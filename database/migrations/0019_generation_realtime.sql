-- 0019_generation_realtime.sql — RLS policies so admin/superadmin users can
-- subscribe to generation_runs_live changes via Supabase Realtime (CDC on
-- Postgres logical replication). This is the ONLY client-accessible policy on
-- the generation telemetry tables (0017/0018 are service-role-only — the
-- durable scoreboard is read exclusively through Core).
--
-- generation_runs_live carries ZERO PII: run metadata, slot counts, stage
-- breakdown, and cost totals — nothing identifiable to any user. The admin
-- dashboard currently polls Core every 2s; with this policy it subscribes to
-- live Postgres changes via the Supabase Realtime service (already deployed).
--
-- Architectural note (AGENTS.md §1.5 exception): the browser connects to
-- Supabase Realtime directly for this table only, same pattern as Depot's
-- public file route and Pulse's tracker scripts. The connection is
-- authenticated (Supabase JWT) and RLS-gated to staff roles.

-- SELECT for admin/superadmin — enables Realtime subscription.
drop policy if exists "staff_select_live" on generation_runs_live;
create policy "staff_select_live" on generation_runs_live
  for select
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );
