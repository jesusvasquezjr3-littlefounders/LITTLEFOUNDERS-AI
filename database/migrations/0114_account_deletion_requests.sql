-- account_deletion_requests — Product 10 E.6: self-service account deletion
-- with a visible shape and timeline, and one erasure lifecycle shared by every
-- deletion path (self-service, a Tutor deleting a child, and A.1's 90-day
-- suspension purge).
-- @phase: expand
--
-- WHAT THIS ADDS.
--
-- 1. account_deletion_requests: one row per deletion, from request to
--    completion. subject_id deliberately has NO foreign key: the row must
--    outlive the account it describes, because "was this account deleted, when
--    and on whose request" is the audit answer E.6 owes. It holds the account
--    id and dates only — no email, no name, no content. depot_paths and
--    anon_ids are working lists the erasure fills and completion empties.
--    A partial unique index allows one open request per account.
--
-- 2. The request lifecycle as service-only functions, each writing its audit
--    row in the same transaction as the state change:
--      request_account_deletion   pending (self-service grace) or due now
--      cancel_account_deletion    the account holder keeps their account
--      claim_account_deletion     due -> processing, or held while an open
--                                 E.3 safety review names the account
--      record_account_deletion_step   one cross-service step's result
--      complete_account_deletion  refuses unless every step is recorded
--    The erasure itself (erase_account_data) is the next migration.
--
-- 3. Provenance columns that blocked every parent deletion now let go of a
--    deleted account instead of refusing it. Each was a NO ACTION or RESTRICT
--    foreign key to auth.users on a column that records WHO acted (who
--    created a ledger entry, who decided a redemption, who opened or froze an
--    account, who set a rule, who granted voice consent). A Tutor who had
--    used the Family Hub could therefore never be deleted at all. Each column
--    becomes nullable with ON DELETE SET NULL: the child's record stays, and
--    the departed adult's identity leaves it.
--
-- 4. The 0010 guard triggers learn about an erasure in progress. They refused
--    to remove a child's last verified guardian link and refused a parent's
--    role deletion that would orphan a child, so the A.1 cascade migration
--    0110 relies on (parent account deleted -> child suspended -> purged after
--    90 days) could not happen. While Core holds a claimed ('processing')
--    request for the account on either side of the link, the removal is
--    allowed and 0110's trigger suspends the child exactly as A.1 promises.
--    The kid-role and admin-grant guards also accept the one update a
--    provenance cascade makes (granted_by set to NULL, nothing else changed),
--    and the lesson-version immutability guard accepts only created_by being
--    cleared.
--
-- ORDERING. Safe before or after the code. Nothing that runs today reads the
-- new table; the relaxed columns only accept NULL, which nothing writes until
-- an erasure runs; and the guards change behaviour only while a request is
-- 'processing', which only the new Core creates.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id     uuid NOT NULL,
    population     text NOT NULL CHECK (population IN ('adult', 'parent', 'teen', 'unscreened', 'guest', 'child', 'kid')),
    initiated_by   text NOT NULL CHECK (initiated_by IN ('self', 'guardian', 'suspension_expiry')),
    status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'held', 'completed', 'cancelled')),
    requested_at   timestamptz NOT NULL DEFAULT now(),
    scheduled_for  timestamptz NOT NULL,
    started_at     timestamptz,
    attempts       integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    held_reason    text CHECK (held_reason IS NULL OR held_reason IN ('open_safety_review')),
    steps          jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(steps) = 'object'),
    depot_paths    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(depot_paths) = 'array'),
    anon_ids       jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(anon_ids) = 'array'),
    last_error     text CHECK (last_error IS NULL OR char_length(last_error) <= 200),
    cancelled_at   timestamptz,
    completed_at   timestamptz,
    CONSTRAINT account_deletion_schedule_order CHECK (scheduled_for >= requested_at),
    CONSTRAINT account_deletion_completed_marker CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
    CONSTRAINT account_deletion_cancelled_marker CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_one_open
    ON public.account_deletion_requests (subject_id)
    WHERE status IN ('pending', 'processing', 'held');
