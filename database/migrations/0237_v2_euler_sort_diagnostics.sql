-- v2_euler_sort_diagnostics — the L5 Euler and L10 sort-by-rule codes on
-- the v2 grade receipt (GAP-FIX-R4 learning; Appendix P L5 and L10, Part 4.5).
-- @phase: contract
-- @after-release: none — the receipt CHECK is dropped and re-added with three more diagnostic codes and nothing else changed, so every receipt a deployed Core writes still passes and no running write is rejected; learning_error_family_split keeps its signature and result. The phase classifier counts any CHECK swap as a contraction, so it is declared contract and applied by hand. Apply it BEFORE the Core release that grades Euler occupancy or conclusion steps or sort rule switches: an older CHECK would refuse a receipt naming one of the new codes (the grade route answers 502 and nothing is recorded).
--
-- Appendix P L5 grades "item -> region map; region occupancy flags; chosen
-- conclusion", with syllogisms for ages 13-17; L10 changes the rule mid-task
-- (rule switching, 10-12). Core now stores which part the learner missed:
--   * occupancy    the regions the learner marked as holding something
--                  differ from the rubric's (an answer error);
--   * conclusion   the chosen conclusion (necessarily / possibly / never)
--                  differs from the rubric's (an answer error);
--   * rule_switch  the first rule was sorted right and the items after the
--                  switch were sorted by the old rule or a wrong bin (a
--                  structure error: the criterion, not one item).
-- A wrongly chosen diagram (L5 choose-the-relation) is the existing
-- `structure` code. learning_error_family_split (0207) is redefined only to
-- count rule_switch among structure errors.

ALTER TABLE public.lesson_v2_grade_receipts DROP CONSTRAINT IF EXISTS lesson_v2_grade_receipts_signals_check;
ALTER TABLE public.lesson_v2_grade_receipts
    ADD CONSTRAINT lesson_v2_grade_receipts_signals_check CHECK (
        (NOT (verdict ? 'diagnostic') OR verdict->>'diagnostic' IN
            ('none', 'structure', 'value', 'partial', 'miss', 'false_alarm', 'path', 'outcome', 'bin', 'reason', 'tolerance', 'count_from_zero',
             'confirmation_bias', 'p_only_missing_not_q', 'matching', 'not_p_checked', 'all_cards',
             'occupancy', 'conclusion', 'rule_switch'))
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
-- the previous CHECK, which this one only widens, so validation cannot fail.
ALTER TABLE public.lesson_v2_grade_receipts VALIDATE CONSTRAINT lesson_v2_grade_receipts_signals_check;

-- Structure-versus-answer split of first-try errors (Part 4.5): 0207's body
-- with rule_switch counted as a structure error.
CREATE OR REPLACE FUNCTION public.learning_error_family_split(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (family text, diagnostic text, errors bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (run_id, segment_id) verdict
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until
        ORDER BY run_id, segment_id, created_at, jti
    )
    SELECT CASE WHEN verdict->>'diagnostic' IN ('structure', 'path', 'bin', 'rule_switch') THEN 'structure' ELSE 'answer' END,
           verdict->>'diagnostic', count(*)
    FROM first_try
    WHERE verdict->>'correct' = 'false' AND verdict ? 'diagnostic' AND verdict->>'diagnostic' <> 'none'
    GROUP BY 1, 2
    ORDER BY 1, 3 DESC;
$$;
REVOKE ALL ON FUNCTION public.learning_error_family_split(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_error_family_split(timestamptz, timestamptz) TO service_role;
