-- wallet_move_flows — part 2 of 2 (wallet_moves): the goal rules and the flows.
-- @phase: expand
--
-- The goal guard is replaced by one that keeps every earlier rule word for word
-- and lets a goal's target change ONLY inside wallet_goal_edit (a transaction-
-- local marker; a plain UPDATE of the target is still refused). The provenance
-- breakdown counts coins a holder moved into a goal as their own (D.16). Then
-- the producing flows: move between pockets, into and out of a goal, edit a
-- goal, and remove a goal without stranding its coins. Apply after wallet_moves.
--
-- Rationale: wallet_moves (part 1) holds the why.

-- ── The goal guard (supersedes independent_teen_wallet_guards'): a goal's target
-- is still immutable, except inside wallet_goal_edit, which marks its own
-- transaction. Every other rule is kept. ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_savings_goal_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_progress bigint;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF public.wallet_holder_kind(NEW.kid_user_id) IS NULL THEN
            RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status <> 'active' OR NEW.reached_at IS NOT NULL THEN
            RAISE EXCEPTION 'GOAL_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'kid_user_id', 'created_at'] THEN
        RAISE EXCEPTION 'GOAL_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    IF 'target' = ANY (v_changed) AND coalesce(current_setting('lf.goal_edit', true), '') <> NEW.id::text THEN
        RAISE EXCEPTION 'GOAL_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'active' AND NEW.status = 'reached' THEN
            SELECT coalesce(sum(amount), 0) INTO v_progress FROM public.wallet_ledger WHERE goal_id = NEW.id;
            IF v_progress < NEW.target OR NEW.reached_at IS NULL THEN
                RAISE EXCEPTION 'GOAL_NOT_REACHED' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status IN ('active', 'reached') AND NEW.status = 'archived' THEN
            IF NEW.reached_at IS DISTINCT FROM OLD.reached_at THEN
                RAISE EXCEPTION 'GOAL_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            RAISE EXCEPTION 'GOAL_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
                DETAIL = format('%s -> %s', OLD.status, NEW.status);
        END IF;
    ELSIF 'reached_at' = ANY (v_changed) THEN
        RAISE EXCEPTION 'GOAL_STATE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_savings_goal_state() FROM PUBLIC, anon, authenticated, service_role;

-- ── D.16: coins a holder moved into a goal are their own ────────────────────
CREATE OR REPLACE FUNCTION public.goal_progress_breakdown(p_goal_ids uuid[])
RETURNS TABLE (goal_id uuid, own bigint, bonus bigint, family bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH sums AS (
        SELECT g.id,
               coalesce(sum(l.amount) FILTER (WHERE l.amount > 0 AND l.reason IN ('task_approved', 'allowance', 'self_income', 'goal_move')), 0) AS own_in,
               coalesce(sum(l.amount) FILTER (WHERE l.amount > 0 AND l.reason = 'savings_bonus'), 0) AS bonus_in,
               coalesce(sum(l.amount) FILTER (WHERE l.amount > 0 AND l.reason NOT IN ('task_approved', 'allowance', 'self_income', 'goal_move', 'savings_bonus')), 0) AS family_in,
               coalesce(-sum(l.amount) FILTER (WHERE l.amount < 0), 0) AS taken
        FROM unnest(p_goal_ids) AS g (id)
        LEFT JOIN public.wallet_ledger l ON l.goal_id = g.id
        GROUP BY g.id
    ), attributed AS (
        SELECT id, own_in, bonus_in, family_in, taken,
               greatest(own_in - taken, 0) AS own_left,
               greatest(taken - own_in, 0) AS after_own
        FROM sums
    )
    SELECT id,
           own_left,
           greatest(bonus_in - greatest(after_own - family_in, 0), 0),
           greatest(family_in - after_own, 0),
           own_in + bonus_in + family_in - taken
    FROM attributed;
$$;
REVOKE ALL ON FUNCTION public.goal_progress_breakdown(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goal_progress_breakdown(uuid[]) TO service_role;

-- ── Producing flows (service role only, serialized on the holder's wallet lock,
-- audited in the same transaction) ──────────────────────────────────────────

-- Coins from one pocket to another, whole coins, nothing leaves the account.
CREATE OR REPLACE FUNCTION public.wallet_move_pocket(p_holder uuid, p_from text, p_to text, p_amount int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_move uuid;
BEGIN
    IF p_holder IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from = p_to
       OR p_from NOT IN ('save', 'spend', 'share') OR p_to NOT IN ('save', 'spend', 'share')
       OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 100000 THEN
        RAISE EXCEPTION 'WALLET_MOVE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    INSERT INTO public.wallet_moves (holder_user_id, kind, amount, from_bucket, to_bucket)
    VALUES (p_holder, 'pocket', p_amount, p_from, p_to)
    RETURNING id INTO v_move;
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id)
    VALUES (p_holder, p_from, -p_amount, 'pocket_move', p_holder, v_move);
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id)
    VALUES (p_holder, p_to, p_amount, 'pocket_move', p_holder, v_move);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.pocket_move', p_holder::text,
            jsonb_build_object('move_id', v_move, 'from', p_from, 'to', p_to, 'amount', p_amount));
    RETURN v_move;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_move_pocket(uuid, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_move_pocket(uuid, text, text, int) TO service_role;

-- Coins into a goal from plain Save ('in'), or out of a goal back to plain Save
-- ('out'). An active goal takes coins; a goal in any state gives them back.
-- A goal the coins cover is reached in the same transaction.
CREATE OR REPLACE FUNCTION public.wallet_move_goal(p_holder uuid, p_goal uuid, p_direction text, p_amount int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_move   uuid;
    v_status text;
BEGIN
    IF p_holder IS NULL OR p_goal IS NULL OR p_direction IS NULL OR p_direction NOT IN ('in', 'out')
       OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 100000 THEN
        RAISE EXCEPTION 'WALLET_MOVE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    SELECT status INTO v_status FROM public.savings_goals WHERE id = p_goal AND kid_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF p_direction = 'in' AND v_status <> 'active' THEN
        RAISE EXCEPTION 'GOAL_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.wallet_moves (holder_user_id, kind, amount, goal_id)
    VALUES (p_holder, CASE p_direction WHEN 'in' THEN 'goal_in' ELSE 'goal_out' END, p_amount, p_goal)
    RETURNING id INTO v_move;
    IF p_direction = 'in' THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id)
        VALUES (p_holder, 'save', -p_amount, 'goal_move', p_holder, v_move);
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, move_id)
        VALUES (p_holder, 'save', p_amount, 'goal_move', p_goal, p_holder, v_move);
        PERFORM public.reach_goal_if_covered(p_goal);
    ELSE
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, move_id)
        VALUES (p_holder, 'save', -p_amount, 'goal_move', p_goal, p_holder, v_move);
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id)
        VALUES (p_holder, 'save', p_amount, 'goal_move', p_holder, v_move);
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.goal_move', p_holder::text,
            jsonb_build_object('move_id', v_move, 'goal_id', p_goal, 'direction', p_direction, 'amount', p_amount));
    RETURN v_move;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_move_goal(uuid, uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_move_goal(uuid, uuid, text, int) TO service_role;

-- Rename a goal, change its picture, or change how much it needs. A reached
-- goal keeps its target (it was reached at that number); an active goal whose
-- new target the coins already cover is reached in the same transaction.
CREATE OR REPLACE FUNCTION public.wallet_goal_edit(p_holder uuid, p_goal uuid, p_title text, p_target int, p_icon text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_goal  public.savings_goals%ROWTYPE;
    v_title text := btrim(coalesce(p_title, ''));
BEGIN
    IF p_holder IS NULL OR p_goal IS NULL OR char_length(v_title) NOT BETWEEN 1 AND 80
       OR p_target IS NULL OR p_target NOT BETWEEN 1 AND 100000
       OR p_icon IS NULL OR p_icon NOT IN ('star', 'game', 'toy', 'book', 'bike', 'trip', 'gift') THEN
        RAISE EXCEPTION 'GOAL_EDIT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    SELECT * INTO v_goal FROM public.savings_goals WHERE id = p_goal AND kid_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_goal.status = 'archived' THEN
        RAISE EXCEPTION 'GOAL_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;
    IF v_goal.status = 'reached' AND p_target <> v_goal.target THEN
        RAISE EXCEPTION 'GOAL_EDIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
    PERFORM set_config('lf.goal_edit', p_goal::text, true);
    UPDATE public.savings_goals SET title = v_title, target = p_target, icon = p_icon WHERE id = p_goal;
    PERFORM set_config('lf.goal_edit', '', true);
    PERFORM public.reach_goal_if_covered(p_goal);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.goal_edited', p_holder::text,
            jsonb_build_object('goal_id', p_goal, 'target', p_target));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_goal_edit(uuid, uuid, text, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_goal_edit(uuid, uuid, text, int, text) TO service_role;

-- Remove a goal: whatever it holds goes back to plain Save in the same
-- transaction, so deleting a goal can never strand coins. Returns the coins
-- that went back.
CREATE OR REPLACE FUNCTION public.wallet_goal_archive(p_holder uuid, p_goal uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_status text;
    v_held   bigint;
    v_move   uuid;
BEGIN
    IF p_holder IS NULL OR p_goal IS NULL THEN
        RAISE EXCEPTION 'WALLET_MOVE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    SELECT status INTO v_status FROM public.savings_goals WHERE id = p_goal AND kid_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_status = 'archived' THEN
        RETURN 0;
    END IF;
    SELECT coalesce(sum(amount), 0) INTO v_held FROM public.wallet_ledger WHERE goal_id = p_goal;
    IF v_held > 0 THEN
        INSERT INTO public.wallet_moves (holder_user_id, kind, amount, goal_id)
        VALUES (p_holder, 'goal_out', v_held, p_goal) RETURNING id INTO v_move;
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, move_id)
        VALUES (p_holder, 'save', -v_held, 'goal_move', p_goal, p_holder, v_move);
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id)
        VALUES (p_holder, 'save', v_held, 'goal_move', p_holder, v_move);
    END IF;
    UPDATE public.savings_goals SET status = 'archived' WHERE id = p_goal;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.goal_archived', p_holder::text,
            jsonb_build_object('goal_id', p_goal, 'returned', v_held));
    RETURN v_held::int;
END;
$$;
REVOKE ALL ON FUNCTION public.wallet_goal_archive(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_goal_archive(uuid, uuid) TO service_role;

SELECT 'wallet_move_flows_ok' AS sentinel;
