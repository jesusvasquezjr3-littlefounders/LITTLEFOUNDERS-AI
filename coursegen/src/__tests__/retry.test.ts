import { describe, expect, it, vi } from 'vitest';
import { withTransportRetry } from '../providers/retry.js';
import { ProviderHttpError, ProviderNetworkError, isRetryableError } from '../providers/errors.js';

const noSleep = () => Promise.resolve();
const fixedRandom = () => 0.5;

describe('error classification', () => {
  it('429 is retryable', () => {
    expect(new ProviderHttpError('test', 429, '').retryable).toBe(true);
  });
  it('5xx is retryable', () => {
    expect(new ProviderHttpError('test', 500, '').retryable).toBe(true);
    expect(new ProviderHttpError('test', 503, '').retryable).toBe(true);
  });
  it('400 is NOT retryable', () => {
    expect(new ProviderHttpError('test', 400, '').retryable).toBe(false);
  });
  it('401/403/404 are NOT retryable', () => {
    expect(new ProviderHttpError('test', 401, '').retryable).toBe(false);
    expect(new ProviderHttpError('test', 403, '').retryable).toBe(false);
    expect(new ProviderHttpError('test', 404, '').retryable).toBe(false);
  });
  it('network errors are retryable', () => {
    expect(new ProviderNetworkError('test', new Error('boom')).retryable).toBe(true);
  });
  it('isRetryableError returns false for a generic Error', () => {
    expect(isRetryableError(new Error('plain'))).toBe(false);
  });
});

describe('withTransportRetry', () => {
  it('retries a 429 up to maxAttempts, then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderHttpError('test', 429, 'rate limited'))
      .mockRejectedValueOnce(new ProviderHttpError('test', 429, 'rate limited'))
      .mockResolvedValueOnce('ok');

    const result = await withTransportRetry(fn, { maxAttempts: 4, sleep: noSleep, random: fixedRandom });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry a 400 — throws immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderHttpError('test', 400, 'bad request'));
    await expect(withTransportRetry(fn, { maxAttempts: 4, sleep: noSleep, random: fixedRandom })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on persistent 5xx', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderHttpError('test', 500, 'server error'));
    await expect(withTransportRetry(fn, { maxAttempts: 3, sleep: noSleep, random: fixedRandom })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('sleeps with jittered exponential backoff bounded by baseMs/maxMs', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderHttpError('test', 500, 'x'))
      .mockRejectedValueOnce(new ProviderHttpError('test', 500, 'x'))
      .mockResolvedValueOnce('ok');

    await withTransportRetry(fn, { maxAttempts: 4, baseMs: 500, maxMs: 8000, sleep, random: () => 0 });
    expect(sleep).toHaveBeenCalledTimes(2);
    // random()=0 → jitter factor 0.5 exactly: attempt1 backoff=500 → sleep(250); attempt2 backoff=1000 → sleep(500)
    expect(sleep.mock.calls[0]![0]).toBeCloseTo(250, 5);
    expect(sleep.mock.calls[1]![0]).toBeCloseTo(500, 5);
  });
});
