CREATE TABLE IF NOT EXISTS fact_events_raw (
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
CREATE TABLE IF NOT EXISTS fact_segment_attempts_raw (
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

CREATE TABLE IF NOT EXISTS dim_sessions_raw (
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

CREATE TABLE IF NOT EXISTS dim_users_raw (
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
  course_slug VARCHAR,
  course_title_en VARCHAR,
  course_title_es VARCHAR,
  course_title_pt VARCHAR,
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

-- Product 10 E.6 account erasure. One row per erased account id (kind
-- 'user') and per converted pre-signup visitor id (kind 'anon'). The sync
-- re-applies the deletion after every run, so a batch read from Vault just
-- before the account was erased cannot bring its rows back. Rows older than
-- 30 days are dropped by the same pass (the race lasts minutes, and an id
-- kept forever would itself be a record of the person).
CREATE TABLE IF NOT EXISTS erased_subjects (
  subject_id UUID PRIMARY KEY,
  kind VARCHAR NOT NULL,
  erased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- One fixed, resumable content-reset maintenance lease. Startup reads this
-- before enabling warehouse writers so a restart cannot strand stale facts.
CREATE TABLE IF NOT EXISTS content_retirement_state (
  operation VARCHAR PRIMARY KEY,
  lease_id UUID NOT NULL,
  phase VARCHAR NOT NULL,
  course_ids JSON NOT NULL,
  lesson_ids JSON NOT NULL,
  inventory JSON NOT NULL,
  started_at VARCHAR NOT NULL,
  backup_sha256 VARCHAR
);

-- H.2 / Appendix O 1.2: the experiment tables are keyed by a learner and are
-- inside the warehouse's 400-day retention window and the E.6 erasure, so both
-- jobs need them to exist from the first boot, not only after the first
-- experiment call (services/experiments.ts keeps the same definitions).
CREATE TABLE IF NOT EXISTS experiment_assignments (
  experiment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (experiment_id, user_id)
);

CREATE TABLE IF NOT EXISTS experiment_exposures (
  experiment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  exposed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (experiment_id, user_id)
);

-- One row per warehouse retention prune and table (services/warehouseRetention.ts),
-- the warehouse twin of Vault's insights_maintenance_log: rows removed, the
-- window applied and when, so a prune that stopped running is visible. The
-- erasure re-apply (services/erasure.ts) writes one row per run as well, and a
-- failed run of either writes ok = FALSE with its error. Core's watched job
-- warehouse_retention reads it (services/warehouseMaintenance.ts, GAP-FIX-R8).
CREATE TABLE IF NOT EXISTS warehouse_maintenance_log (
  job VARCHAR NOT NULL,
  table_name VARCHAR NOT NULL,
  retain_days INTEGER NOT NULL,
  removed BIGINT NOT NULL,
  ran_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ok BOOLEAN DEFAULT TRUE,
  error VARCHAR
);

-- SCHEMA EVOLUTION — must run BEFORE the indexes below (production incident
-- 2026-08-09). `CREATE TABLE IF NOT EXISTS` does not update a persistent DuckDB
-- file: on a warehouse that already exists (the Railway volume survives every
-- deploy) a column ADDED to a definition above is silently NOT created, because
-- the whole CREATE is skipped. These ALTERs are what actually add it.
--
-- Ordering is load-bearing, not cosmetic. This block used to sit at the END of
-- the file, AFTER the CREATE INDEX statements — so `idx_fact_events_occurred`
-- ran against a table whose `occurred_at` did not exist yet and raised a Binder
-- Error, which `initDb` catches as "non-fatal": the service stayed up answering
-- /health while duckdb was down and sync was permanently dead. A column added
-- to a pre-existing table above MUST get an ALTER here in the same commit, and
-- nothing that references a new column may be placed above this block.
-- Keep semicolons out of these comments — the runner splits statements on them.
ALTER TABLE fact_events_raw ADD COLUMN IF NOT EXISTS client_event_id UUID;
ALTER TABLE fact_events_raw ADD COLUMN IF NOT EXISTS event_version SMALLINT;
ALTER TABLE fact_events_raw ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP;
ALTER TABLE fact_events_raw ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE fact_events_raw ADD COLUMN IF NOT EXISTS experiment_id UUID;
ALTER TABLE fact_events_raw ADD COLUMN IF NOT EXISTS experiment_variant VARCHAR;
ALTER TABLE fact_segment_attempts_raw ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE fact_segment_attempts_raw ADD COLUMN IF NOT EXISTS topic_id UUID;
ALTER TABLE fact_segment_attempts_raw ADD COLUMN IF NOT EXISTS skill_key VARCHAR;
ALTER TABLE fact_segment_attempts_raw ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE fact_segment_attempts_raw ADD COLUMN IF NOT EXISTS document_updated_at TIMESTAMP;
ALTER TABLE fact_segment_attempts_raw ADD COLUMN IF NOT EXISTS diagnostic_code VARCHAR;
ALTER TABLE dim_lessons ADD COLUMN IF NOT EXISTS course_slug VARCHAR;
ALTER TABLE dim_lessons ADD COLUMN IF NOT EXISTS course_title_en VARCHAR;
ALTER TABLE dim_lessons ADD COLUMN IF NOT EXISTS course_title_es VARCHAR;
ALTER TABLE dim_lessons ADD COLUMN IF NOT EXISTS course_title_pt VARCHAR;
ALTER TABLE dim_users_raw ADD COLUMN IF NOT EXISTS is_staff BOOLEAN DEFAULT FALSE;
ALTER TABLE warehouse_maintenance_log ADD COLUMN IF NOT EXISTS ok BOOLEAN DEFAULT TRUE;
ALTER TABLE warehouse_maintenance_log ADD COLUMN IF NOT EXISTS error VARCHAR;


-- ═══ STAFF-FREE VIEWS ═════════════════════════════════════════════════════
--
-- Every analytical query reads THESE, never the *_raw tables underneath.
--
-- Why the tables were renamed rather than each query being edited: measured
-- against production on 2026-08-13, 90.5% of first-party events and 100% of
-- lesson_segment_attempts were produced by 2 staff accounts. Ninety-five query
-- sites referenced the fact tables, and a filter that must be remembered in
-- ninety-five places is a filter that will be missed in one. Renaming the
-- physical tables and re-creating the old names as filtered views made every
-- existing query correct at once, and makes the CLEAN name the path of least
-- resistance for new ones. `queries-are-staff-free.test.ts` fails the build if
-- an analytical file reaches for a *_raw table.
--
-- The filter is deliberately BELT AND BRACES, because neither signal is
-- sufficient alone:
--   * `role` on an event is the event-time stamp, and Core stamps the
--     highest-priority role in a fixed order, so a superadmin who is also a
--     parent stamps `parent`.
--   * `dim_users.role` is the most-recently-granted role, which flips with
--     grant order.
-- `dim_users_raw.is_staff` (Vault migration 0046) is the authoritative
-- EXISTS-over-all-roles answer, and the stamp check additionally catches rows
-- whose user has since been deleted from the dimension.
--
-- Rows with no user_id (anonymous acquisition traffic) are KEPT: they are the
-- pre-signup funnel and cannot be staff-attributed.

CREATE OR REPLACE VIEW v_staff_users AS
  SELECT user_id FROM dim_users_raw WHERE is_staff IS TRUE;

CREATE OR REPLACE VIEW fact_events AS
  SELECT * FROM fact_events_raw e
  WHERE COALESCE(e.role, '') NOT IN ('admin', 'superadmin')
    AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM v_staff_users));

CREATE OR REPLACE VIEW fact_segment_attempts AS
  SELECT * FROM fact_segment_attempts_raw a
  WHERE a.user_id NOT IN (SELECT user_id FROM v_staff_users);

CREATE OR REPLACE VIEW dim_sessions AS
  SELECT * FROM dim_sessions_raw s
  WHERE s.user_id IS NULL OR s.user_id NOT IN (SELECT user_id FROM v_staff_users);

CREATE OR REPLACE VIEW dim_users AS
  SELECT * FROM dim_users_raw u
  WHERE u.is_staff IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_fact_events_user_time  ON fact_events_raw(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_event_time ON fact_events_raw(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_session    ON fact_events_raw(session_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_fact_events_created     ON fact_events_raw(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_role        ON fact_events_raw(role, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_route       ON fact_events_raw(route_class, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_device      ON fact_events_raw(device, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_locale      ON fact_events_raw(locale, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_occurred    ON fact_events_raw(occurred_at);
CREATE INDEX IF NOT EXISTS idx_fact_events_experiment  ON fact_events_raw(experiment_id, experiment_variant, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_attempts_segment_time ON fact_segment_attempts_raw(lesson_id, segment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_attempts_user_time ON fact_segment_attempts_raw(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_attempts_skill_time ON fact_segment_attempts_raw(user_id, skill_key, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_states_action ON learner_skill_states(recommended_action, review_due_at);
CREATE INDEX IF NOT EXISTS idx_anon_conversions_user ON dim_anon_conversions(user_id);
