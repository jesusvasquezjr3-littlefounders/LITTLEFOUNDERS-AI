-- @phase: contract
-- @after-release: none — no application code has ever read families,
--   family_members, tasks.family_id or tasks.reward. tasks/ has no mounted
--   router (verified 2026-09-08: grep of backend/src/app.ts). The ONLY
--   reader of families/family_members was the insights_family_engagement
--   view, and this same migration redefines it. Full trace: FAMILY_HUB.md §5.1.
--
-- 0074_family_hub.sql — the tasks/rewards/monitoring product surface's real
-- schema, replacing the PROVISIONAL one 0002_content_skeleton.sql shipped on
-- day one and explicitly told callers not to build on.
--
-- WHY families/family_members ARE DROPPED RATHER THAN POPULATED (D1,
-- FAMILY_HUB.md §5.1, owner-approved 2026-09-08). Every real parent-kid link
-- in production goes through guardian_links — verified pairs of
-- (parent_user_id, kid_user_id) — because that is what /family/kids has
-- written since it shipped. families/family_members have zero rows and zero
-- writers; /AGENTS.md §1.3's "membership lives in family_members" describes
-- a table nothing populates. guardian_links already satisfies the actual
-- invariant that sentence protects (multiple parents per kid — nothing stops
-- two parent_user_id rows pointing at the same kid_user_id), so a "family"
-- for every purpose in this schema is: one kid + their verified guardians,
-- derived from guardian_links, never stored as its own row. This migration
-- and the /AGENTS.md + /CLAUDE.md + database/AGENTS.md wording fix that
-- accompanies it in the same commit are the two halves of D1.
--
-- WHY tasks.reward (jsonb) IS DROPPED. An unvalidated free-form shape with no
-- defined vocabulary is exactly what /AGENTS.md §1.14 warns against — nothing
-- ever wrote to it, and no UI could have known how to render it. reward_coins
-- (an integer, same shape as learning_stats.xp) is the one thing the earn
-- loop actually needs.

-- ── Drop the dead join tables and their dependent view ─────────────────────
-- Order matters, found by running this migration for real against the local
-- stack (twice — each failure below is a real dependency, not a guess):
--   1. families_select_member (0001, ON families) reads family_members in
--      its USING clause, so it must go before family_members is dropped.
--   2. family_members.family_id and tasks.family_id both FK to families, so
--      families cannot drop until both of those are gone.
-- Explicit DROP POLICY / DROP COLUMN steps rather than CASCADE, so nothing
-- is removed by inference — every object taken down is named here.
drop view if exists insights_family_engagement;
drop policy if exists families_select_member on public.families;
drop policy if exists family_members_select_member on public.family_members;

-- ── tasks — redesigned from the provisional 0002 shape ─────────────────────
alter table public.tasks drop column if exists family_id;
alter table public.tasks drop column if exists reward;

drop table if exists public.family_members;
drop table if exists public.families;
alter table public.tasks
    add column if not exists reward_coins integer not null default 1 check (reward_coins > 0),
    add column if not exists recurrence   text not null default 'once' check (recurrence in ('once', 'weekly')),
    add column if not exists due_at       timestamptz;
alter table public.tasks alter column reward_coins drop default;

