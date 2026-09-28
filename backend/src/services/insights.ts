import { admitsAcquisitionAnswer, allowsSelfManagedAnalytics } from './analyticsPreference.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';
import { readAgeScreen } from './ageScreen.js';

/*
 * First-party usage telemetry + the insight reads (0023, spec: /INSIGHTS.md).
 *
 * The §1.9 contract, enforced HERE and not in the client:
 *  - A kid's events are recorded ONLY while an active analytics_consents row
 *    exists for that kid. Consent is granted/revoked exclusively by a
 *    VERIFIED guardian through the family router. Fail-closed: if Vault
 *    cannot answer the consent question, the events are DROPPED — we never
 *    record first and ask later.
 *  - The event vocabulary is closed (mirrors the DB CHECK constraints), and
 *    rows carry no free text: nothing a child types can enter this stream.
 *  - Everything is first-party (Vault). None of it feeds Pulse or any
 *    third-party API.
 */

/** Mirrors the 0028/0072/S05.3d (learning_quality_events)/S05.3e (motivation_events) CHECK exactly. Closed by design (§1.9 rule 2). */
export const RECORDABLE_EVENTS = [
  // session lifecycle
  'session_start', 'session_heartbeat', 'session_end', 'nav_view',
  // acquisition / marketing
  'page_view', 'cta_click', 'scroll_depth',
  // signup funnel
  'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
  // activation
  'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
  // lesson micro-behaviour
  'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
  'hint_open', 'explanation_view', 'audio_replay', 'results_view',
  // other surfaces. task_complete is deliberately ABSENT: Tasks is still a
  // placeholder surface, so nothing can emit it. This list must be a SUBSET
  // of the 0028 CHECK — a value Core accepts but Postgres rejects fails the
  // INSERT for the entire 25-event batch, not just the offending row.
  // game_open/game_start/game_complete removed as dead vocabulary: the Game
  // Engine that emitted them was removed 2026-07-31 (WALKTHROUGH.md) and no
  // code path emits them anymore. The 0028 CHECK still permits them at the
  // DB level (narrower app-side vocabulary than the DB allows is safe); no
  // migration is needed to remove app-side support for a value.
  'task_view',
  'profile_edit', 'avatar_edit', 'tutor_open',
  // retention / family
  'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke',
  // parent report + achievement sharing (0072). badge_link_click is retired
  // app-side (OD-20: Appendix L counts shares initiated, never viewer reach),
  // so Core refuses it; the 0072 CHECK still permits it until the dated
  // removal narrows it (docs/rebuild/policies/ACHIEVEMENT-SHARING.md).
  'parent_report_viewed', 'badge_generated', 'badge_shared',
  // B.5 replay-notice display rate (S05.3d). replay_below_best is written by
  // Core only (SERVER_ONLY_EVENTS); replay_notice_view by the result screen.
  'replay_below_best', 'replay_notice_view',
  // B.21 / B.24 motivation metrics (S05.3e, *_motivation_events.sql). All
  // three are written by Core only (SERVER_ONLY_EVENTS).
  'streak_rest_day', 'streak_restart', 'path_choice',
] as const;

/**
 * Events only Core may write. The client ingest drops them: a forged
 * denominator would move a metric that must stay trustworthy.
 */
export const SERVER_ONLY_EVENTS: ReadonlySet<string> = new Set(['replay_below_best', 'streak_rest_day', 'streak_restart', 'path_choice']);

export const ROUTE_CLASSES = ['learn', 'tasks', 'profile', 'tutor', 'family', 'admin', 'marketing', 'other'] as const;
export const DEVICES = ['mobile', 'tablet', 'desktop'] as const;
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export const REFERRER_CLASSES = ['direct', 'search', 'social', 'referral', 'internal', 'campaign'] as const;

export type RecordableEvent = (typeof RECORDABLE_EVENTS)[number];
export type RouteClass = (typeof ROUTE_CLASSES)[number];
export type Device = (typeof DEVICES)[number];
export type EventLocale = (typeof LOCALES)[number];
export type ReferrerClass = (typeof REFERRER_CLASSES)[number];

