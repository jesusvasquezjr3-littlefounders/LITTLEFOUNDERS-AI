import { randomBytes } from 'node:crypto';
import { getConfig } from '../config.js';

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
  kind: 'course_badge' | 'streak';
  label: string;
  firstName: string;
  ageBand?: '6-8' | '9-11' | '12-14';
}

const BADGE_BUCKET = 'badges';

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
