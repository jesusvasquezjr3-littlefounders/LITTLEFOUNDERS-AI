import { useCallback, useEffect, useRef, useState } from 'react';
import { STAFF_PERMISSIONS, type StaffPermission } from '../../design/controls';

/*
 * The data layer of the rebuilt staff console (W2 Lane 6, W2T.1).
 *
 * The rebuilt UI imports nothing outside src/rebuild and src/i18n (02 rule 23,
 * `check-product-spec.mjs`), so the screens receive a `StaffApi` from their
 * route host (app-routes/staffConsole.tsx), which calls Core with the staff
 * member's own session. Core is the control: every path below sits behind
 * requireRole(admin|superadmin) plus the named grant of G.1
 * (`requireAdminPermission`, backend/src/routes/admin.ts), and Roles & Access
 * behind superadmin. The screens only choose what to ask for and what to show;
 * a hidden section never substitutes for the server's refusal.
 *
 * Wire shapes are hand-mirrored from Core (no shared types across packages by
 * design) and checked on arrival: a payload of the wrong shape is an error
 * state, never a crash or a guessed zero.
 */

/** A refusal may carry Core's itemized reasons (the C.6 pack contract lists every failure). */
export type StaffResult<T> = { ok: true; data: T } | { ok: false; code: string; failures?: string[] };

/** A file Core rendered (W2T.3: the analytics reports, the intel and raw-event exports): its bytes and Core's export headers (truncated, next-offset, rows, token). */
export interface StaffDownload { blob: Blob; headers: Record<string, string> }

export interface StaffApi {
  get<T>(path: string): Promise<StaffResult<T>>;
  post<T>(path: string, body: unknown): Promise<StaffResult<T>>;
  /** DELETE (W2T.3: revoking an analytics exclusion). A host without it offers no revoke. */
  remove?<T>(path: string): Promise<StaffResult<T>>;
  /** A raw file route (success is bytes; a failure is Core's usual envelope). A host without it offers no download. */
  download?(path: string): Promise<StaffResult<StaffDownload>>;
}

/** What the signed-in staff member may open: the same grants the route guards and the staff navigation read. */
export interface StaffViewer { superadmin: boolean; permissions: readonly StaffPermission[] }

export function can(viewer: StaffViewer, permission: StaffPermission): boolean {
  return viewer.superadmin || viewer.permissions.includes(permission);
}

/** The grants of an account as Core's requireAdminPermission reads them: only an admin's named grants count; a superadmin holds all. */
export function staffViewer(roles: readonly string[], permissions: readonly string[]): StaffViewer {
  return {
    superadmin: roles.includes('superadmin'),
    permissions: roles.includes('admin') ? STAFF_PERMISSIONS.filter((grant) => permissions.includes(grant)) : [],
  };
}

export type Load<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; code: string }
  | { state: 'ready'; data: T; refreshing: boolean };

/**
 * One read. `path: null` reads nothing (a section the viewer has no grant
 * for never asks Core). A reload keeps the data on screen while it runs, so a
 * refresh after an action never moves the page (02 rule 13); a first load or
 * a retry after an error shows the loading state.
 */
