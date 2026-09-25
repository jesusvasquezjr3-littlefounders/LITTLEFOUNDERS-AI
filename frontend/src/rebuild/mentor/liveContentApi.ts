/*
 * The client API layer for C.5 (the governed live-generation tier) and C.6
 * (the curated activity-pack release gate), used by the staff console.
 *
 * Every call goes to Core, the only service the frontend talks to, under the
 * staff member's own session; Core enforces the `manage_content` grant on
 * each route before any data is read (the UI never substitutes for that).
 * Hand-mirrored from Core's `routes/admin.ts`,
 * `services/pedagogy/liveContentGovernance.ts` and `services/tutorPacks.ts`
 * (this repo shares no types across packages).
 *
 * The rebuilt UI imports nothing from the legacy frontend (Bible 02 rule 23),
 * so this layer carries its own envelope-aware call: every response is
 * `{ data, error }`, and anything else is an error, never a guessed success.
 */
const BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; failures?: string[] } };

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
      const e = error as { code: string; message?: unknown; failures?: unknown };
      return {
        data: null,
        error: {
          code: e.code,
          message: typeof e.message === 'string' ? e.message : '',
          ...(Array.isArray(e.failures) ? { failures: e.failures.filter((f): f is string => typeof f === 'string') } : {}),
        },
      };
    }
  }
  return { data: null, error: { code: 'INTERNAL', message: 'Malformed response' } };
}

export const RISK_CATEGORIES = ['standard', 'sensitive'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export const SUSPENSION_REASONS = ['uncalibrated', 'calibration_stale', 'concordance_below_floor', 'review_rate_below_floor'] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];
export type CalibrationState = 'passed' | 'uncalibrated' | 'stale';

/** Mirrors `GET /admin/tutor/live-content/status`. */
export interface LiveContentStatus {
  calibration: { state: CalibrationState; ageDays: number | null; judgeModel: string | null; recordedAt: string | null; maxAgeDays: number };
  categories: {
    category: RiskCategory;
    suspended: boolean;
    reasons: SuspensionReason[];
    rate: number;
    baseline: number;
    floor: number;
    elevated: boolean;
    decisionsToRestore: number;
    pending: number;
    overdue: number;
  }[];
  reviewSlaDays: number;
}

export const REVIEW_DECISIONS = ['approve', 'quality', 'safety'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** The staff verdict body: an approval, or a rejection with its issue class. */
export function reviewBody(decision: ReviewDecision): { status: 'approved' } | { status: 'rejected'; issue: 'quality' | 'safety' } {
  return decision === 'approve' ? { status: 'approved' } : { status: 'rejected', issue: decision };
}

export async function getLiveContentStatus(token: string): Promise<ApiResult<LiveContentStatus>> {
  return api<LiveContentStatus>('/admin/tutor/live-content/status', { token });
}

export async function decideLiveItem(token: string, segmentId: string, decision: ReviewDecision): Promise<ApiResult<{ id: string; status: string; issue: string | null }>> {
  return api(`/admin/tutor/review-queue/${encodeURIComponent(segmentId)}/status`, { token, body: reviewBody(decision) });
}

export type PackStatus = 'review' | 'published' | 'archived';

/** Mirrors one row of `GET /admin/tutor/packs` (the answer keys ride along for staff). */
export interface TutorPackSummary {
  id: string;
  skill_key: string;
  kc_key: string | null;
  tier: 1 | 2 | 3;
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  status: PackStatus;
  pack_version: number;
  risk_category: RiskCategory;
  source: string;
  demand_pattern: string | null;
  pack: { segments: { id: string; type: string; prompt_md?: string }[] };
}

export async function listPacks(token: string, status: PackStatus): Promise<ApiResult<{ packs: TutorPackSummary[]; total: number }>> {
  return api(`/admin/tutor/packs?status=${status}`, { token });
}

export async function setPackStatus(token: string, packId: string, status: PackStatus): Promise<ApiResult<{ id: string; status: PackStatus }>> {
  return api(`/admin/tutor/packs/${encodeURIComponent(packId)}/status`, { token, body: { status } });
}