-- RLS: the provisional migration shipped SELECT only ("parents manage via
-- service role for now"). Core writes through the service role either way
-- (§1.5 — the frontend never talks to Supabase directly), but /AGENTS.md
-- §1.3 requires RLS on every user-content table regardless of which path a
-- given deploy actually uses, so the policies below are real, not a
-- placeholder comment.
drop policy if exists tasks_select_party on public.tasks;
create policy tasks_select_party on public.tasks
    for select using (assigned_by = auth.uid() OR assigned_to = auth.uid()
        OR public.is_verified_guardian_of(assigned_to));

drop policy if exists tasks_insert_guardian on public.tasks;
create policy tasks_insert_guardian on public.tasks
    for insert with check (assigned_by = auth.uid() AND public.is_verified_guardian_of(assigned_to));

-- UPDATE is intentionally the same broad guardian-or-party predicate for
-- every column — Postgres RLS gates ROW visibility, not per-transition
-- legality (open -> done -> approved is enforced by Core's route logic, the
-- same shape guardian_links.verification_status already uses: RLS says WHO
-- may touch the row, the service layer says WHAT they may do to it).
drop policy if exists tasks_update_party on public.tasks;
create policy tasks_update_party on public.tasks
    for update using (assigned_to = auth.uid() OR public.is_verified_guardian_of(assigned_to));

-- ── wallet_ledger — append-only, exactly like audit_logs. A bucket balance
-- is SUM(amount), never a mutable counter: /AGENTS.md §1.14's own rule
-- ("a value read, modified and written back must never collapse a failure
-- into a zero/empty default") applies here as directly as it does to XP —
-- a ledger sum degrades to "unreadable, refuse" on a transient failure, a
-- counter degrades to "silently wrong."
create table if not exists public.wallet_ledger (
    id            bigint generated always as identity primary key,
    kid_user_id   uuid not null references auth.users (id) on delete cascade,
    bucket        text not null check (bucket in ('save', 'spend', 'share')),
    amount        integer not null check (amount <> 0),
    reason        text not null check (reason in ('task_approved', 'redemption', 'manual_adjustment')),
    task_id       uuid references public.tasks (id) on delete set null,
    goal_id       uuid,   -- FK added below, after savings_goals exists
    redemption_id uuid,   -- FK added below, after redemptions exists
    created_by    uuid not null references auth.users (id),
    created_at    timestamptz not null default now()
);

create table if not exists public.savings_goals (
    id          uuid primary key default gen_random_uuid(),
    kid_user_id uuid not null references auth.users (id) on delete cascade,
    title       text not null,
    target      integer not null check (target > 0),
    icon        text not null default 'star' check (icon in ('star', 'game', 'toy', 'book', 'bike', 'trip', 'gift')),
    status      text not null default 'active' check (status in ('active', 'reached', 'archived')),
    created_at  timestamptz not null default now(),
    reached_at  timestamptz
);

alter table public.wallet_ledger
    drop constraint if exists wallet_ledger_goal_id_fkey;
alter table public.wallet_ledger
    add constraint wallet_ledger_goal_id_fkey foreign key (goal_id) references public.savings_goals (id) on delete set null;

create table if not exists public.redemption_catalog (
    id             uuid primary key default gen_random_uuid(),
    parent_user_id uuid not null references auth.users (id) on delete cascade,
    title          text not null,
    cost           integer not null check (cost > 0),
    active         boolean not null default true,
    created_at     timestamptz not null default now()
);

create table if not exists public.redemptions (
    id          uuid primary key default gen_random_uuid(),
    catalog_id  uuid not null references public.redemption_catalog (id) on delete cascade,
    kid_user_id uuid not null references auth.users (id) on delete cascade,
    status      text not null default 'requested' check (status in ('requested', 'approved', 'denied', 'fulfilled')),
    created_at  timestamptz not null default now(),
    decided_at  timestamptz,
    decided_by  uuid references auth.users (id)
);

alter table public.wallet_ledger
    drop constraint if exists wallet_ledger_redemption_id_fkey;
alter table public.wallet_ledger
    add constraint wallet_ledger_redemption_id_fkey foreign key (redemption_id) references public.redemptions (id) on delete set null;

create index if not exists idx_wallet_ledger_kid on public.wallet_ledger (kid_user_id, bucket);
create index if not exists idx_savings_goals_kid on public.savings_goals (kid_user_id);
create index if not exists idx_redemption_catalog_parent on public.redemption_catalog (parent_user_id);
create index if not exists idx_redemptions_kid on public.redemptions (kid_user_id);

alter table public.wallet_ledger        enable row level security;
alter table public.savings_goals        enable row level security;
alter table public.redemption_catalog   enable row level security;
alter table public.redemptions          enable row level security;

-- wallet_ledger: kid + verified guardians read; NO client insert/update/delete
-- policy at all (no policy = denied, same idiom as audit_logs) — every row is
-- server-computed by Core's service-role writes, never a client assertion.
drop policy if exists wallet_ledger_select_party on public.wallet_ledger;
create policy wallet_ledger_select_party on public.wallet_ledger
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

-- savings_goals: kid manages their own; guardians read-only.
drop policy if exists savings_goals_select_party on public.savings_goals;
create policy savings_goals_select_party on public.savings_goals
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
drop policy if exists savings_goals_insert_own on public.savings_goals;
create policy savings_goals_insert_own on public.savings_goals
    for insert with check (kid_user_id = auth.uid());
drop policy if exists savings_goals_update_own on public.savings_goals;
create policy savings_goals_update_own on public.savings_goals
    for update using (kid_user_id = auth.uid());

-- redemption_catalog: parent-authored, parent-only read/write; the assigned
-- kid(s) need to see it too, so any verified guardian of ANY of the parent's
-- kids... in practice this is scoped to "my own catalog" for the parent and
-- Core serves a kid their guardian's catalog through the service role (the
-- kid has no direct DB relationship to a catalog row otherwise).
drop policy if exists redemption_catalog_select_own on public.redemption_catalog;
create policy redemption_catalog_select_own on public.redemption_catalog
    for select using (parent_user_id = auth.uid());
drop policy if exists redemption_catalog_write_own on public.redemption_catalog;
create policy redemption_catalog_write_own on public.redemption_catalog
    for insert with check (parent_user_id = auth.uid());
drop policy if exists redemption_catalog_update_own on public.redemption_catalog;
create policy redemption_catalog_update_own on public.redemption_catalog
    for update using (parent_user_id = auth.uid());

-- redemptions: the requesting kid and the catalog's owning parent (any
-- verified guardian of that kid) can see and progress it.
drop policy if exists redemptions_select_party on public.redemptions;
create policy redemptions_select_party on public.redemptions
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
drop policy if exists redemptions_insert_own on public.redemptions;
create policy redemptions_insert_own on public.redemptions
    for insert with check (kid_user_id = auth.uid());
drop policy if exists redemptions_update_guardian on public.redemptions;
create policy redemptions_update_guardian on public.redemptions
    for update using (public.is_verified_guardian_of(kid_user_id));

-- ── insights_family_engagement, redefined on guardian_links ────────────────
-- "Family" for reporting purposes is now per-kid (one row per verified
-- guardian relationship set), matching how every other endpoint in this
-- codebase already scopes family data — there was never a multi-kid
-- household grouping anywhere else in the app to begin with.
create or replace view insights_family_engagement as
select
  gl.kid_user_id                                          as kid_user_id,
  min(gl.created_at)                                      as first_guardian_link_at,
  count(distinct gl.parent_user_id)                       as guardians,
  count(distinct t.id)                                    as tasks_created,
  count(distinct t.id) filter (where t.status = 'approved') as tasks_approved,
  max(t.created_at)                                       as last_task_at
from guardian_links gl
left join tasks t on t.assigned_to = gl.kid_user_id
where gl.verification_status = 'verified'
group by gl.kid_user_id;

revoke all on insights_family_engagement from public, anon, authenticated;
grant select on insights_family_engagement to service_role;

select 'migration_0074_ok' as sentinel;
