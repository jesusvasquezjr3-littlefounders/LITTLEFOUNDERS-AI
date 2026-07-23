// `analyze` family — numeric grading tests (LESSON_ENGINE.md §5.6, §6).
// Per type: correct → 100, partial → exact expected value, malformed → 0, never throw.

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { analyzeGraders } from './grade'

function segment(type: string, payload: Record<string, unknown>, answer: Record<string, unknown>): SegmentBase {
  return {
    id: `test-${type}`,
    type,
    prompt_md: 'test',
    difficulty: 1,
    xp: 10,
    payload,
    answer,
  }
}

function grade(seg: SegmentBase, answer: unknown) {
  const grader = analyzeGraders[seg.type]
  if (!grader) throw new Error(`no grader for ${seg.type}`)
  return grader(seg, answer)
}

const MALFORMED_ANSWERS: unknown[] = [undefined, null, 42, 'nope', [], {}]

function expectMalformedZero(seg: SegmentBase, extra: unknown[] = []) {
  for (const bad of [...MALFORMED_ANSWERS, ...extra]) {
    expect(() => grade(seg, bad)).not.toThrow()
    expect(grade(seg, bad).score).toBe(0)
  }
}

// ---- spot_error -----------------------------------------------------------------

describe('spot_error', () => {
  const seg = segment(
    'spot_error',
    {
      steps: [
        { id: 's1', text_md: 'a' },
        { id: 's2', text_md: 'b' },
        { id: 's3', text_md: 'c' },
        { id: 's4', text_md: 'd' },
      ],
    },
    { error_ids: ['s3'], correction_md: 'La correcta es **$25**.' },
  )

  it('correct selection scores 100 and reveals the correction', () => {
    const out = grade(seg, { selected: ['s3'] })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ error_ids: ['s3'], correction_md: 'La correcta es **$25**.' })
  })

  it('partial: one hit + one false alarm over 4 steps → decisionAccuracy 75', () => {
    // TP s3 + TN s1,s4 = 3 good of 4.
    expect(grade(seg, { selected: ['s2', 's3'] }).score).toBe(75)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ selected: 's3' }, { selected: [1, 2] }])
    // Missing answer key is also malformed.
    const noKey = { ...seg, answer: undefined }
    expect(grade(noKey, { selected: ['s3'] }).score).toBe(0)
  })
})

// ---- cause_effect -----------------------------------------------------------------

describe('cause_effect', () => {
  const seg = segment(
    'cause_effect',
    {
      events: [
        { id: 'e1', text_md: 'a' },
        { id: 'e2', text_md: 'b' },
        { id: 'e3', text_md: 'c' },
        { id: 'e4', text_md: 'd' },
        { id: 'd1', text_md: 'x' },
      ],
      slots: 4,
    },
    { chain: ['e1', 'e2', 'e3', 'e4'] },
  )

  it('correct chain scores 100', () => {
    const out = grade(seg, { chain: ['e1', 'e2', 'e3', 'e4'] })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ chain: ['e1', 'e2', 'e3', 'e4'] })
  })

  it('partial: two of four in position → positional 50', () => {
    expect(grade(seg, { chain: ['e1', 'e2', 'e4', 'e3'] }).score).toBe(50)
  })

  it('wrong length chain → 0 (positional rejects)', () => {
    expect(grade(seg, { chain: ['e1', 'e2'] }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ chain: 'e1' }, { chain: [1] }])
  })
})

// ---- compare_table -----------------------------------------------------------------

describe('compare_table', () => {
  const seg = segment(
    'compare_table',
    {
      rows: [
        { id: 'r1', label: 'A' },
        { id: 'r2', label: 'B' },
      ],
      cols: [
        { id: 'c1', label: 'X' },
        { id: 'c2', label: 'Y' },
      ],
      tokens: [
        { id: 't1', text_md: '1' },
        { id: 't2', text_md: '2' },
        { id: 't3', text_md: '3' },
        { id: 't4', text_md: '4' },
      ],
    },
    { cells: { 'r1:c1': 't1', 'r1:c2': 't2', 'r2:c1': 't3', 'r2:c2': 't4' } },
  )

  it('all cells right scores 100', () => {
    expect(
      grade(seg, { cells: { 'r1:c1': 't1', 'r1:c2': 't2', 'r2:c1': 't3', 'r2:c2': 't4' } }).score,
    ).toBe(100)
  })

  it('partial: 3 of 4 cells → ratio 75', () => {
    expect(
      grade(seg, { cells: { 'r1:c1': 't1', 'r1:c2': 't2', 'r2:c1': 't4', 'r2:c2': 't4' } }).score,
    ).toBe(75)
  })

  it('rescues legacy underscore-separated answer keys', () => {
    const legacy = segment(
      'compare_table',
      { rows: [{ id: 'r1', label: 'A' }], cols: [{ id: 'c1', label: 'X' }], tokens: [{ id: 't1', text_md: '1' }] },
      { cells: { r1_c1: 't1' } }, // `_` separator instead of the canonical `:`
    )
    // The player always submits `<row>:<col>` — this used to score 0/100.
    expect(grade(legacy, { cells: { 'r1:c1': 't1' } }).score).toBe(100)
  })

  it('treats tokens with identical display text as interchangeable', () => {
    const dup = segment(
      'compare_table',
      {
        rows: [{ id: 'r1', label: 'A' }],
        cols: [{ id: 'c1', label: 'X' }],
        tokens: [
          { id: 't1', text_md: '5 MXN' },
          { id: 't2', text_md: '5 MXN' },
        ],
      },
      { cells: { 'r1:c1': 't1' } },
    )
    // Placing the other "5 MXN" token is still correct — same visible value.
    expect(grade(dup, { cells: { 'r1:c1': 't2' } }).score).toBe(100)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ cells: 'nope' }, { cells: { 'r1:c1': 7 } }])
  })
})

