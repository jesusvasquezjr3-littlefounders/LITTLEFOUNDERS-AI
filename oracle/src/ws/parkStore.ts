import { randomUUID } from 'node:crypto';
import { isTestOrDev } from '../env.js';
import { withTimeout } from '../lib/http.js';
import { redisClient } from '../lib/redis.js';

/*
 * THE SHARED HALF OF A PARKED SESSION — what lets a dropped learner reconnect
 * onto a DIFFERENT replica and keep the same lesson, the same transcript and
 * the same ledger entry.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 *
 * `ws/server.ts`'s `parkedSessions` holds a dropped session's LIVE
 * `TutorOrchestrator` and `SpeechScope` for `SESSION_RESUME_GRACE_MS`. That
 * map is process memory, and `RUNBOOK.md` Round 142 established it was the
 * last structure pinning Oracle to one replica — and, crucially, that the
 * session lock does NOT already cover it: the close handler releases the
 * claim BEFORE parking (deliberately, so a genuine resume need not wait out
 * `SESSION_LOCK_TTL_MS`), so at N>1 a reconnect landing on replica B acquires
 * the free lock cleanly, finds nothing parked, and builds a SECOND
 * orchestrator with `transcriptSeq` back to 0 — every row then colliding in
 * `tutor_turns` and being dropped in silence by `ignore-duplicates` — while
 * replica A's park timer still wins the `ended_at=is.null` close and B's real
 * billed usage never reaches Core's ledger.
 *
 * ── THE THREE THINGS THIS MODULE OWNS, AND WHY THEY ARE THREE ───────────────
 *
 * 1. THE PARK RECORD (`oracle:park:<sid>`). The versioned snapshot of the
 *    conversation, claimed atomically by whoever resumes. Optional by nature:
 *    a session whose record is missing is degraded, not corrupt.
 * 2. THE PARK'S OWNERSHIP, folded into the same key. The parking replica's
 *    grace timer must not close a session someone else has already resumed,
 *    and "did anyone take this park" is exactly what a compare-and-delete on
 *    this key answers. This is the fleet-owned half of the grace window: the
 *    TIMER stays a local `setTimeout` (a distributed scheduler would be a
 *    great deal of machinery for a question a local clock already answers),
 *    but the AUTHORITY to act on it is this shared record.
 * 3. THE TRANSCRIPT FLOOR (`oracle:seq:<sid>`), and it is deliberately NOT
 *    part of the record. The record can legitimately be absent — it expired,
 *    the parking process crashed, the park was never published because a
 *    graceful close was already in flight — and in every one of those cases a
 *    resumed session must STILL never restart `transcriptSeq` at 0. A
 *    separate monotonic high-water mark, published per row and read at every
 *    connection, makes the silent-collision bug impossible by construction
 *    rather than merely unlikely. It is the backstop the record is not.
 *
 * ── WHY THIS FILE IS NEUTRAL ABOUT FAILURE, LIKE `lib/lock.ts` ──────────────
 *
 * `lib/redis.ts`'s contract is "nothing throws, and every caller treats 'no'
 * as a MISS" — right for a cache, wrong here for the same reason `lock.ts`
 * spells out at length: collapsing "the store said no" into "the store could
 * not be asked" is exactly the §1.14 failure-is-not-emptiness shape. So every
 * function below reports what actually happened and THE CALLER decides. The
 * decisions themselves are written down at each call site in `ws/server.ts`,
 * not here.
 *
 * ── WHY TEST/DEV USES AN IN-PROCESS MAP ─────────────────────────────────────
 *
 * Identical precedent and identical reasoning to `lib/lock.ts`: the automated
 * suite stays hermetic, `npm run dev` boots with no Redis, and the local
 * implementation has the SAME contract rather than a relaxed one. `unreachable`
 * simply never arises against a plain JS Map, so no call site's fail-closed
 * decision is ever silently bypassed in dev — there is no partition to have.
 */

const COMMAND_TIMEOUT_MS = 250;

const PARK_KEY_PREFIX = 'oracle:park:';
const SEQ_KEY_PREFIX = 'oracle:seq:';

