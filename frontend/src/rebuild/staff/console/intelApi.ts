/*
 * S6 Learning intel and S8 Insights (view_analytics), W2T.3: the wire shapes
 * of the warehouse (dataintel, proxied read-only by Core at /admin/intel/*),
 * Core's family-engagement insight (/admin/insights/families) and Core's raw
 * event export (/admin/insights/export). Hand-mirrored and checked on arrival.
 *
 * What staff may see is fixed server-side and kept here:
 *   - H.1: behavioural events exist only when the consent gate admitted them
 *     at the source (a child's only with a verified guardian's consent), and
 *     the warehouse filters staff activity out before any metric is computed;
 *   - D.6: the family insight's per-child rows come only for children the H.1
 *     gate admits and carry no identity; its rates are the whole population's
 *     (the summary), never the listed rows';
 *   - G.6: no Mentor transcript, no wallet or banking data, no impersonation.
 *     Nothing below reads any of them. A learner is shown by name only to a
 *     viewer who holds manage_users (the same grant that opens the people
 *     directory); otherwise by a short id.
 *   - The raw export carries no user or anonymous id (Core strips them) and
 *     Core writes every export to the audit log.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isNullableNumber = (value: unknown): value is number | null => value === null || isNumber(value);
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const arrayOf = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);

/* ---- The window ------------------------------------------------------------ */

export const INTEL_PRESETS = [7, 30, 90, 365] as const;
export interface IntelWindow { days: number; from?: string; to?: string }
export const DEFAULT_WINDOW: IntelWindow = { days: 30 };

/** The window every warehouse read carries (a custom range with both ends; `days` stays as the fallback). */
export function windowQuery(window: IntelWindow): string {
  return window.from && window.to ? `days=${window.days}&from=${window.from}&to=${window.to}` : `days=${window.days}`;
}
/** The warehouse's day-count reads (summary, trends) accept 1-365. */
export const summaryDays = (window: IntelWindow) => Math.min(365, Math.max(1, window.days));
/** Cohort retention is weekly: the same window in weeks (1-52). */
export const cohortWeeks = (window: IntelWindow) => Math.max(1, Math.min(52, Math.round(window.days / 7)));
export function customWindow(from: string, to: string): IntelWindow {
  const [start, end] = from <= to ? [from, to] : [to, from];
  return { days: Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1), from: start, to: end };
}

/* ---- Overview --------------------------------------------------------------- */

export interface IntelSummary {
  dau: number; wau: number; mau: number; totalEvents: number; week1Retention: number; activationRate: number;
  peakDailyUsers: number; adoption: { role: string; routeClass: string; users: number; sessions: number }[];
}
export const isIntelSummary = (value: unknown): value is IntelSummary => isRecord(value) && isNumber(value.dau) && isNumber(value.wau)
  && isNumber(value.mau) && isNumber(value.totalEvents) && isNumber(value.week1Retention) && isNumber(value.activationRate) && isNumber(value.peakDailyUsers)
  && arrayOf(value.adoption, (a): a is IntelSummary['adoption'][number] => isRecord(a) && isString(a.role) && isNumber(a.users));

export const TREND_METRICS = ['dau', 'events', 'users', 'sessions'] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];
export const GRANULARITIES = ['day', 'week', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];
export interface TrendPoint { date: string; value: number }
export const isTrend = (value: unknown): value is TrendPoint[] => arrayOf(value, (p): p is TrendPoint => isRecord(p) && isString(p.date) && isNumber(p.value));

export interface FunnelStep { step: string; stepOrder: number; users: number; conversionFromPrevious: number | null }
export const isFunnel = (value: unknown): value is FunnelStep[] => arrayOf(value, (s): s is FunnelStep => isRecord(s) && isString(s.step)
  && isNumber(s.stepOrder) && isNumber(s.users) && isNullableNumber(s.conversionFromPrevious));

