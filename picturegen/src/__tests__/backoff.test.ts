import { describe, expect, it } from 'vitest';
import { computeWaitMs, isRateLimitStatus, isRetryableStatus, parseRetryAfterMs } from '../gen/backoff.js';

describe('isRetryableStatus / isRateLimitStatus', () => {
  it('retries 429 and 5xx; rate-limit is 429 only', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRateLimitStatus(429)).toBe(true);
    expect(isRateLimitStatus(503)).toBe(false);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses delta-seconds and caps at 120s', () => {
    expect(parseRetryAfterMs('7')).toBe(7000);
    expect(parseRetryAfterMs('999')).toBe(120_000);
  });

  it('returns undefined for null/garbage', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('soon')).toBeUndefined();
  });
});

describe('computeWaitMs', () => {
  it('rate-limited ladder waits 1s-60s (per-minute quota scale), transient stays 0.5s-8s', () => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const rl = computeWaitMs(attempt, { rateLimited: true, rand: () => 1 });
      expect(rl).toBeGreaterThanOrEqual(1000);
      expect(rl).toBeLessThanOrEqual(60_000);
      const transient = computeWaitMs(attempt, { rand: () => 1 });
      expect(transient).toBeLessThanOrEqual(8000);
    }
    // The rate-limit ladder must be able to SPAN a per-minute window.
    expect(computeWaitMs(7, { rateLimited: true, rand: () => 1 })).toBe(60_000);
  });

  it('a provider Retry-After always wins over the computed ladder', () => {
    expect(computeWaitMs(1, { rateLimited: true, retryAfterMs: 42_000, rand: () => 0 })).toBe(42_000);
  });
});
