-- 0059_atomic_learner_memory_write.sql — writeLearnerMemory was a plain
-- read-then-write, so two concurrent sessions for the same learner could
-- silently discard each other's memory update.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, round 42 (2026-08-30, MEDIUM/HIGH). Every
-- post-session review reads the CURRENT note, asks a model to consolidate it
-- with what just happened, then writes back a FULL REPLACEMENT — but the
-- read and the write are minutes apart (a whole live conversation runs in
-- between), and nothing checks the row is still in the state that was read.
-- Two sessions for the same learner closing close together — the documented
-- "dropped connection, 90s park window, quick reopen" case this codebase
-- already names elsewhere as plausibly common — each read the same starting
-- note, each fold in a DIFFERENT real observation, and whichever write lands
-- last wins outright: the other session's genuine learning is discarded with
-- no error, no log, and nothing distinguishing it from an ordinary
-- uncontested write.
--
-- This is NOT the same shape `award_tutor_xp` (migration 0055) closed: XP's
-- "current total" is recomputed fresh from source rows INSIDE one atomic
-- function, so serializing the read+write there is sufficient. Here the new
-- CONTENT is computed by a model call that cannot run inside Postgres, so
-- atomicity alone cannot make two proposals merge — the fix is optimistic
-- concurrency control instead: the write only lands if the row's content is
-- STILL what the caller read before proposing its replacement. A conflict is
-- reported back rather than silently overwritten, so the loser can be logged
-- instead of believed. The advisory lock still serializes the check-then-
-- write itself, exactly as 0055's does, so the compare-and-swap has no race
-- of its own under any number of Core replicas.
CREATE OR REPLACE FUNCTION public.write_learner_memory_checked(
    p_user_id          uuid,
    p_store            text,
    p_expected_before  text,
    p_new_content      text,
    p_before_hash      text,
    p_after_hash       text,
    p_actor            text,
    p_session_id       uuid
)
-- 'written': the store and ledger now reflect p_new_content.
-- 'unchanged': the current content already equals p_new_content — no ledger
--   noise, matching writeLearnerMemory's existing "nothing new" short-circuit.
-- 'conflict': the row no longer matches p_expected_before — someone else
--   wrote first. The caller must NOT treat this as success.
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current text;
BEGIN
    IF p_store NOT IN ('learner', 'pedagogy') THEN
        RAISE EXCEPTION 'invalid learner_memory store: %', p_store;
    END IF;

    -- Keyed on the learner alone (not per-store): two stores for the same
    -- learner serializing against each other is rare, cheap contention on a
    -- best-effort, once-per-session-close write — simpler than a compound
    -- key and still correct. A different salt from 0055/0057's own locks so
    -- an unrelated atomic operation for the same user never contends here.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

    SELECT content INTO v_current
    FROM public.learner_memory
    WHERE user_id = p_user_id AND store = p_store;

    IF v_current IS DISTINCT FROM p_expected_before THEN
        RETURN 'conflict';
    END IF;

    IF v_current = p_new_content THEN
        RETURN 'unchanged';
    END IF;

    INSERT INTO public.learner_memory (user_id, store, content, updated_at)
    VALUES (p_user_id, p_store, p_new_content, now())
    ON CONFLICT (user_id, store) DO UPDATE
        SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at;

    INSERT INTO public.learner_memory_ledger (user_id, store, actor, before_hash, after_hash, session_id)
    VALUES (p_user_id, p_store, p_actor, p_before_hash, p_after_hash, p_session_id);

    RETURN 'written';
END;
$$;

REVOKE ALL ON FUNCTION public.write_learner_memory_checked(uuid, text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_learner_memory_checked(uuid, text, text, text, text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.write_learner_memory_checked(uuid, text, text, text, text, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.write_learner_memory_checked(uuid, text, text, text, text, text, text, uuid) TO service_role;
