-- 0009_learning_activity_date.sql
--
-- Day-streak correctness (found live 2026-07-13): streak.ts used
-- learning_stats.updated_at as a proxy for "last day the learner passed a
-- lesson", but nothing ever advanced that column (no touch trigger, and
-- patchLearningStats never wrote it) — so once the UTC day rolled over,
-- EVERY completed lesson read "last activity = yesterday" and incremented
-- the streak: +1 per lesson instead of +1 per day.
--
-- The real model (v1 parity): the CLIENT reports its local calendar date
-- (YYYY-MM-DD) on completion — a kid's "day" follows their wall clock, not
-- UTC — and Core stores it here. streak.ts compares calendar dates only.
--
-- learning_stats remains system-written-only (0006): no client policies
-- change; Core (service role) is still the only writer.

ALTER TABLE public.learning_stats
    ADD COLUMN IF NOT EXISTS last_active_date date;

COMMENT ON COLUMN public.learning_stats.last_active_date IS
    'Local calendar date (client-reported) of the last PASSED lesson — the day-streak anchor. Null until the first pass.';
