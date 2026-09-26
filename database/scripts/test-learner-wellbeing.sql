-- S05.3f (B.23, B.28): physical checks for *_learner_registers.sql and
-- *_engagement_health.sql. Run from the repository root with
--   psql -v ON_ERROR_STOP=1 -f database/scripts/test-learner-wellbeing.sql
-- on an isolated, fully migrated test database that has at least one lesson.
-- Everything is rolled back.
BEGIN;

INSERT INTO auth.users (id) VALUES
    ('f5300000-0000-4000-8000-000000000001'),  -- a learner seen at 9, now 10
    ('f5300000-0000-4000-8000-000000000002'),  -- a teen who arrived at 15
    ('f5300000-0000-4000-8000-000000000003');  -- an adult learner

-- 1. The register history: first sighting only, graduations owed and acknowledged once.
DO $$
DECLARE
    v_kid uuid := 'f5300000-0000-4000-8000-000000000001';
    v_teen uuid := 'f5300000-0000-4000-8000-000000000002';
    v_noted jsonb;
    v_first timestamptz;
BEGIN
    v_noted := public.note_learner_register(v_kid, 'young');
    IF v_noted <> '{"seen": ["young"], "acknowledged": []}'::jsonb THEN RAISE EXCEPTION 'first sighting: %', v_noted; END IF;
    PERFORM public.note_learner_register(v_kid, 'young');
    IF (SELECT count(*) FROM public.learner_register_history WHERE user_id = v_kid) <> 1 THEN RAISE EXCEPTION 'a second sighting wrote a row'; END IF;
    -- The first sighting of the next register is later than the first.
    UPDATE public.learner_register_history SET first_seen_at = now() - interval '1 year' WHERE user_id = v_kid;
    v_noted := public.note_learner_register(v_kid, 'transition');
    IF v_noted->'seen' <> '["young", "transition"]'::jsonb OR v_noted->'acknowledged' <> '[]'::jsonb THEN RAISE EXCEPTION 'graduation owed: %', v_noted; END IF;

    IF public.acknowledge_learner_graduation(v_kid, 'teen') THEN RAISE EXCEPTION 'acknowledged a register never seen'; END IF;
    IF public.acknowledge_learner_graduation(v_kid, 'young') THEN RAISE EXCEPTION 'acknowledged the youngest register'; END IF;
    IF NOT public.acknowledge_learner_graduation(v_kid, 'transition') THEN RAISE EXCEPTION 'could not acknowledge'; END IF;
    SELECT graduation_acknowledged_at INTO v_first FROM public.learner_register_history WHERE user_id = v_kid AND register = 'transition';
    IF NOT public.acknowledge_learner_graduation(v_kid, 'transition') THEN RAISE EXCEPTION 'a retry was refused'; END IF;
    IF (SELECT graduation_acknowledged_at FROM public.learner_register_history WHERE user_id = v_kid AND register = 'transition') <> v_first THEN
        RAISE EXCEPTION 'a retry moved the acknowledgement';
    END IF;
    IF public.note_learner_register(v_kid, 'transition')->'acknowledged' <> '["transition"]'::jsonb THEN RAISE EXCEPTION 'acknowledgement not reported'; END IF;

    -- A teen who arrived at 15 owes nothing.
    PERFORM public.note_learner_register(v_teen, 'teen');
    IF public.acknowledge_learner_graduation(v_teen, 'teen') THEN RAISE EXCEPTION 'a graduation with no younger register'; END IF;

    BEGIN
        PERFORM public.note_learner_register(v_teen, 'toddler');
        RAISE EXCEPTION 'an unknown register was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
        INSERT INTO public.learner_register_history (user_id, register) VALUES (v_teen, 'baby');
        RAISE EXCEPTION 'the register CHECK let an unknown value in';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;

