import type {
  Whiteboard,
  WhiteboardCategories,
  WhiteboardCompare,
  WhiteboardMarkedLine,
  WhiteboardBarModel,
  WhiteboardFlow,
  WhiteboardGoalBar,
  WhiteboardPartWhole,
  WhiteboardSequence,
  WhiteboardTokens,
  WhiteboardWorked,
  WhiteboardArray,
  WhiteboardFractionStrip,
  WhiteboardOpenNumberLine,
  WhiteboardPartition,
  WhiteboardTenFrame,
  WhiteboardChance,
  WhiteboardRanking,
  WhiteboardScale,
  WhiteboardTable,
  WhiteboardTwoBins,
  WhiteboardVenn,
  WhiteboardBudgetPlate,
  WhiteboardChange,
  WhiteboardDeal,
  WhiteboardEquationBar,
  WhiteboardInventory,
  WhiteboardLedger,
  WhiteboardPriceTag,
  WhiteboardReceipt,
  WhiteboardRegroup,
  WhiteboardBeadString,
  WhiteboardBeforeAfter,
  WhiteboardFractionCircle,
  WhiteboardPictograph,
  WhiteboardSequenceCompare,
  WhiteboardStack,
  WhiteboardTally,
  WhiteboardTimeline,
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


/* ── WAVE 1 INSTRUMENTS (/TUTOR_INSTRUMENTS.md Sprints 7-8) ─────────────────── */

/** What a `bar_model` draws beyond its own raw parts — see `computeBarModel`. */
export interface BarModelResult {
  /** Each part's share of the whole, 0..1, in the model's own order. */
  widths: number[];
  /** Which part is the unknown, or null when every part is stated. */
  unknownIndex: number | null;
}

/**
 * Verifies a bar model and derives each part's WIDTH.
 *
 * Deliberately does NOT compute the unknown part's VALUE. That number is the
 * answer, and this board exists so the learner reads it off the picture; sending
 * it would put the solution in the wire for a renderer to accidentally print.
 * The unknown's width IS computed, because making its size apparent is precisely
 * what a bar model is for.
 *
 * Three things no per-field bound can see: more than one unknown (a bar model
 * with two gaps is not a model of anything), stated parts that overrun the
 * whole, and — when every part is stated — parts that do not actually make the
 * whole. All three drop the board entire.
 */
export function computeBarModel(board: Pick<WhiteboardBarModel, 'whole' | 'parts'>): BarModelResult | null {
  const total = board.whole.value;
  if (!Number.isFinite(total) || total <= 0 || total > MAX_VALUE) return null;

  const unknowns = board.parts.filter((p) => p.value === null).length;
  if (unknowns > 1) return null;

  let stated = 0;
  for (const part of board.parts) {
    if (part.value === null) continue;
    if (!Number.isFinite(part.value) || part.value < 0) return null;
    stated += part.value;
  }
  if (stated > total + ZERO_EPSILON) return null;
  // Every part stated must actually bond to the whole — otherwise the picture
  // asserts an arithmetic that is simply false.
  if (unknowns === 0 && Math.abs(stated - total) > ZERO_EPSILON) return null;

  const unknownIndex = board.parts.findIndex((p) => p.value === null);
  const remainder = Math.max(0, total - stated);
  const widths = board.parts.map((p) => (p.value === null ? remainder : p.value) / total);
  return { widths, unknownIndex: unknownIndex === -1 ? null : unknownIndex };
}

/**
 * Verifies a number bond: the two parts must actually make the whole.
 *
 * There is nothing to derive — every value is stated, and that is the point of
 * this board. What it adds is the REFUSAL: a bond that does not balance is
 * dropped entire rather than drawn, because a wrong bond teaches a wrong
 * relationship far more durably than a wrong sentence does.
 */
export function computePartWhole(board: Pick<WhiteboardPartWhole, 'whole' | 'left' | 'right'>): true | null {
  const { whole, left, right } = board;
  for (const v of [whole.value, left.value, right.value]) {
    if (!Number.isFinite(v) || v < 0 || v > MAX_VALUE) return null;
  }
  return Math.abs(left.value + right.value - whole.value) <= ZERO_EPSILON ? true : null;
}

/** What a `flow` board draws beyond what came in and what went out. */
export interface FlowResult {
  /** The third place. THE MODEL HAS NO FIELD FOR THIS — it is the thing being taught. */
  kept: number;
}

/**
 * Verifies a flow and derives what is left.
 *
 * `kept` is the whole lesson of `three-piles-in-out-left.md` — the difference
 * between what came in and what it cost — so the model is given no way to state
 * it. Spending more than came in is refused rather than drawn negative: a loss
 * is a real and teachable situation, but it is a DIFFERENT visual case than
 * three positive piles, and this board is deliberately the bounded first slice.
 */
export function computeFlow(board: Pick<WhiteboardFlow, 'income' | 'spent'>): FlowResult | null {
  const income = board.income.value;
  const spent = board.spent.value;
  if (!Number.isFinite(income) || income < 0 || income > MAX_VALUE) return null;
  if (!Number.isFinite(spent) || spent < 0 || spent > MAX_VALUE) return null;
  if (spent > income + ZERO_EPSILON) return null;
  const kept = Math.max(0, money(income - spent));
  return { kept };
}

/** What a `goal_bar` draws beyond the goal and what is saved. */
export interface GoalBarResult {
  /** How much more is needed. THE MODEL HAS NO FIELD FOR THIS — it is the question. */
  remaining: number;
  /** How much of the bar is shaded, 0..1. */
  savedFraction: number;
}

/**
 * Verifies a savings goal and derives what is missing.
 *
 * `find-what-is-missing.md` asks for the bar to be drawn BEFORE any operation,
 * with the saved part shaded from the left — so what is missing has to be the
 * server's number, not the model's, or the board would be asserting the very
 * answer it was drawn to let the learner find.
 *
 * Saving MORE than the goal is refused: the bar has no way to draw an overflow,
 * and a shaded fraction above 1 would silently clamp into a picture that says
 * "exactly enough" when the story said otherwise.
 */
export function computeGoalBar(board: Pick<WhiteboardGoalBar, 'goal' | 'saved'>): GoalBarResult | null {
  const goal = board.goal.value;
  const saved = board.saved.value;
  if (!Number.isFinite(goal) || goal <= 0 || goal > MAX_VALUE) return null;
  if (!Number.isFinite(saved) || saved < 0 || saved > MAX_VALUE) return null;
  if (saved > goal + ZERO_EPSILON) return null;
  return { remaining: Math.max(0, money(goal - saved)), savedFraction: Math.min(1, saved / goal) };
}

/** What a `worked` example draws beyond its own steps. */
export interface WorkedResult {
  /** The running value after each line, `values[0]` being `start`. */
  values: number[];
  /**
   * The result of UNDOING the last step — the checking move made literal.
   * Equals `values[values.length - 2]` when the arithmetic holds, which is the
   * point: the board can show the check landing back where it started.
   */
  checkValue: number;
}

/**
 * Verifies a worked example and derives both its running values and its CHECK.
 *
 * `worked-example-think-aloud.md` asks for the one thing no other kind draws:
 * "deliberately show the moment of CHECKING… undo the operation." So the check
 * is not a label the model writes, it is arithmetic the server actually
 * performs — a board that claims to verify itself has genuinely been verified
 * by the process that drew it.
 */
export function computeWorked(board: Pick<WhiteboardWorked, 'start' | 'steps'>): WorkedResult | null {
  if (!Number.isFinite(board.start) || board.start < 0 || board.start > MAX_VALUE) return null;
  const values: number[] = [board.start];
  let current = board.start;
  for (const step of board.steps) {
    if (!Number.isFinite(step.value) || step.value <= 0) return null;
    current = money(step.op === 'add' ? current + step.value : current - step.value);
    if (!Number.isFinite(current) || current < -ZERO_EPSILON || current > MAX_VALUE) return null;
    if (current < 0) current = 0;
    values.push(current);
  }
  const last = board.steps[board.steps.length - 1];
  if (!last) return null;
  // Undo it: the inverse operation applied to the result must land on the
  // previous line. Computed rather than assumed, so the drawn check is real.
  const checkValue = money(last.op === 'add' ? current - last.value : current + last.value);
  return { values, checkValue };
}


/* ── THE CANONICAL PRIMARY-MATHS VOCABULARY ─────────────────────────────────── */

/** How a `ten_frame` fills its frames — see `computeTenFrame`. */
export interface TenFrameResult {
  /** How many cells are filled in each frame of ten, in order. */
  frames: number[];
}

/**
 * Splits a count across frames of ten.
 *
 * Deliberately does NOT compute the complement to ten. That number is almost
 * always the question a ten frame is being used to ask ("how many more to make
 * ten?"), and a board that carries the answer is one field away from printing it.
 */
export function computeTenFrame(board: Pick<WhiteboardTenFrame, 'count'>): TenFrameResult | null {
  const { count } = board;
  if (!Number.isInteger(count) || count < 1 || count > 20) return null;
  return { frames: count <= 10 ? [count] : [10, count - 10] };
}

/** Where each jump lands on an open number line — see `computeOpenNumberLine`. */
export interface OpenNumberLineResult {
  /** The value at each stop, starting with `from` and ending on `to`. */
  stops: number[];
  /** Each stop's place along the line, 0..1 — the client draws from this, never from the raw numbers. */
  positions: number[];
}

/**
 * Verifies an open number line and places every stop along it.
 *
 * The refusal is the point: jumps that do not land exactly on `to` are a picture
 * of counting up that never arrives, which teaches the method as unreliable.
 * `make-change-counting-up` is the KC this exists for, and a wrong picture of it
 * is worse than no picture.
 */
export function computeOpenNumberLine(
  board: Pick<WhiteboardOpenNumberLine, 'from' | 'to' | 'jumps'>,
): OpenNumberLineResult | null {
  const { from, to, jumps } = board;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from < 0 || to < 0 || from > MAX_VALUE || to > MAX_VALUE) return null;
  const span = to - from;
  if (span <= ZERO_EPSILON) return null;

  const stops: number[] = [from];
  let current = from;
  for (const jump of jumps) {
    if (!Number.isFinite(jump.value) || jump.value <= 0) return null;
    current = money(current + jump.value);
    if (current > to + ZERO_EPSILON) return null;
    stops.push(current);
  }
  // It has to ARRIVE. A line that stops short is not counting up, it is stopping.
  if (Math.abs(current - to) > ZERO_EPSILON) return null;
  return { stops, positions: stops.map((v) => (v - from) / span) };
}

