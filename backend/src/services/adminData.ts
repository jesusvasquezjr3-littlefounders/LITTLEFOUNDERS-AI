import { grantRole, insertAuditLog, revokeRole, serviceRest } from './supabaseRest.js';

/*
 * Staff-console data plane (routes/admin.ts). Every read here is service-role
 * and platform-wide (all users' rows) — the console's job — so it is gated by
 * requireRole(['admin','superadmin']) at the route, and role mutations gate
 * further on superadmin (§1.4). No minor PII leaves the platform; these are
 * internal reads for staff. Counts are computed in JS (young platform, small
 * tables); revisit with PostgREST count headers if the row counts grow large.
 */

type Localized = Record<string, string> | null;

/** First available locale of a localized jsonb title, for compact display. */
function pickTitle(title: Localized): string {
  if (!title) return '—';
  return title['en-US'] ?? title['es-MX'] ?? title['pt-BR'] ?? Object.values(title)[0] ?? '—';
}

function tally(rows: { status?: string; role?: string }[], key: 'status' | 'role'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r[key];
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// ── Overview ────────────────────────────────────────────────────────────────

export interface AdminOverview {
  users: { total: number; byRole: Record<string, number> };
  content: { courses: Record<string, number>; lessons: Record<string, number>; reviewQueue: number };
  audit: { recent: number };
}

export async function getAdminOverview(): Promise<AdminOverview | null> {
  const [profiles, roles, courses, lessons, audit] = await Promise.all([
    serviceRest<{ user_id: string }[]>('/profiles?select=user_id'),
    serviceRest<{ role: string }[]>('/user_roles?select=role'),
    serviceRest<{ status: string }[]>('/courses?select=status'),
    serviceRest<{ status: string }[]>('/lessons?select=status'),
    serviceRest<{ id: number }[]>('/audit_logs?select=id&order=id.desc&limit=500'),
  ]);
  if (!profiles || !roles || !courses || !lessons || !audit) return null;
  const lessonsByStatus = tally(lessons, 'status');
  return {
    users: { total: profiles.length, byRole: tally(roles, 'role') },
    content: { courses: tally(courses, 'status'), lessons: lessonsByStatus, reviewQueue: lessonsByStatus.review ?? 0 },
    audit: { recent: audit.length },
  };
}

// ── Users / Support ───────────────────────────────────────────────────────────

export interface AdminUser {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string;
  createdAt: string;
  roles: string[];
}

export async function listAdminUsers(limit = 100): Promise<AdminUser[] | null> {
  const profiles = await serviceRest<
    { user_id: string; display_name: string; username: string | null; locale: string; created_at: string }[]
  >(`/profiles?select=user_id,display_name,username,locale,created_at&order=created_at.desc&limit=${limit}`);
  if (!profiles) return null;
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.user_id).join(',');
  const roleRows = await serviceRest<{ user_id: string; role: string }[]>(
    `/user_roles?user_id=in.(${ids})&select=user_id,role`,
  );
  if (!roleRows) return null;
  const byUser = new Map<string, string[]>();
  for (const r of roleRows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  return profiles.map((p) => ({
    userId: p.user_id,
    displayName: p.display_name,
    username: p.username,
    locale: p.locale,
    createdAt: p.created_at,
    roles: byUser.get(p.user_id) ?? [],
  }));
}

// ── Content ──────────────────────────────────────────────────────────────────

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  subject: string;
  status: string;
  position: number;
}

export async function listAdminCourses(): Promise<AdminCourse[] | null> {
  const rows = await serviceRest<
    { id: string; slug: string; title: Localized; subject: string; status: string; position: number }[]
  >('/courses?select=id,slug,title,subject,status,position&order=position.asc');
  if (!rows) return null;
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: pickTitle(c.title),
    subject: c.subject,
    status: c.status,
    position: c.position,
  }));
}

