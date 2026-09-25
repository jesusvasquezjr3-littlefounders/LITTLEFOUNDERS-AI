-- achievement_share_initiations — Appendix L's "shares initiated"
-- counter for the OD-20 image-sharing architecture (Product 10 F.1, F.5).
-- @phase: expand
--
-- WHAT THIS ADDS AND WHY.
--
-- OD-20 (24 September 2026) made an achievement share a PNG that Core
-- renders and hands to the verified guardian, who sends it themselves. No
-- link, page or stored image exists any more, so the only honest measure of
-- the feature is how often a guardian INITIATES a share — and OD-20 says
-- Appendix L counts exactly that, never viewer reach.
--
-- achievement_share_initiations   One row per rendered achievement image,
--                                 written by Core's service role after the
--                                 guardian and achievement checks pass.
--
--   achievement_kind  which achievement was shared (course badge, streak,
--                     reached savings goal) — the same closed vocabulary as
--                     badge_shares.achievement_kind.
--   handoff           what the parent's device offered for the hand-off:
--                     'share_sheet' (Web Share API with a file) or
--                     'download'. Declared by the client, used only for this
--                     count, never for access.
--   created_at        when.
--
-- MINIMIZATION (F.6 / Appendix L). The row carries NO user id, NO kid id, NO
-- name, NO label and NO image reference: it is an operational counter, not a
-- record about a child, so it needs no retention job of its own and cannot
-- be joined back to a family. Both CHECKs keep it a closed vocabulary — no
-- free-text channel exists.
--
-- ACCESS. RLS is enabled with NO policy: no browser session can read or
-- write it. Core's service role writes (routes/family.ts) and reads the
-- aggregate counts for staff with view_analytics
-- (GET /api/v1/admin/analytics/achievement-sharing).
--
-- ORDERING. Safe before or after the code: the Core that writes it treats a
-- failed insert as a logged measurement gap and still hands the parent the
-- image, and nothing older reads or writes this table.

CREATE TABLE IF NOT EXISTS public.achievement_share_initiations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_kind  text NOT NULL CHECK (achievement_kind IN ('course_badge', 'streak', 'goal_reached')),
    handoff           text NOT NULL CHECK (handoff IN ('share_sheet', 'download')),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS achievement_share_initiations_created_at_idx
    ON public.achievement_share_initiations (created_at);

ALTER TABLE public.achievement_share_initiations ENABLE ROW LEVEL SECURITY;

SELECT 'migration_achievement_share_initiations_ok' AS sentinel;
