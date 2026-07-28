// `maker` family — numeric grader tests (LESSON_ENGINE.md §6).

import { describe, expect, it } from 'vitest'
import type { SegmentBase } from '../../core/types'
import { makerGraders, simulateRobot } from './grade'

function seg(
  type: string,
  payload: Record<string, unknown>,
  answer?: Record<string, unknown>,
): SegmentBase {
  return { id: `t-${type}`, type, prompt_md: 'x', difficulty: 1, xp: 10, payload, ...(answer ? { answer } : {}) }
}

const grade = (s: SegmentBase, answer: unknown) => {
  const grader = makerGraders[s.type]
  if (!grader) throw new Error(`no grader for ${s.type}`)
  return grader(s, answer)
}

// ---- code_order ------------------------------------------------------------------

describe('code_order', () => {
  const segment = seg(
    'code_order',
    {
      blocks: [
        { id: 'b1', text_md: 'inicio' },
        { id: 'b2', text_md: 'repetir 4 veces:' },
        { id: 'b3', text_md: 'guardar(10)' },
        { id: 'b4', text_md: 'mostrar(total)' },
      ],
    },
    { order: ['b1', 'b2', 'b3', 'b4'] },
  )

  it('correct order → 100 and reveals the order', () => {
    const out = grade(segment, { order: ['b1', 'b2', 'b3', 'b4'] })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ order: ['b1', 'b2', 'b3', 'b4'] })
  })

  it('one adjacent swap → exact kendall value 83', () => {
    // 6 pairs, 1 discordant → 5/6 = 83.33 → 83
    expect(grade(segment, { order: ['b1', 'b3', 'b2', 'b4'] }).score).toBe(83)
  })

  it('fully reversed → 0', () => {
    expect(grade(segment, { order: ['b4', 'b3', 'b2', 'b1'] }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    expect(() => grade(segment, null)).not.toThrow()
    expect(grade(segment, null).score).toBe(0)
    expect(grade(segment, { order: 'b1' }).score).toBe(0)
    expect(grade(segment, { order: ['b1', 'b2'] }).score).toBe(0)
    expect(grade(seg('code_order', segment.payload), { order: ['b1', 'b2', 'b3', 'b4'] }).score).toBe(0)
  })
})

// ---- robot_path -------------------------------------------------------------------

describe('robot_path', () => {
  // 4×4, start bottom-left facing up, goal top-right, two walls.
  const payload = {
    grid: { w: 4, h: 4 },
    start: { x: 0, y: 3, dir: 'up' },
    goal: { x: 3, y: 0 },
    walls: [
      { x: 1, y: 2 },
      { x: 2, y: 1 },
    ],
    commands: ['forward', 'left', 'right'],
    max_commands: 10,
  }
  const segment = seg('robot_path', payload, {})
  const SOLUTION = ['forward', 'forward', 'forward', 'right', 'forward', 'forward', 'forward']

  it('program reaching the goal → 100 and reveals the goal', () => {
    const out = grade(segment, { commands: SOLUTION })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ goal: { x: 3, y: 0 } })
  })

  it('stopping one cell short (manhattan 1) → 40', () => {
    expect(grade(segment, { commands: SOLUTION.slice(0, -1) }).score).toBe(40)
  })

  it('far from the goal → 0', () => {
    expect(grade(segment, { commands: ['forward'] }).score).toBe(0)
  })

  it('wall blocks movement: the robot stays in place', () => {
    // up to (0,2), turn right, forward into wall (1,2) → blocked, stays at (0,2).
    const states = simulateRobot(
      { w: 4, h: 4, walls: payload.walls },
      { x: 0, y: 3, dir: 'up' },
      ['forward', 'right', 'forward'],
    )
    const final = states[states.length - 1]
    expect(final).toEqual({ x: 0, y: 2, dir: 'right', blocked: true })
    expect(grade(segment, { commands: ['forward', 'right', 'forward'] }).score).toBe(0)
  })

  it('grid border blocks movement: the robot stays in place', () => {
    const states = simulateRobot(
      { w: 4, h: 4, walls: [] },
      { x: 0, y: 3, dir: 'up' },
      ['left', 'forward'],
    )
    expect(states[states.length - 1]).toEqual({ x: 0, y: 3, dir: 'left', blocked: true })
  })

  it('commands beyond max_commands are ignored', () => {
    const short = seg('robot_path', { ...payload, max_commands: 5 }, {})
    // Sliced to 5: forward×3, right, forward → (1,0), manhattan 2 → 0.
    expect(grade(short, { commands: SOLUTION }).score).toBe(0)
  })

  it('malformed → 0, never throws', () => {
    expect(() => grade(segment, undefined)).not.toThrow()
    expect(grade(segment, undefined).score).toBe(0)
    expect(grade(segment, { commands: ['forward', 'jump'] }).score).toBe(0)
    expect(grade(segment, { commands: 'forward' }).score).toBe(0)
    expect(grade(seg('robot_path', { grid: { w: 4 } }, {}), { commands: ['forward'] }).score).toBe(0)
  })
})

