// Determinism regression tests for core/mathd.ts — GAME_ENGINE.md §5 / brief §4.
//
// Two different kinds of assertion live here, and the distinction matters:
//
// 1. CORRECTNESS — `dsin`/`dcos`/`datan2` are compared against `Math.sin`/`Math.cos`/
//    `Math.atan2` within ACCURACY. Calling the banned functions is legitimate HERE
//    because a test is never replayed on the server; it only has to establish that the
//    polynomials really do approximate the true function. Simulator code must not.
// 2. DETERMINISM — the identities that must hold EXACTLY (`toBe`), independent of any
//    engine's transcendental implementation. These are the properties the reward path
//    actually leans on.

import { ACCURACY, datan2, dcos, dhypot, dpow, dsin } from '@/game-engine/core/mathd'

const referenceSin = (degrees: number): number => Math.sin((degrees * Math.PI) / 180)
const referenceCos = (degrees: number): number => Math.cos((degrees * Math.PI) / 180)
const referenceAtan2Degrees = (y: number, x: number): number => (Math.atan2(y, x) * 180) / Math.PI

/** `toBe` uses Object.is, which separates -0 from 0. Sign of zero is not part of any
 *  identity being asserted here, so collapse it before comparing. */
const zeroSafe = (value: number): number => (value === 0 ? 0 : value)

describe('dsin / dcos — correctness against the reference', () => {
  it('tracks Math.sin and Math.cos across a dense sweep of two full turns', () => {
    let worstSin = 0
    let worstCos = 0
    // 0.0005 deg steps over [-720, 720]: ~2.9M samples through every quadrant, both
    // signs, and both sides of each 45 deg / 90 deg fold boundary.
    for (let degrees = -720; degrees <= 720; degrees += 0.0005) {
      const errorSin = Math.abs(dsin(degrees) - referenceSin(degrees))
      const errorCos = Math.abs(dcos(degrees) - referenceCos(degrees))
      if (errorSin > worstSin) worstSin = errorSin
      if (errorCos > worstCos) worstCos = errorCos
    }
    expect(worstSin).toBeLessThan(ACCURACY.sin)
    expect(worstCos).toBeLessThan(ACCURACY.cos)
  })

  it('stays within ACCURACY on integer degrees far outside one turn', () => {
    // The reference is evaluated at the REDUCED angle, which is the same true angle for
    // an integer degree input. Feeding Math.sin the raw value instead would measure
    // Math.sin's own argument rounding — `100000 * Math.PI / 180` is ~1745 rad, whose
    // ulp alone is 2.3e-13 — rather than anything about this module.
    for (const degrees of [-100000, -3607, -721, 721, 4321, 100000]) {
      const reduced = degrees - 360 * Math.floor(degrees / 360)
      expect(Math.abs(dsin(degrees) - referenceSin(reduced))).toBeLessThan(ACCURACY.sin)
      expect(Math.abs(dcos(degrees) - referenceCos(reduced))).toBeLessThan(ACCURACY.cos)
    }
  })

  it('satisfies the Pythagorean identity everywhere', () => {
    for (let degrees = -400; degrees <= 400; degrees += 0.25) {
      const s = dsin(degrees)
      const c = dcos(degrees)
      expect(Math.abs(s * s + c * c - 1)).toBeLessThan(1e-13)
    }
  })

  it('returns NaN only for non-finite input', () => {
    expect(Number.isNaN(dsin(Number.NaN))).toBe(true)
    expect(Number.isNaN(dcos(Number.POSITIVE_INFINITY))).toBe(true)
    for (let degrees = -1000; degrees <= 1000; degrees += 0.7) {
      expect(Number.isFinite(dsin(degrees))).toBe(true)
      expect(Number.isFinite(dcos(degrees))).toBe(true)
    }
  })
})

