-- 0055_atomic_tutor_xp.sql — the Tutor's daily XP cap was enforced by a
-- non-atomic read-then-write, so it was not actually a cap.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, 2026-08-30 (CRITICAL). `POST
-- /segments/:segmentId/grade` (backend/src/routes/tutor.ts) read "XP earned
-- today" with a plain SELECT/sum over tutor_sessions.xp_awarded, computed
-- `xp = min(baseXp, cap - earnedToday)` in application code, then wrote the
-- result with a SEPARATE, unconditional PATCH. Two concurrent grade requests
-- for the same learner — a fast learner clearing two segments back-to-back, a
-- flaky-connection retry, or two open tabs — both read the same stale
-- "earned today" before either write lands, so both independently believe
-- the full remaining budget is theirs and both spend it. Reproduced: a
-- session at 110/120 XP, two segments worth 20 XP each graded concurrently,
-- both awarded the full 10 XP remaining — 20 total against a 10 XP budget.
--
-- Core is a stateless HTTP service with no documented single-replica
-- constraint (unlike Oracle, which is deliberately pinned to one — see
-- oracle/AGENTS.md), so an in-process lock in Node would not close this
-- under horizontal scaling. The cap spans every tutor_sessions row for a
-- user on a given day, which PostgREST's own row-level conditional PATCH
-- (the pattern `closeTutorSession` already uses for "first write wins" on
-- ONE row) cannot express across a multi-row aggregate. The fix moves the
-- read, the cap arithmetic and the write into ONE function, serialized with
-- a Postgres advisory lock keyed on the learner — correct under any number
-- of Core replicas, because the lock lives in the database, not the process.
CREATE OR REPLACE FUNCTION public.award_tutor_xp(
    p_session_id uuid,
    p_user_id    uuid,
    p_since      timestamptz,
    p_cap        int,
    p_requested  int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_earned_today int;
    v_awarded      int;
BEGIN
    -- Held for the rest of this transaction, released automatically on
    -- commit/rollback. Keyed on the learner so two DIFFERENT learners never
    -- wait on each other — only concurrent grades for the SAME one do.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    SELECT COALESCE(SUM(xp_awarded), 0)
    INTO v_earned_today
    FROM public.tutor_sessions
    WHERE user_id = p_user_id
      AND started_at >= p_since;

    v_awarded := GREATEST(0, LEAST(p_requested, p_cap - v_earned_today));

    IF v_awarded > 0 THEN
        UPDATE public.tutor_sessions
        SET xp_awarded = xp_awarded + v_awarded
        WHERE id = p_session_id
          AND user_id = p_user_id;
    END IF;

    RETURN v_awarded;
END;
$$;

REVOKE ALL ON FUNCTION public.award_tutor_xp(uuid, uuid, timestamptz, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_tutor_xp(uuid, uuid, timestamptz, int, int) FROM anon;
REVOKE ALL ON FUNCTION public.award_tutor_xp(uuid, uuid, timestamptz, int, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_tutor_xp(uuid, uuid, timestamptz, int, int) TO service_role;
