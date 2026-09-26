import { SessionClosing, SessionEndChoice, type ClosingScript, type EffortAct } from '../../mentor/SessionEnd';
import { CheckInChoice } from '../../mentor/CheckIn';
import { GoalCheckChoice } from '../../mentor/GoalCheck';
import { AllianceCheck } from '../../mentor/AllianceCheck';
import { DispositionSummary } from '../../mentor/DispositionSummary';
import type { DispositionSummaryData } from '../../mentor/allianceApi';
import { framed, type PreviewRegistry } from './types';

/*
 * Lane 3 (mentor): the Mentor's session surfaces. The Mentor stage itself
 * (Bible 08) registers here when it is built.
 */

/** C.7 preview fixture: a profile with every row populated (closed labels only). */
const PREVIEW_PROFILE: DispositionSummaryData = {
  exists: true,
  current: true,
  sessionsObserved: 7,
  helpStyle: 'tell_early',
  persistence: 'persists',
  explanation: 'needs_scaffold',
  persistentlyDeclined: ['less_text', 'more_visual'],
  typicalReplySeconds: 12,
  personas: [{ character: 'dina', sessions: 5 }, { character: 'rho', sessions: 2 }],
  effects: ['stuck_degrade_early', 'scaffolded_explanation', 'seeded_declines', 'idle_nudge_paced'],
  updatedAt: '2026-09-24T12:00:00Z',
};

const SCRIPTS = ['completed', 'interrupted', 'learner_left', 'safety_stop'];

export const mentorPreviewScreens: PreviewRegistry = {
  'mentor-session-end': framed(({ t, locale, theme, params, go }) => <main className="lf-preview lf-preview--mentor-session-end" data-surface="app"
    data-screen="mentor-session-end"><div className="lf-preview-content">
    {/* C.8/C.12 + C.16 fixtures: the stop-or-continue choice and the closing state for ?script=&effort=. */}
    <SessionEndChoice copy={t.mentorSessionEnd} locale={locale} dark={theme === 'dark'} onChoose={() => undefined} />
    <SessionClosing copy={t.mentorSessionEnd} locale={locale} dark={theme === 'dark'}
      script={(SCRIPTS.includes(params.get('script') ?? '') ? params.get('script') : 'completed') as ClosingScript}
      effort={(params.get('effort') ?? 'recovered') as EffortAct}
      topic={params.get('topic') === 'none' ? null : t.mentorSessionEnd.previewTopic} onBack={() => go('home')} />
  </div></main>),
  'mentor-check-in': framed(({ t, locale, theme }) => <main className="lf-preview lf-preview--mentor-check-in" data-surface="app"
    data-screen="mentor-check-in"><div className="lf-preview-content">
    {/* C.19 fixture: the two reply chips the stage shows under the Mentor's check-in turn. */}
    <CheckInChoice copy={t.mentorCheckIn} locale={locale} dark={theme === 'dark'} onAnswer={() => undefined} />
  </div></main>),
  'mentor-goal-check': framed(({ t, locale, theme }) => <main className="lf-preview lf-preview--mentor-goal-check" data-surface="app"
    data-screen="mentor-goal-check"><div className="lf-preview-content">
    {/* C.15 fixture: the two chips under the Mentor's goal restatement. */}
    <GoalCheckChoice copy={t.mentorGoalCheck} locale={locale} dark={theme === 'dark'} onAnswer={() => undefined} />
  </div></main>),
  'mentor-alliance-check': framed(({ t, locale, theme, params }) => <main className="lf-preview lf-preview--mentor-alliance-check" data-surface="app"
    data-screen="mentor-alliance-check"><div className="lf-preview-content">
    {/* C.15 fixture: the end-of-session bond proxy for ?script=; ?result=failed shows the retry. */}
    <AllianceCheck copy={t.mentorAllianceCheck} locale={locale} dark={theme === 'dark'}
      script={(SCRIPTS.includes(params.get('script') ?? '')
        ? params.get('script') : 'completed') as 'completed' | 'interrupted' | 'learner_left' | 'safety_stop'}
      onAnswer={async () => (params.get('result') === 'failed' ? 'failed' : 'recorded')} />
  </div></main>),
  'mentor-profile': framed(({ t, locale, theme, params }) => <main className="lf-preview lf-preview--mentor-profile" data-surface="app"
    data-screen="mentor-profile"><div className="lf-preview-content">
    {/* C.7 fixture: ?audience=own|child and ?state=ready|empty|loading|failed. */}
    <DispositionSummary copy={t.mentorProfile} locale={locale} dark={theme === 'dark'}
      audience={params.get('audience') === 'own' ? 'own' : 'child'}
      phase={params.get('state') === 'loading' ? 'loading' : params.get('state') === 'failed' ? 'failed' : 'ready'}
      data={params.get('state') === 'empty' ? { ...PREVIEW_PROFILE, exists: false } : PREVIEW_PROFILE}
      canReset onReset={() => undefined} />
  </div></main>),
};
