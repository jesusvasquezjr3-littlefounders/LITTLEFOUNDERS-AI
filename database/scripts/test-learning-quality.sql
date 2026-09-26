-- S05.3d (B.5, B.12, B.19): physical checks for *_lesson_replay_receipt.sql,
-- *_judgment_quality_signal.sql, *_practice_difficulty_calibration.sql and
-- *_learning_quality_events.sql. Run with psql -v ON_ERROR_STOP=1 on an
-- isolated, fully migrated test database that has at least one lesson.
-- Everything is rolled back.
BEGIN;

INSERT INTO auth.users (id) VALUES
    ('d5300000-0000-4000-8000-000000000001'),  -- learner
    ('d5300000-0000-4000-8000-000000000002'),  -- content staff
    ('d5300000-0000-4000-8000-000000000003');  -- analytics-only staff
INSERT INTO public.learning_stats (user_id) VALUES ('d5300000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) VALUES
    ('d5300000-0000-4000-8000-000000000002', 'admin'),
    ('d5300000-0000-4000-8000-000000000003', 'admin') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_permissions (user_id, permission) VALUES
    ('d5300000-0000-4000-8000-000000000002', 'manage_content'),
    ('d5300000-0000-4000-8000-000000000003', 'view_analytics');

-- B.5: replay receipt and the improvement-only XP policy.
DO $$
DECLARE
    v_user uuid := 'd5300000-0000-4000-8000-000000000001';
    v_lesson uuid := (SELECT id FROM public.lessons ORDER BY id LIMIT 1);
    v_first jsonb;
    v_lower jsonb;
    v_retry jsonb;
BEGIN
    IF v_lesson IS NULL THEN RAISE EXCEPTION 'Seed a lesson in the isolated test database first'; END IF;
    v_first := public.complete_lesson(v_user, v_lesson, 'd5300000-0000-4000-8000-0000000000a1', 90, true, 20, 5, '2026-09-24');
    IF v_first->'replay'->>'kind' <> 'first' OR v_first->'replay'->>'notice' <> 'none'
       OR v_first->'replay'->'previous_best_score' <> 'null'::jsonb OR v_first->'replay'->>'xp_policy' <> 'improvement_only' THEN
        RAISE EXCEPTION 'First completion receipt is wrong: %', v_first;
    END IF;
    v_lower := public.complete_lesson(v_user, v_lesson, 'd5300000-0000-4000-8000-0000000000a2', 40, true, 10, 5, '2026-09-24');
    IF v_lower->'replay'->>'kind' <> 'replay' OR v_lower->'replay'->>'notice' <> 'best_kept'
       OR (v_lower->'replay'->>'previous_best_score')::int <> 90 OR (v_lower->'replay'->>'best_score_kept')::boolean IS NOT TRUE
       OR (v_lower->>'xp_delta')::int <> 0 OR (v_lower->>'best_score')::int <> 90 THEN
        RAISE EXCEPTION 'Lower replay receipt is wrong: %', v_lower;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lesson_progress WHERE user_id = v_user AND lesson_id = v_lesson AND best_score = 90 AND xp_earned = 20)
       OR NOT EXISTS (SELECT 1 FROM public.learning_stats WHERE user_id = v_user AND xp_points = 20) THEN
        RAISE EXCEPTION 'A replay lowered the kept best or paid XP';
    END IF;
    v_retry := public.complete_lesson(v_user, v_lesson, 'd5300000-0000-4000-8000-0000000000a2', 0, false, 0, 1, '2026-09-25');
    IF v_retry->'replay' <> v_lower->'replay' OR (v_retry->>'replayed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'A lost-response retry changed the stored replay receipt';
    END IF;
END $$;

-- B.12: the judgment shape is a database fact.
DO $$
DECLARE
    v_user uuid := 'd5300000-0000-4000-8000-000000000001';
    v_lesson uuid := (SELECT id FROM public.lessons ORDER BY id LIMIT 1);
    v_version uuid := 'd5300000-0000-4000-8000-0000000000b1';
    v_run uuid := 'd5300000-0000-4000-8000-0000000000b2';
    v_rejected boolean := false;
BEGIN
    INSERT INTO public.lesson_document_versions (id, lesson_id, locale, version_id, schema_version, document, answer_keys)
    VALUES (v_version, v_lesson, 'en-US', 'qa-reasoning-001', 2, '{}'::jsonb, '{}'::jsonb);
    INSERT INTO public.lesson_v2_runs (id, user_id, lesson_id, locale, document_version_id, expires_at)
    VALUES (v_run, v_user, v_lesson, 'en-US', v_version, now() + interval '15 minutes');
    INSERT INTO public.lesson_v2_attempt_nonces (jti, user_id, run_id, document_version_id, segment_id, expires_at) VALUES
        ('qaJudgmentNonce000000001', v_user, v_run, v_version, 'decide-01', now() + interval '15 minutes'),
        ('qaJudgmentNonce000000002', v_user, v_run, v_version, 'decide-01', now() + interval '15 minutes');
    PERFORM public.record_v2_lesson_grade_ordered(v_user, v_run, v_version, 'decide-01', 'qaJudgmentNonce000000001',
        '{"correct":false,"score":0,"judgment":{"quality":"sound"}}'::jsonb, NULL);
    BEGIN
        PERFORM public.record_v2_lesson_grade_ordered(v_user, v_run, v_version, 'decide-01', 'qaJudgmentNonce000000002',
            '{"correct":true,"score":100,"judgment":{"quality":"brilliant","score":100}}'::jsonb, NULL);
    EXCEPTION WHEN check_violation THEN v_rejected := true;
    END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'A malformed judgment was stored'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.learning_judgment_differentiation(now() - interval '1 hour', now() + interval '1 hour')
                   WHERE lesson_id = v_lesson AND attempts = 1 AND incorrect_sound = 1 AND divergent_share = 1) THEN
        RAISE EXCEPTION 'The judgment differentiation metric missed the divergent attempt';
    END IF;
