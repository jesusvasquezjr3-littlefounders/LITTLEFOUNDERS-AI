-- @phase: expand
-- *_mentor_alliance_and_disposition.sql — Product C.15 (the Alliance
-- Controller), C.14 (the self-explanation move) and C.7 (the persistent
-- learner disposition profile), instrumented for Appendix F §1.2 (Alliance
-- Bond Proxy Score, Goal-Agreement Completion Rate, Adaptation-Offer
-- Renegotiation Trigger Rate, Self-Explanation Quality-Check Pass Rate,
-- Disposition-Profile Completeness Rate) and the Part 3 Stage 7 Alliance
-- Controller kill switch. Additive only: four new tables. Safe to apply before
-- or after the code; the Core release that WRITES them must not be deployed
-- before this migration is applied (a POST to a table PostgREST does not know
-- fails, and the close record would lose its alliance data — see the deploy
-- order in docs/rebuild/sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md).
--
-- Every vocabulary below is HAND-MIRRORED from Oracle
-- (`tutor/allianceController.ts`, `tutor/selfExplanation.ts`,
-- `tutor/explanationLexicon.ts`, `tutor/dispositionProfile.ts`) and Core
-- (`services/pedagogy/alliance.ts`, `services/pedagogy/disposition.ts`);
-- `npm run alliance:check` keeps them identical.
--
-- ── 1. THE PER-SESSION ALLIANCE RECORD (explicit, queryable C.15 state) ──────
--
-- One row per session that ran the Alliance Controller: how the session
-- opened for this persona (continuity and whether the re-establishment
-- happened), whether a goal was agreed in the learner's own terms, the task
-- signals (adaptation offers, acceptances, declines), the bond signals (turns
-- that referenced something specific the learner did vs generic praise) and
-- the end-of-session bond proxy ("did I get what you were going for today?"),
-- which the learner answers AFTER the session closes (`bond_proxy`).
--
-- PRIVACY POSTURE. No user id and no text: the persona, the session (SET NULL
-- on the 90-day transcript purge, so the per-persona aggregate the Stage 7
-- baseline needs outlives the conversation without keeping anything about the
-- child), labels and counts. RLS enabled with ZERO client policies: an
-- internal monitoring artifact read by the service role only
-- (`npm --prefix backend run tutor:alliance-report`, Core's kill switch).
-- The learner's own bond-proxy answer is written by Core after it checked the
-- session is theirs.

CREATE TABLE IF NOT EXISTS public.tutor_session_alliance (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id               uuid NULL UNIQUE REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character                text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    mode                     text NOT NULL CHECK (mode IN ('act', 'shadow')),
    continuity               text NULL CHECK (continuity IS NULL OR continuity IN (
                                'first_meeting', 'persona_switch', 'memory_gap', 'continuing'
                             )),
    continuity_move          text NOT NULL CHECK (continuity_move IN ('delivered', 'shadow', 'not_needed', 'unknown')),
    goal_agreement           text NOT NULL CHECK (goal_agreement IN ('agreed', 'renegotiated', 'unconfirmed', 'not_reached')),
    goal_settled_at_turn     integer NULL CHECK (goal_settled_at_turn IS NULL OR goal_settled_at_turn BETWEEN 1 AND 10000),
    learner_turns            integer NOT NULL CHECK (learner_turns BETWEEN 0 AND 10000),
    adaptation_offers        integer NOT NULL CHECK (adaptation_offers BETWEEN 0 AND 10000),
    adaptation_accepts       integer NOT NULL CHECK (adaptation_accepts BETWEEN 0 AND 10000),
    adaptation_declines      integer NOT NULL CHECK (adaptation_declines BETWEEN 0 AND 10000),
    bond_specific_turns      integer NOT NULL CHECK (bond_specific_turns BETWEEN 0 AND 10000),
    bond_generic_turns       integer NOT NULL CHECK (bond_generic_turns BETWEEN 0 AND 10000),
    -- C.14: how the self-explanation move ran this session (NULL: off).
    self_explanation_mode    text NULL CHECK (self_explanation_mode IS NULL OR self_explanation_mode IN ('act', 'shadow')),
    self_explanation_prompts integer NULL CHECK (self_explanation_prompts IS NULL OR self_explanation_prompts BETWEEN 0 AND 100),
    -- The end-of-session bond proxy, answered after the close (NULL: not answered).
    bond_proxy               text NULL CHECK (bond_proxy IS NULL OR bond_proxy IN ('yes', 'partly', 'no')),
    bond_proxy_at            timestamptz NULL,
    created_at               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tutor_session_alliance_goal_turn CHECK (
        (goal_agreement IN ('agreed', 'renegotiated')) = (goal_settled_at_turn IS NOT NULL)
    ),
    CONSTRAINT tutor_session_alliance_bond_proxy_together CHECK ((bond_proxy IS NULL) = (bond_proxy_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_tutor_session_alliance_created
    ON public.tutor_session_alliance (created_at);
CREATE INDEX IF NOT EXISTS idx_tutor_session_alliance_bond_proxy
    ON public.tutor_session_alliance (character, bond_proxy_at)
    WHERE bond_proxy IS NOT NULL;

ALTER TABLE public.tutor_session_alliance ENABLE ROW LEVEL SECURITY;
-- No client policy, by design (see PRIVACY POSTURE above).

-- ── 2. THE RENEGOTIATION LEDGER (Renegotiation Trigger Rate; Stage 7) ────────
--
-- One row per time the decline pattern completed: whether the renegotiation
-- question was asked and answered, and whether the session IMPROVED over the
-- following learner turns (no further decline, no disengagement firing, no
-- "not really" at a check-in). `improved` NULL: the session ended before the
-- window closed. Same privacy posture as above.

CREATE TABLE IF NOT EXISTS public.tutor_alliance_renegotiation (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character    text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    observation  integer NOT NULL CHECK (observation BETWEEN 1 AND 10),
    at_turn      integer NOT NULL CHECK (at_turn BETWEEN 0 AND 10000),
    mode         text NOT NULL CHECK (mode IN ('act', 'shadow')),
    outcome      text NOT NULL CHECK (outcome IN (
                    'answered', 'unanswered', 'undelivered', 'session_ended', 'superseded', 'shadow'
                 )),
    improved     boolean NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, observation)
);

CREATE INDEX IF NOT EXISTS idx_tutor_alliance_renegotiation_created
    ON public.tutor_alliance_renegotiation (created_at);

ALTER TABLE public.tutor_alliance_renegotiation ENABLE ROW LEVEL SECURITY;
-- No client policy, by design.

-- ── 3. THE SELF-EXPLANATION LEDGER (C.14 Quality-Check Pass Rate) ────────────
--
-- One row per self-explanation prompt (or shadowed decision point): where the
-- decision came from, the concept family it rests on, the prompt variant,
-- the quality label of the first reply and of the follow-up, and the outcome.
-- NEVER what the learner said: there is no column that could hold it.

CREATE TABLE IF NOT EXISTS public.tutor_self_explanation_event (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character         text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    observation       integer NOT NULL CHECK (observation BETWEEN 1 AND 20),
    source            text NOT NULL CHECK (source IN ('activity', 'conversation')),
    family            text NOT NULL CHECK (family IN (
                         'saving', 'spending', 'needs_wants', 'price_value', 'budget',
                         'earning', 'trade', 'sharing', 'time'
                      )),
    variant           text NOT NULL CHECK (variant IN ('why', 'how', 'scaffolded')),
    mode              text NOT NULL CHECK (mode IN ('act', 'shadow')),
    first_quality     text NULL CHECK (first_quality IS NULL OR first_quality IN (
                         'concept', 'off_concept', 'filler', 'misconception', 'help', 'unanswered'
                      )),
    followup_quality  text NULL CHECK (followup_quality IS NULL OR followup_quality IN (
                         'concept', 'off_concept', 'filler', 'misconception', 'help', 'unanswered'
                      )),
    outcome           text NOT NULL CHECK (outcome IN (
                         'passed_first', 'passed_followup', 'explained_by_mentor', 'misconception_corrected',
                         'skipped_help', 'unanswered', 'undelivered', 'superseded', 'shadow'
                      )),
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, observation)
);

CREATE INDEX IF NOT EXISTS idx_tutor_self_explanation_event_created
    ON public.tutor_self_explanation_event (created_at);

ALTER TABLE public.tutor_self_explanation_event ENABLE ROW LEVEL SECURITY;
-- No client policy, by design.

-- ── 4. THE LEARNER DISPOSITION PROFILE (C.7) ────────────────────────────────
--
-- The persistent, cross-session record of HOW this learner learns, beside
-- (never instead of) the mastery model: help-seeking rates, typical reply
-- pace, the share of sessions with a disengagement firing, a "not really" at
-- a check-in, or a silent dropout, the decayed self-explanation counts, the
-- adaptations taken or turned down, and the persona-rapport history the C.15
-- continuity decision reads. The derived traits (`help_style`, `persistence`,
-- `explanation`) are closed labels about HOW the learner works, never about
-- how they feel. Numbers and closed labels only; no text.
--
-- SAFEGUARDS (the same minor/privacy boundaries as the learner memory):
--   * It never reaches a language model: Core sends Oracle a derived
--     projection in the SESSION context, which is not a field of the sealed
--     model context (oracle/src/context/schema.ts).
--   * A session that ended on a safety stop, a consent revocation or an error
--     does not update the behavioural rates: the profile must not become a
--     secondary record of a disclosure. Only its persona-rapport session
--     count moves (so the next persona is not falsely "new").
--   * RLS: the learner reads their own row and a verified guardian reads
--     their child's (`is_verified_guardian_of`, the learner-memory rule).
--     There is no client write policy: only Core writes it, at close.
--   * Retention: deleted with the account (ON DELETE CASCADE); a row not
--     updated for 365 days is purged by
--     `npm --prefix backend run tutor:alliance-report -- --purge-stale`, and
--     a row older than 30 days is reported as not current.
--   * Reset: the learner (13+, no guardian link) or the verified guardian can
--     delete it through Core (`DELETE /api/v1/tutor/disposition`, and
--     `/api/v1/tutor/kids/:kidUserId/disposition`).

CREATE TABLE IF NOT EXISTS public.learner_disposition_profile (
    user_id             uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    sessions_observed   integer NOT NULL DEFAULT 0 CHECK (sessions_observed BETWEEN 0 AND 100000),
    behavior_sessions   integer NOT NULL DEFAULT 0 CHECK (behavior_sessions BETWEEN 0 AND 100000),
    hint_rate           numeric(5, 3) NULL CHECK (hint_rate IS NULL OR hint_rate BETWEEN 0 AND 1),
    tell_rate           numeric(5, 3) NULL CHECK (tell_rate IS NULL OR tell_rate BETWEEN 0 AND 1),
    typed_answer_ms     integer NULL CHECK (typed_answer_ms IS NULL OR typed_answer_ms BETWEEN 0 AND 600000),
    spoken_answer_ms    integer NULL CHECK (spoken_answer_ms IS NULL OR spoken_answer_ms BETWEEN 0 AND 600000),
    disengagement_rate  numeric(5, 3) NULL CHECK (disengagement_rate IS NULL OR disengagement_rate BETWEEN 0 AND 1),
    misaligned_rate     numeric(5, 3) NULL CHECK (misaligned_rate IS NULL OR misaligned_rate BETWEEN 0 AND 1),
    left_rate           numeric(5, 3) NULL CHECK (left_rate IS NULL OR left_rate BETWEEN 0 AND 1),
    se_prompts          numeric(7, 3) NOT NULL DEFAULT 0 CHECK (se_prompts BETWEEN 0 AND 1000),
    se_first_pass       numeric(7, 3) NOT NULL DEFAULT 0 CHECK (se_first_pass BETWEEN 0 AND 1000),
    -- {adaptation: {accepted: n, declined: n}} (decayed counts), closed keys checked by Core.
    adaptation_history  jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(adaptation_history) = 'object'),
    -- {character: {sessions: n, lastAt: iso, bondYes: n, bondAnswered: n}}, closed keys checked by Core.
    persona_rapport     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(persona_rapport) = 'object'),
    help_style          text NOT NULL DEFAULT 'unknown' CHECK (help_style IN ('independent', 'hint_seeking', 'tell_early', 'unknown')),
    persistence         text NOT NULL DEFAULT 'unknown' CHECK (persistence IN ('persists', 'disengages_early', 'unknown')),
    explanation         text NOT NULL DEFAULT 'unknown' CHECK (explanation IN ('explains', 'needs_scaffold', 'unknown')),
    last_session_at     timestamptz NULL,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT learner_disposition_profile_se_pass_bound CHECK (se_first_pass <= se_prompts)
);

CREATE INDEX IF NOT EXISTS idx_learner_disposition_profile_updated
    ON public.learner_disposition_profile (updated_at);

ALTER TABLE public.learner_disposition_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_disposition_profile_select_own ON public.learner_disposition_profile;
CREATE POLICY learner_disposition_profile_select_own ON public.learner_disposition_profile
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- No INSERT / UPDATE / DELETE policy: only Core (service role) writes it.
