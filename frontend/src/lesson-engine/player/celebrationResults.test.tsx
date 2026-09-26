import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import type { LessonDocument } from '../core/types'
import { initialSession } from '../core/session'
import { ResultsScreen } from './LessonPlayer'
import type { ServerCompletion } from './completion'
import { playSfx } from './sfx'

/*
 * B.20 / OD-7 and B.23 (S05.3g) on the live results screen. The lane review
 * found the fanfare and the cast's `celebrate` action firing on the client's
 * own `passed`, before Core answered, in previews, and for every register.
 * A completed lesson IS a milestone, so it may celebrate, but only when Core
 * named `lesson-complete` and only in a register whose result shows the medal.
 */

const actions: string[] = []
vi.mock('@/lib/insights', async () => ({ ...(await vi.importActual<typeof import('@/lib/insights')>('@/lib/insights')), trackInsight: vi.fn() }))
vi.mock('@/components/characters/control/CharacterActor3D', () => ({
  default: ({ action }: { action: string }) => { actions.push(action); return null },
}))
vi.mock('./sfx', () => ({ playSfx: vi.fn(), playLessonBgm: vi.fn(), stopLessonBgm: vi.fn() }))

const doc: LessonDocument = {
  schema_version: 1,
  meta: { slug: 'l1', title: 'Lesson One', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: [], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [],
}

const completion = (extra: Partial<ServerCompletion>): ServerCompletion => ({
  score: 90, passed: true, best_score: 90, xp_earned: 20, xp_delta: 20, streak_days: 2, longest_streak: 2, streak_extended: false,
  first_today: false, minutes_learned: 10, lessons_completed: 1, next_lesson_id: null, ...extra,
})

const fanfares = () => vi.mocked(playSfx).mock.calls.filter(([name]) => name === 'celebration').length

function show(server: ServerCompletion | null, register?: 'young' | 'transition' | 'teen' | 'adult') {
  return render(<ResultsScreen doc={doc} state={initialSession(doc)} server={server} secondsSpent={60} pendingSave={server === null} onExit={() => {}} lessonId="lesson-1" register={register} />)
}

beforeEach(async () => {
  actions.length = 0
  vi.mocked(playSfx).mockClear()
  await i18n.changeLanguage('en-US')
})

describe('live results: the completed-lesson milestone is decided by Core and the register', () => {
  it('celebrates once when Core named lesson-complete, for a young learner', () => {
    const { rerender } = show(completion({ celebrations: ['lesson-complete'] }), 'young')
    rerender(<ResultsScreen doc={doc} state={initialSession(doc)} server={completion({ celebrations: ['lesson-complete'] })} secondsSpent={60} pendingSave={false} onExit={() => {}} lessonId="lesson-1" register="young" />)
    expect(fanfares()).toBe(1)
    expect(actions.at(-1)).toBe('celebrate')
  })

  it('celebrates nothing before Core answers, for an older Core without the list, or for a failed run', () => {
    show(null)
    show(completion({}))
    show(completion({ passed: false, celebrations: [] }))
    expect(fanfares()).toBe(0)
    expect(actions).not.toContain('celebrate')
  })

  it('never takes a name the closed list does not hold', () => {
    show(completion({ celebrations: ['correct-answer', 'streak-8'] }))
    expect(fanfares()).toBe(0)
    expect(actions).not.toContain('celebrate')
  })

  it('presents a teen or adult result as data: the cast nods, no fanfare', () => {
    show(completion({ celebrations: ['lesson-complete'] }), 'teen')
    show(completion({ celebrations: ['lesson-complete'] }), 'adult')
    expect(fanfares()).toBe(0)
    expect(actions).not.toContain('celebrate')
    expect(actions).toContain('nod')
  })
})
