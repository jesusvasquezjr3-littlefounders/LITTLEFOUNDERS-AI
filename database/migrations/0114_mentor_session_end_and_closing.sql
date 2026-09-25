-- @phase: expand
-- *_mentor_session_end_and_closing.sql — Product C.16 (end-reason-specific
-- closing scripts) and C.8/C.12 (the behavioral-signature session-end signal),
-- instrumented for Appendix F §1.1 and §1.2. Additive only: three nullable
-- columns on an existing table and one new table. Safe to apply before or
-- after the code; the Core release that WRITES these columns must not be
-- deployed before this migration is applied (PostgREST refuses a PATCH naming
-- a column its schema cache does not have, and the close would then fail —
-- see the deploy order in docs/rebuild/sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md).
--
-- ── C.16: THE SESSION-CLOSE EVENT LOG ───────────────────────────────────────
--
-- `tutor_sessions.close_reason` (0047) says WHY a session ended. Appendix F's
-- Session-Closing Script Accuracy (target 100%) asks whether the Mentor then
-- used the RIGHT closing script for that reason, so the script actually used
-- is recorded beside it, as Oracle reports it at close:
--
--   closing_script        completed | interrupted | learner_left | safety_stop
--                         (NULL: a session closed before this build).
--   opening               the line the session OPENED with: the greeting, or
--                         the re-engagement message a silent dropout or a
--                         budget interruption in the learner's previous
--                         session queued for their return. It is how C.16's
--                         "queued for return" is measured to have happened.
--   end_signal_evaluated  whether the C.8/C.12 signal had enough graded turns
--                         to be evaluated at all — the Trigger Rate's
--                         denominator (NULL: before this build, or the
--                         signal was switched off).
--
-- The vocabularies are HAND-MIRRORED from Oracle (`tutor/sessionClosing.ts`,
-- `tutor/sessionEndSignal.ts`) and Core (`routes/tutor.ts` CloseBody,
-- `services/pedagogy/sessionEnd.ts`); `npm run session-end:check` keeps them
-- identical.

ALTER TABLE public.tutor_sessions
    ADD COLUMN IF NOT EXISTS closing_script text NULL
        CHECK (closing_script IS NULL OR closing_script IN ('completed', 'interrupted', 'learner_left', 'safety_stop')),
    ADD COLUMN IF NOT EXISTS opening text NULL
        CHECK (opening IS NULL OR opening IN (
            'greeting',
            'reengage_left_resume',
            'reengage_left_fresh',
            'reengage_interrupted_resume',
            'reengage_interrupted_fresh'
        )),
    ADD COLUMN IF NOT EXISTS end_signal_evaluated boolean NULL;

-- The accuracy report scans closed sessions by close time.
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_closing_script_ended
    ON public.tutor_sessions (ended_at)
    WHERE closing_script IS NOT NULL;

-- ── C.8 / C.12: THE SESSION-END SIGNAL LEDGER ───────────────────────────────
--
-- One row per FIRING of the behavioral-signature signal (Appendix D §2.5),
-- written by Core at close from Oracle's report. It is the data source of the
-- Early-Warning Signal Trigger Rate (Appendix F §1.1): the share of evaluated
-- sessions where it fired before the hard cap (`remaining_ms` > 0), and the
-- precision of those firings (`confirmed`).
--
-- SIGNAL STRENGTH ONLY, NEVER AN EMOTION LABEL (Block C non-negotiable): the
-- row holds the two measured deltas against the learner's own session-opening
-- baseline, the mode (offer, or shadow under the Stage 7 kill switch), what
-- the learner chose, and whether later evidence confirmed it.
--
-- PRIVACY POSTURE. No user id and no text: only the persona, the session
-- (SET NULL on the 90-day transcript purge, so the aggregate outlives the
-- conversation without keeping anything about the child) and numbers. RLS
-- enabled with ZERO client policies — an internal monitoring artifact read
-- only by the service role (`npm --prefix backend run tutor:session-end-report`;
-- the C.24 dashboard later).

CREATE TABLE IF NOT EXISTS public.tutor_session_end_signal (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character               text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    -- 1-based index of the graded observation it fired on.
    observation             integer NOT NULL CHECK (observation BETWEEN 1 AND 10000),
    elapsed_ms              integer NOT NULL CHECK (elapsed_ms >= 0),
    -- Time left before the hard cap when it fired: > 0 is "before the hard cap".
    remaining_ms            integer NOT NULL CHECK (remaining_ms >= 0),
    latency_sd_baseline     numeric(6, 3) NOT NULL CHECK (latency_sd_baseline >= 0),
    latency_sd_window       numeric(6, 3) NOT NULL CHECK (latency_sd_window >= 0),
    surprise_rate_baseline  numeric(4, 3) NOT NULL CHECK (surprise_rate_baseline BETWEEN 0 AND 1),
    surprise_rate_window    numeric(4, 3) NOT NULL CHECK (surprise_rate_window BETWEEN 0 AND 1),
    mode                    text NOT NULL CHECK (mode IN ('offer', 'shadow')),
    outcome                 text NOT NULL CHECK (outcome IN ('accepted', 'declined', 'unanswered', 'not_offered')),
    -- TRUE accepted or the surprising misses persisted; FALSE they recovered;
    -- NULL undetermined (the session ended first).
    confirmed               boolean NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    -- Idempotency: a close that is retried writes the same firings.
    UNIQUE (session_id, observation)
);

CREATE INDEX IF NOT EXISTS idx_tutor_session_end_signal_created
    ON public.tutor_session_end_signal (created_at);

ALTER TABLE public.tutor_session_end_signal ENABLE ROW LEVEL SECURITY;
-- No client policy, by design (see PRIVACY POSTURE above).
