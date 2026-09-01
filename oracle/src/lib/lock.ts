import { randomUUID } from 'node:crypto';
import { isTestOrDev } from '../env.js';
import { withTimeout } from './http.js';
import { redisClient } from './redis.js';

/*
 * A DISTRIBUTED MUTUAL-EXCLUSION CLAIM — deliberately its own file, not a
 * third helper bolted onto `redis.ts`.
 *
 * `redis.ts`'s own header comment is a contract every caller relies on:
 * "Nothing here throws. Both helpers answer 'no' on any failure, and every
 * caller must treat 'no' as a MISS rather than as an error." That is exactly
 * right for a cache or a rate limiter (§1.14: an availability control fails
 * OPEN, because a degraded limiter must never be able to take the platform
 * down) and exactly wrong for a lock, whose entire job is to be trustworthy
 * on failure — and there is no single right answer to "the store is
 * unreachable" that works for every lock. `oracle/AGENTS.md` item 79 /
 * `RUNBOOK.md` Round 119 found this precisely: retrofitting `redisGet`/
 * `redisSetEx` as-is into a lock would silently inherit "unreachable → miss →
 * proceed" (fail OPEN) without anyone deciding that was right for THIS
 * control. So this module reports what actually happened — acquired, held by
 * someone else, or the store could not confirm either — and stays neutral.
 * THE CALLER decides what "unreachable" means for its own stakes, at its own
 * call site, in a comment that says so (see `session/token.ts`'s
 * `nonceLedger.consume` and `ws/server.ts`'s session-lock call site — both
 * chose fail CLOSED, for the same reasoning, written down at each one).
 *
 * ── WHY A CLAIM HAS A TTL AND IS RENEWED, NOT HELD FOREVER ──────────────────
 *
 * Round 119 point 4: `oracle/railway.json`'s `restartPolicyMaxRetries: 10`
 * treats crash-and-restart as routine, and TODAY a crash simply erases the
 * crashed process's in-memory state with it, so a legitimate resume against
 * the freshly-restarted (necessarily empty) process succeeds immediately. A
 * claim with NO expiry would regress that: it would outlive the crashed
 * process that held it, and a legitimate resume could be refused for as long
 * as the claim survives. A claim with a short TTL, renewed periodically by
 * whoever holds it, keeps the crash-restart case ALMOST as good as today
 * (bounded by one TTL window instead of instant) while still closing the
 * actual gap this exists for: two DIFFERENT processes can never both believe
 * they hold the same key at the same time.
 *
 * ── WHY TEST/DEV USES AN IN-PROCESS MAP, NOT A MOCKED REDIS ─────────────────
 *
 * Same precedent as `middleware/rateLimit.ts` (`MemoryStore` in test/dev,
 * `RedisStore` in production) — and the same reasoning: `npm run dev` boots
 * "with no provider keys at all" (`README.md`) and the automated suite must
 * stay hermetic. This is NOT "fail open in dev" — the local implementation
 * below has the IDENTICAL acquire/renew/release contract as the Redis one,
 * correct by construction, for a runtime where only one process will ever
 * exist. `unreachable` (the condition each call site's fail-closed decision
 * actually cares about) simply never arises against a plain JS Map, so the
 * fail-closed policy is never silently bypassed in dev — it has nothing to
 * fire on, because there is no network partition to have. The REDIS-BACKED
 * functions are exported on their own (`redisAcquireLock`/`redisRenewLock`/
 * `redisReleaseLock`) precisely so they can be unit-tested directly against a
 * mocked `lib/redis.js`, the same way `speech.test.ts` already does — see
 * `lock.test.ts`.
 */

const COMMAND_TIMEOUT_MS = 250;
/**
 * One bounded retry, after a short delay, on anything short of a clean
 * acquire. Two different races both resolve within this window and neither
 * has any other affordance:
 *
 *   - OUR OWN just-closed socket. `release()` at socket-close is
 *     fire-and-forget (a `close` event handler cannot make its emitter await
 *     it), so a resume racing in within single-digit milliseconds of a drop
 *     can see the outgoing socket's claim as still `held` even though it is
 *     already on its way out. `ALREADY_CONNECTED` is a TERMINAL message on
 *     the client (`useTutorSocket.ts`: "check your other tab or device") —
 *     it does not invite the user to retry — so a false positive here is not
 *     self-healing on its own and is worth one bounded retry to avoid.
 *   - A momentary Redis hiccup. A blip well under this window resolves
 *     itself on the retry rather than refusing a session over it.
 *
 * A GENUINE conflict (another replica's socket really is live, or Redis is
 * genuinely down) is unchanged by the retry — it fails the second attempt
 * exactly as it failed the first, just 150ms later.
 */
const RETRY_DELAY_MS = 150;

