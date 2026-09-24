-- @phase: expand
-- S05.2x: a review verdict is not a penalty.  Burn the submitted nonce and
-- create its next short-lived nonce inside one transaction, so a lost HTTP
-- response can be recovered without a browser-held secret.

CREATE OR REPLACE FUNCTION public.record_v2_lesson_grade_retry(
    p_user_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_segment_id text,
    p_jti text,
    p_required_met_segment_id text,
    p_verdict jsonb,
    p_next_jti text,
    p_next_expires_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    result jsonb;
BEGIN
    IF p_next_jti IS NULL OR p_next_jti !~ '^[A-Za-z0-9_-]{20,}$'
       OR p_next_expires_at IS NULL OR p_next_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid v2 retry nonce' USING ERRCODE = '22023';
    END IF;

    result := public.record_v2_lesson_grade_ordered(
        p_user_id, p_run_id, p_document_version_id, p_segment_id, p_jti,
        p_verdict, p_required_met_segment_id
    );
    IF result->>'blocked' = 'true' OR result->>'replayed' = 'true' OR (result->'verdict'->>'correct')::boolean THEN
        RETURN result;
    END IF;

    INSERT INTO public.lesson_v2_attempt_nonces(jti, user_id, run_id, document_version_id, segment_id, expires_at)
    VALUES (p_next_jti, p_user_id, p_run_id, p_document_version_id, p_segment_id, p_next_expires_at);
    RETURN result || jsonb_build_object('retry_jti', p_next_jti);
END;
$$;

REVOKE ALL ON FUNCTION public.record_v2_lesson_grade_retry(uuid, uuid, uuid, text, text, text, jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_lesson_grade_retry(uuid, uuid, uuid, text, text, text, jsonb, text, timestamptz) TO service_role;