END $$;

-- B.19: guard rails, actor checks, append-only history and review opening.
DO $$
DECLARE
    v_lesson uuid := (SELECT id FROM public.lessons ORDER BY id LIMIT 1);
    v_user uuid := 'd5300000-0000-4000-8000-000000000001';
    v_staff uuid := 'd5300000-0000-4000-8000-000000000002';
    v_analyst uuid := 'd5300000-0000-4000-8000-000000000003';
    v_failed boolean;
    v_opened int;
    v_review uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.practice_difficulty_bands WHERE lesson_id IS NULL AND lower_pct = 70 AND upper_pct = 85 AND min_sample = 30) THEN
        RAISE EXCEPTION 'The default 70-85 band was not seeded';
    END IF;
    v_failed := false;
    BEGIN PERFORM public.set_practice_difficulty_band(v_lesson, 90, 99, 30, 'drifting toward certainty', v_staff);
    EXCEPTION WHEN check_violation THEN v_failed := true; END;
    IF NOT v_failed THEN RAISE EXCEPTION 'A band above the guard rail was accepted'; END IF;
    v_failed := false;
    BEGIN PERFORM public.set_practice_difficulty_band(v_lesson, 70, 85, 30, 'analytics cannot set bands', v_analyst);
    EXCEPTION WHEN insufficient_privilege THEN v_failed := true; END;
    IF NOT v_failed THEN RAISE EXCEPTION 'An analytics-only actor set a band'; END IF;

    -- 40 first attempts at 95% in each of two consecutive windows: too easy.
    INSERT INTO public.lesson_segment_attempts (user_id, lesson_id, segment_id, attempt_number, score, diagnostic_code, created_at)
    SELECT v_user, v_lesson, 'qa-seg-' || g, 1, CASE WHEN g % 20 = 0 THEN 0 ELSE 100 END,
           CASE WHEN g % 20 = 0 THEN 'initial_incorrect' ELSE NULL END,
           now() - (CASE WHEN g <= 40 THEN interval '3 days' ELSE interval '31 days' END)
    FROM generate_series(1, 80) AS g;
    v_opened := public.sync_practice_difficulty_reviews(28, now());
    SELECT id INTO v_review FROM public.practice_difficulty_reviews WHERE lesson_id = v_lesson AND status = 'open';
    IF v_opened < 1 OR v_review IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.practice_difficulty_reviews WHERE id = v_review AND direction = 'above_band') THEN
        RAISE EXCEPTION 'A consistently too-easy lesson did not open a review';
    END IF;
    IF public.sync_practice_difficulty_reviews(28, now()) <> 0 THEN RAISE EXCEPTION 'A second sync duplicated the review'; END IF;
    IF public.resolve_practice_difficulty_review(v_review, v_staff, 'make_easier', 'This would push it further out')->>'status' <> 'wrong_direction' THEN
        RAISE EXCEPTION 'A decision against the band direction was accepted';
    END IF;
    IF public.resolve_practice_difficulty_review(v_review, v_staff, 'adjust_band', 'Teen pathway hypothesis: 75 to 90', 75, 90)->>'status' <> 'resolved' THEN
        RAISE EXCEPTION 'The adjust-band decision did not resolve';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.practice_difficulty_bands WHERE lesson_id = v_lesson AND lower_pct = 75 AND upper_pct = 90)
       OR NOT EXISTS (SELECT 1 FROM public.practice_difficulty_band_log WHERE lesson_id = v_lesson AND review_id = v_review AND changed_by = v_staff)
       OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'practice_review.resolve' AND actor_id = v_staff) THEN
        RAISE EXCEPTION 'The band change was not applied, logged and audited together';
    END IF;
    IF public.resolve_practice_difficulty_review(v_review, v_staff, 'no_change', 'Second decision attempt')->>'status' <> 'already_resolved' THEN
        RAISE EXCEPTION 'A resolved review accepted a second decision';
    END IF;
    v_failed := false;
    BEGIN UPDATE public.practice_difficulty_band_log SET rationale = 'rewritten history' WHERE lesson_id = v_lesson;
    EXCEPTION WHEN raise_exception THEN v_failed := true; END;
    IF NOT v_failed THEN RAISE EXCEPTION 'The recalibration log is not append-only'; END IF;
    IF public.sync_practice_difficulty_reviews(28, now()) <> 0 THEN RAISE EXCEPTION 'A review reopened inside its cooldown'; END IF;
