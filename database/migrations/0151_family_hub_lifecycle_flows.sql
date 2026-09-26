-- family_hub_lifecycle_flows — S07.1, part 5 of 5 (D.4 / D.5, OD-21): the producing flows for
-- redemption fulfilled, manual adjustment, goal withdrawal and guardian-link
-- pending/rejected/revoked.
-- @phase: contract
-- @after-release: none — replaces accept_guardian_invite so an accepted
--   invite produces a PENDING link while the child has a guardian to confirm
--   it; an older Core would still answer "linked" for it. Apply with the Core release that ships the
--   S07.1 routes, after family_hub_state_machine, never ahead of it.
--
-- Rationale and the full state-machine description: family_hub_state_machine
-- (part 1) and docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── Producing flows (OD-21) ──────────────────────────────────────────────────
-- Manual adjustment: guardian-only, audited, required reason.
CREATE OR REPLACE FUNCTION public.guardian_adjust_wallet(
    p_kid_user_id uuid,
    p_actor       uuid,
    p_bucket      text,
    p_amount      int,
    p_reason      text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_reason text := btrim(coalesce(p_reason, ''));
    v_action uuid;
BEGIN
    IF p_bucket IS NULL OR p_bucket NOT IN ('save', 'spend', 'share') OR p_amount IS NULL OR p_amount = 0
       OR abs(p_amount) > 1000 OR char_length(v_reason) NOT BETWEEN 1 AND 240 THEN
        RAISE EXCEPTION 'WALLET_ADJUSTMENT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, p_kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.wallet_guardian_actions (kind, kid_user_id, actor_user_id, bucket, amount, reason)
    VALUES ('manual_adjustment', p_kid_user_id, p_actor, p_bucket, p_amount, v_reason)
    RETURNING id INTO v_action;
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, guardian_action_id)
    VALUES (p_kid_user_id, p_bucket, p_amount, 'manual_adjustment', p_actor, v_action);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'wallet.manual_adjustment', p_kid_user_id::text,
            jsonb_build_object('action_id', v_action, 'bucket', p_bucket, 'amount', p_amount));
    RETURN v_action;
END;
$$;
REVOKE ALL ON FUNCTION public.guardian_adjust_wallet(uuid, uuid, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_adjust_wallet(uuid, uuid, text, int, text) TO service_role;

-- Goal withdrawal: guardian-only, audited, required reason. Moves coins out of
-- a goal's tagged savings into Spend, or releases them into plain Save.
CREATE OR REPLACE FUNCTION public.guardian_withdraw_goal(
    p_goal_id     uuid,
    p_actor       uuid,
    p_amount      int,
    p_destination text,
    p_reason      text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_reason text := btrim(coalesce(p_reason, ''));
    v_kid    uuid;
    v_action uuid;
BEGIN
    IF p_destination IS NULL OR p_destination NOT IN ('save', 'spend') OR p_amount IS NULL OR p_amount <= 0
       OR p_amount > 1000 OR char_length(v_reason) NOT BETWEEN 1 AND 240 THEN
        RAISE EXCEPTION 'GOAL_WITHDRAWAL_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT kid_user_id INTO v_kid FROM public.savings_goals WHERE id = p_goal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.wallet_guardian_actions (kind, kid_user_id, actor_user_id, bucket, goal_id, amount, reason)
    VALUES ('goal_withdrawal', v_kid, p_actor, p_destination, p_goal_id, p_amount, v_reason)
    RETURNING id INTO v_action;
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, guardian_action_id)
    VALUES (v_kid, 'save', -p_amount, 'goal_withdrawal', p_goal_id, p_actor, v_action);
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, guardian_action_id)
    VALUES (v_kid, p_destination, p_amount, 'goal_withdrawal', p_actor, v_action);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'wallet.goal_withdrawal', v_kid::text,
            jsonb_build_object('action_id', v_action, 'goal_id', p_goal_id, 'destination', p_destination, 'amount', p_amount));
    RETURN v_action;
