-- @phase: expand
-- C.1: one-time coarse teaching calibration, never verified-adult evidence.
-- No DOB or exact age is retained. Existing origin/consent safeguards remain.
CREATE TABLE IF NOT EXISTS public.mentor_age_calibrations (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mentor_age_calibrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mentor_age_calibrations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.mentor_age_calibrations TO service_role;

CREATE OR REPLACE FUNCTION public.record_mentor_age_calibration(p_user_id uuid, p_tier smallint)
RETURNS smallint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE stored_tier smallint;
BEGIN
    IF p_tier IS NULL OR p_tier NOT BETWEEN 1 AND 3 THEN
        RAISE EXCEPTION 'Invalid teaching tier' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = '23503'; END IF;
    INSERT INTO public.mentor_age_calibrations(user_id, tier) VALUES (p_user_id, p_tier)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT tier INTO stored_tier FROM public.mentor_age_calibrations WHERE user_id = p_user_id;
    RETURN stored_tier;
END;
$$;
REVOKE ALL ON FUNCTION public.record_mentor_age_calibration(uuid, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_mentor_age_calibration(uuid, smallint) TO service_role;
