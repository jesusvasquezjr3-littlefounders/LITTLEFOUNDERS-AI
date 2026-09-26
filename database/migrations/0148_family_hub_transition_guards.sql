-- family_hub_transition_guards — S07.1, part 2 of 5 (D.4 / D.5, OD-21): task, goal, catalog and
-- redemption transitions enforced for every writer, the service role included.
-- @phase: contract
-- @after-release: none — the triggers narrow what even the service role may
--   write; every transition the current Core makes stays legal (verified on
--   native PostgreSQL against the real migration chain). Apply with the Core release that ships the
--   S07.1 routes, after family_hub_state_machine, never ahead of it.
--
-- Rationale and the full state-machine description: family_hub_state_machine
-- (part 1) and docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── Task state machine ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_task_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'open' OR NEW.allocated OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.cancel_reason IS NOT NULL OR NEW.evidence_bucket IS NOT NULL OR NEW.evidence_hash IS NOT NULL
           OR NEW.evidence_ext IS NOT NULL OR NEW.evidence_uploaded_at IS NOT NULL THEN
            RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'A task is created open, unallocated, undecided and without evidence.';
        END IF;
        IF NEW.reward_coins NOT BETWEEN 1 AND 500 THEN
            RAISE EXCEPTION 'TASK_REWARD_OUT_OF_RANGE' USING ERRCODE = 'P0001';
        END IF;
        IF NOT public.family_is_verified_guardian(NEW.assigned_by, NEW.assigned_to) THEN
            RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['decided_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'assigned_by', 'assigned_to', 'title', 'reward_coins', 'recurrence', 'due_at',
                          'requires_evidence', 'created_at'] THEN
        RAISE EXCEPTION 'TASK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    IF v_changed && ARRAY['evidence_bucket', 'evidence_hash', 'evidence_ext', 'evidence_uploaded_at']
       AND (OLD.status NOT IN ('open', 'done') OR NEW.status IS DISTINCT FROM OLD.status) THEN
        RAISE EXCEPTION 'TASK_EVIDENCE_LOCKED' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'open' AND NEW.status = 'done' THEN
            IF v_changed && ARRAY['decided_by', 'decided_at', 'cancel_reason', 'allocated'] THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status = 'done' AND NEW.status = 'approved' THEN
            IF NEW.requires_evidence AND (NEW.evidence_bucket IS NULL OR NEW.evidence_hash IS NULL OR NEW.evidence_ext IS NULL) THEN
                RAISE EXCEPTION 'TASK_EVIDENCE_REQUIRED' USING ERRCODE = 'P0001';
            END IF;
            IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.assigned_to) OR NEW.decided_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.allocated OR NEW.cancel_reason IS NOT NULL THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status IN ('open', 'done') AND NEW.status = 'cancelled' THEN
            IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.assigned_to) OR NEW.decided_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.allocated THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            RAISE EXCEPTION 'TASK_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
                DETAIL = format('%s -> %s', OLD.status, NEW.status);
        END IF;
    ELSIF v_changed && ARRAY['decided_by', 'decided_at', 'cancel_reason'] THEN
        RAISE EXCEPTION 'TASK_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;

    IF 'allocated' = ANY (v_changed) AND (OLD.allocated OR NEW.status <> 'approved') THEN
        RAISE EXCEPTION 'TASK_ALLOCATION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_task_state() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS task_state_guard ON public.tasks;
CREATE TRIGGER task_state_guard BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.guard_task_state();

-- ── Savings goal state machine ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_savings_goal_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_progress bigint;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'active' OR NEW.reached_at IS NOT NULL THEN
            RAISE EXCEPTION 'GOAL_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'kid_user_id', 'target', 'created_at'] THEN
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
DROP TRIGGER IF EXISTS savings_goal_state_guard ON public.savings_goals;
CREATE TRIGGER savings_goal_state_guard BEFORE INSERT OR UPDATE ON public.savings_goals
    FOR EACH ROW EXECUTE FUNCTION public.guard_savings_goal_state();

