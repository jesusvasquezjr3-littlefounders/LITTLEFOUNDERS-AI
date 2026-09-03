import type {
  Whiteboard,
  WhiteboardCategories,
  WhiteboardCompare,
  WhiteboardMarkedLine,
  WhiteboardSequence,
  WhiteboardTokens,
} from './turnSchema.js';

/*
 * THE NUMBERS ON THE BOARD ARE COMPUTED, NEVER TAKEN ON THE MODEL'S WORD.
 *
 * This is the same rule `arithmetic.ts` applies to a spoken answer, extended
 * to what gets DRAWN: the model proposes the raw shape of a board as part of
 * its story, and the functions in this file are the only thing that turn
 * that proposal into the values a child actually sees. A drawn number that
 * turned out to be wrong would be worse than a spoken one — a wrong picture
 * is remembered longer than a wrong sentence.
 *
 * DELIBERATELY NARROW, same posture as the rest of §5: closed vocabularies,
 * bounded numbers, a ceiling on every intermediate or derived value.
 * Anything that would produce a non-finite, negative, or absurd value
 * returns null — and null means "drop the whiteboard from this turn,
 * exactly as if the model had not set one", never "show whatever came out."
 *
 * ONE FUNCTION PER `kind` (`computeSequence`, `computeComparison`,
 * `computeMarkedLine`), because each verifies a DIFFERENT thing a schema
 * alone cannot: `computeSequence` re-folds a multi-step running total no
 * per-field bound could catch; `computeMarkedLine` checks a relationship
 * BETWEEN fields (`max > min`, a mark actually inside the line) that
 * `z.discriminatedUnion` cannot carry a `.refine()` for (see
 * `WhiteboardMarkedLineSchema`'s own comment, turnSchema.ts); `computeComparison`
 * has no fold and no cross-field bound to check — both its inputs are
 * already fully bounded by the schema — so its own null path is pure
 * defense-in-depth against a value reaching it OUTSIDE a fresh, schema-
 * validated model turn (a resumed snapshot written by a different schema
 * version), the same reason `computeSequence`'s own `start` re-check below
 * is redundant with the schema for THAT one field and exists anyway. What
 * `computeComparison` genuinely adds is `difference`/`greater` — DERIVED
 * facts the schema gives the model no field to assert in the first place,
 * computed here so the client never does that arithmetic itself.
 */

/** No intermediate or final value may exceed this — a board is a story aid, not a ledger. */
const MAX_VALUE = 10_000_000;

/**
 * A running value this close to zero is zero — floating-point noise from
 * decimal subtraction (e.g. `0.3 - 0.1 - 0.1 - 0.1 === -2.7755575615628914e-17`
 * in JS), not a negative amount. Found by adversarial review, 2026-08-30
 * (MEDIUM): a valid "spend it down to zero" sequence with decimal steps
 * landed a hair below zero and silently dropped the whole whiteboard, as if
 * the model had never asked for one.
 */
const ZERO_EPSILON = 1e-9;

/**
 * The running value after each step, `values[0]` being `start` itself. Null
 * if the proposal does not compute to a sane sequence.
 */
export function computeSequence(board: Pick<WhiteboardSequence, 'start' | 'steps'>): number[] | null {
  const values: number[] = [board.start];
  if (!Number.isFinite(board.start) || board.start < 0 || board.start > MAX_VALUE) return null;

  let current = board.start;
  for (const step of board.steps) {
    if (!Number.isFinite(step.value) || step.value <= 0) return null;
    switch (step.op) {
      case 'add':
        current += step.value;
        break;
      case 'subtract':
        current -= step.value;
        break;
      case 'multiply_percent':
        // "the box gives you 20% more" — a percentage step, never a bare
        // multiplier, so the model cannot express "×1000" as one field.
        if (step.value > 500) return null;
        current += current * (step.value / 100);
        break;
    }
    if (!Number.isFinite(current) || current < -ZERO_EPSILON || current > MAX_VALUE) return null;
    if (current < 0) current = 0;
    values.push(current);
  }
  return values;
}

