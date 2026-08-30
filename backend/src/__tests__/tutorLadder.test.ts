import { describe, expect, it } from 'vitest';
import {
  composeExactTray,
  orderCandidates,
  submissionFromKey,
  verifyGeneratedSegment,
} from '../services/tutorLadder.js';
import { GRADERS } from '../lesson-contract/registry.js';
import type { SegmentBase } from '../lesson-contract/core/types.js';

/*
 * The money trays joined the live allowlist (Tutor v3). Their keys are EMPTY
 * by design — the grader reads the payload — so verification means composing
 * an exact tray. These tests pin that the composition really scores 100
 * against the REAL grader, and that an unreachable target fails the segment
 * rather than serving an unwinnable exercise.
 */

function traySegment(type: 'coin_count' | 'make_change', payload: Record<string, unknown>): SegmentBase {
  return {
    id: 'seg-tray-1',
    type,
    prompt_md: 'Arma la cantidad exacta.',
    difficulty: 2,
    xp: 20,
    payload: { currency: 'MXN', ...payload },
    answer: {},
  } as unknown as SegmentBase;
}

describe('orderCandidates — the visual-type preference (V4 sprint 2 backlog)', () => {
  const candidate = (type: string, difficulty: number) => ({ type, difficulty });

  it('is a plain difficulty sort when no preference is given', () => {
    const candidates = [candidate('quiz_mcq', 5), candidate('true_false', 2), candidate('coin_count', 3)];
    expect(orderCandidates(candidates, 3, null).map((c) => c.type)).toEqual([
      'coin_count',
      'true_false',
      'quiz_mcq',
    ]);
    // undefined behaves exactly like null — the caller should never have to
    // pick which "no preference" spelling to use.
    expect(orderCandidates(candidates, 3, undefined).map((c) => c.type)).toEqual([
      'coin_count',
      'true_false',
      'quiz_mcq',
    ]);
  });

  it('tries a preferred-type match FIRST, even at a worse difficulty distance', () => {
    // The whole point: a visual segment two difficulty steps off should still
    // win over an on-difficulty segment of some other type — this is a
    // preference over TYPE, difficulty is only the tiebreaker within it.
    const candidates = [candidate('quiz_mcq', 3), candidate('number_line', 5)];
    expect(orderCandidates(candidates, 3, ['number_line', 'interest_peek'])[0]?.type).toBe('number_line');
  });

  it('falls through to the ordinary difficulty sort when nothing matches the preference', () => {
    // Most skills have no visual segment yet — a preference must never turn
    // into an outage.
    const candidates = [candidate('quiz_mcq', 5), candidate('true_false', 3)];
    expect(orderCandidates(candidates, 3, ['number_line'])[0]?.type).toBe('true_false');
  });

  it('sorts by difficulty within the preferred group when more than one matches', () => {
    const candidates = [candidate('number_line', 5), candidate('interest_peek', 3), candidate('quiz_mcq', 3)];
    const ordered = orderCandidates(candidates, 3, ['number_line', 'interest_peek']);
    expect(ordered.map((c) => c.type)).toEqual(['interest_peek', 'number_line', 'quiz_mcq']);
  });

  it('is a no-op preference on an empty list', () => {
    expect(orderCandidates([], 3, ['number_line'])).toEqual([]);
  });
});

