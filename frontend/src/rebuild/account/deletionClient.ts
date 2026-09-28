/*
 * Client API layer for Product 10 E.6 self-service account deletion.
 *
 * Core decides everything: who may delete themselves (a parent-created child
 * never, staff never through this flow), the waiting period, the re-entry of
 * the password or a recent sign-in, and the erasure itself. This file only
 * carries requests and validates the answers, so a malformed response is a
 * failure, never an invented state. Transport-only and dependency-injected;
 * it imports nothing from the legacy app (Bible 02 rule 23).
 */

export type DeletionStatus = 'pending' | 'processing' | 'held';
export type DeletionReauth = 'password' | 'recent_sign_in' | 'none';

export interface OpenDeletion {
  status: DeletionStatus;
  requestedAt: string;
  scheduledFor: string;
}

export type DeletionEligibility =
  | { allowed: false; reason: 'kid' | 'staff' }
  | {
      allowed: true;
      population: string;
      graceDays: number;
      immediate: boolean;
      reauth: DeletionReauth;
      children: { lastTutorOf: number; sharedTutorOf: number };
      /** D-14 (b): the verified Tutors a linked teen's deletion tells (0 when absent). */
      tutorsTold: number;
    };

export interface DeletionState {
  deletion: OpenDeletion | null;
  eligibility: DeletionEligibility;
}

/** What a confirmed request produced. 'finishing': the account is gone, stored copies are still being cleared. */
export type DeletionOutcome =
  | { status: 'pending'; scheduledFor: string; signedOut: boolean }
  | { status: 'completed' | 'finishing' | 'processing' | 'held'; scheduledFor: string };

export type Result<T> = { ok: true; value: T } | { ok: false; code: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

function parseOpen(value: unknown): OpenDeletion | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (!['pending', 'processing', 'held'].includes(String(value.status)) || !isDate(value.requestedAt) || !isDate(value.scheduledFor)) return undefined;
  return { status: value.status as DeletionStatus, requestedAt: value.requestedAt, scheduledFor: value.scheduledFor };
}

function parseEligibility(value: unknown): DeletionEligibility | undefined {
  if (!isRecord(value)) return undefined;
  if (value.allowed === false) {
    return value.reason === 'kid' || value.reason === 'staff' ? { allowed: false, reason: value.reason } : undefined;
  }
  const children = value.children;
  if (value.allowed !== true || typeof value.population !== 'string' || !isCount(value.graceDays) || typeof value.immediate !== 'boolean'
    || !['password', 'recent_sign_in', 'none'].includes(String(value.reauth)) || !isRecord(children)
    || !isCount(children.lastTutorOf) || !isCount(children.sharedTutorOf)) return undefined;
  return {
    allowed: true,
    population: value.population,
    graceDays: value.graceDays,
    immediate: value.immediate,
    reauth: value.reauth as DeletionReauth,
    children: { lastTutorOf: children.lastTutorOf, sharedTutorOf: children.sharedTutorOf },
    tutorsTold: isCount(value.tutorsTold) ? value.tutorsTold : 0,
  };
}

interface Transport {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

async function call(transport: Transport, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<{ status: number; envelope: Record<string, unknown> } | null> {
  const fetchImpl = transport.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${transport.baseUrl}/api/v1/account/deletion`, {
      method,
      headers: { Authorization: `Bearer ${transport.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope: unknown = await response.json().catch(() => null);
    return isRecord(envelope) ? { status: response.status, envelope } : null;
  } catch {
    return null;
  }
}

function errorCode(envelope: Record<string, unknown>): string {
  return isRecord(envelope.error) && typeof envelope.error.code === 'string' ? envelope.error.code : 'UNAVAILABLE';
}

export async function getDeletionState(transport: Transport): Promise<Result<DeletionState>> {
  const answer = await call(transport, 'GET');
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  if (answer.status !== 200 || !isRecord(answer.envelope.data)) return { ok: false, code: errorCode(answer.envelope) };
  const deletion = parseOpen(answer.envelope.data.deletion);
  const eligibility = parseEligibility(answer.envelope.data.eligibility);
  if (deletion === undefined || !eligibility) return { ok: false, code: 'UNAVAILABLE' };
  return { ok: true, value: { deletion, eligibility } };
}

export async function requestAccountDeletion(transport: Transport & { currentPassword?: string }): Promise<Result<DeletionOutcome>> {
  const body = transport.currentPassword ? { acknowledge: true, currentPassword: transport.currentPassword } : { acknowledge: true };
  const answer = await call(transport, 'POST', body);
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if ((answer.status !== 200 && answer.status !== 202) || !isRecord(data) || !isDate(data.scheduledFor)) {
    return { ok: false, code: errorCode(answer.envelope) };
  }
  const status = String(data.status);
  if (!['pending', 'completed', 'finishing', 'processing', 'held'].includes(status)) return { ok: false, code: 'UNAVAILABLE' };
  if (status === 'pending') return { ok: true, value: { status, scheduledFor: data.scheduledFor, signedOut: data.signedOut === true } };
  return { ok: true, value: { status, scheduledFor: data.scheduledFor } as DeletionOutcome };
}

export async function cancelAccountDeletion(transport: Transport): Promise<Result<'cancelled'>> {
  const answer = await call(transport, 'DELETE');
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  if (answer.status === 200 && isRecord(answer.envelope.data) && answer.envelope.data.status === 'cancelled') return { ok: true, value: 'cancelled' };
  return { ok: false, code: errorCode(answer.envelope) };
}

/** The stated date, in the reader's locale (Appendix J: every request carries its timeline). */
export function formatDeletionDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
