import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * `lib/lock.ts` in isolation — the primitive `oracle/AGENTS.md` item 79 /
 * `RUNBOOK.md` Round 119 asked for: a cross-process claim with an honest
 * "unreachable" answer (never silently a miss, unlike `redisGet`/
 * `redisSetEx`), and renew/release that can never touch a DIFFERENT owner's
 * claim. The Lua script itself was also verified once, by hand, against a
 * real Redis container before this file existed (not part of this suite —
 * see the session's own notes) — what belongs in the automated suite is the
 * CONTRACT: exactly what every caller (the jti ledger, the session-exclusivity
 * lock) is relying on.
 */

/** A minimal, REAL (not string-matched) fake of the one Redis surface `lib/lock.ts` touches. */
function fakeRedisClient(isOpen = true) {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const read = (key: string): string | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  };
  return {
    isOpen,
    store,
    set: vi.fn(async (key: string, value: string, opts?: { NX?: boolean; PX?: number }) => {
      if (opts?.NX && read(key) !== null) return null;
      store.set(key, { value, expiresAt: Date.now() + (opts?.PX ?? Number.POSITIVE_INFINITY) });
      return 'OK';
    }),
    // Mirrors COMPARE_AND_ACT_SCRIPT's own semantics exactly (compare owner,
    // then PEXPIRE or DEL) — a real interpreter would be more general than
    // this needs to be; the actual Lua text was verified separately.
    eval: vi.fn(async (_script: string, opts: { keys: string[]; arguments: string[] }) => {
      const [key] = opts.keys;
      const [owner, ttlArg] = opts.arguments;
      if (read(key) !== owner) return 0;
      const ttl = Number(ttlArg);
      if (ttl > 0) store.set(key, { value: owner, expiresAt: Date.now() + ttl });
      else store.delete(key);
      return 1;
    }),
  };
}

describe('redisAcquireLock / redisRenewLock / redisReleaseLock — the Redis-backed primitive', () => {
  afterEach(() => {
    vi.doUnmock('../lib/redis.js');
    vi.resetModules();
  });

  it('acquires a free key and reports the owner it minted', async () => {
    const client = fakeRedisClient();
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock } = await import('../lib/lock.js');

    const result = await redisAcquireLock('k1', 5_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.owner).toBe('string');
    expect(client.set).toHaveBeenCalledWith('k1', expect.any(String), { NX: true, PX: 5_000 });
  });

  it('refuses a key that is already held, with reason "held"', async () => {
    const client = fakeRedisClient();
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock } = await import('../lib/lock.js');

    await redisAcquireLock('k1', 5_000);
    const second = await redisAcquireLock('k1', 5_000);
    expect(second).toEqual({ ok: false, reason: 'held' });
  });

  it('reports "unreachable" — never throws, never a silent miss — when the client is not open', async () => {
    const client = fakeRedisClient(false);
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock } = await import('../lib/lock.js');

    const result = await redisAcquireLock('k1', 5_000);
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
    // Never even attempted the command — matching redisGet/redisSetEx's own isOpen guard.
    expect(client.set).not.toHaveBeenCalled();
  });

  it('reports "unreachable" when the command itself throws', async () => {
    const client = fakeRedisClient();
    client.set.mockRejectedValueOnce(new Error('ECONNRESET'));
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock } = await import('../lib/lock.js');

    const result = await redisAcquireLock('k1', 5_000);
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('the TRUE owner can renew — the TTL is actually extended', async () => {
    const client = fakeRedisClient();
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock, redisRenewLock } = await import('../lib/lock.js');

    const acquired = await redisAcquireLock('k1', 100);
    if (!acquired.ok) throw new Error('setup failed');
    const renewed = await redisRenewLock('k1', acquired.owner, 10_000);
    expect(renewed).toBe(true);
    expect(client.store.get('k1')?.expiresAt).toBeGreaterThan(Date.now() + 5_000);
  });

  /*
   * THE ASSERTION THAT MATTERS MOST IN THIS FILE. A plain GET-then-SET from
   * JS (no Lua) would have a window where a DIFFERENT owner's legitimate
   * claim (acquired between our GET and our SET) gets silently overwritten —
   * exactly the correctness property a lock exists for. Proven here by
   * constructing exactly that scenario: owner A's claim expires, owner B
   * legitimately acquires the same key, and owner A's (now-stale) renew must
   * be a complete no-op against B's claim.
   */
  it('a non-owner renew NEVER touches a different owner\'s claim, even after that owner naturally expired and someone else acquired', async () => {
    const client = fakeRedisClient();
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock, redisRenewLock } = await import('../lib/lock.js');

    const ownerA = await redisAcquireLock('k1', 10);
    if (!ownerA.ok) throw new Error('setup failed');
    await new Promise((r) => setTimeout(r, 20)); // let A's claim expire
    const ownerB = await redisAcquireLock('k1', 10_000);
    if (!ownerB.ok) throw new Error('setup failed');

    // A's stale renew must be a no-op — it must NEVER extend or otherwise
    // touch the key B now legitimately owns.
    const staleRenew = await redisRenewLock('k1', ownerA.owner, 10_000);
    expect(staleRenew).toBe(false);
    expect(client.store.get('k1')?.value).toBe(ownerB.owner);
  });

  it('the TRUE owner can release, and the key is actually gone afterward', async () => {
    const client = fakeRedisClient();
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock, redisReleaseLock } = await import('../lib/lock.js');

    const acquired = await redisAcquireLock('k1', 10_000);
    if (!acquired.ok) throw new Error('setup failed');
    await redisReleaseLock('k1', acquired.owner);
    expect(client.store.has('k1')).toBe(false);
  });

  it('a non-owner release is a no-op — the real owner\'s claim survives', async () => {
    const client = fakeRedisClient();
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisAcquireLock, redisReleaseLock } = await import('../lib/lock.js');

    const acquired = await redisAcquireLock('k1', 10_000);
    if (!acquired.ok) throw new Error('setup failed');
    await redisReleaseLock('k1', 'someone-else-entirely');
    expect(client.store.get('k1')?.value).toBe(acquired.owner);
  });

  it('release never throws even when the client is unreachable', async () => {
    const client = fakeRedisClient(false);
    vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
    const { redisReleaseLock } = await import('../lib/lock.js');
    await expect(redisReleaseLock('k1', 'owner')).resolves.toBeUndefined();
  });
});

