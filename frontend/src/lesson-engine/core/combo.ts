/*
 * WHEN A RUN OF RIGHT ANSWERS IS WORTH SAYING SOMETHING ABOUT.
 *
 * The session has counted consecutive first-try correct answers since v1, and
 * the header has shown the number since v1. Nothing ever told the learner it
 * was a RUN — the number simply changed, which is how a variable behaves and
 * not how a reward behaves.
 *
 * The rule lives here, as a pure function, rather than as two conditions inside
 * JSX, because "when does the product celebrate" is a product decision that
 * deserves to be stated once and tested rather than read off a template in two
 * places that have to agree.
 */

/** A run is worth naming from here up. Two is a run; one is an answer. */
export const COMBO_FLOOR = 2

/*
 * B.20 / OD-7 (S05.3e): a run of right answers is INFORMATION, never a
 * celebration. The "every third answer" VFX ring this module used to schedule
 * (`burst`) was a celebration effect on correct answers, which the closed
 * milestone list forbids (Frontend Bible 02 D7, rule 17). The run is still
 * named in words; nothing bursts, floats or overshoots.
 */
export interface ComboBeat {
  /** Name the run — "3 in a row!". */
  show: boolean
}

/**
 * @param streak  consecutive first-try correct answers, from the session.
 * @param correct whether the answer being shown feedback for was right.
 */
export function comboBeat(streak: number, correct: boolean): ComboBeat {
  /*
   * A WRONG ANSWER NEVER CARRIES A COMBO, even though the session's streak has
   * not been recomputed at the moment feedback renders. Congratulating a run
   * in the same banner that says the answer was wrong reads as the engine not
   * paying attention — and this engine's first rule about wrong answers is that
   * it never mocks (LESSON_ENGINE.md P3).
   */
  if (!correct) return { show: false }
  return { show: streak >= COMBO_FLOOR }
}
