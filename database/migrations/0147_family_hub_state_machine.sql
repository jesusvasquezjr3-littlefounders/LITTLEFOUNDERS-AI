-- family_hub_state_machine — S07.1, part 1 of 5 (D.4 and D.5 / OD-21): the
-- Family Hub's state machine is enforced by the database, and every declared
-- lifecycle state has a flow that produces it. Parts: state_machine (schema,
-- lockdown, helpers), transition_guards, wallet_integrity,
-- guardian_link_lifecycle, lifecycle_flows. Split so each payload stays well
-- inside the operator transport's single-argument limit.
-- @phase: contract
-- @after-release: none — no deployed code writes these tables through the
--   browser role (the SPA only talks to Core, and Core writes with the service
--   role), so the dropped client write policies and revoked grants have no
--   reader to retire. Declared contract anyway because the new triggers NARROW
--   what the service role itself may write: every transition the current Core
--   makes is legal under them (verified against the actual migration chain on
--   native PostgreSQL), but an older Core would keep answering "linked" for a
--   second-guardian acceptance that is now pending confirmation. Apply it with
--   the Core release that ships the S07.1 routes, never ahead of it.
--
-- D.4. The audit found that row-level rules let a family member write
-- chores, savings goals, redemptions and banking accounts directly through
-- the data gateway, skipping Core's business rules (photo before approval,
-- balance before a redemption is approved). A kid could insert a redemption
-- already marked 'approved'; a guardian could approve one without the debit.
-- This migration closes it in three layers:
--   1. Browser roles lose every write grant and write policy on the Family
--      Hub tables (reads are unchanged). Wallet ledger entries were already
--      service-only; now everything around them is too.
--   2. BEFORE triggers enforce the legal state machine for EVERY writer,
--      the service role included, so a Core defect cannot produce an illegal
--      transition either: task open->done->approved|cancelled with the photo
--      rule, goal active->reached only when the tagged savings cover the
--      target, redemption requested->approved only with its debit written,
--      approved->fulfilled only by a verified guardian, and a child can never
--      lift a freeze a guardian placed.
--   3. Every accepted transition is recorded in family_state_audit with the
--      request role that caused it — Appendix H's "Unauthorized
--      State-Transition Rate" is a query over that table, not an estimate.
--
-- D.5 / OD-21. The declared-but-unused states each get a producing and a
-- consuming flow:
--   - redemption 'fulfilled': a verified guardian marks an approved reward
--     delivered (fulfill_redemption).
--   - ledger 'manual_adjustment': guardian-only, audited, required reason
--     (guardian_adjust_wallet).
--   - ledger 'goal_withdrawal': guardian-only, audited, required reason;
--     moves coins out of a goal's tagged savings into Spend or back into
--     plain Save (guardian_withdraw_goal).
--   - guardian link 'pending' and 'rejected': accepting a second-guardian
--     invite now creates a PENDING link that an existing verified guardian
--     confirms or rejects (decide_guardian_link). A leaked invite link can no
--     longer attach a stranger to a child on its own.
--   - guardian link 'revoked': a verified guardian steps away from a child
--     while another verified guardian remains (revoke_own_guardian_link).
-- Guardian money actions are recorded in wallet_guardian_actions, the one
-- place their reason lives; each ledger row they write points at it.

-- ── New columns ─────────────────────────────────────────────────────────────
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE public.redemptions
    ADD COLUMN IF NOT EXISTS fulfilled_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

ALTER TABLE public.guardian_links
    ADD COLUMN IF NOT EXISTS invite_id  uuid REFERENCES public.guardian_invites (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS decided_at timestamptz,
    ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- ── Guardian money actions (manual adjustment, goal withdrawal) ──────────────
CREATE TABLE IF NOT EXISTS public.wallet_guardian_actions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          text NOT NULL CHECK (kind IN ('manual_adjustment', 'goal_withdrawal')),
    kid_user_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    -- manual_adjustment: the bucket adjusted. goal_withdrawal: the destination.
    bucket        text NOT NULL CHECK (bucket IN ('save', 'spend', 'share')),
    goal_id       uuid REFERENCES public.savings_goals (id) ON DELETE SET NULL,
    -- Signed for an adjustment (credit or debit); positive for a withdrawal.
    amount        integer NOT NULL CHECK (amount <> 0 AND amount BETWEEN -1000 AND 1000),
    reason        text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 240),
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT wallet_guardian_action_withdrawal_shape
        CHECK (kind <> 'goal_withdrawal' OR (amount > 0 AND bucket IN ('save', 'spend')))
);
CREATE INDEX IF NOT EXISTS idx_wallet_guardian_actions_kid
    ON public.wallet_guardian_actions (kid_user_id, created_at DESC);

ALTER TABLE public.wallet_guardian_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_guardian_actions_select_party ON public.wallet_guardian_actions;
CREATE POLICY wallet_guardian_actions_select_party ON public.wallet_guardian_actions
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

