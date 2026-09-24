-- @phase: expand
-- B.3: one malformed published course must become staff-visible without
-- exposing its parsing details or any learner data to the staff console.

CREATE TABLE IF NOT EXISTS public.course_assembly_incidents (
    course_id        uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE RESTRICT,
    occurrence_count bigint NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
    first_seen_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_assembly_incidents ENABLE ROW LEVEL SECURITY;
-- No browser policy: Core records the counter; the permission-gated staff
-- console reads through Core's service-role data plane.

CREATE OR REPLACE FUNCTION public.record_course_assembly_incident(p_course_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_course_id IS NULL THEN
        RAISE EXCEPTION 'course_id is required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.course_assembly_incidents(course_id)
    VALUES (p_course_id)
    ON CONFLICT (course_id) DO UPDATE
    SET occurrence_count = public.course_assembly_incidents.occurrence_count + 1,
        last_seen_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_course_assembly_incident(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_course_assembly_incident(uuid) TO service_role;
