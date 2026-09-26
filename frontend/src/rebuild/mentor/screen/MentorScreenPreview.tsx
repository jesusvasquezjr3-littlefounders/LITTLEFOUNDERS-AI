import { useState } from 'react';
import type { AgeBand, Locale } from '../../design/copyBudget';
import { MENTOR_CHARACTERS, type MentorCharacter } from '../../design/assets';
import { RebuildProvider } from '../../design/controls';
import type { Adaptation, TutorOffers, TutorWhiteboardWire } from '../session/types';
import type { TutorTurnState } from '../session/useTutorSocket';
import { boardFixtures } from './boardFixtures';
import { mentorCopy } from './MentorRoute';
import { MentorScreen, type MentorLive, type MentorScreenSession } from './MentorScreen';
import type { MentorPhase } from './useMentorSession';

/*
 * Development preview of the Mentor screen (the preview entry's `mentor-screen` screen),
 * every state from fixtures, no Core and no Oracle:
 *
 *   ?state=  loading | unavailable | calibration | openings | limit | conversing | thinking | long | board |
 *            adaptation | session-end | goal | check-in | activity | recording | error | closing | closing-safety
 *   ?board=<whiteboard kind>  ?character=  ?guardian=1  ?mic=on|off|consent|policy  ?sheet=transcript|grown-up|chooser
 */

const TURNS: Record<Locale, { short: string; long: string; ask: string }> = {
  'en-US': {
    short: 'Nice thinking. How much is left to save for the bike?',
    long: 'You saved ten coins the first week. Then you added five coins each week after that, so the jar kept growing. Look at the board: every bar is one more week. Can you tell me what the jar will hold in week four, and how you worked it out?',
    ask: 'What would you do with the ten coins?',
  },
  'es-MX': {
    short: 'Bien pensado. ¿Cuánto falta ahorrar para la bici?',
    long: 'Ahorraste diez monedas la primera semana. Después agregaste cinco monedas cada semana, así que el frasco siguió creciendo. Mira el pizarrón: cada barra es una semana más. ¿Me dices cuánto tendrá el frasco en la semana cuatro y cómo lo pensaste?',
    ask: '¿Qué harías con las diez monedas?',
  },
  'pt-BR': {
    short: 'Bem pensado. Quanto falta poupar para a bicicleta?',
    long: 'Você poupou dez moedas na primeira semana. Depois colocou cinco moedas a cada semana, então o pote continuou crescendo. Olhe o quadro: cada barra é mais uma semana. Pode me dizer quanto o pote terá na semana quatro e como pensou?',
    ask: 'O que você faria com as dez moedas?',
  },
};

const OFFERS: TutorOffers = {
  locale: 'en-US', lastSession: { topic: 'Saving', courseId: 'c1', topicId: 't1', skillKey: null, outcome: 'left', daysAgo: 1 },
  intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null, voiceAvailable: true, microphoneBlockedBy: null,
  weakSkills: [{ skillKey: 'money/change', title: 'Change', courseId: 'c1', topicId: 't2', recommendedAction: 'practice', reasonCode: 'x' }],
  faqIds: ['what_is_saving'], canAskOpen: true,
};

const noop = () => undefined;

