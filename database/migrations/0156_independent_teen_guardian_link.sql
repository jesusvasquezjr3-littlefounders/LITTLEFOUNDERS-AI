-- independent_teen_guardian_link — S07.2, part 5 of 5 (D.3, OD-3 Option B): a
-- self-registered teen may invite a parent later (optional, teen-initiated,
-- never mandatory), and the family mechanics then layer onto the same wallet.
-- @phase: contract
-- @after-release: none — narrows two S07.1 writers: an invite for a teen's
--   account can only be issued by the teen themself, and accepting any invite
--   now needs a parent-role account. A teen-issued invite produces a PENDING
--   link that only the teen can confirm. Every write the current Core makes
--   stays legal (it only issues invites from a verified guardian of a
--   parent-created child, through the parent-only family router). Apply with
--   the Core release that ships the S07.2 routes, after the S07.1
--   family_hub_* migrations, never ahead of them.
--
-- Why the teen confirms: an invite link can leak. A leaked link must never
-- attach a stranger to a teen's account on its own, exactly as S07.1 made a
-- second Tutor pending for a child in a family. Here the confirming party is
-- the account holder, because nobody else has standing to decide who becomes
-- a teen's Tutor.
--
-- What layering means, and why nothing is migrated: tasks, reward requests,
-- allowance and freeze already key on the child's user id and a verified
-- guardian link. Once the teen confirms, a verified link exists, so the
-- parent's existing flows work on the teen's existing ledger, goals and
-- personal rewards. The teen keeps the self-directed actions (no approval
-- step, Option B); a freeze or spend limit the parent sets applies to them.

-- ── Invites for a teen's account are issued by the teen ─────────────────────
CREATE OR REPLACE FUNCTION public.guard_guardian_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id OR NEW.kid_user_id IS DISTINCT FROM OLD.kid_user_id OR NEW.token IS DISTINCT FROM OLD.token
           OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR (NEW.created_by IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL) THEN
            RAISE EXCEPTION 'GUARDIAN_INVITE_IMMUTABLE' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.accepted_by IS NOT NULL OR NEW.accepted_at IS NOT NULL OR NEW.expires_at > now() + interval '8 days' THEN
        RAISE EXCEPTION 'GUARDIAN_INVITE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF public.teen_wallet_holder(NEW.kid_user_id) THEN
        IF NEW.created_by IS DISTINCT FROM NEW.kid_user_id THEN
            RAISE EXCEPTION 'TEEN_INVITES_OWN_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF (SELECT count(*) FROM public.guardian_invites
            WHERE kid_user_id = NEW.kid_user_id AND accepted_at IS NULL AND expires_at > now()) >= 3 THEN
            RAISE EXCEPTION 'GUARDIAN_INVITE_LIMIT' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.created_by IS NULL OR NEW.created_by = NEW.kid_user_id
          OR NOT public.family_is_verified_guardian(NEW.created_by, NEW.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_guardian_invite() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS guardian_invite_guard ON public.guardian_invites;
CREATE TRIGGER guardian_invite_guard BEFORE INSERT OR UPDATE ON public.guardian_invites
    FOR EACH ROW EXECUTE FUNCTION public.guard_guardian_invite();
GRANT INSERT, UPDATE ON public.guardian_invites TO service_role;

-- ── Acceptance: a teen-issued invite is always pending the teen ─────────────
CREATE OR REPLACE FUNCTION public.accept_guardian_invite(p_token text, p_accepting uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    invite_row public.guardian_invites%ROWTYPE;
    link_row   public.guardian_links%ROWTYPE;
    v_target   text;
    v_teen     boolean;
BEGIN
    IF p_token IS NULL OR p_accepting IS NULL THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO invite_row FROM public.guardian_invites WHERE token = p_token FOR UPDATE;
    IF NOT FOUND OR invite_row.accepted_at IS NOT NULL OR invite_row.expires_at <= now()
       OR invite_row.kid_user_id = p_accepting
       OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_accepting AND role = 'parent') THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('guardian-links:' || invite_row.kid_user_id::text, 0));
    v_teen := invite_row.created_by IS NOT DISTINCT FROM invite_row.kid_user_id;

    SELECT * INTO link_row FROM public.guardian_links
    WHERE parent_user_id = p_accepting AND kid_user_id = invite_row.kid_user_id FOR UPDATE;

    IF FOUND AND link_row.verification_status = 'verified' THEN
        v_target := 'verified';
    ELSE
        v_target := CASE WHEN v_teen OR EXISTS (
            SELECT 1 FROM public.guardian_links
            WHERE kid_user_id = invite_row.kid_user_id AND parent_user_id <> p_accepting AND verification_status = 'verified'
        ) THEN 'pending' ELSE 'verified' END;
        IF link_row.id IS NULL THEN
            INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at, invite_id)
            VALUES (p_accepting, invite_row.kid_user_id, v_target,
                    CASE WHEN v_target = 'verified' THEN now() END, invite_row.id);
        ELSE
            UPDATE public.guardian_links
            SET verification_status = v_target,
                verified_at = CASE WHEN v_target = 'verified' THEN now() END,
                invite_id = invite_row.id,
                decided_by = NULL, decided_at = NULL, revoked_by = NULL, revoked_at = NULL
            WHERE id = link_row.id;
        END IF;
    END IF;

    UPDATE public.guardian_invites SET accepted_by = p_accepting, accepted_at = now() WHERE id = invite_row.id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_accepting,
            CASE WHEN v_teen AND v_target = 'pending' THEN 'family.teen_guardian_pending'
                 WHEN v_target = 'pending' THEN 'family.second_guardian_pending'
                 ELSE 'family.second_guardian_linked' END,
            invite_row.kid_user_id::text,
            jsonb_build_object('origin', 'database-function', 'invite_id', invite_row.id));
    RETURN invite_row.kid_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_guardian_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_guardian_invite(text, uuid) TO service_role;

