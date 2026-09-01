import { afterEach, describe, expect, it, vi } from 'vitest';
import { isHandshakeRateLimited, resetHandshakeRateLimitForTests } from '../ws/handshakeRateLimit.js';

/*
 * ORACLE.md §15.2 item 3 — unit-level coverage for the counter itself, ahead
 * of `admission-control.test.ts`'s end-to-end proof through the real socket
 * server. These run against the in-memory fallback (`isTestOrDev` is true
 * throughout this suite — `test-setup.ts` pins `NODE_ENV=test`), which is the
 * SAME code path a real deployment falls back to if Redis is ever
 * unconfigured — see the file's own comment for why that is a deliberate,
 * supported degradation rather than a test-only shortcut.
 */

afterEach(() => {
  resetHandshakeRateLimitForTests();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('isHandshakeRateLimited', () => {
  it('admits attempts up to the configured max, then refuses the next one', async () => {
    vi.stubEnv('ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX', '3');
    vi.stubEnv('ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS', '60000');
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();

    const ip = '203.0.113.10';
    expect(await isHandshakeRateLimited(ip)).toBe(false); // 1
    expect(await isHandshakeRateLimited(ip)).toBe(false); // 2
    expect(await isHandshakeRateLimited(ip)).toBe(false); // 3 — AT the max, not over it
    expect(await isHandshakeRateLimited(ip)).toBe(true); // 4 — over the max
    expect(await isHandshakeRateLimited(ip)).toBe(true); // stays refused, not a one-shot trip

    const { resetConfigCache: reset2 } = await import('../env.js');
    reset2();
  });

  it('keys by IP: one address being over budget never touches another', async () => {
    vi.stubEnv('ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX', '1');
    vi.stubEnv('ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS', '60000');
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();

    const attacker = '198.51.100.7';
    const neighbor = '198.51.100.8';

    expect(await isHandshakeRateLimited(attacker)).toBe(false);
    expect(await isHandshakeRateLimited(attacker)).toBe(true);
    // A DIFFERENT IP sharing nothing with the first must not inherit its
    // budget — the whole point of keying by address rather than a single
    // global counter, which would let one flood lock out every learner.
    expect(await isHandshakeRateLimited(neighbor)).toBe(false);
  });

  it('resets once the window elapses, rather than refusing an address forever', async () => {
    vi.stubEnv('ORACLE_WS_HANDSHAKE_RATE_LIMIT_MAX', '1');
    vi.stubEnv('ORACLE_WS_HANDSHAKE_RATE_LIMIT_WINDOW_MS', '1000');
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();

    vi.useFakeTimers();
    const ip = '192.0.2.55';
    expect(await isHandshakeRateLimited(ip)).toBe(false);
    expect(await isHandshakeRateLimited(ip)).toBe(true);

    // Still inside the window: still refused.
    vi.advanceTimersByTime(999);
    expect(await isHandshakeRateLimited(ip)).toBe(true);

    // Past it: a fresh window, a fresh budget.
    vi.advanceTimersByTime(50);
    expect(await isHandshakeRateLimited(ip)).toBe(false);
  });

  /*
   * THE PRODUCTION PATH, not the test fallback the tests above exercise.
   * `isTestOrDev` is a module-level constant frozen at import time from
   * `NODE_ENV` (`env.ts`), so reaching the Redis branch needs a genuinely
   * FRESH module graph loaded under a non-test `NODE_ENV` — `vi.resetModules`
   * plus a fresh dynamic import, kept local to this one test so the file's
   * other tests keep using their original, already-bound `isTestOrDev=true`
   * import untouched.
   *
   * No Redis runs in this environment (nor in CI for this suite), which is
   * exactly the case under test: `lib/redis.ts`'s client is constructed but
   * never `.connect()`-ed here, so `isOpen` is false — the SAME shape a real
   * outage produces. This is the fail-open contract §1.14 requires for an
   * AVAILABILITY control: an unreachable Redis must refuse nobody.
   */
  it('fails OPEN when Redis is unreachable, in the actual production code path (not just the test fallback)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    try {
      const fresh = await import('../ws/handshakeRateLimit.js');
      const freshEnv = await import('../env.js');
      freshEnv.resetConfigCache();
      await expect(fresh.isHandshakeRateLimited('203.0.113.99')).resolves.toBe(false);
    } finally {
      vi.resetModules();
    }
  });
});
