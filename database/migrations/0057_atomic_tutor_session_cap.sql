-- 0057_atomic_tutor_session_cap.sql — the Tutor's daily SESSION cap was
-- enforced by a non-atomic read-then-write, so it was not actually a cap.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, round 34, 2026-08-30 (HIGH). `POST
-- /tutor/sessions` (backend/src/routes/tutor.ts) read "sessions started
-- today" with a plain SELECT/count over tutor_sessions, compared it to
-- MAX_SESSIONS_PER_DAY in application code, then created the session with a
-- SEPARATE, unconditional INSERT. Two concurrent session-creation requests
-- for the same learner (a double-tap, a flaky-connection retry, two open
-- tabs) both read the same stale count before either insert lands, so both
-- independently believe a slot is free and both create a session — the
-- exact race class this migration series already closed once for the daily
-- XP cap (0055_atomic_tutor_xp.sql) and once, with a compensating unique
-- index rather than a lock, for voice consent (tutor_voice_consent's partial
-- unique index) — but never applied to session creation itself. Unlike
-- those two, tutor_sessions carries no per-day uniqueness constraint at all,
-- so there was no backstop: this doesn't just mislabel an error under a
-- race, it actually defeats the cap. Reproduced: two concurrent POSTs both
-- observing count=1 (one below the cap of 2) both succeeded, landing 3
-- sessions against a cap of 2.
--
-- The fix is the same shape as 0055: the count, the cap comparison and the
-- insert move into ONE Postgres function, serialized with a Postgres
-- advisory lock keyed on the learner (a DIFFERENT lock salt than
-- award_tutor_xp's, so a session-start and an XP-award for the same learner
-- never wait on each other — only two operations of the SAME kind ever
-- contend). An empty result set means the cap was reached and nothing was
-- inserted; a non-empty one is the created row, exactly as a plain INSERT
-- ... RETURNING would have been.
--
-- Staff exemption (the person iterating on the Tutor must not be locked out
-- after two attempts) stays in application code: the caller passes an
-- effectively unlimited p_cap for staff, reusing this ONE code path rather
-- than maintaining a second, unchecked insert path that could drift from
-- this one.
CREATE OR REPLACE FUNCTION public.start_tutor_session_checked(
    p_user_id    uuid,
    p_since      timestamptz,
    p_cap        int,
    p_locale     text,
    p_tier       smallint,
    p_character  text,
    p_companion  text,
    p_diorama    text,
    p_intent     text,
    p_course_id  uuid,
    p_topic_id   uuid,
    p_skill_key  text,
    p_voice_used boolean,
    p_consent_id uuid
)
RETURNS SETOF public.tutor_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));

    SELECT count(*) INTO v_count
    FROM public.tutor_sessions
    WHERE user_id = p_user_id
      AND started_at >= p_since;

    IF v_count >= p_cap THEN
        RETURN;
    END IF;

    RETURN QUERY
    INSERT INTO public.tutor_sessions (
        user_id, locale, tier, character, companion, diorama, intent,
        course_id, topic_id, skill_key, voice_used, consent_id
    ) VALUES (
        p_user_id, p_locale, p_tier, p_character, p_companion, p_diorama,
        p_intent, p_course_id, p_topic_id, p_skill_key, p_voice_used,
        p_consent_id
    )
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.start_tutor_session_checked(
    uuid, timestamptz, int, text, smallint, text, text, text, text,
    uuid, uuid, text, boolean, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_tutor_session_checked(
    uuid, timestamptz, int, text, smallint, text, text, text, text,
    uuid, uuid, text, boolean, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.start_tutor_session_checked(
    uuid, timestamptz, int, text, smallint, text, text, text, text,
    uuid, uuid, text, boolean, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_tutor_session_checked(
    uuid, timestamptz, int, text, smallint, text, text, text, text,
    uuid, uuid, text, boolean, uuid
) TO service_role;
