-- 0052_kc_graph.sql — the Tutor v3 pedagogical brain: knowledge components,
-- prerequisites, misconceptions, online mastery, spaced review, evidence.
-- @phase: expand
--
-- Authoritative design: /ORACLE.md (Tutor v3 sections). Owner decisions
-- 2026-08-28: blueprint architecture on the locked stack; money-math AND
-- entrepreneurship strands from day 1.
--
-- WHAT THIS ADDS AND WHY. The Tutor before v3 had no state a teacher would
-- recognize: mastery lived as an offline Beta smoothing in Data Intel that no
-- session updated, review dates were computed and never read, and "pedagogy"
-- was a fixed step list. These seven tables are the missing organ:
--
--   kc / kc_edge            the curriculum as a prerequisite DAG of
--                           Knowledge Components — units fine enough to be
--                           evaluated with 3-5 items and mastered in one
--                           sitting, joined to the existing content pools
--                           through kc.skill_key
--   misconception           the catalog of SYSTEMATIC wrong ideas per KC,
--                           with deterministic detectors — what lets the
--                           tutor say "you are adding instead of counting
--                           up the change" instead of "incorrect"
--   learner_kc_mastery      the BKT posterior, updated ONLINE per attempt
--                           by Core, persisted — a session leaves a trace
--   memory_card             FSRS-style spaced-review state per (learner, KC)
--                           — what "repaso de hoy" is built from
--   learner_misconception   which wrong ideas THIS learner has shown, and
--                           whether they were resolved
--   kc_attempt              the evidence log: every graded attempt with the
--                           posterior before/after and the strategy in force,
--                           so a pedagogical decision is explainable later
--
-- POSTURE. Same as 0047: everything is written by Core with the service
-- role; no client INSERT/UPDATE/DELETE policy exists on any of these tables.
-- Learners (and their verified guardians — the parent-visibility invariant,
-- /AGENTS.md §1.9) read their own learner rows. The kc catalog and its edges
-- are world-readable to authenticated users (pure curriculum, no answers);
-- `misconception` has NO client policy at all, because remediation hints and
-- distractor detectors are answer-adjacent, the same posture as tutor_packs.
--
-- WHAT IS DELIBERATELY ABSENT. kc_attempt has no raw-answer column. A spoken
-- answer is normalized to a number/option BEFORE it reaches this table; the
-- utterance itself lives in tutor_turns under the existing 90-day retention.
-- Evidence must not become a second, unregulated transcript.

-- ─────────────────────────────────────────────────────────────
-- kc — the Knowledge Component catalog
-- ─────────────────────────────────────────────────────────────
-- BKT parameter constraints follow the literature's degeneracy guards:
-- p_g (guess) ≤ 0.30 and p_s (slip) ≤ 0.10 keep EM-style refits and hand
-- edits from producing an uninterpretable model.
CREATE TABLE IF NOT EXISTS public.kc (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key         text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_.-]{2,95}$'),
    strand      text NOT NULL CHECK (strand IN ('money_math', 'entrepreneurship')),
    -- Localized {"en-US": ..., "es-MX": ..., "pt-BR": ...}, like courses.title.
    title       jsonb NOT NULL,
    -- One teachable objective sentence per locale. This is OUR catalog text
    -- and may reach the model as part of the sealed pedagogy context.
    objective   jsonb NOT NULL,
    tier_min    smallint NOT NULL DEFAULT 1 CHECK (tier_min BETWEEN 1 AND 3),
    p_l0        numeric(4,3) NOT NULL DEFAULT 0.250 CHECK (p_l0 >= 0 AND p_l0 <= 1),
    p_t         numeric(4,3) NOT NULL DEFAULT 0.150 CHECK (p_t  >= 0 AND p_t  <= 1),
    p_g         numeric(4,3) NOT NULL DEFAULT 0.200 CHECK (p_g  >= 0 AND p_g  <= 0.300),
    p_s         numeric(4,3) NOT NULL DEFAULT 0.100 CHECK (p_s  >= 0 AND p_s  <= 0.100),
    -- Bridge to the existing content world: the ladder serves segments by
    -- skill_key (lower(course_slug || '/' || topic_slug), 0036 convention).
    -- Several KCs may share one skill_key; NULL means no published pool yet.
    skill_key   text NULL CHECK (skill_key IS NULL OR char_length(skill_key) <= 128),
    status      text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'retired')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_skill_key ON public.kc (skill_key) WHERE skill_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kc_strand ON public.kc (strand) WHERE status = 'active';

ALTER TABLE public.kc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kc_select_all ON public.kc;
CREATE POLICY kc_select_all ON public.kc
    FOR SELECT TO authenticated USING (status = 'active');

-- ─────────────────────────────────────────────────────────────
-- kc_edge — the prerequisite DAG
-- ─────────────────────────────────────────────────────────────
-- Acyclicity is enforced by the seed loader (topological check), not by a
-- trigger: the graph changes at authoring time, never at request time, and a
-- cycle check per insert would be cost without a caller.
CREATE TABLE IF NOT EXISTS public.kc_edge (
    prerequisite_kc_id uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    dependent_kc_id    uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    PRIMARY KEY (prerequisite_kc_id, dependent_kc_id),
    CONSTRAINT kc_edge_no_self_loop CHECK (prerequisite_kc_id <> dependent_kc_id)
);

CREATE INDEX IF NOT EXISTS idx_kc_edge_dependent ON public.kc_edge (dependent_kc_id);

