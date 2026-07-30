// Typed provider errors — the transport-retry / non-retryable split lives on
// `retryable`. Ported verbatim in behavior from `coursegen/src/providers/errors.ts`
// (GAME_ENGINE.md §9: "Arcade's stages, checkpointing, providers and telemetry are
// modeled on Forge"). These classifications were paid for by real runs; do not
// re-derive them.

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly provider: string;
  /**
   * `Retry-After` in milliseconds when the provider sent one. Rate-limit replies
   * usually do, and it is the ONLY authoritative answer to "how long until my
   * quota resets" — guessing with exponential backoff against a per-MINUTE window
   * loses, which is exactly how sustained 429s used to turn into terminal slot
   * failures at volume in Forge.
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

/**
 * FATAL provider states: the credential or the account is the problem, so no amount
 * of retrying, regenerating or waiting can succeed. 401 unauthorized, 402 payment
 * required / insufficient balance, 403 forbidden.
 *
 * WHY THIS EXISTS (measured in Forge, 2026-07-25): a real 62-lesson run hit DeepSeek
 * "Insufficient Balance" partway through. 402 is correctly non-retryable per CALL,
 * but the SLOT then failed, the outer slot-attempt loop regenerated it from scratch
 * three times, the pool moved on, and every remaining slot repeated the whole dance —
 * 62/62 failed, 2.17M tokens and ~$10 spent, ZERO lessons published. The run should
 * have stopped at the first 402. A dead credential is not a slot-level problem.
 *
 * Arcade inherits the rule: `run.ts` must abort the whole run on a fatal provider
 * error, and any per-item `catch` inside a stage MUST rethrow it (gamegen/AGENTS.md).
 */
export function isFatalProviderError(err: unknown): boolean {
  return err instanceof ProviderHttpError && (err.status === 401 || err.status === 402 || err.status === 403);
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
