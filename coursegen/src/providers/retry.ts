// Transport-retry: jittered exponential backoff 0.5s→8s, max 4 attempts,
// ONLY for retryable errors (429/5xx/network/timeout). Non-retryable errors
// (4xx other than 429) throw immediately. SEPARATE counter from the
// schema-corrective retries in pipeline/write.ts / plan.ts (COURSE_ENGINE.md §4).

import { isRetryableError } from './errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  /** Injectable for tests — avoids real sleeps. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests — avoids non-deterministic jitter in assertions. */
  random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withTransportRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;

  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isRetryableError(err) || attempt >= maxAttempts) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      const jittered = backoff * (0.5 + random() * 0.5);
      await sleep(jittered);
    }
  }
}
