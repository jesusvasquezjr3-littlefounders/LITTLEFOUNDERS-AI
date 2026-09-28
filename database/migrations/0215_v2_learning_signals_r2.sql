-- v2_learning_signals_r2 — the Appendix P Part 8 metrics the first round left
-- out, and the new receipt fields behind them (GAP-FIX-R2 learning).
-- @phase: contract
-- @after-release: none — the receipt CHECK is dropped and re-added so that every receipt a deployed Core writes still passes (it adds the diagnostic 'count_from_zero' and pins the shape of new optional fields no deployed Core writes), so no running write is rejected. The phase classifier counts any CHECK swap as a contraction, so it is declared contract and applied by hand. Apply it BEFORE the Core release that grades $2 count-up sequences, L12 cue ticks and scorer parity: an older CHECK would refuse those receipts (the grade answers 502 and nothing is recorded).
--
-- Core writes, beside each v2 verdict in lesson_v2_grade_receipts:
--   * diagnostic 'count_from_zero' ($2: the change counted from zero instead
--     of up from the price, Laski & Siegler);
--   * cues {hits, missed, false_ticks} (L12 / $11 "tick which cues fired"),
--     a diagnostic that never changes the score or d-prime;
--   * client_agree (boolean): whether the browser's advisory scorer verdict,
--     sent beside the answer and never trusted, matched Core's reading of the
--     same answer (Part 8 "scorer parity", target 100%);
--   * item_phase 'pre' | 'post' (L12 / $11 d-prime before and after the lesson);
--   * variant (an id): the representation variant the item used (Part 8
--     "representation A/B": M14/M15 alternatives, worked examples with and
--     without self-explanation prompts);
--   * entry_stage 'concrete' | 'pictorial' | 'abstract' (Part 4.4: where a
--     mastery-faded M1 progression started this learner).
-- The 0205 CHECK is replaced by one that pins every field above, and the
-- read-only service-role aggregates below report them. No learner id, answer
-- or rubric leaves these functions.

ALTER TABLE public.lesson_v2_grade_receipts DROP CONSTRAINT IF EXISTS lesson_v2_grade_receipts_signals_check;
ALTER TABLE public.lesson_v2_grade_receipts
    ADD CONSTRAINT lesson_v2_grade_receipts_signals_check CHECK (
        (NOT (verdict ? 'diagnostic') OR verdict->>'diagnostic' IN
            ('none', 'structure', 'value', 'partial', 'miss', 'false_alarm', 'path', 'outcome', 'bin', 'reason', 'tolerance', 'count_from_zero'))
        AND (NOT (verdict ? 'hints_used') OR (jsonb_typeof(verdict->'hints_used') = 'number'
            AND verdict->>'hints_used' IN ('0', '1', '2')))
        AND (NOT (verdict ? 'item_role') OR verdict->>'item_role' IN ('practice', 'transfer'))
        AND (NOT (verdict ? 'kc') OR (jsonb_typeof(verdict->'kc') = 'string'
            AND verdict->>'kc' ~ '^[a-z0-9][a-z0-9._:-]{2,100}$'))
        AND (NOT (verdict ? 'detection') OR (jsonb_typeof(verdict->'detection') = 'object'
            AND (verdict->'detection') ?& ARRAY['hits', 'misses', 'false_alarms', 'correct_rejections']
            AND (verdict->'detection') - ARRAY['hits', 'misses', 'false_alarms', 'correct_rejections'] = '{}'::jsonb
            AND (verdict->'detection'->>'hits') ~ '^[0-9]$'
            AND (verdict->'detection'->>'misses') ~ '^[0-9]$'
            AND (verdict->'detection'->>'false_alarms') ~ '^[0-9]$'
            AND (verdict->'detection'->>'correct_rejections') ~ '^[0-9]$'))
        AND (NOT (verdict ? 'cues') OR (jsonb_typeof(verdict->'cues') = 'object'
            AND (verdict->'cues') ?& ARRAY['hits', 'missed', 'false_ticks']
            AND (verdict->'cues') - ARRAY['hits', 'missed', 'false_ticks'] = '{}'::jsonb
            AND (verdict->'cues'->>'hits') ~ '^[0-9]{1,2}$'
            AND (verdict->'cues'->>'missed') ~ '^[0-9]{1,2}$'
            AND (verdict->'cues'->>'false_ticks') ~ '^[0-9]{1,2}$'))
        AND (NOT (verdict ? 'client_agree') OR jsonb_typeof(verdict->'client_agree') = 'boolean')
        AND (NOT (verdict ? 'item_phase') OR verdict->>'item_phase' IN ('pre', 'post'))
        AND (NOT (verdict ? 'variant') OR (jsonb_typeof(verdict->'variant') = 'string'
            AND verdict->>'variant' ~ '^[a-z0-9][a-z0-9._:-]{2,100}$'))
        AND (NOT (verdict ? 'entry_stage') OR verdict->>'entry_stage' IN ('concrete', 'pictorial', 'abstract'))
    ) NOT VALID;
