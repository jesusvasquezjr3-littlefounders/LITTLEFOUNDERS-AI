-- @phase: expand
-- parent_verification_document_type_retire — A.5 / Appendix M 1.2 and 1.4:
-- a declared field that nothing validates must not keep claiming a check.
--
-- 0004 created parent_verifications.document_type as
-- `text NOT NULL DEFAULT 'national-id'`. The form stopped asking for a
-- document type in S04.2/W2S.2 (a declaration the image cannot validate) and
-- Core stopped sending it, so the DEFAULT stamped 'national-id' on every new
-- verification: each row claimed a national-ID check that never happened.
-- parent-id-check never compared the document type with the image either
-- (its verdict is documentReadable, nameMatch, birthDateMatch, notExpired),
-- so no row, old or new, holds a validated value.
--
-- This step: no default, nullable, and NULL on every row (none was ever
-- validated). Additive for every running deploy: an older Core that still
-- names the column may write it, and a newer one that omits it writes NULL.
-- The column itself is dropped by the contract migration that follows
-- (drop_parent_verification_document_type), after the Core release that no
-- longer declares it. Appendix M's Schema Field Utilization check
-- (agent/tools/check-schema-fields.mjs, in spec:check) asserts it is gone.

ALTER TABLE public.parent_verifications ALTER COLUMN document_type DROP DEFAULT;
ALTER TABLE public.parent_verifications ALTER COLUMN document_type DROP NOT NULL;
UPDATE public.parent_verifications SET document_type = NULL WHERE document_type IS NOT NULL;
