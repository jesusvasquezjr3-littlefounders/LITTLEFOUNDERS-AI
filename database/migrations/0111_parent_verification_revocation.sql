-- 0111_parent_verification_revocation.sql — A.5: a real revocation trigger
-- path and a distinct staff-granted method value for parent verifications.
-- @phase: expand
--
-- A.5 mandates: a "revoked" verification status must have a real trigger
-- path (a staff action following a fraud report), not exist only as an
-- unused schema value. The revocation row is a NEW parent_verifications
-- row (the resolver reads the latest row, so an older approval never
-- revives after a later revocation) with method 'staff-revoked' and no
-- applicant fields — a revocation does not re-assert a name or a birth
-- date. The staff grant of the parent role is distinguished by method
-- 'staff-granted' where a row exists, and by the absence of any
-- local-ocr row otherwise.
--
-- The columns are relaxed to NULLable so a revocation row can be written
-- without inventing placeholder identity data (never store a fake birth
-- date as a data-pollution workaround).

ALTER TABLE public.parent_verifications
    ALTER COLUMN given_names DROP NOT NULL;

ALTER TABLE public.parent_verifications
    ALTER COLUMN surnames DROP NOT NULL;

ALTER TABLE public.parent_verifications
    ALTER COLUMN birth_date DROP NOT NULL;

ALTER TABLE public.parent_verifications
    DROP CONSTRAINT IF EXISTS parent_verifications_method_check;

ALTER TABLE public.parent_verifications
    ADD CONSTRAINT parent_verifications_method_check
        CHECK (method IN ('local-ocr', 'staff-granted', 'staff-revoked'));

SELECT 'migration_0111_ok' AS sentinel;