/** What an `array` adds up to — see `computeArray`. */
export interface ArrayResult {
  /** rows x columns x unitValue. THE MODEL HAS NO FIELD FOR THIS — it is the product being taught. */
  total: number;
  /** How many cells, for a renderer that draws them. */
  cells: number;
}

/** Verifies a rectangle and multiplies it out. */
export function computeArray(board: Pick<WhiteboardArray, 'rows' | 'columns' | 'unitValue'>): ArrayResult | null {
  const { rows, columns, unitValue } = board;
  if (!Number.isInteger(rows) || !Number.isInteger(columns)) return null;
  if (rows < 1 || columns < 1 || rows > 6 || columns > 6) return null;
  if (!Number.isFinite(unitValue) || unitValue <= 0) return null;
  const cells = rows * columns;
  const total = money(cells * unitValue);
  if (!Number.isFinite(total) || total > MAX_VALUE) return null;
  return { total, cells };
}

/** What each strip of a fraction wall shows — see `computeFractionStrip`. */
export interface FractionStripResult {
  /** The shaded share of each row, 0..1, in order. */
  shares: number[];
}

/**
 * Verifies a fraction wall.
 *
 * `highlighted` may not exceed `denominator` — a strip shading five of four
 * pieces is not a fraction, and a per-field bound cannot see the relationship.
 */
