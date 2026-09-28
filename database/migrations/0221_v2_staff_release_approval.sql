-- v2_staff_release_approval — a new v2 version of an already-published lesson
-- goes live only on a human staff approval (Product G.2 and its non-negotiable
-- constraint; Block G opening, 02 J2; Appendix N 2.3(a)).
-- @phase: contract
-- @after-release: the Core release of GAP-FIX-R2 staff-ops (the staff route
--   POST /admin/content/lessons/:lessonId/versions/:versionId/release and the
--   pending list on the rebuilt Content page). Applied earlier, a Forge v2
--   publication on a published lesson would queue with no screen to approve it.
--
-- Before: publish_v2_lesson_version (0209), executable by the service role
-- (Forge's credential), moved lesson_document_version_current of a PUBLISHED
-- lesson at once, so a new document was child-visible with no staff approval,
-- no staff actor and no justification.
--
-- Now:
--   1. publish_v2_lesson_version keeps every check it had (identity, the
--      manifest's gates, read from forge_v2_manifest_gates as 0217 made them,
--      the course verification) and still inserts the
--      immutable lesson_document_versions row. For a lesson whose status is
--      'published' it no longer moves the pointer: it records a pending
--      lesson_version_activation_requests row (one pending per lesson and
--      locale; an older pending one is superseded) and audits
--      'forge.v2_lesson_version_submitted'. A lesson that is not published is
--      unchanged: its pointer moves, and the lesson itself still reaches
--      learners only through the staff release (release_lesson, 0113).
--   2. release_lesson_version(p_actor, lesson, version) is the staff approval:
--      the actor must be a superadmin or an admin holding manage_content; it
--      re-runs forge_release_verification_refusal for the course, moves the
--      pointer with activated_by = the actor, closes the request and writes an
--      audit_logs row with the staff actor_id. reject_lesson_version records a
--      refusal (reason 10-600 characters), also audited.
--   3. emergency_activate_lesson_version is the one retained bypass of the
--      course verification (G.2's alternative): the actor must hold the
--      superadmin role and a justification of 20-600 characters is mandatory;
--      both are stored in the audit row 'content.v2_emergency_activation',
--      which the retroactive release check (next migration) must close
--      within 30 days. The version must still carry its Forge manifest.
-- All three are service-role only; Core passes the verified staff actor.

CREATE TABLE IF NOT EXISTS public.lesson_version_activation_requests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    locale              text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    document_version_id uuid NOT NULL,
    version_id          text NOT NULL,
    document_sha256     text NOT NULL,
    manifest_sha256     text NOT NULL,
    run_id              text,
    status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'rejected', 'superseded')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    decided_at          timestamptz,
    decided_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    decision_note       text CHECK (decision_note IS NULL OR length(btrim(decision_note)) BETWEEN 10 AND 600),
    CONSTRAINT lesson_version_activation_requests_version_fkey
        FOREIGN KEY (document_version_id, lesson_id, locale)
        REFERENCES public.lesson_document_versions (id, lesson_id, locale) ON DELETE RESTRICT,
    CONSTRAINT lesson_version_activation_requests_decided CHECK ((status = 'pending') = (decided_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_version_activation_requests_one_pending
    ON public.lesson_version_activation_requests (lesson_id, locale) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS lesson_version_activation_requests_status
    ON public.lesson_version_activation_requests (status, created_at DESC);

-- No browser policy: the queue is read by Core's staff route with the service role.
ALTER TABLE public.lesson_version_activation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_version_activation_requests FROM anon, authenticated;
GRANT SELECT ON public.lesson_version_activation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.content_release_actor_allowed(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT p_actor IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'superadmin')
        OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin')
            AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = p_actor AND permission = 'manage_content')))
