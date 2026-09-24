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
  const rootAuthorityFields = ['answer_keys', 'answer_key', 'hidden_tests', 'rubric'];
  const hasRootAuthority = rootAuthorityFields.some((field) => Object.hasOwn(document, field))
    || (document.schema_version === 2 && Object.hasOwn(document, 'scoring'));
  // Retain the long-standing no-allocation behavior for ordinary malformed or
  // metadata-only v1 input. If such a row does carry authority, clone it and
  // remove that material below before any response can observe it.
  if (!Array.isArray(segments) && !hasRootAuthority) return document;
  const stripped: Json = { ...document };
  // Client documents must never carry a second copy of server authority.
  // v2 fails closed in the browser as well, but delivery removes sensitive
  // authoring mistakes before an untrusted client can observe them.
  delete stripped.answer_keys;
  delete stripped.answer_key;
  delete stripped.hidden_tests;
  delete stripped.rubric;
  if (document.schema_version === 2) delete stripped.scoring;
  if (!Array.isArray(segments)) return stripped;
  return {
    ...stripped,
    segments: segments.map((segment) => {
      if (segment && typeof segment === 'object' && !Array.isArray(segment)) {
        const rest: Record<string, unknown> = { ...(segment as Record<string, unknown>) };
        delete rest.answer;
        delete rest.answer_key;
        delete rest.answer_keys;
        delete rest.hidden_tests;
        delete rest.rubric;
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

const CONTENT_TYPES = new Set(['story_dialogue', 'story_scene', 'key_ideas', 'concept_reveal', 'checkpoint', 'eavesdrop']);

/** Distinguish a real story-only lesson from an unknown or ungradeable exercise before awarding a score. */
export function completableSegmentIds(document: Json, answerKeys: Json, graderTypes: ReadonlySet<string>, keylessTypes: ReadonlySet<string>): string[] | null {
  if (document.schema_version !== 1 || !Array.isArray(document.segments) || document.segments.length === 0) return null;
  const ids = new Set<string>();
  const graded: string[] = [];
  for (const raw of document.segments) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const segment = raw as Json;
    if (typeof segment.id !== 'string' || !segment.id || ids.has(segment.id) || typeof segment.type !== 'string'
      || typeof segment.xp !== 'number' || !Number.isFinite(segment.xp) || segment.xp < 0) return null;
    ids.add(segment.id);
    if (CONTENT_TYPES.has(segment.type)) {
      if (segment.xp !== 0 || Object.hasOwn(answerKeys, segment.id)) return null;
      continue;
    }
    if (!graderTypes.has(segment.type) || segment.xp <= 0) return null;
    if (!keylessTypes.has(segment.type) && (!Object.hasOwn(answerKeys, segment.id) || typeof answerKeys[segment.id] !== 'object' || answerKeys[segment.id] === null)) return null;
    graded.push(segment.id);
  }
  if (Object.keys(answerKeys).some((key) => !ids.has(key))) return null;
  return graded;
}