CREATE INDEX IF NOT EXISTS account_deletion_due_idx
    ON public.account_deletion_requests (status, scheduled_for);
CREATE INDEX IF NOT EXISTS account_deletion_requested_idx
    ON public.account_deletion_requests (requested_at);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
-- No browser policy. Core's service role reads; every write goes through the
-- functions below, which audit in the same transaction.
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.account_deletion_requests TO service_role;

-- True while Core holds a claimed erasure for either account. Only the
-- service-role erasure transaction runs while a request is 'processing'.
CREATE OR REPLACE FUNCTION public.account_erasure_in_progress(p_first uuid, p_second uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.account_deletion_requests
        WHERE status = 'processing' AND subject_id IN (p_first, p_second)
    );
$$;
REVOKE ALL ON FUNCTION public.account_erasure_in_progress(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ── request ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_account_deletion(
    p_subject uuid,
    p_population text,
    p_initiated_by text,
    p_grace_days integer,
    p_actor uuid
)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE created public.account_deletion_requests%ROWTYPE;
BEGIN
    IF p_subject IS NULL OR p_grace_days IS NULL OR p_grace_days < 0 OR p_grace_days > 30 THEN
        RAISE EXCEPTION 'INVALID_DELETION_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_subject) THEN
        RAISE EXCEPTION 'NO_SUCH_ACCOUNT' USING ERRCODE = 'P0001';
    END IF;
    -- Staff accounts are removed by a superadmin after their grants are
    -- revoked, never by this flow (Core refuses first; this is the floor).
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject AND role IN ('admin', 'superadmin')) THEN
        RAISE EXCEPTION 'STAFF_ACCOUNT' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
        INSERT INTO public.account_deletion_requests (subject_id, population, initiated_by, scheduled_for)
            VALUES (p_subject, p_population, p_initiated_by, now() + make_interval(days => p_grace_days))
            RETURNING * INTO created;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'DELETION_ALREADY_OPEN' USING ERRCODE = 'P0001';
    END;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (p_actor, 'account.deletion_requested', p_subject::text, jsonb_build_object(
            'request_id', created.id, 'population', created.population,
            'initiated_by', created.initiated_by, 'scheduled_for', created.scheduled_for));
    RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.request_account_deletion(uuid, text, text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(uuid, text, text, integer, uuid) TO service_role;

-- ── cancel (the account holder keeps the account) ─────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_account_deletion(p_subject uuid)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cancelled public.account_deletion_requests%ROWTYPE;
BEGIN
    UPDATE public.account_deletion_requests
        SET status = 'cancelled', cancelled_at = now(), held_reason = NULL
        WHERE subject_id = p_subject AND status IN ('pending', 'held') AND initiated_by = 'self'
        RETURNING * INTO cancelled;
    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE subject_id = p_subject AND status = 'processing') THEN
            RAISE EXCEPTION 'DELETION_IN_PROGRESS' USING ERRCODE = 'P0001';
        END IF;
        RAISE EXCEPTION 'NO_OPEN_DELETION' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (p_subject, 'account.deletion_cancelled', p_subject::text,
            jsonb_build_object('request_id', cancelled.id, 'requested_at', cancelled.requested_at));
    RETURN cancelled;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion(uuid) TO service_role;

-- ── claim ──────────────────────────────────────────────────────────────────
-- Returns NULL when there is nothing to do right now: not due, cancelled or
-- completed, or another worker claimed it within the last ten minutes. A
-- claim older than that is a crashed run and is taken over. An open E.3
-- safety review naming the account holds the erasure (reports and review
-- evidence cascade away with the account) until staff resolve the case.
CREATE OR REPLACE FUNCTION public.claim_account_deletion(p_request uuid)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_row public.account_deletion_requests%ROWTYPE;
BEGIN
    SELECT * INTO current_row FROM public.account_deletion_requests WHERE id = p_request FOR UPDATE;
    IF NOT FOUND OR current_row.status NOT IN ('pending', 'processing', 'held') THEN
        RETURN NULL;
    END IF;
    IF current_row.status = 'pending' AND current_row.scheduled_for > now() THEN
        RETURN NULL;
    END IF;
    IF current_row.status = 'processing' AND current_row.started_at > now() - interval '10 minutes' THEN
        RETURN NULL;
    END IF;
    IF NOT (current_row.steps ? 'core') AND EXISTS (
        SELECT 1 FROM public.social_review_cases c WHERE c.subject_id = current_row.subject_id AND c.status = 'open'
    ) THEN
        IF current_row.status <> 'held' THEN
            UPDATE public.account_deletion_requests
                SET status = 'held', held_reason = 'open_safety_review'
                WHERE id = p_request
                RETURNING * INTO current_row;
            INSERT INTO public.audit_logs (actor_id, action, subject, detail)
                VALUES (NULL, 'account.deletion_held', current_row.subject_id::text,
                    jsonb_build_object('request_id', current_row.id, 'reason', 'open_safety_review'));
        END IF;
        RETURN current_row;
    END IF;
    UPDATE public.account_deletion_requests
        SET status = 'processing', held_reason = NULL, started_at = now(), attempts = attempts + 1
        WHERE id = p_request
        RETURNING * INTO current_row;
    RETURN current_row;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion(uuid) TO service_role;

-- ── one cross-service step ─────────────────────────────────────────────────
-- p_result NULL records a failure (p_error) without marking the step done.
-- p_depot_paths replaces the remaining Depot list (what is left to delete).
CREATE OR REPLACE FUNCTION public.record_account_deletion_step(
    p_request uuid,
    p_step text,
    p_result jsonb,
    p_error text,
    p_depot_paths jsonb
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    -- The core step's result is written only by erase_account_data itself;
    -- 'core' is accepted here to record a FAILURE of that step.
    IF p_step NOT IN ('oracle', 'core', 'depot', 'dataintel') OR (p_step = 'core' AND p_result IS NOT NULL) THEN
        RAISE EXCEPTION 'INVALID_DELETION_STEP' USING ERRCODE = 'P0001';
    END IF;
    IF p_depot_paths IS NOT NULL AND jsonb_typeof(p_depot_paths) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_DELETION_STEP' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.account_deletion_requests
        SET steps = CASE WHEN p_result IS NULL THEN steps ELSE steps || jsonb_build_object(p_step, p_result) END,
            last_error = CASE WHEN p_error IS NULL THEN NULL ELSE left(p_step || ': ' || p_error, 200) END,
            depot_paths = COALESCE(p_depot_paths, depot_paths)
        WHERE id = p_request AND status = 'processing';
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.record_account_deletion_step(uuid, text, jsonb, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_deletion_step(uuid, text, jsonb, text, jsonb) TO service_role;

-- ── complete ───────────────────────────────────────────────────────────────
-- A deletion is complete only when every service recorded its step and the
-- remaining Depot list is empty. The working lists are emptied here.
CREATE OR REPLACE FUNCTION public.complete_account_deletion(p_request uuid)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE done public.account_deletion_requests%ROWTYPE;
BEGIN
    SELECT * INTO done FROM public.account_deletion_requests WHERE id = p_request FOR UPDATE;
    IF NOT FOUND OR done.status <> 'processing' THEN
        RAISE EXCEPTION 'DELETION_NOT_PROCESSING' USING ERRCODE = 'P0001';
    END IF;
    IF NOT (done.steps ?& ARRAY['oracle', 'core', 'depot', 'dataintel']) OR jsonb_array_length(done.depot_paths) > 0 THEN
        RAISE EXCEPTION 'DELETION_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.account_deletion_requests
        SET status = 'completed', completed_at = now(), depot_paths = '[]'::jsonb,
            anon_ids = '[]'::jsonb, last_error = NULL
        WHERE id = p_request
        RETURNING * INTO done;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'account.deletion_completed', done.subject_id::text, jsonb_build_object(
            'request_id', done.id, 'population', done.population, 'initiated_by', done.initiated_by,
            'requested_at', done.requested_at, 'attempts', done.attempts, 'steps', done.steps));
    RETURN done;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_deletion(uuid) TO service_role;

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

SELECT 'migration_account_deletion_requests_ok' AS sentinel;
