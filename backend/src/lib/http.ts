import type { Response } from 'express';

/*
 * One shape for every answer: `{ data, error }`, the same as the mail service. An error is a code,
 * never a sentence: the words a person reads live in the frontend's locale files, in three
 * languages.
 */
export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  CODE_INVALID: 400,
  AGE_OUT_OF_RANGE: 400,
  PERMISSION_REQUIRED: 400,
  USERNAME_INVALID: 400,
  NAME_INVALID: 400,
  ROLE_NOT_GRANTABLE: 400,
  TARGET_NOT_ELIGIBLE: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  ORIGIN_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  USERNAME_TAKEN: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  TOO_MANY_ATTEMPTS: 429,
  INTERNAL: 500,
  EMAIL_NOT_SENT: 502,
  UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class ApiError extends Error {
  readonly code: ErrorCode;
  /** Seconds the caller should wait before trying again, when that is known. */
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ErrorCode, retryAfterSeconds?: number) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERROR_STATUS, value);
}

export function sendData(res: Response, data: object, status = 200): void {
  res.status(status).json({ data, error: null });
}

export function sendError(res: Response, error: ApiError): void {
  if (error.retryAfterSeconds !== undefined) res.set('Retry-After', String(error.retryAfterSeconds));

  res.status(ERROR_STATUS[error.code]).json({
    data: null,
    error: { code: error.code, ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }) },
  });
}