ALTER TABLE public.wallet_ledger
    ADD COLUMN IF NOT EXISTS guardian_action_id uuid REFERENCES public.wallet_guardian_actions (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_guardian_action
    ON public.wallet_ledger (guardian_action_id) WHERE guardian_action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_goal
    ON public.wallet_ledger (goal_id) WHERE goal_id IS NOT NULL;

-- ── Transition audit (Appendix H: Unauthorized State-Transition Rate) ───────
CREATE TABLE IF NOT EXISTS public.family_state_audit (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name    text NOT NULL,
    row_id        text NOT NULL,
    from_state    text,
    to_state      text,
    actor_user_id uuid,
    -- The request's JWT role (PostgREST sets it per request): 'service_role'
    -- for Core. NULL means no API request at all (a manual or migration
    -- write), which the metric counts as outside the service layer.
    request_role  text,
    db_role       text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_family_state_audit_time
    ON public.family_state_audit (created_at DESC);
ALTER TABLE public.family_state_audit ENABLE ROW LEVEL SECURITY;
-- No policies: staff read it through Core with the service role only.

-- ── Browser roles lose every Family Hub write path (reads unchanged) ────────
DROP POLICY IF EXISTS tasks_insert_guardian ON public.tasks;
DROP POLICY IF EXISTS tasks_update_party ON public.tasks;
DROP POLICY IF EXISTS savings_goals_insert_own ON public.savings_goals;
DROP POLICY IF EXISTS savings_goals_update_own ON public.savings_goals;
DROP POLICY IF EXISTS redemption_catalog_write_own ON public.redemption_catalog;
DROP POLICY IF EXISTS redemption_catalog_update_own ON public.redemption_catalog;
DROP POLICY IF EXISTS redemptions_insert_own ON public.redemptions;
DROP POLICY IF EXISTS redemptions_update_guardian ON public.redemptions;
-- A guardian who stepped away (revoked) must lose read access to the chores
-- they once assigned; only the child and CURRENT verified guardians read tasks.
DROP POLICY IF EXISTS tasks_select_party ON public.tasks;
CREATE POLICY tasks_select_party ON public.tasks
    FOR SELECT USING (assigned_to = auth.uid() OR public.is_verified_guardian_of(assigned_to));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
    public.tasks, public.savings_goals, public.redemptions, public.redemption_catalog,
    public.wallet_ledger, public.pending_credits, public.allowance_rules,
    public.savings_bonus_rules, public.spend_limits, public.kid_task_streaks,
    public.guardian_links, public.wallet_guardian_actions, public.family_state_audit
FROM anon, authenticated;
-- banking_accounts keeps 0093's presentation-only column grant (nickname,
-- card_design) for the account holder; everything else is service-only.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.banking_accounts FROM anon, authenticated;
REVOKE UPDATE ON public.banking_accounts FROM anon;
REVOKE ALL ON public.family_state_audit FROM anon, authenticated;
GRANT SELECT, INSERT ON public.family_state_audit TO service_role;
GRANT SELECT, INSERT ON public.wallet_guardian_actions TO service_role;
-- Append-only for the service role too: the ledger, the guardian actions and
-- the transition audit are only ever inserted. Cascading deletes from
-- auth.users run with the table owner's rights and are unaffected.
REVOKE UPDATE, DELETE, TRUNCATE ON public.wallet_ledger, public.wallet_guardian_actions, public.family_state_audit
FROM service_role;

-- ── Helpers ───────────────────────────────────────────────────────────────
-- Columns whose value differs between two row images.
CREATE OR REPLACE FUNCTION public.family_changed_columns(p_old jsonb, p_new jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT coalesce(array_agg(t.k ORDER BY t.k), '{}'::text[])
    FROM jsonb_object_keys(p_new) AS t(k)
    WHERE p_old -> t.k IS DISTINCT FROM p_new -> t.k;
$$;

-- True when every changed column is in the nullable-actor set and became NULL:
-- the shape of an ON DELETE SET NULL cascade, which must never be refused.
CREATE OR REPLACE FUNCTION public.family_only_nulled(p_changed text[], p_nullable text[], p_new jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT p_changed <@ p_nullable
       AND NOT EXISTS (SELECT 1 FROM unnest(p_changed) AS c(k) WHERE p_new -> c.k <> 'null'::jsonb);
$$;

-- Explicit-actor form of is_verified_guardian_of (which reads auth.uid()):
-- Core passes the acting parent, and the database re-derives the link itself.
CREATE OR REPLACE FUNCTION public.family_is_verified_guardian(p_parent uuid, p_kid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_parent IS NOT NULL AND p_kid IS NOT NULL AND p_parent <> p_kid AND EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.parent_user_id = p_parent AND gl.kid_user_id = p_kid AND gl.verification_status = 'verified'
    );
$$;

CREATE OR REPLACE FUNCTION public.family_request_role()
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    );
$$;

REVOKE ALL ON FUNCTION public.family_changed_columns(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_only_nulled(text[], text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_is_verified_guardian(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_request_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_changed_columns(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_only_nulled(text[], text[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_is_verified_guardian(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_request_role() TO service_role;

SELECT 'family_hub_state_machine_ok' AS sentinel;
