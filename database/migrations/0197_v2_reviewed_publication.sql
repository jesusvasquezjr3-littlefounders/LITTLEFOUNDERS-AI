-- v2_reviewed_publication — the reviewed publication transaction for v2 lesson
-- documents (GAP-FIX-R1 learning; OD-17, OD-23, OD-24; 0101 header; F-06/B.16).
-- @phase: expand
--
-- 0101 promised "a future reviewed publication transaction creates a v2
-- version and moves the current pointer together", and 0113's
-- guard_live_v2_activation refuses any browser or service-role move of the
-- pointer of a published lesson. Nothing wrote a v2 version, so no new-catalog
-- lesson could go live. This is that transaction:
--
--   publish_v2_lesson_version(lesson, locale, version_id, document,
--                             answer_keys, release_manifest)
--
-- It runs as its owner (SECURITY DEFINER), which is the one identity the
-- 0113 guard lets through, and only the service role (Forge's release
-- credential) may execute it. In one transaction it:
--   1. checks the document's identity (schema 2, lesson, locale, version) and
--      that the answer keys are an object;
--   2. requires a release manifest for THIS document: its identity, every
--      Forge gate that runs on a v2 document (forge_release_gates gate 1, the
--      contract, and gates 11-16, plus the v2 content gate; gates 2-9 belong
--      to the v1 writer) with "ok": true and none failed, and Core's contract
--      and interactive-behaviour checks ok;
--   3. for a published lesson, requires the course's Forge verification to be
--      current for its existing content (forge_release_verification_refusal,
--      0112): a publication never rides on a stale attestation. The new
--      activation then moves the watermark, so the next release verifies again;
--   4. inserts the immutable lesson_document_versions row (a version id is
--      never reused) and moves lesson_document_version_current;
--   5. writes an audit row with the document and answer-key digests.
-- A direct pointer move on a published lesson stays refused (0113).

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

    -- The manifest attests THIS document.
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
    WHERE (r.gate_number IN (1, 11, 12, 13, 14, 15, 16) OR r.gate_id = 'forge.release.v2-content')
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_release_manifest->'checks') AS e(item)
        WHERE e.item->>'gate' = r.gate_id AND (e.item -> 'ok') = 'true'::jsonb);
    IF v_failed > 0 OR v_missing > 0 THEN
        RAISE EXCEPTION 'The release manifest is missing % gate(s) or carries % failed check(s)', v_missing, v_failed USING ERRCODE = '22023';
    END IF;

    -- A published lesson's course must be verified for its current content first.
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
    INSERT INTO public.lesson_document_version_current (lesson_id, locale, document_version_id, activated_at)
    VALUES (p_lesson_id, p_locale, v_version, now())
    ON CONFLICT (lesson_id, locale) DO UPDATE SET document_version_id = EXCLUDED.document_version_id, activated_at = EXCLUDED.activated_at;

    v_document_digest := encode(sha256(convert_to(p_document::text, 'UTF8')), 'hex');
    v_keys_digest := encode(sha256(convert_to(p_answer_keys::text, 'UTF8')), 'hex');
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'forge.v2_lesson_published', p_lesson_id::text, jsonb_build_object(
        'locale', p_locale, 'version_id', p_version_id, 'document_version_id', v_version,
        'document_sha256', v_document_digest, 'answer_keys_sha256', v_keys_digest,
        'lesson_status', v_lesson.status, 'run_id', p_release_manifest->>'run_id'));
    RETURN jsonb_build_object('document_version_id', v_version, 'version_id', p_version_id, 'locale', p_locale,
        'document_sha256', v_document_digest);
END;
$$;
REVOKE ALL ON FUNCTION public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb) TO service_role;
