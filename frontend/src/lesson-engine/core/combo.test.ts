import { describe, expect, it } from 'vitest'
import { COMBO_FLOOR, COMBO_MILESTONE, comboBeat } from './combo'

describe('comboBeat', () => {
  it('says nothing about a single right answer', () => {
    // One correct answer is an answer. Calling it a run devalues the word.
    expect(comboBeat(1, true)).toEqual({ show: false, burst: false })
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
      expect(comboBeat(streak, false), `streak ${streak}`).toEqual({ show: false, burst: false })
    }
  })

  it('bursts on every milestone and only on milestones', () => {
    const bursts = []
    for (let streak = 1; streak <= 12; streak += 1) {
      if (comboBeat(streak, true).burst) bursts.push(streak)
    }
    expect(bursts).toEqual([3, 6, 9, 12])
  })

  it('never bursts below the floor, even on a multiple of the milestone', () => {
    // Guards the ordering: `0 % 3 === 0` is true, and a burst at zero would be
    // the engine celebrating nothing.
    expect(comboBeat(0, true)).toEqual({ show: false, burst: false })
  })

  it('keeps the milestone rarer than the callout', () => {
    // If these ever met, every named run would also burst and the extra beat
    // would stop meaning anything.
    expect(COMBO_MILESTONE).toBeGreaterThan(COMBO_FLOOR - 1)
    expect(COMBO_MILESTONE).toBeGreaterThan(1)
  })
})
