-- 0033_retire_unused_game_schema.sql — remove the never-shipped game feature.
-- Delta over 0032; do not edit historical migrations. The application, routes,
-- analytics code and Railway service were removed before this forward cleanup.
-- This migration makes the database agree with the product decision: lessons,
-- tasks and the tutor are the active learning surfaces; no game tables or game
-- telemetry are part of the production schema.

-- Remove any rows that could have been written by an old local build before
-- the tables themselves disappear. Production was never migrated past 0011,
-- so this is also safe for the handoff path (the objects simply do not exist).
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

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_route_class_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_route_class_check CHECK (route_class IN (
    'learn', 'tasks', 'profile', 'tutor', 'family', 'admin', 'marketing', 'other'
  ));

ALTER TABLE public.learning_events
  DROP COLUMN IF EXISTS game_id;

DROP TABLE IF EXISTS public.game_progress CASCADE;
DROP TABLE IF EXISTS public.game_attempts CASCADE;
DROP TABLE IF EXISTS public.game_documents CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;
