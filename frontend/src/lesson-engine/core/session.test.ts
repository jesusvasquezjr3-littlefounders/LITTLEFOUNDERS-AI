import { describe, expect, it } from 'vitest'
import type { LessonDocument, Verdict } from './types'
import { verdictFrom } from './types'
import {
  createSessionReducer,
  earnedXp,
  initialSession,
  lessonScore,
  progressPct,
  type SessionState,
} from './session'

function doc(overrides?: Partial<LessonDocument['scoring']>): LessonDocument {
  return {
    schema_version: 1,
    meta: {
      slug: 'test',
      title: 'Test',
      locale: 'es-MX',
      subject: 'money',
      estimated_minutes: 5,
      objectives: ['x'],
      cast: ['dina'],
    },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null, ...overrides },
    segments: [
      { id: 's1', type: 'story_scene', prompt_md: 'intro', difficulty: 1, xp: 0, payload: {} },
      { id: 'e1', type: 'quiz_mcq', prompt_md: 'q1', difficulty: 1, xp: 10, payload: {} },
      { id: 'e2', type: 'quiz_mcq', prompt_md: 'q2', difficulty: 1, xp: 30, payload: {} },
    ],
  }
}

function v(score: number): Verdict {
  return verdictFrom(score, 70)
}

function play(d: LessonDocument, actions: Parameters<ReturnType<typeof createSessionReducer>>[1][]): SessionState {
  const reducer = createSessionReducer(d)
  return actions.reduce(reducer, initialSession(d))
}

describe('session reducer (LESSON_ENGINE.md §7)', () => {
  it('walks intro → playing → results and computes XP-weighted score', () => {
    const d = doc()
    const state = play(d, [
      { type: 'BEGIN' },
      { type: 'CONTENT_DONE', segmentId: 's1' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(100) },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e2', verdict: v(0) },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e2', verdict: v(100) },
      { type: 'NEXT' },
    ])
    expect(state.phase).toBe('results')
    expect(lessonScore(d, state)).toBe(100)
    expect(earnedXp(d, state)).toBe(40)
    expect(state.outcome).toBe('passed')
  })

  it('retries can only improve; streak counts first-try correct only', () => {
    const d = doc()
    const state = play(d, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(100) }, // first-try → streak 1
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e2', verdict: v(50) },
      { type: 'RETRY' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e2', verdict: v(30) }, // worse retry
    ])
    expect(state.seg.e2?.best).toBe(50) // never lowered
    expect(state.streak).toBe(0) // done without correct → reset
    expect(state.bestStreak).toBe(1)
  })

  it('RETRY bumps the per-segment retry counter (drives a clean remount)', () => {
    const d = doc()
    const afterRetry = play(d, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(50) },
      { type: 'RETRY' },
    ])
    expect(afterRetry.seg.e1?.retries).toBe(1)
    expect(afterRetry.stepPhase).toBe('answer')
    // A done segment (perfect) can't be retried → counter stays 0.
    const afterPerfect = play(d, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(100) },
      { type: 'RETRY' },
    ])
    expect(afterPerfect.seg.e1?.retries).toBe(0)
  })

  it('caps hints at the segment count and stores the server score verbatim (no client re-penalty)', () => {
    const d = doc()
    const withHints: LessonDocument = {
      ...d,
      segments: d.segments.map((s) => (s.id === 'e1' ? { ...s, hints: ['h1', 'h2'] } : s)),
    }
    const state = play(withHints, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'HINT', segmentId: 'e1' },
      { type: 'HINT', segmentId: 'e1' },
      { type: 'HINT', segmentId: 'e1' }, // beyond limit → ignored
      { type: 'SUBMIT' },
      // The server already applied the hint penalty (0012) and sends the
      // penalized score as the verdict; the reducer stores it verbatim.
      { type: 'VERDICT', segmentId: 'e1', verdict: v(81) },
    ])
    expect(state.seg.e1?.hintsShown).toBe(2) // capped at the segment's hint count
    expect(state.seg.e1?.best).toBe(81) // no client-side re-penalization
  })

  it('cheer mode (hearts null) never fails mid-lesson', () => {
    const d = doc()
    const state = play(d, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(0) },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(0) },
      { type: 'NEXT' },
    ])
    expect(state.phase).toBe('playing')
    expect(state.hearts).toBeNull()
  })

  it('arcade mode: exhausted wrong segments cost hearts; 0 hearts ends at results', () => {
    const d = doc({ hearts: 1, max_attempts: 1 })
    const state = play(d, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'VERDICT', segmentId: 'e1', verdict: v(0) }, // heart 1 → 0
      { type: 'NEXT' },
    ])
    expect(state.hearts).toBe(0)
    expect(state.phase).toBe('results')
    expect(state.outcome).toBe('failed')
  })

  it('grade failure returns to answer without consuming an attempt', () => {
    const d = doc()
    const state = play(d, [
      { type: 'BEGIN' },
      { type: 'NEXT' },
      { type: 'SUBMIT' },
      { type: 'GRADE_FAILED' },
    ])
    expect(state.stepPhase).toBe('answer')
    expect(state.seg.e1?.attempts ?? 0).toBe(0)
  })

  it('progressPct advances with the index', () => {
    const d = doc()
    const s0 = play(d, [{ type: 'BEGIN' }])
    expect(progressPct(d, s0)).toBe(0)
    const s1 = play(d, [{ type: 'BEGIN' }, { type: 'NEXT' }])
    expect(progressPct(d, s1)).toBe(33)
  })
})