/**
 * How long a published park record outlives the grace window it serves.
 *
 * Generous ON PURPOSE, and the direction matters. The parking replica's timer
 * fires at `SESSION_RESUME_GRACE_MS`; if the record could expire FIRST, that
 * timer's compare-and-delete would read "absent" and be unable to tell
 * "somebody resumed this" from "the key simply aged out" — and the
 * conservative reading of that ambiguity (do not close) leaks a session that
 * stays `ended_at IS NULL` in Core forever, with its cost never reaching the
 * ledger. A margin far wider than any plausible timer skew removes the
 * ambiguity instead of teaching the caller to guess at it.
 */
const PARK_RECORD_TTL_MARGIN_MS = 5 * 60_000;

/**
 * How long the transcript floor outlives its session.
 *
 * A session is capped at twenty-five minutes and two a day (/ORACLE.md §15.2),
 * so six hours is several times any real session's life while still being a
 * bounded key rather than a permanent one. It only has to survive longer than
 * the session it protects: once Core has closed the session, no token is ever
 * minted for it again and nothing will ever ask for this floor.
 */
const SEQ_FLOOR_TTL_MS = 6 * 60 * 60_000;

export type ParkClaimOutcome =
  | { ok: true; record: string | null }
  | { ok: false; reason: 'unreachable' };

/**
 * What a parking replica's grace timer learns when it asks whether its own
 * park is still its own.
 *
 * - `owned`    — the record is still ours: nobody resumed, this session really
 *                did end, and this replica is the one that must close it.
 * - `taken`    — the record is gone, or belongs to a LATER park by another
 *                process. Either way somebody else now owns this session's
 *                ending; closing it here would stomp a live conversation.
 * - `unreachable` — the store could not say. A distinct third answer on
 *                purpose: see the call site for which way it decides and why.
 */
export type ParkReleaseOutcome = 'owned' | 'taken' | 'unreachable';

export type SeqFloorOutcome = { ok: true; seq: number } | { ok: false; reason: 'unreachable' };

/**
 * A park record is stored as `<owner>\n<json>` in ONE key rather than as two
 * keys or as JSON with an owner field inside it.
 *
 * One key means the record and its ownership can never disagree, expire apart,
 * or be half-written — the property the whole compare-and-delete rests on. A
 * newline prefix (rather than `cjson.decode` inside the Lua) keeps the
 * ownership check a plain string comparison, which is the one operation that
 * behaves identically in Redis's Lua and in the in-process Map below.
 */
function encodeRecord(owner: string, json: string): string {
  return `${owner}\n${json}`;
}

function decodeRecord(raw: string): { owner: string; json: string } | null {
  const cut = raw.indexOf('\n');
  if (cut <= 0) return null;
  return { owner: raw.slice(0, cut), json: raw.slice(cut + 1) };
}

// ── the Redis-backed implementation ─────────────────────────────────────────

/** Reads and DELETES in one step, so two replicas can never both adopt one park. */
const CLAIM_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v`;

/**
 * 1 = still ours (deleted it); 2 = present but a DIFFERENT owner; 0 = absent.
 * Two and zero are both "not ours any more" to the caller, but they are
 * genuinely different events and the script reports them apart so a log line
 * can say which one happened.
 */
const RELEASE_IF_OWNED_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if not v then return 0 end
local owner = ARGV[1]
if string.sub(v, 1, string.len(owner) + 1) == owner .. '\\n' then
  redis.call('DEL', KEYS[1])
  return 1
end
return 2`;

