-- 0004_mail_least_privilege.sql
-- The mail service's delivery history, tightened (the security review of 2026-10-10):
--
--   1. The mail service gets a database role of its own that can touch the delivery history and
--      nothing else. Until now it used the service key, which runs every backend function for any
--      account. The service key no longer has any privilege on the history, and never leaves Core.
--   2. An account that is deleted takes its lines of the history with it: they hold its address.
--   3. A line is kept 90 days and then removed.

-- ---------------------------------------------------------------------------------------------
-- 1. A role for the mail service
-- ---------------------------------------------------------------------------------------------

-- No login: it is reached only through the REST interface, with a token that names it
-- (database/scripts/mint-role-key.mjs). It inherits nothing and owns nothing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'mail_service') THEN
        CREATE ROLE mail_service NOLOGIN NOINHERIT;
    END IF;
END
$$;

-- The REST interface connects as `authenticator` and switches to the role its token names.
GRANT mail_service TO authenticator;
GRANT USAGE ON SCHEMA public TO mail_service;

-- What it does and no more: add a line, read the history for staff, and change a line's status
-- when the relay reports. It cannot delete a line or change who an email went to.
REVOKE ALL ON TABLE public.email_logs FROM service_role;
GRANT SELECT, INSERT ON TABLE public.email_logs TO mail_service;
GRANT UPDATE (status) ON TABLE public.email_logs TO mail_service;

-- Row-level security stays on. The service key passed it by privilege; this role does not, so it
-- gets policies for exactly the three things above. No other role has a policy, so none sees a row.
CREATE POLICY email_logs_mail_select ON public.email_logs FOR SELECT TO mail_service USING (true);
CREATE POLICY email_logs_mail_insert ON public.email_logs FOR INSERT TO mail_service WITH CHECK (true);
CREATE POLICY email_logs_mail_update ON public.email_logs FOR UPDATE TO mail_service USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------------------------
-- 2. A deleted account's lines go with it
-- ---------------------------------------------------------------------------------------------

-- The lines were only unlinked (user_id set to null) and kept the address. Now they are removed,
-- when the account is deleted and when the authentication service marks it deleted.
CREATE FUNCTION public.forget_user_mail()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.email_logs AS l WHERE l.user_id = OLD.id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.forget_user_mail() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_forget_user_mail_on_delete
    BEFORE DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.forget_user_mail();

CREATE TRIGGER trg_forget_user_mail_on_soft_delete
    AFTER UPDATE OF deleted_at ON auth.users
    FOR EACH ROW
    WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION public.forget_user_mail();

-- ---------------------------------------------------------------------------------------------
-- 3. A line is kept 90 days
-- ---------------------------------------------------------------------------------------------

-- Long enough to answer "did my code arrive?" and to see a delivery problem build up; short enough
-- that the history is not a growing list of everybody's address. Returns how many lines went.
CREATE FUNCTION public.purge_email_logs(p_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_removed integer;
BEGIN
    IF p_days IS NULL OR p_days < 1 THEN
        RAISE EXCEPTION 'purge_email_logs: p_days must be at least 1';
    END IF;

    DELETE FROM public.email_logs AS l WHERE l.created_at < now() - make_interval(days => p_days);
    GET DIAGNOSTICS v_removed = ROW_COUNT;

    RETURN v_removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_email_logs(integer) FROM PUBLIC, anon, authenticated, service_role, mail_service;

-- Every night, by the database's own scheduler. Where the scheduler is not installed the function
-- still exists and the notice says so: run it from the operator's own scheduler then.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        PERFORM cron.schedule('purge-email-logs', '17 3 * * *', 'SELECT public.purge_email_logs(90)');
    ELSE
        RAISE NOTICE 'pg_cron is not available: schedule "SELECT public.purge_email_logs(90)" once a day by other means';
    END IF;
END
$$;
