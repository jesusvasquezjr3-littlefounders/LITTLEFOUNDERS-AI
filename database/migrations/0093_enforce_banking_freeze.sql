-- @phase: expand
-- D.1: serialize movement with account freeze using the banking account row.
-- Existing wallet advisory locks remain first; freeze takes only the account row.
CREATE OR REPLACE FUNCTION public.banking_movement_allowed(p_kid_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE frozen_now boolean;
BEGIN
    SELECT frozen INTO frozen_now FROM public.banking_accounts
        WHERE kid_user_id = p_kid_user_id FOR UPDATE;
    RETURN NOT coalesce(frozen_now, false);
END;
$$;
REVOKE ALL ON FUNCTION public.banking_movement_allowed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.banking_movement_allowed(uuid) TO service_role;

-- Browser clients may edit presentation only. Freeze is an authorized Core action.
REVOKE UPDATE ON public.banking_accounts FROM anon, authenticated;
GRANT UPDATE (nickname, card_design) ON public.banking_accounts TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_frozen_redemption_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT public.banking_movement_allowed(NEW.kid_user_id) THEN
        RAISE EXCEPTION 'ACCOUNT_FROZEN' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_frozen_redemption_request() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER frozen_redemption_admission BEFORE INSERT ON public.redemptions
FOR EACH ROW EXECUTE FUNCTION public.guard_frozen_redemption_request();

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
    -- A goal tag only makes sense when there is money going into Save, and
    -- only for a goal that is actually this kid's own active one — the same
    -- ownership discipline every other guardian-scoped read in this schema
    -- already applies, checked here rather than trusted from the caller.
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
    RETURN true;
END;
$$;

create or replace function public.allocate_pending_credit(
    p_credit_id  uuid,
    p_kid_user_id uuid,
    p_save       int,
    p_spend      int,
    p_share      int,
    p_created_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_credit public.pending_credits%rowtype;
begin
    if p_save < 0 or p_spend < 0 or p_share < 0 then
        return false;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));
    IF NOT public.banking_movement_allowed(p_kid_user_id) THEN RETURN false; END IF;

    select * into v_credit from public.pending_credits
    where id = p_credit_id and kid_user_id = p_kid_user_id
    for update;

    if not found or v_credit.allocated or (p_save + p_spend + p_share) <> v_credit.amount then
        return false;
    end if;

    if p_save > 0 then
        insert into public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
        values (p_kid_user_id, 'save', p_save, 'allowance', p_created_by);
    end if;
    if p_spend > 0 then
        insert into public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
        values (p_kid_user_id, 'spend', p_spend, 'allowance', p_created_by);
    end if;
    if p_share > 0 then
        insert into public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
        values (p_kid_user_id, 'share', p_share, 'allowance', p_created_by);
    end if;

    update public.pending_credits set allocated = true where id = p_credit_id;
    return true;
end;
$$;

