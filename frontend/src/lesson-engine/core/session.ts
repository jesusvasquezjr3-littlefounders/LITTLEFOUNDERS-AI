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
  hearts: number | null
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

export function initialSession(doc: LessonDocument): SessionState {
  return {
    phase: 'intro',
    stepPhase: 'answer',
    index: 0,
    seg: {},
    streak: 0,
    bestStreak: 0,
    hearts: doc.scoring.hearts,
    outcome: null,
  }
}

function segState(state: SessionState, id: string): SegmentState {
  return state.seg[id] ?? EMPTY_SEG
}

export function createSessionReducer(doc: LessonDocument) {
  const { pass_threshold, hint_penalty_pct, max_attempts } = doc.scoring

  function finish(state: SessionState): SessionState {
    const score = lessonScore(doc, state)
    return {
      ...state,
      phase: 'results',
      outcome: state.hearts === 0 ? 'failed' : score >= pass_threshold ? 'passed' : 'failed',
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
        const penalty = Math.pow(1 - hint_penalty_pct / 100, prev.hintsShown)
        const penalized = Math.max(0, Math.min(100, Math.round(action.verdict.score * penalty)))
        const best = Math.max(prev.best, penalized)
        const outOfAttempts = attempts >= max_attempts
        const done = action.verdict.score >= 100 || !action.verdict.allowRetry || outOfAttempts
        const firstTryCorrect = attempts === 1 && action.verdict.correct

        let streak = state.streak
        if (firstTryCorrect) streak = state.streak + 1
        else if (done && !action.verdict.correct) streak = 0

        let hearts = state.hearts
        if (hearts !== null && done && !action.verdict.correct) hearts = Math.max(0, hearts - 1)

        return {
          ...state,
          stepPhase: 'feedback',
          streak,
          bestStreak: Math.max(state.bestStreak, streak),
          hearts,
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
        return {
          ...state,
          stepPhase: 'answer',
          seg: { ...state.seg, [current.id]: { ...s, retries: s.retries + 1 } },
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
        if (state.hearts === 0) return finish(state)
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
