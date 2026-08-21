import crypto from 'crypto';
import { z } from 'zod';
import { getConfig } from '../env.js';

/*
 * The live-session token (/ORACLE.md §3.2, /AGENTS.md §1.5 Oracle exception).
 *
 * Core mints it; the browser carries it on ONE websocket; Oracle verifies and
 * burns it. It is deliberately not a Supabase JWT and Oracle rejects one:
 *
 * - A Supabase JWT authenticates a PERSON for minutes to hours across every
 *   surface. This authenticates ONE SOCKET for one session for one minute.
 * - It is single-use. A replayed token is a rejected token, so a URL captured
 *   from a screen recording or a shared link is already dead.
 * - It names a session id, so a token cannot be pointed at someone else's
 *   conversation even if the signature is valid.
 *
 * Format: `v1.<base64url payload>.<base64url hmac>` — compact, URL-safe, no
 * dependency. The payload is readable by anyone holding the token, which is
 * fine: it contains two opaque uuids and an expiry, and the socket is useless
 * without the signature.
 */

const PayloadSchema = z
  .object({
    /** Tutor session id (uuid). */
    sid: z.uuid(),
    /** The learner this session belongs to (uuid). */
    uid: z.uuid(),
    /** Unix seconds. */
    exp: z.number().int().positive(),
    /** Single-use nonce. */
    jti: z.string().min(16).max(64),
  })
  .strict();

export type SessionTokenPayload = z.infer<typeof PayloadSchema>;

export type TokenVerdict =
  | { ok: true; payload: SessionTokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'replayed' };

const PREFIX = 'v1';

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

/**
 * Mints a token. Lives here rather than only in Core so the two sides can
 * never drift: Oracle's own tests sign with this function and verify with the
 * next one, and Core imports the same format from its own copy of the spec.
 */
export function mintSessionToken(
  payload: Omit<SessionTokenPayload, 'jti'> & { jti?: string },
  secret: string,
): string {
  const complete: SessionTokenPayload = {
    ...payload,
    jti: payload.jti ?? crypto.randomBytes(16).toString('base64url'),
  };
  const body = `${PREFIX}.${Buffer.from(JSON.stringify(complete), 'utf8').toString('base64url')}`;
  return `${body}.${sign(body, secret)}`;
}

/**
 * Tracks spent nonces so a token works exactly once.
 *
 * In-memory on purpose. A session token lives for a minute and a websocket is
 * pinned to one process for its whole life, so a shared store would buy
 * nothing but a dependency — and §1.14's rule is that liveness must not depend
 * on optional infrastructure. A process restart forgets spent nonces, and the
 * worst that allows is replaying a token that has not yet expired, into a
 * session whose socket is already gone.
 */
class NonceLedger {
  private readonly spent = new Map<string, number>();

  /** Returns false if this nonce was already used. */
  consume(jti: string, expiresAtMs: number, now: number): boolean {
    this.sweep(now);
    if (this.spent.has(jti)) return false;
    this.spent.set(jti, expiresAtMs);
    return true;
  }

  private sweep(now: number): void {
    if (this.spent.size < 512) return;
    for (const [jti, expiry] of this.spent) {
      if (expiry <= now) this.spent.delete(jti);
    }
  }

  /** Test seam. */
  clear(): void {
    this.spent.clear();
  }
}

export const nonceLedger = new NonceLedger();

/**
 * Verifies and burns a token.
 *
 * The signature is compared in constant time on fixed-width digests, for the
 * §1.14 reason: a length pre-check on a raw string throws RangeError on any
 * multi-byte character, turning a forged token into a 500 instead of a 401.
 */
export function verifySessionToken(token: string, now = Date.now()): TokenVerdict {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: 'malformed' };
  const [, encoded, signature] = parts;
  if (!encoded || !signature) return { ok: false, reason: 'malformed' };

  const body = `${PREFIX}.${encoded}`;
  const expected = sign(body, getConfig().TUTOR_SESSION_SECRET);
  const matches = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(signature).digest(),
    crypto.createHash('sha256').update(expected).digest(),
  );
  if (!matches) return { ok: false, reason: 'bad_signature' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const payload = PayloadSchema.safeParse(parsed);
  if (!payload.success) return { ok: false, reason: 'malformed' };
  if (payload.data.exp * 1000 <= now) return { ok: false, reason: 'expired' };

  if (!nonceLedger.consume(payload.data.jti, payload.data.exp * 1000, now)) {
    return { ok: false, reason: 'replayed' };
  }

  return { ok: true, payload: payload.data };
}

/**
 * Rejects anything shaped like a Supabase JWT before it is even verified.
 *
 * A JWT would fail the format check anyway (three dot-separated parts, but the
 * first is `eyJ...` rather than `v1`). This exists so the REASON is
 * unambiguous in a log: someone wiring the client wrong should see "you sent a
 * Supabase JWT" and not "malformed", because those lead to very different
 * fixes and the wrong one takes an afternoon.
 */
export function looksLikeSupabaseJwt(token: string): boolean {
  return token.startsWith('eyJ');
}
