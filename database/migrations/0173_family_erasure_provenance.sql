-- family_erasure_provenance — S07.7, part 1 of 5 (D.21): deleting an adult's
-- account never takes a child's Family Hub record with it, and never fails on it.
-- @phase: expand
--
-- Parts, applied in this order after the S07.6 migrations:
-- family_erasure_provenance (this file), parent_coaching (D.23), money_bridge
-- (D.19), family_research_instrumentation (D.22) and family_data_retention
-- (D.21). Rationale and evidence: docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md
-- (S07.7) and docs/operations/FAMILY-DATA-RETENTION.md.
--
-- WHAT WAS FOUND. D.21's policy says a departed adult's identity leaves the
-- child's record and the record stays. On this chain it could not happen:
--   1. Four provenance columns (who wrote a ledger line, who decided a reward,
--      who opened or froze an account, who set a rule) were NO ACTION foreign
--      keys, so deleting any Tutor who had used the Family Hub failed.
--   2. The S08 lane (E.6) relaxes exactly those keys to ON DELETE SET NULL on
--      the integration branch. Once both lanes are merged, the cascade's own
--      UPDATE reaches this lane's S07.1 guards, which refuse it:
--      guard_wallet_ledger_entry raises LEDGER_APPEND_ONLY on created_by
--      becoming NULL (reproduced on the chain; the sprint record has the run),
--      and the redemption, account and bonus-rule guards refuse the same shape.
--
-- WHAT THIS DOES.
--   * The provenance keys become nullable ON DELETE SET NULL. The statements
--     are the same text as the S08 lane's account_deletion_guards, so applying
--     both files in either order leaves one identical constraint.
--   * Each guarded table's BEFORE UPDATE guard no longer runs for the one row
--     change a SET NULL cascade makes: only the provenance column(s) become
--     NULL and nothing else changes. The guard functions themselves are not
--     redefined (the D.7 registry pins their bodies); their UPDATE trigger
--     gains a WHEN clause built only from built-in operators, so it works for
--     every role that may update the row. Every other update still passes
--     through the unchanged guard.
--
-- A child's own record is still erased with the child: every Block D table
-- keyed by the child cascades from auth.users (checked by the S07.7 verifier).

-- ── provenance columns let go of a deleted account (same text as S08) ──────
ALTER TABLE public.wallet_ledger
    ALTER COLUMN created_by DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS wallet_ledger_created_by_fkey,
    ADD CONSTRAINT wallet_ledger_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.redemptions
    DROP CONSTRAINT IF EXISTS redemptions_decided_by_fkey,
    ADD CONSTRAINT redemptions_decided_by_fkey
        FOREIGN KEY (decided_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.banking_accounts
    ALTER COLUMN opened_by DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS banking_accounts_opened_by_fkey,
    ADD CONSTRAINT banking_accounts_opened_by_fkey
        FOREIGN KEY (opened_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.banking_accounts
    DROP CONSTRAINT IF EXISTS banking_accounts_frozen_by_fkey,
    ADD CONSTRAINT banking_accounts_frozen_by_fkey
        FOREIGN KEY (frozen_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.allowance_rules
    ALTER COLUMN parent_user_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS allowance_rules_parent_user_id_fkey,
    ADD CONSTRAINT allowance_rules_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.savings_bonus_rules
    ALTER COLUMN parent_user_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS savings_bonus_rules_parent_user_id_fkey,
    ADD CONSTRAINT savings_bonus_rules_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.spend_limits
    ALTER COLUMN parent_user_id DROP NOT NULL,
    DROP CONSTRAINT IF EXISTS spend_limits_parent_user_id_fkey,
    ADD CONSTRAINT spend_limits_parent_user_id_fkey
        FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

-- ── the guards let the cascade's own update through, and nothing else ──────
-- INSERT keeps its trigger unconditionally; UPDATE runs the same guard unless
-- the row image differs only in the named provenance column(s), each of which
-- is now NULL. to_jsonb and the jsonb minus operator are built in, so the
-- condition needs no grant and cannot be widened by any role.
DROP TRIGGER IF EXISTS wallet_ledger_entry_guard ON public.wallet_ledger;
DROP TRIGGER IF EXISTS wallet_ledger_entry_guard_update ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_entry_guard BEFORE INSERT ON public.wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_ledger_entry();
CREATE TRIGGER wallet_ledger_entry_guard_update BEFORE UPDATE ON public.wallet_ledger
    FOR EACH ROW WHEN (NOT (
        OLD.created_by IS NOT NULL AND NEW.created_by IS NULL
        AND (to_jsonb(OLD) - 'created_by') = (to_jsonb(NEW) - 'created_by')))
    EXECUTE FUNCTION public.guard_wallet_ledger_entry();

DROP TRIGGER IF EXISTS redemption_state_guard ON public.redemptions;
DROP TRIGGER IF EXISTS redemption_state_guard_update ON public.redemptions;
CREATE TRIGGER redemption_state_guard BEFORE INSERT ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.guard_redemption_state();
CREATE TRIGGER redemption_state_guard_update BEFORE UPDATE ON public.redemptions
    FOR EACH ROW WHEN (NOT (
        OLD.decided_by IS NOT NULL AND NEW.decided_by IS NULL
        AND (to_jsonb(OLD) - 'decided_by') = (to_jsonb(NEW) - 'decided_by')))
    EXECUTE FUNCTION public.guard_redemption_state();

DROP TRIGGER IF EXISTS banking_account_state_guard ON public.banking_accounts;
DROP TRIGGER IF EXISTS banking_account_state_guard_update ON public.banking_accounts;
CREATE TRIGGER banking_account_state_guard BEFORE INSERT ON public.banking_accounts
    FOR EACH ROW EXECUTE FUNCTION public.guard_banking_account_state();
-- A frozen account whose freezer is erased stays frozen with no recorded
-- owner, which the guard already treats as the guardians' freeze: the child
-- still cannot lift it.
CREATE TRIGGER banking_account_state_guard_update BEFORE UPDATE ON public.banking_accounts
    FOR EACH ROW WHEN (NOT (
        (OLD.opened_by IS NOT NULL OR OLD.frozen_by IS NOT NULL)
        AND (NEW.opened_by IS NULL OR NEW.opened_by IS NOT DISTINCT FROM OLD.opened_by)
        AND (NEW.frozen_by IS NULL OR NEW.frozen_by IS NOT DISTINCT FROM OLD.frozen_by)
        AND (to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW))
        AND (to_jsonb(OLD) - 'opened_by' - 'frozen_by') = (to_jsonb(NEW) - 'opened_by' - 'frozen_by')))
    EXECUTE FUNCTION public.guard_banking_account_state();

DROP TRIGGER IF EXISTS savings_bonus_rule_guard ON public.savings_bonus_rules;
DROP TRIGGER IF EXISTS savings_bonus_rule_guard_update ON public.savings_bonus_rules;
CREATE TRIGGER savings_bonus_rule_guard BEFORE INSERT ON public.savings_bonus_rules
    FOR EACH ROW EXECUTE FUNCTION public.guard_savings_bonus_rule();
CREATE TRIGGER savings_bonus_rule_guard_update BEFORE UPDATE ON public.savings_bonus_rules
    FOR EACH ROW WHEN (NOT (
        OLD.parent_user_id IS NOT NULL AND NEW.parent_user_id IS NULL
        AND (to_jsonb(OLD) - 'parent_user_id') = (to_jsonb(NEW) - 'parent_user_id')))
    EXECUTE FUNCTION public.guard_savings_bonus_rule();

SELECT 'migration_family_erasure_provenance_ok' AS sentinel;
