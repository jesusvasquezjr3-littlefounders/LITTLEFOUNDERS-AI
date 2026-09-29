import { stripAnswers } from './lessonDocument.js';
import { z } from 'zod';
import {
  countServiceRows,
  getLessonDocumentLocales,
  grantRole,
  grantAdminPermission,
  serviceRest,
  serviceRestRaw,
} from './supabaseRest.js';
import { listMinorRecordTutors } from './tutorAgeRecord.js';

/*
 * Staff-console data plane (routes/admin.ts). Reads here use the service role
 * and may span platform rows, so the route checks staff role and the current
 * named permission before invoking each category. Role/grant mutations require
 * Superadmin. No minor PII leaves the platform; these are
 * internal reads for staff. Overview status totals use PostgREST exact counts;
 * identity/role rows are paged so the dashboard never silently stops at the
 * default 1,000-row response limit.
 */

type Localized = Record<string, string> | null;

/** First available locale of a localized jsonb title, for compact display. */
function pickTitle(title: Localized): string {
  if (!title) return '—';
  return title['en-US'] ?? title['es-MX'] ?? title['pt-BR'] ?? Object.values(title)[0] ?? '—';
}

// ── Overview ────────────────────────────────────────────────────────────────

const ROLE_ORDER = ['superadmin', 'admin', 'bigfounder', 'parent', 'kid', 'universal'] as const;
const COURSE_STATUS_ORDER = ['published', 'draft', 'archived'] as const;
const LESSON_STATUS_ORDER = ['published', 'review', 'draft', 'archived'] as const;
const OVERVIEW_PAGE_SIZE = 1000;

async function listAllServiceRows<T>(path: string): Promise<T[] | null> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += OVERVIEW_PAGE_SIZE) {
    const page = await serviceRest<T[]>(`${path}&limit=${OVERVIEW_PAGE_SIZE}&offset=${offset}`);
    if (!page) return null;
    rows.push(...page);
    if (page.length < OVERVIEW_PAGE_SIZE) return rows;
  }
}

async function countStatuses(table: 'courses' | 'lessons', statuses: readonly string[]): Promise<Record<string, number> | null> {
  const counts = await Promise.all(
    statuses.map(async (status) => [status, await countServiceRows(`/${table}?status=eq.${status}&select=id`)] as const),
  );
  if (counts.some(([, count]) => count === null)) return null;
  const result: Record<string, number> = {};
  for (const [status, count] of counts) result[status] = count as number;
  return result;
}

function primaryRole(roleRows: string[]): (typeof ROLE_ORDER)[number] {
  return ROLE_ORDER.find((role) => roleRows.includes(role)) ?? 'universal';
}

export interface AdminOverview {
  users?: { total: number; byRole: Record<string, number>; staff: number };
  content?: { courses: Record<string, number>; lessons: Record<string, number>; reviewQueue: number };
  audit?: { total: number };
}

export async function getAdminOverview(
  allowed: { users: boolean; content: boolean; audit: boolean } = { users: true, content: true, audit: true },
): Promise<AdminOverview | null> {
  const [profiles, roles, courses, lessons, auditTotal] = await Promise.all([
    allowed.users ? listAllServiceRows<{ user_id: string }>('/profiles?select=user_id&order=user_id.asc') : Promise.resolve([]),
    allowed.users ? listAllServiceRows<{ user_id: string; role: string }>('/user_roles?select=user_id,role&order=user_id.asc,role.asc') : Promise.resolve([]),
    allowed.content ? countStatuses('courses', COURSE_STATUS_ORDER) : Promise.resolve({}),
    allowed.content ? countStatuses('lessons', LESSON_STATUS_ORDER) : Promise.resolve({}),
    allowed.audit ? countServiceRows('/audit_logs?select=id') : Promise.resolve(0),
  ]);
  if (!profiles || !roles || !courses || !lessons || auditTotal === null) return null;

  const overview: AdminOverview = {};
  if (allowed.users) {
    const profileIds = new Set(profiles.map((profile) => profile.user_id));
    const rolesByUser = new Map<string, string[]>();
    for (const row of roles) {
      if (profileIds.has(row.user_id)) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
    }

    // A person can hold multiple role rows (universal is retained on upgrades).
    // The overview is a people distribution, so each profile belongs to exactly
    // one highest-privilege bucket, matching /admin/users.
    const byRole: Record<string, number> = {};
    for (const profile of profiles) {
      const role = primaryRole(rolesByUser.get(profile.user_id) ?? []);
      byRole[role] = (byRole[role] ?? 0) + 1;
    }
    overview.users = { total: profiles.length, byRole, staff: (byRole.admin ?? 0) + (byRole.superadmin ?? 0) };
  }
  if (allowed.content) overview.content = { courses, lessons, reviewQueue: (lessons as Record<string, number>).review ?? 0 };
  if (allowed.audit) overview.audit = { total: auditTotal };
  return overview;
}

// ── Users / Support ───────────────────────────────────────────────────────────

export interface AdminUser {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string;
  createdAt: string;
  birthDate: string | null;
  roles: string[];
  /** A.5: null = no verification row; 'id-verified' = latest row is local-ocr verified; 'staff-granted' = latest verified row via another method (or parent role with no verification row — distinguished where it matters); 'revoked' = latest row revoked. */
  verification: 'id-verified' | 'staff-granted' | 'revoked' | null;
  /**
   * A.2, A.5, OD-3 section 2 (F3-identity-site): true when the account holds
   * the parent role while its own age record says a minor. Staff review it
   * (revoke, or settle an E.4 age correction); it is never demoted silently.
   */
  ageRecordMinor: boolean;
}

export async function listAdminUsers(): Promise<AdminUser[] | null> {
  const profiles = await listAllServiceRows<{
    user_id: string;
    display_name: string;
    username: string | null;
    locale: string;
    created_at: string;
    birth_date: string | null;
  }>('/profiles?select=user_id,display_name,username,locale,created_at,birth_date&order=created_at.desc');
  if (!profiles) return null;
  if (profiles.length === 0) return [];
  const roleRows = await listAllServiceRows<{ user_id: string; role: string }>(
    '/user_roles?select=user_id,role&order=user_id.asc,role.asc',
  );
  if (!roleRows) return null;
  // A.5: the latest verification row per user — read ALL rows ordered newest
  // first and keep the first per user. Volume is bounded (one row per
  // verified/revoked parent, never per session).
  const verificationRows = await listAllServiceRows<{
    user_id: string;
    status: 'verified' | 'revoked';
    method: string;
  }>('/parent_verifications?select=user_id,status,method&order=created_at.desc,id.desc');
  if (!verificationRows) return null;
  // A.2/A.5: a Tutor whose age record says a minor is flagged for review; an
  // unreadable answer fails the directory rather than hiding the flag.
  const minorRecord = await listMinorRecordTutors();
  if (!minorRecord) return null;
  const latestVerification = new Map<string, { status: 'verified' | 'revoked'; method: string }>();
  for (const row of verificationRows) {
    if (!latestVerification.has(row.user_id)) latestVerification.set(row.user_id, { status: row.status, method: row.method });
  }
  const profileIds = new Set(profiles.map((profile) => profile.user_id));
  const byUser = new Map<string, string[]>();
  for (const r of roleRows) {
    if (profileIds.has(r.user_id)) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  }
  return profiles.map((p) => {
    const latest = latestVerification.get(p.user_id);
    const roles = byUser.get(p.user_id) ?? [];
    // A.5: a parent role with no verification row is a staff grant — the
    // console must say so rather than showing an empty verification slot.
    const verification = latest === undefined
      ? roles.includes('parent') ? 'staff-granted' as const : null
      : latest.status === 'revoked' ? 'revoked' as const
      : latest.method === 'local-ocr' ? 'id-verified' as const
      : 'staff-granted' as const;
    return {
      userId: p.user_id,
      displayName: p.display_name,
      username: p.username,
      locale: p.locale,
      createdAt: p.created_at,
      birthDate: p.birth_date,
      roles,
      verification,
      ageRecordMinor: minorRecord.has(p.user_id),
    };
  });
}

export async function getSignupTimeline(days = 90): Promise<{ date: string; count: number }[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const profiles = await serviceRest<
    { created_at?: string }[]
  >(`/profiles?select=created_at&created_at=gte.${cutoff.toISOString().slice(0, 10)}&order=created_at.asc`);
  if (!profiles) return [];
  const byDay = new Map<string, number>();
  for (const p of profiles) {
    const d = (p.created_at ?? '').slice(0, 10);
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const result: { date: string; count: number }[] = [];
  const start = new Date(cutoff);
  while (start <= new Date()) {
    const key = start.toISOString().slice(0, 10);
    result.push({ date: key, count: byDay.get(key) ?? 0 });
    start.setDate(start.getDate() + 1);
  }
  return result;
}

// ── Content ──────────────────────────────────────────────────────────────────

export interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  subject: string;
  status: string;
  position: number;
  createdAt: string;
  adventureCount: number;
  sagaCount: number;
  topicCount: number;
  lessonCount: number;
  lessonsByStatus: Record<string, number>;
}

