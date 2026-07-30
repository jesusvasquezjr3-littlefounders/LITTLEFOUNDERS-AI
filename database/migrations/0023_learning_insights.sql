-- 0023_learning_insights.sql — first-party usage telemetry + the insight views
-- that make the data we ALREADY collect readable (INSIGHTS.md is the spec).
--
-- Two design decisions carry this migration, both §1.9-derived:
--
-- 1. CONSENT IS A ROW, NOT A FLAG BURIED IN A PROFILE. analytics_consents is
--    the gate for every kid-originated usage event: Core records a kid's
--    events ONLY while an active (revoked_at IS NULL) row exists for that
--    kid. Grants come exclusively from a VERIFIED guardian (Core re-checks
--    guardian_links per request — §1.3 app layer; the FK here is the DB
--    layer). Revocation keeps the row with revoked_at set, so "was consent
--    active on date X" stays answerable — that is an audit requirement, not
--    a nicety. Adult roles (universal/parent/bigfounder/admin) are gated by
--    the platform terms, not by this table.
--
-- 2. NO FREE TEXT, BY CONSTRUCTION. learning_events has no jsonb payload and
--    no open string column: `event` and `route_class` are CHECK-constrained
--    closed enums, `value` is numeric, and segment_id is a bounded content
--    id. A client cannot smuggle a chat message, a search query, or any
--    child-authored text into analytics because the schema has nowhere to
--    put it. Widening this table = §1.9 review first.
--
-- Data flow: browser beacon → Core POST /api/v1/events (Zod, role-aware,
-- fail-closed for kids) → this table. The admin console reads the VIEWS
-- below through Core (/api/v1/admin/insights/*). Nothing here is ever sent
-- to a third-party AI API or to Pulse — Pulse's boundary (no behavioral
-- capture on kid sessions, pulse/AGENTS.md) is unchanged; this table is the
-- first-party, consent-gated alternative to it.
--
-- Service-role-only posture like 0017/0018/0021: RLS enabled, ZERO client
-- policies on both tables; the views are revoked from client roles. Browsers
-- write through Core and staff read through Core. Growth: learning_events is
-- append-only and unbounded — the retention delta (prune > 400 days) is
-- documented in INSIGHTS.md and RUNBOOK.md before any large-scale rollout.

-- ─────────────────────────────────────────────────────────────
-- analytics_consents — the parental gate for kid usage telemetry
-- ─────────────────────────────────────────────────────────────
-- APPEND-ONLY LEDGER, one row per grant. A revocation closes the open row
-- (sets revoked_at); a re-grant INSERTS a new row, never touches old ones.
-- This is what keeps "was consent active on date X?" answerable across
-- grant→revoke→re-grant cycles — a single upserted row would rewrite
-- history and leave stored kid data with no consent evidence for the
-- period it was lawfully collected. Active consent = an open row
-- (revoked_at IS NULL) exists for the kid.
create table if not exists analytics_consents (
  id           bigint generated always as identity primary key,
  kid_user_id  uuid not null references auth.users (id) on delete cascade,
  granted_by   uuid references auth.users (id) on delete set null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

alter table analytics_consents enable row level security;
-- No client policies — Core (service role) is the only reader/writer.

create index if not exists idx_analytics_consents_kid on analytics_consents (kid_user_id, granted_at desc);

-- ─────────────────────────────────────────────────────────────
-- learning_events — first-party usage stream (closed vocabulary)
-- ─────────────────────────────────────────────────────────────
create table if not exists learning_events (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Stamped by Core from user_roles at ingest time, never trusted from the
  -- client. Lets every view segment kid/parent behavior without a join.
  role         text not null check (role in ('universal', 'parent', 'kid', 'bigfounder', 'admin', 'superadmin')),
  event        text not null check (event in (
    'session_start',      -- app booted with a session
    'session_heartbeat',  -- 60s pulse while the tab is visible (value = seconds since last)
    'session_end',        -- pagehide flush (value = session seconds, best effort)
    'nav_view',           -- surface navigation (route_class carries WHERE)
    'lesson_start',       -- lesson player mounted
    'lesson_abandon',     -- player unmounted without completing (value = seconds in lesson)
    'audio_replay',       -- learner re-played a narration (engagement w/ audio)
    'territory_view'      -- a PARENT opened a kid's territory (family conduct)
  )),
  route_class  text check (route_class in ('learn', 'games', 'tasks', 'profile', 'tutor', 'family', 'admin', 'marketing', 'other')),
  -- Deliberately NO foreign key: lessons are deleted/recreated on republish
  -- and history must survive content restructures (identity-migration
  -- contract, coursegen 66b7e8b). Joins go through the views below.
  lesson_id    uuid,
  -- Content-id charset, not just a length cap: a length-only constraint is
  -- still a free-text channel (64 chars of anything, 25 per batch). With the
  -- charset CHECK there is genuinely nowhere to put prose.
  segment_id   text check (segment_id is null or segment_id ~ '^[A-Za-z0-9._-]{1,64}$'),
  value        numeric(12, 2),
  created_at   timestamptz not null default now()
);

alter table learning_events enable row level security;
-- No client policies — ingest and reads both go through Core.

create index if not exists idx_learning_events_user_time on learning_events (user_id, created_at desc);
create index if not exists idx_learning_events_event_time on learning_events (event, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Insight views — aggregation lives in Postgres, not in Core
-- ─────────────────────────────────────────────────────────────

-- Which exercises are miscalibrated. Built ENTIRELY from data the product
-- already records server-side (lesson_segment_attempts, 0007/0012) — this
-- view needs no new collection and no consent beyond the product itself.
-- High avg_attempts + high hint_rate + low first_try_score = the exercise is
-- too hard or the prompt is broken; 1.0 first-try pass = it teaches nothing.
create or replace view insights_segment_calibration as
select
  a.lesson_id,
  l.slug                                          as lesson_slug,
  l.title                                         as lesson_title,
  a.segment_id,
  count(*)                                        as attempts,
  count(distinct a.user_id)                       as learners,
  round(avg(a.score), 1)                          as avg_score,
  round(count(*)::numeric
        / nullif(count(distinct a.user_id), 0), 2) as avg_attempts_per_learner,
  round(avg(case when a.hints_used > 0 then 1 else 0 end), 4) as hint_rate,
  round(avg(a.score) filter (where a.attempt_number = 1), 1)  as first_try_avg_score,
  max(a.created_at)                               as last_attempt_at
from lesson_segment_attempts a
left join lessons l on l.id = a.lesson_id
group by a.lesson_id, l.slug, l.title, a.segment_id;

-- Daily rhythm of the platform, segmented by role — retention curves,
-- session cadence, and surface interest all read from here.
-- KNOWN PRE-SCALE WORK (INSIGHTS.md §6): the day filter is a ::date cast, so
-- it cannot use the created_at btrees — every admin load scans the table.
-- Fine at current volume; before large-scale rollout this becomes a
-- materialized rollup refreshed on a schedule, shipped together with the
-- ~400-day prune delta.
create or replace view insights_daily_activity as
select
  created_at::date          as day,
  role,
  event,
  route_class,
  count(*)                  as events,
  count(distinct user_id)   as users,
  round(sum(value), 2)      as total_value
from learning_events
group by 1, 2, 3, 4;

-- Family dynamics: how households actually use the task system.
create or replace view insights_family_engagement as
select
  f.id                                                   as family_id,
  f.created_at                                           as family_created_at,
  count(distinct fm.user_id)                             as members,
  count(distinct t.id)                                   as tasks_created,
  count(distinct t.id) filter (where t.status = 'done')  as tasks_completed,
  max(t.created_at)                                      as last_task_at
from families f
left join family_members fm on fm.family_id = f.id
left join tasks t on t.family_id = f.id
group by f.id, f.created_at;

-- The views run with the owner's privileges (they must — the underlying
-- tables are RLS-with-no-policies by design), so client roles are cut off
-- explicitly. Only Core's service role may read them.
revoke all on insights_segment_calibration from public, anon, authenticated;
revoke all on insights_daily_activity from public, anon, authenticated;
revoke all on insights_family_engagement from public, anon, authenticated;
grant select on insights_segment_calibration, insights_daily_activity, insights_family_engagement to service_role;
