-- @phase: expand
-- H.1: an account-owned optional analytics choice, never a safety-log switch.
CREATE TABLE IF NOT EXISTS public.teen_analytics_preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled boolean NOT NULL,
    disclosure_version smallint NOT NULL CHECK (disclosure_version = 1),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teen_analytics_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teen_analytics_preferences FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.teen_analytics_preferences TO service_role;
CREATE OR REPLACE FUNCTION public.set_teen_analytics_preference(p_user_id uuid, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_enabled IS NULL THEN RAISE EXCEPTION 'A choice is required' USING ERRCODE = '22023'; END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = '23503'; END IF;
    INSERT INTO public.teen_analytics_preferences(user_id, enabled, disclosure_version)
    VALUES (p_user_id, p_enabled, 1)
    ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled,
        disclosure_version = EXCLUDED.disclosure_version, updated_at = now();
    RETURN p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.set_teen_analytics_preference(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_teen_analytics_preference(uuid, boolean) TO service_role;
