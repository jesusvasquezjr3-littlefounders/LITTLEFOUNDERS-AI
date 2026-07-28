-- 0018_generation_live.sql — live heartbeat during active generation runs.
-- coursegen upserts ONE row per active run on every slot stage transition so the
-- admin dashboard (/api/v1/admin/generation/live) can poll near-real-time
-- progress — the "what is happening RIGHT NOW" complement to 0017's
-- "what happened once it finished" durable scoreboard.
--
-- Service-role-only posture like 0017: RLS enabled, ZERO client policies.
-- Core reads this table exclusively through /api/v1/admin/* (service role);
-- the browser never touches Vault directly.
--
-- Rows for finished runs are deleted by coursegen at run end. A stale row
-- (>2 min since updated_at) means the run process died and Core treats it as
-- terminated.

create table if not exists generation_runs_live (
  run_id           text primary key,
  track_id         text,
  course_slug      text not null,
  register         text not null default 'kid',
  active_slots     integer not null default 0,
  completed_slots  integer not null default 0,
  failed_slots     integer not null default 0,
  total_slots      integer not null default 0,
  -- Per-stage slot count: { pending, planning, writing, gating, reviewing,
  -- localizing, illustrating, publishing }
  stage_breakdown  jsonb not null default '{}'::jsonb,
  tokens_used      bigint not null default 0,
  usd_used         numeric(12, 4) not null default 0,
  cached_tokens    bigint not null default 0,
  images_generated integer not null default 0,
  images_billed    integer not null default 0,
  images_inherited integer not null default 0,
  started_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table generation_runs_live enable row level security;

create index if not exists generation_runs_live_updated_idx
  on generation_runs_live (updated_at desc);
