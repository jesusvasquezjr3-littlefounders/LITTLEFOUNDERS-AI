-- independent_teen_wallet_guards — S07.2, part 2 of 5 (D.3, OD-3 Option B): the
-- teen wallet's rules, enforced for every writer, the service role included.
-- @phase: contract
-- @after-release: none — narrows what even the service role may write: a
--   wallet row (ledger entry, savings goal) needs a wallet holder, so no adult
--   can hold a personal wallet, and the teen's own actions must balance. Every
--   write the current Core makes stays legal (parent-created children hold
--   the kid role). Apply with the Core release that ships the S07.2 routes,
--   after independent_teen_wallet_schema, never ahead of it.
--
-- Rationale: independent_teen_wallet_schema (part 1) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── Personal rewards: the teen's own list, archived rather than deleted ─────
CREATE OR REPLACE FUNCTION public.guard_personal_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT public.teen_wallet_holder(NEW.holder_user_id) THEN
            RAISE EXCEPTION 'TEEN_WALLET_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status <> 'active' OR NEW.archived_at IS NOT NULL THEN
            RAISE EXCEPTION 'PERSONAL_REWARD_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        -- A bound on what one account can create, not a product opinion.
        IF (SELECT count(*) FROM public.personal_rewards
            WHERE holder_user_id = NEW.holder_user_id AND status = 'active') >= 20 THEN
            RAISE EXCEPTION 'PERSONAL_REWARD_LIMIT' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] THEN
        RETURN NEW;
    END IF;
    IF NOT (v_changed <@ ARRAY['status', 'archived_at']) THEN
        RAISE EXCEPTION 'PERSONAL_REWARD_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    IF NOT (OLD.status = 'active' AND NEW.status = 'archived' AND NEW.archived_at IS NOT NULL) THEN
        RAISE EXCEPTION 'PERSONAL_REWARD_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_personal_reward() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS personal_reward_guard ON public.personal_rewards;
CREATE TRIGGER personal_reward_guard BEFORE INSERT OR UPDATE ON public.personal_rewards
    FOR EACH ROW EXECUTE FUNCTION public.guard_personal_reward();
DROP TRIGGER IF EXISTS personal_reward_state_transition_audit ON public.personal_rewards;
CREATE TRIGGER personal_reward_state_transition_audit AFTER UPDATE OF status ON public.personal_rewards
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('status', 'id', 'holder_user_id');

-- ── Self actions: only an eligible teen, never while frozen, never past a
-- guardian's spend limit once a parent is linked ─────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_wallet_self_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_reward  public.personal_rewards%ROWTYPE;
    v_limit   public.spend_limits%ROWTYPE;
    v_used    bigint;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
        IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['goal_id', 'personal_reward_id'], to_jsonb(NEW)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'WALLET_ACTION_APPEND_ONLY' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.teen_wallet_holder(NEW.holder_user_id) THEN
        RAISE EXCEPTION 'TEEN_WALLET_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    -- D.1: a freeze a linked guardian placed holds the teen's own movements too.
    IF NOT public.banking_movement_allowed(NEW.holder_user_id) THEN
        RAISE EXCEPTION 'ACCOUNT_FROZEN' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.kind = 'self_income' AND NEW.goal_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.savings_goals WHERE id = NEW.goal_id AND kid_user_id = NEW.holder_user_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'GOAL_NOT_ACTIVE' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.kind = 'goal_release' AND NOT EXISTS (
        SELECT 1 FROM public.savings_goals WHERE id = NEW.goal_id AND kid_user_id = NEW.holder_user_id
    ) THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.kind = 'personal_reward' THEN
        SELECT * INTO v_reward FROM public.personal_rewards WHERE id = NEW.personal_reward_id;
        IF NOT FOUND OR v_reward.holder_user_id <> NEW.holder_user_id OR v_reward.status <> 'active' OR v_reward.cost <> NEW.amount THEN
            RAISE EXCEPTION 'PERSONAL_REWARD_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        -- A spend limit exists only if a linked guardian set one; it then counts
        -- reward requests and personal rewards alike over the same window.
        SELECT * INTO v_limit FROM public.spend_limits WHERE kid_user_id = NEW.holder_user_id AND active;
        IF FOUND THEN
            SELECT coalesce(-sum(amount), 0) INTO v_used FROM public.wallet_ledger
            WHERE kid_user_id = NEW.holder_user_id AND bucket = 'spend' AND reason IN ('redemption', 'personal_reward')
              AND created_at >= now() - CASE WHEN v_limit.period = 'weekly' THEN interval '7 days' ELSE interval '30 days' END;
            IF v_used + NEW.amount > v_limit.cap THEN
                RAISE EXCEPTION 'SPEND_LIMIT_REACHED' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_wallet_self_action() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS wallet_self_action_guard ON public.wallet_self_actions;
CREATE TRIGGER wallet_self_action_guard BEFORE INSERT OR UPDATE ON public.wallet_self_actions
    FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_self_action();

-- At commit, a self action must have exactly the ledger rows it describes.
CREATE OR REPLACE FUNCTION public.check_wallet_self_action_balanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_rows  int;
    v_sum   bigint;
    v_save  bigint;
    v_spend bigint;
    v_share bigint;
BEGIN
    SELECT count(*), coalesce(sum(amount), 0),
           coalesce(sum(amount) FILTER (WHERE bucket = 'save'), 0),
           coalesce(sum(amount) FILTER (WHERE bucket = 'spend'), 0),
           coalesce(sum(amount) FILTER (WHERE bucket = 'share'), 0)
    INTO v_rows, v_sum, v_save, v_spend, v_share
    FROM public.wallet_ledger WHERE self_action_id = NEW.id;
    IF (NEW.kind = 'self_income' AND (v_save <> NEW.save_amount OR v_spend <> NEW.spend_amount OR v_share <> NEW.share_amount
            OR v_rows <> (NEW.save_amount > 0)::int + (NEW.spend_amount > 0)::int + (NEW.share_amount > 0)::int))
       OR (NEW.kind = 'personal_reward' AND (v_rows <> 1 OR v_sum <> -NEW.amount))
       OR (NEW.kind = 'goal_release' AND (v_rows <> 2 OR v_sum <> 0)) THEN
        RAISE EXCEPTION 'WALLET_ACTION_UNBALANCED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_wallet_self_action_balanced() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS wallet_self_action_balanced ON public.wallet_self_actions;
CREATE CONSTRAINT TRIGGER wallet_self_action_balanced AFTER INSERT ON public.wallet_self_actions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_wallet_self_action_balanced();

-- ── Savings goals: only a wallet holder has goals (S07.1 rules unchanged) ───
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

SELECT 'independent_teen_wallet_guards_ok' AS sentinel;