export interface Anomaly { metric: string; date: string; value: number; expected: number; zScore: number; severity: string; resolved: boolean }
export const isAnomalies = (value: unknown): value is Anomaly[] => arrayOf(value, (a): a is Anomaly => isRecord(a) && isString(a.metric)
  && isString(a.date) && isNumber(a.value) && isNumber(a.expected) && isNumber(a.zScore) && typeof a.resolved === 'boolean');

export interface StaffExclusion { excludedEvents: number; excludedShare: number | null; staffUsers: number; excludedAttempts: number }
export const isStaffExclusion = (value: unknown): value is StaffExclusion => isRecord(value) && isNumber(value.excludedEvents)
  && isNullableNumber(value.excludedShare) && isNumber(value.staffUsers) && isNumber(value.excludedAttempts);

/* ---- Family engagement (D.6) and consent coverage (H.1) --------------------- */

/**
 * S07.6 (D.6): the staff family-engagement insight on the per-child shape.
 * Mirrors Core's FamilyEngagementInsight (services/insights.ts) and the
 * migration family_engagement_insight key for key; the snake_case keys are a
 * DB-function read, not a proxied /admin/intel/* endpoint.
 * agent/tools/check-family-engagement-contract.mjs keeps the four copies equal.
 * Per-child rows come only for children whose analytics consent the H.1 gate
 * admits, and carry no identity; the summary counts every child.
 */
export interface IntelFamilySummary {
  children: number;
  children_with_tasks: number;
  active_children: number;
  tasks_created: number;
  tasks_approved: number;
  active_days: number;
  listed_children: number;
}

export interface IntelFamilyChild {
  guardians: number;
  tasks_created: number;
  tasks_approved: number;
  first_link_on: string;
  last_task_on: string | null;
}

export interface FamiliesInsight { summary: IntelFamilySummary; children: IntelFamilyChild[]; consent: { kidsTotal: number; kidsConsented: number } }
export const isFamilies = (value: unknown): value is FamiliesInsight => isRecord(value) && isRecord(value.summary)
  && isNumber(value.summary.children) && isNumber(value.summary.tasks_created) && isNumber(value.summary.tasks_approved) && isNumber(value.summary.listed_children)
  && isRecord(value.consent) && isNumber(value.consent.kidsTotal) && isNumber(value.consent.kidsConsented)
  && arrayOf(value.children, (c): c is IntelFamilyChild => isRecord(c) && isNumber(c.guardians) && isNumber(c.tasks_created)
    && isNumber(c.tasks_approved) && isString(c.first_link_on) && isNullableString(c.last_task_on));

/* ---- Retention -------------------------------------------------------------- */

export interface Cohort { cohortWeek: string; weekOffset: number; users: number; cohortSize: number; retentionPct: number }
export const isCohorts = (value: unknown): value is Cohort[] => arrayOf(value, (c): c is Cohort => isRecord(c) && isString(c.cohortWeek)
  && isNumber(c.weekOffset) && isNumber(c.cohortSize) && isNumber(c.retentionPct));

/** The cohort grid: newest cohort first, week offsets in order, each cell's share of its cohort (0-1) or null. */
export function cohortGrid(cohorts: readonly Cohort[], limit = 12) {
  const weeks = [...new Set(cohorts.map((c) => c.weekOffset))].sort((a, b) => a - b);
  const labels = [...new Set(cohorts.map((c) => c.cohortWeek))].sort().reverse().slice(0, limit);
  const cell = new Map(cohorts.map((c) => [`${c.cohortWeek}:${c.weekOffset}`, c]));
  return {
    weeks,
    rows: labels.map((label) => ({
      cohort: label,
      size: cell.get(`${label}:0`)?.cohortSize ?? Math.max(0, ...cohorts.filter((c) => c.cohortWeek === label).map((c) => c.cohortSize)),
      shares: weeks.map((week) => cell.get(`${label}:${week}`)?.retentionPct ?? null),
    })),
  };
}

/* ---- People ----------------------------------------------------------------- */

