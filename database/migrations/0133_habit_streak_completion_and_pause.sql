-- @phase: expand
-- B.21 and B.24 (S05.3e), part two of the habit-streak migration: the writes
-- that move onto the lapse-tolerant model. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md; policy:
-- docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md.
--
-- Split from *_habit_streak_and_autonomy.sql at merge time for the Railway
-- transport cap (23,000 bytes per migration). That file must be applied first:
-- it adds the learning_stats columns, the learning_streak_pauses and
-- learning_pace_preferences tables and the habit_streak_advance and
-- learning_streak_paused_dates helpers every function below calls.
--
-- Everything is additive: complete_lesson is replaced with the same
-- signature, the same writes and every existing result key, plus two new keys
-- (`streak`, `pace`), which a running Core ignores;
-- record_learning_practice_day, set_learning_streak_pause and
-- cancel_learning_streak_pause are new, service role only.

-- ── complete_lesson, now on the habit model ────────────────────────────────
-- Same signature, writes and result keys as *_lesson_replay_receipt.sql; the
-- only behavioural change is the streak (and the two new result keys).
CREATE OR REPLACE FUNCTION public.complete_lesson(
    p_user_id uuid, p_lesson_id uuid, p_run_id uuid,
    p_score int, p_passed boolean, p_xp int, p_minutes int, p_local_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats public.learning_stats%ROWTYPE;
    v_progress public.lesson_progress%ROWTYPE;
    v_result jsonb;
    v_delta int;
    v_new_pass boolean;
    v_streak jsonb;
    v_current int;
    v_best int;
    v_last date;
    v_day_passed int;
    v_kind text;
    v_prior_best int;
    v_notice text;
BEGIN
    IF p_score IS NULL OR p_score NOT BETWEEN 0 AND 100
       OR p_xp IS NULL OR p_xp < 0 OR p_minutes IS NULL
       OR p_minutes NOT BETWEEN 0 AND 120 OR p_passed IS NULL
       OR p_local_date IS NULL THEN
        RAISE EXCEPTION 'Invalid completion input';
    END IF;

    -- The stats row serializes different lessons for the same learner as well
    -- as retries of one lesson, across every Core replica.
    SELECT * INTO STRICT v_stats FROM public.learning_stats
    WHERE user_id = p_user_id FOR UPDATE;

    SELECT result INTO v_result FROM public.lesson_completion_receipts
    WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND run_id = p_run_id;
    IF FOUND THEN
        RETURN v_result || jsonb_build_object('replayed', true);
    END IF;

    SELECT * INTO v_progress FROM public.lesson_progress
    WHERE user_id = p_user_id AND lesson_id = p_lesson_id FOR UPDATE;
    v_delta := GREATEST(0, p_xp - COALESCE(v_progress.xp_earned, 0));
    v_new_pass := p_passed AND NOT COALESCE(v_progress.passed, false);

    -- B.21: only a passed lesson is a practised day.
    IF p_passed THEN
        v_streak := public.habit_streak_advance(
            v_stats.streak_days, v_stats.longest_streak, v_stats.last_active_date,
            v_stats.rest_days_used, v_stats.days_practiced, p_local_date,
            public.learning_streak_paused_dates(p_user_id, v_stats.last_active_date, p_local_date));
    ELSE
        v_streak := jsonb_build_object('current', v_stats.streak_days,
            'best', GREATEST(v_stats.longest_streak, v_stats.streak_days),
            'last_active_date', v_stats.last_active_date, 'rest_days_used', v_stats.rest_days_used,
            'days_practiced', v_stats.days_practiced, 'outcome', 'not_practised', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    v_current := (v_streak->>'current')::int;
    v_best := (v_streak->>'best')::int;
    v_last := (v_streak->>'last_active_date')::date;
    -- B.24: lessons passed on the learner's current day, for their chosen pace.
    v_day_passed := CASE
        WHEN NOT p_passed THEN v_stats.day_lessons_passed
        WHEN v_stats.last_active_date = p_local_date THEN v_stats.day_lessons_passed + 1
        WHEN v_stats.last_active_date IS NULL OR v_stats.last_active_date < p_local_date THEN 1
        ELSE v_stats.day_lessons_passed END;

    -- B.5: classify this run against the course-level record it is about to
    -- update (lesson_progress). Placement credits live in their own table and
    -- never lower anything here, so a credited lesson's first run is 'first'.
    v_kind := CASE
        WHEN v_progress.user_id IS NULL OR (COALESCE(v_progress.attempts, 0) = 0 AND NOT COALESCE(v_progress.passed, false)) THEN 'first'
        WHEN v_progress.passed THEN 'replay'
        ELSE 'retry' END;
    v_prior_best := CASE WHEN v_kind = 'first' THEN NULL ELSE COALESCE(v_progress.best_score, 0) END;
    v_notice := CASE
        WHEN v_prior_best IS NOT NULL AND p_score < v_prior_best THEN 'best_kept'
        WHEN v_prior_best IS NOT NULL AND p_score > v_prior_best THEN 'new_best'
        ELSE 'none' END;

    INSERT INTO public.lesson_progress
        (user_id, lesson_id, best_score, passed, attempts, xp_earned, completed_at)
    VALUES (p_user_id, p_lesson_id, GREATEST(COALESCE(v_progress.best_score, 0), p_score),
        COALESCE(v_progress.passed, false) OR p_passed,
        COALESCE(v_progress.attempts, 0) + 1,
        GREATEST(COALESCE(v_progress.xp_earned, 0), p_xp), now())
    ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        best_score = EXCLUDED.best_score, passed = EXCLUDED.passed,
        attempts = EXCLUDED.attempts, xp_earned = EXCLUDED.xp_earned,
        completed_at = EXCLUDED.completed_at;

    UPDATE public.learning_stats SET
        xp_points = xp_points + v_delta,
        minutes_learned = minutes_learned + p_minutes,
        lessons_completed = lessons_completed + v_new_pass::int,
        streak_days = v_current,
        longest_streak = GREATEST(longest_streak, v_best),
        last_active_date = v_last,
        rest_days_used = (v_streak->>'rest_days_used')::int,
        days_practiced = (v_streak->>'days_practiced')::int,
        day_lessons_passed = v_day_passed
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
        'score', p_score, 'passed', p_passed,
        'best_score', GREATEST(COALESCE(v_progress.best_score, 0), p_score),
        'xp_earned', GREATEST(COALESCE(v_progress.xp_earned, 0), p_xp),
        'xp_delta', v_delta, 'streak_days', v_current,
        'longest_streak', GREATEST(v_stats.longest_streak, v_best),
        'streak_extended', v_current > v_stats.streak_days,
        'first_today', p_passed AND v_stats.last_active_date IS DISTINCT FROM p_local_date,
        'minutes_learned', v_stats.minutes_learned + p_minutes,
        'lessons_completed', v_stats.lessons_completed + v_new_pass::int,
        'first_completion', v_new_pass AND v_stats.lessons_completed = 0,
        'replayed', false,
        'replay', jsonb_build_object(
            'kind', v_kind,
            'previous_best_score', v_prior_best,
            'best_score_kept', v_prior_best IS NOT NULL AND p_score < v_prior_best,
            'notice', v_notice,
            'xp_policy', 'improvement_only'),
        -- B.21: what happened to the streak, server-authored. `milestone` is
        -- the only thing about a streak the result screen may celebrate.
        'streak', jsonb_build_object(
            'model', 'rest-days-v1',
            'outcome', v_streak->>'outcome',
            'rest_days_bridged', (v_streak->>'rest_days_bridged')::int,
            'rest_days_left', 2 - (v_streak->>'rest_days_used')::int,
            'milestone', v_streak->'milestone',
            'days_practiced', (v_streak->>'days_practiced')::int,
            'best', GREATEST(v_stats.longest_streak, v_best),
            'run_before', v_stats.streak_days),
        -- B.24: the learner's day so far; Core compares it with their chosen pace.
        'pace', jsonb_build_object(
            'lessons_passed_today', CASE WHEN v_last = p_local_date THEN v_day_passed ELSE 0 END));
    IF p_run_id IS NOT NULL THEN
        INSERT INTO public.lesson_completion_receipts VALUES (p_user_id, p_lesson_id, p_run_id, v_result);
    END IF;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date) TO service_role;

