-- 0020_heartbeat_snapshots.sql — time-series record of every heartbeat update
-- during active generation runs. Each row is a snapshot of the run state at a
-- point in time, giving the admin dashboard a rich timeline of progression
-- (stage breakdown over time, cost curve, image generation pace).
--
-- Service-role-only posture like 0017/0018: RLS enabled, ZERO client policies.
-- coursegen's liveTelemetry appends here on each slot transition; Core reads
-- through /api/v1/admin/generation/snapshots/:runId.

create table if not exists generation_heartbeat_snapshots (
  id               bigint generated always as identity primary key,
  run_id           text not null,
  active_slots     integer not null default 0,
  completed_slots  integer not null default 0,
  failed_slots     integer not null default 0,
  stage_breakdown  jsonb not null default '{}'::jsonb,
  tokens_used      bigint not null default 0,
  usd_used         numeric(12, 4) not null default 0,
  cached_tokens    bigint not null default 0,
  images_generated integer not null default 0,
  images_billed    integer not null default 0,
  images_inherited integer not null default 0,
  created_at       timestamptz not null default now()
);

alter table generation_heartbeat_snapshots enable row level security;

create index if not exists heartbeat_snapshots_run_idx
  on generation_heartbeat_snapshots (run_id, created_at);
