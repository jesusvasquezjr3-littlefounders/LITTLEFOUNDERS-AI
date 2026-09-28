-- @phase: contract
-- @after-release: the Core release of the F1 data-platform lane, in which
--   ParentVerificationInsert no longer declares document_type, and after
--   parent_verification_document_type_retire. Applied first, PostgREST would
--   reject an older Core's insert that still names the column.
-- drop_parent_verification_document_type — A.5 alternate remedy, Appendix M
-- 1.2 (Document-Type Validation Coverage, retired) and 1.4 (Schema Field
-- Utilization Audit): the field is removed rather than validated.
--
-- Nothing reads it: no index, policy, view or function names the column, the
-- staff console projects the verification tier and status only, and the
-- generated types drop it in the same change. The values are all NULL after
-- the expand step, so nothing of value is destroyed. Idempotent.

ALTER TABLE public.parent_verifications
    DROP COLUMN IF EXISTS document_type;
