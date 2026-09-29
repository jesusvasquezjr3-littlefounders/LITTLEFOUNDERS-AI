-- @phase: expand
-- C.22 / Appendix E 3.1 (Tier 2 "released via canary rollout") / Appendix F
-- Part 3 Stage 5 and 1.4 (GAP-FIX-R3 mentor lane): the Mentor canary arm a
-- session actually ran. Core assigns the arm at session start from a running
-- `mentor.canary` H.7 experiment (adults only, OD-23), Oracle applies the
-- proposal's Tier 2 parameter overrides and reports the arm at close, and
-- Core stores it here once. The Mentor-quality dashboard reads canary against
-- control per proposal, and `npm run tutor:canary-report` draws the sample of
-- canary-arm sessions a named person reads before release.
--
-- Additive only: two nullable columns (NULL = the session ran no canary) and a
-- partial index. Every deployed reader and writer ignores unknown columns.
-- The arm vocabulary is mirrored in Core and Oracle (`npm run canary:check`).

ALTER TABLE public.tutor_sessions
    ADD COLUMN IF NOT EXISTS canary_proposal_id text NULL
        CHECK (canary_proposal_id IS NULL OR canary_proposal_id ~ '^P-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+$'),
    ADD COLUMN IF NOT EXISTS canary_arm text NULL CHECK (canary_arm IN ('canary', 'control'));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutor_sessions_canary_pair') THEN
        ALTER TABLE public.tutor_sessions
            ADD CONSTRAINT tutor_sessions_canary_pair
            CHECK ((canary_proposal_id IS NULL) = (canary_arm IS NULL));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS tutor_sessions_canary_idx
    ON public.tutor_sessions (canary_proposal_id, ended_at)
    WHERE canary_proposal_id IS NOT NULL;

COMMENT ON COLUMN public.tutor_sessions.canary_proposal_id IS
    'C.22 Stage 5: the Mentor change proposal whose canary this session was enrolled in (either arm); NULL when none.';
COMMENT ON COLUMN public.tutor_sessions.canary_arm IS
    'C.22 Stage 5: canary (ran the proposal''s Tier 2 overrides) or control (ran the approved defaults), as Oracle reported it at close.';
