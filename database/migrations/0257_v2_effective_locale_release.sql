-- v2_effective_locale_release — release the canonical v2 catalogue without
-- requiring shadow v1 documents, while retaining a per-locale v1 fallback.
-- @phase: contract
-- @after-release: the Forge release whose v2 manifest attests and blocks on gates 5-9. Applying this first makes every v2 publication fail because publish_v2_lesson_version reads forge_v2_manifest_gates dynamically. Apply it with or after that Forge release; release_course/release_lesson themselves only broaden locale availability.
--
-- A locale is available when it has a current v2 pointer, or (only when that
-- pointer is absent) a v1 lesson_documents row. release_course and
-- release_lesson previously counted only v1 rows, which made a complete v2
-- lesson impossible to release. Their actor checks, lock order, verification,
-- watermark/concurrency recount, Stage 3 triggers and audit transaction are
-- retained below.

-- V2 is canonical for this catalogue, so every document-level Stage 2 gate
-- that Forge runs for v2 is also required by the publication RPC. Existing
-- rows remain untouched; publish_v2_lesson_version reads this table.
INSERT INTO public.forge_v2_manifest_gates (gate_id) VALUES
  ('forge.gate.05.rationale-canon'),
  ('forge.gate.06.anti-genericity'),
  ('forge.gate.07.generation-quality'),
  ('forge.gate.08.clarity'),
  ('forge.gate.09.readability')
