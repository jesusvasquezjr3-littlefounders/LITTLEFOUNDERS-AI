-- 0025_insights_scale.sql — make the insights layer survive real volume.
--
-- 0023/0024 built the capture and the questions. This migration is about the
-- part that decides whether any of it still works at a million rows:
--
-- 1. THE DAILY VIEW COULD NOT USE AN INDEX. `insights_daily_activity` grouped
--    on `created_at::date` and Core filtered with `day >= X`. A cast on the
--    left of a predicate is not sargable, so every admin page load sequentially
--    scanned the whole table. Replaced with ACCUMULATING ROLLUP TABLES written
--    nightly over a trailing window; raw range queries stop casting and ride
--    the plain created_at index instead (an index ON the cast is impossible —
--    see §2). Rollup rows are frozen once written, so they outlive the raw
--    events they came from and the retention prune cannot erase history.
--
-- 2. RETENTION IS NOW EXECUTABLE, NOT DOCUMENTED. `prune_learning_events()`
--    deletes beyond the window in genuinely committed batches (a PROCEDURE —
--    a function cannot COMMIT, so its "batching" was one giant transaction)
--    and reports what it removed; the nightly job calls it. A retention policy
--    that lives only in a doc is not a retention policy.
--
-- 3. DEAD VOCABULARY REMOVED. `video_play`, `game_complete` and
--    `task_complete` were declared in 0024 but nothing can emit them — there
--    is no video, and Games/Tasks are placeholder surfaces. Declared-but-never-
--    emitted events are how a dashboard silently lies with empty series; the
--    enum now describes only what the product can actually produce. They come
--    back in the same commit as the features that emit them.
--
-- 4. TIME-TO-VALUE + ENGAGEMENT SCORE — the two derived measures the console
--    needs and that are expensive to compute per request.

-- ─────────────────────────────────────────────────────────────
-- 1. Honest vocabulary
-- ─────────────────────────────────────────────────────────────
delete from public.learning_events where event in ('video_play', 'game_complete', 'task_complete');

alter table public.learning_events drop constraint if exists learning_events_event_check;
alter table public.learning_events add constraint learning_events_event_check check (event in (
  'session_start', 'session_heartbeat', 'session_end', 'nav_view',
  'page_view', 'cta_click', 'scroll_depth',
  'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
  'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
  'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
  'hint_open', 'explanation_view', 'audio_replay', 'results_view',
  'game_open', 'task_view', 'profile_edit', 'avatar_edit', 'tutor_open',
  'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke'
));

-- ─────────────────────────────────────────────────────────────
-- 2. Sargable day access + the accumulating rollups
-- ─────────────────────────────────────────────────────────────
-- NOTE: there is deliberately no index on (created_at::date). A timestamptz→
-- date cast depends on the session TimeZone, so Postgres rejects it in an
-- index expression as non-IMMUTABLE. The fix is not to force it (an immutable
-- wrapper would silently freeze a timezone into the index) but to stop
-- casting on the left of predicates: raw range queries filter
-- `created_at >= <timestamptz>` and ride idx_learning_events_created (0024),
-- while day-grained aggregation is answered by the rollups below, where the
-- cast is computed once per refresh instead of once per row per query.

/*
 * insights_daily_activity has now been three shapes: a plain VIEW (0024), a
 * MATERIALIZED view (this migration's first draft), and — below — a real
 * TABLE. Every DROP form raises rather than no-ops when the object is one of
 * the other kinds, so no fixed order is safe. Decide from the catalog.
 */
do $$
declare kind char;
begin
  select relkind into kind from pg_class
   where relname = 'insights_daily_activity' and relnamespace = 'public'::regnamespace;
  if    kind = 'm' then execute 'drop materialized view insights_daily_activity';
  elsif kind = 'v' then execute 'drop view insights_daily_activity';
  -- kind = 'r' (already the table) is left in place: dropping it would
  -- destroy exactly the history this design exists to preserve.
  end if;
end
$$;

/*
 * WHY A TABLE AND NOT A MATERIALIZED VIEW.
 *
 * A matview is fully recomputed from its source on every refresh. Combined
 * with prune_learning_events(), that made the retention story a lie: the
 * night after raw events aged out, the next refresh recomputed the rollup
 * WITHOUT them and silently erased that day from history. "Aggregates survive
 * the prune" is only true if the aggregate is never recomputed from data that
 * no longer exists.
 *
 * So the rollup is an accumulating table. refresh_insights_rollups() rewrites
 * only a trailing window (default 7 days — long enough to absorb late or
 * backdated arrivals, short enough to stay cheap); every older row is frozen
 * and outlives the raw events it was derived from. This also turns the
 * nightly cost from "scan the whole table" into "scan the last week".
 *
 * Dimensions default to '' rather than NULL so the primary key is total (NULL
 * never equals NULL, so a nullable key column silently permits duplicates and
 * breaks the upsert). '' is falsy in JS, so readers' `if (!route_class)`
 * checks keep working unchanged.
 */
