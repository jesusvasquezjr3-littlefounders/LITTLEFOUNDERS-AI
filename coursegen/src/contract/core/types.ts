// Minimal type/const subset copied from
// frontend/src/lesson-engine/core/types.ts — ONLY the pieces schemaBase.ts
// needs (LESSON_LOCALES, LESSON_SUBJECTS). The frontend original also
// exports React-dependent registry/grading types (ComponentType, Grader,
// Registry…) that have no reason to exist in a Node CLI and are
// deliberately NOT copied here (contract-copy rule, COURSE_ENGINE.md /
// AGENTS.md §0.4). NOT part of the contract:check byte-diff — see
// src/contract/check.ts for which files ARE diffed.

export const LESSON_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type LessonLocale = (typeof LESSON_LOCALES)[number];

export const LESSON_SUBJECTS = ['money', 'math', 'science', 'economics', 'code', 'mixed'] as const;
export type LessonSubject = (typeof LESSON_SUBJECTS)[number];