describe('acquireLock / renewLock / releaseLock — the public entry points (local store, isTestOrDev)', () => {
  const KEY = 'oracle:lock:test:public-entry';

  afterEach(async () => {
    const { clearLocalClaims } = await import('../lib/lock.js');
    clearLocalClaims('oracle:lock:test:');
  });

  it('acquires a free key immediately, with no retry delay', async () => {
    const { acquireLock } = await import('../lib/lock.js');
    const start = Date.now();
    const result = await acquireLock(KEY, 5_000);
    expect(result.ok).toBe(true);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('refuses a key another owner still holds, after the one retry', async () => {
    const { acquireLock } = await import('../lib/lock.js');
    const first = await acquireLock(KEY, 5_000);
    expect(first.ok).toBe(true);

    const start = Date.now();
    const second = await acquireLock(KEY, 5_000);
    expect(second).toEqual({ ok: false, reason: 'held' });
    // The retry actually happened — this took at least the retry delay, it
    // did not fail on the first attempt alone.
    expect(Date.now() - start).toBeGreaterThanOrEqual(140);
  });

  /*
   * THE RACE `RETRY_DELAY_MS` EXISTS FOR: a claim that frees itself DURING
   * the retry window is picked up by the second attempt rather than
   * wrongly refusing a legitimate caller — the "our own just-closed socket"
   * scenario `lock.ts`'s header comment names.
   */
  it('picks up a claim that is released during the retry window', async () => {
    const { acquireLock, releaseLock } = await import('../lib/lock.js');
    const first = await acquireLock(KEY, 5_000);
    if (!first.ok) throw new Error('setup failed');

    // Released shortly after the first attempt fails locally but before the
    // retry fires — inside the 150ms window.
    setTimeout(() => {
      void releaseLock(KEY, first.owner);
    }, 40);

    const second = await acquireLock(KEY, 5_000);
    expect(second.ok).toBe(true);
  });

  it('renewLock only extends a claim its OWNER holds', async () => {
    const { acquireLock, renewLock } = await import('../lib/lock.js');
    const acquired = await acquireLock(KEY, 100);
    if (!acquired.ok) throw new Error('setup failed');

    expect(await renewLock(KEY, 'not-the-owner', 10_000)).toBe(false);
    expect(await renewLock(KEY, acquired.owner, 10_000)).toBe(true);
  });

  it('releaseLock only frees a claim its OWNER holds', async () => {
    const { acquireLock, releaseLock, renewLock } = await import('../lib/lock.js');
    const acquired = await acquireLock(KEY, 10_000);
    if (!acquired.ok) throw new Error('setup failed');

    await releaseLock(KEY, 'not-the-owner');
    // Still held by the real owner — releasing as an impostor did nothing.
    expect(await renewLock(KEY, acquired.owner, 10_000)).toBe(true);

    await releaseLock(KEY, acquired.owner);
    // Actually gone now: a fresh acquire by anyone succeeds.
    const reacquired = await acquireLock(KEY, 5_000);
    expect(reacquired.ok).toBe(true);
  });
});

describe('clearLocalClaims — the test seam is scoped by prefix, on purpose', () => {
  beforeEach(async () => {
    const { clearLocalClaims } = await import('../lib/lock.js');
    clearLocalClaims('oracle:lock:test:');
  });

  /*
   * THE REASON THIS IS SCOPED AT ALL: `nonceLedger.clear()` (jti) and a live
   * session's own exclusivity claim share the SAME local Map in test/dev.
   * `live-session.test.ts`'s `afterEach` calls `nonceLedger.clear()` between
   * every test; if that wiped every local claim indiscriminately, it would
   * also erase a still-open test socket's session-lock claim mid-suite,
   * silently reopening the exact double-connection gap this migration exists
   * to close — invisible to any assertion in THIS file, only ever surfacing
   * as cross-test contamination in a much larger, unrelated suite.
   */
  it('clearing one namespace never touches a different namespace\'s claim', async () => {
    const { acquireLock, clearLocalClaims, renewLock } = await import('../lib/lock.js');
    const jti = await acquireLock('oracle:lock:test:jti:abc', 10_000);
    const session = await acquireLock('oracle:lock:test:session:xyz', 10_000);
    if (!jti.ok || !session.ok) throw new Error('setup failed');

    clearLocalClaims('oracle:lock:test:jti:');

    // The cleared namespace is actually gone: a fresh acquire succeeds.
    expect((await acquireLock('oracle:lock:test:jti:abc', 5_000)).ok).toBe(true);
    // The OTHER namespace's claim is completely untouched.
    expect(await renewLock('oracle:lock:test:session:xyz', session.owner, 5_000)).toBe(true);
  });
});
