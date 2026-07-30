-- 0024_insights_depth.sql — the depth layer for /INSIGHTS.md.
--
-- 0023 proved the pipeline; it captured 8 events over 9 columns, which is
-- enough to know THAT people use the product and not much else. This
-- migration makes the data actually answer product questions: who activates,
-- where they fall off, how fast they learn, which acquisition source produced
-- them, and how any of that differs by device, locale or cohort.
--
-- Four additions:
--
-- 1. SESSION IDENTITY + DIMENSIONS on learning_events. Without session_id
--    every event floated free — "how deep is a typical session", "how many
--    sessions to first completion", "what do people do right before they
--    quit" were all unanswerable. device/locale/referrer_class turn every
--    metric into a segmentable one. `ordinal` is the event's position within
--    its session, which is what makes funnels and last-action-before-exit
--    analysis cheap.
--
-- 2. A MUCH WIDER EVENT VOCABULARY (still a closed enum — §1.9 rule 2 is
--    unchanged and non-negotiable). Marketing → signup → activation →
--    engagement → retention, so the whole lifecycle lives in one stream.
--
-- 3. ANONYMOUS ACQUISITION FUNNEL. anon_visitors is keyed by a FIRST-PARTY
--    cookie (lf_aid, our own domain, no third party, no cross-site anything).
--    It answers the question the product cannot currently answer at all:
--    which channel/campaign/landing page produces signups. On signup Core
--    links the visitor to the user — but ONLY for adults: if the account
--    turns out to be a kid, the linkage is dropped and the anon row is
--    orphaned, because a kid's pre-consent browsing must not become a
--    retained behavioural profile.
--
-- 4. SIX ANALYTICAL VIEWS: cohort retention, activation funnel, learning
--    velocity, drop-off, session depth, feature adoption.
--
-- Posture is unchanged from 0023: every table RLS-enabled with ZERO client
-- policies, every view REVOKEd from client roles and granted only to
-- service_role. Nothing here reaches a third party or an AI API.

-- ─────────────────────────────────────────────────────────────
-- 1. learning_events — session identity + segmentation dimensions
-- ─────────────────────────────────────────────────────────────

-- Client-generated per session (a page-load lifetime). NOT a foreign key and
-- NOT stable across sessions: it exists to group one visit's events, never to
-- follow a person across time. Cross-session identity is user_id (consented)
-- or anon_id (adults, first-party cookie) — never this.
alter table public.learning_events add column if not exists session_id uuid;

alter table public.learning_events add column if not exists device text
  check (device is null or device in ('mobile', 'tablet', 'desktop'));

alter table public.learning_events add column if not exists locale text
  check (locale is null or locale in ('en-US', 'es-MX', 'pt-BR'));

-- Coarse acquisition class, never a raw referrer URL (a URL can carry
-- identifiers and query strings — exactly the free-text channel §1.9 forbids).
alter table public.learning_events add column if not exists referrer_class text
  check (referrer_class is null or referrer_class in ('direct', 'search', 'social', 'referral', 'internal', 'campaign'));

-- Position of the event within its session (1-based). Makes "what was the
-- last thing before they left" and step-ordered funnels an index scan
-- instead of a window function over the whole table.
alter table public.learning_events add column if not exists ordinal integer;

create index if not exists idx_learning_events_session on public.learning_events (session_id, ordinal);
create index if not exists idx_learning_events_created on public.learning_events (created_at desc);

-- Wider closed vocabulary. Still an enum, still no free text: the whole
-- lifecycle is expressible without ever storing something a child typed.
alter table public.learning_events drop constraint if exists learning_events_event_check;
alter table public.learning_events add constraint learning_events_event_check check (event in (
  -- session lifecycle (0023)
  'session_start', 'session_heartbeat', 'session_end', 'nav_view',
  -- acquisition / marketing (anonymous or authenticated)
  'page_view', 'cta_click', 'scroll_depth', 'video_play',
  -- signup funnel
  'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
  -- activation
  'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
  -- lesson micro-behaviour (the calibration + frustration signals)
  'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
  'hint_open', 'explanation_view', 'audio_replay', 'results_view',
  -- other product surfaces
  'game_open', 'game_complete', 'task_view', 'task_complete',
  'profile_edit', 'avatar_edit', 'tutor_open',
  -- retention / family
  'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke'
));

