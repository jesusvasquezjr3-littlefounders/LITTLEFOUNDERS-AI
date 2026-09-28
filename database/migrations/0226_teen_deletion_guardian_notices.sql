-- teen_deletion_guardian_notices — GAP-FIX-R2 (owner review D-14 (b), E.6,
-- OD-3 section 2): a linked teen who deletes their own account tells each
-- verified Tutor, notify only.
-- @phase: expand
--
-- D-14 was approved with (b): "The policy says notify only, once linking
-- exists." Linking exists (a self-registered teen can link a verified parent,
-- POST /api/v1/wallet/guardian-invite), and the erasure removes that link
-- (erase_account_data deletes the teen's guardian_links), so without a notice
-- the Tutor is never told.
--
-- WHAT THIS ADDS.
--   * account_deletion_guardian_notices: one row per (deletion request,
--     verified Tutor). Ids and a timestamp only: no reason, no name, no
--     content. The teen's display name and the scheduled date are read when
--     the Tutor looks, so nothing about the teen is copied. Both user columns
--     cascade from auth.users: the erasure removes the teen's notices with
--     the account (the notice existed to reach the Tutor before it ran), and a
--     departed Tutor's notices go with them. RLS: the Tutor it names reads it;
--     no browser role writes.
--   * notify_guardians_of_teen_deletion(): an AFTER INSERT trigger on
--     account_deletion_requests. For a self-initiated request of population
--     'teen' it writes one notice per verified guardian link of the subject
--     and one audit row (account.deletion_guardians_notified), in the same
--     transaction as the request and its own audit row. An unlinked teen
--     (D-14 (a)) writes nothing. Nobody else is affected: a parent-created
--     child is deleted by its Tutor, and adults are not reported to anyone.
--   * guardian_deletion_notices(p_guardian): service-only read for Core. It
--     returns the notices whose request is still open (pending or held), with
--     the teen's display name and the scheduled date. A cancelled request
--     drops out, so a teen who keeps their account needs no second notice;
--     the Tutor is offered no action (notify only).
--
-- ORDERING. Safe before or after the code: nothing reads the table until the
-- Core release that serves it, and the trigger only inserts.

CREATE TABLE IF NOT EXISTS public.account_deletion_guardian_notices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id       uuid NOT NULL REFERENCES public.account_deletion_requests (id) ON DELETE CASCADE,
    teen_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    guardian_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT account_deletion_guardian_notice_once UNIQUE (request_id, guardian_user_id),
    CONSTRAINT account_deletion_guardian_notice_other CHECK (teen_user_id <> guardian_user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_guardian_notices_guardian
    ON public.account_deletion_guardian_notices (guardian_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_guardian_notices_teen
    ON public.account_deletion_guardian_notices (teen_user_id);

ALTER TABLE public.account_deletion_guardian_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_guardian_notices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_deletion_guardian_notices TO authenticated;
GRANT SELECT ON public.account_deletion_guardian_notices TO service_role;
DROP POLICY IF EXISTS account_deletion_guardian_notices_select_own ON public.account_deletion_guardian_notices;
CREATE POLICY account_deletion_guardian_notices_select_own ON public.account_deletion_guardian_notices
    FOR SELECT USING (guardian_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_guardians_of_teen_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_notified integer;
BEGIN
    IF NEW.population <> 'teen' OR NEW.initiated_by <> 'self' THEN
        RETURN NEW;
    END IF;
    WITH written AS (
        INSERT INTO public.account_deletion_guardian_notices (request_id, teen_user_id, guardian_user_id)
        SELECT NEW.id, NEW.subject_id, g.parent_user_id
        FROM public.guardian_links g
        WHERE g.kid_user_id = NEW.subject_id AND g.verification_status = 'verified' AND g.parent_user_id <> NEW.subject_id
        ON CONFLICT (request_id, guardian_user_id) DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_notified FROM written;
    IF v_notified > 0 THEN
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
            VALUES (NEW.subject_id, 'account.deletion_guardians_notified', NEW.subject_id::text, jsonb_build_object(
                'request_id', NEW.id, 'guardians', v_notified, 'scheduled_for', NEW.scheduled_for));
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_guardians_of_teen_deletion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_guardians_of_teen_deletion ON public.account_deletion_requests;
CREATE TRIGGER trg_notify_guardians_of_teen_deletion
    AFTER INSERT ON public.account_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_guardians_of_teen_deletion();

CREATE OR REPLACE FUNCTION public.guardian_deletion_notices(p_guardian uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id,
        'teen_user_id', n.teen_user_id,
        'display_name', coalesce(p.display_name, ''),
        'scheduled_for', r.scheduled_for,
        'notified_at', n.created_at
    ) ORDER BY r.scheduled_for, n.id), '[]'::jsonb)
    FROM public.account_deletion_guardian_notices n
    JOIN public.account_deletion_requests r ON r.id = n.request_id AND r.status IN ('pending', 'held')
    LEFT JOIN public.profiles p ON p.user_id = n.teen_user_id
    WHERE n.guardian_user_id = p_guardian;
$$;
REVOKE ALL ON FUNCTION public.guardian_deletion_notices(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_deletion_notices(uuid) TO service_role;