interface CourseHierarchyRows {
  courses: {
    id: string;
    slug: string;
    title: Localized;
    description: Localized;
    subject: string;
    status: string;
    position: number;
    created_at: string;
  }[];
  adventures: { id: string; course_id: string; title: Localized; status: string }[];
  sagas: { id: string; adventure_id: string; title: Localized; status: string }[];
  topics: { id: string; saga_id: string; title: Localized; status: string }[];
  lessons: {
    id: string;
    topic_id: string;
    slug: string;
    title: Localized;
    difficulty: number;
    xp_total: number;
    estimated_minutes: number;
    status: string;
    created_at: string;
  }[];
}

async function loadCourseHierarchyRows(): Promise<CourseHierarchyRows | null> {
  const [courses, adventures, sagas, topics, lessons] = await Promise.all([
    listAllServiceRows<CourseHierarchyRows['courses'][number]>(
      '/courses?select=id,slug,title,description,subject,status,position,created_at&order=position.asc,id.asc',
    ),
    listAllServiceRows<CourseHierarchyRows['adventures'][number]>(
      '/adventures?select=id,course_id,title,status&order=course_id.asc,id.asc',
    ),
    listAllServiceRows<CourseHierarchyRows['sagas'][number]>(
      '/sagas?select=id,adventure_id,title,status&order=adventure_id.asc,id.asc',
    ),
    listAllServiceRows<CourseHierarchyRows['topics'][number]>(
      '/topics?select=id,saga_id,title,status&order=saga_id.asc,id.asc',
    ),
    listAllServiceRows<CourseHierarchyRows['lessons'][number]>(
      '/lessons?select=id,topic_id,slug,title,difficulty,xp_total,estimated_minutes,status,created_at&order=topic_id.asc,position.asc,id.asc',
    ),
  ]);
  if (!courses || !adventures || !sagas || !topics || !lessons) return null;
  return { courses, adventures, sagas, topics, lessons };
}

function hierarchyIndexes(rows: CourseHierarchyRows) {
  const adventureById = new Map(rows.adventures.map((row) => [row.id, row]));
  const sagaById = new Map(rows.sagas.map((row) => [row.id, row]));
  const topicById = new Map(rows.topics.map((row) => [row.id, row]));
  const courseById = new Map(rows.courses.map((row) => [row.id, row]));
  const courseForLesson = (lesson: CourseHierarchyRows['lessons'][number]) => {
    const topic = topicById.get(lesson.topic_id);
    const saga = topic ? sagaById.get(topic.saga_id) : undefined;
    const adventure = saga ? adventureById.get(saga.adventure_id) : undefined;
    return adventure ? courseById.get(adventure.course_id) : undefined;
  };
  return { adventureById, sagaById, topicById, courseById, courseForLesson };
}

export async function listAdminCourses(): Promise<AdminCourse[] | null> {
  const rows = await loadCourseHierarchyRows();
  if (!rows) return null;
  return rows.courses.map((course) => {
    const adventures = rows.adventures.filter((row) => row.course_id === course.id);
    const adventureIds = new Set(adventures.map((row) => row.id));
    const sagas = rows.sagas.filter((row) => adventureIds.has(row.adventure_id));
    const sagaIds = new Set(sagas.map((row) => row.id));
    const topics = rows.topics.filter((row) => sagaIds.has(row.saga_id));
    const topicIds = new Set(topics.map((row) => row.id));
    const lessons = rows.lessons.filter((row) => topicIds.has(row.topic_id));
    const lessonsByStatus: Record<string, number> = {};
    for (const lesson of lessons) lessonsByStatus[lesson.status] = (lessonsByStatus[lesson.status] ?? 0) + 1;
    return {
      id: course.id,
      slug: course.slug,
      title: pickTitle(course.title),
      description: pickTitle(course.description),
      subject: course.subject,
      status: course.status,
      position: course.position,
      createdAt: course.created_at,
      adventureCount: adventures.length,
      sagaCount: sagas.length,
      topicCount: topics.length,
      lessonCount: lessons.length,
      lessonsByStatus,
    };
  });
}

export interface AdminContentSummary {
  courses: { total: number; published: number; draft: number; archived: number };
  lessons: { total: number; published: number; review: number; draft: number; archived: number };
}

export interface CourseAssemblyIncident {
  courseId: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** Persistent B.3 signals, deliberately without a raw parsing error or learner data. */
export async function listCourseAssemblyIncidents(): Promise<CourseAssemblyIncident[] | null> {
  const rows = await serviceRest<{
    course_id: string;
    occurrence_count: number;
    first_seen_at: string;
    last_seen_at: string;
  }[]>('/course_assembly_incidents?select=course_id,occurrence_count,first_seen_at,last_seen_at&order=last_seen_at.desc');
  if (!rows) return null;
  return rows.map((row) => ({
    courseId: row.course_id,
    occurrenceCount: row.occurrence_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));
}

// ── Report escalation queue (0108, E.3 — manage_support) ──────────────────

const SocialReportCaseRow = z.object({
  subject_id: z.string().uuid(),
  origin: z.enum(['report', 'pattern']),
  status: z.enum(['open', 'resolved']),
  first_seen_at: z.string().datetime({ offset: true }),
  last_seen_at: z.string().datetime({ offset: true }),
  resolved_at: z.string().datetime({ offset: true }).nullable(),
  resolved_by: z.string().uuid().nullable(),
});

const SocialReportRow = z.object({
  id: z.string().uuid(),
  reporter_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  category: z.enum(['unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other']),
  note: z.string().nullable(),
  status: z.enum(['open', 'resolved']),
  created_at: z.string().datetime({ offset: true }),
  resolved_at: z.string().datetime({ offset: true }).nullable(),
});

export interface SocialReportCase {
  subjectId: string;
  origin: 'report' | 'pattern';
  status: 'open' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reportCount: number;
  openReportCount: number;
}

/** The staff queue: one case per subject account, open cases first. */
export async function listSocialReportCases(limit: number, offset: number): Promise<SocialReportCase[] | null> {
  const raw = await serviceRest<unknown[]>(
    `/social_review_cases?select=subject_id,origin,status,first_seen_at,last_seen_at,resolved_at,resolved_by&order=status.asc,last_seen_at.desc&limit=${limit}&offset=${offset}`,
  );
  if (raw === null) return null;
  const parsed = z.array(SocialReportCaseRow).safeParse(raw);
  if (!parsed.success) return null;
  const cases = parsed.data;
  const counts = await reportCountsForSubjects(cases.map((row) => row.subject_id));
  if (counts === null) return null;
  return cases.map((row) => {
    const count = counts.get(row.subject_id) ?? { reportCount: 0, openReportCount: 0 };
    return {
      subjectId: row.subject_id,
      origin: row.origin,
      status: row.status,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      reportCount: count.reportCount,
      openReportCount: count.openReportCount,
    };
  });
}

async function reportCountsForSubjects(subjectIds: string[]): Promise<Map<string, { reportCount: number; openReportCount: number }> | null> {
  if (subjectIds.length === 0) return new Map();
  const filter = subjectIds.map((id) => `"${id}"`).join(',');
  const raw = await serviceRest<unknown[]>(
    `/social_reports?subject_id=in.(${filter})&select=subject_id,status`,
  );
  if (raw === null) return null;
  const parsed = z.array(z.object({ subject_id: z.string().uuid(), status: z.enum(['open', 'resolved']) })).safeParse(raw);
  if (!parsed.success) return null;
  const counts = new Map<string, { reportCount: number; openReportCount: number }>();
  for (const row of parsed.data) {
    const entry = counts.get(row.subject_id) ?? { reportCount: 0, openReportCount: 0 };
    entry.reportCount += 1;
    if (row.status === 'open') entry.openReportCount += 1;
    counts.set(row.subject_id, entry);
  }
  return counts;
}

export interface SocialReportCaseDetail extends SocialReportCase {
  reports: {
    id: string;
    reporterId: string;
    category: 'unwanted_contact' | 'harassment' | 'inappropriate_content' | 'impersonation' | 'other';
    note: string | null;
    status: 'open' | 'resolved';
    createdAt: string;
    resolvedAt: string | null;
  }[];
}

/** One case plus its reports, for the staff detail view. */
export async function getSocialReportCase(subjectId: string): Promise<SocialReportCaseDetail | null> {
  const [caseRows, reportRows] = await Promise.all([
    serviceRest<unknown[]>(`/social_review_cases?subject_id=eq.${subjectId}&select=subject_id,origin,status,first_seen_at,last_seen_at,resolved_at,resolved_by&limit=1`),
    serviceRest<unknown[]>(`/social_reports?subject_id=eq.${subjectId}&select=id,reporter_id,subject_id,category,note,status,created_at,resolved_at&order=created_at.asc,id.asc`),
  ]);
  if (caseRows === null || reportRows === null) return null;
  const parsedCase = z.array(SocialReportCaseRow).max(1).safeParse(caseRows);
  const parsedReports = z.array(SocialReportRow).safeParse(reportRows);
  if (!parsedCase.success || !parsedReports.success) return null;
  if (parsedCase.data.length === 0) return null;
  const row = parsedCase.data[0]!;
  const reports = parsedReports.data.filter((r) => r.subject_id === subjectId);
  return {
    subjectId: row.subject_id,
    origin: row.origin,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    reportCount: reports.length,
    openReportCount: reports.filter((r) => r.status === 'open').length,
    reports: reports.map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      category: r.category,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    })),
  };
}

