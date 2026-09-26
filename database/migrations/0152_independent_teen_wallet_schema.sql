-- independent_teen_wallet_schema — S07.2, part 1 of 5 (D.3, OD-3 Option B):
-- a self-registered teen (13–17) gets a personal wallet without a parent.
-- Parts: schema (who holds a wallet, the new tables and ledger vocabulary),
-- guards (every writer, the service role included), ledger (the append-only
-- ledger learns the teen's reasons), flows (the teen's own producing
-- functions and the adoption metric), guardian_link (a teen invites a parent
-- later, and the family mechanics layer onto the same wallet).
-- Split so each payload stays well inside the operator transport's
-- single-argument limit.
-- @phase: contract
-- @after-release: none — no deployed code writes the new reasons or tables.
--   Declared contract because the ledger reason CHECK is dropped and re-added
--   (a pure widening here) and because part 2 narrows what even the service
--   role may write: a wallet row now needs a wallet holder (a parent-created
--   child or an eligible teen), so no adult can ever hold a personal wallet.
--   Every write the current Core makes stays legal (verified on native
--   PostgreSQL). Apply with the Core release that ships the S07.2 routes,
--   after the S07.1 family_hub_* migrations, never ahead of either.
--
-- OD-3 Option B (owner log §7): a self-registered teen without a parent gets a
-- personal wallet: self-logged income, Save/Spend/Share allocation, savings
-- goals and a personal reward list, in simulated coins, with no approval step.
-- Tasks, chore approval and anything a parent approves stay guardian-only.
-- Adults never get a personal wallet. If the teen later links a parent, the
-- chores, approvals and reward catalog use the SAME ledger, goals and
-- account: nothing is migrated, so nothing can be lost.
--
-- Eligibility follows AGE, never role (OD-3): the stored age-screen
-- declaration says 13 to 17; no under-13 origin marker (A.2); not a guest
-- session; not a parent-created child (those hold the family wallet already);
-- not a parent or staff account; and when a birth date is on the profile it
-- must still place the person at 13 to 17 today, so a teen who turns 18 keeps
-- their history read-only and cannot add to it.

-- ── Who may hold a wallet ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.teen_wallet_holder(p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_band  text;
    v_guest boolean;
    v_birth date;
    v_age   int;
BEGIN
    IF p_user IS NULL THEN
        RETURN false;
    END IF;
    SELECT declared_age_band INTO v_band FROM public.account_age_declarations WHERE user_id = p_user;
    IF v_band IS DISTINCT FROM '13_to_17' THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user) THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role IN ('kid', 'parent', 'admin', 'superadmin')) THEN
        RETURN false;
    END IF;
    SELECT coalesce(u.is_anonymous, false) INTO v_guest FROM auth.users u WHERE u.id = p_user;
    IF NOT FOUND OR v_guest THEN
        RETURN false;
    END IF;
    SELECT birth_date INTO v_birth FROM public.profiles WHERE user_id = p_user;
    IF v_birth IS NOT NULL THEN
        v_age := date_part('year', age(current_date, v_birth))::int;
        IF v_age < 13 OR v_age > 17 THEN
            RETURN false;
        END IF;
    END IF;
    RETURN true;
END;
$$;

