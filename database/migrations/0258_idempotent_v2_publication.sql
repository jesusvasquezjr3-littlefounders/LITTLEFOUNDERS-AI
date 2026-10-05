-- idempotent_v2_publication — make immutable v2 publication retries safe.
-- @phase: expand
--
-- The version identity is idempotent only when its document and answer-key
-- digests match. A retry changes no pointer, request, or audit row.

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
    v_existing_document jsonb;
    v_existing_keys jsonb;
    v_missing integer;
    v_failed integer;
    v_refusal text;
    v_document_digest text;
    v_keys_digest text;
    v_existing_document_digest text;
    v_existing_keys_digest text;
    v_request uuid;
    v_request_status text;
    v_is_current boolean := false;
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
    SELECT a.course_id INTO v_course FROM public.topics t
    JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE t.id = v_lesson.topic_id;

    IF p_release_manifest->>'lesson_id' IS DISTINCT FROM p_lesson_id::text
       OR p_release_manifest->>'locale' IS DISTINCT FROM p_locale
       OR p_release_manifest->>'version_id' IS DISTINCT FROM p_version_id
       OR (p_release_manifest->'core_contract') IS DISTINCT FROM 'true'::jsonb
       OR (p_release_manifest->'interactive_behaviour') IS DISTINCT FROM 'true'::jsonb
       OR jsonb_typeof(p_release_manifest->'checks') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'The release manifest does not attest this v2 document' USING ERRCODE = '22023';
    END IF;
    SELECT count(*)::integer INTO v_failed FROM jsonb_array_elements(p_release_manifest->'checks') AS e(item)
    WHERE jsonb_typeof(e.item) <> 'object' OR (e.item -> 'ok') IS DISTINCT FROM 'true'::jsonb;
    SELECT count(*)::integer INTO v_missing FROM public.forge_release_gates r
    WHERE r.gate_id IN (SELECT m.gate_id FROM public.forge_v2_manifest_gates m)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_release_manifest->'checks') AS e(item)
                      WHERE e.item->>'gate' = r.gate_id AND (e.item -> 'ok') = 'true'::jsonb);
    IF v_failed > 0 OR v_missing > 0 THEN
        RAISE EXCEPTION 'The release manifest is missing % gate(s) or carries % failed check(s)', v_missing, v_failed USING ERRCODE = '22023';
    END IF;

    v_document_digest := encode(sha256(convert_to(p_document::text, 'UTF8')), 'hex');
    v_keys_digest := encode(sha256(convert_to(p_answer_keys::text, 'UTF8')), 'hex');
    SELECT v.id, v.document, v.answer_keys INTO v_version, v_existing_document, v_existing_keys
    FROM public.lesson_document_versions v
    WHERE v.lesson_id = p_lesson_id AND v.locale = p_locale AND v.version_id = p_version_id;

    IF v_version IS NOT NULL THEN
        v_existing_document_digest := encode(sha256(convert_to(v_existing_document::text, 'UTF8')), 'hex');
        v_existing_keys_digest := encode(sha256(convert_to(v_existing_keys::text, 'UTF8')), 'hex');
        IF v_existing_document_digest IS DISTINCT FROM v_document_digest
           OR v_existing_keys_digest IS DISTINCT FROM v_keys_digest THEN
            RAISE EXCEPTION 'This v2 version id already exists with different content digests; versions are immutable'
                USING ERRCODE = '23505';
        END IF;

        SELECT r.id, r.status INTO v_request, v_request_status
        FROM public.lesson_version_activation_requests r
        WHERE r.lesson_id = p_lesson_id AND r.locale = p_locale AND r.document_version_id = v_version
        ORDER BY r.created_at DESC LIMIT 1;
        SELECT EXISTS (SELECT 1 FROM public.lesson_document_version_current p
                       WHERE p.lesson_id = p_lesson_id AND p.locale = p_locale
                         AND p.document_version_id = v_version) INTO v_is_current;
        RETURN jsonb_build_object(
            'document_version_id', v_version, 'version_id', p_version_id, 'locale', p_locale,
            'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest,
            'activation', CASE WHEN v_is_current THEN 'activated'
                               WHEN v_request_status = 'pending' THEN 'pending_staff_approval'
                               ELSE coalesce(v_request_status, 'stored') END,
            'request_id', v_request, 'idempotent', true);
    END IF;

    -- Only a new immutable version changes content, so only it needs the
    -- current course attestation. A byte-identical retry above changes nothing.
    IF v_lesson.status = 'published' AND v_course IS NOT NULL THEN
        SELECT r.code INTO v_refusal FROM public.forge_release_verification_refusal(v_course) AS r LIMIT 1;
        IF v_refusal IS NOT NULL THEN
            RAISE EXCEPTION 'Course verification refused the publication: %', v_refusal USING ERRCODE = '22023';
        END IF;
    END IF;

    INSERT INTO public.lesson_document_versions (lesson_id, locale, version_id, schema_version, document, answer_keys)
    VALUES (p_lesson_id, p_locale, p_version_id, 2, p_document, p_answer_keys)
    RETURNING id INTO v_version;

    IF v_lesson.status = 'published' THEN
        UPDATE public.lesson_version_activation_requests SET status = 'superseded', decided_at = now()
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
            'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest,
            'activation', 'pending_staff_approval', 'request_id', v_request);
    END IF;

    INSERT INTO public.lesson_document_version_current (lesson_id, locale, document_version_id, activated_at)
    VALUES (p_lesson_id, p_locale, v_version, now())
    ON CONFLICT (lesson_id, locale) DO UPDATE
      SET document_version_id = EXCLUDED.document_version_id, activated_at = EXCLUDED.activated_at;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'forge.v2_lesson_published', p_lesson_id::text, jsonb_build_object(
        'locale', p_locale, 'version_id', p_version_id, 'document_version_id', v_version,
        'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest,
        'lesson_status', v_lesson.status, 'run_id', p_release_manifest->>'run_id'));
    RETURN jsonb_build_object('document_version_id', v_version, 'version_id', p_version_id, 'locale', p_locale,
        'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest, 'activation', 'activated');
END;
$$;

REVOKE ALL ON FUNCTION public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;

SELECT 'migration_idempotent_v2_publication_ok' AS sentinel;
