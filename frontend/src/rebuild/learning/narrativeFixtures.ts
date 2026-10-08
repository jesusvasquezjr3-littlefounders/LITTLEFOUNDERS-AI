import type { Locale } from '../design/copyBudget';
import type { JournalState, NarrativeRecall } from './narrative';

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
    choice: pick(locale, '10 seeds, double the price', '10 semillas, el doble', '10 sementes, o dobro'),
    first_choice: changed ? pick(locale, '5 seeds, the usual price', '5 semillas, el precio de siempre', '5 sementes, o preço de sempre') : null,
    outcome: pick(locale, 'Two neighbors buy. Liruf earns 16 seeds toward the guitar.', 'Compran dos vecinos. Liruf gana 16 semillas para la guitarra.', 'Dois vizinhos compram. Liruf ganha 16 sementes para a guitarra.'),
    relevance: 'same-arc',
    recorded_at: '2026-09-20T10:00:00.000Z',
  };
}

/** A moment `days` ago at ten in the morning, so the preview always reads "Today" and "Yesterday" whenever it is opened. */
const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); date.setHours(10, 0, 0, 0); return date.toISOString(); };

export function journalFixture(locale: Locale): JournalState {
  const course = { slug: 'financial-education', title: loc('Money basics', 'Bases del dinero', 'Básico do dinheiro') };
  return {
    status: 'ready',
    hasMore: true,
    entries: [
      {
        id: 'e1', course, lesson: { id: 'l1', title: loc('The lemonade stand', 'El puesto de limonada', 'A barraca de limonada') },
        situation: pick(locale, 'What price brings me closer to the guitar?', '¿Qué precio me acerca más a la guitarra?', 'Qual preço me aproxima mais da guitarra?'),
        choice: pick(locale, '10 seeds, double the price', '10 semillas, el doble', '10 sementes, o dobro'),
        firstChoice: pick(locale, '5 seeds, the usual price', '5 semillas, el precio de siempre', '5 sementes, o preço de sempre'),
        outcome: pick(locale, 'Two neighbors buy. Liruf earns 16 seeds toward the guitar.', 'Compran dos vecinos. Liruf gana 16 semillas para la guitarra.', 'Dois vizinhos compram. Liruf ganha 16 sementes para a guitarra.'),
        timesDecided: 2, resurfaced: 1, recordedAt: daysAgo(0),
      },
      {
        id: 'e2', course, lesson: { id: 'l2', title: loc('A week of chores', 'Una semana de tareas', 'Uma semana de tarefas') },
        situation: pick(locale, 'Do you want to buy it now?', '¿Quieres comprarlo ahora?', 'Você quer comprar agora?'),
        choice: pick(locale, 'I will wait a week', 'Esperaré una semana', 'Vou esperar uma semana'),
        firstChoice: null,
        outcome: pick(locale, 'You waited and the price dropped. You keep 4 seeds.', 'Esperaste y el precio bajó. Te quedan 4 semillas.', 'Você esperou e o preço baixou. Sobraram 4 sementes.'),
        timesDecided: 1, resurfaced: 0, recordedAt: daysAgo(1),
      },
    ],
  };
}

export const journalPreviewStates = (locale: Locale): Record<string, JournalState> => ({
  list: journalFixture(locale),
  empty: { status: 'ready', entries: [], hasMore: false },
  loading: { status: 'loading' },
  error: { status: 'error' },
});
