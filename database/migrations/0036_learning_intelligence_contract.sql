-- 0036_learning_intelligence_contract.sql
--
-- Makes learning evidence reproducible and decision-ready without opening a
-- free-text telemetry channel. Behavioural events remain consent-gated; the
-- grading record remains Core-authored and therefore authoritative.

-- ── Authoritative attempt context ─────────────────────────────────────────
-- A grade alone cannot distinguish a quick confident answer from a long,
-- scaffolded recovery. These fields are written only by Core alongside the
-- already-authoritative score; no learner answer or free text is stored.
ALTER TABLE public.lesson_segment_attempts
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer,
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS topic_id uuid,
  ADD COLUMN IF NOT EXISTS skill_key text,
  ADD COLUMN IF NOT EXISTS document_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS diagnostic_code text;

ALTER TABLE public.lesson_segment_attempts
  DROP CONSTRAINT IF EXISTS lesson_segment_attempts_time_spent_check;
ALTER TABLE public.lesson_segment_attempts
  ADD CONSTRAINT lesson_segment_attempts_time_spent_check
  CHECK (time_spent_seconds IS NULL OR time_spent_seconds BETWEEN 0 AND 7200);

ALTER TABLE public.lesson_segment_attempts
  DROP CONSTRAINT IF EXISTS lesson_segment_attempts_skill_key_check;
ALTER TABLE public.lesson_segment_attempts
  ADD CONSTRAINT lesson_segment_attempts_skill_key_check
  CHECK (skill_key IS NULL OR skill_key ~ '^[a-z0-9][a-z0-9._/-]{0,127}$');

ALTER TABLE public.lesson_segment_attempts
  DROP CONSTRAINT IF EXISTS lesson_segment_attempts_diagnostic_code_check;
ALTER TABLE public.lesson_segment_attempts
  ADD CONSTRAINT lesson_segment_attempts_diagnostic_code_check
  CHECK (diagnostic_code IS NULL OR diagnostic_code IN (
    'initial_incorrect', 'hint_assisted', 'retry_recovery'
  ));

-- Existing records predate immutable attempt context. Their curriculum
-- placement is recovered from the current hierarchy once, while new attempts
-- are stamped by Core at grade time and retain the document version they saw.
UPDATE public.lesson_segment_attempts attempt
SET
  course_id = course_row.id,
  topic_id = topic_row.id,
  skill_key = lower(course_row.slug || '/' || topic_row.slug)
FROM public.lessons lesson_row
JOIN public.topics topic_row ON topic_row.id = lesson_row.topic_id
JOIN public.sagas saga_row ON saga_row.id = topic_row.saga_id
JOIN public.adventures adventure_row ON adventure_row.id = saga_row.adventure_id
JOIN public.courses course_row ON course_row.id = adventure_row.course_id
WHERE attempt.lesson_id = lesson_row.id
  AND attempt.skill_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_segment_attempts_skill_time
  ON public.lesson_segment_attempts (user_id, skill_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_segment_attempts_course_topic
  ON public.lesson_segment_attempts (course_id, topic_id, created_at DESC);

COMMENT ON COLUMN public.lesson_segment_attempts.skill_key IS
  'Server-derived course/topic skill identity. One topic is the initial skill grain; future Forge segment mappings may add finer grain without storing learner input.';
COMMENT ON COLUMN public.lesson_segment_attempts.document_updated_at IS
  'Immutable lesson-document version observed while grading. Null only for attempts recorded before migration 0036.';
COMMENT ON COLUMN public.lesson_segment_attempts.diagnostic_code IS
  'Closed, server-derived learning outcome code. Never contains a learner answer or free text.';

-- ── Event integrity and causal context ─────────────────────────────────────
-- `client_event_id` gives the beacon an idempotency key across retry/reload.
-- `occurred_at` preserves the client-observed order while `created_at` remains
-- the server receipt time used for operational freshness checks.
ALTER TABLE public.learning_events
  ADD COLUMN IF NOT EXISTS client_event_id uuid,
  ADD COLUMN IF NOT EXISTS event_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS experiment_id uuid,
  ADD COLUMN IF NOT EXISTS experiment_variant text;

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_event_version_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_event_version_check
  CHECK (event_version BETWEEN 1 AND 99);

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_experiment_variant_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_experiment_variant_check
  CHECK (experiment_variant IS NULL OR experiment_variant IN ('A', 'B'));

CREATE UNIQUE INDEX IF NOT EXISTS learning_events_client_event_id_unique
  ON public.learning_events (client_event_id)
  WHERE client_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_events_occurred
  ON public.learning_events (occurred_at DESC)
  WHERE occurred_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_events_course_time
  ON public.learning_events (course_id, created_at DESC)
  WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_events_experiment_time
  ON public.learning_events (experiment_id, experiment_variant, created_at DESC)
  WHERE experiment_id IS NOT NULL;

COMMENT ON COLUMN public.learning_events.client_event_id IS
  'Beacon-generated idempotency key. Legacy rows may be null; current clients always provide one.';
COMMENT ON COLUMN public.learning_events.occurred_at IS
  'Client-observed timestamp, bounded by Core at ingest. created_at remains server receipt time.';
COMMENT ON COLUMN public.learning_events.experiment_id IS
  'Optional experiment exposure context. Only Core-verified assignments may populate it.';

-- ── Data Intel sync contracts ───────────────────────────────────────────────
-- PostgreSQL's CREATE OR REPLACE VIEW cannot insert/reorder output columns.
-- Both feeds gain columns ahead of legacy fields, so replace the projection in
-- one migration transaction. No dependent database objects exist; Data Intel
-- reads them only through PostgREST and resumes after the transaction commits.
DROP VIEW IF EXISTS public.dataintel_events_sync;
DROP VIEW IF EXISTS public.dataintel_attempts_sync;

CREATE OR REPLACE VIEW public.dataintel_events_sync AS
SELECT
  e.id AS event_id,
  e.client_event_id,
  e.event_version,
  e.occurred_at,
  e.user_id,
  e.anon_id,
  e.session_id,
  e.lesson_id,
  e.course_id,
  e.segment_id,
  e.experiment_id,
  e.experiment_variant,
  e.event,
  e.role,
  e.route_class,
  e.device,
  e.locale,
  e.referrer_class,
  e.ordinal,
  e.value,
  e.created_at
FROM public.learning_events e
ORDER BY e.id ASC;

CREATE OR REPLACE VIEW public.dataintel_attempts_sync AS
SELECT
  a.id AS attempt_id,
  a.user_id,
  a.lesson_id,
  a.course_id,
  a.topic_id,
  a.skill_key,
  a.segment_id,
  a.attempt_number,
  a.score,
  a.hints_used,
  a.time_spent_seconds,
  a.document_updated_at,
  a.diagnostic_code,
  a.created_at
FROM public.lesson_segment_attempts a
ORDER BY a.id ASC;

REVOKE ALL ON public.dataintel_events_sync FROM public, anon, authenticated;
GRANT SELECT ON public.dataintel_events_sync TO service_role;
REVOKE ALL ON public.dataintel_attempts_sync FROM public, anon, authenticated;
GRANT SELECT ON public.dataintel_attempts_sync TO service_role;