create or replace function public.run_due_scheduled_credits(p_kid_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_allowance public.allowance_rules%rowtype;
    v_bonus     public.savings_bonus_rules%rowtype;
    v_credited  int := 0;
    v_iter      int;
    v_save_balance int;
    v_bonus_amount int;
    v_step      interval;
begin
    perform pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));
    IF NOT public.banking_movement_allowed(p_kid_user_id) THEN RETURN 0; END IF;

    select * into v_allowance from public.allowance_rules
    where kid_user_id = p_kid_user_id and active for update;

    if found then
        v_step := case v_allowance.frequency
            when 'weekly' then interval '7 days'
            when 'biweekly' then interval '14 days'
            else interval '1 month'
        end;
        v_iter := 0;
        while v_allowance.next_run_at <= now() and v_iter < 8 loop
            insert into public.pending_credits (kid_user_id, amount, source, source_ref)
            values (p_kid_user_id, v_allowance.amount, 'allowance', v_allowance.id);
            v_allowance.next_run_at := v_allowance.next_run_at + v_step;
            v_iter := v_iter + 1;
            v_credited := v_credited + 1;
        end loop;
        -- Fast-forward without crediting if still overdue past the cap.
        while v_allowance.next_run_at <= now() loop
            v_allowance.next_run_at := v_allowance.next_run_at + v_step;
        end loop;
        update public.allowance_rules set next_run_at = v_allowance.next_run_at where id = v_allowance.id;
    end if;

    select * into v_bonus from public.savings_bonus_rules
    where kid_user_id = p_kid_user_id and active for update;

    if found then
        v_iter := 0;
        while v_bonus.next_run_at <= now() and v_iter < 8 loop
            select coalesce(sum(amount), 0) into v_save_balance
            from public.wallet_ledger where kid_user_id = p_kid_user_id and bucket = 'save';
            v_bonus_amount := floor(greatest(v_save_balance, 0) * v_bonus.rate_bp / 10000.0);
            if v_bonus_amount > 0 then
                insert into public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
                values (p_kid_user_id, 'save', v_bonus_amount, 'savings_bonus', p_kid_user_id);
            end if;
            v_bonus.next_run_at := v_bonus.next_run_at + interval '7 days';
            v_iter := v_iter + 1;
            v_credited := v_credited + 1;
        end loop;
        while v_bonus.next_run_at <= now() loop
            v_bonus.next_run_at := v_bonus.next_run_at + interval '7 days';
        end loop;
        update public.savings_bonus_rules set next_run_at = v_bonus.next_run_at where kid_user_id = p_kid_user_id;
    end if;

    return v_credited;
end;
$$;

CREATE OR REPLACE FUNCTION public.decide_redemption(
    p_redemption_id uuid,
    p_approve       boolean,
    p_decided_by    uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kid_user_id uuid;
    v_redemption  public.redemptions%ROWTYPE;
    v_cost        int;
    v_balance     int;
BEGIN
    -- Lock ordering matches allocate_task_reward: the advisory lock (keyed on
    -- the kid, same lock space — tag 1) is taken BEFORE any row lock, so the
    -- two functions can never deadlock against each other for the same kid.
    -- A cheap, unlocked read gets the key; the authoritative row is re-read
    -- FOR UPDATE only after the lock is held.
    SELECT kid_user_id INTO v_kid_user_id FROM public.redemptions WHERE id = p_redemption_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid_user_id::text, 1));
    IF p_approve AND NOT public.banking_movement_allowed(v_kid_user_id) THEN RETURN false; END IF;

    SELECT * INTO v_redemption FROM public.redemptions
    WHERE id = p_redemption_id
    FOR UPDATE;

    IF NOT FOUND OR v_redemption.status <> 'requested' THEN
        RETURN false;
    END IF;

    IF NOT p_approve THEN
        UPDATE public.redemptions
        SET status = 'denied', decided_at = now(), decided_by = p_decided_by
        WHERE id = p_redemption_id;
        RETURN true;
    END IF;

    SELECT cost INTO v_cost FROM public.redemption_catalog WHERE id = v_redemption.catalog_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.wallet_ledger
    WHERE kid_user_id = v_redemption.kid_user_id AND bucket = 'spend';

    IF v_cost IS NULL OR v_balance < v_cost THEN
        RETURN false;
    END IF;

    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, redemption_id, created_by)
    VALUES (v_redemption.kid_user_id, 'spend', -v_cost, 'redemption', p_redemption_id, p_decided_by);

    UPDATE public.redemptions
    SET status = 'approved', decided_at = now(), decided_by = p_decided_by
    WHERE id = p_redemption_id;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid,uuid,int,int,int,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_task_reward(uuid,uuid,int,int,int,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.allocate_pending_credit(uuid,uuid,int,int,int,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_pending_credit(uuid,uuid,int,int,int,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.run_due_scheduled_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_due_scheduled_credits(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.decide_redemption(uuid,boolean,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_redemption(uuid,boolean,uuid) TO service_role;
