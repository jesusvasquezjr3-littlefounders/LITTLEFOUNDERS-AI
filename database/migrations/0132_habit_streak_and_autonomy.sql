-- @phase: expand
-- B.21 and B.24 (S05.3e): the lapse-tolerant learning streak, the guardian's
-- holiday pause and the learner's pace choice. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md; policy:
-- docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md.
--
-- The streak model (Frontend Bible 02 §9.6, Product 10 B.21):
--   * a streak counts practised days in a row (a passed lesson on that local
--     date, as since 0009);
--   * two rest days per ISO week (Monday to Sunday) are free and automatic: a
--     missed day inside the run is a rest day, and the run breaks only when a
--     week holds a third missed day. A rest day keeps the run, it does not add
--     to it;
--   * a verified guardian may pause the streak for a holiday: a paused day is
--     neither practised nor missed;
--   * the best streak and the days practised are permanent;
--   * only 7, 30 and 100 are milestones (OD-7);
--   * a date earlier than the last practised day changes nothing (the legacy
--     rule restarted the run over a device clock).
--
-- habit_streak_advance below is the SQL twin of
-- backend/src/services/habitStreak.ts; both are pinned by the shared vectors
-- in database/scripts/habit-streak-vectors.json (Core runs them in its tests,
-- database/scripts/test-habit-streak.sql runs them here).
--
-- OD-9: nothing a learner was promised is lost. streak_days and
-- longest_streak keep their values and meaning (the live run and the best).
-- days_practiced is new; it is backfilled with the best lower bound the
-- stored data supports (see the UPDATE below) and only ever grows.
--
-- Everything is additive: new columns with defaults, new tables with RLS and
-- no browser write path, new functions, and complete_lesson replaced with the
-- same signature, the same writes and every existing result key, plus two new
-- keys (`streak`, `pace`). A running Core ignores the new keys.
--
-- Split in two at merge time for the Railway transport cap (23,000 bytes per
-- migration, database/scripts/check-migrations.mjs): this file carries the
-- model's state (columns, backfill, the pause and pace tables) and its two
-- pure helpers (habit_streak_advance, learning_streak_paused_dates). The next
-- migration, *_habit_streak_completion_and_pause.sql, moves complete_lesson and
-- the onboarding day onto it and adds the guardian's pause functions; apply
-- both, in order, before this Core.

-- ── learning_stats: the model's state ──────────────────────────────────────
ALTER TABLE public.learning_stats
    ADD COLUMN IF NOT EXISTS rest_days_used smallint NOT NULL DEFAULT 0
        CONSTRAINT learning_stats_rest_days_used_range CHECK (rest_days_used BETWEEN 0 AND 2),
    ADD COLUMN IF NOT EXISTS days_practiced integer NOT NULL DEFAULT 0
        CONSTRAINT learning_stats_days_practiced_nonneg CHECK (days_practiced >= 0),
    ADD COLUMN IF NOT EXISTS day_lessons_passed smallint NOT NULL DEFAULT 0
        CONSTRAINT learning_stats_day_lessons_passed_nonneg CHECK (day_lessons_passed >= 0);

COMMENT ON COLUMN public.learning_stats.rest_days_used IS
    'B.21: rest days the current streak run has used in the ISO week of last_active_date (0-2).';
COMMENT ON COLUMN public.learning_stats.days_practiced IS
    'B.21: every practised day ever. Permanent; backfilled at migration as a lower bound.';
COMMENT ON COLUMN public.learning_stats.day_lessons_passed IS
    'B.24: lessons passed on last_active_date, compared with the learner''s chosen daily pace.';

-- The lower bound: the longest run ever, and the distinct local-ish dates of
-- each lesson's latest completion (lesson_progress keeps one completion per
-- lesson). The true count can only be higher, so the backfill never
-- overstates what a learner did.
UPDATE public.learning_stats s SET days_practiced = GREATEST(
    s.days_practiced, s.streak_days, COALESCE(s.longest_streak, 0),
    COALESCE((SELECT count(DISTINCT p.completed_at::date)::int FROM public.lesson_progress p
              WHERE p.user_id = s.user_id AND p.passed AND p.completed_at IS NOT NULL), 0))
WHERE s.days_practiced = 0;

-- ── The guardian's holiday pause ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_streak_pauses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    starts_on    date NOT NULL,
    ends_on      date NOT NULL,
    set_by       uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz NULL,
    CONSTRAINT learning_streak_pauses_order CHECK (ends_on >= starts_on),
    -- At most 21 days per pause (a proposal in the policy; Core repeats it).
    CONSTRAINT learning_streak_pauses_length CHECK (ends_on - starts_on <= 20)
);
CREATE INDEX IF NOT EXISTS learning_streak_pauses_learner_idx
    ON public.learning_streak_pauses (learner_id, ends_on DESC);

ALTER TABLE public.learning_streak_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_streak_pauses_select_party ON public.learning_streak_pauses;
CREATE POLICY learning_streak_pauses_select_party ON public.learning_streak_pauses
    FOR SELECT USING (learner_id = auth.uid() OR public.is_verified_guardian_of(learner_id));
-- No INSERT/UPDATE/DELETE policy: only the two functions below write, for a
-- verified guardian Core has already checked, and they check again.

