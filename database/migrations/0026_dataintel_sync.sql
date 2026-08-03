-- 0026_dataintel_sync.sql — dataintel (DuckDB) sync views & cursor state in Vault.
--
-- dataintel is a companion analytics service backed by DuckDB that runs offline
-- analytical queries (cohorts, funnels, ML). It needs an efficient incremental
-- feed from Vault — a cursor it can resume from plus dimension views that
-- always serve the current shape of the data.
--
-- This migration creates:
--
-- 1. dataintel_sync_state       — cursor table (one row per source table).
-- 2. dataintel_events_sync      — raw event stream ordered by id (sync worker
--                                 filters `event_id > last_event_id` via
--                                 PostgREST query params).
-- 3. dataintel_users_sync       — user dimension (role, locale, XP, streak).
-- 4. dataintel_lessons_sync     — lesson dimension (title, course, segment count).
-- 5. dataintel_sessions_sync    — session summaries (rolling 90-day window).
--
-- Posture: service-role-only, matching the insights tables (0023-0025). RLS
-- enabled on the cursor table with zero client policies; every view is REVOKEd
-- from client roles and granted ONLY to service_role. dataintel ships its own
-- service-role key and queries Vault's PostgREST directly — nothing here is
-- ever served to a browser or sent to a third-party AI API.

-- ─────────────────────────────────────────────────────────────
-- 1. dataintel_sync_state — cursor table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dataintel_sync_state (
  table_name     TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_id  BIGINT DEFAULT 0,
  rows_synced    BIGINT DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO dataintel_sync_state (table_name, last_synced_at, last_event_id)
VALUES ('learning_events', now(), 0)
ON CONFLICT (table_name) DO NOTHING;

ALTER TABLE dataintel_sync_state ENABLE ROW LEVEL SECURITY;
-- Zero client policies — only service_role reads/writes this table.

CREATE INDEX IF NOT EXISTS idx_dataintel_sync_state_table
  ON dataintel_sync_state (table_name);

-- ─────────────────────────────────────────────────────────────
-- 2. dataintel_events_sync — incremental event feed
-- ─────────────────────────────────────────────────────────────
-- The sync worker queries:
--   /rest/v1/dataintel_events_sync?event_id=gt.<last_event_id>&limit=1000
-- and advances the cursor after each successful batch load.
CREATE OR REPLACE VIEW dataintel_events_sync AS
SELECT
  e.id AS event_id,
  e.user_id,
  e.anon_id,
  e.session_id,
  e.lesson_id,
  e.segment_id,
  e.event,
  e.role,
  e.route_class,
  e.device,
  e.locale,
  e.referrer_class,
  e.ordinal,
  e.value,
  e.created_at
FROM learning_events e
ORDER BY e.id ASC;

-- ─────────────────────────────────────────────────────────────
-- 3. dataintel_users_sync — user dimension
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW dataintel_users_sync AS
SELECT
  u.id AS user_id,
  COALESCE(
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id ORDER BY ur.granted_at DESC LIMIT 1),
    'universal'
  ) AS role,
  u.created_at,
  COALESCE(up.locale, 'en-US') AS locale,
  COALESCE(ls.xp_points, 0) AS xp_points,
  COALESCE(ls.minutes_learned, 0) AS minutes_learned,
  COALESCE(ls.lessons_completed, 0) AS lessons_completed,
  COALESCE(ls.streak_days, 0) AS streak_days,
  COALESCE(ls.longest_streak, 0) AS longest_streak
FROM auth.users u
LEFT JOIN profiles up ON up.user_id = u.id
LEFT JOIN learning_stats ls ON ls.user_id = u.id;

-- ─────────────────────────────────────────────────────────────
-- 4. dataintel_lessons_sync — lesson dimension
-- ─────────────────────────────────────────────────────────────
-- Segment count is derived from the lesson document JSONB (the segments array
-- inside lesson_documents.document). Counting only en-US avoids triple-counting
-- per locale.
CREATE OR REPLACE VIEW dataintel_lessons_sync AS
SELECT
  l.id AS lesson_id,
  l.slug,
  l.title->>'en-US' AS title_en,
  l.title->>'es-MX' AS title_es,
  l.title->>'pt-BR' AS title_pt,
  a.course_id,
  COALESCE(
    (SELECT jsonb_array_length(document->'segments')
     FROM lesson_documents ld
     WHERE ld.lesson_id = l.id AND ld.locale = 'en-US'
     LIMIT 1),
    0
  ) AS segment_count
FROM lessons l
JOIN topics t ON t.id = l.topic_id
JOIN sagas s ON s.id = t.saga_id
JOIN adventures a ON a.id = s.adventure_id
WHERE l.status = 'published';

-- ─────────────────────────────────────────────────────────────
-- 5. dataintel_sessions_sync — session summaries (90-day window)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW dataintel_sessions_sync AS
SELECT
  session_id,
  -- Standard PostgreSQL has no MIN/MAX aggregate for uuid (verified against
  -- 17.6: "function min(uuid) does not exist") — a session has at most one
  -- user_id in practice, so this only needs A representative non-null value,
  -- not a true minimum. The text round-trip is a no-op for that purpose.
  MIN(user_id::text) FILTER (WHERE user_id IS NOT NULL) ::uuid AS user_id,
  MIN(created_at) AS started_at,
  MAX(created_at) AS ended_at,
  MODE() WITHIN GROUP (ORDER BY device) AS device,
  MODE() WITHIN GROUP (ORDER BY locale) AS locale,
  MODE() WITHIN GROUP (ORDER BY referrer_class) AS referrer_class,
  COUNT(*) AS events_count,
  COUNT(DISTINCT route_class) AS surfaces,
  COUNT(DISTINCT lesson_id) FILTER (WHERE lesson_id IS NOT NULL) AS lessons_started,
  EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS duration_sec
FROM learning_events
WHERE session_id IS NOT NULL AND created_at >= now() - INTERVAL '90 days'
GROUP BY session_id;

-- ─────────────────────────────────────────────────────────────
-- 6. Privileges — service_role only
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON dataintel_events_sync FROM public, anon, authenticated;
GRANT SELECT ON dataintel_events_sync TO service_role;

REVOKE ALL ON dataintel_users_sync FROM public, anon, authenticated;
GRANT SELECT ON dataintel_users_sync TO service_role;

REVOKE ALL ON dataintel_lessons_sync FROM public, anon, authenticated;
GRANT SELECT ON dataintel_lessons_sync TO service_role;

REVOKE ALL ON dataintel_sessions_sync FROM public, anon, authenticated;
GRANT SELECT ON dataintel_sessions_sync TO service_role;

REVOKE ALL ON dataintel_sync_state FROM public, anon, authenticated;
GRANT ALL ON dataintel_sync_state TO service_role;
