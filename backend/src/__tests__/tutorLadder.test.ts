import { describe, expect, it } from 'vitest';
import { composeExactTray, submissionFromKey, verifyGeneratedSegment } from '../services/tutorLadder.js';
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
