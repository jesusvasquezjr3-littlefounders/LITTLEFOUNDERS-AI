import { describe, expect, it } from 'vitest';
import { computeBackoffMs, isRetryableStatus } from '../tts/backoff.js';

describe('isRetryableStatus', () => {
  it('retries 429 and 5xx', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });

  it('does not retry 4xx other than 429, or 2xx/3xx', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(304)).toBe(false);
  });
});

describe('computeBackoffMs', () => {
  it('stays within the 0.5s–8s jittered window across attempts', () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      for (const rand of [0, 0.25, 0.5, 0.75, 0.999]) {
        const delay = computeBackoffMs(attempt, () => rand);
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(8000);
      }
    }
  });

  it('grows with the attempt number at rand=0 (lower bound of the jitter band)', () => {
    const d1 = computeBackoffMs(1, () => 0);
    const d2 = computeBackoffMs(2, () => 0);
    const d3 = computeBackoffMs(3, () => 0);
    expect(d1).toBeLessThanOrEqual(d2);
    expect(d2).toBeLessThanOrEqual(d3);
  });

  it('caps at 8s even for large attempt numbers', () => {
    expect(computeBackoffMs(10, () => 1)).toBe(8000);
    expect(computeBackoffMs(10, () => 0.999)).toBeLessThanOrEqual(8000);
  });
});
