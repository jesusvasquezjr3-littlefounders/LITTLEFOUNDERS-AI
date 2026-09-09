-- @phase: expand
-- @after-release: none — additive only. No existing reader is affected;
--   wallet_ledger's reason CHECK widens (never narrows) and gains one
--   nullable-by-default column read only by the new code path.
--
-- 0081_banca_digital.sql — BANCA_DIGITAL.md Waves 0-2: a named account +
-- card the kid can see and freeze, automated allowance, a "Parent-Paid"
-- savings bonus, and a parent-set spend limit. Still rung 1 of the research
-- brief's regulatory ladder (BANCA_DIGITAL.md §0/§13) — closed-loop LF
-- Coins, zero real money, zero new regulatory surface.
--
-- SCOPE NOTE vs BANCA_DIGITAL.md §5.7: `family_gifts` (the sibling-transfer
-- mechanic) is NOT part of this migration. §12 D5 left its ledger shape an
-- open question, and building it well needs a second cross-kid
-- authorization surface on top of everything else here — building it
-- half-verified under the same pass as the rest would be exactly what
-- FAMILY_HUB.md §3/D4 already refused to do with the Share bucket once
-- ("deliberately deferred rather than built half-way"). Tracked as the next
-- increment, not dropped.
--
-- DESIGN REVISION vs BANCA_DIGITAL.md §5.6: the doc proposed an `allocated`
-- boolean directly on `wallet_ledger`. Building it revealed that column
-- can't carry it — `bucket` is NOT NULL with a closed 3-value CHECK, and an
-- unallocated credit has, by definition, no bucket yet. The existing system
-- already solves this shape for chores by keeping "awaiting allocation" on
-- the SOURCE row (`tasks.allocated`) and never touching `wallet_ledger`
-- until the split is chosen. `pending_credits` below generalizes that same
-- pattern to allowance, instead of bending wallet_ledger's own invariant.

-- ── banca_accounts — one row per kid, created when a guardian opens it ─────
create table if not exists public.banca_accounts (
    kid_user_id    uuid primary key references auth.users (id) on delete cascade,
    nickname       text not null default 'My Account' check (char_length(nickname) between 1 and 40),
    card_design    text not null default 'indigo' check (card_design in ('indigo', 'emerald', 'violet', 'amber', 'sunrise', 'ocean')),
    -- Server-generated, format 'LF-####-####' (8 digits, letter prefix,
    -- non-standard grouping) — structurally NOT a 16-digit PAN and never
    -- mistakable for one; see backend's generateDisplayNumber + its test.
    display_number text not null,
    frozen         boolean not null default false,
    frozen_by      uuid references auth.users (id),
    frozen_at      timestamptz,
    opened_by      uuid not null references auth.users (id),
    opened_at      timestamptz not null default now()
);

alter table public.banca_accounts enable row level security;

drop policy if exists banca_accounts_select_party on public.banca_accounts;
create policy banca_accounts_select_party on public.banca_accounts
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

drop policy if exists banca_accounts_update_party on public.banca_accounts;
create policy banca_accounts_update_party on public.banca_accounts
    for update using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

-- ── wallet_ledger — widen the reason vocabulary, additive only ────────────
alter table public.wallet_ledger drop constraint if exists wallet_ledger_reason_check;
alter table public.wallet_ledger add constraint wallet_ledger_reason_check
    check (reason in ('task_approved', 'goal_withdrawal', 'redemption', 'manual_adjustment', 'allowance', 'savings_bonus'));

-- ── pending_credits — the allowance-side analog of tasks.allocated ────────
-- One row per posted-but-not-yet-split payout. A kid splits it across
-- Save/Spend/Share exactly like an approved task's reward, through
-- allocate_pending_credit below (same shape as allocate_task_reward, 0075).
create table if not exists public.pending_credits (
    id            uuid primary key default gen_random_uuid(),
    kid_user_id   uuid not null references auth.users (id) on delete cascade,
    amount        integer not null check (amount > 0),
    source        text not null check (source in ('allowance')),
    source_ref    uuid,  -- the allowance_rules.id that generated this row, informational only
    allocated     boolean not null default false,
    created_at    timestamptz not null default now()
);