export function useStaffRead<T>(api: StaffApi, path: string | null, guard: (value: unknown) => value is T) {
  const [load, setLoad] = useState<Load<T>>(path ? { state: 'loading' } : { state: 'idle' });
  const [tick, setTick] = useState(0);
  const guardRef = useRef(guard);
  guardRef.current = guard;
  useEffect(() => {
    if (!path) { setLoad({ state: 'idle' }); return; }
    let live = true;
    setLoad((previous) => (previous.state === 'ready' ? { ...previous, refreshing: true } : previous.state === 'loading' ? previous : { state: 'loading' }));
    api.get<unknown>(path).then((result) => {
      if (!live) return;
      if (!result.ok) setLoad({ state: 'error', code: result.code });
      else if (!guardRef.current(result.data)) setLoad({ state: 'error', code: 'MALFORMED' });
      else setLoad({ state: 'ready', data: result.data, refreshing: false });
    }, () => { if (live) setLoad({ state: 'error', code: 'INTERNAL' }); });
    return () => { live = false; };
  }, [api, path, tick]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { load, reload };
}

/* ---------------------------------------------------------------------------
 * Shape checks
 * ------------------------------------------------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isCounts = (value: unknown): value is Record<string, number> => isRecord(value) && Object.values(value).every(isNumber);
const arrayOf = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);

/* ---- Overview (S1) ------------------------------------------------------- */

/** GET /admin/overview: each part only when the viewer holds its grant (Core projects it). */
export interface Overview {
  users?: { total: number; byRole: Record<string, number>; staff: number };
  content?: { courses: Record<string, number>; lessons: Record<string, number>; reviewQueue: number };
  audit?: { total: number };
}
export const isOverview = (value: unknown): value is Overview => isRecord(value)
  && (value.users === undefined || (isRecord(value.users) && isNumber(value.users.total) && isNumber(value.users.staff) && isCounts(value.users.byRole)))
  && (value.content === undefined || (isRecord(value.content) && isCounts(value.content.courses) && isCounts(value.content.lessons) && isNumber(value.content.reviewQueue)))
  && (value.audit === undefined || (isRecord(value.audit) && isNumber(value.audit.total)));

/** GET /admin/health/services (view_analytics). Uptime Kuma's status: 1 up, 0 down. */
export interface Health { summary: { total: number; down: number }; monitors: { id: number; name: string; status: number }[] }
export const isHealth = (value: unknown): value is Health => isRecord(value) && isRecord(value.summary)
  && isNumber(value.summary.total) && isNumber(value.summary.down)
  && arrayOf(value.monitors, (m): m is Health['monitors'][number] => isRecord(m) && isNumber(m.id) && isString(m.name) && isNumber(m.status));

/** GET /admin/learning/retention (view_analytics). */
export interface Retention {
  buckets: { bucket: string; n: number; avg_first_attempt_score: number }[];
  byTopic: { slug: string; title: string; n: number; avgFirstAttemptScore: number }[];
}
export const isRetention = (value: unknown): value is Retention => isRecord(value)
  && arrayOf(value.buckets, (b): b is Retention['buckets'][number] => isRecord(b) && isString(b.bucket) && isNumber(b.n) && isNumber(b.avg_first_attempt_score))
  && arrayOf(value.byTopic, (t): t is Retention['byTopic'][number] => isRecord(t) && isString(t.slug) && isString(t.title) && isNumber(t.avgFirstAttemptScore));

/* ---- Users (S3, A.5) ----------------------------------------------------- */

/** A.5: the verification Core projects per account (id-verified vs staff-granted vs revoked). */
export const VERIFICATIONS = ['id-verified', 'staff-granted', 'revoked'] as const;
export type Verification = (typeof VERIFICATIONS)[number];

export interface StaffUser {
  userId: string;
  displayName: string;
  username: string | null;
  locale: string;
  createdAt: string;
  birthDate: string | null;
  roles: string[];
  verification?: Verification | null;
  /** A.2/A.5 (F3-identity-site): the account holds the parent role while its own age record says a minor. */
  ageRecordMinor?: boolean;
}
const isUser = (u: unknown): u is StaffUser => isRecord(u) && isString(u.userId) && isString(u.displayName) && isNullableString(u.username)
  && isString(u.locale) && isString(u.createdAt) && isNullableString(u.birthDate) && arrayOf(u.roles, isString)
  && (u.verification === undefined || u.verification === null || (VERIFICATIONS as readonly unknown[]).includes(u.verification))
  && (u.ageRecordMinor === undefined || typeof u.ageRecordMinor === 'boolean');
export const isUsers = (value: unknown): value is { users: StaffUser[] } => isRecord(value) && arrayOf(value.users, isUser);

export interface TimelineDay { date: string; count: number }
const isDay = (d: unknown): d is TimelineDay => isRecord(d) && isString(d.date) && isNumber(d.count);
export const isTimeline = (value: unknown): value is { timeline: TimelineDay[] } => isRecord(value) && arrayOf(value.timeline, isDay);

/** The funnel card's three reads (view_analytics); only the fields it shows are required. */
export const isAcquisition = (value: unknown): value is { visitors: number } => isRecord(value) && isNumber(value.visitors);
export const isFunnelIntegrity = (value: unknown): value is { accountsCreated: number; unobserved: number } => isRecord(value)
  && isNumber(value.accountsCreated) && isNumber(value.unobserved);
export const isRegistrations = (value: unknown): value is { entries: { role: string; registrations: number }[] } => isRecord(value)
  && arrayOf(value.entries, (e): e is { role: string; registrations: number } => isRecord(e) && isString(e.role) && isNumber(e.registrations));

/* ---- Roles & Access (S10, A.5, G.4) --------------------------------------- */

/** Core's GRANTABLE_ROLES, in the order the form offers them. */
export const GRANTABLE_ROLES = ['parent', 'kid', 'bigfounder', 'admin', 'superadmin'] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];
/** A.5: a staff grant of the parent role carries this audited justification (Core: 10-200 characters). */
export const JUSTIFICATION = { min: 10, max: 200 } as const;
/** A.5: a revocation's audited reason (Core: 10-300 characters). */
export const REVOKE_REASON = { min: 10, max: 300 } as const;
/** G.4: the quarterly access-review window. A grant older than this is listed for re-justification. */
export const REVIEW_WINDOW_DAYS = 90;

