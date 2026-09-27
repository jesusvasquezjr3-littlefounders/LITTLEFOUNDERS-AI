// `storyplay` family — grading tests (LESSON_ENGINE.md §5.7, §6).
// Every type: best → 100 (or top quality), mixed → exact expected mean,
// malformed → 0 without throwing. Plus flash_match overtime (no penalty, OD-28) and
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

  /*
   * naive_strategy_passes / partial_credit_too_generous (2026-07-25): a node offering a
   * SINGLE choice is a forced "continue", not a decision — the child had no alternative.
   * Authors are told to end branches that way AND to key every choice in the tree, so
   * those steps used to be averaged in as free 100s and diluted the one real decision
   * below the pass line. Every case below is scored against the payload's real arity.
   */
  describe('forced single-choice nodes', () => {
    const branching = seg(
      'story_branch',
      {
        start_node: 'd1',
        nodes: [
          {
            id: 'd1',
            text_md: '¿Qué precio pones?',
            choices: [
              { id: 'good', text_md: '5', next: 'beat1' },
              { id: 'bad', text_md: '10', next: 'beat1' },
            ],
          },
          { id: 'beat1', text_md: 'Nadie compró.', choices: [{ id: 'ok1', text_md: 'Entendido', next: 'beat2' }] },
          { id: 'beat2', text_md: 'Sigo lejos.', choices: [{ id: 'ok2', text_md: 'Entendido', next: null }] },
        ],
      },
      {
        qualities: [
          { node_id: 'd1', choice_id: 'good', score: 100 },
          { node_id: 'd1', choice_id: 'bad', score: 10 },
          // The forced acknowledgements, keyed as the palette asks — nothing about
          // pressing them can be wrong, so they are keyed high.
          { node_id: 'beat1', choice_id: 'ok1', score: 100 },
          { node_id: 'beat2', choice_id: 'ok2', score: 100 },
        ],
      },
    )
    const walk = (firstChoice: string) => ({
      path: [
        { node_id: 'd1', choice_id: firstChoice },
        { node_id: 'beat1', choice_id: 'ok1' },
        { node_id: 'beat2', choice_id: 'ok2' },
      ],
    })

    it('earn no credit: the worst decision no longer averages up to a pass', () => {
      // Was mean(10, 100, 100) = 70 = the default pass_threshold, with the only real
      // decision in the lesson made wrong. Now it is the decision itself.
      expect(grade(branching, walk('bad')).score).toBe(10)
    })

    it('cost nothing either: the intended best path is still exactly 100', () => {
      expect(grade(branching, walk('good')).score).toBe(100)
    })

    it('are not marked as the "best choice" in the reveal', () => {
      expect(grade(branching, walk('bad')).reveal).toEqual({ best: { d1: 'good' } })
    })

    it('still grade a decision-free story so it stays winnable (never unwinnable)', () => {
      const linear = seg(
        'story_branch',
        {
          start_node: 'b1',
          nodes: [
            { id: 'b1', text_md: 'Uno', choices: [{ id: 'ok1', text_md: 'Sigue', next: 'b2' }] },
            { id: 'b2', text_md: 'Dos', choices: [{ id: 'ok2', text_md: 'Fin', next: null }] },
          ],
        },
        {
          qualities: [
            { node_id: 'b1', choice_id: 'ok1', score: 100 },
            { node_id: 'b2', choice_id: 'ok2', score: 100 },
          ],
        },
      )
      const out = grade(linear, {
        path: [
          { node_id: 'b1', choice_id: 'ok1' },
          { node_id: 'b2', choice_id: 'ok2' },
        ],
      })
      expect(out.score).toBe(100)
    })
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

  // OD-28 (owner review L-01, MN-02): the timer stays, but running out of
  // time never costs points. Full and partial answers score the same either way.
  it('overtime never reduces the score', () => {
    const full: [string, string][] = [
      ['l1', 'r1'],
      ['l2', 'r2'],
      ['l3', 'r3'],
      ['l4', 'r4'],
    ]
    expect(grade(segment, { pairs: full, overtime: true }).score).toBe(100)
    const partial: [string, string][] = [
      ['l1', 'r1'],
      ['l2', 'r3'],
      ['l3', 'r3'],
    ]
    expect(grade(segment, { pairs: partial, overtime: true }).score).toBe(
      grade(segment, { pairs: partial, overtime: false }).score,
    )
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

  /*
   * WHY THIS EXPECTATION CHANGED (reveal_leaks_internals, 2026-07-25): this test used
   * to assert `reveal` === { qualities: { a: 60, b: 90 } }, i.e. it LOCKED IN the leak.
   * The widget printed those raw answer-key numbers under each card ("Value: 0" /
   * "Value: 100" — live content ships exactly that pair): an internal grading scale
   * that means nothing to a 6–13yo, on the one type whose whole point is that both
   * sides can be worth choosing. The grader now emits only WHICH side the author rated
   * higher, so the numbers never leave the server. Scoring is untouched (the score
   * assertions above still hold), so nothing a child answered correctly changed.
   */
  it('reveals which side the author rated higher — never the raw quality numbers', () => {
    const out = grade(segment, { choice: 'a' })
    expect(out.reveal).toEqual({ better_side: 'b' })
    expect(JSON.stringify(out.reveal)).not.toContain('60')
    expect(JSON.stringify(out.reveal)).not.toContain('90')
  })

  it('a genuine dilemma (tied qualities) reveals no better side at all', () => {
    const tie = seg(
      'would_you_rather',
      { a: { text_md: 'x' }, b: { text_md: 'y' } },
      { qualities: { a: 100, b: 100 }, reveal_md: 'Las dos valen.' },
    )
    expect(grade(tie, { choice: 'a' }).reveal).toEqual({ better_side: null })
    expect(grade(tie, { choice: 'a' }).score).toBe(100)
    expect(grade(tie, { choice: 'b' }).score).toBe(100)
  })

  it('rescales 0–1 quality maps to 0–100 (Forge scale drift)', () => {
    const zeroToOne = seg(
      'would_you_rather',
      { a: { text_md: 'x' }, b: { text_md: 'y' } },
      { qualities: { a: 1, b: 0.3 } },
    )
    expect(grade(zeroToOne, { choice: 'a' }).score).toBe(100)
    expect(grade(zeroToOne, { choice: 'b' }).score).toBe(30)
  })

  it('an all-zero map is a free-choice reflection: any valid pick passes', () => {
    const degenerate = seg(
      'would_you_rather',
      { a: { text_md: 'x' }, b: { text_md: 'y' } },
      { qualities: { a: 0, b: 0 } },
    )
    expect(grade(degenerate, { choice: 'a' }).score).toBe(100)
    expect(grade(degenerate, { choice: 'b' }).score).toBe(100)
  })

  it('malformed answers score 0 without throwing', () => {
    expectMalformedSafe(segment, { choice: 'a' })
    expect(grade(segment, { choice: 'c' }).score).toBe(0)
    expect(grade(segment, { choice: 1 }).score).toBe(0)
  })
})

// ---- quality-scale normalization (best_decision / story_branch parity) -------------

describe('quality-scale normalization', () => {
  it('story_branch rescales a 0–1 quality map', () => {
    const s = seg(
      'story_branch',
      { start_node: 'n1', nodes: [] },
      {
        qualities: [
          { node_id: 'n1', choice_id: 'a', score: 1 },
          { node_id: 'n1', choice_id: 'b', score: 0.2 },
        ],
      },
    )
    expect(grade(s, { path: [{ node_id: 'n1', choice_id: 'a' }] }).score).toBe(100)
    expect(grade(s, { path: [{ node_id: 'n1', choice_id: 'b' }] }).score).toBe(20)
  })

  it('dialogue_choice rescales a 0–1 quality map', () => {
    const s = seg(
      'dialogue_choice',
      { persona: { character: 'zara', role_md: 'x' }, opening_md: 'x', turns: [] },
      { turns: [{ turn_id: 't1', qualities: { r1: 1, r2: 0.4 } }] },
    )
    expect(grade(s, { replies: [{ turn_id: 't1', reply_id: 'r1' }] }).score).toBe(100)
    expect(grade(s, { replies: [{ turn_id: 't1', reply_id: 'r2' }] }).score).toBe(40)
  })
})
