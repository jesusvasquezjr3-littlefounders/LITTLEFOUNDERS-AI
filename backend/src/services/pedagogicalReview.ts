import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * Appendix C Part 3, Stage 3 (Pedagogical Human Review), GAP-FIX-R6 learning.
 *
 * A Pedagogical Reviewer, never the Content Author of the same content, runs
 * the six checks of Block B's Pedagogical Design Standard and the four Stage 3
 * questions (B.23 register, B.24 autonomy, B.12 reasoning, B.11 fallibility)
 * and resolves every Stage 3 flag Forge raised. "A review that only says
 * approved ... does not count as complete": every item carries a named finding.
 *
 * Vault holds the record and the gate (`*_lesson_pedagogical_reviews.sql`,
 * `*_lesson_pedagogical_review_writer.sql`, `*_stage3_review_release_gate.sql`):
 * record_lesson_pedagogical_review re-checks the actor (manage_content), the
 * content the reviewer read (its fingerprint), the author and every item, and
 * derives pass or fail; a lesson moving to published and a v2 pointer moving on
 * a published lesson raise STAGE3_REVIEW_REQUIRED unless the latest review of
 * that content passed. Core validates the same shape first, maps the refusals
 * and serves the state the staff form needs. Every read failure is null (502).
 */

/** The ten items, in the order the form shows them. `allowsNotApplicable` mirrors stage3_review_items(). */
export const STAGE3_ITEMS = [
  { id: 'working_memory', allowsNotApplicable: false, spec: 'Block B check 1, B.17' },
  { id: 'feedback_scope', allowsNotApplicable: false, spec: 'Block B check 2, B.26' },
  { id: 'reward_autonomy', allowsNotApplicable: false, spec: 'Block B check 3, B.20, B.24' },
  { id: 'practice_zone', allowsNotApplicable: false, spec: 'Block B check 4, B.19, B.4' },
  { id: 'age_register', allowsNotApplicable: false, spec: 'Block B check 5, B.23' },
  { id: 'resolution_efficiency', allowsNotApplicable: true, spec: 'Block B check 6, B.28' },
  { id: 'register_genuine', allowsNotApplicable: false, spec: 'Stage 3 question, B.23' },
  { id: 'autonomy_real', allowsNotApplicable: true, spec: 'Stage 3 question, B.24' },
  { id: 'reasoning_authentic', allowsNotApplicable: true, spec: 'Stage 3 question, B.12' },
  { id: 'mentor_fallibility', allowsNotApplicable: true, spec: 'Stage 3 question, B.11' },
] as const;
export type Stage3ItemId = (typeof STAGE3_ITEMS)[number]['id'];

export const STAGE3_REFUSAL = 'STAGE3_REVIEW_REQUIRED';
const STAGE3_PREFIX = `${STAGE3_REFUSAL}: `;

/** The PostgREST error body of a release Vault refused for want of a passing Stage 3 review. */
export function stage3RefusalMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const message = (body as { message?: unknown }).message;
  if (typeof message !== 'string' || !message.startsWith(STAGE3_REFUSAL)) return null;
  return message.startsWith(STAGE3_PREFIX) ? message.slice(STAGE3_PREFIX.length) : message;
}

// ── The body the staff form posts ───────────────────────────────────────────

const finding = z.string().trim().min(10).max(600);
const itemShape = (allowsNotApplicable: boolean) => z.object({
  result: allowsNotApplicable ? z.enum(['pass', 'fail', 'not_applicable']) : z.enum(['pass', 'fail']),
  finding,
}).strict();
const ChecksSchema = z.object(Object.fromEntries(STAGE3_ITEMS.map((item) => [item.id, itemShape(item.allowsNotApplicable)])) as {
  [K in Stage3ItemId]: ReturnType<typeof itemShape>;
}).strict();

