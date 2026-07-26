import { describe, expect, it } from 'vitest'
import { glowsAndGrows } from './glowsGrows'
import { initialSession, type SessionState } from './session'
import type { LessonDocument } from './types'

/*
 * Each test pins one honesty rule: praise must be true by construction, and
 * the quest framing must never contradict the praise.
 */

function doc(segments: Array<{ id: string; type: string; xp: number }>): LessonDocument {
  return {
    schema_version: 1,
    meta: { slug: 'gg', title: 'GG', locale: 'es-MX', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments: segments.map((s) => ({ ...s, prompt_md: 'p', difficulty: 1, payload: {} })),
  } as unknown as LessonDocument
}

function played(
  base: LessonDocument,
  seg: Record<string, { best: number; firstTry?: boolean; attempts?: number }>,
): SessionState {
  const state = initialSession(base)
  return {
    ...state,
    seg: Object.fromEntries(
      Object.entries(seg).map(([id, s]) => [
        id,
        { attempts: s.attempts ?? 1, hintsShown: 0, best: s.best, done: true, verdict: null, firstTry: s.firstTry ?? s.best >= 100, retries: 0 },
      ]),
    ),
  }
}

describe('glowsAndGrows', () => {
  it('returns null for an all-content lesson (nothing graded was attempted)', () => {
    const d = doc([{ id: 's1', type: 'story_scene', xp: 0 }])
    expect(glowsAndGrows(d, initialSession(d))).toBeNull()
  })

  it('glow = strongest family, grow = weakest family framed as quest', () => {
    const d = doc([
      { id: 'a', type: 'quiz_mcq', xp: 10 }, // choice
      { id: 'b', type: 'coin_count', xp: 10 }, // money
    ])
    const result = glowsAndGrows(d, played(d, { a: { best: 100 }, b: { best: 40 } }))
    expect(result).toEqual({ glow: { kind: 'family', family: 'choice' }, grow: { kind: 'family', family: 'money' } })
  })

  it('a perfect run earns the "mastered" grow, never a fake quest', () => {
    const d = doc([
      { id: 'a', type: 'quiz_mcq', xp: 10 },
      { id: 'b', type: 'coin_count', xp: 10 },
    ])
    const result = glowsAndGrows(d, played(d, { a: { best: 100 }, b: { best: 90 } }))
    expect(result?.grow).toEqual({ kind: 'mastered' })
  })

  it('a rough run (best family under 70) celebrates EFFORT instead of inventing a strength', () => {
    const d = doc([
      { id: 'a', type: 'quiz_mcq', xp: 10 },
      { id: 'b', type: 'coin_count', xp: 10 },
    ])
    const result = glowsAndGrows(d, played(d, { a: { best: 50 }, b: { best: 30 } }))
    expect(result?.glow).toEqual({ kind: 'effort' })
    expect(result?.grow).toEqual({ kind: 'family', family: 'money' })
  })

  it('one mid-range family shows the glow only — naming it as both strength and quest contradicts itself', () => {
    const d = doc([{ id: 'a', type: 'quiz_mcq', xp: 10 }])
    const result = glowsAndGrows(d, played(d, { a: { best: 75 } }))
    expect(result).toEqual({ glow: { kind: 'family', family: 'choice' }, grow: null })
  })

  it('unattempted graded segments are excluded (a heart-out early exit does not zero unseen families)', () => {
    const d = doc([
      { id: 'a', type: 'quiz_mcq', xp: 10 },
      { id: 'b', type: 'coin_count', xp: 10 }, // never reached
    ])
    const result = glowsAndGrows(d, played(d, { a: { best: 100 } }))
    // money never counts against the kid; the one perfect family earns "mastered".
    expect(result).toEqual({ glow: { kind: 'family', family: 'choice' }, grow: { kind: 'mastered' } })
  })

  it('first-try rate breaks average ties for the glow', () => {
    const d = doc([
      { id: 'a', type: 'quiz_mcq', xp: 10 },
      { id: 'b', type: 'coin_count', xp: 10 },
    ])
    const result = glowsAndGrows(
      d,
      played(d, { a: { best: 90, firstTry: false, attempts: 2 }, b: { best: 90, firstTry: true } }),
    )
    expect(result?.glow).toEqual({ kind: 'family', family: 'money' })
  })
})
