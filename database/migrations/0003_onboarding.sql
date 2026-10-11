-- 0003_onboarding.sql
-- What the onboarding hands to a new account (docs/features/F-003-onboarding.md): the name the
-- person asked to be called, the mentor they chose, and whether they came in as a parent.

-- The mentor: the character that accompanies the person. They can change it later.
ALTER TABLE public.profiles ADD COLUMN mentor text CHECK (mentor IN ('zara', 'rho', 'liruf', 'dina'));

-- The person came in through "I'm a parent". It is what they said, not a verified fact and not a
-- user type: the `parent` type is still granted only after verification (0001, D-030). It lets the
-- product show a parent's first steps and tells staff who is waiting to be verified.
ALTER TABLE public.profiles ADD COLUMN parent_intent boolean NOT NULL DEFAULT false;

-- Sets what the onboarding collected. A null argument leaves that value as it is. The name is a
-- first name or a nickname typed by the person: trimmed, inner spaces collapsed, and refused if it
-- holds anything but letters, marks, spaces, apostrophes, periods and hyphens, or is too long.
CREATE FUNCTION public.core_set_profile(p_user uuid, p_display_name text, p_mentor text, p_parent_intent boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_name text := NULLIF(regexp_replace(btrim(COALESCE(p_display_name, '')), '\s+', ' ', 'g'), '');
BEGIN
    IF v_name IS NOT NULL AND (char_length(v_name) > 40 OR v_name !~ '^[[:alpha:]][[:alpha:] ''’.\-]*$') THEN
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

-- The session's account now also says its mentor and whether it came in as a parent.
CREATE OR REPLACE FUNCTION public.core_session_context(p_user uuid, p_session uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'active', u.deleted_at IS NULL
            AND (u.banned_until IS NULL OR u.banned_until <= now())
            AND EXISTS (
                SELECT 1 FROM auth.sessions AS s
                WHERE s.id = p_session AND s.user_id = u.id AND (s.not_after IS NULL OR s.not_after > now())
            ),
        'email', u.email,
        'username', p.username,
        'displayName', p.display_name,
        'locale', p.locale,
        'mentor', p.mentor,
        'parentIntent', p.parent_intent,
        'ageDeclared', EXISTS (SELECT 1 FROM public.age_declarations AS d WHERE d.user_id = u.id),
        'roles', COALESCE((SELECT jsonb_agg(r.role ORDER BY r.role) FROM public.user_roles AS r WHERE r.user_id = u.id), '[]'::jsonb)
    )
    FROM auth.users AS u
    JOIN public.profiles AS p ON p.user_id = u.id
    WHERE u.id = p_user;
$$;

REVOKE ALL ON FUNCTION public.core_set_profile(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.core_set_profile(uuid, text, text, boolean) TO service_role;
