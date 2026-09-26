-- wallet_usual_split — S07.4, part 4 of 5 (D.13): a recommended default split
-- with an easy override, and every split measured against it.
-- @phase: expand
--
-- D.13 (Appendix G §1.4, §2.1; owner log §8: "no compulsory rationale was
-- recorded, so the recommended default with override applies"). Before this
-- checkpoint the child typed three numbers for every payout, starting from
-- "everything in Save", with no recommendation and no record of what they
-- chose against what was suggested. Now:
--
--   * Every wallet holder has a usual split: their own, self-imposed ratio
--     (the quality Thaler's mental accounting depends on), starting from the
--     platform's recommended 50 / 40 / 10 until they change it. Only the child
--     sets it; a Tutor sees it but cannot impose it, because a Tutor-set ratio
--     would be exactly the externally mandated category D.13 moves away from.
--   * Every payout (a chore reward, an allowance, a teen's logged income) is
--     offered pre-split by that ratio. Keeping it is one tap; any other split
--     that adds up is accepted, including everything in one pocket.
--   * Every split writes a consent-gated split_allocated event with the
--     default at that moment and whether it was kept (Split-Ratio Engagement
--     Quality), computed here, never trusted from the client.
--
-- The allocation functions are replaced with versions that keep every earlier
-- rule word for word (validation, freeze, the exact total, the goal checks) and
-- add: the event, an optional goal tag for an allowance's Save part, and the
-- goal-reached flip inside the same transaction (Core's later flip stays as a
-- harmless idempotent fallback). allocate_pending_credit gains a trailing
-- p_goal_id DEFAULT NULL, so an older Core's six-argument call still resolves.

-- The platform recommendation (Appendix G gives no evidence for any specific
-- ratio; this is a starting point, recalibrated in the Block D threshold log).
CREATE OR REPLACE FUNCTION public.wallet_recommended_split()
RETURNS TABLE (save_pct int, spend_pct int, share_pct int)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT 50 AS save_pct, 40 AS spend_pct, 10 AS share_pct;
$$;
REVOKE ALL ON FUNCTION public.wallet_recommended_split() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_recommended_split() TO service_role;

CREATE TABLE IF NOT EXISTS public.wallet_split_preferences (
    holder_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    save_pct       integer NOT NULL CHECK (save_pct BETWEEN 0 AND 100),
    spend_pct      integer NOT NULL CHECK (spend_pct BETWEEN 0 AND 100),
    share_pct      integer NOT NULL CHECK (share_pct BETWEEN 0 AND 100),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT wallet_split_sums_to_100 CHECK (save_pct + spend_pct + share_pct = 100)
);
ALTER TABLE public.wallet_split_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_split_preferences_select_party ON public.wallet_split_preferences;
CREATE POLICY wallet_split_preferences_select_party ON public.wallet_split_preferences
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.wallet_split_preferences FROM anon, authenticated, service_role;
GRANT SELECT ON public.wallet_split_preferences TO service_role;

CREATE OR REPLACE FUNCTION public.guard_wallet_split_preference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF public.wallet_holder_kind(NEW.holder_user_id) IS NULL THEN
        RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.holder_user_id <> OLD.holder_user_id THEN
        RAISE EXCEPTION 'SPLIT_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_wallet_split_preference() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS wallet_split_preference_guard ON public.wallet_split_preferences;
CREATE TRIGGER wallet_split_preference_guard BEFORE INSERT OR UPDATE ON public.wallet_split_preferences
    FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_split_preference();

-- The holder's usual split: their own if they set one, else the recommendation.
CREATE OR REPLACE FUNCTION public.wallet_usual_split(p_holder uuid)
RETURNS TABLE (save_pct int, spend_pct int, share_pct int, custom boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p.save_pct, p.spend_pct, p.share_pct, true FROM public.wallet_split_preferences p WHERE p.holder_user_id = p_holder
    UNION ALL
    SELECT r.save_pct, r.spend_pct, r.share_pct, false FROM public.wallet_recommended_split() r
    WHERE NOT EXISTS (SELECT 1 FROM public.wallet_split_preferences p WHERE p.holder_user_id = p_holder);
$$;
REVOKE ALL ON FUNCTION public.wallet_usual_split(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_usual_split(uuid) TO service_role;

-- Whole coins for an amount under a ratio: each pocket gets the floor of its
-- share, and the one or two coins left go to the largest remainders (ties:
-- Save, then Spend, then Share). Mirrored exactly by the client's
-- splitCoins() (frontend/src/rebuild/family/moneyHabitsApi.ts); both are
-- pinned to the same fixture table.
CREATE OR REPLACE FUNCTION public.wallet_split_coins(p_amount int, p_save_pct int, p_spend_pct int, p_share_pct int)
RETURNS TABLE (save int, spend int, share int)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    WITH parts (ord, pct) AS (VALUES (1, p_save_pct), (2, p_spend_pct), (3, p_share_pct)),
    floored AS (SELECT ord, (p_amount * pct) / 100 AS base, (p_amount * pct) % 100 AS rem FROM parts),
    ranked AS (SELECT ord, base, row_number() OVER (ORDER BY rem DESC, ord) AS rn FROM floored),
    leftover AS (SELECT p_amount - sum(base)::int AS n FROM floored)
    SELECT max(base + CASE WHEN rn <= n THEN 1 ELSE 0 END) FILTER (WHERE ord = 1)::int,
           max(base + CASE WHEN rn <= n THEN 1 ELSE 0 END) FILTER (WHERE ord = 2)::int,
           max(base + CASE WHEN rn <= n THEN 1 ELSE 0 END) FILTER (WHERE ord = 3)::int
    FROM ranked CROSS JOIN leftover;
$$;
REVOKE ALL ON FUNCTION public.wallet_split_coins(int, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_split_coins(int, int, int, int) TO service_role;

-- Only the holder sets their usual split (a child in a family, or a teen).
CREATE OR REPLACE FUNCTION public.set_wallet_usual_split(p_holder uuid, p_actor uuid, p_save int, p_spend int, p_share int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_holder IS NULL OR p_save IS NULL OR p_spend IS NULL OR p_share IS NULL
       OR p_save NOT BETWEEN 0 AND 100 OR p_spend NOT BETWEEN 0 AND 100 OR p_share NOT BETWEEN 0 AND 100
       OR p_save + p_spend + p_share <> 100 THEN
        RAISE EXCEPTION 'SPLIT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF p_actor IS DISTINCT FROM p_holder THEN
        RAISE EXCEPTION 'SPLIT_OWNER_ONLY' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    INSERT INTO public.wallet_split_preferences (holder_user_id, save_pct, spend_pct, share_pct, updated_at)
    VALUES (p_holder, p_save, p_spend, p_share, now())
    ON CONFLICT (holder_user_id) DO UPDATE
        SET save_pct = EXCLUDED.save_pct, spend_pct = EXCLUDED.spend_pct, share_pct = EXCLUDED.share_pct, updated_at = now();
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'wallet.usual_split_set', p_holder::text,
            jsonb_build_object('save', p_save, 'spend', p_spend, 'share', p_share));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_wallet_usual_split(uuid, uuid, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_wallet_usual_split(uuid, uuid, int, int, int) TO service_role;

-- The split event: the default at this moment, computed here.
CREATE OR REPLACE FUNCTION public.record_wallet_split(p_holder uuid, p_source text, p_save int, p_spend int, p_share int, p_goal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_usual record;
    v_def   record;
    v_total int := p_save + p_spend + p_share;
BEGIN
    SELECT * INTO v_usual FROM public.wallet_usual_split(p_holder);
    SELECT * INTO v_def FROM public.wallet_split_coins(v_total, v_usual.save_pct, v_usual.spend_pct, v_usual.share_pct);
    INSERT INTO public.family_money_events (user_id, event, source, amount, save_amount, spend_amount, share_amount,
                                            default_save, default_spend, default_share, followed_default, goal_id)
    VALUES (p_holder, 'split_allocated', p_source, v_total, p_save, p_spend, p_share,
            v_def.save, v_def.spend, v_def.share, (p_save = v_def.save AND p_spend = v_def.spend AND p_share = v_def.share), p_goal_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_wallet_split(uuid, text, int, int, int, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- A goal the Save part just covered is reached in the same transaction.
CREATE OR REPLACE FUNCTION public.reach_goal_if_covered(p_goal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_target   int;
    v_progress bigint;
BEGIN
    IF p_goal_id IS NULL THEN
        RETURN;
    END IF;
    SELECT target INTO v_target FROM public.savings_goals WHERE id = p_goal_id AND status = 'active' FOR UPDATE;
    SELECT coalesce(sum(amount), 0) INTO v_progress FROM public.wallet_ledger WHERE goal_id = p_goal_id;
    IF v_target IS NOT NULL AND v_progress >= v_target THEN
        UPDATE public.savings_goals SET status = 'reached', reached_at = now() WHERE id = p_goal_id;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reach_goal_if_covered(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ── Chore rewards (supersedes enforce_banking_freeze's definition) ──────────
CREATE OR REPLACE FUNCTION public.allocate_task_reward(
    p_task_id     uuid,
    p_kid_user_id uuid,
    p_save        int,
    p_spend       int,
    p_share       int,
    p_created_by  uuid,
    p_goal_id     uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%ROWTYPE;
    v_goal_ok boolean;
BEGIN
    IF p_save < 0 OR p_spend < 0 OR p_share < 0 THEN
        RETURN false;
    END IF;
    IF p_goal_id IS NOT NULL THEN
        IF p_save <= 0 THEN
            RETURN false;
        END IF;
        SELECT EXISTS (
            SELECT 1 FROM public.savings_goals
            WHERE id = p_goal_id AND kid_user_id = p_kid_user_id AND status = 'active'
        ) INTO v_goal_ok;
        IF NOT v_goal_ok THEN
            RETURN false;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));
    IF NOT public.banking_movement_allowed(p_kid_user_id) THEN RETURN false; END IF;

    SELECT * INTO v_task FROM public.tasks
    WHERE id = p_task_id AND assigned_to = p_kid_user_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_task.status <> 'approved'
       OR v_task.allocated
       OR (p_save + p_spend + p_share) <> v_task.reward_coins
    THEN
        RETURN false;
    END IF;

    IF p_save > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, goal_id, created_by)
        VALUES (p_kid_user_id, 'save', p_save, 'task_approved', p_task_id, p_goal_id, p_created_by);
    END IF;
    IF p_spend > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, created_by)
        VALUES (p_kid_user_id, 'spend', p_spend, 'task_approved', p_task_id, p_created_by);
    END IF;
    IF p_share > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, created_by)
        VALUES (p_kid_user_id, 'share', p_share, 'task_approved', p_task_id, p_created_by);
    END IF;

    UPDATE public.tasks SET allocated = true WHERE id = p_task_id;
    PERFORM public.record_wallet_split(p_kid_user_id, 'task', p_save, p_spend, p_share, p_goal_id);
    PERFORM public.reach_goal_if_covered(p_goal_id);
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid, uuid) TO service_role;

-- ── Allowance payouts: the same rules, plus a goal tag for the Save part ────
DROP FUNCTION IF EXISTS public.allocate_pending_credit(uuid, uuid, int, int, int, uuid);
CREATE OR REPLACE FUNCTION public.allocate_pending_credit(
    p_credit_id   uuid,
    p_kid_user_id uuid,
    p_save        int,
    p_spend       int,
    p_share       int,
    p_created_by  uuid,
    p_goal_id     uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit public.pending_credits%ROWTYPE;
    v_goal_ok boolean;
BEGIN
    IF p_save < 0 OR p_spend < 0 OR p_share < 0 THEN
        RETURN false;
    END IF;
    IF p_goal_id IS NOT NULL THEN
        IF p_save <= 0 THEN
            RETURN false;
        END IF;
        SELECT EXISTS (
            SELECT 1 FROM public.savings_goals
            WHERE id = p_goal_id AND kid_user_id = p_kid_user_id AND status = 'active'
        ) INTO v_goal_ok;
        IF NOT v_goal_ok THEN
            RETURN false;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));
    IF NOT public.banking_movement_allowed(p_kid_user_id) THEN RETURN false; END IF;

    SELECT * INTO v_credit FROM public.pending_credits
    WHERE id = p_credit_id AND kid_user_id = p_kid_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_credit.allocated OR (p_save + p_spend + p_share) <> v_credit.amount THEN
        RETURN false;
    END IF;

    IF p_save > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by)
        VALUES (p_kid_user_id, 'save', p_save, 'allowance', p_goal_id, p_created_by);
    END IF;
    IF p_spend > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
        VALUES (p_kid_user_id, 'spend', p_spend, 'allowance', p_created_by);
    END IF;
    IF p_share > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
        VALUES (p_kid_user_id, 'share', p_share, 'allowance', p_created_by);
    END IF;

    UPDATE public.pending_credits SET allocated = true WHERE id = p_credit_id;
    PERFORM public.record_wallet_split(p_kid_user_id, 'allowance', p_save, p_spend, p_share, p_goal_id);
    PERFORM public.reach_goal_if_covered(p_goal_id);
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_pending_credit(uuid, uuid, int, int, int, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_pending_credit(uuid, uuid, int, int, int, uuid, uuid) TO service_role;

-- ── A teen's logged income (supersedes independent_teen_wallet_flows') ──────
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
    PERFORM public.reach_goal_if_covered(p_goal_id);
    PERFORM public.record_wallet_split(p_holder, 'income', p_save, p_spend, p_share, p_goal_id);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.self_income', p_holder::text,
            jsonb_build_object('action_id', v_action, 'amount', v_amount, 'source', p_source));
    RETURN v_action;
END;
$$;
REVOKE ALL ON FUNCTION public.teen_log_income(uuid, text, int, int, int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_log_income(uuid, text, int, int, int, uuid) TO service_role;

SELECT 'wallet_usual_split_ok' AS sentinel;
