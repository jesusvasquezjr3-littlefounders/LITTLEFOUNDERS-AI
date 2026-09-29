import { describe, expect, it, vi } from 'vitest';
import { askToConnect, blockTeenRequest, decideTeenRequest, getFollowers, getTeenRequests, removeFollower, reportTeenRequest } from './teenConnectionsClient';

/* E.8 client layer: only a validated answer is ever a success. */

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function transport(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  return { t: { baseUrl: 'http://core', token: 'tok', fetchImpl: fetchImpl as unknown as typeof fetch }, fetchImpl };
}

describe('teen connections client', () => {
  it('reads the queue and rejects malformed rows', async () => {
    const good = transport(200, { data: { requests: [{ requestId: ID, requestedAt: '2026-09-24T10:00:00Z', requester: { username: 'omar', displayName: 'Omar', avatarOptions: {} } }], nextOffset: null }, error: null });
    expect(await getTeenRequests(good.t)).toEqual({ ok: true, value: { requests: [{ requestId: ID, requestedAt: '2026-09-24T10:00:00Z', username: 'omar', displayName: 'Omar' }], nextOffset: null } });
    expect(good.fetchImpl.mock.calls[0]![0]).toBe('http://core/api/v1/profile/connection-requests?offset=0');
    for (const bad of [
      { requests: [{ requestId: 'nope', requestedAt: '2026-09-24T10:00:00Z', requester: null }], nextOffset: null },
      { requests: [{ requestId: ID, requestedAt: 'yesterday', requester: null }], nextOffset: null },
      { requests: [], nextOffset: -1 },
      { requests: 'x', nextOffset: null },
    ]) {
      expect((await getTeenRequests(transport(200, { data: bad, error: null }).t)).ok).toBe(false);
    }
    expect(await getTeenRequests(transport(502, { data: null, error: { code: 'DATA_UNAVAILABLE' } }).t)).toEqual({ ok: false, code: 'DATA_UNAVAILABLE' });
  });

  it('confirms a decision only with a matching receipt', async () => {
    expect(await decideTeenRequest(transport(200, { data: { requestId: ID, status: 'accepted' } }).t, ID, 'accept')).toEqual({ ok: true, value: 'accepted' });
    expect((await decideTeenRequest(transport(200, { data: { requestId: ID, status: 'accepted' } }).t, ID, 'decline')).ok).toBe(false);
    expect((await decideTeenRequest(transport(200, { data: { requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'declined' } }).t, ID, 'decline')).ok).toBe(false);
    expect(await decideTeenRequest(transport(409, { data: null, error: { code: 'SOCIAL_DECISION_CONFLICT' } }).t, ID, 'accept')).toEqual({ ok: false, code: 'SOCIAL_DECISION_CONFLICT' });
    const never = transport(200, {});
    expect(await decideTeenRequest(never.t, '../other', 'accept')).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(never.fetchImpl).not.toHaveBeenCalled();
  });

  it('lists followers that can be addressed and removes one by handle', async () => {
    expect(await getFollowers(transport(200, { data: { users: [{ displayName: 'Omar', username: 'omar' }, { displayName: 'No handle', username: null }] } }).t))
      .toEqual({ ok: true, value: [{ username: 'omar', displayName: 'Omar' }] });
    const removal = transport(200, { data: { removed: true } });
    expect(await removeFollower(removal.t, 'omar')).toEqual({ ok: true, value: 'removed' });
    expect(removal.fetchImpl.mock.calls[0]![0]).toBe('http://core/api/v1/profile/followers/omar');
    expect((await removeFollower(transport(200, {}).t, 'Bad Name')).ok).toBe(false);
  });

  it('asks to connect and accepts only a pending receipt with no follow', async () => {
    expect(await askToConnect(transport(202, { data: { requestId: ID, status: 'pending', following: false, decidedBy: 'subject' } }).t, 'rio'))
      .toEqual({ ok: true, value: { requestId: ID, decidedBy: 'subject' } });
    expect((await askToConnect(transport(202, { data: { requestId: ID, status: 'pending', following: true, decidedBy: 'subject' } }).t, 'rio')).ok).toBe(false);
    expect(await askToConnect(transport(409, { data: null, error: { code: 'SOCIAL_REQUEST_COOLDOWN' } }).t, 'rio')).toEqual({ ok: false, code: 'SOCIAL_REQUEST_COOLDOWN' });
    expect(await askToConnect({ baseUrl: 'http://core', token: 't', fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch }, 'rio')).toEqual({ ok: false, code: 'UNAVAILABLE' });
  });

  // E.3 from the teen's queue (GAP-FIX-R5 social): by request id, confirmed only by a matching receipt.
  it('reports and blocks a requester by request id, confirmed only by a matching receipt', async () => {
    const report = transport(201, { data: { requestId: ID, reported: true, reportId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } });
    expect(await reportTeenRequest(report.t, ID, 'unwanted_contact', null)).toEqual({ ok: true, value: 'reported' });
    expect(report.fetchImpl.mock.calls[0]![0]).toBe(`http://core/api/v1/profile/connection-requests/${ID}/report`);
    expect(JSON.parse(String(report.fetchImpl.mock.calls[0]![1]!.body))).toEqual({ category: 'unwanted_contact' });
    const withNote = transport(201, { data: { requestId: ID, reported: true } });
    await reportTeenRequest(withNote.t, ID, 'other', 'Kept asking');
    expect(JSON.parse(String(withNote.fetchImpl.mock.calls[0]![1]!.body))).toEqual({ category: 'other', note: 'Kept asking' });
    expect((await reportTeenRequest(transport(201, { data: { requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reported: true } }).t, ID, 'other', null)).ok).toBe(false);
    expect((await reportTeenRequest(transport(200, { data: { requestId: ID, reported: true } }).t, ID, 'other', null)).ok).toBe(false);
    expect(await reportTeenRequest(transport(404, { data: null, error: { code: 'NOT_FOUND' } }).t, ID, 'other', null)).toEqual({ ok: false, code: 'NOT_FOUND' });
    const block = transport(200, { data: { requestId: ID, blocked: true } });
    expect(await blockTeenRequest(block.t, ID)).toEqual({ ok: true, value: 'blocked' });
    expect(block.fetchImpl.mock.calls[0]![0]).toBe(`http://core/api/v1/profile/connection-requests/${ID}/block`);
    expect((await blockTeenRequest(transport(200, { data: { requestId: ID, blocked: false } }).t, ID)).ok).toBe(false);
    expect(await blockTeenRequest(transport(502, { data: null, error: { code: 'INTERNAL' } }).t, ID)).toEqual({ ok: false, code: 'INTERNAL' });
    const never = transport(200, {});
    expect(await reportTeenRequest(never.t, '../other', 'other', null)).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(await blockTeenRequest(never.t, 'omar')).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(never.fetchImpl).not.toHaveBeenCalled();
  });
});
