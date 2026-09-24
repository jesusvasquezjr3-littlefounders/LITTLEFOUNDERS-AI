-- @phase: expand
-- M1 representation fading is a learning sequence. A later representation
-- requires evidence that the preceding representation was attempted, without
-- turning an earlier review into a progression dead end.

CREATE FUNCTION public.record_v2_cpa_grade_retry(
    p_user_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_segment_id text,
    p_jti text,
    p_required_attempted_segment_id text,
    p_verdict jsonb,
    p_next_jti text,
    p_next_expires_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    prerequisite_exists boolean;
BEGIN
    IF p_required_attempted_segment_id IS NOT NULL AND length(p_required_attempted_segment_id) = 0 THEN
        RAISE EXCEPTION 'Invalid CPA attempt prerequisite' USING ERRCODE = '22023';
    END IF;

    IF p_required_attempted_segment_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.lesson_v2_grade_receipts
            WHERE user_id = p_user_id AND run_id = p_run_id
              AND document_version_id = p_document_version_id
              AND segment_id = p_required_attempted_segment_id
        ) INTO prerequisite_exists;
        IF NOT prerequisite_exists THEN
            RETURN jsonb_build_object('blocked', true);
        END IF;
    END IF;

    RETURN public.record_v2_lesson_grade_retry(
        p_user_id, p_run_id, p_document_version_id, p_segment_id, p_jti,
        NULL, p_verdict, p_next_jti, p_next_expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_v2_cpa_grade_retry(uuid, uuid, uuid, text, text, text, jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_cpa_grade_retry(uuid, uuid, uuid, text, text, text, jsonb, text, timestamptz) TO service_role;
