import { describe, expect, it } from 'vitest'
import { COMBO_FLOOR, comboBeat } from './combo'

describe('comboBeat', () => {
  it('says nothing about a single right answer', () => {
    // One correct answer is an answer. Calling it a run devalues the word.
    expect(comboBeat(1, true)).toEqual({ show: false })
  })

  it('names the run from the floor up', () => {
    expect(comboBeat(COMBO_FLOOR, true).show).toBe(true)
    expect(comboBeat(COMBO_FLOOR + 1, true).show).toBe(true)
  })

  it('NEVER carries a combo on a wrong answer', () => {
    /*
     * The session's streak is not recomputed at the moment feedback renders, so
     * a wrong answer arrives while `streak` still holds the run it just ended.
     * Congratulating there would put "5 in a row!" in the same banner as "not
     * quite" — the engine not paying attention, on the surface where P3 says it
     * must never mock.
     */
    for (const streak of [0, 1, 2, 3, 7, 12]) {
      expect(comboBeat(streak, false), `streak ${streak}`).toEqual({ show: false })
    }
  })

  it('B.20 / OD-7 (S05.3e): a run of right answers never schedules a celebration effect', () => {
    // The old "burst every third answer" VFX was a celebration on correct
    // answers, which the closed milestone list forbids. The beat carries words only.
    for (let streak = 0; streak <= 30; streak += 1) {
      expect(Object.keys(comboBeat(streak, true))).toEqual(['show'])
    }
  })
})
