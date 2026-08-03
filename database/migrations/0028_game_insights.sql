-- 0028_game_insights.sql — the Game Engine's two events and its content id.
--
-- 0025 §3 DELETED `game_complete` as dead vocabulary, with the rule that such
-- values "come back in the same commit as the features that emit them". The
-- Game Engine is that feature, so this is that commit: `game_complete` returns
-- and `game_start` joins it, alongside the `game_id` column that says WHICH
-- game an event is about.
--
-- §1.9 REVIEW — the "widening this table = §1.9 review first" gate from 0023.
-- Nothing about the privacy posture changes, and each part of that is a
-- property of the schema rather than a promise about the code:
--
--  1. THE VOCABULARY STAYS CLOSED. `event` remains a CHECK-constrained enum;
--     this migration re-declares the FULL list rather than relaxing it, so the
--     only new things expressible are the two named events. A closed enum is
--     also why the mirrors in Core (backend/src/services/insights.ts) and the
--     browser beacon (frontend/src/lib/insights.ts) must move in this same
--     commit: a value Core accepts but Postgres rejects fails the INSERT for
--     the whole 25-event batch, not just the offending row.
--
--  2. THE PAYLOAD STAYS NUMERIC-ONLY, BY CONSTRUCTION. No jsonb column, no
--     open string column, is added here. A game event carries `value`
--     (numeric) and `game_id` (uuid) and nothing else that a game could put
--     words into — so, exactly as in 0023, there is nowhere for a chat
--     message, a search query, or any child-authored text to go. Scores and
--     input logs live in game_attempts (0027), never in this stream.
--
--  3. KID EVENTS REMAIN GATED BY THE EXISTING FAIL-CLOSED CONSENT GATE. These
--     two events go through POST /api/v1/events and the server-side
--     game-completion path like every other event: a kid's rows are recorded
--     ONLY while an active analytics_consents row exists, and if Vault cannot
--     answer the consent question the batch is dropped. No new ingest path and
--     no new exemption is introduced here.
--
--  4. `game_id` IDENTIFIES PLATFORM CONTENT, NEVER A PERSON. It is the id of a
--     row in `games` — an authored, published artifact of ours, the same class
--     of identifier as `lesson_id`. It says which game was played; it says
--     nothing about who played it beyond what `user_id` already says, and it
--     cannot be resolved to a child by anyone who does not already hold the
--     user id.
--
-- Posture is unchanged from 0023-0025: RLS enabled with ZERO client policies,
-- ingest through Core, reads through Core, nothing to a third party or an AI
-- API.

-- ─────────────────────────────────────────────────────────────
-- 1. The event vocabulary, re-declared in full
-- ─────────────────────────────────────────────────────────────
-- The 0024/0025 mechanism: a CHECK cannot be extended, only replaced, so the
-- constraint is dropped and re-added with the COMPLETE list. Every value below
-- that is not `game_start`/`game_complete` is carried verbatim from the 0025
-- constraint — omitting one would silently start rejecting live capture for a
-- surface that is already emitting it.
alter table public.learning_events drop constraint if exists learning_events_event_check;
alter table public.learning_events add constraint learning_events_event_check check (event in (
  'session_start', 'session_heartbeat', 'session_end', 'nav_view',
  'page_view', 'cta_click', 'scroll_depth',
  'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
  'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
  'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
  'hint_open', 'explanation_view', 'audio_replay', 'results_view',
  -- Game Engine. `game_open` (0024) is the HUB signal — someone looked at the
  -- games surface. These two are the PLAY signals: the player mounted, and the
  -- server accepted a replayed run. Distinct questions, distinct events.
  'game_open', 'game_start', 'game_complete',
  'task_view', 'profile_edit', 'avatar_edit', 'tutor_open',
  'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke'
));

-- ─────────────────────────────────────────────────────────────
-- 2. game_id — which game, deliberately without a foreign key
-- ─────────────────────────────────────────────────────────────
-- Same rationale as `lesson_id` in 0023, and for the same reason: games are
-- deleted and recreated on republish, and analytics history must survive
-- content restructures (the identity-migration contract). A foreign key would
-- either cascade the history away or block the republish. Joins go through the
-- views, which left-join and tolerate a game that no longer exists.
alter table public.learning_events add column if not exists game_id uuid;

-- ─────────────────────────────────────────────────────────────
-- 3. Views: nothing to change
-- ─────────────────────────────────────────────────────────────
/*
 * Every existing insights_* object over learning_events was checked against
 * these two additions and none of them mis-aggregates:
 *
 *  - insights_daily_activity / insights_daily_users (0025 rollup tables) and
 *    insights_today_activity / insights_today_users group BY `event`, so the
 *    new values appear as new rows rather than contaminating existing ones.
 *    refresh_insights_rollups() needs no change for the same reason.
 *  - insights_lesson_dropoff filters `lesson_id is not null` AND on the three
 *    lesson_* events; game rows carry a null lesson_id and a non-lesson event,
 *    so they cannot enter it.
 *  - insights_session_depth and insights_feature_adoption count events and
 *    surfaces generically — a played game SHOULD raise session depth and
 *    `games` adoption, which is exactly what they will now report.
 *  - insights_activation_funnel and insights_time_to_value enumerate the
 *    events they consider; neither list includes a game event.
 *  - insights_cohort_retention counts any activity, which a game legitimately
 *    is. insights_learning_velocity, insights_engagement,
 *    insights_segment_calibration and insights_family_engagement do not read
 *    the event column at all.
 *
 * No column is added to any view here: the game funnel view belongs with the
 * queries that will consume it, not ahead of them.
 */