-- NOT VALID keeps the swap cheap on a large table; every row already satisfies
-- the 0205 CHECK, which this one only widens, so validation cannot fail.
ALTER TABLE public.lesson_v2_grade_receipts VALIDATE CONSTRAINT lesson_v2_grade_receipts_signals_check;

-- Part 8 scorer parity: of the graded submissions whose browser reported its
-- advisory verdict, the share where it agreed with Core. Every receipt counts,
-- not only first tries: parity is a property of each submission.
CREATE OR REPLACE FUNCTION public.learning_scorer_parity(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (graded bigint, reported bigint, agreed bigint, agreement_share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT count(*),
           count(*) FILTER (WHERE verdict ? 'client_agree'),
           count(*) FILTER (WHERE verdict->>'client_agree' = 'true'),
           CASE WHEN count(*) FILTER (WHERE verdict ? 'client_agree') = 0 THEN NULL
                ELSE round(count(*) FILTER (WHERE verdict->>'client_agree' = 'true')::numeric
                           / count(*) FILTER (WHERE verdict ? 'client_agree'), 4) END
    FROM public.lesson_v2_grade_receipts
    WHERE created_at >= p_since AND created_at < p_until;
$$;

-- L12 / $11: first-try detection cells split by item phase (pre, post, or
-- unphased practice); Core computes d-prime per phase. Hit rate alone is
-- never reported.
CREATE OR REPLACE FUNCTION public.learning_detection_cells_by_phase(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (item_phase text, responses bigint, hits bigint, misses bigint, false_alarms bigint, correct_rejections bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (run_id, segment_id) verdict
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until AND verdict ? 'detection'
        ORDER BY run_id, segment_id, created_at, jti
    )
    SELECT coalesce(verdict->>'item_phase', 'practice'), count(*),
           sum((verdict->'detection'->>'hits')::int), sum((verdict->'detection'->>'misses')::int),
           sum((verdict->'detection'->>'false_alarms')::int), sum((verdict->'detection'->>'correct_rejections')::int)
    FROM first_try
    GROUP BY 1
    ORDER BY CASE coalesce(verdict->>'item_phase', 'practice') WHEN 'pre' THEN 1 WHEN 'post' THEN 2 ELSE 3 END;
$$;

-- L12 cue ticks: summed first-try cue counts (diagnostic).
CREATE OR REPLACE FUNCTION public.learning_cue_hits(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (responses bigint, hits bigint, missed bigint, false_ticks bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (run_id, segment_id) verdict
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until AND verdict ? 'cues'
        ORDER BY run_id, segment_id, created_at, jti
    )
    SELECT count(*), coalesce(sum((verdict->'cues'->>'hits')::int), 0), coalesce(sum((verdict->'cues'->>'missed')::int), 0),
           coalesce(sum((verdict->'cues'->>'false_ticks')::int), 0)
    FROM first_try;
$$;

-- Part 8 representation A/B: first-try success on transfer items per KC and
-- representation variant. Diagnostic until enough data (Part 8).
CREATE OR REPLACE FUNCTION public.learning_variant_transfer(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (kc text, variant text, first_attempts bigint, successes bigint, success_share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (run_id, segment_id) verdict
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until AND verdict ? 'variant' AND verdict ? 'kc'
          AND verdict->>'item_role' = 'transfer'
        ORDER BY run_id, segment_id, created_at, jti
    )
    SELECT verdict->>'kc', verdict->>'variant', count(*),
           count(*) FILTER (WHERE verdict->>'correct' = 'true'),
           round(count(*) FILTER (WHERE verdict->>'correct' = 'true')::numeric / count(*), 4)
    FROM first_try
    GROUP BY 1, 2
    ORDER BY 1, 2;
$$;

-- Part 4.4: where mastery fading started learners (a fluent learner starts past concrete).
CREATE OR REPLACE FUNCTION public.learning_cpa_entry_stage_distribution(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (entry_stage text, runs bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT entry_stage, count(*) FROM (
        SELECT DISTINCT ON (run_id) verdict->>'entry_stage' AS entry_stage
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until AND verdict ? 'entry_stage'
        ORDER BY run_id, created_at, jti
    ) AS runs_started
    GROUP BY entry_stage
    ORDER BY CASE entry_stage WHEN 'concrete' THEN 1 WHEN 'pictorial' THEN 2 ELSE 3 END;
$$;

REVOKE ALL ON FUNCTION public.learning_scorer_parity(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_detection_cells_by_phase(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_cue_hits(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_variant_transfer(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_cpa_entry_stage_distribution(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_scorer_parity(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_detection_cells_by_phase(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_cue_hits(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_variant_transfer(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_cpa_entry_stage_distribution(timestamptz, timestamptz) TO service_role;
