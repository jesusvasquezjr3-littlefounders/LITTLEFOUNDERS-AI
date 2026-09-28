-- @phase: expand
-- memory_proposal_store — C.4 and OD-18: the Mentor's PEDAGOGY note about a
-- minor is reviewed like the learner note.
--
-- learner_memory_proposals (0068) parked only the LEARNER store. The 0068
-- header argued that the pedagogy store ("what teaching works with this
-- child": pacing, scaffolding needs) is the Mentor's own method note and not
-- a record of the child. The SPEC does not accept that distinction: Product
-- C.4 names a memory-note system of two notes (learner note and pedagogy
-- note), and OD-18 says nothing is written to a minor's persistent memory
-- without a note-level decision by the reviewer (the verified guardian, or
-- the independent teen themself). Both notes are model-written prose about
-- the same child, fed into every later session.
--
-- This migration is additive:
--   1. `store` names which note a proposal replaces. Every existing row is a
--      learner proposal, so the default is 'learner' and nothing is rewritten.
--   2. The length caps follow the store, the same caps learner_memory (0053)
--      enforces: 1,400 characters for the learner note, 2,200 for pedagogy.
--      The column-level 1,400 caps from 0068 are replaced by store-aware ones.
--   3. decide_learner_memory_proposal (0068) applies an approved proposal to
--      ITS store through the same write_learner_memory_checked (0059) path,
--      so the compare-and-swap, the verdict words and the append-only ledger
--      row are unchanged. Same signature, same grants.
--
-- The `store` column is a closed set (CHECK IN), so the E.10 messaging scan
-- (social_messaging_surfaces) reads it as a code, not free text; the table's
-- two free-text columns are already reviewed there.

ALTER TABLE public.learner_memory_proposals
    ADD COLUMN IF NOT EXISTS store text NOT NULL DEFAULT 'learner'
        CHECK (store IN ('learner', 'pedagogy'));

-- The 0068 caps were inline column checks (1,400 on both text columns).
-- Replaced, not stacked: a stacked 1,400 cap would refuse every pedagogy
-- note longer than a learner note may be.
ALTER TABLE public.learner_memory_proposals
    DROP CONSTRAINT IF EXISTS learner_memory_proposals_proposed_check,
    DROP CONSTRAINT IF EXISTS learner_memory_proposals_expected_before_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'learner_memory_proposals_store_caps'
    ) THEN
        ALTER TABLE public.learner_memory_proposals
            ADD CONSTRAINT learner_memory_proposals_store_caps CHECK (
                char_length(proposed) >= 1
                AND char_length(proposed) <= CASE store WHEN 'pedagogy' THEN 2200 ELSE 1400 END
                AND (expected_before IS NULL
                     OR char_length(expected_before) <= CASE store WHEN 'pedagogy' THEN 2200 ELSE 1400 END)
            );
    END IF;
END
$$;

-- The pending queue is read per learner and per store.
CREATE INDEX IF NOT EXISTS idx_learner_memory_proposals_pending_store
    ON public.learner_memory_proposals (user_id, store, created_at ASC)
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.decide_learner_memory_proposal(
    p_proposal_id uuid,
    p_decided_by  uuid,
    p_verdict     text,
    p_actor       text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row     public.learner_memory_proposals%ROWTYPE;
    v_outcome text;
BEGIN
    IF p_verdict NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'invalid learner memory proposal verdict: %', p_verdict;
    END IF;

    -- Claim and decide in one transaction (unchanged from 0068): a second
    -- reviewer blocks on the lock and then finds no pending row.
    SELECT * INTO v_row
    FROM public.learner_memory_proposals
    WHERE id = p_proposal_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'not_pending';
    END IF;

    IF p_verdict = 'rejected' THEN
        UPDATE public.learner_memory_proposals
        SET status = 'rejected', decided_by = p_decided_by, decided_at = now()
        WHERE id = v_row.id;
        RETURN 'rejected';
    END IF;

    -- The proposal's own store, through the one atomic write path (0059).
    v_outcome := public.write_learner_memory_checked(
        v_row.user_id,
        v_row.store,
        v_row.expected_before,
        v_row.proposed,
        v_row.before_hash,
        v_row.after_hash,
        p_actor,
        v_row.session_id
    );

    -- 'conflict' leaves the row pending: nothing was written.
    IF v_outcome = 'conflict' THEN
        RETURN 'conflict';
    END IF;

    UPDATE public.learner_memory_proposals
    SET status = 'approved', decided_by = p_decided_by, decided_at = now()
    WHERE id = v_row.id;

    RETURN v_outcome;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_learner_memory_proposal(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_learner_memory_proposal(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.decide_learner_memory_proposal(uuid, uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decide_learner_memory_proposal(uuid, uuid, text, text) TO service_role;

SELECT 'migration_memory_proposal_store_ok' AS sentinel;
