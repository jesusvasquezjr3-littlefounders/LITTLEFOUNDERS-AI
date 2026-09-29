-- v2_time_on_task — Appendix C 1.2 Session Efficiency Ratio counts v2 lesson
-- work (GAP-FIX-R4 learning; B.28; Appendix P Part 7.5).
-- @phase: expand
--
-- The ratio is "time spent in graded/practice interaction / total session
-- time". learning_session_efficiency (0136) took graded seconds only from
-- lesson_segment_attempts.time_spent_seconds, the legacy v1 player's table.
-- A v2 grade (lesson_v2_grade_receipts) or a v2 non-scored step
-- (lesson_v2_segment_views) stored no time, so every v2 lesson added session
-- heartbeats with zero graded time; after OD-24 retires v1 the ratio reads 0.
--
-- This adds the v2 time on task as an ANALYTICS FIELD ONLY (Part 7.5: never a
-- grading input). Core accepts an optional bounded time_spent_seconds
-- (0-7200) on the v2 grade and view routes and records it here AFTER the
-- receipt or view exists, through record_v2_time_on_task. The receipt's
-- verdict, score and completion are untouched: nothing that grades or
-- completes reads these columns.
--
--   lesson_v2_grade_receipts.time_spent_seconds  (nullable, 0-7200)
--   lesson_v2_segment_views.time_spent_seconds   (nullable, 0-7200)
--   record_v2_time_on_task(user, run, segment, receipt jti | null, seconds)
--       Sets the time once: on the learner's own receipt (by jti) or view
--       (by run and segment), only while it is still NULL. Returns whether a
--       row took it. A replayed grade or a second view never overwrites it.
--   learning_session_efficiency(since, until)
--       Same weekly shape as 0136; graded seconds are now the v1 attempts
--       PLUS the v2 receipts and views of the same learner-day, still capped
--       at that day's visible session time.
--
-- Additive columns, a new function and a CREATE OR REPLACE with the same
-- signature and result: expand. RLS and grants are unchanged (service-role
-- writes; neither table has a client policy).

ALTER TABLE public.lesson_v2_grade_receipts
    ADD COLUMN IF NOT EXISTS time_spent_seconds integer NULL
        CHECK (time_spent_seconds IS NULL OR time_spent_seconds BETWEEN 0 AND 7200);

ALTER TABLE public.lesson_v2_segment_views
    ADD COLUMN IF NOT EXISTS time_spent_seconds integer NULL
        CHECK (time_spent_seconds IS NULL OR time_spent_seconds BETWEEN 0 AND 7200);

CREATE OR REPLACE FUNCTION public.record_v2_time_on_task(
    p_user_id uuid, p_run_id uuid, p_segment_id text, p_receipt_jti text, p_seconds integer
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_rows integer;
BEGIN
    IF p_user_id IS NULL OR p_run_id IS NULL OR p_segment_id IS NULL OR p_seconds IS NULL
       OR p_seconds NOT BETWEEN 0 AND 7200 THEN
        RAISE EXCEPTION 'Invalid time on task' USING ERRCODE = '22023';
    END IF;
    IF p_receipt_jti IS NOT NULL THEN
        UPDATE public.lesson_v2_grade_receipts
        SET time_spent_seconds = p_seconds
        WHERE jti = p_receipt_jti AND user_id = p_user_id AND run_id = p_run_id
          AND segment_id = p_segment_id AND time_spent_seconds IS NULL;
    ELSE
        UPDATE public.lesson_v2_segment_views
        SET time_spent_seconds = p_seconds
        WHERE run_id = p_run_id AND segment_id = p_segment_id AND user_id = p_user_id
          AND time_spent_seconds IS NULL;
    END IF;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.record_v2_time_on_task(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_time_on_task(uuid, uuid, text, text, integer) TO service_role;

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
    ), timed AS (
        -- v1: the legacy player's graded attempts.
        SELECT a.user_id, a.created_at, COALESCE(a.time_spent_seconds, 0) AS seconds
        FROM public.lesson_segment_attempts a
        WHERE a.created_at >= p_since AND a.created_at < p_until
        UNION ALL
        -- v2: graded steps (every receipt, retries included: each is time on task).
        SELECT r.user_id, r.created_at, COALESCE(r.time_spent_seconds, 0)
        FROM public.lesson_v2_grade_receipts r
        WHERE r.created_at >= p_since AND r.created_at < p_until
        UNION ALL
        -- v2: practice steps the learner acted on without a grade (a Mentor turn, an explored visual).
        SELECT v.user_id, v.created_at, COALESCE(v.time_spent_seconds, 0)
        FROM public.lesson_v2_segment_views v
        WHERE v.created_at >= p_since AND v.created_at < p_until
    ), graded AS (
        SELECT t.user_id, (t.created_at AT TIME ZONE 'UTC')::date AS day, sum(t.seconds) AS seconds
        FROM timed t
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