export function computeFractionStrip(board: Pick<WhiteboardFractionStrip, 'rows'>): FractionStripResult | null {
  const shares: number[] = [];
  for (const row of board.rows) {
    if (!Number.isInteger(row.denominator) || row.denominator < 1 || row.denominator > 12) return null;
    if (!Number.isInteger(row.highlighted) || row.highlighted < 0) return null;
    if (row.highlighted > row.denominator) return null;
    shares.push(row.highlighted / row.denominator);
  }
  return { shares };
}

/** What one piece is worth in each split — see `computePartition`. */
export interface PartitionResult {
  /** The value of ONE piece in each split, in order. The model has no field for these. */
  pieceValues: number[];
}

/**
 * Verifies a partition and works out what one piece is worth in each split.
 *
 * That value is the whole lesson — "a bigger bottom number means a smaller
 * piece" — so it is derived here rather than stated. Two splits sharing a
 * denominator are refused: drawing the same split twice is not a comparison,
 * and no per-split schema can see it.
 */
export function computePartition(board: Pick<WhiteboardPartition, 'whole' | 'splits'>): PartitionResult | null {
  const { whole, splits } = board;
  if (!Number.isFinite(whole) || whole <= 0 || whole > MAX_VALUE) return null;
  const seen = new Set<number>();
  const pieceValues: number[] = [];
  for (const split of splits) {
    if (!Number.isInteger(split.denominator) || split.denominator < 2 || split.denominator > 12) return null;
    if (seen.has(split.denominator)) return null;
    seen.add(split.denominator);
    pieceValues.push(money(whole / split.denominator));
  }
  return { pieceValues };
}


