-- 0242_staff_grant_revocation.sql — GAP-FIX-R5 staff-ops: a staff role or
-- permission revocation is audited under the superadmin who made it, and an
-- elevated revocation enters the access-review log.
-- @phase: expand
--
-- Product G.1 (permissions "stored, displayed, and audited"), Law 5 ("know,
-- precisely, who can see what internally"), G.4 and Appendix N 1.1
-- (Access-Review Cadence Compliance and Stale-Grant Rate, from the
-- access-review log).
--
-- Before this migration Roles & Access revoked through a service-role DELETE.
-- The only audit row came from audit_role_change (0003) and
-- audit_admin_permission_change (0030), which set actor_id =
-- COALESCE(request.jwt.claim.sub, OLD.granted_by on DELETE). The service key
-- carries no sub, so every revocation was recorded as done by whoever had
-- GRANTED the access; and no revocation ever wrote a staff_access_reviews row
-- (the console recorded only 'kept').
--
-- 1. The two audit triggers take the actor from the session (jwt sub), then
--    from the transaction-local setting lf.actor (set only by the function
--    below), then, for an INSERT or UPDATE, from granted_by. A DELETE with no
--    actor records NULL (a system action, e.g. an account erasure), never the
--    original granter. A DELETE also records who had granted it (grantedBy).
-- 2. revoke_staff_grant(p_actor, p_subject, p_kind, p_grant), service role
--    only: a superadmin actor (ACCESS_REVOKE_FORBIDDEN otherwise), never the
--    actor's own superadmin role (ACCESS_REVOKE_SELF). It deletes the role or
--    the permission with lf.actor = p_actor, so the trigger's
--    'user_roles.delete' / 'admin_permissions.delete' row names the revoking
--    superadmin; for an elevated grant (admin, superadmin, or one of the four
--    staff permissions) it records the review decision 'revoked' through
--    record_staff_access_review (0195: the review row and
--    'admin.access.reviewed'), all in one transaction. Returns 'revoked' or
--    'not_held'. The existing role triggers (superadmin domain, kid guardian,
--    parent cascade, admin grant) still apply and still refuse.
--
-- Additive: an older Core that still DELETEs directly keeps working (its
-- revocations are now recorded with a NULL actor instead of the granter's).
-- Proven on native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

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
                 NULLIF(current_setting('lf.actor', true), '')::uuid,
                 CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.granted_by END),
        'user_roles.' || lower(TG_OP),
        CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
        CASE WHEN TG_OP = 'DELETE'
             THEN jsonb_build_object('role', OLD.role, 'grantedBy', OLD.granted_by)
             ELSE jsonb_build_object('role', NEW.role) END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

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
                 NULLIF(current_setting('lf.actor', true), '')::uuid,
                 CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.granted_by END),
        'admin_permissions.' || lower(TG_OP),
        CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END,
        CASE WHEN TG_OP = 'DELETE'
             THEN jsonb_build_object('permission', OLD.permission, 'grantedBy', OLD.granted_by)
             ELSE jsonb_build_object('permission', NEW.permission) END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_staff_grant(
    p_actor   uuid,
    p_subject uuid,
    p_kind    text,
    p_grant   text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_removed integer := 0;
    v_elevated boolean;
BEGIN
    IF p_actor IS NULL OR p_subject IS NULL OR p_kind IS NULL OR nullif(btrim(coalesce(p_grant, '')), '') IS NULL THEN
        RAISE EXCEPTION 'ACCESS_REVOKE_INVALID: actor, subject, kind and grant are required' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'superadmin') THEN
        RAISE EXCEPTION 'ACCESS_REVOKE_FORBIDDEN: only a superadmin revokes a role or a staff permission' USING ERRCODE = '42501';
    END IF;
    IF p_kind = 'role' AND p_grant = 'superadmin' AND p_subject = p_actor THEN
        RAISE EXCEPTION 'ACCESS_REVOKE_SELF: a superadmin cannot revoke their own superadmin access' USING ERRCODE = '42501';
    END IF;

    -- The audit triggers read the revoking actor from here (transaction-local).
    PERFORM set_config('lf.actor', p_actor::text, true);
    IF p_kind = 'role' THEN
        DELETE FROM public.user_roles WHERE user_id = p_subject AND role = p_grant;
        GET DIAGNOSTICS v_removed = ROW_COUNT;
        v_elevated := p_grant IN ('admin', 'superadmin');
    ELSIF p_kind = 'permission' THEN
        DELETE FROM public.admin_permissions WHERE user_id = p_subject AND permission = p_grant;
        GET DIAGNOSTICS v_removed = ROW_COUNT;
        v_elevated := p_grant IN ('manage_users', 'manage_content', 'view_analytics', 'manage_support');
    ELSE
        RAISE EXCEPTION 'ACCESS_REVOKE_INVALID: kind is role or permission' USING ERRCODE = '22023';
    END IF;
    PERFORM set_config('lf.actor', '', true);

    IF v_removed = 0 THEN
        RETURN 'not_held';
    END IF;

    -- G.4 / Appendix N 1.1: an elevated revocation is a review decision.
    IF v_elevated THEN
        PERFORM public.record_staff_access_review(p_subject, p_kind, p_grant, p_actor, 'revoked', NULL);
    END IF;

    RETURN 'revoked';
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_staff_grant(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_grant(uuid, uuid, text, text) TO service_role;

SELECT 'migration_staff_grant_revocation_ok' AS sentinel;