// ---- debug_hunt -------------------------------------------------------------------

describe('debug_hunt', () => {
  const segment = seg(
    'debug_hunt',
    {
      intro_md: 'Encuentra el error.',
      blocks: [
        { id: 'b1', text_md: 'meta = 40' },
        { id: 'b2', text_md: 'cada semana:' },
        { id: 'b3', text_md: 'gastar(10)' },
        { id: 'b4', text_md: 'total = total + 10' },
        { id: 'b5', text_md: 'si total >= meta: celebrar()' },
      ],
    },
    { bug_ids: ['b3'], fix_md: 'Cambia `gastar(10)` por `guardar(10)`.' },
  )

  it('exact bug selection → 100 and reveals bug_ids + fix_md', () => {
    const out = grade(segment, { selected: ['b3'] })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({
      bug_ids: ['b3'],
      fix_md: 'Cambia `gastar(10)` por `guardar(10)`.',
    })
  })

  // EXPECTATIONS CHANGED (fairness fix): debug_hunt scored `decisionAccuracy`
  // ((TP+TN)/N), which paid for untapped innocent blocks — so at 8 blocks / 1 bug
  // tapping ONE arbitrary innocent block scored 75 and PASSED without finding the
  // bug. It now scores `signalDetection` (hitRate − 0.5·falseAlarmRate), so the
  // hit is load-bearing: found-the-bug answers get MORE credit than before (88 vs
  // 80 with one slip), missed-the-bug answers get 0 instead of a pass.
  it('found the bug + one false alarm over 5 blocks → 88 (was 80 under decisionAccuracy)', () => {
    // hitRate 1/1 = 1, falseAlarms 1 of 4 innocents → 1 − 0.5×0.25 = 0.875 → 88
    expect(grade(segment, { selected: ['b3', 'b4'] }).score).toBe(88)
  })

  it('missing the bug scores 0 however many innocent blocks were tapped (was 40)', () => {
    // hitRate 0 ⇒ no amount of true negatives can rescue the score.
    expect(grade(segment, { selected: ['b1', 'b2'] }).score).toBe(0)
    expect(grade(segment, { selected: ['b1'] }).score).toBe(0)
  })

  it('tapping EVERY block can never pass (50), and tapping one innocent block over 8 never does either', () => {
    expect(grade(segment, { selected: ['b1', 'b2', 'b3', 'b4', 'b5'] }).score).toBe(50)
    // The proven exploit: 8 blocks with a single bug. Under decisionAccuracy a
    // single arbitrary tap scored (8−2)/8 = 75 ≥ 70 with zero reasoning.
    const eight = seg(
      'debug_hunt',
      {
        intro_md: 'Encuentra el error.',
        blocks: Array.from({ length: 8 }, (_, i) => ({ id: `k${i + 1}`, text_md: `linea ${i + 1}` })),
      },
      { bug_ids: ['k7'] },
    )
    expect(grade(eight, { selected: ['k1'] }).score).toBe(0)
    expect(grade(eight, { selected: ['k7'] }).score).toBe(100)
  })

  it('with two bugs, finding only one fails (50) — the miss is the learning-critical element', () => {
    const two = seg(
      'debug_hunt',
      {
        intro_md: 'Encuentra los errores.',
        blocks: Array.from({ length: 6 }, (_, i) => ({ id: `k${i + 1}`, text_md: `linea ${i + 1}` })),
      },
      { bug_ids: ['k2', 'k5'] },
    )
    expect(grade(two, { selected: ['k2'] }).score).toBe(50)
    expect(grade(two, { selected: ['k2', 'k5'] }).score).toBe(100)
  })

  it('malformed → 0, never throws', () => {
    expect(() => grade(segment, 42)).not.toThrow()
    expect(grade(segment, 42).score).toBe(0)
    expect(grade(segment, { selected: [1, 2] }).score).toBe(0)
  })
})

// ---- balance_scale ----------------------------------------------------------------

