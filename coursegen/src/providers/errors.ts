// Typed provider errors — the transport-retry / non-retryable split
// (COURSE_ENGINE.md §4 "Retries & backoff") lives on `retryable`.

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly provider: string;
  /**
   * `Retry-After` in milliseconds when the provider sent one. Rate-limit replies
   * usually do, and it is the ONLY authoritative answer to "how long until my
   * quota resets" — guessing with exponential backoff against a per-MINUTE window
   * loses, which is exactly how sustained 429s used to turn into terminal slot
   * failures at volume.
   */
  readonly retryAfterMs?: number;

  constructor(provider: string, status: number, body: string, retryAfterMs?: number) {
    super(`${provider} HTTP ${status}: ${body.slice(0, 500)}`);
    this.name = 'ProviderHttpError';
    this.provider = provider;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    // 429 and any 5xx are transient — everything else (400/401/403/404…) is
    // a real failure and must NOT burn transport-retry budget.
    this.retryable = status === 429 || status >= 500;
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }
}

/** Parses a `Retry-After` header (seconds, or an HTTP date) into milliseconds. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    const delta = when - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

/** True for a provider rate-limit reply, which gets its own (much longer) backoff ladder. */
export function isRateLimitError(err: unknown): boolean {
  return err instanceof ProviderHttpError && err.isRateLimit;
}

/** The provider-supplied wait, when there is one. */
export function retryAfterMsOf(err: unknown): number | undefined {
  return err instanceof ProviderHttpError ? err.retryAfterMs : undefined;
}

export class ProviderNetworkError extends Error {
  readonly provider: string;
  readonly retryable = true;

  constructor(provider: string, cause: unknown) {
    super(`${provider} network error: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ProviderNetworkError';
    this.provider = provider;
  }
}

export class ProviderTimeoutError extends Error {
  readonly provider: string;
  readonly retryable = true;

  constructor(provider: string, timeoutMs: number) {
    super(`${provider} timed out after ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
    this.provider = provider;
  }
}

export class ProviderNotConfiguredError extends Error {
  readonly provider: string;
  readonly retryable = false;

  constructor(provider: string) {
    super(`${provider} is NOT_CONFIGURED — missing API key`);
    this.name = 'ProviderNotConfiguredError';
    this.provider = provider;
  }
}

export function isRetryableError(err: unknown): boolean {
  return (
    err instanceof ProviderHttpError ||
    err instanceof ProviderNetworkError ||
    err instanceof ProviderTimeoutError
  )
    ? err.retryable
    : false;
}