$$;
REVOKE ALL ON FUNCTION public.content_release_actor_allowed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_release_actor_allowed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_v2_lesson_version(
    p_lesson_id uuid,
    p_locale text,
    p_version_id text,
    p_document jsonb,
    p_answer_keys jsonb,
    p_release_manifest jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lesson public.lessons%ROWTYPE;
    v_course uuid;
    v_version uuid;
    v_missing integer;
    v_failed integer;
    v_refusal text;
    v_document_digest text;
    v_keys_digest text;
    v_request uuid;
BEGIN
    IF p_lesson_id IS NULL OR p_locale NOT IN ('en-US', 'es-MX', 'pt-BR') OR p_version_id IS NULL
       OR p_version_id !~ '^[a-z0-9][a-z0-9._:-]{2,100}$'
       OR p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
       OR p_answer_keys IS NULL OR jsonb_typeof(p_answer_keys) <> 'object'
       OR p_release_manifest IS NULL OR jsonb_typeof(p_release_manifest) <> 'object' THEN
        RAISE EXCEPTION 'Invalid v2 publication input' USING ERRCODE = '22023';
    END IF;
    IF p_document->>'schema_version' IS DISTINCT FROM '2' OR p_document->>'lesson_id' IS DISTINCT FROM p_lesson_id::text
       OR p_document->>'locale' IS DISTINCT FROM p_locale OR p_document->>'version_id' IS DISTINCT FROM p_version_id THEN
        RAISE EXCEPTION 'The v2 document does not match its publication identity' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_lesson FROM public.lessons WHERE id = p_lesson_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown lesson' USING ERRCODE = '22023';
    END IF;
    SELECT a.course_id INTO v_course
    FROM public.topics t JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE t.id = v_lesson.topic_id;

    IF p_release_manifest->>'lesson_id' IS DISTINCT FROM p_lesson_id::text OR p_release_manifest->>'locale' IS DISTINCT FROM p_locale
       OR p_release_manifest->>'version_id' IS DISTINCT FROM p_version_id
       OR (p_release_manifest->'core_contract') IS DISTINCT FROM 'true'::jsonb
       OR (p_release_manifest->'interactive_behaviour') IS DISTINCT FROM 'true'::jsonb
       OR jsonb_typeof(p_release_manifest->'checks') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'The release manifest does not attest this v2 document' USING ERRCODE = '22023';
    END IF;
    SELECT count(*)::integer INTO v_failed
    FROM jsonb_array_elements(p_release_manifest->'checks') AS e(item)
    WHERE jsonb_typeof(e.item) <> 'object' OR (e.item -> 'ok') IS DISTINCT FROM 'true'::jsonb;
    SELECT count(*)::integer INTO v_missing
    FROM public.forge_release_gates r
    WHERE r.gate_id IN (SELECT m.gate_id FROM public.forge_v2_manifest_gates m)
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_release_manifest->'checks') AS e(item)
        WHERE e.item->>'gate' = r.gate_id AND (e.item -> 'ok') = 'true'::jsonb);
    IF v_failed > 0 OR v_missing > 0 THEN
        RAISE EXCEPTION 'The release manifest is missing % gate(s) or carries % failed check(s)', v_missing, v_failed USING ERRCODE = '22023';
    END IF;

    IF v_lesson.status = 'published' AND v_course IS NOT NULL THEN
        SELECT r.code INTO v_refusal FROM public.forge_release_verification_refusal(v_course) AS r LIMIT 1;
        IF v_refusal IS NOT NULL THEN
            RAISE EXCEPTION 'Course verification refused the publication: %', v_refusal USING ERRCODE = '22023';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM public.lesson_document_versions
               WHERE lesson_id = p_lesson_id AND locale = p_locale AND version_id = p_version_id) THEN
        RAISE EXCEPTION 'This v2 version id is already published; versions are immutable' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.lesson_document_versions (lesson_id, locale, version_id, schema_version, document, answer_keys)
    VALUES (p_lesson_id, p_locale, p_version_id, 2, p_document, p_answer_keys)
    RETURNING id INTO v_version;
    v_document_digest := encode(sha256(convert_to(p_document::text, 'UTF8')), 'hex');
    v_keys_digest := encode(sha256(convert_to(p_answer_keys::text, 'UTF8')), 'hex');

    IF v_lesson.status = 'published' THEN
        -- G.2: a live lesson's new content waits for a human staff approval.
        UPDATE public.lesson_version_activation_requests
        SET status = 'superseded', decided_at = now()
        WHERE lesson_id = p_lesson_id AND locale = p_locale AND status = 'pending';
        INSERT INTO public.lesson_version_activation_requests
            (lesson_id, locale, document_version_id, version_id, document_sha256, manifest_sha256, run_id)
        VALUES (p_lesson_id, p_locale, v_version, p_version_id, v_document_digest,
                encode(sha256(convert_to(p_release_manifest::text, 'UTF8')), 'hex'), p_release_manifest->>'run_id')
        RETURNING id INTO v_request;
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'forge.v2_lesson_version_submitted', p_lesson_id::text, jsonb_build_object(
            'locale', p_locale, 'version_id', p_version_id, 'document_version_id', v_version, 'request_id', v_request,
            'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest, 'run_id', p_release_manifest->>'run_id'));
        RETURN jsonb_build_object('document_version_id', v_version, 'version_id', p_version_id, 'locale', p_locale,
            'document_sha256', v_document_digest, 'activation', 'pending_staff_approval', 'request_id', v_request);
    END IF;

    INSERT INTO public.lesson_document_version_current (lesson_id, locale, document_version_id, activated_at)
    VALUES (p_lesson_id, p_locale, v_version, now())
    ON CONFLICT (lesson_id, locale) DO UPDATE SET document_version_id = EXCLUDED.document_version_id, activated_at = EXCLUDED.activated_at;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'forge.v2_lesson_published', p_lesson_id::text, jsonb_build_object(
        'locale', p_locale, 'version_id', p_version_id, 'document_version_id', v_version,
        'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest,
        'lesson_status', v_lesson.status, 'run_id', p_release_manifest->>'run_id'));
    RETURN jsonb_build_object('document_version_id', v_version, 'version_id', p_version_id, 'locale', p_locale,
        'document_sha256', v_document_digest, 'activation', 'activated');