/**
 * The role stamped onto each event, chosen from the caller's DB roles.
 * `kid` wins unconditionally — if a user is somehow kid+anything, the
 * consent gate and the kid segmentation must both apply (§1.9 errs toward
 * the child). After that, the more specific role beats `universal`.
 */
const ROLE_STAMP_ORDER = ['kid', 'parent', 'bigfounder', 'superadmin', 'admin', 'universal'] as const;

export function stampRole(roles: string[]): string {
  return ROLE_STAMP_ORDER.find((r) => roles.includes(r)) ?? 'universal';
}

export interface LearningEventInsert {
  /** Exactly one of user_id / anon_id is required (0024 CHECK). */
  user_id?: string | null;
  anon_id?: string | null;
  role: string;
  event: RecordableEvent;
  route_class?: RouteClass | null;
  lesson_id?: string | null;
  segment_id?: string | null;
  value?: number | null;
  session_id?: string | null;
  device?: Device | null;
  locale?: EventLocale | null;
  referrer_class?: ReferrerClass | null;
  ordinal?: number | null;
  client_event_id?: string;
  event_version?: number;
  occurred_at?: string;
  course_id?: string | null;
  experiment_id?: string | null;
  experiment_variant?: 'A' | 'B' | null;
}

/**
 * Batch insert with a client idempotency key. A retry must not inflate a
 * decision metric. PostgREST returns only inserted rows, making `accepted`
 * truthful even when a pagehide retry races a normal flush.
 */
export async function insertLearningEvents(rows: LearningEventInsert[]): Promise<number | null> {
  if (rows.length === 0) return 0;
  // Apply the same optional-collection policy to server-produced events.
  // The database trigger remains the atomic backstop against concurrent revocation.
  const decisions = new Map<string, Promise<boolean>>();
  const allowed = (userId: string) => {
    let decision = decisions.get(userId);
    if (!decision) {
      decision = (async () => {
        const [age, roles] = await Promise.all([readAgeScreen(userId), getRolesForGate(userId)]);
        if (!age || age.required || age.protectedOrigin || !roles?.length) return false;
        if (roles.includes('kid')) return await hasActiveAnalyticsConsent(userId) === true;
        return allowsSelfManagedAnalytics(userId, age);
      })();
      decisions.set(userId, decision);
    }
    return decision;
  };
  const admission = await Promise.all(rows.map(row => row.user_id ? allowed(row.user_id) : true));
  const admitted = rows.filter((_row, index) => admission[index]);
  if (admitted.length === 0) return 0;
  const stampedRows = admitted.map((row) => ({
    ...row,
    client_event_id: row.client_event_id ?? serverEventId(),
    event_version: row.event_version ?? 1,
    occurred_at: row.occurred_at ?? new Date().toISOString(),
  }));
  const res = await serviceRest<unknown[]>('/learning_events?on_conflict=client_event_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(stampedRows),
  });
  return res === null ? null : res.length;
}

/** Legacy/manual clients have no browser-generated id. They remain accepted,
 * but current beacon events always carry their own idempotency key. */
export function serverEventId(): string {
  return randomUUID();
}

/**
 * A stable idempotency key for a server event that may be observed more than
 * once (S05.3e: a path choice is recorded when a lesson opens, and a reload
 * opens it again). Same key, same uuid; the unique index drops the repeat.
 */
