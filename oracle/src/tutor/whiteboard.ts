import type { CategoriesBoard, SequenceBoard, Whiteboard } from './turnSchema.js';

/*
 * THE NUMBERS ON THE BOARD ARE COMPUTED, NEVER TAKEN ON THE MODEL'S WORD.
 *
 * This is the same rule `arithmetic.ts` applies to a spoken answer, extended
 * to what gets DRAWN: the model proposes `start` and `steps` as part of its
 * story, and this function is the only thing that turns that proposal into
 * the values a child actually sees. A drawn number that turned out to be
 * wrong would be worse than a spoken one — a wrong picture is remembered
 * longer than a wrong sentence.
 *
 * DELIBERATELY NARROW, same posture as the rest of §5: one operation per
 * step from a three-item vocabulary, whole numbers in, a ceiling on every
 * intermediate. Anything that would produce a non-finite, negative, or
 * absurd running value returns null — and null means "drop the whiteboard
 * from this turn, exactly as if the model had not set one", never "show
 * whatever came out."
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
export function computeSequence(board: Pick<SequenceBoard, 'start' | 'steps'>): number[] | null {
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
export function computeCategories(board: Pick<CategoriesBoard, 'categories'>): number[] | null {
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

/**
 * Re-derives the values ANY whiteboard kind actually draws, dispatched by
 * `kind` — never taken from wherever the board was last computed, at
 * whichever of the three points in a turn's life this is called from
 * (authoring-time in `orchestrator.ts`, delivery and resume-redraw in
 * `ws/server.ts`). One dispatch point so a future third kind is one more
 * `case` here, not a third call site elsewhere to remember to update — the
 * same reasoning `prompt.ts`'s `REPEATING_CUE` gives for deriving a regex
 * from a shared table instead of authoring it twice.
 */
export function computeWhiteboardValues(board: Whiteboard): number[] | null {
  switch (board.kind) {
    case 'sequence':
      return computeSequence(board);
    case 'categories':
      return computeCategories(board);
  }
}
