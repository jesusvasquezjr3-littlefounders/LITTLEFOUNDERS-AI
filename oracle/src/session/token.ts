import crypto from 'crypto';
import { z } from 'zod';
import { getConfig } from '../env.js';
import { acquireLock, clearLocalClaims, type LockAcquireOutcome } from '../lib/lock.js';

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
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'replayed' | 'store_unreachable' };

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
 * Tracks spent nonces so a token works exactly once — on a SHARED store, not
 * a process-local Map, per `oracle/AGENTS.md` item 79 / `RUNBOOK.md` Round
 * 119: a websocket is pinned to one process for its whole life, but the
 * VERIFICATION that burns the nonce happens at connection time, before that
 * pinning exists — on N>1 replicas a second socket for a replayed token could
 * land on a DIFFERENT process than the first and find an empty local Map.
 *
 * ── WHY THIS FAILS CLOSED ON "THE STORE COULD NOT CONFIRM EITHER WAY" ───────
 *
 * `lib/lock.ts` reports `unreachable` neutrally and leaves the decision here,
 * on purpose (see that file's header comment). This call site chooses the
 * SAME posture as `ws/server.ts`'s session-exclusivity lock, for the same
 * reason, and the two are meant to be read together: a jti that might already
 * be spent is exactly the kind of ambiguity that feeds the failure this whole
 * migration exists to prevent (a second, independent `TutorOrchestrator` for
 * one session — duplicate paid model calls, a corrupted transcript row
 * count). Treating "can't confirm" as "assume unused" would silently accept
 * that risk. §1.14's own precedent points the other way for a CORRECTNESS
 * control: `getLearningStatsForUpdate` returning zeros on a transient failure
 * (instead of refusing) is the exact shape of bug this guards against —
 * defaulting toward "proceed" on an unconfirmed read. The cost is a session
 * that cannot START or RESUME during a genuine Redis outage — not a session
 * that drops or a healthcheck that fails; `GET /health` has never depended on
 * Redis and still does not (§1.14's "Liveness must not depend on optional
 * infrastructure").
 *
 * ── WHY THIS IS SAFE TO CALL ON EVERY CONNECTION, NOT JUST WHEN N>1 ─────────
 *
 * In test/dev (`isTestOrDev`), `lib/lock.ts` backs this with a real in-process
 * Map — semantically identical to the old `NonceLedger`, so single-replica
 * behavior (today's actual deployment) is completely unchanged. Only
 * production, with Redis actually reachable, gets the cross-process
 * guarantee; only a genuine production Redis outage gets the refusal.
 */
const NONCE_KEY_PREFIX = 'oracle:lock:jti:';

/** Returns false if this nonce was already used OR the store could not confirm it was not — see the header comment for why those are the same answer here. */
async function consumeNonce(jti: string, expiresAtMs: number, now: number): Promise<LockAcquireOutcome> {
  // The claim's own TTL is the nonce's remaining validity: once the token
  // itself has expired, replaying it is refused by `exp` above regardless,
  // so nothing is lost by letting the claim expire on the same clock instead
  // of tracking it forever. Floored at 1s so an already-expired-by-the-time-
  // -we-get-here token (a slow request, a clock skew) never asks for a
  // zero-or-negative TTL.
  const ttlMs = Math.max(1_000, expiresAtMs - now);
  return acquireLock(NONCE_KEY_PREFIX + jti, ttlMs);
}

export const nonceLedger = {
  consume: consumeNonce,
  /** Test seam — see `clearLocalClaims`'s own comment for why this is scoped and LOCAL-only. */
  clear(): void {
    clearLocalClaims(NONCE_KEY_PREFIX);
  },
};

/**
 * Verifies and burns a token.
 *
 * The signature is compared in constant time on fixed-width digests, for the
 * §1.14 reason: a length pre-check on a raw string throws RangeError on any
 * multi-byte character, turning a forged token into a 500 instead of a 401.
 */
export async function verifySessionToken(token: string, now = Date.now()): Promise<TokenVerdict> {
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

  const claimed: LockAcquireOutcome = await nonceLedger.consume(payload.data.jti, payload.data.exp * 1000, now);
  if (!claimed.ok) {
    // `held` is a genuine replay: something already burned this exact jti.
    // `unreachable` is a DIFFERENT fact — the store could not say either way
    // — and reusing "replayed" for it would misreport a Redis outage as an
    // attack in every log line. See `consumeNonce`'s header comment for why
    // both still refuse the connection (fail closed), just under distinct,
    // honest names.
    return { ok: false, reason: claimed.reason === 'unreachable' ? 'store_unreachable' : 'replayed' };
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
