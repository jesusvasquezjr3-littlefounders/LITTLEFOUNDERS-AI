import type { Locale } from '../../design/copyBudget';
import type { TutorMapResponse } from '../session/tutorApi';
import type { SessionSummary, SessionTranscript } from '../session/types';
import { boardFixtures } from './boardFixtures';
import type { MentorData, MentorNotebook } from './mentorData';

/*
 * Fixtures for the Mentor screen's secondary views (the development preview
 * and the unit tests): a learning map with every state, a notebook with a
 * plan, kept boards and a recap, past talks and one saved talk to replay. The
 * words are what Core and the model would send in that language.
 */

const w = (locale: Locale, en: string, es: string, pt: string) => (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en);

export function mapFixture(locale: Locale): TutorMapResponse {
  const node = (kcKey: string, title: string, state: TutorMapResponse['nodes'][number]['state'], skillKey: string | null = `money/${kcKey}`) =>
    ({ kcId: kcKey, kcKey, strand: 'money_math' as const, title, state, mastery: null, attempts: 0, skillKey });
  return {
    nodes: [
      node('count', w(locale, 'Count coins', 'Contar monedas', 'Contar moedas'), 'mastered'),
      node('add', w(locale, 'Add prices', 'Sumar precios', 'Somar preços'), 'needs_review'),
      node('change', w(locale, 'Give change by counting up', 'Dar cambio contando hacia arriba', 'Dar troco contando para cima'), 'in_progress'),
      node('save', w(locale, 'Save for a goal', 'Ahorrar para una meta', 'Poupar para uma meta'), 'available'),
      node('budget', w(locale, 'Plan a budget', 'Planear un presupuesto', 'Planejar um orçamento'), 'locked'),
    ],
    edges: [{ from: 'count', to: 'add' }, { from: 'add', to: 'change' }, { from: 'count', to: 'save' }, { from: 'change', to: 'budget' }, { from: 'save', to: 'budget' }],
    continueTarget: { kcKey: 'add', title: w(locale, 'Add prices', 'Sumar precios', 'Somar preços'), reason: 'review_due', skillKey: 'money/add' },
    review: { count: 1 },
  };
}

export function notebookFixture(locale: Locale): MentorNotebook {
  const boards = boardFixtures(locale);
  return {
    plan: { content: boards.goal_bar, sessionId: 's-plan', updatedAt: '2026-09-20T15:00:00Z' },
    entries: [{ id: 'k1', whiteboard: boards.sequence, sessionId: 's1', turnSeq: 4, keptAt: '2026-09-22T16:30:00Z' }],
    recap: { minutes: 12, xp: 30, board: null },
  };
}

export function sessionsFixture(): SessionSummary[] {
  const base = { locale: 'en-US', companion: null, closeReason: 'completed', segmentCount: 1, xpAwarded: 20 };
  return [
    { ...base, id: 'past-1', character: 'dina', diorama: 'diorama-b', intent: 'course_topic', startedAt: '2026-09-24T16:00:00Z', endedAt: '2026-09-24T16:12:00Z', turnCount: 6 },
    { ...base, id: 'past-2', character: 'rho', diorama: 'diorama-a', intent: 'open', startedAt: '2026-09-21T17:30:00Z', endedAt: '2026-09-21T17:40:00Z', turnCount: 4 },
  ];
}

export function transcriptFixture(locale: Locale, character: SessionSummary['character'] = 'dina'): SessionTranscript {
  const boards = boardFixtures(locale);
  const at = (minute: number) => `2026-09-24T16:${String(minute).padStart(2, '0')}:00Z`;
  const turn = (seq: number, speaker: 'tutor' | 'learner' | 'system', text: string, minute: number, extra: Partial<SessionTranscript['turns'][number]> = {}) => ({
    id: `t${seq}-${speaker}`, seq, speaker, text, emotion: speaker === 'tutor' ? 'happy' as const : null, action: speaker === 'tutor' ? 'idle' as const : null,
    audio_path: null, source: 'live', created_at: at(minute), whiteboard: null, demonstrate: null, roleplay_scene: null, point_at: null, ...extra,
  });
  return {
    session: { ...sessionsFixture()[0]!, character },
    turns: [
      turn(1, 'tutor', w(locale, 'Hi! Shall we plan how to save for the bike?', '¡Hola! ¿Planeamos cómo ahorrar para la bici?', 'Oi! Vamos planejar como poupar para a bicicleta?'), 0),
      turn(2, 'learner', w(locale, 'Yes!', '¡Sí!', 'Sim!'), 1),
      turn(3, 'tutor', w(locale, 'Look at the board. You have saved 45 of 120.', 'Mira el pizarrón. Llevas 45 de 120.', 'Olhe o quadro. Você já tem 45 de 120.'), 2,
        { emotion: 'encouraging', action: 'point', whiteboard: boards.goal_bar }),
      turn(4, 'learner', w(locale, 'So 75 to go.', 'Faltan 75.', 'Faltam 75.'), 4),
    ],
    segments: [{ segmentId: 'seg1', seq: 1, origin: 'catalog', segment: { prompt_md: w(locale, 'How much is still to save?', '¿Cuánto falta ahorrar?', 'Quanto ainda falta poupar?') }, score: 100, xpAwarded: 20, createdAt: at(3) }],
  };
}

/** A data source answering from the fixtures, or the empty, failed or never-answering reads the views must handle. */
export function fixtureData(locale: Locale, mode: 'ready' | 'empty' | 'failed' | 'loading' = 'ready'): MentorData {
  const answer = <T>(ready: T, empty: T): Promise<T | null> => (mode === 'loading' ? new Promise(() => undefined)
    : Promise.resolve(mode === 'failed' ? null : mode === 'empty' ? empty : ready));
  return {
    map: () => answer(mapFixture(locale), { nodes: [], edges: [], continueTarget: null, review: { count: 0 } }),
    notebook: () => answer(notebookFixture(locale), { plan: null, entries: [], recap: null }),
    sessions: () => answer(sessionsFixture(), []),
    transcript: (id) => answer(transcriptFixture(locale, sessionsFixture().find((s) => s.id === id)?.character ?? 'dina'),
      { session: sessionsFixture()[0]!, turns: [], segments: [] }),
  };
}
