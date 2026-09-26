-- independent_teen_wallet_flows — S07.2, part 4 of 5 (D.3, OD-3 Option B): the
-- teen's own producing flows (log income and split it at once, keep a
-- personal reward list and mark a reward, release coins from their own goal)
-- and Appendix H's Teen Independent-Mode Adoption metric.
-- @phase: expand
--
-- Every function is service-role only, serialized on the holder's wallet lock
-- (the same advisory key the S07.1 flows use, so a guardian correction and a
-- teen's own action can never interleave) and audited in the same
-- transaction. The triggers of parts 2 and 3 re-check everything; these
-- functions exist so Core gets one atomic call and a named refusal.
--
-- Rationale: independent_teen_wallet_schema (part 1) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- Logged income, split across Save/Spend/Share in the same action: no pending
-- state, no approval step. The Save part may go straight to an active goal,
-- and a goal the income covers is marked reached in the same transaction.
CREATE OR REPLACE FUNCTION public.teen_log_income(
    p_holder  uuid,
    p_source  text,
    p_save    int,
    p_spend   int,
    p_share   int,
    p_goal_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_amount   int;
    v_action   uuid;
    v_target   int;
    v_progress bigint;
BEGIN
    IF p_holder IS NULL OR p_source IS NULL OR p_source NOT IN ('allowance', 'gift', 'earned')
       OR p_save IS NULL OR p_spend IS NULL OR p_share IS NULL OR p_save < 0 OR p_spend < 0 OR p_share < 0
       OR (p_goal_id IS NOT NULL AND p_save = 0) THEN
        RAISE EXCEPTION 'SELF_INCOME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_amount := p_save + p_spend + p_share;
    IF v_amount NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'SELF_INCOME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    IF NOT public.teen_wallet_holder(p_holder) THEN
        RAISE EXCEPTION 'TEEN_WALLET_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, save_amount, spend_amount, share_amount, goal_id)
    VALUES ('self_income', p_holder, v_amount, p_source, p_save, p_spend, p_share, p_goal_id)
    RETURNING id INTO v_action;
    IF p_save > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, self_action_id)
        VALUES (p_holder, 'save', p_save, 'self_income', p_goal_id, p_holder, v_action);
    END IF;
    IF p_spend > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id)
        VALUES (p_holder, 'spend', p_spend, 'self_income', p_holder, v_action);
    END IF;
    IF p_share > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id)
        VALUES (p_holder, 'share', p_share, 'self_income', p_holder, v_action);
    END IF;
    IF p_goal_id IS NOT NULL THEN
        SELECT target INTO v_target FROM public.savings_goals WHERE id = p_goal_id AND status = 'active' FOR UPDATE;
        SELECT coalesce(sum(amount), 0) INTO v_progress FROM public.wallet_ledger WHERE goal_id = p_goal_id;
        IF v_target IS NOT NULL AND v_progress >= v_target THEN
            UPDATE public.savings_goals SET status = 'reached', reached_at = now() WHERE id = p_goal_id;
        END IF;
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.self_income', p_holder::text,
            jsonb_build_object('action_id', v_action, 'amount', v_amount, 'source', p_source));
    RETURN v_action;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_log_income(uuid, text, int, int, int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_log_income(uuid, text, int, int, int, uuid) TO service_role;

-- The teen's own reward list, in place of a parent-curated catalog.
CREATE OR REPLACE FUNCTION public.teen_create_personal_reward(p_holder uuid, p_title text, p_cost int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_title  text := btrim(coalesce(p_title, ''));
    v_reward uuid;
BEGIN
    IF p_holder IS NULL OR char_length(v_title) NOT BETWEEN 1 AND 60 OR p_cost IS NULL OR p_cost NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'PERSONAL_REWARD_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    INSERT INTO public.personal_rewards (holder_user_id, title, cost)
    VALUES (p_holder, v_title, p_cost)
    RETURNING id INTO v_reward;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.personal_reward_created', p_holder::text, jsonb_build_object('reward_id', v_reward, 'cost', p_cost));
    RETURN v_reward;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_create_personal_reward(uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_create_personal_reward(uuid, text, int) TO service_role;

-- true = archived now; false = already archived. Another holder's reward is
-- indistinguishable from a missing one.
CREATE OR REPLACE FUNCTION public.teen_archive_personal_reward(p_holder uuid, p_reward uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_status text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    SELECT status INTO v_status FROM public.personal_rewards WHERE id = p_reward AND holder_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PERSONAL_REWARD_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_status <> 'active' THEN
        RETURN false;
    END IF;
    UPDATE public.personal_rewards SET status = 'archived', archived_at = now() WHERE id = p_reward;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.personal_reward_archived', p_holder::text, jsonb_build_object('reward_id', p_reward));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_archive_personal_reward(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_archive_personal_reward(uuid, uuid) TO service_role;

-- The teen marks a personal reward for themselves: its cost leaves Spend at
-- once. No approval step; a freeze or a spend limit a linked guardian set
-- still applies (part 2).
CREATE OR REPLACE FUNCTION public.teen_claim_personal_reward(p_holder uuid, p_reward uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_reward public.personal_rewards%ROWTYPE;
    v_action uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    IF NOT public.teen_wallet_holder(p_holder) THEN
        RAISE EXCEPTION 'TEEN_WALLET_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_reward FROM public.personal_rewards WHERE id = p_reward AND holder_user_id = p_holder FOR UPDATE;
    IF NOT FOUND OR v_reward.status <> 'active' THEN
        RAISE EXCEPTION 'PERSONAL_REWARD_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, personal_reward_id)
    VALUES ('personal_reward', p_holder, v_reward.cost, v_reward.id)
    RETURNING id INTO v_action;
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id)
    VALUES (p_holder, 'spend', -v_reward.cost, 'personal_reward', p_holder, v_action);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.personal_reward_claimed', p_holder::text,
            jsonb_build_object('action_id', v_action, 'reward_id', v_reward.id, 'cost', v_reward.cost));
    RETURN v_action;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_claim_personal_reward(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_claim_personal_reward(uuid, uuid) TO service_role;

-- The teen moves coins out of their OWN goal, into Spend or plain Save. A
-- self-directed wallet has nobody else to do it (the guardian-only
-- goal_withdrawal of S07.1 stays guardian-only for children in a family).
CREATE OR REPLACE FUNCTION public.teen_release_goal(p_holder uuid, p_goal_id uuid, p_amount int, p_destination text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_action uuid;
BEGIN
    IF p_holder IS NULL OR p_destination IS NULL OR p_destination NOT IN ('save', 'spend')
       OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'GOAL_RELEASE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    IF NOT public.teen_wallet_holder(p_holder) THEN
        RAISE EXCEPTION 'TEEN_WALLET_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM public.savings_goals WHERE id = p_goal_id AND kid_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, goal_id, destination)
    VALUES ('goal_release', p_holder, p_amount, p_goal_id, p_destination)
    RETURNING id INTO v_action;
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, self_action_id)
    VALUES (p_holder, 'save', -p_amount, 'goal_release', p_goal_id, p_holder, v_action);
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id)
    VALUES (p_holder, p_destination, p_amount, 'goal_release', p_holder, v_action);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.goal_release', p_holder::text,
            jsonb_build_object('action_id', v_action, 'goal_id', p_goal_id, 'destination', p_destination, 'amount', p_amount));
    RETURN v_action;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_release_goal(uuid, uuid, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_release_goal(uuid, uuid, int, text) TO service_role;

-- ── Appendix H: Teen Independent-Mode Adoption (Diagnostic, no target) ──────
-- Eligible teens today, how many ever used their wallet (a logged income, a
-- goal or a personal reward), split by whether a parent is linked now, and
-- how many first used it since p_since. Counts only; never an identity.
CREATE OR REPLACE FUNCTION public.teen_wallet_adoption(p_since timestamptz)
RETURNS TABLE (eligible_teens bigint, adopters bigint, independent_adopters bigint, linked_adopters bigint, new_adopters bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH teens AS (
        SELECT d.user_id FROM public.account_age_declarations d
        WHERE d.declared_age_band = '13_to_17' AND public.teen_wallet_holder(d.user_id)
    ), first_use AS (
        SELECT t.user_id, least(
            (SELECT min(a.created_at) FROM public.wallet_self_actions a WHERE a.holder_user_id = t.user_id),
            (SELECT min(g.created_at) FROM public.savings_goals g WHERE g.kid_user_id = t.user_id),
            (SELECT min(r.created_at) FROM public.personal_rewards r WHERE r.holder_user_id = t.user_id)
        ) AS at,
        EXISTS (SELECT 1 FROM public.guardian_links gl WHERE gl.kid_user_id = t.user_id AND gl.verification_status = 'verified') AS linked
        FROM teens t
    )
    SELECT count(*),
           count(*) FILTER (WHERE at IS NOT NULL),
           count(*) FILTER (WHERE at IS NOT NULL AND NOT linked),
           count(*) FILTER (WHERE at IS NOT NULL AND linked),
           count(*) FILTER (WHERE at >= p_since)
    FROM first_use;
$$;
REVOKE ALL ON FUNCTION public.teen_wallet_adoption(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_wallet_adoption(timestamptz) TO service_role;

SELECT 'independent_teen_wallet_flows_ok' AS sentinel;
