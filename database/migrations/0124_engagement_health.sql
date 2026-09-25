-- @phase: expand
-- B.28 (S05.3f): Appendix C Part 1.2's Session Efficiency Ratio and AI Mentor
-- Resolution Efficiency, measured from the first release. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md; policy:
-- docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md §5.
--
-- Both are weekly series read by Core for content staff. Neither returns a
-- learner id. A rising turn count or a falling efficiency ratio is a
-- regression Core flags for investigation; a longer session is never read as
-- a success.
--
-- Session Efficiency Ratio: graded interaction time / visible session time.
--   Visible session time: the 60-second heartbeats the client sends only while
--   the tab is visible (consent-gated at ingest: nothing exists for a learner
--   without analytics consent). Graded time: the seconds Core recorded on each
--   graded lesson attempt, on the same learner-day, capped at that day's
--   session time. Staff roles are excluded. v2 attempts carry no time yet and
--   are not counted (documented limitation).
-- Mentor Resolution Efficiency: turns per Mentor session that ended because
--   the Mentor closed it as done ('completed'), by intent and overall.
--
-- New functions only: expand.

CREATE OR REPLACE FUNCTION public.learning_session_efficiency(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (week_start date, learners bigint, graded_seconds bigint, session_seconds bigint, efficiency_ratio numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH sessions AS (
        SELECT e.user_id,
               (e.created_at AT TIME ZONE 'UTC')::date AS day,
               sum(COALESCE(e.value, 0)) AS seconds
        FROM public.learning_events e
        WHERE e.event = 'session_heartbeat' AND e.user_id IS NOT NULL
          AND e.role NOT IN ('admin', 'superadmin')
          AND e.created_at >= p_since AND e.created_at < p_until
        GROUP BY 1, 2
    ), graded AS (
        SELECT a.user_id,
               (a.created_at AT TIME ZONE 'UTC')::date AS day,
               sum(COALESCE(a.time_spent_seconds, 0)) AS seconds
        FROM public.lesson_segment_attempts a
        WHERE a.created_at >= p_since AND a.created_at < p_until
        GROUP BY 1, 2
    ), per_day AS (
        SELECT date_trunc('week', s.day)::date AS week_start, s.user_id,
               s.seconds AS session_seconds,
               LEAST(COALESCE(g.seconds, 0), s.seconds) AS graded_seconds
        FROM sessions s
        LEFT JOIN graded g ON g.user_id = s.user_id AND g.day = s.day
    )
    SELECT week_start, count(DISTINCT user_id), round(sum(graded_seconds))::bigint, round(sum(session_seconds))::bigint,
           CASE WHEN sum(session_seconds) = 0 THEN NULL ELSE round(sum(graded_seconds) / sum(session_seconds), 4) END
    FROM per_day
    GROUP BY week_start
    ORDER BY week_start
$$;

REVOKE ALL ON FUNCTION public.learning_session_efficiency(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_session_efficiency(timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.mentor_resolution_efficiency(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (week_start date, intent text, resolved_sessions bigint, median_turns numeric, p75_turns numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH resolved AS (
        SELECT date_trunc('week', s.ended_at AT TIME ZONE 'UTC')::date AS week_start, s.intent, s.turn_count
        FROM public.tutor_sessions s
        WHERE s.close_reason = 'completed' AND s.turn_count > 0
          AND s.ended_at >= p_since AND s.ended_at < p_until
    )
    SELECT week_start, intent, count(*),
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY turn_count)::numeric, 2),
           round(percentile_cont(0.75) WITHIN GROUP (ORDER BY turn_count)::numeric, 2)
    FROM resolved GROUP BY week_start, intent
    UNION ALL
    SELECT week_start, 'all', count(*),
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY turn_count)::numeric, 2),
           round(percentile_cont(0.75) WITHIN GROUP (ORDER BY turn_count)::numeric, 2)
    FROM resolved GROUP BY week_start
    ORDER BY 1, 2
$$;

REVOKE ALL ON FUNCTION public.mentor_resolution_efficiency(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mentor_resolution_efficiency(timestamptz, timestamptz) TO service_role;
