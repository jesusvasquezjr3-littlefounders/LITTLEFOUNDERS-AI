// `choice` family — grader tests (LESSON_ENGINE.md §5.2, §6).
//
// SCOPE: the `yes_no_cases` fairness contract. The grader change that closed
// naive_strategy_passes (2026-07-25) swapped pooled `decisionAccuracy` for
// `balancedDecisionAccuracy`, but shipped with coverage only at the HELPER level
// (core/scoring.test.ts). These tests pin the property where the exploit actually
// lived — end to end, on the exact answer object the widget builds from taps — so a
// future edit to `gradeYesNoCases` (or to `buildYesNoAnswer`) cannot silently reopen
// it. The engine-level counterpart to coursegen's gate 8, which refuses to AUTHOR the
// one-sided keys no formula can rescue.

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { choiceGraders } from './grade'
import { buildYesNoAnswer, choiceCanSubmit } from './components'
import { decisionAccuracy } from '../../core/scoring'

/** The document pass mark every authored lesson uses (coursegen default). */
const PASS_THRESHOLD = 70

function seg(type: string, payload: Record<string, unknown>, answer?: Record<string, unknown>): SegmentBase {
  return { id: `t-${type}`, type, prompt_md: 'x', difficulty: 1, xp: 10, payload, answer }
}

function grade(type: string, segment: SegmentBase, answer: unknown) {
  const grader = choiceGraders[type]
  if (!grader) throw new Error(`missing grader: ${type}`)
  return grader(segment, answer)
}

const MALFORMED_ANSWERS: unknown[] = [undefined, null, 42, 'nope', [], {}, { junk: true }]

describe('yes_no_cases', () => {
  const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
  const casesOf = (n: number) => ids.slice(0, n).map((id) => ({ id, text_md: id }))
  const segmentOf = (n: number, applies: string[]) =>
    seg('yes_no_cases', { rule_md: 'Una necesidad es algo sin lo que no puedes vivir bien.', cases: casesOf(n) }, { applies_ids: applies })

  /** What the widget submits when the child presses the same button on every case. */
  const blanket = (n: number, yes: boolean) =>
    buildYesNoAnswer({ decisions: Object.fromEntries(casesOf(n).map((c) => [c.id, yes])) })

  it('a blanket NO cannot pass, on the skewed shape where it used to (8 cases, 2 applying)', () => {
    const segment = segmentOf(8, ['c1', 'c2'])
    // The old exploit, kept here as the regression marker: pooled accuracy paid the
    // majority class, so "press NO on every case" scored 6/8 = 75 ≥ 70 without a
    // single case being tested against the rule — and the widget's canSubmit is
    // satisfied by exactly that, one repeated tap.
    expect(decisionAccuracy([], ['c1', 'c2'], ids)).toBe(75)
    expect(choiceCanSubmit.yes_no_cases({ decisions: Object.fromEntries(ids.map((id) => [id, false])) }, segment)).toBe(true)

    const score = grade('yes_no_cases', segment, blanket(8, false)).score
    expect(score).toBe(50)
    expect(score).toBeLessThan(PASS_THRESHOLD)
  })

  it('a blanket YES cannot pass either, on the mirror-image shape (8 cases, 6 applying)', () => {
    const applies = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
    expect(decisionAccuracy(ids, applies, ids)).toBe(75) // the mirror exploit
    expect(grade('yes_no_cases', segmentOf(8, applies), blanket(8, true)).score).toBe(50)
  })

  it('neither blanket answer passes at ANY applying:non-applying split the schema allows', () => {
    // cases: 3–8 (schema), and gate 8 refuses the one-sided keys (0 or all applying).
    for (let n = 3; n <= 8; n++) {
      for (let p = 1; p < n; p++) {
        const segment = segmentOf(n, ids.slice(0, p))
        expect(grade('yes_no_cases', segment, blanket(n, false)).score).toBe(50)
        expect(grade('yes_no_cases', segment, blanket(n, true)).score).toBe(50)
      }
    }
  })

  it('the intended answer still scores exactly 100 (never unwinnable)', () => {
    for (let n = 3; n <= 8; n++) {
      for (let p = 1; p < n; p++) {
        const applies = ids.slice(0, p)
        const decisions = Object.fromEntries(casesOf(n).map((c) => [c.id, applies.includes(c.id)]))
        expect(grade('yes_no_cases', segmentOf(n, applies), buildYesNoAnswer({ decisions })).score).toBe(100)
      }
    }
  })

  it('a child who reasoned and slipped once still passes', () => {
    // Every applying case found plus one false alarm: (1 + 5/6) / 2 = 92. Reasoning is
    // not punished for a single mis-tap (same allowance as setF1 / signalDetection).
    const segment = segmentOf(8, ['c1', 'c2'])
    const decisions = Object.fromEntries(ids.map((id) => [id, ['c1', 'c2', 'c3'].includes(id)]))
    const score = grade('yes_no_cases', segment, buildYesNoAnswer({ decisions })).score
    expect(score).toBe(92)
    expect(score).toBeGreaterThanOrEqual(PASS_THRESHOLD)
  })

  it('a balanced set grades exactly as it did before the fix', () => {
    // As many applying cases as non-applying → mean(sensitivity, specificity) IS
    // (TP+TN)/N, so already-authored balanced lessons keep their scores bit for bit.
    const segment = segmentOf(4, ['c1', 'c3'])
    for (const picked of [[], ['c1'], ['c1', 'c3'], ['c2', 'c4'], ['c1', 'c2', 'c3']]) {
      const decisions = Object.fromEntries(casesOf(4).map((c) => [c.id, picked.includes(c.id)]))
      expect(grade('yes_no_cases', segment, buildYesNoAnswer({ decisions })).score).toBe(
        decisionAccuracy(picked, ['c1', 'c3'], ['c1', 'c2', 'c3', 'c4']),
      )
    }
  })

  it('reveals the applying cases (so the widget can mark each card) and nothing else', () => {
    const out = grade('yes_no_cases', segmentOf(4, ['c1', 'c3']), blanket(4, false))
    expect(out.reveal).toEqual({ applies_ids: ['c1', 'c3'] })
  })

  it('malformed → 0, never throws', () => {
    const segment = segmentOf(4, ['c1', 'c3'])
    for (const bad of MALFORMED_ANSWERS) {
      expect(() => grade('yes_no_cases', segment, bad)).not.toThrow()
      expect(grade('yes_no_cases', segment, bad).score).toBe(0)
    }
    expect(grade('yes_no_cases', segment, { applies_ids: [1, 2] }).score).toBe(0)
    expect(grade('yes_no_cases', { ...segment, answer: undefined }, blanket(4, false)).score).toBe(0)
  })
})