export function deterministicEventId(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

// ── Consent ─────────────────────────────────────────────────

interface ConsentRow {
  id?: number;
  kid_user_id: string;
  granted_at: string;
  revoked_at: string | null;
}

/**
 * Whether the kid's guardian consent is currently active.
 * `null` means VAULT DID NOT ANSWER — callers must treat that as "no"
 * (fail-closed), never as "assume yes".
 */
export async function hasActiveAnalyticsConsent(kidUserId: string): Promise<boolean | null> {
  const rows = await serviceRest<ConsentRow[]>(
    `/analytics_consents?kid_user_id=eq.${encodeURIComponent(kidUserId)}&revoked_at=is.null&select=kid_user_id,granted_at,revoked_at&limit=1`,
  );
  if (rows === null) return null;
  return rows.length > 0;
}

/** Active-consent state for a set of kids (the parent dashboard list). */
export async function getConsentsForKids(kidIds: string[]): Promise<Map<string, boolean> | null> {
  const out = new Map<string, boolean>(kidIds.map((id) => [id, false]));
  if (kidIds.length === 0) return out;
  const filter = kidIds.map((id) => encodeURIComponent(id)).join(',');
  const rows = await serviceRest<ConsentRow[]>(
    `/analytics_consents?kid_user_id=in.(${filter})&revoked_at=is.null&select=kid_user_id,granted_at,revoked_at`,
  );
  if (rows === null) return null;
  for (const r of rows) out.set(r.kid_user_id, true);
  return out;
}

/**
 * Grant (or re-grant after a revocation). The ledger is APPEND-ONLY: a
 * re-grant INSERTS a new row rather than resurrecting the revoked one —
 * upserting onto a single row would rewrite granted_at/revoked_at and
 * destroy the "was consent active on date X" audit trail that justifies
 * keeping already-collected data. Idempotent: an active grant stays as-is.
 */
/*
 * Returns what actually HAPPENED, not merely whether the call succeeded.
 *
 * The caller records a consent_grant / consent_revoke event, and a parent who
 * re-taps an already-on toggle (or whose client retries) must not manufacture
 * a consent decision that was never made. Consent history is the record that
 * would be produced if anyone ever asks what a guardian agreed to and when —
 * phantom entries in it are worse than no entries.
 */
export type ConsentOutcome = 'changed' | 'unchanged' | null;

export async function grantAnalyticsConsent(kidUserId: string, grantedBy: string): Promise<ConsentOutcome> {
  const already = await hasActiveAnalyticsConsent(kidUserId);
  if (already === null) return null;
  if (already) return 'unchanged';
  const res = await serviceRest<unknown>('/analytics_consents', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      kid_user_id: kidUserId,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
    }),
  });
  return res === null ? null : 'changed';
}

/**
 * Revoke: closes the OPEN row(s) only — history rows are never touched.
 *
 * `return=representation` rather than `minimal` so the affected rows come
 * back: a PATCH that matches nothing is a perfectly successful request, and
 * without the row count there is no way to tell "consent withdrawn" from
 * "there was nothing to withdraw".
 */