describe('dsin / dcos — exact determinism properties', () => {
  it('pins the cardinal angles exactly', () => {
    expect(dsin(0)).toBe(0)
    expect(dcos(0)).toBe(1)
    expect(dsin(90)).toBe(1)
    expect(dcos(90)).toBe(0)
    expect(dsin(180)).toBe(0)
    expect(dcos(180)).toBe(-1)
    expect(dsin(270)).toBe(-1)
    expect(dcos(270)).toBe(0)
    expect(dsin(360)).toBe(0)
    expect(dcos(360)).toBe(1)
    expect(dsin(-90)).toBe(-1)
    expect(dcos(-180)).toBe(-1)
  })

  it('is exactly periodic on integer degrees', () => {
    for (let degrees = -180; degrees <= 180; degrees += 1) {
      expect(zeroSafe(dsin(degrees + 360))).toBe(zeroSafe(dsin(degrees)))
      expect(zeroSafe(dsin(degrees - 720))).toBe(zeroSafe(dsin(degrees)))
      expect(zeroSafe(dcos(degrees + 360))).toBe(zeroSafe(dcos(degrees)))
      expect(zeroSafe(dcos(degrees - 720))).toBe(zeroSafe(dcos(degrees)))
    }
  })

  it('is exactly odd (sin) and exactly even (cos) on integer degrees', () => {
    for (let degrees = 0; degrees <= 360; degrees += 1) {
      expect(zeroSafe(dsin(-degrees))).toBe(zeroSafe(-dsin(degrees)))
      expect(zeroSafe(dcos(-degrees))).toBe(zeroSafe(dcos(degrees)))
    }
  })

  it('exactly satisfies the supplement and complement identities on integer degrees', () => {
    for (let degrees = 0; degrees <= 90; degrees += 1) {
      expect(zeroSafe(dsin(180 - degrees))).toBe(zeroSafe(dsin(degrees)))
      expect(zeroSafe(dcos(180 - degrees))).toBe(zeroSafe(-dcos(degrees)))
      expect(zeroSafe(dsin(90 - degrees))).toBe(zeroSafe(dcos(degrees)))
      expect(zeroSafe(dcos(90 - degrees))).toBe(zeroSafe(dsin(degrees)))
    }
  })

  it('returns identical results for identical inputs (the replay property)', () => {
    for (const degrees of [0.1, 12.5, 44.999, 45, 45.001, 89.9, 137.25, -313.75]) {
      expect(dsin(degrees)).toBe(dsin(degrees))
      expect(dcos(degrees)).toBe(dcos(degrees))
    }
  })
})

