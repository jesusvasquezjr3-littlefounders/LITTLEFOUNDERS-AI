-- @phase: expand
-- S05.2y: complete a v2 lesson only from receipts belonging to its immutable run.

CREATE OR REPLACE FUNCTION public.complete_v2_lesson(
    p_user_id uuid,
    p_lesson_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_required_segment_ids text[],
    p_xp int,
    p_minutes int,
    p_local_date date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    run public.lesson_v2_runs%ROWTYPE;
    result jsonb;
    expected_count int;
    met_count int;
BEGIN
    IF p_user_id IS NULL OR p_lesson_id IS NULL OR p_run_id IS NULL OR p_document_version_id IS NULL
       OR p_required_segment_ids IS NULL OR cardinality(p_required_segment_ids) = 0
       OR cardinality(ARRAY(SELECT DISTINCT unnest(p_required_segment_ids))) <> cardinality(p_required_segment_ids)
       OR EXISTS (SELECT 1 FROM unnest(p_required_segment_ids) AS id WHERE id IS NULL OR length(id) = 0)
       OR p_xp IS NULL OR p_xp < 0 OR p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 120 OR p_local_date IS NULL THEN
        RAISE EXCEPTION 'Invalid v2 completion input' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR run.user_id <> p_user_id OR run.lesson_id <> p_lesson_id
       OR run.document_version_id <> p_document_version_id THEN
        RAISE EXCEPTION 'Invalid v2 lesson run' USING ERRCODE = '22023';
    END IF;

    expected_count := cardinality(p_required_segment_ids);
    SELECT count(*) INTO met_count FROM public.lesson_v2_grade_receipts
    WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
      AND segment_id = ANY(p_required_segment_ids)
      AND verdict->>'correct' = 'true' AND verdict->>'score' = '100';
    IF met_count <> expected_count THEN
        RAISE EXCEPTION 'V2 lesson has pending learning steps' USING ERRCODE = '22023';
    END IF;

    result := public.complete_lesson(p_user_id, p_lesson_id, p_run_id, 100, true, p_xp, p_minutes, p_local_date);
    UPDATE public.lesson_v2_runs SET completed_at = COALESCE(completed_at, now()) WHERE id = p_run_id;
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_v2_lesson(uuid, uuid, uuid, uuid, text[], int, int, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_v2_lesson(uuid, uuid, uuid, uuid, text[], int, int, date) TO service_role;
