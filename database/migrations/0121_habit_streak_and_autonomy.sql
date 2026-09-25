-- @phase: expand
-- B.21 and B.24 (S05.3e): the lapse-tolerant learning streak, the guardian's
-- holiday pause and the learner's pace choice. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md; policy:
-- docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md.
--
-- The streak model (Frontend Bible 02 §9.6, Product 10 B.21):
--   * a streak counts practised days in a row (a passed lesson on that local
--     date, as since 0009);
--   * two rest days per ISO week (Monday to Sunday) are free and automatic: a
--     missed day inside the run is a rest day, and the run breaks only when a
--     week holds a third missed day. A rest day keeps the run, it does not add
--     to it;
--   * a verified guardian may pause the streak for a holiday: a paused day is
--     neither practised nor missed;
--   * the best streak and the days practised are permanent;
--   * only 7, 30 and 100 are milestones (OD-7);
--   * a date earlier than the last practised day changes nothing (the legacy
--     rule restarted the run over a device clock).
--
-- habit_streak_advance below is the SQL twin of
-- backend/src/services/habitStreak.ts; both are pinned by the shared vectors
-- in database/scripts/habit-streak-vectors.json (Core runs them in its tests,
-- database/scripts/test-habit-streak.sql runs them here).
--
-- OD-9: nothing a learner was promised is lost. streak_days and
-- longest_streak keep their values and meaning (the live run and the best).
-- days_practiced is new; it is backfilled with the best lower bound the
-- stored data supports (see the UPDATE below) and only ever grows.
--
-- Everything is additive: new columns with defaults, new tables with RLS and
-- no browser write path, new functions, and complete_lesson replaced with the
-- same signature, the same writes and every existing result key, plus two new
-- keys (`streak`, `pace`). A running Core ignores the new keys.

-- ── learning_stats: the model's state ──────────────────────────────────────
ALTER TABLE public.learning_stats
    ADD COLUMN IF NOT EXISTS rest_days_used smallint NOT NULL DEFAULT 0
        CONSTRAINT learning_stats_rest_days_used_range CHECK (rest_days_used BETWEEN 0 AND 2),
    ADD COLUMN IF NOT EXISTS days_practiced integer NOT NULL DEFAULT 0
        CONSTRAINT learning_stats_days_practiced_nonneg CHECK (days_practiced >= 0),
    ADD COLUMN IF NOT EXISTS day_lessons_passed smallint NOT NULL DEFAULT 0
        CONSTRAINT learning_stats_day_lessons_passed_nonneg CHECK (day_lessons_passed >= 0);

COMMENT ON COLUMN public.learning_stats.rest_days_used IS
    'B.21: rest days the current streak run has used in the ISO week of last_active_date (0-2).';
COMMENT ON COLUMN public.learning_stats.days_practiced IS
    'B.21: every practised day ever. Permanent; backfilled at migration as a lower bound.';
COMMENT ON COLUMN public.learning_stats.day_lessons_passed IS
    'B.24: lessons passed on last_active_date, compared with the learner''s chosen daily pace.';

-- The lower bound: the longest run ever, and the distinct local-ish dates of
-- each lesson's latest completion (lesson_progress keeps one completion per
-- lesson). The true count can only be higher, so the backfill never
-- overstates what a learner did.
UPDATE public.learning_stats s SET days_practiced = GREATEST(
    s.days_practiced, s.streak_days, COALESCE(s.longest_streak, 0),
    COALESCE((SELECT count(DISTINCT p.completed_at::date)::int FROM public.lesson_progress p
              WHERE p.user_id = s.user_id AND p.passed AND p.completed_at IS NOT NULL), 0))
WHERE s.days_practiced = 0;

-- ── The guardian's holiday pause ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_streak_pauses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    starts_on    date NOT NULL,
    ends_on      date NOT NULL,
    set_by       uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz NULL,
    CONSTRAINT learning_streak_pauses_order CHECK (ends_on >= starts_on),
    -- At most 21 days per pause (a proposal in the policy; Core repeats it).
    CONSTRAINT learning_streak_pauses_length CHECK (ends_on - starts_on <= 20)
);
CREATE INDEX IF NOT EXISTS learning_streak_pauses_learner_idx
    ON public.learning_streak_pauses (learner_id, ends_on DESC);

ALTER TABLE public.learning_streak_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_streak_pauses_select_party ON public.learning_streak_pauses;
CREATE POLICY learning_streak_pauses_select_party ON public.learning_streak_pauses
    FOR SELECT USING (learner_id = auth.uid() OR public.is_verified_guardian_of(learner_id));
-- No INSERT/UPDATE/DELETE policy: only the two functions below write, for a
-- verified guardian Core has already checked, and they check again.

-- ── The learner's pace (B.24) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_pace_preferences (
    user_id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    daily_lesson_goal smallint NOT NULL
        CONSTRAINT learning_pace_preferences_goal CHECK (daily_lesson_goal BETWEEN 1 AND 3),
    chosen_at         timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_pace_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_pace_preferences_select_party ON public.learning_pace_preferences;
