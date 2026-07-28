-- 0022_realtime_publication.sql — actually enable CDC for generation_runs_live.
--
-- 0019 granted admin/superadmin the SELECT policy that Realtime needs to
-- authorize a subscription, but a policy alone emits nothing: Supabase
-- Realtime reads Postgres LOGICAL REPLICATION, and a table only appears in
-- that stream once it is a member of the `supabase_realtime` publication.
-- Verified on the production Vault: the publication exists and had ZERO
-- tables, so the admin Live Monitor's `postgres_changes` subscription
-- (frontend/src/routes/admin/LiveStats.tsx) would have stayed silent
-- forever — connected, authorized, and receiving no events.
--
-- REPLICA IDENTITY FULL is required, not optional, for two reasons:
--   1. The subscription listens for `event: '*'`, which includes DELETE
--      (coursegen deletes the row at run end, and the dashboard treats that
--      as "run finished"). With the default REPLICA IDENTITY the DELETE
--      payload carries only the primary key.
--   2. Realtime evaluates the RLS policy from 0019 against the replicated
--      row. Without the full old-row image it cannot authorize the change
--      and drops it.
--
-- The table carries ZERO PII (run metadata, slot counts, cost totals), so
-- replicating the full row is safe under §1.9.

-- Idempotent: ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS form and
-- errors with 42710 if the table is already a member, which would abort a
-- re-run under ON_ERROR_STOP=1.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'generation_runs_live'
  ) then
    alter publication supabase_realtime add table generation_runs_live;
  end if;
end
$$;

alter table generation_runs_live replica identity full;
