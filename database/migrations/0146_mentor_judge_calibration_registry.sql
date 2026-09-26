-- @phase: expand
-- *_mentor_judge_calibration_registry.sql — Product C.23 (the calibration
-- process for every automated evaluation judge; Appendix E §2.1 and §3.2,
-- Appendix F §1.3 Judge–Human Agreement Rate).
--
-- One registry of calibration runs for EVERY judge that may be trusted with a
-- decision: the live-content judge (C.5, which until now recorded into
-- `tutor_content_judge_calibration`) and the transcript judge (C.21). A judge
-- is trusted only while its latest full calibration PASSED and was
-- re-verified within its cadence, and a failed spot check un-trusts it until
-- a new calibration passes. Core computes each run from the panel's raw
-- labels and the judge's raw verdicts; THIS FILE recomputes the verdict again
-- from the numbers inside `record_mentor_judge_calibration` and refuses any
-- row whose claimed stratum result, scope or verdict does not follow from its
-- own numbers and thresholds, and any threshold below the pre-registered
-- floor. A harness bug or a hand-edited run file cannot record a pass.
--
-- Additive only: two new tables and one function. `tutor_content_judge_
-- calibration` (from the live-content migration) is left in place and is no
-- longer written: nothing in any environment ever recorded into it (the live
-- calibration is owner-run and has not run), and a later contract migration
-- may drop it. Apply this BEFORE the Core release that reads it: without it
-- the live-content gate cannot read a calibration and keeps live generation
-- suspended (fail closed, the same state as "never calibrated"), and the
-- transcript-judge signal reads as unavailable.
--
-- PRIVACY POSTURE. No learner, no text, no transcript: model names, hashes,
-- counts and agreement numbers only. RLS enabled with ZERO client policies:
-- Core's service role (the operator CLI and the evaluation loop) is the only
-- reader and writer.
--
-- Vocabularies are HAND-MIRRORED from Core (`services/pedagogy/
-- judgeCalibration.ts`); the floors are the Tier 1 minimums. `npm run
-- judge-calibration:check` keeps both identical and refuses a lowered floor.

