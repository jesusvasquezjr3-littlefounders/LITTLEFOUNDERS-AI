-- 0005_review_followups.sql
-- Two things left by the security review of 2026-10-10 (docs/security/SECURITY-GUIDE.md):
--
--   1. Core can ask whether an address already has an account, to keep an allowance of emails
--      reserved for people who do (a flood of made-up addresses must not stop them signing in).
--   2. A display name cannot look like a web address or pass for the product's staff. Nobody sees
--      another person's name yet; the rule is in place before anybody does.

-- ---------------------------------------------------------------------------------------------
-- 1. Does this address have an account?
-- ---------------------------------------------------------------------------------------------

-- For Core's own bookkeeping. Core never tells a caller the answer.
CREATE FUNCTION public.core_account_exists(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.users AS u
        WHERE u.email = lower(btrim(p_email)) AND u.deleted_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.core_account_exists(text) FROM PUBLIC, anon, authenticated, service_role, mail_service;
GRANT EXECUTE ON FUNCTION public.core_account_exists(text) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Display names
-- ---------------------------------------------------------------------------------------------

-- As in 0003, plus two refusals:
--   - a period followed by two or more letters ("example.com", "www.name"): a name is not a link.
--     "J.R." and "Dr. Ana" stay fine;
--   - a word that would pass for the product or its staff, in the three languages.
CREATE OR REPLACE FUNCTION public.core_set_profile(p_user uuid, p_display_name text, p_mentor text, p_parent_intent boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_name text := NULLIF(regexp_replace(btrim(COALESCE(p_display_name, '')), '\s+', ' ', 'g'), '');
BEGIN
    IF v_name IS NOT NULL AND (char_length(v_name) > 40 OR v_name !~ '^[[:alpha:]][[:alpha:] ''’.\-]*$') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NAME_INVALID');
    END IF;

    IF v_name IS NOT NULL AND (
        v_name ~ '\.[[:alpha:]]{2,}'
        OR lower(v_name) ~ '(^|[^[:alpha:]])(admin|administrator|administrador|moderator|moderador|support|soporte|suporte|staff|official|oficial|system|sistema|littlefounders|mentoria|mentorai)([^[:alpha:]]|$)'
        OR lower(v_name) ~ 'little[ .''’\-]*founders'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NAME_INVALID');
    END IF;

    IF p_mentor IS NOT NULL AND p_mentor NOT IN ('zara', 'rho', 'liruf', 'dina') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'BAD_REQUEST');
    END IF;

    -- Only an adult can be waiting to be verified as a parent.
    IF p_parent_intent IS TRUE AND COALESCE(public.effective_age(p_user), 0) < 18 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'TARGET_NOT_ELIGIBLE');
    END IF;

    UPDATE public.profiles AS p
    SET display_name = COALESCE(v_name, p.display_name),
        mentor = COALESCE(p_mentor, p.mentor),
        parent_intent = COALESCE(p_parent_intent, p.parent_intent)
    WHERE p.user_id = p_user;

    RETURN jsonb_build_object('ok', true);
END;
$$;
