-- @phase: expand
-- B.5 (S05.3d): the authenticated replay receipt and XP policy. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md.
--
-- complete_lesson (0083) already kept the course-level best score and paid
-- XP only for the improvement over the kept XP, but it said neither: the
-- result screen had to guess whether a lower run had cost the learner
-- anything. This replacement keeps every argument, every write and every
-- existing result key byte for byte, and adds one server-authored `replay`
-- object to the result and to the stored receipt:
--
--   kind                'first' (no earlier completion of this lesson),
--                       'retry' (earlier completions, never passed) or
--                       'replay' (the lesson was already passed).
--   previous_best_score The course-level best before this run, or null.
--   best_score_kept     true when this run scored below that kept best, so
--                       the kept best is unchanged.
--   notice              'best_kept' when the result screen must say the saved
--                       best is unaffected (Product 10 B.5), 'new_best' when
--                       this run raised it, otherwise 'none'.
--   xp_policy           'improvement_only': a run adds XP only above the XP
--                       already kept for this lesson. A replay can never lower
--                       XP or the best score, and repeating a lesson can never
--                       farm XP. The rule itself is unchanged from 0083.
--
-- complete_v2_lesson (0104) is replaced with the same signature. It passed a
-- constant 100 as the score, so the kept best of a v2 lesson meant nothing.
-- It now passes the run's first-try accuracy over the required segments (the
-- earliest receipt of each, since a review retry is never a penalty but is not
-- a first try either) and stores three client-safe facts on the receipt:
-- first_try_correct, graded_count and the B.12 judgment summary (counts of
-- sound, partial and unsupported reasons on the first try of each reasoning
-- segment). Completion still requires a met receipt for every required
-- segment, so "passed" is unchanged.

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
    v_streak int;
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
    v_streak := v_stats.streak_days;
    IF p_passed THEN
        v_streak := CASE
            WHEN v_stats.last_active_date = p_local_date THEN GREATEST(1, v_stats.streak_days)
            WHEN v_stats.last_active_date = p_local_date - 1 THEN v_stats.streak_days + 1
            ELSE 1 END;
    END IF;

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
        streak_days = v_streak,
        longest_streak = GREATEST(longest_streak, v_streak),
        last_active_date = CASE WHEN p_passed THEN p_local_date ELSE last_active_date END
    WHERE user_id = p_user_id;

    v_result := jsonb_build_object(
        'score', p_score, 'passed', p_passed,
        'best_score', GREATEST(COALESCE(v_progress.best_score, 0), p_score),
        'xp_earned', GREATEST(COALESCE(v_progress.xp_earned, 0), p_xp),
        'xp_delta', v_delta, 'streak_days', v_streak,
        'longest_streak', GREATEST(v_stats.longest_streak, v_streak),
        'streak_extended', v_streak > v_stats.streak_days,
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
            'xp_policy', 'improvement_only'));
    IF p_run_id IS NOT NULL THEN
        INSERT INTO public.lesson_completion_receipts VALUES (p_user_id, p_lesson_id, p_run_id, v_result);
    END IF;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_v2_lesson(
    p_user_id uuid,
    p_lesson_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_required_segment_ids text[],
    p_xp int,
    p_minutes int,
    p_local_date date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_run public.lesson_v2_runs%ROWTYPE;
    v_result jsonb;
    v_extras jsonb;
    v_expected int;
    v_met int;
    v_first_correct int;
    v_sound int;
    v_partial int;
    v_unsupported int;
    v_score int;
BEGIN
    IF p_user_id IS NULL OR p_lesson_id IS NULL OR p_run_id IS NULL OR p_document_version_id IS NULL
       OR p_required_segment_ids IS NULL OR cardinality(p_required_segment_ids) = 0
       OR cardinality(ARRAY(SELECT DISTINCT unnest(p_required_segment_ids))) <> cardinality(p_required_segment_ids)
       OR EXISTS (SELECT 1 FROM unnest(p_required_segment_ids) AS id WHERE id IS NULL OR length(id) = 0)
       OR p_xp IS NULL OR p_xp < 0 OR p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 120 OR p_local_date IS NULL THEN
        RAISE EXCEPTION 'Invalid v2 completion input' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR v_run.user_id <> p_user_id OR v_run.lesson_id <> p_lesson_id
       OR v_run.document_version_id <> p_document_version_id THEN
        RAISE EXCEPTION 'Invalid v2 lesson run' USING ERRCODE = '22023';
    END IF;

    v_expected := cardinality(p_required_segment_ids);
    SELECT count(DISTINCT segment_id) INTO v_met FROM public.lesson_v2_grade_receipts
    WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
      AND segment_id = ANY(p_required_segment_ids)
      AND verdict->>'correct' = 'true' AND verdict->>'score' = '100';
    IF v_met <> v_expected THEN
        RAISE EXCEPTION 'V2 lesson has pending learning steps' USING ERRCODE = '22023';
    END IF;

    -- The first receipt of each required segment is its first try. The run
    -- row lock above serializes this with every grade of the same run.
    SELECT count(*) FILTER (WHERE first_try.verdict->>'correct' = 'true'),
           count(*) FILTER (WHERE first_try.verdict->'judgment'->>'quality' = 'sound'),
           count(*) FILTER (WHERE first_try.verdict->'judgment'->>'quality' = 'partial'),
           count(*) FILTER (WHERE first_try.verdict->'judgment'->>'quality' = 'unsupported')
      INTO v_first_correct, v_sound, v_partial, v_unsupported
      FROM (
        SELECT DISTINCT ON (segment_id) segment_id, verdict
        FROM public.lesson_v2_grade_receipts
        WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
          AND segment_id = ANY(p_required_segment_ids)
        ORDER BY segment_id, created_at, jti
      ) AS first_try;
    v_score := round(100.0 * v_first_correct / v_expected)::int;

    v_result := public.complete_lesson(p_user_id, p_lesson_id, p_run_id, v_score, true, p_xp, p_minutes, p_local_date);
    UPDATE public.lesson_v2_runs SET completed_at = COALESCE(completed_at, now()) WHERE id = p_run_id;
    IF v_result->>'replayed' = 'true' THEN
        RETURN v_result;
    END IF;

    v_extras := jsonb_build_object(
        'first_try_correct', v_first_correct,
        'graded_count', v_expected,
        'judgment', jsonb_build_object(
            'assessed', v_sound + v_partial + v_unsupported,
            'sound', v_sound, 'partial', v_partial, 'unsupported', v_unsupported));
    UPDATE public.lesson_completion_receipts SET result = result || v_extras
    WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND run_id = p_run_id;
    RETURN v_result || v_extras;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_v2_lesson(uuid, uuid, uuid, uuid, text[], int, int, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_v2_lesson(uuid, uuid, uuid, uuid, text[], int, int, date) TO service_role;
