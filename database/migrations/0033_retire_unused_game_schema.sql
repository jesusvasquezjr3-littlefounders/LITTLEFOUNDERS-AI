-- 0033_retire_unused_game_schema.sql — remove the never-shipped game feature.
-- Delta over 0032; do not edit historical migrations. The application, routes,
-- analytics code and Railway service were removed before this forward cleanup.
-- This migration makes the database agree with the product decision: lessons,
-- tasks and the tutor are the active learning surfaces; no game tables or game
-- telemetry are part of the production schema.

-- Remove any rows that could have been written by an old local build before
-- the tables themselves disappear. Production sits at migration 0022 exactly
-- (verified 2026-08-02 by a read-only signature-object probe), so on the
-- production handoff path 0023 creates learning_events earlier in the same
-- delta run and it holds zero game rows there; this cleanup exists for
-- local/QA databases whose frontend predates the game removal.
DELETE FROM public.learning_events
WHERE event IN ('game_open', 'game_start', 'game_complete');

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_event_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_event_check CHECK (event IN (
    'session_start', 'session_heartbeat', 'session_end', 'nav_view',
    'page_view', 'cta_click', 'scroll_depth',
    'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
    'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
    'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
    'hint_open', 'explanation_view', 'audio_replay', 'results_view',
    'task_view', 'profile_edit', 'avatar_edit', 'tutor_open',
    'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke'
  ));

-- Rows on the retired games surface can outlive the game events deleted above:
-- session/nav/page telemetry has legally carried route_class = 'games' since
-- 0023. Reclassify them as 'other' (the catch-all surface bucket) instead of
-- deleting — they are legitimate kid session history, and any surviving
-- 'games' row would otherwise violate the tightened CHECK below (23514) and
-- abort this migration. The UPDATE is a no-op on replay.
UPDATE public.learning_events
SET route_class = 'other'
WHERE route_class = 'games';

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_route_class_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_route_class_check CHECK (route_class IN (
    'learn', 'tasks', 'profile', 'tutor', 'family', 'admin', 'marketing', 'other'
  ));

-- The 0025 rollup table (insights_daily_activity) freezes route_class into
-- day-grained history with NO CHECK constraint, so local/QA rollup rows keyed
-- 'games' would survive the raw-stream remap above — disagreeing with the
-- remapped raw events and unreachable from Core's surface filters. Merge them
-- into 'other' instead of a plain UPDATE: route_class is part of the primary
-- key, so a same-key 'other' row may already exist and a bare UPDATE would
-- raise 23505. events/total_value are additive and are summed; users/sessions
-- are count-distincts per dimension combination, which are NOT additive (see
-- 0025) — the true merged distinct count lies between max and sum, so the
-- merge takes GREATEST, the defensible floor that never inflates.
-- insights_daily_users has no route_class dimension and needs no remap.
-- Production is unaffected: on the handoff path 0025 creates the table empty
-- within the same delta run. Idempotent: once no 'games' rows remain, both
-- statements are no-ops on replay.
INSERT INTO public.insights_daily_activity AS t
  (day, role, event, route_class, device, locale, events, users, sessions, total_value)
SELECT day, role, event, 'other', device, locale, events, users, sessions, total_value
FROM public.insights_daily_activity
WHERE route_class = 'games'
ON CONFLICT (day, role, event, route_class, device, locale) DO UPDATE SET
  events      = t.events + excluded.events,
  users       = greatest(t.users, excluded.users),
  sessions    = greatest(t.sessions, excluded.sessions),
  total_value = CASE
    WHEN t.total_value IS NULL AND excluded.total_value IS NULL THEN NULL
    ELSE coalesce(t.total_value, 0) + coalesce(excluded.total_value, 0)
  END;

DELETE FROM public.insights_daily_activity
WHERE route_class = 'games';

ALTER TABLE public.learning_events
  DROP COLUMN IF EXISTS game_id;

DROP TABLE IF EXISTS public.game_progress CASCADE;
DROP TABLE IF EXISTS public.game_attempts CASCADE;
DROP TABLE IF EXISTS public.game_documents CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;
