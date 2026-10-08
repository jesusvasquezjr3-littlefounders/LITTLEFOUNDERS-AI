import { getConfig } from '../config.js';
import { BADGE_LINK_CUTOVER, badgeLinksRetired } from './badgeLinkWindow.js';
import { badgeShareImageStillReferencedElsewhere } from './supabaseRest.js';

export { BADGE_LINK_CUTOVER, BADGE_LINK_ROUTE_RETIRES_AT, BADGE_SHARE_LIFETIME_DAYS, badgeLinksRetired } from './badgeLinkWindow.js';

/*
 * Legacy achievement links (24 September 2026).
 *
 * THE LEGACY LINK ARCHITECTURE IS RETIRING. Links (`/badge/{token}` plus a
 * world-readable Depot image) issued BEFORE the cutover keep their
 * controls — noindex, a 30-day expiry and per-share revocation that also
 * purges the image — until they expire. After BADGE_LINK_ROUTE_RETIRES_AT
 * every such link has necessarily expired (the database refuses new rows
 * from the cutover and every row expires 30 days after its creation), so
 * the public route answers 410 without reading anything, and the sweep
 * (routes/badgePublic.ts, `badge-link-retirement.yml`) removes any image a
 * visit never purged. The dated removal of the remaining code, the Vercel
 * rewrite and the table is the last step of retiring them.
 */

/**
 * A legacy link is live only while ALL of these hold: the route is not yet
 * retired, the link was issued before the cutover, it is un-revoked
 * and it is inside its window. The public read route evaluates this on
 * EVERY request (revocation/expiry take effect immediately, not on a job's
 * schedule).
 */
export function isBadgeShareActive(
  share: { revoked_at: string | null; expires_at: string; created_at: string },
  now: Date = new Date(),
): boolean {
  if (badgeLinksRetired(now)) return false;
  const created = Date.parse(share.created_at);
  if (!Number.isFinite(created) || created >= Date.parse(BADGE_LINK_CUTOVER)) return false;
  return share.revoked_at === null && Date.parse(share.expires_at) > now.getTime();
}

/**
 * Deletes the Depot object behind a legacy badge image (revocation is
 * not done until the image's OWN storage location stops serving, not merely
 * the /badge/{token} page 404ing). Depot's DELETE is idempotent for our
 * purposes: a 404 means the object is already gone, which is the state we
 * want. Returns false on any transport-level failure.
 */
export async function deleteBadgeImage(bucket: string, hash: string, ext: string): Promise<boolean> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  try {
    const response = await fetch(`${FILEBASE_URL}/api/v1/files/${encodeURIComponent(bucket)}/${hash}.${ext}`, {
      method: 'DELETE',
      headers: {
        'x-internal-api-key': FILEBASE_INTERNAL_KEY,
        'x-service-name': 'backend',
      },
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export type BadgeImagePurgeOutcome = 'purged' | 'still-referenced' | 'failed';

/**
 * Purges the Depot object behind one dead legacy share — but ONLY when no
 * other LIVE share references the same content-addressed object (two shares
 * of the same achievement deduplicated to one image). A failed reference
 * read skips the delete entirely (never destroy on an ambiguous
 * read) and reports `failed` so the sweep retries it.
 */
export async function purgeBadgeImage(share: {
  token: string;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
}): Promise<BadgeImagePurgeOutcome> {
  const referenced = await badgeShareImageStillReferencedElsewhere(share.token, share.image_bucket, share.image_hash);
  if (referenced === null) return 'failed';
  if (referenced) return 'still-referenced';
  return (await deleteBadgeImage(share.image_bucket, share.image_hash, share.image_ext)) ? 'purged' : 'failed';
}

/** Boolean form for the revoke and public routes, which only report whether the image is gone. */
export async function purgeBadgeImageIfUnreferenced(share: {
  token: string;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
}): Promise<boolean> {
  return (await purgeBadgeImage(share)) === 'purged';
}