-- ── 1. CALIBRATION RUNS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_judge_calibration (
    id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_id                     text NOT NULL CHECK (judge_id IN ('live_content_judge', 'transcript_judge')),
    kind                         text NOT NULL CHECK (kind IN ('calibration', 'spot_check')),
    verifies_calibration_id      uuid NULL REFERENCES public.mentor_judge_calibration (id) ON DELETE RESTRICT,
    judge_model                  text NOT NULL CHECK (char_length(judge_model) BETWEEN 1 AND 128),
    judge_prompt_hash            text NOT NULL CHECK (judge_prompt_hash ~ '^[0-9a-f]{64}$'),
    author_model                 text NULL CHECK (author_model IS NULL OR char_length(author_model) BETWEEN 1 AND 128),
    same_family                  boolean NOT NULL,
    seed_set_version             text NOT NULL CHECK (char_length(seed_set_version) BETWEEN 1 AND 32),
    seed_set_hash                text NOT NULL CHECK (seed_set_hash ~ '^[0-9a-f]{64}$'),
    raters                       smallint NOT NULL CHECK (raters BETWEEN 2 AND 20),
    items                        integer NOT NULL CHECK (items BETWEEN 1 AND 10000),
    inter_rater_agreement        numeric(5, 4) NOT NULL CHECK (inter_rater_agreement BETWEEN 0 AND 1),
    inter_rater_kappa            numeric(6, 4) NOT NULL CHECK (inter_rater_kappa BETWEEN -1 AND 1),
    length_bias_gap              numeric(5, 4) NULL CHECK (length_bias_gap IS NULL OR length_bias_gap BETWEEN 0 AND 1),
    -- The pre-registered thresholds the run was judged against. Each may be
    -- raised; none may be recorded below its floor (Tier 1).
    threshold_inter_rater        numeric(5, 4) NOT NULL CHECK (threshold_inter_rater BETWEEN 0.85 AND 1),
    threshold_inter_rater_kappa  numeric(5, 4) NOT NULL CHECK (threshold_inter_rater_kappa BETWEEN 0.60 AND 1),
    threshold_agreement          numeric(5, 4) NOT NULL CHECK (threshold_agreement BETWEEN 0.90 AND 1),
    threshold_judge_kappa        numeric(5, 4) NOT NULL CHECK (threshold_judge_kappa BETWEEN 0.70 AND 1),
    threshold_length_gap         numeric(5, 4) NOT NULL CHECK (threshold_length_gap BETWEEN 0 AND 0.15),
    min_items_per_stratum        integer NOT NULL CHECK (min_items_per_stratum BETWEEN 5 AND 10000),
    min_items_per_question       integer NOT NULL CHECK (min_items_per_question BETWEEN 10 AND 10000),
    min_per_label                integer NOT NULL CHECK (min_per_label BETWEEN 2 AND 10000),
    scope                        text[] NOT NULL DEFAULT '{}'::text[] CHECK (scope <@ ARRAY[
                                     'approve', 'answer_reveal', 'false_affirmation', 'emotion_label',
                                     'hint_repeat', 'tell_honored', 'controlling_language'
                                 ]::text[]),
    verdict                      text NOT NULL CHECK (verdict IN ('passed', 'failed')),
    failure_reasons              text[] NOT NULL DEFAULT '{}'::text[] CHECK (failure_reasons <@ ARRAY[
                                     'inter_rater_below_threshold', 'inter_rater_kappa_below_threshold',
                                     'verbosity_bias', 'self_enhancement_risk', 'no_question_calibrated',
                                     'required_question_uncalibrated', 'spot_check_scope_lost'
                                 ]::text[]),
    recorded_by                  text NOT NULL CHECK (char_length(recorded_by) BETWEEN 1 AND 120),
    note                         text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 1000),
    created_at                   timestamptz NOT NULL DEFAULT now(),
    -- A spot check re-verifies exactly one calibration; a calibration re-verifies none.
    CONSTRAINT mentor_judge_calibration_spot_check_target CHECK (
        (kind = 'spot_check') = (verifies_calibration_id IS NOT NULL)
    ),
    -- Per-judge minimum strata (a full calibration of the content judge keeps
    -- the S06.12 bar: 20 items and both labels at least 5 times per category).
    CONSTRAINT mentor_judge_calibration_judge_minimums CHECK (
        (judge_id = 'live_content_judge' AND (
            (kind = 'calibration' AND min_items_per_stratum >= 20 AND min_items_per_question >= 40 AND min_per_label >= 5)
            OR (kind = 'spot_check' AND min_items_per_stratum >= 10 AND min_items_per_question >= 20 AND min_per_label >= 3)))
        OR (judge_id = 'transcript_judge' AND (
            (kind = 'calibration' AND min_items_per_stratum >= 10 AND min_items_per_question >= 20 AND min_per_label >= 3)
            OR (kind = 'spot_check' AND min_items_per_stratum >= 5 AND min_items_per_question >= 10 AND min_per_label >= 2)))
    ),
    -- A pass follows from its own numbers.
    CONSTRAINT mentor_judge_calibration_passed CHECK (
        verdict = 'failed' OR (
            inter_rater_agreement >= threshold_inter_rater
            AND inter_rater_kappa >= threshold_inter_rater_kappa
            AND (length_bias_gap IS NULL OR length_bias_gap <= threshold_length_gap)
            AND NOT same_family
            AND cardinality(scope) >= 1
            AND cardinality(failure_reasons) = 0
            AND (judge_id <> 'live_content_judge' OR scope @> ARRAY['approve']::text[])
        )
    ),
    CONSTRAINT mentor_judge_calibration_failed_has_reason CHECK (
        verdict = 'passed' OR cardinality(failure_reasons) >= 1
    )
);

CREATE INDEX IF NOT EXISTS idx_mentor_judge_calibration_judge_created
    ON public.mentor_judge_calibration (judge_id, created_at DESC);

ALTER TABLE public.mentor_judge_calibration ENABLE ROW LEVEL SECURITY;
-- No client policy: service role only.

