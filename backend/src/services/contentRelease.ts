import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';
import { STAGE3_REFUSAL, stage3RefusalMessage } from './pedagogicalReview.js';

/*
 * Product G.2 (Block G opening: no lesson reaches a child without a human
 * staff approval) and Appendix N 1.2 / 2.3, on the rebuilt Content page.
 *
 * 1. Pending v2 versions. Forge's reviewed publication
 *    (`publish_v2_lesson_version`) no longer puts a new version of an
 *    already-published lesson live: it records a pending activation request
 *    (`*_v2_staff_release_approval.sql`). A staff member with manage_content
 *    releases it (`release_lesson_version`: the course's Forge verification is
 *    re-checked, the pointer moves, the audit row names the staff actor) or
 *    rejects it with a reason. Both functions re-check the actor in SQL.
 * 2. The retroactive release checks (`*_content_bypass_retro_checks.sql`):
 *    every bypass of the release check (the database owner's justified patch
 *    of a live document, a Superadmin's emergency activation, a legacy 0209
 *    publication on a live lesson) must be followed by a complete Forge
 *    verification of its course within 30 days. This reads the list and the
 *    counts behind Appendix N 1.2's two metrics, and the overdue count the
 *    operations watchdog alerts on.
 * Every read failure is null (a 502), never an empty, calm list.
 */

export const RETRO_CHECK_DAYS = 30;
export const BYPASS_WINDOW_DAYS = 90;

const PendingRow = z.object({
  id: z.string(),
  lesson_id: z.string(),
  locale: z.string(),
  document_version_id: z.string(),
  version_id: z.string(),
  document_sha256: z.string(),
  run_id: z.string().nullable(),
  created_at: z.string(),
  lessons: z.object({ slug: z.string(), title: z.record(z.string(), z.unknown()).nullable(), status: z.string() }).nullable(),
});

export interface PendingLessonVersion {
  requestId: string;
  lessonId: string;
  lessonSlug: string | null;
  lessonTitle: Record<string, string>;
  lessonStatus: string | null;
  locale: string;
  documentVersionId: string;
  versionId: string;
  documentSha256: string;
  runId: string | null;
  submittedAt: string;
}

const titleOf = (value: Record<string, unknown> | null | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(value ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

export async function listPendingLessonVersions(): Promise<PendingLessonVersion[] | null> {
  const rows = await serviceRest<unknown>(
    '/lesson_version_activation_requests?status=eq.pending' +
      '&select=id,lesson_id,locale,document_version_id,version_id,document_sha256,run_id,created_at,lessons(slug,title,status)' +
      '&order=created_at.asc&limit=200',
  );
  const parsed = z.array(PendingRow).safeParse(rows);
  if (!parsed.success) return null;
  return parsed.data.map((r) => ({
    requestId: r.id,
    lessonId: r.lesson_id,
    lessonSlug: r.lessons?.slug ?? null,
    lessonTitle: titleOf(r.lessons?.title),
    lessonStatus: r.lessons?.status ?? null,
    locale: r.locale,
    documentVersionId: r.document_version_id,
    versionId: r.version_id,
    documentSha256: r.document_sha256,
    runId: r.run_id,
    submittedAt: r.created_at,
  }));
}

const DecisionRows = z.array(z.object({ ok: z.boolean(), code: z.string(), message: z.string() })).min(1);
export type VersionDecision = { outcome: 'done'; code: string } | { outcome: 'refused'; code: string; message: string } | { outcome: 'unavailable' };

async function decide(fn: 'release_lesson_version' | 'reject_lesson_version', body: Record<string, unknown>): Promise<VersionDecision> {
  const raw = await serviceRestRaw(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) });
  if (!raw.ok) {
    // GAP-FIX-R6: Vault's release gate refuses a version no passing Stage 3 review covers (the pointer does not move).
    const stage3 = stage3RefusalMessage(raw.body);
    return stage3 === null ? { outcome: 'unavailable' } : { outcome: 'refused', code: STAGE3_REFUSAL, message: stage3 };
  }
  const parsed = DecisionRows.safeParse(raw.body);
  if (!parsed.success) return { outcome: 'unavailable' };
  const row = parsed.data[0]!;
  return row.ok ? { outcome: 'done', code: row.code } : { outcome: 'refused', code: row.code, message: row.message };
}

/** The staff approval: Vault re-checks the actor and the course verification, moves the pointer and audits it. */
export function releaseLessonVersion(actorId: string, lessonId: string, documentVersionId: string): Promise<VersionDecision> {
  return decide('release_lesson_version', { p_actor: actorId, p_lesson_id: lessonId, p_document_version_id: documentVersionId });
}