/** The two facts a `compare` board draws beyond its own two raw values — see this file's header comment. */
export interface ComparisonResult {
  difference: number;
  greater: 'left' | 'right' | 'tie';
}

/**
 * Verifies a `compare` board's two quantities and derives the two facts
 * about them the schema gives the model no field to assert directly:
 * how far apart they are, and which is larger. Null on anything that could
 * only reach here from outside a schema-validated turn (see this file's
 * header comment) — never on a value a real model turn can actually carry,
 * both of which are already bounded by `WhiteboardCompareSideSchema`.
 */
export function computeComparison(board: Pick<WhiteboardCompare, 'left' | 'right'>): ComparisonResult | null {
  const { left, right } = board;
  if (!Number.isFinite(left.value) || left.value < 0 || left.value > MAX_VALUE) return null;
  if (!Number.isFinite(right.value) || right.value < 0 || right.value > MAX_VALUE) return null;
  const difference = Math.abs(right.value - left.value);
  const greater: ComparisonResult['greater'] =
    Math.abs(left.value - right.value) <= ZERO_EPSILON ? 'tie' : left.value > right.value ? 'left' : 'right';
  return { difference, greater };
}

/** One mark on a `marked_line` board, positioned along it — see `computeMarkedLine`. */
export interface MarkedLinePoint {
  value: number;
  label: string;
  /** Where this mark sits between `min` (0) and `max` (1) — the client draws from this, never from `value`/`min`/`max` directly. */
  position: number;
}

/**
 * Verifies a `marked_line` board and positions every mark along it.
 *
 * `max > min` and "every mark actually falls within [min, max]" are exactly
 * the kind of cross-field relationship `WhiteboardMarkedLineSchema` cannot
 * enforce itself (see that schema's own comment) — a model can set
 * `min: 50, max: 10` and pass every individual field bound, and this is the
 * only thing that then catches it and drops the whole board, fail-open,
 * the same posture `computeSequence` already gives a sequence whose own
 * running total goes out of range.
 *
 * `position` is the derived fact the client renders from — never `value`
 * relative to `min`/`max` computed again on the client, the same "the
 * server computes it once, the client only draws it" rule `values` already
 * follows for `sequence`.
 */
export function computeMarkedLine(
  board: Pick<WhiteboardMarkedLine, 'min' | 'max' | 'marks'>,
): MarkedLinePoint[] | null {
  const { min, max, marks } = board;
  if (!Number.isFinite(min) || min < 0 || min > MAX_VALUE) return null;
  if (!Number.isFinite(max) || max < 0 || max > MAX_VALUE) return null;
  // A real range, never zero-width or inverted — see the doc comment above.
  if (max - min <= ZERO_EPSILON) return null;

  const span = max - min;
  const points: MarkedLinePoint[] = [];
  for (const mark of marks) {
    if (!Number.isFinite(mark.value)) return null;
    if (mark.value < min - ZERO_EPSILON || mark.value > max + ZERO_EPSILON) return null;
    const clamped = Math.min(max, Math.max(min, mark.value));
    points.push({ value: clamped, label: mark.label, position: (clamped - min) / span });
  }
  return points;
}

/**
 * THE DENOMINATIONS THAT ACTUALLY EXIST, per currency.
 *
 * A `tokens` board draws money a learner can recognise from their own hand, so
 * a denomination that does not exist is not a rounding error — it teaches
 * something false about the real world. `WhiteboardTokenGroupSchema` can bound
 * one number; only this table can say that 7 is not a coin in any of the three
 * currencies this product ships (§1.14, "generated content must be verified for
 * SUBJECT, not only for form").
 *
 * Expressed in each currency's MAJOR unit, sub-unit coins included, because a
 * lesson about change needs the 50-centavo piece as much as the 10-peso one.
 */
const DENOMINATIONS: Readonly<Record<'MXN' | 'USD' | 'BRL', readonly number[]>> = {
  MXN: [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000],
  USD: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100],
  BRL: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200],
};

/** No board may put more than this many objects on the table — past it, nobody counts, they estimate. */
const MAX_TOKENS_ON_TABLE = 24;

