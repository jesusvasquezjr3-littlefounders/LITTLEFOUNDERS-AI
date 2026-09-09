-- @phase: contract
-- @after-release: 11446bf7 (a straight RENAME TO, not a data-shape change —
--   nothing is dropped, narrowed or made unreadable. check-migration-phase.mjs
--   still classifies any RENAME as a contraction, deliberately: a rolling
--   deploy where old code queries the old table name would 404 through
--   PostgREST mid-rollout, and the gate cannot tell "renamed, harmlessly" from
--   "renamed, and something still depends on the old name" without a human
--   saying so. This migration must land BEFORE any code references
--   `banking_accounts` — which it does, in the same release (database/AGENTS.md).
--
-- 0082_rename_banking_accounts.sql — corrects a naming mistake caught after
-- 0081 shipped: `banca_accounts` used a Spanish word as a permanent code
-- identifier, inconsistent with /AGENTS.md §1.0 #4 ("all documentation,
-- comments and commit messages MUST be written in English") and with every
-- other table this schema ships (`wallet_ledger`, `savings_goals`,
-- `redemption_catalog`, `spend_limits`, `allowance_rules` — all English).
-- "Banca Digital" stays a legitimate localized DISPLAY name in the es-MX
-- translation strings a Spanish-speaking family actually reads; it was never
-- legitimate as a table name, a route path, or a file name, and this
-- migration is the schema half of undoing that mistake. The route, file and
-- identifier renames are the same commit's code changes.

alter table public.banca_accounts rename to banking_accounts;

-- RENAME TO renames the table but leaves every constraint/index carrying its
-- OLD name (Postgres does not cascade a table rename onto them) — a `\d` or
-- a Postgres error message would still say `banca_accounts_pkey` forever if
-- these were left alone. Renamed too, so no Spanish-derived identifier
-- survives anywhere in the schema, not just in the one name a query targets.
-- Renaming the PRIMARY KEY constraint auto-renames its backing index too
-- (Postgres keeps the two in lockstep) — no separate ALTER INDEX needed, and
-- adding one would error "does not exist" on an index already renamed.
alter table public.banking_accounts rename constraint banca_accounts_pkey to banking_accounts_pkey;
alter table public.banking_accounts rename constraint banca_accounts_card_design_check to banking_accounts_card_design_check;
alter table public.banking_accounts rename constraint banca_accounts_nickname_check to banking_accounts_nickname_check;
alter table public.banking_accounts rename constraint banca_accounts_frozen_by_fkey to banking_accounts_frozen_by_fkey;
alter table public.banking_accounts rename constraint banca_accounts_kid_user_id_fkey to banking_accounts_kid_user_id_fkey;
alter table public.banking_accounts rename constraint banca_accounts_opened_by_fkey to banking_accounts_opened_by_fkey;

drop policy if exists banca_accounts_select_party on public.banking_accounts;
create policy banking_accounts_select_party on public.banking_accounts
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

drop policy if exists banca_accounts_update_party on public.banking_accounts;
create policy banking_accounts_update_party on public.banking_accounts
    for update using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

select 'migration_0082_ok' as sentinel;
