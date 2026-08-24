import rateLimit, { MemoryStore, type RateLimitRequestHandler } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import RedisStore from 'rate-limit-redis';
import { isTestOrDev } from '../env.js';
import { withTimeout } from '../lib/http.js';
import { redisClient } from '../lib/redis.js';

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

function store() {
  if (isTestOrDev) return new MemoryStore();
  return new RedisStore({
    /*
     * The `isOpen` guard its siblings in `lib/redis.ts` both have. A command
     * against a closed client should say so, not throw from inside node-redis.
     */
    sendCommand: (...args: string[]) =>
      redisClient.isOpen
        ? withTimeout(redisClient.sendCommand(args), COMMAND_TIMEOUT_MS, 'redis')
        : Promise.reject(new Error('redis not connected yet')),
  });
}

/*
 * BUILT ON THE FIRST REQUEST, NOT AT MODULE LOAD.
 *
 * `rateLimit()` calls `store.init()` synchronously during construction, and
 * `RedisStore.init()` immediately issues a command to load its Lua script.
 * This module used to be evaluated at import time — before index.ts connects
 * Redis in the background, which it does deliberately so the listener can open
 * without waiting on optional infrastructure (§1.14). So every single healthy
 * boot printed a stack trace:
 *
 *   express-rate-limit: async error during store initialization.
 *   ClientClosedError: The client is closed
 *
 * Nothing was broken — `passOnStoreError` means a degraded limiter fails open
 * by design — but a stack trace on every clean start is noise that teaches you
 * to skim this log, and this service's real faults live in it. Guarding
 * `sendCommand` alone only changes which error is printed: express-rate-limit
 * logs the trace itself, whatever the rejection says.
 *
 * Deferring construction to the first request is what actually removes it. By
 * then the background connect has long since resolved, so `init()` finds an
 * open client and succeeds. If Redis is genuinely down the limiter still fails
 * open, exactly as before — the trade is unchanged, the log is just honest now.
 */
let limiter: RateLimitRequestHandler | null = null;

export const globalRateLimiter: RequestHandler = (req, res, next) => {
  limiter ??= buildLimiter();
  return limiter(req, res, next);
};

function buildLimiter(): RateLimitRequestHandler {
  return rateLimit({
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
    skip: (req) => req.path.startsWith('/api/v1/tutor'),
    message: {
      data: null,
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    },
    store: store(),
  });
}
