import type { Locale } from '../design/copyBudget';
import type { PlacementAsk, PlacementFlow, PlacementResult, PlacementScreen } from './placementFlow';

/*
 * W2L.2: preview fixtures for the placement flow (L4). A fixed flow per state,
 * so every screen can be reached by a URL and audited as it is; the handlers
 * move between the preview's states instead of calling Core. The real route
 * drives the same view with usePlacementFlow.
 */

const PROMPTS: Record<Locale, { prompt: string; options: string[] }> = {
  'en-US': { prompt: 'You save 10 coins a week. How many after 4 weeks?', options: ['14 coins', '40 coins', '100 coins'] },
  'es-MX': { prompt: 'Ahorras 10 monedas por semana. ¿Cuántas tienes en 4 semanas?', options: ['14 monedas', '40 monedas', '100 monedas'] },
  'pt-BR': { prompt: 'Você poupa 10 moedas por semana. Quantas terá em 4 semanas?', options: ['14 moedas', '40 moedas', '100 moedas'] },
};

const REFLECTION: Record<Locale, string> = {
  'en-US': 'You already keep a budget. We can start past that.',
  'es-MX': 'Ya llevas un presupuesto. Podemos empezar después de eso.',
  'pt-BR': 'Você já faz um orçamento. Podemos começar depois disso.',
};

const ask = (locale: Locale, questionNumber: number, phase: PlacementAsk['phase']): PlacementAsk => ({
  kind: 'ask', probe: { topicId: `topic-${questionNumber}`, ...PROMPTS[locale] }, questionNumber, questionsRemaining: phase === 'confirm' ? 1 : 6, phase,
});

const result = (start: 'beginning' | 'further_in', capped = false): PlacementResult => ({
  frontier: start === 'beginning' ? 0 : 12, startLessonId: 'lesson-1', cappedByPrerequisite: capped,
  framing: { path: 'adaptive_quiz', start, basis: 'prior_exposure', learner_chosen: false },
});

/** The preview states, by `?flow=`. */
export const PLACEMENT_PREVIEW_STATES = ['welcome', 'intake', 'question', 'reflection', 'confirm', 'outcome', 'outcome-start', 'capped', 'adjust',
  'saving', 'save-error', 'step-offline', 'loading', 'error', 'offline', 'age', 'not-found'] as const;

export function placementPreviewFlow(state: string, locale: Locale, go: (state: string) => void): PlacementFlow {
  const screens: Record<string, PlacementScreen> = {
    welcome: { kind: 'welcome' },
    intake: { kind: 'intake' },
    question: { kind: 'question', ask: ask(locale, 2, 'search') },
    reflection: { kind: 'question', ask: ask(locale, 1, 'search') },
    confirm: { kind: 'question', ask: ask(locale, 7, 'confirm') },
    'step-offline': { kind: 'question', ask: ask(locale, 2, 'search') },
    outcome: { kind: 'outcome', result: result('further_in') },
    'outcome-start': { kind: 'outcome', result: result('beginning') },
    capped: { kind: 'outcome', result: result('further_in', true) },
    saving: { kind: 'outcome', result: result('further_in') },
    'save-error': { kind: 'outcome', result: result('further_in') },
    adjust: { kind: 'adjust', result: result('further_in') },
    loading: { kind: 'loading' },
    error: { kind: 'unavailable', reason: 'error' },
    offline: { kind: 'unavailable', reason: 'offline' },
    age: { kind: 'unavailable', reason: 'age-restricted' },
    'not-found': { kind: 'unavailable', reason: 'not-found' },
  };
  const screen = screens[state] ?? screens.welcome!;
  const answered = state === 'reflection' ? 0 : screen.kind === 'question' ? 1 : 0;
  return {
    screen,
    answered,
    reflection: state === 'reflection' ? REFLECTION[locale] : null,
    intakeAvailable: true,
    pending: state === 'saving' ? 'save' : null,
    issue: state === 'save-error' ? { kind: 'save', offline: false } : state === 'step-offline' ? { kind: 'step', offline: true } : null,
    begin: () => go('intake'),
    startFromBeginning: () => go('outcome-start'),
    submitIntake: () => go('reflection'),
    skipIntake: () => go('question'),
    answer: () => go(state === 'confirm' ? 'outcome' : 'confirm'),
    back: () => go('reflection'),
    accept: () => go('saving'),
    earlier: () => go('adjust'),
    chooseEarlier: () => go('saving'),
    chooseBeginning: () => go('saving'),
    keep: () => go('outcome'),
    reload: () => go('welcome'),
  };
}
