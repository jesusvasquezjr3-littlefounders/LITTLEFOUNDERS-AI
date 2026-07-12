-- 0004_parent_verifications.sql — isolated storage for Guardian parent
-- identity verifications (/AGENTS.md §1.4: universal → parent ONLY through
-- parent-id-check). Idempotent. RLS enabled in this migration.
--
-- Privacy contract (Jesús, 2026-07-12): the ID photograph is NEVER stored —
-- anywhere. Only the applicant-declared data that was matched against the
-- document lands here, and only for VERIFIED outcomes. Failed attempts leave
-- an audit_logs row (no PII detail) and nothing else.

CREATE TABLE IF NOT EXISTS public.parent_verifications (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    status        text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'revoked')),
    method        text NOT NULL DEFAULT 'local-ocr',
    given_names   text NOT NULL,
    surnames      text NOT NULL,
    birth_date    date NOT NULL,
    address       text NOT NULL DEFAULT '',
    document_type text NOT NULL DEFAULT 'national-id',
    checks        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- boolean check summary, never raw OCR text
    verified_at   timestamptz NOT NULL DEFAULT now(),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_verifications_user
    ON public.parent_verifications (user_id);

ALTER TABLE public.parent_verifications ENABLE ROW LEVEL SECURITY;

-- Self may read their own verification record; all writes are service-role
-- only (no INSERT/UPDATE/DELETE policies — Core writes with the service key).
DROP POLICY IF EXISTS parent_verifications_select_own ON public.parent_verifications;
CREATE POLICY parent_verifications_select_own ON public.parent_verifications
    FOR SELECT USING (user_id = auth.uid());