ON CONFLICT (gate_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.lesson_effective_locale_count(p_lesson_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT count(*)::integer
    FROM (VALUES ('en-US'::text), ('es-MX'::text), ('pt-BR'::text)) AS wanted(locale)
    WHERE EXISTS (
        SELECT 1 FROM public.lesson_document_version_current p
        WHERE p.lesson_id = p_lesson_id AND p.locale = wanted.locale
    ) OR (
        NOT EXISTS (
            SELECT 1 FROM public.lesson_document_version_current p
            WHERE p.lesson_id = p_lesson_id AND p.locale = wanted.locale
        )
        AND EXISTS (
            SELECT 1 FROM public.lesson_documents d
            WHERE d.lesson_id = p_lesson_id AND d.locale = wanted.locale
        )
    )
$$;

REVOKE ALL ON FUNCTION public.lesson_effective_locale_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_effective_locale_count(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_course(
  p_actor uuid,
  p_course_id uuid
)
RETURNS TABLE (
  ok boolean,
  code text,
  message text,
  adventures_published integer,
  sagas_published integer,
  topics_published integer,
  lessons_published integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_status text;
  v_adventures integer := 0;
  v_sagas integer := 0;
  v_topics integer := 0;
  v_lessons integer := 0;
  v_documents integer := 0;
  v_ineligible_lessons integer := 0;
  v_incomplete_locale_lessons integer := 0;
  v_last_document_update timestamptz;
  v_v2_pointers integer := 0;
  v_last_v2_activation timestamptz;
  v_refusal_code text;
  v_refusal_message text;
  v_adventures_after integer := 0;
  v_adventures_unpublished integer := 0;
  v_sagas_after integer := 0;
  v_sagas_unpublished integer := 0;
  v_topics_after integer := 0;
  v_topics_unpublished integer := 0;
  v_lessons_after integer := 0;
  v_lessons_unpublished integer := 0;
  v_documents_after integer := 0;
  v_last_document_update_after timestamptz;
  v_v2_pointers_after integer := 0;
  v_last_v2_activation_after timestamptz;
BEGIN
  IF NOT public.content_release_actor_allowed(p_actor) THEN
    RETURN QUERY SELECT false, 'FORBIDDEN', 'Only staff with the content permission may release a course.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT c.status INTO v_course_status
  FROM public.courses c WHERE c.id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NOT_FOUND', 'Course does not exist.', 0, 0, 0, 0;
    RETURN;
  END IF;
  IF v_course_status = 'archived' THEN
    RETURN QUERY SELECT false, 'ARCHIVED', 'An archived course must be restored to draft before release.', 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Keep 0242's course-to-leaf lock order. The two content stores are locked
  -- before the verification watermark is checked.
  PERFORM 1 FROM public.adventures a WHERE a.course_id = p_course_id FOR UPDATE;
  PERFORM 1 FROM public.sagas s JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id FOR UPDATE OF s;
  PERFORM 1 FROM public.topics t JOIN public.sagas s ON s.id = t.saga_id
    JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id FOR UPDATE OF t;
  PERFORM 1 FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
    JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id FOR UPDATE OF l;
  PERFORM 1 FROM public.lesson_documents d JOIN public.lessons l ON l.id = d.lesson_id
    JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
    JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id FOR UPDATE OF d;
  PERFORM 1 FROM public.lesson_document_version_current p JOIN public.lessons l ON l.id = p.lesson_id
    JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
    JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id FOR UPDATE OF p;

  SELECT count(*)::integer INTO v_adventures FROM public.adventures a WHERE a.course_id = p_course_id;
  SELECT count(*)::integer INTO v_sagas FROM public.sagas s
    JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer INTO v_topics FROM public.topics t
    JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id;
  SELECT count(*)::integer INTO v_lessons FROM public.lessons l
    JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
    JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer INTO v_documents FROM public.lesson_documents d
    JOIN public.lessons l ON l.id = d.lesson_id JOIN public.topics t ON t.id = l.topic_id
    JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id;

  IF v_adventures = 0 OR v_sagas = 0 OR v_topics = 0 OR v_lessons = 0 THEN
    RETURN QUERY SELECT false, 'INCOMPLETE_HIERARCHY', 'A releasable course needs at least one adventure, saga, topic, and lesson.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_ineligible_lessons
  FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id AND l.status NOT IN ('review', 'published');
  IF v_ineligible_lessons > 0 THEN
    RETURN QUERY SELECT false, 'LESSONS_NOT_REVIEWABLE', 'Every lesson must be in review or already published before release.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_incomplete_locale_lessons
  FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id AND public.lesson_effective_locale_count(l.id) <> 3;
  IF v_incomplete_locale_lessons > 0 THEN
    RETURN QUERY SELECT false, 'INCOMPLETE_LOCALES', 'Every lesson needs en-US, es-MX, and pt-BR as a current v2 version or a v1 fallback before release.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT max(d.updated_at) INTO v_last_document_update FROM public.lesson_documents d
  JOIN public.lessons l ON l.id = d.lesson_id JOIN public.topics t ON t.id = l.topic_id
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, max(p.activated_at) INTO v_v2_pointers, v_last_v2_activation
  FROM public.lesson_document_version_current p JOIN public.lessons l ON l.id = p.lesson_id
  JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;

  SELECT r.code, r.message INTO v_refusal_code, v_refusal_message
  FROM public.forge_release_verification_refusal(p_course_id) AS r;
  IF v_refusal_code IS NOT NULL THEN
    RETURN QUERY SELECT false, v_refusal_code, v_refusal_message, 0, 0, 0, 0;
    RETURN;
  END IF;

  UPDATE public.lessons l SET status = 'published'
  FROM public.topics t, public.sagas s, public.adventures a
  WHERE l.topic_id = t.id AND t.saga_id = s.id AND s.adventure_id = a.id
    AND a.course_id = p_course_id AND l.status = 'review'
    AND public.lesson_effective_locale_count(l.id) = 3;
  GET DIAGNOSTICS lessons_published = ROW_COUNT;

  UPDATE public.topics t SET status = 'published'
  FROM public.sagas s, public.adventures a
  WHERE t.saga_id = s.id AND s.adventure_id = a.id AND a.course_id = p_course_id
    AND t.status <> 'published'
    AND NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id AND l.status <> 'published');
  GET DIAGNOSTICS topics_published = ROW_COUNT;
  UPDATE public.sagas s SET status = 'published' FROM public.adventures a
  WHERE s.adventure_id = a.id AND a.course_id = p_course_id AND s.status <> 'published'
    AND NOT EXISTS (SELECT 1 FROM public.topics t WHERE t.saga_id = s.id AND t.status <> 'published');
  GET DIAGNOSTICS sagas_published = ROW_COUNT;
  UPDATE public.adventures a SET status = 'published'
  WHERE a.course_id = p_course_id AND a.status <> 'published'
    AND NOT EXISTS (SELECT 1 FROM public.sagas s WHERE s.adventure_id = a.id AND s.status <> 'published');
  GET DIAGNOSTICS adventures_published = ROW_COUNT;

  SELECT count(*)::integer, count(*) FILTER (WHERE l.status <> 'published')::integer
  INTO v_lessons_after, v_lessons_unpublished FROM public.lessons l
  JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE t.status <> 'published')::integer
  INTO v_topics_after, v_topics_unpublished FROM public.topics t
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE s.status <> 'published')::integer
  INTO v_sagas_after, v_sagas_unpublished FROM public.sagas s
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE a.status <> 'published')::integer
  INTO v_adventures_after, v_adventures_unpublished FROM public.adventures a WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, max(d.updated_at) INTO v_documents_after, v_last_document_update_after
  FROM public.lesson_documents d JOIN public.lessons l ON l.id = d.lesson_id
  JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, max(p.activated_at) INTO v_v2_pointers_after, v_last_v2_activation_after
  FROM public.lesson_document_version_current p JOIN public.lessons l ON l.id = p.lesson_id
  JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;

  IF v_lessons_after <> v_lessons OR v_lessons_unpublished > 0
     OR v_topics_after <> v_topics OR v_topics_unpublished > 0
     OR v_sagas_after <> v_sagas OR v_sagas_unpublished > 0
     OR v_adventures_after <> v_adventures OR v_adventures_unpublished > 0
     OR v_documents_after <> v_documents
     OR v_last_document_update_after IS DISTINCT FROM v_last_document_update
     OR v_v2_pointers_after <> v_v2_pointers
     OR v_last_v2_activation_after IS DISTINCT FROM v_last_v2_activation THEN
    RAISE EXCEPTION 'release_course: concurrent content change detected for course % (adventures %/%, sagas %/%, topics %/%, lessons %/%, documents %/%); release rolled back',
      p_course_id, v_adventures_after, v_adventures, v_sagas_after, v_sagas,
      v_topics_after, v_topics, v_lessons_after, v_lessons, v_documents_after, v_documents;
  END IF;

  UPDATE public.courses SET status = 'published' WHERE id = p_course_id;
  IF v_course_status <> 'published' OR adventures_published + sagas_published + topics_published + lessons_published > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.course.release', p_course_id::text, jsonb_build_object(
      'adventuresPublished', adventures_published, 'sagasPublished', sagas_published,
      'topicsPublished', topics_published, 'lessonsPublished', lessons_published));
  END IF;
  RETURN QUERY SELECT true, 'RELEASED', 'Course hierarchy released.', adventures_published, sagas_published, topics_published, lessons_published;
