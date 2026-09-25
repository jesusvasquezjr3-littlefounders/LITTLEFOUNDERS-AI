-- family_hub_wallet_integrity — S07.1, part 3 of 5 (D.4 / D.5, OD-21): guardian money actions,
-- an append-only never-overdrawn ledger and guardian-owned freezes.
-- @phase: contract
-- @after-release: none — the triggers narrow what even the service role may
--   write (no ledger edits, no overdraft, no child lifting a guardian freeze);
--   every write the current Core makes stays legal. Apply with the Core release that ships the
--   S07.1 routes, after family_hub_state_machine, never ahead of it.
--
-- Rationale and the full state-machine description: family_hub_state_machine
-- (part 1) and docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── Guardian money actions: who, why, and only for their own family ─────────
CREATE OR REPLACE FUNCTION public.guard_wallet_guardian_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
        IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['actor_user_id', 'goal_id'], to_jsonb(NEW)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'WALLET_ACTION_APPEND_ONLY' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.family_is_verified_guardian(NEW.actor_user_id, NEW.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF char_length(btrim(NEW.reason)) NOT BETWEEN 1 AND 240 THEN
        RAISE EXCEPTION 'WALLET_ACTION_REASON_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.kind = 'manual_adjustment' AND NEW.goal_id IS NOT NULL THEN
        RAISE EXCEPTION 'WALLET_ACTION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.kind = 'goal_withdrawal' AND NOT EXISTS (
        SELECT 1 FROM public.savings_goals WHERE id = NEW.goal_id AND kid_user_id = NEW.kid_user_id
    ) THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_wallet_guardian_action() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS wallet_guardian_action_guard ON public.wallet_guardian_actions;
CREATE TRIGGER wallet_guardian_action_guard BEFORE INSERT OR UPDATE ON public.wallet_guardian_actions
    FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_guardian_action();

-- At commit, a guardian action must have exactly the ledger rows it describes:
-- one row of the stated amount for an adjustment; a balanced debit/credit pair
-- for a withdrawal. A half-written money movement cannot commit.
CREATE OR REPLACE FUNCTION public.check_wallet_guardian_action_balanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_rows int;
    v_sum  bigint;
BEGIN
    SELECT count(*), coalesce(sum(amount), 0) INTO v_rows, v_sum
    FROM public.wallet_ledger WHERE guardian_action_id = NEW.id;
    IF (NEW.kind = 'manual_adjustment' AND (v_rows <> 1 OR v_sum <> NEW.amount))
       OR (NEW.kind = 'goal_withdrawal' AND (v_rows <> 2 OR v_sum <> 0)) THEN
        RAISE EXCEPTION 'WALLET_ACTION_UNBALANCED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_wallet_guardian_action_balanced() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS wallet_guardian_action_balanced ON public.wallet_guardian_actions;
CREATE CONSTRAINT TRIGGER wallet_guardian_action_balanced AFTER INSERT ON public.wallet_guardian_actions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_wallet_guardian_action_balanced();

-- ── Wallet ledger: append-only, reason-shaped, never overdrawn ──────────────
CREATE OR REPLACE FUNCTION public.guard_wallet_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_action   public.wallet_guardian_actions%ROWTYPE;
    v_bucket   bigint;
    v_goal     bigint;
    v_tagged   bigint;
    v_goal_kid uuid;
    v_goal_status text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
        IF v_changed = '{}'::text[]
           OR public.family_only_nulled(v_changed, ARRAY['task_id', 'goal_id', 'redemption_id', 'guardian_action_id'], to_jsonb(NEW)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'LEDGER_APPEND_ONLY' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.goal_id IS NOT NULL THEN
        SELECT kid_user_id, status INTO v_goal_kid, v_goal_status FROM public.savings_goals WHERE id = NEW.goal_id;
        IF v_goal_kid IS DISTINCT FROM NEW.kid_user_id OR NEW.bucket <> 'save' THEN
            RAISE EXCEPTION 'LEDGER_GOAL_INVALID' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF NEW.reason IN ('manual_adjustment', 'goal_withdrawal') THEN
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
DROP TRIGGER IF EXISTS wallet_ledger_entry_guard ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_entry_guard BEFORE INSERT OR UPDATE ON public.wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_ledger_entry();

-- ── Banking account: a child never lifts a guardian's freeze ────────────────
CREATE OR REPLACE FUNCTION public.guard_banking_account_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.opened_by <> NEW.kid_user_id AND NOT public.family_is_verified_guardian(NEW.opened_by, NEW.kid_user_id) THEN
            RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.frozen OR NEW.frozen_by IS NOT NULL OR NEW.frozen_at IS NOT NULL THEN
            RAISE EXCEPTION 'ACCOUNT_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.kid_user_id IS DISTINCT FROM OLD.kid_user_id OR NEW.display_number IS DISTINCT FROM OLD.display_number
       OR NEW.opened_by IS DISTINCT FROM OLD.opened_by OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
        RAISE EXCEPTION 'ACCOUNT_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.frozen IS DISTINCT FROM OLD.frozen OR NEW.frozen_by IS DISTINCT FROM OLD.frozen_by
       OR NEW.frozen_at IS DISTINCT FROM OLD.frozen_at THEN
        IF NEW.frozen_by IS NULL OR (NEW.frozen_by <> NEW.kid_user_id
                                     AND NOT public.family_is_verified_guardian(NEW.frozen_by, NEW.kid_user_id)) THEN
            RAISE EXCEPTION 'FREEZE_ACTOR_INVALID' USING ERRCODE = 'P0001';
        END IF;
        -- A freeze placed by anyone but the child (or with no recorded owner)
        -- belongs to the guardians: the child can neither lift it nor re-own it.
        IF OLD.frozen AND OLD.frozen_by IS DISTINCT FROM OLD.kid_user_id AND NEW.frozen_by = NEW.kid_user_id THEN
            RAISE EXCEPTION 'FREEZE_OWNED_BY_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF (NEW.frozen AND NEW.frozen_at IS NULL) OR (NOT NEW.frozen AND NEW.frozen_at IS NOT NULL) THEN
            RAISE EXCEPTION 'ACCOUNT_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_banking_account_state() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS banking_account_state_guard ON public.banking_accounts;
CREATE TRIGGER banking_account_state_guard BEFORE INSERT OR UPDATE ON public.banking_accounts
    FOR EACH ROW EXECUTE FUNCTION public.guard_banking_account_state();

SELECT 'family_hub_wallet_integrity_ok' AS sentinel;
