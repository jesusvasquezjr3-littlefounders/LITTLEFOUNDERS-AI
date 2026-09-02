-- 0068_learner_memory_guardian_approval.sql — the LEARNER store stops
-- auto-writing for a minor. A post-session review's proposal now PARKS as a
-- pending row a verified guardian approves or rejects, and only an approval
-- moves the store.
-- @phase: expand
--
-- CLOSES THE ONE ITEM /ORACLE.md §20 MARKS **BLOCKING BEFORE FAMILY
-- ROLLOUT**: "auto-write is the owner-accepted interim while the platform's
-- only active learner is the owner. Before real families: LEARNER-store writes
-- require guardian approval from the portal, which reads the same ledger."
-- Migration 0053 shipped the stores with that sentence already written into
-- its own header; this is the migration that makes it true.
--
-- WHY ONLY THE `learner` STORE. The two stores 0053 created are different
-- KINDS of thing and only one of them is a record OF THE CHILD:
--
--   learner   Who this child is — interests, what motivates them, what to
--             avoid. A curated, model-authored prose description of a minor,
--             injected into every future session. That is exactly the sort of
--             belief a parent has the right to see before the system starts
--             holding it, which is what makes the gate belong HERE.
--
--   pedagogy  What teaching actually works with them — "prefers a worked
--             example before the rule", "loses the thread past three steps".
--             The tutor's own teaching notes about its own method. Gating it
--             would put a guardian in the position of approving a teaching
--             technique, which is not a parental decision, and would stall
--             the tutor's ability to adapt behind an inbox. It keeps
--             auto-writing, for a minor and an adult alike.
--
-- The split is enforced by construction rather than by a caller remembering
-- it: this table has no `store` column and its length CHECK is the LEARNER
-- store's own 1,400-character cap, so a pedagogy note cannot be parked here
-- even by mistake, and `decide_learner_memory_proposal` below passes the
-- literal 'learner' to the apply function.
--
-- ADULTS ARE UNAFFECTED. A learner who is not a `kid` has no guardian to ask,
-- and inventing an approval queue nobody can empty would simply stop their
-- memory from ever being written. Core decides which path a write takes by
-- reading `user_roles` (`routes/tutor.ts`); a role read that FAILS refuses the
-- write outright rather than falling through to the ungated path (§1.14 —
-- failure must be distinguishable from emptiness, and here the "default" would
-- be a child's note bypassing the gate).
--
-- WHY AN APPROVAL DOES NOT GET ITS OWN WRITE PATH. The apply below calls
-- `write_learner_memory_checked` (migration 0059) — the same function 0061's
-- pair wrapper calls, for the same reason 0061 states in its own header: a
-- plpgsql function runs inside its CALLER's transaction, so calling it from
-- here is already the whole job, and it keeps ONE copy of the compare-and-swap,
-- the 'written'/'unchanged'/'conflict' vocabulary and the append-only
-- `learner_memory_ledger` insert. A second apply path would be a second thing
-- to keep in step, and the ledger row — the compensating control 0053 exists
-- around — is precisely what a duplicate would eventually forget to write.
--
-- WHY A PROPOSAL CAN GO STALE, AND WHY THAT IS THE HONEST ANSWER. Each
-- proposal is a full REPLACEMENT of the store, computed from the belief the
-- session started with, which is recorded here as `expected_before`. Two
-- sessions can therefore leave two pending proposals both computed from the
-- same base. Approving the first moves the store; the second no longer
-- matches what it was built on, `write_learner_memory_checked` reports
-- 'conflict', and this function does NOT mark it approved — it stays pending
-- so the guardian can reject it rather than being told a write landed that
-- did not. That is the same per-store contract round 51 already gave two
-- overlapping sessions ("the loser correctly reports 'conflict'"), reached
-- through a guardian instead of through a race, and it is why the decision
-- returns a VERDICT rather than a boolean.

-- ─────────────────────── learner_memory_proposals ──────────────────────────

CREATE TABLE IF NOT EXISTS public.learner_memory_proposals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- The proposed replacement for the LEARNER store, under that store's own
    -- 1,400-character cap (0053). No `store` column exists on purpose: see the
    -- header — the absence is what makes a pedagogy note unparkable here.
    proposed         text NOT NULL CHECK (char_length(proposed) BETWEEN 1 AND 1400),
    -- The belief this proposal was actually computed from — the session-start
    -- snapshot Oracle sends as `expectedBefore`. NULL means "there was no note
    -- yet", which is a real starting state and not a missing value.
    expected_before  text NULL CHECK (expected_before IS NULL OR char_length(expected_before) <= 1400),
    -- sha256 hex, computed by Core with the same code every other ledger row's
    -- hashes come from, so an approved proposal's ledger entry is
    -- indistinguishable from an ungated write's. `before_hash` is NULL exactly
    -- when `expected_before` is.
    before_hash      text NULL CHECK (before_hash IS NULL OR before_hash ~ '^[0-9a-f]{64}$'),
    after_hash       text NOT NULL CHECK (after_hash ~ '^[0-9a-f]{64}$'),
    -- The session whose review proposed this. Plain uuid, NO foreign key, for
    -- the same reason `learner_memory_ledger` has none: sessions purge at 90
    -- days and a guardian decision must outlive the conversation that prompted
    -- it.
    session_id       uuid NULL,
    status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by       uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    decided_at       timestamptz NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    -- A decided row names its decider and when; a pending row names neither.
    -- Without this a half-written decision reads as a legitimate state, and
    -- "who approved this note about my child" is the one question this table
    -- exists to answer.
    CONSTRAINT learner_memory_proposals_decision_complete CHECK (
        (status = 'pending'  AND decided_by IS NULL     AND decided_at IS NULL) OR
        (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    ),
    CONSTRAINT learner_memory_proposals_before_hash_pairs CHECK (
        (expected_before IS NULL) = (before_hash IS NULL)
    )
);

-- The queue read: one learner's still-undecided proposals, oldest first (the
-- oldest is the one a family has been waiting on longest). Partial, because
-- every other status is history and is never paged through by the portal.
CREATE INDEX IF NOT EXISTS idx_learner_memory_proposals_pending
    ON public.learner_memory_proposals (user_id, created_at ASC)
    WHERE status = 'pending';

