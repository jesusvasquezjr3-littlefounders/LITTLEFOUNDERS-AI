import { describe, expect, it } from 'vitest';
import { computeSequence } from '../tutor/whiteboard.js';

/*
 * THE BOARD'S NUMBERS ARE COMPUTED, NEVER TAKEN ON THE MODEL'S WORD — the same
 * rule `arithmetic.ts` applies to a spoken answer. Every case below is either
 * the owner's own screenshot (2026-08-29: "empiezas con 10, cada día +2… si
 * empezaras con 20 y cada día 3") or a bound that must hold no matter what a
 * model proposes.
 */

describe('a real sequence', () => {
  it('matches the owner\'s own example: 10, +2 each day', () => {
    expect(computeSequence({ start: 10, steps: [{ op: 'add', value: 2 }] })).toEqual([10, 12]);
  });

  it('matches the second example: 20, +3 each day', () => {
    expect(computeSequence({ start: 20, steps: [{ op: 'add', value: 3 }] })).toEqual([20, 23]);
  });

  it('chains several steps, in order', () => {
    expect(
      computeSequence({
        start: 10,
        steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'subtract', value: 3 }],
      }),
    ).toEqual([10, 15, 20, 17]);
  });

  it('applies a percentage growth step against the CURRENT value, not the start', () => {
    // 100 growing 10% twice is 110, then 121 — not 120.
    expect(
      computeSequence({ start: 100, steps: [{ op: 'multiply_percent', value: 10 }, { op: 'multiply_percent', value: 10 }] }),
    ).toEqual([100, 110, 121]);
  });
});

describe('refuses to draw a nonsense board', () => {
  it('a subtraction that goes negative', () => {
    expect(computeSequence({ start: 5, steps: [{ op: 'subtract', value: 10 }] })).toBeNull();
  });

  it('a starting value out of range', () => {
    expect(computeSequence({ start: -1, steps: [{ op: 'add', value: 1 }] })).toBeNull();
    expect(computeSequence({ start: 10_000_001, steps: [{ op: 'add', value: 1 }] })).toBeNull();
  });

  it('a running total that grows past the ceiling', () => {
    expect(
      computeSequence({ start: 9_000_000, steps: [{ op: 'add', value: 5_000_000 }] }),
    ).toBeNull();
  });

  it('a percentage step over 500%', () => {
    expect(computeSequence({ start: 10, steps: [{ op: 'multiply_percent', value: 501 }] })).toBeNull();
  });

  it('a non-finite or non-positive step value', () => {
    expect(computeSequence({ start: 10, steps: [{ op: 'add', value: 0 }] })).toBeNull();
    expect(computeSequence({ start: 10, steps: [{ op: 'add', value: Number.NaN }] })).toBeNull();
  });
});

describe('decimal steps that land on zero via floating-point noise', () => {
  /*
   * Found by adversarial review, round 14, 2026-08-30 (MEDIUM): a valid
   * "spend it down to zero" sequence with decimal steps computes, in JS
   * floating point, to a hair below exactly zero — e.g.
   * `0.3 - 0.1 - 0.1 - 0.1 === -2.7755575615628914e-17` — and the pre-fix
   * `current < 0` check dropped the entire whiteboard, indistinguishable
   * from a genuinely nonsense board.
   */
  it('treats a subtraction sequence that nets to zero as zero, not as negative', () => {
    // In JS, 0.3 - 0.1 - 0.1 - 0.1 === -2.7755575615628914e-17 — a hair
    // below zero, not a real negative amount, and must not drop the board.
    const result = computeSequence({
      start: 0.3,
      steps: [
        { op: 'subtract', value: 0.1 },
        { op: 'subtract', value: 0.1 },
        { op: 'subtract', value: 0.1 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);
    expect(result?.at(-1)).toBe(0);
  });

  it('still refuses a sequence that goes genuinely, meaningfully negative', () => {
    expect(computeSequence({ start: 0.3, steps: [{ op: 'subtract', value: 0.31 }] })).toBeNull();
  });
});
