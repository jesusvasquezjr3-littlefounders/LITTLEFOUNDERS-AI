-- independent_teen_wallet_ledger — S07.2, part 3 of 5 (D.3, OD-3 Option B): the
-- append-only ledger learns the teen's three reasons, and every wallet row
-- needs a wallet holder.
-- @phase: contract
-- @after-release: none — replaces the S07.1 ledger guard with a strictly
--   narrower one: every S07.1 rule is kept verbatim, a new row now needs a
--   wallet holder (no adult ever holds a wallet) and the teen's reasons must
--   match the self action they point at. Every write the current Core makes
--   stays legal. Apply with the Core release that ships the S07.2 routes,
--   after independent_teen_wallet_schema, never ahead of it.
--
-- Rationale: independent_teen_wallet_schema (part 1) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

CREATE OR REPLACE FUNCTION public.guard_wallet_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_action   public.wallet_guardian_actions%ROWTYPE;
    v_self     public.wallet_self_actions%ROWTYPE;
    v_bucket   bigint;
    v_goal     bigint;
    v_tagged   bigint;
    v_goal_kid uuid;
    v_goal_status text;
    v_split    int;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
        IF v_changed = '{}'::text[]
           OR public.family_only_nulled(v_changed, ARRAY['task_id', 'goal_id', 'redemption_id', 'guardian_action_id', 'self_action_id'], to_jsonb(NEW)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'LEDGER_APPEND_ONLY' USING ERRCODE = 'P0001';
    END IF;

    -- OD-3: a wallet belongs to a parent-created child or an eligible teen.
    -- Adults never hold one, whoever writes the row.
    IF public.wallet_holder_kind(NEW.kid_user_id) IS NULL THEN
        RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.goal_id IS NOT NULL THEN
        SELECT kid_user_id, status INTO v_goal_kid, v_goal_status FROM public.savings_goals WHERE id = NEW.goal_id;
        IF v_goal_kid IS DISTINCT FROM NEW.kid_user_id OR NEW.bucket <> 'save' THEN
            RAISE EXCEPTION 'LEDGER_GOAL_INVALID' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.reason IN ('self_income', 'personal_reward', 'goal_release') THEN
        SELECT * INTO v_self FROM public.wallet_self_actions WHERE id = NEW.self_action_id;
        IF NOT FOUND OR NEW.guardian_action_id IS NOT NULL OR v_self.kind <> NEW.reason
           OR v_self.holder_user_id <> NEW.kid_user_id OR NEW.created_by <> NEW.kid_user_id
           OR NEW.task_id IS NOT NULL OR NEW.redemption_id IS NOT NULL THEN
            RAISE EXCEPTION 'LEDGER_SELF_ACTION_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason = 'self_income' THEN
            v_split := CASE NEW.bucket WHEN 'save' THEN v_self.save_amount WHEN 'spend' THEN v_self.spend_amount ELSE v_self.share_amount END;
            IF NEW.amount <= 0 OR NEW.amount <> v_split
               OR (NEW.bucket = 'save' AND NEW.goal_id IS DISTINCT FROM v_self.goal_id)
               OR (NEW.bucket <> 'save' AND NEW.goal_id IS NOT NULL)
               OR (NEW.goal_id IS NOT NULL AND v_goal_status <> 'active')
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id AND bucket = NEW.bucket) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason = 'personal_reward' THEN
            IF NEW.amount <> -v_self.amount OR NEW.bucket <> 'spend' OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.amount < 0 THEN
            IF NEW.amount <> -v_self.amount OR NEW.bucket <> 'save' OR NEW.goal_id IS DISTINCT FROM v_self.goal_id
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id AND amount < 0) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            IF NEW.amount <> v_self.amount OR NEW.bucket <> v_self.destination OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id AND amount > 0) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    ELSIF NEW.self_action_id IS NOT NULL THEN
        RAISE EXCEPTION 'LEDGER_REASON_INVALID' USING ERRCODE = 'P0001';
    ELSIF NEW.reason IN ('manual_adjustment', 'goal_withdrawal') THEN
        SELECT * INTO v_action FROM public.wallet_guardian_actions WHERE id = NEW.guardian_action_id;
        IF NOT FOUND OR v_action.kind <> NEW.reason OR v_action.kid_user_id <> NEW.kid_user_id
           OR v_action.actor_user_id IS DISTINCT FROM NEW.created_by THEN
            RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason = 'manual_adjustment' THEN
            IF NEW.amount <> v_action.amount OR NEW.bucket <> v_action.bucket OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE guardian_action_id = v_action.id) THEN
                RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.amount < 0 THEN
            IF NEW.amount <> -v_action.amount OR NEW.bucket <> 'save' OR NEW.goal_id IS DISTINCT FROM v_action.goal_id
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE guardian_action_id = v_action.id AND amount < 0) THEN
                RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            IF NEW.amount <> v_action.amount OR NEW.bucket <> v_action.bucket OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE guardian_action_id = v_action.id AND amount > 0) THEN
                RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    ELSE
        IF NEW.guardian_action_id IS NOT NULL THEN
            RAISE EXCEPTION 'LEDGER_REASON_INVALID' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason = 'task_approved' THEN
            IF NEW.amount <= 0 OR NOT EXISTS (
                SELECT 1 FROM public.tasks
                WHERE id = NEW.task_id AND assigned_to = NEW.kid_user_id AND status = 'approved' AND NOT allocated
            ) THEN
                RAISE EXCEPTION 'LEDGER_TASK_INVALID' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.goal_id IS NOT NULL AND v_goal_status <> 'active' THEN
                RAISE EXCEPTION 'LEDGER_GOAL_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason = 'redemption' THEN
            IF NEW.amount >= 0 OR NEW.bucket <> 'spend' OR NEW.goal_id IS NOT NULL OR NOT EXISTS (
                SELECT 1 FROM public.redemptions
                WHERE id = NEW.redemption_id AND kid_user_id = NEW.kid_user_id AND status = 'requested'
            ) OR EXISTS (
                SELECT 1 FROM public.wallet_ledger WHERE redemption_id = NEW.redemption_id AND reason = 'redemption'
            ) THEN
                RAISE EXCEPTION 'LEDGER_REDEMPTION_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason IN ('allowance', 'savings_bonus') THEN
            IF NEW.amount <= 0 OR NEW.goal_id IS NOT NULL OR (NEW.reason = 'savings_bonus' AND NEW.bucket <> 'save') THEN
                RAISE EXCEPTION 'LEDGER_CREDIT_INVALID' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    -- No debit may overdraw a bucket, a goal, or the savings reserved for goals.
    IF NEW.amount < 0 THEN
        IF NEW.goal_id IS NOT NULL THEN
            SELECT coalesce(sum(amount), 0) INTO v_goal FROM public.wallet_ledger WHERE goal_id = NEW.goal_id;
            IF v_goal + NEW.amount < 0 THEN
                RAISE EXCEPTION 'GOAL_BALANCE_INSUFFICIENT' USING ERRCODE = 'P0001';
            END IF;
        END IF;
        SELECT coalesce(sum(amount), 0) INTO v_bucket FROM public.wallet_ledger
        WHERE kid_user_id = NEW.kid_user_id AND bucket = NEW.bucket;
        IF v_bucket + NEW.amount < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.goal_id IS NULL AND NEW.bucket = 'save' THEN
            SELECT coalesce(sum(amount), 0) INTO v_tagged FROM public.wallet_ledger
            WHERE kid_user_id = NEW.kid_user_id AND bucket = 'save' AND goal_id IS NOT NULL;
            IF v_bucket - v_tagged + NEW.amount < 0 THEN
                RAISE EXCEPTION 'GOAL_SAVINGS_PROTECTED' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_wallet_ledger_entry() FROM PUBLIC, anon, authenticated, service_role;

SELECT 'independent_teen_wallet_ledger_ok' AS sentinel;
