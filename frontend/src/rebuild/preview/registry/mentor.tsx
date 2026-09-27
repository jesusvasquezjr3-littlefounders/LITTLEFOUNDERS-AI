import { useState } from 'react';
import type { Locale } from '../../design/copyBudget';
import { SessionClosing, SessionEndChoice, type ClosingScript, type EffortAct } from '../../mentor/SessionEnd';
import { CheckInChoice } from '../../mentor/CheckIn';
import { GoalCheckChoice } from '../../mentor/GoalCheck';
import { AllianceCheck } from '../../mentor/AllianceCheck';
import { DispositionSummary } from '../../mentor/DispositionSummary';
import type { DispositionSummaryData } from '../../mentor/allianceApi';
import { MentorStagePreview } from '../../mentor/MentorStagePreview';
import { MentorScreenPreview } from '../../mentor/screen/MentorScreenPreview';
import { VoiceConsent, type VoiceConsentApi } from '../../mentor/VoiceConsent';
import type { MentorVoiceConsentCopy } from '../../mentor/screen/MentorScreen';
import { framed, standalone, type PreviewRegistry } from './types';

/*
 * Lane 3 (mentor): the Mentor stage (Bible 08) and the Mentor's session
 * surfaces.
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

/** C.2 preview fixture: Core's consent record for ?consent=off|active&policy=allowed|blocked, or ?consent=failed. */
function consentFixture(params: URLSearchParams): VoiceConsentApi {
  let record = params.get('consent') === 'failed' ? null : {
    active: params.get('consent') === 'active', grantedAt: params.get('consent') === 'active' ? '2026-09-12T10:00:00Z' : null, locale: null,
    policy: params.get('policy') === 'blocked' ? 'blocked' as const : 'allowed' as const,
  };
  return {
    read: async () => record,
    grant: async () => { record = record && { ...record, active: true, grantedAt: '2026-09-26T10:00:00Z' }; return record ? { grantedAt: '2026-09-26T10:00:00Z' } : null; },
    revoke: async () => { record = record && { ...record, active: false, grantedAt: null }; return record !== null; },
  };
}

function ConsentPreview({ params, copy, locale }: { params: URLSearchParams; copy: MentorVoiceConsentCopy; locale: Locale }) {
  const [api] = useState(() => consentFixture(params));
  return <VoiceConsent kidUserId="preview-kid" kidName="Ana" api={api} copy={copy} locale={locale} initiallyConfirming={params.get('confirm') === '1'} headingLevel={1} />;
}

export const mentorPreviewScreens: PreviewRegistry = {
  /* W2M.1: the one Mentor stage at full size, in the Mentor screen's stage region (08 §6, §7); see MentorStagePreview. */
  'mentor-stage': standalone(({ locale, theme, ageBand, params }) => <MentorStagePreview locale={locale} theme={theme} ageBand={ageBand} params={params} />),
  /* W2M.2: the Mentor screen (08 §2-§6) in every state from fixtures; see MentorScreenPreview. */
  'mentor-screen': standalone(({ locale, theme, ageBand, params }) => <MentorScreenPreview locale={locale} theme={theme} ageBand={ageBand} params={params} />),
  /* W2M.3 (C.2): the microphone permission a verified Tutor gives for one child; ?consent=off|active|failed&policy=allowed|blocked&confirm=1. */
  'mentor-voice-consent': framed(({ t, locale, params }) => <main className="lf-preview lf-preview--mentor-voice-consent" data-surface="app"
    data-screen="mentor-voice-consent-preview"><div className="lf-preview-content">
    <ConsentPreview params={params} copy={t.mentorVoiceConsent as unknown as MentorVoiceConsentCopy} locale={locale} />
  </div></main>),
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