/* ── DECISION AND COMPARISON ────────────────────────────────────────────────── */

/** What a `table` works out about its options — see `computeTable`. */
export interface TableResult {
  /** Price per unit for each option, in the model's own order. */
  unitPrices: number[];
  /** Which option is cheapest per unit. THE MODEL HAS NO FIELD FOR THIS — it is the comparison being taught. */
  bestIndex: number;
}

/**
 * Works out price per unit for each option and which one actually wins.
 *
 * The whole point of `money.unit-price` is that the cheapest STICKER price and
 * the cheapest per-unit price are often different options, so a tutor that could
 * simply assert a winner could assert the wrong one over correct numbers — the
 * `highest-price-wins` misconception with a picture behind it. A tie refuses
 * rather than picking: two winners is not the lesson.
 */
export function computeTable(board: Pick<WhiteboardTable, 'options'>): TableResult | null {
  const unitPrices: number[] = [];
  for (const option of board.options) {
    if (!Number.isFinite(option.price) || option.price <= 0) return null;
    if (!Number.isFinite(option.units) || option.units <= 0) return null;
    unitPrices.push(money(option.price / option.units));
  }
  let bestIndex = 0;
  for (let i = 1; i < unitPrices.length; i += 1) {
    if (unitPrices[i]! < unitPrices[bestIndex]! - ZERO_EPSILON) bestIndex = i;
  }
  const ties = unitPrices.filter((p) => Math.abs(p - unitPrices[bestIndex]!) <= ZERO_EPSILON).length;
  if (ties > 1) return null;
  return { unitPrices, bestIndex };
}

/** Which way a `scale` tips — see `computeScale`. */
export interface ScaleResult {
  tilt: 'left' | 'right' | 'level';
  difference: number;
}

/**
 * Derives which way the balance tips and by how much.
 *
 * Shares its inputs with `computeComparison` and is kept separate deliberately:
 * `compare` answers "which is more" and this answers "are these fair to each
 * other", and a later change to one should not silently move the other.
 */
export function computeScale(board: Pick<WhiteboardScale, 'left' | 'right'>): ScaleResult | null {
  const { left, right } = board;
  if (!Number.isFinite(left.value) || left.value < 0 || left.value > MAX_VALUE) return null;
  if (!Number.isFinite(right.value) || right.value < 0 || right.value > MAX_VALUE) return null;
  const difference = money(Math.abs(left.value - right.value));
  const tilt: ScaleResult['tilt'] =
    difference <= ZERO_EPSILON ? 'level' : left.value > right.value ? 'left' : 'right';
  return { tilt, difference };
}

/** How many things landed in each bin — see `computeTwoBins`. */
export interface TwoBinsResult {
  counts: [number, number];
}

/**
 * Counts each bin, and refuses a sort with an empty one.
 *
 * A classification board with everything on one side demonstrates nothing about
 * the distinction it was drawn to make — which is the exact failure
 * `value-not-appearance.md` guards against when it asks to "build one case where
 * the two split".
 */
export function computeTwoBins(board: Pick<WhiteboardTwoBins, 'items'>): TwoBinsResult | null {
  const counts: [number, number] = [0, 0];
  for (const item of board.items) {
    if (item.bin !== 0 && item.bin !== 1) return null;
    counts[item.bin] += 1;
  }
  if (counts[0] === 0 || counts[1] === 0) return null;
  return { counts };
}

/** How many things fall on each side of a `venn`, and in the overlap. */
export interface VennResult {
  left: number;
  right: number;
  both: number;
}

/**
 * Counts the three regions, and refuses a Venn with an empty overlap.
 *
 * The overlap IS the instrument. Without something in it this is a two-bin sort
 * drawn as circles, and the misconception it exists for (`want-feels-like-need`)
 * lives entirely in the middle.
 */
export function computeVenn(board: Pick<WhiteboardVenn, 'items'>): VennResult | null {
  const result: VennResult = { left: 0, right: 0, both: 0 };
  for (const item of board.items) result[item.side] += 1;
  if (result.both === 0) return null;
  return result;
}

