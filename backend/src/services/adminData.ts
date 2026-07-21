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
