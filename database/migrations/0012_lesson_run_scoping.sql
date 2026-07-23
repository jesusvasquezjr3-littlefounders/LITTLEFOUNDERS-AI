-- 0012_lesson_run_scoping.sql
--
-- Two grading-integrity fixes found in the 62-lesson QA inspection
-- (2026-07-22), both landing on lesson_segment_attempts (0007):
--
-- 1. Run-scoped attempts. max_attempts was enforced against the LIFETIME row
--    count for (user, lesson, segment), so replaying a completed lesson hit
--    the cap on the first graded segment — the server returned 409
--    ATTEMPTS_EXHAUSTED and the player mis-rendered it as a 0/100 FAIL on a
--    correct answer. The client now generates a run_id per lesson entry and
--    sends it with each grade call; the cap counts only rows from the current
--    run, so every play-through starts fresh while history is preserved.
--    Nullable: pre-existing rows and any legacy client that omits it fall back
--    to the old lifetime count (safe, and only affects un-migrated clients).
--
-- 2. Server-authoritative hint penalty. hint_penalty_pct was applied only in
--    the client reducer and then discarded when /complete recomputed the score
--    from recorded attempts ("client-side UX only"), so a hint never lowered
--    the score or XP and a reload laundered it entirely. The score column now
--    stores the hint-penalized score the server computed, and hints_used
--    records how many hints were charged (0 = none) for transparency/analytics.
--
-- lesson_segment_attempts stays system-written-only (0007): no client policy
-- changes; Core (service role) remains the only writer.

ALTER TABLE public.lesson_segment_attempts
    ADD COLUMN IF NOT EXISTS run_id uuid;

ALTER TABLE public.lesson_segment_attempts
    ADD COLUMN IF NOT EXISTS hints_used integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lesson_segment_attempts_run
    ON public.lesson_segment_attempts (user_id, lesson_id, segment_id, run_id);

COMMENT ON COLUMN public.lesson_segment_attempts.run_id IS
    'Client-generated per-lesson-entry id; the max_attempts cap counts only rows from the current run so replays start fresh. Null = legacy/lifetime-scoped row.';
COMMENT ON COLUMN public.lesson_segment_attempts.hints_used IS
    'Hints charged when this attempt was graded (0 = none). The score column stores the hint-penalized, server-authoritative score.';
