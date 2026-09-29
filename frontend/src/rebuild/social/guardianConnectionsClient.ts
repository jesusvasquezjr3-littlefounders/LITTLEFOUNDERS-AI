import type { ReportCategory } from './ReportDialog';

/*
 * E.1/E.3/E.13 (GAP-FIX-R3 social): the Tutor's two writes on a child's
 * connection. Core is the boundary (verified guardian, current connection,
 * guardian-tier child); these only send and read the receipt. Success is
 * claimed on Core's exact receipt, never on a missing error. Transport is
 * injected (the route passes the app's `api`), so nothing here imports the
 * legacy app (Bible 02 rule 23).
 */

export type Envelope<T> = { data: T | null; error: { code: string } | null };
export type Send = <T>(path: string, options: { token: string; method: 'DELETE' | 'POST'; body?: { category: ReportCategory; note?: string } }) => Promise<Envelope<T>>;
export type EndOutcome = 'ended' | 'gone' | 'failed';

const connectionPath = (kidUserId: string, userId: string) =>
  `/family/kids/${encodeURIComponent(kidUserId)}/social/connections/${encodeURIComponent(userId)}`;

export async function guardianEndConnection(send: Send, kidUserId: string, userId: string, token: string): Promise<EndOutcome> {
  const result = await send<{ ended?: unknown; removed?: unknown }>(connectionPath(kidUserId, userId), { token, method: 'DELETE' });
  if (result.error) return result.error.code === 'NOT_FOUND' ? 'gone' : 'failed';
  const removed = result.data?.removed;
  return result.data?.ended === true && typeof removed === 'number' && Number.isInteger(removed) && removed >= 1 && removed <= 2 ? 'ended' : 'failed';
}

export async function guardianReportConnection(send: Send, kidUserId: string, userId: string, category: ReportCategory, note: string | null, token: string): Promise<boolean> {
  const result = await send<{ reported?: unknown }>(`${connectionPath(kidUserId, userId)}/report`,
    { token, method: 'POST', body: note === null ? { category } : { category, note } });
  return result.data?.reported === true;
}