/** Close a case (migration 0108's service-only transaction records the actor in the audit trail). */
export async function resolveSocialReviewCase(subjectId: string, actorId: string): Promise<'resolved' | 'not-found' | 'unavailable'> {
  const raw = await serviceRestRaw('/rpc/resolve_social_review_case', {
    method: 'POST',
    body: JSON.stringify({ p_subject: subjectId, p_resolved_by: actorId }),
  });
  if (raw.ok) return raw.body === true ? 'resolved' : 'not-found';
  return 'unavailable';
}

/**
 * A.5's real revocation trigger path: a staff action following a fraud
 * report writes a NEW parent_verifications row with status 'revoked' and
 * method 'staff-revoked' (0111 relaxes the applicant columns so no fake
 * identity data is invented). The resolver reads the latest row, so the
 * revocation supersedes any older approval and takes effect immediately at
 * the next Mentor/family admission; the parent role grant itself stays for
 * the audit trail's reconstruction. The caller must have already written
 * the audit row carrying the reason.
 */
/*
 * A.5 (Appendix M 1.2): the staff writes of the parent-verification tier go
 * through database functions (migration parent_grant_integrity) that commit
 * the row and its audited reason in ONE transaction. A refusal the database
 * names (a reason out of bounds, an actor without the role, a role trigger)
 * is 'rejected'; anything else, including a transport failure, is
 * 'unavailable' and the route answers 502: a write Core cannot confirm is
 * never reported as done.
 */
const DB_REFUSAL_CODES = new Set(['22023', '42501', '23503', '23514', 'P0001']);
function dbRefusal(body: unknown): { code: string; message: string } | null {
  const parsed = z.object({ code: z.string(), message: z.string() }).passthrough().safeParse(body);
  return parsed.success && DB_REFUSAL_CODES.has(parsed.data.code) ? { code: parsed.data.code, message: parsed.data.message } : null;
}

/*
 * 'minor_record' (F4-staff-ops, OD-3 section 2): the target's age record is a
 * minor's (kid role, under-13 origin, or an effective band under 13 or 13 to
 * 17). The database refuses before any write (staff_parent_grant_age_guard);
 * the age record is corrected through the E.4 review, never by a grant.
 */
/*
 * 'revoked' (GAP-FIX-R6 identity-site, A.5): staff revoked this adult's
 * verification; the database refuses the parent role on every path, the
 * staff grant included (tutor_revocation_cascade, PARENT_ROLE_REVOKED).
 */
export type ParentGrantOutcome = 'granted' | 'already_granted' | 'invalid' | 'minor_record' | 'revoked' | 'rejected' | 'unavailable';

export async function grantParentRoleWithJustification(userId: string, actorId: string, justification: string): Promise<ParentGrantOutcome> {
  const { ok, body } = await serviceRestRaw('/rpc/grant_parent_role_with_justification', {
    method: 'POST',
    body: JSON.stringify({ p_user: userId, p_actor: actorId, p_justification: justification }),
  });
  if (!ok) {
    const refusal = dbRefusal(body);
    if (!refusal) return 'unavailable';
    if (refusal.message.includes('PARENT_GRANT_JUSTIFICATION_REQUIRED')) return 'invalid';
    if (refusal.message.includes('PARENT_ROLE_REVOKED')) return 'revoked';
    return refusal.message.includes('PARENT_GRANT_MINOR_RECORD') ? 'minor_record' : 'rejected';
  }
  return body === 'granted' || body === 'already_granted' ? body : 'unavailable';
}

export type ParentRevokeOutcome = 'revoked' | 'not_found' | 'invalid' | 'rejected' | 'unavailable';

export async function revokeParentVerification(userId: string, actorId: string, reason: string): Promise<ParentRevokeOutcome> {
  const { ok, body } = await serviceRestRaw('/rpc/revoke_parent_verification', {
    method: 'POST',
    body: JSON.stringify({ p_user: userId, p_actor: actorId, p_reason: reason }),
  });
  if (!ok) {
    const refusal = dbRefusal(body);
    if (!refusal) return 'unavailable';
    return refusal.message.includes('PARENT_REVOKE_REASON_REQUIRED') ? 'invalid' : 'rejected';
  }
  return body === 'revoked' || body === 'not_found' ? body : 'unavailable';
}

// ── G.4: the access-review log (migration staff_access_reviews) ─────────────

/** The quarterly cadence G.4 names; Appendix N measures compliance against it. */
export const ACCESS_REVIEW_CADENCE_DAYS = 90;
export const STAFF_REVIEW_ROLES = ['admin', 'superadmin'] as const;
export const STAFF_REVIEW_PERMISSIONS = ['manage_users', 'manage_content', 'view_analytics', 'manage_support'] as const;

const ReviewGrant = z.object({
  userId: z.string().uuid(),
  kind: z.enum(['role', 'permission']),
  grant: z.enum([...STAFF_REVIEW_ROLES, ...STAFF_REVIEW_PERMISSIONS]),
  grantedAt: z.string(),
  lastReviewedAt: z.string().nullable(),
  due: z.boolean(),
});
const ReviewStatus = z.object({
  cadenceDays: z.number().int(),
  total: z.coerce.number().int().nonnegative(),
  stale: z.coerce.number().int().nonnegative(),
  reviewedEver: z.coerce.number().int().nonnegative(),
  grants: z.array(ReviewGrant),
});
export type AccessReviewGrant = z.infer<typeof ReviewGrant>;

export interface AccessReviewStatus {
  cadenceDays: number;
  grants: (AccessReviewGrant & { displayName: string; username: string | null })[];
  /** Appendix N: Access-Review Cadence Compliance (target 100%) and Stale-Grant Rate (trend to zero). */
  metrics: { total: number; stale: number; reviewedEver: number; compliance: number | null; staleRate: number | null };
}

export async function getAccessReviewStatus(cadenceDays = ACCESS_REVIEW_CADENCE_DAYS): Promise<AccessReviewStatus | null> {
  const raw = await serviceRest<unknown>('/rpc/staff_access_review_status', {
    method: 'POST',
    body: JSON.stringify({ p_cadence_days: cadenceDays }),
  });
  const parsed = ReviewStatus.safeParse(raw);
  if (!parsed.success) return null;
  const ids = [...new Set(parsed.data.grants.map((g) => g.userId))];
  const profiles = ids.length === 0 ? [] : await serviceRest<{ user_id: string; display_name: string; username: string | null }[]>(
    `/profiles?user_id=in.(${ids.join(',')})&select=user_id,display_name,username`,
  );
  if (!profiles) return null;
  const byId = new Map(profiles.map((p) => [p.user_id, p]));
  const { total, stale, reviewedEver } = parsed.data;
  return {
    cadenceDays: parsed.data.cadenceDays,
    grants: parsed.data.grants.map((g) => ({ ...g, displayName: byId.get(g.userId)?.display_name ?? '—', username: byId.get(g.userId)?.username ?? null })),
    metrics: {
      total,
      stale,
      reviewedEver,
      compliance: total === 0 ? null : (total - stale) / total,
      staleRate: total === 0 ? null : stale / total,
    },
  };
}

/**
 * G.4 (Appendix N 1.1): how many elevated grants are held (`total`) and how
 * many are past the review cadence (`due`), for the operations watchdog and
 * the quarterly review issue (services/opsJobs.ts). The same database verdict
 * the Roles & Access card lists; null when the read failed, never 0.
 */
export async function getAccessReviewCounts(cadenceDays = ACCESS_REVIEW_CADENCE_DAYS): Promise<{ due: number; total: number } | null> {
  const raw = await serviceRest<unknown>('/rpc/staff_access_review_status', {
    method: 'POST',
    body: JSON.stringify({ p_cadence_days: cadenceDays }),
  });
  const parsed = ReviewStatus.safeParse(raw);
  return parsed.success ? { due: parsed.data.stale, total: parsed.data.total } : null;
}

export type AccessReviewOutcome = 'recorded' | 'not_held' | 'rejected' | 'unavailable';

export async function recordAccessReview(input: {
  subjectId: string; kind: 'role' | 'permission'; grant: string; actorId: string; outcome: 'kept' | 'revoked'; note: string | null;
}): Promise<AccessReviewOutcome> {
  const { ok, body } = await serviceRestRaw('/rpc/record_staff_access_review', {
    method: 'POST',
    body: JSON.stringify({
      p_subject: input.subjectId, p_kind: input.kind, p_grant_key: input.grant, p_actor: input.actorId,
      p_outcome: input.outcome, p_note: input.note,
    }),
  });
  if (!ok) return dbRefusal(body) ? 'rejected' : 'unavailable';
  return body === 'recorded' || body === 'not_held' ? body : 'unavailable';
}