const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export function isCourseStatus(s: string): s is CourseStatus {
  return (COURSE_STATUSES as readonly string[]).includes(s);
}

/** Flip a course's publish state (the review→published human gate, §1.9). Audited. */
export async function setCourseStatus(courseId: string, status: CourseStatus, actorId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(`/courses?id=eq.${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  });
  if (res === null) return false;
  await insertAuditLog(actorId, 'admin.course.set_status', courseId, { status });
  return true;
}

// ── Moderation (lesson review gate) ──────────────────────────────────────────

export interface AdminReviewLesson {
  id: string;
  slug: string;
  title: string;
  status: string;
}

export async function listReviewLessons(): Promise<AdminReviewLesson[] | null> {
  const rows = await serviceRest<{ id: string; slug: string; title: Localized; status: string }[]>(
    '/lessons?status=eq.review&select=id,slug,title,status&order=slug.asc',
  );
  if (!rows) return null;
  return rows.map((l) => ({ id: l.id, slug: l.slug, title: pickTitle(l.title), status: l.status }));
}

const LESSON_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export function isLessonStatus(s: string): s is LessonStatus {
  return (LESSON_STATUSES as readonly string[]).includes(s);
}

/** Approve (review→published) or reject (review→draft) a lesson at the human gate. Audited. */
export async function setLessonStatus(lessonId: string, status: LessonStatus, actorId: string): Promise<boolean> {
  const res = await serviceRest<unknown>(`/lessons?id=eq.${encodeURIComponent(lessonId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  });
  if (res === null) return false;
  await insertAuditLog(actorId, 'admin.lesson.set_status', lessonId, { status });
  return true;
}

// ── Audit log ────────────────────────────────────────────────────────────────

export interface AdminAuditEntry {
  id: number;
  actorId: string | null;
  action: string;
  subject: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export async function listAudit(limit = 50, offset = 0): Promise<AdminAuditEntry[] | null> {
  const rows = await serviceRest<
    { id: number; actor_id: string | null; action: string; subject: string; detail: Record<string, unknown>; created_at: string }[]
  >(`/audit_logs?select=id,actor_id,action,subject,detail,created_at&order=id.desc&limit=${limit}&offset=${offset}`);
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    action: r.action,
    subject: r.subject,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

// ── Roles & Access (superadmin) ──────────────────────────────────────────────

export interface AdminRoleHolder {
  userId: string;
  displayName: string;
  username: string | null;
  roles: string[];
}

/** Everyone who holds a STAFF or upgraded role (not the universal baseline). */
export async function listRoleHolders(): Promise<AdminRoleHolder[] | null> {
  const rows = await serviceRest<{ user_id: string; role: string }[]>(
    "/user_roles?role=neq.universal&select=user_id,role&order=user_id.asc",
  );
  if (!rows) return null;
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.user_id))].join(',');
  const profiles = await serviceRest<{ user_id: string; display_name: string; username: string | null }[]>(
    `/profiles?user_id=in.(${ids})&select=user_id,display_name,username`,
  );
  if (!profiles) return null;
  const pByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  return [...byUser.entries()].map(([userId, roles]) => ({
    userId,
    displayName: pByUser.get(userId)?.display_name ?? '—',
    username: pByUser.get(userId)?.username ?? null,
    roles,
  }));
}

export interface RoleMutationResult {
  ok: boolean;
  code?: 'DB_REJECTED';
}

/** superadmin-only. grantRole/revokeRole are audited by the DB trigger; the
 * DB triggers (superadmin-domain, admin-must-have-superadmin-granter,
 * kid-guardian, parent-cascade) are the real guardrails and will reject
 * invalid mutations — we surface that as DB_REJECTED. */
export async function grantRoleChecked(userId: string, role: string, actorId: string): Promise<RoleMutationResult> {
  const ok = await grantRole(userId, role, actorId);
  return ok ? { ok: true } : { ok: false, code: 'DB_REJECTED' };
}

