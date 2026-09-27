-- @phase: expand
-- S-06 (owner decision OD-28, 27 September 2026): a verified Tutor may change
-- the username of their linked child whose handle is flagged (E.13).
--
-- A parent-created child signs in with a handle, and Core derives the child's
-- sign-in address from it (`<username>@kids.littlefounders.invalid`, Core
-- routes/family.ts kidEmail). The username and that address must therefore
-- change together or the child is locked out, which is why a child's username
-- was not editable before. guardian_rename_flagged_child changes both, and
-- writes the audit row, in ONE transaction; every rule is checked inside it,
-- so a race between two requests or a stale Core check cannot split them.
--
-- Who and when (all checked here, not only in Core):
--   - the caller is a parent with a VERIFIED link to the child;
--   - the child is a parent-created account (kid role): a self-registered
--     teen signs in by email and renames their own handle;
--   - the CURRENT handle is flagged by the E.13 classifier (profile_field_flags);
--     an unflagged handle stays locked, as before;
--   - the new handle has the platform shape (0005), is not flagged itself (the
--     E.13 write guard, 0120, refuses it too), differs from the old one, and no
--     profile or sign-in address uses it;
--   - the stored sign-in address is the one derived from the current handle;
--     an account that does not follow the derivation is left for support.
--
-- The audit row names the act and the flag categories of the old handle, never
-- a handle or a name (the E.13 audit rule). Core ends the child's sessions
-- after the commit, so the child signs in again with the new handle.
--
-- kid_username_guard closes the other door: a child's username can no longer
-- change through any other write (a browser session under profiles_update_own,
-- or a service write), because that would strand the account behind its old
-- sign-in address. The first username of a new child (from no username, before
-- the kid role exists) is unaffected. No deployed Core renames a child, so
-- nothing a running service does is refused: this is expand.

CREATE OR REPLACE FUNCTION public.guard_kid_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.username IS NOT NULL
       AND NEW.username IS DISTINCT FROM OLD.username
       AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'kid')
       AND coalesce(current_setting('lf.kid_username_rename', true), '') <> NEW.user_id::text THEN
        RAISE EXCEPTION 'KID_USERNAME_LOCKED' USING ERRCODE = 'P0001',
            DETAIL = 'A child''s username changes only through guardian_rename_flagged_child';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_kid_username() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER kid_username_guard
BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_kid_username();

CREATE OR REPLACE FUNCTION public.guardian_rename_flagged_child(p_guardian uuid, p_kid uuid, p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_domain constant text := '@kids.littlefounders.invalid';
    v_old text;
    v_old_flags text[];
    v_email text;
    v_new text := p_username;
BEGIN
    IF p_guardian IS NULL OR p_kid IS NULL OR p_guardian = p_kid THEN
        RAISE EXCEPTION 'NOT_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF v_new IS NULL OR v_new !~ '^[a-z0-9_]{3,20}$' THEN
        RAISE EXCEPTION 'USERNAME_SHAPE' USING ERRCODE = 'P0001';
    END IF;
    -- Serialize with sign-in changes, age declarations and deletion of this account.
    PERFORM 1 FROM auth.users WHERE id = p_kid FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_guardian AND role = 'parent')
       OR NOT EXISTS (SELECT 1 FROM public.guardian_links
                      WHERE parent_user_id = p_guardian AND kid_user_id = p_kid AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'NOT_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_kid AND role = 'kid') THEN
        RAISE EXCEPTION 'ACCOUNT_SELF_MANAGED' USING ERRCODE = 'P0001';
    END IF;
    SELECT username INTO v_old FROM public.profiles WHERE user_id = p_kid FOR UPDATE;
    v_old_flags := public.profile_field_flags(v_old);
    IF v_old IS NULL OR cardinality(v_old_flags) = 0 THEN
        RAISE EXCEPTION 'USERNAME_NOT_FLAGGED' USING ERRCODE = 'P0001';
    END IF;
    IF v_new = v_old THEN
        RAISE EXCEPTION 'USERNAME_UNCHANGED' USING ERRCODE = 'P0001';
    END IF;
    IF cardinality(public.profile_field_flags(v_new)) > 0 THEN
        RAISE EXCEPTION 'PROFILE_FIELD_UNSAFE' USING ERRCODE = 'P0001', DETAIL = 'username';
    END IF;
    SELECT email INTO v_email FROM auth.users WHERE id = p_kid;
    IF v_email IS DISTINCT FROM v_old || v_domain THEN
        RAISE EXCEPTION 'SIGN_IN_IDENTIFIER_MISMATCH' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_new AND user_id <> p_kid)
       OR EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_new || v_domain AND id <> p_kid) THEN
        RAISE EXCEPTION 'USERNAME_IN_USE' USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('lf.kid_username_rename', p_kid::text, true);
    UPDATE public.profiles SET username = v_new WHERE user_id = p_kid;
    PERFORM set_config('lf.kid_username_rename', '', true);
    UPDATE auth.users SET email = v_new || v_domain WHERE id = p_kid;
    -- GoTrue keeps a copy of the address on the email identity; keep it in step.
    IF to_regclass('auth.identities') IS NOT NULL THEN
        EXECUTE 'UPDATE auth.identities SET identity_data = jsonb_set(identity_data, ''{email}'', to_jsonb($1::text))
                 WHERE user_id = $2 AND provider = ''email'' AND identity_data ? ''email'''
            USING v_new || v_domain, p_kid;
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_guardian, 'family.kid_username_changed', p_kid::text,
            jsonb_build_object('origin', 'database-function', 'reason', 'flagged_handle', 'flags', to_jsonb(v_old_flags)));
    RETURN v_new;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'USERNAME_IN_USE' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.guardian_rename_flagged_child(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_rename_flagged_child(uuid, uuid, text) TO service_role;
