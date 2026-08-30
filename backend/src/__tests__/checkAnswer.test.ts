import { describe, expect, it } from 'vitest';
import { checkAttempt, type MisconceptionDef } from '../services/pedagogy/checkAnswer.js';

/*
 * This file had NO test coverage before this fix — `checkAttempt` is the
 * deterministic misconception detector every graded activity runs through,
 * and it was verified only by adversarial review directly against the
 * compiled output. Scoped to the fix at hand (a new numeric pattern) plus
 * enough surrounding coverage to ground it in real behavior, not a
 * wholesale backfill of every existing pattern.
 */

const DECIMAL_MISALIGNED: MisconceptionDef = {
  id: 'mis-1',
  code: 'adds-digits-ignores-decimal',
  distractorPatterns: { numeric: ['decimal_misaligned'], option_tags: ['decimal-misaligned'] },
};

/*
 * Found by adversarial review, round 52 (2026-08-30, MEDIUM/HIGH): this
 * misconception — real, seeded, attached to money.add-money — carried ONLY
 * an option_tags pattern, which checkAttempt never consults for a
 * kind:'numeric' attempt, the exact shape money.add-money's own
 * direct-amount-entry activities produce. A learner submitting the
 * catalog's own textbook wrong answer (1.50 + 2.50 -> "3.100" -> 3.1) was
 * diagnosed as nothing more specific than "incorrect".
 */
describe('checkAttempt diagnoses "adds digits, ignores the decimal" from a real numeric submission', () => {
  it('recognizes the exact wrong answer the catalog describes (1.50 + 2.50 = "3.100")', () => {
    const result = checkAttempt(
      { kind: 'numeric', submitted: 3.1, expected: 4, operands: { a: 1.5, b: 2.5 } },
      [DECIMAL_MISALIGNED],
    );
    expect(result).toEqual({ correct: false, misconceptionId: 'mis-1', misconceptionCode: 'adds-digits-ignores-decimal' });
  });

  it('still diagnoses it for a different pair of amounts that genuinely needs a carry — the pattern computes, it does not memorize one case', () => {
    // 1.60 -> whole 1, cents 60; 1.50 -> whole 1, cents 50; wholeSum 2, centsSum 110 -> "2.110" -> 2.11
    // Correctly, 1.60 + 1.50 = 3.10 — the carry the misconception skips.
    const result = checkAttempt(
      { kind: 'numeric', submitted: 2.11, expected: 3.1, operands: { a: 1.6, b: 1.5 } },
      [DECIMAL_MISALIGNED],
    );
    expect(result).toEqual({ correct: false, misconceptionId: 'mis-1', misconceptionCode: 'adds-digits-ignores-decimal' });
  });

  it('does not diagnose a wrong answer that has nothing to do with this pattern', () => {
    const result = checkAttempt(
      { kind: 'numeric', submitted: 0, expected: 4, operands: { a: 1.5, b: 2.5 } },
      [DECIMAL_MISALIGNED],
    );
    expect(result).toEqual({ correct: false, misconceptionId: null, misconceptionCode: null });
  });

  it('a correct answer is never diagnosed, even against a catalog that could match it', () => {
    const result = checkAttempt(
      { kind: 'numeric', submitted: 4, expected: 4, operands: { a: 1.5, b: 2.5 } },
      [DECIMAL_MISALIGNED],
    );
    expect(result).toEqual({ correct: true, misconceptionId: null, misconceptionCode: null });
  });
});
