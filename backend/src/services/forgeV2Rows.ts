// Core's strict v2 contract applied to rows Forge emitted (S05.4c).
//
// Forge's zero-spend emitter produces `lesson_document_versions`-shaped rows
// ({lesson_id, locale, schema_version, version_id, document, answer_keys}).
// Each must pass the exact function Core runs before delivering or grading a
// v2 lesson, so Forge can never target a looser copy of the contract.
// Used by scripts/forge-v2-check.ts (npm run forge-v2:check) and its test.

import { checkV2Behaviour } from './forgeV2Behaviour.js';
import { validateV2LessonForGrading } from './v2LessonDocument.js';

export interface ForgeV2Row {
  lesson_id?: unknown;
  locale?: unknown;
  schema_version?: unknown;
  version_id?: unknown;
  document?: unknown;
  answer_keys?: unknown;
}

/** Problems with Forge's emitted rows under Core's contract; empty means every row is deliverable. */
export function checkForgeV2Rows(rows: unknown): string[] {
  if (!Array.isArray(rows)) return ['expected a JSON array of emitted rows'];
  if (rows.length === 0) return ['no emitted rows to validate'];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const row = (raw ?? {}) as ForgeV2Row;
    const where = `row ${index} (${String(row.lesson_id)} ${String(row.locale)})`;
    if (typeof row.lesson_id !== 'string' || typeof row.locale !== 'string') {
      problems.push(`${where}: lesson_id and locale are required`);
      continue;
    }
    const key = `${row.lesson_id}:${row.locale}`;
    if (seen.has(key)) problems.push(`${where}: duplicate lesson/locale row`);
    seen.add(key);
    if (row.schema_version !== 2) problems.push(`${where}: schema_version must be 2`);
    const document = row.document as { version_id?: unknown } | undefined;
    if (!document || document.version_id !== row.version_id) problems.push(`${where}: row version_id must match the document's`);
    const parsed = validateV2LessonForGrading(row.document, row.answer_keys, { lessonId: row.lesson_id, locale: row.locale });
    if (!parsed) { problems.push(`${where}: refused by Core's v2 contract (validateV2LessonForGrading)`); continue; }
    // GAP-FIX-R1: the interactive-behaviour gate over the full permitted input range, on the authoritative scorer.
    for (const report of checkV2Behaviour(parsed, row.answer_keys as Record<string, unknown>)) {
      for (const problem of report.problems) problems.push(`${where}: interactive-behaviour gate, ${report.segmentId} (${report.type}): ${problem}`);
    }
  }
  return problems;
}

/** Appendix C 1.3: the interactive-behaviour gate's pass rate over the graded segments of valid rows. */
export function forgeV2BehaviourPassRate(rows: unknown): { segments: number; passed: number; states: number; passRate: number | null } {
  let segments = 0; let passed = 0; let states = 0;
  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = (raw ?? {}) as ForgeV2Row;
    if (typeof row.lesson_id !== 'string' || typeof row.locale !== 'string') continue;
    const parsed = validateV2LessonForGrading(row.document, row.answer_keys, { lessonId: row.lesson_id, locale: row.locale });
    if (!parsed) continue;
    for (const report of checkV2Behaviour(parsed, row.answer_keys as Record<string, unknown>)) {
      segments += 1; states += report.states; if (report.ok) passed += 1;
    }
  }
  return { segments, passed, states, passRate: segments === 0 ? null : passed / segments };
}

