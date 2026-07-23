import { describe, expect, it } from 'vitest'
import {
  allocationRanges,
  binary,
  calibration,
  decisionAccuracy,
  footrule,
  fuzzyEquals,
  jaccard,
  kendall,
  keywordCoverage,
  levenshtein,
  qualityScaleFactor,
  linearFalloff,
  meanQuality,
  normalizeText,
  positional,
  ratio,
  signalDetection,
  sumEquals,
  toleranceBands,
} from './scoring'

describe('scoring helpers (LESSON_ENGINE.md §6)', () => {
  it('binary / ratio', () => {
    expect(binary(true)).toBe(100)
    expect(binary(false)).toBe(0)
    expect(ratio(3, 5)).toBe(60)
    expect(ratio(1, 0)).toBe(0)
  })

  it('kendall: perfect, adjacent swap, reversal, invalid', () => {
    expect(kendall(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(100)
    expect(kendall(['b', 'a', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(83)
    expect(kendall(['d', 'c', 'b', 'a'], ['a', 'b', 'c', 'd'])).toBe(0)
    expect(kendall(['a', 'a', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(0)
    expect(kendall(['a'], ['a'])).toBe(0)
  })

  it('footrule is gentler than kendall on displacement', () => {
    const user = ['b', 'a', 'c', 'd']
    const correct = ['a', 'b', 'c', 'd']
    expect(footrule(user, correct)).toBeGreaterThanOrEqual(kendall(user, correct) - 10)
    expect(footrule(correct, correct)).toBe(100)
  })

  it('positional / jaccard', () => {
    expect(positional(['a', 'x', 'c'], ['a', 'b', 'c'])).toBe(67)
    expect(jaccard(['a', 'b'], ['b', 'c'])).toBe(33)
    expect(jaccard([], [])).toBe(100)
  })

  it('decisionAccuracy counts true negatives; signalDetection punishes spam', () => {
    expect(decisionAccuracy(['a'], ['a', 'b'], ['a', 'b', 'c', 'd'])).toBe(75)
    expect(signalDetection(['a', 'b'], ['a', 'b'])).toBe(100)
    // flag-everything: 2 hits − 2 false alarms = 0
    expect(signalDetection(['a', 'b', 'c', 'd'], ['a', 'b'])).toBe(0)
  })

  it('toleranceBands / linearFalloff (incl. log scale)', () => {
    expect(toleranceBands(102, 100, 5)).toBe(100)
    expect(toleranceBands(108, 100, 5)).toBe(50)
    expect(toleranceBands(120, 100, 5)).toBe(0)
    expect(linearFalloff(100, 100, 5, 50)).toBe(100)
    expect(linearFalloff(150, 100, 0, 100)).toBe(50)
    // log delta = |log10(1000) − log10(100)| = 1 → (1 − 0.5)/(2 − 0.5) into the falloff
    expect(linearFalloff(1000, 100, 0.5, 2, 'log')).toBe(67)
    expect(linearFalloff(0, 100, 1, 2, 'log')).toBe(0)
  })

  it('allocationRanges requires the total to match', () => {
    const targets = { save: { min: 40, max: 60 }, spend: { min: 40, max: 60 } }
    expect(allocationRanges({ save: 50, spend: 50 }, targets, 100)).toBe(100)
    expect(allocationRanges({ save: 70, spend: 30 }, targets, 100)).toBe(0)
    expect(allocationRanges({ save: 50, spend: 30 }, targets, 100)).toBe(0) // sums to 80
  })

  it('calibration payoff', () => {
    expect(calibration(true, 90)).toBe(90)
    expect(calibration(false, 90)).toBe(10)
    expect(calibration(false, 50)).toBe(50)
  })

  it('sumEquals near band', () => {
    expect(sumEquals(25, 25, 5)).toBe(100)
    expect(sumEquals(28, 25, 5)).toBe(40)
    expect(sumEquals(35, 25, 5)).toBe(0)
  })

  it('meanQuality', () => {
    expect(meanQuality([100, 50])).toBe(75)
    expect(meanQuality([])).toBe(0)
  })

  it('qualityScaleFactor: 0–1 maps rescale, 0–100 maps pass through', () => {
    expect(qualityScaleFactor([1, 0.3])).toBe(100) // authored 0–1 → ×100
    expect(qualityScaleFactor([0.8])).toBe(100)
    expect(qualityScaleFactor([100, 20])).toBe(1) // already 0–100
    expect(qualityScaleFactor([1])).toBe(100) // boundary: max exactly 1
    expect(qualityScaleFactor([0, 0])).toBe(1) // degenerate: no rescale
    expect(qualityScaleFactor([])).toBe(1)
  })

  it('text matching: accents, fuzz budget, keywords', () => {
    expect(normalizeText('  ¡Ahórro!  ')).toBe('ahorro')
    expect(levenshtein('gato', 'gtao')).toBe(2)
    expect(fuzzyEquals('ahorro', 'Ahórro')).toBe(true)
    expect(fuzzyEquals('si', 'no')).toBe(false)
    // short strings are exact-only
    expect(fuzzyEquals('sol', 'sal')).toBe(false)
    expect(keywordCoverage('guardar dinero para después', ['guardar', 'después', 'banco'])).toBe(67)
  })
})