export async function getAdminContentSummary(): Promise<AdminContentSummary | null> {
  const [courses, lessons] = await Promise.all([
    countStatuses('courses', COURSE_STATUS_ORDER),
    countStatuses('lessons', LESSON_STATUS_ORDER),
  ]);
  if (!courses || !lessons) return null;
  return {
    courses: {
      total: Object.values(courses).reduce((sum, count) => sum + count, 0),
      published: courses.published ?? 0,
      draft: courses.draft ?? 0,
      archived: courses.archived ?? 0,
    },
    lessons: {
      total: Object.values(lessons).reduce((sum, count) => sum + count, 0),
      published: lessons.published ?? 0,
      review: lessons.review ?? 0,
      draft: lessons.draft ?? 0,
      archived: lessons.archived ?? 0,
    },
  };
}

const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export function isCourseStatus(s: string): s is CourseStatus {
  return (COURSE_STATUSES as readonly string[]).includes(s);
}

/** `blocked` carries the RPC's refusal verbatim so the route can map each
 * distinct cause (archived vs missing locale vs stale verification…) to its
 * own envelope error instead of one generic message. */
export type CourseStatusResult =
  | { outcome: 'ok' }
  | { outcome: 'blocked'; code: string; message: string }
  | { outcome: 'unavailable' };

interface CourseReleaseRow {
  ok: boolean;
  code: string;
  message: string;
  adventures_published: number;
  sagas_published: number;
  topics_published: number;
  lessons_published: number;
}

interface StatusMoveRow {
  ok: boolean;
  code: string;
  message: string;
}

/**
 * One receipt reader for the four audited status RPCs: a decision is 'ok'
 * only when Vault answered a row saying so. No row (a failed request, an
 * unreadable body) is 'unavailable', and the route answers 502: the decision
 * and its audit row either both committed or neither did, and Core does not
 * know which, so it never reports success.
 */
function statusReceipt(rows: StatusMoveRow[] | null): CourseStatusResult {
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row || typeof row.ok !== 'boolean' || typeof row.code !== 'string') return { outcome: 'unavailable' };
  if (!row.ok) return { outcome: 'blocked', code: row.code, message: typeof row.message === 'string' ? row.message : row.code };
  return { outcome: 'ok' };
}

/**
 * A publish click is a human approval, but it must release the complete
 * hierarchy atomically. Directly PATCHing courses.status left every child in
 * draft/review, making the course appear released to staff while remaining
 * invisible to learners. The Vault RPC preflights locale completeness and
 * lesson readiness before any state changes.
 *
 * G.3 (GAP-FIX-R5): every course decision names its staff actor and Vault
 * writes the central audit row in the SAME transaction ('admin.course.release'
 * from release_course, 'admin.course.set_status' from set_course_status), and
 * refuses an actor without the content permission (FORBIDDEN). Vault also
 * refuses a direct status PATCH, so no unaudited path is left here.
 */
export async function setCourseStatus(courseId: string, status: CourseStatus, actorId: string): Promise<CourseStatusResult> {
  if (status === 'published') {
    const rows = await serviceRest<CourseReleaseRow[]>('/rpc/release_course', {
      method: 'POST',
      body: JSON.stringify({ p_actor: actorId, p_course_id: courseId }),
    });
    return statusReceipt(rows);
  }
  const rows = await serviceRest<StatusMoveRow[]>('/rpc/set_course_status', {
    method: 'POST',
    body: JSON.stringify({ p_actor: actorId, p_course_id: courseId, p_status: status }),
  });
  return statusReceipt(rows);
}

// ── Moderation (lesson review gate) ──────────────────────────────────────────

export interface AdminReviewLesson {
  id: string;
  slug: string;
  title: string;
  status: string;
  courseTitle: string;
  subject: string;
  adventureTitle: string;
  sagaTitle: string;
  topicTitle: string;
  difficulty: number;
  xpTotal: number;
  estimatedMinutes: number;
  createdAt: string;
  locales: string[];
}

export async function listReviewLessons(): Promise<AdminReviewLesson[] | null> {
  const rows = await loadCourseHierarchyRows();
  const documents = await listAllServiceRows<{ lesson_id: string; locale: string }>(
    '/lesson_documents?select=lesson_id,locale&order=lesson_id.asc,locale.asc',
  );
  if (!rows || !documents) return null;
  const { adventureById, sagaById, topicById, courseForLesson } = hierarchyIndexes(rows);
  const localesByLesson = new Map<string, string[]>();
  for (const document of documents) localesByLesson.set(document.lesson_id, [...(localesByLesson.get(document.lesson_id) ?? []), document.locale]);
  return rows.lessons
    .filter((lesson) => lesson.status === 'review')
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((lesson) => {
      const topic = topicById.get(lesson.topic_id);
      const saga = topic ? sagaById.get(topic.saga_id) : undefined;
      const adventure = saga ? adventureById.get(saga.adventure_id) : undefined;
      const course = courseForLesson(lesson);
      return {
        id: lesson.id,
        slug: lesson.slug,
        title: pickTitle(lesson.title),
        status: lesson.status,
        courseTitle: pickTitle(course?.title ?? null),
        subject: course?.subject ?? 'mixed',
        adventureTitle: pickTitle(adventure?.title ?? null),
        sagaTitle: pickTitle(saga?.title ?? null),
        topicTitle: pickTitle(topic?.title ?? null),
        difficulty: lesson.difficulty,
        xpTotal: lesson.xp_total,
        estimatedMinutes: lesson.estimated_minutes,
        createdAt: lesson.created_at,
        locales: localesByLesson.get(lesson.id) ?? [],
      };
    });
}

export interface AdminLessonDocument {
  locale: string;
  schemaVersion: number;
  document: Record<string, unknown>;
  audio: Record<string, unknown>;
}

export interface AdminReviewLessonDetail extends AdminReviewLesson {
  documents: AdminLessonDocument[];
}

export async function getReviewLessonDetail(lessonId: string): Promise<AdminReviewLessonDetail | null> {
  const rows = await loadCourseHierarchyRows();
  const documents = await getLessonDocumentLocales(lessonId);
  if (!rows || !documents) return null;
  const lesson = rows.lessons.find((row) => row.id === lessonId);
  if (!lesson) return null;
  const { adventureById, sagaById, topicById, courseForLesson } = hierarchyIndexes(rows);
  const topic = topicById.get(lesson.topic_id);
  const saga = topic ? sagaById.get(topic.saga_id) : undefined;
  const adventure = saga ? adventureById.get(saga.adventure_id) : undefined;
  const course = courseForLesson(lesson);
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: pickTitle(lesson.title),
    status: lesson.status,
    courseTitle: pickTitle(course?.title ?? null),
    subject: course?.subject ?? 'mixed',
    adventureTitle: pickTitle(adventure?.title ?? null),
    sagaTitle: pickTitle(saga?.title ?? null),
    topicTitle: pickTitle(topic?.title ?? null),
    difficulty: lesson.difficulty,
    xpTotal: lesson.xp_total,
    estimatedMinutes: lesson.estimated_minutes,
    createdAt: lesson.created_at,
    locales: documents.map((document) => document.locale),
    documents: documents.map((document) => ({
      locale: document.locale,
      schemaVersion: document.schema_version,
      document: stripAnswers(document.document),
      audio: document.audio,
    })),
  };
}

const LESSON_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export function isLessonStatus(s: string): s is LessonStatus {
  return (LESSON_STATUSES as readonly string[]).includes(s);
}

/** Approve (review→published) or reject (review→draft) a lesson at the human gate. Audited. */
interface LessonReleaseRow {
  ok: boolean;
  code: string;
  message: string;
  lessons_published: number;
}

/**
 * Lesson status changes from the staff moderation queue. Publishing is a
 * RELEASE, never a status write (Product G.2, S05.4c): `release_lesson` runs
 * the same verification preflight as the course release (a fresh Forge
 * verify:course attesting every required release gate), and Vault refuses a
 * direct API-role status write. A rejection back to draft, a return to
 * review and a takedown go through `set_lesson_status`. Both name the staff
 * actor and write 'admin.lesson.release' / 'admin.lesson.set_status' in the
 * same transaction (G.3, GAP-FIX-R5); an unconfirmed write is 'unavailable'.
 */
