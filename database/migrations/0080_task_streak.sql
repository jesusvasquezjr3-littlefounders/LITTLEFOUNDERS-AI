-- 0080_task_streak.sql — a chore-completion streak, separate from
-- learning_stats' lesson-day streak.
-- @phase: expand
--
-- WHY A SEPARATE TABLE, NOT A COLUMN ON learning_stats. FAMILY_HUB.md §8 is
-- explicit that learning_stats has "no conversion path to/from LF Coins" —
-- the two economies are deliberately kept apart. A chore streak living on
-- the SAME row as the lesson streak would blur that boundary the moment
-- anyone reads the table, even with the columns kept logically separate.
-- kid_task_streaks is its own table, in its own domain, updated by its own
-- route (POST /tasks/:id/complete), exactly the isolation §3's non-goal
-- already asks for.
--
-- WHY THE SAME DAY-STREAK MATH AS LEARNING. `services/streak.ts`'s
-- nextStreak()/isCalendarDate() are pure, already covered by
-- streak.test.ts, and this domain's rule is identical (same day → no
-- double count, next day → +1, any gap → restart at 1) — reused as-is
-- rather than a second implementation of the same date arithmetic.
--
-- No RLS INSERT/UPDATE policy: Core always writes this with the service
-- role (single-row upsert, no concurrent-write risk the way wallet_ledger's
-- money has — a lost update here costs a kid at most one day's streak
-- credit, not a duplicated coin, so this does not need 0075's advisory-lock
-- treatment).

CREATE TABLE IF NOT EXISTS public.kid_task_streaks (
    kid_user_id         uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    current_streak_days integer NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
    longest_streak_days integer NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
    last_completed_date date,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kid_task_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kid_task_streaks_select_party ON public.kid_task_streaks;
CREATE POLICY kid_task_streaks_select_party ON public.kid_task_streaks
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

SELECT 'migration_0080_ok' AS sentinel;
