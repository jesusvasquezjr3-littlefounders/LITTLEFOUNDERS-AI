/*
 * Deterministic answer checking + misconception detection.
 *
 * THE RULE (blueprint §12.2, /ORACLE.md v3): the LLM never judges whether an
 * answer is correct. Correctness is arithmetic against the segment's own key;
 * a WRONG answer is then matched against the KC's misconception catalog to
 * decide whether it was a systematic wrong idea rather than noise.
 *
 * Numeric misconception patterns are a CLOSED vocabulary evaluated against
 * the item's named operands (e.g. change-making exposes a=price, b=paid,
 * target=change). A pattern whose operands are absent is skipped, never
 * guessed. Option-tag patterns match tags the authored item attached to the
 * chosen distractor.
 */

export interface MisconceptionDef {
  id: string;
  code: string;
  /** {"numeric": ["a+b"], "option_tags": ["adds-instead-of-counts-up"]} */
  distractorPatterns: { numeric?: string[]; option_tags?: string[] };
}

export interface NumericAttempt {
  kind: 'numeric';
  /** What the learner answered, already normalized to a number. */
  submitted: number;
  /** The correct value from the verified key. */
  expected: number;
  /** Named operands of the item — the pattern vocabulary reads these. */
  operands: Record<string, number>;
  /** Money comparisons tolerate float dust, nothing else. */
  toleranceCents?: number;
}

export interface OptionAttempt {
  kind: 'option';
  correct: boolean;
  /** Tags the authored item attached to the CHOSEN option. */
  chosenTags: string[];
}

export type CheckedAttempt = NumericAttempt | OptionAttempt;

const TOLERANCE = 0.005;

function near(a: number, b: number, toleranceCents = 0): boolean {
  return Math.abs(a - b) <= TOLERANCE + toleranceCents / 100;
}

/**
 * The closed numeric-pattern vocabulary. Each entry computes "the answer this
 * wrong idea would produce" from the item's operands, or null when the item
 * does not carry the operands the pattern needs.
 */
const NUMERIC_PATTERNS: Record<string, (ops: Record<string, number>) => number | null> = {
  'a+b': (o) => (o.a !== undefined && o.b !== undefined ? o.a + o.b : null),
  'a-b': (o) => (o.a !== undefined && o.b !== undefined ? o.a - o.b : null),
  'b-a': (o) => (o.a !== undefined && o.b !== undefined ? o.b - o.a : null),
  'a*b': (o) => (o.a !== undefined && o.b !== undefined ? o.a * o.b : null),
  'a': (o) => o.a ?? null,
  'b': (o) => o.b ?? null,
  /** Answered with the COUNT of pieces instead of their value. */
  'count': (o) => o.count ?? null,
  /** Percent read as an absolute amount: answered the percent number itself. */
  'p': (o) => o.p ?? null,
  /** Divided the whole goal instead of the missing part. */
  'goal_div_rate': (o) =>
    o.goal !== undefined && o.rate !== undefined && o.rate > 0 ? o.goal / o.rate : null,
  /** Digit-wise subtraction: always small-from-large per column. */
  'digitwise_diff': (o) => {
    if (o.a === undefined || o.b === undefined) return null;
    const [x, y] = [Math.round(o.a * 100), Math.round(o.b * 100)];
    const xs = String(Math.max(x, y));
    const ys = String(Math.min(x, y)).padStart(xs.length, '0');
    let out = '';
    for (let i = 0; i < xs.length; i++) {
      out += String(Math.abs(Number(xs[i]) - Number(ys[i])));
    }
    return Number(out) / 100;
  },
};

/** Predicates that need the submitted value itself, not an equality target. */
const RELATIONAL_PATTERNS: Record<string, (submitted: number, ops: Record<string, number>) => boolean> = {
  /** Overshot: kept going past the target. */
  'gt_target': (submitted, o) => (o.target !== undefined ? submitted > o.target + TOLERANCE : false),
};

export interface CheckResult {
  correct: boolean;
  misconceptionId: string | null;
  misconceptionCode: string | null;
}

/**
 * Verdict + misconception in one pass. Only a WRONG answer is matched against
 * the catalog — a correct answer that coincides with a pattern is correct.
 */
export function checkAttempt(attempt: CheckedAttempt, catalog: MisconceptionDef[]): CheckResult {
  if (attempt.kind === 'option') {
    if (attempt.correct) return { correct: true, misconceptionId: null, misconceptionCode: null };
    for (const def of catalog) {
      const tags = def.distractorPatterns.option_tags ?? [];
      if (tags.some((t) => attempt.chosenTags.includes(t))) {
        return { correct: false, misconceptionId: def.id, misconceptionCode: def.code };
      }
    }
    return { correct: false, misconceptionId: null, misconceptionCode: null };
  }

  const correct = near(attempt.submitted, attempt.expected, attempt.toleranceCents ?? 0);
  if (correct) return { correct: true, misconceptionId: null, misconceptionCode: null };

  for (const def of catalog) {
    for (const pattern of def.distractorPatterns.numeric ?? []) {
      const relational = RELATIONAL_PATTERNS[pattern];
      if (relational) {
        if (relational(attempt.submitted, attempt.operands)) {
          return { correct: false, misconceptionId: def.id, misconceptionCode: def.code };
        }
        continue;
      }
      const compute = NUMERIC_PATTERNS[pattern];
      if (!compute) continue; // unknown pattern: skip, never guess
      const predicted = compute(attempt.operands);
      // A pattern that predicts the CORRECT answer cannot diagnose anything.
      if (predicted === null || near(predicted, attempt.expected, attempt.toleranceCents ?? 0)) continue;
      if (near(attempt.submitted, predicted, attempt.toleranceCents ?? 0)) {
        return { correct: false, misconceptionId: def.id, misconceptionCode: def.code };
      }
    }
  }
  return { correct: false, misconceptionId: null, misconceptionCode: null };
}
