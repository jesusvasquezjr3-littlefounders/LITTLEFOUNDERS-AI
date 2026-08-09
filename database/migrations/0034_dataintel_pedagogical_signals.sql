-- 0034_dataintel_pedagogical_signals.sql
-- DuckDB calibrates content from Core's server-authoritative grading records.
-- Browser events describe navigation and effort, but do not contain grades.

CREATE OR REPLACE VIEW public.dataintel_attempts_sync AS
SELECT
  a.id AS attempt_id,
  a.user_id,
  a.lesson_id,
  a.segment_id,
  a.attempt_number,
  a.score,
  a.hints_used,
  a.created_at
FROM public.lesson_segment_attempts a
ORDER BY a.id ASC;

REVOKE ALL ON public.dataintel_attempts_sync FROM public, anon, authenticated;
GRANT SELECT ON public.dataintel_attempts_sync TO service_role;