/** Monotonic: a lower number never lowers the floor, it only refreshes the TTL. */
const RAISE_FLOOR_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local proposed = tonumber(ARGV[1])
if proposed > current then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
else
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 1`;

/*
 * EXPORTED ON THEIR OWN, exactly as `lib/lock.ts` exports `redisAcquireLock`
 * and friends and for the identical reason it gives: the automated suite runs
 * under `isTestOrDev` and therefore NEVER reaches this half, so without a
 * direct seam the mapping from a Redis reply to this module's own three-way
 * outcomes would be unexercised until production. The Lua itself was verified
 * against a real Redis 7 (RUNBOOK Round 143); these tests cover the JS that
 * interprets what it returns, which is the part a future edit can break
 * silently.
 */

export async function redisPublishPark(sessionId: string, json: string, ttlMs: number): Promise<string | null> {
  if (!redisClient.isOpen) return null;
  const owner = randomUUID();
  try {
    await withTimeout(
      redisClient.set(PARK_KEY_PREFIX + sessionId, encodeRecord(owner, json), { PX: ttlMs }),
      COMMAND_TIMEOUT_MS,
      'park publish',
    );
    return owner;
  } catch {
    return null;
  }
}

export async function redisClaimPark(sessionId: string): Promise<ParkClaimOutcome> {
  if (!redisClient.isOpen) return { ok: false, reason: 'unreachable' };
  try {
    const raw = await withTimeout(
      redisClient.eval(CLAIM_SCRIPT, { keys: [PARK_KEY_PREFIX + sessionId] }),
      COMMAND_TIMEOUT_MS,
      'park claim',
    );
    // `null` is Redis saying the key is absent — a real answer, and the common
    // one. Anything else non-string is a reply we do not understand, which is
    // NOT the same as "no park" and must not be reported as one.
    if (raw === null || raw === undefined) return { ok: true, record: null };
    if (typeof raw !== 'string') return { ok: false, reason: 'unreachable' };
    return { ok: true, record: decodeRecord(raw)?.json ?? null };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

export async function redisReleasePark(sessionId: string, owner: string): Promise<ParkReleaseOutcome> {
  if (!redisClient.isOpen) return 'unreachable';
  try {
    const result = await withTimeout(
      redisClient.eval(RELEASE_IF_OWNED_SCRIPT, { keys: [PARK_KEY_PREFIX + sessionId], arguments: [owner] }),
      COMMAND_TIMEOUT_MS,
      'park release',
    );
    return result === 1 ? 'owned' : 'taken';
  } catch {
    return 'unreachable';
  }
}

export function redisRaiseFloor(sessionId: string, seq: number): void {
  if (!redisClient.isOpen) return;
  void withTimeout(
    redisClient.eval(RAISE_FLOOR_SCRIPT, {
      keys: [SEQ_KEY_PREFIX + sessionId],
      arguments: [String(seq), String(SEQ_FLOOR_TTL_MS)],
    }),
    COMMAND_TIMEOUT_MS,
    'seq floor raise',
  ).catch(() => {
    /* See `raiseTranscriptFloor`: a lost raise is absorbed by the next row. */
  });
}

export async function redisReadFloor(sessionId: string): Promise<SeqFloorOutcome> {
  if (!redisClient.isOpen) return { ok: false, reason: 'unreachable' };
  try {
    const raw = await withTimeout(redisClient.get(SEQ_KEY_PREFIX + sessionId), COMMAND_TIMEOUT_MS, 'seq floor read');
    if (raw === null) return { ok: true, seq: 0 };
    const parsed = Number(raw);
    /*
     * A key we cannot parse is NOT a zero floor. That default is the exact
     * "failure collapsed into emptiness" shape §1.14 forbids, and here it
     * would silently reopen the transcript-collision bug the floor exists to
     * close — a resumed session would start numbering at 1 over rows that
     * already exist, and `ignore-duplicates` would delete them without a word.
     */
    if (!Number.isFinite(parsed) || parsed < 0) return { ok: false, reason: 'unreachable' };
    return { ok: true, seq: Math.floor(parsed) };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

// ── the in-process implementation — test/dev only, same contract ────────────

interface LocalEntry {
  value: string;
  expiresAt: number;
}

const localStore = new Map<string, LocalEntry>();

function localRead(key: string): string | null {
  const entry = localStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localStore.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Test seam, and the ONLY way to empty this store. Deliberately has no
 * production equivalent, for the same reason `lib/lock.ts`'s
 * `clearLocalClaims` does not: a shared store has no cheap "clear
 * everything", and TTL expiry is the only backstop that exists in prod.
 */
export function clearLocalParkStore(): void {
  localStore.clear();
}

function localPublishPark(sessionId: string, json: string, ttlMs: number): string {
  const owner = randomUUID();
  localStore.set(PARK_KEY_PREFIX + sessionId, {
    value: encodeRecord(owner, json),
    expiresAt: Date.now() + ttlMs,
  });
  return owner;
}

function localClaimPark(sessionId: string): ParkClaimOutcome {
  const key = PARK_KEY_PREFIX + sessionId;
  const raw = localRead(key);
  localStore.delete(key);
  return { ok: true, record: raw === null ? null : (decodeRecord(raw)?.json ?? null) };
}

function localReleasePark(sessionId: string, owner: string): ParkReleaseOutcome {
  const key = PARK_KEY_PREFIX + sessionId;
  const raw = localRead(key);
  if (raw === null || decodeRecord(raw)?.owner !== owner) return 'taken';
  localStore.delete(key);
  return 'owned';
}

function localRaiseFloor(sessionId: string, seq: number): void {
  const key = SEQ_KEY_PREFIX + sessionId;
  if (seq > Number(localRead(key) ?? '0')) {
    localStore.set(key, { value: String(seq), expiresAt: Date.now() + SEQ_FLOOR_TTL_MS });
  }
}

function localReadFloor(sessionId: string): SeqFloorOutcome {
  return { ok: true, seq: Number(localRead(SEQ_KEY_PREFIX + sessionId) ?? '0') };
}

// ── the public entry points ─────────────────────────────────────────────────

/**
 * Publishes a park so another replica can adopt it, returning the owner token
 * the parking replica must keep in order to reclaim or release it.
 *
 * `null` means the record did not land — an expected, survivable outcome (the
 * store is down). The caller keeps its LOCAL park either way, so a
 * same-replica resume is completely unaffected by this failing; what is lost
 * is only the ability for a DIFFERENT replica to take over.
 */
export function publishParkedSession(sessionId: string, json: string, graceMs: number): Promise<string | null> {
  const ttlMs = graceMs + PARK_RECORD_TTL_MARGIN_MS;
  return isTestOrDev
    ? Promise.resolve(localPublishPark(sessionId, json, ttlMs))
    : redisPublishPark(sessionId, json, ttlMs);
}

/**
 * Atomically takes the park record for `sessionId`, if there is one.
 *
 * `{ ok: true, record: null }` and `{ ok: false, reason: 'unreachable' }` are
 * deliberately different answers: the first says this session has no parked
 * conversation waiting (an ordinary first connection), the second says we
 * could not find out. Collapsing them is the §1.14 mistake this whole module
 * is shaped around.
 */
export function claimParkedSession(sessionId: string): Promise<ParkClaimOutcome> {
  return isTestOrDev ? Promise.resolve(localClaimPark(sessionId)) : redisClaimPark(sessionId);
}

/**
 * Asks whether this replica's own park is still its own, and drops it if so.
 *
 * This is what makes the grace timer safe at N>1 without a distributed
 * scheduler: every replica that parked keeps its own local timer, and only the
 * one still holding the record is allowed to end the session.
 */
export function releaseParkIfOwned(sessionId: string, owner: string): Promise<ParkReleaseOutcome> {
  return isTestOrDev
    ? Promise.resolve(localReleasePark(sessionId, owner))
    : redisReleasePark(sessionId, owner);
}

/**
 * Raises this session's transcript high-water mark. Fire-and-forget by
 * design: it is called once per transcript row, on the live turn path, and
 * the learner must never wait on it. A lost write costs nothing on its own —
 * the NEXT row raises the floor past it, and the floor is only ever read at
 * connection time.
 */
export function raiseTranscriptFloor(sessionId: string, seq: number): void {
  if (isTestOrDev) localRaiseFloor(sessionId, seq);
  else redisRaiseFloor(sessionId, seq);
}

/**
 * The highest transcript row number this session is known to have written,
 * from any replica. `0` means "this session has written nothing yet", which
 * is a real and common answer (every first connection); `unreachable` means
 * we could not ask, which is a different one.
 */
export function readTranscriptFloor(sessionId: string): Promise<SeqFloorOutcome> {
  return isTestOrDev ? Promise.resolve(localReadFloor(sessionId)) : redisReadFloor(sessionId);
}
