import { describe, expect, it } from 'vitest';
import { createConcurrencyGate } from '../gen/concurrencyGate.js';

describe('createConcurrencyGate', () => {
  it('never lets more than `limit` callers run at once', async () => {
    const gate = createConcurrencyGate(2);
    let active = 0;
    let maxActive = 0;

    const task = () =>
      gate.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
      });

    await Promise.all([task(), task(), task(), task(), task()]);

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('runs callers strictly one-at-a-time when limit is 1', async () => {
    const gate = createConcurrencyGate(1);
    const order: string[] = [];

    const task = (label: string) =>
      gate.run(async () => {
        order.push(`${label}-start`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(`${label}-end`);
      });

    await Promise.all([task('a'), task('b'), task('c')]);

    // Each start must be immediately followed by its own end — no interleaving.
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end', 'c-start', 'c-end']);
  });

  it('releases the slot and lets a queued caller proceed even if the running one throws', async () => {
    const gate = createConcurrencyGate(1);
    const results: string[] = [];

    await expect(
      gate.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await gate.run(async () => {
      results.push('after-failure');
    });

    expect(results).toEqual(['after-failure']);
  });

  it('propagates the return value of the wrapped function', async () => {
    const gate = createConcurrencyGate(3);
    const result = await gate.run(async () => 42);
    expect(result).toBe(42);
  });
});
