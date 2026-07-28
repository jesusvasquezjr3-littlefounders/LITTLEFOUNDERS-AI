/** 429/5xx are transient — everything else (400s, network parse errors) is not. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/** Rate limits get their own, longer ladder — see computeWaitMs. */
export function isRateLimitStatus(status: number): boolean {
  return status === 429;
}

const MIN_MS = 500;
const MAX_MS = 8000;

/*
 * TWO LADDERS (ported from coursegen/src/providers/retry.ts — keep in sync):
 * a 5xx or a dropped socket is usually gone in a second, so 0.5s→8s is right
 * for it. A 429 is NOT: provider quotas are per-MINUTE, so a ~3.5s ladder
 * expires inside the same window that rejected the call, and with concurrent
 * workers sharing one quota a transient limit becomes terminal per-unit
 * failures. Rate limits therefore wait 1s→60s (spanning a per-minute window)
 * and get extra attempts, and a provider-supplied Retry-After ALWAYS wins
 * over our guess — capped so a hostile value cannot park a worker forever.
 */
const RL_MIN_MS = 1000;
const RL_MAX_MS = 60_000;
export const RATE_LIMIT_EXTRA_ATTEMPTS = 2;
const RETRY_AFTER_CAP_MS = 120_000;

/** Parse an HTTP Retry-After header (delta-seconds or HTTP-date) into ms, capped. */
export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Math.min(Number(trimmed) * 1000, RETRY_AFTER_CAP_MS);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(0, date - Date.now()), RETRY_AFTER_CAP_MS);
}

/**
 * Jittered exponential backoff for attempt 1..N (1-indexed) — 0.5s–8s for
 * transient errors, 1s–60s for rate limits, and the provider's own
 * Retry-After (already capped) when supplied. `rand` is injectable so tests
 * can assert bounds deterministically.
 */
export function computeWaitMs(
  attempt: number,
  opts: { rateLimited?: boolean; retryAfterMs?: number; rand?: () => number } = {},
): number {
  if (opts.retryAfterMs !== undefined) return Math.min(opts.retryAfterMs, RETRY_AFTER_CAP_MS);
  const min = opts.rateLimited ? RL_MIN_MS : MIN_MS;
  const max = opts.rateLimited ? RL_MAX_MS : MAX_MS;
  const rand = opts.rand ?? Math.random;
  const exp = Math.min(max, min * 2 ** (attempt - 1));
  const jitter = min + rand() * (exp - min || 1);
  return Math.round(Math.max(min, Math.min(max, jitter)));
}

/** Back-compat shim for existing call sites/tests — the transient ladder only. */
export function computeBackoffMs(attempt: number, rand: () => number = Math.random): number {
  return computeWaitMs(attempt, { rand });
}
