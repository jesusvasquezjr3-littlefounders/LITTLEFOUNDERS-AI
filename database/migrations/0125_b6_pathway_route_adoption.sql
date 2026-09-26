-- @phase: expand
-- B.6 / OD-16 / OD-22 (S05.3b) — the learner routes adopt the pathway model.
-- Policy (a proposal awaiting owner review): docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md.
-- Requires the B.6 data-layer migration (course_pathway_badges,
-- course_pathway_placements, adventures.pathway_stage) to be applied first.
--
-- Two database boundaries, both additive:
--
--   get_completed_course_badges  every badge reader (profile, the Family Hub
--                                badge share, the public badge page, the B.2
--                                prerequisite check) now sees STORED badges
--                                as well as the live full-course rule. A
--                                stored badge is never revoked (Rule B4): a
--                                course that grows by one lesson no longer
--                                takes a finished learner's badge away, which
--                                OD-9 forbids. The live rule is kept, so no
--                                badge that exists today disappears either.
--
--   commit_course_pathway_placement
--                                the stage-entry placement (Rule P6), built on
--                                B.1's atomic commit (commit_course_placement):
--                                one transaction writes the (course, stage)
--                                entry row, keeps B.1's legacy course record,
--                                and adds placement credits. Credits are
--                                refused outside the stage's own chapters, so
--                                a placement can never credit another stage's
--                                pathway (OD-16: a minor never completes adult
--                                chapters, an adult never childhood ones).
--
-- POSTURE: both functions are SECURITY DEFINER, executable by service_role
-- only. Core computes every placement and award; no client writes either.

