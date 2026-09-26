// Lesson session state machine — LESSON_ENGINE.md §7. Pure reducer, unit-tested.

import type { LessonDocument, SegmentBase, Verdict } from './types'

export type SessionPhase = 'intro' | 'playing' | 'results'
export type StepPhase = 'answer' | 'checking' | 'feedback'

export interface SegmentState {
  attempts: number
  hintsShown: number
  /** Best penalized score so far — retries can only improve (P3). */
  best: number
  done: boolean
  verdict: Verdict | null
  /** true = correct on attempt 1; false = completed without first-try correct. */
  firstTry: boolean | null
  /** Times "Intentar de nuevo" was pressed — drives a clean remount of the exercise component so timers/boards/keypads reset and stale drafts don't co-submit. */
  retries: number
  selfMark?: 'got_it' | 'review'
}

export interface SessionState {
  phase: SessionPhase
  stepPhase: StepPhase
  index: number
  seg: Record<string, SegmentState>
  streak: number
  bestStreak: number
  outcome: 'passed' | 'failed' | null
}

export type SessionAction =
  | { type: 'BEGIN' }
  | { type: 'SUBMIT' }
  | { type: 'VERDICT'; segmentId: string; verdict: Verdict }
  | { type: 'GRADE_FAILED' }
  | { type: 'RETRY' }
  | { type: 'NEXT' }
  | { type: 'HINT'; segmentId: string }
  | { type: 'CONTENT_DONE'; segmentId: string; selfMark?: 'got_it' | 'review' }

const EMPTY_SEG: SegmentState = {
  attempts: 0,
  hintsShown: 0,
  best: 0,
  done: false,
  verdict: null,
  firstTry: null,
  retries: 0,
}

export function isGraded(segment: SegmentBase): boolean {
  return segment.xp > 0
}

export function initialSession(_doc: LessonDocument): SessionState {
  return {
    phase: 'intro',
    stepPhase: 'answer',
    index: 0,
    seg: {},
    streak: 0,
    bestStreak: 0,
    // OD-1 and B.26 (S05.3f): no lives. A wrong answer never spends anything
    // and never ends a lesson early; the legacy `scoring.hearts` field of a
    // migrated document (OD-9) is ignored, never read.
    outcome: null,
  }
}

function segState(state: SessionState, id: string): SegmentState {
  return state.seg[id] ?? EMPTY_SEG
}

export function createSessionReducer(doc: LessonDocument) {
  const { pass_threshold, max_attempts } = doc.scoring

  function finish(state: SessionState): SessionState {
    const score = lessonScore(doc, state)
    return {
      ...state,
      phase: 'results',
      outcome: score >= pass_threshold ? 'passed' : 'failed',
    }
  }

  return function reducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
      case 'BEGIN':
        return state.phase === 'intro' ? { ...state, phase: 'playing', stepPhase: 'answer' } : state

      case 'SUBMIT':
        return state.stepPhase === 'answer' ? { ...state, stepPhase: 'checking' } : state

      case 'GRADE_FAILED':
        // Grader unavailable: stay answerable, never punish the kid for our outage.
        return state.stepPhase === 'checking' ? { ...state, stepPhase: 'answer' } : state

      case 'VERDICT': {
        const prev = segState(state, action.segmentId)
        const attempts = prev.attempts + 1
        // The server already applied the hint penalty (0012) — verdict.score is
        // the authoritative penalized score; the client never re-penalizes.
        const best = Math.max(prev.best, action.verdict.score)
        const outOfAttempts = attempts >= max_attempts
        const done = action.verdict.score >= 100 || !action.verdict.allowRetry || outOfAttempts
        const firstTryCorrect = attempts === 1 && action.verdict.correct

        let streak = state.streak
        if (firstTryCorrect) streak = state.streak + 1
        else if (done && !action.verdict.correct) streak = 0

        return {
          ...state,
          stepPhase: 'feedback',
          streak,
          bestStreak: Math.max(state.bestStreak, streak),
          seg: {
            ...state.seg,
            [action.segmentId]: {
              ...prev,
              attempts,
              best,
              done,
              verdict: action.verdict,
              firstTry: prev.firstTry ?? (firstTryCorrect ? true : done ? false : null),
            },
          },
        }
      }

      case 'RETRY': {
        if (state.stepPhase !== 'feedback') return state
        const current = doc.segments[state.index]
        if (!current) return state
        const s = segState(state, current.id)
        if (s.done) return state
        // Bump retries so the player remounts the exercise (fresh timer/board/
        // keypad) and clears the previous draft — no stale co-submit (P3/E2).
        // Also clear the stale verdict: several exercises (memory_flip, number_line,
        // speed_tap, flash_match, lightning_round) gate interaction on `verdict`
        // being null, so a leftover verdict from the failed attempt left the
        // remounted component born disabled — no click could ever land.
        return {
          ...state,
          stepPhase: 'answer',
          seg: { ...state.seg, [current.id]: { ...s, retries: s.retries + 1, verdict: null } },
        }
      }

      case 'HINT': {
        const prev = segState(state, action.segmentId)
        const limit = doc.segments.find((s) => s.id === action.segmentId)?.hints?.length ?? 0
        if (prev.hintsShown >= limit) return state
        return {
          ...state,
          seg: { ...state.seg, [action.segmentId]: { ...prev, hintsShown: prev.hintsShown + 1 } },
        }
      }

      case 'CONTENT_DONE': {
        const prev = segState(state, action.segmentId)
        return {
          ...state,
          seg: {
            ...state.seg,
            [action.segmentId]: { ...prev, done: true, selfMark: action.selfMark },
          },
        }
      }

      case 'NEXT': {
        if (state.phase !== 'playing') return state
        const nextIndex = state.index + 1
        if (nextIndex >= doc.segments.length) return finish(state)
        return { ...state, index: nextIndex, stepPhase: 'answer' }
      }

      default:
        return state
    }
  }
}

// ---- Selectors ----------------------------------------------------------------

export function lessonScore(doc: LessonDocument, state: SessionState): number {
  const graded = doc.segments.filter(isGraded)
  const totalXp = graded.reduce((acc, s) => acc + s.xp, 0)
  if (totalXp === 0) return 100
  const weighted = graded.reduce((acc, s) => acc + (segScore(state, s.id) / 100) * s.xp, 0)
  return Math.round((weighted / totalXp) * 100)
}

export function earnedXp(doc: LessonDocument, state: SessionState): number {
  return Math.round(
    doc.segments
      .filter(isGraded)
      .reduce((acc, s) => acc + (segScore(state, s.id) / 100) * s.xp, 0),
  )
}

export function progressPct(doc: LessonDocument, state: SessionState): number {
  if (doc.segments.length === 0) return 0
  const done = state.phase === 'results' ? doc.segments.length : state.index
  return Math.round((done / doc.segments.length) * 100)
}

function segScore(state: SessionState, id: string): number {
  return state.seg[id]?.best ?? 0
}
