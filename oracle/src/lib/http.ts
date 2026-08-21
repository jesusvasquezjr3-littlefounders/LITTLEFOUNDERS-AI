import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getConfig } from '../env.js';

/** Envelope error response (/AGENTS.md §1.6). */
export function fail(res: Response, status: number, code: string, message: string): Response {
  return res.status(status).json({ data: null, error: { code, message } });
}

/** Envelope success response. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data, error: null });
}

/**
 * Constant-time secret comparison on FIXED-WIDTH digests (/AGENTS.md §1.14).
 *
 * Never guard timingSafeEqual with a String.length pre-check: String.length
 * counts UTF-16 code units while Buffer.from yields UTF-8 bytes, so a
 * same-character-length header carrying any byte >= 0x80 produces a longer
 * buffer and timingSafeEqual THROWS RangeError — a 500 where a 401 belongs.
 * Hashing first removes both the throw and the key-length side channel.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(provided).digest(),
    crypto.createHash('sha256').update(expected).digest(),
  );
}

/** Validates the INTERNAL_API_KEY header for service-to-service calls. */
export function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.get('x-internal-api-key') ?? '';
  if (!secretsMatch(provided, getConfig().INTERNAL_API_KEY)) {
    fail(res, 401, 'UNAUTHORIZED', 'Invalid internal API key');
    return;
  }
  next();
}

/**
 * Wraps a promise in a hard timeout.
 *
 * Every upstream Oracle calls is optional in the sense that the session must
 * survive its absence — but only if the call actually RETURNS. A hung provider
 * with no timeout is indistinguishable from a working one that is slow, and
 * the learner sits watching a character say nothing.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
