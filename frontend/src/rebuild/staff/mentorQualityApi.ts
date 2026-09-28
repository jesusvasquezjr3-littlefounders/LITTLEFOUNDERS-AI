/*
 * The client API layer for C.24, the Mentor-quality dashboard (with C.21's
 * anomaly flags), used by the rebuilt staff console.
 *
 * Every call goes to Core, the only service the frontend talks to, under the
 * staff member's own session. Core enforces `view_analytics` on every route
 * before any data is read, and the named-owner rule on every flag action and
 * review (the UI only hides actions a reader cannot take; it never
 * substitutes for that). Hand-mirrored from Core's `routes/admin.ts` and
 * `services/pedagogy/mentorQuality*.ts` (this repo shares no types across
 * packages); `npm run evaluation-loop:check` keeps the vocabularies below
 * identical to Core's and the migration's.
 *
 * The rebuilt UI imports nothing from the legacy frontend (Bible 02 rule 23),
 * so this layer carries its own envelope-aware call: every response is
 * `{ data, error }`, and anything else is an error, never a guessed success.
 */
const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

export type ApiResult<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } };

async function api<T>(path: string, options: { token: string; body?: unknown }): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${options.token}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method: options.body !== undefined ? 'POST' : 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    return { data: null, error: { code: 'INTERNAL', message: 'Network error' } };
  }
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === 'object' && 'data' in body && 'error' in body) {
    const { data, error } = body as { data: unknown; error: unknown };
    if (error === null && res.ok && data !== null && data !== undefined) return { data: data as T, error: null };
    if (data === null && error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      const e = error as { code: string; message?: unknown };
      return { data: null, error: { code: e.code, message: typeof e.message === 'string' ? e.message : '' } };
    }
  }
  return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
}

export const OWNER_ROLES = ['pedagogical_lead', 'safety_trust_lead', 'engineering_lead'] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export const SIGNAL_CATEGORIES = ['pedagogy', 'relational', 'safety_governance', 'pipeline', 'learning_outcome', 'engagement_health'] as const;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export const SIGNAL_STATUSES = ['ok', 'breach', 'insufficient_data', 'diagnostic', 'unavailable', 'not_instrumented', 'external'] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const FLAG_KINDS = [
  'threshold_breach',
  'zero_tolerance',
  'upward_drift',
  'relative_drop',
  'persona_disparity',
  'subgroup_disparity',
  'source_unavailable',
] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

export const FLAG_SEVERITIES = ['review', 'urgent'] as const;
export const FLAG_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

/** Core's resolution note bounds (the root cause in words, never a bare click). */
export const RESOLUTION_NOTE_MIN = 10;
export const RESOLUTION_NOTE_MAX = 2000;

export interface SignalReading {
  id: string;
  status: SignalStatus;
  value: number | null;
  sample: number;
  breakdown: { key: string; value: number | null; sample: number; status: SignalStatus }[];
}

export interface DashboardSignal {
  id: string;
  category: SignalCategory;
  requirement: string;
  ownerRole: OwnerRole;
  threshold: { kind: string; value: number | null; upper?: number };
  instrumented: 'yes' | 'not_instrumented' | 'external';
  pending: string | null;
  /** Null when no snapshot carries this signal yet. */
  reading: SignalReading | null;
  stale: boolean;
}

export interface DashboardFlag {
  id: string;
  signalId: string;
  kind: FlagKind;
  requirement: string;
  ownerRole: OwnerRole;
  severity: 'review' | 'urgent';
  scope: string;
  value: number | null;
  threshold: number | null;
  status: FlagStatus;
  openedAt: string;
  lastSeenAt: string;
  seenCount: number;
  resolutionNote: string | null;
}

/** Mirrors `GET /admin/mentor-quality`. */
export interface MentorQualityDashboardData {
  generatedAt: string;
  snapshot: { computedAt: string; windowDays: number; rubricHash: string } | null;
  freshness: { ageHours: number | null; stale: boolean; slaHours: number };
  lastRun: { startedAt: string; status: 'ok' | 'partial' | 'failed'; scored: number; failed: number; backlogBefore: number | null; trigger: string } | null;
  signals: DashboardSignal[];
  flags: { active: DashboardFlag[]; recentlyResolved: DashboardFlag[] };
  owners: { role: OwnerRole; userId: string; displayName: string | null; assignedAt: string }[];
  viewerOwnerRoles: OwnerRole[];
  reviews: {
    week: string;
    previousWeek: string;
    named: number;
    reviewedThisWeek: number;
    reviewedPreviousWeek: number;
    previousRate: number | null;
    missingRoles: OwnerRole[];
    thisWeek: { role: OwnerRole; reviewerId: string | null; reviewedAt: string; openFlags: number }[];
  };
}

export async function getMentorQualityDashboard(token: string): Promise<ApiResult<MentorQualityDashboardData>> {
  return api('/admin/mentor-quality', { token });
}

export async function acknowledgeFlag(token: string, flagId: string): Promise<ApiResult<{ id: string; status: string }>> {
  return api(`/admin/mentor-quality/flags/${encodeURIComponent(flagId)}/acknowledge`, { token, body: {} });
}

export async function resolveFlag(token: string, flagId: string, note: string): Promise<ApiResult<{ id: string; status: string }>> {
  return api(`/admin/mentor-quality/flags/${encodeURIComponent(flagId)}/resolve`, { token, body: { note: note.trim() } });
}

export async function signWeeklyReview(token: string, role: OwnerRole, note?: string): Promise<ApiResult<{ role: OwnerRole; week: string }>> {
  return api('/admin/mentor-quality/reviews', { token, body: note && note.trim() ? { role, note: note.trim() } : { role } });
}

/** Signals whose value is a count or a score, not a share (so never shown as a percentage). */
export const COUNT_SIGNALS: readonly string[] = ['kill_switch.open', 'dialogue.ab_outcome', 'learning.time_to_mastery', 'engagement.mentor_resolution'];
export const SCORE_SIGNALS: readonly string[] = ['alliance.bond_proxy'];