export function rejectLessonVersion(actorId: string, lessonId: string, documentVersionId: string, reason: string): Promise<VersionDecision> {
  return decide('reject_lesson_version', { p_actor: actorId, p_lesson_id: lessonId, p_document_version_id: documentVersionId, p_reason: reason });
}

// ── Retroactive release checks (Appendix N 1.2) ─────────────────────────────

const count = z.coerce.number().int().nonnegative();
const MetricsRows = z.array(z.object({
  publish_actions: count, bypasses: count, decided: count, unverified: count, complete: count, overdue_open: count,
})).length(1);
const CheckRows = z.array(z.object({
  id: z.coerce.number(),
  action: z.string(),
  lesson_id: z.string().nullable(),
  course_id: z.string().nullable(),
  locale: z.string().nullable(),
  occurred_at: z.string(),
  due_at: z.string(),
  justified: z.boolean(),
  closed_at: z.string().nullable(),
  closing_verified_at: z.string().nullable(),
  state: z.enum(['open', 'closed', 'closed_late', 'overdue']),
}));

export type BypassMetrics = z.infer<typeof MetricsRows>[number];

export interface BypassReport {
  windowDays: number;
  retroCheckDays: number;
  /**
   * Release-Verification Bypass Rate: bypasses with no retroactive check within
   * 30 days (overdue, or closed late) over every publish action in the window
   * (staff releases plus bypasses). Target 0. Null with no publish action.
   */
  bypassRate: number | null;
  /**
   * Bypass-Path Justification & Retroactive-Check Completeness: of the
   * bypasses whose outcome is known (closed, or past due), the share with a
   * justification AND a check closed within 30 days. Target 1. Null when none
   * is decided yet.
   */
  completenessRate: number | null;
  counts: { publishActions: number; bypasses: number; decided: number; unverified: number; complete: number; pending: number; overdue: number };
  checks: {
    id: number; action: string; lessonId: string | null; courseId: string | null; locale: string | null;
    occurredAt: string; dueAt: string; justified: boolean; closedAt: string | null; closingVerifiedAt: string | null;
    state: 'open' | 'closed' | 'closed_late' | 'overdue';
  }[];
}

/** Pure: the two Appendix N 1.2 rates from the counts. */
export function bypassRates(m: BypassMetrics): { bypassRate: number | null; completenessRate: number | null } {
  return {
    bypassRate: m.publish_actions === 0 ? null : m.unverified / m.publish_actions,
    completenessRate: m.decided === 0 ? null : m.complete / m.decided,
  };
}

async function readMetrics(days: number): Promise<BypassMetrics | null> {
  const rows = await serviceRest<unknown>('/rpc/content_bypass_metrics', { method: 'POST', body: JSON.stringify({ p_days: days }) });
  const parsed = MetricsRows.safeParse(rows);
  return parsed.success ? parsed.data[0]! : null;
}

export async function getContentBypassReport(days: number = BYPASS_WINDOW_DAYS): Promise<BypassReport | null> {
  const [metrics, rows] = await Promise.all([
    readMetrics(days),
    serviceRest<unknown>('/rpc/content_bypass_checks', { method: 'POST', body: JSON.stringify({ p_days: days }) }),
  ]);
  const checks = CheckRows.safeParse(rows);
  if (!metrics || !checks.success) return null;
  return {
    windowDays: days,
    retroCheckDays: RETRO_CHECK_DAYS,
    ...bypassRates(metrics),
    counts: {
      publishActions: metrics.publish_actions,
      bypasses: metrics.bypasses,
      decided: metrics.decided,
      unverified: metrics.unverified,
      complete: metrics.complete,
      pending: metrics.bypasses - metrics.decided,
      overdue: metrics.overdue_open,
    },
    checks: checks.data.map((c) => ({
      id: c.id, action: c.action, lessonId: c.lesson_id, courseId: c.course_id, locale: c.locale,
      occurredAt: c.occurred_at, dueAt: c.due_at, justified: c.justified, closedAt: c.closed_at,
      closingVerifiedAt: c.closing_verified_at, state: c.state,
    })),
  };
}

/** The operations watchdog's number: retroactive checks past their 30 days and still open (any age). Null when unreadable. */
export async function getOverdueRetroChecks(): Promise<number | null> {
  const metrics = await readMetrics(BYPASS_WINDOW_DAYS);
  return metrics === null ? null : metrics.overdue_open;
}
