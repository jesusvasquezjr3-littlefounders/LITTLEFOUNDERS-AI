/*
 * Appendix C Part 3 Stage 3 (Pedagogical Human Review), GAP-FIX-R6 learning:
 * the wire shapes of Core's
 *
 *   GET  /admin/content/lessons/:lessonId/pedagogical-review[?versionId=]
 *   POST /admin/content/lessons/:lessonId/pedagogical-review
 *
 * hand-mirrored from backend/src/services/pedagogicalReview.ts (no shared
 * types across packages by design) and checked on arrival. Core and Vault
 * re-check every field; this only builds a complete body and names refusals.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The six Block B checks, then the four Stage 3 questions; `allowsNotApplicable` mirrors Vault's stage3_review_items(). */
export const STAGE3_ITEMS = [
  { id: 'working_memory', group: 'check', allowsNotApplicable: false },
  { id: 'feedback_scope', group: 'check', allowsNotApplicable: false },
  { id: 'reward_autonomy', group: 'check', allowsNotApplicable: false },
  { id: 'practice_zone', group: 'check', allowsNotApplicable: false },
  { id: 'age_register', group: 'check', allowsNotApplicable: false },
  { id: 'resolution_efficiency', group: 'check', allowsNotApplicable: true },
  { id: 'register_genuine', group: 'question', allowsNotApplicable: false },
  { id: 'autonomy_real', group: 'question', allowsNotApplicable: true },
  { id: 'reasoning_authentic', group: 'question', allowsNotApplicable: true },
  { id: 'mentor_fallibility', group: 'question', allowsNotApplicable: true },
] as const;
export type Stage3ItemId = (typeof STAGE3_ITEMS)[number]['id'];
export type Stage3Result = 'pass' | 'fail' | 'not_applicable';
export type Stage3Resolution = 'acceptable' | 'needs_change';

export interface Stage3OpenItem { id: string; gate: number; message: string; locale: string | null; runId: string | null; createdAt: string }
export interface Stage3State {
  lessonId: string;
  lessonStatus: string;
  subject: 'lesson' | 'version';
  fingerprint: string | null;
  documentVersionId: string | null;
  locale: string | null;
  versionId: string | null;
  versionAuthorId: string | null;
  latest: { id: string; result: 'pass' | 'fail'; findingCount: number; recordedAt: string } | null;
  openItems: Stage3OpenItem[];
  authors: { userId: string; displayName: string }[];
  refusal: string | null;
}

const isOpenItem = (v: unknown): v is Stage3OpenItem => isRecord(v) && isString(v.id) && isNumber(v.gate) && isString(v.message)
  && isNullableString(v.locale) && isString(v.createdAt);
const isLatest = (v: unknown): v is NonNullable<Stage3State['latest']> => isRecord(v) && isString(v.id) && (v.result === 'pass' || v.result === 'fail')
  && isNumber(v.findingCount) && isString(v.recordedAt);

export const isStage3State = (value: unknown): value is Stage3State => isRecord(value) && isString(value.lessonId)
  && (value.subject === 'lesson' || value.subject === 'version') && isNullableString(value.fingerprint)
  && isNullableString(value.documentVersionId) && isNullableString(value.versionAuthorId) && isNullableString(value.refusal)
  && (value.latest === null || isLatest(value.latest))
  && Array.isArray(value.openItems) && value.openItems.every(isOpenItem)
  && Array.isArray(value.authors) && value.authors.every((a) => isRecord(a) && isString(a.userId) && isString(a.displayName));

/** Where the content stands: the chip and the note the panel shows. */
export type Stage3Status = 'passed' | 'failed' | 'itemsOpen' | 'needed';
export function stage3Status(state: Stage3State): Stage3Status {
  if (state.refusal === null) return 'passed';
  if (state.latest?.result === 'fail') return 'failed';
  if (state.latest && state.openItems.length > 0) return 'itemsOpen';
  return 'needed';
}

export function stage3Path(lessonId: string, versionId?: string | null): string {
  return `/admin/content/lessons/${lessonId}/pedagogical-review${versionId ? `?versionId=${versionId}` : ''}`;
}

export interface Stage3Draft {
  authorId: string;
  checks: Partial<Record<Stage3ItemId, { result: Stage3Result | null; finding: string }>>;
  forgeItems: Record<string, { resolution: Stage3Resolution | null; note: string }>;
}
export const emptyDraft = (): Stage3Draft => ({ authorId: '', checks: {}, forgeItems: {} });

const fits = (text: string) => text.trim().length >= 10 && text.trim().length <= 600;

/**
 * The POST body, or null while the draft is incomplete: every item has a
 * result it allows and a named finding, every open Forge flag a resolution
 * and a note, and an author unless the version records its own.
 */
export function stage3Body(state: Stage3State, draft: Stage3Draft): Record<string, unknown> | null {
  const checks: Record<string, { result: Stage3Result; finding: string }> = {};
  for (const item of STAGE3_ITEMS) {
    const entry = draft.checks[item.id];
    if (!entry?.result || !fits(entry.finding) || (entry.result === 'not_applicable' && !item.allowsNotApplicable)) return null;
    checks[item.id] = { result: entry.result, finding: entry.finding.trim() };
  }
  const forgeItems = [];
  for (const item of state.openItems) {
    const entry = draft.forgeItems[item.id];
    if (!entry?.resolution || !fits(entry.note)) return null;
    forgeItems.push({ id: item.id, resolution: entry.resolution, note: entry.note.trim() });
  }
  if (!state.versionAuthorId && !draft.authorId) return null;
  return {
    ...(state.subject === 'version' ? { documentVersionId: state.documentVersionId } : { fingerprint: state.fingerprint }),
    ...(state.versionAuthorId ? {} : { authorId: draft.authorId }),
    checks,
    forgeItems,
  };
}

/** Core's codes for a refused review → the copy key that names it; null for an outage. */
export const STAGE3_REFUSALS = {
  STAGE3_CONTENT_CHANGED: 'contentChanged',
  STAGE3_SELF_REVIEW: 'selfReview',
  STAGE3_AUTHOR_REQUIRED: 'authorRequired',
  STAGE3_AUTHOR_NOT_STAFF: 'authorNotStaff',
  STAGE3_AUTHOR_MISMATCH: 'authorMismatch',
  STAGE3_FORGE_ITEMS_UNRESOLVED: 'forgeUnresolved',
  VALIDATION_ERROR: 'invalid',
} as const;
export type Stage3RefusalKey = (typeof STAGE3_REFUSALS)[keyof typeof STAGE3_REFUSALS];
export function stage3Refusal(code: string): Stage3RefusalKey | null {
  return code in STAGE3_REFUSALS ? STAGE3_REFUSALS[code as keyof typeof STAGE3_REFUSALS] : null;
}
