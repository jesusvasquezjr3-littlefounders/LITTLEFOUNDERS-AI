import type { Rhythm, RhythmState, StreakView } from './motivation';
import type { KidStreakState } from '../family/streakPause';

/*
 * S05.3e preview fixtures for the rebuilt rhythm (B.21, B.24), the guardian's
 * holiday pause and the milestone result. Shapes only: every real value comes
 * from Core. Used by rebuild.html and the real-Chrome matrix.
 */

export const streak = (over: Partial<StreakView>): StreakView => ({
  model: 'rest-days-v1', status: 'open', current: 4, best: 12, daysPracticed: 41, restDaysLeft: 1,
  lastActiveDate: '2026-09-22', pause: null, ...over,
});

const rhythm = (over: Partial<Rhythm> = {}): Rhythm => ({
  streak: streak({}),
  pace: { goal: 2, chosen: true, passedToday: 1, goalMet: false },
  mentor: { character: 'zara', chosen: true },
  levers: ['path', 'mentor', 'pace'],
  ...over,
});

export const rhythmPreviewStates: Record<string, RhythmState> = {
  open: { status: 'ready', rhythm: rhythm() },
  today: { status: 'ready', rhythm: rhythm({ streak: streak({ status: 'practiced_today', current: 7, restDaysLeft: 2, lastActiveDate: '2026-09-24' }),
    pace: { goal: 2, chosen: true, passedToday: 2, goalMet: true } }) },
  resting: { status: 'ready', rhythm: rhythm({ streak: streak({ status: 'resting', current: 0, restDaysLeft: 2, lastActiveDate: '2026-09-18' }),
    pace: { goal: 1, chosen: false, passedToday: 0, goalMet: false }, mentor: { character: 'rho', chosen: false } }) },
  paused: { status: 'ready', rhythm: rhythm({ streak: streak({ status: 'paused', pause: { startsOn: '2026-09-22', endsOn: '2026-10-03' } }) }) },
  none: { status: 'ready', rhythm: rhythm({ streak: streak({ status: 'none', current: 0, best: 0, daysPracticed: 0, restDaysLeft: 2, lastActiveDate: null }),
    pace: { goal: 1, chosen: false, passedToday: 0, goalMet: false }, mentor: { character: 'dina', chosen: false } }) },
  loading: { status: 'loading' },
  error: { status: 'error' },
};

export const streakPausePreviewStates: Record<string, KidStreakState> = {
  ready: { status: 'ready', streak: streak({}) },
  active: { status: 'ready', streak: streak({ status: 'paused', pause: { startsOn: '2026-09-22', endsOn: '2026-10-03' } }) },
  resting: { status: 'ready', streak: streak({ status: 'resting', current: 0 }) },
  loading: { status: 'loading' },
  error: { status: 'error' },
  'no-access': { status: 'no-access' },
};

/** A first completion on the seventh practised day that meets the learner's plan. */
export function milestoneReceipt(locale: 'en-US' | 'es-MX' | 'pt-BR') {
  const skill = { 'en-US': 'Saving toward a goal', 'es-MX': 'Ahorrar para una meta', 'pt-BR': 'Poupar para uma meta' }[locale];
  return {
    schema_version: 2, completion_id: 'sample-completion-3', lesson_id: 'pilot-savings-sequence', version_id: 'rev-1', locale,
    first_try_correct: 3, graded_count: 4, awarded_xp: 40, duration_seconds: 200, previous_best_percent: 0,
    replay: { kind: 'first', notice: 'none', best_score_kept: false, xp_policy: 'improvement_only' },
    celebrations: ['lesson-complete', 'streak-7'],
    recognition: { skills: [skill] },
    streak: { days: 7, milestone: 7, rest_days_bridged: 0 },
    pace: { goal: 2, passed_today: 2, goal_met: true },
  };
}
