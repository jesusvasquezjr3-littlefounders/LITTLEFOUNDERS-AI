-- @phase: expand
--   Adds read-only views over tables that already exist. Nothing is dropped,
--   narrowed or rewritten, so it is safe to apply before or after the code.
-- 0050_audience_insights.sql — who is actually out there, and how many of them
-- became real accounts.
--
-- WHY THESE EXIST
--
-- On 2026-08-28 the console could answer "how many lessons were completed" in
-- four different ways and could not answer "how many people signed up last
-- week" at all. Every existing insights view is built on `learning_events`,
-- which is a CONSENT-GATED, CLIENT-EMITTED stream: an anonymous visitor who
-- declines optional cookies emits nothing, and a browser that closes mid-flush
-- loses the tail. Measured in production the same day: 16 accounts were
-- created after instrumentation began, and `signup_complete` had fired ZERO
-- times. Two explanations fit that equally well — the funnel drops events, or
-- those accounts were created outside the signup form and only logged into —
-- and NOTHING in the schema could tell them apart.
--
-- That ambiguity is the defect these views close, and it is /AGENTS.md §1.14
-- exactly: an absence has to be distinguishable from a fault. So:
--
--   * `insights_registrations_daily` is the SERVER-SIDE TRUTH. It counts rows
--     in `profiles`, which exist because an account exists. No consent gate,
--     no browser, no beacon — and retroactive to the first account ever
--     created, where the event stream only starts on 2026-08-03.
--   * `insights_signup_funnel_integrity` sets that truth beside what the
--     client stream claims, per day. A gap is not corrected — it is REPORTED,
--     because a client funnel silently under-counting is a thing an operator
--     must be told rather than have smoothed over.
--   * `insights_audience_daily` answers "who was here" with DISTINCT SESSIONS
--     per day per role. Distinct counts are not additive, so this cannot be
--     derived by summing `insights_daily_activity` across its dimensions — the
--     one existing view that looks like it should work.
--   * `insights_anon_acquisition` finally reads `anon_visitors`, a table that
--     has been collecting landing route, referrer class, device, locale, UTM
--     and CONVERSION since 0024 and that nothing has ever queried.
--
-- POSTURE: same as every other insights view (0023 §"aggregation lives in
-- Postgres, not in Core") — service-role only, revoked from every client role.
-- None of these expose an email, a name or an address; the registration views
-- are pure counts, and `anon_visitors` holds no identity by construction.

-- ─────────────────────────────────────────────────────────────
-- 1. Registrations — the consent-independent denominator
-- ─────────────────────────────────────────────────────────────
-- `role` comes from `user_roles`, which is the authority; a profile with no
-- role row is counted as 'unknown' rather than dropped, because a user who
-- exists and cannot be classified is a fact worth seeing, not a row to hide.
create or replace view insights_registrations_daily as
select
  (p.created_at at time zone 'UTC')::date              as day,
  coalesce(
    (select ur.role from user_roles ur where ur.user_id = p.user_id order by ur.role limit 1),
    'unknown'
  )                                                     as role,
  count(*)                                              as registrations
from profiles p
group by 1, 2;

-- ─────────────────────────────────────────────────────────────
-- 2. Funnel integrity — the truth beside the claim
-- ─────────────────────────────────────────────────────────────
-- Deliberately a FULL OUTER JOIN on the day: a day where the client reported
-- signups and no account exists is just as interesting as the reverse, and an
-- inner join would hide both.
create or replace view insights_signup_funnel_integrity as
with server as (
  select (created_at at time zone 'UTC')::date as day, count(*) as accounts_created
  from profiles group by 1
),
client as (
  select (created_at at time zone 'UTC')::date as day,
         count(*) filter (where event = 'signup_start')    as signup_start,
         count(*) filter (where event = 'signup_submit')   as signup_submit,
         count(*) filter (where event = 'signup_complete') as signup_complete
  from learning_events
  where event in ('signup_start', 'signup_submit', 'signup_complete')
  group by 1
)
select
  coalesce(s.day, c.day)                    as day,
  coalesce(s.accounts_created, 0)           as accounts_created,
  coalesce(c.signup_start, 0)               as signup_start,
  coalesce(c.signup_submit, 0)              as signup_submit,
  coalesce(c.signup_complete, 0)            as signup_complete,
  -- Positive = accounts the client stream never saw. This is the number that
  -- says how far the consent-gated funnel can be trusted on a given day.
  coalesce(s.accounts_created, 0) - coalesce(c.signup_complete, 0) as unobserved
from server s
full outer join client c on c.day = s.day;

-- ─────────────────────────────────────────────────────────────
-- 3. Audience — distinct sessions per day per role
-- ─────────────────────────────────────────────────────────────
-- `anon` is a first-class row here, not an absence: separating people who have
-- never had an account from people who have one is the whole question this
-- view exists to answer, and staff are separated for the same reason — they
-- are 90% of the event volume on a pre-launch product and would otherwise
-- drown every other line on the chart.
create or replace view insights_audience_daily as
select
  (created_at at time zone 'UTC')::date                     as day,
  role,
  count(distinct session_id)                                as sessions,
  count(distinct user_id) filter (where role <> 'anon')      as users,
  count(distinct anon_id) filter (where anon_id is not null) as visitors,
  count(*)                                                   as events,
  count(distinct route_class) filter (where route_class is not null) as surfaces
from learning_events
group by 1, 2;

-- ─────────────────────────────────────────────────────────────
-- 4. Anonymous acquisition — a table nothing has ever read
-- ─────────────────────────────────────────────────────────────
-- One row per anonymous visitor, with whether they ever became an account.
-- `days_to_convert` is null for everyone who did not, which is the honest
-- shape: it is not zero, and it is not a pending conversion.
create or replace view insights_anon_acquisition as
select
  (first_seen_at at time zone 'UTC')::date  as first_seen_day,
  landing_route,
  coalesce(referrer_class, 'unknown')       as referrer_class,
  coalesce(device, 'unknown')               as device,
  coalesce(locale, 'unknown')               as locale,
  coalesce(utm_source, '(none)')            as utm_source,
  coalesce(utm_campaign, '(none)')          as utm_campaign,
  count(*)                                                        as visitors,
  count(*) filter (where converted_user_id is not null)           as converted,
  round(
    avg(extract(epoch from (converted_at - first_seen_at)) / 86400.0)
      filter (where converted_user_id is not null),
    2
  )                                                               as avg_days_to_convert
from anon_visitors
group by 1, 2, 3, 4, 5, 6, 7;

-- ─────────────────────────────────────────────────────────────
-- Grants — service role only, like every other insights view
-- ─────────────────────────────────────────────────────────────
revoke all on insights_registrations_daily, insights_signup_funnel_integrity,
  insights_audience_daily, insights_anon_acquisition
  from public, anon, authenticated;

grant select on insights_registrations_daily, insights_signup_funnel_integrity,
  insights_audience_daily, insights_anon_acquisition
  to service_role;

-- Indexes the views lean on. `created_at` alone is not covered by the existing
-- (user_id, created_at) and (event, created_at) indexes for a bare day rollup.
create index if not exists idx_learning_events_created_at on learning_events (created_at desc);
create index if not exists idx_profiles_created_at on profiles (created_at desc);
create index if not exists idx_anon_visitors_first_seen on anon_visitors (first_seen_at desc);
