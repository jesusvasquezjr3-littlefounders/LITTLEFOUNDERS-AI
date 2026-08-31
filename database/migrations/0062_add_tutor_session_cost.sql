-- 0062_add_tutor_session_cost.sql — a paid model call that happens AFTER a
-- session's cost has already been written needs a way to be added to it.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, round 78 (2026-08-30, MEDIUM). Round 64 closed
-- the same CLASS of gap for tier-3 generation — a real, separately-billed
-- model call whose price never reached `tutor_sessions.cost_usd` — but that
-- one happens DURING an active session, so folding it into the orchestrator's
-- own running total (`noteGenerationCost`) was enough: the total is read once,
-- at close, after every contributor has already added to it.
--
-- The post-session review (`oracle/src/session/review.ts`) is the other shape.
-- It makes its own real call to the pedagogical model — same model, same
-- provider, same invoice — and it is fired FIRE-AND-FORGET *after*
-- `closeSession` has already persisted `cost_usd`, in both the graceful
-- `finish()` path and the dropped-connection `finalizeParked()` path. There is
-- no running total left to add to: the orchestrator is about to be discarded
-- and the row already says what the session cost. So every session with a real
-- conversation in it under-reported its true spend, permanently and silently
-- (§1.0: "in blind flight" — a cost ledger missing a surface).
--
-- WHY A FUNCTION AND NOT A PATCH. The write is `cost_usd = cost_usd + x`,
-- which PostgREST cannot express: a PATCH can only set a literal, so Core
-- would have to read the row, add in application code, and write the sum back
-- — the exact read-modify-write shape §1.14 names (`getLearningStatsForUpdate`
-- erasing a child's XP behind a 200) and that migrations 0055/0057/0059 have
-- each already moved into Postgres for the same reason. One UPDATE statement
-- takes its own row lock, so two additions can never lose each other, and a
-- failed read cannot turn into a write of zero because there is no read.
--
-- DELIBERATELY NOT GUARDED ON `ended_at`. A closed session is not immutable
-- here — `setSessionSummary` already writes the memory digest onto a row that
-- has closed — and guarding on `ended_at IS NOT NULL` would make a cost
-- disappear precisely when the close itself failed, which is the moment the
-- record is already least trustworthy. The row must exist, and that is all.
--
-- RETURNS the new total, or NULL when no such session exists — so a caller can
-- tell "added" from "there was nothing to add it to" (§1.14) rather than
-- reading silence as success.

CREATE OR REPLACE FUNCTION public.add_tutor_session_cost(
    p_session_id uuid,
    p_amount     numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total numeric;
BEGIN
    -- A non-positive addition is a caller bug, not a write. Refusing it here
    -- keeps the CHECK (cost_usd >= 0) unreachable from this path.
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN NULL;
    END IF;

    UPDATE public.tutor_sessions
       SET cost_usd = cost_usd + p_amount
     WHERE id = p_session_id
    RETURNING cost_usd INTO v_total;

    RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.add_tutor_session_cost(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_tutor_session_cost(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.add_tutor_session_cost(uuid, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_tutor_session_cost(uuid, numeric) TO service_role;
