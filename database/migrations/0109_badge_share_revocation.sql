-- 0109_badge_share_revocation.sql — F.2: per-share revocation and a default
-- expiration window for the shareable-achievement-badge loop (0072/0073).
-- @phase: expand
--
-- WHAT THIS ADDS AND WHY.
--
-- F.2 (10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md) mandates two lifecycle
-- controls on badge_shares, which 0073 deliberately made immutable ("a
-- re-share issues a new token/row"): a parent-initiated per-share revoke
-- that kills one link without touching the underlying achievement, and a
-- default expiration so a forgotten link does not stay live forever.
--
--   expires_at   timestamptz NOT NULL. The default window is 30 days —
--                the conservative end of Appendix K's proposed 30-90 day
--                range (OD-10: build the conservative option; OD-13: the
--                range applies as written). 30 days is chosen because the
--                documented purpose is a one-time celebratory share
--                (Appendix K §1.4's retention-limitation reading) and a
--                re-share is one tap away, so a short window costs the
--                parent nothing material. Appendix L's Share Link Lifespan
--                metric feeds recalibration.
--   revoked_at   timestamptz NULL. NULL = live; a non-NULL value means the
--                token and its image must be treated as unreachable. Rows
--                are NEVER deleted: the share record (and everything the
--                achievement itself depends on) stays intact, only the
--                link dies.
--
-- Enforcement lives in Core, not in SQL: the public read route re-checks
-- both columns on every request (and the revoke route does a
-- compare-and-swap PATCH keyed on revoked_at IS NULL), because a revoked
-- or expired link must stop resolving immediately, without waiting for any
-- trigger or job. No RLS change: badge_shares still has no client
-- INSERT/UPDATE/DELETE policy — only Core's service role writes (0073).
--
-- The backfill below gives every pre-existing share the default window
-- measured from its OWN created_at (OD-13: "public badge shares with no
-- expiry ... are given the default expiry at migration"). The DDL lock
-- makes the UPDATE race-free against new inserts.

ALTER TABLE public.badge_shares
    ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days');

ALTER TABLE public.badge_shares
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE public.badge_shares
    SET expires_at = created_at + interval '30 days';

SELECT 'migration_0109_ok' AS sentinel;
