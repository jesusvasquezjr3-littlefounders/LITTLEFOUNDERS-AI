import type { Locale } from '../design/copyBudget';
import type { JournalState, NarrativeRecall, SelfBridge } from './narrative';
import type { ChildDecisionsState } from './childDecisions';

/*
 * S05.3c preview fixtures for the recall and the journal, in the three
 * locales. Snapshot texts are what Core stores: plain text, at most two
 * sentences and 24 words (decisionJournal.ts). Catalog titles are localized
 * objects, exactly as Core serves them.
 */

const loc = (en: string, es: string, pt: string) => ({ 'en-US': en, 'es-MX': es, 'pt-BR': pt });
const pick = (locale: Locale, en: string, es: string, pt: string) => (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en);

export function recallFixture(locale: Locale, changed = true): NarrativeRecall {
  return {
    entry_id: 'entry-1',
    lesson_title: loc('The lemonade stand', 'El puesto de limonada', 'A barraca de limonada'),
    situation: pick(locale, 'What price brings me closer to the guitar?', '¿Qué precio me acerca más a la guitarra?', 'Qual preço me aproxima mais da guitarra?'),
    choice: pick(locale, '10 coins, double the price', '10 monedas, el doble', '10 moedas, o dobro'),
    first_choice: changed ? pick(locale, '5 coins, the usual price', '5 monedas, el precio de siempre', '5 moedas, o preço de sempre') : null,
    outcome: pick(locale, 'Two neighbors buy. Liruf earns 16 coins toward the guitar.', 'Compran dos vecinos. Liruf gana 16 monedas para la guitarra.', 'Dois vizinhos compram. Liruf ganha 16 moedas para a guitarra.'),
    relevance: 'same-arc',
    recorded_at: '2026-09-20T10:00:00.000Z',
  };
}

/** An independent teen's open self prompt, as Core serves it (Option B). */
export function selfBridgesFixture(): SelfBridge[] {
  return [{ id: 'bridge-1', action: 'savings_goal', skill: loc('Saving toward a goal', 'Ahorrar para una meta', 'Poupar para uma meta'), createdAt: '2026-09-22T10:00:00.000Z', expiresAt: '2026-10-06T10:00:00.000Z' }];
}

export function journalFixture(locale: Locale, withBridge: boolean): JournalState {
  const course = { slug: 'financial-education', title: loc('Money basics', 'Bases del dinero', 'Básico do dinheiro') };
  return {
    status: 'ready',
    hasMore: true,
    bridges: withBridge ? selfBridgesFixture() : [],
    entries: [
      {
        id: 'e1', course, lesson: { id: 'l1', title: loc('The lemonade stand', 'El puesto de limonada', 'A barraca de limonada') },
        situation: pick(locale, 'What price brings me closer to the guitar?', '¿Qué precio me acerca más a la guitarra?', 'Qual preço me aproxima mais da guitarra?'),
        choice: pick(locale, '10 coins, double the price', '10 monedas, el doble', '10 moedas, o dobro'),
        firstChoice: pick(locale, '5 coins, the usual price', '5 monedas, el precio de siempre', '5 moedas, o preço de sempre'),
        outcome: pick(locale, 'Two neighbors buy. Liruf earns 16 coins toward the guitar.', 'Compran dos vecinos. Liruf gana 16 monedas para la guitarra.', 'Dois vizinhos compram. Liruf ganha 16 moedas para a guitarra.'),
        timesDecided: 2, resurfaced: 1, recordedAt: '2026-09-21T10:00:00.000Z',
      },
      {
        id: 'e2', course, lesson: { id: 'l2', title: loc('A week of chores', 'Una semana de tareas', 'Uma semana de tarefas') },
        situation: pick(locale, 'Do you want to buy it now?', '¿Quieres comprarlo ahora?', 'Você quer comprar agora?'),
        choice: pick(locale, 'I will wait a week', 'Esperaré una semana', 'Vou esperar uma semana'),
        firstChoice: null, outcome: null, timesDecided: 1, resurfaced: 0, recordedAt: '2026-09-19T10:00:00.000Z',
      },
    ],
  };
}

export const journalPreviewStates = (locale: Locale): Record<string, JournalState> => ({
  list: journalFixture(locale, false),
  teen: journalFixture(locale, true),
  // OD-27 (3): a parent-created child under 13, whose verified Tutor sees the chosen options.
  shared: { ...journalFixture(locale, false), sharedWithTutor: true } as JournalState,
  empty: { status: 'ready', entries: [], hasMore: false, bridges: [] },
  loading: { status: 'loading' },
  error: { status: 'error' },
});

/** OD-27 (3): the Tutor's view of an under-13 child's story choices (titles arrive in the Tutor's locale). */
export function childDecisionsFixture(locale: Locale): ChildDecisionsState {
  const course = { 'en-US': 'Money basics', 'es-MX': 'Bases del dinero', 'pt-BR': 'Básico do dinheiro' }[locale];
  const lesson = { 'en-US': 'The lemonade stand', 'es-MX': 'El puesto de limonada', 'pt-BR': 'A banca de limonada' }[locale];
  const recall = recallFixture(locale);
  return { status: 'ready', hasMore: false, entries: [
    { id: 'decision-1', courseTitle: course, lessonTitle: lesson, situation: recall.situation, choice: recall.choice, recordedAt: '2026-09-20T10:00:00.000Z' },
  ] };
}