export interface ChurnRow { user_id: string; risk_level: string; risk_score: number; lessons_completed: number; days_since_active: number; last_event_at: string }
export const isChurn = (value: unknown): value is ChurnRow[] => arrayOf(value, (r): r is ChurnRow => isRecord(r) && isString(r.user_id)
  && isString(r.risk_level) && isNumber(r.risk_score) && isNumber(r.lessons_completed) && isString(r.last_event_at));
/** Worst first: the row an operator must act on is never hunted for. */
export const CHURN_LEVELS = ['high', 'medium', 'at_risk', 'active'] as const;

export function churnBuckets(rows: readonly ChurnRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.risk_level, (counts.get(row.risk_level) ?? 0) + 1);
  const known = CHURN_LEVELS.filter((level) => counts.has(level));
  const other = [...counts.keys()].filter((level) => !(CHURN_LEVELS as readonly string[]).includes(level)).sort();
  return [...known, ...other].map((level) => ({ level, count: counts.get(level)! }));
}

/* ---- Experiments and alerts (read-only here) --------------------------------- */

export interface Experiment { id: string; name: string; status: string; metric: string; variantA: string; variantB: string }
export const isExperiments = (value: unknown): value is Experiment[] => arrayOf(value, (e): e is Experiment => isRecord(e) && isString(e.id)
  && isString(e.name) && isString(e.status) && isString(e.metric) && isString(e.variantA) && isString(e.variantB));
/**
 * H.3: the outcome of an alert's latest trigger (dataintel alerts.ts). null
 * when it never fired, or the trigger is in flight or predates tracking.
 */