/** The order a `ranking` puts its items in — see `computeRanking`. */
export interface RankingResult {
  /** Item indices, in the order they should be drawn. The model does not choose this. */
  order: number[];
}

/**
 * Sorts the items. The model supplies amounts and never the order, because
 * putting them in order is the thing being practised.
 *
 * A tie refuses: two items in the same place is not a ranking, and quietly
 * picking one would teach an ordering the numbers do not support.
 */
export function computeRanking(board: Pick<WhiteboardRanking, 'items' | 'direction'>): RankingResult | null {
  const values = board.items.map((i) => i.value);
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > MAX_VALUE)) return null;
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (Math.abs(values[i]! - values[j]!) <= ZERO_EPSILON) return null;
    }
  }
  const order = board.items
    .map((_, i) => i)
    .sort((a, b) => (board.direction === 'asc' ? values[a]! - values[b]! : values[b]! - values[a]!));
  return { order };
}

/** How much of the circle each outcome gets — see `computeChance`. */
export interface ChanceResult {
  /** Each outcome's share of the whole, 0..1, summing to 1. */
  shares: number[];
}

/**
 * Normalises plain weights into shares.
 *
 * The model states WEIGHTS, never percentages, and never a probability of its
 * own: "three times out of four" is a thing a tutor can reason about loosely and
 * get wrong, and a nine-year-old should not be asked to read a percentage to
 * understand that something usually works.
 */
export function computeChance(board: Pick<WhiteboardChance, 'outcomes'>): ChanceResult | null {
  let total = 0;
  for (const outcome of board.outcomes) {
    if (!Number.isInteger(outcome.weight) || outcome.weight < 1) return null;
    total += outcome.weight;
  }
  if (total <= 0) return null;
  return { shares: board.outcomes.map((o) => o.weight / total) };
}


/* ── OPERATIONS AND REAL-MONEY ARTEFACTS ────────────────────────────────────── */

/** How a `deal` shares out — see `computeDeal`. */
export interface DealResult {
  /** How many each place gets. The model has no field for it. */
  perBin: number;
  /** What is left over, and it is not nothing — that is the lesson. */
  remainder: number;
}

/** Shares a total into places and keeps the remainder visible. */
export function computeDeal(board: Pick<WhiteboardDeal, 'total' | 'bins'>): DealResult | null {
  const { total, bins } = board;
  if (!Number.isInteger(total) || total < 1) return null;
  if (bins.length < 2) return null;
  // You cannot deal what you do not have: fewer things than places means at
  // least one place gets nothing, which is a different lesson than sharing.
  if (total < bins.length) return null;
  return { perBin: Math.floor(total / bins.length), remainder: total % bins.length };
}

/** The change owed — see `computeChange`. */
export interface ChangeResult {
  change: number;
}

/**
 * Works out the change. Refuses a payment smaller than the price: a negative
 * change is not a picture of `register-keeps-the-price`, it is a different story
 * about not having enough, and `goal_bar` or `marked_line` tells that one.
 */
export function computeChange(board: Pick<WhiteboardChange, 'price' | 'paid'>): ChangeResult | null {
  const { price, paid } = board;
  if (!Number.isFinite(price) || !Number.isFinite(paid)) return null;
  if (price <= 0 || paid <= 0 || price > MAX_VALUE || paid > MAX_VALUE) return null;
  if (paid < price - ZERO_EPSILON) return null;
  return { change: money(paid - price) };
}

/** What a `regroup` yields — see `computeRegroup`. */
export interface RegroupResult {
  /** How many of the smaller denomination you get back. */
  intoCount: number;
}

/**
 * Breaks a denomination into a smaller one.
 *
 * Refuses anything that does not divide evenly, and refuses breaking a unit into
 * something bigger than itself: a trade that leaves a fraction of a coin is not
 * a thing that happens on a table, and drawing it would teach that it does.
 */
export function computeRegroup(
  board: Pick<WhiteboardRegroup, 'fromDenomination' | 'fromCount' | 'intoDenomination'>,
): RegroupResult | null {
  const { fromDenomination, fromCount, intoDenomination } = board;
  if (!Number.isFinite(fromDenomination) || !Number.isFinite(intoDenomination)) return null;
  if (fromDenomination <= 0 || intoDenomination <= 0) return null;
  if (intoDenomination >= fromDenomination) return null;
  const exact = (fromDenomination * fromCount) / intoDenomination;
  const rounded = Math.round(exact);
  if (Math.abs(exact - rounded) > 1e-6) return null;
  if (rounded < 1 || rounded > 60) return null;
  return { intoCount: rounded };
}

