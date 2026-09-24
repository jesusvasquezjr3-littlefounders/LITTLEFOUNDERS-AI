-- Reversible integration check for migrations 0101 and 0102.
-- Run only against a local or disposable fully migrated database:
--   psql -v ON_ERROR_STOP=1 -f database/scripts/test-v2-lesson-attempts.sql
-- It uses existing synthetic/local rows and rolls every audit row back.

BEGIN;

DO $$
DECLARE
    v_lesson uuid;
    v_other_lesson uuid;
    v_user uuid;
    v_version uuid;
    v_run uuid;
    v_first jsonb;
    v_replay jsonb;
    v_blocked jsonb;
    v_structure jsonb;
    v_answer jsonb;
BEGIN
    SELECT id INTO v_lesson FROM public.lessons ORDER BY id LIMIT 1;
    SELECT id INTO v_other_lesson FROM public.lessons WHERE id <> v_lesson ORDER BY id LIMIT 1;
    SELECT id INTO v_user FROM auth.users ORDER BY id LIMIT 1;
    IF v_lesson IS NULL OR v_other_lesson IS NULL OR v_user IS NULL THEN
        RAISE EXCEPTION 'S05 v2 audit requires two lessons and one user';
    END IF;

    INSERT INTO public.lesson_document_versions(lesson_id, locale, version_id, schema_version, document, answer_keys)
    VALUES (v_lesson, 'en-US', 'audit-v2-001', 2, '{"schema_version":2}'::jsonb, '{}'::jsonb)
    RETURNING id INTO v_version;
    INSERT INTO public.lesson_document_version_current(lesson_id, locale, document_version_id)
    VALUES (v_lesson, 'en-US', v_version);

    BEGIN
        UPDATE public.lesson_document_versions SET document = '{"changed":true}'::jsonb WHERE id = v_version;
        RAISE EXCEPTION 'immutable version was mutable';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'lesson document versions are immutable' THEN RAISE; END IF;
    END;

    BEGIN
        INSERT INTO public.lesson_document_version_current(lesson_id, locale, document_version_id)
        VALUES (v_other_lesson, 'en-US', v_version);
        RAISE EXCEPTION 'cross-lesson version pointer was allowed';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO public.lesson_v2_runs(user_id, lesson_id, locale, document_version_id, expires_at)
    VALUES (v_user, v_lesson, 'en-US', v_version, now() + interval '20 minutes') RETURNING id INTO v_run;
    INSERT INTO public.lesson_v2_attempt_nonces(jti, user_id, run_id, document_version_id, segment_id, expires_at)
    VALUES ('audit_nonce_1234567890', v_user, v_run, v_version, 'allocate-01', now() + interval '15 minutes');

    SET LOCAL ROLE service_role;
    SELECT public.record_v2_lesson_grade(v_user, v_run, v_version, 'allocate-01', 'audit_nonce_1234567890', '{"score":100,"correct":true}'::jsonb)
    INTO v_first;
    SELECT public.record_v2_lesson_grade(v_user, v_run, v_version, 'allocate-01', 'audit_nonce_1234567890', '{"score":0,"correct":false}'::jsonb)
    INTO v_replay;
    RESET ROLE;

    IF v_first->>'replayed' <> 'false' OR v_replay->>'replayed' <> 'true'
       OR v_replay->'verdict' <> '{"score":100,"correct":true}'::jsonb
       OR (SELECT consumed_at IS NOT NULL FROM public.lesson_v2_attempt_nonces WHERE jti = 'audit_nonce_1234567890') IS NOT TRUE THEN
        RAISE EXCEPTION 'nonce receipt contract failed';
    END IF;

    INSERT INTO public.lesson_v2_attempt_nonces(jti, user_id, run_id, document_version_id, segment_id, expires_at)
    VALUES
        ('audit_structure_nonce_1234567890', v_user, v_run, v_version, 'bar-structure-01', now() + interval '15 minutes'),
        ('audit_answer_nonce_1234567890123', v_user, v_run, v_version, 'bar-answer-01', now() + interval '15 minutes');

    SET LOCAL ROLE service_role;
    SELECT public.record_v2_lesson_grade_ordered(v_user, v_run, v_version, 'bar-answer-01', 'audit_answer_nonce_1234567890123', '{"score":100,"correct":true}'::jsonb, 'bar-structure-01')
    INTO v_blocked;
    SELECT public.record_v2_lesson_grade_ordered(v_user, v_run, v_version, 'bar-structure-01', 'audit_structure_nonce_1234567890', '{"score":100,"correct":true}'::jsonb, NULL)
    INTO v_structure;
    SELECT public.record_v2_lesson_grade_ordered(v_user, v_run, v_version, 'bar-answer-01', 'audit_answer_nonce_1234567890123', '{"score":100,"correct":true}'::jsonb, 'bar-structure-01')
    INTO v_answer;
    RESET ROLE;

    IF v_blocked->>'blocked' <> 'true' OR v_structure->>'replayed' <> 'false' OR v_answer->>'replayed' <> 'false'
       OR (SELECT consumed_at IS NULL FROM public.lesson_v2_attempt_nonces WHERE jti = 'audit_answer_nonce_1234567890123') IS NOT FALSE THEN
        RAISE EXCEPTION 'ordered v2 receipt contract failed';
    END IF;

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM public.record_v2_lesson_grade(v_user, v_run, v_version, 'allocate-01', 'audit_nonce_1234567890', '{"score":100,"correct":true}'::jsonb);
        RAISE EXCEPTION 'authenticated role executed v2 grade RPC';
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
    END;

    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM public.record_v2_lesson_grade_ordered(v_user, v_run, v_version, 'bar-answer-01', 'audit_answer_nonce_1234567890123', '{"score":100,"correct":true}'::jsonb, 'bar-structure-01');
        RAISE EXCEPTION 'authenticated role executed ordered v2 grade RPC';
    EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE;
    END;
END;
$$;

ROLLBACK;
