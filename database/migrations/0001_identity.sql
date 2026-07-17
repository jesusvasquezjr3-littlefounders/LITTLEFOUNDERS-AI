-- 0001_identity.sql — Identity domain (LOCKED by /AGENTS.md §1.3)
-- profiles, user_roles, families, family_members, guardian_links, audit_logs.
-- Idempotent. RLS enabled on every table in this migration.

-- ─────────────────────────────────────────────────────────────
-- profiles — 1:1 with auth.users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name text NOT NULL DEFAULT '',
    locale       text NOT NULL DEFAULT 'en-US' CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    theme        text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- user_roles — exactly six roles; superadmin only @littlefounders.ai
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role       text NOT NULL CHECK (role IN ('universal', 'parent', 'kid', 'bigfounder', 'admin', 'superadmin')),
    granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
);

CREATE OR REPLACE FUNCTION public.enforce_superadmin_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email text;
BEGIN
    IF NEW.role = 'superadmin' THEN
        SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
        IF user_email IS NULL OR user_email NOT LIKE '%@littlefounders.ai' THEN
            RAISE EXCEPTION 'superadmin is only grantable to @littlefounders.ai emails';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_superadmin_domain ON public.user_roles;
CREATE TRIGGER trg_superadmin_domain
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_superadmin_domain();

-- ─────────────────────────────────────────────────────────────
-- families — membership via family_members (multiple parents by design)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.families (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL DEFAULT '',
    created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_members (
    family_id   uuid NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    member_role text NOT NULL CHECK (member_role IN ('parent', 'kid')),
    joined_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (family_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- guardian_links — verified parent↔kid relation (via Guardian service)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guardian_links (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kid_user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'revoked')),
    verified_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT guardian_link_not_self CHECK (parent_user_id <> kid_user_id),
    CONSTRAINT guardian_link_unique UNIQUE (parent_user_id, kid_user_id)
);

-- ─────────────────────────────────────────────────────────────
-- audit_logs — append-only (no UPDATE/DELETE policies exist)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    action     text NOT NULL,
    subject    text NOT NULL DEFAULT '',
    detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs     ENABLE ROW LEVEL SECURITY;

-- helper: is the current user a verified guardian of `kid`?
CREATE OR REPLACE FUNCTION public.is_verified_guardian_of(kid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.parent_user_id = auth.uid()
          AND gl.kid_user_id = kid
          AND gl.verification_status = 'verified'
    );
$$;

-- profiles: self read/write; verified guardians read their kids
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- user_roles: self read; writes only via service role (no policy = denied)
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- families / family_members: members read their family
DROP POLICY IF EXISTS families_select_member ON public.families;
CREATE POLICY families_select_member ON public.families
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = id AND fm.user_id = auth.uid()
    ));
DROP POLICY IF EXISTS family_members_select_member ON public.family_members;
CREATE POLICY family_members_select_member ON public.family_members
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = family_members.family_id AND fm.user_id = auth.uid()
    ));

-- guardian_links: both sides read; status changes only via service role
DROP POLICY IF EXISTS guardian_links_select_party ON public.guardian_links;
CREATE POLICY guardian_links_select_party ON public.guardian_links
    FOR SELECT USING (parent_user_id = auth.uid() OR kid_user_id = auth.uid());

-- audit_logs: append-only — INSERT via service role only; SELECT self-actions
DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs
    FOR SELECT USING (actor_id = auth.uid());
-- Deliberately NO update/delete policies on audit_logs (append-only invariant).
