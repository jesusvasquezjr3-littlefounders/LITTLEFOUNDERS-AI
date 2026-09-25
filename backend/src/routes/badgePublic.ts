import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { requireInternalKey } from '../middleware/auth.js';
import { badgeLinksRetired, isBadgeShareActive, purgeBadgeImage, purgeBadgeImageIfUnreferenced } from '../services/badges.js';
import { getBadgeShareByToken, insertAuditLog, listDeadBadgeShares } from '../services/supabaseRest.js';

/*
 * GET /api/v1/badges/:token — the LEGACY public badge-link read (0073/0109).
 *
 * OD-20 (24 September 2026) made a new share an image handed to the parent;
 * no new link is issued. Links issued before the cutover keep their F.2
 * controls until they expire: this route serves one only while it is
 * un-revoked, inside its 30-day window and was issued before the cutover
 * (services/badges.ts isBadgeShareActive). From BADGE_LINK_ROUTE_RETIRES_AT
 * every legacy link has expired, so the route answers 410 Gone without
 * reading anything — the dated retirement of the public page. Removing the
 * code itself is the runbook in docs/rebuild/policies/ACHIEVEMENT-SHARING.md.
 *
 * It is the ONE unauthenticated Core read a stranger's browser reaches
 * (/AGENTS.md §1.5's deliberate exception while legacy links live). The
 * response is whitelisted to display fields only: no kid_user_id, no
 * created_by, no row id. `token` is a 32-char base64url opaque string
 * (~144 bits of entropy), rate-limited by the app-level globalRateLimiter.
 */

const TokenParam = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

export function badgePublicRouter(): Router {
  const router = Router();

  router.get('/:token', async (req, res) => {
    // Share status must be rechecked on every read, including after revocation.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (badgeLinksRetired()) return fail(res, 410, 'GONE', 'Achievement links are retired');

    const parsedToken = TokenParam.safeParse(req.params.token);
    if (!parsedToken.success) return fail(res, 404, 'NOT_FOUND', 'No such badge');

    const share = await getBadgeShareByToken(parsedToken.data);
    if (!share || !isBadgeShareActive(share)) {
      // F.2: a revoked, expired or post-cutover share is unreachable — page
      // AND image. The revoke route purges synchronously and the sweep below
      // catches every dead link nobody visits; this lazy purge is a third
      // path. Never awaited: the 404 must not wait on Depot.
      if (share) void purgeBadgeImageIfUnreferenced(share);
      return fail(res, 404, 'NOT_FOUND', 'No such badge');
    }

    return ok(res, {
      firstName: share.first_name,
      achievementKind: share.achievement_kind,
      achievementLabel: share.achievement_label,
      imageUrl: share.image_url,
    });
  });

  return router;
}

/*
 * POST /api/v1/internal/badge-links/purge — the legacy-image sweep.
 *
 * F.2 says a dead link is not dead until its IMAGE stops resolving at its
 * own storage URL. Revocation purges at once and the public route purges
 * lazily on a visit, but a link that simply expires unvisited kept a
 * world-readable image forever. This sweep walks every dead legacy link
 * (revoked, expired, issued at/after the cutover; every link once the route
 * is retired) and deletes its Depot object unless a still-live twin shares
 * it. Called daily by `.github/workflows/badge-link-retirement.yml` from
 * inside Core's container (internal key never leaves the process), paged by
 * offset because rows are never deleted by the sweep and Depot's delete is
 * idempotent.
 *
 * It reports what it did and writes `badge_links.images_swept` to audit_logs
 * on every run, including a run that purged nothing: "ran and found nothing"
 * and "never ran" must stay distinguishable (§1.14). A failed read is a 502,
 * never a reassuring zero.
 */
export const BADGE_IMAGE_SWEEP_AUDIT_ACTION = 'badge_links.images_swept';

const SweepBody = z
  .object({
    limit: z.number().int().min(1).max(1000).default(500),
    offset: z.number().int().min(0).max(1_000_000).default(0),
  })
  .strict();

export function badgeLinkSweepRouter(): Router {
  const router = Router();
  router.use(requireInternalKey);

  router.post('/purge', async (req, res) => {
    const parsed = SweepBody.safeParse(req.body ?? {});
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body');
    const { limit, offset } = parsed.data;

    const dead = await listDeadBadgeShares(limit, offset);
    if (dead === null) return fail(res, 502, 'DATA_UNAVAILABLE', 'The badge-image sweep could not read the links');

    const counts = { scanned: dead.length, purged: 0, stillReferenced: 0, failed: 0 };
    for (const share of dead) {
      const outcome = await purgeBadgeImage(share);
      if (outcome === 'purged') counts.purged += 1;
      else if (outcome === 'still-referenced') counts.stillReferenced += 1;
      else counts.failed += 1;
    }
    if (counts.failed > 0) console.error(`[badge-link-retirement] ${counts.failed} legacy image(s) could not be purged this batch`);

    const retired = badgeLinksRetired();
    const audited = await insertAuditLog(null, BADGE_IMAGE_SWEEP_AUDIT_ACTION, 'badge_shares', { ...counts, limit, offset, retired });
    if (!audited) console.error('[badge-link-retirement] audit write FAILED — the sweep ran but will not show as having run');

    return ok(res, { ...counts, limit, offset, retired, complete: dead.length < limit });
  });

  return router;
}
