// `storyplay` family — grading tests (LESSON_ENGINE.md §5.7, §6).
// Every type: best → 100 (or top quality), mixed → exact expected mean,
// malformed → 0 without throwing. Plus flash_match overtime cap and
// lightning_round null answers.

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { storyplayGraders } from './grade'

function seg(
  type: string,
  payload: Record<string, unknown>,
  answer?: Record<string, unknown>,
): SegmentBase {
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

function grade(segment: SegmentBase, answer: unknown) {
  const grader = storyplayGraders[segment.type]
  if (!grader) throw new Error(`no grader for ${segment.type}`)
  return grader(segment, answer)
}

const MALFORMED_ANSWERS: unknown[] = [null, undefined, 42, 'nope', [], { wrong: 'shape' }]

function expectMalformedSafe(segment: SegmentBase, wellFormed: unknown) {
  for (const bad of MALFORMED_ANSWERS) {
    expect(() => grade(segment, bad)).not.toThrow()
    expect(grade(segment, bad).score).toBe(0)
  }
  // Missing answer key is malformed too.
  const noKey = { ...segment, answer: undefined }
  expect(() => grade(noKey, wellFormed)).not.toThrow()
  expect(grade(noKey, wellFormed).score).toBe(0)
}

// ---- story_branch -----------------------------------------------------------------

describe('story_branch', () => {
  const segment = seg(
    'story_branch',
    { start_node: 'n1', nodes: [] },
    {
      qualities: [
        { node_id: 'n1', choice_id: 'a', score: 100 },
        { node_id: 'n1', choice_id: 'b', score: 20 },
        { node_id: 'n2', choice_id: 'a', score: 100 },
        { node_id: 'n2', choice_id: 'b', score: 50 },
      ],
    },
  )

  it('best path scores 100', () => {
    const out = grade(segment, {
      path: [
        { node_id: 'n1', choice_id: 'a' },
        { node_id: 'n2', choice_id: 'a' },
      ],
    })
    expect(out.score).toBe(100)
  })

  it('mixed path is the exact mean of matched qualities', () => {
    const out = grade(segment, {
      path: [
        { node_id: 'n1', choice_id: 'b' },
        { node_id: 'n2', choice_id: 'b' },
      ],
    })
    expect(out.score).toBe(35) // (20 + 50) / 2
  })

  it('skips path steps with no authored quality', () => {
    const out = grade(segment, {
      path: [
        { node_id: 'n1', choice_id: 'a' },
        { node_id: 'ghost', choice_id: 'x' },
      ],
    })
    expect(out.score).toBe(100) // only n1/a counts
  })

  it('scores 0 when no path step matches any quality', () => {
    expect(grade(segment, { path: [{ node_id: 'ghost', choice_id: 'x' }] }).score).toBe(0)
    expect(grade(segment, { path: [] }).score).toBe(0)
  })

  it('reveals the best choice per node', () => {
    const out = grade(segment, { path: [{ node_id: 'n1', choice_id: 'b' }] })
    expect(out.reveal).toEqual({ best: { n1: 'a', n2: 'a' } })
  })

  it('malformed answers score 0 without throwing', () => {
    expectMalformedSafe(segment, { path: [{ node_id: 'n1', choice_id: 'a' }] })
    expect(grade(segment, { path: [{ node_id: 'n1' }] }).score).toBe(0) // step missing choice_id
    expect(grade(segment, { path: 'nope' }).score).toBe(0)
  })
})

// ---- dialogue_choice ---------------------------------------------------------------

describe('dialogue_choice', () => {
  const segment = seg(
    'dialogue_choice',
    { persona: { character: 'zara', role_md: 'x' }, opening_md: 'x', turns: [] },
    {
      turns: [
        {
          turn_id: 't1',
          qualities: { r1: 100, r2: 40 },
          reactions: { r1: '¡Gran trato!', r2: 'Perdiste dinero.' },
        },
        { turn_id: 't2', qualities: { r1: 100, r2: 10 }, reactions: { r1: '¡Volveré mañana!' } },
        { turn_id: 't3', qualities: { r1: 100, r2: 70 } },
      ],
    },
  )

  it('best replies score 100 and join reactions with newlines', () => {
    const out = grade(segment, {
      replies: [
        { turn_id: 't1', reply_id: 'r1' },
        { turn_id: 't2', reply_id: 'r1' },
        { turn_id: 't3', reply_id: 'r1' },
      ],
    })
    expect(out.score).toBe(100)
    expect(out.feedback_md).toBe('¡Gran trato!\n¡Volveré mañana!')
  })

  it('mixed replies produce the exact mean', () => {
    const out = grade(segment, {
      replies: [
        { turn_id: 't1', reply_id: 'r2' },
        { turn_id: 't2', reply_id: 'r2' },
        { turn_id: 't3', reply_id: 'r2' },
      ],
    })
    expect(out.score).toBe(40) // (40 + 10 + 70) / 3
  })

  it('an unanswered turn counts as 0 in the mean', () => {
    const out = grade(segment, { replies: [{ turn_id: 't1', reply_id: 'r1' }] })
    expect(out.score).toBe(33) // round((100 + 0 + 0) / 3)
  })

  it('reveals the best reply per turn', () => {
    const out = grade(segment, { replies: [{ turn_id: 't1', reply_id: 'r2' }] })
    expect(out.reveal).toEqual({ best: { t1: 'r1', t2: 'r1', t3: 'r1' } })
  })

  it('malformed answers score 0 without throwing', () => {
    expectMalformedSafe(segment, { replies: [{ turn_id: 't1', reply_id: 'r1' }] })
    expect(grade(segment, { replies: [{ turn_id: 't1' }] }).score).toBe(0)
    expect(grade(segment, { replies: 'nope' }).score).toBe(0)
  })
})

// ---- flash_match -----------------------------------------------------------------

describe('flash_match', () => {
  const segment = seg(
    'flash_match',
    { left: [], right: [], seconds: 30 },
    {
      pairs: [
        ['l1', 'r1'],
        ['l2', 'r2'],
        ['l3', 'r3'],
        ['l4', 'r4'],
      ],
    },
  )

  it('all correct pairs score 100', () => {
    const out = grade(segment, {
      pairs: [
        ['l1', 'r1'],
        ['l2', 'r2'],
        ['l3', 'r3'],
        ['l4', 'r4'],
      ],
      overtime: false,
    })
    expect(out.score).toBe(100)
  })

  it('partial pairs score the exact ratio', () => {
    const out = grade(segment, {
      pairs: [
        ['l1', 'r1'],
        ['l2', 'r3'], // wrong match
        ['l3', 'r3'],
      ],
      overtime: false,
    })
    expect(out.score).toBe(50) // 2 of 4
  })

  it('caps at ×0.8 when overtime', () => {
    const out = grade(segment, {
      pairs: [
        ['l1', 'r1'],
        ['l2', 'r2'],
        ['l3', 'r3'],
        ['l4', 'r4'],
      ],
      overtime: true,
    })
    expect(out.score).toBe(80)
  })

  it('reversed tuples and duplicates do not double-count', () => {
    expect(grade(segment, { pairs: [['r1', 'l1']], overtime: false }).score).toBe(0)
    expect(
      grade(segment, {
        pairs: [
          ['l1', 'r1'],
          ['l1', 'r1'],
        ],
        overtime: false,
      }).score,
    ).toBe(25) // 1 of 4, counted once
  })

  it('malformed answers score 0 without throwing', () => {
    expectMalformedSafe(segment, { pairs: [['l1', 'r1']], overtime: false })
    expect(grade(segment, { pairs: [['l1', 42]] }).score).toBe(0)
    expect(grade(segment, { pairs: 'nope' }).score).toBe(0)
  })
})

// ---- lightning_round --------------------------------------------------------------

describe('lightning_round', () => {
  const segment = seg(
    'lightning_round',
    { questions: [], seconds_per_q: 8 },
    { correct: { q1: 'a', q2: 'b', q3: 'c' } },
  )

  it('all correct scores 100', () => {
    expect(grade(segment, { answers: { q1: 'a', q2: 'b', q3: 'c' } }).score).toBe(100)
  })

  it('null and missing answers count as wrong', () => {
    expect(grade(segment, { answers: { q1: 'a', q2: null, q3: 'x' } }).score).toBe(33) // 1 of 3
    expect(grade(segment, { answers: { q1: 'a' } }).score).toBe(33)
    expect(grade(segment, { answers: {} }).score).toBe(0)
  })

  it('reveals the correct map', () => {
    expect(grade(segment, { answers: {} }).reveal).toEqual({
      correct: { q1: 'a', q2: 'b', q3: 'c' },
    })
  })

  it('malformed answers score 0 without throwing', () => {
    expectMalformedSafe(segment, { answers: { q1: 'a' } })
    expect(grade(segment, { answers: 'nope' }).score).toBe(0)
  })
})

// ---- would_you_rather --------------------------------------------------------------

describe('would_you_rather', () => {
  const segment = seg(
    'would_you_rather',
    { a: { text_md: 'x' }, b: { text_md: 'y' } },
    { qualities: { a: 60, b: 90 }, reveal_md: 'Las dos valen: eso es **costo de oportunidad**.' },
  )

  it('scores the chosen side quality and always gives the reveal feedback', () => {
    const outA = grade(segment, { choice: 'a' })
    expect(outA.score).toBe(60)
    expect(outA.feedback_md).toBe('Las dos valen: eso es **costo de oportunidad**.')
    const outB = grade(segment, { choice: 'b' })
    expect(outB.score).toBe(90)
    expect(outB.feedback_md).toBe('Las dos valen: eso es **costo de oportunidad**.')
  })

  it('reveals both qualities', () => {
    expect(grade(segment, { choice: 'a' }).reveal).toEqual({ qualities: { a: 60, b: 90 } })
  })

  it('malformed answers score 0 without throwing', () => {
    expectMalformedSafe(segment, { choice: 'a' })
    expect(grade(segment, { choice: 'c' }).score).toBe(0)
    expect(grade(segment, { choice: 1 }).score).toBe(0)
  })
})
