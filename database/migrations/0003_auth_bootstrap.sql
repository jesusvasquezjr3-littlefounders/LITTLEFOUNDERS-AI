-- 0003_auth_bootstrap.sql — signup bootstrap, role-change auditing, scale indexes.
-- Delta over 0001 (never edit an applied migration). Idempotent.
-- No new tables here; RLS coverage lives with each table's own migration.

-- ─────────────────────────────────────────────────────────────
-- New-user bootstrap: every auth.users INSERT gets a profile row
-- and the 'universal' default role (/AGENTS.md §1.4 — low-friction
-- signup). This is what makes GoTrue signup → usable account work
-- without any backend round-trip.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''))
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'universal')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- updated_at maintenance (profiles, avatars)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
CREATE TRIGGER trg_profiles_touch
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_avatars_touch ON public.avatars;
CREATE TRIGGER trg_avatars_touch
    BEFORE UPDATE ON public.avatars
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Role-change auditing: every grant/revoke on user_roles lands in
-- append-only audit_logs (definer function owns the insert; RLS on
-- audit_logs stays closed to clients).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (
        COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
                 CASE WHEN TG_OP = 'DELETE' THEN OLD.granted_by ELSE NEW.granted_by END),
        'user_roles.' || lower(TG_OP),
        CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
        jsonb_build_object('role', CASE WHEN TG_OP = 'DELETE' THEN OLD.role ELSE NEW.role END)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_role_change
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- ─────────────────────────────────────────────────────────────
-- Scale indexes — every RLS helper and hot lookup path is indexed.
-- (guardian_links (parent, kid) is already covered by its UNIQUE
-- constraint — that's the is_verified_guardian_of() path.)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_family_members_user
    ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_kid_verified
    ON public.guardian_links (kid_user_id) WHERE verification_status = 'verified';
CREATE INDEX IF NOT EXISTS idx_guardian_links_kid
    ON public.guardian_links (kid_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
    ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON public.audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_family
    ON public.tasks (family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
    ON public.tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_lessons_course_position
    ON public.lessons (course_id, position);
