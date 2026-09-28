-- v2_manifest_carried_gates — the v2 reviewed publication requires the
-- carried-over Stage 2 gates (GAP-FIX-R2 learning; Appendix C Part 3 Stage 2
-- gates 4, 7 and 8; B.22, B.26, B.27; Product G.2 "no structurally exempt
-- path").
-- @phase: contract
-- @after-release: the Forge release that emits v2 manifests with the carried gates (coursegen src/v2/release.ts V2_MANIFEST_GATES lists forge.gate.02, 03, 04, 17 and 18). An older Forge manifest omits them, so a publication it sends is refused until Forge is updated; no learner-facing path depends on this function.
--
-- 0209's publish_v2_lesson_version required forge_release_gates gate 1, gates
-- 11-16 and the v2 content gate, a list written into the function body. A
-- new-catalog lesson (OD-24) could therefore publish without the
-- reward-mechanic (17), wellbeing-language (18), age-vocabulary (2),
-- currency-fact (3) and arithmetic re-execution (4) gates, which Forge ran
-- only on v1 documents. This file:
--   1. adds public.forge_v2_manifest_gates, the rows naming every gate a v2
--      publication manifest must attest (each a forge_release_gates gate_id;
--      agent/tools/check-forge-release-gate-parity.mjs keeps these rows equal
--      to Forge's V2_MANIFEST_GATES);
--   2. redefines publish_v2_lesson_version identically to 0209 except that
--      the required gates are read from those rows. Same signature, grants,
--      return shape, identity checks, course verification and audit row.
-- RLS is on with no policy: only the SECURITY DEFINER function reads it.

CREATE TABLE IF NOT EXISTS public.forge_v2_manifest_gates (
    gate_id    text PRIMARY KEY REFERENCES public.forge_release_gates (gate_id),
    added_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forge_v2_manifest_gates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forge_v2_manifest_gates FROM PUBLIC, anon, authenticated;

INSERT INTO public.forge_v2_manifest_gates (gate_id) VALUES
    ('forge.gate.01.contract'),
    ('forge.gate.02.age-vocabulary'),
    ('forge.gate.03.currency-facts'),
    ('forge.gate.04.arithmetic'),
    ('forge.gate.11.redundancy'),
    ('forge.gate.12.tone'),
    ('forge.gate.13.copy-budget'),
    ('forge.gate.14.concept-cap'),
    ('forge.gate.15.mentor-misjudgment'),
    ('forge.gate.16.regional-adaptation'),
    ('forge.gate.17.reward-mechanics'),
    ('forge.gate.18.wellbeing-language'),
    ('forge.release.v2-content')
ON CONFLICT (gate_id) DO NOTHING;

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
    WHERE r.gate_id IN (SELECT m.gate_id FROM public.forge_v2_manifest_gates m)
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