-- 'managed_child' = a parent-created child (the family wallet, S07.1);
-- 'teen' = an eligible self-registered teen (independent or linked later);
-- NULL = no wallet at all (every adult, guest and ineligible account).
CREATE OR REPLACE FUNCTION public.wallet_holder_kind(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN p_user IS NULL THEN NULL
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid') THEN 'managed_child'
        WHEN public.teen_wallet_holder(p_user) THEN 'teen'
    END;
$$;

-- What Core reads before admitting a wallet request: the holder kind and how
-- many verified guardians the holder has (tasks and approvals need one).
CREATE OR REPLACE FUNCTION public.wallet_access(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'kind', public.wallet_holder_kind(p_user),
        'verified_guardians', (SELECT count(*) FROM public.guardian_links gl
                               WHERE gl.kid_user_id = p_user AND gl.verification_status = 'verified')
    );
$$;

REVOKE ALL ON FUNCTION public.teen_wallet_holder(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_holder_kind(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_wallet_holder(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_holder_kind(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_access(uuid) TO service_role;

-- ── The teen's own reward list (in place of a parent-curated catalog) ───────
CREATE TABLE IF NOT EXISTS public.personal_rewards (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60 AND title = btrim(title)),
    cost           integer NOT NULL CHECK (cost BETWEEN 1 AND 500),
    status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    archived_at    timestamptz,
    CONSTRAINT personal_reward_archive_shape CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_personal_rewards_holder
    ON public.personal_rewards (holder_user_id, created_at DESC);

ALTER TABLE public.personal_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS personal_rewards_select_party ON public.personal_rewards;
CREATE POLICY personal_rewards_select_party ON public.personal_rewards
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));

-- ── The teen's own money actions: logged income, a claimed personal reward,
-- coins released from their own goal. Mirrors wallet_guardian_actions (S07.1):
-- every ledger row they write points at the action that explains it. ─────────
CREATE TABLE IF NOT EXISTS public.wallet_self_actions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind               text NOT NULL CHECK (kind IN ('self_income', 'personal_reward', 'goal_release')),
    holder_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    amount             integer NOT NULL CHECK (amount BETWEEN 1 AND 1000),
    -- self_income only: where the coins came from (no free text: nothing
    -- identifying can be typed into a money record).
    source             text CHECK (source IN ('allowance', 'gift', 'earned')),
    save_amount        integer NOT NULL DEFAULT 0 CHECK (save_amount >= 0),
    spend_amount       integer NOT NULL DEFAULT 0 CHECK (spend_amount >= 0),
    share_amount       integer NOT NULL DEFAULT 0 CHECK (share_amount >= 0),
    goal_id            uuid REFERENCES public.savings_goals (id) ON DELETE SET NULL,
    personal_reward_id uuid REFERENCES public.personal_rewards (id) ON DELETE SET NULL,
    -- goal_release only: where the released coins go.
    destination        text CHECK (destination IN ('save', 'spend')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT wallet_self_action_shape CHECK (
        (kind = 'self_income' AND source IS NOT NULL AND destination IS NULL AND personal_reward_id IS NULL
            AND save_amount + spend_amount + share_amount = amount AND (goal_id IS NULL OR save_amount > 0))
        OR (kind = 'personal_reward' AND source IS NULL AND destination IS NULL AND goal_id IS NULL
            AND save_amount = 0 AND spend_amount = 0 AND share_amount = 0)
        OR (kind = 'goal_release' AND source IS NULL AND destination IS NOT NULL AND personal_reward_id IS NULL
            AND save_amount = 0 AND spend_amount = 0 AND share_amount = 0)
    )
);
CREATE INDEX IF NOT EXISTS idx_wallet_self_actions_holder
    ON public.wallet_self_actions (holder_user_id, created_at DESC);

ALTER TABLE public.wallet_self_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_self_actions_select_party ON public.wallet_self_actions;
CREATE POLICY wallet_self_actions_select_party ON public.wallet_self_actions
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));

-- ── Ledger: the teen's reasons and the pointer to the action behind them ────
ALTER TABLE public.wallet_ledger
    ADD COLUMN IF NOT EXISTS self_action_id uuid REFERENCES public.wallet_self_actions (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_self_action
    ON public.wallet_ledger (self_action_id) WHERE self_action_id IS NOT NULL;

alter table public.wallet_ledger drop constraint if exists wallet_ledger_reason_check;
alter table public.wallet_ledger add constraint wallet_ledger_reason_check
    check (reason in ('task_approved', 'goal_withdrawal', 'redemption', 'manual_adjustment', 'allowance', 'savings_bonus', 'self_income', 'personal_reward', 'goal_release'));

-- ── Browser roles never write; the action log is append-only ────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.personal_rewards, public.wallet_self_actions
FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.personal_rewards TO service_role;
GRANT SELECT, INSERT ON public.wallet_self_actions TO service_role;
REVOKE DELETE, TRUNCATE ON public.personal_rewards FROM service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.wallet_self_actions FROM service_role;

SELECT 'independent_teen_wallet_schema_ok' AS sentinel;
