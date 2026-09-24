-- @phase: expand
-- A.3/A.4 minimal age-screen evidence. A declaration is not verified adulthood.
-- Under-13 dates are never retained. Self-service declarations cannot be edited
-- to gain privileges; correction/verified evidence requires a separate policy.
CREATE TABLE IF NOT EXISTS public.account_age_declarations (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    declared_age_band text NOT NULL CHECK (declared_age_band IN ('under_13', '13_to_17', 'adult')),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_age_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_age_declarations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.account_age_declarations TO service_role;

CREATE OR REPLACE FUNCTION public.record_age_declaration(p_user_id uuid, p_age_band text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE stored_band text;
BEGIN
    IF p_age_band IS NULL OR p_age_band NOT IN ('under_13', '13_to_17', 'adult') THEN
        RAISE EXCEPTION 'Invalid age band' USING ERRCODE = '22023';
    END IF;
    -- Serialize first declaration and reclassification for one identity.
    PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found' USING ERRCODE = '23503';
    END IF;
    -- A later under-13 disclosure always protects, even if the first declaration
    -- was different. It never gets discarded by an idempotency conflict.
    IF p_age_band = 'under_13' THEN
        PERFORM public.mark_under13_origin(p_user_id);
    END IF;
    INSERT INTO public.account_age_declarations(user_id, declared_age_band)
    VALUES (p_user_id, p_age_band)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT declared_age_band INTO stored_band FROM public.account_age_declarations WHERE user_id = p_user_id;
    RETURN stored_band;
END;
$$;
REVOKE ALL ON FUNCTION public.record_age_declaration(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_age_declaration(uuid, text) TO service_role;
