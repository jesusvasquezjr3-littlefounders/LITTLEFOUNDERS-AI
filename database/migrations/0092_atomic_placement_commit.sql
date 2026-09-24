-- @phase: expand
-- B.1: one service-owned transaction for the placement result and credits.
CREATE OR REPLACE FUNCTION public.commit_course_placement(p_result jsonb, p_lesson_ids uuid[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    subject uuid := (p_result->>'user_id')::uuid;
    course uuid := (p_result->>'course_id')::uuid;
    prior public.course_placements%ROWTYPE;
    credits uuid[];
    existing_credits uuid[];
BEGIN
    IF p_lesson_ids IS NULL OR jsonb_typeof(p_result) <> 'object' THEN
        RAISE EXCEPTION 'Invalid placement payload';
    END IF;
    SELECT coalesce(array_agg(DISTINCT id ORDER BY id), '{}'::uuid[]) INTO credits
        FROM unnest(p_lesson_ids) id;
    IF array_position(p_lesson_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid credit'; END IF;
    PERFORM 1 FROM auth.users WHERE id = subject FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown learner'; END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(credits) AS requested(lesson_id) WHERE NOT EXISTS (
            SELECT 1 FROM public.lessons l
            JOIN public.topics t ON t.id = l.topic_id
            JOIN public.sagas s ON s.id = t.saga_id
            JOIN public.adventures a ON a.id = s.adventure_id
            WHERE l.id = requested.lesson_id AND a.course_id = course AND l.status = 'published'
        )
    ) THEN RAISE EXCEPTION 'Credit outside published course'; END IF;
    SELECT * INTO prior FROM public.course_placements WHERE user_id = subject AND course_id = course;
    IF FOUND THEN
        SELECT coalesce(array_agg(lesson_id ORDER BY lesson_id), '{}'::uuid[]) INTO existing_credits
            FROM public.placement_credits WHERE user_id = subject AND course_id = course;
        IF prior.claimed_level = p_result->>'claimed_level'
           AND prior.education_level = p_result->>'education_level'
           AND prior.quiz_answers = p_result->'quiz_answers'
           AND prior.start_topic_id IS NOT DISTINCT FROM (p_result->>'start_topic_id')::uuid
           AND prior.start_lesson_id IS NOT DISTINCT FROM (p_result->>'start_lesson_id')::uuid
           AND prior.method = p_result->>'method' AND credits = existing_credits THEN
            RETURN 'replayed';
        END IF;
        RETURN 'conflict';
    END IF;
    INSERT INTO public.course_placements(user_id,course_id,claimed_level,education_level,quiz_answers,start_topic_id,start_lesson_id,method)
    VALUES(subject,course,p_result->>'claimed_level',p_result->>'education_level',p_result->'quiz_answers',
        (p_result->>'start_topic_id')::uuid,(p_result->>'start_lesson_id')::uuid,p_result->>'method');
    INSERT INTO public.placement_credits(user_id,lesson_id,topic_id,course_id)
        SELECT subject,l.id,l.topic_id,course FROM public.lessons l WHERE l.id = ANY(credits);
    RETURN 'created';
END;
$$;
REVOKE ALL ON FUNCTION public.commit_course_placement(jsonb,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_course_placement(jsonb,uuid[]) TO service_role;
