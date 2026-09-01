import { describe, expect, it } from 'vitest';
import { lessonStepDots, MAX_LESSON_STEP_DOTS } from '../lessonStepDots';

describe('lessonStepDots', () => {
  it('marks every dot before the current step done, the current step current, the rest upcoming', () => {
    expect(lessonStepDots(2, 4)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
  });

  it('marks the first dot current on step 1', () => {
    expect(lessonStepDots(1, 3)).toEqual(['current', 'upcoming', 'upcoming']);
  });

  it('marks every earlier dot done on the final step, with none upcoming', () => {
    expect(lessonStepDots(4, 4)).toEqual(['done', 'done', 'done', 'current']);
  });

  it('draws exactly one dot for a single-step plan', () => {
    expect(lessonStepDots(1, 1)).toEqual(['current']);
  });

  it('returns nothing for a plan with no steps, rather than throwing', () => {
    expect(lessonStepDots(1, 0)).toEqual([]);
  });

  it('returns nothing for a negative step count, rather than throwing', () => {
    // Array.from({ length: negative }) throws a RangeError — this is the
    // exact boundary AGENTS.md §1.14 says must degrade, not crash, on a
    // value that crossed a network boundary this file does not control.
    expect(() => lessonStepDots(1, -3)).not.toThrow();
    expect(lessonStepDots(1, -3)).toEqual([]);
  });

  it('clamps a step below 1 to the first dot', () => {
    expect(lessonStepDots(0, 3)).toEqual(['current', 'upcoming', 'upcoming']);
  });

  it('clamps a step past the end to the last dot', () => {
    expect(lessonStepDots(9, 3)).toEqual(['done', 'done', 'current']);
  });

  it('caps the dot count at MAX_LESSON_STEP_DOTS for an implausibly large plan', () => {
    const dots = lessonStepDots(2, 999);
    expect(dots).toHaveLength(MAX_LESSON_STEP_DOTS);
    expect(dots[0]).toBe('done');
    expect(dots[1]).toBe('current');
  });

  it('truncates a non-integer step/of pair instead of producing a fractional index', () => {
    expect(lessonStepDots(2.9, 4.2)).toEqual(lessonStepDots(2, 4));
  });
});
