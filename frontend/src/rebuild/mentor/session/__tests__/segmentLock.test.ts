import { describe, expect, it } from 'vitest';
import { isSegmentLocked, MAX_ATTEMPTS } from '../segmentLock';

/*
 * Four unrelated reasons an activity stops accepting input, each a rule about
 * someone's answer and each failing differently. They were one boolean inside
 * a component with no test file.
 */

const open = { checking: false, demoRunning: false, answeredCorrectly: false, attempt: 1 };

describe('when the learner may work', () => {
  it('leaves a fresh activity open', () => {
    expect(isSegmentLocked(open)).toBe(false);
  });

  it('keeps it open on the last allowed attempt', () => {
    // Off-by-one here takes an attempt away from every child, silently.
    expect(isSegmentLocked({ ...open, attempt: MAX_ATTEMPTS })).toBe(false);
  });
});

describe('when it must be taken away', () => {
  it('locks while the answer is being graded', () => {
    // Otherwise the verdict that comes back is for an answer no longer on screen.
    expect(isSegmentLocked({ ...open, checking: true })).toBe(true);
  });

  it('locks while the tutor is demonstrating', () => {
    // The demo writes into the same draft a tap changes. Unlocked, a child is
    // fighting the tutor's hands for the same coins.
    expect(isSegmentLocked({ ...open, demoRunning: true })).toBe(true);
  });

  it('locks an answer that was already right', () => {
    // Graded and paid. Editing it afterwards edits a result the child was
    // already congratulated for.
    expect(isSegmentLocked({ ...open, answeredCorrectly: true })).toBe(true);
  });

  it('locks once the attempts are spent', () => {
    expect(isSegmentLocked({ ...open, attempt: MAX_ATTEMPTS + 1 })).toBe(true);
  });
});
