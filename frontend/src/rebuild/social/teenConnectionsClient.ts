/*
 * Client API layer for Product 10 E.8 (the independent teen's self-managed
 * connections) and the private profile card.
 *
 * Core and the database decide everything: who is a teen, who may ask, who
 * decides (always the teen the request targets, from the session), and what
 * a viewer may see. This file only carries requests and validates the
 * answers, so a malformed response is a failure, never an invented state.
 * Transport-only and dependency-injected; it imports nothing from the legacy
 * app (Bible 02 rule 23).
 */

export interface Transport { baseUrl: string; token: string; fetchImpl?: typeof fetch }
export type Result<T> = { ok: true; value: T } | { ok: false; code: string };

export interface TeenRequest { requestId: string; requestedAt: string; username: string | null; displayName: string | null }
/** A follower, addressed by user id: an account without a @username is still listed and actionable (GAP-FIX-R8 social). */
export interface Follower { userId: string; username: string | null; displayName: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z0-9_]{3,20}$/;

async function call(transport: Transport, path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<{ status: number; envelope: Record<string, unknown> } | null> {
  const fetchImpl = transport.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${transport.baseUrl}/api/v1${path}`, {
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

/** The teen's own pending requests (Core binds the subject to the session). */
export async function getTeenRequests(transport: Transport, offset = 0): Promise<Result<{ requests: TeenRequest[]; nextOffset: number | null }>> {
  const answer = await call(transport, `/profile/connection-requests?offset=${offset}`, 'GET');
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status !== 200 || !isRecord(data) || !Array.isArray(data.requests)) return { ok: false, code: errorCode(answer.envelope) };
  const next = data.nextOffset;
  if (next !== null && !(typeof next === 'number' && Number.isInteger(next) && next > offset)) return { ok: false, code: 'UNAVAILABLE' };
  const requests: TeenRequest[] = [];
  for (const item of data.requests) {
    if (!isRecord(item) || typeof item.requestId !== 'string' || !UUID.test(item.requestId) || !isDate(item.requestedAt)) return { ok: false, code: 'UNAVAILABLE' };
    const requester = item.requester;
    if (requester !== null && !(isRecord(requester) && (requester.username === null || typeof requester.username === 'string') && typeof requester.displayName === 'string')) {
      return { ok: false, code: 'UNAVAILABLE' };
    }
    requests.push({
      requestId: item.requestId,
      requestedAt: item.requestedAt,
      username: isRecord(requester) ? (requester.username as string | null) : null,
      displayName: isRecord(requester) ? (requester.displayName as string) : null,
    });
  }
  return { ok: true, value: { requests, nextOffset: next as number | null } };
}

/** Accept or decline. Only a receipt naming the same request and outcome confirms it. */
export async function decideTeenRequest(transport: Transport, requestId: string, decision: 'accept' | 'decline'): Promise<Result<'accepted' | 'declined'>> {
  if (!UUID.test(requestId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/connection-requests/${requestId}/decision`, 'POST', { decision });
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  const expected = decision === 'accept' ? 'accepted' : 'declined';
  if (answer.status === 200 && isRecord(data) && data.requestId === requestId && data.status === expected) return { ok: true, value: expected };
  return { ok: false, code: answer.status === 200 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

/**
 * E.3 from the teen's own queue (GAP-FIX-R5 social): report the requester of a
 * request addressed to the session. Only a 201 receipt naming the same request confirms it.
 */
export async function reportTeenRequest(transport: Transport, requestId: string, category: string, note: string | null): Promise<Result<'reported'>> {
  if (!UUID.test(requestId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/connection-requests/${requestId}/report`, 'POST', note === null ? { category } : { category, note });
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 201 && isRecord(data) && data.requestId === requestId && data.reported === true) return { ok: true, value: 'reported' };
  return { ok: false, code: answer.status === 201 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

/** Block the requester of a request addressed to the session. Only a receipt naming the same request confirms it. */
export async function blockTeenRequest(transport: Transport, requestId: string): Promise<Result<'blocked'>> {
  if (!UUID.test(requestId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/connection-requests/${requestId}/block`, 'POST', {});
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 200 && isRecord(data) && data.requestId === requestId && data.blocked === true) return { ok: true, value: 'blocked' };
  return { ok: false, code: answer.status === 200 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

/**
 * The session's followers (already filtered by Core to accounts it may see).
 * GAP-FIX-R8 social (E.3, E.8): every row is kept, handle-less ones included,
 * because each is addressed by the user id Core sends; a row without a valid
 * id is a malformed answer, never a silently dropped person.
 */
export async function getFollowers(transport: Transport): Promise<Result<Follower[]>> {
  const answer = await call(transport, '/profile/followers', 'GET');
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status !== 200 || !isRecord(data) || !Array.isArray(data.users)) return { ok: false, code: errorCode(answer.envelope) };
  const followers: Follower[] = [];
  for (const user of data.users) {
    if (!isRecord(user) || typeof user.displayName !== 'string' || typeof user.userId !== 'string' || !UUID.test(user.userId)) return { ok: false, code: 'UNAVAILABLE' };
    if (!(user.username === null || user.username === undefined || typeof user.username === 'string')) return { ok: false, code: 'UNAVAILABLE' };
    const username = typeof user.username === 'string' && USERNAME.test(user.username) ? user.username : null;
    followers.push({ userId: user.userId, username, displayName: user.displayName });
  }
  return { ok: true, value: followers };
}

/** Remove a follower by user id. Only a receipt naming the same account confirms it. */
export async function removeFollower(transport: Transport, userId: string): Promise<Result<'removed'>> {
  if (!UUID.test(userId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/followers/id/${userId}`, 'DELETE');
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 200 && isRecord(data) && data.userId === userId && data.removed === true) return { ok: true, value: 'removed' };
  return { ok: false, code: answer.status === 200 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

/** E.3 on a list entry (GAP-FIX-R8 social): report one of the session's own connections by user id. 201 with the same id confirms it. */
export async function reportConnection(transport: Transport, userId: string, category: string, note: string | null): Promise<Result<'reported'>> {
  if (!UUID.test(userId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/connections/${userId}/report`, 'POST', note === null ? { category } : { category, note });
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 201 && isRecord(data) && data.userId === userId && data.reported === true) return { ok: true, value: 'reported' };
  return { ok: false, code: answer.status === 201 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

/** Block one of the session's own connections by user id. Only a receipt naming the same account confirms it. */
export async function blockConnection(transport: Transport, userId: string): Promise<Result<'blocked'>> {
  if (!UUID.test(userId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/connections/${userId}/block`, 'POST', {});
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 200 && isRecord(data) && data.userId === userId && data.blocked === true) return { ok: true, value: 'blocked' };
  return { ok: false, code: answer.status === 200 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

/** Stop following one of the session's own connections by user id. Only a receipt naming the same account confirms it. */
export async function unfollowConnection(transport: Transport, userId: string): Promise<Result<'unfollowed'>> {
  if (!UUID.test(userId)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profile/following/id/${userId}`, 'DELETE');
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 200 && isRecord(data) && data.userId === userId && data.following === false) return { ok: true, value: 'unfollowed' };
  return { ok: false, code: answer.status === 200 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}

export type RequestReceipt = { requestId: string; decidedBy: 'guardian' | 'subject' };

/** Ask to connect. A 202 pending receipt with no follow is the only success. */
export async function askToConnect(transport: Transport, username: string): Promise<Result<RequestReceipt>> {
  if (!USERNAME.test(username)) return { ok: false, code: 'VALIDATION_ERROR' };
  const answer = await call(transport, `/profiles/${username}/connection-request`, 'POST', {});
  if (!answer) return { ok: false, code: 'UNAVAILABLE' };
  const data = answer.envelope.data;
  if (answer.status === 202 && isRecord(data) && typeof data.requestId === 'string' && UUID.test(data.requestId)
    && data.status === 'pending' && data.following === false && (data.decidedBy === 'guardian' || data.decidedBy === 'subject')) {
    return { ok: true, value: { requestId: data.requestId, decidedBy: data.decidedBy } };
  }
  return { ok: false, code: answer.status === 202 ? 'UNAVAILABLE' : errorCode(answer.envelope) };
}