CREATE POLICY learning_pace_preferences_select_party ON public.learning_pace_preferences
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- Written by Core (service role) for the learner themselves; no browser write policy.

-- ── The pure model ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.habit_streak_advance(
    p_current int, p_best int, p_last date, p_rest_used int, p_days_practiced int,
    p_today date, p_paused date[]
)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_best int := GREATEST(COALESCE(p_best, 0), COALESCE(p_current, 0));
    v_days int := COALESCE(p_days_practiced, 0);
    v_day date;
    v_week date;
    v_scan_week date;
    v_count int;
    v_missed int := 0;
    v_ok boolean := true;
    v_next int;
    v_rest int;
    v_outcome text;
BEGIN
    IF p_today IS NULL THEN
        RAISE EXCEPTION 'habit_streak_advance needs a date' USING ERRCODE = '22023';
    END IF;
    IF p_last IS NULL THEN
        RETURN jsonb_build_object('current', 1, 'best', GREATEST(v_best, 1), 'last_active_date', p_today,
            'rest_days_used', 0, 'days_practiced', v_days + 1, 'outcome', 'first', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    IF p_today = p_last THEN
        v_next := GREATEST(COALESCE(p_current, 0), 1);
        RETURN jsonb_build_object('current', v_next, 'best', GREATEST(v_best, v_next), 'last_active_date', p_last,
            'rest_days_used', LEAST(GREATEST(COALESCE(p_rest_used, 0), 0), 2), 'days_practiced', v_days,
            'outcome', 'same_day', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    IF p_today < p_last THEN
        RETURN jsonb_build_object('current', COALESCE(p_current, 0), 'best', v_best, 'last_active_date', p_last,
            'rest_days_used', LEAST(GREATEST(COALESCE(p_rest_used, 0), 0), 2), 'days_practiced', v_days,
            'outcome', 'earlier_date', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;

    -- Scan the days strictly between the last practised day and today.
    v_scan_week := date_trunc('week', p_last::timestamp)::date;
    v_count := LEAST(GREATEST(COALESCE(p_rest_used, 0), 0), 2);
    v_day := p_last + 1;
    WHILE v_day < p_today LOOP
        IF p_paused IS NULL OR NOT (v_day = ANY (p_paused)) THEN
            v_week := date_trunc('week', v_day::timestamp)::date;
            IF v_week <> v_scan_week THEN
                v_scan_week := v_week;
                v_count := 0;
            END IF;
            v_count := v_count + 1;
            v_missed := v_missed + 1;
            IF v_count > 2 THEN
                v_ok := false;
                EXIT;
            END IF;
        END IF;
        v_day := v_day + 1;
    END LOOP;

    IF NOT v_ok THEN
        RETURN jsonb_build_object('current', 1, 'best', GREATEST(v_best, 1), 'last_active_date', p_today,
            'rest_days_used', 0, 'days_practiced', v_days + 1, 'outcome', 'restarted', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    v_next := COALESCE(p_current, 0) + 1;
    v_rest := CASE WHEN v_scan_week = date_trunc('week', p_today::timestamp)::date THEN v_count ELSE 0 END;
    v_outcome := CASE WHEN v_missed > 0 THEN 'bridged' ELSE 'extended' END;
    RETURN jsonb_build_object('current', v_next, 'best', GREATEST(v_best, v_next), 'last_active_date', p_today,
        'rest_days_used', v_rest, 'days_practiced', v_days + 1, 'outcome', v_outcome,
        'rest_days_bridged', v_missed,
        'milestone', CASE WHEN v_next IN (7, 30, 100) THEN v_next END);
END;
$$;

REVOKE ALL ON FUNCTION public.habit_streak_advance(int, int, date, int, int, date, date[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.habit_streak_advance(int, int, date, int, int, date, date[]) TO service_role;

-- The paused days strictly between two dates, from pauses that are not cancelled.
CREATE OR REPLACE FUNCTION public.learning_streak_paused_dates(p_user_id uuid, p_after date, p_before date)
RETURNS date[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(DISTINCT d::date ORDER BY d::date), ARRAY[]::date[])
    FROM public.learning_streak_pauses p,
         generate_series(GREATEST(p.starts_on, p_after + 1), LEAST(p.ends_on, p_before - 1), interval '1 day') AS d
    WHERE p_after IS NOT NULL AND p_before IS NOT NULL
      AND p.learner_id = p_user_id AND p.cancelled_at IS NULL
      AND p.ends_on > p_after AND p.starts_on < p_before
$$;

REVOKE ALL ON FUNCTION public.learning_streak_paused_dates(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_streak_paused_dates(uuid, date, date) TO service_role;

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

SELECT 'migration_habit_streak_and_autonomy_ok' AS sentinel;
