import { describe, expect, it } from 'vitest';
import { withTimeout } from './timeout.js';

/*
 * The rate limiter and cache middleware both rely on this: node-redis's
 * `isOpen` stays true through the entire reconnect-retry loop during a live
 * outage, so a command sent to a "connected-but-actually-down" client never
 * resolves or rejects on its own. Without an explicit deadline, that hangs
 * every request forever instead of letting `passOnStoreError`/the existing
 * best-effort `.catch()` do their job.
 */
describe('withTimeout', () => {
  it('resolves with the underlying value when it settles before the deadline', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50);
    expect(result).toBe('ok');
  });

  it('rejects when the underlying promise never settles', async () => {
    const neverSettles = new Promise<string>(() => {});
    await expect(withTimeout(neverSettles, 20)).rejects.toThrow(/timed out/);
  });

  it('propagates the underlying rejection reason when it rejects before the deadline', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });
});