export function MentorScreenPreview({ locale, theme, ageBand, params }: { locale: Locale; theme: 'light' | 'dark'; ageBand: AgeBand; params: URLSearchParams }) {
  const copy = mentorCopy(locale);
  const state = params.get('state') ?? 'openings';
  const character = (MENTOR_CHARACTERS as readonly string[]).includes(params.get('character') ?? '') ? params.get('character') as MentorCharacter : 'dina';
  const boards = boardFixtures(locale);
  const boardKind = (params.get('board') ?? (state === 'board' ? 'sequence' : null)) as TutorWhiteboardWire['kind'] | null;
  const board = boardKind && boardKind in boards ? boards[boardKind] : null;
  const mic = params.get('mic') ?? 'on';
  const [recording] = useState(state === 'recording');

  const phase: MentorPhase = state === 'loading' || state === 'unavailable' || state === 'calibration' ? state
    : state === 'openings' || state === 'limit' ? 'openings'
      : state.startsWith('closing') ? 'closing' : 'conversing';
  const text = state === 'long' || board ? TURNS[locale].long : state === 'adaptation' || state === 'session-end' || state === 'goal' || state === 'check-in' ? TURNS[locale].ask : TURNS[locale].short;
  const turn: TutorTurnState | null = phase === 'conversing' && state !== 'thinking' ? {
    seq: 3, text, emotion: state === 'error' ? 'encouraging' : 'happy', action: board ? 'point' : 'idle', audioUrl: null, audioPending: false, wordTimings: null,
    next: 'ask', policy: null, demonstrate: null, whiteboard: board, roleplayScene: null, pointAt: null,
  } : null;
  const socket: MentorLive = {
    adaptationOffer: state === 'adaptation' ? 'more_examples' as Adaptation : null,
    sessionEndOffer: state === 'session-end', checkInOpen: state === 'check-in', goalCheckOpen: state === 'goal',
    error: state === 'error' ? { code: 'STT_FAILED' } : null, budget: 'running', intelDegraded: false,
    segment: state === 'activity' ? { segmentId: 's1', seq: 3, origin: 'catalog', segment: { type: 'coin_count', prompt: locale === 'es-MX' ? '¿Cuántas monedas hay en total?' : locale === 'pt-BR' ? 'Quantas moedas há no total?' : 'How many coins are there in all?' }, scoresXp: true, framing: '' } : null,
    thinking: state === 'thinking',
    answerAdaptation: noop, answerSessionEnd: noop, answerCheckIn: noop, answerGoal: noop,
  };
  const session: MentorScreenSession = {
    phase, known: phase !== 'loading' && phase !== 'unavailable', ageBand, character, scene: character === 'liruf' || character === 'dina' ? 'diorama-b' : 'diorama-a',
    nickname: params.get('nickname'), offers: phase === 'openings' ? { ...OFFERS, locale, canStart: true, startBlockedBy: state === 'limit' ? 'SESSION_LIMIT' : null } : null,
    calibrationSaving: false, calibrationError: false, starting: false, startError: state === 'limit' ? 'SESSION_LIMIT' : null,
    socket, turn, speechUrl: null, audioKey: 3, speaking: false, awaitingReply: state === 'thinking', replyTimedOut: false, resuming: false, ending: false,
    history: [{ speaker: 'tutor', text: TURNS[locale].ask, seq: 1 }, { speaker: 'learner', text: locale === 'en-US' ? 'Save them' : locale === 'es-MX' ? 'Ahorrarlas' : 'Poupar', seq: 2 }, { speaker: 'tutor', text, seq: 3 }],
    closing: phase === 'closing' ? { sessionId: 'preview', script: state === 'closing-safety' ? 'safety_stop' : 'completed', effort: 'recovered', topic: state === 'closing-safety' ? null : (copy.mentorSessionEnd as { previewTopic?: string }).previewTopic ?? null } : null,
    mic: { present: mic === 'on' && (phase === 'openings' || phase === 'conversing'), blockedBy: mic === 'consent' ? 'CONSENT_REQUIRED' : mic === 'policy' ? 'POLICY_BLOCKED' : mic === 'off' ? 'VOICE_UNAVAILABLE' : null,
      denied: false, recording, microphone: { subscribe: (listener) => { listener(0.6); return noop; } } },
    retry: noop, chooseCalibration: noop, start: noop, sendText: noop, pressMic: noop, endSession: noop,
    chooseCharacter: async () => true, answerAlliance: async () => 'recorded', setHasDraft: noop, onSpeechEnd: noop, onSpeechBlocked: noop,
  };
  return <div className="lf-rebuild" data-theme={theme} lang={locale} data-age-band={ageBand}>
    <RebuildProvider environment={{ theme, locale, ageBand }} labels={{ dismiss: copy.mentorScreen.sheetClose }}>
      <MentorScreen session={session} copy={copy} locale={locale} theme={theme} guardianLink={params.get('guardian') === '1'}
        onLeave={noop} onPath={noop} initialSheet={(params.get('sheet') as 'transcript' | 'grownUp' | 'chooser' | null) ?? null} />
    </RebuildProvider>
  </div>;
}
