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
