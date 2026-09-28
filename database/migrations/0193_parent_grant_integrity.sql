-- parent_grant_integrity — A.5 and Appendix M 1.2 (Staff-Grant Justification
-- Completeness, target 100%): a staff grant of the parent role and a staff
-- revocation of a parent verification each commit TOGETHER with their
-- audited reason, or not at all.
-- @phase: contract
-- @after-release: the Core release carrying gap-fix F1-staff-ops (POST /admin/roles/grant for the parent role calls grant_parent_role_with_justification, and POST /admin/users/:id/verification/revoke calls revoke_parent_verification); an older Core inserts the staff parent grant directly and would now be refused
--
-- Before this migration Core committed the role (PostgREST insert) and then
-- wrote the justification as a SEPARATE audit row whose failure it ignored,
-- so a grant could land with no reason on record. The revocation wrote its
-- audit row first and its row second, with the same blind spot.
--
-- 1. grant_parent_role_with_justification(user, actor, justification): one
--    transaction inserts the user_roles row and the audit_logs row
--    'admin.parent_role_justification' carrying the reason. A reason under
--    10 or over 200 characters (after trimming) is refused, as is an actor
--    who is not a superadmin (Core's superadminOnly, enforced again here).
-- 2. enforce_parent_role_provenance: a BEFORE INSERT OR UPDATE trigger on
--    user_roles. A new parent role is accepted only when it comes through the
--    function above, when the account's LATEST parent verification is an
--    ID check (status verified, method local-ocr: Core's /verification path
--    writes that row before the role), or when a justification row for the
--    account already exists. Every API role (anon, authenticated,
--    service_role, authenticator) is bound; a database superuser session
--    (migrations, dev seeds, the native verifiers, an operator at psql) can
--    bypass any trigger anyway, so it is not pretended otherwise.
-- 3. revoke_parent_verification(user, actor, reason): one transaction writes
--    the revoked row (method staff-revoked) and the audit row
--    'admin.parent_verification.revoked' with the reason (10-300 characters).
--    The actor must hold the admin or superadmin role.
--
-- Proven on native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

CREATE OR REPLACE FUNCTION public.grant_parent_role_with_justification(
    p_user uuid,
    p_actor uuid,
    p_justification text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reason text := btrim(coalesce(p_justification, ''));
    v_inserted integer := 0;
BEGIN
    IF p_user IS NULL OR p_actor IS NULL THEN
        RAISE EXCEPTION 'PARENT_GRANT_INVALID: user and actor are required' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_reason) < 10 OR char_length(v_reason) > 200 THEN
        RAISE EXCEPTION 'PARENT_GRANT_JUSTIFICATION_REQUIRED: a justification of 10-200 characters is required'
            USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'superadmin') THEN
        RAISE EXCEPTION 'PARENT_GRANT_FORBIDDEN: only a superadmin grants the parent role' USING ERRCODE = '42501';
    END IF;

    PERFORM set_config('lf.parent_grant', p_user::text, true);
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (p_user, 'parent', p_actor)
    ON CONFLICT (user_id, role) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    PERFORM set_config('lf.parent_grant', '', true);

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.parent_role_justification', p_user::text,
            jsonb_build_object('justification', v_reason, 'method', 'staff-granted', 'newlyGranted', v_inserted = 1));

    RETURN CASE WHEN v_inserted = 1 THEN 'granted' ELSE 'already_granted' END;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_parent_role_with_justification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_parent_role_with_justification(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_parent_role_provenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_latest record;
BEGIN
    IF NEW.role <> 'parent' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.role = 'parent' AND OLD.user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;
    -- The staff path: the audited function marks the one account it grants.
    IF coalesce(current_setting('lf.parent_grant', true), '') = NEW.user_id::text THEN
        RETURN NEW;
    END IF;
    -- The ID-verified path: the latest verification is a verified ID check.
    SELECT status, method INTO v_latest
    FROM public.parent_verifications
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    IF FOUND AND v_latest.status = 'verified' AND v_latest.method = 'local-ocr' THEN
        RETURN NEW;
    END IF;
    -- A re-grant of an account whose staff justification is already on record.
    IF EXISTS (
        SELECT 1 FROM public.audit_logs a
        WHERE a.action = 'admin.parent_role_justification'
          AND a.subject = NEW.user_id::text
          AND char_length(btrim(coalesce(a.detail ->> 'justification', ''))) >= 10
    ) THEN
        RETURN NEW;
    END IF;
    -- A superuser session can bypass any trigger; only API roles are bound.
    IF current_user NOT IN ('anon', 'authenticated', 'service_role', 'authenticator') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'PARENT_ROLE_UNJUSTIFIED: a parent role needs an ID verification or an audited staff justification'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_parent_role_provenance ON public.user_roles;
CREATE TRIGGER trg_enforce_parent_role_provenance
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_role_provenance();

CREATE OR REPLACE FUNCTION public.revoke_parent_verification(
    p_user uuid,
    p_actor uuid,
    p_reason text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
    IF p_user IS NULL OR p_actor IS NULL THEN
        RAISE EXCEPTION 'PARENT_REVOKE_INVALID: user and actor are required' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_reason) < 10 OR char_length(v_reason) > 300 THEN
        RAISE EXCEPTION 'PARENT_REVOKE_REASON_REQUIRED: a reason of 10-300 characters is required' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role IN ('admin', 'superadmin')) THEN
        RAISE EXCEPTION 'PARENT_REVOKE_FORBIDDEN: only staff revoke a verification' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
        RETURN 'not_found';
    END IF;

    INSERT INTO public.parent_verifications (user_id, status, method, checks)
    VALUES (p_user, 'revoked', 'staff-revoked', '{}'::jsonb);

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.parent_verification.revoked', p_user::text, jsonb_build_object('reason', v_reason));

    RETURN 'revoked';
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_parent_verification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_parent_verification(uuid, uuid, text) TO service_role;

SELECT 'migration_parent_grant_integrity_ok' AS sentinel;
