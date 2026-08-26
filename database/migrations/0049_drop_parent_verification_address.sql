-- 0049_drop_parent_verification_address.sql — remove a home address that
-- nothing ever verified.
--
-- WHY THIS IS A DELETE AND NOT A DEPRECATION. 0004 states this table's own
-- privacy contract: "Only the applicant-declared data that was MATCHED AGAINST
-- THE DOCUMENT lands here." The address was never matched against anything.
-- Traced through the whole stack before writing this: Core required it
-- (`z.string().trim().min(1).max(240)`) and persisted it, but never forwarded
-- it — `parent-id-check/` has no occurrence of the word, and Guardian's verdict
-- is exactly four checks, `documentReadable`, `nameMatch`, `birthDateMatch`,
-- `notExpired`. Nothing in the platform ever read the column back.
--
-- So it was write-only PII, collected as `required` on a screen whose most
-- prominent element is a promise about what we do not keep, and it sat in a
-- table whose stated contract excluded it. /AGENTS.md §1.9 asks for minimal
-- collection; the honest fix is to stop asking and to drop what was gathered,
-- not to keep it behind a comment.
--
-- Idempotent (`IF EXISTS`). This DESTROYS the stored addresses, which is the
-- point: leaving them would keep exactly the data the app no longer justifies
-- holding. Nothing depends on the column — no index, no policy, no view, no
-- generated type consumer.

ALTER TABLE public.parent_verifications
    DROP COLUMN IF EXISTS address;
