import { describe, expect, it } from 'vitest';
import { computeCategories, computeSequence, computeWhiteboardValues } from '../tutor/whiteboard.js';

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

describe('computeWhiteboardValues dispatches by kind', () => {
  it('routes a sequence board to computeSequence', () => {
    expect(
      computeWhiteboardValues({
        kind: 'sequence',
        start: 10,
        steps: [{ op: 'add', value: 2 }],
        unit: 'week',
        label: 'test',
        currency: null,
      }),
    ).toEqual([10, 12]);
  });

  it('routes a categories board to computeCategories', () => {
    expect(
      computeWhiteboardValues({
        kind: 'categories',
        categories: [
          { label: 'Necesito', value: 40 },
          { label: 'Quiero', value: 35 },
        ],
        label: 'test',
        currency: null,
      }),
    ).toEqual([40, 35]);
  });

  it('drops a categories board the same way it drops a broken sequence — null, not a thrown error', () => {
    expect(
      computeWhiteboardValues({
        kind: 'categories',
        categories: [
          { label: 'A', value: 1 },
          { label: 'A', value: 2 },
        ],
        label: 'test',
        currency: null,
      }),
    ).toBeNull();
  });
});
