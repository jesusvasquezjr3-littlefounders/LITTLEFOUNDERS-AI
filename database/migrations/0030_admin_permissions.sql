-- ─────────────────────────────────────────────────────────────
-- admin_permissions — granular access control for admin roles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_permissions (
    user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    permission text NOT NULL CHECK (permission IN ('manage_users', 'manage_content', 'view_analytics', 'manage_support')),
    granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, permission)
);

-- RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Select policy: A user can see their own permissions, and superadmins can see all.
-- Wait, actually service role handles all of this via the backend (`backend/src/routes/admin.ts`).
-- The rule for user_roles is "self read; writes only via service role (no policy = denied)".
-- I will match that exact pattern.

CREATE POLICY admin_permissions_select_own ON public.admin_permissions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Writes are done via service role (backend). No insert/update/delete policies needed for authenticated.

-- ─────────────────────────────────────────────────────────────
-- Audit-log trigger for admin permissions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_admin_permission_change()
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
        'admin_permissions.' || lower(TG_OP),
        CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
        jsonb_build_object('permission', CASE WHEN TG_OP = 'DELETE' THEN OLD.permission ELSE NEW.permission END)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admin_permission_change ON public.admin_permissions;
CREATE TRIGGER trg_audit_admin_permission_change
    AFTER INSERT OR UPDATE OR DELETE ON public.admin_permissions
    FOR EACH ROW EXECUTE FUNCTION public.audit_admin_permission_change();