END $$;

-- B.5 metric and browser roles.
DO $$
DECLARE
    v_user uuid := 'd5300000-0000-4000-8000-000000000001';
    v_lesson uuid := (SELECT id FROM public.lessons ORDER BY id LIMIT 1);
BEGIN
    INSERT INTO public.learning_events (user_id, role, event, route_class, lesson_id) VALUES
        (v_user, 'universal', 'replay_below_best', 'learn', v_lesson),
        (v_user, 'universal', 'replay_notice_view', 'learn', v_lesson),
        (v_user, 'universal', 'replay_below_best', 'learn', v_lesson);
    IF NOT EXISTS (SELECT 1 FROM public.learning_replay_notice_display_rate(now() - interval '1 hour', now() + interval '1 hour')
                   WHERE below_best = 2 AND shown = 2) THEN
        -- Both denominators fall inside the 30-minute window of the one view.
        RAISE EXCEPTION 'The display-rate join is wrong';
    END IF;
    IF has_function_privilege('authenticated', 'public.practice_success_band_metrics(timestamptz,timestamptz)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.resolve_practice_difficulty_review(uuid,uuid,text,text,integer,integer,integer)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.set_practice_difficulty_band(uuid,integer,integer,integer,text,uuid,uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.learning_judgment_differentiation(timestamptz,timestamptz)', 'EXECUTE')
       OR has_table_privilege('authenticated', 'public.practice_difficulty_reviews', 'SELECT')
          AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'practice_difficulty_reviews') THEN
        RAISE EXCEPTION 'A browser role can reach the calibration layer';
    END IF;
END $$;
ROLLBACK;
