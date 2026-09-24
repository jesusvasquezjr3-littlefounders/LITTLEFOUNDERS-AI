import { randomBytes } from 'node:crypto';
import { getConfig } from '../config.js';
import { badgeShareImageStillReferencedElsewhere } from './supabaseRest.js';

/*
 * Shareable-achievement-badge loop (0072/0073, /ORACLE.md-adjacent ROADMAP
 * growth entry): Core decides WHICH achievement and WHAT it says, then asks
 * Depot (filebase) to render the pixels — the same "content vs. bytes" split
 * as every other Depot caller (Forge/Echo write lesson media, Core issues
 * download URLs; here Core writes badge images through Depot's compositor
 * instead of uploading pre-made bytes).
 */

/** URL-safe opaque token — mirrors the 0073 CHECK (`^[A-Za-z0-9_-]{16,64}$`). 32 chars from 24 random bytes. */
export function generateBadgeToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * A kid's profile `display_name` is parent-chosen free text and may be a
 * full name — /AGENTS.md §1.9's "age band + first name" ceiling applies to
 * this badge too (it is about to become a public, unauthenticated URL), so
 * only the FIRST token ever leaves this function. Capped to the 0073 column
 * limit regardless, defense in depth against an unusually long first token.
 */
export function firstNameOnly(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 40);
}

export interface ComposedBadge {
  url: string;
  bucket: string;
  hash: string;
  ext: string;
  bytes: number;
  mime: string;
}

export interface BadgeCompositeParams {
  kind: 'course_badge' | 'streak' | 'goal_reached';
  label: string;
  firstName: string;
  ageBand?: '6-8' | '9-11' | '12-14';
}

const BADGE_BUCKET = 'badges';

/**
 * F.2's default expiration window (migration 0109, `expires_at`). 30 days is
 * the conservative end of Appendix K's proposed 30-90 day range: the share's
 * documented purpose is a one-time celebratory moment (Appendix K §1.4), a
 * re-share mints a fresh link in one tap, and OD-10/OD-13 make the
 * conservative reading of the written range the binding one. Appendix L's
 * Share Link Lifespan metric is the recalibration channel.
 */
export const BADGE_SHARE_LIFETIME_DAYS = 30;

/** The `expires_at` a newly issued share gets — sent explicitly so the row never depends on the DB default alone. */
export function badgeShareExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + BADGE_SHARE_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * A share is live only while it is un-revoked AND inside its window. The
 * public read route evaluates this on EVERY request (revocation/expiry must
 * take effect immediately, not on a job's schedule).
 */
export function isBadgeShareActive(share: { revoked_at: string | null; expires_at: string }): boolean {
  return share.revoked_at === null && Date.parse(share.expires_at) > Date.now();
}

/**
 * Deletes the Depot object behind a badge image (F.2: revocation is not done
 * until the image's OWN storage location stops serving, not merely the
 * /badge/{token} page 404ing). Depot's DELETE is idempotent for our purposes:
 * a 404 means the object is already gone, which is the state we want.
 * Returns false on any transport-level failure — the caller must log it and
 * may retry (the revoke route is idempotent, and the public route re-purges
 * inactive shares on every hit).
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

/**
 * Purges the Depot object behind one dead share — but ONLY when no other
 * LIVE share references the same content-addressed object. Two shares for the
 * same achievement dedupe to one image (Depot is content-addressed by
 * design), so deleting unconditionally would break a still-live twin's image.
 * A failed reference read returns false and skips the delete entirely
 * (§1.14: never destroy on an ambiguous read).
 */
export async function purgeBadgeImageIfUnreferenced(share: {
  token: string;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
}): Promise<boolean> {
  const referenced = await badgeShareImageStillReferencedElsewhere(share.token, share.image_bucket, share.image_hash);
  if (referenced === null || referenced) return false;
  return deleteBadgeImage(share.image_bucket, share.image_hash, share.image_ext);
}

/** Calls Depot's templated compositor. Returns null on ANY failure — the caller must refuse, never fall back to a placeholder image (§1.14). */
export async function composeBadgeImage(params: BadgeCompositeParams): Promise<ComposedBadge | null> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  try {
    const response = await fetch(`${FILEBASE_URL}/api/v1/badges`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': FILEBASE_INTERNAL_KEY,
        'x-service-name': 'backend',
      },
      body: JSON.stringify({ bucket: BADGE_BUCKET, ...params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data: ComposedBadge | null };
    return body.data;
  } catch {
    return null;
  }
}
