-- @phase: expand
-- *_mentor_integrity_evidence.sql — Product C.10 and C.18 instrumentation
-- (Appendix F §1.1, §1.2 and Part 3 Stage 7). Additive only: two new nullable
-- / defaulted column groups on an existing table and one new table. Safe to
-- apply before or after the code; the Core release that WRITES these columns
-- must not be deployed before this migration is applied (PostgREST refuses
-- an insert naming a column its schema cache does not have — the trajectory
-- batch would be lost, never corrupted).
--
-- ── C.10: THE EXTENDED MASTERY ENGINE EVENT LOG ─────────────────────────────
--
-- `tutor_trajectory_step` (0066) already records every pedagogy-controller
-- decision. C.10 requires two consecutive qualifying observations before the
-- controller declares mastery or triggers remediation/rescue, and Appendix F
-- measures that as the Corroborating-Evidence Compliance Rate (a hard 100%
-- invariant) and the Mastery Declaration Reversal Rate (Stage 7 kill-switch
-- condition above 8%). Both need the EVIDENCE a decision rested on, which the
-- row did not carry:
--
--   evidence_rule          which consequential rule fired ('mastery' for
--                          CELEBRATE/TRANSFER, 'remediation', 'rescue');
--                          NULL on every ordinary decision and on a decision a
--                          guardrail HELD rather than executed.
--   evidence_observations  the consecutive qualifying observations behind it.
--   evidence_required      the requirement in force for that KC (2 by
--                          default; 1 only under a logged Stage 7 rollback).
--   mastery_revoked        the decision withdrew a mastery declared earlier
--                          in the session (the Appendix D §2.3 demotion rule).
--
-- The three evidence columns travel together (CHECK below): a half-recorded
-- piece of evidence is indistinguishable from a compliance failure.

ALTER TABLE public.tutor_trajectory_step
    ADD COLUMN IF NOT EXISTS evidence_rule text NULL
        CHECK (evidence_rule IS NULL OR evidence_rule IN ('mastery', 'remediation', 'rescue')),
    ADD COLUMN IF NOT EXISTS evidence_observations smallint NULL
        CHECK (evidence_observations IS NULL OR evidence_observations BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS evidence_required smallint NULL
        CHECK (evidence_required IS NULL OR evidence_required BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS mastery_revoked boolean NOT NULL DEFAULT false;

-- A NEW constraint over columns this same migration adds (every existing row
-- is all-NULL, so it validates trivially). Guarded so a re-run is a no-op.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tutor_trajectory_step_evidence_unit'
    ) THEN
        ALTER TABLE public.tutor_trajectory_step
            ADD CONSTRAINT tutor_trajectory_step_evidence_unit CHECK (
                (evidence_rule IS NULL AND evidence_observations IS NULL AND evidence_required IS NULL)
                OR (evidence_rule IS NOT NULL AND evidence_observations IS NOT NULL AND evidence_required IS NOT NULL)
            );
    END IF;
END
$$;

-- The compliance and reversal reports scan consequential decisions by time.
CREATE INDEX IF NOT EXISTS idx_tutor_trajectory_step_evidence
    ON public.tutor_trajectory_step (created_at)
    WHERE evidence_rule IS NOT NULL OR mastery_revoked;

-- ── C.18: THE MENTOR HONESTY LEDGER ─────────────────────────────────────────
--
-- One row per Mentor turn, written by Core when Oracle persists the turn
-- (`POST /tutor/internal/turns` with `honesty`). It is the data source of the
-- Answer-Reveal Rate (per session and per persona) and of the Sycophancy
-- Audit's zero-tolerance count. Oracle never holds an answer key, so
-- `reveal_key_match` is computed HERE, by Core, against the open activity's
-- stored key (services/pedagogy/answerReveal.ts); NULL means "not scorable",
-- never "no".
--
-- PRIVACY POSTURE. No user id and no text: only the persona, the session
-- (SET NULL on the 90-day transcript purge, so the aggregate outlives the
-- conversation without keeping anything about the child) and closed-
-- vocabulary facts. RLS enabled with ZERO client policies — like
-- tutor_trajectory_step, an internal monitoring artifact read only by the
-- service role (the integrity report; the C.24 dashboard later).
--
-- The vocabularies below are HAND-MIRRORED from Oracle's `TurnHonesty`
-- (oracle/src/tutor/feedbackHonesty.ts) and Core's `TurnHonestyBody`
-- (backend/src/routes/tutor.ts); `npm run honesty:check` keeps all three
-- identical.

CREATE TABLE IF NOT EXISTS public.tutor_turn_honesty (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                  uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    -- The persona the learner was talking to (tutor_sessions.character).
    character                   text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    -- The transcript row this describes (tutor_turns.seq).
    turn_seq                    integer NOT NULL CHECK (turn_seq >= 0),
    -- Whether the turn sat inside a hint-ladder, repair or open-activity
    -- sequence — the reveal rate's denominator.
    sequence_kind               text NOT NULL
        CHECK (sequence_kind IN ('hint_ladder', 'repair', 'open_activity', 'none')),
    hint_level                  text NULL
        CHECK (hint_level IS NULL OR hint_level IN ('reask', 'indirect', 'misconception', 'fill_blank', 'tell')),
    -- The learner explicitly asked for the answer, or the ladder reached "tell" (C.13).
    reveal_sanctioned           boolean NOT NULL DEFAULT false,
    -- Core's key-based check: TRUE stated the key, FALSE did not, NULL not scorable.
    reveal_key_match            boolean NULL,
    -- Oracle's deterministic checks on the delivered text.
    reveal_self_answered        boolean NOT NULL DEFAULT false,
    reveal_phrase               boolean NOT NULL DEFAULT false,
    verdict_context             text NULL
        CHECK (verdict_context IS NULL OR verdict_context IN ('after_incorrect', 'after_correct', 'after_unsound_claim')),
    -- A draft affirmed a verified-wrong answer / unsound idea and was repaired or replaced.
    false_affirmation_caught    boolean NOT NULL DEFAULT false,
    -- The DELIVERED turn still affirmed it — zero tolerance; must stay false.
    false_affirmation_delivered boolean NOT NULL DEFAULT false,
    praise                      text NULL CHECK (praise IS NULL OR praise IN ('specific', 'generic')),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    -- Idempotency: Oracle's transcript write is retried as a unit.
    UNIQUE (session_id, turn_seq)
);

CREATE INDEX IF NOT EXISTS idx_tutor_turn_honesty_created
    ON public.tutor_turn_honesty (created_at);
CREATE INDEX IF NOT EXISTS idx_tutor_turn_honesty_character_created
    ON public.tutor_turn_honesty (character, created_at);

ALTER TABLE public.tutor_turn_honesty ENABLE ROW LEVEL SECURITY;
-- No client policy, by design (see PRIVACY POSTURE above).