END;
$$;

REVOKE ALL ON FUNCTION public.release_course(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_course(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_lesson(p_actor uuid, p_lesson_id uuid)
RETURNS TABLE (ok boolean, code text, message text, lessons_published integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_course_id uuid;
  v_course_status text;
  v_lesson_status text;
  v_parents_live boolean;
  v_locales integer := 0;
  v_refusal_code text;
  v_refusal_message text;
BEGIN
  IF NOT public.content_release_actor_allowed(p_actor) THEN
    RETURN QUERY SELECT false, 'FORBIDDEN', 'Only staff with the content permission may release a lesson.', 0;
    RETURN;
  END IF;
  SELECT a.course_id INTO v_course_id FROM public.lessons l
  JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
  JOIN public.adventures a ON a.id = s.adventure_id WHERE l.id = p_lesson_id;
  IF v_course_id IS NULL THEN
    RETURN QUERY SELECT false, 'NOT_FOUND', 'Lesson does not exist.', 0;
    RETURN;
  END IF;

  -- Preserve the course-first lock order used by release_course.
  SELECT c.status INTO v_course_status FROM public.courses c WHERE c.id = v_course_id FOR UPDATE;
  SELECT l.status INTO v_lesson_status FROM public.lessons l WHERE l.id = p_lesson_id FOR UPDATE;
  PERFORM 1 FROM public.lesson_documents d WHERE d.lesson_id = p_lesson_id FOR UPDATE;
  PERFORM 1 FROM public.lesson_document_version_current p WHERE p.lesson_id = p_lesson_id FOR UPDATE;

  IF v_course_status = 'archived' THEN
    RETURN QUERY SELECT false, 'ARCHIVED', 'An archived course must be restored to draft before release.', 0;
    RETURN;
  END IF;
  IF v_lesson_status = 'published' THEN
    RETURN QUERY SELECT true, 'RELEASED', 'Lesson is already published.', 0;
    RETURN;
  END IF;
  IF v_lesson_status <> 'review' THEN
    RETURN QUERY SELECT false, 'LESSONS_NOT_REVIEWABLE', 'The lesson must be in review before release.', 0;
    RETURN;
  END IF;

  SELECT c.status = 'published' AND a.status = 'published' AND s.status = 'published' AND t.status = 'published'
  INTO v_parents_live FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  JOIN public.courses c ON c.id = a.course_id WHERE l.id = p_lesson_id;
  IF NOT coalesce(v_parents_live, false) THEN
    RETURN QUERY SELECT false, 'COURSE_RELEASE_REQUIRED',
      'This lesson''s course or section is not live yet. Release the whole course instead.', 0;
    RETURN;
  END IF;

  v_locales := public.lesson_effective_locale_count(p_lesson_id);
  IF v_locales <> 3 THEN
    RETURN QUERY SELECT false, 'INCOMPLETE_LOCALES', 'The lesson needs en-US, es-MX, and pt-BR as a current v2 version or a v1 fallback before release.', 0;
    RETURN;
  END IF;

  SELECT r.code, r.message INTO v_refusal_code, v_refusal_message
  FROM public.forge_release_verification_refusal(v_course_id) AS r;
  IF v_refusal_code IS NOT NULL THEN
    RETURN QUERY SELECT false, v_refusal_code, v_refusal_message, 0;
    RETURN;
  END IF;

  UPDATE public.lessons l SET status = 'published'
  WHERE l.id = p_lesson_id AND l.status = 'review';
  GET DIAGNOSTICS lessons_published = ROW_COUNT;
  IF lessons_published <> 1 THEN
    RAISE EXCEPTION 'release_lesson: lesson % changed concurrently; release rolled back', p_lesson_id;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, subject, detail)
  VALUES (p_actor, 'admin.lesson.release', p_lesson_id::text, jsonb_build_object('lessonsPublished', lessons_published));
  RETURN QUERY SELECT true, 'RELEASED', 'Lesson released.', lessons_published;
END;
$$;

REVOKE ALL ON FUNCTION public.release_lesson(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_lesson(uuid, uuid) TO service_role;

-- Latest release migration re-issues the unchanged bypass guards so the
-- static contract pins the production definitions, not a historical file.
DROP TRIGGER IF EXISTS lessons_release_only_publication ON public.lessons;
CREATE TRIGGER lessons_release_only_publication
  BEFORE INSERT OR UPDATE OF status ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.guard_release_only_publication();
DROP TRIGGER IF EXISTS courses_release_only_publication ON public.courses;
CREATE TRIGGER courses_release_only_publication
  BEFORE INSERT OR UPDATE OF status ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.guard_release_only_publication();
DROP TRIGGER IF EXISTS lesson_document_version_current_live_guard ON public.lesson_document_version_current;
CREATE TRIGGER lesson_document_version_current_live_guard
  BEFORE INSERT OR UPDATE ON public.lesson_document_version_current
  FOR EACH ROW EXECUTE FUNCTION public.guard_live_v2_activation();

SELECT 'migration_v2_effective_locale_release_ok' AS sentinel;
