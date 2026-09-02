import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * `ws/parkStore.ts` in isolation — the shared half of a parked session
 * (`RUNBOOK.md` Round 143).
 *
 * TWO halves, tested for different things. The LOCAL implementation is what
 * `npm run dev` and every other suite in this repo actually run, so its
 * contract is tested directly. The REDIS implementation is what PRODUCTION
 * runs and what no other test in this repo can reach (everything else is under
 * `isTestOrDev`), so it is exercised here through a mocked client — which is
 * precisely why `redisPublishPark` and friends are exported on their own, the
 * same seam and the same reasoning as `lib/lock.ts`'s `redisAcquireLock`.
 *
 * The Lua text itself was verified separately against a real Redis 7 container
 * — 23 assertions, twice, recorded in RUNBOOK Round 143. What belongs in the
 * automated suite is the CONTRACT every call site in `ws/server.ts` relies on,
 * above all the one §1.14 keeps naming: "the store said no" and "the store
 * could not be asked" must never be the same answer.
 */

/** A minimal, REAL (not string-matched) fake of the Redis surface this module touches. */
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
    get: vi.fn(async (key: string) => read(key)),
    set: vi.fn(async (key: string, value: string, opts?: { PX?: number }) => {
      store.set(key, { value, expiresAt: Date.now() + (opts?.PX ?? Number.POSITIVE_INFINITY) });
      return 'OK';
    }),
    /*
     * Mirrors the three scripts' own semantics, chosen by which arguments
     * arrive — a real Lua interpreter would be far more general than this
     * needs to be, and the actual script text was verified separately.
     */
    eval: vi.fn(async (script: string, opts: { keys: string[]; arguments?: string[] }) => {
      const key = opts.keys[0] as string;
      const args = opts.arguments ?? [];
      if (script.includes("redis.call('DEL', KEYS[1]) end")) {
        // CLAIM: get + delete.
        const value = read(key);
        if (value !== null) store.delete(key);
        return value;
      }
      if (script.includes('PEXPIRE')) {
        // RAISE FLOOR: monotonic max.
        const current = Number(read(key) ?? '0');
        const proposed = Number(args[0]);
        if (proposed > current) store.set(key, { value: String(proposed), expiresAt: Date.now() + Number(args[1]) });
        return 1;
      }
      // RELEASE IF OWNED: compare the owner prefix, then delete.
      const value = read(key);
      if (value === null) return 0;
      if (!value.startsWith(`${args[0] as string}\n`)) return 2;
      store.delete(key);
      return 1;
    }),
  };
}

async function withFakeRedis<T>(
  client: ReturnType<typeof fakeRedisClient>,
  run: (mod: typeof import('../ws/parkStore.js')) => Promise<T>,
): Promise<T> {
  vi.doMock('../lib/redis.js', () => ({ redisClient: client }));
  vi.resetModules();
  try {
    return await run(await import('../ws/parkStore.js'));
  } finally {
    vi.doUnmock('../lib/redis.js');
    vi.resetModules();
  }
}

