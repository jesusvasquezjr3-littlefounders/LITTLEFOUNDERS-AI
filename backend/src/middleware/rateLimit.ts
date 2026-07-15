import rateLimit, { MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { getConfig } from '../config.js';

const isTest = process.env.NODE_ENV === 'test';

// Create a Redis client for distributed rate limiting
export const redisClient = createClient({
  url: getConfig().REDIS_URL,
});

// We connect manually in the entry point (index.ts) but handle connection errors here silently
if (!isTest) {
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
}

// Function to get the appropriate store based on the environment
const getStore = () => {
  if (isTest) return new MemoryStore();
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  });
};

// Global baseline rate limiter (e.g., 200 requests per 15 minutes per IP)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } },
  store: getStore(),
});

// Strict auth rate limiter (e.g., 10 requests per 15 minutes per IP)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many authentication attempts, please try again later.' } },
  store: getStore(),
});
