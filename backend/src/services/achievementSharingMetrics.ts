import { BADGE_LINK_CUTOVER, BADGE_LINK_ROUTE_RETIRES_AT, badgeLinksRetired } from './badgeLinkWindow.js';
import { countServiceRows } from './supabaseRest.js';

/*
 * Appendix L metrics for achievement sharing under OD-20.
 *
 * WHAT IS COUNTED: shares INITIATED — a verified guardian asked for the
 * achievement image and Core rendered it — split by the hand-off the parent's
 * device offered (share sheet or download) and by achievement kind; the
 * Persistent Public URL Rate (new company-hosted links among new shares,
 * target zero, structurally enforced by the database refusing new
 * badge_shares rows); and the legacy links' lifecycle until their retirement.
 *
 * WHAT IS NEVER COUNTED: who saw a shared image, how many people opened
 * anything, or any click-through "reach". There is no viewer to count by
 * design (F.5's brand position: a proud moment a parent sends to people who
 * care, not an acquisition funnel), and the legacy `badge_link_click`
 * anonymous event is no longer accepted.
 *
 * Every count is exact or the whole read fails: a KPI must never turn an
 * unavailable count into a believable zero (§1.14).
 */

export interface AchievementSharingMetrics {
  windowDays: number;
  since: string;
  initiated: {
    total: number;
    shareSheet: number;
    download: number;
    byKind: { course_badge: number; streak: number; goal_reached: number };
  };
  /** New company-hosted links created in the window after the OD-20 cutover. Target: 0. */
  persistentPublicUrls: number;
  /** persistentPublicUrls / (initiated.total + persistentPublicUrls); null when there were no shares at all. */
  persistentPublicUrlRate: number | null;
  legacyLinks: {
    cutover: string;
    routeRetiresAt: string;
    retired: boolean;
    total: number;
    live: number;
    revoked: number;
  };
}

const q = (value: string) => encodeURIComponent(value);

export async function getAchievementSharingMetrics(windowDays: number, now: Date = new Date()): Promise<AchievementSharingMetrics | null> {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const persistentSince = Date.parse(since) > Date.parse(BADGE_LINK_CUTOVER) ? since : BADGE_LINK_CUTOVER;
  const initiations = `/achievement_share_initiations?select=id&created_at=gte.${q(since)}`;
  const retired = badgeLinksRetired(now);
  const live = `/badge_shares?select=id&created_at=lt.${q(BADGE_LINK_CUTOVER)}&revoked_at=is.null&expires_at=gt.${q(now.toISOString())}`;

  const [total, shareSheet, download, course, streak, goal, persistent, legacyTotal, legacyLive, legacyRevoked] = await Promise.all([
    countServiceRows(initiations),
    countServiceRows(`${initiations}&handoff=eq.share_sheet`),
    countServiceRows(`${initiations}&handoff=eq.download`),
    countServiceRows(`${initiations}&achievement_kind=eq.course_badge`),
    countServiceRows(`${initiations}&achievement_kind=eq.streak`),
    countServiceRows(`${initiations}&achievement_kind=eq.goal_reached`),
    countServiceRows(`/badge_shares?select=id&created_at=gte.${q(persistentSince)}`),
    countServiceRows('/badge_shares?select=id'),
    retired ? Promise.resolve(0) : countServiceRows(live),
    countServiceRows('/badge_shares?select=id&revoked_at=not.is.null'),
  ]);
  const values = [total, shareSheet, download, course, streak, goal, persistent, legacyTotal, legacyLive, legacyRevoked];
  if (values.some((value) => value === null)) return null;

  const initiatedTotal = total as number;
  const persistentCount = persistent as number;
  const denominator = initiatedTotal + persistentCount;
  return {
    windowDays,
    since,
    initiated: {
      total: initiatedTotal,
      shareSheet: shareSheet as number,
      download: download as number,
      byKind: { course_badge: course as number, streak: streak as number, goal_reached: goal as number },
    },
    persistentPublicUrls: persistentCount,
    persistentPublicUrlRate: denominator === 0 ? null : persistentCount / denominator,
    legacyLinks: {
      cutover: BADGE_LINK_CUTOVER,
      routeRetiresAt: BADGE_LINK_ROUTE_RETIRES_AT,
      retired,
      total: legacyTotal as number,
      live: legacyLive as number,
      revoked: legacyRevoked as number,
    },
  };
}
