-- v2_learning_signal_metrics — Appendix C 1.1 transfer success and the
-- Appendix P Part 8 teaching-visual metrics (GAP-FIX-R1 learning).
-- @phase: expand
--
-- Core stores, beside each v2 verdict (0205 CHECK): the closed diagnostic
-- code, the item role (practice or transfer), the KC the item evidences and,
-- for the scam families, the signal-detection counts. These service-role
-- functions read them over the FIRST receipt of each (run, segment), the same
-- first-try rule complete_v2_lesson uses, for the staff learning-quality
-- panel and the Mentor quality loop. Read-only aggregates: no learner id, no
-- answer, no rubric leaves them. Service role only.

-- Transfer versus practice success per KC.
CREATE OR REPLACE FUNCTION public.learning_transfer_success(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (kc text, item_role text, first_attempts bigint, successes bigint, success_share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (run_id, segment_id) verdict
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until AND verdict ? 'item_role' AND verdict ? 'kc'
        ORDER BY run_id, segment_id, created_at, jti
    )
    SELECT verdict->>'kc', verdict->>'item_role', count(*),
           count(*) FILTER (WHERE verdict->>'correct' = 'true'),
           round(count(*) FILTER (WHERE verdict->>'correct' = 'true')::numeric / count(*), 4)
    FROM first_try
    GROUP BY verdict->>'kc', verdict->>'item_role'
    ORDER BY 1, 2;
$$;

-- Structure-versus-answer split of first-try errors (Part 4.5).
CREATE OR REPLACE FUNCTION public.learning_error_family_split(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (family text, diagnostic text, errors bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (run_id, segment_id) verdict
        FROM public.lesson_v2_grade_receipts
        WHERE created_at >= p_since AND created_at < p_until
        ORDER BY run_id, segment_id, created_at, jti
    )
    SELECT CASE WHEN verdict->>'diagnostic' IN ('structure', 'path', 'bin') THEN 'structure' ELSE 'answer' END,
           verdict->>'diagnostic', count(*)
    FROM first_try
    WHERE verdict->>'correct' = 'false' AND verdict ? 'diagnostic' AND verdict->>'diagnostic' <> 'none'
    GROUP BY 1, 2
    ORDER BY 1, 3 DESC;
$$;

-- M1: where learners first succeed without help (0105 recorded it; this reports it).
CREATE OR REPLACE FUNCTION public.learning_first_unaided_stage_distribution(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (stage text, learners bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT stage, count(*)
    FROM public.lesson_v2_first_unaided_stages
    WHERE created_at >= p_since AND created_at < p_until
    GROUP BY stage
    ORDER BY CASE stage WHEN 'concrete' THEN 1 WHEN 'pictorial' THEN 2 ELSE 3 END;
$$;

-- L12 / $11: summed first-try detection cells per lesson; Core computes d-prime.
CREATE OR REPLACE FUNCTION public.learning_detection_cells(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (lesson_id uuid, responses bigint, hits bigint, misses bigint, false_alarms bigint, correct_rejections bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH first_try AS (
        SELECT DISTINCT ON (receipt.run_id, receipt.segment_id) run.lesson_id, receipt.verdict
        FROM public.lesson_v2_grade_receipts AS receipt
        JOIN public.lesson_v2_runs AS run ON run.id = receipt.run_id
        WHERE receipt.created_at >= p_since AND receipt.created_at < p_until AND receipt.verdict ? 'detection'
        ORDER BY receipt.run_id, receipt.segment_id, receipt.created_at, receipt.jti
    )
    SELECT lesson_id, count(*),
           sum((verdict->'detection'->>'hits')::int), sum((verdict->'detection'->>'misses')::int),
           sum((verdict->'detection'->>'false_alarms')::int), sum((verdict->'detection'->>'correct_rejections')::int)
    FROM first_try
    GROUP BY lesson_id
    ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.learning_transfer_success(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_error_family_split(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_first_unaided_stage_distribution(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_detection_cells(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_transfer_success(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_error_family_split(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_first_unaided_stage_distribution(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.learning_detection_cells(timestamptz, timestamptz) TO service_role;
