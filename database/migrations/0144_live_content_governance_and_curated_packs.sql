-- @phase: expand
-- *_live_content_governance_and_curated_packs.sql — Product C.5 (a dynamic,
-- risk-scaled staff-sampling rate for the judge-approved live-generation
-- tier, with a calibrated judge) and C.6 (a populated curated activity-pack
-- tier), governed by Appendix E §3.1.1 and instrumented for Appendix F §1.3
-- (Judge Approval-Quality Concordance Rate, Kill-Switch Trigger Log) and the
-- Part 3 Stage 7 rollback of the Live-Generation Content Judge.
--
-- Additive only: three new tables, two new functions, new nullable or
-- defaulted columns on `tutor_packs`. Safe to apply before or after the code;
-- the Core release that CALLS the new functions must follow it (Core fails
-- CLOSED without them: a live candidate is not served when its sampling
-- record cannot be written). See the deploy order in
-- docs/rebuild/sprints/S06-MENTOR-PEDAGOGY-GOVERNANCE.md.
--
-- Every vocabulary below is HAND-MIRRORED from Core
-- (`services/pedagogy/liveContentGovernance.ts`, `services/tutorPacks.ts`)
-- and Oracle (`content/contentRisk.ts`); `npm run live-content:check` keeps
-- them identical, and also guards the Appendix E §3.1.1 floors (15% / 50%),
-- which are Tier-1-adjacent: they may be raised by a human decision, never
-- lowered.
--
-- PRIVACY POSTURE (all three tables). No learner id and no text: labels,
-- numbers, our own catalog keys, the judge's model name and prompt hash, and
-- the deciding staff member's account id. RLS enabled with ZERO client
-- policies: governance artifacts read and written by the service role only
-- (Core's gate, the staff routes, the operator report).

-- ── 1. THE LIVE-CONTENT LOG (C.5) ──────────────────────────────────────────
--
-- One row per live-generated segment actually SERVED to a learner, written in
-- the SAME transaction as the segment claim (function below), so the
-- denominator of every sampling metric cannot silently lose a row. It records
-- the content-risk category the segment was judged under, the signals that
-- put it there, the sampling rate that applied at serve time (baseline or
-- elevated), whether it was sampled for staff review, and the judge identity
-- (model + prompt hash) and calibration that approved it. The staff decision
-- lands on the same row (function below). The segment reference becomes NULL
-- at the 90-day transcript purge; the row itself stays as evidence (it
-- carries nothing about the learner).
CREATE TABLE IF NOT EXISTS public.tutor_live_content_log (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id         uuid NULL REFERENCES public.tutor_segments (id) ON DELETE SET NULL,
    risk_category      text NOT NULL CHECK (risk_category IN ('standard', 'sensitive')),
    risk_signals       text[] NOT NULL DEFAULT '{}'::text[]
                           CHECK (risk_signals <@ ARRAY[
                               'financial_hardship', 'family_conflict', 'loss_and_grief',
                               'safety_adjacent', 'session_safety_event', 'learner_classifier_match',
                               'unrecognized_signal'
                           ]::text[]),
    segment_type       text NOT NULL CHECK (char_length(segment_type) BETWEEN 1 AND 64),
    tier               smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    locale             text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    sample_rate        numeric(5, 4) NOT NULL CHECK (sample_rate > 0 AND sample_rate <= 1),
    elevated           boolean NOT NULL,
    sampled            boolean NOT NULL,
    judge_model        text NOT NULL CHECK (char_length(judge_model) BETWEEN 1 AND 128),
    judge_prompt_hash  text NOT NULL CHECK (judge_prompt_hash ~ '^[0-9a-f]{64}$'),
    calibration_id     uuid NULL,
    review_verdict     text NULL CHECK (review_verdict IN ('approved', 'rejected')),
    review_issue       text NULL CHECK (review_issue IN ('quality', 'safety')),
    reviewed_by        uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    reviewed_at        timestamptz NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    -- The floors of Appendix E §3.1.1, enforced where no code path can
    -- bypass them: a standard item is never sampled below 15%, a sensitive
    -- one never below 50%.
    CONSTRAINT tutor_live_content_log_floor CHECK (
        (risk_category = 'standard' AND sample_rate >= 0.15)
        OR (risk_category = 'sensitive' AND sample_rate >= 0.50)
    ),
    -- A sensitive item carries the signal that made it sensitive.
    CONSTRAINT tutor_live_content_log_signals CHECK (
        (risk_category = 'standard') = (cardinality(risk_signals) = 0)
    ),
    -- Only a sampled item is reviewed; a verdict carries its time; an issue
    -- class only ever accompanies a rejection.
    CONSTRAINT tutor_live_content_log_review CHECK (
        (review_verdict IS NULL) = (reviewed_at IS NULL)
        AND (review_verdict IS NULL OR sampled)
        AND (review_issue IS NULL OR review_verdict = 'rejected')
    )
);

CREATE INDEX IF NOT EXISTS idx_tutor_live_content_log_category_created
    ON public.tutor_live_content_log (risk_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_live_content_log_category_reviewed
    ON public.tutor_live_content_log (risk_category, reviewed_at DESC)
    WHERE reviewed_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_live_content_log_segment
    ON public.tutor_live_content_log (segment_id)
    WHERE segment_id IS NOT NULL;

ALTER TABLE public.tutor_live_content_log ENABLE ROW LEVEL SECURITY;
-- No client policy: a governance artifact, service role only.

-- The systematic-sampling accumulator, one row per risk category. Sampling
-- is DETERMINISTIC rather than a die roll: each served item adds its rate to
-- the category's credit and is sampled whenever the credit reaches 1. Over
-- any run of n items at least floor(n × rate) are sampled, so "the reviewed
-- share fell below the floor" is an exact statement about staff review, not
-- a coin-flip artifact. The row is locked inside the claim transaction, so
-- concurrent Core replicas cannot both spend the same credit.
CREATE TABLE IF NOT EXISTS public.tutor_live_sampling_credit (
    risk_category text PRIMARY KEY CHECK (risk_category IN ('standard', 'sensitive')),
    credit        numeric(7, 6) NOT NULL DEFAULT 0 CHECK (credit >= 0 AND credit < 1),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_live_sampling_credit ENABLE ROW LEVEL SECURITY;
-- No client policy: service role only.

-- ── 2. JUDGE CALIBRATION RECORDS (C.5 → Appendix E §2.1/§3.2) ───────────────
--
-- The live-content judge's approvals are trusted at no sampling rate until it
-- has been calibrated against a human-rated seed set. One row per recorded
-- calibration run: WHICH judge (model name + SHA-256 of its system prompt,
-- so changing either makes the record stop matching), which seed set (hash),
-- how many items per risk category, the judge-human agreement per category,
-- the human inter-rater agreement (the humans must agree with each other
-- before the judge is compared with them) and the pre-registered thresholds
-- the run was judged against. A `passed` row is refused by the database
-- unless every number clears its threshold and every threshold is at least
-- the proposed floor.
CREATE TABLE IF NOT EXISTS public.tutor_content_judge_calibration (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_model               text NOT NULL CHECK (char_length(judge_model) BETWEEN 1 AND 128),
    judge_prompt_hash         text NOT NULL CHECK (judge_prompt_hash ~ '^[0-9a-f]{64}$'),
    seed_set_version          text NOT NULL CHECK (char_length(seed_set_version) BETWEEN 1 AND 32),
    seed_set_hash             text NOT NULL CHECK (seed_set_hash ~ '^[0-9a-f]{64}$'),
    raters                    smallint NOT NULL CHECK (raters BETWEEN 2 AND 20),
    items_standard            integer NOT NULL CHECK (items_standard BETWEEN 0 AND 10000),
    items_sensitive           integer NOT NULL CHECK (items_sensitive BETWEEN 0 AND 10000),
    agreement_standard        numeric(5, 4) NOT NULL CHECK (agreement_standard BETWEEN 0 AND 1),
    agreement_sensitive       numeric(5, 4) NOT NULL CHECK (agreement_sensitive BETWEEN 0 AND 1),
    inter_rater_agreement     numeric(5, 4) NOT NULL CHECK (inter_rater_agreement BETWEEN 0 AND 1),
    threshold_agreement       numeric(5, 4) NOT NULL CHECK (threshold_agreement BETWEEN 0.90 AND 1),
    threshold_inter_rater     numeric(5, 4) NOT NULL CHECK (threshold_inter_rater BETWEEN 0.85 AND 1),
    min_items_per_category    integer NOT NULL CHECK (min_items_per_category BETWEEN 20 AND 10000),
    verdict                   text NOT NULL CHECK (verdict IN ('passed', 'failed')),
    recorded_by               text NOT NULL CHECK (char_length(recorded_by) BETWEEN 1 AND 120),
    note                      text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 1000),
    created_at                timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tutor_content_judge_calibration_passed CHECK (
        verdict = 'failed' OR (
            items_standard >= min_items_per_category
            AND items_sensitive >= min_items_per_category
            AND agreement_standard >= threshold_agreement
            AND agreement_sensitive >= threshold_agreement
            AND inter_rater_agreement >= threshold_inter_rater
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_tutor_content_judge_calibration_created
    ON public.tutor_content_judge_calibration (created_at DESC);

ALTER TABLE public.tutor_content_judge_calibration ENABLE ROW LEVEL SECURITY;
-- No client policy: service role only.

-- ── 3. THE CONTENT-LADDER DEMAND LOG (C.6) ─────────────────────────────────
--
-- One row per content-ladder decision: which rung answered (catalog, bank,
-- an invitation to generate, a suspension of live generation) and, for the
-- live tier, what Core did with the candidate. It is the demand signal that
-- ranks which request patterns the curated tier should cover next
-- (`tutor:live-content-report`) and the measure of whether it is working (the
-- live share of served activities must fall as packs land). Our own catalog
-- keys and labels only; the requested skill key is model-written text, so it
-- is stored only when it matches the catalog key shape.
CREATE TABLE IF NOT EXISTS public.tutor_content_ladder_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    outcome         text NOT NULL CHECK (outcome IN (
                        'catalog', 'bank', 'needs_generation', 'live_suspended', 'live_served', 'live_refused'
                    )),
    route           text NOT NULL CHECK (route IN (
                        'named_skill', 'kc_pack', 'prerequisite', 'frontier', 'none', 'verify'
                    )),
    kc_id           uuid NULL,
    skill_key       text NULL CHECK (skill_key IS NULL OR skill_key ~ '^(kc:)?[a-z0-9][a-z0-9._/-]{0,127}$'),
    tier            smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    locale          text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    risk_category   text NULL CHECK (risk_category IS NULL OR risk_category IN ('standard', 'sensitive')),
    reason          text NULL CHECK (reason IS NULL OR reason IN (
                        'uncalibrated', 'calibration_stale', 'concordance_below_floor',
                        'review_rate_below_floor', 'judge_not_calibrated', 'gate_unavailable',
                        'verification_failed'
                    )),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_content_ladder_events_created
    ON public.tutor_content_ladder_events (created_at DESC);

ALTER TABLE public.tutor_content_ladder_events ENABLE ROW LEVEL SECURITY;
-- No client policy: service role only.

-- ── 4. THE CURATED ACTIVITY-PACK TIER (C.6) ────────────────────────────────
--
-- `tutor_packs` (0047) had storage and a reader but no authoring contract, no
-- loader and no content. These columns carry what the contract needs:
--   kc_key          a pack may target a knowledge component that has no
--                   published topic (its skill_key is then 'kc:' || kc_key,
--                   which keeps 0047's UNIQUE (skill_key, tier, locale))
--   pack_version    bumped by the loader on every content change
--   content_hash    SHA-256 of the canonical pack, carried into every served
--                   segment's provenance so a defect is traceable
--   source          'hand_authored' (the zero-spend seed packs) or 'forge'
--   demand_pattern  WHY this pack exists (the request pattern it covers)
--   risk_category   declared by the author, checked by the contract
--   validated_at    when the contract last passed on the stored content
-- A published pack is released by a HUMAN (released_by/released_at, 0047).
ALTER TABLE public.tutor_packs
    ADD COLUMN IF NOT EXISTS kc_key text NULL
        CHECK (kc_key IS NULL OR kc_key ~ '^[a-z0-9][a-z0-9_.-]{2,95}$'),
    ADD COLUMN IF NOT EXISTS pack_version integer NOT NULL DEFAULT 1
        CHECK (pack_version BETWEEN 1 AND 100000),
    ADD COLUMN IF NOT EXISTS content_hash text NULL
        CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'),
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'forge'
        CHECK (source IN ('hand_authored', 'forge')),
    ADD COLUMN IF NOT EXISTS demand_pattern text NULL
        CHECK (demand_pattern IS NULL OR demand_pattern IN (
            'kc_without_catalog_content', 'catalog_type_gap', 'high_live_demand'
        )),
    ADD COLUMN IF NOT EXISTS risk_category text NOT NULL DEFAULT 'standard'
        CHECK (risk_category IN ('standard', 'sensitive')),
    ADD COLUMN IF NOT EXISTS validated_at timestamptz NULL;

ALTER TABLE public.tutor_packs
    ADD CONSTRAINT tutor_packs_kc_key_matches_skill_key
        CHECK (kc_key IS NULL OR skill_key = 'kc:' || kc_key) NOT VALID;
-- A published pack names the human who released it.
ALTER TABLE public.tutor_packs
    ADD CONSTRAINT tutor_packs_published_is_released
        CHECK (status <> 'published' OR released_at IS NOT NULL) NOT VALID;

-- ── 5. THE LIVE CLAIM: segment + sampling decision + log, one transaction ──
--
-- Wraps 0064's `insert_tutor_segment_checked` (the atomic per-session claim,
-- unchanged). Inside one transaction it: locks the category's sampling
-- credit, decides `sampled` deterministically from the rate Core passes,
-- claims the segment with review_status 'pending' when sampled, and writes
-- the log row. An empty result is 0064's "a concurrent request already
-- claimed this exact segment" — and then NOTHING else is written (the credit
-- is not spent, no log row exists), so the caller's retry sees a clean state.
-- The rate is re-checked against the floors here too: a caller passing a
-- rate below the floor gets an exception, not a quiet under-sample.
CREATE OR REPLACE FUNCTION public.insert_tutor_live_segment_checked(
    p_session_id        uuid,
    p_source_key        text,
    p_segment_type      text,
    p_payload           jsonb,
    p_answer            jsonb,
    p_key_verified      boolean,
    p_provenance        jsonb,
    p_risk_category     text,
    p_risk_signals      text[],
    p_tier              integer,
    p_locale            text,
    p_sample_rate       numeric,
    p_elevated          boolean,
    p_judge_model       text,
    p_judge_prompt_hash text,
    p_calibration_id    uuid
)
RETURNS SETOF public.tutor_segments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit  numeric;
    v_next    numeric;
    v_sampled boolean;
    v_row     public.tutor_segments%ROWTYPE;
BEGIN
    IF p_risk_category NOT IN ('standard', 'sensitive') THEN
        RAISE EXCEPTION 'unknown risk category %', p_risk_category;
    END IF;
    IF (p_risk_category = 'standard' AND p_sample_rate < 0.15)
        OR (p_risk_category = 'sensitive' AND p_sample_rate < 0.50)
        OR p_sample_rate > 1 THEN
        RAISE EXCEPTION 'sample rate % is outside the % floor', p_sample_rate, p_risk_category;
    END IF;

    INSERT INTO public.tutor_live_sampling_credit (risk_category, credit)
    VALUES (p_risk_category, 0)
    ON CONFLICT (risk_category) DO NOTHING;

    SELECT credit INTO v_credit
    FROM public.tutor_live_sampling_credit
    WHERE risk_category = p_risk_category
    FOR UPDATE;

    v_next := v_credit + p_sample_rate;
    v_sampled := v_next >= 1;

    SELECT * INTO v_row
    FROM public.insert_tutor_segment_checked(
        p_session_id, p_source_key, 'live', NULL, p_segment_type, p_payload,
        p_answer, p_key_verified, p_provenance,
        CASE WHEN v_sampled THEN 'pending' ELSE NULL END
    );
    IF NOT FOUND THEN
        -- A concurrent winner claimed this exact segment: spend nothing.
        RETURN;
    END IF;

    UPDATE public.tutor_live_sampling_credit
    SET credit = CASE WHEN v_sampled THEN v_next - 1 ELSE v_next END,
        updated_at = now()
    WHERE risk_category = p_risk_category;

    INSERT INTO public.tutor_live_content_log (
        segment_id, risk_category, risk_signals, segment_type, tier, locale,
        sample_rate, elevated, sampled, judge_model, judge_prompt_hash, calibration_id
    ) VALUES (
        v_row.id, p_risk_category, COALESCE(p_risk_signals, '{}'::text[]), p_segment_type,
        p_tier, p_locale, p_sample_rate, p_elevated, v_sampled, p_judge_model,
        p_judge_prompt_hash, p_calibration_id
    );

    RETURN NEXT v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_tutor_live_segment_checked(
    uuid, text, text, jsonb, jsonb, boolean, jsonb, text, text[], integer, text, numeric, boolean, text, text, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_tutor_live_segment_checked(
    uuid, text, text, jsonb, jsonb, boolean, jsonb, text, text[], integer, text, numeric, boolean, text, text, uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.insert_tutor_live_segment_checked(
    uuid, text, text, jsonb, jsonb, boolean, jsonb, text, text[], integer, text, numeric, boolean, text, text, uuid
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.insert_tutor_live_segment_checked(
    uuid, text, text, jsonb, jsonb, boolean, jsonb, text, text[], integer, text, numeric, boolean, text, text, uuid
) TO service_role;

-- ── 6. THE STAFF DECISION: segment status + log verdict, one transaction ────
--
-- Replaces the two-step "PATCH the segment, then remember to log it" with one
-- claim: the verdict lands only on a segment still pending (a second
-- reviewer's stale tab changes nothing) and on its log row in the same
-- transaction. Returns 'recorded', 'recorded_legacy' (a segment sampled
-- before this migration, which has no log row) or 'not_pending'.
CREATE OR REPLACE FUNCTION public.record_tutor_live_review(
    p_segment_id uuid,
    p_verdict    text,
    p_issue      text,
    p_reviewer   uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claimed uuid;
    v_logged  uuid;
BEGIN
    IF p_verdict NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'unknown verdict %', p_verdict;
    END IF;
    IF p_issue IS NOT NULL AND (p_verdict <> 'rejected' OR p_issue NOT IN ('quality', 'safety')) THEN
        RAISE EXCEPTION 'an issue class accompanies a rejection only';
    END IF;

    UPDATE public.tutor_segments
    SET review_status = p_verdict
    WHERE id = p_segment_id AND review_status = 'pending'
    RETURNING id INTO v_claimed;
    IF v_claimed IS NULL THEN
        RETURN 'not_pending';
    END IF;

    UPDATE public.tutor_live_content_log
    SET review_verdict = p_verdict,
        review_issue = p_issue,
        reviewed_by = p_reviewer,
        reviewed_at = now()
    WHERE segment_id = p_segment_id AND reviewed_at IS NULL
    RETURNING id INTO v_logged;

    RETURN CASE WHEN v_logged IS NULL THEN 'recorded_legacy' ELSE 'recorded' END;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) TO service_role;
