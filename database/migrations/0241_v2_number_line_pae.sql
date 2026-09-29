-- v2_number_line_pae — the M2/M3 placement error on the v2 grade receipt
-- (GAP-FIX-R5 learning; Appendix P Part 1 M2 and M3, Part 4.6, Part 7.2).
-- @phase: contract
-- @after-release: none — the receipt CHECK is dropped and re-added with one more optional key and nothing else changed, so every receipt a deployed Core writes still passes and no running write is rejected. The phase classifier counts any CHECK swap as a contraction, so it is declared contract and applied by hand. Apply it BEFORE the Core release that grades number lines with a tolerance: that release writes `pae` on every number-line receipt, and this CHECK is what pins its shape (without it the key is simply unconstrained, never refused).
--
-- Appendix P M2 grades "position error as a share of the line (PAE) within a
-- tolerance; order of placed items" and Part 4.6 "number lines with a
-- tolerance on error as a share of the line". Core now grades whole-number
-- lines against a private `tolerance_share` and stores, beside the verdict,
-- the largest placement error as a share of the line (four decimals, 0-1):
--   * M2 one point:    |value - target| / (maximum - minimum);
--   * M2 placed items: the largest item error (order is graded first, as the
--                      existing `structure` code);
--   * M3 fraction line: the error in snap units / all units of the line.
-- It is a diagnostic for calibrating the tolerance ("a design choice to
-- calibrate, not a research value"), never a grading input and never sent
-- to the browser. No diagnostic code is added: a missed tolerance stays
-- `tolerance`, a misordered set `structure`, a half-right pair `partial`.

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
        -- CASE, not AND: the cast runs only on a JSON number, whatever order the conditions are evaluated in.
        AND (NOT (verdict ? 'pae') OR CASE WHEN jsonb_typeof(verdict->'pae') = 'number'
            THEN (verdict->>'pae')::numeric BETWEEN 0 AND 1 ELSE false END)
    ) NOT VALID;
-- NOT VALID keeps the swap cheap on a large table; no existing row carries
-- `pae`, so every row satisfies the new clause and validation cannot fail.
ALTER TABLE public.lesson_v2_grade_receipts VALIDATE CONSTRAINT lesson_v2_grade_receipts_signals_check;
