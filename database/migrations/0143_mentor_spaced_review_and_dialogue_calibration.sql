-- @phase: expand
-- *_mentor_spaced_review_and_dialogue_calibration.sql — Product C.11 (the
-- two-tier spaced review) and C.17 (age-band dialogue calibration),
-- instrumented for Appendix F §1.1 (Spaced-Review Routing Accuracy), §1.2
-- (Age-Band Calibration A/B Outcome) and the Part 3 Stage 7 automatic
-- rollbacks of both components. Additive only: two new tables and one new
-- nullable column. Safe to apply before or after the code; the Core release
-- that WRITES them should follow it (a POST to a table PostgREST does not know
-- fails and the close loses that record; the `kc_attempt.review_tier` write
-- falls back to the row without the column — see the deploy order in
-- docs/rebuild/sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md).
--
-- Every vocabulary below is HAND-MIRRORED from Oracle (`tutor/spacedReview.ts`,
-- `tutor/dialogueCalibration.ts`) and Core (`services/pedagogy/spacedReview.ts`,
-- `services/pedagogy/dialogueCalibration.ts`, `services/pedagogy/fsrs.ts`);
-- `npm run review-calibration:check` keeps them identical.
--
-- ── 1. THE ROUTING LOG (C.11) ───────────────────────────────────────────────
--
-- One row per routing decision: which tier a wrong answer went to (kept for a
-- spaced re-check later in the session, or handed to the cross-session
-- scheduler), WHY (the first rule that applied), the INPUTS the rule read
-- (the belief before the miss, the turn and time budget left, the
-- re-exposures and queue before it) and how it ENDED. Recording the inputs is
-- what makes the Spaced-Review Routing Accuracy audit mechanical: Core
-- re-evaluates the pure rule over every row, and the quarterly human spot
-- check reads a reproducible sample (`tutor:spaced-review-report --sample`).
--
-- PRIVACY POSTURE. No user id and no text: the session (SET NULL on the
-- 90-day transcript purge, so the audit sample outlives the conversation
-- without keeping anything about the child), the persona, a knowledge
-- component of our own catalog, labels and numbers. RLS enabled with ZERO
-- client policies: an internal monitoring artifact read by the service role
-- only (the report and Core's kill switch).

CREATE TABLE IF NOT EXISTS public.tutor_review_routing (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NULL REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character           text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    mode                text NOT NULL CHECK (mode IN ('act', 'shadow')),
    rule_version        text NOT NULL CHECK (char_length(rule_version) BETWEEN 1 AND 16),
    observation         integer NOT NULL CHECK (observation BETWEEN 1 AND 200),
    kc_id               uuid NOT NULL,
    tier                text NOT NULL CHECK (tier IN ('within_session', 'cross_session')),
    reason              text NOT NULL CHECK (reason IN (
                            'no_plan_entry', 'wrapping', 'time_budget', 'turn_budget',
                            'reexposure_cap', 'far_from_threshold', 'queue_full', 'near_threshold'
                        )),
    source              text NOT NULL CHECK (source IN ('first_miss', 'reexposure_miss')),
    p_before            numeric(4, 3) NOT NULL CHECK (p_before BETWEEN 0 AND 1),
    p_after             numeric(4, 3) NOT NULL CHECK (p_after BETWEEN 0 AND 1),
    turns_remaining     integer NOT NULL CHECK (turns_remaining BETWEEN 0 AND 100000),
    ms_until_wrap       integer NOT NULL CHECK (ms_until_wrap BETWEEN 0 AND 86400000),
    budget_state        text NOT NULL CHECK (budget_state IN ('running', 'wrapping', 'ended')),
    planned             boolean NOT NULL,
    reexposures_before  integer NOT NULL CHECK (reexposures_before BETWEEN 0 AND 50),
    queued_before       integer NOT NULL CHECK (queued_before BETWEEN 0 AND 50),
    at_turn             integer NOT NULL CHECK (at_turn BETWEEN 0 AND 100000),
    outcome             text NOT NULL CHECK (outcome IN ('retired', 'rerouted', 'session_ended', 'abandoned', 'handed_off')),
    successes           integer NOT NULL CHECK (successes BETWEEN 0 AND 50),
    failures            integer NOT NULL CHECK (failures BETWEEN 0 AND 50),
    created_at          timestamptz NOT NULL DEFAULT now(),
    -- A within-session decision is only ever "near_threshold", and the reverse.
    CONSTRAINT tutor_review_routing_tier_reason CHECK ((tier = 'within_session') = (reason = 'near_threshold')),
    -- A cross-session decision is handed off from the miss on; a within one never is.
    CONSTRAINT tutor_review_routing_tier_outcome CHECK ((tier = 'cross_session') = (outcome = 'handed_off')),
    -- A shadow router never opens a re-check, so nothing it routed can be retired by one.
    CONSTRAINT tutor_review_routing_retired_success CHECK (outcome <> 'retired' OR successes >= 1),
    -- Idempotency: a close that is retried writes the same decisions.
    UNIQUE (session_id, observation)
);

CREATE INDEX IF NOT EXISTS idx_tutor_review_routing_created
    ON public.tutor_review_routing (created_at);
CREATE INDEX IF NOT EXISTS idx_tutor_review_routing_act
    ON public.tutor_review_routing (mode, created_at);

ALTER TABLE public.tutor_review_routing ENABLE ROW LEVEL SECURITY;

-- ── 2. THE SHORT-HORIZON MARK ON THE EVIDENCE LOG (C.11) ─────────────────────
--
-- Whether a graded attempt was a SPACED review of the learner's memory card
-- (it moved the cross-session schedule) or a within-session re-exposure
-- inside the short horizon (it did not; `fsrs.ts` `reviewCardTwoTier`).
-- NULL: an attempt recorded before this migration. `kc_attempt` keeps its
-- existing learner/guardian SELECT policy (0052); no new policy is needed.

ALTER TABLE public.kc_attempt
    ADD COLUMN IF NOT EXISTS review_tier text NULL
        CHECK (review_tier IS NULL OR review_tier IN ('spaced', 'short_horizon'));

-- ── 3. THE DIALOGUE REGISTER RECORD (C.17) ──────────────────────────────────
--
-- One row per session: the register it ran — the age BAND Core derived
-- (young_child 6–9, tween 10–12, teen 13–17, adult 18+; never an age or a
-- birth date), the VARIANT (the SPEC's `calibrated` register or the uniform
-- `control`), how it was ASSIGNED (the adults-only H.7 experiment per OD-23,
-- or why the learner was not enrolled) and the experiment id — plus what the
-- register did: the hint-ladder length, hint and tell requests, controlling
-- language caught and delivered (the auditable teen/adult style constraint),
-- and pacing changes offered versus made unilaterally. Joined by session with
-- the C.15 bond proxy and the C.16 closing script, it is the Age-Band
-- Calibration A/B Outcome (`tutor:dialogue-calibration-report`).
--
-- PRIVACY POSTURE. As above: no user id, no text; the session is SET NULL on
-- the transcript purge. RLS enabled with ZERO client policies (service role
-- only).

CREATE TABLE IF NOT EXISTS public.tutor_dialogue_calibration (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                uuid NULL UNIQUE REFERENCES public.tutor_sessions (id) ON DELETE SET NULL,
    character                 text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    band                      text NOT NULL CHECK (band IN ('young_child', 'tween', 'teen', 'adult')),
    variant                   text NOT NULL CHECK (variant IN ('calibrated', 'control')),
    assignment                text NOT NULL CHECK (assignment IN (
                                  'experiment', 'not_eligible', 'no_consent', 'no_experiment',
                                  'runtime_unavailable', 'rollback', 'tier_fallback', 'operator_off'
                              )),
    experiment_id             uuid NULL,
    ladder_rungs              integer NOT NULL CHECK (ladder_rungs BETWEEN 2 AND 5),
    hint_requests             integer NOT NULL CHECK (hint_requests BETWEEN 0 AND 10000),
    tell_requests             integer NOT NULL CHECK (tell_requests BETWEEN 0 AND 10000),
    controlling_caught        integer NOT NULL CHECK (controlling_caught BETWEEN 0 AND 10000),
    controlling_delivered     integer NOT NULL CHECK (controlling_delivered BETWEEN 0 AND 10000),
    pacing_offers             integer NOT NULL CHECK (pacing_offers BETWEEN 0 AND 10000),
    unilateral_style_changes  integer NOT NULL CHECK (unilateral_style_changes BETWEEN 0 AND 10000),
    created_at                timestamptz NOT NULL DEFAULT now(),
    -- An experiment id belongs to an enrolled session, and only to one.
    CONSTRAINT tutor_dialogue_calibration_experiment CHECK ((assignment = 'experiment') = (experiment_id IS NOT NULL)),
    -- Only the younger-child calibrated register shortens the hint ladder.
    CONSTRAINT tutor_dialogue_calibration_ladder CHECK (
        ladder_rungs = CASE WHEN variant = 'calibrated' AND band = 'young_child' THEN 4 ELSE 5 END
    ),
    CONSTRAINT tutor_dialogue_calibration_delivered CHECK (controlling_delivered <= controlling_caught),
    -- The control arm is the uniform register: no controlling-language gate ran.
    CONSTRAINT tutor_dialogue_calibration_control CHECK (variant = 'calibrated' OR controlling_caught = 0),
    -- The ask-first register never changes the approach on its own.
    CONSTRAINT tutor_dialogue_calibration_ask_first CHECK (
        NOT (variant = 'calibrated' AND band IN ('teen', 'adult')) OR unilateral_style_changes = 0
    )
);

CREATE INDEX IF NOT EXISTS idx_tutor_dialogue_calibration_created
    ON public.tutor_dialogue_calibration (created_at);
CREATE INDEX IF NOT EXISTS idx_tutor_dialogue_calibration_experiment
    ON public.tutor_dialogue_calibration (assignment, band, variant);

ALTER TABLE public.tutor_dialogue_calibration ENABLE ROW LEVEL SECURITY;
