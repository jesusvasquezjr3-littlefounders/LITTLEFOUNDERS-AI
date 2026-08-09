CREATE TABLE IF NOT EXISTS fact_events (
  event_id BIGINT PRIMARY KEY,
  client_event_id UUID,
  event_version SMALLINT,
  occurred_at TIMESTAMP,
  user_id UUID,
  anon_id UUID,
  session_id UUID,
  lesson_id UUID,
  course_id UUID,
  segment_id VARCHAR,
  experiment_id UUID,
  experiment_variant VARCHAR,
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

-- Server-authoritative lesson attempts. These are intentionally separate
-- from consent-gated behavioural events: grades are product records written
-- by Core, not browser telemetry, and are the reliable source for
-- pedagogical calibration.
CREATE TABLE IF NOT EXISTS fact_segment_attempts (
  attempt_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  course_id UUID,
  topic_id UUID,
  skill_key VARCHAR,
  segment_id VARCHAR NOT NULL,
  attempt_number INTEGER NOT NULL,
  score DOUBLE NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER,
  document_updated_at TIMESTAMP,
  diagnostic_code VARCHAR,
  created_at TIMESTAMP NOT NULL
);

-- Derived, interpretable learner state. This lives in the warehouse because
-- it is recomputed from immutable facts, while Vault remains the operational source
-- of truth. The future Tutor consumes this through Core, never directly.
CREATE TABLE IF NOT EXISTS learner_skill_states (
  user_id UUID NOT NULL,
  skill_key VARCHAR NOT NULL,
  course_id UUID,
  topic_id UUID,
  mastery_probability DOUBLE NOT NULL,
  uncertainty DOUBLE NOT NULL,
  evidence_count INTEGER NOT NULL,
  first_practiced_at TIMESTAMP,
  last_practiced_at TIMESTAMP,
  review_due_at TIMESTAMP,
  recommended_action VARCHAR NOT NULL,
  reason_code VARCHAR NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, skill_key)
);

-- First-party anonymous-to-account links for adult acquisition analysis.
-- The source view excludes child accounts by construction, so this does not
-- create a cross-session behavioural profile for a child.
CREATE TABLE IF NOT EXISTS dim_anon_conversions (
  anon_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  converted_at TIMESTAMP NOT NULL
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

-- Sync freshness is an operational fact, not a transient worker detail: the
-- admin console needs to distinguish an empty dataset from a stale one.
CREATE TABLE IF NOT EXISTS dataintel_sync_state (
  table_name VARCHAR PRIMARY KEY,
  last_event_id BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rows_synced BIGINT NOT NULL DEFAULT 0,
  last_error VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_fact_events_user_time  ON fact_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_event_time ON fact_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_session    ON fact_events(session_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_fact_events_created     ON fact_events(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_role        ON fact_events(role, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_route       ON fact_events(route_class, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_device      ON fact_events(device, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_locale      ON fact_events(locale, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_occurred    ON fact_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_experiment  ON fact_events(experiment_id, experiment_variant, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_attempts_segment_time ON fact_segment_attempts(lesson_id, segment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_attempts_user_time ON fact_segment_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_attempts_skill_time ON fact_segment_attempts(user_id, skill_key, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_states_action ON learner_skill_states(recommended_action, review_due_at);
CREATE INDEX IF NOT EXISTS idx_anon_conversions_user ON dim_anon_conversions(user_id);

-- `CREATE TABLE IF NOT EXISTS` does not update persistent DuckDB files.
ALTER TABLE fact_events ADD COLUMN IF NOT EXISTS client_event_id UUID;
ALTER TABLE fact_events ADD COLUMN IF NOT EXISTS event_version SMALLINT;
ALTER TABLE fact_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP;
ALTER TABLE fact_events ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE fact_events ADD COLUMN IF NOT EXISTS experiment_id UUID;
ALTER TABLE fact_events ADD COLUMN IF NOT EXISTS experiment_variant VARCHAR;
ALTER TABLE fact_segment_attempts ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE fact_segment_attempts ADD COLUMN IF NOT EXISTS topic_id UUID;
ALTER TABLE fact_segment_attempts ADD COLUMN IF NOT EXISTS skill_key VARCHAR;
ALTER TABLE fact_segment_attempts ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE fact_segment_attempts ADD COLUMN IF NOT EXISTS document_updated_at TIMESTAMP;
ALTER TABLE fact_segment_attempts ADD COLUMN IF NOT EXISTS diagnostic_code VARCHAR;