describe('composeExactTray', () => {
  it('composes exact totals, including the non-greedy case', () => {
    expect(composeExactTray([1, 2, 5], 8)!.reduce((a, b) => a + b, 0)).toBe(8);
    // Greedy fails here (4+... cannot finish); the DP must not.
    const tricky = composeExactTray([3, 4], 6);
    expect(tricky).not.toBeNull();
    expect(tricky!.reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('handles decimal money in cents', () => {
    const picked = composeExactTray([0.5, 1, 2], 3.5);
    expect(picked).not.toBeNull();
    expect(Math.round(picked!.reduce((a, b) => a + b, 0) * 100)).toBe(350);
  });

  it('refuses the unreachable and the hostile', () => {
    expect(composeExactTray([4], 6)).toBeNull(); // unreachable
    expect(composeExactTray([5], 0)).toBeNull();
    expect(composeExactTray([], 10)).toBeNull();
    expect(composeExactTray([0.01], 900_000)).toBeNull(); // bounded, no CPU burn
  });
});

describe('tray verification through the real graders', () => {
  it('coin_count: the composed tray scores 100 with the real grader', () => {
    const segment = traySegment('coin_count', { denominations: [1, 2, 5, 10], target: 17 });
    const submission = submissionFromKey(segment);
    expect(submission).toBeDefined();
    expect(GRADERS.coin_count!(segment, submission).score).toBe(100);

    const result = verifyGeneratedSegment(segment, 2);
    expect(result.ok).toBe(true);
    expect(result.keyVerified).toBe(true);
  });

  it('make_change: change = paid_with − price, composed and verified', () => {
    const segment = traySegment('make_change', { denominations: [1, 2, 5], price: 7, paid_with: 10 });
    const submission = submissionFromKey(segment) as { picked: number[] };
    expect(submission.picked.reduce((a, b) => a + b, 0)).toBe(3);
    expect(GRADERS.make_change!(segment, submission).score).toBe(100);
    expect(verifyGeneratedSegment(segment, 2).keyVerified).toBe(true);
  });

  it('an unwinnable tray (target unreachable) is refused, never served', () => {
    const segment = traySegment('coin_count', { denominations: [4], target: 6 });
    const result = verifyGeneratedSegment(segment, 2);
    expect(result.keyVerified).toBe(false);
    expect(result.ok).toBe(false);
  });
});

/*
 * fill_blank's key re-execution is SELF-referential: submissionFromKey builds
 * the "learner" submission directly out of answer.gaps, so re-running it
 * against the same key always scores 100 no matter what that key contains —
 * it proves the key agrees with itself, never that it agrees with what the
 * learner is actually shown. These tests pin the CONTENT check that catches
 * what re-execution structurally cannot: a gap with no matching {{N}} marker
 * in the payload's own text, and a bank_id that names a token absent from the
 * payload's own bank. Before this check existed, verifyGeneratedSegment
 * returned `ok: true, keyVerified: true` for both.
 */
function fillBlankSegment(payload: Record<string, unknown>, gaps: Record<string, unknown>[]): SegmentBase {
  return {
    id: 'seg-fill-1',
    type: 'fill_blank',
    prompt_md: 'Fill in the blank.',
    difficulty: 2,
    xp: 10,
    explanation_md: 'because math.',
    payload,
    answer: { gaps },
  } as unknown as SegmentBase;
}

describe('fill_blank verification — tying the key back to its own payload', () => {
  it('refuses a gap number with no matching {{N}} marker in text_md', () => {
    const segment = fillBlankSegment({ text_md: 'The sky is blue and grass is green.', mode: 'typed' }, [
      { gap: 1, accept: ['green'] },
    ]);
    const result = verifyGeneratedSegment(segment, 2);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('no matching {{1}} marker'))).toBe(true);
  });

  it('refuses a bank-mode bank_id that names a token absent from the payload\'s own bank', () => {
    const segment = fillBlankSegment(
      {
        text_md: 'The sky is {{1}}.',
        mode: 'bank',
        bank: [{ id: 'red', text_md: 'red' }, { id: 'yellow', text_md: 'yellow' }],
      },
      [{ gap: 1, bank_id: 'blue' }],
    );
    const result = verifyGeneratedSegment(segment, 2);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('not offered in the payload'))).toBe(true);
  });

  it('passes a genuinely well-formed typed fill_blank', () => {
    const segment = fillBlankSegment({ text_md: 'The sky is {{1}} and grass is {{2}}.', mode: 'typed' }, [
      { gap: 1, accept: ['blue'] },
      { gap: 2, accept: ['green'] },
    ]);
    const result = verifyGeneratedSegment(segment, 2);
    expect(result.ok).toBe(true);
    expect(result.keyVerified).toBe(true);
  });

  it('passes a genuinely well-formed bank fill_blank', () => {
    const segment = fillBlankSegment(
      { text_md: 'The sky is {{1}}.', mode: 'bank', bank: [{ id: 'blue', text_md: 'blue' }, { id: 'red', text_md: 'red' }] },
      [{ gap: 1, bank_id: 'blue' }],
    );
    const result = verifyGeneratedSegment(segment, 2);
    expect(result.ok).toBe(true);
    expect(result.keyVerified).toBe(true);
  });
});

/*
 * Found by an adversarial review, 2026-08-30 (HIGH): FORBIDDEN_BY_TIER's
 * tier-1 decimal check was period-only (/\d+\.\d{2,}/), so pt-BR (and es-MX)
 * prose writing a decimal with a COMMA — "3,50 reais", not "3.50 reais" —
 * sailed through unblocked, on two of the platform's three locked locales.
 * Mirrors the identical fix in oracle/src/tutor/prompt.ts's TIER_FORBIDDEN.
 */
describe('tier-1 vocabulary — the comma-decimal fix', () => {
  it('catches a comma-decimal number in a generated tier-1 activity', () => {
    const segment = {
      id: 'seg-decimal-1',
      type: 'quiz_mcq',
      prompt_md: 'Custa 3,1416 reais o brinquedo. Quanto voce paga?',
      difficulty: 1,
      xp: 10,
      payload: { options: [{ id: 'a', text_md: '3 reais', rationale_md: 'arredondado' }] },
      answer: {},
    } as unknown as SegmentBase;
    const result = verifyGeneratedSegment(segment, 1);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('tier 1 vocabulary violation'))).toBe(true);
  });
});
