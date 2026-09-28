import { z } from 'zod';
import { serviceRest, serviceRestRaw } from './supabaseRest.js';
import { AgeBand, birthMonthForBand } from './ageScreen.js';

/*
 * E.4 (as amended by OD-3), Appendix J 1.1: the staff-reviewed age correction
 * for a self-registered account. The age a self-registered account declared is
 * locked; with no guardian to re-confirm, a later change is a request that a
 * staff member with manage_users decides.
 *
 * The database is the boundary (migration age_correction_requests):
 * request_age_correction refuses every population that may not ask (a
 * parent-created child, an under-13 origin, a guest, an unscreened account),
 * keeps one pending request per account and keeps only what the declaration
 * itself may keep (the band, and a 13-17 birth month); decide_age_correction
 * re-checks the staff grant, refuses the requester deciding their own request,
 * applies an approval through record_age_declaration / promote_age_declaration
 * and writes the audit row in the same transaction. Core's checks before each
 * call only give a clear answer.
 */

export const APPROVE_REASONS = ['evidence_verified', 'entry_error'] as const;
export const REJECT_REASONS = ['evidence_missing', 'not_credible'] as const;
export const CorrectionReason = z.enum([...APPROVE_REASONS, ...REJECT_REASONS]);
export type CorrectionReason = z.infer<typeof CorrectionReason>;
export const CorrectionStatus = z.enum(['pending', 'approved', 'rejected']);
export type CorrectionStatus = z.infer<typeof CorrectionStatus>;

const Row = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  from_age_band: AgeBand,
  requested_age_band: AgeBand,
  requested_birth_month: z.string().nullable(),
  status: CorrectionStatus,
  decided_by: z.string().uuid().nullable(),
  reason_code: CorrectionReason.nullable(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
}).strip();
type Row = z.infer<typeof Row>;
const SELECT = 'id,user_id,from_age_band,requested_age_band,requested_birth_month,status,decided_by,reason_code,created_at,decided_at';

/** What the account itself sees of its latest request. */
export interface OwnCorrection {
  id: string;
  status: CorrectionStatus;
  requestedBand: AgeBand;
  reason: CorrectionReason | null;
  createdAt: string;
  decidedAt: string | null;
}

/** What a manage_users staff member sees in the queue: no name, no date beyond a teen's month. */
export interface StaffCorrection extends OwnCorrection {
  userId: string;
  fromBand: AgeBand;
  requestedBirthMonth: string | null;
  decidedBy: string | null;
}

const own = (row: Row): OwnCorrection => ({
  id: row.id, status: row.status, requestedBand: row.requested_age_band, reason: row.reason_code, createdAt: row.created_at, decidedAt: row.decided_at,
});
const staffView = (row: Row): StaffCorrection => ({
  ...own(row), userId: row.user_id, fromBand: row.from_age_band,
  requestedBirthMonth: row.requested_birth_month ? row.requested_birth_month.slice(0, 7) : null, decidedBy: row.decided_by,
});

/** The account's latest request, null when it never asked, 'unavailable' when the store did not answer. */
export async function readOwnCorrection(userId: string): Promise<OwnCorrection | null | 'unavailable'> {
  if (!z.string().uuid().safeParse(userId).success) return 'unavailable';
  const rows = await serviceRest<unknown>(`/age_correction_requests?user_id=eq.${encodeURIComponent(userId)}&select=${SELECT}&order=created_at.desc&limit=1`);
  const parsed = z.array(Row).max(1).safeParse(rows);
  if (!parsed.success) return 'unavailable';
  return parsed.data[0] ? own(parsed.data[0]) : null;
}

const REQUEST_REFUSALS: Record<string, readonly [number, string]> = {
  KID_AGE_BY_TUTOR: [403, 'KID_AGE_BY_TUTOR'],
  NOT_ELIGIBLE: [403, 'NOT_ELIGIBLE'],
  AGE_PROTECTED: [409, 'AGE_PROTECTED'],
  AGE_SCREEN_REQUIRED: [409, 'AGE_SCREEN_REQUIRED'],
  AGE_UNCHANGED: [409, 'AGE_UNCHANGED'],
  CORRECTION_PENDING: [409, 'CORRECTION_PENDING'],
  INVALID_AGE_BAND: [400, 'VALIDATION_ERROR'],
  INVALID_BIRTH_MONTH: [400, 'VALIDATION_ERROR'],
};

const Refusal = z.object({ message: z.string() }).passthrough();
function refusal(body: unknown, table: Record<string, readonly [number, string]>): readonly [number, string] | null {
  const parsed = Refusal.safeParse(body);
  return parsed.success ? table[parsed.data.message] ?? null : null;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; code: string };
const unavailable = { ok: false, status: 502, code: 'DATA_UNAVAILABLE' } as const;

/** Files a request for the band `birthDate` gives (already validated); a 13-17 band keeps its month, nothing else of the date. */
export async function fileCorrection(userId: string, band: AgeBand, birthDate: string): Promise<Outcome<string>> {
  const month = birthMonthForBand(birthDate, band);
  const result = await serviceRestRaw('/rpc/request_age_correction', {
    method: 'POST', body: JSON.stringify({ p_user: userId, p_age_band: band, p_birth_month: month }),
  });
  if (result.ok) {
    const id = z.string().uuid().safeParse(result.body);
    return id.success ? { ok: true, value: id.data } : unavailable;
  }
  const known = refusal(result.body, REQUEST_REFUSALS);
  return known ? { ok: false, status: known[0], code: known[1] } : unavailable;
}

/** The staff queue, newest first; `status` narrows it. */
export async function listCorrections(status: CorrectionStatus | 'all', limit: number): Promise<StaffCorrection[] | null> {
  const filter = status === 'all' ? '' : `&status=eq.${status}`;
  const rows = await serviceRest<unknown>(`/age_correction_requests?select=${SELECT}${filter}&order=created_at.desc&limit=${limit}`);
  const parsed = z.array(Row).safeParse(rows);
  return parsed.success ? parsed.data.map(staffView) : null;
}

const DECISION_REFUSALS: Record<string, readonly [number, string]> = {
  NOT_FOUND: [404, 'NOT_FOUND'],
  SELF_DECISION: [403, 'SELF_DECISION'],
  NOT_STAFF: [403, 'FORBIDDEN'],
  NOT_PENDING: [409, 'NOT_PENDING'],
  INVALID_DECISION: [400, 'VALIDATION_ERROR'],
};

/** A staff decision, applied and audited by the database in one transaction. */
export async function decideCorrection(requestId: string, staffId: string, approve: boolean, reason: CorrectionReason): Promise<Outcome<CorrectionStatus>> {
  const result = await serviceRestRaw('/rpc/decide_age_correction', {
    method: 'POST', body: JSON.stringify({ p_request: requestId, p_staff: staffId, p_approve: approve, p_reason: reason }),
  });
  if (result.ok) {
    const status = CorrectionStatus.safeParse(result.body);
    return status.success && status.data === (approve ? 'approved' : 'rejected') ? { ok: true, value: status.data } : unavailable;
  }
  const known = refusal(result.body, DECISION_REFUSALS);
  return known ? { ok: false, status: known[0], code: known[1] } : unavailable;
}
