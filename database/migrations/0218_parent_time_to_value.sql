-- @phase: contract
-- @after-release: none; pure widening. Every existing event value stays valid, and no running Core emits the two new ones until the GAP-FIX-R2 staff-ops release.
-- parent_time_to_value — Appendix C 1.2 "Parent Time-to-Value" (B.10, B.23)
-- on the C.24 dashboard (GAP-FIX-R2 staff-ops).
--
-- Two server-only learning events, written by Core behind the same consent
-- gate as every other event (an adult is recorded only with self-managed
-- analytics allowed, H.1), each at most once per account (a deterministic
-- idempotency key):
--
--   parent_signup_completed   Core, when an adult's identity verification
--                             makes them a verified parent (the Tutor role).
--   parent_first_value        Core, the first time that parent reads a linked
--                             child's progress (the territory or the weekly
--                             narrative): a child is linked AND the parent saw
--                             the first insight.
--
-- parent_time_to_value(p_since, p_until): for the parents whose signup event
-- falls in the window, how many reached first value, the median and the 75th
-- percentile of the seconds between the two, and how many did so within the
-- proposed 3-minute target (Appendix C: "proposed: 3 minutes"). Counts and
-- durations only; service role only.
--
-- The conservative classifier treats any CHECK replacement as a contraction,
-- so this is declared contract. The list is the S05.3e list
-- (*_motivation_events.sql) plus the two new values.
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
    'streak_rest_day', 'streak_restart', 'path_choice',
    'parent_signup_completed', 'parent_first_value'
  ));

CREATE OR REPLACE FUNCTION public.parent_time_to_value(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (signups bigint, reached bigint, median_seconds numeric, p75_seconds numeric, within_target bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH signup AS (
        SELECT user_id, min(created_at) AS at FROM public.learning_events
        WHERE event = 'parent_signup_completed' AND user_id IS NOT NULL
        GROUP BY user_id
        HAVING min(created_at) >= p_since AND min(created_at) < p_until
    ), first_value AS (
        SELECT s.user_id, extract(epoch FROM min(e.created_at) - s.at) AS seconds
        FROM signup s JOIN public.learning_events e
          ON e.user_id = s.user_id AND e.event = 'parent_first_value' AND e.created_at >= s.at
        GROUP BY s.user_id, s.at
    )
    SELECT (SELECT count(*) FROM signup),
           (SELECT count(*) FROM first_value),
           (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds)::numeric, 1) FROM first_value),
           (SELECT round(percentile_cont(0.75) WITHIN GROUP (ORDER BY seconds)::numeric, 1) FROM first_value),
           (SELECT count(*) FROM first_value WHERE seconds <= 180)
$$;

REVOKE ALL ON FUNCTION public.parent_time_to_value(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_time_to_value(timestamptz, timestamptz) TO service_role;
