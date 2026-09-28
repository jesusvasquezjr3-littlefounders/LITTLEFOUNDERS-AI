-- guard_kid_email: a child account's sign-in address cannot be changed from
-- outside Core, including a direct GoTrue call with the child's own token.
-- @phase: expand
--
-- Product 10 A.6, Appendix M 1.3 ("Unauthorized Kid-Role Email-Change Attempt
-- Rate", through any path, UI or direct API) and Part 2.1 criterion 2.
--
-- Before this, KID_EMAIL_FORBIDDEN existed only in Core's POST
-- /auth/change-email. GoTrue is reachable without Core: Kong routes
-- /auth/v1/* with the public key the SPA ships, so a child holding their own
-- access token could call PUT /auth/v1/user {email} directly, and GoTrue would
-- store the pending address on auth.users (email_change) and start the
-- confirmation. Nothing in the database refused it.
--
-- The trigger below refuses, for an account holding the kid role:
--   * any change of auth.users.email, except to the one address the account
--     may have: the synthetic `<username>@kids.littlefounders.invalid` derived
--     from the child's current profile handle. That handle is itself guarded
--     (kid_username_guard, 0183): only guardian_rename_flagged_child (a
--     verified Tutor, S-06) can change it, and it moves the address in the
--     same transaction, so the Tutor's rename keeps working;
--   * any new pending address (email_change) or phone (phone, phone_change).
--     Clearing a pending value stays allowed.
-- There is deliberately no switch a session could set to skip the check: the
-- Tutor's rename is the only sanctioned move, and it passes on its own terms.
--
-- It reads the row as jsonb so it does not depend on GoTrue's column list (the
-- native verifier's auth shim has no phone columns), and it fires on every
-- update but compares values first: GoTrue rewrites whole rows on sign-in, and
-- an unchanged address must never cost a role lookup or be refused.
-- The refusal is SQLSTATE P0001 with message KID_EMAIL_FORBIDDEN.
-- Evidence: database/scripts/verify-kid-email-guard-postgres.py.

CREATE OR REPLACE FUNCTION public.guard_kid_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_old jsonb := to_jsonb(OLD);
    v_new jsonb := to_jsonb(NEW);
    v_email_moved boolean;
    v_pending boolean;
    v_handle text;
BEGIN
    v_email_moved := (v_new ->> 'email') IS DISTINCT FROM (v_old ->> 'email');
    v_pending := (coalesce(v_new ->> 'email_change', '') <> ''
                    AND (v_new ->> 'email_change') IS DISTINCT FROM (v_old ->> 'email_change'))
              OR coalesce(v_new ->> 'phone', '') IS DISTINCT FROM coalesce(v_old ->> 'phone', '')
              OR (coalesce(v_new ->> 'phone_change', '') <> ''
                    AND (v_new ->> 'phone_change') IS DISTINCT FROM (v_old ->> 'phone_change'));
    IF NOT v_email_moved AND NOT v_pending THEN
        RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'kid') THEN
        RETURN NEW;
    END IF;
    IF v_pending THEN
        RAISE EXCEPTION 'KID_EMAIL_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    SELECT username INTO v_handle FROM public.profiles WHERE user_id = NEW.id;
    IF v_handle IS NULL OR lower(v_new ->> 'email') IS DISTINCT FROM v_handle || '@kids.littlefounders.invalid' THEN
        RAISE EXCEPTION 'KID_EMAIL_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_kid_email() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS guard_kid_email ON auth.users;
CREATE TRIGGER guard_kid_email
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.guard_kid_email();