// ---- read_chart -----------------------------------------------------------------

describe('read_chart', () => {
  const seg = segment(
    'read_chart',
    {
      chart: { kind: 'bar', series: [{ label: 'S', points: [{ x: 'a', y: 1 }] }] },
      questions: [
        { id: 'q1', prompt_md: 'p1', options: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }] },
        { id: 'q2', prompt_md: 'p2', options: [{ id: 'a', text_md: 'a' }, { id: 'b', text_md: 'b' }] },
      ],
    },
    { correct: { q1: 'b', q2: 'a' } },
  )

  it('all questions right scores 100', () => {
    const out = grade(seg, { answers: { q1: 'b', q2: 'a' } })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ correct: { q1: 'b', q2: 'a' } })
  })

  it('partial: 1 of 2 questions → ratio 50', () => {
    expect(grade(seg, { answers: { q1: 'b', q2: 'b' } }).score).toBe(50)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ answers: ['b'] }, { answers: { q1: true } }])
  })
})

// ---- evidence_hunt -----------------------------------------------------------------

describe('evidence_hunt', () => {
  const seg = segment(
    'evidence_hunt',
    {
      claim_md: 'claim',
      sentences: [
        { id: 's1', text_md: 'a' },
        { id: 's2', text_md: 'b' },
        { id: 's3', text_md: 'c' },
        { id: 's4', text_md: 'd' },
        { id: 's5', text_md: 'e' },
      ],
    },
    { evidence_ids: ['s1', 's3', 's5'] },
  )

  it('exact evidence set scores 100', () => {
    expect(grade(seg, { selected: ['s1', 's3', 's5'] }).score).toBe(100)
  })

  it('partial: {s1,s2} vs {s1,s3,s5} → jaccard 1/4 = 25', () => {
    expect(grade(seg, { selected: ['s1', 's2'] }).score).toBe(25)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ selected: 's1' }, { selected: [null] }])
  })
})

// ---- red_flags -----------------------------------------------------------------

describe('red_flags', () => {
  const seg = segment(
    'red_flags',
    {
      artifact_md: 'ad',
      artifact_kind: 'ad',
      flags: [
        { id: 'f1', text_md: 'a' },
        { id: 'f2', text_md: 'b' },
        { id: 'f3', text_md: 'c' },
        { id: 'f4', text_md: 'd' },
        { id: 'f5', text_md: 'e' },
        { id: 'f6', text_md: 'f' },
      ],
    },
    { redflag_ids: ['f1', 'f2', 'f3', 'f6'] },
  )

  it('exact flags score 100', () => {
    expect(grade(seg, { selected: ['f1', 'f2', 'f3', 'f6'] }).score).toBe(100)
  })

  it('partial: 2 hits, 1 false alarm over 4 positives → (2−1)/4 = 25', () => {
    expect(grade(seg, { selected: ['f1', 'f2', 'f4'] }).score).toBe(25)
  })

  it('flag-everything gets punished: 4 hits − 2 false alarms → 50', () => {
    expect(grade(seg, { selected: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] }).score).toBe(50)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ selected: 'f1' }, { selected: [{}] }])
  })
})

// ---- fact_opinion -----------------------------------------------------------------

describe('fact_opinion', () => {
  const seg = segment(
    'fact_opinion',
    {
      statements: [
        { id: 'st1', text_md: 'a' },
        { id: 'st2', text_md: 'b' },
        { id: 'st3', text_md: 'c' },
        { id: 'st4', text_md: 'd' },
      ],
    },
    { fact_ids: ['st1', 'st3'] },
  )

  it('all statements decided right scores 100', () => {
    const out = grade(seg, { fact_ids: ['st1', 'st3'] })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ fact_ids: ['st1', 'st3'] })
  })

  it('partial: TP st1 + TN st4 of 4 → decisionAccuracy 50', () => {
    expect(grade(seg, { fact_ids: ['st1', 'st2'] }).score).toBe(50)
  })

  it('malformed → 0, never throws', () => {
    expectMalformedZero(seg, [{ fact_ids: 'st1' }, { fact_ids: [false] }])
  })
})
