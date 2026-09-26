-- @phase: expand
-- *_mentor_evaluation_loop_and_quality_dashboard.sql — Product C.21 (the
-- evaluation-and-improvement loop: continuous transcript scoring against a
-- defined rubric, and anomaly flagging) and C.24 (the consolidated
-- Mentor-quality and engagement-health dashboard with owned regression
-- thresholds), both Appendix E §3.1 Tier 3 (fully-automated measurement and
-- flagging, whose output is information for a human, never a live decision
-- that reaches a child), instrumented for Appendix F §1.4 (Evaluation
-- Pipeline Uptime/Coverage Rate; Dashboard Data-Freshness & Usage Rate).
--
-- Additive only: one nullable column and one partial index on an existing
-- table, six new tables. Safe to apply before or after the code; the Core
-- release that WRITES these tables must follow it (without it the evaluation
-- pass records nothing and answers 502, the dashboard answers 502; the
-- Mentor's live path does not touch any of this).
--
-- PRIVACY POSTURE. No text and no learner id anywhere below. Scores carry
-- the persona, the age tier and the locale (the segments the disparity flags
-- need) and the session id, which becomes NULL when the 90-day transcript
-- purge deletes the session, so the aggregate outlives the conversation
-- without keeping anything about the child. Every table has RLS enabled and
-- ZERO client policies: Core's service role is the only reader and writer
-- (the evaluation loop and the staff routes behind `view_analytics`).
--
-- Every vocabulary below is HAND-MIRRORED from Core
-- (`services/pedagogy/transcriptRubric.ts`, `transcriptScoring.ts`,
-- `mentorQuality.ts`) and the rebuilt staff client
-- (`frontend/src/rebuild/staff/mentorQualityApi.ts`);
-- `npm run evaluation-loop:check` keeps them identical.

-- ── 1. The coverage stamp ───────────────────────────────────────────────────
--
-- Set once a session has been scored, to the rubric hash it was scored
-- against. NULL = not scored yet: the pass's work queue, and the Evaluation
-- Pipeline Coverage Rate's gap.
ALTER TABLE public.tutor_sessions
    ADD COLUMN IF NOT EXISTS evaluation_rubric_hash text NULL
        CHECK (evaluation_rubric_hash IS NULL OR evaluation_rubric_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_unevaluated
    ON public.tutor_sessions (ended_at)
    WHERE ended_at IS NOT NULL AND evaluation_rubric_hash IS NULL;

-- ── 2. Transcript scores (C.21) ─────────────────────────────────────────────
--
-- One row per session × criterion × scorer × rubric. `scorer` admits only the
-- deterministic 'rules' scorer: an AI judge may not write scores until it is
-- calibrated against a human panel (C.23, Appendix E §3.2). Widening this
-- CHECK is the schema half of that decision, on purpose.
CREATE TABLE IF NOT EXISTS public.tutor_transcript_score (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character         text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    tier              smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    locale            text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    rubric_version    text NOT NULL CHECK (rubric_version ~ '^mentor-transcript-rubric\.v[0-9]{1,3}$'),
    rubric_hash       text NOT NULL CHECK (rubric_hash ~ '^[0-9a-f]{64}$'),
    scorer            text NOT NULL CHECK (scorer IN ('rules')),
    criterion         text NOT NULL CHECK (criterion IN (
                          'answer_reveal',
                          'false_affirmation',
                          'praise_specificity',
                          'emotion_label',
                          'hint_repeat',
                          'tell_honored',
                          'closing_script',
                          'check_in',
                          'goal_agreement',
                          'controlling_language',
                          'self_explanation',
                          'scaffold_quality'
                      )),
    outcome           text NOT NULL CHECK (outcome IN ('pass', 'fail', 'observed', 'not_applicable')),
    numerator         integer NOT NULL CHECK (numerator BETWEEN 0 AND 100000),
    denominator       integer NOT NULL CHECK (denominator BETWEEN 0 AND 100000),
    session_ended_at  timestamptz NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK (numerator <= denominator),
    CHECK (outcome <> 'not_applicable' OR denominator = 0),
    -- Idempotency: a retried pass writes the same rows.
    UNIQUE (session_id, scorer, rubric_hash, criterion)
);

CREATE INDEX IF NOT EXISTS idx_tutor_transcript_score_ended
    ON public.tutor_transcript_score (rubric_hash, session_ended_at);
CREATE INDEX IF NOT EXISTS idx_tutor_transcript_score_created
    ON public.tutor_transcript_score (created_at);

ALTER TABLE public.tutor_transcript_score ENABLE ROW LEVEL SECURITY;
-- No client policy, by design (see PRIVACY POSTURE above).

-- ── 3. The pass log (C.21 uptime, C.24 freshness) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.tutor_evaluation_run (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger              text NOT NULL CHECK (trigger IN ('schedule', 'operator')),
    rubric_hash          text NOT NULL CHECK (rubric_hash ~ '^[0-9a-f]{64}$'),
    started_at           timestamptz NOT NULL,
    finished_at          timestamptz NULL,
    backlog_before       integer NULL CHECK (backlog_before IS NULL OR backlog_before >= 0),
    scored               integer NOT NULL CHECK (scored >= 0),
    failed               integer NOT NULL CHECK (failed >= 0),
    flags_opened         integer NOT NULL DEFAULT 0 CHECK (flags_opened >= 0),
    flags_refreshed      integer NOT NULL DEFAULT 0 CHECK (flags_refreshed >= 0),
    signals_breached     integer NOT NULL DEFAULT 0 CHECK (signals_breached >= 0),
    signals_unavailable  integer NOT NULL DEFAULT 0 CHECK (signals_unavailable >= 0),
    status               text NOT NULL CHECK (status IN ('ok', 'partial', 'failed')),
    created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_evaluation_run_started
    ON public.tutor_evaluation_run (started_at DESC);

ALTER TABLE public.tutor_evaluation_run ENABLE ROW LEVEL SECURITY;

-- ── 4. The consolidated signals, as computed (C.24) ─────────────────────────
--
-- `signals` is the array of readings: closed-vocabulary ids, numbers and
-- statuses only (the loop never writes text into it). Pruned after 90 days.
CREATE TABLE IF NOT EXISTS public.mentor_quality_snapshot (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NULL REFERENCES public.tutor_evaluation_run (id) ON DELETE SET NULL,
    schema_version  text NOT NULL CHECK (schema_version = 'mentor-quality.v1'),
    computed_at     timestamptz NOT NULL,
    window_days     smallint NOT NULL CHECK (window_days BETWEEN 1 AND 365),
    rubric_hash     text NOT NULL CHECK (rubric_hash ~ '^[0-9a-f]{64}$'),
    signals         jsonb NOT NULL CHECK (jsonb_typeof(signals) = 'array'),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_quality_snapshot_computed
    ON public.mentor_quality_snapshot (computed_at DESC);

ALTER TABLE public.mentor_quality_snapshot ENABLE ROW LEVEL SECURITY;

-- ── 5. Named owners (Appendix F §1.4 "named owners") ────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_quality_owner (
    owner_role   text NOT NULL CHECK (owner_role IN ('pedagogical_lead', 'safety_trust_lead', 'engineering_lead')),
    user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    assigned_by  uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    assigned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_role, user_id)
);

ALTER TABLE public.mentor_quality_owner ENABLE ROW LEVEL SECURITY;

-- ── 6. Flags: a regression that requires a named owner's review ─────────────
--
-- Opened by the loop, refreshed while the anomaly persists, NEVER closed by
-- the machine: a named owner acknowledges it and resolves it with the root
-- cause in words. At most one active (open or acknowledged) flag per anomaly.
CREATE TABLE IF NOT EXISTS public.mentor_quality_flag (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id        text NOT NULL CHECK (signal_id ~ '^[a-z_]+\.[a-z_]+$'),
    kind             text NOT NULL CHECK (kind IN (
                         'threshold_breach',
                         'zero_tolerance',
                         'upward_drift',
                         'relative_drop',
                         'persona_disparity',
                         'subgroup_disparity',
                         'source_unavailable'
                     )),
    requirement      text NOT NULL CHECK (requirement ~ '^[BC]\.[0-9]{1,2}$'),
    owner_role       text NOT NULL CHECK (owner_role IN ('pedagogical_lead', 'safety_trust_lead', 'engineering_lead')),
    severity         text NOT NULL CHECK (severity IN ('review', 'urgent')),
    scope            text NOT NULL CHECK (scope ~ '^[a-z]+(:[A-Za-z0-9_.:-]+)?(/[a-z]+:[A-Za-z0-9_.:-]+)*$' AND char_length(scope) <= 120),
    dedup_key        text NOT NULL CHECK (char_length(dedup_key) BETWEEN 1 AND 240),
    metric_value     numeric(9, 4) NULL,
    threshold        numeric(9, 4) NULL,
    evidence         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
    status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    opened_at        timestamptz NOT NULL DEFAULT now(),
    last_seen_at     timestamptz NOT NULL DEFAULT now(),
    seen_count       integer NOT NULL DEFAULT 1 CHECK (seen_count >= 1),
    acknowledged_by  uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    acknowledged_at  timestamptz NULL,
    resolved_by      uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    resolved_at      timestamptz NULL,
    resolution_note  text NULL CHECK (resolution_note IS NULL OR char_length(resolution_note) BETWEEN 10 AND 2000),
    CHECK (status = 'open' OR acknowledged_at IS NOT NULL),
    CHECK (status <> 'resolved' OR (resolved_at IS NOT NULL AND resolution_note IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_quality_flag_active
    ON public.mentor_quality_flag (dedup_key)
    WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS idx_mentor_quality_flag_status
    ON public.mentor_quality_flag (status, owner_role, opened_at DESC);

ALTER TABLE public.mentor_quality_flag ENABLE ROW LEVEL SECURITY;

-- ── 7. The weekly owner review (Appendix F §1.4 Dashboard Usage Rate) ───────
CREATE TABLE IF NOT EXISTS public.mentor_quality_review (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_role   text NOT NULL CHECK (owner_role IN ('pedagogical_lead', 'safety_trust_lead', 'engineering_lead')),
    reviewer_id  uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    -- The Monday of the ISO week reviewed.
    week_start   date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    snapshot_id  uuid NULL REFERENCES public.mentor_quality_snapshot (id) ON DELETE SET NULL,
    open_flags   integer NOT NULL CHECK (open_flags >= 0),
    note         text NULL CHECK (note IS NULL OR char_length(note) <= 2000),
    reviewed_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_role, reviewer_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_mentor_quality_review_week
    ON public.mentor_quality_review (week_start DESC);

ALTER TABLE public.mentor_quality_review ENABLE ROW LEVEL SECURITY;
-- No client policy on any table in this migration: service role only.
