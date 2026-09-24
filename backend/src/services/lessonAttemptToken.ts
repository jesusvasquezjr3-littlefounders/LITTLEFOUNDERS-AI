import crypto from 'crypto';

/*
 * Version-pinned attempt token wire contract. Issuance and verification are
 * pure so the eventual database transaction can atomically burn `jti` with
 * the grade. Verification alone never makes a token single-use.
 */

const PREFIX = 'v1';
export const LESSON_ATTEMPT_TOKEN_TTL_SECONDS = 15 * 60;

export interface LessonAttemptTokenPayload {
  vid: string;
  uid: string;
  lid: string;
  loc: 'en-US' | 'es-MX' | 'pt-BR';
  sid: string;
  rid: string;
  exp: number;
  jti: string;
}

export type LessonAttemptTokenResult =
  | { status: 'valid'; payload: LessonAttemptTokenPayload }
  | { status: 'invalid' | 'expired' | 'mismatch' };

/**
 * A caller may first authenticate the learner/run/segment tuple, then resolve
 * the immutable version named by that signed token before checking locale and
 * version identity. This is needed when a newly activated revision supersedes
 * the pointer while an already-issued run is still valid.
 */
export type LessonAttemptTokenExpectation = Partial<Pick<LessonAttemptTokenPayload, 'uid' | 'vid' | 'lid' | 'loc' | 'sid' | 'rid'>>;

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validPayload(value: unknown): value is LessonAttemptTokenPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.vid === 'string' && typeof payload.uid === 'string' && typeof payload.lid === 'string'
    && (payload.loc === 'en-US' || payload.loc === 'es-MX' || payload.loc === 'pt-BR') && typeof payload.sid === 'string'
    && typeof payload.rid === 'string' && typeof payload.exp === 'number' && Number.isSafeInteger(payload.exp)
    && typeof payload.jti === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(payload.jti);
}

/** Mint a short-lived token bound to one learner, immutable version, run and segment. */
export function mintLessonAttemptToken(
  input: Omit<LessonAttemptTokenPayload, 'exp' | 'jti'>,
  secret: string,
  now = Date.now(),
): { token: string; payload: LessonAttemptTokenPayload; expiresAt: string } {
  const payload: LessonAttemptTokenPayload = {
    ...input,
    exp: Math.floor(now / 1000) + LESSON_ATTEMPT_TOKEN_TTL_SECONDS,
    jti: crypto.randomBytes(24).toString('base64url'),
  };
  const body = `${PREFIX}.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
  return { token: `${body}.${sign(body, secret)}`, payload, expiresAt: new Date(payload.exp * 1000).toISOString() };
}

/** Re-sign a persisted, still-live nonce after a browser reload without storing a token client-side. */
export function reissueLessonAttemptToken(payload: LessonAttemptTokenPayload, secret: string, now = Date.now()): { token: string; expiresAt: string } | null {
  if (!validPayload(payload) || payload.exp * 1000 <= now) return null;
  const body = `${PREFIX}.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
  return { token: `${body}.${sign(body, secret)}`, expiresAt: new Date(payload.exp * 1000).toISOString() };
}

/** Verify a token without consuming it; the grade transaction must burn `jti`. */
export function verifyLessonAttemptToken(
  token: string,
  secret: string,
  expected: LessonAttemptTokenExpectation,
  now = Date.now(),
): LessonAttemptTokenResult {
  const [prefix, encoded, signature, ...rest] = token.split('.');
  if (prefix !== PREFIX || !encoded || !signature || rest.length !== 0) return { status: 'invalid' };
  const body = `${prefix}.${encoded}`;
  if (!safeEqual(sign(body, secret), signature)) return { status: 'invalid' };
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return { status: 'invalid' };
  }
  if (!validPayload(payload)) return { status: 'invalid' };
  if (payload.exp * 1000 <= now) return { status: 'expired' };
  for (const key of ['uid', 'vid', 'lid', 'loc', 'sid', 'rid'] as const) {
    if (expected[key] !== undefined && payload[key] !== expected[key]) return { status: 'mismatch' };
  }
  return { status: 'valid', payload };
}
