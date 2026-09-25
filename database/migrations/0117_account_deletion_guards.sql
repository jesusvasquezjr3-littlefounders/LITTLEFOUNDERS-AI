-- account_deletion_guards — Product 10 E.6, sections 3 and 4 of the
-- account-deletion change (sections 1 and 2 are 0116_account_deletion_requests).
-- Split from that file at merge because one migration may not exceed the
-- 23,000 bytes railway-migrate.sh can pass as a single Windows argument.
-- @phase: expand
--
-- 3. Provenance columns that blocked every parent deletion let go of a deleted
--    account instead of refusing it: each NO ACTION/RESTRICT foreign key to
--    auth.users on a column that records WHO acted becomes nullable with
--    ON DELETE SET NULL. The child's record stays; the departed adult's
--    identity leaves it.
--
-- 4. The 0010 guard triggers learn about an erasure in progress: while Core
--    holds a claimed ('processing') account_deletion_requests row for either
--    side of a guardian link, removing the last verified link or the parent
--    role is allowed, so 0110's A.1 cascade can suspend the child. The kid-role
--    and admin-grant guards accept only a provenance cascade (granted_by set to
--    NULL), and the lesson-version immutability guard accepts only created_by
--    being cleared.
--
-- ORDERING. Apply after 0116 (the guards read account_deletion_requests).
-- Safe before or after the code: the relaxed columns only accept NULL, which
-- nothing writes until an erasure runs, and the guards change behaviour only
-- while a request is 'processing', which only the new Core creates.


-- ── provenance columns let go of a deleted account ─────────────────────────
ALTER TABLE public.tutor_voice_consent
    ALTER COLUMN granted_by DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS tutor_voice_consent_granted_by_fkey,
    ADD CONSTRAINT tutor_voice_consent_granted_by_fkey
        FOREIGN KEY (granted_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.wallet_ledger
    ALTER COLUMN created_by DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS wallet_ledger_created_by_fkey,
    ADD CONSTRAINT wallet_ledger_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.redemptions
    DROP CONSTRAINT IF EXISTS redemptions_decided_by_fkey,
    ADD CONSTRAINT redemptions_decided_by_fkey
        FOREIGN KEY (decided_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.banking_accounts
    ALTER COLUMN opened_by DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS banking_accounts_opened_by_fkey,
    ADD CONSTRAINT banking_accounts_opened_by_fkey
        FOREIGN KEY (opened_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.banking_accounts
    DROP CONSTRAINT IF EXISTS banking_accounts_frozen_by_fkey,
    ADD CONSTRAINT banking_accounts_frozen_by_fkey
        FOREIGN KEY (frozen_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.allowance_rules
    ALTER COLUMN parent_user_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS allowance_rules_parent_user_id_fkey,
    ADD CONSTRAINT allowance_rules_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.savings_bonus_rules
    ALTER COLUMN parent_user_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS savings_bonus_rules_parent_user_id_fkey,
    ADD CONSTRAINT savings_bonus_rules_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.spend_limits
    ALTER COLUMN parent_user_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS spend_limits_parent_user_id_fkey,
    ADD CONSTRAINT spend_limits_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

-- ── the 0010 guards learn about an erasure in progress ─────────────────────
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
    -- E.6: an erasure in progress removes this account's links itself
    -- before its roles, so any child it supervised alone is suspended (A.1)
    -- rather than the deletion being refused forever.
    IF public.account_erasure_in_progress(OLD.user_id, OLD.user_id) THEN
        RETURN OLD;
    END IF;

    FOR kid_record IN
        SELECT kid_user_id FROM public.guardian_links
        WHERE parent_user_id = OLD.user_id AND verification_status = 'verified'
    LOOP
        IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = kid_record.kid_user_id AND role = 'kid') THEN
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

CREATE OR REPLACE FUNCTION public.enforce_kid_has_guardian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- The ON DELETE SET NULL of granted_by (the granting adult was erased)
    -- grants nothing: same account, same role, only the provenance cleared.
    IF TG_OP = 'UPDATE' AND NEW.user_id = OLD.user_id AND NEW.role = OLD.role
       AND OLD.granted_by IS NOT NULL AND NEW.granted_by IS NULL THEN
        RETURN NEW;
    END IF;
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

CREATE OR REPLACE FUNCTION public.enforce_admin_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    granter_role text;
BEGIN
    -- Same provenance-only update as above: the granting superadmin's
    -- account was erased; the grant itself is unchanged.
    IF TG_OP = 'UPDATE' AND NEW.user_id = OLD.user_id AND NEW.role = OLD.role
       AND OLD.granted_by IS NOT NULL AND NEW.granted_by IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.role = 'admin' THEN
        IF NEW.granted_by IS NULL THEN
            RAISE EXCEPTION 'An admin role must have a granted_by actor';
        END IF;

        SELECT role INTO granter_role FROM public.user_roles WHERE user_id = NEW.granted_by AND role = 'superadmin';

        IF granter_role IS NULL THEN
            RAISE EXCEPTION 'Only a superadmin can grant the admin role';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_lesson_document_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- The only permitted change: the author's account was erased and its
    -- id leaves the version (ON DELETE SET NULL). Content never changes.
    IF TG_OP = 'UPDATE' AND OLD.created_by IS NOT NULL AND NEW.created_by IS NULL
       AND (to_jsonb(NEW) - 'created_by') = (to_jsonb(OLD) - 'created_by') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'lesson document versions are immutable';
END;
$$;

SELECT 'migration_account_deletion_guards_ok' AS sentinel;