export async function revokeRoleChecked(userId: string, role: string): Promise<RoleMutationResult> {
  const ok = await revokeRole(userId, role);
  return ok ? { ok: true } : { ok: false, code: 'DB_REJECTED' };
}

// ── Learning retention (0016) ───────────────────────────────────────────────

export interface RetentionBucket {
  bucket: string;
  n: number;
  avg_first_attempt_score: number;
}

export interface RetentionTopicRow {
  source_topic_slug: string;
  source_topic_title: Localized;
  n: number;
  avg_first_attempt_score: number;
}

export interface LearningRetention {
  buckets: RetentionBucket[];
  byTopic: { slug: string; title: string; n: number; avgFirstAttemptScore: number }[];
}

/**
 * Always-on retention measurement: our spaced-review lessons ARE the delayed
 * test (Learn Your Way analysis, 2026-07-25), so first-EVER-attempt scores on
 * them, bucketed by days since the learner last practiced the cited source
 * topics, are per-concept forgetting curves at zero extra assessment cost.
 * Computation lives in Vault (admin_retention_* functions, migration 0016 —
 * EXECUTE revoked from client roles); Core just brokers it to the console.
 */
export async function getLearningRetention(): Promise<LearningRetention | null> {
  const [buckets, byTopic] = await Promise.all([
    serviceRest<RetentionBucket[]>('/rpc/admin_retention_at_distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
    serviceRest<RetentionTopicRow[]>('/rpc/admin_retention_by_topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  ]);
  if (!buckets || !byTopic) return null;
  return {
    buckets,
    byTopic: byTopic.map((r) => ({
      slug: r.source_topic_slug,
      title: pickTitle(r.source_topic_title),
      n: r.n,
      avgFirstAttemptScore: r.avg_first_attempt_score,
    })),
  };
}

// ── Generation telemetry (0017) ─────────────────────────────────────────────

export interface GenerationRunListItem {
  runId: string;
  trackId: string | null;
  courseSlug: string;
  register: string;
  published: number;
  failed: number;
  slotsEnumerated: number;
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
  updatedAt: string;
}

export interface GenerationTrackListItem {
  trackId: string;
  courseSlug: string;
  budgetUsd: number | null;
  halted: string | null;
  totals: Record<string, number>;
  failureHeatmap: Record<string, number>;
  mopUp: string[];
  shards: number;
  updatedAt: string;
}

export interface GenerationOverview {
  tracks: GenerationTrackListItem[];
  runs: GenerationRunListItem[];
}

interface GenerationRunRow {
  run_id: string;
  track_id: string | null;
  course_slug: string;
  register: string;
  summary: {
    published?: string[];
    failed?: { slotId: string; error: string; failedFrom?: string }[];
    slotsEnumerated?: number;
  } & Record<string, unknown>;
  tokens_used: number;
  usd_used: number | string;
  cached_tokens: number;
  images_generated: number;
  images_billed: number;
  updated_at: string;
}

function mapRunRow(r: GenerationRunRow): GenerationRunListItem {
  return {
    runId: r.run_id,
    trackId: r.track_id,
    courseSlug: r.course_slug,
    register: r.register,
    published: r.summary.published?.length ?? 0,
    failed: r.summary.failed?.length ?? 0,
    slotsEnumerated: r.summary.slotsEnumerated ?? 0,
    tokensUsed: r.tokens_used,
    // numeric columns arrive as strings through PostgREST — normalize once here.
    usdUsed: Number(r.usd_used),
    cachedTokens: r.cached_tokens,
    imagesGenerated: r.images_generated,
    imagesBilled: r.images_billed,
    updatedAt: r.updated_at,
  };
}

/**
 * The Generation console's landing data: recent tracks + recent runs from the
 * 0017 telemetry tables (written by coursegen at the end of every non-dry
 * run; service-role-only — this console is their ONLY reader).
 */
export async function getGenerationOverview(): Promise<GenerationOverview | null> {
  const [tracks, runs] = await Promise.all([
    serviceRest<
      {
        track_id: string;
        course_slug: string;
        budget_usd: number | string | null;
        halted: string | null;
        report: {
          totals?: Record<string, number>;
          failureHeatmap?: Record<string, number>;
          mopUp?: string[];
          shards?: unknown[];
        } & Record<string, unknown>;
        updated_at: string;
      }[]
    >('/generation_tracks?select=track_id,course_slug,budget_usd,halted,report,updated_at&order=updated_at.desc&limit=10'),
    serviceRest<GenerationRunRow[]>(
      '/generation_runs?select=run_id,track_id,course_slug,register,summary,tokens_used,usd_used,cached_tokens,images_generated,images_billed,updated_at&order=updated_at.desc&limit=20',
    ),
  ]);
  if (!tracks || !runs) return null;
  return {
    tracks: tracks.map((t) => ({
      trackId: t.track_id,
      courseSlug: t.course_slug,
      budgetUsd: t.budget_usd === null ? null : Number(t.budget_usd),
      halted: t.halted,
      totals: t.report.totals ?? {},
      failureHeatmap: t.report.failureHeatmap ?? {},
      mopUp: t.report.mopUp ?? [],
      shards: t.report.shards?.length ?? 0,
      updatedAt: t.updated_at,
    })),
    runs: runs.map(mapRunRow),
  };
}

export interface GenerationSlotItem {
  slotId: string;
  state: string;
  failedFrom: string | null;
  error: string | null;
  salvaged: boolean;
  droppedSegments: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  durationMs: number | null;
  rubric: Record<string, number | string> | null;
  reviewCycles: number | null;
  earlyStopped: boolean;
}

export interface GenerationRunDetail {
  run: GenerationRunListItem & { summary: Record<string, unknown>; params: Record<string, unknown> };
  slots: GenerationSlotItem[];
}

export async function getGenerationRun(runId: string): Promise<GenerationRunDetail | null> {
  const encoded = encodeURIComponent(runId);
  const [runs, slots] = await Promise.all([
    serviceRest<(GenerationRunRow & { params: Record<string, unknown> })[]>(
      `/generation_runs?run_id=eq.${encoded}&select=run_id,track_id,course_slug,register,params,summary,tokens_used,usd_used,cached_tokens,images_generated,images_billed,updated_at`,
    ),
    serviceRest<
      {
        slot_id: string;
        state: string;
        failed_from: string | null;
        error: string | null;
        salvaged: boolean;
        dropped_segments: number;
        images_generated: number;
        images_billed: number;
        images_inherited: number;
        duration_ms: number | null;
        rubric: Record<string, number | string> | null;
        review_cycles: number | null;
        early_stopped: boolean;
      }[]
    >(
      `/generation_slots?run_id=eq.${encoded}&select=slot_id,state,failed_from,error,salvaged,dropped_segments,images_generated,images_billed,images_inherited,duration_ms,rubric,review_cycles,early_stopped&order=slot_id.asc`,
    ),
  ]);
  if (!runs || !slots) return null;
  const runRow = runs[0];
  if (!runRow) return null;
  return {
    run: { ...mapRunRow(runRow), summary: runRow.summary, params: runRow.params ?? {} },
    slots: slots.map((s) => ({
      slotId: s.slot_id,
      state: s.state,
      failedFrom: s.failed_from,
      error: s.error,
      salvaged: s.salvaged,
      droppedSegments: s.dropped_segments,
      imagesGenerated: s.images_generated,
      imagesBilled: s.images_billed,
      imagesInherited: s.images_inherited,
      durationMs: s.duration_ms,
      rubric: s.rubric,
      reviewCycles: s.review_cycles,
      earlyStopped: s.early_stopped,
    })),
  };
}