-- ── Guardian link state machine: the teen decides links they invited ───────
-- S07.1's rules are kept verbatim; the only change is who may decide a
-- pending link: for a link produced by the account holder's own invite, the
-- account holder (and nobody else); for every other link, another verified
-- guardian who is not the pending adult.
CREATE OR REPLACE FUNCTION public.guard_guardian_link_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_others  boolean;
    v_self_invited boolean;
BEGIN
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
        IF NEW.revoked_by IS DISTINCT FROM NEW.parent_user_id OR NEW.revoked_at IS NULL THEN
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

-- The teen confirms or rejects a parent who accepted the teen's own invite.
CREATE OR REPLACE FUNCTION public.teen_decide_guardian_link(p_link_id uuid, p_teen uuid, p_confirm boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_link public.guardian_links%ROWTYPE;
    v_to   text := CASE WHEN p_confirm THEN 'verified' ELSE 'rejected' END;
BEGIN
    IF p_confirm IS NULL OR p_teen IS NULL THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_DECISION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('guardian-links:' || p_teen::text, 0));
    SELECT * INTO v_link FROM public.guardian_links WHERE id = p_link_id AND kid_user_id = p_teen FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (
        SELECT 1 FROM public.guardian_invites gi WHERE gi.id = v_link.invite_id AND gi.created_by = p_teen
    ) THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.teen_wallet_holder(p_teen) THEN
        RAISE EXCEPTION 'TEEN_WALLET_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF v_link.verification_status <> 'pending' THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_NOT_PENDING' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.guardian_links
    SET verification_status = v_to,
        verified_at = CASE WHEN p_confirm THEN now() END,
        decided_by = p_teen, decided_at = now()
    WHERE id = p_link_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_teen, CASE WHEN p_confirm THEN 'family.teen_guardian_confirmed' ELSE 'family.teen_guardian_rejected' END,
            p_teen::text, jsonb_build_object('link_id', p_link_id, 'guardian_user_id', v_link.parent_user_id));
    RETURN v_to;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_decide_guardian_link(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_decide_guardian_link(uuid, uuid, boolean) TO service_role;

SELECT 'independent_teen_guardian_link_ok' AS sentinel;
