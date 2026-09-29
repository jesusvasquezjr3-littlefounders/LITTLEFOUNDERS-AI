-- staff_parent_grant_age_guard — gap-fix round 4, F4-staff-ops item 1
-- (A.5 "verification must mean one thing, always"; OD-3 section 2: every
-- minor safeguard follows age, not role; Appendix M 1.2 and Part 3 Stage 3).
-- @phase: expand
--
-- identity_enforcement (guard_parent_verification_age) stopped a verified ID
-- check for an account whose age record is a minor's, but the STAFF path to
-- the parent role never read the age record: grant_parent_role_with_justification
-- (parent_grant_integrity) checked only the reason and the actor, and
-- enforce_parent_role_provenance passed any row carrying the staff marker and
-- any re-grant with a justification already on record. A superadmin could
-- therefore create exactly the minor-record Tutors that list_minor_record_tutors
-- and the tutor_adult_age_record release gate exist to find.
--
-- 1. account_age_record_is_minor(user): the ONE predicate, the same as
--    guard_parent_verification_age and list_minor_record_tutors: the account
--    holds the kid role, has an under-13 origin (account_safety_origins), or
--    its effective declared band is under 13 or 13 to 17 (so a teen made 18
--    by birth month is an adult). SECURITY DEFINER, service role only.
-- 2. grant_parent_role_with_justification raises PARENT_GRANT_MINOR_RECORD
--    before any write when the target's age record is a minor's: no role, no
--    audit row. Everything else is parent_grant_integrity's body.
-- 3. enforce_parent_role_provenance refuses a new parent role for a
--    minor-record account on the staff-marker branch, the ID-verified branch
--    and the re-grant branch alike. A database superuser session without the
--    marker (migrations, seeds, an operator at psql) still bypasses, as
--    before: it can bypass any trigger anyway.
--
-- A row that already exists is untouched (the UPDATE of an existing parent
-- row returns early, as before): the pre-guard Tutors stay listed by
-- list_minor_record_tutors for E.4 staff review, never demoted silently.
--
-- Core maps PARENT_GRANT_MINOR_RECORD to 409 AGE_RECORD_MINOR. Proven on
-- native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

CREATE OR REPLACE FUNCTION public.account_age_record_is_minor(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.user_roles k WHERE k.user_id = p_user AND k.role = 'kid')
        OR EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = p_user)
        OR coalesce(public.effective_age_band(p_user), '') IN ('under_13', '13_to_17'));
$$;
REVOKE ALL ON FUNCTION public.account_age_record_is_minor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_age_record_is_minor(uuid) TO service_role;

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
    IF public.account_age_record_is_minor(p_user) THEN
        RAISE EXCEPTION 'PARENT_GRANT_MINOR_RECORD: the account''s age record is a minor''s; correct it through the age review first'
            USING ERRCODE = '42501';
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
    v_staff boolean;
BEGIN
    IF NEW.role <> 'parent' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.role = 'parent' AND OLD.user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;
    v_staff := coalesce(current_setting('lf.parent_grant', true), '') = NEW.user_id::text;
    -- A superuser session without the staff marker can bypass any trigger;
    -- only API roles (and the audited function's marker) are bound.
    IF NOT v_staff AND current_user NOT IN ('anon', 'authenticated', 'service_role', 'authenticator') THEN
        RETURN NEW;
    END IF;
    -- OD-3 section 2: the age record outranks every path to the role.
    IF public.account_age_record_is_minor(NEW.user_id) THEN
        RAISE EXCEPTION 'PARENT_GRANT_MINOR_RECORD: the account''s age record is a minor''s; correct it through the age review first'
            USING ERRCODE = '42501';
    END IF;
    -- The staff path: the audited function marks the one account it grants.
    IF v_staff THEN
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
    RAISE EXCEPTION 'PARENT_ROLE_UNJUSTIFIED: a parent role needs an ID verification or an audited staff justification'
        USING ERRCODE = '42501';
END;
$$;
