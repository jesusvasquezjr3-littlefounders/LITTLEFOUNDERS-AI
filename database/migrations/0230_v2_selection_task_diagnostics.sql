-- v2_selection_task_diagnostics — L1 rule-checker selection codes on the
-- v2 grade receipt (GAP-FIX-R3 learning; Appendix P L1, Part 4.5).
-- @phase: contract
-- @after-release: none — the receipt CHECK is dropped and re-added with five more diagnostic codes and nothing else changed, so every receipt a deployed Core writes still passes and no running write is rejected. The phase classifier counts any CHECK swap as a contraction, so it is declared contract and applied by hand. Apply it BEFORE the Core release that grades rule-checker rubrics carrying card roles: an older CHECK would refuse a receipt naming one of the new codes (the grade route answers 502 and nothing is recorded).
--
-- The private rule-checker rubric may now name each card's role against the
-- rule "if P then Q" (p, not_p, q, not_q). Core then stores which wrong set
-- the learner turned, beside the verdict:
--   * confirmation_bias      {P, Q}
--   * p_only_missing_not_q   {P}
--   * matching               {Q}
--   * not_p_checked          any other set with the not-P card
--   * all_cards              every card
-- Every other wrong set keeps partial / miss / false_alarm. The codes are
-- answer errors in learning_error_family_split (0207), which reports each
-- code by name; no function changes. The roles never leave the answer keys.

ALTER TABLE public.lesson_v2_grade_receipts DROP CONSTRAINT IF EXISTS lesson_v2_grade_receipts_signals_check;
ALTER TABLE public.lesson_v2_grade_receipts
    ADD CONSTRAINT lesson_v2_grade_receipts_signals_check CHECK (
        (NOT (verdict ? 'diagnostic') OR verdict->>'diagnostic' IN
            ('none', 'structure', 'value', 'partial', 'miss', 'false_alarm', 'path', 'outcome', 'bin', 'reason', 'tolerance', 'count_from_zero',
             'confirmation_bias', 'p_only_missing_not_q', 'matching', 'not_p_checked', 'all_cards'))
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
