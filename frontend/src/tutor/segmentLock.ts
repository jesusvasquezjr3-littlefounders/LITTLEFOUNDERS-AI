/*
 * WHEN THE LEARNER'S HANDS ARE OFF THE ACTIVITY.
 *
 * Four unrelated reasons an open activity stops accepting input, condensed
 * into one boolean inside a component with no test file. Each is a real rule
 * about someone's answer, and each fails differently:
 *
 *  - MID-SUBMIT. Changing a draft while it is being graded means the verdict
 *    that comes back is for an answer that no longer exists on screen.
 *  - THE TUTOR IS DEMONSTRATING. The demo writes into the same draft a tap
 *    changes, so an unlocked tray means a child fighting the tutor's hands for
 *    the same coins.
 *  - ALREADY RIGHT. That answer has been graded and paid; editing it afterwards
 *    edits a result the child was already congratulated for.
 *  - ATTEMPTS SPENT. Past the limit the activity is over and the tutor teaches
 *    instead.
 *
 * Pulled out of the panel so the rules can be checked without rendering one.
 */

/** How many tries an activity gives before the tutor takes over. */
export const MAX_ATTEMPTS = 2;

export function isSegmentLocked(input: {
  checking: boolean;
  demoRunning: boolean;
  answeredCorrectly: boolean;
  attempt: number;
}): boolean {
  return (
    input.checking ||
    input.demoRunning ||
    input.answeredCorrectly ||
    input.attempt > MAX_ATTEMPTS
  );
}
