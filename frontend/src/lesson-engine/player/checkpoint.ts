import { z } from 'zod'
import type { SessionState } from '../core/session'

const PREFIX = 'lf.lesson.checkpoint.v1:'
const count = z.number().int().nonnegative()
const verdict = z.object({
  correct: z.boolean(), score: z.number().min(0).max(100),
  tier: z.enum(['perfect', 'great', 'almost', 'tryAgain']),
  feedback_md: z.string().optional(), reveal: z.unknown().optional(), allowRetry: z.boolean(),
})
const session = z.object({
  phase: z.enum(['intro', 'playing', 'results']), stepPhase: z.enum(['answer', 'checking', 'feedback']),
  index: count, streak: count, bestStreak: count, hearts: count.nullable(),
  outcome: z.enum(['passed', 'failed']).nullable(),
  seg: z.record(z.string(), z.object({
    attempts: count, hintsShown: count, best: z.number().min(0).max(100), done: z.boolean(),
    verdict: verdict.nullable(), firstTry: z.boolean().nullable(), retries: count,
    selfMark: z.enum(['got_it', 'review']).optional(),
  })),
})
const schema = z.object({
  runId: z.uuid(), document: z.string().nullable(), elapsedMs: z.number().nonnegative(),
  state: session.nullable(),
  completion: z.object({ seconds_spent: z.number().int().min(1).max(7200), run_id: z.uuid(), local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable(),
})
export interface LessonCheckpoint {
  runId: string
  document: string | null
  elapsedMs: number
  state: SessionState | null
  completion: { seconds_spent: number; run_id: string; local_date: string } | null
}

export function newCheckpoint(): LessonCheckpoint {
  return { runId: crypto.randomUUID(), document: null, elapsedMs: 0, state: null, completion: null }
}

export function checkpointKey(userId: string, lessonId: string): string {
  return PREFIX + encodeURIComponent(userId) + ':' + encodeURIComponent(lessonId)
}

/** Tab-local recovery only. Never store tokens, draft answers or child identity fields. */
export function readCheckpoint(key: string): LessonCheckpoint {
  try {
    const parsed = schema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? 'null'))
    if (parsed.success && (!parsed.data.completion || parsed.data.completion.run_id === parsed.data.runId)) {
      const value = parsed.data
      // An interrupted request cannot remain in a permanent spinner after reload.
      if (value.state?.stepPhase === 'checking') value.state.stepPhase = 'answer'
      return value
    }
  } catch { /* Storage may be disabled; the current in-memory run still works. */ }
  return newCheckpoint()
}

export function writeCheckpoint(key: string, value: LessonCheckpoint): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* Best-effort tab recovery. */ }
}

export function removeCheckpoint(key: string): void {
  try { sessionStorage.removeItem(key) } catch { /* Storage may be disabled. */ }
}

/** Called on identity changes so a shared device cannot expose a previous learner's feedback. */
export function clearLessonCheckpoints(): void {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key)
  } catch { /* Storage may be disabled. */ }
}