describe('datan2', () => {
  it('tracks Math.atan2 within ACCURACY across the plane', () => {
    let worst = 0
    for (let i = 0; i < 400; i += 1) {
      for (let j = 0; j < 400; j += 1) {
        const x = (i - 200) / 7
        const y = (j - 200) / 11
        if (x === 0 && y === 0) continue
        const error = Math.abs(datan2(y, x) - referenceAtan2Degrees(y, x))
        if (error > worst) worst = error
      }
    }
    expect(worst).toBeLessThan(ACCURACY.atan2Degrees)
  })

  it('tracks Math.atan2 for extreme aspect ratios', () => {
    const cases: readonly (readonly [number, number])[] = [
      [1e-9, 1],
      [1, 1e-9],
      [-1e-9, -1],
      [1e9, 1],
      [1, -1e9],
      [-1e9, -1e-9],
    ]
    for (const [y, x] of cases) {
      expect(Math.abs(datan2(y, x) - referenceAtan2Degrees(y, x))).toBeLessThan(
        ACCURACY.atan2Degrees,
      )
    }
  })

  it('pins the axes and the diagonals exactly', () => {
    expect(datan2(0, 1)).toBe(0)
    expect(datan2(1, 0)).toBe(90)
    expect(datan2(0, -1)).toBe(180)
    expect(datan2(-1, 0)).toBe(-90)
    expect(datan2(1, 1)).toBe(45)
    expect(datan2(1, -1)).toBe(135)
    expect(datan2(-1, -1)).toBe(-135)
    expect(datan2(-1, 1)).toBe(-45)
    expect(datan2(3, 3)).toBe(45)
  })

  it('is scale invariant on exactly representable scalings', () => {
    for (const scale of [2, 4, 1024, 0.5, 0.03125]) {
      expect(datan2(3 * scale, 7 * scale)).toBe(datan2(3, 7))
      expect(datan2(-9 * scale, 2 * scale)).toBe(datan2(-9, 2))
    }
  })

  it('never returns NaN, including for the degenerate zero vector', () => {
    const degenerate = [
      datan2(0, 0),
      datan2(Number.NaN, 1),
      datan2(1, Number.NaN),
      datan2(Number.NaN, Number.NaN),
      datan2(Number.POSITIVE_INFINITY, 1),
      datan2(1, Number.NEGATIVE_INFINITY),
    ]
    for (const value of degenerate) {
      expect(Number.isNaN(value)).toBe(false)
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(datan2(0, 0)).toBe(0)
  })

  it('stays inside (-180, 180] and is always finite', () => {
    // The 40,000-point sweep is the point of this test, so the coverage stays. What
    // changed is that failures are collected and asserted ONCE: three expect() calls
    // per point is 120,000 matcher invocations, and their overhead — not datan2 —
    // pushed this past the 5s timeout.
    const offenders: string[] = []
    for (let i = 0; i < 200; i += 1) {
      for (let j = 0; j < 200; j += 1) {
        const angle = datan2(j - 100, i - 100)
        if (!Number.isFinite(angle) || angle <= -180 || angle > 180) {
          offenders.push(`datan2(${j - 100}, ${i - 100}) = ${angle}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('round-trips through dcos/dsin back to the original direction', () => {
    for (let i = 1; i <= 60; i += 1) {
      const x = (i - 30) / 3
      const y = (i * 2 - 31) / 5
      const angle = datan2(y, x)
      const length = dhypot(x, y)
      expect(Math.abs(dcos(angle) * length - x)).toBeLessThan(1e-12)
      expect(Math.abs(dsin(angle) * length - y)).toBeLessThan(1e-12)
    }
  })
})

describe('dpow', () => {
  it('computes integer powers exactly', () => {
    expect(dpow(2, 10)).toBe(1024)
    expect(dpow(3, 5)).toBe(243)
    expect(dpow(-2, 3)).toBe(-8)
    expect(dpow(-2, 4)).toBe(16)
    expect(dpow(10, 15)).toBe(1000000000000000)
    expect(dpow(0.5, 3)).toBe(0.125)
  })

  it('treats a zero exponent as 1 and a negative exponent as a reciprocal', () => {
    expect(dpow(7, 0)).toBe(1)
    expect(dpow(0, 0)).toBe(1)
    expect(dpow(-3, 0)).toBe(1)
    expect(dpow(2, -3)).toBe(0.125)
    expect(dpow(0, -1)).toBe(Number.POSITIVE_INFINITY)
    expect(dpow(0, 5)).toBe(0)
  })

  it('rejects a non-integer exponent', () => {
    expect(() => dpow(2, 0.5)).toThrow(RangeError)
    expect(() => dpow(2, -1.5)).toThrow(RangeError)
    expect(() => dpow(2, 1e-9)).toThrow(RangeError)
    expect(() => dpow(2, Number.NaN)).toThrow(RangeError)
    expect(() => dpow(2, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => dpow(2, Number.NEGATIVE_INFINITY)).toThrow(RangeError)
  })

  it('agrees with repeated multiplication, which is its definition', () => {
    for (let exponent = 0; exponent <= 24; exponent += 1) {
      let expected = 1
      for (let k = 0; k < exponent; k += 1) expected = expected * 2
      expect(dpow(2, exponent)).toBe(expected)
    }
  })

  it('is stable under repeated evaluation (the replay property)', () => {
    for (const exponent of [0, 1, 2, 3, 7, 12, 31, -4]) {
      expect(dpow(1.0001, exponent)).toBe(dpow(1.0001, exponent))
    }
  })
})

describe('dhypot', () => {
  it('computes exact Pythagorean triples', () => {
    expect(dhypot(3, 4)).toBe(5)
    expect(dhypot(-3, -4)).toBe(5)
    expect(dhypot(5, 12)).toBe(13)
    expect(dhypot(0, 0)).toBe(0)
    expect(dhypot(0, -7)).toBe(7)
  })

  it('is symmetric and sign independent', () => {
    for (let i = 1; i <= 40; i += 1) {
      const x = i / 3
      const y = i / 7
      expect(dhypot(x, y)).toBe(dhypot(y, x))
      expect(dhypot(-x, y)).toBe(dhypot(x, y))
      expect(dhypot(x, -y)).toBe(dhypot(x, y))
    }
  })

  it('agrees with the unit circle built from dsin/dcos', () => {
    for (let degrees = 0; degrees < 360; degrees += 3) {
      expect(Math.abs(dhypot(dcos(degrees), dsin(degrees)) - 1)).toBeLessThan(1e-13)
    }
  })
})
