import rateLimit, { MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { getConfig } from '../config.js';

export const isTestOrDev = process.env.NODE_ENV !== 'production';

// Create a Redis client for distributed rate limiting
export const redisClient = createClient({
  url: getConfig().REDIS_URL,
});

// We connect manually in the entry point (index.ts) but handle connection errors here silently
if (!isTestOrDev) {
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
}

// Function to get the appropriate store based on the environment
const getStore = () => {
  if (isTestOrDev) return new MemoryStore();
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  });
};

/*
 * passOnStoreError: FAIL OPEN when Redis errors.
 *
 * The default is fail-CLOSED: a store error is passed to the error handler,
 * which under our envelope handler becomes a 500. With the limiter mounted
 * app-wide that turned any Redis outage into a total outage — every route,
 * including GET /health, answered 500, which failed Railway's healthcheck and
 * took Core down over a degraded *rate limiter*.
 *
 * Rate limiting protects availability; it is not an authorization control.
 * Trading "requests are briefly unmetered" for "the platform stays up" is the
 * correct direction. Auth abuse is still bounded by GoTrue's own throttling.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
  store: getStore(),
});

// Telemetry gets its OWN budget, outside the global pool: beacon flushes
// from a shared-IP household/classroom must never consume the 200-req
// budget real product calls depend on. Generous enough for many concurrent
// sessions behind one NAT (a flush is ~1 req/min/session), fail-open like
// the others — losing telemetry is always acceptable, blocking lessons never is.
export const eventsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many telemetry batches, slow down.' } },
  store: getStore(),
});

// Evidence-photo uploads are the only binary payload (up to 8MB) this router
// accepts, and the only one worth metering separately from the 200-req/15min
// budget every other Family Hub action shares on the same IP — an abusive
// loop of uploads would otherwise burn real bandwidth AND starve the rest of
// a household's legitimate requests against the same shared limit.
export const evidenceUploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many photo uploads, please try again later.' } },
  store: getStore(),
});

// Strict auth rate limiter (e.g., 10 requests per 15 minutes per IP). Reserved
// for routes that touch an EXISTING credential (login, recovery, password/
// email change, guest→real upgrade) — the surface brute-force/enumeration
// protection actually guards.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts, please try again later.' } },
  store: getStore(),
});

/*
 * Account-creation rate limiter (/signup, /guest) — deliberately separate
 * from, and more generous than, authRateLimiter above.
 *
 * Both used to share the 10-req/15-min pool with every other auth route,
 * including /login and /refresh. A shared-IP household/school/office network
 * (observed 2026-09-12, a QA cluster testing from one network) can burn
 * through 10 requests on OTHER people's logins and background session
 * refreshes alone, so a first-time visitor's very first /signup attempt
 * arrived pre-blocked with "too many attempts" — not because they did
 * anything wrong, but because the budget was never theirs alone to spend.
 * Creating an account is also lower-risk to rate-limit generously than
 * guessing a password: a burst of signups is at worst spam accounts, not a
 * credential-stuffing surface, and GoTrue has its own throttling underneath
 * either way (see authRateLimiter's own note in this file's history).
 */
export const accountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many account attempts, please try again later.' } },
  store: getStore(),
});