describe('balance_scale', () => {
  const segment = seg(
    'balance_scale',
    {
      left_fixed: [{ label: 'Cofre', value: 12 }],
      weights: [
        { id: 'w5', label: '5', value: 5 },
        { id: 'w4', label: '4', value: 4 },
        { id: 'w3', label: '3', value: 3 },
        { id: 'w2', label: '2', value: 2 },
        { id: 'w1', label: '1', value: 1 },
      ],
    },
    {},
  )

  it('exact balance (5+4+3 = 12) → 100 and reveals the target', () => {
    const out = grade(segment, { placed: ['w5', 'w4', 'w3'] })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ target: 12 })
  })

  it('within the smallest weight (11 vs 12, smallest = 1) → 40', () => {
    expect(grade(segment, { placed: ['w5', 'w4', 'w2'] }).score).toBe(40)
  })

  it('off by more than the smallest weight → 0', () => {
    expect(grade(segment, { placed: ['w5', 'w4'] }).score).toBe(0)
  })

  it('unknown weight id → 0 (malformed), never throws', () => {
    expect(() => grade(segment, { placed: ['w9'] })).not.toThrow()
    expect(grade(segment, { placed: ['w9'] }).score).toBe(0)
    expect(grade(segment, { placed: 'w5' }).score).toBe(0)
    expect(grade(segment, null).score).toBe(0)
  })
})

// ---- measure_read -----------------------------------------------------------------

describe('measure_read', () => {
  const segment = seg(
    'measure_read',
    { instrument: 'thermometer', min: 0, max: 40, ticks: 9, unit: '°C', pointer_value: 25 },
    { value: 25, tolerance: 1 },
  )

  it('exact reading → 100 and reveals the value', () => {
    const out = grade(segment, { value: 25 })
    expect(out.score).toBe(100)
    expect(out.reveal).toEqual({ value: 25 })
  })

  it('within tolerance → 100; within 2× tolerance → 50; beyond → 0', () => {
    expect(grade(segment, { value: 25.9 }).score).toBe(100)
    expect(grade(segment, { value: 26.9 }).score).toBe(50)
    expect(grade(segment, { value: 30 }).score).toBe(0)
  })

  it('numeric strings from the NumberPad path are accepted', () => {
    expect(grade(segment, { value: '25' }).score).toBe(100)
  })

  it('malformed → 0, never throws', () => {
    expect(() => grade(segment, { value: 'veinticinco' })).not.toThrow()
    expect(grade(segment, { value: 'veinticinco' }).score).toBe(0)
    expect(grade(segment, {}).score).toBe(0)
    expect(grade(seg('measure_read', segment.payload), { value: 25 }).score).toBe(0)
  })
})

// ---- machine_io -------------------------------------------------------------------

describe('machine_io', () => {
  const numericSegment = seg(
    'machine_io',
    { examples: [{ in: 2, out: 5 }, { in: 3, out: 7 }], probe_in: 6 },
    { value: 13 },
  )
  const optionSegment = seg(
    'machine_io',
    {
      examples: [{ in: 2, out: 5 }, { in: 3, out: 7 }],
      probe_in: 6,
      options: [
        { id: 'o1', text_md: '12' },
        { id: 'o2', text_md: '13' },
        { id: 'o3', text_md: '14' },
      ],
    },
    { correct_option_id: 'o2' },
  )

  it('numeric variant: exact → 100, off by one → 0 (tolerance 0)', () => {
    expect(grade(numericSegment, { value: 13 }).score).toBe(100)
    expect(grade(numericSegment, { value: 12 }).score).toBe(0)
    expect(grade(numericSegment, { value: 13 }).reveal).toEqual({ value: 13 })
  })

  it('options variant: binary vs correct_option_id', () => {
    expect(grade(optionSegment, { option_id: 'o2' }).score).toBe(100)
    expect(grade(optionSegment, { option_id: 'o1' }).score).toBe(0)
    expect(grade(optionSegment, { option_id: 'o2' }).reveal).toEqual({ correct_option_id: 'o2' })
  })

  it('malformed → 0, never throws', () => {
    expect(() => grade(numericSegment, [])).not.toThrow()
    expect(grade(numericSegment, []).score).toBe(0)
    expect(grade(numericSegment, { value: 'trece' }).score).toBe(0)
    expect(grade(optionSegment, { value: 13 }).score).toBe(0)
    expect(grade(seg('machine_io', numericSegment.payload), { value: 13 }).score).toBe(0)
  })
})