-- ── Onboarding's day one, on the same model and under the same row lock ────
-- POST /onboarding/complete used to read-modify-write the stats row with the
-- legacy rule. It now advances the streak here, atomically, and touches
-- nothing else.
CREATE OR REPLACE FUNCTION public.record_learning_practice_day(p_user_id uuid, p_local_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats public.learning_stats%ROWTYPE;
    v_streak jsonb;
BEGIN
    IF p_user_id IS NULL OR p_local_date IS NULL THEN
        RAISE EXCEPTION 'Invalid practice day' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.learning_stats (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO STRICT v_stats FROM public.learning_stats WHERE user_id = p_user_id FOR UPDATE;
    v_streak := public.habit_streak_advance(
        v_stats.streak_days, v_stats.longest_streak, v_stats.last_active_date,
        v_stats.rest_days_used, v_stats.days_practiced, p_local_date,
        public.learning_streak_paused_dates(p_user_id, v_stats.last_active_date, p_local_date));
    UPDATE public.learning_stats SET
        streak_days = (v_streak->>'current')::int,
        longest_streak = GREATEST(longest_streak, (v_streak->>'best')::int),
        last_active_date = (v_streak->>'last_active_date')::date,
        rest_days_used = (v_streak->>'rest_days_used')::int,
        days_practiced = (v_streak->>'days_practiced')::int,
        day_lessons_passed = CASE WHEN v_stats.last_active_date IS DISTINCT FROM (v_streak->>'last_active_date')::date
                                  THEN 0 ELSE day_lessons_passed END
    WHERE user_id = p_user_id;
    RETURN v_streak;
END;
$$;

REVOKE ALL ON FUNCTION public.record_learning_practice_day(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_learning_practice_day(uuid, date) TO service_role;

-- ── The guardian's pause: set and cancel ───────────────────────────────────
-- One open pause per learner (a later call replaces it). Both functions
-- re-check the verified guardian link Core has already checked, so a
-- regressed Core still cannot pause someone else's child.
CREATE OR REPLACE FUNCTION public.set_learning_streak_pause(
    p_guardian_id uuid, p_learner_id uuid, p_starts_on date, p_ends_on date, p_today date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_guardian_id IS NULL OR p_learner_id IS NULL OR p_starts_on IS NULL OR p_ends_on IS NULL OR p_today IS NULL THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.parent_user_id = p_guardian_id AND gl.kid_user_id = p_learner_id
          AND gl.verification_status = 'verified'
    ) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;
    IF p_ends_on < p_starts_on OR p_ends_on - p_starts_on > 20
       OR p_starts_on < p_today - 7 OR p_starts_on > p_today + 60 THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;
    -- Serialize with completions of the same learner.
    PERFORM 1 FROM public.learning_stats WHERE user_id = p_learner_id FOR UPDATE;
    UPDATE public.learning_streak_pauses SET cancelled_at = now()
    WHERE learner_id = p_learner_id AND cancelled_at IS NULL AND ends_on >= p_today;
    INSERT INTO public.learning_streak_pauses (learner_id, starts_on, ends_on, set_by)
    VALUES (p_learner_id, p_starts_on, p_ends_on, p_guardian_id)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('status', 'set', 'id', v_id, 'starts_on', p_starts_on, 'ends_on', p_ends_on);
END;
$$;

REVOKE ALL ON FUNCTION public.set_learning_streak_pause(uuid, uuid, date, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_learning_streak_pause(uuid, uuid, date, date, date) TO service_role;

-- Cancelling keeps the days already paused (they were a promise) and drops the rest.
CREATE OR REPLACE FUNCTION public.cancel_learning_streak_pause(p_guardian_id uuid, p_learner_id uuid, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_changed int := 0;
    v_step int;
BEGIN
    IF p_guardian_id IS NULL OR p_learner_id IS NULL OR p_today IS NULL THEN
        RETURN jsonb_build_object('status', 'invalid');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.parent_user_id = p_guardian_id AND gl.kid_user_id = p_learner_id
          AND gl.verification_status = 'verified'
    ) THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;
    PERFORM 1 FROM public.learning_stats WHERE user_id = p_learner_id FOR UPDATE;
    -- Not started yet: void it.
    UPDATE public.learning_streak_pauses SET cancelled_at = now()
    WHERE learner_id = p_learner_id AND cancelled_at IS NULL AND starts_on >= p_today;
    GET DIAGNOSTICS v_step = ROW_COUNT;
    v_changed := v_changed + v_step;
    -- Already running: end it yesterday.
    UPDATE public.learning_streak_pauses SET ends_on = p_today - 1
    WHERE learner_id = p_learner_id AND cancelled_at IS NULL AND starts_on < p_today AND ends_on >= p_today;
    GET DIAGNOSTICS v_step = ROW_COUNT;
    v_changed := v_changed + v_step;
    RETURN jsonb_build_object('status', CASE WHEN v_changed > 0 THEN 'cancelled' ELSE 'none' END);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_learning_streak_pause(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_learning_streak_pause(uuid, uuid, date) TO service_role;

SELECT 'migration_habit_streak_completion_and_pause_ok' AS sentinel;
