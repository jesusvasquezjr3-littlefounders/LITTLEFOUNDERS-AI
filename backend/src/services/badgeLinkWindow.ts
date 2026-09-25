/*
 * The legacy achievement-link window (OD-20). Its own module so both the
 * sharing service (services/badges.ts) and the data layer
 * (services/supabaseRest.ts) can read it without an import cycle.
 */

/**
 * OD-20's decision date. Links issued before it keep their F.2 controls
 * until they expire; a link issued at or after it is never served (fail
 * closed — the decision says new shares are images, so a row created after
 * it can only come from an outdated deploy). Mirrored in
 * frontend/api/badge/[token].ts and checked by `npm run sharing:check`.
 */
export const BADGE_LINK_CUTOVER = '2026-09-24T00:00:00.000Z';

/**
 * Cutover + the 30-day window (BADGE_SHARE_LIFETIME_DAYS): the instant by
 * which every legacy link has expired. From here on the public route is
 * retired outright. Mirrored in frontend/api/badge/[token].ts and
 * frontend/src/routes/marketing/BadgeLandingPage.tsx.
 */
export const BADGE_LINK_ROUTE_RETIRES_AT = '2026-10-24T00:00:00.000Z';

/**
 * F.2's default expiration window for legacy links (migration 0109,
 * `expires_at`). No new link is issued any more; this remains the fact the
 * retirement date above is derived from.
 */
export const BADGE_SHARE_LIFETIME_DAYS = 30;

/** True once every legacy link has expired and the public page route is retired. */
export function badgeLinksRetired(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(BADGE_LINK_ROUTE_RETIRES_AT);
}
