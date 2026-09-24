-- @phase: expand
-- Serialize the attempt cap and persist replayable verdicts in the same transaction.
CREATE TABLE IF NOT EXISTS public.lesson_grade_receipts (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    run_id uuid NOT NULL,
    segment_id text NOT NULL,
    client_attempt integer NOT NULL CHECK (client_attempt > 0),
    verdict jsonb NOT NULL,
    PRIMARY KEY (user_id, lesson_id, run_id, segment_id, client_attempt)
);
ALTER TABLE public.lesson_grade_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_grade_receipts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_lesson_grade(
    p_user_id uuid, p_lesson_id uuid, p_run_id uuid, p_segment_id text,
    p_client_attempt integer, p_max_attempts integer, p_hints_used integer,
    p_verdict jsonb, p_context jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count integer;
    v_verdict jsonb;
    v_score integer;
    v_correct boolean;
BEGIN
    IF p_user_id IS NULL OR p_lesson_id IS NULL OR p_segment_id IS NULL OR length(p_segment_id) = 0
       OR p_client_attempt IS NULL OR p_client_attempt < 1 OR p_max_attempts IS NULL OR p_max_attempts < 1
       OR p_hints_used IS NULL OR p_hints_used < 0 OR p_verdict IS NULL
       OR jsonb_typeof(p_verdict->'score') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_verdict->'correct') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Invalid grade parameters' USING ERRCODE = '22023';
    END IF;
    v_score := (p_verdict->>'score')::integer;
    v_correct := (p_verdict->>'correct')::boolean;
    IF v_score < 0 OR v_score > 100 THEN
        RAISE EXCEPTION 'Invalid grade score' USING ERRCODE = '22023';
    END IF;
    -- Lock all runs of this segment to preserve the legacy lifetime-count path too.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_lesson_id::text || ':' || p_segment_id, 0));
    IF p_run_id IS NOT NULL THEN
        SELECT verdict INTO v_verdict FROM public.lesson_grade_receipts
        WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND run_id = p_run_id
          AND segment_id = p_segment_id AND client_attempt = p_client_attempt;
        IF FOUND THEN RETURN jsonb_build_object('exhausted', false, 'verdict', v_verdict); END IF;
    END IF;
    SELECT count(*) INTO v_count FROM public.lesson_segment_attempts
    WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND segment_id = p_segment_id
      AND (p_run_id IS NULL OR run_id = p_run_id);
    IF v_count >= p_max_attempts THEN RETURN jsonb_build_object('exhausted', true); END IF;
    v_count := v_count + 1;
    v_verdict := jsonb_set(p_verdict, '{allowRetry}', to_jsonb(v_score < 100 AND v_count < p_max_attempts));
    IF v_score < 100 AND v_count < p_max_attempts THEN v_verdict := v_verdict - 'reveal'; END IF;
    INSERT INTO public.lesson_segment_attempts(
        user_id, lesson_id, segment_id, attempt_number, score, run_id, hints_used,
        time_spent_seconds, course_id, topic_id, skill_key, document_updated_at, diagnostic_code
    ) VALUES (
        p_user_id, p_lesson_id, p_segment_id, v_count, v_score, p_run_id, p_hints_used,
        (p_context->>'timeSpentSeconds')::integer, (p_context->>'courseId')::uuid,
        (p_context->>'topicId')::uuid, p_context->>'skillKey', (p_context->>'documentUpdatedAt')::timestamptz,
        CASE WHEN p_hints_used > 0 THEN 'hint_assisted' WHEN v_count > 1 AND v_correct THEN 'retry_recovery'
             WHEN NOT v_correct THEN 'initial_incorrect' ELSE NULL END
    );
    IF p_run_id IS NOT NULL THEN
        INSERT INTO public.lesson_grade_receipts VALUES (p_user_id, p_lesson_id, p_run_id, p_segment_id, p_client_attempt, v_verdict);
    END IF;
    RETURN jsonb_build_object('exhausted', false, 'verdict', v_verdict);
END;
$$;
REVOKE ALL ON FUNCTION public.record_lesson_grade(uuid, uuid, uuid, text, integer, integer, integer, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lesson_grade(uuid, uuid, uuid, text, integer, integer, integer, jsonb, jsonb) TO service_role;
