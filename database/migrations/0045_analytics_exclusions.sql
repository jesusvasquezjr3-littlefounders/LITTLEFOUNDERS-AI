-- 0045_analytics_exclusions.sql — internal-traffic exclusion registry.
--
-- WHY THIS EXISTS
-- Staff browsing the public site is not acquisition. It inflates visitors,
-- flattens bounce rate and re-weights every geography/source breakdown the
-- team makes decisions from. Plausible CE v3.2.1 ships NO ingestion-side IP
-- blocklist (a previous attempt to claim one was removed in 02758833), so the
-- only boundary we can actually enforce is OUR OWN: the tracker gate in the
-- SPA and the first-party ingest in Core. This table is the source of truth
-- both of them read.
--
-- SCOPE OF THE TRUTH THIS BUYS: exclusion is FORWARD-ONLY. It prevents future
-- pollution; it cannot retroactively remove events already stored in
-- Plausible/Umami/GA4. The console says so on screen — never imply otherwise.
--
-- §1.9: no minor's data lands here. `analytics_staff_ip_sightings` records
-- addresses ONLY for authenticated admin/superadmin requests (adult staff,
-- internal operations); Core never writes a visitor's, parent's or kid's
-- address to either table, and the public tracking-decision endpoint answers
-- from memory without persisting anything.
--
-- Idempotent. RLS enabled with NO policies: both tables are service-role only
-- (the `user_roles`/`admin_permissions` posture) — the console reads them
-- through Core, which is gated by requireRole(['admin','superadmin']).

-- ── Exclusion registry ──────────────────────────────────────────────────────
-- `network` is cidr, so one row covers a single address (/32, /128) or a whole
-- office range with the same containment semantics — no parallel "is this a
-- range?" branch anywhere in the code.

CREATE TABLE IF NOT EXISTS public.analytics_ip_exclusions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network     cidr NOT NULL,
    label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    reason      text CHECK (reason IS NULL OR char_length(reason) <= 280),
    created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    -- Revocation is bookkeeping, not deletion: an exclusion that silently
    -- vanished would make a past report impossible to explain. `revoked_at`
    -- alone decides active/inactive — `revoked_by` is ON DELETE SET NULL, so
    -- pairing them in a CHECK would make deleting a staff account fail.
    revoked_at  timestamptz,
    revoked_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

-- One ACTIVE row per network; revoked rows stay for the audit trail and may
-- repeat (a network can be excluded, revoked, and excluded again).
CREATE UNIQUE INDEX IF NOT EXISTS analytics_ip_exclusions_active_network_idx
    ON public.analytics_ip_exclusions (network)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS analytics_ip_exclusions_created_at_idx
    ON public.analytics_ip_exclusions (created_at DESC);

ALTER TABLE public.analytics_ip_exclusions ENABLE ROW LEVEL SECURITY;
-- No policies: service role (Core) only.

COMMENT ON TABLE public.analytics_ip_exclusions IS
    'Networks excluded from analytics ingestion (staff/office traffic). Enforced by the SPA tracker gate and Core /api/v1/events. Forward-only: never rewrites history.';

-- ── Automatic detection ─────────────────────────────────────────────────────
-- Every authenticated staff request stamps its source address here, so the
-- console can offer "these are the addresses your team actually works from"
-- instead of asking a human to know their own IP. Pruned by Core to a rolling
-- 90-day window (see backend/src/services/analyticsExclusions.ts).

CREATE TABLE IF NOT EXISTS public.analytics_staff_ip_sightings (
    address       inet NOT NULL,
    user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    hits          bigint NOT NULL DEFAULT 1 CHECK (hits > 0),
    PRIMARY KEY (address, user_id)
);

CREATE INDEX IF NOT EXISTS analytics_staff_ip_sightings_last_seen_idx
    ON public.analytics_staff_ip_sightings (last_seen_at DESC);

ALTER TABLE public.analytics_staff_ip_sightings ENABLE ROW LEVEL SECURITY;
-- No policies: service role (Core) only.

COMMENT ON TABLE public.analytics_staff_ip_sightings IS
    'Source addresses of authenticated admin/superadmin requests, for one-click exclusion suggestions. Staff (adults) only — §1.9 forbids recording a minor here.';

-- Atomic upsert-and-increment. Core records a sighting on staff requests, so
-- this runs on a hot path: doing it as INSERT … ON CONFLICT keeps it to one
-- round trip and makes `hits` a real counter (a PostgREST merge-duplicates
-- upsert would overwrite it with 1 every time, and first_seen_at with now()).
-- SECURITY INVOKER + service-role-only tables: no new reach is granted here.
CREATE OR REPLACE FUNCTION public.record_staff_ip_sighting(p_address inet, p_user_id uuid)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO public.analytics_staff_ip_sightings (address, user_id)
    VALUES (p_address, p_user_id)
    ON CONFLICT (address, user_id) DO UPDATE
        SET last_seen_at = now(),
            hits = public.analytics_staff_ip_sightings.hits + 1;
$$;
