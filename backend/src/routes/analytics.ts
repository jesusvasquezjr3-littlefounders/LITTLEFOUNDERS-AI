import { Router } from 'express';
import { ok } from '../lib/http.js';
import { isIpExcluded } from '../services/analyticsExclusions.js';
import { isBotUserAgent } from '../services/botDetection.js';

/*
 * GET /api/v1/analytics/tracking-decision — the ONE public read of the
 * internal-traffic exclusion registry (Vault 0045).
 *
 * The SPA asks this before mounting Plausible/Umami/GA4, so an excluded
 * machine never sends a hit to anything. That is the only enforceable
 * boundary we have: Plausible CE ships no ingestion-side IP blocklist, so a
 * list that lived only in a dashboard would change no number anywhere.
 *
 * Contract notes:
 *  - Anonymous by design (the caller is a marketing visitor with no session)
 *    and rate-limited by the global limiter. It answers one boolean about the
 *    CALLER'S OWN address and reveals nothing about the registry: an
 *    unexcluded probe cannot learn which networks are excluded.
 *  - Nothing is persisted. The visitor's address is matched in memory against
 *    the cached snapshot and discarded (§1.9 — we do not store visitor IPs).
 *  - `degraded: true` means Vault could not answer, so "not excluded" here is
 *    an assumption, not a fact. The browser keeps any exclusion it already
 *    persisted, which is what makes a staff machine stay excluded through an
 *    outage; fresh visitors keep being measured, because losing real
 *    acquisition data is worse than admitting a few staff pageviews.
 *  - no-store: the answer is per-address. A shared cache handing one client's
 *    decision to another would silently mis-scope tracking for everybody
 *    behind that cache.
 */
export function analyticsRouter(): Router {
  const router = Router();

  router.get('/tracking-decision', async (req, res) => {
    /*
     * A crawler that runs JavaScript asks this too. Answering "excluded" stops
     * it mounting any tracker, which keeps it out of Plausible/Umami/GA4 in
     * the same breath as staff traffic — cheaper and earlier than filtering it
     * downstream, and it costs a real visitor nothing.
     */
    if (isBotUserAgent(req.get('user-agent'))) {
      res.setHeader('Cache-Control', 'no-store');
      return ok(res, { excluded: true, degraded: false });
    }
    const excluded = await isIpExcluded(req.ip);
    res.setHeader('Cache-Control', 'no-store');
    ok(res, { excluded: excluded === true, degraded: excluded === null });
  });

  return router;
}
