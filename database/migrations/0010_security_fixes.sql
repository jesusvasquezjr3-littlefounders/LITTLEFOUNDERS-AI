-- 0010_security_fixes.sql — Security Hardening & Invariant Protection
-- Implements protections for child safety invariants and prevents dangerous cascades

-- 1. Kid Orphan Protection: Ensure a 'kid' role cannot be created/updated without a verified guardian
CREATE OR REPLACE FUNCTION public.enforce_kid_has_guardian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role = 'kid' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.guardian_links 
            WHERE kid_user_id = NEW.user_id 
              AND verification_status = 'verified'
        ) THEN
            RAISE EXCEPTION 'A kid account MUST have at least 1 verified guardian link';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kid_has_guardian ON public.user_roles;
CREATE TRIGGER trg_enforce_kid_has_guardian
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_kid_has_guardian();

-- 2. Prevent removal of the LAST verified guardian for a kid
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
    -- Check if the kid still has the 'kid' role
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = OLD.kid_user_id AND role = 'kid'
    ) INTO is_kid;
    
    IF is_kid THEN
        -- Check how many OTHER verified guardians remain
        SELECT COUNT(*) INTO remaining_guardians
        FROM public.guardian_links
        WHERE kid_user_id = OLD.kid_user_id
          AND id != OLD.id
          AND verification_status = 'verified';
          
        IF remaining_guardians = 0 THEN
            RAISE EXCEPTION 'Cannot remove the last verified guardian from a kid account';
        END IF;
    END IF;
    
    -- If it's an UPDATE, allow it only if the new status is still 'verified'
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

DROP TRIGGER IF EXISTS trg_prevent_last_guardian_removal ON public.guardian_links;
CREATE TRIGGER trg_prevent_last_guardian_removal
    BEFORE DELETE OR UPDATE ON public.guardian_links
    FOR EACH ROW EXECUTE FUNCTION public.prevent_last_guardian_removal();

-- 3. Block auth.users cascading deletes if it orphans a kid
-- We hook into public.user_roles BEFORE DELETE as a proxy for the cascading delete from auth.users
CREATE OR REPLACE FUNCTION public.prevent_parent_cascade_orphan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    kid_record RECORD;
    remaining_guardians integer;
BEGIN
    -- For every kid this user is a verified guardian of...
    FOR kid_record IN 
        SELECT kid_user_id FROM public.guardian_links 
        WHERE parent_user_id = OLD.user_id AND verification_status = 'verified'
    LOOP
        -- If this kid still has the 'kid' role...
        IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = kid_record.kid_user_id AND role = 'kid') THEN
            -- Check if they have OTHER verified guardians
            SELECT COUNT(*) INTO remaining_guardians
            FROM public.guardian_links
            WHERE kid_user_id = kid_record.kid_user_id
              AND parent_user_id != OLD.user_id
              AND verification_status = 'verified';
              
            IF remaining_guardians = 0 THEN
                RAISE EXCEPTION 'Cannot delete this user because it would orphan a kid account (ID: %)', kid_record.kid_user_id;
            END IF;
        END IF;
    END LOOP;
    
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_parent_cascade_orphan ON public.user_roles;
CREATE TRIGGER trg_prevent_parent_cascade_orphan
    BEFORE DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_parent_cascade_orphan();

-- 4. Restrict admin escalation
CREATE OR REPLACE FUNCTION public.enforce_admin_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    granter_role text;
BEGIN
    IF NEW.role = 'admin' THEN
        IF NEW.granted_by IS NULL THEN
            RAISE EXCEPTION 'An admin role must have a granted_by actor';
        END IF;
        
        -- The granter MUST be a superadmin
        SELECT role INTO granter_role FROM public.user_roles WHERE user_id = NEW.granted_by AND role = 'superadmin';
        
        IF granter_role IS NULL THEN
            RAISE EXCEPTION 'Only a superadmin can grant the admin role';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_grant ON public.user_roles;
CREATE TRIGGER trg_enforce_admin_grant
    BEFORE INSERT OR UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_grant();

-- Add intentionality comments to missing policies identified in audit
COMMENT ON TABLE public.tasks IS '-- DELIBERATE: no client write policies (service-role only via backend)';
COMMENT ON TABLE public.profiles IS '-- DELIBERATE: no DELETE policy — account deletion flows through auth.users CASCADE';