export async function setLessonStatus(lessonId: string, status: LessonStatus, actorId: string): Promise<CourseStatusResult> {
  if (status === 'published') {
    const rows = await serviceRest<LessonReleaseRow[]>('/rpc/release_lesson', {
      method: 'POST',
      body: JSON.stringify({ p_actor: actorId, p_lesson_id: lessonId }),
    });
    return statusReceipt(rows);
  }
  const rows = await serviceRest<StatusMoveRow[]>('/rpc/set_lesson_status', {
    method: 'POST',
    body: JSON.stringify({ p_actor: actorId, p_lesson_id: lessonId, p_status: status }),
  });
  return statusReceipt(rows);
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

export interface AdminAuditQuery {
  limit: number;
  offset: number;
  action?: string;
  actorId?: string;
  subject?: string;
  from?: string;
  to?: string;
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

function auditFilters(query: AdminAuditQuery): string {
  const filters = [
    query.action ? `&action=eq.${encodeURIComponent(query.action)}` : '',
    query.actorId ? `&actor_id=eq.${encodeURIComponent(query.actorId)}` : '',
    query.subject ? `&subject=eq.${encodeURIComponent(query.subject)}` : '',
    query.from ? `&created_at=gte.${encodeURIComponent(`${query.from}T00:00:00.000Z`)}` : '',
    query.to ? `&created_at=lt.${encodeURIComponent(`${query.to}T23:59:59.999Z`)}` : '',
  ];
  return filters.join('');
}

export async function listAudit(query: AdminAuditQuery): Promise<AdminAuditPage | null> {
  const filters = auditFilters(query);
  const listPath = `/audit_logs?select=id,actor_id,action,subject,detail,created_at${filters}&order=id.desc&limit=${query.limit}&offset=${query.offset}`;
  const countPath = `/audit_logs?select=id${filters}`;
  const [rows, total] = await Promise.all([
    serviceRest<
      { id: number; actor_id: string | null; action: string; subject: string; detail: Record<string, unknown>; created_at: string }[]
    >(listPath),
    countServiceRows(countPath),
  ]);
  if (!rows || total === null) return null;
  return {
    entries: rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      action: r.action,
      subject: r.subject,
      detail: r.detail,
      createdAt: r.created_at,
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

// ── Roles & Access (superadmin) ──────────────────────────────────────────────

export const ADMIN_PERMISSIONS = ['manage_users', 'manage_content', 'view_analytics', 'manage_support'] as const;

export interface RoleAssignment {
  role: string;
  grantedAt: string | null;
  grantedBy: string | null;
}

export interface PermissionAssignment {
  permission: string;
  grantedAt: string | null;
  grantedBy: string | null;
}

export interface AdminRoleHolder {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string | null;
  createdAt: string | null;
  roles: string[];
  permissions: string[];
  roleAssignments: RoleAssignment[];
  permissionAssignments: PermissionAssignment[];
  lastChangedAt: string | null;
}

export interface AdminRolesSummary {
  totalHolders: number;
  totalRoleAssignments: number;
  totalPermissionAssignments: number;
  roleCounts: Record<string, number>;
  permissionCounts: Record<string, number>;
  lastChangedAt: string | null;
}

export interface AdminRolesData {
  holders: AdminRoleHolder[];
  summary: AdminRolesSummary;
}

export interface AdminRoleCandidate {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string | null;
  createdAt: string | null;
  roles: string[];
}

/** Searchable, read-only target list for safe role grants. */
export async function findRoleCandidates(query: string, limit: number): Promise<AdminRoleCandidate[] | null> {
  // PostgREST uses `*` as the `ilike` wildcard. Escape user-supplied asterisks
  // after URL encoding so the directory search cannot widen its predicate.
  const encoded = encodeURIComponent(query).replaceAll('*', '%2A');
  const profilePath = z.string().uuid().safeParse(query).success
    ? `/profiles?user_id=eq.${encoded}&select=user_id,display_name,username,locale,created_at&limit=${limit}`
    : `/profiles?or=(display_name.ilike.*${encoded}*,username.ilike.*${encoded}*)&select=user_id,display_name,username,locale,created_at&limit=${limit}`;
  const profiles = await serviceRest<{
    user_id: string;
    display_name: string;
    username: string | null;
    locale?: string | null;
    created_at?: string | null;
  }[]>(profilePath);
  if (!profiles) return null;
  if (profiles.length === 0) return [];
  const ids = profiles.map((profile) => profile.user_id).join(',');
  const roles = await serviceRest<{ user_id: string; role: string }[]>(
    `/user_roles?user_id=in.(${ids})&select=user_id,role&order=user_id.asc,role.asc`,
  );
  if (!roles) return null;
  const rolesByUser = new Map<string, string[]>();
  for (const row of roles) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
  return profiles.map((profile) => ({
    userId: profile.user_id,
    displayName: profile.display_name,
    username: profile.username,
    locale: profile.locale ?? null,
    createdAt: profile.created_at ?? null,
    roles: rolesByUser.get(profile.user_id) ?? [],
  }));
}

/** Everyone who holds a STAFF or upgraded role (not the universal baseline). */
export async function listRoleHolders(): Promise<AdminRolesData | null> {
  const rows = await serviceRest<{ user_id: string; role: string; granted_at?: string | null; granted_by?: string | null }[]>(
    "/user_roles?role=neq.universal&select=user_id,role,granted_at,granted_by&order=user_id.asc,role.asc",
  );
  if (!rows) return null;
  if (rows.length === 0) {
    return {
      holders: [],
      summary: {
        totalHolders: 0,
        totalRoleAssignments: 0,
        totalPermissionAssignments: 0,
        roleCounts: {},
        permissionCounts: {},
        lastChangedAt: null,
      },
    };
  }
  const ids = [...new Set(rows.map((r) => r.user_id))].join(',');
  const [profiles, perms] = await Promise.all([
    serviceRest<{ user_id: string; display_name: string; username: string | null; locale?: string | null; created_at?: string | null }[]>(
      `/profiles?user_id=in.(${ids})&select=user_id,display_name,username,locale,created_at`,
    ),
    serviceRest<{ user_id: string; permission: string; granted_at?: string | null; granted_by?: string | null }[]>(
      `/admin_permissions?user_id=in.(${ids})&select=user_id,permission,granted_at,granted_by`,
    ),
  ]);
  if (!profiles || !perms) return null;
  const pByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const assignmentsByUser = new Map<string, RoleAssignment[]>();
  const permissionAssignmentsByUser = new Map<string, PermissionAssignment[]>();
  for (const r of rows) {
    assignmentsByUser.set(r.user_id, [
      ...(assignmentsByUser.get(r.user_id) ?? []),
      { role: r.role, grantedAt: r.granted_at ?? null, grantedBy: r.granted_by ?? null },
    ]);
  }
  for (const p of perms) {
    permissionAssignmentsByUser.set(p.user_id, [
      ...(permissionAssignmentsByUser.get(p.user_id) ?? []),
      { permission: p.permission, grantedAt: p.granted_at ?? null, grantedBy: p.granted_by ?? null },
    ]);
  }

  const holders = [...assignmentsByUser.entries()].map(([userId, roleAssignments]) => {
    const permissionAssignments = permissionAssignmentsByUser.get(userId) ?? [];
    const timestamps = [...roleAssignments, ...permissionAssignments]
      .map((assignment) => assignment.grantedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .reverse();
    const profile = pByUser.get(userId);
    return {
      userId,
      displayName: profile?.display_name ?? '—',
      username: profile?.username ?? null,
      locale: profile?.locale ?? null,
      createdAt: profile?.created_at ?? null,
      roles: roleAssignments.map((assignment) => assignment.role),
      permissions: permissionAssignments.map((assignment) => assignment.permission),
      roleAssignments,
      permissionAssignments,
      lastChangedAt: timestamps[0] ?? null,
    };
  });
  const roleCounts: Record<string, number> = {};
  const permissionCounts: Record<string, number> = {};
  for (const row of rows) roleCounts[row.role] = (roleCounts[row.role] ?? 0) + 1;
  for (const row of perms) permissionCounts[row.permission] = (permissionCounts[row.permission] ?? 0) + 1;
  const allTimestamps = [...rows, ...perms]
    .map((row) => row.granted_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .reverse();

  return {
    holders,
    summary: {
      totalHolders: holders.length,
      totalRoleAssignments: rows.length,
      totalPermissionAssignments: perms.length,
      roleCounts,
      permissionCounts,
      lastChangedAt: allTimestamps[0] ?? null,
    },
  };
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

export async function grantAdminPermissionChecked(userId: string, permission: string, actorId: string): Promise<RoleMutationResult> {
  const ok = await grantAdminPermission(userId, permission, actorId);
  return ok ? { ok: true } : { ok: false, code: 'DB_REJECTED' };
}

/*
 * G.1 / G.4 (GAP-FIX-R5): a role or staff-permission revocation goes through
 * Vault's revoke_staff_grant, never a service-role DELETE. The function
 * checks the superadmin actor, removes the grant with that actor on the
 * trigger's audit row ('user_roles.delete' / 'admin_permissions.delete'; a
 * service-role DELETE used to be recorded under the ORIGINAL granter), and
 * for an elevated grant records the access-review decision 'revoked', all in
 * one transaction. The role triggers (superadmin domain, kid guardian, parent
 * cascade) still refuse: 'rejected'. A write Core cannot confirm is
 * 'unavailable' (502), never 'revoked'.
 */
export type StaffRevokeOutcome = 'revoked' | 'not_held' | 'forbidden' | 'rejected' | 'unavailable';

export async function revokeStaffGrant(input: {
  actorId: string; subjectId: string; kind: 'role' | 'permission'; grant: string;
}): Promise<StaffRevokeOutcome> {
  const { ok, body } = await serviceRestRaw('/rpc/revoke_staff_grant', {
    method: 'POST',
    body: JSON.stringify({ p_actor: input.actorId, p_subject: input.subjectId, p_kind: input.kind, p_grant: input.grant }),
  });
  if (!ok) {
    const refusal = dbRefusal(body);
    if (!refusal) return 'unavailable';
    return refusal.message.includes('ACCESS_REVOKE_FORBIDDEN') || refusal.message.includes('ACCESS_REVOKE_SELF') ? 'forbidden' : 'rejected';
  }
  return body === 'revoked' || body === 'not_held' ? body : 'unavailable';
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

/*
 * Forge (`coursegen/`) is the only pipeline that writes generation telemetry
 * (generation_runs / generation_slots / generation_runs_live /
 * generation_heartbeat_snapshots) now that Arcade (games) has been removed.
 * Every aggregation here reads the tables as lesson-only — no kind marker, no
 * cross-pipeline scoping.
 */

/** Judge rubric dimensions — a CLOSED set. `kid_safety` is the hard floor. */
const RUBRIC_DIMENSIONS: readonly string[] = [
  'kid_safety',
  'age_fit',
  'concreteness',
  'pedagogy',
  'cognitive_engagement',
  'feedback_quality',
  'distractor_quality',
  'narrative_quality',
  'naturalness',
];

export function rubricDimensions(): readonly string[] {
  return RUBRIC_DIMENSIONS;
}

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
  params?: Record<string, unknown> | null;
  summary: {
    published?: string[];
    alreadyDone?: string[];
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
    // A resumed run's summary reports only NEW publishes; alreadyDone carries
    // the earlier passes' — the run row shows the CUMULATIVE run state.
    published: (r.summary.published?.length ?? 0) + (r.summary.alreadyDone?.length ?? 0),
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

const OVERVIEW_RUN_LIMIT = 20;

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
      '/generation_runs?select=run_id,track_id,course_slug,register,params,summary,tokens_used,usd_used,cached_tokens,images_generated,images_billed,updated_at' +
        `&order=updated_at.desc&limit=${OVERVIEW_RUN_LIMIT}`,
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
    runs: runs.map(mapRunRow).slice(0, OVERVIEW_RUN_LIMIT),
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

// ── Live generation (0018 — the "what is happening RIGHT NOW" signal) ────────

export interface LiveRunHeartbeat {
  runId: string;
  trackId: string | null;
  courseSlug: string;
  register: string;
  activeSlots: number;
  completedSlots: number;
  failedSlots: number;
  skippedSlots: number;
  totalSlots: number;
  stageBreakdown: Record<string, number>;
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  startedAt: string;
  updatedAt: string;
}

export interface LiveGenerationStatus {
  activeRuns: LiveRunHeartbeat[];
}

function liveNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function getLiveGeneration(): Promise<LiveGenerationStatus | null> {
  const rows = await serviceRest<
    {
      run_id: string;
      track_id: string | null;
      course_slug: string;
      register: string;
      active_slots: number;
      completed_slots: number;
      failed_slots: number;
      skipped_slots: number;
      total_slots: number;
      stage_breakdown: Record<string, number>;
      tokens_used: number;
      usd_used: number | string;
      cached_tokens: number;
      images_generated: number;
      images_billed: number;
      images_inherited: number;
      started_at: string;
      updated_at: string;
    }[]
  >('/generation_runs_live?select=*&order=updated_at.desc&limit=10');
  if (!rows) return null;
  // Stale rows (>2 min no update) mean the run process died — filter them out.
  const now = Date.now();
  const TWO_MIN = 2 * 60 * 1000;
  const fresh = rows.filter((r) => now - new Date(r.updated_at).getTime() < TWO_MIN);
  return {
    activeRuns: fresh.map((r) => ({
      runId: r.run_id,
      trackId: r.track_id,
      courseSlug: r.course_slug,
      register: r.register,
      activeSlots: liveNumber(r.active_slots),
      completedSlots: liveNumber(r.completed_slots),
      failedSlots: liveNumber(r.failed_slots),
      skippedSlots: liveNumber(r.skipped_slots),
      totalSlots: liveNumber(r.total_slots),
      stageBreakdown: r.stage_breakdown ?? {},
      tokensUsed: liveNumber(r.tokens_used),
      usdUsed: liveNumber(r.usd_used),
      cachedTokens: liveNumber(r.cached_tokens),
      imagesGenerated: liveNumber(r.images_generated),
      imagesBilled: liveNumber(r.images_billed),
      imagesInherited: liveNumber(r.images_inherited),
      startedAt: r.started_at,
      updatedAt: r.updated_at,
    })),
  };
}

// ── Cross-run analytics (trends, failure patterns, quality over time) ───────

export interface GenerationAnalytics {
  courseSlug: string | null;
  runsAnalyzed: number;
  costTrend: { runId: string; updatedAt: string; usdPerPublished: number | null; tokensPerLesson: number | null }[];
  qualityTrend: { runId: string; updatedAt: string; dimMeans: Record<string, number | null> }[];
  cacheEfficiency: { runId: string; updatedAt: string; cacheHitPct: number }[];
  failureByStage: { stage: string; count: number; pct: number }[];
  failureByLocale: { locale: string; count: number; pct: number }[];
  stageSuccessRate: { stage: string; passed: number; failed: number; rate: number };
  costForecast: { perLesson: number | null; perCourse: number | null; basedOn: number } | null;
  averages: {
    costPerPublished: number | null;
    tokensPerLesson: number | null;
    cacheHitPct: number | null;
  };
}

const ANALYTICS_LIMIT = 50;

/** Cross-run cost/quality/failure trends for Forge's lesson-generation runs. */
export async function getGenerationAnalytics(
  courseSlug?: string,
): Promise<GenerationAnalytics | null> {
  const filter = courseSlug
    ? `&course_slug=eq.${encodeURIComponent(courseSlug)}`
    : '';
  const runs = await serviceRest<
    {
      run_id: string;
      course_slug: string;
      register: string;
      params: Record<string, unknown>;
      summary: {
        published?: string[];
        failed?: { slotId: string; error: string; failedFrom?: string }[];
        slotsEnumerated?: number;
      } & Record<string, unknown>;
      tokens_used: number;
      usd_used: number | string;
      cached_tokens: number;
      updated_at: string;
    }[]
  >(
    `/generation_runs?select=run_id,course_slug,register,params,summary,tokens_used,usd_used,cached_tokens,updated_at` +
      `&order=updated_at.desc&limit=${ANALYTICS_LIMIT}${filter}`,
  );
  if (!runs || runs.length === 0) return null;

  const filtered = runs.filter((r) => (r.summary.published?.length ?? 0) > 0 || (r.summary.failed?.length ?? 0) > 0);
  if (filtered.length === 0) return null;

  const costTrend = filtered.map((r) => {
    const published = r.summary.published?.length ?? 0;
    return {
      runId: r.run_id,
      updatedAt: r.updated_at,
      usdPerPublished: published > 0 ? Number(r.usd_used) / published : null,
      tokensPerLesson: published > 0 ? r.tokens_used / published : null,
    };
  });

  // Batch-fetch rubric slots for all runs in ONE query
  const allSlots = await serviceRest<
    {
      run_id: string;
      rubric: Record<string, number | string> | null;
    }[]
  >(
    `/generation_slots?or=(${filtered.map((r) => `run_id.eq.${encodeURIComponent(r.run_id)}`).join(',')})&select=run_id,rubric&rubric=not.is.null&limit=500`,
  );
  const slotsByRun = new Map<string, { rubric: Record<string, number | string> | null }[]>();
  if (allSlots) {
    for (const s of allSlots) {
      const list = slotsByRun.get(s.run_id) ?? [];
      list.push(s);
      slotsByRun.set(s.run_id, list);
    }
  }

  const dims = rubricDimensions();
  const qualityTrend: GenerationAnalytics['qualityTrend'] = [];
  for (const r of filtered) {
    const runSlots = slotsByRun.get(r.run_id) ?? [];
    if (runSlots.length === 0) {
      qualityTrend.push({ runId: r.run_id, updatedAt: r.updated_at, dimMeans: {} });
      continue;
    }
    const dimMeans: Record<string, number | null> = {};
    for (const dim of dims) {
      const values = runSlots
        .map((s) => s.rubric?.[dim])
        .filter((v): v is number => typeof v === 'number');
      dimMeans[dim] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }
    qualityTrend.push({ runId: r.run_id, updatedAt: r.updated_at, dimMeans });
  }

  const cacheEfficiency = filtered.map((r) => ({
    runId: r.run_id,
    updatedAt: r.updated_at,
    cacheHitPct: r.tokens_used > 0 ? (r.cached_tokens / r.tokens_used) * 100 : 0,
  }));

  const stageCounts = new Map<string, number>();
  let totalFailures = 0;
  for (const r of filtered) {
    for (const f of r.summary.failed ?? []) {
      const stage = f.failedFrom ?? 'unknown';
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
      totalFailures++;
    }
  }
  const failureByStage = [...stageCounts.entries()]
    .map(([stage, count]) => ({ stage, count, pct: totalFailures > 0 ? (count / totalFailures) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  // Locale stats approximated from the params.locales field or from run register.
  const localeCounts = new Map<string, number>();
  for (const r of filtered) {
    const locales: string[] = r.params?.locales as string[] ?? ['es-MX', 'en-US', 'pt-BR'];
    for (const locale of locales) {
      localeCounts.set(locale, (localeCounts.get(locale) ?? 0) + 1);
    }
  }

  const allPublished = filtered.reduce((n, r) => n + (r.summary.published?.length ?? 0), 0);
  const totalCost = filtered.reduce((n, r) => n + Number(r.usd_used), 0);
  const totalTokens = filtered.reduce((n, r) => n + r.tokens_used, 0);
  const totalCached = filtered.reduce((n, r) => n + r.cached_tokens, 0);

  // Stage success rate: across all runs, how many slots attempted per stage
  // survived vs failed at that stage. Approximated from failureHeatmap.
  const allAttempted = allPublished + totalFailures;
  const stageSuccess = {
    stage: 'overall',
    passed: allPublished,
    failed: totalFailures,
    rate: allAttempted > 0 ? (allPublished / allAttempted) * 100 : 0,
  };

  /*
   * Cost forecast, from the published-lesson cost average across runs. The
   * per-course projection multiplies by the units a typical course holds —
   * ~500 lessons (the Forge track size).
   */
  const costPerUnitAvg = allPublished > 0 ? totalCost / allPublished : null;
  const UNITS_PER_COURSE = 500;
  let costForecast: GenerationAnalytics['costForecast'] = null;
  if (costPerUnitAvg !== null && allPublished > 5) {
    costForecast = {
      perLesson: costPerUnitAvg,
      perCourse: costPerUnitAvg * UNITS_PER_COURSE,
      basedOn: allPublished,
    };
  }

  return {
    courseSlug: courseSlug ?? null,
    runsAnalyzed: filtered.length,
    costTrend,
    qualityTrend,
    cacheEfficiency,
    failureByStage,
    failureByLocale: [...localeCounts.entries()].map(([locale, count]) => ({
      locale,
      count,
      pct: filtered.length > 0 ? (count / filtered.length) * 100 : 0,
    })),
    stageSuccessRate: stageSuccess,
    costForecast,
    averages: {
      costPerPublished: allPublished > 0 ? totalCost / allPublished : null,
      tokensPerLesson: allPublished > 0 ? totalTokens / allPublished : null,
      cacheHitPct: totalTokens > 0 ? (totalCached / totalTokens) * 100 : null,
    },
  };
}

// ── Coach report (forge:coach surfaced in the admin dashboard) ─────────────

/*
 * Bible 02 section 1.2 and rule 16 (F4-staff-ops): Core returns each proposed
 * action as structured facts only, never prose. The staff console composes
 * the proposal and its evidence in the viewer's locale (en-US, es-MX, pt-BR)
 * and formats every number with Intl.
 */
export type CoachAction =
  | { tag: 'cost:cache'; params: { cacheHitPct: number; wastedUsd: number } }
  | { tag: `judge:${string}`; params: { dimension: string; mean: number; min: number | null; n: number } }
  | { tag: 'failure:stage'; params: { stage: string; count: number; total: number } }
  | { tag: 'cost:perLesson'; params: { usdPerLesson: number; totalUsd: number; published: number; inherited: number; billed: number } };
export interface CoachReport {
  courseSlug: string | null;
  trackId: string | null;
  runsAnalyzed: number;
  outcomes: { published: number; failed: number; other: number };
  failureHeatmap: Record<string, number>;
  topErrors: { sample: string; count: number }[];
  judge: {
    judged: number;
    dimensionMeans: Record<string, number | null>;
    dimensionMins: Record<string, number | null>;
    cyclesHistogram: { cycle1: number; cycle2: number; cycle3: number; earlyStops: number };
    worstLessons: { slotId: string; dims: string[] }[];
  };
  cost: { totalUsd: number; totalTokens: number; cacheHitPct: number };
  images: { generated: number; billed: number; inherited: number };
  proposedActions: CoachAction[];
}

const COACH_LIMIT = 20;

export async function getCoachReport(
  courseSlug?: string,
  trackId?: string,
): Promise<CoachReport | null> {
  let filter = courseSlug ? `&course_slug=eq.${encodeURIComponent(courseSlug)}` : '';
  if (trackId) filter += `&track_id=eq.${encodeURIComponent(trackId)}`;

  const allRuns = await serviceRest<
    {
      run_id: string;
      track_id: string | null;
      course_slug: string;
      params?: Record<string, unknown> | null;
      summary: {
        published?: string[];
        failed?: { slotId: string; error: string; failedFrom?: string }[];
        dryRun?: string[];
        skipped?: { slotId: string; reason: string }[];
        alreadyDone?: string[];
        imagesGenerated?: number;
        imagesBilled?: number;
        imagesInherited?: number;
      } & Record<string, unknown>;
      tokens_used: number;
      usd_used: number | string;
      cached_tokens: number;
      images_generated: number;
      images_billed: number;
      images_inherited: number;
      updated_at: string;
    }[]
  >(
    `/generation_runs?select=run_id,track_id,course_slug,params,summary,tokens_used,usd_used,cached_tokens,images_generated,images_billed,images_inherited,updated_at` +
      `&order=updated_at.desc&limit=${COACH_LIMIT}${filter}`,
  );
  if (!allRuns) return null;
  const runs = allRuns.slice(0, COACH_LIMIT);
  if (runs.length === 0) return null;

  let totalPublished = 0;
  let totalFailed = 0;
  let totalOther = 0;
  const heatmap = new Map<string, number>();
  const errorGroups = new Map<string, number>();
  let totalUsd = 0;
  let totalTokens = 0;
  let totalCached = 0;
  let totalImagesGenerated = 0;
  let totalImagesBilled = 0;
  let totalImagesInherited = 0;

  for (const r of runs) {
    totalPublished += r.summary.published?.length ?? 0;
    totalFailed += r.summary.failed?.length ?? 0;
    totalOther += (r.summary.dryRun?.length ?? 0) + (r.summary.skipped?.length ?? 0) + (r.summary.alreadyDone?.length ?? 0);
    for (const f of r.summary.failed ?? []) {
      const stage = f.failedFrom ?? 'unknown';
      heatmap.set(stage, (heatmap.get(stage) ?? 0) + 1);
      const msg = f.error.slice(0, 120);
      errorGroups.set(msg, (errorGroups.get(msg) ?? 0) + 1);
    }
    // A missing counter is zero, never NaN (a NaN would reach the console as null).
    totalUsd += Number(r.usd_used ?? 0);
    totalTokens += Number(r.tokens_used ?? 0);
    totalCached += Number(r.cached_tokens ?? 0);
    totalImagesGenerated += Number(r.images_generated ?? 0);
    totalImagesBilled += Number(r.images_billed ?? 0);
    totalImagesInherited += Number(r.images_inherited ?? 0);
  }

  const topErrors = [...errorGroups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sample, count]) => ({ sample, count }));

  // Judge rubric aggregation from slots — single batch query across all runs
  const runIds = runs.map((r) => r.run_id);
  const orClauses = runIds.map((id) => `run_id.eq.${encodeURIComponent(id)}`).join(',');
  const slots = await serviceRest<
    {
      slot_id: string;
      rubric: Record<string, number | string> | null;
      review_cycles: number | null;
      early_stopped: boolean;
    }[]
  >(
    `/generation_slots?or=(${orClauses})&select=slot_id,rubric,review_cycles,early_stopped&rubric=not.is.null&limit=500`,
  );
  const judged = slots?.filter((s) => s.rubric) ?? [];

  const dims = rubricDimensions();
  const dimensionMeans: Record<string, number | null> = {};
  const dimensionMins: Record<string, number | null> = {};
  for (const dim of dims) {
    const values = judged.map((s) => s.rubric?.[dim]).filter((v): v is number => typeof v === 'number');
    dimensionMeans[dim] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    dimensionMins[dim] = values.length > 0 ? Math.min(...values) : null;
  }

  let cycle1 = 0, cycle2 = 0, cycle3 = 0, earlyStops = 0;
  for (const s of judged) {
    const c = s.review_cycles ?? 0;
    if (c <= 1) cycle1++;
    else if (c === 2) cycle2++;
    else cycle3++;
    if (s.early_stopped) earlyStops++;
  }

  /*
   * Worst lessons: the hard floor (`kid_safety`) plus Forge's "is this pitched
   * right for the age band" dimension, `age_fit`.
   */
  const fitDim = 'age_fit';
  const worstLessons = judged
    .map((s) => {
      const r = s.rubric ?? {};
      const kidSafety = typeof r.kid_safety === 'number' ? r.kid_safety : 5;
      const rawFit = r[fitDim];
      const fit = typeof rawFit === 'number' ? rawFit : 5;
      const low: string[] = [];
      if (kidSafety < 5) low.push(`kid_safety=${kidSafety}`);
      if (fit < 4) low.push(`${fitDim}=${fit}`);
      return { slotId: s.slot_id, dims: low };
    })
    .filter((s) => s.dims.length > 0)
    .sort((a, b) => b.dims.length - a.dims.length)
    .slice(0, 10);

  const cacheHitPct = totalTokens > 0 ? (totalCached / totalTokens) * 100 : 0;

  // Proposed actions from the evidence: structured facts, composed and localized by the console.
  const actions: CoachAction[] = [];
  if (cacheHitPct < 30) {
    actions.push({ tag: 'cost:cache', params: { cacheHitPct, wastedUsd: (totalTokens - totalCached) * 0.0004 } });
  }
  for (const dim of dims) {
    const mean = dimensionMeans[dim];
    if (typeof mean !== 'number' || mean >= 3.5) continue;
    actions.push({ tag: `judge:${dim}`, params: { dimension: dim, mean, min: dimensionMins[dim] ?? null, n: judged.length } });
  }
  const topStage = [...heatmap.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topStage && topStage[1] > 0) {
    actions.push({ tag: 'failure:stage', params: { stage: topStage[0], count: topStage[1], total: totalFailed } });
  }
  if (totalPublished > 0) {
    const usdPerLesson = totalUsd / totalPublished;
    if (usdPerLesson > 0.15) {
      actions.push({
        tag: 'cost:perLesson',
        params: { usdPerLesson, totalUsd, published: totalPublished, inherited: totalImagesInherited, billed: totalImagesBilled },
      });
    }
  }

  return {
    courseSlug: courseSlug ?? null,
    trackId: trackId ?? null,
    runsAnalyzed: runs.length,
    outcomes: { published: totalPublished, failed: totalFailed, other: totalOther },
    failureHeatmap: Object.fromEntries(heatmap),
    topErrors,
    judge: {
      judged: judged.length,
      dimensionMeans,
      dimensionMins,
      cyclesHistogram: { cycle1, cycle2, cycle3, earlyStops },
      worstLessons,
    },
    cost: { totalUsd, totalTokens, cacheHitPct },
    images: { generated: totalImagesGenerated, billed: totalImagesBilled, inherited: totalImagesInherited },
    proposedActions: actions,
  };
}

// ── Heartbeat snapshots (0020 — time-series of run progression) ────────────

export interface HeartbeatSnapshot {
  id: number;
  runId: string;
  activeSlots: number;
  completedSlots: number;
  failedSlots: number;
  skippedSlots: number;
  stageBreakdown: Record<string, number>;
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  createdAt: string;
}

export async function getHeartbeatSnapshots(runId: string): Promise<HeartbeatSnapshot[] | null> {
  const rows = await serviceRest<
    {
      id: number;
      run_id: string;
      active_slots: number;
      completed_slots: number;
      failed_slots: number;
      skipped_slots: number;
      stage_breakdown: Record<string, number>;
      tokens_used: number;
      usd_used: number | string;
      cached_tokens: number;
      images_generated: number;
      images_billed: number;
      images_inherited: number;
      created_at: string;
    }[]
  >(
    `/generation_heartbeat_snapshots?run_id=eq.${encodeURIComponent(runId)}&select=*&order=created_at.asc&limit=500`,
  );
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    runId: r.run_id,
    activeSlots: liveNumber(r.active_slots),
    completedSlots: liveNumber(r.completed_slots),
    failedSlots: liveNumber(r.failed_slots),
    skippedSlots: liveNumber(r.skipped_slots),
    stageBreakdown: r.stage_breakdown ?? {},
    tokensUsed: liveNumber(r.tokens_used),
    usdUsed: liveNumber(r.usd_used),
    cachedTokens: liveNumber(r.cached_tokens),
    imagesGenerated: liveNumber(r.images_generated),
    imagesBilled: liveNumber(r.images_billed),
    imagesInherited: liveNumber(r.images_inherited),
    createdAt: r.created_at,
  }));
}

// ── Slot detail (full inspection of a single generated lesson) ─────────────

export interface SlotDetail {
  slotId: string;
  runId: string;
  state: string;
  failedFrom: string | null;
  error: string | null;
  salvaged: boolean;
  droppedSegments: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  durationMs: number | null;
  durationHuman: string | null;
  rubric: Record<string, number | string> | null;
  reviewCycles: number | null;
  earlyStopped: boolean;
  updatedAt: string;
  run: { courseSlug: string; register: string; updatedAt: string } | null;
}

export async function getSlotDetail(runId: string, slotId: string): Promise<SlotDetail | null> {
  const encodedRun = encodeURIComponent(runId);
  const encodedSlot = encodeURIComponent(slotId);
  const [slots, runs] = await Promise.all([
    serviceRest<
      {
        slot_id: string;
        run_id: string;
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
        updated_at: string;
      }[]
    >(
      `/generation_slots?run_id=eq.${encodedRun}&slot_id=eq.${encodedSlot}&select=*`,
    ),
    serviceRest<
      { course_slug: string; register: string; updated_at: string }[]
    >(
      `/generation_runs?run_id=eq.${encodedRun}&select=course_slug,register,updated_at`,
    ),
  ]);
  if (!slots || slots.length === 0) return null;
  const s = slots[0]!;
  const run = runs?.[0] ?? null;
  return {
    slotId: s.slot_id,
    runId: s.run_id,
    state: s.state,
    failedFrom: s.failed_from,
    error: s.error,
    salvaged: s.salvaged,
    droppedSegments: s.dropped_segments,
    imagesGenerated: s.images_generated,
    imagesBilled: s.images_billed,
    imagesInherited: s.images_inherited,
    durationMs: s.duration_ms,
    durationHuman: s.duration_ms !== null ? formatDuration(s.duration_ms) : null,
    rubric: s.rubric,
    reviewCycles: s.review_cycles,
    earlyStopped: s.early_stopped,
    updatedAt: s.updated_at,
    run: run ? { courseSlug: run.course_slug, register: run.register, updatedAt: run.updated_at } : null,
  };
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

// ── Run comparison (side-by-side) ──────────────────────────────────────────

export interface RunComparison {
  runs: {
    runId: string;
    courseSlug: string;
    register: string;
    published: number;
    failed: number;
    slotsEnumerated: number;
    usdUsed: number;
    tokensUsed: number;
    cachedTokens: number;
    cacheHitPct: number;
    imagesGenerated: number;
    imagesBilled: number;
    imagesInherited: number;
    judgeMeans: Record<string, number | null>;
    failureHeatmap: Record<string, number>;
    updatedAt: string;
  }[];
  deltas: {
    published: number;
    failed: number;
    usdUsed: number;
    cacheHitPct: number;
  } | null;
}

export async function compareRuns(runIdA: string, runIdB: string): Promise<RunComparison | null> {
  const rows = await serviceRest<
    {
      run_id: string;
      course_slug: string;
      register: string;
      params?: Record<string, unknown> | null;
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
      images_inherited: number;
      updated_at: string;
    }[]
  >(
    `/generation_runs?run_id=in.(${encodeURIComponent(runIdA)},${encodeURIComponent(runIdB)})&select=run_id,course_slug,register,params,summary,tokens_used,usd_used,cached_tokens,images_generated,images_billed,images_inherited,updated_at`,
  );
  if (!rows || rows.length < 2) return null;

  const runs = await Promise.all(rows.map(async (r) => {
    const dims = rubricDimensions();
    const slots = await serviceRest<
      { rubric: Record<string, number | string> | null }[]
    >(
      `/generation_slots?run_id=eq.${encodeURIComponent(r.run_id)}&select=rubric&rubric=not.is.null&limit=200`,
    );
    const judged = slots?.filter((s) => s.rubric) ?? [];
    const judgeMeans: Record<string, number | null> = {};
    for (const dim of dims) {
      const vals = judged.map((s) => s.rubric?.[dim]).filter((v): v is number => typeof v === 'number');
      judgeMeans[dim] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    const heatmap: Record<string, number> = {};
    for (const f of r.summary.failed ?? []) {
      const stage = f.failedFrom ?? 'unknown';
      heatmap[stage] = (heatmap[stage] ?? 0) + 1;
    }
    const published = r.summary.published?.length ?? 0;
    const failed = r.summary.failed?.length ?? 0;
    const cacheHitPct = r.tokens_used > 0 ? (r.cached_tokens / r.tokens_used) * 100 : 0;
    return {
      runId: r.run_id,
      courseSlug: r.course_slug,
      register: r.register,
      published,
      failed,
      slotsEnumerated: r.summary.slotsEnumerated ?? 0,
      usdUsed: Number(r.usd_used),
      tokensUsed: r.tokens_used,
      cachedTokens: r.cached_tokens,
      cacheHitPct,
      imagesGenerated: r.images_generated,
      imagesBilled: r.images_billed,
      imagesInherited: r.images_inherited,
      judgeMeans,
      failureHeatmap: heatmap,
      updatedAt: r.updated_at,
    };
  }));

  const [a, b] = runs as [typeof runs[0], typeof runs[0]];
  const deltas = a && b ? {
    published: b.published - a.published,
    failed: b.failed - a.failed,
    usdUsed: b.usdUsed - a.usdUsed,
    cacheHitPct: b.cacheHitPct - a.cacheHitPct,
  } : null;

  return { runs, deltas };
}