ALTER TABLE public.learner_memory_proposals ENABLE ROW LEVEL SECURITY;

-- Exactly `learner_memory`'s own policy (0053): the learner reads what is held
-- about them, and a VERIFIED guardian reads their child's. Parent visibility
-- is an invariant, not a feature flag — and a note awaiting approval is no
-- less a belief about the child than an approved one.
DROP POLICY IF EXISTS learner_memory_proposals_select_own ON public.learner_memory_proposals;
CREATE POLICY learner_memory_proposals_select_own ON public.learner_memory_proposals
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- No INSERT/UPDATE/DELETE policies: only the service role writes, and a
-- DECISION is only ever made through the function below, never by a direct
-- PATCH. A guardian holding a valid JWT still cannot write this table.

-- ──────────────────── the decision, claim and apply in one ─────────────────

CREATE OR REPLACE FUNCTION public.decide_learner_memory_proposal(
    p_proposal_id uuid,
    p_decided_by  uuid,
    p_verdict     text,
    p_actor       text
)
-- 'not_pending': there is no such proposal, or it was already decided. A
--   verdict lands ONLY on a still-pending row — a second reviewer's stale tab,
--   a double-tap, or a retry after a timeout can never overwrite a decision
--   that was already made. This is `setTutorReviewStatus`'s own rule
--   (`review_status=eq.pending` in the filter) moved into a function, because
--   here the decision and the write it triggers must be ONE transaction.
-- 'rejected': the proposal is closed and the store did not move.
-- 'written' / 'unchanged': approved, and `write_learner_memory_checked` says
--   the store now holds it (or already did).
-- 'conflict': approved, but the store moved since this proposal was computed.
--   The store is NOT touched and the proposal STAYS PENDING — see the header.
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

    /*
     * CLAIM AND DECIDE IN ONE TRANSACTION. The `status = 'pending'` predicate
     * plus `FOR UPDATE` is what makes "only on a still-pending row" true under
     * concurrency rather than merely true in the common case: a second caller
     * blocks on the lock, re-evaluates the predicate after the first commits,
     * finds no row and gets 'not_pending'. Two guardians of the same child,
     * both looking at the same queue, is an ordinary Tuesday here (§1.3 —
     * families support multiple parents).
     */
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

    -- THE EXISTING ATOMIC PATH, not a second one. 0059's function does the
    -- compare-and-swap against `expected_before`, the upsert, and the
    -- append-only ledger insert — and it takes its own advisory lock on the
    -- learner, so this runs serialized against a concurrent pedagogy write
    -- from a session closing at the same moment.
    v_outcome := public.write_learner_memory_checked(
        v_row.user_id,
        'learner',
        v_row.expected_before,
        v_row.proposed,
        v_row.before_hash,
        v_row.after_hash,
        p_actor,
        v_row.session_id
    );

    -- 'conflict' deliberately leaves the row PENDING: nothing was written, so
    -- recording an approval would be a receipt for a change that never
    -- happened. Every other verdict means the store now reflects this
    -- proposal, so it is closed.
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
