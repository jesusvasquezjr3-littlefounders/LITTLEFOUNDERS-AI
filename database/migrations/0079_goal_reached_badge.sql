-- 0079_goal_reached_badge.sql — widens the shareable-achievement-badge loop
-- (0072/0073) with a third kind: a reached savings goal.
-- @phase: contract
-- @after-release: 8a19a59e (this DROP/ADD CONSTRAINT is a pure widen — no
--   value is removed — but check-migration-phase.mjs classifies every
--   dropped-and-re-added CHECK as a contraction regardless of direction,
--   deliberately, since the gate cannot parse old-vs-new value sets
--   semantically (see 0072's identical case). Nothing here depends on an
--   older deploy retiring a removed value, so the named release is simply
--   the current HEAD at authoring time: this migration must still land
--   BEFORE any code issues a `goal_reached` badge, exactly like a normal
--   expand — the gate's mechanical caution costs one manual dispatch, which
--   is cheaper than the outage an under-called contraction risks
--   (database/AGENTS.md).
--
-- WHY THIS EXISTS. FAMILY_HUB.md §8 committed to reusing the badge system
-- "as-is" for goal reached — "no new image/compositor work" — but the
-- `achievement_kind` CHECK only ever allowed `course_badge`/`streak`. This is
-- the delta that keeps that promise: 0073 is applied to production and is
-- never edited (§1.3), so the constraint is dropped and recreated rather
-- than altered in place.
--
-- No RLS change: badge_shares' existing policies scope by kid/creator
-- already and do not reference achievement_kind's vocabulary.

ALTER TABLE public.badge_shares
    DROP CONSTRAINT IF EXISTS badge_shares_achievement_kind_check;
ALTER TABLE public.badge_shares
    ADD CONSTRAINT badge_shares_achievement_kind_check
    CHECK (achievement_kind IN ('course_badge', 'streak', 'goal_reached'));

SELECT 'migration_0079_ok' AS sentinel;