-- ─────────────────────────────────────────────────────────────
-- get_completed_course_badges — stored ∪ live, never revoked
-- ─────────────────────────────────────────────────────────────
-- Same signature and row shape as the 0043 version (callers are unchanged).
-- The live half is the 0043 body verbatim apart from projecting course_id; the
-- stored half reads course_pathway_badges. When both exist the EARLIEST date
-- wins, so a frozen badge keeps the date it was first earned.
CREATE OR REPLACE FUNCTION public.get_completed_course_badges(
    p_user_id uuid
)
RETURNS TABLE (
    course_slug text,
    course_title jsonb,
    badge_asset text,
    completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH live AS (
        SELECT
            c.id AS course_id,
            MAX(COALESCE(lp.completed_at, pc.created_at)) AS completed_at
        FROM public.courses c
        JOIN public.adventures a ON a.course_id = c.id
        JOIN public.sagas s ON s.adventure_id = a.id
        JOIN public.topics t ON t.saga_id = s.id
        JOIN public.lessons l ON l.topic_id = t.id
        LEFT JOIN public.lesson_progress lp
            ON lp.lesson_id = l.id
           AND lp.user_id = p_user_id
           AND lp.passed = true
        LEFT JOIN public.placement_credits pc
            ON pc.lesson_id = l.id
           AND pc.user_id = p_user_id
        WHERE c.status = 'published'
          AND c.badge_asset IS NOT NULL
          AND l.status <> 'archived'
        GROUP BY c.id
        HAVING COUNT(DISTINCT l.id) > 0
           AND COUNT(DISTINCT COALESCE(lp.lesson_id, pc.lesson_id)) = COUNT(DISTINCT l.id)
    ),
    stored AS (
        SELECT b.course_id, MIN(b.earned_at) AS completed_at
        FROM public.course_pathway_badges b
        WHERE b.user_id = p_user_id
        GROUP BY b.course_id
    ),
    earned AS (
        SELECT course_id, completed_at FROM live
        UNION ALL
        SELECT course_id, completed_at FROM stored
    )
    SELECT
        c.slug,
        c.title,
        c.badge_asset,
        MIN(e.completed_at) AS completed_at
    FROM earned e
    JOIN public.courses c ON c.id = e.course_id
    WHERE c.status = 'published'
      AND c.badge_asset IS NOT NULL
    GROUP BY c.id, c.slug, c.title, c.badge_asset, c.position
    ORDER BY MIN(e.completed_at) DESC NULLS LAST, c.position ASC, c.id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_completed_course_badges(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_course_badges(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- commit_course_pathway_placement — the stage-entry placement (Rule P6)
-- ─────────────────────────────────────────────────────────────
-- p_result: { user_id, course_id, pathway_stage, method, start_topic_id,
--             start_lesson_id, credited_topics, claimed_level,
--             education_level, quiz_answers }
-- Returns 'created', 'replayed' (the same placement committed again) or
-- 'conflict' (this stage already has a different entry placement).
CREATE OR REPLACE FUNCTION public.commit_course_pathway_placement(p_result jsonb, p_lesson_ids uuid[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    subject uuid := (p_result->>'user_id')::uuid;
    course uuid := (p_result->>'course_id')::uuid;
    stage text := p_result->>'pathway_stage';
    start_topic uuid := (p_result->>'start_topic_id')::uuid;
    credited integer := (p_result->>'credited_topics')::integer;
    prior public.course_pathway_placements%ROWTYPE;
    credits uuid[];
BEGIN
    IF p_lesson_ids IS NULL OR jsonb_typeof(p_result) <> 'object' THEN
        RAISE EXCEPTION 'Invalid placement payload';
    END IF;
    IF array_position(p_lesson_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid credit'; END IF;
    IF stage IS NULL OR stage NOT IN ('child', 'tween', 'teen', 'adult') THEN
        RAISE EXCEPTION 'Invalid pathway stage';
    END IF;
    IF credited IS NULL OR credited < 0 THEN RAISE EXCEPTION 'Invalid credited topic count'; END IF;
    SELECT coalesce(array_agg(DISTINCT id ORDER BY id), '{}'::uuid[]) INTO credits
        FROM unnest(p_lesson_ids) id;
    PERFORM 1 FROM auth.users WHERE id = subject FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown learner'; END IF;

    -- A credit must be a published lesson of THIS course inside a chapter of
    -- THIS stage. A legacy chapter's stage is its age tier's (Rule P1), the
    -- same table Core uses: tier1/tier2 child, tier3 tween, tier4 teen.
    IF EXISTS (
        SELECT 1 FROM unnest(credits) AS requested(lesson_id) WHERE NOT EXISTS (
            SELECT 1 FROM public.lessons l
            JOIN public.topics t ON t.id = l.topic_id
            JOIN public.sagas s ON s.id = t.saga_id
            JOIN public.adventures a ON a.id = s.adventure_id
            WHERE l.id = requested.lesson_id
              AND a.course_id = course
              AND l.status = 'published'
              AND COALESCE(a.pathway_stage, CASE a.age_tier
                    WHEN 'tier1' THEN 'child' WHEN 'tier2' THEN 'child'
                    WHEN 'tier3' THEN 'tween' WHEN 'tier4' THEN 'teen' END) = stage
        )
    ) THEN RAISE EXCEPTION 'Credit outside the pathway stage'; END IF;
    IF start_topic IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.topics t
        JOIN public.sagas s ON s.id = t.saga_id
        JOIN public.adventures a ON a.id = s.adventure_id
        WHERE t.id = start_topic AND a.course_id = course
    ) THEN RAISE EXCEPTION 'Start topic outside the course'; END IF;

    SELECT * INTO prior FROM public.course_pathway_placements
        WHERE user_id = subject AND course_id = course AND pathway_stage = stage;
    IF FOUND THEN
        IF prior.method = p_result->>'method'
           AND prior.start_topic_id IS NOT DISTINCT FROM start_topic
           AND prior.credited_topics = credited
           AND NOT EXISTS (
               SELECT 1 FROM unnest(credits) AS requested(lesson_id)
               WHERE NOT EXISTS (
                   SELECT 1 FROM public.placement_credits pc
                   WHERE pc.user_id = subject AND pc.lesson_id = requested.lesson_id
               )
           ) THEN
            RETURN 'replayed';
        END IF;
        RETURN 'conflict';
    END IF;

    INSERT INTO public.course_pathway_placements(user_id, course_id, pathway_stage, method, start_topic_id, credited_topics)
    VALUES (subject, course, stage, p_result->>'method', start_topic, credited);
    -- B.1's per-course record is kept as the course's FIRST placement, written
    -- only when absent: a later stage never rewrites it, and an operator who
    -- switches Core back to the linear engine still finds the learner placed.
    INSERT INTO public.course_placements(user_id, course_id, claimed_level, education_level, quiz_answers, start_topic_id, start_lesson_id, method)
    VALUES (subject, course, p_result->>'claimed_level', p_result->>'education_level', p_result->'quiz_answers',
        start_topic, (p_result->>'start_lesson_id')::uuid, p_result->>'method')
    ON CONFLICT (user_id, course_id) DO NOTHING;
    -- Credits already granted by an earlier stage stay exactly as they are.
    INSERT INTO public.placement_credits(user_id, lesson_id, topic_id, course_id)
        SELECT subject, l.id, l.topic_id, course FROM public.lessons l WHERE l.id = ANY(credits)
    ON CONFLICT (user_id, lesson_id) DO NOTHING;
    RETURN 'created';
END;
$$;

REVOKE ALL ON FUNCTION public.commit_course_pathway_placement(jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_course_pathway_placement(jsonb, uuid[]) TO service_role;