create table if not exists public.insights_daily_activity (
  day         date   not null,
  role        text   not null,
  event       text   not null,
  route_class text   not null default '',
  device      text   not null default '',
  locale      text   not null default '',
  events      bigint not null,
  users       bigint not null,
  sessions    bigint not null,
  total_value numeric,
  primary key (day, role, event, route_class, device, locale)
);

/*
 * DISTINCT USERS CANNOT BE SUMMED. insights_daily_activity.users is a
 * count-distinct *within one dimension combination*; adding those numbers
 * across events/devices/locales counts the same child once per combination
 * and inflates "active users" several-fold. Distinct counts are not additive,
 * and no amount of care in the caller makes them so.
 *
 * This second rollup holds the counts that ARE the answer, computed once at
 * the right grain. role = '' is the synthetic ALL-ROLES row: the true distinct
 * count for the day, not the sum of the per-role rows (a user whose role
 * changed mid-window appears under both).
 */
create table if not exists public.insights_daily_users (
  day      date   not null,
  role     text   not null,
  users    bigint not null,
  sessions bigint not null,
  primary key (day, role)
);

-- The earlier draft's zero-argument overload must go: leaving it beside the
-- new (integer) form makes every `select refresh_insights_rollups()` fail with
-- "function is not unique" rather than resolving to the default.
drop routine if exists refresh_insights_rollups();

/*
 * Rewrite the trailing window. Deliberately NOT a full recompute — see above.
 * `window_days` is widened only for the initial backfill:
 *     select refresh_insights_rollups(4000);
 */
create or replace function refresh_insights_rollups(window_days integer default 7)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  cutoff date := current_date - greatest(window_days, 0);
  touched bigint;
begin
  delete from public.insights_daily_activity where day >= cutoff;
  insert into public.insights_daily_activity
    (day, role, event, route_class, device, locale, events, users, sessions, total_value)
  select
    created_at::date,
    role,
    event,
    coalesce(route_class, ''),
    coalesce(device, ''),
    coalesce(locale, ''),
    count(*),
    count(distinct coalesce(user_id::text, anon_id::text)),
    count(distinct session_id),
    round(sum(value), 2)
  from public.learning_events
  where created_at >= cutoff
  group by 1, 2, 3, 4, 5, 6;
  get diagnostics touched = row_count;

  delete from public.insights_daily_users where day >= cutoff;
  insert into public.insights_daily_users (day, role, users, sessions)
  select created_at::date,
         role,
         count(distinct coalesce(user_id::text, anon_id::text)),
         count(distinct session_id)
  from public.learning_events
  where created_at >= cutoff
  group by 1, 2
  union all
  select created_at::date,
         '',
         count(distinct coalesce(user_id::text, anon_id::text)),
         count(distinct session_id)
  from public.learning_events
  where created_at >= cutoff
  group by 1;

  return format('rolled up %s rows from %s', touched, cutoff);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Executable retention
-- ─────────────────────────────────────────────────────────────
/*
 * Delete raw events beyond the retention window.
 *
 * 400 days: one full school year of cohort comparison plus margin, the longest
 * question the product actually asks of RAW events. Day-grained history lives
 * in the rollups above and is never pruned, so long-run trend is unaffected.
 *
 * A PROCEDURE, not a function, and that is load-bearing: a plpgsql FUNCTION
 * always runs inside its caller's transaction, so the "bounded batches" loop
 * it used to contain committed nothing — every batch accumulated into one
 * enormous transaction, holding locks and bloating WAL exactly as batching was
 * meant to avoid. Only a procedure may COMMIT mid-loop.
 */
/*
 * DROP ROUTINE, not DROP FUNCTION: this object shipped as a FUNCTION in an
 * earlier draft and is a PROCEDURE now, and `DROP FUNCTION` raises
 * "... is not a function" against a procedure instead of no-opping — the same
 * catalog asymmetry as view/matview above, and it aborts the whole migration.
 * DROP ROUTINE covers both kinds.
 */
drop routine if exists prune_learning_events(integer, integer);
drop routine if exists prune_learning_events(integer, integer, bigint);

/*
 * Audit trail of retention runs. A deletion policy that leaves no record of
 * having run cannot be shown to have run — and this is also how the procedure
 * reports its result: it CANNOT return one. A procedure that performs
 * transaction control may not have output parameters (Postgres executes those
 * through a portal that pins a snapshot, and COMMIT under a held snapshot
 * raises "invalid transaction termination"). So the count is written here and
 * the caller reads the last row.
 */
create table if not exists public.insights_maintenance_log (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  job         text        not null,
  retain_days integer,
  removed     bigint      not null default 0
);

