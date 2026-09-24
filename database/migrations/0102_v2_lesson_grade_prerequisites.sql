-- @phase: expand
-- M7 has an intentional two-step learning contract: build the comparison
-- structure before arithmetic. The authoritative receipt transaction enforces
-- that order so a direct HTTP call cannot skip the learning step.

CREATE FUNCTION public.record_v2_lesson_grade_ordered(
    p_user_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_segment_id text,
    p_jti text,
    p_verdict jsonb,
    p_required_met_segment_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    nonce public.lesson_v2_attempt_nonces%ROWTYPE;
    run public.lesson_v2_runs%ROWTYPE;
    prerequisite_verdict jsonb;
    score_text text;
    correct boolean;
BEGIN
    IF p_user_id IS NULL OR p_run_id IS NULL OR p_document_version_id IS NULL
       OR p_segment_id IS NULL OR length(p_segment_id) = 0 OR p_jti IS NULL
       OR (p_required_met_segment_id IS NOT NULL AND length(p_required_met_segment_id) = 0)
       OR p_verdict IS NULL OR jsonb_typeof(p_verdict->'score') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_verdict->'correct') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Invalid v2 grade parameters' USING ERRCODE = '22023';
    END IF;

    score_text := p_verdict->>'score';
    correct := (p_verdict->>'correct')::boolean;
    IF score_text !~ '^(0|[1-9][0-9]?|100)$'
       OR correct IS DISTINCT FROM (score_text = '100') THEN
        RAISE EXCEPTION 'Invalid v2 grade verdict' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO nonce FROM public.lesson_v2_attempt_nonces
    WHERE jti = p_jti FOR UPDATE;
    IF NOT FOUND OR nonce.user_id <> p_user_id OR nonce.run_id <> p_run_id
       OR nonce.document_version_id <> p_document_version_id OR nonce.segment_id <> p_segment_id
       OR nonce.expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid or expired v2 attempt token' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR run.user_id <> p_user_id OR run.document_version_id <> p_document_version_id
       OR run.expires_at <= now() OR run.completed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Inactive v2 lesson run' USING ERRCODE = '22023';
    END IF;

    IF nonce.consumed_at IS NOT NULL THEN
        SELECT verdict INTO p_verdict FROM public.lesson_v2_grade_receipts WHERE jti = p_jti;
        IF FOUND THEN RETURN jsonb_build_object('replayed', true, 'verdict', p_verdict); END IF;
        RAISE EXCEPTION 'Consumed v2 attempt nonce without receipt' USING ERRCODE = '22023';
    END IF;

    IF p_required_met_segment_id IS NOT NULL THEN
        SELECT verdict INTO prerequisite_verdict FROM public.lesson_v2_grade_receipts
        WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
          AND segment_id = p_required_met_segment_id;
        IF NOT FOUND OR prerequisite_verdict->>'score' <> '100'
           OR (prerequisite_verdict->>'correct')::boolean IS DISTINCT FROM true THEN
            RETURN jsonb_build_object('blocked', true);
        END IF;
    END IF;

    UPDATE public.lesson_v2_attempt_nonces SET consumed_at = now() WHERE jti = p_jti;
    INSERT INTO public.lesson_v2_grade_receipts(jti, user_id, run_id, document_version_id, segment_id, verdict)
    VALUES (p_jti, p_user_id, p_run_id, p_document_version_id, p_segment_id, p_verdict);
    RETURN jsonb_build_object('replayed', false, 'verdict', p_verdict);
END;
$$;

REVOKE ALL ON FUNCTION public.record_v2_lesson_grade_ordered(uuid, uuid, uuid, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_lesson_grade_ordered(uuid, uuid, uuid, text, text, jsonb, text) TO service_role;
