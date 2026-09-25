-- family_engagement_insight — S07.6, part 2 of 2 (D.6): the staff
-- family-engagement insight on the per-child shape, and its uptime.
-- @phase: expand
--
-- THE DEFECT. 0074 redefined insights_family_engagement per child (one row per
-- child with a verified Tutor: guardians, tasks created, tasks approved, last
-- task). Core's reader still parsed the earlier per-family shape (family id,
-- creation date, members, tasks completed), so every row failed validation and
-- GET /api/v1/admin/insights/families answered "Family views unreachable" for
-- every request since 0074. Appendix H makes this a prerequisite for the Block D
-- metrics: a metrics framework is only as useful as the staff tooling that
-- surfaces it.
--
-- THE FIX, AT THE BOUNDARY. One function answers the staff insight, built on
-- the per-child view (the view stays the single definition of "engagement per
-- child"):
--   summary   population counts over every child with a verified Tutor
--             (bookkeeping, counts only: no consent needed for a number no one
--             can trace back to a child)
--   children  the per-child rows, only for children the H.1 analytics gate
--             admits (family_analytics_admitted, the gate every Block D
--             behavioural diagnostic uses), with NO identity: no child id, no
--             Tutor id, and dates to the day. A per-child row is analytics
--             about a child, so it follows the child's consent.
-- Its jsonb keys are the wire contract; agent/tools/check-family-engagement-
-- contract.mjs fails CI when this file, Core's parser and the console's type
-- disagree, which is the exact drift that broke the insight.
--
-- UPTIME (Appendix H: Staff Family-Engagement Insight Uptime, target 100%).
-- staff_insight_checks records every staff request's outcome (Core writes it
-- through record_staff_insight_check) and a nightly probe
-- (insights-maintenance.yml calls probe_family_engagement_insight), so the
-- insight is measured even on days no one opens the console. Closed
-- vocabularies only: no free text, no identity.

CREATE OR REPLACE FUNCTION public.family_engagement_insight(p_limit int DEFAULT 100, p_active_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_summary  jsonb;
    v_children jsonb;
BEGIN
    IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_active_days IS NULL OR p_active_days NOT BETWEEN 1 AND 365 THEN
        RAISE EXCEPTION 'ENGAGEMENT_INSIGHT_BOUNDS' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_build_object(
        'children', count(*),
        'children_with_tasks', count(*) FILTER (WHERE e.tasks_created > 0),
        'active_children', count(*) FILTER (WHERE e.last_task_at >= now() - make_interval(days => p_active_days)),
        'tasks_created', coalesce(sum(e.tasks_created), 0),
        'tasks_approved', coalesce(sum(e.tasks_approved), 0),
        'active_days', p_active_days
    )
    INTO v_summary
    FROM public.insights_family_engagement e;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
            'guardians', r.guardians,
            'tasks_created', r.tasks_created,
            'tasks_approved', r.tasks_approved,
            'first_link_on', to_char(r.first_guardian_link_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
            'last_task_on', CASE WHEN r.last_task_at IS NULL THEN NULL ELSE to_char(r.last_task_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') END
        ) ORDER BY r.last_task_at DESC NULLS LAST, r.tasks_created DESC), '[]'::jsonb)
    INTO v_children
    FROM (
        SELECT e.*
        FROM public.insights_family_engagement e
        WHERE public.family_analytics_admitted(e.kid_user_id)
        ORDER BY e.last_task_at DESC NULLS LAST, e.tasks_created DESC
        LIMIT p_limit
    ) r;

    RETURN jsonb_build_object(
        'summary', v_summary || jsonb_build_object('listed_children', jsonb_array_length(v_children)),
        'children', v_children
    );
END;
$$;
REVOKE ALL ON FUNCTION public.family_engagement_insight(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_engagement_insight(int, int) TO service_role;

-- ── Uptime record ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_insight_checks (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    insight    text NOT NULL CHECK (insight IN ('family_engagement')),
    source     text NOT NULL CHECK (source IN ('request', 'probe')),
    outcome    text NOT NULL CHECK (outcome IN ('ok', 'unavailable', 'shape_mismatch')),
    checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_insight_checks_insight_time ON public.staff_insight_checks (insight, checked_at);

ALTER TABLE public.staff_insight_checks ENABLE ROW LEVEL SECURITY;
-- No policy: no browser role reads or writes it. Only the two functions below
-- write it, so a row is always one of the closed outcomes at the real time.
REVOKE ALL ON public.staff_insight_checks FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_staff_insight_check(p_insight text, p_source text, p_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.staff_insight_checks (insight, source, outcome) VALUES (p_insight, p_source, p_outcome);
END;
$$;
REVOKE ALL ON FUNCTION public.record_staff_insight_check(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_staff_insight_check(text, text, text) TO service_role;

-- The nightly probe: the same function the staff endpoint calls, checked for
-- the contract's keys. An error (a view redefined under it, a missing
-- function) is 'unavailable'; an answer without the contract's keys is
-- 'shape_mismatch'. It also keeps the record to its retention bound.
CREATE OR REPLACE FUNCTION public.probe_family_engagement_insight(p_retain_days int DEFAULT 400)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_answer  jsonb;
    v_outcome text;
    v_pruned  bigint;
BEGIN
    BEGIN
        v_answer := public.family_engagement_insight(1, 30);
        IF jsonb_typeof(v_answer -> 'summary') = 'object'
           AND jsonb_typeof(v_answer -> 'children') = 'array'
           AND (v_answer -> 'summary') ?& ARRAY['children', 'children_with_tasks', 'active_children', 'tasks_created', 'tasks_approved', 'active_days', 'listed_children']
           AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(v_answer -> 'children') c
               WHERE NOT (c ?& ARRAY['guardians', 'tasks_created', 'tasks_approved', 'first_link_on', 'last_task_on'])
           ) THEN
            v_outcome := 'ok';
        ELSE
            v_outcome := 'shape_mismatch';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_outcome := 'unavailable';
    END;
    INSERT INTO public.staff_insight_checks (insight, source, outcome) VALUES ('family_engagement', 'probe', v_outcome);
    -- Retention runs only when the probe is called, never when this file is
    -- applied (which deletes nothing, so it stays an expand migration).
    WITH gone AS (DELETE FROM public.staff_insight_checks WHERE checked_at < now() - make_interval(days => greatest(p_retain_days, 30)) RETURNING 1)
    SELECT count(*) INTO v_pruned FROM gone;
    RETURN v_outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.probe_family_engagement_insight(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.probe_family_engagement_insight(int) TO service_role;

-- Uptime over a window, per source: how many checks, how many returned data.
CREATE OR REPLACE FUNCTION public.staff_insight_uptime(p_insight text, p_since timestamptz)
RETURNS TABLE (source text, checks bigint, ok bigint, last_outcome text, last_checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT s.name,
           count(c.id),
           count(c.id) FILTER (WHERE c.outcome = 'ok'),
           (SELECT l.outcome FROM public.staff_insight_checks l
             WHERE l.insight = p_insight AND l.source = s.name ORDER BY l.checked_at DESC, l.id DESC LIMIT 1),
           max(c.checked_at)
    FROM (VALUES (1, 'probe'), (2, 'request')) AS s (ord, name)
    LEFT JOIN public.staff_insight_checks c
           ON c.insight = p_insight AND c.source = s.name AND c.checked_at >= p_since
    GROUP BY s.ord, s.name
    ORDER BY s.ord;
$$;
REVOKE ALL ON FUNCTION public.staff_insight_uptime(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_insight_uptime(text, timestamptz) TO service_role;

select 'migration_family_engagement_insight_ok' as sentinel;