-- ── Reward catalog: bounded costs, fixed ownership ──────────────────────────
CREATE OR REPLACE FUNCTION public.guard_redemption_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.parent_user_id IS DISTINCT FROM OLD.parent_user_id
                              OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
        RAISE EXCEPTION 'CATALOG_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW.cost IS DISTINCT FROM OLD.cost) AND NEW.cost NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'CATALOG_COST_OUT_OF_RANGE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_redemption_catalog() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS redemption_catalog_guard ON public.redemption_catalog;
CREATE TRIGGER redemption_catalog_guard BEFORE INSERT OR UPDATE ON public.redemption_catalog
    FOR EACH ROW EXECUTE FUNCTION public.guard_redemption_catalog();

-- ── Redemption state machine ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_redemption_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_item    public.redemption_catalog%ROWTYPE;
    v_limit   public.spend_limits%ROWTYPE;
    v_used    bigint;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'requested' OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.fulfilled_by IS NOT NULL OR NEW.fulfilled_at IS NOT NULL THEN
            RAISE EXCEPTION 'REDEMPTION_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        SELECT * INTO v_item FROM public.redemption_catalog WHERE id = NEW.catalog_id;
        IF NOT FOUND OR NOT v_item.active OR NOT public.family_is_verified_guardian(v_item.parent_user_id, NEW.kid_user_id) THEN
            RAISE EXCEPTION 'REWARD_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        -- The same rolling-window spend limit Core checks at request time.
        SELECT * INTO v_limit FROM public.spend_limits WHERE kid_user_id = NEW.kid_user_id AND active;
        IF FOUND THEN
            SELECT coalesce(-sum(amount), 0) INTO v_used FROM public.wallet_ledger
            WHERE kid_user_id = NEW.kid_user_id AND bucket = 'spend' AND reason = 'redemption'
              AND created_at >= now() - CASE WHEN v_limit.period = 'weekly' THEN interval '7 days' ELSE interval '30 days' END;
            IF v_used + v_item.cost > v_limit.cap THEN
                RAISE EXCEPTION 'SPEND_LIMIT_REACHED' USING ERRCODE = 'P0001';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['fulfilled_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'catalog_id', 'kid_user_id', 'created_at'] THEN
        RAISE EXCEPTION 'REDEMPTION_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'requested' AND NEW.status IN ('approved', 'denied') THEN
            IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.kid_user_id) OR NEW.decided_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.fulfilled_by IS NOT NULL OR NEW.fulfilled_at IS NOT NULL THEN
                RAISE EXCEPTION 'REDEMPTION_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.status = 'approved' AND NOT EXISTS (
                SELECT 1 FROM public.wallet_ledger
                WHERE redemption_id = NEW.id AND reason = 'redemption' AND amount < 0
            ) THEN
                RAISE EXCEPTION 'REDEMPTION_NOT_PAID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status = 'approved' AND NEW.status = 'fulfilled' THEN
            IF NOT public.family_is_verified_guardian(NEW.fulfilled_by, NEW.kid_user_id) OR NEW.fulfilled_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF v_changed && ARRAY['decided_by', 'decided_at'] THEN
                RAISE EXCEPTION 'REDEMPTION_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            RAISE EXCEPTION 'REDEMPTION_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
                DETAIL = format('%s -> %s', OLD.status, NEW.status);
        END IF;
    ELSIF v_changed && ARRAY['decided_by', 'decided_at', 'fulfilled_by', 'fulfilled_at'] THEN
        RAISE EXCEPTION 'REDEMPTION_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_redemption_state() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS redemption_state_guard ON public.redemptions;
CREATE TRIGGER redemption_state_guard BEFORE INSERT OR UPDATE ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.guard_redemption_state();

SELECT 'family_hub_transition_guards_ok' AS sentinel;
