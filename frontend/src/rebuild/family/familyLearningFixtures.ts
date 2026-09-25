import type { Locale } from '../design/copyBudget';
import type { BridgesState, NarrativeState } from './familyLearning';

/*
 * S05.3c preview fixtures for the guardian's course narrative and bridge
 * prompts. Titles arrive already in the guardian's locale, as Core serves them.
 */

const pick = (locale: Locale, en: string, es: string, pt: string) => (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en);

export function narrativeFixture(locale: Locale): NarrativeState {
  const course = pick(locale, 'Money basics', 'Bases del dinero', 'Básico do dinheiro');
  return {
    status: 'ready',
    week: { lessons: 3, topicsCompleted: 1 },
    hasMore: true,
    entries: [
      {
        lessonId: 'l1', lessonTitle: pick(locale, 'The lemonade stand', 'El puesto de limonada', 'A barraca de limonada'), topicTitle: '', courseTitle: course,
        completedAt: '2026-09-23T10:00:00.000Z', skills: [pick(locale, 'Choosing a price', 'Elegir un precio', 'Escolher um preço')],
        struggle: 'resolved', usedHint: true, decisions: 2, topicComplete: true, conversation: 'decision',
      },
      {
        lessonId: 'l2', lessonTitle: pick(locale, 'Saving for a bike', 'Ahorrar para una bici', 'Poupar para uma bicicleta'), topicTitle: '', courseTitle: course,
        completedAt: '2026-09-22T10:00:00.000Z', skills: [pick(locale, 'Saving toward a goal', 'Ahorrar para una meta', 'Poupar para uma meta'), pick(locale, 'Math of a saving plan', 'Las cuentas de un plan de ahorro', 'As contas de um plano de poupança')],
        struggle: 'none', usedHint: false, decisions: 0, topicComplete: false, conversation: 'explain',
      },
      {
        lessonId: 'l3', lessonTitle: pick(locale, 'Counting mixed coins', 'Contar monedas mezcladas', 'Contar moedas misturadas'), topicTitle: '', courseTitle: course,
        completedAt: '2026-09-21T10:00:00.000Z', skills: [pick(locale, 'Count mixed money', 'Contar dinero mezclado', 'Contar dinheiro misturado')],
        struggle: 'open', usedHint: false, decisions: 0, topicComplete: false, conversation: 'explain',
      },
    ],
  };
}

export function bridgesFixture(locale: Locale): BridgesState {
  return {
    status: 'ready',
    prompts: [
      { id: 'p1', action: 'savings_goal', skill: pick(locale, 'Saving toward a goal', 'Ahorrar para una meta', 'Poupar para uma meta'), createdAt: '2026-09-23T10:00:00.000Z', expiresAt: '2026-10-07T10:00:00.000Z' },
      { id: 'p2', action: 'earning_task', skill: pick(locale, 'Work has value', 'El trabajo vale', 'O trabalho tem valor'), createdAt: '2026-09-22T10:00:00.000Z', expiresAt: '2026-10-06T10:00:00.000Z' },
    ],
  };
}

export const narrativePreviewStates = (locale: Locale): Record<string, NarrativeState> => ({
  ready: narrativeFixture(locale),
  empty: { status: 'ready', week: { lessons: 0, topicsCompleted: 0 }, entries: [], hasMore: false },
  error: { status: 'error' },
  loading: { status: 'loading' },
});
