/** 429/5xx are transient — everything else (400s, network parse errors) is not. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

const MIN_MS = 500;
const MAX_MS = 8000;

/**
 * Jittered exponential backoff, 0.5s–8s, for attempt 1..N (1-indexed).
 * `rand` is injectable so tests can assert bounds deterministically.
 */
export function computeBackoffMs(attempt: number, rand: () => number = Math.random): number {
  const exp = Math.min(MAX_MS, MIN_MS * 2 ** (attempt - 1));
  const jitter = MIN_MS + rand() * (exp - MIN_MS || 1);
  return Math.round(Math.max(MIN_MS, Math.min(MAX_MS, jitter)));
}
