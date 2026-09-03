import { describe, expect, it } from 'vitest';
import {
  computeCategories,
  computeComparison,
  computeMarkedLine,
  computeSequence,
  computeTokens,
  computeBarModel,
  computePartWhole,
  computeFlow,
  computeGoalBar,
  computeWorked,
  computeTenFrame,
  computeOpenNumberLine,
  computeArray,
  computeFractionStrip,
  computePartition,
  computeTable,
  computeScale,
  computeTwoBins,
  computeVenn,
  computeRanking,
  computeChance,
  computeDeal,
  computeChange,
  computeRegroup,
  computeEquationBar,
  computeReceipt,
  computeLedger,
  computePriceTag,
  computeInventory,
  computeBudgetPlate,
  computePictograph,
  computeBeadString,
  computeTally,
  computeFractionCircle,
  computeStack,
  computeSequenceCompare,
  computeTimeline,
  computeBeforeAfter,
  computeWhatif,
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

/*
 * WAVE 1 INSTRUMENTS (/TUTOR_INSTRUMENTS.md Sprints 7-8). Each compute function
 * exists to catch a relationship BETWEEN fields no per-field bound can see, and
 * to derive the one number the schema deliberately denies the model — because in
 * every case that number is what the learner is working out.
 */

describe('bar_model — the unknown is drawn, never answered', () => {
  it('sizes each part against the whole and finds the gap', () => {
    const result = computeBarModel({
      whole: { label: 'Tenias', value: 60 },
      parts: [
        { label: 'Gastaste', value: 25 },
        { label: 'Queda', value: null },
      ],
    });
    expect(result?.unknownIndex).toBe(1);
    expect(result?.widths[0]).toBeCloseTo(25 / 60);
    expect(result?.widths[1]).toBeCloseTo(35 / 60);
  });

  it('never returns the unknown part VALUE — that is the answer', () => {
    const result = computeBarModel({
      whole: { label: 'w', value: 60 },
      parts: [
        { label: 'a', value: 25 },
        { label: 'b', value: null },
      ],
    });
    expect(Object.keys(result ?? {}).sort()).toEqual(['unknownIndex', 'widths']);
  });

  it('refuses two unknowns — a model with two gaps is a model of nothing', () => {
    expect(
      computeBarModel({
        whole: { label: 'w', value: 60 },
        parts: [
          { label: 'a', value: null },
          { label: 'b', value: null },
        ],
      }),
    ).toBeNull();
  });

  it('refuses parts that overrun the whole', () => {
    expect(
      computeBarModel({
        whole: { label: 'w', value: 30 },
        parts: [
          { label: 'a', value: 25 },
          { label: 'b', value: 20 },
        ],
      }),
    ).toBeNull();
  });

  it('with every part stated, refuses parts that do not make the whole', () => {
    expect(
      computeBarModel({
        whole: { label: 'w', value: 60 },
        parts: [
          { label: 'a', value: 25 },
          { label: 'b', value: 20 },
        ],
      }),
    ).toBeNull();
    expect(
      computeBarModel({
        whole: { label: 'w', value: 60 },
        parts: [
          { label: 'a', value: 25 },
          { label: 'b', value: 35 },
        ],
      })?.unknownIndex,
    ).toBeNull();
  });
});

describe('part_whole — a bond that does not balance is not drawn', () => {
  it('accepts a real bond', () => {
    expect(
      computePartWhole({
        whole: { label: 'total', value: 18 },
        left: { label: 'sab', value: 9 },
        right: { label: 'dom', value: 9 },
      }),
    ).toBe(true);
  });

  it('refuses one that does not — a wrong bond teaches a wrong relationship', () => {
    expect(
      computePartWhole({
        whole: { label: 'total', value: 18 },
        left: { label: 'sab', value: 9 },
        right: { label: 'dom', value: 8 },
      }),
    ).toBeNull();
  });
});

describe('flow — what is left is the server number', () => {
  it('derives what is kept', () => {
    expect(computeFlow({ income: { label: 'in', value: 48 }, spent: { label: 'out', value: 19 } })).toEqual({
      kept: 29,
    });
  });

  it('handles money decimals without dust', () => {
    expect(computeFlow({ income: { label: 'in', value: 10 }, spent: { label: 'out', value: 0.3 } })?.kept).toBe(9.7);
  });

  it('refuses spending more than came in — a loss is a different visual case', () => {
    expect(computeFlow({ income: { label: 'in', value: 10 }, spent: { label: 'out', value: 11 } })).toBeNull();
  });

  it('allows spending exactly everything', () => {
    expect(computeFlow({ income: { label: 'in', value: 10 }, spent: { label: 'out', value: 10 } })).toEqual({ kept: 0 });
  });
});

describe('goal_bar — what is missing is the question', () => {
  it('derives the shortfall and the shaded fraction', () => {
    const result = computeGoalBar({ goal: { label: 'g', value: 90 }, saved: { label: 's', value: 34 } });
    expect(result?.remaining).toBe(56);
    expect(result?.savedFraction).toBeCloseTo(34 / 90);
  });

  it('refuses saving more than the goal — the bar cannot draw an overflow', () => {
    expect(computeGoalBar({ goal: { label: 'g', value: 90 }, saved: { label: 's', value: 91 } })).toBeNull();
  });

  it('draws a reached goal as full, with nothing missing', () => {
    expect(computeGoalBar({ goal: { label: 'g', value: 90 }, saved: { label: 's', value: 90 } })).toEqual({
      remaining: 0,
      savedFraction: 1,
    });
  });
});

describe('worked — the check is arithmetic the server actually performed', () => {
  it('runs the lines and lands the check on the previous one', () => {
    const result = computeWorked({
      start: 72,
      steps: [
        { op: 'subtract', value: 15 },
        { op: 'add', value: 8 },
      ],
    });
    expect(result?.values).toEqual([72, 57, 65]);
    expect(result?.checkValue).toBe(57);
    expect(result?.checkValue).toBe(result?.values[result.values.length - 2]);
  });

  it('checks a single-step example too', () => {
    const result = computeWorked({ start: 20, steps: [{ op: 'add', value: 5 }] });
    expect(result?.values).toEqual([20, 25]);
    expect(result?.checkValue).toBe(20);
  });

  it('refuses a line that would go negative', () => {
    expect(computeWorked({ start: 5, steps: [{ op: 'subtract', value: 9 }] })).toBeNull();
  });
});

describe('whiteboardComputesOk dispatches every Wave 1 kind', () => {
  it('passes a real board and fails a broken one', () => {
    expect(
      whiteboardComputesOk({
        kind: 'part_whole',
        whole: { label: 'w', value: 18 },
        left: { label: 'a', value: 9 },
        right: { label: 'b', value: 9 },
        label: 'bond',
        currency: null,
      }),
    ).toBe(true);
    expect(
      whiteboardComputesOk({
        kind: 'flow',
        income: { label: 'in', value: 5 },
        spent: { label: 'out', value: 9 },
        keptLabel: 'left',
        label: 'flow',
        currency: null,
      }),
    ).toBe(false);
  });
});

/*
 * THE CANONICAL PRIMARY-MATHS VOCABULARY. Each compute below either derives the
 * number being taught, or refuses a picture that would teach something false.
 */

describe('ten_frame', () => {
  it('fills one frame up to ten and spills into a second', () => {
    expect(computeTenFrame({ count: 7 })).toEqual({ frames: [7] });
    expect(computeTenFrame({ count: 10 })).toEqual({ frames: [10] });
    expect(computeTenFrame({ count: 14 })).toEqual({ frames: [10, 4] });
  });

  it('never computes the complement to ten — that is usually the question', () => {
    expect(Object.keys(computeTenFrame({ count: 7 }) ?? {})).toEqual(['frames']);
  });
});

describe('open_number_line — it has to ARRIVE', () => {
  it('places every stop along the line', () => {
    const result = computeOpenNumberLine({ from: 7, to: 10, jumps: [{ value: 1 }, { value: 2 }] });
    expect(result?.stops).toEqual([7, 8, 10]);
    expect(result?.positions[0]).toBe(0);
    expect(result?.positions[2]).toBe(1);
    expect(result?.positions[1]).toBeCloseTo(1 / 3);
  });

  it('refuses jumps that stop short — a count-up that never arrives teaches the method as unreliable', () => {
    expect(computeOpenNumberLine({ from: 7, to: 10, jumps: [{ value: 1 }] })).toBeNull();
  });

  it('refuses jumps that overshoot', () => {
    expect(computeOpenNumberLine({ from: 7, to: 10, jumps: [{ value: 5 }] })).toBeNull();
  });

  it('refuses a line with no distance to cover', () => {
    expect(computeOpenNumberLine({ from: 10, to: 10, jumps: [{ value: 1 }] })).toBeNull();
  });
});

describe('array', () => {
  it('multiplies the rectangle out', () => {
    expect(computeArray({ rows: 4, columns: 3, unitValue: 1 })).toEqual({ total: 12, cells: 12 });
    expect(computeArray({ rows: 3, columns: 2, unitValue: 2.5 })).toEqual({ total: 15, cells: 6 });
  });

  it('refuses a rectangle bigger than a glance', () => {
    expect(computeArray({ rows: 7, columns: 2, unitValue: 1 })).toBeNull();
  });
});

describe('fraction_strip', () => {
  it('derives each row shaded share', () => {
    expect(
      computeFractionStrip({
        rows: [
          { denominator: 2, highlighted: 1 },
          { denominator: 4, highlighted: 1 },
        ],
      }),
    ).toEqual({ shares: [0.5, 0.25] });
  });

  it('refuses shading more pieces than the strip has', () => {
    expect(computeFractionStrip({ rows: [{ denominator: 4, highlighted: 5 }, { denominator: 2, highlighted: 1 }] })).toBeNull();
  });
});

describe('partition', () => {
  it('works out what one piece is worth in each split', () => {
    expect(
      computePartition({
        whole: 60,
        splits: [
          { label: 'entre dos', denominator: 2 },
          { label: 'entre cuatro', denominator: 4 },
        ],
      }),
    ).toEqual({ pieceValues: [30, 15] });
  });

  it('refuses two splits with the same denominator — drawing one split twice is not a comparison', () => {
    expect(
      computePartition({
        whole: 60,
        splits: [
          { label: 'a', denominator: 2 },
          { label: 'b', denominator: 2 },
        ],
      }),
    ).toBeNull();
  });
});

/*
 * DECISION AND COMPARISON. Every refusal below is a picture that would teach
 * something false, not merely an out-of-range number.
 */

describe('table — the cheapest sticker price and the cheapest per unit differ', () => {
  it('works out price per unit and which option actually wins', () => {
    // 12 for 4 is 3 each; 20 for 10 is 2 each. The DEARER bag is the better
    // deal, which is the whole point of `money.unit-price`.
    const result = computeTable({
      options: [
        { label: 'chica', price: 12, units: 4 },
        { label: 'grande', price: 20, units: 10 },
      ],
    });
    expect(result?.unitPrices).toEqual([3, 2]);
    expect(result?.bestIndex).toBe(1);
  });

  it('refuses a tie — two winners is not the lesson', () => {
    expect(
      computeTable({
        options: [
          { label: 'a', price: 10, units: 5 },
          { label: 'b', price: 20, units: 10 },
        ],
      }),
    ).toBeNull();
  });
});

describe('scale', () => {
  it('tips toward the heavier side and levels on equal', () => {
    expect(computeScale({ left: { label: 'a', value: 18 }, right: { label: 'b', value: 25 } })).toEqual({
      tilt: 'right',
      difference: 7,
    });
    expect(computeScale({ left: { label: 'a', value: 9 }, right: { label: 'b', value: 9 } })?.tilt).toBe('level');
  });
});

describe('two_bins — a sort with an empty bin demonstrates nothing', () => {
  it('counts both bins', () => {
    expect(
      computeTwoBins({ items: [{ label: 'a', bin: 0 }, { label: 'b', bin: 1 }] }),
    ).toEqual({ counts: [1, 1] });
  });

  it('refuses everything on one side', () => {
    expect(computeTwoBins({ items: [{ label: 'a', bin: 0 }, { label: 'b', bin: 0 }] })).toBeNull();
  });
});

describe('venn — the overlap IS the instrument', () => {
  it('counts the three regions', () => {
    expect(
      computeVenn({
        items: [
          { label: 'a', side: 'left' },
          { label: 'b', side: 'right' },
          { label: 'c', side: 'both' },
        ],
      }),
    ).toEqual({ left: 1, right: 1, both: 1 });
  });

  it('refuses an empty overlap — that is a two-bin sort drawn as circles', () => {
    expect(
      computeVenn({ items: [{ label: 'a', side: 'left' }, { label: 'b', side: 'right' }] }),
    ).toBeNull();
  });
});

describe('ranking — the ORDER is the server\'s', () => {
  it('sorts ascending and descending', () => {
    const items = [
      { label: 'cuaderno', value: 25 },
      { label: 'mochila', value: 180 },
      { label: 'lapiz', value: 6 },
    ];
    expect(computeRanking({ items, direction: 'asc' })?.order).toEqual([2, 0, 1]);
    expect(computeRanking({ items, direction: 'desc' })?.order).toEqual([1, 0, 2]);
  });

  it('refuses a tie rather than breaking it quietly', () => {
    expect(
      computeRanking({ items: [{ label: 'a', value: 5 }, { label: 'b', value: 5 }], direction: 'asc' }),
    ).toBeNull();
  });
});

describe('chance — weights in, shares out, no percentage from the model', () => {
  it('normalises weights to shares that sum to one', () => {
    const result = computeChance({ outcomes: [{ label: 'vende', weight: 4 }, { label: 'llueve', weight: 1 }] });
    expect(result?.shares).toEqual([0.8, 0.2]);
    expect(result!.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

/* ── OPERATIONS AND REAL-MONEY ARTEFACTS ────────────────────────────────────── */

describe('deal — the remainder is not nothing', () => {
  it('shares out and keeps what is left', () => {
    expect(computeDeal({ total: 14, bins: ['a', 'b', 'c'] })).toEqual({ perBin: 4, remainder: 2 });
    expect(computeDeal({ total: 12, bins: ['a', 'b', 'c'] })).toEqual({ perBin: 4, remainder: 0 });
  });

  it('refuses fewer things than places — you cannot deal what you do not have', () => {
    expect(computeDeal({ total: 2, bins: ['a', 'b', 'c'] })).toBeNull();
  });
});

describe('change', () => {
  it('works out what comes back', () => {
    expect(computeChange({ price: 7, paid: 20 })).toEqual({ change: 13 });
    expect(computeChange({ price: 7, paid: 7 })).toEqual({ change: 0 });
  });

  it('refuses paying less than the price — that is a different story', () => {
    expect(computeChange({ price: 20, paid: 7 })).toBeNull();
  });
});

describe('regroup', () => {
  it('breaks a unit into smaller ones', () => {
    expect(computeRegroup({ fromDenomination: 10, fromCount: 1, intoDenomination: 1 })).toEqual({ intoCount: 10 });
    expect(computeRegroup({ fromDenomination: 10, fromCount: 2, intoDenomination: 5 })).toEqual({ intoCount: 4 });
  });

  it('refuses a trade that does not divide evenly — half a coin is not on any table', () => {
    expect(computeRegroup({ fromDenomination: 10, fromCount: 1, intoDenomination: 3 })).toBeNull();
  });

  it('refuses breaking a unit into something bigger than itself', () => {
    expect(computeRegroup({ fromDenomination: 5, fromCount: 1, intoDenomination: 10 })).toBeNull();
  });
});

describe('equation_bar — an unbalanced equation is refused, never drawn', () => {
  it('accepts sides that match', () => {
    expect(
      computeEquationBar({
        left: [{ label: 'a', value: 34 }, { label: 'b', value: 56 }],
        right: [{ label: 'goal', value: 90 }],
      }),
    ).toEqual({ total: 90 });
  });

  it('refuses sides that do not — the equals sign is not decorative', () => {
    expect(
      computeEquationBar({
        left: [{ label: 'a', value: 34 }],
        right: [{ label: 'goal', value: 90 }],
      }),
    ).toBeNull();
  });
});

describe('receipt and ledger', () => {
  it('adds a receipt up', () => {
    expect(
      computeReceipt({ lines: [{ label: 'a', value: 18 }, { label: 'b', value: 24 }, { label: 'c', value: 31 }] }),
    ).toEqual({ total: 73 });
  });

  it('runs a ledger balance line by line', () => {
    const result = computeLedger({
      entries: [
        { label: 'sold', amount: 48, direction: 'in' },
        { label: 'cups', amount: 19, direction: 'out' },
        { label: 'sold', amount: 26, direction: 'in' },
      ],
    });
    expect(result?.balances).toEqual([48, 29, 55]);
    expect(result?.final).toBe(55);
  });

  it('refuses a ledger that goes below zero — this board cannot draw debt honestly', () => {
    expect(
      computeLedger({
        entries: [
          { label: 'cups', amount: 19, direction: 'out' },
          { label: 'sold', amount: 5, direction: 'in' },
        ],
      }),
    ).toBeNull();
  });
});

describe('price_tag', () => {
  it('applies the discount and divides by the quantity', () => {
    expect(computePriceTag({ price: 60, units: 6, discountPercent: 25 })).toEqual({ unitPrice: 7.5, finalPrice: 45 });
  });

  it('handles a plain tag with no discount', () => {
    expect(computePriceTag({ price: 60, units: 6, discountPercent: null })).toEqual({ unitPrice: 10, finalPrice: 60 });
  });
});

describe('inventory', () => {
  it('works out what is left', () => {
    expect(computeInventory({ start: 12, sold: 5 })).toEqual({ left: 7 });
  });

  it('refuses selling more than you had', () => {
    expect(computeInventory({ start: 5, sold: 12 })).toBeNull();
  });
});

describe('budget_plate — the ONE board that draws a rule being broken', () => {
  it('reports what is left when it fits', () => {
    expect(
      computeBudgetPlate({ budget: 100, items: [{ label: 'a', value: 45 }, { label: 'b', value: 30 }] }),
    ).toEqual({ spent: 75, remaining: 25, overBy: 0 });
  });

  it('ALLOWS an overspend and reports it — refusing would hide the case it exists for', () => {
    // `budget-is-per-item` can only be dislodged by letting the learner watch
    // the total cross the line.
    expect(
      computeBudgetPlate({
        budget: 100,
        items: [{ label: 'a', value: 45 }, { label: 'b', value: 30 }, { label: 'c', value: 40 }],
      }),
    ).toEqual({ spent: 115, remaining: 0, overBy: 15 });
  });
});

/* ── EARLY YEARS AND TIME ───────────────────────────────────────────────────── */

describe('pictograph, bead string, tally, fraction circle', () => {
  it('scales each pictograph row by what one icon is worth', () => {
    expect(
      computePictograph({ rows: [{ label: 'a', count: 4 }, { label: 'b', count: 7 }], unitValue: 10 }),
    ).toEqual({ totals: [40, 70] });
  });

  it('splits a bead string across two rows of ten', () => {
    expect(computeBeadString({ count: 13 })).toEqual({ rows: [10, 3] });
    expect(computeBeadString({ count: 7 })).toEqual({ rows: [7] });
  });

  it('writes a tally as fives and singles, which is how a tally is actually kept', () => {
    expect(
      computeTally({ groups: [{ label: 'a', count: 12 }, { label: 'b', count: 3 }] })?.fives,
    ).toEqual([
      [2, 2],
      [0, 3],
    ]);
  });

  it('refuses shading more circle pieces than the circle has', () => {
    expect(computeFractionCircle({ denominator: 8, highlighted: 3 })).toEqual({ share: 0.375 });
    expect(computeFractionCircle({ denominator: 4, highlighted: 5 })).toBeNull();
  });
});

describe('stack — totals compared by what they are made of', () => {
  it('adds each column and finds the shared scale', () => {
    const result = computeStack({
      columns: [
        { label: 'w1', parts: [{ label: 'food', value: 60 }, { label: 'fun', value: 20 }] },
        { label: 'w2', parts: [{ label: 'food', value: 25 }, { label: 'fun', value: 55 }] },
      ],
    });
    // Same total, completely different composition — the point of the board.
    expect(result?.totals).toEqual([80, 80]);
    expect(result?.max).toBe(80);
  });
});

describe('sequence_compare — two futures over the SAME number of periods', () => {
  it('folds both tracks', () => {
    const result = computeSequenceCompare({
      tracks: [
        { label: 'save 2', start: 0, steps: [{ op: 'add', value: 2 }, { op: 'add', value: 2 }] },
        { label: 'save 5', start: 0, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ],
    });
    expect(result?.values).toEqual([
      [0, 2, 4],
      [0, 5, 10],
    ]);
  });

  it('refuses tracks of different lengths — that draws a difference in how long you looked', () => {
    expect(
      computeSequenceCompare({
        tracks: [
          { label: 'a', start: 0, steps: [{ op: 'add', value: 2 }] },
          { label: 'b', start: 0, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }] },
        ],
      }),
    ).toBeNull();
  });
});

describe('whatif — 2-3 branches sharing ONE start, switched between rather than seen at once', () => {
  it('folds every branch from the shared start', () => {
    const result = computeWhatif({
      start: 5,
      branches: [
        { label: 'save 1', steps: [{ op: 'add', value: 1 }, { op: 'add', value: 1 }] },
        { label: 'save 2', steps: [{ op: 'add', value: 2 }, { op: 'add', value: 2 }] },
        { label: 'save 3', steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ],
    });
    expect(result?.values).toEqual([
      [5, 6, 7],
      [5, 7, 9],
      [5, 8, 11],
    ]);
  });

  it('refuses branches of different lengths — the learner must be comparing the SAME number of periods', () => {
    expect(
      computeWhatif({
        start: 0,
        branches: [
          { label: 'a', steps: [{ op: 'add', value: 2 }] },
          { label: 'b', steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }] },
        ],
      }),
    ).toBeNull();
  });

  it("refuses a branch whose own arithmetic is nonsense, same as any other sequence — one bad branch invalidates the whole board", () => {
    expect(
      computeWhatif({
        start: 5,
        branches: [
          { label: 'a', steps: [{ op: 'subtract', value: 10 }] },
          { label: 'b', steps: [{ op: 'add', value: 2 }] },
        ],
      }),
    ).toBeNull();
  });
});

describe('timeline — order is the whole point', () => {
  it('places events along the span', () => {
    const result = computeTimeline({ span: 5, events: [{ label: 'a', at: 1 }, { label: 'b', at: 3 }, { label: 'c', at: 5 }] });
    expect(result?.positions).toEqual([0, 0.5, 1]);
  });

  it('refuses two events in the same period', () => {
    expect(computeTimeline({ span: 5, events: [{ label: 'a', at: 2 }, { label: 'b', at: 2 }] })).toBeNull();
  });

  it('refuses an event outside the span', () => {
    expect(computeTimeline({ span: 3, events: [{ label: 'a', at: 1 }, { label: 'b', at: 9 }] })).toBeNull();
  });
});

describe('before_after', () => {
  it('works out what changed and which way', () => {
    expect(computeBeforeAfter({ before: 40, after: 65 })).toEqual({ delta: 25, direction: 'up' });
    expect(computeBeforeAfter({ before: 65, after: 40 })).toEqual({ delta: 25, direction: 'down' });
    expect(computeBeforeAfter({ before: 40, after: 40 })).toEqual({ delta: 0, direction: 'same' });
  });
});

describe('every shipped kind is dispatched by whiteboardComputesOk', () => {
  it('has no kind that falls through — the compiler enforces it, this records why it matters', () => {
    // A kind missing from the switch would be a board nothing verifies, which
    // is the one thing this whole file exists to prevent. TypeScript's
    // exhaustiveness check is what actually guarantees it; this test is the
    // note explaining that the guarantee is deliberate.
    expect(
      whiteboardComputesOk({ kind: 'cycle', steps: ['a', 'b', 'c'], label: 'loop' }),
    ).toBe(true);
    expect(
      whiteboardComputesOk({
        kind: 'timeline',
        unit: 'day',
        span: 3,
        events: [{ label: 'a', at: 1 }, { label: 'b', at: 1 }],
        label: 'when',
      }),
    ).toBe(false);
  });
});