/** What an `equation_bar` weighs — see `computeEquationBar`. */
export interface EquationBarResult {
  /** Both sides, which are equal by construction: an unbalanced board is refused. */
  total: number;
}

/**
 * Verifies that the two sides actually match.
 *
 * An equation drawn out of balance teaches that the equals sign is decorative,
 * which is the opposite of what this instrument exists for.
 */
export function computeEquationBar(
  board: Pick<WhiteboardEquationBar, 'left' | 'right'>,
): EquationBarResult | null {
  const sum = (terms: { value: number }[]) => terms.reduce((acc, t) => acc + t.value, 0);
  for (const term of [...board.left, ...board.right]) {
    if (!Number.isFinite(term.value) || term.value < 0 || term.value > MAX_VALUE) return null;
  }
  const left = money(sum(board.left));
  const right = money(sum(board.right));
  if (Math.abs(left - right) > ZERO_EPSILON) return null;
  return { total: left };
}

/** A receipt's running total — see `computeReceipt`. */
export interface ReceiptResult {
  total: number;
}

/** Adds the lines up. The total is the thing being practised, so it is not a model field. */
export function computeReceipt(board: Pick<WhiteboardReceipt, 'lines'>): ReceiptResult | null {
  let total = 0;
  for (const line of board.lines) {
    if (!Number.isFinite(line.value) || line.value < 0 || line.value > MAX_VALUE) return null;
    total = money(total + line.value);
  }
  if (total <= 0 || total > MAX_VALUE) return null;
  return { total };
}

/** A ledger's running balance after each line — see `computeLedger`. */
export interface LedgerResult {
  balances: number[];
  final: number;
}

/**
 * Runs the ledger.
 *
 * Refuses a balance that ever goes below zero: a child's ledger that goes
 * negative is a story about debt, which is not what `biz.revenue`/`profit` is
 * teaching here and which this board has no way to draw honestly.
 */
export function computeLedger(board: Pick<WhiteboardLedger, 'entries'>): LedgerResult | null {
  const balances: number[] = [];
  let running = 0;
  for (const entry of board.entries) {
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) return null;
    running = money(entry.direction === 'in' ? running + entry.amount : running - entry.amount);
    if (running < -ZERO_EPSILON || running > MAX_VALUE) return null;
    if (running < 0) running = 0;
    balances.push(running);
  }
  return { balances, final: running };
}

/** What a price tag works out — see `computePriceTag`. */
export interface PriceTagResult {
  /** What one unit costs after any discount. */
  unitPrice: number;
  /** What the whole thing costs after any discount. */
  finalPrice: number;
}

/** Applies the discount and divides by the quantity — the two numbers a shopper is working out. */
export function computePriceTag(
  board: Pick<WhiteboardPriceTag, 'price' | 'units' | 'discountPercent'>,
): PriceTagResult | null {
  const { price, units, discountPercent } = board;
  if (!Number.isFinite(price) || price <= 0 || price > MAX_VALUE) return null;
  if (!Number.isFinite(units) || units <= 0) return null;
  if (discountPercent !== null && (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 90)) {
    return null;
  }
  const finalPrice = money(discountPercent === null ? price : price * (1 - discountPercent / 100));
  return { unitPrice: money(finalPrice / units), finalPrice };
}

/** What is left in stock — see `computeInventory`. */
export interface InventoryResult {
  left: number;
}

/** Refuses selling more than you had: stock that goes negative is not a thing on a shelf. */
export function computeInventory(board: Pick<WhiteboardInventory, 'start' | 'sold'>): InventoryResult | null {
  const { start, sold } = board;
  if (!Number.isInteger(start) || !Number.isInteger(sold)) return null;
  if (start < 1 || sold < 0 || sold > start) return null;
  return { left: start - sold };
}

/** What a budget plate has left, or is over by — see `computeBudgetPlate`. */
export interface BudgetPlateResult {
  spent: number;
  /** What is still available. Zero once the ceiling is reached. */
  remaining: number;
  /** How far past the ceiling, or 0. Drawn so an overspend shows what it STEALS FROM. */
  overBy: number;
}

/**
 * Adds the items up against the ceiling.
 *
 * Overspending is NOT refused here, unlike most boards: `budget-is-per-item` is
 * the belief that a budget applies to each thing separately, and the only way to
 * break it is to let the learner see the total cross the line. A refusal would
 * hide exactly the case the instrument exists for.
 */
