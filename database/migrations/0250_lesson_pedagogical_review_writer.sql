-- lesson_pedagogical_review_writer — the one writer and the staff read of a
-- Stage 3 pedagogical review (GAP-FIX-R6 learning; Appendix C Part 3 Stage 3,
-- Part 2.1 criterion 4; Block B's six checks). Part 2 of 3 (storage: the
-- previous migration; release enforcement: the next one).
-- @phase: expand
--
-- 1. record_lesson_pedagogical_review(actor, lesson, version, fingerprint,
--    author, checks, forge_items). Refusals, each a named code:
--      FORBIDDEN            the actor is not a superadmin or an admin holding
--                           manage_content (content_release_actor_allowed);
--      NOT_FOUND            no such lesson, or the version is not the lesson's;
--      CONTENT_CHANGED      a lesson review names the fingerprint the reviewer
--                           read, and the lesson's content moved since;
--      AUTHOR_REQUIRED      the author is the version's recorded creator; with
--      AUTHOR_MISMATCH      none (Forge runs as the service role) the reviewer
--      AUTHOR_NOT_STAFF     names the Content Author, a staff account;
--      SELF_REVIEW          reviewer = author (Appendix C Stage 3: a distinct
--                           role; the table CHECK is the backstop);
--      INVALID_REVIEW       not exactly the ten items, each {result, finding}
--                           with a finding of 10-600 characters;
--      FORGE_ITEMS_UNRESOLVED  not exactly one resolution per open Forge item.
--    The result is derived: 'fail' when any item fails or any Forge item needs
--    change (finding_count = how many), else 'pass'. The review, the item
--    resolutions and the audit row 'content.stage3_review.recorded' commit
--    together. The lesson row is locked FOR SHARE, so a review and a release
--    of the same lesson serialize.
-- 2. lesson_stage3_review_state(lesson, version): what the staff form needs,
--    as one JSON object: the subject, the current fingerprint, the version's
--    creator, the latest review of this subject, the open Forge items, the
--    staff accounts that may be named as author, and the release refusal;
--    {"found": false} for an unknown lesson or a version of another lesson.
-- Service role only; Core passes the verified staff actor.

CREATE OR REPLACE FUNCTION public.record_lesson_pedagogical_review(
    p_actor uuid, p_lesson_id uuid, p_document_version_id uuid, p_fingerprint text,
    p_author uuid, p_checks jsonb, p_forge_items jsonb)
