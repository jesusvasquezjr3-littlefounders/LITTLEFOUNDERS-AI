-- 0110_second_guardian_and_kid_suspension.sql — A.1: build the two FAQ
-- promises that did not exist (a second verified Tutor can link to the same
-- child; a child's account is suspended when its last Tutor goes away and
-- deleted if nothing reactivates it within 90 days).
-- @phase: expand
--
-- A.1's mandate is "build the flow or remove the claim". The schema already
-- supports multiple verified guardian links, so the second-Tutor promise is
-- a missing product flow: a verified parent invites a second verified parent
-- to link to an existing kid, and acceptance re-verifies the joining adult
-- before any link row is written (Core's existing verified-adulthood
-- evidence, never a self-declared age).
--
-- The cancellation promise is implemented as: when a kid's LAST verified
-- guardian link disappears (parent account deleted, link revoked), the kid
-- profile is marked suspended_at = now(); any newly established verified
-- link clears it immediately. Deletion after 90 days is lazy, not cron-based
-- (there is no scheduler in this stack): Core evaluates it at the kid's own
-- session boundary and hard-deletes the account once the window has passed
-- with no verified link. A suspended kid cannot use the product in the
-- meantime because every session admission re-checks the suspension.

-- Second-guardian invites. Service-only: Core brokers every read and write.
CREATE TABLE IF NOT EXISTS public.guardian_invites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- SET NULL, not CASCADE: the invite's purpose is linking a guardian to a
    -- KID. If the inviting parent's account disappears, an already-accepted
    -- link keeps the kid supervised; an unaccepted invite must survive so a
    -- second parent can still accept it and reactivate the kid.
    created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    token       text NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    accepted_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guardian_invite_kid_idx
    ON public.guardian_invites (kid_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS guardian_invite_token_idx
    ON public.guardian_invites (token);
ALTER TABLE public.guardian_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.guardian_invites TO service_role;

-- Kid suspension marker: NULL = active, non-NULL = last verified guardian
-- link disappeared. Enforced at session admission by Core, not by RLS.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Suspend a kid whose last verified link disappeared. Fires per deleted
-- link; the guard inside means only the deletion that empties the set
-- actually writes the marker (idempotent — a second trigger run sees the
-- existing marker and skips).
CREATE OR REPLACE FUNCTION public.suspend_unlinked_kid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.verification_status = 'verified' OR OLD.verification_status <> 'verified' THEN
        RETURN OLD;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.kid_user_id = OLD.kid_user_id AND gl.verification_status = 'verified'
    ) THEN
        UPDATE public.profiles SET suspended_at = now(), updated_at = now()
            WHERE user_id = OLD.kid_user_id;
    END IF;
    RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.suspend_unlinked_kid() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER guardian_link_suspension
    AFTER DELETE ON public.guardian_links
    FOR EACH ROW EXECUTE FUNCTION public.suspend_unlinked_kid();

-- A newly verified link reactivates the kid immediately (the FAQ's
-- "unusable until an active Tutor account supervises it again").
CREATE OR REPLACE FUNCTION public.reactivate_linked_kid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.verification_status <> 'verified' THEN RETURN NEW; END IF;
    UPDATE public.profiles SET suspended_at = NULL, updated_at = now()
        WHERE user_id = NEW.kid_user_id;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reactivate_linked_kid() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER guardian_link_reactivation
    AFTER INSERT OR UPDATE OF verification_status ON public.guardian_links
    FOR EACH ROW EXECUTE FUNCTION public.reactivate_linked_kid();

-- Accept a second-guardian invite. The joining parent's verified-adulthood
-- evidence is checked by Core BEFORE this call; the function performs the
-- one-shot token exchange: validate, link, accept, reactivate (the link
-- trigger also fires, idempotently) and audit — all in one transaction.
CREATE OR REPLACE FUNCTION public.accept_guardian_invite(p_token text, p_accepting uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invite_row public.guardian_invites%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_accepting IS NULL THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO invite_row FROM public.guardian_invites WHERE token = p_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    IF invite_row.accepted_at IS NOT NULL OR invite_row.expires_at <= now() THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    IF invite_row.kid_user_id = p_accepting THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
        VALUES (p_accepting, invite_row.kid_user_id, 'verified', now())
        ON CONFLICT (parent_user_id, kid_user_id) DO NOTHING;
    UPDATE public.guardian_invites
        SET accepted_by = p_accepting, accepted_at = now()
        WHERE token = p_token;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (p_accepting, 'family.second_guardian_linked', invite_row.kid_user_id::text,
            jsonb_build_object('origin', 'database-function'));
    RETURN invite_row.kid_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_guardian_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_guardian_invite(text, uuid) TO service_role;

SELECT 'migration_0110_ok' AS sentinel;
