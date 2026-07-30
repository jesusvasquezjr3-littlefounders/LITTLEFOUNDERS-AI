import { describe, expect, it } from 'vitest'
import {
  accuracyScore,
  applyPenalty,
  clampScore,
  comboMultiplier,
  efficiencyScore,
  survivalScore,
  targetScore,
  tierForScore,
  weightedScore,
} from './scoring'

describe('clampScore', () => {
  it('rounds to an integer inside 0..100', () => {
    expect(clampScore(0)).toBe(0)
    expect(clampScore(1)).toBe(1)
    expect(clampScore(49.4)).toBe(49)
    expect(clampScore(49.5)).toBe(50)
    expect(clampScore(99.6)).toBe(100)
    expect(clampScore(100)).toBe(100)
  })

  it('clamps out-of-range values', () => {
    expect(clampScore(-0.4)).toBe(0)
    expect(clampScore(-1)).toBe(0)
    expect(clampScore(-1000)).toBe(0)
    expect(clampScore(101)).toBe(100)
    expect(clampScore(1e9)).toBe(100)
  })

  it('refuses non-finite scores instead of paying 100 for them', () => {
    expect(clampScore(Number.NaN)).toBe(0)
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampScore(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('comboMultiplier', () => {
  it('reproduces the v1 curve when configured with the v1 constants', () => {
    for (let combo = 0; combo <= 24; combo++) {
      expect(comboMultiplier(combo, { step: 5, max: 5 })).toBe(
        Math.min(5, 1 + Math.floor(combo / 5)),
      )
    }
  })

  it('steps exactly at the configured stride', () => {
    expect(comboMultiplier(0, { step: 3, max: 4 })).toBe(1)
    expect(comboMultiplier(2, { step: 3, max: 4 })).toBe(1)
    expect(comboMultiplier(3, { step: 3, max: 4 })).toBe(2)
    expect(comboMultiplier(5, { step: 3, max: 4 })).toBe(2)
    expect(comboMultiplier(6, { step: 3, max: 4 })).toBe(3)
    expect(comboMultiplier(9, { step: 3, max: 4 })).toBe(4)
  })

  it('never exceeds the cap however long the streak', () => {
    expect(comboMultiplier(1000, { step: 3, max: 4 })).toBe(4)
    expect(comboMultiplier(Number.MAX_SAFE_INTEGER, { step: 1, max: 8 })).toBe(8)
  })

  it('treats a step of 1 as a multiplier per success', () => {
    expect(comboMultiplier(0, { step: 1, max: 10 })).toBe(1)
    expect(comboMultiplier(1, { step: 1, max: 10 })).toBe(2)
    expect(comboMultiplier(4, { step: 1, max: 10 })).toBe(5)
  })

  it('floors fractional combos and strides', () => {
    expect(comboMultiplier(4.9, { step: 5, max: 5 })).toBe(1)
    expect(comboMultiplier(5.9, { step: 5, max: 5 })).toBe(2)
    expect(comboMultiplier(6, { step: 2.9, max: 5 })).toBe(4)
  })

  it('degrades to a flat 1x on a malformed config instead of dividing by zero', () => {
    expect(comboMultiplier(20, { step: 0, max: 5 })).toBe(1)
    expect(comboMultiplier(20, { step: -5, max: 5 })).toBe(1)
    expect(comboMultiplier(20, { step: 0.5, max: 5 })).toBe(1)
    expect(comboMultiplier(20, { step: Number.NaN, max: 5 })).toBe(1)
    expect(comboMultiplier(Number.POSITIVE_INFINITY, { step: 5, max: 5 })).toBe(1)
    expect(comboMultiplier(20, { step: 5, max: Number.NaN })).toBe(1)
  })

  it('never returns less than 1', () => {
    expect(comboMultiplier(0, { step: 5, max: 0 })).toBe(1)
    expect(comboMultiplier(50, { step: 5, max: -3 })).toBe(1)
    expect(comboMultiplier(-10, { step: 5, max: 5 })).toBe(1)
  })
})

describe('accuracyScore', () => {
  it('maps the boundaries', () => {
    expect(accuracyScore(0, 10)).toBe(0)
    expect(accuracyScore(1, 10)).toBe(10)
    expect(accuracyScore(5, 10)).toBe(50)
    expect(accuracyScore(10, 10)).toBe(100)
    expect(accuracyScore(1, 1)).toBe(100)
  })

  it('returns 0 when nothing was ever presented', () => {
    expect(accuracyScore(0, 0)).toBe(0)
    expect(accuracyScore(5, 0)).toBe(0)
    expect(accuracyScore(5, -3)).toBe(0)
  })

  it('clamps impossible hit counts', () => {
    expect(accuracyScore(-4, 10)).toBe(0)
    expect(accuracyScore(14, 10)).toBe(100)
  })

  it('rounds to the nearest point', () => {
    expect(accuracyScore(1, 3)).toBe(33)
    expect(accuracyScore(2, 3)).toBe(67)
  })

  it('never returns NaN', () => {
    expect(accuracyScore(Number.NaN, 10)).toBe(0)
    expect(accuracyScore(3, Number.NaN)).toBe(0)
    expect(accuracyScore(Number.POSITIVE_INFINITY, 10)).toBe(0)
  })
})

describe('targetScore', () => {
  it('maps the boundaries', () => {
    expect(targetScore(0, 50)).toBe(0)
    expect(targetScore(25, 50)).toBe(50)
    expect(targetScore(49, 50)).toBe(98)
    expect(targetScore(50, 50)).toBe(100)
  })

  it('clamps overshoot and negative progress', () => {
    expect(targetScore(500, 50)).toBe(100)
    expect(targetScore(-20, 50)).toBe(0)
  })

  it('refuses a non-positive target rather than granting a free 100', () => {
    expect(targetScore(0, 0)).toBe(0)
    expect(targetScore(10, 0)).toBe(0)
    expect(targetScore(10, -5)).toBe(0)
  })

  it('never returns NaN', () => {
    expect(targetScore(Number.NaN, 10)).toBe(0)
    expect(targetScore(10, Number.NaN)).toBe(0)
    expect(targetScore(Number.POSITIVE_INFINITY, 10)).toBe(0)
    expect(targetScore(10, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('survivalScore', () => {
  it('maps the boundaries', () => {
    expect(survivalScore(0, 200)).toBe(0)
    expect(survivalScore(1, 200)).toBe(1)
    expect(survivalScore(100, 200)).toBe(50)
    expect(survivalScore(200, 200)).toBe(100)
    expect(survivalScore(1000, 200)).toBe(100)
  })

  it('floors fractional ticks', () => {
    expect(survivalScore(99.9, 200)).toBe(50)
    expect(survivalScore(1.9, 100)).toBe(1)
    expect(survivalScore(10, 0.9)).toBe(0)
  })

  it('handles the degenerate inputs', () => {
    expect(survivalScore(-50, 200)).toBe(0)
    expect(survivalScore(50, 0)).toBe(0)
    expect(survivalScore(50, -200)).toBe(0)
    expect(survivalScore(Number.NaN, 200)).toBe(0)
    expect(survivalScore(50, Number.NaN)).toBe(0)
  })
})

describe('efficiencyScore', () => {
  it('pays most for spending least', () => {
    expect(efficiencyScore(0, 100)).toBe(100)
    expect(efficiencyScore(25, 100)).toBe(75)
    expect(efficiencyScore(50, 100)).toBe(50)
    expect(efficiencyScore(99, 100)).toBe(1)
    expect(efficiencyScore(100, 100)).toBe(0)
  })

  it('bottoms out at 0 when the budget is overspent', () => {
    expect(efficiencyScore(150, 100)).toBe(0)
  })

  it('treats negative usage as zero usage', () => {
    expect(efficiencyScore(-10, 100)).toBe(100)
  })

  it('refuses a non-positive budget', () => {
    expect(efficiencyScore(0, 0)).toBe(0)
    expect(efficiencyScore(5, 0)).toBe(0)
    expect(efficiencyScore(5, -10)).toBe(0)
  })

  it('never returns NaN', () => {
    expect(efficiencyScore(Number.NaN, 100)).toBe(0)
    expect(efficiencyScore(10, Number.NaN)).toBe(0)
    expect(efficiencyScore(Number.POSITIVE_INFINITY, 100)).toBe(0)
  })
})

describe('weightedScore', () => {
  it('blends signals by weight', () => {
    expect(
      weightedScore([
        { value: 100, weight: 1 },
        { value: 0, weight: 1 },
      ]),
    ).toBe(50)
    expect(
      weightedScore([
        { value: 100, weight: 3 },
        { value: 0, weight: 1 },
      ]),
    ).toBe(75)
    expect(
      weightedScore([
        { value: 80, weight: 2 },
        { value: 50, weight: 1 },
        { value: 20, weight: 1 },
      ]),
    ).toBe(58)
  })

  it('is weight-scale invariant', () => {
    const a = weightedScore([
      { value: 90, weight: 1 },
      { value: 30, weight: 3 },
    ])
    const b = weightedScore([
      { value: 90, weight: 10 },
      { value: 30, weight: 30 },
    ])
    expect(a).toBe(b)
    expect(a).toBe(45)
  })

  it('returns the single part when there is only one', () => {
    expect(weightedScore([{ value: 73, weight: 5 }])).toBe(73)
  })

  it('handles a total weight of zero explicitly', () => {
    expect(weightedScore([])).toBe(0)
    expect(weightedScore([{ value: 100, weight: 0 }])).toBe(0)
    expect(
      weightedScore([
        { value: 100, weight: 0 },
        { value: 50, weight: 0 },
      ]),
    ).toBe(0)
  })

  it('ignores negative and non-finite weights', () => {
    expect(
      weightedScore([
        { value: 100, weight: 1 },
        { value: 0, weight: -5 },
      ]),
    ).toBe(100)
    expect(
      weightedScore([
        { value: 100, weight: 1 },
        { value: 0, weight: Number.NaN },
      ]),
    ).toBe(100)
    expect(weightedScore([{ value: 40, weight: Number.POSITIVE_INFINITY }])).toBe(0)
  })

  it('clamps each part before weighting so one runaway signal cannot escape 0..100', () => {
    expect(
      weightedScore([
        { value: 1000, weight: 1 },
        { value: 0, weight: 1 },
      ]),
    ).toBe(50)
    expect(
      weightedScore([
        { value: -1000, weight: 1 },
        { value: 100, weight: 1 },
      ]),
    ).toBe(50)
    expect(
      weightedScore([
        { value: Number.NaN, weight: 1 },
        { value: 100, weight: 1 },
      ]),
    ).toBe(50)
  })
})

describe('applyPenalty', () => {
  it('subtracts flat points per penalty', () => {
    expect(applyPenalty(100, 0, 5)).toBe(100)
    expect(applyPenalty(100, 1, 5)).toBe(95)
    expect(applyPenalty(100, 4, 5)).toBe(80)
    expect(applyPenalty(60, 2, 10)).toBe(40)
  })

  it('floors at 0 instead of going negative', () => {
    expect(applyPenalty(10, 5, 5)).toBe(0)
    expect(applyPenalty(0, 3, 5)).toBe(0)
    expect(applyPenalty(100, 1000, 5)).toBe(0)
  })

  it('clamps the incoming score first', () => {
    expect(applyPenalty(150, 1, 5)).toBe(95)
    expect(applyPenalty(-20, 0, 5)).toBe(0)
  })

  it('can only ever lower the score', () => {
    expect(applyPenalty(80, -3, 5)).toBe(80)
    expect(applyPenalty(80, 2, -5)).toBe(80)
    expect(applyPenalty(80, 0.9, 10)).toBe(80)
    expect(applyPenalty(80, 1.9, 10)).toBe(70)
  })

  it('never returns NaN', () => {
    expect(applyPenalty(80, Number.NaN, 5)).toBe(80)
    expect(applyPenalty(80, 2, Number.NaN)).toBe(80)
    expect(applyPenalty(Number.NaN, 2, 5)).toBe(0)
    expect(applyPenalty(80, Number.POSITIVE_INFINITY, 5)).toBe(80)
  })
})

describe('tierForScore', () => {
  it('matches the Lesson Engine thresholds at every boundary', () => {
    expect(tierForScore(100, 70)).toBe('perfect')
    expect(tierForScore(99, 70)).toBe('great')
    expect(tierForScore(70, 70)).toBe('great')
    expect(tierForScore(69, 70)).toBe('almost')
    expect(tierForScore(40, 70)).toBe('almost')
    expect(tierForScore(39, 70)).toBe('tryAgain')
    expect(tierForScore(0, 70)).toBe('tryAgain')
  })

  it('is exact at the pass score itself', () => {
    expect(tierForScore(60, 60)).toBe('great')
    expect(tierForScore(59, 60)).toBe('almost')
    expect(tierForScore(50, 50)).toBe('great')
    expect(tierForScore(49, 50)).toBe('almost')
  })

  it('lets a low pass score win over the almost band, exactly like tierFor', () => {
    expect(tierForScore(35, 30)).toBe('great')
    expect(tierForScore(30, 30)).toBe('great')
    // Below a sub-40 pass score there is no 'almost' band left: the 40 floor is
    // never reached, so the next band down is 'tryAgain' — same as tierFor.
    expect(tierForScore(29, 30)).toBe('tryAgain')
    expect(tierForScore(0, 0)).toBe('great')
  })

  it('clamps both arguments', () => {
    expect(tierForScore(150, 70)).toBe('perfect')
    expect(tierForScore(-50, 70)).toBe('tryAgain')
    expect(tierForScore(100, 150)).toBe('perfect')
    expect(tierForScore(99, 150)).toBe('almost')
    expect(tierForScore(Number.NaN, 70)).toBe('tryAgain')
    expect(tierForScore(80, Number.NaN)).toBe('great')
  })
})

describe('finiteness invariant', () => {
  const PROBES = [0, 1, -1, 0.5, 39, 40, 70, 99, 100, 101, -100, 1e6, -1e6, 1e-6]

  it('every helper returns a finite number for every finite probe pair', () => {
    for (const a of PROBES) {
      for (const b of PROBES) {
        expect(Number.isFinite(clampScore(a))).toBe(true)
        expect(Number.isFinite(comboMultiplier(a, { step: b, max: 5 }))).toBe(true)
        expect(Number.isFinite(comboMultiplier(a, { step: 5, max: b }))).toBe(true)
        expect(Number.isFinite(accuracyScore(a, b))).toBe(true)
        expect(Number.isFinite(targetScore(a, b))).toBe(true)
        expect(Number.isFinite(survivalScore(a, b))).toBe(true)
        expect(Number.isFinite(efficiencyScore(a, b))).toBe(true)
        expect(Number.isFinite(applyPenalty(a, b, 5))).toBe(true)
        expect(Number.isFinite(weightedScore([{ value: a, weight: b }]))).toBe(true)
      }
    }
  })

  it('every 0..100 helper stays inside 0..100 and integral', () => {
    for (const a of PROBES) {
      for (const b of PROBES) {
        for (const score of [
          accuracyScore(a, b),
          targetScore(a, b),
          survivalScore(a, b),
          efficiencyScore(a, b),
          applyPenalty(a, b, 7),
          weightedScore([
            { value: a, weight: 1 },
            { value: b, weight: 2 },
          ]),
        ]) {
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
          expect(Number.isInteger(score)).toBe(true)
        }
      }
    }
  })
})