RETURNS TABLE (ok boolean, code text, message text, review_id uuid, result text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_creator uuid;
    v_author uuid;
    v_source text;
    v_fp text;
    v_items jsonb := coalesce(p_forge_items, '[]'::jsonb);
    v_open integer;
    v_given integer;
    v_matched integer;
    v_findings integer;
    v_result text;
    v_id uuid;
BEGIN
    IF NOT public.content_release_actor_allowed(p_actor) THEN
        RETURN QUERY SELECT false, 'FORBIDDEN'::text, 'Only staff with the content permission may record a Stage 3 review.'::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;
    PERFORM 1 FROM public.lessons l WHERE l.id = p_lesson_id FOR SHARE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'NOT_FOUND'::text, 'Lesson does not exist.'::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    IF p_document_version_id IS NOT NULL THEN
        SELECT v.created_by INTO v_creator FROM public.lesson_document_versions v
        WHERE v.id = p_document_version_id AND v.lesson_id = p_lesson_id;
        IF NOT FOUND THEN
            RETURN QUERY SELECT false, 'NOT_FOUND'::text, 'This version is not a version of the lesson.'::text, NULL::uuid, NULL::text;
            RETURN;
        END IF;
        IF p_fingerprint IS NOT NULL THEN
            RETURN QUERY SELECT false, 'INVALID_REVIEW'::text, 'A version review names the version, not a lesson fingerprint.'::text, NULL::uuid, NULL::text;
            RETURN;
        END IF;
    ELSE
        v_fp := public.lesson_stage3_fingerprint(p_lesson_id);
        IF p_fingerprint IS DISTINCT FROM v_fp THEN
            RETURN QUERY SELECT false, 'CONTENT_CHANGED'::text, 'The lesson content changed since it was read; review the current content.'::text, NULL::uuid, NULL::text;
            RETURN;
        END IF;
    END IF;

    IF v_creator IS NOT NULL THEN
        IF p_author IS NOT NULL AND p_author <> v_creator THEN
            RETURN QUERY SELECT false, 'AUTHOR_MISMATCH'::text, 'The version records its own author.'::text, NULL::uuid, NULL::text;
            RETURN;
        END IF;
        v_author := v_creator;
        v_source := 'version_creator';
    ELSE
        IF p_author IS NULL THEN
            RETURN QUERY SELECT false, 'AUTHOR_REQUIRED'::text, 'Name the Content Author of this content.'::text, NULL::uuid, NULL::text;
            RETURN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_author AND r.role IN ('admin', 'superadmin')) THEN
            RETURN QUERY SELECT false, 'AUTHOR_NOT_STAFF'::text, 'The Content Author is a staff account.'::text, NULL::uuid, NULL::text;
            RETURN;
        END IF;
        v_author := p_author;
        v_source := 'named_by_reviewer';
    END IF;
    IF v_author = p_actor THEN
        RETURN QUERY SELECT false, 'SELF_REVIEW'::text, 'The Pedagogical Reviewer is never the Content Author of the same content.'::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    IF NOT public.stage3_review_checks_valid(p_checks) THEN
        RETURN QUERY SELECT false, 'INVALID_REVIEW'::text, 'Every check needs a result and a named finding of 10-600 characters.'::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;
    IF jsonb_typeof(v_items) <> 'array' OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_items) AS e(item)
        WHERE jsonb_typeof(e.item) <> 'object'
           OR jsonb_typeof(e.item -> 'id') IS DISTINCT FROM 'string'
           OR (e.item ->> 'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR jsonb_typeof(e.item -> 'resolution') IS DISTINCT FROM 'string'
           OR (e.item ->> 'resolution') NOT IN ('acceptable', 'needs_change')
           OR jsonb_typeof(e.item -> 'note') IS DISTINCT FROM 'string'
           OR length(btrim(e.item ->> 'note')) NOT BETWEEN 10 AND 600) THEN
        RETURN QUERY SELECT false, 'INVALID_REVIEW'::text, 'Each Forge item needs a resolution and a note of 10-600 characters.'::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;
    SELECT count(*)::integer INTO v_open FROM public.stage3_open_items(p_lesson_id, p_document_version_id);
    SELECT count(DISTINCT e.item ->> 'id')::integer INTO v_given FROM jsonb_array_elements(v_items) AS e(item);
    SELECT count(*)::integer INTO v_matched FROM public.stage3_open_items(p_lesson_id, p_document_version_id) o
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) AS e(item) WHERE e.item ->> 'id' = o.id::text);
    IF v_given <> jsonb_array_length(v_items) OR v_given <> v_open OR v_matched <> v_open THEN
        RETURN QUERY SELECT false, 'FORGE_ITEMS_UNRESOLVED'::text,
            format('Resolve each of the %s open Forge item(s) exactly once.', v_open), NULL::uuid, NULL::text;
        RETURN;
    END IF;

    SELECT (SELECT count(*) FROM jsonb_each(p_checks) AS c(key, value) WHERE c.value ->> 'result' = 'fail')
         + (SELECT count(*) FROM jsonb_array_elements(v_items) AS e(item) WHERE e.item ->> 'resolution' = 'needs_change')
      INTO v_findings;
    v_result := CASE WHEN v_findings = 0 THEN 'pass' ELSE 'fail' END;

    INSERT INTO public.lesson_pedagogical_reviews
        (lesson_id, subject_kind, content_fingerprint, document_version_id, reviewer_id, author_id, author_source,
         result, finding_count, checks, forge_items)
    VALUES (p_lesson_id, CASE WHEN p_document_version_id IS NULL THEN 'lesson' ELSE 'version' END, v_fp, p_document_version_id,
            p_actor, v_author, v_source, v_result, v_findings, p_checks, v_items)
    RETURNING id INTO v_id;
    UPDATE public.lesson_stage3_review_items i
    SET review_id = v_id, resolution = e.item ->> 'resolution', resolution_note = btrim(e.item ->> 'note')
    FROM jsonb_array_elements(v_items) AS e(item)
    WHERE i.id::text = e.item ->> 'id';
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'content.stage3_review.recorded', p_lesson_id::text, jsonb_build_object(
        'review_id', v_id, 'subject', CASE WHEN p_document_version_id IS NULL THEN 'lesson' ELSE 'version' END,
        'document_version_id', p_document_version_id, 'fingerprint', v_fp, 'result', v_result, 'findings', v_findings,
        'author_id', v_author, 'author_source', v_source, 'forge_items', jsonb_array_length(v_items)));
    RETURN QUERY SELECT true, 'RECORDED'::text, 'Stage 3 review recorded.'::text, v_id, v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.record_lesson_pedagogical_review(uuid, uuid, uuid, text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lesson_pedagogical_review(uuid, uuid, uuid, text, uuid, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.lesson_stage3_review_state(p_lesson_id uuid, p_document_version_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_status text;
    v_creator uuid;
    v_locale text;
    v_version_label text;
    v_fp text;
    v_latest jsonb;
    v_items jsonb;
    v_authors jsonb;
BEGIN
    SELECT l.status INTO v_status FROM public.lessons l WHERE l.id = p_lesson_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;
    IF p_document_version_id IS NOT NULL THEN
        SELECT v.created_by, v.locale, v.version_id INTO v_creator, v_locale, v_version_label
        FROM public.lesson_document_versions v WHERE v.id = p_document_version_id AND v.lesson_id = p_lesson_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('found', false);
        END IF;
    ELSE
        v_fp := public.lesson_stage3_fingerprint(p_lesson_id);
    END IF;

    SELECT jsonb_build_object('id', r.id, 'result', r.result, 'finding_count', r.finding_count, 'reviewer_id', r.reviewer_id,
                              'author_id', r.author_id, 'author_source', r.author_source, 'checks', r.checks,
                              'forge_items', r.forge_items, 'recorded_at', r.recorded_at)
      INTO v_latest
    FROM public.lesson_pedagogical_reviews r
    WHERE r.lesson_id = p_lesson_id
      AND CASE WHEN p_document_version_id IS NULL THEN r.subject_kind = 'lesson' AND r.content_fingerprint = v_fp
               ELSE r.subject_kind = 'version' AND r.document_version_id = p_document_version_id END
    ORDER BY r.seq DESC LIMIT 1;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'gate', o.gate, 'message', o.flag_text, 'locale', o.locale,
                                                 'run_id', o.run_id, 'created_at', o.created_at) ORDER BY o.created_at, o.id), '[]'::jsonb)
      INTO v_items
    FROM public.stage3_open_items(p_lesson_id, p_document_version_id) o;

    SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'display_name', coalesce(p.display_name, '')) ORDER BY coalesce(p.display_name, ''), s.user_id), '[]'::jsonb)
      INTO v_authors
    FROM (SELECT DISTINCT r.user_id FROM public.user_roles r WHERE r.role IN ('admin', 'superadmin')) s
    LEFT JOIN public.profiles p ON p.user_id = s.user_id;

    RETURN jsonb_build_object(
        'found', true, 'lesson_id', p_lesson_id, 'lesson_status', v_status,
        'subject', CASE WHEN p_document_version_id IS NULL THEN 'lesson' ELSE 'version' END,
        'fingerprint', v_fp, 'document_version_id', p_document_version_id, 'locale', v_locale, 'version_id', v_version_label,
        'version_author_id', v_creator, 'latest', v_latest, 'open_items', v_items, 'authors', v_authors,
        'refusal', public.stage3_release_refusal(p_lesson_id, p_document_version_id));
END;
$$;
REVOKE ALL ON FUNCTION public.lesson_stage3_review_state(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_stage3_review_state(uuid, uuid) TO service_role;
