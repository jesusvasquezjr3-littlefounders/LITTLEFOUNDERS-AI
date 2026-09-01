import { getConfig, isTestOrDev } from '../env.js';
import { redisClient } from '../lib/redis.js';
import { withTimeout } from '../lib/http.js';

/*
 * ORACLE.md §15.2 item 3 — the websocket handshake has no rate limit of its
 * own.
 *
 * `middleware/rateLimit.ts`'s `globalRateLimiter` never sees this path: the
 * `WebSocketServer` in `ws/server.ts`'s `attachTutorSocket` is attached
 * directly to the raw HTTP server (`{ server: httpServer, path: '/ws/tutor' }`),
 * so the upgrade never enters Express at all. Token minting (Core-side,
 * ORACLE.md §15's "what holds" list) already bounds an UNAUTHENTICATED flood —
 * nothing without a valid, unused, unexpired session token gets past gate 3 in
 * `handleConnection` — but that leaves the handshake PATH itself unbounded:
 * the TCP+TLS+HTTP-upgrade cost of every attempt, valid token or not. This is
 * defence in depth for a control that already works, not the primary defence.
 *
 * NOT `express-rate-limit`'s `Store` interface (the one `globalRateLimiter`
 * uses via `RedisStore`/`MemoryStore`). That type's `init(options)` wants the
 * whole middleware `Options` bag — it is built to be driven by `rateLimit()`
 * itself inside an Express request/response cycle, and there is neither here.
 * Forcing it to work outside that cycle would trade a five-line counter for an
 * awkward adapter. What IS reused, deliberately, is the CONVENTION
 * `middleware/rateLimit.ts` already established: memory-backed in test/dev
 * (so this is exercised by a real test without a live Redis — the same reason
 * that file swaps to `MemoryStore` there) and Redis-backed in production, on
 * the one connection `lib/redis.ts` already owns. It FAILS OPEN on any store
 * error: this is an AVAILABILITY control, not an authorization one (§1.14),
 * and an unreachable Redis must never be able to refuse every connection to
 * the one process serving everybody.
 */

const COMMAND_TIMEOUT_MS = 250;

/**
 * Per-process fallback, used only when `isTestOrDev` — see the file comment.
 * Never consulted in production, where Redis backs this instead.
 */
const memoryHits = new Map<string, { count: number; resetAtMs: number }>();

/**
 * Test-only: a suite shares this process across many `it()` blocks, so one
 * test's bucket must not leak into the next. Mirrors `nonceLedger.clear()`
 * (session/token.ts) and `finalizeAllParked()` (ws/server.ts), which exist as
 * exported test hooks for the identical reason.
 */
export function resetHandshakeRateLimitForTests(): void {
  memoryHits.clear();
}

function incrementInMemory(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || entry.resetAtMs <= now) {
    memoryHits.set(key, { count: 1, resetAtMs: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

/**
 * Atomically increments `key` in Redis, setting the window's expiry on the
 * FIRST hit only — a classic fixed-window counter. `null` means the count
 * could not be obtained (unreachable Redis or a slow command), and the caller
 * must treat that as "allow" — see the file comment.
 *
 * Best-effort on the expiry: a crash between INCR and EXPIRE leaves that one
 * key counting forever instead of resetting on schedule, which only makes a
 * single window too strict for one IP, never unsafe — not worth a transaction
 * for a control whose entire job is protecting availability.
 */
async function incrementInRedis(key: string, windowSeconds: number): Promise<number | null> {
  if (!redisClient.isOpen) return null;
  try {
    const count = await withTimeout(redisClient.incr(key), COMMAND_TIMEOUT_MS, 'redis incr');
    if (count === 1) void redisClient.expire(key, windowSeconds).catch(() => {});
    return count;
  } catch {
    return null;
  }
}

/**
 * Whether `ip` has exceeded the handshake attempt budget for the current
 * window. Fails OPEN (`false`) whenever the count cannot be determined.
 */
export async function isHandshakeRateLimited(ip: string): Promise<boolean> {
  const { ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX, ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS } = getConfig();
  const key = `ws-handshake:${ip}`;

  const count = isTestOrDev
    ? incrementInMemory(key, ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS)
    : await incrementInRedis(key, Math.ceil(ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS / 1000));

  if (count === null) return false;
  return count > ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX;
}