describe('the Redis-backed park store — the half production actually runs', () => {
  afterEach(() => {
    vi.doUnmock('../lib/redis.js');
    vi.resetModules();
  });

  it('publishes a record and hands back an owner token that claims it', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      const owner = await park.redisPublishPark('s1', '{"turns":2}', 60_000);
      expect(owner).toBeTruthy();
      expect(await park.redisClaimPark('s1')).toEqual({ ok: true, record: '{"turns":2}' });
    });
  });

  it('claims ATOMICALLY — a second replica finds nothing left to adopt', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      await park.redisPublishPark('s1', '{"a":1}', 60_000);
      expect(await park.redisClaimPark('s1')).toEqual({ ok: true, record: '{"a":1}' });
      expect(await park.redisClaimPark('s1')).toEqual({ ok: true, record: null });
    });
  });

  it('distinguishes "nothing parked" from "could not ask" — the §1.14 line', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      expect(await park.redisClaimPark('never-parked')).toEqual({ ok: true, record: null });
    });
    await withFakeRedis(fakeRedisClient(false), async (park) => {
      expect(await park.redisClaimPark('never-parked')).toEqual({ ok: false, reason: 'unreachable' });
    });
  });

  it('releases only the TRUE owner’s park, and never a stranger’s', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      const owner = (await park.redisPublishPark('s1', '{"a":1}', 60_000)) as string;
      // The grace timer of a replica that does NOT own this park must be told
      // 'taken' — closing the session here is the ledger stomp Round 142 traced.
      expect(await park.redisReleasePark('s1', 'someone-else')).toBe('taken');
      // …and the real record must survive that attempt untouched.
      expect(await park.redisReleasePark('s1', owner)).toBe('owned');
      expect(await park.redisClaimPark('s1')).toEqual({ ok: true, record: null });
    });
  });

  it('reports an ADOPTED park as taken, so its old replica declines to close it', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      const owner = (await park.redisPublishPark('s1', '{"a":1}', 60_000)) as string;
      await park.redisClaimPark('s1'); // another replica adopts it
      expect(await park.redisReleasePark('s1', owner)).toBe('taken');
    });
  });

  it('keeps a record containing newlines intact — the owner prefix is not a parser', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      const json = JSON.stringify({ text: 'line one\nline two\n' });
      await park.redisPublishPark('s1', json, 60_000);
      expect(await park.redisClaimPark('s1')).toEqual({ ok: true, record: json });
    });
  });

  it('raises the transcript floor monotonically and never lowers it', async () => {
    await withFakeRedis(fakeRedisClient(), async (park) => {
      expect(await park.redisReadFloor('s1')).toEqual({ ok: true, seq: 0 });
      park.redisRaiseFloor('s1', 5);
      await Promise.resolve();
      expect(await park.redisReadFloor('s1')).toEqual({ ok: true, seq: 5 });
      park.redisRaiseFloor('s1', 3);
      await Promise.resolve();
      expect(await park.redisReadFloor('s1')).toEqual({ ok: true, seq: 5 });
      park.redisRaiseFloor('s1', 9);
      await Promise.resolve();
      expect(await park.redisReadFloor('s1')).toEqual({ ok: true, seq: 9 });
    });
  });

  it('refuses an UNPARSEABLE floor rather than reporting it as zero', async () => {
    /*
     * The single most dangerous default in this module. A zero floor tells a
     * resuming socket "this session has written nothing", so it starts
     * numbering at 1 over rows that already exist — and `tutor_turns`'
     * `ignore-duplicates` deletes them without a word. Whatever a corrupt key
     * means, it does not mean that.
     */
    const client = fakeRedisClient();
    client.store.set('oracle:seq:s1', { value: 'not-a-number', expiresAt: Date.now() + 60_000 });
    await withFakeRedis(client, async (park) => {
      expect(await park.redisReadFloor('s1')).toEqual({ ok: false, reason: 'unreachable' });
    });
  });

  it('reports unreachable — not a false negative — on every entry point when the store is down', async () => {
    await withFakeRedis(fakeRedisClient(false), async (park) => {
      expect(await park.redisPublishPark('s1', '{}', 60_000)).toBeNull();
      expect(await park.redisClaimPark('s1')).toEqual({ ok: false, reason: 'unreachable' });
      expect(await park.redisReleasePark('s1', 'owner')).toBe('unreachable');
      expect(await park.redisReadFloor('s1')).toEqual({ ok: false, reason: 'unreachable' });
      // …and the fire-and-forget raise simply does nothing, without throwing:
      // it runs on the live turn path and must never be able to break a turn.
      expect(() => park.redisRaiseFloor('s1', 4)).not.toThrow();
    });
  });

  it('treats a reply it does not understand as unreachable, never as "no park"', async () => {
    const client = fakeRedisClient();
    client.eval = vi.fn(async () => 12345 as unknown as string);
    await withFakeRedis(client, async (park) => {
      expect(await park.redisClaimPark('s1')).toEqual({ ok: false, reason: 'unreachable' });
    });
  });

  it('reports unreachable when a command throws or times out', async () => {
    const client = fakeRedisClient();
    client.eval = vi.fn(async () => {
      throw new Error('connection reset');
    });
    client.get = vi.fn(async () => {
      throw new Error('connection reset');
    });
    await withFakeRedis(client, async (park) => {
      expect(await park.redisClaimPark('s1')).toEqual({ ok: false, reason: 'unreachable' });
      expect(await park.redisReleasePark('s1', 'owner')).toBe('unreachable');
      expect(await park.redisReadFloor('s1')).toEqual({ ok: false, reason: 'unreachable' });
    });
  });
});

describe('the in-process park store — the half dev and the suite run', () => {
  afterEach(async () => {
    const { clearLocalParkStore } = await import('../ws/parkStore.js');
    clearLocalParkStore();
  });

  it('has the SAME contract as the Redis one, not a relaxed one', async () => {
    const park = await import('../ws/parkStore.js');
    expect(await park.claimParkedSession('local-1')).toEqual({ ok: true, record: null });

    const owner = (await park.publishParkedSession('local-1', '{"a":1}', 60_000)) as string;
    expect(owner).toBeTruthy();
    expect(await park.releaseParkIfOwned('local-1', 'stranger')).toBe('taken');
    expect(await park.claimParkedSession('local-1')).toEqual({ ok: true, record: '{"a":1}' });
    expect(await park.claimParkedSession('local-1')).toEqual({ ok: true, record: null });
    expect(await park.releaseParkIfOwned('local-1', owner)).toBe('taken');
  });

  it('keeps the floor monotonic locally too', async () => {
    const park = await import('../ws/parkStore.js');
    expect(await park.readTranscriptFloor('local-2')).toEqual({ ok: true, seq: 0 });
    park.raiseTranscriptFloor('local-2', 4);
    expect(await park.readTranscriptFloor('local-2')).toEqual({ ok: true, seq: 4 });
    park.raiseTranscriptFloor('local-2', 2);
    expect(await park.readTranscriptFloor('local-2')).toEqual({ ok: true, seq: 4 });
  });

  it('never reports one session’s park under another’s id', async () => {
    const park = await import('../ws/parkStore.js');
    await park.publishParkedSession('local-a', '{"who":"a"}', 60_000);
    expect(await park.claimParkedSession('local-b')).toEqual({ ok: true, record: null });
    expect(await park.claimParkedSession('local-a')).toEqual({ ok: true, record: '{"who":"a"}' });
  });
});
