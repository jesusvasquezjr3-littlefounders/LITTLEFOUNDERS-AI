-- tutor_revocation_cascade — gap-fix round 6, identity-site (A.5: the
-- 'revoked' status needs a real trigger path, and a revocation found to be
-- fraudulent must actually end the verification; Appendix M Part 2.1
-- criterion 2: the verification-status distinction holds through every path,
-- UI and direct API; Appendix M 1.4: the revocation status has a consumer;
-- A.1 FAQ 'cancelTutor': a child is paused until an active Tutor supervises it).
-- @phase: contract
-- @after-release: none required — every Core release already reads roles and verified guardian links from the database on each request, so it simply stops seeing the revoked adult's powers. The classifier flags the DELETE statements (the revoked adult's parent role and unaccepted invites, inside end_revoked_tutor_powers and its one-time backfill for adults whose latest verification is already 'revoked'); apply it by hand like every contract migration, before or with the Core release of gap-fix round 6 identity-site (that release maps PARENT_ROLE_REVOKED to 409 PARENT_VERIFICATION_REVOKED; an older Core answers the same refusal as 409 ROLE_REJECTED).
--
-- Before this migration revoke_parent_verification (0193) wrote only the
-- 'revoked' parent_verifications row and its audit row. The adult kept the
-- parent role and every verified guardian link, and every Core surface that
-- checks only requireRole(['parent']) plus a verified link (tasks, banking,
-- family governance, the child's Mentor transcripts and memory notes) still
-- served them. Their children stayed linked 'verified', so the A.1 pause
-- never reached a child whose only Tutor was revoked.
--
-- 1. tutor_verification_revoked(user): the latest parent_verifications row
--    (latest-row-wins, as Core's readAdultVerificationStatus) is 'revoked'.
-- 2. end_revoked_tutor_powers(user, actor), internal: in one transaction it
--    revokes every verified guardian link of the adult (revoked_by = the
--    staff actor, so family_state_audit names who decided), withdraws the
--    invites the adult issued that nobody accepted yet, and removes the
--    parent role (the user_roles audit row names the staff actor through
--    lf.actor). The 0150 status trigger then pauses (and, for a kid-role
--    account, bans) every child left with no verified guardian: the A.1
--    cascade, unchanged.
-- 3. revoke_parent_verification: 0193's checks and rows, then (2), and the
--    audit row carries what was ended (links, invites, role, children paused).
-- 4. A revoked adult cannot come back through another door:
--    - guard_guardian_link_state (0156's body) refuses a new or reopened link
--      (pending or verified) for an adult whose latest verification is
--      revoked (GUARDIAN_LINK_TUTOR_REVOKED), and accepts the staff
--      revocation transition only under the marker (2) sets;
--    - enforce_parent_role_provenance (0235's body) refuses the parent role on
--      every bound path, the staff grant included (PARENT_ROLE_REVOKED).
--    - guard_parent_verification_revoked refuses a new 'verified' row on a
--      bound path (PARENT_VERIFICATION_REVOKED; Core refuses first).
--      Reversing a mistaken revocation is an owner decision (lane record,
--      owner question); until then a database superuser is the only path.
-- 5. prevent_last_guardian_removal (0117's body) lets the staff revocation
--    end the last verified link of a kid-role child (the child is paused, not
--    left supervised by a revoked adult).
-- 6. Backfill: adults whose latest verification is already 'revoked' lose the
--    powers they kept, attributed to the staff member of their latest
--    revocation audit row.
--
-- Proven on native PostgreSQL by database/scripts/verify-tutor-revocation-postgres.py
-- (npm run identity:db-verify).

-- ── 1. The predicate ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tutor_verification_revoked(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL AND coalesce((
        SELECT v.status = 'revoked'
        FROM public.parent_verifications v
        WHERE v.user_id = p_user
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT 1), false);
$$;
REVOKE ALL ON FUNCTION public.tutor_verification_revoked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_verification_revoked(uuid) TO service_role;

-- ── 4a. The guardian-link state machine (0156's body + the revoked adult) ──
CREATE OR REPLACE FUNCTION public.guard_guardian_link_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_others  boolean;
    v_self_invited boolean;
    v_staff_revocation boolean;
BEGIN
    -- A.5: an adult whose verification was revoked never enters a link again.
    IF NEW.verification_status IN ('pending', 'verified')
       AND (TG_OP = 'INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status)
       AND public.tutor_verification_revoked(NEW.parent_user_id) THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_TUTOR_REVOKED' USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.verification_status NOT IN ('pending', 'verified')
           OR (NEW.verification_status = 'verified' AND NEW.verified_at IS NULL)
           OR (NEW.verification_status = 'pending' AND NEW.verified_at IS NOT NULL)
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[]
       OR public.family_only_nulled(v_changed, ARRAY['invite_id', 'decided_by', 'revoked_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'parent_user_id', 'kid_user_id', 'created_at'] THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    v_others := EXISTS (
        SELECT 1 FROM public.guardian_links
        WHERE kid_user_id = NEW.kid_user_id AND id <> NEW.id AND verification_status = 'verified'
    );
    v_self_invited := EXISTS (
        SELECT 1 FROM public.guardian_invites gi WHERE gi.id = NEW.invite_id AND gi.created_by = NEW.kid_user_id
    );
    -- Set only by end_revoked_tutor_powers, for the one adult it ends.
    v_staff_revocation := coalesce(current_setting('lf.tutor_revocation', true), '') = NEW.parent_user_id::text;

    IF OLD.verification_status = 'pending' AND NEW.verification_status IN ('verified', 'rejected')
       AND NEW.decided_by IS NOT NULL THEN
        IF NEW.decided_by = NEW.parent_user_id OR NEW.decided_at IS NULL
           OR (NEW.verification_status = 'verified' AND NEW.verified_at IS NULL)
           OR (NEW.verification_status = 'rejected' AND NEW.verified_at IS NOT NULL)
           OR (v_self_invited AND (NEW.decided_by <> NEW.kid_user_id OR NOT public.teen_wallet_holder(NEW.kid_user_id)))
           OR (NOT v_self_invited AND NOT public.family_is_verified_guardian(NEW.decided_by, NEW.kid_user_id)) THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_DECISION_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status = 'verified' AND NEW.verification_status = 'revoked' THEN
        -- The guardian stepping away names themself; a staff revocation of
        -- the adult's verification names the staff member (or no one, for
        -- the backfill of a revocation whose staff account is gone).
        IF NEW.revoked_at IS NULL
           OR (NOT v_staff_revocation AND NEW.revoked_by IS DISTINCT FROM NEW.parent_user_id) THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REVOCATION_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status IN ('pending', 'rejected', 'revoked') AND NEW.verification_status = 'pending' THEN
        IF NEW.invite_id IS NULL OR NEW.invite_id IS NOT DISTINCT FROM OLD.invite_id OR NEW.verified_at IS NOT NULL
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status IN ('pending', 'rejected', 'revoked') AND NEW.verification_status = 'verified' THEN
        IF v_others OR v_self_invited OR NEW.invite_id IS NULL OR NEW.invite_id IS NOT DISTINCT FROM OLD.invite_id OR NEW.verified_at IS NULL
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        RAISE EXCEPTION 'GUARDIAN_LINK_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.verification_status, NEW.verification_status);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_guardian_link_state() FROM PUBLIC, anon, authenticated, service_role;

-- ── 5. The last-guardian guard (0117's body + the staff revocation) ────────
CREATE OR REPLACE FUNCTION public.prevent_last_guardian_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_kid boolean;
    remaining_guardians integer;
BEGIN
    -- E.6: the account on either side of this link is being erased by a
    -- claimed request. Removing the link is the point; 0110's suspension
    -- trigger then pauses a child who lost their last Tutor (A.1).
    IF TG_OP = 'DELETE' AND public.account_erasure_in_progress(OLD.parent_user_id, OLD.kid_user_id) THEN
        RETURN OLD;
    END IF;
    -- A.5: staff revoked this adult's verification. The child must not stay
    -- supervised by them; the status trigger pauses a child left with none.
    IF TG_OP = 'UPDATE' AND NEW.verification_status = 'revoked'
       AND coalesce(current_setting('lf.tutor_revocation', true), '') = OLD.parent_user_id::text THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = OLD.kid_user_id AND role = 'kid'
    ) INTO is_kid;

    IF is_kid THEN
        SELECT COUNT(*) INTO remaining_guardians
        FROM public.guardian_links
        WHERE kid_user_id = OLD.kid_user_id
          AND id != OLD.id
          AND verification_status = 'verified';

        IF remaining_guardians = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last verified guardian from a kid account';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.verification_status != 'verified' AND is_kid THEN
        SELECT COUNT(*) INTO remaining_guardians
        FROM public.guardian_links
        WHERE kid_user_id = OLD.kid_user_id
          AND id != OLD.id
          AND verification_status = 'verified';

        IF remaining_guardians = 0 THEN
            RAISE EXCEPTION 'Cannot revoke the last verified guardian from a kid account';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- ── 4b. Parent-role provenance (0235's body + the revoked adult) ────────────
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
    -- A.5: a revoked verification is not cleared by any path, the staff grant included.
    IF public.tutor_verification_revoked(NEW.user_id) THEN
        RAISE EXCEPTION 'PARENT_ROLE_REVOKED: this adult''s verification was revoked by staff'
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

-- ── 4c. A new verification row never overrides a revocation ────────────────
-- Core already answers PARENT_VERIFICATION_REVOKED before writing; this is the
-- database's backstop for every bound path (a superuser session is not bound).
CREATE OR REPLACE FUNCTION public.guard_parent_verification_revoked()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.status = 'verified'
       AND current_user IN ('anon', 'authenticated', 'service_role', 'authenticator')
       AND public.tutor_verification_revoked(NEW.user_id) THEN
        RAISE EXCEPTION 'PARENT_VERIFICATION_REVOKED: a revoked verification is not cleared by a new check'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_parent_verification_revoked() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_guard_parent_verification_revoked ON public.parent_verifications;
CREATE TRIGGER trg_guard_parent_verification_revoked
    BEFORE INSERT ON public.parent_verifications
    FOR EACH ROW EXECUTE FUNCTION public.guard_parent_verification_revoked();

-- ── 2. Ending the powers, in one transaction ────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_revoked_tutor_powers(p_user uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kids uuid[];
    v_invites integer := 0;
    v_roles integer := 0;
    v_paused integer := 0;
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'TUTOR_REVOCATION_INVALID: user is required' USING ERRCODE = '22023';
    END IF;
    PERFORM set_config('lf.tutor_revocation', p_user::text, true);
    PERFORM set_config('lf.actor', coalesce(p_actor::text, ''), true);

    WITH ended AS (
        UPDATE public.guardian_links
        SET verification_status = 'revoked', revoked_by = p_actor, revoked_at = now()
        WHERE parent_user_id = p_user AND verification_status = 'verified'
        RETURNING kid_user_id
    )
    SELECT coalesce(array_agg(DISTINCT kid_user_id), '{}') INTO v_kids FROM ended;

    DELETE FROM public.guardian_invites WHERE created_by = p_user AND accepted_at IS NULL;
    GET DIAGNOSTICS v_invites = ROW_COUNT;

    DELETE FROM public.user_roles WHERE user_id = p_user AND role = 'parent';
    GET DIAGNOSTICS v_roles = ROW_COUNT;

    SELECT count(*) INTO v_paused
    FROM unnest(v_kids) AS k(kid)
    WHERE NOT EXISTS (SELECT 1 FROM public.guardian_links gl WHERE gl.kid_user_id = k.kid AND gl.verification_status = 'verified');

    PERFORM set_config('lf.tutor_revocation', '', true);
    PERFORM set_config('lf.actor', '', true);
    RETURN jsonb_build_object('linksRevoked', cardinality(v_kids), 'invitesWithdrawn', v_invites,
                              'parentRoleRemoved', v_roles = 1, 'childrenPaused', v_paused);
END;
$$;
REVOKE ALL ON FUNCTION public.end_revoked_tutor_powers(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ── 3. The staff revocation (0193's contract + the cascade) ────────────────
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
    v_ended jsonb;
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

    v_ended := public.end_revoked_tutor_powers(p_user, p_actor);

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.parent_verification.revoked', p_user::text,
            jsonb_build_object('reason', v_reason) || v_ended);

    RETURN 'revoked';
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_parent_verification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_parent_verification(uuid, uuid, text) TO service_role;

-- ── 6. Backfill: revocations that ended nothing ─────────────────────────────
DO $$
DECLARE
    r record;
    v_ended jsonb;
BEGIN
    FOR r IN
        SELECT u.user_id,
               (SELECT a.actor_id FROM public.audit_logs a
                WHERE a.action = 'admin.parent_verification.revoked' AND a.subject = u.user_id::text
                ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS actor
        FROM (SELECT DISTINCT user_id FROM public.parent_verifications) u
        WHERE public.tutor_verification_revoked(u.user_id)
          AND (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.user_id AND ur.role = 'parent')
               OR EXISTS (SELECT 1 FROM public.guardian_links gl WHERE gl.parent_user_id = u.user_id AND gl.verification_status = 'verified')
               OR EXISTS (SELECT 1 FROM public.guardian_invites gi WHERE gi.created_by = u.user_id AND gi.accepted_at IS NULL))
    LOOP
        v_ended := public.end_revoked_tutor_powers(r.user_id, r.actor);
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (r.actor, 'admin.parent_verification.powers_ended', r.user_id::text,
                jsonb_build_object('origin', 'migration-backfill') || v_ended);
    END LOOP;
END;
$$;

SELECT 'migration_tutor_revocation_cascade_ok' AS sentinel;
