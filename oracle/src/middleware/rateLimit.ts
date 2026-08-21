import rateLimit, { MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { getConfig, isTestOrDev } from '../env.js';
import { withTimeout } from '../lib/http.js';

/*
 * Rate limiting is an AVAILABILITY control, not an authorization one
 * (/AGENTS.md §1.14). It fails OPEN on a store error, because a degraded
 * limiter must never be able to take the platform down.
 *
 * The command timeout exists for a failure this project has already hit: a
 * live Redis outage leaves `isOpen` true because node-redis retries in the
 * background, so a hung sendCommand never rejects, `passOnStoreError` never
 * fires, and every request hangs instead of failing open.
 */
const COMMAND_TIMEOUT_MS = 250;

export const rateLimitClient = createClient({ url: getConfig().REDIS_URL });

if (!isTestOrDev) {
  rateLimitClient.on('error', (err) => console.error('[oracle] rate-limit redis error', err));
}

function store() {
  if (isTestOrDev) return new MemoryStore();
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      withTimeout(rateLimitClient.sendCommand(args), COMMAND_TIMEOUT_MS, 'redis'),
  });
}

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: {
    data: null,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  },
  store: store(),
});
