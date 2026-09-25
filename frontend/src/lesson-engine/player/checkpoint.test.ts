import { beforeEach, describe, expect, it } from 'vitest'
import { checkpointKey, clearLessonCheckpoints, newCheckpoint, readCheckpoint, removeCheckpoint, writeCheckpoint } from './checkpoint'

beforeEach(() => sessionStorage.clear())

describe('tab-local lesson recovery', () => {
  it('isolates learners and lessons and removes feedback at identity changes', () => {
    const first = checkpointKey('learner-a', 'lesson-a')
    const value = newCheckpoint()
    writeCheckpoint(first, value)
    expect(readCheckpoint(first).runId).toBe(value.runId)
    expect(readCheckpoint(checkpointKey('learner-b', 'lesson-a')).runId).not.toBe(value.runId)
    expect(readCheckpoint(checkpointKey('learner-a', 'lesson-b')).runId).not.toBe(value.runId)
    sessionStorage.setItem('unrelated', 'preserved')
    clearLessonCheckpoints()
    expect(sessionStorage.getItem(first)).toBeNull()
    expect(sessionStorage.getItem('unrelated')).toBe('preserved')
  })

  it('restores completed segments and preserves the exact pending completion payload', () => {
    const key = checkpointKey('learner', 'lesson')
    const value = newCheckpoint()
    value.completion = { run_id: value.runId, seconds_spent: 42, local_date: '2026-09-16' }
    value.state = { phase: 'results', stepPhase: 'feedback', index: 1, streak: 1, bestStreak: 1, outcome: 'passed', seg: {
      exercise: { attempts: 1, hintsShown: 0, best: 100, done: true, firstTry: true, retries: 0, verdict: { correct: true, score: 100, tier: 'perfect', allowRetry: false } },
    } }
    writeCheckpoint(key, value)
    expect(readCheckpoint(key)).toEqual(value)
    removeCheckpoint(key)
    expect(readCheckpoint(key).runId).not.toBe(value.runId)
  })

  it('rejects corrupted shapes and mismatched run receipts', () => {
    const key = checkpointKey('learner', 'lesson')
    for (const value of ['{', 'null', '{"state":{"index":-1}}']) {
      sessionStorage.setItem(key, value)
      expect(readCheckpoint(key).state).toBeNull()
    }
    const value = newCheckpoint()
    value.completion = { run_id: crypto.randomUUID(), seconds_spent: 42, local_date: '2026-09-16' }
    writeCheckpoint(key, value)
    expect(readCheckpoint(key).runId).not.toBe(value.runId)
  })
})
