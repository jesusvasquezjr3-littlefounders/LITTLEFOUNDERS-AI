-- @phase: contract
-- @after-release: none; pure widening. Every existing event value stays valid, and no running Core emits the three new ones until the S05.3e release.
-- B.21 and B.24 (S05.3e): the Appendix C motivation metrics. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md; policy:
-- docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md.
--
--   streak_rest_day   Core, when a passed lesson kept a run alive over
--                     missed days (value = rest days used).
--   streak_restart    Core, when a passed lesson started a new run because
--                     the old one had broken (value = the old run's length).
--   path_choice       Core, when a learner opens a lesson from a course path
--                     that offered more than one lesson (value 1 = not the
--                     recommended one, 0 = the recommended one).
--
-- All three are server-only (the client ingest drops them) and ride the
-- existing consent gate: a kid's events are recorded only while guardian
-- consent is active, and anyone else only with self-managed analytics on.
-- The conservative classifier treats any CHECK replacement as a contraction,
-- so this is declared contract and needs an operator dispatch. The list is
-- the S05.3d list (*_learning_quality_events.sql) plus the three new values.
ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_event_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_event_check CHECK (event IN (
    'session_start', 'session_heartbeat', 'session_end', 'nav_view',
    'page_view', 'cta_click', 'scroll_depth',
    'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
    'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
    'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
    'hint_open', 'explanation_view', 'audio_replay', 'results_view',
    'task_view', 'profile_edit', 'avatar_edit', 'tutor_open',
    'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke',
    'parent_report_viewed', 'badge_generated', 'badge_shared', 'badge_link_click',
    'replay_below_best', 'replay_notice_view',
    'streak_rest_day', 'streak_restart', 'path_choice'
  ));

-- Appendix C "Streak-Freeze Utilization Rate" (named "rest day" in the
-- product, glossary §5): of the learners whose run met a lapse in the window,
-- the share whose run was kept by rest days rather than restarted. A learner
-- with both counts once in each column.
CREATE OR REPLACE FUNCTION public.learning_rest_day_utilization(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (learners_with_lapse bigint, kept_by_rest_days bigint, restarted bigint, utilization_rate numeric, rest_days_used bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH window_events AS (
        SELECT user_id, event, value FROM public.learning_events
        WHERE event IN ('streak_rest_day', 'streak_restart') AND user_id IS NOT NULL
          AND created_at >= p_since AND created_at < p_until
    ), per_learner AS (
        SELECT user_id,
               bool_or(event = 'streak_rest_day') AS kept,
               bool_or(event = 'streak_restart') AS broke,
               COALESCE(sum(value) FILTER (WHERE event = 'streak_rest_day'), 0) AS days
        FROM window_events GROUP BY user_id
    )
    SELECT count(*), count(*) FILTER (WHERE kept), count(*) FILTER (WHERE broke),
           CASE WHEN count(*) = 0 THEN NULL ELSE round(count(*) FILTER (WHERE kept)::numeric / count(*), 4) END,
           COALESCE(sum(days), 0)::bigint
    FROM per_learner
$$;

REVOKE ALL ON FUNCTION public.learning_rest_day_utilization(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_rest_day_utilization(timestamptz, timestamptz) TO service_role;

-- Appendix C "Autonomy Mechanism Adoption Rate" (B.24), one row per lever.
-- path: of the lesson opens that offered a real choice, the share where the
--       learner took something other than the recommendation (per open).
-- pace and mentor: of the learners active in the window, the share who have
--       made that choice themselves (a saved preference), not the default.
-- Avatar customization is deliberately not a lever here (Sailer et al. 2017).
CREATE OR REPLACE FUNCTION public.learning_autonomy_adoption(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (lever text, offered bigint, exercised bigint, adoption_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH path AS (
        SELECT count(*) AS offered, count(*) FILTER (WHERE value = 1) AS exercised
        FROM public.learning_events
        WHERE event = 'path_choice' AND created_at >= p_since AND created_at < p_until
    ), active AS (
        SELECT DISTINCT user_id FROM public.learning_events
        WHERE event IN ('lesson_complete', 'lesson_start') AND user_id IS NOT NULL
          AND created_at >= p_since AND created_at < p_until
    ), pace AS (
        SELECT count(*) AS offered, count(p.user_id) AS exercised
        FROM active a LEFT JOIN public.learning_pace_preferences p ON p.user_id = a.user_id
    ), mentor AS (
        SELECT count(*) AS offered, count(t.user_id) AS exercised
        FROM active a LEFT JOIN public.tutor_preferences t ON t.user_id = a.user_id
    )
    SELECT 'path', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM path
    UNION ALL
    SELECT 'pace', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM pace
    UNION ALL
    SELECT 'mentor', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM mentor
$$;

REVOKE ALL ON FUNCTION public.learning_autonomy_adoption(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_autonomy_adoption(timestamptz, timestamptz) TO service_role;
