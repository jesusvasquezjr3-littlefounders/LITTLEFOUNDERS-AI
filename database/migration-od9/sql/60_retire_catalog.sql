-- OD-24 (with OD-9 section 4.1): the legacy lesson catalog is removed once the
-- migration and the v2 engine are done, and every earned record is kept.
--
-- Retirement is ARCHIVING, never deleting: lesson_progress, placement_credits,
-- course_placements and course_pathway_badges cascade when a lesson or course
-- row is deleted (the legacy_catalog_delete_guard migration now refuses such a
-- delete outright). The legacy catalog is every course, adventure, saga, topic
-- and lesson row that already existed when the 'before' inventory was taken
-- on the legacy database; content the Forge published later is not touched.
--
-- od9.run_retire_catalog(apply, before_label):
--   * refuses (OD9_RETIRE_REFUSED) unless the before inventory exists and a
--     kc-credit apply run is recorded (README step 7: credit BEFORE retiring);
--   * the dry run lists every row it would archive and every learner whose
--     complete legacy topic still lacks its KC credit (kind 'missing_credit');
--   * apply refuses while any such credit is missing, then archives only
--     (status = 'archived'), idempotently. The runner then captures
--     `inventory --label retired` and compares it with the before inventory
--     (exit 1 on any loss).

CREATE OR REPLACE FUNCTION od9.run_retire_catalog(p_apply boolean, p_before text DEFAULT 'before')
RETURNS TABLE (kind text, id uuid, slug text, detail text)
LANGUAGE plpgsql
SET "TimeZone" = 'UTC'
AS $$
#variable_conflict use_column
DECLARE
    run bigint;
    v_before timestamptz;
    v_missing bigint;
    v_archived jsonb := '{}'::jsonb;
    n bigint;
BEGIN
    PERFORM od9.require_rebuild_schema();
    SELECT min(r.started_at) INTO v_before FROM od9.runs r
     WHERE r.step = 'inventory' AND r.label = p_before AND r.mode = 'capture';
    IF v_before IS NULL OR NOT EXISTS (SELECT 1 FROM od9.inventory i WHERE i.label = p_before) THEN
        RAISE EXCEPTION 'OD9_RETIRE_REFUSED: no "%" inventory; capture it on the legacy database before anything else', p_before
            USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM od9.runs r WHERE r.step = 'kc_credit' AND r.mode = 'apply') THEN
        RAISE EXCEPTION 'OD9_RETIRE_REFUSED: run kc-credit --apply before retiring the legacy catalog (a retired topic can no longer be shown complete)'
            USING ERRCODE = '55000';
    END IF;

    INSERT INTO od9.runs (step, mode, label) VALUES ('retire_catalog', CASE WHEN p_apply THEN 'apply' ELSE 'dry_run' END, p_before)
    RETURNING od9.runs.id INTO run;

    -- Learners whose complete legacy topic still lacks a KC credit (the kc-credit dry run, reused).
    DROP TABLE IF EXISTS pg_temp.od9_retire_missing;
    CREATE TEMP TABLE od9_retire_missing AS
    SELECT k.user_id, k.course_slug, k.new_credits FROM od9.run_kc_credit(false) k WHERE k.new_credits > 0;
    SELECT count(*) INTO v_missing FROM od9_retire_missing;

    DROP TABLE IF EXISTS pg_temp.od9_retire_rows;
    CREATE TEMP TABLE od9_retire_rows AS
    SELECT 'course'::text AS kind, c.id, c.slug FROM public.courses c WHERE c.status <> 'archived' AND c.created_at <= v_before
    UNION ALL SELECT 'adventure', a.id, a.slug FROM public.adventures a WHERE a.status <> 'archived' AND a.created_at <= v_before
    UNION ALL SELECT 'saga', s.id, s.slug FROM public.sagas s WHERE s.status <> 'archived' AND s.created_at <= v_before
    UNION ALL SELECT 'topic', t.id, t.slug FROM public.topics t WHERE t.status <> 'archived' AND t.created_at <= v_before
    UNION ALL SELECT 'lesson', l.id, l.slug FROM public.lessons l WHERE l.status <> 'archived' AND l.created_at <= v_before;

    IF p_apply THEN
        IF v_missing > 0 THEN
            RAISE EXCEPTION 'OD9_RETIRE_REFUSED: % learner/course pair(s) have a complete legacy topic without its KC credit; run kc-credit --apply again first', v_missing
                USING ERRCODE = '55000';
        END IF;
        -- Children first, so no live parent ever points at an archived child only by accident of order.
        UPDATE public.lessons l SET status = 'archived' WHERE l.id IN (SELECT r.id FROM od9_retire_rows r WHERE r.kind = 'lesson');
        GET DIAGNOSTICS n = ROW_COUNT; v_archived := v_archived || jsonb_build_object('lessons', n);
        UPDATE public.topics t SET status = 'archived' WHERE t.id IN (SELECT r.id FROM od9_retire_rows r WHERE r.kind = 'topic');
        GET DIAGNOSTICS n = ROW_COUNT; v_archived := v_archived || jsonb_build_object('topics', n);
        UPDATE public.sagas s SET status = 'archived' WHERE s.id IN (SELECT r.id FROM od9_retire_rows r WHERE r.kind = 'saga');
        GET DIAGNOSTICS n = ROW_COUNT; v_archived := v_archived || jsonb_build_object('sagas', n);
        UPDATE public.adventures a SET status = 'archived' WHERE a.id IN (SELECT r.id FROM od9_retire_rows r WHERE r.kind = 'adventure');
        GET DIAGNOSTICS n = ROW_COUNT; v_archived := v_archived || jsonb_build_object('adventures', n);
        UPDATE public.courses c SET status = 'archived' WHERE c.id IN (SELECT r.id FROM od9_retire_rows r WHERE r.kind = 'course');
        GET DIAGNOSTICS n = ROW_COUNT; v_archived := v_archived || jsonb_build_object('courses', n);
    END IF;

    UPDATE od9.runs SET summary = jsonb_build_object(
        'before', p_before, 'before_at', v_before,
        'to_archive', (SELECT jsonb_object_agg(x.kind, x.n) FROM (SELECT r.kind, count(*) AS n FROM od9_retire_rows r GROUP BY r.kind) x),
        'archived', v_archived, 'missing_credit', v_missing)
    WHERE od9.runs.id = run;

    RETURN QUERY
    SELECT r.kind, r.id, r.slug, CASE WHEN p_apply THEN 'archived' ELSE 'to_archive' END FROM od9_retire_rows r
    UNION ALL
    SELECT 'missing_credit', m.user_id, m.course_slug, m.new_credits || ' KC credit(s) missing' FROM od9_retire_missing m
    ORDER BY 1, 3, 2;
END $$;
