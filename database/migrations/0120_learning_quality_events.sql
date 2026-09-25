-- @phase: contract
-- @after-release: none; pure widening. Every existing event value stays valid, and no running Core or client emits the two new ones until the S05.3d release.
-- B.5 (S05.3d): Appendix C "Replay Non-Regression Messaging Display Rate".
-- Record: docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md.
--
--   replay_below_best    Core, server-side, when a completion receipt says
--                        notice = 'best_kept' (the denominator).
--   replay_notice_view   The client, when the result screen actually shows
--                        "your saved best is still X" (the numerator).
--
-- Both ride the existing consent-gated pipeline (a kid's events are recorded
-- only while guardian consent is active), so numerator and denominator are
-- dropped for exactly the same learners and the rate stays comparable. The
-- conservative deployment classifier treats any CHECK replacement as a
-- contraction, so this is declared contract and needs an operator dispatch
-- (like 0113), not auto-apply. The list below is 0072's list plus the two
-- new values; route_class is unchanged ('learn' already exists).
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
    'replay_below_best', 'replay_notice_view'
  ));

-- The display rate itself. Each denominator event (user, lesson) is matched to
-- a client view of the same lesson by the same learner within 30 minutes; a
-- view without a denominator is ignored, so the rate can never exceed 100%.
CREATE OR REPLACE FUNCTION public.learning_replay_notice_display_rate(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (below_best bigint, shown bigint, display_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH denominator AS (
        SELECT d.id, d.user_id, d.lesson_id, d.created_at
        FROM public.learning_events d
        WHERE d.event = 'replay_below_best' AND d.lesson_id IS NOT NULL
          AND d.created_at >= p_since AND d.created_at < p_until
    ), matched AS (
        SELECT denominator.id,
               EXISTS (
                   SELECT 1 FROM public.learning_events v
                   WHERE v.event = 'replay_notice_view' AND v.user_id = denominator.user_id
                     AND v.lesson_id = denominator.lesson_id
                     AND v.created_at >= denominator.created_at - interval '1 minute'
                     AND v.created_at < denominator.created_at + interval '30 minutes'
               ) AS seen
        FROM denominator
    )
    SELECT count(*), count(*) FILTER (WHERE seen),
           CASE WHEN count(*) = 0 THEN NULL ELSE round(count(*) FILTER (WHERE seen)::numeric / count(*), 4) END
    FROM matched
$$;

REVOKE ALL ON FUNCTION public.learning_replay_notice_display_rate(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_replay_notice_display_rate(timestamptz, timestamptz) TO service_role;
