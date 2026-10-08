-- archived_catalog_release — retain historical lessons while releasing a replacement catalog.
-- @phase: expand
-- @after-release: deploy the Forge verifier that pins catalog_fingerprint before releasing a course with archived rows. Existing current-only courses retain the prior verification contract.
-- No content is archived, deleted or published by applying this migration.
-- All rows and both document stores remain locked and counted. Only non-archived
-- rows are candidates; the Stage 3, locale, verification and audit gates remain.

CREATE OR REPLACE FUNCTION public.forge_release_catalog_fingerprint(p_course_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT md5(jsonb_build_object(
    'course', (SELECT (to_jsonb(c) - 'status' - 'updated_at') || jsonb_build_object('archived', c.status = 'archived') FROM public.courses c WHERE c.id = p_course_id),
    'adventures', (SELECT jsonb_agg((to_jsonb(a) - 'status' - 'updated_at') || jsonb_build_object('archived', a.status = 'archived') ORDER BY a.id) FROM public.adventures a WHERE a.course_id = p_course_id),
    'sagas', (SELECT jsonb_agg((to_jsonb(s) - 'status' - 'updated_at') || jsonb_build_object('archived', s.status = 'archived') ORDER BY s.id) FROM public.sagas s JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id),
    'topics', (SELECT jsonb_agg((to_jsonb(t) - 'status' - 'updated_at') || jsonb_build_object('archived', t.status = 'archived') ORDER BY t.id) FROM public.topics t JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id),
    'lessons', (SELECT jsonb_agg((to_jsonb(l) - 'status' - 'updated_at') || jsonb_build_object('archived', l.status = 'archived') ORDER BY l.id) FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id)
  )::text);
$$;
REVOKE ALL ON FUNCTION public.forge_release_catalog_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.forge_release_catalog_fingerprint(uuid) TO service_role;

-- The shared preflight protects individual lessons and live version writes too.
create or replace function public.forge_release_verification_refusal(
  p_course_id uuid
)
returns table (
  code text,
  message text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_last_change timestamptz;
  v_catalog_fingerprint text;
  v_verified_at timestamptz;
  v_watermark timestamptz;
  v_checks jsonb;
  v_missing_gates integer := 0;
  v_failed_checks integer := 0;
begin
  -- The latest document change or v2 activation of the course.
  v_last_change := public.forge_release_content_watermark(p_course_id);

  select v.verified_at, v.checks, v.content_watermark into v_verified_at, v_checks, v_watermark
  from public.course_release_verifications v
  where v.course_id = p_course_id;

  if v_verified_at is null or (v_last_change is not null and v_verified_at < v_last_change) then
    return query select 'VERIFICATION_REQUIRED'::text,
      'Run Forge verify:course successfully after the latest document change before release.'::text;
    return;
  end if;

  -- The attestation covers exactly the content verify:course read: the
  -- watermark it captured before reading must still be the current one. A
  -- change that landed while it was running (or an attestation with no
  -- watermark) needs a new verification.
  if v_watermark is distinct from v_last_change then
    return query select 'VERIFICATION_REQUIRED'::text,
      'The course changed while Forge verify:course was running. Run it again before release.'::text;
    return;
  end if;

  -- S05.4c (Product G.2, Appendix C Stage 2): the attestation must name every
  -- Forge release gate this database requires, each with ok = true, and carry
  -- no failed or malformed entry. An attestation written by a Forge that
  -- predates a gate, or a hand-written row that does not attest every gate,
  -- cannot unlock a release. (A service-role holder who forges a complete
  -- attestation is outside what the database can tell apart; that trust
  -- boundary is the service-role key itself.)
  if v_checks is null or jsonb_typeof(v_checks) <> 'array' then
    v_checks := '[]'::jsonb;
  end if;

  select count(*)::integer into v_failed_checks
  from jsonb_array_elements(v_checks) as e(item)
  where jsonb_typeof(e.item) <> 'object'
     or (e.item -> 'ok') is distinct from 'true'::jsonb;

  select count(*)::integer into v_missing_gates
  from public.forge_release_gates r
  where not exists (
    select 1
    from jsonb_array_elements(v_checks) as e(item)
    where jsonb_typeof(e.item) = 'object'
      and e.item ->> 'gate' = r.gate_id
      and (e.item -> 'ok') = 'true'::jsonb
  );

  if v_failed_checks > 0 or v_missing_gates > 0 then
    return query select 'VERIFICATION_INCOMPLETE'::text,
      format('The Forge verification does not attest every required release gate (%s missing, %s failed). Run the current Forge verify:course again.',
             v_missing_gates, v_failed_checks);
    return;
  end if;
  -- Document timestamps do not change when a lesson is archived or moved.
  -- A mixed current/historical catalog therefore pins the complete hierarchy
  -- read by Forge as well, including the archive boundary and retained rows.
  SELECT item ->> 'catalog_fingerprint' INTO v_catalog_fingerprint
  FROM public.course_release_verifications v CROSS JOIN LATERAL jsonb_array_elements(v.checks) AS item
  WHERE v.course_id = p_course_id AND item ->> 'gate' = 'forge.release.lessons-complete'
  LIMIT 1;
  IF v_catalog_fingerprint IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.adventures a WHERE a.course_id = p_course_id AND a.status = 'archived')
    OR EXISTS (SELECT 1 FROM public.sagas s JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id AND s.status = 'archived')
    OR EXISTS (SELECT 1 FROM public.topics t JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id AND t.status = 'archived')
    OR EXISTS (SELECT 1 FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id AND l.status = 'archived')
  THEN
    IF v_catalog_fingerprint IS DISTINCT FROM public.forge_release_catalog_fingerprint(p_course_id) THEN
      RETURN QUERY SELECT 'VERIFICATION_REQUIRED'::text, 'Reverify the exact active and archived catalog before release.';
      RETURN;
    END IF;
  END IF;

end;
$$;

REVOKE ALL ON FUNCTION public.forge_release_verification_refusal(uuid) FROM PUBLIC, anon, authenticated;

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

  -- Archived ancestors cannot hide active descendants; retired empty branches
  -- must be explicitly archived before verification, never revived by release.
  IF NOT EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
    JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id AND l.status <> 'archived'
  ) OR EXISTS (
    SELECT 1 FROM public.adventures a WHERE a.course_id = p_course_id AND a.status <> 'archived'
      AND NOT EXISTS (SELECT 1 FROM public.sagas s WHERE s.adventure_id = a.id AND s.status <> 'archived')
  ) OR EXISTS (
    SELECT 1 FROM public.sagas s JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id AND s.status <> 'archived' AND (a.status = 'archived'
      OR NOT EXISTS (SELECT 1 FROM public.topics t WHERE t.saga_id = s.id AND t.status <> 'archived'))
  ) OR EXISTS (
    SELECT 1 FROM public.topics t JOIN public.sagas s ON s.id = t.saga_id
    JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id AND t.status <> 'archived' AND (s.status = 'archived'
      OR a.status = 'archived' OR NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id AND l.status <> 'archived'))
  ) OR EXISTS (
    SELECT 1 FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
    JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE a.course_id = p_course_id AND l.status <> 'archived'
      AND (t.status = 'archived' OR s.status = 'archived' OR a.status = 'archived')
  ) THEN
    RETURN QUERY SELECT false, 'INCOMPLETE_HIERARCHY', 'Every active branch needs active children and non-archived ancestors; archive retired empty branches explicitly.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_ineligible_lessons
  FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id AND l.status NOT IN ('review', 'published', 'archived');
  IF v_ineligible_lessons > 0 THEN
    RETURN QUERY SELECT false, 'LESSONS_NOT_REVIEWABLE', 'Every non-archived lesson must be in review or already published before release.', 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_incomplete_locale_lessons
  FROM public.lessons l JOIN public.topics t ON t.id = l.topic_id
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id AND l.status <> 'archived' AND public.lesson_effective_locale_count(l.id) <> 3;
  IF v_incomplete_locale_lessons > 0 THEN
    RETURN QUERY SELECT false, 'INCOMPLETE_LOCALES', 'Every non-archived lesson needs en-US, es-MX, and pt-BR as a current v2 version or a v1 fallback before release.', 0, 0, 0, 0;
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
    AND t.status NOT IN ('published', 'archived')
    AND NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id AND l.status NOT IN ('published', 'archived'));
  GET DIAGNOSTICS topics_published = ROW_COUNT;
  UPDATE public.sagas s SET status = 'published' FROM public.adventures a
  WHERE s.adventure_id = a.id AND a.course_id = p_course_id AND s.status NOT IN ('published', 'archived')
    AND NOT EXISTS (SELECT 1 FROM public.topics t WHERE t.saga_id = s.id AND t.status NOT IN ('published', 'archived'));
  GET DIAGNOSTICS sagas_published = ROW_COUNT;
  UPDATE public.adventures a SET status = 'published'
  WHERE a.course_id = p_course_id AND a.status NOT IN ('published', 'archived')
    AND NOT EXISTS (SELECT 1 FROM public.sagas s WHERE s.adventure_id = a.id AND s.status NOT IN ('published', 'archived'));
  GET DIAGNOSTICS adventures_published = ROW_COUNT;

  SELECT count(*)::integer, count(*) FILTER (WHERE l.status NOT IN ('published', 'archived'))::integer
  INTO v_lessons_after, v_lessons_unpublished FROM public.lessons l
  JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE t.status NOT IN ('published', 'archived'))::integer
  INTO v_topics_after, v_topics_unpublished FROM public.topics t
  JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
  WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE s.status NOT IN ('published', 'archived'))::integer
  INTO v_sagas_after, v_sagas_unpublished FROM public.sagas s
  JOIN public.adventures a ON a.id = s.adventure_id WHERE a.course_id = p_course_id;
  SELECT count(*)::integer, count(*) FILTER (WHERE a.status NOT IN ('published', 'archived'))::integer
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