-- ─────────────────────────────────────────────────────────────
-- 2. anon_visitors — the acquisition funnel, first-party only
-- ─────────────────────────────────────────────────────────────
-- One row per first-party cookie (lf_aid). Deliberately holds NO PII: no IP,
-- no user agent string, no raw referrer — only the coarse classes above plus
-- UTM-style campaign labels, which are OUR OWN marketing parameters.
create table if not exists anon_visitors (
  anon_id         uuid primary key,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  referrer_class  text check (referrer_class is null or referrer_class in ('direct', 'search', 'social', 'referral', 'internal', 'campaign')),
  utm_source      text check (utm_source is null or utm_source ~ '^[A-Za-z0-9._-]{1,64}$'),
  utm_medium      text check (utm_medium is null or utm_medium ~ '^[A-Za-z0-9._-]{1,64}$'),
  utm_campaign    text check (utm_campaign is null or utm_campaign ~ '^[A-Za-z0-9._-]{1,64}$'),
  landing_route   text check (landing_route is null or landing_route ~ '^[A-Za-z0-9/_-]{1,120}$'),
  device          text check (device is null or device in ('mobile', 'tablet', 'desktop')),
  locale          text check (locale is null or locale in ('en-US', 'es-MX', 'pt-BR')),
  -- Set on signup, ADULTS ONLY. A kid account never gets linked: their
  -- pre-consent browsing must not become a retained behavioural profile.
  converted_user_id uuid references auth.users (id) on delete set null,
  converted_at    timestamptz
);

alter table anon_visitors enable row level security;
-- No client policies — Core (service role) is the only reader/writer.

create index if not exists idx_anon_visitors_converted on anon_visitors (converted_at desc) where converted_at is not null;
create index if not exists idx_anon_visitors_campaign on anon_visitors (utm_campaign, first_seen_at desc);

-- Anonymous events live in the same stream, attributed to the cookie rather
-- than a user. NULL user_id was previously impossible; relax it and require
-- exactly one of the two identities.
alter table public.learning_events alter column user_id drop not null;
alter table public.learning_events add column if not exists anon_id uuid references anon_visitors (anon_id) on delete cascade;
alter table public.learning_events drop constraint if exists learning_events_identity_check;
alter table public.learning_events add constraint learning_events_identity_check
  check (user_id is not null or anon_id is not null);
-- `role` must tolerate the anonymous case.
alter table public.learning_events drop constraint if exists learning_events_role_check;
alter table public.learning_events add constraint learning_events_role_check
  check (role in ('anon', 'universal', 'parent', 'kid', 'bigfounder', 'admin', 'superadmin'));