END;
$$;
REVOKE ALL ON FUNCTION public.guardian_withdraw_goal(uuid, uuid, int, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_withdraw_goal(uuid, uuid, int, text, text) TO service_role;

-- Redemption fulfilled: a verified guardian marks an approved reward delivered.
-- false = not in the approved state (already delivered, never approved).
CREATE OR REPLACE FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid    uuid;
    v_status text;
BEGIN
    SELECT kid_user_id INTO v_kid FROM public.redemptions WHERE id = p_redemption_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    SELECT status INTO v_status FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
    IF v_status <> 'approved' THEN
        RETURN false;
    END IF;
    UPDATE public.redemptions SET status = 'fulfilled', fulfilled_by = p_actor, fulfilled_at = now()
    WHERE id = p_redemption_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'tasks.redemption_fulfilled', p_redemption_id::text, jsonb_build_object('kid_user_id', v_kid));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_redemption(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_redemption(uuid, uuid) TO service_role;

-- Second-guardian acceptance now produces a PENDING link while the child has a
-- verified guardian to confirm it; with none left (a suspended child), the
-- acceptance verifies directly exactly as before. Same signature and return
-- value as 0110, so Core reads the resulting status separately.
CREATE OR REPLACE FUNCTION public.accept_guardian_invite(p_token text, p_accepting uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    invite_row public.guardian_invites%ROWTYPE;
    link_row   public.guardian_links%ROWTYPE;
    v_target   text;
BEGIN
    IF p_token IS NULL OR p_accepting IS NULL THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO invite_row FROM public.guardian_invites WHERE token = p_token FOR UPDATE;
    IF NOT FOUND OR invite_row.accepted_at IS NOT NULL OR invite_row.expires_at <= now()
       OR invite_row.kid_user_id = p_accepting THEN
        RAISE EXCEPTION 'INVALID_GUARDIAN_INVITE' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('guardian-links:' || invite_row.kid_user_id::text, 0));

    SELECT * INTO link_row FROM public.guardian_links
    WHERE parent_user_id = p_accepting AND kid_user_id = invite_row.kid_user_id FOR UPDATE;

    IF FOUND AND link_row.verification_status = 'verified' THEN
        v_target := 'verified';
    ELSE
        v_target := CASE WHEN EXISTS (
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
            CASE WHEN v_target = 'pending' THEN 'family.second_guardian_pending' ELSE 'family.second_guardian_linked' END,
            invite_row.kid_user_id::text,
            jsonb_build_object('origin', 'database-function', 'invite_id', invite_row.id));
    RETURN invite_row.kid_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_guardian_invite(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_guardian_invite(text, uuid) TO service_role;

-- An existing verified guardian confirms or rejects a pending link.
CREATE OR REPLACE FUNCTION public.decide_guardian_link(p_link_id uuid, p_actor uuid, p_confirm boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid  uuid;
    v_link public.guardian_links%ROWTYPE;
    v_to   text := CASE WHEN p_confirm THEN 'verified' ELSE 'rejected' END;
BEGIN
    IF p_confirm IS NULL THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_DECISION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT kid_user_id INTO v_kid FROM public.guardian_links WHERE id = p_link_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('guardian-links:' || v_kid::text, 0));
    SELECT * INTO v_link FROM public.guardian_links WHERE id = p_link_id FOR UPDATE;
    IF p_actor IS NULL OR p_actor = v_link.parent_user_id OR NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF v_link.verification_status <> 'pending' THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_NOT_PENDING' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.guardian_links
    SET verification_status = v_to,
        verified_at = CASE WHEN p_confirm THEN now() END,
        decided_by = p_actor, decided_at = now()
    WHERE id = p_link_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, CASE WHEN p_confirm THEN 'family.guardian_link_confirmed' ELSE 'family.guardian_link_rejected' END,
            v_kid::text, jsonb_build_object('link_id', p_link_id, 'guardian_user_id', v_link.parent_user_id));
    RETURN v_to;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_guardian_link(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_guardian_link(uuid, uuid, boolean) TO service_role;

-- A verified guardian steps away from a child. Refused while they are the
-- child's only verified guardian (0010's invariant, re-checked here so Core
-- gets a named error instead of a generic exception).
CREATE OR REPLACE FUNCTION public.revoke_own_guardian_link(p_kid_user_id uuid, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_link public.guardian_links%ROWTYPE;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('guardian-links:' || p_kid_user_id::text, 0));
    SELECT * INTO v_link FROM public.guardian_links
    WHERE parent_user_id = p_actor AND kid_user_id = p_kid_user_id AND verification_status = 'verified'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.guardian_links
        WHERE kid_user_id = p_kid_user_id AND id <> v_link.id AND verification_status = 'verified'
    ) THEN
        RAISE EXCEPTION 'LAST_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.guardian_links
    SET verification_status = 'revoked', revoked_by = p_actor, revoked_at = now()
    WHERE id = v_link.id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'family.guardian_link_revoked', p_kid_user_id::text, jsonb_build_object('link_id', v_link.id));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_own_guardian_link(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_own_guardian_link(uuid, uuid) TO service_role;

SELECT 'family_hub_lifecycle_flows_ok' AS sentinel;
