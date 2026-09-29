import { stripAnswers } from './lessonDocument.js';
import type { LessonDocumentRow } from './supabaseRest.js';
import {
  gradeV2Visual, projectV2MentorStage, stripV2MentorStage, v2NarrationAudio, validateV2LessonForGrading, type V2MentorStage,
} from './v2LessonDocument.js';

/*
 * GAP-FIX-R6 (staff-ops): the human review sees what a child will see.
 *
 * Product 10 G.2 ("no lesson reaches a child without human approval") and
 * Appendix C Part 3 Stage 3 (Pedagogical Human Review judges the age register,
 * the autonomy mechanism and the reasoning exercise) need the reviewer to play
 * the lesson in the learner's own renderer. For a v2 document (OD-24) that is
 * the rebuilt lesson view, fed exactly what GET /learn/lessons/:id feeds it:
 *
 *   - the answerless client document (stripAnswers, then the authored
 *     `mentor_stage` removed and projected beside it);
 *   - the compact Mentor stage projection, with the catalog default
 *     character (a reviewer has no learner preference);
 *   - the resolved narration map;
 *   - `playable`: whether Core would deliver this document to a learner at
 *     all (its public document and its private rubric agree). A document
 *     Core would refuse is flagged to the reviewer, never hidden.
 *
 * The one learner-specific step Core applies on delivery, the mastery fade of
 * worked examples, is not applied: the reviewer sees the full unfaded
 * document, every step a learner at any mastery may meet.
 *
 * A preview answer is checked against the real answer key by
 * `gradeStaffPreview`, and NOTHING is recorded: no run, no receipt, no
 * evidence, no event. The answer key itself never leaves Core.
 */

/** The catalog default Mentor (tutorData.getTutorPreferences), used because a reviewer has no learner preference. */
export const PREVIEW_MENTOR_CHARACTER = 'rho';

export interface StaffLessonDocument {
  locale: string;
  schemaVersion: number;
  /** The immutable v2 version this row is (the id a preview answer is checked against); null for a v1 row. */
  documentVersionId: string | null;
  document: Record<string, unknown>;
  audio: Record<string, unknown>;
  /** v2 only: Core would deliver this document to a learner. */
  playable?: boolean;
  /** v2 only: the compact Mentor stage projection, as delivered beside the document. */
  mentorStage?: V2MentorStage | null;
  /** v2 only: segment id -> public narration URL. */
  narrationAudio?: Record<string, string>;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** One document row as the staff review renders it (v1: the answerless document; v2: the learner's delivery). */
export function staffLessonDocument(row: LessonDocumentRow, lessonId: string): StaffLessonDocument {
  const safe = stripAnswers(row.document);
  const base = {
    locale: row.locale,
    schemaVersion: row.schema_version,
    documentVersionId: row.schema_version === 2 ? row.document_version_id ?? null : null,
    audio: record(row.audio),
  };
  if (row.schema_version !== 2) return { ...base, document: record(safe) };
  const validated = validateV2LessonForGrading(safe, row.answer_keys, { lessonId, locale: row.locale });
  return {
    ...base,
    document: record(stripV2MentorStage(safe)),
    playable: validated !== null,
    mentorStage: validated ? projectV2MentorStage(validated, PREVIEW_MENTOR_CHARACTER) : null,
    narrationAudio: validated ? v2NarrationAudio(validated, row.audio) : {},
  };
}

export type StaffPreviewGrade =
  | { status: 'graded'; verdict: { correct: boolean; score: number; judgment?: string; diagnostic?: string } }
  /** Not a v2 document, or one Core would not deliver: nothing can be checked. */
  | { status: 'unplayable' }
  /** Not a graded step of this document, or an answer its scorer refuses. */
  | { status: 'invalid' };

/** Checks one preview answer against the document's own answer key. Pure: records nothing. */
export function gradeStaffPreview(row: LessonDocumentRow, lessonId: string, segmentId: string, answer: unknown): StaffPreviewGrade {
  if (row.schema_version !== 2) return { status: 'unplayable' };
  const document = validateV2LessonForGrading(stripAnswers(row.document), row.answer_keys, { lessonId, locale: row.locale });
  if (!document) return { status: 'unplayable' };
  const graded = gradeV2Visual(document, row.answer_keys as Record<string, unknown>, segmentId, answer);
  if (!graded) return { status: 'invalid' };
  return {
    status: 'graded',
    verdict: {
      correct: graded.correct, score: graded.score,
      ...(graded.judgment ? { judgment: graded.judgment } : {}),
      ...(graded.diagnostic && graded.diagnostic !== 'none' ? { diagnostic: graded.diagnostic } : {}),
    },
  };
}