-- ── 2. PER-STRATUM RESULTS ───────────────────────────────────────────────────
-- One row per (question, stratum): the weakest stratum decides (Appendix E
-- §1.2), so each is recorded, not only an average.
CREATE TABLE IF NOT EXISTS public.mentor_judge_calibration_stratum (
    calibration_id  uuid NOT NULL REFERENCES public.mentor_judge_calibration (id) ON DELETE CASCADE,
    question        text NOT NULL CHECK (question IN (
                        'approve', 'answer_reveal', 'false_affirmation', 'emotion_label',
                        'hint_repeat', 'tell_honored', 'controlling_language'
                    )),
    stratum         text NOT NULL CHECK (stratum IN ('standard', 'sensitive', 'routine', 'hard')),
    items           integer NOT NULL CHECK (items BETWEEN 0 AND 10000),
    panel_pass      integer NOT NULL CHECK (panel_pass BETWEEN 0 AND 10000),
    panel_fail      integer NOT NULL CHECK (panel_fail BETWEEN 0 AND 10000),
    agreement       numeric(5, 4) NOT NULL CHECK (agreement BETWEEN 0 AND 1),
    question_kappa  numeric(6, 4) NOT NULL CHECK (question_kappa BETWEEN -1 AND 1),
    passed          boolean NOT NULL,
    PRIMARY KEY (calibration_id, question, stratum),
    CONSTRAINT mentor_judge_calibration_stratum_counts CHECK (panel_pass + panel_fail <= items)
);

ALTER TABLE public.mentor_judge_calibration_stratum ENABLE ROW LEVEL SECURITY;
-- No client policy: service role only.