ALTER TABLE public.kc_edge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kc_edge_select_all ON public.kc_edge;
CREATE POLICY kc_edge_select_all ON public.kc_edge
    FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────
-- misconception — the catalog of systematic wrong ideas
-- ─────────────────────────────────────────────────────────────
-- `distractor_patterns` is the deterministic detector, e.g.
--   {"numeric": ["a+b"], "option_tags": ["adds-instead-of-counts-up"]}
-- where "a+b" names a transform of the item's own operands that this wrong
-- idea would produce. Detection is arithmetic, never a model's opinion.
CREATE TABLE IF NOT EXISTS public.misconception (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kc_id               uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    code                text NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9_.-]{2,95}$'),
    -- Staff-facing description, localized.
    description         jsonb NOT NULL,
    -- OUR remediation wording, localized. May reach the model as the sealed
    -- `misconceptionHint`; never contains learner text by construction.
    remediation_hint    jsonb NOT NULL,
    distractor_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (kc_id, code)
);

ALTER TABLE public.misconception ENABLE ROW LEVEL SECURITY;
-- No client policy: answer-adjacent, same posture as tutor_packs.

-- ─────────────────────────────────────────────────────────────
-- learner_kc_mastery — the online BKT posterior
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learner_kc_mastery (
    user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kc_id           uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    p_known         numeric(6,5) NOT NULL CHECK (p_known >= 0 AND p_known <= 1),
    attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    correct         integer NOT NULL DEFAULT 0 CHECK (correct >= 0 AND correct <= attempts),
    -- Per-learner BKT parameter overrides (BBKT), a later calibration step.
    params_override jsonb NULL,
    last_attempt_at timestamptz NULL,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kc_id)
);

ALTER TABLE public.learner_kc_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_kc_mastery_select_own ON public.learner_kc_mastery;
CREATE POLICY learner_kc_mastery_select_own ON public.learner_kc_mastery
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- memory_card — spaced-review state (FSRS-style)
-- ─────────────────────────────────────────────────────────────
-- One card per (learner, KC), not per item: the Tutor reviews CONCEPTS with
-- fresh items each time, so the memory model attaches to the KC.
CREATE TABLE IF NOT EXISTS public.memory_card (
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kc_id          uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    state          text NOT NULL DEFAULT 'new'
                       CHECK (state IN ('new', 'learning', 'review', 'relearning')),
    stability      numeric(8,3) NOT NULL DEFAULT 0 CHECK (stability >= 0),
    difficulty     numeric(4,2) NOT NULL DEFAULT 5 CHECK (difficulty >= 1 AND difficulty <= 10),
    reps           integer NOT NULL DEFAULT 0 CHECK (reps >= 0),
    lapses         integer NOT NULL DEFAULT 0 CHECK (lapses >= 0),
    due_at         timestamptz NOT NULL DEFAULT now(),
    last_review_at timestamptz NULL,
    PRIMARY KEY (user_id, kc_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_card_due ON public.memory_card (user_id, due_at);

ALTER TABLE public.memory_card ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memory_card_select_own ON public.memory_card;
CREATE POLICY memory_card_select_own ON public.memory_card
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- learner_misconception — which wrong ideas this learner has shown
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learner_misconception (
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    misconception_id uuid NOT NULL REFERENCES public.misconception (id) ON DELETE CASCADE,
    evidence_count   integer NOT NULL DEFAULT 1 CHECK (evidence_count >= 1),
    last_seen_at     timestamptz NOT NULL DEFAULT now(),
    resolved_at      timestamptz NULL,
    PRIMARY KEY (user_id, misconception_id)
);

ALTER TABLE public.learner_misconception ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_misconception_select_own ON public.learner_misconception;
CREATE POLICY learner_misconception_select_own ON public.learner_misconception
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- kc_attempt — the evidence log
-- ─────────────────────────────────────────────────────────────
-- Every pedagogical decision must be explainable after the fact: which
-- strategy was in force, what the posterior was before and after. This is
-- the trace a parent-facing explanation and an audit both read from.
CREATE TABLE IF NOT EXISTS public.kc_attempt (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kc_id            uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    session_id       uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    segment_id       uuid NULL REFERENCES public.tutor_segments (id) ON DELETE SET NULL,
    source           text NOT NULL CHECK (source IN ('segment_grade', 'voice_check')),
    correct          boolean NOT NULL,
    score            integer NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    -- The controller strategy in force when this evidence was produced.
    strategy         text NULL CHECK (strategy IS NULL OR strategy IN
                         ('DIRECT', 'WORKED', 'FADED', 'SOCRATIC', 'FLUENCY', 'SPACED',
                          'PROBE', 'REMEDIATE', 'RESCUE', 'ELABORATE', 'TRANSFER', 'CELEBRATE')),
    misconception_id uuid NULL REFERENCES public.misconception (id) ON DELETE SET NULL,
    p_known_before   numeric(6,5) NOT NULL CHECK (p_known_before >= 0 AND p_known_before <= 1),
    p_known_after    numeric(6,5) NOT NULL CHECK (p_known_after  >= 0 AND p_known_after  <= 1),
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_attempt_user_created
    ON public.kc_attempt (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kc_attempt_kc
    ON public.kc_attempt (kc_id, created_at DESC);

ALTER TABLE public.kc_attempt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kc_attempt_select_own ON public.kc_attempt;
CREATE POLICY kc_attempt_select_own ON public.kc_attempt
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
