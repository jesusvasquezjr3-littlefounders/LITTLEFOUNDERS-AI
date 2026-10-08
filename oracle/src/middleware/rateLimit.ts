import rateLimit, { MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { isTestOrDev } from '../env.js';
import { withTimeout } from '../lib/http.js';
import { awaitFirstConnect, redisClient } from '../lib/redis.js';

/*
 * Rate limiting is an AVAILABILITY control, not an authorization one
 * (/AGENTS.md §1.14). It fails OPEN on a store error, because a degraded
 * limiter must never be able to take the platform down.
 *
 * The command timeout exists for a failure this project has already hit: a
 * live Redis outage leaves `isOpen` true because node-redis retries in the
 * background, so a hung sendCommand never rejects, `passOnStoreError` never
 * fires, and every request hangs instead of failing open.
 *
 * The client itself now lives in `lib/redis.ts`, shared with the speech cache.
 * One connection, one reconnect loop, one thing to be down.
 */
const COMMAND_TIMEOUT_MS = 250;

/*
 * How long the store's FIRST command may wait for the initial connect. Spent at
 * most once, during startup, and never on a request path: `/health` is mounted
 * above this limiter precisely so a slow optional dependency cannot fail a
 * platform healthcheck.
 */
const BOOT_GRACE_MS = 3_000;

function store() {
  if (isTestOrDev) return new MemoryStore();
  return new RedisStore({
    /*
     * `RedisStore.init()` fires a command the instant this store is built, and
     * that is at module load — before index.ts has connected the shared client.
     * `awaitFirstConnect` covers exactly that window and NOTHING else: once the
     * client has ever been open it returns instantly, so an outage later fails
     * fast rather than adding a grace period to every request.
     *
     * Then the `isOpen` guard its siblings in `lib/redis.ts` both have: a
     * command against a closed client should say so plainly rather than throw
     * from inside node-redis.
     */
    sendCommand: async (...args: string[]) => {
      await awaitFirstConnect(BOOT_GRACE_MS);
      if (!redisClient.isOpen) throw new Error('redis unavailable');
      return withTimeout(redisClient.sendCommand(args), COMMAND_TIMEOUT_MS, 'redis');
    },
  });
}

/*
 * WHY THE STORE WAITS INSTEAD OF THE LIMITER BEING LAZY.
 *
 * Every healthy boot used to print `ClientClosedError: The client is closed`,
 * because `rateLimit()` runs `store.init()` synchronously and `RedisStore`
 * immediately issues a command — while index.ts connects Redis in the
 * background by design. Two wrong fixes were tried before this one, and both
 * are worth naming because each looked finished:
 *
 *   1. Guarding `sendCommand` only changed WHICH error printed. The trace comes
 *      from express-rate-limit itself, whatever the rejection says.
 *   2. Deferring construction to the first request removed that trace and
 *      earned a new one — `ERR_ERL_CREATED_IN_REQUEST_HANDLER`, which the
 *      library raises on purpose, and now on a request path rather than at boot.
 *
 * The limiter is built at init, where it belongs. The STORE absorbs the race.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  /*
   * THE INTERNAL SURFACE IS EXEMPT, and this is the difference between a
   * limiter and an outage.
   *
   * Oracle has exactly one HTTP caller: Core, from one address. Keying by IP
   * therefore put ALL platform traffic in a single 200-per-15-minutes bucket —
   * and `preflight` runs on the tutor OFFER screen, not just on session start,
   * so roughly 200 tutor page views in a quarter of an hour made Core answer
   * `ORACLE_UNAVAILABLE` to every learner. Ordinary success was the trigger;
   * no attacker was required. Worse, `/health` stayed 200 throughout, so the
   * platform saw a healthy service and never restarted or scaled it.
   *
   * Exempting it costs nothing, because `requireInternalKey` already fronts
   * that surface with a shared secret — an IP bucket in front of a key check
   * defends against nobody. What the limiter still guards is everything
   * unauthenticated, which is where a real flood would arrive.
   */
  skip: (req) => req.path.startsWith('/api/v1/tutor') || req.path.startsWith('/api/v1/game'),
  message: {
    data: null,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  },
  store: store(),
});
