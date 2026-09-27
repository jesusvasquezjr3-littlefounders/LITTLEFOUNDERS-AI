-- OD-24 (with OD-9): before the legacy lesson catalog is removed, every
-- completed legacy topic credits the knowledge components it TEACHES on the
-- shared graph (public.legacy_kc_credits), so the new courses start each
-- learner at the right place; and every course badge the live rule grants is
-- frozen (Rule B5), so removing lessons can never take one away.
--
-- Rules (docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md):
--   E1  a topic is complete when every published lesson in it is passed
--       (lesson_progress) or placement-credited (placement_credits);
--   E2  a complete topic satisfies each KC it teaches, never one it only
--       reviews; the Mentor's rows are not touched (no second model);
--   T3  the credit records the stage of the legacy chapter; it satisfies
--       prerequisites at every stage but stands for new content only of the
--       same or a younger stage (public.legacy_kc_credit_covers);
--   B5  frozen badges are the 0123 backfill, re-run at cutover.
-- Nothing is rewritten, rescored or deleted: lesson_progress, placement
-- credits, XP, coins and streaks are only read.
--
-- od9.run_kc_credit(false) reports; od9.run_kc_credit(true) writes. Both are
-- idempotent (primary keys; ON CONFLICT DO NOTHING).

CREATE OR REPLACE FUNCTION od9.run_kc_credit(p_apply boolean)
RETURNS TABLE (user_id uuid, course_slug text, topics_complete bigint, kcs_credited bigint, new_credits bigint)
LANGUAGE plpgsql
SET "TimeZone" = 'UTC'
AS $$
#variable_conflict use_column
DECLARE
    run bigint;
    frozen bigint := 0;
    inserted bigint := 0;
    unmapped bigint;
    stageless bigint;