export const DELIVERY_STATUSES = ['delivered', 'failed', 'unconfigured'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
const isDeliveryStatus = (value: unknown): value is DeliveryStatus | null | undefined => value === null || value === undefined
  || (DELIVERY_STATUSES as readonly unknown[]).includes(value);
export interface IntelAlert {
  id: string; name: string; metric: string; condition: string; threshold: number; channel: string; status: string; lastTriggeredAt?: string | null;
  lastDeliveryStatus?: DeliveryStatus | null; lastDeliveryError?: string | null;
}
export const isAlerts = (value: unknown): value is IntelAlert[] => arrayOf(value, (a): a is IntelAlert => isRecord(a) && isString(a.id)
  && isString(a.name) && isString(a.metric) && isString(a.condition) && isNumber(a.threshold) && isString(a.channel) && isString(a.status)
  && isDeliveryStatus(a.lastDeliveryStatus) && (a.lastDeliveryError === undefined || isNullableString(a.lastDeliveryError)));

/**
 * Appendix O 1.3 (H.3): the Alert-to-Notification Delivery Rate
 * (GET /admin/intel/alerts/delivery). `rate` is delivered / triggered, null
 * when nothing fired; the target is 100%.
 */
export interface AlertDeliveryRate { days: number; triggered: number; delivered: number; failed: number; unconfigured: number; pending: number; rate: number | null; target: number }
export const isAlertDelivery = (value: unknown): value is AlertDeliveryRate => isRecord(value) && isNumber(value.days) && isNumber(value.triggered)
  && isNumber(value.delivered) && isNumber(value.failed) && isNumber(value.unconfigured) && isNumber(value.pending) && isNullableNumber(value.rate) && isNumber(value.target);
/** The delivery rate is read over a fixed month: the Experiments & alerts view has no window of its own. */
export const DELIVERY_WINDOW_DAYS = 30;

/**
 * Appendix O 1.1 (H.1): Teen/Guest Consent-Adjacent Disclosure Coverage
 * (GET /admin/analytics/consent-coverage): active self-registered teens shown
 * the disclosure (or with analytics suppressed) and active guests (suppressed
 * by their protected origin), against a 100% target. Counts only.
 */
export interface DisclosureCoverage {
  teens: { active: number; disclosed: number; optedIn: number; optedOut: number; protectedOrigin: number; measuredWithoutOptIn: number; covered: number };
  guests: { active: number; suppressed: number; measured: number };
  days: number; covered: number; population: number; coverage: number | null; target: number; status: 'met' | 'missed' | 'no_data';
  /** Appendix O 1.1, Consent-Gate Population Gap Rate: measured with no choice behind it, target zero. */
  gap?: { measured: number; rate: number | null; target: number; status: 'met' | 'missed' | 'no_data' };
}
export const isDisclosureCoverage = (value: unknown): value is DisclosureCoverage => isRecord(value) && isRecord(value.teens) && isRecord(value.guests)
  && isNumber(value.teens.active) && isNumber(value.teens.disclosed) && isNumber(value.teens.optedIn) && isNumber(value.teens.optedOut)
  && isNumber(value.teens.measuredWithoutOptIn) && isNumber(value.teens.covered)
  && isNumber(value.guests.active) && isNumber(value.guests.suppressed) && isNumber(value.guests.measured)
  && isNumber(value.covered) && isNumber(value.population) && isNullableNumber(value.coverage) && isNumber(value.target)
  && ['met', 'missed', 'no_data'].includes(value.status as string)
  && (value.gap === undefined || (isRecord(value.gap) && isNumber(value.gap.measured) && isNullableNumber(value.gap.rate) && isNumber(value.gap.target)
    && ['met', 'missed', 'no_data'].includes(value.gap.status as string)));

/* ---- Insights (S8): learning evidence ----------------------------------------- */

export type EvidenceStatus = 'awaiting_evidence' | 'limited' | 'sufficient';
export type Attention = 'awaiting_evidence' | 'monitor' | 'review' | 'healthy';
export type Recommendation = 'remediate' | 'practice' | 'retrieve' | 'continue';

export interface LearningTrend { date: string; attempts: number; learners: number; avgScore: number | null; firstTryAvgScore: number | null }
export interface CourseHealth {
  courseId: string; courseSlug: string | null; courseTitleEn: string | null; courseTitleEs: string | null; courseTitlePt: string | null;
  lessons: number; learners: number; attempts: number; avgScore: number | null; firstTryAvgScore: number | null; hintRate: number | null;
  retryRate: number | null; avgSecondsPerAttempt: number | null; starts: number; completions: number; abandonRate: number | null;
  evidenceStatus: EvidenceStatus; attention: Attention;
}
export interface LessonHealth extends CourseHealth { lessonId: string; lessonSlug: string | null; lessonTitleEn: string | null; lessonTitleEs: string | null; lessonTitlePt: string | null }
export interface LearnerProfile {
  userId: string; role: string | null; attempts: number; avgScore: number | null; firstTryAvgScore: number | null; hintRate: number | null;
  avgMasteryProbability: number | null; skillsNeedingSupport: number; recommendedAction: Recommendation | null; lastActiveAt: string | null; evidenceStatus: EvidenceStatus;
}
export interface LearningOverview {
  snapshot: { courses: number; lessons: number; attempts: number; learners: number; avgScore: number | null; firstTryAvgScore: number | null;
    hintRate: number | null; retryRate: number | null; evidenceStatus: EvidenceStatus };
  trends: LearningTrend[]; courses: CourseHealth[]; lessons: LessonHealth[]; learners: LearnerProfile[];
}
const EVIDENCE = ['awaiting_evidence', 'limited', 'sufficient'];
const isTrendRow = (t: unknown): t is LearningTrend => isRecord(t) && isString(t.date) && isNumber(t.attempts) && isNullableNumber(t.avgScore);
const isCourse = (c: unknown): c is CourseHealth => isRecord(c) && isString(c.courseId) && isNullableString(c.courseTitleEn ?? null)
  && isNumber(c.lessons) && isNumber(c.learners) && isNumber(c.attempts) && isNullableNumber(c.avgScore) && isNumber(c.starts) && isNumber(c.completions)
  && EVIDENCE.includes(c.evidenceStatus as string) && isString(c.attention);
const isLesson = (l: unknown): l is LessonHealth => isCourse(l) && isString((l as unknown as Record<string, unknown>).lessonId);
const isLearner = (l: unknown): l is LearnerProfile => isRecord(l) && isString(l.userId) && isNumber(l.attempts) && isNullableNumber(l.avgMasteryProbability)
  && isNumber(l.skillsNeedingSupport) && EVIDENCE.includes(l.evidenceStatus as string);
export const isLearningOverview = (value: unknown): value is LearningOverview => isRecord(value) && isRecord(value.snapshot)
  && isNumber(value.snapshot.courses) && isNumber(value.snapshot.lessons) && isNumber(value.snapshot.attempts) && isNumber(value.snapshot.learners)
  && EVIDENCE.includes(value.snapshot.evidenceStatus as string)
  && arrayOf(value.trends, isTrendRow) && arrayOf(value.courses, isCourse) && arrayOf(value.lessons, isLesson) && arrayOf(value.learners, isLearner);

export interface SkillHealth { skillKey: string; learners: number; attempts: number; avgMasteryProbability: number; hintRate: number; priority: string }
export const isSkillHealth = (value: unknown): value is { skills: SkillHealth[] } => isRecord(value) && arrayOf(value.skills, (s): s is SkillHealth => isRecord(s)
  && isString(s.skillKey) && isNumber(s.learners) && isNumber(s.avgMasteryProbability) && isNumber(s.hintRate) && isString(s.priority));

export interface LearnerDetail {
  profile: LearnerProfile | null; trends: LearningTrend[]; courses: CourseHealth[];
  states: { skillKey: string; masteryProbability: number; evidenceCount: number; recommendedAction: Recommendation }[];
}
export const isLearnerDetail = (value: unknown): value is LearnerDetail => isRecord(value) && (value.profile === null || isLearner(value.profile))
  && arrayOf(value.trends, isTrendRow) && arrayOf(value.courses, isCourse)
  && arrayOf(value.states, (s): s is LearnerDetail['states'][number] => isRecord(s) && isString(s.skillKey) && isNumber(s.masteryProbability) && isString(s.recommendedAction));

/** A course or lesson title in the surface's language, falling back to English, then the slug. */
export function titleIn(locale: string, item: { en: string | null; es: string | null; pt: string | null; slug: string | null }): string | null {
  const localized = locale.startsWith('es') ? item.es : locale.startsWith('pt') ? item.pt : item.en;
  return localized || item.en || item.slug;
}

/** Names for the learner directory: only for a viewer who holds manage_users (GET /admin/users). */
export const isUserNames = (value: unknown): value is { users: { userId: string; displayName: string }[] } => isRecord(value)
  && arrayOf(value.users, (u): u is { userId: string; displayName: string } => isRecord(u) && isString(u.userId) && isString(u.displayName));

/* ---- Raw events (S8 export) ------------------------------------------------------ */

/** Core's InsightsExportQuerySchema: days 1-365, csv or json, optional role and event; paged with a continuation token. */
export const EXPORT_ROLES = ['anon', 'universal', 'parent', 'kid', 'bigfounder'] as const;
export interface RawExportRequest { days: number; format: 'csv' | 'json'; role: string; event: string; offset: number; token: string | null }
export function rawExportPath(request: RawExportRequest): string {
  const params = new URLSearchParams({ days: String(Math.min(365, Math.max(1, request.days))), format: request.format });
  if (request.role) params.set('role', request.role);
  if (request.event) params.set('event', request.event);
  if (request.offset > 0) params.set('offset', String(request.offset));
  if (request.token) params.set('exportToken', request.token);
  return `/admin/insights/export?${params.toString()}`;
}

/* ---- Views ------------------------------------------------------------------------ */

export const INTEL_VIEWS = ['overview', 'insights', 'retention', 'people', 'families', 'operations'] as const;
export type IntelView = (typeof INTEL_VIEWS)[number];
/** `?view=`; the legacy `?focus=learning` (and /admin/insights, which redirects here) opens Insights. */
export function intelView(view: string | null, focus: string | null = null): IntelView {
  if ((INTEL_VIEWS as readonly string[]).includes(view ?? '')) return view as IntelView;
  return focus === 'learning' ? 'insights' : 'overview';
}
