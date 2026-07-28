// Transport-retry: jittered exponential backoff 0.5s→8s, max 4 attempts,
// ONLY for retryable errors (429/5xx/network/timeout). Non-retryable errors
// (4xx other than 429) throw immediately. SEPARATE counter from the
// schema-corrective retries in pipeline/write.ts / plan.ts (COURSE_ENGINE.md §4).

import { isRateLimitError, isRetryableError, retryAfterMsOf } from './errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  /** Attempts for a RATE LIMIT specifically — quotas are per-minute, so this ladder is longer. */
  rateLimitMaxAttempts?: number;
  rateLimitBaseMs?: number;
  rateLimitMaxMs?: number;
  /** Hard ceiling on a provider-supplied Retry-After, so a hostile value cannot park a worker. */
  retryAfterCapMs?: number;
  /** Injectable for tests — avoids real sleeps. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests — avoids non-deterministic jitter in assertions. */
  random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * TWO LADDERS, because the two failure modes have different timescales.
 *
 * A 5xx or a dropped socket is usually gone in a second, so the original
 * 0.5s→8s × 4 ladder (~3.75s of total waiting) is right for it. A 429 is NOT:
 * provider quotas are per-MINUTE, so a ~3.75s ladder expires inside the same
 * window that rejected the call, and at volume every concurrent worker burns its
 * attempts against one rate-limit window — which is how a transient limit became
 * TERMINAL slot failures, re-paid regeneration, and a run that reported failures
 * caused entirely by its own retry policy.
 *
 * So: rate limits get a longer ladder (1s→60s × 6 ≈ 63s of waiting, which spans a
 * per-minute window), and a provider-supplied `Retry-After` ALWAYS wins over our
 * guess, capped so a hostile or mistaken value cannot park a worker forever.
 */
export async function withTransportRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;
  const rlMaxAttempts = opts.rateLimitMaxAttempts ?? 6;
  const rlBaseMs = opts.rateLimitBaseMs ?? 1000;
  const rlMaxMs = opts.rateLimitMaxMs ?? 60_000;
  const retryAfterCapMs = opts.retryAfterCapMs ?? 120_000;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;

  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isRetryableError(err)) throw err;
      const rateLimited = isRateLimitError(err);
      const limit = rateLimited ? rlMaxAttempts : maxAttempts;
      if (attempt >= limit) throw err;

      const supplied = retryAfterMsOf(err);
      let waitMs: number;
      if (supplied !== undefined) {
        // The provider told us when the quota resets — believe it, within reason.
        waitMs = Math.min(supplied, retryAfterCapMs);
      } else {
        const base = rateLimited ? rlBaseMs : baseMs;
        const cap = rateLimited ? rlMaxMs : maxMs;
        const backoff = Math.min(cap, base * 2 ** (attempt - 1));
        waitMs = backoff * (0.5 + random() * 0.5);
      }
      if (rateLimited) {
        console.warn(
          `[forge] rate limited (attempt ${attempt}/${limit}) — waiting ${Math.round(waitMs / 1000)}s` +
            (supplied !== undefined ? ' (provider Retry-After)' : ''),
        );
      }
      await sleep(waitMs);
    }
  }
}
