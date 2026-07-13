// Typed provider errors — the transport-retry / non-retryable split
// (COURSE_ENGINE.md §4 "Retries & backoff") lives on `retryable`.

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly provider: string;

  constructor(provider: string, status: number, body: string) {
    super(`${provider} HTTP ${status}: ${body.slice(0, 500)}`);
    this.name = 'ProviderHttpError';
    this.provider = provider;
    this.status = status;
    // 429 and any 5xx are transient — everything else (400/401/403/404…) is
    // a real failure and must NOT burn transport-retry budget.
    this.retryable = status === 429 || status >= 500;
  }
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