-- ── 3. THE ONLY WRITE PATH ───────────────────────────────────────────────────
-- Inserts one run and its strata in one transaction, after recomputing, from
-- the numbers and the row's own thresholds:
--   - every stratum's pass (items, both labels, agreement);
--   - the scope (questions whose every stratum passed, with the judge's full
--     set of strata, enough items across them, and the question's kappa at
--     or above the floor);
--   - for a spot check: the calibration it re-verifies exists, is a PASSED
--     full calibration of the SAME judge identity, and keeps its scope;
-- and refuses the row when a claim differs. The verdict must then satisfy
-- the table's own CHECKs.
CREATE OR REPLACE FUNCTION public.record_mentor_judge_calibration(
    p_calibration jsonb,
    p_strata      jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row           public.mentor_judge_calibration%ROWTYPE;
    v_target        public.mentor_judge_calibration%ROWTYPE;
    v_expected_n    integer;
    v_stratum       jsonb;
    v_expect_pass   boolean;
    v_scope         text[] := '{}'::text[];
    v_question      text;
    v_all_passed    boolean;
    v_strata_n      integer;
    v_items_sum     integer;
    v_kappa         numeric;
    v_id            uuid;
BEGIN
    v_row := jsonb_populate_record(NULL::public.mentor_judge_calibration, p_calibration);
    v_expected_n := CASE v_row.judge_id WHEN 'live_content_judge' THEN 2 WHEN 'transcript_judge' THEN 2 ELSE NULL END;
    IF v_expected_n IS NULL THEN
        RAISE EXCEPTION 'unknown judge %', v_row.judge_id;
    END IF;
    IF jsonb_typeof(p_strata) <> 'array' OR jsonb_array_length(p_strata) = 0 THEN
        RAISE EXCEPTION 'a calibration run records its strata';
    END IF;

    -- Every stratum's pass follows from its numbers.
    FOR v_stratum IN SELECT * FROM jsonb_array_elements(p_strata) LOOP
        v_expect_pass :=
            (v_stratum->>'items')::integer >= v_row.min_items_per_stratum
            AND (v_stratum->>'panel_pass')::integer >= v_row.min_per_label
            AND (v_stratum->>'panel_fail')::integer >= v_row.min_per_label
            AND (v_stratum->>'agreement')::numeric >= v_row.threshold_agreement;
        IF v_expect_pass IS DISTINCT FROM (v_stratum->>'passed')::boolean THEN
            RAISE EXCEPTION 'stratum %/% claims passed=% but its numbers say %',
                v_stratum->>'question', v_stratum->>'stratum', v_stratum->>'passed', v_expect_pass;
        END IF;
    END LOOP;

    -- The scope follows from the strata: every stratum of the question passed
    -- on its own, the question has all of the judge's strata and enough items,
    -- and the question's kappa clears the floor.
    FOR v_question IN SELECT DISTINCT s->>'question' FROM jsonb_array_elements(p_strata) s LOOP
        SELECT bool_and((s->>'passed')::boolean), count(DISTINCT s->>'stratum'), sum((s->>'items')::integer),
               min((s->>'question_kappa')::numeric)
        INTO v_all_passed, v_strata_n, v_items_sum, v_kappa
        FROM jsonb_array_elements(p_strata) s
        WHERE s->>'question' = v_question;
        IF v_all_passed AND v_strata_n = v_expected_n AND v_items_sum >= v_row.min_items_per_question
            AND v_kappa >= v_row.threshold_judge_kappa THEN
            v_scope := array_append(v_scope, v_question);
        END IF;
    END LOOP;
    IF NOT (v_scope @> COALESCE(v_row.scope, '{}'::text[]) AND COALESCE(v_row.scope, '{}'::text[]) @> v_scope) THEN
        RAISE EXCEPTION 'the claimed scope % is not the scope the strata support %', v_row.scope, v_scope;
    END IF;

    -- A spot check re-verifies a passed calibration of the same judge identity.
    IF v_row.kind = 'spot_check' THEN
        SELECT * INTO v_target FROM public.mentor_judge_calibration WHERE id = v_row.verifies_calibration_id;
        IF NOT FOUND OR v_target.kind <> 'calibration' OR v_target.verdict <> 'passed'
            OR v_target.judge_id <> v_row.judge_id
            OR v_target.judge_model <> v_row.judge_model
            OR v_target.judge_prompt_hash <> v_row.judge_prompt_hash THEN
            RAISE EXCEPTION 'a spot check must re-verify a passed calibration of the same judge identity';
        END IF;
        IF v_row.verdict = 'passed' AND NOT (v_scope @> v_target.scope) THEN
            RAISE EXCEPTION 'a passing spot check keeps the calibrated scope';
        END IF;
    END IF;

    INSERT INTO public.mentor_judge_calibration (
        judge_id, kind, verifies_calibration_id, judge_model, judge_prompt_hash, author_model,
        same_family, seed_set_version, seed_set_hash, raters, items, inter_rater_agreement,
        inter_rater_kappa, length_bias_gap, threshold_inter_rater, threshold_inter_rater_kappa,
        threshold_agreement, threshold_judge_kappa, threshold_length_gap, min_items_per_stratum,
        min_items_per_question, min_per_label, scope, verdict, failure_reasons, recorded_by, note
    ) VALUES (
        v_row.judge_id, v_row.kind, v_row.verifies_calibration_id, v_row.judge_model,
        v_row.judge_prompt_hash, v_row.author_model, v_row.same_family, v_row.seed_set_version,
        v_row.seed_set_hash, v_row.raters, v_row.items, v_row.inter_rater_agreement,
        v_row.inter_rater_kappa, v_row.length_bias_gap, v_row.threshold_inter_rater,
        v_row.threshold_inter_rater_kappa, v_row.threshold_agreement, v_row.threshold_judge_kappa,
        v_row.threshold_length_gap, v_row.min_items_per_stratum, v_row.min_items_per_question,
        v_row.min_per_label, v_scope, v_row.verdict, COALESCE(v_row.failure_reasons, '{}'::text[]),
        v_row.recorded_by, v_row.note
    )
    RETURNING id INTO v_id;

    INSERT INTO public.mentor_judge_calibration_stratum (
        calibration_id, question, stratum, items, panel_pass, panel_fail, agreement, question_kappa, passed
    )
    SELECT v_id, s->>'question', s->>'stratum', (s->>'items')::integer, (s->>'panel_pass')::integer,
           (s->>'panel_fail')::integer, (s->>'agreement')::numeric, (s->>'question_kappa')::numeric,
           (s->>'passed')::boolean
    FROM jsonb_array_elements(p_strata) s;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_mentor_judge_calibration(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_mentor_judge_calibration(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.record_mentor_judge_calibration(jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_mentor_judge_calibration(jsonb, jsonb) TO service_role;

COMMENT ON TABLE public.mentor_judge_calibration IS
    'C.23: every calibration run and spot check of an automated evaluation judge. Written only through record_mentor_judge_calibration.';
COMMENT ON TABLE public.tutor_content_judge_calibration IS
    'Superseded by mentor_judge_calibration (C.23). Never written; kept for a later contract migration.';