export interface Assignment { role: string; grantedAt: string | null; grantedBy: string | null }
export interface PermissionAssignment { permission: string; grantedAt: string | null; grantedBy: string | null }
export interface Holder {
  userId: string;
  displayName: string;
  username: string | null;
  roles: string[];
  permissions: string[];
  roleAssignments: Assignment[];
  permissionAssignments: PermissionAssignment[];
  lastChangedAt: string | null;
}
export interface RolesData {
  holders: Holder[];
  summary: {
    totalHolders: number;
    totalRoleAssignments: number;
    totalPermissionAssignments: number;
    roleCounts: Record<string, number>;
    permissionCounts: Record<string, number>;
    lastChangedAt: string | null;
  };
}
const isGrantRow = (key: 'role' | 'permission') => (a: unknown): a is Assignment & PermissionAssignment => isRecord(a)
  && isString(a[key]) && isNullableString(a.grantedAt) && isNullableString(a.grantedBy);
const isHolder = (h: unknown): h is Holder => isRecord(h) && isString(h.userId) && isString(h.displayName) && isNullableString(h.username)
  && arrayOf(h.roles, isString) && arrayOf(h.permissions, isString) && arrayOf(h.roleAssignments, isGrantRow('role'))
  && arrayOf(h.permissionAssignments, isGrantRow('permission')) && isNullableString(h.lastChangedAt);
export const isRolesData = (value: unknown): value is RolesData => isRecord(value) && arrayOf(value.holders, isHolder)
  && isRecord(value.summary) && isNumber(value.summary.totalHolders) && isNumber(value.summary.totalRoleAssignments)
  && isNumber(value.summary.totalPermissionAssignments) && isCounts(value.summary.roleCounts) && isNullableString(value.summary.lastChangedAt);

export interface Candidate { userId: string; displayName: string; username: string | null; roles: string[] }
export const isCandidates = (value: unknown): value is { candidates: Candidate[] } => isRecord(value)
  && arrayOf(value.candidates, (c): c is Candidate => isRecord(c) && isString(c.userId) && isString(c.displayName) && isNullableString(c.username) && arrayOf(c.roles, isString));

/*
 * G.4 / Appendix N 1.1: the access-review log. Core lists only the elevated
 * grants (admin and superadmin roles, the four staff permissions; never a
 * family role), each with its last kept review; a grant is due when
 * max(granted, last review) is older than the cadence. Recording "Keep
 * access" is POST /admin/roles/review, audited in the same transaction.
 */
export const ACCESS_REVIEWS_PATH = '/admin/roles/reviews';
export interface AccessReviewGrant {
  userId: string; kind: 'role' | 'permission'; grant: string; grantedAt: string; lastReviewedAt: string | null; due: boolean;
  displayName: string; username: string | null;
}
export interface AccessReviews {
  cadenceDays: number;
  grants: AccessReviewGrant[];
  metrics: { total: number; stale: number; reviewedEver: number; compliance: number | null; staleRate: number | null };
}
const isReviewGrant = (g: unknown): g is AccessReviewGrant => isRecord(g) && isString(g.userId) && (g.kind === 'role' || g.kind === 'permission')
  && isString(g.grant) && isString(g.grantedAt) && isNullableString(g.lastReviewedAt) && typeof g.due === 'boolean'
  && isString(g.displayName) && isNullableString(g.username);
export const isAccessReviews = (value: unknown): value is AccessReviews => isRecord(value) && isNumber(value.cadenceDays)
  && arrayOf(value.grants, isReviewGrant) && isRecord(value.metrics) && isNumber(value.metrics.total) && isNumber(value.metrics.stale)
  && (value.metrics.compliance === null || isNumber(value.metrics.compliance));

/** The grants the review card asks about: due first, oldest confirmation first (the server's order). */
export const reviewDue = (reviews: AccessReviews | null): AccessReviewGrant[] => (reviews?.grants ?? []).filter((grant) => grant.due);

/* ---- Audit log (S9) ------------------------------------------------------ */

export interface AuditEntry { id: number; actorId: string | null; action: string; subject: string; detail: Record<string, unknown>; createdAt: string }
export interface AuditPage { entries: AuditEntry[]; total: number; limit: number; offset: number }
export const isAuditPage = (value: unknown): value is AuditPage => isRecord(value) && isNumber(value.total) && isNumber(value.offset)
  && arrayOf(value.entries, (e): e is AuditEntry => isRecord(e) && isNumber(e.id) && isNullableString(e.actorId) && isString(e.action)
    && isString(e.subject) && isRecord(e.detail) && isString(e.createdAt));
