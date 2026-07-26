-- 0017_generation_telemetry.sql — the durable scoreboard of every coursegen
-- generation run (COURSE_ENGINE.md §4 "telemetry"): per-run summaries,
-- per-slot outcomes with judge rubrics and failure stages, and per-track
-- reports from generate:track. This is what the admin Generation dashboard
-- (Core /api/v1/admin/generation/*) and the forge:coach improvement loop read
-- — the permanent "what happened, what failed, what did it cost" record the
-- run dirs alone cannot provide (runs/ is a gitignored local directory on
-- whatever machine ran the generation).
--
-- Service-role only, same posture as picture_assets (0014) / speech_assets
-- (0015): RLS enabled with NO client policies. Browsers never read these
-- tables — the staff console reads them exclusively through Core, which holds
-- the service role and gates on admin/superadmin. coursegen writes them
-- (telemetry ingest, swallow-on-failure) at the end of every non-dry run.

create table if not exists generation_runs (
  run_id           text primary key,
  -- Set when the run is a shard of a generate:track invocation.
  track_id         text,
  course_slug      text not null,
  register         text not null default 'kid',
  -- RunParams (locales/noImages/register) — what produced the slots.
  params           jsonb not null default '{}'::jsonb,
  -- The full RunSummary (buckets, salvaged, image counts, budget flags).
  summary          jsonb not null default '{}'::jsonb,
  tokens_used      bigint not null default 0,
  usd_used         numeric(12, 4) not null default 0,
  cached_tokens    bigint not null default 0,
  images_generated integer not null default 0,
  images_billed    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists generation_slots (
  run_id           text not null references generation_runs (run_id) on delete cascade,
  slot_id          text not null,
  -- Final outcome this run: published | failed | skipped | dry-run.
  state            text not null,
  -- Stage the slot failed from (checkpoint failedFrom) — the failure heatmap datum.
  failed_from      text,
  error            text,
  salvaged         boolean not null default false,
  dropped_segments integer not null default 0,
  images_generated integer not null default 0,
  images_billed    integer not null default 0,
  images_inherited integer not null default 0,
  duration_ms      integer,
  -- Last judge rubric for the slot (9 dimensions + notes), from rubrics.jsonl.
  rubric           jsonb,
  review_cycles    integer,
  early_stopped    boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (run_id, slot_id)
);

create table if not exists generation_tracks (
  track_id    text primary key,
  course_slug text not null,
  -- The full TrackReport (shards, totals, failure heatmap, mop-up, halted).
  report      jsonb not null default '{}'::jsonb,
  budget_usd  numeric(12, 4),
  halted      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table generation_runs enable row level security;
alter table generation_slots enable row level security;
alter table generation_tracks enable row level security;

create index if not exists generation_runs_course_idx on generation_runs (course_slug, updated_at desc);
create index if not exists generation_runs_track_idx on generation_runs (track_id) where track_id is not null;
create index if not exists generation_tracks_course_idx on generation_tracks (course_slug, updated_at desc);