-- 2. No browser role can execute the functions or write the table; RLS is on.
DO $$
BEGIN
    IF has_function_privilege('authenticated', 'public.note_learner_register(uuid, text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.note_learner_register(uuid, text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.acknowledge_learner_graduation(uuid, text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.learning_session_efficiency(timestamptz, timestamptz)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.mentor_resolution_efficiency(timestamptz, timestamptz)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.learner_register_history', 'INSERT')
       OR has_table_privilege('authenticated', 'public.learner_register_history', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.learner_register_history', 'DELETE') THEN
        RAISE EXCEPTION 'a browser role can execute a service function or write the register history';
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.learner_register_history'::regclass) THEN
        RAISE EXCEPTION 'RLS is off on learner_register_history';
    END IF;
END $$;

-- 3. Session efficiency: graded seconds over visible session seconds, capped, staff excluded.
DO $$
DECLARE
    v_adult uuid := 'f5300000-0000-4000-8000-000000000003';
    v_teen uuid := 'f5300000-0000-4000-8000-000000000002';
    v_lesson uuid := (SELECT id FROM public.lessons LIMIT 1);
    r record;
BEGIN
    INSERT INTO public.learning_events (user_id, role, event, route_class, value) VALUES
        (v_adult, 'universal', 'session_heartbeat', 'learn', 60),
        (v_adult, 'universal', 'session_heartbeat', 'learn', 60),
        (v_teen, 'admin', 'session_heartbeat', 'learn', 60);
    INSERT INTO public.lesson_segment_attempts (user_id, lesson_id, segment_id, attempt_number, score, time_spent_seconds) VALUES
        (v_adult, v_lesson, 's1', 1, 100, 30),
        (v_adult, v_lesson, 's2', 1, 0, 30),
        (v_teen, v_lesson, 's1', 1, 100, 500);
    SELECT * INTO r FROM public.learning_session_efficiency(now() - interval '1 day', now() + interval '1 day');
    IF r.learners <> 1 OR r.graded_seconds <> 60 OR r.session_seconds <> 120 OR r.efficiency_ratio <> 0.5 THEN
        RAISE EXCEPTION 'session efficiency: %', r;
    END IF;
    -- Graded time never exceeds the day's visible time.
    UPDATE public.lesson_segment_attempts SET time_spent_seconds = 900 WHERE user_id = v_adult AND segment_id = 's1';
    SELECT * INTO r FROM public.learning_session_efficiency(now() - interval '1 day', now() + interval '1 day');
    IF r.efficiency_ratio <> 1 THEN RAISE EXCEPTION 'efficiency not capped: %', r; END IF;
END $$;

-- 4. Mentor resolution efficiency: turns of sessions the Mentor closed as done, by intent and overall.
DO $$
DECLARE
    v_adult uuid := 'f5300000-0000-4000-8000-000000000003';
    r record;
BEGIN
    INSERT INTO public.tutor_sessions (user_id, locale, tier, character, diorama, intent, close_reason, turn_count, started_at, ended_at) VALUES
        (v_adult, 'en-US', 3, 'dina', 'diorama-a', 'weak_skill', 'completed', 4, now() - interval '1 hour', now()),
        (v_adult, 'en-US', 3, 'dina', 'diorama-a', 'weak_skill', 'completed', 8, now() - interval '1 hour', now()),
        (v_adult, 'en-US', 3, 'dina', 'diorama-a', 'faq', 'completed', 2, now() - interval '1 hour', now()),
        (v_adult, 'en-US', 3, 'dina', 'diorama-a', 'faq', 'learner_left', 30, now() - interval '1 hour', now());
    SELECT * INTO r FROM public.mentor_resolution_efficiency(now() - interval '1 day', now() + interval '1 day') WHERE intent = 'all';
    IF r.resolved_sessions <> 3 OR r.median_turns <> 4 THEN RAISE EXCEPTION 'overall resolution: %', r; END IF;
    SELECT * INTO r FROM public.mentor_resolution_efficiency(now() - interval '1 day', now() + interval '1 day') WHERE intent = 'weak_skill';
    IF r.resolved_sessions <> 2 OR r.median_turns <> 6 THEN RAISE EXCEPTION 'weak-skill resolution: %', r; END IF;
END $$;

ROLLBACK;
