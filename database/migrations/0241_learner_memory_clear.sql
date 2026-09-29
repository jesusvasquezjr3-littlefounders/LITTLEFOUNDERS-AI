-- @phase: contract
-- @after-release: none — this file only DEFINES clear_learner_memory(); applying it deletes nothing and changes no table, column or constraint. The phase classifier flags the DELETE statement inside the function body, so it is declared contract and applied by hand. Apply it BEFORE the Core release that serves DELETE /tutor/memory/:store and DELETE /tutor/kids/:kidUserId/memory/:store: without it both routes answer 502 and no note is deleted.
-- learner_memory_clear — the note owner and a verified guardian can DELETE a
-- stored Mentor memory note (Product 10 C.4 self-review/deletion mechanism;
-- OD-18 "approves or deletes every persistent Mentor memory note"; S01.4
-- acceptance "visible review/deletion controls matching the chosen policy").
--
-- Until now only a PROPOSED note could be refused
-- (decide_learner_memory_proposal, 0068/0219). A note already in
-- learner_memory, including every note written for a universal-role teen
-- before S01.4f/OD-18 made teen notes reviewable, stayed forever and was read
-- into every session. This function is the one way to remove one store's row.
--
-- Additive in effect: one new function, no table or constraint change (see
-- the @after-release line for why the header still says contract).
--
--   * Compare-and-delete. The caller names the text it showed the reviewer
--     (p_expected). If the row changed since (an approval or an adult's
--     session wrote a new note), nothing is deleted and the answer is
--     'conflict'. The reviewer decides on the note they read, never on a
--     newer one they did not see.
--   * The same advisory lock as write_learner_memory_checked (0059, salt 2),
--     so a delete and a write for the same learner serialise.
--   * An append-only learner_memory_ledger row, with NO text: the actor
--     ('learner-self-deleted' or 'guardian-deleted'), the sha256 of the
--     deleted note as before_hash, and the sha256 of the empty string as
--     after_hash. learner_memory.content can never be empty (0053 CHECK), so
--     that hash reads unambiguously as "no note after this".
--   * Pending proposals of the same store whose expected_before no longer
--     matches the (now absent) note are closed as rejected, decided by the
--     deleter: approving them could only ever answer 'conflict'. A proposal
--     computed from "no note yet" (expected_before NULL) still applies
--     cleanly and stays pending for its reviewer.
--
-- Core authorises the caller before calling (routes/tutor.ts: the owner only
-- when classifyMemoryReview answers self-review or adult-direct; a verified
-- guardian re-checked on every call). Execution is service-role only.

CREATE OR REPLACE FUNCTION public.clear_learner_memory(
    p_user        uuid,
    p_store       text,
    p_expected    text,
    p_actor       text,
    p_decided_by  uuid
)
-- 'deleted':  the row is gone, the ledger row is written, stale proposals closed.
-- 'absent':   there is no note in that store; nothing changed.
-- 'conflict': the note is no longer p_expected; nothing changed.
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
    IF p_actor NOT IN ('learner-self-deleted', 'guardian-deleted') THEN
        RAISE EXCEPTION 'invalid learner_memory delete actor: %', p_actor;
    END IF;
    IF p_expected IS NULL OR p_decided_by IS NULL THEN
        RAISE EXCEPTION 'a delete names the note it removes and who removed it';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 2));

    SELECT content INTO v_current
    FROM public.learner_memory
    WHERE user_id = p_user AND store = p_store
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'absent';
    END IF;
    IF v_current IS DISTINCT FROM p_expected THEN
        RETURN 'conflict';
    END IF;

    DELETE FROM public.learner_memory
    WHERE user_id = p_user AND store = p_store;

    INSERT INTO public.learner_memory_ledger (user_id, store, actor, before_hash, after_hash, session_id)
    VALUES (
        p_user,
        p_store,
        p_actor,
        encode(sha256(convert_to(v_current, 'UTF8')), 'hex'),
        encode(sha256(''::bytea), 'hex'),
        NULL
    );

    UPDATE public.learner_memory_proposals
    SET status = 'rejected', decided_by = p_decided_by, decided_at = now()
    WHERE user_id = p_user
      AND store = p_store
      AND status = 'pending'
      AND expected_before IS NOT NULL;

    RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION public.clear_learner_memory(uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_learner_memory(uuid, text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.clear_learner_memory(uuid, text, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clear_learner_memory(uuid, text, text, text, uuid) TO service_role;

SELECT 'migration_learner_memory_clear_ok' AS sentinel;
