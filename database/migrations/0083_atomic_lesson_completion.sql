-- @phase: expand
-- Commit progress, rewards and the run receipt together. A lost HTTP response
-- can be retried without adding minutes, attempts or rewards a second time.
CREATE TABLE IF NOT EXISTS public.lesson_completion_receipts (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    run_id uuid NOT NULL,
    result jsonb NOT NULL,
    PRIMARY KEY (user_id, lesson_id, run_id)
);
ALTER TABLE public.lesson_completion_receipts ENABLE ROW LEVEL SECURITY;

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
        'replayed', false);
    IF p_run_id IS NOT NULL THEN
        INSERT INTO public.lesson_completion_receipts VALUES (p_user_id, p_lesson_id, p_run_id, v_result);
    END IF;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date) TO service_role;
