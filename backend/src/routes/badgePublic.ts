import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { isBadgeShareActive, purgeBadgeImageIfUnreferenced } from '../services/badges.js';
import { getBadgeShareByToken } from '../services/supabaseRest.js';

/*
 * GET /api/v1/badges/:token — the ONE genuinely unauthenticated Core read
 * (/AGENTS.md §1.5 is otherwise "every internal service is called
 * service-to-service, the browser only talks to Core through auth'd
 * routes" — this is the deliberate exception, because a badge link is
 * opened by strangers who do not have, and may never create, an account).
 *
 * The response is whitelisted down to display fields only: no
 * kid_user_id, no created_by, no row id. `token` is a 32-char base64url
 * opaque string (backend/src/services/badges.ts, ~144 bits of entropy),
 * so this is not meaningfully enumerable — rate-limited by the app-level
 * globalRateLimiter like every other Core route regardless.
 */

const TokenParam = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

export function badgePublicRouter(): Router {
  const router = Router();

  router.get('/:token', async (req, res) => {
    // Share status must be rechecked on every read, including after revocation.
    res.setHeader('Cache-Control', 'no-store');
    const parsedToken = TokenParam.safeParse(req.params.token);
    if (!parsedToken.success) return fail(res, 404, 'NOT_FOUND', 'No such badge');

    const share = await getBadgeShareByToken(parsedToken.data);
    if (!share || !isBadgeShareActive(share)) {
      // F.2: a revoked or expired share is unreachable — page AND image. The
      // revoke route purges synchronously; this lazy purge catches shares
      // whose window ended without ever being revoked (and retries a failed
      // revoke-time purge, since the delete is idempotent). Never awaited:
      // the 404 must not wait on Depot.
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
