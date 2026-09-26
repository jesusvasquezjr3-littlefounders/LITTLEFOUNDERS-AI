-- S05.3e (B.21, B.24): physical checks for *_habit_streak_and_autonomy.sql,
-- *_habit_streak_completion_and_pause.sql and
-- *_motivation_events.sql. Run from the repository root with
--   psql -v ON_ERROR_STOP=1 -f database/scripts/test-habit-streak.sql
-- on an isolated, fully migrated test database that has at least one lesson.
-- It reads the shared vectors that Core's tests also run
-- (database/scripts/habit-streak-vectors.json), so the SQL model and
-- backend/src/services/habitStreak.ts are held to the same expectations.
-- Everything is rolled back.
\set vectors `cat database/scripts/habit-streak-vectors.json`
BEGIN;

CREATE TEMP TABLE habit_vectors ON COMMIT DROP AS SELECT :'vectors'::jsonb AS doc;

-- 1. The pure model against every shared "advance" vector.
DO $$
DECLARE
    v jsonb;
    v_state jsonb;
    v_got jsonb;
    v_want jsonb;
    v_paused date[];
    v_checked int := 0;
BEGIN
    FOR v IN SELECT jsonb_array_elements(doc->'advance') FROM habit_vectors LOOP
        v_state := v->'state';
        SELECT COALESCE(array_agg(d::date), ARRAY[]::date[]) INTO v_paused
        FROM jsonb_array_elements(v->'pauses') AS p,
             generate_series((p->>'startsOn')::date, (p->>'endsOn')::date, interval '1 day') AS d;
        v_got := public.habit_streak_advance(
            (v_state->>'current')::int, (v_state->>'best')::int, (v_state->>'lastActiveDate')::date,
            (v_state->>'restDaysUsed')::int, (v_state->>'daysPracticed')::int, (v->>'today')::date, v_paused);
        v_want := v->'expect';
        IF (v_got->>'current')::int <> (v_want->>'current')::int
           OR (v_got->>'best')::int <> (v_want->>'best')::int
           OR (v_got->>'last_active_date') IS DISTINCT FROM (v_want->>'lastActiveDate')
           OR (v_got->>'rest_days_used')::int <> (v_want->>'restDaysUsed')::int
           OR (v_got->>'days_practiced')::int <> (v_want->>'daysPracticed')::int
           OR v_got->>'outcome' <> v_want->>'outcome'
           OR (v_got->>'rest_days_bridged')::int <> (v_want->>'restDaysBridged')::int
           OR (v_got->'milestone') IS DISTINCT FROM (v_want->'milestone') THEN
            RAISE EXCEPTION 'Vector "%" failed: got %, want %', v->>'name', v_got, v_want;
        END IF;
        v_checked := v_checked + 1;
    END LOOP;
    IF v_checked < 20 THEN RAISE EXCEPTION 'Only % vectors checked', v_checked; END IF;
    RAISE NOTICE 'habit_streak_advance: % shared vectors passed', v_checked;
END $$;

INSERT INTO auth.users (id) VALUES
    ('e5300000-0000-4000-8000-000000000001'),  -- kid
    ('e5300000-0000-4000-8000-000000000002'),  -- verified guardian
    ('e5300000-0000-4000-8000-000000000003'),  -- unrelated adult
    ('e5300000-0000-4000-8000-000000000004');  -- pending (unverified) guardian
