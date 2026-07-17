import type { LessonDocument } from './types'

/**
 * The single sanctioned answer-key stripper (LESSON_ENGINE.md §3).
 * Production clients only ever receive stripped documents; Core will apply this
 * same function server-side once the content-schema session lands.
 */
export function stripAnswers(doc: LessonDocument): LessonDocument {
  return {
    ...doc,
    segments: doc.segments.map((segment) => {
      const copy = { ...segment }
      delete copy.answer
      return copy
    }),
  }
}
