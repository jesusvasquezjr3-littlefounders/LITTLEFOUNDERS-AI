-- close_badge_share_links — OD-20's cutover at the database: no new
-- public badge link can ever be created (Product 10 F.1).
-- @phase: contract
-- @after-release: the Core release carrying S08.4 (codex/spec-s08, "OD-20 image-only achievement sharing"), whose share route renders an image and never inserts into badge_shares
--
-- WHAT THIS DOES AND WHY.
--
-- OD-20 (24 September 2026): a new achievement share is an image handed to
-- the parent; the rebuild creates no company-hosted public page for a new
-- share. Core no longer has any insert path into badge_shares, but "the
-- application stopped doing it" is not a control. This trigger makes the
-- table refuse every INSERT, from any role including the service role, so
-- no deploy — current, older or future — can mint a new public link.
--
-- WHAT KEEPS WORKING. Legacy links issued before the cutover keep their F.2
-- controls until they expire: SELECT (the public read and the Family list)
-- and UPDATE (the per-link revoke's compare-and-swap on revoked_at) are
-- untouched, and so are the image purge and the sweep, which never write
-- rows. Rows are not deleted here; the whole table is dropped in the dated
-- removal after 24 October 2026 (docs/rebuild/policies/ACHIEVEMENT-SHARING.md).
--
-- WHY CONTRACT. This removes a write an older deploy still performs: a
-- pre-S08.4 Core composes and STORES a world-readable Depot image and only
-- then inserts the row. Applied before the new Core is live, the insert
-- would fail after the image already exists, leaving a public object with
-- no row to revoke or sweep it. Apply only once the release named above is
-- live (the migration-phase gate keeps it out of auto-apply).

CREATE OR REPLACE FUNCTION public.refuse_new_badge_share_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'badge_shares is closed (OD-20): achievement sharing is an image handed to the parent; no new public link may be created'
        USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS badge_shares_refuse_insert ON public.badge_shares;
CREATE TRIGGER badge_shares_refuse_insert
    BEFORE INSERT ON public.badge_shares
    FOR EACH ROW
    EXECUTE FUNCTION public.refuse_new_badge_share_link();

REVOKE ALL ON FUNCTION public.refuse_new_badge_share_link() FROM PUBLIC;

SELECT 'migration_close_badge_share_links_ok' AS sentinel;
