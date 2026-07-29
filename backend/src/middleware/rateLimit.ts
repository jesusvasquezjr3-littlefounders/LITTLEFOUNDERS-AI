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

// Strict auth rate limiter (e.g., 10 requests per 15 minutes per IP)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts, please try again later.' } },
  store: getStore(),
});
