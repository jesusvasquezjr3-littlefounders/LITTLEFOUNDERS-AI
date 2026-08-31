-- 0061_atomic_learner_memory_pair_write.sql — the post-session review writes
-- BOTH learner-memory stores, and it wrote them as two separate transactions,
-- so a session starting in between read one brand-new note beside one stale
-- one.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, round 61 (2026-08-30, MEDIUM) — deferred that
-- round because closing it needs this migration rather than a same-session
-- patch, and picked up here as round 75.
--
-- 0059 made ONE store's write atomic against concurrent writers of THAT store.
-- It did not, and could not, make the PAIR atomic: `PUT
-- /internal/tutor/learner-memory` looped over `['learner', 'pedagogy']` and
-- awaited `write_learner_memory_checked` once per store, which is two
-- PostgREST calls and therefore two transactions with a real, network-sized
-- window between the first COMMIT and the second. `getLearnerMemory` — run at
-- the START of the next session for the same learner, and by the guardian
-- dossier view — reads both rows in that window and gets a TORN pair: the
-- brand-new learner note beside the pedagogy note the review just decided to
-- replace. Reproduced in round 61 by holding the `pedagogy` RPC open on a
-- manually-resolved promise while the `learner` write completed and a
-- concurrent read ran: it returned `{ learner: 'NEW…', pedagogy: 'OLD…' }`.
--
-- The blast radius is contained — one learner, and it self-corrects the
-- moment the second write lands — which is why this is MEDIUM and not HIGH.
-- What it is NOT is harmless: the next session's model prompt is built from
-- exactly this pair, and Oracle's own post-session review then computes its
-- next proposal from the brief it was handed, so a torn read is a belief the
-- system can go on to write back down as if it were coherent.
--
-- WHY ONE TRANSACTION IS ENOUGH, and what it relies on. `getLearnerMemory`
-- reads both rows in a SINGLE statement (`/learner_memory?user_id=eq.…`), so
-- it sees one snapshot; two rows written in one transaction are therefore
-- visible to it either both-before or both-after, never one of each. A reader
-- that split the pair into two SELECTs would reintroduce the same window from
-- the other side — that single statement is part of the contract, not an
-- incidental detail of how the query happens to be written today.
--
-- WHY THIS WRAPS 0059's FUNCTION INSTEAD OF REIMPLEMENTING IT. A plpgsql
-- function called from another runs inside the CALLER's transaction, so
-- calling `write_learner_memory_checked` twice from here is already the whole
-- fix — and it means the compare-and-swap, the 'written'/'unchanged'/
-- 'conflict' vocabulary and the append-only ledger row are literally the same
-- code for one store and for two. A second copy of that logic is a second
-- thing to keep in step with the first, and this file would be exactly where
-- the two started to drift.
--
-- WHAT DELIBERATELY DOES NOT CHANGE. Each store's compare-and-swap is still
-- judged on its OWN `expected_before`: a store whose row moved under it still
-- reports 'conflict' and is still not written, while the other store still
-- lands. That is the same per-store contract Core and Oracle already have
-- (`updateLearnerMemory` requires every PROPOSED store to report true, so a
-- partial write is already reported as "did not land, the next review will
-- try again"). The only thing this migration changes is WHEN the two writes
-- become visible: together, or not at all.
--
-- 0059's `write_learner_memory_checked` is deliberately left in place and NOT
-- dropped even though Core now calls only the pair function. Dropping it
-- would be a contraction, and one contraction blocks the whole additive batch
-- from auto-applying (database/AGENTS.md); an unused SECURITY DEFINER function
-- whose EXECUTE is granted to `service_role` alone costs nothing to keep, and
-- it is the function this one calls anyway.
CREATE OR REPLACE FUNCTION public.write_learner_memory_pair_checked(
    p_user_id               uuid,
    p_learner_expected      text,
    p_learner_new           text,
    p_learner_before_hash   text,
    p_learner_after_hash    text,
    p_pedagogy_expected     text,
    p_pedagogy_new          text,
    p_pedagogy_before_hash  text,
    p_pedagogy_after_hash   text,
    p_actor                 text,
    p_session_id            uuid
)
-- A jsonb object with ONE KEY PER STORE ACTUALLY ATTEMPTED, each carrying the
-- same verdict `write_learner_memory_checked` returns for a single store:
-- 'written', 'unchanged' or 'conflict'. A NULL `p_*_new` means "this review
-- proposed nothing for that store" — the store is skipped entirely and its key
-- is ABSENT from the result, which is the same shape the route's own `if
-- (content === null) continue` already produced. It never means "store NULL":
-- `learner_memory.content` is NOT NULL and a proposal of nothing is not a
-- proposal to forget.
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb := '{}'::jsonb;
BEGIN
    IF p_learner_new IS NULL AND p_pedagogy_new IS NULL THEN
        RETURN v_result;
    END IF;

    -- The same learner-keyed salt 0059 uses, taken ONCE up front so a pair is
    -- serialized as a unit no matter which stores it carries. The inner
    -- function takes it again per store; re-acquiring an advisory lock already
    -- held by this transaction is free, and it must stay in there because that
    -- function is still callable on its own.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

    IF p_learner_new IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(
            'learner',
            public.write_learner_memory_checked(
                p_user_id, 'learner', p_learner_expected, p_learner_new,
                p_learner_before_hash, p_learner_after_hash, p_actor, p_session_id
            )
        );
    END IF;

    IF p_pedagogy_new IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(
            'pedagogy',
            public.write_learner_memory_checked(
                p_user_id, 'pedagogy', p_pedagogy_expected, p_pedagogy_new,
                p_pedagogy_before_hash, p_pedagogy_after_hash, p_actor, p_session_id
            )
        );
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.write_learner_memory_pair_checked(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_learner_memory_pair_checked(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.write_learner_memory_pair_checked(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.write_learner_memory_pair_checked(uuid, text, text, text, text, text, text, text, text, text, uuid) TO service_role;