create index if not exists idx_maintenance_log_ran on public.insights_maintenance_log (ran_at desc);

/*
 * NOTE: no `SET search_path` clause, and that is required rather than an
 * oversight — Postgres forbids transaction control inside a routine that
 * carries a SET clause ("invalid transaction termination"), because the
 * setting has to be restored at exit and a COMMIT would discard that state.
 * Safe here because every object reference below is schema-qualified and the
 * routine is SECURITY INVOKER (the search_path hardening that matters applies
 * to SECURITY DEFINER, where an attacker-controlled path picks the code that
 * runs as the owner).
 */
create or replace procedure prune_learning_events(
  retain_days integer default 400,
  batch_size  integer default 50000
)
language plpgsql
security invoker
as $$
declare
  cutoff  timestamptz := now() - make_interval(days => retain_days);
  removed bigint := 0;
  batch   bigint;
begin
  loop
    delete from public.learning_events
    where ctid in (
      select ctid from public.learning_events where created_at < cutoff limit batch_size
    );
    get diagnostics batch = row_count;
    removed := removed + batch;
    commit;                       -- each batch is durable on its own
    exit when batch = 0;
  end loop;

  -- Visitors whose events are all gone and who never converted carry no
  -- remaining analytical value; converted rows stay for attribution history.
  delete from public.anon_visitors v
  where v.converted_at is null
    and v.last_seen_at < cutoff
    and not exists (select 1 from public.learning_events e where e.anon_id = v.anon_id);

  insert into public.insights_maintenance_log (job, retain_days, removed)
  values ('prune_learning_events', retain_days, removed);
  commit;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Derived measures the console needs
-- ─────────────────────────────────────────────────────────────

-- TIME TO VALUE: how long from first sight to first completed lesson. The
-- single number that says whether onboarding works.
--
-- The scan is restricted to the events that can possibly contribute. Without
-- the event filter this aggregated EVERY row in the table — tens of millions
-- of segment_view rows — to find three timestamps per user. With it, the
-- partial index below answers it directly.
create index if not exists idx_learning_events_lifecycle
  on public.learning_events (user_id, event, created_at)
  where user_id is not null
    and event in ('signup_complete', 'session_start', 'first_lesson_complete');

create or replace view insights_time_to_value as
with firsts as (
  select
    user_id,
    min(created_at) filter (where event in ('signup_complete', 'session_start')) as first_seen,
    min(created_at) filter (where event = 'first_lesson_complete')               as activated_at
  from public.learning_events
  where user_id is not null
    and event in ('signup_complete', 'session_start', 'first_lesson_complete')
  group by user_id
)
select
  user_id,
  first_seen,
  activated_at,
  round(extract(epoch from (activated_at - first_seen)) / 3600, 2) as hours_to_value
from firsts
where first_seen is not null;

-- ENGAGEMENT SCORE: one comparable 0-100 number per learner, so cohorts and
-- segments can be ranked without re-deriving the formula in every caller.
-- Weights are deliberately simple and visible: breadth (lessons), consistency
-- (streak), and depth (sessions) — see /INSIGHTS.md §9.
create or replace view insights_engagement as
select
  s.user_id,
  s.xp_points,
  s.lessons_completed,
  s.streak_days,
  s.longest_streak,
  coalesce(e.sessions, 0)      as sessions_30d,
  coalesce(e.active_days, 0)   as active_days_30d,
  least(100, round(
      least(40, s.lessons_completed * 4)
    + least(30, s.longest_streak * 3)
    + least(30, coalesce(e.active_days, 0) * 2)
  ))                            as engagement_score
from public.learning_stats s
left join (
  select user_id,
         count(distinct session_id)       as sessions,
         count(distinct created_at::date) as active_days
  from public.learning_events
  where user_id is not null and created_at >= now() - interval '30 days'
  group by user_id
) e on e.user_id = s.user_id;

-- Client roles stay cut off — these run with owner privileges over
-- RLS-with-no-policy tables, so a missing REVOKE is a readable bypass.
revoke all on insights_daily_activity, insights_daily_users, insights_time_to_value, insights_engagement
  from public, anon, authenticated;
grant select on insights_daily_activity, insights_daily_users, insights_time_to_value, insights_engagement
  to service_role;
revoke all on function refresh_insights_rollups(integer) from public, anon, authenticated;
revoke all on procedure prune_learning_events(integer, integer) from public, anon, authenticated;
grant execute on function refresh_insights_rollups(integer) to service_role;
grant execute on procedure prune_learning_events(integer, integer) to service_role;

-- The rollups are written by the maintenance job under owner privileges and
-- read only through Core's service role; RLS keeps client roles out entirely.
alter table public.insights_daily_activity  enable row level security;
alter table public.insights_daily_users     enable row level security;
alter table public.insights_maintenance_log enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 5. Two views 0024 left with a whole-table shape
-- ─────────────────────────────────────────────────────────────

