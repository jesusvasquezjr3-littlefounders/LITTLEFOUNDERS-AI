import { describe, expect, it } from 'vitest';
import {
  computeComparison,
  computeMarkedLine,
  computeSequence,
  whiteboardComputesOk,
} from '../tutor/whiteboard.js';

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

/*
 * TWO-QUANTITY COMPARISON (V4, /ORACLE.md §20.5 backlog) — same posture as
 * `computeSequence` above: the two raw values are recomputed rather than
 * trusted, and the two facts the schema gives the model no field to assert
 * (`difference`, `greater`) are derived here, never taken on the model's
 * word.
 */
describe('a real comparison', () => {
  it('computes the difference and names the greater side', () => {
    expect(
      computeComparison({ left: { label: 'Tienda A', value: 45 }, right: { label: 'Tienda B', value: 28 } }),
    ).toEqual({ difference: 17, greater: 'left' });
  });

  it('names the RIGHT side when it is larger', () => {
    expect(
      computeComparison({ left: { label: 'A', value: 10 }, right: { label: 'B', value: 25 } }),
    ).toEqual({ difference: 15, greater: 'right' });
  });

  it('calls two equal values a tie, not an arbitrary winner', () => {
    expect(computeComparison({ left: { label: 'A', value: 20 }, right: { label: 'B', value: 20 } })).toEqual({
      difference: 0,
      greater: 'tie',
    });
  });

  it('treats a difference smaller than floating-point noise as a tie', () => {
    // 0.1 + 0.2 !== 0.3 in JS float — the same class of noise `computeSequence`
    // already tolerates at zero, tolerated here at "equal" instead.
    const result = computeComparison({ left: { label: 'A', value: 0.1 + 0.2 }, right: { label: 'B', value: 0.3 } });
    expect(result?.greater).toBe('tie');
    expect(result?.difference).toBeCloseTo(0);
  });
});

describe('refuses to compare a nonsense value', () => {
  // Both sides are already bounded by `WhiteboardCompareSideSchema` — these
  // values can only reach here from OUTSIDE a schema-validated turn (a
  // resumed snapshot written by a different schema version, or — as below —
  // a direct call bypassing the schema entirely, the same defense-in-depth
  // posture `computeSequence`'s own `start` bound re-check already has).
  it('a negative value on either side', () => {
    expect(computeComparison({ left: { label: 'A', value: -1 }, right: { label: 'B', value: 5 } })).toBeNull();
    expect(computeComparison({ left: { label: 'A', value: 5 }, right: { label: 'B', value: -1 } })).toBeNull();
  });

  it('a value past the ceiling', () => {
    expect(
      computeComparison({ left: { label: 'A', value: 10_000_001 }, right: { label: 'B', value: 5 } }),
    ).toBeNull();
  });

  it('a non-finite value', () => {
    expect(
      computeComparison({ left: { label: 'A', value: Number.NaN }, right: { label: 'B', value: 5 } }),
    ).toBeNull();
  });
});

/*
 * A MARKED NUMBER LINE (V4, /ORACLE.md §20.5 backlog). `max > min` and every
 * mark actually falling inside `[min, max]` are relationships BETWEEN
 * fields `WhiteboardMarkedLineSchema` cannot enforce itself (see that
 * schema's own comment) — this is the only thing that catches them.
 */
describe('a real marked line', () => {
  it('positions each mark as a fraction of the way from min to max', () => {
    const points = computeMarkedLine({
      min: 0,
      max: 40,
      marks: [
        { value: 22, label: 'Lo que tienes' },
        { value: 35, label: 'Los audífonos' },
      ],
    });
    expect(points).toEqual([
      { value: 22, label: 'Lo que tienes', position: 0.55 },
      { value: 35, label: 'Los audífonos', position: 0.875 },
    ]);
  });

  it('positions a mark sitting exactly on an end of the line at 0 or 1', () => {
    const points = computeMarkedLine({
      min: 10,
      max: 30,
      marks: [
        { value: 10, label: 'start' },
        { value: 30, label: 'end' },
      ],
    });
    expect(points?.[0]?.position).toBe(0);
    expect(points?.[1]?.position).toBe(1);
  });

  it('accepts up to the schema maximum of four marks', () => {
    const points = computeMarkedLine({
      min: 0,
      max: 10,
      marks: [
        { value: 1, label: 'a' },
        { value: 3, label: 'b' },
        { value: 6, label: 'c' },
        { value: 9, label: 'd' },
      ],
    });
    expect(points).toHaveLength(4);
  });
});

describe('refuses to draw a nonsense line', () => {
  it('a line with no width at all (max equal to min)', () => {
    expect(computeMarkedLine({ min: 20, max: 20, marks: [{ value: 20, label: 'x' }] })).toBeNull();
  });

  it('an INVERTED line (max below min) — the exact cross-field mistake the schema itself cannot catch', () => {
    // `WhiteboardMarkedLineSchema` bounds `min` and `max` independently; it
    // has no `.refine()` (z.discriminatedUnion cannot carry one — see that
    // schema's own comment), so a model setting min:50, max:10 passes every
    // per-field check and this is the only thing that then drops the board.
    expect(computeMarkedLine({ min: 50, max: 10, marks: [{ value: 30, label: 'x' }] })).toBeNull();
  });

  it('a mark outside the line, below min', () => {
    expect(computeMarkedLine({ min: 10, max: 30, marks: [{ value: 5, label: 'x' }] })).toBeNull();
  });

  it('a mark outside the line, above max', () => {
    expect(computeMarkedLine({ min: 10, max: 30, marks: [{ value: 35, label: 'x' }] })).toBeNull();
  });

  it('a starting value out of the ceiling range', () => {
    expect(computeMarkedLine({ min: -1, max: 10, marks: [{ value: 5, label: 'x' }] })).toBeNull();
  });

  it('a non-finite mark value', () => {
    expect(computeMarkedLine({ min: 0, max: 10, marks: [{ value: Number.NaN, label: 'x' }] })).toBeNull();
  });
});

describe('whiteboardComputesOk — the single validity gate, dispatched by kind', () => {
  it('passes a valid board of each kind', () => {
    expect(
      whiteboardComputesOk({
        kind: 'sequence',
        start: 10,
        unit: 'day',
        steps: [{ op: 'add', value: 2 }],
        label: 'x',
        currency: null,
      }),
    ).toBe(true);
    expect(
      whiteboardComputesOk({
        kind: 'compare',
        left: { label: 'A', value: 1 },
        right: { label: 'B', value: 2 },
        label: 'x',
        currency: null,
      }),
    ).toBe(true);
    expect(
      whiteboardComputesOk({
        kind: 'marked_line',
        min: 0,
        max: 10,
        marks: [{ value: 5, label: 'x' }],
        label: 'x',
        currency: null,
      }),
    ).toBe(true);
  });

  it('fails a board of each kind whose own numbers do not check out', () => {
    expect(
      whiteboardComputesOk({
        kind: 'sequence',
        start: 5,
        unit: 'day',
        steps: [{ op: 'subtract', value: 10 }],
        label: 'x',
        currency: null,
      }),
    ).toBe(false);
    expect(
      whiteboardComputesOk({
        kind: 'marked_line',
        min: 10,
        max: 0,
        marks: [{ value: 5, label: 'x' }],
        label: 'x',
        currency: null,
      }),
    ).toBe(false);
  });
});
