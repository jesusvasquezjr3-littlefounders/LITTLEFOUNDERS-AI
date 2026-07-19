-- 0011_oauth_bootstrap.sql — social-login (Google) bootstrap.
-- Delta over 0003 (never edit an applied migration). Idempotent.
--
-- OAuth users arrive via GoTrue's /authorize flow carrying provider metadata
-- (full_name / name) instead of the email-signup 'display_name'. Extend
-- handle_new_user() to derive a sensible display_name for BOTH paths so a
-- Google sign-up lands with the person's name (not a blank). Role stays
-- 'universal' (§1.4) exactly as before. CREATE OR REPLACE updates the function
-- the existing trg_handle_new_user trigger (0003) already calls.
--
-- We deliberately do NOT import the provider avatar_url/picture: the platform
-- uses DiceBear avataaars + gradient covers only (DESIGN.md), never external
-- photo URLs.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
            NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
            NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
            ''
        )
    )
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'universal')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;