BEGIN
    PERFORM od9.require_rebuild_schema();
    INSERT INTO od9.runs (step, mode) VALUES ('kc_credit', CASE WHEN p_apply THEN 'apply' ELSE 'dry_run' END) RETURNING id INTO run;

    DROP TABLE IF EXISTS pg_temp.od9_topic_done;
    CREATE TEMP TABLE od9_topic_done AS
    WITH live AS (
        SELECT l.id AS lesson_id, l.topic_id FROM public.lessons l WHERE l.status = 'published'
    ), totals AS (
        SELECT topic_id, count(*) AS n FROM live GROUP BY topic_id
    ), done AS (
        SELECT e.user_id, lv.topic_id, lv.lesson_id,
               bool_or(e.src = 'passed') AS passed, max(e.at) AS at
        FROM (SELECT p.user_id, p.lesson_id, 'passed' AS src, p.completed_at AS at FROM public.lesson_progress p WHERE p.passed
              UNION ALL
              SELECT c.user_id, c.lesson_id, 'credit', c.created_at FROM public.placement_credits c) e
        JOIN live lv ON lv.lesson_id = e.lesson_id
        GROUP BY e.user_id, lv.topic_id, lv.lesson_id
    )
    SELECT d.user_id, d.topic_id, t.n AS lessons_total,
           CASE WHEN bool_and(d.passed) THEN 'lessons_passed'
                WHEN NOT bool_or(d.passed) THEN 'placement_credit'
                ELSE 'mixed' END AS basis,
           max(d.at) AS completed_at,
           c.slug AS course_slug,
           a.slug || '/' || s.slug || '/' || tp.slug AS topic_path,
           od9.chapter_stage(a.age_tier, a.pathway_stage) AS stage
    FROM done d
    JOIN totals t ON t.topic_id = d.topic_id
    JOIN public.topics tp ON tp.id = d.topic_id
    JOIN public.sagas s ON s.id = tp.saga_id
    JOIN public.adventures a ON a.id = s.adventure_id
    JOIN public.courses c ON c.id = a.course_id
    GROUP BY d.user_id, d.topic_id, t.n, c.slug, a.slug, s.slug, tp.slug, a.age_tier, a.pathway_stage
    HAVING count(*) = t.n;

    DROP TABLE IF EXISTS pg_temp.od9_credit;
    CREATE TEMP TABLE od9_credit AS
    SELECT td.user_id, k.kc_id, td.topic_id, td.course_slug, td.topic_path, td.stage, td.basis,
           td.lessons_total, td.completed_at, k.map_version
    FROM od9_topic_done td
    JOIN public.topic_knowledge_components k ON k.topic_id = td.topic_id AND k.role = 'teaches'
    JOIN public.kc ON kc.id = k.kc_id AND kc.status <> 'retired'
    WHERE td.stage IS NOT NULL;

    SELECT count(*) INTO unmapped FROM od9_topic_done td
    WHERE NOT EXISTS (SELECT 1 FROM public.topic_knowledge_components k WHERE k.topic_id = td.topic_id AND k.role = 'teaches');
    SELECT count(*) INTO stageless FROM od9_topic_done td WHERE td.stage IS NULL;

    IF p_apply THEN
        INSERT INTO public.legacy_kc_credits (user_id, kc_id, source_topic_id, source_course_slug, source_topic_path,
                                              source_stage, basis, lessons_total, completed_at, map_version)
        SELECT c.user_id, c.kc_id, c.topic_id, c.course_slug, c.topic_path, c.stage, c.basis, c.lessons_total, c.completed_at, c.map_version
        FROM od9_credit c
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS inserted = ROW_COUNT;

        -- B5, the 0123 backfill verbatim in intent: freeze what the live rule grants.
        INSERT INTO public.course_pathway_badges (user_id, course_id, award_key, pathway_stage, basis, earned_at)
        SELECT l.uid, c.id, 'legacy', st.legacy_stage, 'legacy_full_course', COALESCE(b.completed_at, now())
        FROM od9.badge_learners() l
        CROSS JOIN LATERAL public.get_completed_course_badges(l.uid) b
        JOIN public.courses c ON c.slug = b.course_slug
        LEFT JOIN LATERAL (
            SELECT CASE WHEN bool_and(a.age_tier IN ('tier1', 'tier2')) THEN 'child'
                        WHEN bool_and(a.age_tier = 'tier3') THEN 'tween'
                        WHEN bool_and(a.age_tier = 'tier4') THEN 'teen' END AS legacy_stage
            FROM public.adventures a WHERE a.course_id = c.id
        ) st ON true
        ON CONFLICT (user_id, course_id, award_key) DO NOTHING;
        GET DIAGNOSTICS frozen = ROW_COUNT;
    END IF;

    UPDATE od9.runs SET summary = jsonb_build_object(
        'complete_topics', (SELECT count(*) FROM od9_topic_done),
        'learners', (SELECT count(DISTINCT x.user_id) FROM od9_topic_done x),
        'credits', (SELECT count(*) FROM od9_credit),
        'new_credits', inserted,
        'badges_frozen', frozen,
        'complete_topics_teaching_no_kc', unmapped,
        'complete_topics_without_stage', stageless)
    WHERE id = run;

    RETURN QUERY
    SELECT c.user_id, c.course_slug, count(DISTINCT c.topic_id), count(DISTINCT c.kc_id),
           CASE WHEN p_apply THEN count(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM public.legacy_kc_credits l WHERE l.user_id = c.user_id AND l.kc_id = c.kc_id
                      AND l.source_topic_id = c.topic_id AND l.credited_at >= now()))
                ELSE count(*) FILTER (WHERE NOT EXISTS (
                    SELECT 1 FROM public.legacy_kc_credits l WHERE l.user_id = c.user_id AND l.kc_id = c.kc_id
                      AND l.source_topic_id = c.topic_id)) END
    FROM od9_credit c
    GROUP BY c.user_id, c.course_slug
    ORDER BY c.user_id, c.course_slug;
END $$;
