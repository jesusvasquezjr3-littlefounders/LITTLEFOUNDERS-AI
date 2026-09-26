-- @phase: expand
-- *_mentor_behavioral_telemetry.sql — Product C.9 (the Behavioral Telemetry
-- Layer) and C.19 (the disengagement check-in and repair-initiation move),
-- instrumented for Appendix F §1.2 (Default-to-Inaction Rate, Disengagement-
-- Repair Initiation Rate) and the Part 3 Stage 7 kill switch. Additive only:
-- three nullable columns on an existing table and one new table. Safe to apply
-- before or after the code; the Core release that WRITES these columns must
-- not be deployed before this migration is applied (PostgREST refuses a PATCH
-- naming a column its schema cache does not have, and the close would then
-- fail — see the deploy order in
-- docs/rebuild/sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md).
--
-- ── THE PER-SESSION COUNTS (Default-to-Inaction Rate) ───────────────────────
--
--   telemetry_mode              act | shadow: how the layer ran this session
--                               (NULL: a session before this build, or the
--                               layer switched off — nothing was computed).
--   telemetry_evaluated_turns   learner turns on which the layer computed a
--                               reading (after the learner's own baseline).
--   telemetry_action_turns      of those, turns on which it acted (a check-in
--                               fired). Default-to-Inaction Rate =
--                               1 − Σ action / Σ evaluated (floor 85%,
--                               proposed, pending calibration).
--
-- The three travel together (a CHECK), and action ≤ evaluated.

ALTER TABLE public.tutor_sessions
    ADD COLUMN IF NOT EXISTS telemetry_mode text NULL
        CHECK (telemetry_mode IS NULL OR telemetry_mode IN ('act', 'shadow')),
    ADD COLUMN IF NOT EXISTS telemetry_evaluated_turns integer NULL
        CHECK (telemetry_evaluated_turns IS NULL OR telemetry_evaluated_turns BETWEEN 0 AND 100000),
    ADD COLUMN IF NOT EXISTS telemetry_action_turns integer NULL
        CHECK (telemetry_action_turns IS NULL OR telemetry_action_turns BETWEEN 0 AND 100000);

-- A NEW constraint over columns this same migration adds (every existing row
-- is all-NULL, so it validates trivially). Guarded so a re-run is a no-op.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tutor_sessions_telemetry_counts_together'
    ) THEN
        ALTER TABLE public.tutor_sessions
            ADD CONSTRAINT tutor_sessions_telemetry_counts_together CHECK (
                (telemetry_mode IS NULL AND telemetry_evaluated_turns IS NULL AND telemetry_action_turns IS NULL)
                OR (
                    telemetry_mode IS NOT NULL
                    AND telemetry_evaluated_turns IS NOT NULL
                    AND telemetry_action_turns IS NOT NULL
                    AND telemetry_action_turns <= telemetry_evaluated_turns
                )
            );
    END IF;
END
$$;

-- The kill-switch evaluation and the report scan recent closed sessions.
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_telemetry_ended
    ON public.tutor_sessions (ended_at)
    WHERE telemetry_mode IS NOT NULL;

-- ── THE FIRING LEDGER (Disengagement-Repair Initiation Rate) ────────────────
--
-- One row per FIRING of the fused disengagement signal, written by Core at
-- close from Oracle's report: the strength of each of the eight channels in
-- [0, 1] against the learner's own baseline, how many fused channels were
-- elevated, the mode, and what happened to the C.19 check-in:
--
--   aligned / misaligned / unanswered   the check-in WAS asked (initiated);
--   undelivered                         a Mentor turn went out without it —
--                                       a real miss (Repair Initiation < 100%,
--                                       a Stage 7 trigger);
--   session_ended                       the session ended before any Mentor
--                                       turn could carry it (no opportunity);
--   superseded                          a safety stop or a closing sequence
--                                       took precedence (by design);
--   shadow                              recorded under the kill switch, never
--                                       acted on.
--
-- SIGNAL STRENGTH ONLY, NEVER AN EMOTION LABEL (Appendix D §1.7, Block C
-- non-negotiable): there is no column that could hold one, and Core's strict
-- body refuses any extra field.
--
-- PRIVACY POSTURE. No user id and no text: only the persona, the session
-- (SET NULL on the 90-day transcript purge, so the aggregate outlives the
-- conversation without keeping anything about the child) and numbers. RLS
-- enabled with ZERO client policies — an internal monitoring artifact read
-- only by the service role (`npm --prefix backend run tutor:telemetry-report`
-- and Core's kill-switch evaluation; the C.24 dashboard later).
--
-- The vocabularies are HAND-MIRRORED from Oracle
-- (`tutor/behavioralTelemetry.ts`) and Core
-- (`services/pedagogy/behavioralTelemetry.ts`); `npm run telemetry:check`
-- keeps them identical.

CREATE TABLE IF NOT EXISTS public.tutor_telemetry_firing (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character        text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    -- 1-based index of the learner observation it fired on.
    observation      integer NOT NULL CHECK (observation BETWEEN 1 AND 10000),
    latency_shift    numeric(4, 3) NOT NULL CHECK (latency_shift BETWEEN 0 AND 1),
    rapid_response   numeric(4, 3) NOT NULL CHECK (rapid_response BETWEEN 0 AND 1),
    verbosity_drop   numeric(4, 3) NOT NULL CHECK (verbosity_drop BETWEEN 0 AND 1),
    repeated_answer  numeric(4, 3) NOT NULL CHECK (repeated_answer BETWEEN 0 AND 1),
    hedging          numeric(4, 3) NOT NULL CHECK (hedging BETWEEN 0 AND 1),
    off_topic        numeric(4, 3) NOT NULL CHECK (off_topic BETWEEN 0 AND 1),
    hint_abuse       numeric(4, 3) NOT NULL CHECK (hint_abuse BETWEEN 0 AND 1),
    fast_known_miss  numeric(4, 3) NOT NULL CHECK (fast_known_miss BETWEEN 0 AND 1),
    channels         smallint NOT NULL CHECK (channels BETWEEN 0 AND 8),
    mode             text NOT NULL CHECK (mode IN ('act', 'shadow')),
    outcome          text NOT NULL CHECK (outcome IN (
                        'aligned',
                        'misaligned',
                        'unanswered',
                        'undelivered',
                        'session_ended',
                        'superseded',
                        'shadow'
                     )),
    -- Whether the repair turn after "not really" carried an adaptation offer;
    -- NULL when there was no repair.
    repair_offered   boolean NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    -- Idempotency: a close that is retried writes the same firings.
    UNIQUE (session_id, observation)
);

CREATE INDEX IF NOT EXISTS idx_tutor_telemetry_firing_created
    ON public.tutor_telemetry_firing (created_at);

ALTER TABLE public.tutor_telemetry_firing ENABLE ROW LEVEL SECURITY;
-- No client policy, by design (see PRIVACY POSTURE above).
