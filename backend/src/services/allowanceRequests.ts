import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';
import { isRefusal, rpc, UNAVAILABLE, type Refusal } from './familyLifecycle.js';

/*
 * A child in a family asks for a bigger allowance (allowance_requests, 0261):
 * the amount they would like and why, in a closed set of reasons and a short
 * note. A verified Tutor answers yes (the allowance becomes the asked amount)
 * or "not yet" with a reason code and a reason that says what the child can do
 * next (D.18). Every write is a database function that re-checks the family
 * link, the allowance and the one-open-request rule, and audits; Core only
 * shapes the wire. Practice coins only: nothing here moves a coin.
 */

export { isRefusal, UNAVAILABLE };
export type { Refusal };

const UUID = z.string().uuid();
const eu = (value: string) => encodeURIComponent(UUID.parse(value));

export const REQUEST_REASONS = ['saving_goal', 'more_needs', 'worked_more', 'other'] as const;
export const REQUEST_DENIAL_CODES = ['later_date', 'not_suitable', 'talk_first'] as const;

const RequestRows = z.array(z.object({
  id: z.string().uuid(),
  kid_user_id: z.string().uuid(),
  from_amount: z.number().int(),
  amount: z.number().int(),
  reason_kind: z.enum(REQUEST_REASONS),
  note: z.string().nullable(),
  status: z.enum(['requested', 'approved', 'denied', 'withdrawn']),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  decision_code: z.enum(REQUEST_DENIAL_CODES).nullable(),
  decision_reason: z.string().nullable(),
  revisit_on: z.string().nullable(),
}).strict());
export type AllowanceRequestRow = z.infer<typeof RequestRows>[number];

const FIELDS = 'id,kid_user_id,from_amount,amount,reason_kind,note,status,created_at,decided_at,decision_code,decision_reason,revisit_on';

/** The newest requests of one child, newest first; null = unreadable (never shown as "none"). */
export async function listAllowanceRequests(kidId: string, limit = 3): Promise<AllowanceRequestRow[] | null> {
  const rows = RequestRows.safeParse(await serviceRest<unknown>(
    `/allowance_requests?kid_user_id=eq.${eu(kidId)}&select=${FIELDS}&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 20))}`,
  ));
  return rows.success ? rows.data : null;
}

export async function getAllowanceRequest(requestId: string): Promise<AllowanceRequestRow | null | undefined> {
  const rows = RequestRows.safeParse(await serviceRest<unknown>(`/allowance_requests?id=eq.${eu(requestId)}&select=${FIELDS}&limit=1`));
  if (!rows.success) return undefined;
  return rows.data[0] ?? null;
}

export function createAllowanceRequest(kidId: string, input: { amount: number; reasonKind: (typeof REQUEST_REASONS)[number]; note: string | null }) {
  return rpc('allowance_request_create', {
    p_kid: UUID.parse(kidId), p_amount: input.amount, p_reason_kind: input.reasonKind, p_note: input.note,
  }, UUID);
}

export function withdrawAllowanceRequest(kidId: string, requestId: string) {
  return rpc('allowance_request_withdraw', { p_request: UUID.parse(requestId), p_kid: UUID.parse(kidId) }, z.literal(true));
}

export function decideAllowanceRequest(input: { requestId: string; actorId: string; approve: boolean; reasonCode: string | null; reason: string | null; revisitOn: string | null }) {
  return rpc('allowance_request_decide', {
    p_request: UUID.parse(input.requestId), p_actor: UUID.parse(input.actorId), p_approve: input.approve,
    p_code: input.reasonCode, p_reason: input.reason, p_revisit: input.revisitOn,
  }, z.enum(['approved', 'denied']));
}
