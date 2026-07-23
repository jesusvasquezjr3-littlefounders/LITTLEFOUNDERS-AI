-- 0013_longest_streak.sql
--
-- Results-screen coherence (QA inspection 2026-07-22): the lesson results
-- showed "Mejor racha 0" next to "Racha de días 1" in 46/62 lessons, because
-- the "best streak" card rendered a CLIENT-only in-lesson first-try-correct
-- answer streak — a different quantity from the day streak, and 0 whenever no
-- answer was first-try-correct. There was no persisted "longest streak" to
-- source a real best-ever stat from.
--
-- learning_stats.longest_streak now stores the all-time high-water mark of the
-- day streak, updated on every completion (max of the running streak). The
-- card reads this, so it is always >= the current day streak — never the
-- incoherent "best 0, current 1".
--
-- learning_stats stays system-written only (0006): no client policy changes.

ALTER TABLE public.learning_stats
    ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0);

-- Backfill: a user's longest streak is at least their current streak.
UPDATE public.learning_stats
    SET longest_streak = streak_days
    WHERE longest_streak < streak_days;

COMMENT ON COLUMN public.learning_stats.longest_streak IS
    'All-time high-water mark of the day streak (>= streak_days). Sourced by the lesson results "Mejor racha" card.';