INSERT INTO public.learning_stats (user_id) VALUES ('e5300000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status) VALUES
    ('e5300000-0000-4000-8000-000000000002', 'e5300000-0000-4000-8000-000000000001', 'verified'),
    ('e5300000-0000-4000-8000-000000000004', 'e5300000-0000-4000-8000-000000000001', 'pending');

-- 2. complete_lesson runs the model under the row lock: a rest day keeps the
-- run, a third missed day restarts it, a pause bridges a holiday, the best
-- and days practised never go down, a failed lesson is not a practised day.
DO $$
DECLARE
    v_kid uuid := 'e5300000-0000-4000-8000-000000000001';
    v_guardian uuid := 'e5300000-0000-4000-8000-000000000002';
    v_lesson uuid := (SELECT id FROM public.lessons ORDER BY id LIMIT 1);
    r jsonb;
BEGIN
    IF v_lesson IS NULL THEN RAISE EXCEPTION 'Seed a lesson in the isolated test database first'; END IF;
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 80, true, 10, 3, '2026-09-21');  -- Mon
    IF r->'streak'->>'outcome' <> 'first' OR (r->>'streak_days')::int <> 1 THEN RAISE EXCEPTION 'first: %', r; END IF;
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 80, true, 10, 3, '2026-09-23');  -- Wed, Tue rests
    IF r->'streak'->>'outcome' <> 'bridged' OR (r->'streak'->>'rest_days_bridged')::int <> 1
       OR (r->'streak'->>'rest_days_left')::int <> 1 OR (r->>'streak_days')::int <> 2 THEN
        RAISE EXCEPTION 'rest day: %', r;
    END IF;
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 20, false, 0, 3, '2026-09-24');   -- a failed lesson
    IF r->'streak'->>'outcome' <> 'not_practised' OR (r->>'streak_days')::int <> 2
       OR (SELECT last_active_date FROM public.learning_stats WHERE user_id = v_kid) <> '2026-09-23' THEN
        RAISE EXCEPTION 'a failed lesson moved the streak: %', r;
    END IF;
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 80, true, 10, 3, '2026-09-23');  -- same day again
    IF (r->'pace'->>'lessons_passed_today')::int <> 2 THEN RAISE EXCEPTION 'pace count: %', r; END IF;
    -- Thu, Fri, Sat missed with one rest day already used this week: the run rests.
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 80, true, 10, 3, '2026-09-27');
    IF r->'streak'->>'outcome' <> 'restarted' OR (r->>'streak_days')::int <> 1 OR (r->'streak'->>'best')::int <> 2
       OR (r->'streak'->>'days_practiced')::int <> 3 THEN
        RAISE EXCEPTION 'restart: %', r;
    END IF;
    -- A holiday pause over the next ten days bridges it completely.
    IF public.set_learning_streak_pause(v_guardian, v_kid, '2026-09-28', '2026-10-07', '2026-09-27')->>'status' <> 'set' THEN
        RAISE EXCEPTION 'pause was refused';
    END IF;
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 80, true, 10, 3, '2026-10-08');
    IF r->'streak'->>'outcome' <> 'extended' OR (r->>'streak_days')::int <> 2 THEN RAISE EXCEPTION 'pause bridge: %', r; END IF;
    -- A device date earlier than the last practised day changes nothing.
    r := public.complete_lesson(v_kid, v_lesson, gen_random_uuid(), 80, true, 10, 3, '2026-10-01');
    IF r->'streak'->>'outcome' <> 'earlier_date' OR (SELECT last_active_date FROM public.learning_stats WHERE user_id = v_kid) <> '2026-10-08' THEN
        RAISE EXCEPTION 'earlier date: %', r;
    END IF;
END $$;

-- 3. Only a verified guardian may pause, within the range rules; cancel keeps paused days.
DO $$
DECLARE
    v_kid uuid := 'e5300000-0000-4000-8000-000000000001';
BEGIN
    IF public.set_learning_streak_pause('e5300000-0000-4000-8000-000000000003', v_kid, '2026-10-10', '2026-10-12', '2026-10-09')->>'status' <> 'forbidden'
       OR public.set_learning_streak_pause('e5300000-0000-4000-8000-000000000004', v_kid, '2026-10-10', '2026-10-12', '2026-10-09')->>'status' <> 'forbidden'
       OR public.set_learning_streak_pause(v_kid, v_kid, '2026-10-10', '2026-10-12', '2026-10-09')->>'status' <> 'forbidden' THEN
        RAISE EXCEPTION 'someone other than a verified guardian set a pause';
    END IF;
    IF public.set_learning_streak_pause('e5300000-0000-4000-8000-000000000002', v_kid, '2026-10-10', '2026-11-01', '2026-10-09')->>'status' <> 'invalid'
       OR public.set_learning_streak_pause('e5300000-0000-4000-8000-000000000002', v_kid, '2026-09-20', '2026-09-22', '2026-10-09')->>'status' <> 'invalid'
       OR public.set_learning_streak_pause('e5300000-0000-4000-8000-000000000002', v_kid, '2026-10-12', '2026-10-10', '2026-10-09')->>'status' <> 'invalid' THEN
        RAISE EXCEPTION 'an out-of-policy pause was accepted';
    END IF;
    BEGIN
        INSERT INTO public.learning_streak_pauses (learner_id, starts_on, ends_on) VALUES (v_kid, '2026-10-01', '2026-10-30');
        RAISE EXCEPTION 'the length CHECK did not fire';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    PERFORM public.set_learning_streak_pause('e5300000-0000-4000-8000-000000000002', v_kid, '2026-10-09', '2026-10-20', '2026-10-09');
    IF (SELECT count(*) FROM public.learning_streak_pauses WHERE learner_id = v_kid AND cancelled_at IS NULL AND ends_on >= '2026-10-09') <> 1 THEN
        RAISE EXCEPTION 'more than one open pause';
    END IF;
    IF public.cancel_learning_streak_pause('e5300000-0000-4000-8000-000000000002', v_kid, '2026-10-12')->>'status' <> 'cancelled'
       OR NOT EXISTS (SELECT 1 FROM public.learning_streak_pauses WHERE learner_id = v_kid AND starts_on = '2026-10-09' AND ends_on = '2026-10-11' AND cancelled_at IS NULL) THEN
        RAISE EXCEPTION 'cancel did not keep the paused days';
    END IF;