/*
 * COHORT RETENTION — the correlated subquery had to go.
 *
 * `(select count(distinct user_id) from first_seen f2 where f2.cohort_week =
 * a.cohort_week)` was evaluated once per output group, and `first_seen` is
 * itself an aggregate over every event ever recorded. Cohort size is a fixed
 * property of a cohort, so it belongs in a single pre-aggregation joined once.
 * Same numbers, one pass instead of one-pass-per-group.
 */
create or replace view insights_cohort_retention as
with first_seen as (
  select user_id, date_trunc('week', min(created_at))::date as cohort_week
  from public.learning_events where user_id is not null group by user_id
),
cohort_sizes as (
  select cohort_week, count(*) as cohort_size from first_seen group by cohort_week
),
activity as (
  select e.user_id, f.cohort_week,
         (date_trunc('week', e.created_at)::date - f.cohort_week) / 7 as week_offset
  from public.learning_events e join first_seen f on f.user_id = e.user_id
  where e.user_id is not null
)
select a.cohort_week,
       a.week_offset,
       count(distinct a.user_id) as users,
       c.cohort_size
from activity a
join cohort_sizes c on c.cohort_week = a.cohort_week
where a.week_offset between 0 and 12
group by a.cohort_week, a.week_offset, c.cohort_size;

/*
 * SESSION DEPTH — bounded to a rolling 90 days.
 *
 * This view aggregates the ENTIRE event table into one row per session, and
 * Core then filters `started_at >= X` on the RESULT: the window never reached
 * the scan, so asking for the last 7 days cost exactly as much as asking for
 * everything. It is a recent-sessions inspector — the console shows at most
 * 1000 rows, newest first — so the window belongs inside the view, where it
 * prunes the scan instead of the output.
 *
 * Long-range session questions are answered by insights_daily_users.sessions,
 * which is rolled up daily and kept forever. The route clamps `days` to 90 to
 * match, rather than accepting a parameter it cannot honour.
 */
create or replace view insights_session_depth as
select
  session_id,
  min(created_at)                                       as started_at,
  max(role)                                             as role,
  max(device)                                           as device,
  max(locale)                                           as locale,
  count(*)                                              as events,
  count(distinct route_class)                           as surfaces,
  count(*) filter (where event = 'lesson_start')        as lessons_started,
  round(sum(value) filter (where event = 'session_heartbeat'), 0) as visible_seconds,
  max(value) filter (where event = 'session_end')       as reported_seconds
from public.learning_events
where session_id is not null
  and created_at >= now() - interval '90 days'
group by session_id;

revoke all on insights_cohort_retention, insights_session_depth from public, anon, authenticated;
grant select on insights_cohort_retention, insights_session_depth to service_role;

/*
 * TODAY IS NOT IN THE ROLLUP, AND THE CONSOLE MUST NOT READ THAT AS ZERO.
 *
 * The rollup is written nightly, so on any given day it holds nothing for the
 * current day. A dashboard that silently renders "0 events today" when there
 * were hundreds is the same class of defect as every other one this migration
 * fixes: a number that looks authoritative and is wrong.
 *
 * These two views compute the CURRENT DAY only, from raw events. They are
 * cheap for exactly the reason the old whole-table view was not: the filter is
 * `created_at >= current_date` with no cast on the left, so it rides
 * idx_learning_events_created and touches one day of rows. Core concatenates
 * them onto the rollup, so the console shows live-today plus frozen-history —
 * scalable AND current, rather than choosing one.
 */
create or replace view insights_today_activity as
select
  created_at::date                  as day,
  role,
  event,
  coalesce(route_class, '')         as route_class,
  coalesce(device, '')              as device,
  coalesce(locale, '')              as locale,
  count(*)                          as events,
  count(distinct coalesce(user_id::text, anon_id::text)) as users,
  count(distinct session_id)        as sessions,
  round(sum(value), 2)              as total_value
from public.learning_events
where created_at >= current_date
group by 1, 2, 3, 4, 5, 6;

create or replace view insights_today_users as
select created_at::date as day, role,
       count(distinct coalesce(user_id::text, anon_id::text)) as users,
       count(distinct session_id) as sessions
from public.learning_events
where created_at >= current_date
group by 1, 2
union all
select created_at::date, '',
       count(distinct coalesce(user_id::text, anon_id::text)),
       count(distinct session_id)
from public.learning_events
where created_at >= current_date
group by 1;

revoke all on insights_today_activity, insights_today_users from public, anon, authenticated;
grant select on insights_today_activity, insights_today_users to service_role;

-- Backfill so the console is not blank until the first nightly run.
select refresh_insights_rollups(4000);
