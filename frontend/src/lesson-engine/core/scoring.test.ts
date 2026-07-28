import { describe, expect, it } from 'vitest'
import {
  allocationRanges,
  balancedDecisionAccuracy,
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
  setF1,
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
    // perfect discrimination: every target, no false alarm
    expect(signalDetection(['a', 'b'], ['a', 'b'], 4)).toBe(100)
    // select-everything: hitRate 1 − 0.5 × falseAlarmRate 1 = 50, below any pass gate
    expect(signalDetection(['a', 'b', 'c', 'd'], ['a', 'b'], 4)).toBe(50)
  })

  it('balancedDecisionAccuracy: a blanket label can never pass, at ANY class ratio', () => {
    /*
     * The property plain decisionAccuracy could not hold for needs_wants. With 8
     * items and 2 needs, "Want on everything" (an EMPTY needs_ids) scored the
     * majority class 6/8 = 75 and cleared the 70 threshold with no thinking.
     */
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    expect(decisionAccuracy([], ['a', 'b'], eight)).toBe(75) // the old exploit
    expect(balancedDecisionAccuracy([], ['a', 'b'], eight)).toBe(50) // want-on-everything
    expect(balancedDecisionAccuracy(eight, ['a', 'b'], eight)).toBe(50) // need-on-everything
    expect(balancedDecisionAccuracy([], ['a', 'b', 'c', 'd', 'e', 'f'], eight)).toBe(50) // inverted ratio
    // The intended answer is still exactly 100, and one miss still passes on merit.
    expect(balancedDecisionAccuracy(['a', 'b'], ['a', 'b'], eight)).toBe(100)
    expect(balancedDecisionAccuracy(['a'], ['a', 'b'], eight)).toBe(75) // half the needs, all wants right
    expect(balancedDecisionAccuracy(['c', 'd'], ['a', 'b'], eight)).toBe(33) // fully inverted calls
  })

  it('balancedDecisionAccuracy: a balanced set grades exactly like decisionAccuracy', () => {
    // Equal class sizes → the mean of the two rates IS (TP+TN)/N, so every already
    // authored balanced lesson keeps its old score.
    const four = ['a', 'b', 'c', 'd']
    for (const selected of [[], ['a'], ['a', 'b'], ['a', 'c'], ['a', 'b', 'c'], four]) {
      expect(balancedDecisionAccuracy(selected, ['a', 'b'], four)).toBe(
        decisionAccuracy(selected, ['a', 'b'], four),
      )
    }
  })

  it('balancedDecisionAccuracy: a one-class set falls back to plain accuracy (never unwinnable)', () => {
    // Degenerate content (no needs at all) is refused by coursegen's gate 8; if it
    // ever reaches the engine the correct labelling must still score 100.
    const four = ['a', 'b', 'c', 'd']
    expect(balancedDecisionAccuracy([], [], four)).toBe(100)
    expect(balancedDecisionAccuracy(four, four, four)).toBe(100)
    expect(balancedDecisionAccuracy([], [], [])).toBe(0)
  })

  it('setF1: only asserted items earn credit — untouched items pay nothing', () => {
    /*
     * The property decisionAccuracy could not hold for a "find the flaw" toggle.
     * On a 10-step spot_error with ONE flawed step it scored an arbitrary single
     * tap (10−1−1)/10 = 80, so "tap any step" passed a 70 gate with no reasoning.
     */
    expect(decisionAccuracy(['s1'], ['s7'], Array.from({ length: 10 }, (_, i) => `s${i + 1}`))).toBe(80)
    expect(setF1(['s1'], ['s7'])).toBe(0)
    // The intended answer is still worth exactly 100 (never unwinnable).
    expect(setF1(['s7'], ['s7'])).toBe(100)
    expect(setF1(['a', 'b'], ['b', 'a'])).toBe(100) // order-free, set semantics
    expect(setF1(['a', 'a', 'a'], ['a'])).toBe(100) // duplicates cannot inflate
  })

  it('setF1: volume strategies collapse, single slips are forgiven', () => {
    // select-all with 1 target of 10 → 2·1/(10+1) = 18
    expect(setF1(Array.from({ length: 10 }, (_, i) => `s${i + 1}`), ['s7'])).toBe(18)
    // full recall + one false alarm → 2·2/(3+2) = 80 (passes: real discrimination)
    expect(setF1(['a', 'b', 'x'], ['a', 'b'])).toBe(80)
    // half the targets, nothing spurious → 2·1/(1+2) = 67 (fails: a taught flaw missed)
    expect(setF1(['a'], ['a', 'b'])).toBe(67)
    expect(setF1([], ['a'])).toBe(0)
    expect(setF1(['a'], [])).toBe(0)
    expect(setF1([], [])).toBe(100)
  })

  it('signalDetection: selecting EVERYTHING can never pass, at ANY positive:negative ratio', () => {
    /*
     * This is the property the old counting formula could not hold. It scored
     * `ratio(hits - falseAlarms, positives)`, so on the live red-flags shape — 4
     * targets, 1 innocent line — tapping every card scored ratio(4-1, 4) = 75 and
     * CLEARED the 70 threshold, defeating the whole point of the type. With rates,
     * select-all is pinned at 50 no matter how the items are split.
     */
    expect(signalDetection(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd'], 5)).toBe(50); // 4:1 (the live shape)
    expect(signalDetection(['a', 'b', 'c'], ['a', 'b'], 3)).toBe(50); // 2:1
    expect(signalDetection(['a', 'b', 'c', 'd', 'e', 'f'], ['a', 'b', 'c'], 6)).toBe(50); // 3:3
    expect(signalDetection(['a', 'b', 'c', 'd', 'e', 'f'], ['a'], 6)).toBe(50); // 1:5
  })

  it('signalDetection: partial credit still rewards real discrimination', () => {
    // 3 of 4 targets, no false alarms → 75 (passes: genuine discrimination)
    expect(signalDetection(['a', 'b', 'c'], ['a', 'b', 'c', 'd'], 8)).toBe(75)
    // every target plus ONE slip out of 4 negatives → 100 − 0.5×25 = 88 (a slip is
    // forgiven; this is why the false-alarm rate is weighted 0.5 and not 1.0)
    expect(signalDetection(['a', 'b', 'c', 'd', 'x'], ['a', 'b', 'c', 'd'], 8)).toBe(88)
    // half the targets plus a slip → 50 − 12.5 = 38 (fails, correctly)
    expect(signalDetection(['a', 'b', 'x'], ['a', 'b', 'c', 'd'], 8)).toBe(38)
    // selecting nothing → 0, never negative
    expect(signalDetection([], ['a', 'b'], 4)).toBe(0)
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

  it('allocationRanges: a partly-right split can never clear a pass gate', () => {
    /*
     * partial_credit_too_generous: this used to return inRange/keys × 100, so on a
     * 4-jar piggy_split three-of-four in range scored 75 and PASSED with one jar
     * wrong — including the jar left at 0, the misconception the type teaches
     * against. Partial credit now lives in a sub-pass band; a perfect split is
     * still exactly 100.
     */
    const four = {
      save: { min: 20, max: 40 },
      spend: { min: 20, max: 40 },
      give: { min: 5, max: 20 },
      invest: { min: 5, max: 20 },
    }
    expect(allocationRanges({ save: 30, spend: 30, give: 20, invest: 20 }, four, 100)).toBe(100)
    // save 40 / spend 40 / give 20 / invest 0 → only `invest` misses its range
    expect(allocationRanges({ save: 40, spend: 40, give: 20, invest: 0 }, four, 100)).toBe(38)
    expect(allocationRanges({ save: 60, spend: 20, give: 20, invest: 0 }, four, 100)).toBe(25) // 2 of 4
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

  it('keywordCoverage: a NUMERIC keyword matches only as a whole number', () => {
    // partial_credit_too_generous (the shipped type_answer keyed keywords: ["20"]):
    // "200"/"120" used to contain "20" and score a full 100 for a wrong sum.
    expect(keywordCoverage('200', ['20'])).toBe(0)
    expect(keywordCoverage('120', ['20'])).toBe(0)
    expect(keywordCoverage('2020', ['20'])).toBe(0)
    // The real answer still counts, alone or inside a sentence, with symbols.
    expect(keywordCoverage('20', ['20'])).toBe(100)
    expect(keywordCoverage('vendió 20 vasos', ['20'])).toBe(100)
    expect(keywordCoverage('$20.', ['20'])).toBe(100)
    // Word keywords keep substring/stem matching (authors depend on it).
    expect(keywordCoverage('ahorrar siempre', ['ahorr'])).toBe(100)
    // Mixed digit+word keywords are not "numeric" and behave exactly as before.
    expect(keywordCoverage('cuesta 5 pesos cada uno', ['5 pesos'])).toBe(100)
  })
})