/** What a `tokens` board draws beyond the model's own piles — see `computeTokens`. */
export interface TokensResult {
  /** The value of each pile, in the model's own order. */
  subtotals: number[];
  /** The value of the whole table. THE MODEL HAS NO FIELD FOR THIS — see `WhiteboardTokensSchema`. */
  total: number;
}

/** Money arithmetic in floating point: 0.1 × 3 is 0.30000000000000004, and a child would read that. */
const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Verifies a `tokens` board and computes what it adds up to.
 *
 * THIS IS THE ARITHMETIC THE LEARNER IS DOING, which is exactly why the schema
 * gives the model no field to state it — the same rule that keeps `greater` off
 * `WhiteboardCompareSchema`. A tutor that could assert the total of a pile could
 * assert a wrong one over a correct picture, and a wrong picture of money is
 * remembered longer than a wrong sentence.
 *
 * Three things no per-field bound can catch, all of them fail-open (null drops
 * the whole board): a denomination that does not exist in this currency; more
 * objects than anyone can count at a glance; and a table whose value runs past
 * the ceiling every other kind already respects.
 */
export function computeTokens(board: Pick<WhiteboardTokens, 'groups' | 'currency'>): TokensResult | null {
  const allowed = DENOMINATIONS[board.currency];
  if (!allowed) return null;

  let objects = 0;
  let total = 0;
  const subtotals: number[] = [];

  for (const group of board.groups) {
    if (!Number.isFinite(group.denomination) || !Number.isInteger(group.count)) return null;
    // `.some` with an epsilon rather than `.includes`: the denominations above
    // are decimals, and a model that emits 0.10 for 0.1 is right about the money.
    if (!allowed.some((d) => Math.abs(d - group.denomination) <= ZERO_EPSILON)) return null;
    if (group.count < 1) return null;

    objects += group.count;
    if (objects > MAX_TOKENS_ON_TABLE) return null;

    const subtotal = money(group.denomination * group.count);
    if (!Number.isFinite(subtotal)) return null;
    subtotals.push(subtotal);
    total = money(total + subtotal);
  }

  if (!Number.isFinite(total) || total <= 0 || total > MAX_VALUE) return null;
  return { subtotals, total };
}

/**
 * True when a whiteboard's own numbers compute to something sane, dispatched
 * to the right function above for its `kind`. The single "is this board
 * valid at all" gate every kind must pass before it can reach a child's
 * screen — used at BOTH the authoring-time check (orchestrator.ts) and,
 * via the kind-specific functions directly, at the wire (ws/server.ts) — so
 * a new kind is never checked one way when authored and a different way
 * when served.
 */
export function whiteboardComputesOk(board: Whiteboard): boolean {
  switch (board.kind) {
    case 'sequence':
      return computeSequence(board) !== null;
    case 'compare':
      return computeComparison(board) !== null;
    case 'marked_line':
      return computeMarkedLine(board) !== null;
    case 'categories':
      return computeCategories(board) !== null;
    case 'tokens':
      return computeTokens(board) !== null;
  }
}

/**
 * The bar value for each named category, in the model's own order. Null
 * drops the whole board — the same fail-open posture `computeSequence`
 * gives a sequence whose arithmetic does not check out.
 *
 * `WhiteboardCategorySchema` already bounds each category's own `label` and
 * `value` independently (turnSchema.ts), so the finite/non-negative checks
 * below are defense in depth rather than this function's real job. What no
 * PER-CATEGORY schema can see is a relationship ACROSS categories: two bars
 * sharing the same label would draw two bars a learner cannot tell apart,
 * and nothing about either category alone is invalid — the same reason
 * `computeSequence` exists to catch a RUNNING total no single step's own
 * bound can express.
 */
export function computeCategories(board: Pick<WhiteboardCategories, 'categories'>): number[] | null {
  const seenLabels = new Set<string>();
  const values: number[] = [];
  for (const category of board.categories) {
    if (!Number.isFinite(category.value) || category.value < 0 || category.value > MAX_VALUE) return null;
    const key = category.label.trim().toLowerCase();
    if (key.length === 0 || seenLabels.has(key)) return null;
    seenLabels.add(key);
    values.push(category.value);
  }
  return values;
}
