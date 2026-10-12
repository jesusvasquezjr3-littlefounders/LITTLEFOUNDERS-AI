-- 0002_email.sql
-- What the emails need (docs/features/F-002-emails.md): the account's language as something the
-- person can change, whether they want the optional emails, and the mail service's delivery history.
--
-- The language is already on the profile (0001): it starts as the language the site was shown in
-- when the account was opened. Emails are written in it.

-- ---------------------------------------------------------------------------------------------
-- The profile
-- ---------------------------------------------------------------------------------------------

-- Optional emails (a welcome, news about the product). Emails that are part of using the account,
-- such as a sign-in code, do not look at this.
ALTER TABLE public.profiles ADD COLUMN product_emails boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------------------------
-- The delivery history of the mail service
-- ---------------------------------------------------------------------------------------------

-- One line per email: who it went to, which email it was and what became of it. Never the body, so
-- never a code. It holds addresses, which are personal data: how long a line is kept is an open
-- task (T-031), and a closed account loses the link to its lines (user_id is set to null).
CREATE TABLE public.email_logs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The Message-ID the mail system gave it: what an operator looks up in Amazon SES.
    message_id    text,
    to_address    text NOT NULL CHECK (char_length(to_address) <= 320),
    subject       text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 998),
    template_type text NOT NULL CHECK (char_length(template_type) <= 64),
    locale        text CHECK (char_length(locale) <= 10),
    user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    status        text NOT NULL CHECK (char_length(status) <= 32),
    detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_logs_created_at ON public.email_logs (created_at DESC);
CREATE INDEX email_logs_message_id ON public.email_logs (message_id);
CREATE INDEX email_logs_user_id ON public.email_logs (user_id) WHERE user_id IS NOT NULL;

-- Nobody but the mail service: row-level security with no policy, and only the privileges it uses
-- (it adds a line, reads the history for staff, and updates a line's status when the relay reports).
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.email_logs TO service_role;
GRANT UPDATE (status) ON TABLE public.email_logs TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Functions for the backend
-- ---------------------------------------------------------------------------------------------

-- The language the account's emails are written in and whether it takes the optional ones. Null
-- when the account does not exist.
CREATE FUNCTION public.core_mail_context(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'email', u.email,
        'locale', p.locale,
        'productEmails', p.product_emails
    )
    FROM auth.users AS u
    JOIN public.profiles AS p ON p.user_id = u.id
    WHERE u.id = p_user AND u.deleted_at IS NULL;
$$;

-- The person changed the language of the site while signed in, or signed in with the site in
-- another language: that is their language from now on.
CREATE FUNCTION public.core_set_locale(p_user uuid, p_locale text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF p_locale IS NULL OR p_locale NOT IN ('en-US', 'es-MX', 'pt-BR') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'BAD_REQUEST');
    END IF;

    UPDATE public.profiles AS p SET locale = p_locale WHERE p.user_id = p_user AND p.locale IS DISTINCT FROM p_locale;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Unsubscribing and subscribing again. The answer is the same whether or not the account exists,
-- so a link somebody made up learns nothing.
CREATE FUNCTION public.core_set_product_emails(p_user uuid, p_wanted boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF p_wanted IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'BAD_REQUEST');
    END IF;

    UPDATE public.profiles AS p SET product_emails = p_wanted WHERE p.user_id = p_user AND p.product_emails IS DISTINCT FROM p_wanted;

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION
    public.core_mail_context(uuid),
    public.core_set_locale(uuid, text),
    public.core_set_product_emails(uuid, boolean)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
    public.core_mail_context(uuid),
    public.core_set_locale(uuid, text),
    public.core_set_product_emails(uuid, boolean)
TO service_role;