END;
$$;
REVOKE ALL ON FUNCTION public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;

-- The pending request of this version, locked, with its lesson's course. Shared by the three decisions.
CREATE OR REPLACE FUNCTION public.lesson_version_request_for_decision(p_lesson_id uuid, p_document_version_id uuid)
RETURNS TABLE (request_id uuid, locale text, version_id text, document_sha256 text, lesson_status text, course_id uuid, request_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM 1 FROM public.lessons WHERE id = p_lesson_id FOR UPDATE;
    RETURN QUERY
    SELECT r.id, r.locale, r.version_id, r.document_sha256, l.status, a.course_id, r.status
    FROM public.lesson_version_activation_requests r
    JOIN public.lessons l ON l.id = r.lesson_id
    LEFT JOIN public.topics t ON t.id = l.topic_id
    LEFT JOIN public.sagas s ON s.id = t.saga_id
    LEFT JOIN public.adventures a ON a.id = s.adventure_id
    WHERE r.lesson_id = p_lesson_id AND r.document_version_id = p_document_version_id
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC
    LIMIT 1
    FOR UPDATE OF r;
END;
$$;
REVOKE ALL ON FUNCTION public.lesson_version_request_for_decision(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_lesson_version_request(p_request_id uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v public.lesson_version_activation_requests%ROWTYPE;
BEGIN
    SELECT * INTO v FROM public.lesson_version_activation_requests WHERE id = p_request_id;
    INSERT INTO public.lesson_document_version_current (lesson_id, locale, document_version_id, activated_at, activated_by)
    VALUES (v.lesson_id, v.locale, v.document_version_id, now(), p_actor)
    ON CONFLICT (lesson_id, locale) DO UPDATE
        SET document_version_id = EXCLUDED.document_version_id, activated_at = EXCLUDED.activated_at, activated_by = EXCLUDED.activated_by;
    UPDATE public.lesson_version_activation_requests
    SET status = 'released', decided_at = now(), decided_by = p_actor
    WHERE id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_lesson_version_request(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The staff approval (Core: POST /admin/content/lessons/:lessonId/versions/:versionId/release).
CREATE OR REPLACE FUNCTION public.release_lesson_version(p_actor uuid, p_lesson_id uuid, p_document_version_id uuid)
RETURNS TABLE (ok boolean, code text, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v record;
    v_refusal record;
BEGIN
    IF NOT public.content_release_actor_allowed(p_actor) THEN
        RETURN QUERY SELECT false, 'FORBIDDEN'::text, 'Only staff with the content permission may release a lesson version.'::text;
        RETURN;
    END IF;
    SELECT * INTO v FROM public.lesson_version_request_for_decision(p_lesson_id, p_document_version_id);
    IF v.request_id IS NULL THEN
        RETURN QUERY SELECT false, 'NOT_FOUND'::text, 'No release request for this lesson version.'::text;
        RETURN;
    END IF;
    IF v.request_status <> 'pending' THEN
        RETURN QUERY SELECT false, 'NOT_PENDING'::text, format('This version was already %s.', v.request_status);
        RETURN;
    END IF;
    IF v.course_id IS NOT NULL THEN
        SELECT r.code, r.message INTO v_refusal FROM public.forge_release_verification_refusal(v.course_id) AS r LIMIT 1;
        IF v_refusal.code IS NOT NULL THEN
            RETURN QUERY SELECT false, v_refusal.code, v_refusal.message;
            RETURN;
        END IF;
    END IF;
    PERFORM public.activate_lesson_version_request(v.request_id, p_actor);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'content.v2_version_released', p_lesson_id::text, jsonb_build_object(
        'locale', v.locale, 'version_id', v.version_id, 'document_version_id', p_document_version_id,
        'request_id', v.request_id, 'document_sha256', v.document_sha256, 'lesson_status', v.lesson_status));
    RETURN QUERY SELECT true, 'RELEASED'::text, 'The version is live.'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.release_lesson_version(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_lesson_version(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_lesson_version(p_actor uuid, p_lesson_id uuid, p_document_version_id uuid, p_reason text)
RETURNS TABLE (ok boolean, code text, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v record;
BEGIN
    IF NOT public.content_release_actor_allowed(p_actor) THEN
        RETURN QUERY SELECT false, 'FORBIDDEN'::text, 'Only staff with the content permission may reject a lesson version.'::text;
        RETURN;
    END IF;
    IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 600 THEN
        RETURN QUERY SELECT false, 'INVALID_REASON'::text, 'A reason of 10-600 characters is required.'::text;
        RETURN;
    END IF;
    SELECT * INTO v FROM public.lesson_version_request_for_decision(p_lesson_id, p_document_version_id);
    IF v.request_id IS NULL THEN
        RETURN QUERY SELECT false, 'NOT_FOUND'::text, 'No release request for this lesson version.'::text;
        RETURN;
    END IF;
    IF v.request_status <> 'pending' THEN
        RETURN QUERY SELECT false, 'NOT_PENDING'::text, format('This version was already %s.', v.request_status);
        RETURN;
    END IF;
    UPDATE public.lesson_version_activation_requests
    SET status = 'rejected', decided_at = now(), decided_by = p_actor, decision_note = btrim(p_reason)
    WHERE id = v.request_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'content.v2_version_rejected', p_lesson_id::text, jsonb_build_object(
        'locale', v.locale, 'version_id', v.version_id, 'document_version_id', p_document_version_id, 'request_id', v.request_id));
    RETURN QUERY SELECT true, 'REJECTED'::text, 'The version stays off.'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_lesson_version(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_lesson_version(uuid, uuid, uuid, text) TO service_role;

-- G.2's one retained bypass: Superadmin only, with a mandatory logged justification.
CREATE OR REPLACE FUNCTION public.emergency_activate_lesson_version(
    p_actor uuid, p_lesson_id uuid, p_document_version_id uuid, p_justification text)
RETURNS TABLE (ok boolean, code text, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v record;
BEGIN
    IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'superadmin') THEN
        RETURN QUERY SELECT false, 'FORBIDDEN'::text, 'The emergency activation is reserved to a Superadmin.'::text;
        RETURN;
    END IF;
    IF p_justification IS NULL OR length(btrim(p_justification)) NOT BETWEEN 20 AND 600 THEN
        RETURN QUERY SELECT false, 'JUSTIFICATION_REQUIRED'::text, 'A justification of 20-600 characters is mandatory.'::text;
        RETURN;
    END IF;
    SELECT * INTO v FROM public.lesson_version_request_for_decision(p_lesson_id, p_document_version_id);
    IF v.request_id IS NULL OR v.request_status <> 'pending' THEN
        RETURN QUERY SELECT false, 'NOT_PENDING'::text, 'Only a pending, Forge-attested version can be activated.'::text;
        RETURN;
    END IF;
    PERFORM public.activate_lesson_version_request(v.request_id, p_actor);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'content.v2_emergency_activation', p_lesson_id::text, jsonb_build_object(
        'locale', v.locale, 'version_id', v.version_id, 'document_version_id', p_document_version_id,
        'request_id', v.request_id, 'justification', btrim(p_justification), 'lesson_status', v.lesson_status));
    RETURN QUERY SELECT true, 'ACTIVATED'::text, 'Activated without the course verification; the retroactive check is due in 30 days.'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.emergency_activate_lesson_version(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emergency_activate_lesson_version(uuid, uuid, uuid, text) TO service_role;