END $$;

-- 4. Onboarding's day one uses the same model and touches nothing else.
DO $$
DECLARE
    v_user uuid := 'e5300000-0000-4000-8000-000000000003';
    r jsonb;
BEGIN
    r := public.record_learning_practice_day(v_user, '2026-09-24');
    IF r->>'outcome' <> 'first' OR NOT EXISTS (
        SELECT 1 FROM public.learning_stats WHERE user_id = v_user AND streak_days = 1 AND days_practiced = 1 AND xp_points = 0) THEN
        RAISE EXCEPTION 'onboarding practice day: %', r;
    END IF;
    r := public.record_learning_practice_day(v_user, '2026-09-24');
    IF r->>'outcome' <> 'same_day' THEN RAISE EXCEPTION 'onboarding retry: %', r; END IF;
END $$;

-- 5. No browser role reaches the model, the pauses or the metrics.
DO $$
BEGIN
    IF has_function_privilege('authenticated', 'public.habit_streak_advance(int, int, date, int, int, date, date[])', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.set_learning_streak_pause(uuid, uuid, date, date, date)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.cancel_learning_streak_pause(uuid, uuid, date)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.record_learning_practice_day(uuid, date)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.complete_lesson(uuid, uuid, uuid, int, boolean, int, int, date)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.learning_rest_day_utilization(timestamptz, timestamptz)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.learning_autonomy_adoption(timestamptz, timestamptz)', 'EXECUTE') THEN
        RAISE EXCEPTION 'a browser role can execute a streak, pause or metric function';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename IN ('learning_streak_pauses', 'learning_pace_preferences') AND cmd <> 'SELECT') THEN
        RAISE EXCEPTION 'a browser write policy exists on the pause or pace table';
    END IF;
END $$;

-- 6. The metrics: the three new events are accepted, and the two functions add up.
-- The events belong to an adult learner the H.1 admission trigger admits.
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES ('e5300000-0000-4000-8000-000000000003', 'adult')
    ON CONFLICT (user_id) DO UPDATE SET declared_age_band = 'adult';
INSERT INTO public.user_roles (user_id, role) VALUES ('e5300000-0000-4000-8000-000000000003', 'universal') ON CONFLICT DO NOTHING;
DO $$
DECLARE
    v_adult uuid := 'e5300000-0000-4000-8000-000000000003';
    r record;
BEGIN
    INSERT INTO public.learning_events (user_id, role, event, route_class, value) VALUES
        (v_adult, 'universal', 'streak_rest_day', 'learn', 2),
        (v_adult, 'universal', 'streak_restart', 'learn', 5),
        (v_adult, 'universal', 'path_choice', 'learn', 1),
        (v_adult, 'universal', 'lesson_complete', 'learn', 80);
    SELECT * INTO r FROM public.learning_rest_day_utilization(now() - interval '1 day', now() + interval '1 day');
    IF r.learners_with_lapse <> 1 OR r.kept_by_rest_days <> 1 OR r.restarted <> 1 OR r.rest_days_used <> 2 THEN
        RAISE EXCEPTION 'rest day utilization: %', r;
    END IF;
    SELECT * INTO r FROM public.learning_autonomy_adoption(now() - interval '1 day', now() + interval '1 day') WHERE lever = 'path';
    IF r.offered <> 1 OR r.exercised <> 1 THEN RAISE EXCEPTION 'path adoption: %', r; END IF;
    SELECT * INTO r FROM public.learning_autonomy_adoption(now() - interval '1 day', now() + interval '1 day') WHERE lever = 'pace';
    IF r.offered <> 1 OR r.exercised <> 0 THEN RAISE EXCEPTION 'pace adoption: %', r; END IF;
    INSERT INTO public.learning_pace_preferences (user_id, daily_lesson_goal) VALUES (v_adult, 2);
    SELECT * INTO r FROM public.learning_autonomy_adoption(now() - interval '1 day', now() + interval '1 day') WHERE lever = 'pace';
    IF r.exercised <> 1 THEN RAISE EXCEPTION 'pace adoption after a choice: %', r; END IF;
    BEGIN
        INSERT INTO public.learning_pace_preferences (user_id, daily_lesson_goal) VALUES ('e5300000-0000-4000-8000-000000000002', 4);
        RAISE EXCEPTION 'a pace above three lessons was stored';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;

ROLLBACK;
