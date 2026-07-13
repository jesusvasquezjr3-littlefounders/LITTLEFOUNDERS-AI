import type { LessonDocumentRow } from './supabaseRest.js';

/*
 * Pure helpers around a lesson_documents row — locale selection, the
 * answer-key stripper, and assembling a gradeable segment. No I/O here
 * (routes/learn.ts fetches rows via services/supabaseRest.ts) so this stays
 * unit-testable with plain fixtures.
 */

type Json = Record<string, unknown>;

/** Caller's profile locale → es-MX (authoring locale) → whatever's there (LESSON_ENGINE.md §3, COURSE_ENGINE.md §4 "es-MX is the authoring locale"). */
export function pickLessonLocale(rows: readonly LessonDocumentRow[], callerLocale: string | null | undefined): LessonDocumentRow | null {
  if (rows.length === 0) return null;
  const byLocale = new Map(rows.map((r) => [r.locale, r]));
  if (callerLocale && byLocale.has(callerLocale)) return byLocale.get(callerLocale) as LessonDocumentRow;
  if (byLocale.has('es-MX')) return byLocale.get('es-MX') as LessonDocumentRow;
  return rows[0] ?? null;
}

/**
 * The single sanctioned answer-key stripper (LESSON_ENGINE.md §3) — server
 * mirror of the frontend's core/strip.ts. `document` is already stored
 * stripped (Forge's publish step splits document/answer_keys, COURSE_ENGINE.md
 * §4), so this is defense in depth, not the primary control.
 */
export function stripAnswers(document: Json): Json {
  const segments = document.segments;
  if (!Array.isArray(segments)) return document;
  return {
    ...document,
    segments: segments.map((segment) => {
      if (segment && typeof segment === 'object' && !Array.isArray(segment)) {
        const rest: Record<string, unknown> = { ...(segment as Record<string, unknown>) };
        delete rest.answer;
        return rest;
      }
      return segment;
    }),
  };
}

export interface GradingSegment {
  id: string;
  type: string;
  prompt_md: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  payload: Json;
  answer?: Json;
}

function toDifficulty(v: unknown): 1 | 2 | 3 | 4 | 5 {
  return typeof v === 'number' && v >= 1 && v <= 5 ? (Math.round(v) as 1 | 2 | 3 | 4 | 5) : 1;
}

/** Find a segment in the client-safe document and re-attach its server-only answer key — the shape the lesson-contract graders expect. */
export function findGradingSegment(document: Json, answerKeys: Json, segmentId: string): GradingSegment | null {
  const segments = document.segments;
  if (!Array.isArray(segments)) return null;
  const found = segments.find((s) => s && typeof s === 'object' && (s as Json).id === segmentId) as Json | undefined;
  if (!found) return null;
  const key = answerKeys[segmentId];
  return {
    id: segmentId,
    type: typeof found.type === 'string' ? found.type : '',
    prompt_md: typeof found.prompt_md === 'string' ? found.prompt_md : '',
    difficulty: toDifficulty(found.difficulty),
    xp: typeof found.xp === 'number' ? found.xp : 0,
    payload: (found.payload as Json) ?? {},
    answer: key && typeof key === 'object' && !Array.isArray(key) ? (key as Json) : undefined,
  };
}

/** xp weight of every segment in the document, keyed by segment id. */
export function xpBySegmentId(document: Json): Map<string, number> {
  const segments = document.segments;
  const out = new Map<string, number>();
  if (!Array.isArray(segments)) return out;
  for (const seg of segments) {
    if (seg && typeof seg === 'object' && typeof (seg as Json).id === 'string') {
      const xp = (seg as Json).xp;
      out.set((seg as Json).id as string, typeof xp === 'number' ? xp : 0);
    }
  }
  return out;
}

/** Every graded segment id — defined as the answer_keys entries (story/content segments never get one, LESSON_ENGINE.md §5.1). */
export function gradedSegmentIds(answerKeys: Json): string[] {
  return Object.keys(answerKeys);
}
