import { describe, expect, it } from 'vitest';
import {
  computeCategories,
  computeComparison,
  computeMarkedLine,
  computeSequence,
  computeTokens,
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
 * `categories` (V4 backlog, "UI generativa acotada" first bounded slice —
 * ORACLE.md §20.5): a comparison across named things at one moment, rather
 * than one quantity over time. Same "computed, never taken on the model's
 * word" discipline as `computeSequence` above, applied to the one thing a
 * PER-CATEGORY schema cannot see on its own — two bars sharing a label.
 */
describe('a real categories board', () => {
  it('returns one value per category, in the given order', () => {
    expect(
      computeCategories({
        categories: [
          { label: 'Necesito', value: 40 },
          { label: 'Quiero', value: 35 },
          { label: 'Ahorré', value: 25 },
        ],
      }),
    ).toEqual([40, 35, 25]);
  });

  it('allows a category worth zero — a legitimate "you spent nothing here" bar', () => {
    expect(
      computeCategories({
        categories: [
          { label: 'Renta', value: 0 },
          { label: 'Comida', value: 50 },
        ],
      }),
    ).toEqual([0, 50]);
  });
});

describe('refuses a nonsense categories board', () => {
  it('two categories sharing the same label — a schema-valid pair no single category can flag alone', () => {
    expect(
      computeCategories({
        categories: [
          { label: 'Renta', value: 10 },
          { label: 'Renta', value: 20 },
        ],
      }),
    ).toBeNull();
  });

  it('a duplicate label caught case- and whitespace-insensitively', () => {
    expect(
      computeCategories({
        categories: [
          { label: 'Renta', value: 10 },
          { label: '  RENTA  ', value: 20 },
        ],
      }),
    ).toBeNull();
  });

  it('a non-finite or negative category value, as defense in depth even though the schema already excludes it', () => {
    expect(
      computeCategories({ categories: [{ label: 'A', value: Number.NaN }, { label: 'B', value: 5 }] }),
    ).toBeNull();
    expect(
      computeCategories({ categories: [{ label: 'A', value: -1 }, { label: 'B', value: 5 }] }),
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
    expect(
      whiteboardComputesOk({
        kind: 'categories',
        categories: [
          { label: 'Necesito', value: 40 },
          { label: 'Quiero', value: 35 },
        ],
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
    // A `categories` board with two bars sharing the same (trimmed,
    // case-folded) label — invalid the same way a broken sequence is, null
    // rather than a thrown error.
    expect(
      whiteboardComputesOk({
        kind: 'categories',
        categories: [
          { label: 'A', value: 1 },
          { label: 'A', value: 2 },
        ],
        label: 'x',
        currency: null,
      }),
    ).toBe(false);
  });
});

/*
 * `tokens` — the first NON-CHART instrument (/TUTOR_INSTRUMENTS.md, Sprint 6).
 * What only `computeTokens` can catch, and no per-field bound can: a
 * denomination that does not EXIST in the board's currency, a table nobody
 * could count at a glance, and the total itself — which the schema gives the
 * model no field to assert, exactly as it gives it no `greater` on a
 * comparison, because that sum is the arithmetic the learner is doing.
 */

describe('a real table of coins', () => {
  it('counts three 10s and four 1s the way a child would', () => {
    expect(computeTokens({ currency: 'MXN', groups: [{ denomination: 10, count: 3 }, { denomination: 1, count: 4 }] })).toEqual(
      { subtotals: [30, 4], total: 34 },
    );
  });

  it('adds sub-unit coins without floating-point dust reaching a child', () => {
    // 0.1 * 3 is 0.30000000000000004 in JS, and a learner would read that.
    expect(computeTokens({ currency: 'USD', groups: [{ denomination: 0.1, count: 3 }] })).toEqual({
      subtotals: [0.3],
      total: 0.3,
    });
  });

  it('accepts a denomination written with trailing precision (0.10 for 0.1)', () => {
    expect(computeTokens({ currency: 'BRL', groups: [{ denomination: 0.1, count: 2 }] })?.total).toBe(0.2);
  });
});

describe('a table that must not be drawn', () => {
  it('refuses a denomination that does not exist in the currency', () => {
    // A "7-peso coin" passes every per-field bound and would teach a child
    // something false about the money in their own hand (§1.14: verified for
    // SUBJECT, not only for form).
    expect(computeTokens({ currency: 'MXN', groups: [{ denomination: 7, count: 2 }] })).toBeNull();
  });

  it('refuses a denomination borrowed from another currency', () => {
    // 0.25 is a real US quarter and a real BRL coin; it is not Mexican money.
    expect(computeTokens({ currency: 'MXN', groups: [{ denomination: 0.25, count: 2 }] })).toBeNull();
    expect(computeTokens({ currency: 'USD', groups: [{ denomination: 0.25, count: 2 }] })).not.toBeNull();
  });

  it('refuses more objects than anyone counts at a glance', () => {
    // Past the ceiling a learner stops counting and starts estimating, which
    // is a different skill than the one this instrument exists to teach.
    expect(
      computeTokens({ currency: 'MXN', groups: [{ denomination: 1, count: 12 }, { denomination: 1, count: 12 }, { denomination: 1, count: 12 }] }),
    ).toBeNull();
  });

  it('accepts exactly the ceiling, and refuses one past it', () => {
    expect(
      computeTokens({ currency: 'MXN', groups: [{ denomination: 1, count: 12 }, { denomination: 2, count: 12 }] }),
    ).toEqual({ subtotals: [12, 24], total: 36 });
    expect(
      computeTokens({ currency: 'MXN', groups: [{ denomination: 1, count: 12 }, { denomination: 2, count: 12 }, { denomination: 5, count: 1 }] }),
    ).toBeNull();
  });

  it('refuses a fractional count — half a coin is not on any table', () => {
    expect(computeTokens({ currency: 'MXN', groups: [{ denomination: 5, count: 2.5 }] })).toBeNull();
  });

  it('refuses a currency it has no denomination table for', () => {
    expect(
      computeTokens({ currency: 'EUR' as 'MXN', groups: [{ denomination: 1, count: 2 }] }),
    ).toBeNull();
  });
});

describe('whiteboardComputesOk dispatches tokens', () => {
  it('passes a real table and fails an impossible coin', () => {
    expect(
      whiteboardComputesOk({
        kind: 'tokens',
        groups: [{ denomination: 20, count: 2 }],
        label: 'Cuenta lo que hay',
        currency: 'MXN',
      }),
    ).toBe(true);
    expect(
      whiteboardComputesOk({
        kind: 'tokens',
        groups: [{ denomination: 3, count: 2 }],
        label: 'Cuenta lo que hay',
        currency: 'MXN',
      }),
    ).toBe(false);
  });
});
