CREATE TABLE IF NOT EXISTS fact_events (
  event_id BIGINT PRIMARY KEY,
  user_id UUID,
  anon_id UUID,
  session_id UUID,
  lesson_id UUID,
  segment_id VARCHAR,
  event_type VARCHAR NOT NULL,
  role VARCHAR,
  route_class VARCHAR,
  device VARCHAR,
  locale VARCHAR,
  referrer_class VARCHAR,
  ordinal INTEGER,
  value DOUBLE,
  created_at TIMESTAMP NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dim_sessions (
  session_id UUID PRIMARY KEY,
  user_id UUID,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  device VARCHAR,
  locale VARCHAR,
  referrer_class VARCHAR,
  events_count INTEGER,
  surfaces INTEGER,
  lessons_started INTEGER,
  duration_sec DOUBLE
);

CREATE TABLE IF NOT EXISTS dim_users (
  user_id UUID PRIMARY KEY,
  role VARCHAR,
  created_at TIMESTAMP,
  locale VARCHAR,
  xp_points DOUBLE,
  lessons_completed INTEGER,
  streak_days INTEGER,
  longest_streak INTEGER
);

CREATE TABLE IF NOT EXISTS dim_lessons (
  lesson_id UUID PRIMARY KEY,
  slug VARCHAR,
  title_en VARCHAR,
  title_es VARCHAR,
  title_pt VARCHAR,
  course_id UUID,
  segment_count INTEGER
);

CREATE TABLE IF NOT EXISTS dim_time (
  date DATE PRIMARY KEY,
  year INTEGER,
  month INTEGER,
  week INTEGER,
  day_of_week INTEGER,
  hour INTEGER,
  is_weekend BOOLEAN
);

CREATE TABLE IF NOT EXISTS agg_daily_activity (
  day DATE NOT NULL,
  role VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  route_class VARCHAR NOT NULL DEFAULT '',
  device VARCHAR NOT NULL DEFAULT '',
  locale VARCHAR NOT NULL DEFAULT '',
  events BIGINT NOT NULL DEFAULT 0,
  users BIGINT NOT NULL DEFAULT 0,
  sessions BIGINT NOT NULL DEFAULT 0,
  total_value DOUBLE,
  PRIMARY KEY (day, role, event_type, route_class, device, locale)
);

CREATE TABLE IF NOT EXISTS agg_daily_users (
  day DATE NOT NULL,
  role VARCHAR NOT NULL,
  users BIGINT NOT NULL DEFAULT 0,
  sessions BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, role)
);

CREATE INDEX IF NOT EXISTS idx_fact_events_user_time  ON fact_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_event_time ON fact_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_session    ON fact_events(session_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_fact_events_created     ON fact_events(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_role        ON fact_events(role, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_route       ON fact_events(route_class, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_device      ON fact_events(device, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_locale      ON fact_events(locale, created_at);