export const Stage3ReviewBody = z.object({
  documentVersionId: z.string().uuid().optional(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  authorId: z.string().uuid().optional(),
  checks: ChecksSchema,
  forgeItems: z.array(z.object({
    id: z.string().uuid(),
    resolution: z.enum(['acceptable', 'needs_change']),
    note: finding,
  }).strict()).max(500).default([]),
}).strict().refine((body) => (body.documentVersionId === undefined) !== (body.fingerprint === undefined),
  'A review names either the version it covers or the lesson fingerprint it read')
  .refine((body) => new Set(body.forgeItems.map((item) => item.id)).size === body.forgeItems.length, 'Each Forge item is resolved once');
export type Stage3Review = z.infer<typeof Stage3ReviewBody>;

// ── The state the form reads ────────────────────────────────────────────────

const Latest = z.object({
  id: z.string(),
  result: z.enum(['pass', 'fail']),
  finding_count: z.number().int().nonnegative(),
  reviewer_id: z.string().nullable(),
  author_id: z.string().nullable(),
  author_source: z.enum(['version_creator', 'named_by_reviewer']),
  checks: z.record(z.string(), z.object({ result: z.string(), finding: z.string() })),
  forge_items: z.array(z.object({ id: z.string(), resolution: z.string(), note: z.string() })),
  recorded_at: z.string(),
});
const StateRow = z.object({
  found: z.literal(true),
  lesson_id: z.string(),
  lesson_status: z.string(),
  subject: z.enum(['lesson', 'version']),
  fingerprint: z.string().nullable(),
  document_version_id: z.string().nullable(),
  locale: z.string().nullable(),
  version_id: z.string().nullable(),
  version_author_id: z.string().nullable(),
  latest: Latest.nullable(),
  open_items: z.array(z.object({
    id: z.string(), gate: z.number().int(), message: z.string(), locale: z.string().nullable(), run_id: z.string().nullable(), created_at: z.string(),
  })),
  authors: z.array(z.object({ user_id: z.string(), display_name: z.string() })),
  refusal: z.string().nullable(),
});

export interface Stage3State {
  lessonId: string;
  lessonStatus: string;
  subject: 'lesson' | 'version';
  fingerprint: string | null;
  documentVersionId: string | null;
  locale: string | null;
  versionId: string | null;
  /** The version's recorded creator: then the author is fixed. Null: the reviewer names the Content Author. */
  versionAuthorId: string | null;
  latest: {
    id: string; result: 'pass' | 'fail'; findingCount: number; reviewerId: string | null; authorId: string | null;
    authorSource: 'version_creator' | 'named_by_reviewer'; checks: Record<string, { result: string; finding: string }>;
    forgeItems: { id: string; resolution: string; note: string }[]; recordedAt: string;
  } | null;
  openItems: { id: string; gate: number; message: string; locale: string | null; runId: string | null; createdAt: string }[];
  /** Staff accounts that may be named as the Content Author (the reviewer is excluded by the caller). */
  authors: { userId: string; displayName: string }[];
  /** Why the content may not go live yet; null when a passing review covers it and no Forge item is open. */
  refusal: string | null;
  items: typeof STAGE3_ITEMS;
}

/** Null when unreadable (502); 'not_found' when the lesson or version does not exist. */
export async function getStage3State(lessonId: string, documentVersionId: string | null, viewerId: string): Promise<Stage3State | 'not_found' | null> {
  const raw = await serviceRest<unknown>('/rpc/lesson_stage3_review_state', {
    method: 'POST',
    body: JSON.stringify({ p_lesson_id: lessonId, p_document_version_id: documentVersionId }),
  });
  if (raw && typeof raw === 'object' && (raw as { found?: unknown }).found === false) return 'not_found';
  const parsed = StateRow.safeParse(raw);
  if (!parsed.success) return null;
  const s = parsed.data;
  return {
    lessonId: s.lesson_id,
    lessonStatus: s.lesson_status,
    subject: s.subject,
    fingerprint: s.fingerprint,
    documentVersionId: s.document_version_id,
    locale: s.locale,
    versionId: s.version_id,
    versionAuthorId: s.version_author_id,
    latest: s.latest ? {
      id: s.latest.id, result: s.latest.result, findingCount: s.latest.finding_count, reviewerId: s.latest.reviewer_id,
      authorId: s.latest.author_id, authorSource: s.latest.author_source, checks: s.latest.checks,
      forgeItems: s.latest.forge_items, recordedAt: s.latest.recorded_at,
    } : null,
    openItems: s.open_items.map((item) => ({
      id: item.id, gate: item.gate, message: item.message, locale: item.locale, runId: item.run_id, createdAt: item.created_at,
    })),
    authors: s.authors.filter((author) => author.user_id !== viewerId).map((author) => ({ userId: author.user_id, displayName: author.display_name })),
    refusal: s.refusal,
    items: STAGE3_ITEMS,
  };
}

// ── Recording ───────────────────────────────────────────────────────────────

const RecordRows = z.array(z.object({
  ok: z.boolean(), code: z.string(), message: z.string(), review_id: z.string().nullable(), result: z.enum(['pass', 'fail']).nullable(),
})).length(1);

export type Stage3Outcome =
  | { outcome: 'recorded'; reviewId: string; result: 'pass' | 'fail' }
  | { outcome: 'refused'; code: string; message: string }
  | { outcome: 'unavailable' };

export async function recordStage3Review(actorId: string, lessonId: string, review: Stage3Review): Promise<Stage3Outcome> {
  const rows = await serviceRest<unknown>('/rpc/record_lesson_pedagogical_review', {
    method: 'POST',
    body: JSON.stringify({
      p_actor: actorId,
      p_lesson_id: lessonId,
      p_document_version_id: review.documentVersionId ?? null,
      p_fingerprint: review.fingerprint ?? null,
      p_author: review.authorId ?? null,
      p_checks: review.checks,
      p_forge_items: review.forgeItems,
    }),
  });
  const parsed = RecordRows.safeParse(rows);
  if (!parsed.success) return { outcome: 'unavailable' };
  const row = parsed.data[0]!;
  if (!row.ok || !row.review_id || !row.result) return { outcome: 'refused', code: row.code, message: row.message };
  return { outcome: 'recorded', reviewId: row.review_id, result: row.result };
}

/** Vault's refusal codes → the route's status and envelope code. */
export const STAGE3_RECORD_REFUSALS: Record<string, { status: number; code: string }> = {
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  CONTENT_CHANGED: { status: 409, code: 'STAGE3_CONTENT_CHANGED' },
  AUTHOR_REQUIRED: { status: 400, code: 'STAGE3_AUTHOR_REQUIRED' },
  AUTHOR_MISMATCH: { status: 409, code: 'STAGE3_AUTHOR_MISMATCH' },
  AUTHOR_NOT_STAFF: { status: 400, code: 'STAGE3_AUTHOR_NOT_STAFF' },
  SELF_REVIEW: { status: 409, code: 'STAGE3_SELF_REVIEW' },
  INVALID_REVIEW: { status: 400, code: 'VALIDATION_ERROR' },
  FORGE_ITEMS_UNRESOLVED: { status: 409, code: 'STAGE3_FORGE_ITEMS_UNRESOLVED' },
};