create index if not exists idx_learning_events_anon on public.learning_events (anon_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3. Analytical views
-- ─────────────────────────────────────────────────────────────

-- COHORT RETENTION: of the users who first appeared in week W, how many came
-- back in week W+n. The single most load-bearing chart in a subscription
-- product — it says whether the thing actually holds people.
create or replace view insights_cohort_retention as
with first_seen as (
  select user_id, date_trunc('week', min(created_at))::date as cohort_week
  from learning_events where user_id is not null group by user_id
),
activity as (
  select e.user_id, f.cohort_week,
         (date_trunc('week', e.created_at)::date - f.cohort_week) / 7 as week_offset
  from learning_events e join first_seen f on f.user_id = e.user_id
  where e.user_id is not null
)
select cohort_week,
       week_offset,
       count(distinct user_id) as users,
       (select count(distinct user_id) from first_seen f2 where f2.cohort_week = a.cohort_week) as cohort_size
from activity a
where week_offset between 0 and 12
group by cohort_week, week_offset;

-- ACTIVATION FUNNEL: the ordered steps from landing to a completed lesson,
-- as distinct users per step. Where the product loses people.
create or replace view insights_activation_funnel as
select
  1 as step_order, 'visited'          as step, count(distinct coalesce(user_id::text, anon_id::text)) as users
  from learning_events where event in ('page_view', 'session_start')
union all
select 2, 'signup_started',  count(distinct coalesce(user_id::text, anon_id::text)) from learning_events where event = 'signup_start'
union all
select 3, 'signed_up',       count(distinct coalesce(user_id::text, anon_id::text)) from learning_events where event = 'signup_complete'
union all
select 4, 'opened_course',   count(distinct user_id::text) from learning_events where event = 'course_open'
union all
select 5, 'started_lesson',  count(distinct user_id::text) from learning_events where event = 'lesson_start'
union all
select 6, 'completed_lesson',count(distinct user_id::text) from learning_events where event = 'lesson_complete';

-- LEARNING VELOCITY: per learner, how much they actually got through and how
-- hard it was. Built from the product's own authoritative tables, so it works
-- regardless of telemetry consent.
create or replace view insights_learning_velocity as
select
  p.user_id,
  count(*) filter (where p.passed)                              as lessons_passed,
  round(avg(p.best_score), 1)                                   as avg_score,
  round(avg(p.attempts), 2)                                     as avg_attempts,
  min(p.completed_at)                                           as first_completion_at,
  max(p.completed_at)                                           as last_completion_at,
  -- Lessons passed per active week — the headline "are they moving" number.
  round(count(*) filter (where p.passed)::numeric
        / nullif(greatest(1, extract(epoch from (max(p.completed_at) - min(p.completed_at))) / 604800), 0), 2) as lessons_per_week,
  s.streak_days,
  s.longest_streak,
  s.xp_points
from lesson_progress p
left join learning_stats s on s.user_id = p.user_id
group by p.user_id, s.streak_days, s.longest_streak, s.xp_points;

-- DROP-OFF: where inside a lesson people quit, and how long they lasted.
create or replace view insights_lesson_dropoff as
select
  e.lesson_id,
  l.slug                                                as lesson_slug,
  count(*) filter (where e.event = 'lesson_start')       as starts,
  count(*) filter (where e.event = 'lesson_abandon')     as abandons,
  count(*) filter (where e.event = 'lesson_complete')    as completions,
  round(count(*) filter (where e.event = 'lesson_abandon')::numeric
        / nullif(count(*) filter (where e.event = 'lesson_start'), 0), 4) as abandon_rate,
  round(avg(e.value) filter (where e.event = 'lesson_abandon'), 1) as avg_seconds_before_abandon
from learning_events e
left join lessons l on l.id = e.lesson_id
where e.lesson_id is not null
group by e.lesson_id, l.slug;

-- SESSION DEPTH: how substantial a visit is, by role and device.
create or replace view insights_session_depth as
select
  session_id,
  min(created_at)                                      as started_at,
  max(role)                                            as role,
  max(device)                                          as device,
  max(locale)                                          as locale,
  count(*)                                             as events,
  count(distinct route_class)                          as surfaces,
  count(*) filter (where event = 'lesson_start')        as lessons_started,
  round(sum(value) filter (where event = 'session_heartbeat'), 0) as visible_seconds,
  max(value) filter (where event = 'session_end')       as reported_seconds
from learning_events
where session_id is not null
group by session_id;

-- FEATURE ADOPTION: which surfaces a given role actually reaches, and how
-- often — the "is anyone using this thing we built" view.
create or replace view insights_feature_adoption as
select
  role,
  route_class,
  count(*)                                             as events,
  count(distinct coalesce(user_id::text, anon_id::text)) as users,
  count(distinct session_id)                           as sessions,
  min(created_at)                                      as first_at,
  max(created_at)                                      as last_at
from learning_events
where route_class is not null
group by role, route_class;

-- Client roles are cut off explicitly: these views run with owner privileges
-- (the base tables are RLS-with-no-policies), so without this they would be a
-- readable bypass. Any NEW view over these tables must repeat this block.
revoke all on insights_cohort_retention, insights_activation_funnel, insights_learning_velocity,
              insights_lesson_dropoff, insights_session_depth, insights_feature_adoption
  from public, anon, authenticated;
grant select on insights_cohort_retention, insights_activation_funnel, insights_learning_velocity,
                insights_lesson_dropoff, insights_session_depth, insights_feature_adoption
  to service_role;