export async function revokeAnalyticsConsent(kidUserId: string): Promise<ConsentOutcome> {
  const res = await serviceRest<unknown[]>(
    `/analytics_consents?kid_user_id=eq.${encodeURIComponent(kidUserId)}&revoked_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    },
  );
  if (res === null) return null;
  return Array.isArray(res) && res.length > 0 ? 'changed' : 'unchanged';
}

/**
 * Roles resolved with the SERVICE role — the §1.9 gates must not depend on
 * the caller's own RLS-scoped read: this repo has already lost an RLS policy
 * to a migration replay, and with a user-token read that regression would
 * return [] (not an error), silently reclassifying every kid as an adult.
 * `null` = Vault did not answer.
 */
export async function getRolesForGate(userId: string): Promise<string[] | null> {
  const rows = await serviceRest<{ role: string }[]>(
    `/user_roles?user_id=eq.${encodeURIComponent(userId)}&select=role`,
  );
  if (rows === null) return null;
  return rows.map((r) => r.role);
}

// ── Insight reads (the 0023 views, service-role only) ───────

const CalibrationRow = z.object({
  lesson_id: z.string().nullable(),
  lesson_slug: z.string().nullable(),
  lesson_title: z.record(z.string(), z.unknown()).nullable(),
  segment_id: z.string(),
  attempts: z.number(),
  learners: z.number(),
  avg_score: z.coerce.number().nullable(),
  avg_attempts_per_learner: z.coerce.number().nullable(),
  hint_rate: z.coerce.number().nullable(),
  first_try_avg_score: z.coerce.number().nullable(),
  last_attempt_at: z.string().nullable(),
});
export type CalibrationEntry = z.infer<typeof CalibrationRow>;

/**
 * Worst-calibrated exercises first (most attempts a learner needs). Built
 * entirely from lesson_segment_attempts — data the product records anyway,
 * so this report works from day one with zero new collection.
 */
export async function readSegmentCalibration(opts: { minLearners: number; limit: number }): Promise<CalibrationEntry[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/insights_segment_calibration?learners=gte.${opts.minLearners}` +
      `&order=avg_attempts_per_learner.desc.nullslast&limit=${opts.limit}&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(CalibrationRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const ActivityRow = z.object({
  day: z.string(),
  role: z.string(),
  event: z.string(),
  route_class: z.string(),
  device: z.string(),
  locale: z.string(),
  events: z.coerce.number(),
  users: z.coerce.number(),
  sessions: z.coerce.number(),
  total_value: z.coerce.number().nullable(),
});
export type ActivityEntry = z.infer<typeof ActivityRow>;

/*
 * The per-dimension rollup. `users` here is a count-distinct WITHIN one
 * dimension combination and must never be summed across rows — use
 * readDailyUsers() for headline user counts (see the 0025 comment).
 *
 * The row cap is not cosmetic: 0025 added device and locale to the grain, so
 * a busy 90-day window is roughly 9x the rows the earlier shape produced, and
 * an unbounded select would stream all of it into a dashboard that renders a
 * few dozen. Ordered day-descending so a truncated read keeps the RECENT days
 * the console actually plots.
 */
export async function readDailyActivity(sinceDays: number, limit = 20_000): Promise<ActivityEntry[] | null> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  /*
   * ROLLUP FOR HISTORY + LIVE FOR TODAY. The rollup is written nightly, so it
   * holds nothing for the current day; reading it alone made the console show
   * a confident 0 on a day with real traffic. The rollup is read strictly
   * BELOW today (`day=lt.`) so the two sources can never double-count the
   * same day, and today comes from a one-day, index-backed view.
   */
  const [history, live] = await Promise.all([
    serviceRest<unknown[]>(`/insights_daily_activity?day=gte.${since}&day=lt.${today}&order=day.desc&limit=${limit}&select=*`),
    serviceRest<unknown[]>('/insights_today_activity?select=*'),
  ]);
  if (history === null || live === null) return null;
  const parsed = z.array(ActivityRow).safeParse([...live, ...history]);
  return parsed.success ? parsed.data : null;
}

const DailyUsersRow = z.object({
  day: z.string(),
  role: z.string(),
  users: z.coerce.number(),
  sessions: z.coerce.number(),
});
export type DailyUsersEntry = z.infer<typeof DailyUsersRow>;

/**
 * Distinct users and sessions per day, counted at the right grain. role = ''
 * is the true all-roles figure for the day, NOT the sum of the per-role rows.
 */
export async function readDailyUsers(sinceDays: number): Promise<DailyUsersEntry[] | null> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  // Same rollup-plus-live split as readDailyActivity, for the same reason.
  const [history, live] = await Promise.all([
    serviceRest<unknown[]>(`/insights_daily_users?day=gte.${since}&day=lt.${today}&order=day.asc&select=*`),
    serviceRest<unknown[]>('/insights_today_users?select=*'),
  ]);
  if (history === null || live === null) return null;
  const parsed = z.array(DailyUsersRow).safeParse([...history, ...live]);
  return parsed.success ? parsed.data : null;
}

/*
 * S07.6 (D.6): the staff family-engagement insight on the per-child shape.
 * 0074 redefined insights_family_engagement per child, but this reader kept
 * parsing the earlier per-family shape (family_id, members, tasks_completed),
 * so every row failed validation and the endpoint answered "Family views
 * unreachable". The database now answers through family_engagement_insight
 * (migration family_engagement_insight): population counts over every child
 * with a verified Tutor, and per-child rows ONLY for children the H.1
 * analytics gate admits, with no identity. These keys are the wire contract;
 * agent/tools/check-family-engagement-contract.mjs keeps this parser, that
 * migration and the console's type equal.
 */
export const FAMILY_ENGAGEMENT_SUMMARY_KEYS = ['children', 'children_with_tasks', 'active_children', 'tasks_created', 'tasks_approved', 'active_days', 'listed_children'] as const;
export const FAMILY_ENGAGEMENT_CHILD_KEYS = ['guardians', 'tasks_created', 'tasks_approved', 'first_link_on', 'last_task_on'] as const;

const count = z.number().int().min(0);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FamilyEngagementInsight = z.object({
  summary: z.object({
    children: count, children_with_tasks: count, active_children: count, tasks_created: count, tasks_approved: count,
    active_days: z.number().int().min(1).max(365), listed_children: count,
  }).strict(),
  children: z.array(z.object({
    guardians: count, tasks_created: count, tasks_approved: count, first_link_on: day, last_task_on: day.nullable(),
  }).strict()).max(500),
}).strict();
export type FamilyEngagementInsight = z.infer<typeof FamilyEngagementInsight>;

/** The window in which a child with a chore counts as active (Block D threshold log). */
export const ENGAGEMENT_ACTIVE_DAYS = 30;

export type InsightOutcome = 'ok' | 'unavailable' | 'shape_mismatch';

/**
 * The insight, or why it could not be served: 'unavailable' (the database did
 * not answer) and 'shape_mismatch' (it answered, but not in the contract's
 * shape, the D.6 failure mode) are told apart so the uptime record can.
 */
export async function readFamilyEngagementInsight(limit: number): Promise<{ ok: true; data: FamilyEngagementInsight } | { ok: false; outcome: Exclude<InsightOutcome, 'ok'> }> {
  const raw = await serviceRestRaw('/rpc/family_engagement_insight', {
    method: 'POST', body: JSON.stringify({ p_limit: limit, p_active_days: ENGAGEMENT_ACTIVE_DAYS }),
  });
  if (!raw.ok) return { ok: false, outcome: 'unavailable' };
  const parsed = FamilyEngagementInsight.safeParse(raw.body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, outcome: 'shape_mismatch' };
}

/**
 * Appendix H (Staff Family-Engagement Insight Uptime): every staff request's
 * outcome is recorded next to the nightly probe's. Best-effort by design: a
 * failed record never changes what the staff member is served, and a database
 * that cannot be reached cannot record its own outage (the probe and Core's
 * own error log cover that window).
 */
export async function recordStaffInsightCheck(outcome: InsightOutcome): Promise<void> {
  try {
    await serviceRestRaw('/rpc/record_staff_insight_check', {
      method: 'POST', body: JSON.stringify({ p_insight: 'family_engagement', p_source: 'request', p_outcome: outcome }),
    });
  } catch {
    // Recording is observability, never part of the answer.
  }
}

const UptimeRows = z.array(z.object({
  source: z.enum(['probe', 'request']),
  checks: z.coerce.number().int().min(0),
  ok: z.coerce.number().int().min(0),
  last_outcome: z.enum(['ok', 'unavailable', 'shape_mismatch']).nullable(),
  last_checked_at: z.string().nullable(),
}).strict()).length(2);

export async function readStaffInsightUptime(since: Date) {
  const parsed = UptimeRows.safeParse(await serviceRest<unknown>('/rpc/staff_insight_uptime', {
    method: 'POST', body: JSON.stringify({ p_insight: 'family_engagement', p_since: since.toISOString() }),
  }));
  return parsed.success ? parsed.data : null;
}

/** Exact row count via Content-Range — O(1) response, no row transfer. */
async function countRows(path: string): Promise<number | null> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) return null;
    const total = res.headers.get('content-range')?.split('/')[1];
    if (!total || total === '*') return null;
    const n = Number(total);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Kids with active consent vs kids total — the coverage KPI. Counts, not rows. */
export async function readConsentCoverage(): Promise<{ kidsTotal: number; kidsConsented: number } | null> {
  const [kidsTotal, kidsConsented] = await Promise.all([
    countRows('/user_roles?role=eq.kid&select=user_id'),
    countRows('/analytics_consents?revoked_at=is.null&select=id'),
  ]);
  if (kidsTotal === null || kidsConsented === null) return null;
  return { kidsTotal, kidsConsented };
}

// ── Anonymous acquisition funnel (0024) ─────────────────────

export interface AnonVisitorUpsert {
  anon_id: string;
  referrer_class?: ReferrerClass | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  landing_route?: string | null;
  device?: Device | null;
  locale?: EventLocale | null;
}

/**
 * Register (or touch) a first-party visitor. Holds NO PII by construction —
 * no IP, no user agent, no raw referrer, only the coarse classes and our own
 * campaign labels. Never throws: acquisition telemetry cannot break a page.
 */
export async function upsertAnonVisitor(v: AnonVisitorUpsert): Promise<boolean> {
  const res = await serviceRest<unknown>('/anon_visitors?on_conflict=anon_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({ ...v, last_seen_at: new Date().toISOString() }),
  });
  return res !== null;
}

/**
 * Attribute a signup to the visitor that produced it — the one question the
 * product could not answer at all before 0024 ("which channel brings users").
 *
 * ADULTS ONLY, and that is a hard rule: linking a kid would turn their
 * pre-consent browsing into a retained behavioural profile attached to a
 * child's identity, which is exactly what the consent gate exists to prevent.
 * A kid signup leaves the anon row orphaned and unlinked.
 */
/*
 * Link an anonymous visitor to the account it became.
 *
 * `converted_at=is.null` is the whole correctness story: without it, every
 * later login from the same browser re-PATCHes the row, so a shared family
 * device re-attributes the visitor to whoever logged in most recently and the
 * campaign that produced the ORIGINAL signup is overwritten. First conversion
 * wins, and the call is idempotent — which is what lets the events route call
 * it on every login without thinking about it.
 */
export async function attributeSignup(anonId: string, userId: string, roles: string[]): Promise<boolean> {
  if (!await admitsAcquisitionAnswer(userId, await readAgeScreen(userId), roles)) return false;
  const res = await serviceRest<unknown>(`/anon_visitors?anon_id=eq.${encodeURIComponent(anonId)}&converted_at=is.null`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ converted_user_id: userId, converted_at: new Date().toISOString() }),
  });
  return res !== null;
}

// ── The 0024 analytical views ───────────────────────────────

const CohortRow = z.object({
  cohort_week: z.string(),
  week_offset: z.coerce.number(),
  users: z.coerce.number(),
  cohort_size: z.coerce.number(),
});
export type CohortEntry = z.infer<typeof CohortRow>;

export async function readCohortRetention(weeks: number): Promise<CohortEntry[] | null> {
  const since = new Date(Date.now() - weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  const rows = await serviceRest<unknown[]>(
    `/insights_cohort_retention?cohort_week=gte.${since}&order=cohort_week.desc,week_offset.asc&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(CohortRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const FunnelRow = z.object({ step_order: z.coerce.number(), step: z.string(), users: z.coerce.number() });
export type FunnelEntry = z.infer<typeof FunnelRow>;

export async function readActivationFunnel(): Promise<FunnelEntry[] | null> {
  const rows = await serviceRest<unknown[]>('/insights_activation_funnel?order=step_order.asc&select=*');
  if (rows === null) return null;
  const parsed = z.array(FunnelRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const VelocityRow = z.object({
  user_id: z.string(),
  lessons_passed: z.coerce.number(),
  avg_score: z.coerce.number().nullable(),
  avg_attempts: z.coerce.number().nullable(),
  lessons_per_week: z.coerce.number().nullable(),
  streak_days: z.coerce.number().nullable(),
  longest_streak: z.coerce.number().nullable(),
  xp_points: z.coerce.number().nullable(),
});
export type VelocityEntry = z.infer<typeof VelocityRow>;

export async function readLearningVelocity(limit: number): Promise<VelocityEntry[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/insights_learning_velocity?order=lessons_passed.desc&limit=${limit}&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(VelocityRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const DropoffRow = z.object({
  lesson_id: z.string().nullable(),
  lesson_slug: z.string().nullable(),
  starts: z.coerce.number(),
  abandons: z.coerce.number(),
  completions: z.coerce.number(),
  abandon_rate: z.coerce.number().nullable(),
  avg_seconds_before_abandon: z.coerce.number().nullable(),
});
export type DropoffEntry = z.infer<typeof DropoffRow>;

export async function readLessonDropoff(limit: number): Promise<DropoffEntry[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/insights_lesson_dropoff?order=abandon_rate.desc.nullslast&limit=${limit}&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(DropoffRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const AdoptionRow = z.object({
  role: z.string(),
  route_class: z.string(),
  events: z.coerce.number(),
  users: z.coerce.number(),
  sessions: z.coerce.number(),
});
export type AdoptionEntry = z.infer<typeof AdoptionRow>;

export async function readFeatureAdoption(): Promise<AdoptionEntry[] | null> {
  const rows = await serviceRest<unknown[]>('/insights_feature_adoption?order=events.desc&select=role,route_class,events,users,sessions');
  if (rows === null) return null;
  const parsed = z.array(AdoptionRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const DepthRow = z.object({
  session_id: z.string(),
  started_at: z.string(),
  role: z.string().nullable(),
  device: z.string().nullable(),
  events: z.coerce.number(),
  surfaces: z.coerce.number(),
  lessons_started: z.coerce.number(),
  visible_seconds: z.coerce.number().nullable(),
});
export type DepthEntry = z.infer<typeof DepthRow>;

export async function readSessionDepth(sinceDays: number, limit: number): Promise<DepthEntry[] | null> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const rows = await serviceRest<unknown[]>(
    `/insights_session_depth?started_at=gte.${since}&order=started_at.desc&limit=${limit}` +
      `&select=session_id,started_at,role,device,events,surfaces,lessons_started,visible_seconds`,
  );
  if (rows === null) return null;
  const parsed = z.array(DepthRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

// ── Export (internal analysis) ──────────────────────────────

export interface ExportFilters {
  sinceDays: number;
  role?: string;
  event?: string;
  routeClass?: string;
  locale?: string;
  device?: string;
  limit: number;
  offset: number;
  /** Salt reused across the pages of ONE logical export. See readEventExport. */
  token?: string;
}

/** Columns pulled from the table. session_id never reaches the file as-is. */
const EXPORT_SOURCE = [
  'created_at', 'role', 'event', 'route_class', 'locale', 'device',
  'referrer_class', 'session_id', 'ordinal', 'lesson_id', 'segment_id', 'value',
] as const;

/** Columns actually written out: session_id is replaced by session_ref. */
const EXPORT_COLUMNS = [
  'created_at', 'role', 'event', 'route_class', 'locale', 'device',
  'referrer_class', 'session_ref', 'ordinal', 'lesson_id', 'segment_id', 'value',
] as const;

/**
 * Raw event rows for internal analysis. Deliberately EXCLUDES user_id and
 * anon_id: an export is a file that leaves the platform's access controls
 * (a laptop, a spreadsheet, a BI tool), so it carries behaviour and
 * dimensions but no identifier that re-identifies a learner. Cohort-level
 * questions are answered by the views; per-user questions stay inside the
 * console, behind auth.
 *
 * SESSION IDENTIFIERS ARE RE-KEYED PER EXPORT. Dropping user_id is not enough
 * on its own: a stable session_id is a pseudonymous identifier, and two files
 * pulled a month apart could be joined on it to rebuild one child's history
 * across exports — reintroducing exactly what removing user_id was meant to
 * prevent. Each export mints a random salt and emits
 * `session_ref = sha256(salt + session_id)`, so ordering and within-session
 * sequence analysis (the reason the column exists) are fully preserved, while
 * the identifier is meaningless outside this one file and cannot be joined
 * back to the console. The salt is never stored.
 *
 * PAGES OF ONE EXPORT MUST SHARE THE SALT. A fresh salt per HTTP request
 * would give the same session a different ref on either side of a page
 * boundary — silently breaking the sequence analysis for exactly the large
 * exports that need paging. The first page returns its salt as an export
 * token and continuation pages echo it back.
 *
 * The token is client-echoed rather than server-stored deliberately: Core is
 * horizontally scaled, so per-instance state would break paging behind a load
 * balancer. The trade-off is that a caller who keeps a token can deliberately
 * make two exports linkable — acceptable, because that caller is an
 * authenticated admin who can already read `user_id` in the console. The
 * pseudonym defends against a file being re-identified downstream, not
 * against the person who generated it.
 */
export async function readEventExport(f: ExportFilters): Promise<{ rows: Record<string, unknown>[]; truncated: boolean; token: string } | null> {
  const since = new Date(Date.now() - f.sinceDays * 86_400_000).toISOString();
  const parts = [
    `created_at=gte.${since}`,
    `select=${EXPORT_SOURCE.join(',')}`,
    `order=created_at.desc`,
    // One extra row is a truncation PROBE: if it comes back, more data exists
    // beyond this page. Reporting that is the difference between an export and
    // a silently clipped file that a analyst reads as the complete picture.
    `limit=${f.limit + 1}`,
    `offset=${f.offset}`,
  ];
  if (f.role) parts.push(`role=eq.${encodeURIComponent(f.role)}`);
  if (f.event) parts.push(`event=eq.${encodeURIComponent(f.event)}`);
  if (f.routeClass) parts.push(`route_class=eq.${encodeURIComponent(f.routeClass)}`);
  if (f.locale) parts.push(`locale=eq.${encodeURIComponent(f.locale)}`);
  if (f.device) parts.push(`device=eq.${encodeURIComponent(f.device)}`);
  const rows = await serviceRest<Record<string, unknown>[]>(`/learning_events?${parts.join('&')}`);
  if (rows === null) return null;

  const truncated = rows.length > f.limit;
  const page = truncated ? rows.slice(0, f.limit) : rows;

  const salt = f.token && /^[0-9a-f]{64}$/.test(f.token) ? f.token : randomBytes(32).toString('hex');
  const refs = new Map<string, string>();
  const sessionRef = (id: unknown): string => {
    if (typeof id !== 'string' || id === '') return '';
    let ref = refs.get(id);
    if (!ref) {
      ref = createHash('sha256').update(`${salt}:${id}`).digest('hex').slice(0, 16);
      refs.set(id, ref);
    }
    return ref;
  };

  return {
    rows: page.map(({ session_id, ...rest }) => ({ ...rest, session_ref: sessionRef(session_id) })),
    truncated,
    token: salt,
  };
}

/** RFC 4180 CSV. Quotes every field so a value can never break the grid. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const escape = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => escape(r[c])).join(',')).join('\n');
  return rows.length > 0 ? `${header}\n${body}\n` : `${header}\n`;
}

// ── Derived measures (0025) ─────────────────────────────────

const TimeToValueRow = z.object({
  user_id: z.string(),
  first_seen: z.string(),
  activated_at: z.string().nullable(),
  hours_to_value: z.coerce.number().nullable(),
});
export type TimeToValueEntry = z.infer<typeof TimeToValueRow>;

/**
 * How long from first sight to first completed lesson. Rows with a null
 * activated_at are the ones who never got there — that population is the
 * point of the measure, so they are NOT filtered out here.
 */
export async function readTimeToValue(limit: number): Promise<TimeToValueEntry[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/insights_time_to_value?order=first_seen.desc&limit=${limit}&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(TimeToValueRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

const EngagementRow = z.object({
  user_id: z.string(),
  xp_points: z.coerce.number().nullable(),
  lessons_completed: z.coerce.number().nullable(),
  streak_days: z.coerce.number().nullable(),
  longest_streak: z.coerce.number().nullable(),
  sessions_30d: z.coerce.number(),
  active_days_30d: z.coerce.number(),
  engagement_score: z.coerce.number(),
});
export type EngagementEntry = z.infer<typeof EngagementRow>;

export async function readEngagement(limit: number): Promise<EngagementEntry[] | null> {
  const rows = await serviceRest<unknown[]>(
    `/insights_engagement?order=engagement_score.desc&limit=${limit}&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(EngagementRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}