export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilters { action: string; actorId: string; subject: string; from: string; to: string }
export const NO_AUDIT_FILTERS: AuditFilters = { action: '', actorId: '', subject: '', from: '', to: '' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server-side filters Core's AuditQuerySchema accepts (exact action, actor and subject; inclusive dates). */
export function auditPath(filters: AuditFilters, offset: number): string {
  const params = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE), offset: String(offset) });
  if (filters.action.trim()) params.set('action', filters.action.trim());
  if (filters.actorId.trim()) params.set('actorId', filters.actorId.trim());
  if (filters.subject.trim()) params.set('subject', filters.subject.trim());
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return `/admin/audit?${params.toString()}`;
}

/* ---- Reports (E.3) ------------------------------------------------------- */

export const REPORT_CATEGORIES = ['unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export interface ReportCase {
  subjectId: string;
  origin: 'report' | 'pattern';
  status: 'open' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  reportCount: number;
  openReportCount: number;
}
export interface ReportRow { id: string; reporterId: string; category: ReportCategory; note: string | null; status: 'open' | 'resolved'; createdAt: string }
export interface CaseDetail extends ReportCase { reports: ReportRow[] }
const isCase = (c: unknown): c is ReportCase => isRecord(c) && isString(c.subjectId) && (c.origin === 'report' || c.origin === 'pattern')
  && (c.status === 'open' || c.status === 'resolved') && isString(c.lastSeenAt) && isNumber(c.reportCount) && isNumber(c.openReportCount);
export const isCases = (value: unknown): value is { cases: ReportCase[] } => isRecord(value) && arrayOf(value.cases, isCase);
export const isCaseDetail = (value: unknown): value is CaseDetail => isCase(value) && arrayOf((value as unknown as Record<string, unknown>).reports,
  (r): r is ReportRow => isRecord(r) && isString(r.id) && isString(r.reporterId) && (REPORT_CATEGORIES as readonly unknown[]).includes(r.category)
    && isNullableString(r.note) && isString(r.createdAt));
/** The queue: Core's page cap (ReportsQuerySchema allows 1-200). */
export const REPORTS_PATH = '/admin/reports?limit=200';

/* ---- Emails (S4) --------------------------------------------------------- */

export interface EmailEntry {
  id: string; messageId?: string; to: string; subject: string; status: string; templateType: string;
  locale?: string; userId?: string; detail: Record<string, unknown>; createdAt: string;
}
export interface EmailSummary {
  total: number; statuses: Record<string, number>; templates: Record<string, number>;
  locales?: Record<string, number>; trend?: TimelineDay[];
}
export const isEmailLogs = (value: unknown): value is { entries: EmailEntry[]; total: number } => isRecord(value) && isNumber(value.total)
  && arrayOf(value.entries, (e): e is EmailEntry => isRecord(e) && isString(e.id) && isString(e.to) && isString(e.subject)
    && isString(e.status) && isString(e.templateType) && isString(e.createdAt) && (e.detail === undefined || isRecord(e.detail)));
export const isEmailSummary = (value: unknown): value is EmailSummary => isRecord(value) && isNumber(value.total)
  && isCounts(value.statuses) && isCounts(value.templates) && (value.locales === undefined || isCounts(value.locales))
  && (value.trend === undefined || arrayOf(value.trend, isDay));
export const EMAIL_PAGE_SIZE = 25;
export const EMAIL_STATUSES = ['queued', 'relayed', 'delivered', 'failed'] as const;
export const EMAIL_TREND_DAYS = 365;

export interface EmailFilters { q: string; status: string; templateType: string }
export function emailLogsPath(filters: EmailFilters, page: number): string {
  const params = new URLSearchParams({ limit: String(EMAIL_PAGE_SIZE), offset: String(page * EMAIL_PAGE_SIZE) });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.templateType) params.set('templateType', filters.templateType);
  return `/admin/emails/logs?${params.toString()}`;
}

/* ---- Shared helpers ------------------------------------------------------ */

export const ROLE_ORDER = ['superadmin', 'admin', 'bigfounder', 'parent', 'kid', 'universal'] as const;

/** The highest role an account holds (Core's primaryRole), for the one-bucket-per-person counts. */
export function topRole(roles: readonly string[]): string {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? 'universal';
}

/** Whole years from a YYYY-MM-DD birth date, or null. */
export function ageFrom(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day || month > 12 || day > 31) return null;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 ? age : null;
}

export const AGE_GROUPS = ['lt6', '6-8', '9-10', '11-12', '13-17', '18+'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export function ageGroup(birthDate: string | null, today = new Date()): AgeGroup | null {
  const age = ageFrom(birthDate, today);
  if (age === null) return null;
  return age < 6 ? 'lt6' : age <= 8 ? '6-8' : age <= 10 ? '9-10' : age <= 12 ? '11-12' : age <= 17 ? '13-17' : '18+';
}