export function computeBudgetPlate(
  board: Pick<WhiteboardBudgetPlate, 'budget' | 'items'>,
): BudgetPlateResult | null {
  const { budget } = board;
  if (!Number.isFinite(budget) || budget <= 0 || budget > MAX_VALUE) return null;
  let spent = 0;
  for (const item of board.items) {
    if (!Number.isFinite(item.value) || item.value < 0 || item.value > MAX_VALUE) return null;
    spent = money(spent + item.value);
  }
  if (spent > MAX_VALUE) return null;
  return {
    spent,
    remaining: Math.max(0, money(budget - spent)),
    overBy: Math.max(0, money(spent - budget)),
  };
}


/* ── EARLY YEARS AND TIME ───────────────────────────────────────────────────── */

/** What each pictograph row adds up to. */
export interface PictographResult {
  totals: number[];
}

/** Multiplies each row's icon count by what one icon is worth. */
export function computePictograph(board: Pick<WhiteboardPictograph, 'rows' | 'unitValue'>): PictographResult | null {
  if (!Number.isFinite(board.unitValue) || board.unitValue <= 0) return null;
  const totals: number[] = [];
  for (const row of board.rows) {
    if (!Number.isInteger(row.count) || row.count < 1) return null;
    const total = money(row.count * board.unitValue);
    if (!Number.isFinite(total) || total > MAX_VALUE) return null;
    totals.push(total);
  }
  return { totals };
}

/** How a bead string groups into fives — see `computeBeadString`. */
export interface BeadStringResult {
  /** Beads on each of the two rows of ten. */
  rows: number[];
}

/** Splits a count across two rows of ten. The complement is never computed — it is the question. */
export function computeBeadString(board: Pick<WhiteboardBeadString, 'count'>): BeadStringResult | null {
  const { count } = board;
  if (!Number.isInteger(count) || count < 1 || count > 20) return null;
  return { rows: count <= 10 ? [count] : [10, count - 10] };
}

/** How each tally group breaks into fives — see `computeTally`. */
export interface TallyResult {
  /** [complete groups of five, leftover marks] per group. */
  fives: [number, number][];
}

/** Splits each count into fives and singles, which is how a tally is actually written. */
export function computeTally(board: Pick<WhiteboardTally, 'groups'>): TallyResult | null {
  const fives: [number, number][] = [];
  for (const group of board.groups) {
    if (!Number.isInteger(group.count) || group.count < 1 || group.count > 20) return null;
    fives.push([Math.floor(group.count / 5), group.count % 5]);
  }
  return { fives };
}

/** The shaded share of a fraction circle. */
export interface FractionCircleResult {
  share: number;
}

/** Refuses shading more pieces than the circle has — no per-field bound can see that relationship. */
export function computeFractionCircle(
  board: Pick<WhiteboardFractionCircle, 'denominator' | 'highlighted'>,
): FractionCircleResult | null {
  const { denominator, highlighted } = board;
  if (!Number.isInteger(denominator) || denominator < 2 || denominator > 12) return null;
  if (!Number.isInteger(highlighted) || highlighted < 0 || highlighted > denominator) return null;
  return { share: highlighted / denominator };
}

/** What each stacked column totals, and the tallest one. */
export interface StackResult {
  totals: number[];
  /** The tallest column, so every column is drawn against the same scale. */
  max: number;
}

/** Adds each column up and finds the scale they share. */
export function computeStack(board: Pick<WhiteboardStack, 'columns'>): StackResult | null {
  const totals: number[] = [];
  for (const column of board.columns) {
    let total = 0;
    for (const part of column.parts) {
      if (!Number.isFinite(part.value) || part.value < 0 || part.value > MAX_VALUE) return null;
      total = money(total + part.value);
    }
    if (total <= 0 || total > MAX_VALUE) return null;
    totals.push(total);
  }
  return { totals, max: Math.max(...totals) };
}

/** Both trajectories of a `sequence_compare`, folded — see `computeSequenceCompare`. */
export interface SequenceCompareResult {
  /** One running-value array per track, in the model's own order. */
  values: number[][];
}

/**
 * Folds both trajectories, and refuses tracks of different lengths.
 *
 * Two lines over different numbers of periods would draw a difference in OUTCOME
 * that is really a difference in how long you looked — the exact confusion this
 * instrument exists to remove from `money.simple-interest-peek`.
 */
