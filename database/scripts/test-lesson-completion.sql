-- Run with psql -v ON_ERROR_STOP=1 on an isolated, fully migrated test database.
-- All fixtures and the failure-injection trigger are rolled back.
BEGIN;

INSERT INTO auth.users (id) VALUES ('e1830000-0000-4000-8000-000000000001');
-- Reuse one lesson only as a foreign-key target; its content is never changed.
-- The isolated database must contain a seeded course.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.lessons) THEN
        RAISE EXCEPTION 'Seed a lesson in the isolated test database first';
    END IF;
END $$;

CREATE FUNCTION public.qa_reject_completion_stats() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.user_id = 'e1830000-0000-4000-8000-000000000001' THEN
        RAISE EXCEPTION 'Injected statistics failure';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER qa_reject_completion_stats BEFORE UPDATE ON public.learning_stats
FOR EACH ROW EXECUTE FUNCTION public.qa_reject_completion_stats();

DO $$
DECLARE
    v_user uuid := 'e1830000-0000-4000-8000-000000000001';
    v_lesson uuid := (SELECT id FROM public.lessons LIMIT 1);
    v_failed boolean := false;
BEGIN
    BEGIN
        PERFORM public.complete_lesson(v_user, v_lesson,
            'e1830000-0000-4000-8000-000000000002', 100, true, 20, 5, '2026-09-16');
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Injected statistics failure' THEN RAISE; END IF;
        v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'Failure injection did not execute'; END IF;
    IF EXISTS (SELECT 1 FROM public.lesson_progress WHERE user_id = v_user)
       OR EXISTS (SELECT 1 FROM public.lesson_completion_receipts WHERE user_id = v_user)
       OR EXISTS (SELECT 1 FROM public.learning_stats WHERE user_id = v_user AND xp_points <> 0) THEN
        RAISE EXCEPTION 'Partial completion escaped rollback';
    END IF;
END $$;

DROP TRIGGER qa_reject_completion_stats ON public.learning_stats;
DO $$
DECLARE
    v_user uuid := 'e1830000-0000-4000-8000-000000000001';
    v_lesson uuid := (SELECT id FROM public.lessons LIMIT 1);
    v_run uuid := 'e1830000-0000-4000-8000-000000000002';
    v_first jsonb;
    v_retry jsonb;
BEGIN
    v_first := public.complete_lesson(v_user, v_lesson, v_run, 100, true, 20, 5, '2026-09-16');
    v_retry := public.complete_lesson(v_user, v_lesson, v_run, 0, false, 0, 120, '2026-09-17');
    IF v_first <> (v_retry || '{"replayed":false}'::jsonb) THEN
        RAISE EXCEPTION 'Replay changed the committed outcome';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.learning_stats WHERE user_id = v_user
        AND xp_points = 20 AND lessons_completed = 1 AND minutes_learned = 5
        AND streak_days = 1 AND longest_streak = 1) THEN
        RAISE EXCEPTION 'Retry lost or duplicated rewards';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lesson_progress WHERE user_id = v_user AND attempts = 1) THEN
        RAISE EXCEPTION 'Retry duplicated attempts';
    END IF;
    IF has_function_privilege('authenticated', 'public.complete_lesson(uuid,uuid,uuid,integer,boolean,integer,integer,date)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.complete_lesson(uuid,uuid,uuid,integer,boolean,integer,integer,date)', 'EXECUTE') THEN
        RAISE EXCEPTION 'A browser role can forge rewards';
    END IF;
END $$;
ROLLBACK;
