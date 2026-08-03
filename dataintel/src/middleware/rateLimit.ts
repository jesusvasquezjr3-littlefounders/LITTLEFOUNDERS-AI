import rateLimit, { MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { getConfig } from '../env.js';
import { isTestOrDev } from './cache.js';
import { withTimeout } from '../lib/timeout.js';

// A live Redis outage leaves `isOpen` true (node-redis keeps retrying in
// the background), so a hung sendCommand would otherwise never reject and
// `passOnStoreError: true` below would never get a chance to fire — turning
// a Redis outage into every request hanging instead of failing open.
const COMMAND_TIMEOUT_MS = 250;

export const rateLimitClient = createClient({
  url: getConfig().REDIS_URL,
});

if (!isTestOrDev) {
  rateLimitClient.on('error', (err) => console.error('[dataintel] RateLimit Client Error', err));
}

const getStore = () => {
  if (isTestOrDev) {
    return new MemoryStore();
  }
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      withTimeout(rateLimitClient.sendCommand(args), COMMAND_TIMEOUT_MS),
  });
};

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
  store: getStore(),
});

export const intelRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  message: {
    data: null,
    error: { code: 'RATE_LIMITED', message: 'Too many analytics requests.' },
  },
  store: getStore(),
});
