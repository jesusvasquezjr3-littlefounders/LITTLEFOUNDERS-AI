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
 * Every third answer in the run gets the extra beat.
 *
 * Often enough that a good run is acknowledged more than once, rare enough that
 * the beat keeps meaning something. A burst on EVERY correct answer is
 * wallpaper: the learner stops seeing it by the fourth one, and it costs the
 * same to draw.
 */
export const COMBO_MILESTONE = 3

export interface ComboBeat {
  /** Name the run — "3 in a row!". */
  show: boolean
  /** Add the one-shot VFX ring on top of it. */
  burst: boolean
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
  if (!correct) return { show: false, burst: false }
  const show = streak >= COMBO_FLOOR
  return { show, burst: show && streak % COMBO_MILESTONE === 0 }
}