alter table public.pending_credits enable row level security;

drop policy if exists pending_credits_select_party on public.pending_credits;
create policy pending_credits_select_party on public.pending_credits
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

create index if not exists idx_pending_credits_kid on public.pending_credits (kid_user_id) where not allocated;

-- Mirrors allocate_task_reward (0075) exactly, keyed on pending_credits
-- instead of tasks, writing wallet_ledger rows with reason = 'allowance'.
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

revoke all on function public.allocate_pending_credit(uuid, uuid, int, int, int, uuid) from public;
revoke all on function public.allocate_pending_credit(uuid, uuid, int, int, int, uuid) from anon;
revoke all on function public.allocate_pending_credit(uuid, uuid, int, int, int, uuid) from authenticated;
grant execute on function public.allocate_pending_credit(uuid, uuid, int, int, int, uuid) to service_role;

-- ── allowance_rules — recurring, chore-independent payouts ────────────────
create table if not exists public.allowance_rules (
    id             uuid primary key default gen_random_uuid(),
    kid_user_id    uuid not null references auth.users (id) on delete cascade,
    parent_user_id uuid not null references auth.users (id),
    amount         integer not null check (amount > 0 and amount <= 1000),
    frequency      text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
    anchor_day     integer not null check (anchor_day between 0 and 28),
    active         boolean not null default true,
    next_run_at    timestamptz not null,
    created_at     timestamptz not null default now(),
    unique (kid_user_id)
);

alter table public.allowance_rules enable row level security;

drop policy if exists allowance_rules_select_party on public.allowance_rules;
create policy allowance_rules_select_party on public.allowance_rules
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

-- ── savings_bonus_rules — the "Parent-Paid Bonus" mechanic ────────────────
create table if not exists public.savings_bonus_rules (
    kid_user_id    uuid primary key references auth.users (id) on delete cascade,
    parent_user_id uuid not null references auth.users (id),
    rate_bp        integer not null check (rate_bp between 0 and 2000),
    active         boolean not null default true,
    next_run_at    timestamptz not null,
    created_at     timestamptz not null default now()
);

alter table public.savings_bonus_rules enable row level security;

drop policy if exists savings_bonus_rules_select_party on public.savings_bonus_rules;
create policy savings_bonus_rules_select_party on public.savings_bonus_rules
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

-- ── spend_limits — the parental-control simulation, enforced at REQUEST
-- time by decide/request logic in Core, not by RLS (§5.5) ─────────────────
create table if not exists public.spend_limits (
    kid_user_id    uuid primary key references auth.users (id) on delete cascade,
    parent_user_id uuid not null references auth.users (id),
    period         text not null check (period in ('weekly', 'monthly')),
    cap            integer not null check (cap > 0),
    active         boolean not null default true,
    created_at     timestamptz not null default now()
);

alter table public.spend_limits enable row level security;

drop policy if exists spend_limits_select_party on public.spend_limits;
create policy spend_limits_select_party on public.spend_limits
    for select using (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

-- ── run_due_scheduled_credits — the no-cron "catch up on access" job ──────
-- There is no scheduler in this stack (verified: no node-cron/setInterval
-- pattern anywhere in backend/src). Rather than add one for two small
-- periodic jobs, this runs INLINE, locked, the first time a kid's banca
-- data is read after a rule falls due — the same "compute on read" posture
-- BANCA_DIGITAL.md §6.5 already commits to for the statement. Capped at 8
-- credited cycles per call (Wave 0's generous worst case: an app unopened
-- for ~2 months on a weekly allowance) — beyond that it fast-forwards
-- next_run_at without crediting further, so an account left dormant for a
-- year does not suddenly mint a year of backdated coins.
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

revoke all on function public.run_due_scheduled_credits(uuid) from public;
revoke all on function public.run_due_scheduled_credits(uuid) from anon;
revoke all on function public.run_due_scheduled_credits(uuid) from authenticated;
grant execute on function public.run_due_scheduled_credits(uuid) to service_role;

select 'migration_0081_ok' as sentinel;
