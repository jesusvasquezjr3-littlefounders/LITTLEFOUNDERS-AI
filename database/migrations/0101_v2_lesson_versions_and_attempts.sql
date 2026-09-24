-- @phase: expand
-- S05.2: additive storage for immutable v2 lesson versions and version-pinned runs.
-- No legacy lesson_documents row is copied here. A future reviewed publication
-- transaction creates a v2 version and moves the current pointer together.

CREATE TABLE IF NOT EXISTS public.lesson_document_versions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       uuid NOT NULL REFERENCES public.lessons(id) ON DELETE RESTRICT,
    locale          text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    version_id      text NOT NULL CHECK (version_id ~ '^[a-z0-9][a-z0-9._:-]{2,100}$'),
    schema_version  integer NOT NULL CHECK (schema_version = 2),
    document        jsonb NOT NULL,
    answer_keys     jsonb NOT NULL DEFAULT '{}'::jsonb,
    audio           jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT lesson_document_versions_lesson_locale_version_unique UNIQUE (lesson_id, locale, version_id),
    CONSTRAINT lesson_document_versions_identity_unique UNIQUE (id, lesson_id, locale)
);

ALTER TABLE public.lesson_document_versions ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policy: v2 answer keys stay server-only.

CREATE OR REPLACE FUNCTION public.reject_lesson_document_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'lesson document versions are immutable';
END;
$$;

DROP TRIGGER IF EXISTS lesson_document_versions_immutable ON public.lesson_document_versions;
CREATE TRIGGER lesson_document_versions_immutable
    BEFORE UPDATE OR DELETE ON public.lesson_document_versions
    FOR EACH ROW EXECUTE FUNCTION public.reject_lesson_document_version_mutation();

CREATE TABLE IF NOT EXISTS public.lesson_document_version_current (
    lesson_id             uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    locale                text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    document_version_id   uuid NOT NULL REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    activated_at          timestamptz NOT NULL DEFAULT now(),
    activated_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (lesson_id, locale),
    CONSTRAINT lesson_document_version_current_identity_fkey
        FOREIGN KEY (document_version_id, lesson_id, locale)
        REFERENCES public.lesson_document_versions (id, lesson_id, locale)
);

ALTER TABLE public.lesson_document_version_current ENABLE ROW LEVEL SECURITY;
-- Core resolves the pointer with the service role; no browser policy exists.

CREATE TABLE IF NOT EXISTS public.lesson_v2_runs (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id             uuid NOT NULL REFERENCES public.lessons(id) ON DELETE RESTRICT,
    locale                text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    document_version_id   uuid NOT NULL REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    started_at            timestamptz NOT NULL DEFAULT now(),
    expires_at            timestamptz NOT NULL,
    completed_at          timestamptz,
    CHECK (expires_at > started_at),
    CONSTRAINT lesson_v2_runs_version_identity_fkey
        FOREIGN KEY (document_version_id, lesson_id, locale)
        REFERENCES public.lesson_document_versions (id, lesson_id, locale)
);

CREATE INDEX IF NOT EXISTS lesson_v2_runs_user_lesson_open_idx
    ON public.lesson_v2_runs (user_id, lesson_id, started_at DESC)
    WHERE completed_at IS NULL;
ALTER TABLE public.lesson_v2_runs ENABLE ROW LEVEL SECURITY;
-- Run rows are written and read through Core's authenticated, version-aware API.

CREATE TABLE IF NOT EXISTS public.lesson_v2_attempt_nonces (
    jti                   text PRIMARY KEY CHECK (jti ~ '^[A-Za-z0-9_-]{20,}$'),
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id                uuid NOT NULL REFERENCES public.lesson_v2_runs(id) ON DELETE CASCADE,
    document_version_id   uuid NOT NULL REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    segment_id            text NOT NULL CHECK (length(segment_id) BETWEEN 1 AND 101),
    expires_at            timestamptz NOT NULL,
    consumed_at           timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS lesson_v2_attempt_nonces_run_segment_idx
    ON public.lesson_v2_attempt_nonces (run_id, segment_id)
    WHERE consumed_at IS NULL;
ALTER TABLE public.lesson_v2_attempt_nonces ENABLE ROW LEVEL SECURITY;
-- The future service-role RPC consumes this nonce with the authoritative grade.

CREATE TABLE IF NOT EXISTS public.lesson_v2_grade_receipts (
    jti                   text PRIMARY KEY REFERENCES public.lesson_v2_attempt_nonces(jti) ON DELETE RESTRICT,
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id                uuid NOT NULL REFERENCES public.lesson_v2_runs(id) ON DELETE CASCADE,
    document_version_id   uuid NOT NULL REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    segment_id            text NOT NULL CHECK (length(segment_id) BETWEEN 1 AND 101),
    verdict               jsonb NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lesson_v2_grade_receipts ENABLE ROW LEVEL SECURITY;
-- Receipts contain pedagogical feedback and remain Core-only until a separate
-- authenticated read contract deliberately exposes a client-safe projection.

CREATE OR REPLACE FUNCTION public.record_v2_lesson_grade(
    p_user_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_segment_id text,
    p_jti text,
    p_verdict jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    nonce public.lesson_v2_attempt_nonces%ROWTYPE;
    run public.lesson_v2_runs%ROWTYPE;
    score_text text;
    correct boolean;
BEGIN
    IF p_user_id IS NULL OR p_run_id IS NULL OR p_document_version_id IS NULL
       OR p_segment_id IS NULL OR length(p_segment_id) = 0 OR p_jti IS NULL
       OR p_verdict IS NULL OR jsonb_typeof(p_verdict->'score') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_verdict->'correct') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Invalid v2 grade parameters' USING ERRCODE = '22023';
    END IF;

    score_text := p_verdict->>'score';
    correct := (p_verdict->>'correct')::boolean;
    IF score_text !~ '^(0|[1-9][0-9]?|100)$'
       OR correct IS DISTINCT FROM (score_text = '100') THEN
        RAISE EXCEPTION 'Invalid v2 grade verdict' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO nonce FROM public.lesson_v2_attempt_nonces
    WHERE jti = p_jti FOR UPDATE;
    IF NOT FOUND OR nonce.user_id <> p_user_id OR nonce.run_id <> p_run_id
       OR nonce.document_version_id <> p_document_version_id OR nonce.segment_id <> p_segment_id
       OR nonce.expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid or expired v2 attempt token' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR run.user_id <> p_user_id OR run.document_version_id <> p_document_version_id
       OR run.expires_at <= now() OR run.completed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Inactive v2 lesson run' USING ERRCODE = '22023';
    END IF;

    IF nonce.consumed_at IS NOT NULL THEN
        SELECT verdict INTO p_verdict FROM public.lesson_v2_grade_receipts WHERE jti = p_jti;
        IF FOUND THEN RETURN jsonb_build_object('replayed', true, 'verdict', p_verdict); END IF;
        RAISE EXCEPTION 'Consumed v2 attempt nonce without receipt' USING ERRCODE = '22023';
    END IF;

    UPDATE public.lesson_v2_attempt_nonces SET consumed_at = now() WHERE jti = p_jti;
    INSERT INTO public.lesson_v2_grade_receipts(jti, user_id, run_id, document_version_id, segment_id, verdict)
    VALUES (p_jti, p_user_id, p_run_id, p_document_version_id, p_segment_id, p_verdict);
    RETURN jsonb_build_object('replayed', false, 'verdict', p_verdict);
END;
$$;
REVOKE ALL ON FUNCTION public.record_v2_lesson_grade(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_lesson_grade(uuid, uuid, uuid, text, text, jsonb) TO service_role;
