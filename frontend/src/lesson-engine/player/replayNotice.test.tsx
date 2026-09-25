import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { trackInsight } from '@/lib/insights'
import type { LessonDocument } from '../core/types'
import { initialSession } from '../core/session'
import { ResultsScreen } from './LessonPlayer'
import type { ServerCompletion } from './completion'

vi.mock('@/lib/insights', async () => ({ ...(await vi.importActual<typeof import('@/lib/insights')>('@/lib/insights')), trackInsight: vi.fn() }))
vi.mock('@/components/characters/control/CharacterActor3D', () => ({ default: () => null }))
vi.mock('./sfx', () => ({ playSfx: vi.fn(), playLessonBgm: vi.fn(), stopLessonBgm: vi.fn() }))

/*
 * B.5 (S05.3d) on the live results screen: when Core's completion receipt says
 * this run scored below the kept best, the screen states that the saved best
 * is unaffected and reports that it showed it (the numerator of Appendix C's
 * replay-notice display rate). A preview never reports.
 */

const doc: LessonDocument = {
  schema_version: 1,
  meta: { slug: 'l1', title: 'Lesson One', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: [], cast: [] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [],
}

const server = (replay: ServerCompletion['replay']): ServerCompletion => ({
  score: 40, passed: true, best_score: 90, xp_earned: 20, xp_delta: 0, streak_days: 2, longest_streak: 2, streak_extended: false,
  first_today: false, minutes_learned: 10, lessons_completed: 1, next_lesson_id: null, replay,
})

beforeEach(async () => {
  vi.mocked(trackInsight).mockClear()
  await i18n.changeLanguage('en-US')
})

describe('B.5 replay notice on the live results screen', () => {
  it('states the kept best and reports the view once', () => {
    const kept = server({ kind: 'replay', previous_best_score: 90, best_score_kept: true, notice: 'best_kept', xp_policy: 'improvement_only' })
    const { rerender } = render(<ResultsScreen doc={doc} state={initialSession(doc)} server={kept} secondsSpent={60} pendingSave={false} onExit={() => {}} lessonId="lesson-1" />)
    expect(screen.getByText('Your saved best is still 90. This was practice.')).toBeInTheDocument()
    rerender(<ResultsScreen doc={doc} state={initialSession(doc)} server={kept} secondsSpent={60} pendingSave={false} onExit={() => {}} lessonId="lesson-1" />)
    expect(vi.mocked(trackInsight).mock.calls.filter(([event]) => event === 'replay_notice_view')).toEqual([
      ['replay_notice_view', { lessonId: 'lesson-1', routeClass: 'learn' }],
    ])
  })

  it('keeps the plain best chip without a notice, and never reports from a preview', () => {
    const { unmount } = render(<ResultsScreen doc={doc} state={initialSession(doc)} secondsSpent={60} pendingSave={false} onExit={() => {}} lessonId="lesson-1"
      server={server({ kind: 'first', previous_best_score: null, best_score_kept: false, notice: 'none', xp_policy: 'improvement_only' })} />)
    expect(screen.queryByText(/saved best/)).toBeNull()
    unmount()
    render(<ResultsScreen doc={doc} state={initialSession(doc)} secondsSpent={60} pendingSave={false} onExit={() => {}}
      server={server({ kind: 'replay', previous_best_score: 90, best_score_kept: true, notice: 'best_kept', xp_policy: 'improvement_only' })} />)
    expect(screen.getByText('Your saved best is still 90. This was practice.')).toBeInTheDocument()
    expect(vi.mocked(trackInsight).mock.calls.some(([event]) => event === 'replay_notice_view')).toBe(false)
  })
})
