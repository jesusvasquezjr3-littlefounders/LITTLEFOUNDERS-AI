-- @phase: expand
-- A.2/A.3: minimal, service-owned provenance survives guest identity upgrades.
-- No refused birth date or browser-editable auth metadata is stored here.
CREATE TABLE IF NOT EXISTS public.account_safety_origins (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    under13_origin boolean NOT NULL DEFAULT true CHECK (under13_origin),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_safety_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_safety_origins FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.account_safety_origins TO service_role;

-- A retry or concurrent reclassification cannot clear or rewrite provenance.
-- Release from its restrictions requires a separately verified guardian/adult
-- decision in the consuming policy; signup/upgrade cannot remove this record.
CREATE OR REPLACE FUNCTION public.mark_under13_origin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.account_safety_origins(user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_under13_origin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_under13_origin(uuid) TO service_role;