export type LockAcquireOutcome =
  | { ok: true; owner: string }
  | { ok: false; reason: 'held' | 'unreachable' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── the Redis-backed implementation — always the real client, independently testable ──

/** One attempt, no retry. `acquireLock` (below) is the retrying public entry point. */
export async function redisAcquireLock(key: string, ttlMs: number): Promise<LockAcquireOutcome> {
  if (!redisClient.isOpen) return { ok: false, reason: 'unreachable' };
  const owner = randomUUID();
  try {
    const result = await withTimeout(
      redisClient.set(key, owner, { NX: true, PX: ttlMs }),
      COMMAND_TIMEOUT_MS,
      'redis lock acquire',
    );
    return result === 'OK' ? { ok: true, owner } : { ok: false, reason: 'held' };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

/*
 * ONE script serves both renew and release — a Lua `EVAL` is the only way to
 * make "check the owner, THEN act" atomic (a plain GET-then-SET/DEL from JS
 * has a window in which a DIFFERENT owner could legitimately acquire the key
 * in between, and the second command would then stomp THEIR claim instead of
 * ours — see `lock.test.ts`'s "never touches a different owner's claim"
 * tests, verified against a real Redis before this shipped). `ttlMs > 0`
 * means renew (extend); `ttlMs === 0` means release (delete). One script
 * halves the surface area to get right rather than two nearly-identical ones.
 */
const COMPARE_AND_ACT_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  if tonumber(ARGV[2]) > 0 then
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])
  else
    return redis.call('DEL', KEYS[1])
  end
else
  return 0
end`;

async function redisCompareAndAct(key: string, owner: string, ttlMs: number): Promise<boolean> {
  if (!redisClient.isOpen) return false;
  try {
    const result = await withTimeout(
      redisClient.eval(COMPARE_AND_ACT_SCRIPT, { keys: [key], arguments: [owner, String(ttlMs)] }),
      COMMAND_TIMEOUT_MS,
      'redis lock compare-and-act',
    );
    return result === 1;
  } catch {
    return false;
  }
}

/** Extends an OWNED claim's TTL. False if we no longer hold it (expired, or Redis unreachable) — never throws, and a caller must treat false as "the claim may be gone," not retry forever. */
export function redisRenewLock(key: string, owner: string, ttlMs: number): Promise<boolean> {
  return redisCompareAndAct(key, owner, ttlMs);
}

/** Releases an OWNED claim immediately. Never throws — a failed release just waits out the TTL, the same outcome as a crash (see header comment). */
export async function redisReleaseLock(key: string, owner: string): Promise<void> {
  await redisCompareAndAct(key, owner, 0);
}

// ── the in-process implementation — test/dev only, see header comment ──

interface LocalClaim {
  owner: string;
  expiresAt: number;
}

const localClaims = new Map<string, LocalClaim>();

function localRead(key: string, now: number): LocalClaim | null {
  const entry = localClaims.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    localClaims.delete(key);
    return null;
  }
  return entry;
}

/**
 * `localRead`'s own lazy expiry only ever cleans the ONE key being read — a
 * claim nobody asks about again (the ordinary case for a jti, consumed
 * exactly once and never looked up under that exact key afterward) would sit
 * in the Map forever in a long-running `npm run dev` process. Mirrors the
 * original in-process `NonceLedger`'s own size-triggered sweep, which existed
 * for exactly this reason and would otherwise have been quietly lost in this
 * migration.
 */
function sweepExpiredLocalClaims(now: number): void {
  if (localClaims.size < 512) return;
  for (const [key, entry] of localClaims) {
    if (entry.expiresAt <= now) localClaims.delete(key);
  }
}

function localAcquireOnce(key: string, ttlMs: number): LockAcquireOutcome {
  const now = Date.now();
  sweepExpiredLocalClaims(now);
  if (localRead(key, now)) return { ok: false, reason: 'held' };
  const owner = randomUUID();
  localClaims.set(key, { owner, expiresAt: now + ttlMs });
  return { ok: true, owner };
}

function localCompareAndAct(key: string, owner: string, ttlMs: number): boolean {
  const now = Date.now();
  const entry = localRead(key, now);
  if (!entry || entry.owner !== owner) return false;
  if (ttlMs > 0) localClaims.set(key, { owner, expiresAt: now + ttlMs });
  else localClaims.delete(key);
  return true;
}

/**
 * Test seam. Clears only LOCAL claims whose key starts with `prefix` —
 * callers namespace their keys (`oracle:lock:jti:`, `oracle:lock:session:`)
 * precisely so one caller's test cleanup (e.g. `nonceLedger.clear()` between
 * tests) can never wipe a DIFFERENT caller's still-live claim (a live
 * session's own exclusivity lock, mid-test). There is deliberately no
 * production equivalent — a shared store has no cheap "clear everything," and
 * TTL expiry is the only backstop that exists (or should exist) in prod.
 */
export function clearLocalClaims(prefix: string): void {
  for (const key of [...localClaims.keys()]) {
    if (key.startsWith(prefix)) localClaims.delete(key);
  }
}

// ── the public entry points — one policy (retry-once), one contract, two backing stores ──

async function acquireOnce(key: string, ttlMs: number): Promise<LockAcquireOutcome> {
  return isTestOrDev ? Promise.resolve(localAcquireOnce(key, ttlMs)) : redisAcquireLock(key, ttlMs);
}

/** Attempts to claim `key` exclusively for `ttlMs`, retrying once after a short delay — see `RETRY_DELAY_MS`'s comment for exactly what that buys and what it does not. */
export async function acquireLock(key: string, ttlMs: number): Promise<LockAcquireOutcome> {
  const first = await acquireOnce(key, ttlMs);
  if (first.ok) return first;
  await sleep(RETRY_DELAY_MS);
  return acquireOnce(key, ttlMs);
}

/** Extends an OWNED claim. See `redisRenewLock`'s comment — the contract is identical across both backing stores. */
export function renewLock(key: string, owner: string, ttlMs: number): Promise<boolean> {
  return isTestOrDev ? Promise.resolve(localCompareAndAct(key, owner, ttlMs)) : redisRenewLock(key, owner, ttlMs);
}

/** Releases an OWNED claim. See `redisReleaseLock`'s comment — never throws either way. */
export async function releaseLock(key: string, owner: string): Promise<void> {
  if (isTestOrDev) {
    localCompareAndAct(key, owner, 0);
    return;
  }
  await redisReleaseLock(key, owner);
}
