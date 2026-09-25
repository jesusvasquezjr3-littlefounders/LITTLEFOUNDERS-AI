import { getConfig } from '../config.js';
import { BADGE_LINK_CUTOVER, badgeLinksRetired } from './badgeLinkWindow.js';
import { badgeShareImageStillReferencedElsewhere } from './supabaseRest.js';

export { BADGE_LINK_CUTOVER, BADGE_LINK_ROUTE_RETIRES_AT, BADGE_SHARE_LIFETIME_DAYS, badgeLinksRetired } from './badgeLinkWindow.js';

/*
 * Achievement sharing (Product 10 Block F; OD-20, 24 September 2026).
 *
 * THE CURRENT ARCHITECTURE IS AN IMAGE HANDED TO THE PARENT. Core decides
 * WHICH achievement and WHAT it says (after verifying the caller is a
 * verified guardian and the achievement is real), asks Depot to render the
 * pixels, and returns the PNG bytes to that parent in the response. Depot
 * stores nothing and Core persists nothing about the image: there is no
 * token, no public page and no world-readable object, so nobody the parent
 * did not send the picture to can open it and no messaging app can build a
 * link preview from a company-hosted URL.
 *
 * THE LEGACY LINK ARCHITECTURE IS RETIRING. Links (`/badge/{token}` plus a
 * world-readable Depot image) issued BEFORE the OD-20 cutover keep their F.2
 * controls — noindex, a 30-day expiry and per-share revocation that also
 * purges the image — until they expire. After BADGE_LINK_ROUTE_RETIRES_AT
 * every such link has necessarily expired (the database refuses new rows
 * from the cutover and every row expires 30 days after its creation), so
 * the public route answers 410 without reading anything, and the sweep
 * (routes/badgePublic.ts, `badge-link-retirement.yml`) removes any image a
 * visit never purged. The dated removal of the remaining code, the Vercel
 * rewrite and the table is the runbook in
 * docs/rebuild/policies/ACHIEVEMENT-SHARING.md.
 */

/**
 * A legacy link is live only while ALL of these hold: the route is not yet
 * retired, the link was issued before the OD-20 cutover, it is un-revoked
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
 * A kid's profile `display_name` is parent-chosen free text and may be a
 * full name. F.6's first-name-only standing constraint: only the FIRST token
 * ever leaves this function, capped at 40 characters regardless (defense in
 * depth against an unusually long first token).
 */
export function firstNameOnly(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 40);
}

export type AchievementKind = 'course_badge' | 'streak' | 'goal_reached';
export type AchievementLocale = 'en-US' | 'es-MX' | 'pt-BR';

/** Exactly what Depot's renderer accepts (its body schema is `.strict()`). F.6: no age, no surname, no photo. */
export interface AchievementImageParams {
  kind: AchievementKind;
  label: string;
  firstName: string;
  locale: AchievementLocale;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** A 1080x1920 flat-colour badge is ~100 KB; anything past this is not our renderer's output. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Renders the achievement image through Depot and returns its bytes. Returns
 * null on ANY failure — transport, a non-PNG answer, an oversized body — and
 * the caller must refuse rather than fall back to a placeholder (§1.14).
 */
export async function renderAchievementImage(params: AchievementImageParams): Promise<Buffer | null> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  try {
    const response = await fetch(`${FILEBASE_URL}/api/v1/badges/render`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': FILEBASE_INTERNAL_KEY,
        'x-service-name': 'backend',
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok || response.headers.get('content-type') !== 'image/png') return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < PNG_MAGIC.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return null;
    if (!bytes.subarray(0, PNG_MAGIC.byteLength).equals(PNG_MAGIC)) return null;
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Deletes the Depot object behind a legacy badge image (F.2: revocation is
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
 * read skips the delete entirely (§1.14: never destroy on an ambiguous
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
