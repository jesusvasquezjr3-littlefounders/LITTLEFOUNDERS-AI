import rateLimit, { MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { getConfig } from '../env.js';
import { isTestOrDev } from './cache.js';

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
    sendCommand: (...args: string[]) => rateLimitClient.sendCommand(args),
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