-- ── The learner's pace (B.24) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_pace_preferences (
    user_id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    daily_lesson_goal smallint NOT NULL
        CONSTRAINT learning_pace_preferences_goal CHECK (daily_lesson_goal BETWEEN 1 AND 3),
    chosen_at         timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_pace_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_pace_preferences_select_party ON public.learning_pace_preferences;
CREATE POLICY learning_pace_preferences_select_party ON public.learning_pace_preferences
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- Written by Core (service role) for the learner themselves; no browser write policy.

-- ── The pure model ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.habit_streak_advance(
    p_current int, p_best int, p_last date, p_rest_used int, p_days_practiced int,
    p_today date, p_paused date[]
)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_best int := GREATEST(COALESCE(p_best, 0), COALESCE(p_current, 0));
    v_days int := COALESCE(p_days_practiced, 0);
    v_day date;
    v_week date;
    v_scan_week date;
    v_count int;
    v_missed int := 0;
    v_ok boolean := true;
    v_next int;
    v_rest int;
    v_outcome text;
BEGIN
    IF p_today IS NULL THEN
        RAISE EXCEPTION 'habit_streak_advance needs a date' USING ERRCODE = '22023';
    END IF;
    IF p_last IS NULL THEN
        RETURN jsonb_build_object('current', 1, 'best', GREATEST(v_best, 1), 'last_active_date', p_today,
            'rest_days_used', 0, 'days_practiced', v_days + 1, 'outcome', 'first', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    IF p_today = p_last THEN
        v_next := GREATEST(COALESCE(p_current, 0), 1);
        RETURN jsonb_build_object('current', v_next, 'best', GREATEST(v_best, v_next), 'last_active_date', p_last,
            'rest_days_used', LEAST(GREATEST(COALESCE(p_rest_used, 0), 0), 2), 'days_practiced', v_days,
            'outcome', 'same_day', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    IF p_today < p_last THEN
        RETURN jsonb_build_object('current', COALESCE(p_current, 0), 'best', v_best, 'last_active_date', p_last,
            'rest_days_used', LEAST(GREATEST(COALESCE(p_rest_used, 0), 0), 2), 'days_practiced', v_days,
            'outcome', 'earlier_date', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;

    -- Scan the days strictly between the last practised day and today.
    v_scan_week := date_trunc('week', p_last::timestamp)::date;
    v_count := LEAST(GREATEST(COALESCE(p_rest_used, 0), 0), 2);
    v_day := p_last + 1;
    WHILE v_day < p_today LOOP
        IF p_paused IS NULL OR NOT (v_day = ANY (p_paused)) THEN
            v_week := date_trunc('week', v_day::timestamp)::date;
            IF v_week <> v_scan_week THEN
                v_scan_week := v_week;
                v_count := 0;
            END IF;
            v_count := v_count + 1;
            v_missed := v_missed + 1;
            IF v_count > 2 THEN
                v_ok := false;
                EXIT;
            END IF;
        END IF;
        v_day := v_day + 1;
    END LOOP;

    IF NOT v_ok THEN
        RETURN jsonb_build_object('current', 1, 'best', GREATEST(v_best, 1), 'last_active_date', p_today,
            'rest_days_used', 0, 'days_practiced', v_days + 1, 'outcome', 'restarted', 'rest_days_bridged', 0, 'milestone', NULL);
    END IF;
    v_next := COALESCE(p_current, 0) + 1;
    v_rest := CASE WHEN v_scan_week = date_trunc('week', p_today::timestamp)::date THEN v_count ELSE 0 END;
    v_outcome := CASE WHEN v_missed > 0 THEN 'bridged' ELSE 'extended' END;
    RETURN jsonb_build_object('current', v_next, 'best', GREATEST(v_best, v_next), 'last_active_date', p_today,
        'rest_days_used', v_rest, 'days_practiced', v_days + 1, 'outcome', v_outcome,
        'rest_days_bridged', v_missed,
        'milestone', CASE WHEN v_next IN (7, 30, 100) THEN v_next END);
END;
$$;

REVOKE ALL ON FUNCTION public.habit_streak_advance(int, int, date, int, int, date, date[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.habit_streak_advance(int, int, date, int, int, date, date[]) TO service_role;

-- The paused days strictly between two dates, from pauses that are not cancelled.
CREATE OR REPLACE FUNCTION public.learning_streak_paused_dates(p_user_id uuid, p_after date, p_before date)
RETURNS date[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(DISTINCT d::date ORDER BY d::date), ARRAY[]::date[])
    FROM public.learning_streak_pauses p,
         generate_series(GREATEST(p.starts_on, p_after + 1), LEAST(p.ends_on, p_before - 1), interval '1 day') AS d
    WHERE p_after IS NOT NULL AND p_before IS NOT NULL
      AND p.learner_id = p_user_id AND p.cancelled_at IS NULL
      AND p.ends_on > p_after AND p.starts_on < p_before
$$;

REVOKE ALL ON FUNCTION public.learning_streak_paused_dates(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_streak_paused_dates(uuid, date, date) TO service_role;

SELECT 'migration_habit_streak_and_autonomy_ok' AS sentinel;
