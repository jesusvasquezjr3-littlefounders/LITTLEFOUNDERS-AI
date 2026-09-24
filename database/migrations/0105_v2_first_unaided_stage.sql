-- @phase: expand
-- S05 M1: server-owned diagnostic for the first unaided successful stage in
-- a concrete -> pictorial -> abstract sequence. It is not progress or XP.

CREATE TABLE IF NOT EXISTS public.lesson_v2_first_unaided_stages (
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_version_id uuid NOT NULL REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    fading_group_id     text NOT NULL CHECK (fading_group_id ~ '^[a-z0-9][a-z0-9._:-]{2,100}$'),
    stage               text NOT NULL CHECK (stage IN ('concrete', 'pictorial', 'abstract')),
    receipt_jti         text NOT NULL REFERENCES public.lesson_v2_grade_receipts(jti) ON DELETE RESTRICT,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, document_version_id, fading_group_id),
    UNIQUE (receipt_jti)
);

ALTER TABLE public.lesson_v2_first_unaided_stages ENABLE ROW LEVEL SECURITY;
-- Core-only diagnostic data. There is deliberately no browser policy.

CREATE OR REPLACE FUNCTION public.record_v2_first_unaided_stage(
    p_user_id uuid,
    p_document_version_id uuid,
    p_fading_group_id text,
    p_stage text,
    p_receipt_jti text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    receipt public.lesson_v2_grade_receipts%ROWTYPE;
BEGIN
    IF p_user_id IS NULL OR p_document_version_id IS NULL OR p_fading_group_id IS NULL
       OR p_fading_group_id !~ '^[a-z0-9][a-z0-9._:-]{2,100}$'
       OR p_stage NOT IN ('concrete', 'pictorial', 'abstract') OR p_receipt_jti IS NULL THEN
        RAISE EXCEPTION 'Invalid first unaided stage input' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO receipt FROM public.lesson_v2_grade_receipts WHERE jti = p_receipt_jti;
    IF NOT FOUND OR receipt.user_id <> p_user_id OR receipt.document_version_id <> p_document_version_id
       OR receipt.verdict->>'correct' <> 'true' OR receipt.verdict->>'score' <> '100' THEN
        RAISE EXCEPTION 'First unaided stage requires a met immutable receipt' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.lesson_v2_first_unaided_stages(user_id, document_version_id, fading_group_id, stage, receipt_jti)
    VALUES (p_user_id, p_document_version_id, p_fading_group_id, p_stage, p_receipt_jti)
    ON CONFLICT (user_id, document_version_id, fading_group_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_v2_first_unaided_stage(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_first_unaided_stage(uuid, uuid, text, text, text) TO service_role;