export function computeSequenceCompare(
  board: Pick<WhiteboardSequenceCompare, 'tracks'>,
): SequenceCompareResult | null {
  const [first, second] = board.tracks;
  if (first.steps.length !== second.steps.length) return null;
  const values: number[][] = [];
  for (const track of board.tracks) {
    const folded = computeSequence({ start: track.start, steps: track.steps });
    if (folded === null) return null;
    values.push(folded);
  }
  return { values };
}

/** Where each timeline event sits along the line. */
export interface TimelineResult {
  /** 0..1 along the span, one per event. */
  positions: number[];
}

/**
 * Places each event, and refuses one that falls outside the span or two that
 * land on the same period — a timeline with two events in one place cannot show
 * the ORDER it exists to show.
 */
export function computeTimeline(board: Pick<WhiteboardTimeline, 'span' | 'events'>): TimelineResult | null {
  const { span, events } = board;
  if (!Number.isInteger(span) || span < 2) return null;
  const seen = new Set<number>();
  const positions: number[] = [];
  for (const event of events) {
    if (!Number.isInteger(event.at) || event.at < 1 || event.at > span) return null;
    if (seen.has(event.at)) return null;
    seen.add(event.at);
    positions.push((event.at - 1) / (span - 1));
  }
  return { positions };
}

/** What changed between two states — see `computeBeforeAfter`. */
export interface BeforeAfterResult {
  /** How much it moved. THE MODEL HAS NO FIELD FOR THIS — it is the question. */
  delta: number;
  direction: 'up' | 'down' | 'same';
}

/** Works out what changed, and which way. */
export function computeBeforeAfter(
  board: Pick<WhiteboardBeforeAfter, 'before' | 'after'>,
): BeforeAfterResult | null {
  const { before, after } = board;
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before < 0 || after < 0 || before > MAX_VALUE || after > MAX_VALUE) return null;
  const delta = money(Math.abs(after - before));
  const direction: BeforeAfterResult['direction'] =
    delta <= ZERO_EPSILON ? 'same' : after > before ? 'up' : 'down';
  return { delta, direction };
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
    case 'bar_model':
      return computeBarModel(board) !== null;
    case 'part_whole':
      return computePartWhole(board) !== null;
    case 'flow':
      return computeFlow(board) !== null;
    case 'goal_bar':
      return computeGoalBar(board) !== null;
    case 'worked':
      return computeWorked(board) !== null;
    case 'ten_frame':
      return computeTenFrame(board) !== null;
    case 'open_number_line':
      return computeOpenNumberLine(board) !== null;
    case 'array':
      return computeArray(board) !== null;
    case 'fraction_strip':
      return computeFractionStrip(board) !== null;
    case 'partition':
      return computePartition(board) !== null;
    case 'table':
      return computeTable(board) !== null;
    case 'scale':
      return computeScale(board) !== null;
    case 'two_bins':
      return computeTwoBins(board) !== null;
    case 'venn':
      return computeVenn(board) !== null;
    case 'ranking':
      return computeRanking(board) !== null;
    case 'outcomes':
      // Prose only — nothing to compute, and nothing that could be wrong about
      // it in the way a number can be. Moderation is what guards this one.
      return true;
    case 'trade':
      return true;
    case 'chance':
      return computeChance(board) !== null;
    case 'deal':
      return computeDeal(board) !== null;
    case 'change':
      return computeChange(board) !== null;
    case 'regroup':
      return computeRegroup(board) !== null;
    case 'equation_bar':
      return computeEquationBar(board) !== null;
    case 'receipt':
      return computeReceipt(board) !== null;
    case 'ledger':
      return computeLedger(board) !== null;
    case 'price_tag':
      return computePriceTag(board) !== null;
    case 'inventory':
      return computeInventory(board) !== null;
    case 'budget_plate':
      return computeBudgetPlate(board) !== null;
    case 'pictograph':
      return computePictograph(board) !== null;
    case 'bead_string':
      return computeBeadString(board) !== null;
    case 'tally':
      return computeTally(board) !== null;
    case 'fraction_circle':
      return computeFractionCircle(board) !== null;
    case 'stack':
      return computeStack(board) !== null;
    case 'sequence_compare':
      return computeSequenceCompare(board) !== null;
    case 'timeline':
      return computeTimeline(board) !== null;
    case 'before_after':
      return computeBeforeAfter(board) !== null;
    // No numbers at all: 3-5 short steps that come back to their start.
    // Moderation is this one's whole guard.
    case 'cycle':
      return true;
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
