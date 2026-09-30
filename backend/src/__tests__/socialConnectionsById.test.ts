import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';

/*
 * GAP-FIX-R8 social (E.3 report on a followers/following-list entry; E.8
 * mutual-consent connections the teen self-manages; Block E Standard
 * component 2; Appendix J 2.1 criterion 2, enforced on every path).
 *
 * A new account has no @username, and every username-keyed safety route
 * (remove, report, block, unfollow) could not address it. The session's own
 * connections are now addressed by user id. Admission is a connection with
 * the session read from the graph (a follow edge either way, or an accepted
 * teen consent either way); any other id, the session's own included, is a
 * 404 with no write called. A handle-less account also can no longer ask a
 * teen to connect (409 USERNAME_REQUIRED), so new edges of this kind do not form.
 */

const TEEN = '11111111-1111-4111-8111-111111111111';
const NO_HANDLE = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const ADULT = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REPORT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let db: FakeDb;
let rpc: { name: string; body: Record<string, unknown>; authorization: string | null }[];
let blocks: { body: Record<string, unknown>; authorization: string | null }[];
let failGraphReads: boolean;
let removeAnswer: { status: number; body: unknown } | null;
const called = (name: string) => rpc.filter(call => call.name === name);
const writes = () => ({
  remove: called('remove_social_follower').length,
  withdraw: called('withdraw_social_connection').length,
  report: called('submit_social_report').length,
  block: blocks.length,
  ask: called('request_teen_connection').length,
});
const NO_WRITES = { remove: 0, withdraw: 0, report: 0, block: 0, ask: 0 };

const profile = (userId: string, username: string | null, displayName: string) => ({
  user_id: userId, username, display_name: displayName, locale: 'en-US', theme: 'system', cover: { preset: 'sunset' }, birth_date: null, created_at: '2026-07-12T00:00:00Z',
});

beforeEach(() => {
  db = {
    profiles: [profile(TEEN, 'rio', 'Rio'), profile(NO_HANDLE, null, 'Pat'), profile(STRANGER, 'omar', 'Omar'), profile(ADULT, 'marta', 'Marta')],
    user_roles: [TEEN, NO_HANDLE, STRANGER, ADULT].map(user_id => ({ user_id, role: 'universal' })),
    social_tiers: [{ user_id: TEEN, tier: 'teen' }, { user_id: NO_HANDLE, tier: 'adult' }, { user_id: STRANGER, tier: 'adult' }, { user_id: ADULT, tier: 'adult' }],
    follows: [],
    blocks: [],
    social_consent_requests: [],
    social_connection_requests: [],
    avatars: [],
  };
  rpc = [];
  blocks = [];
  failGraphReads = false;
  removeAnswer = null;
  const base = createFakeFetch(db);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('Authorization');
    const rpcName = /\/rpc\/([a-z_]+)/.exec(url)?.[1];
    if (rpcName && rpcName !== 'social_tier') rpc.push({ name: rpcName, body: JSON.parse(String(init?.body ?? '{}')), authorization });
    if (rpcName === 'record_social_protection_event') return new Response(null, { status: 204 });
    if (rpcName === 'submit_social_report') return jsonResponse(200, REPORT_ID);
    if (rpcName === 'request_teen_connection') return jsonResponse(200, REQUEST_ID);
    if (rpcName === 'remove_social_follower') {
      if (removeAnswer) return jsonResponse(removeAnswer.status, removeAnswer.body);
      const { p_subject_id: subject, p_follower_id: follower } = JSON.parse(String(init?.body));
      const before = db.follows!.length;
      db.follows = db.follows!.filter(row => !(row.follower_id === follower && row.followed_id === subject));
      return jsonResponse(200, db.follows.length < before);
    }
    if (rpcName === 'withdraw_social_connection') {
      const { p_follower_id: follower, p_followed_id: followed } = JSON.parse(String(init?.body));
      db.follows = db.follows!.filter(row => !(row.follower_id === follower && row.followed_id === followed));
      return jsonResponse(200, true);
    }
    if (failGraphReads && /\/rest\/v1\/(follows|social_consent_requests)\?/.test(url) && (init?.method ?? 'GET') === 'GET') return new Response('{}', { status: 503 });
    if (url.includes('/rest/v1/blocks') && init?.method === 'POST') {
      blocks.push({ body: JSON.parse(String(init.body)), authorization });
      return new Response(null, { status: 201 });
    }
    return base(input, init);
  }));
});

afterEach(() => vi.unstubAllGlobals());

const as = (sub: string) => `Bearer ${mintToken({ sub })}`;
const app = () => request(createApp());
const report = (sub: string, id: string, body: unknown = { category: 'unwanted_contact' }) => app().post(`/api/v1/profile/connections/${id}/report`).set('Authorization', as(sub)).send(body as object);
const block = (sub: string, id: string, body: unknown = {}) => app().post(`/api/v1/profile/connections/${id}/block`).set('Authorization', as(sub)).send(body as object);
const remove = (sub: string, id: string) => app().delete(`/api/v1/profile/followers/id/${id}`).set('Authorization', as(sub));
const unfollow = (sub: string, id: string) => app().delete(`/api/v1/profile/following/id/${id}`).set('Authorization', as(sub));

/** A connection formed before the handle rule: the teen accepted a handle-less adult, who now follows them. */
function legacyAcceptedEdge() {
  db.social_consent_requests!.push({ id: REQUEST_ID, requester_id: NO_HANDLE, subject_id: TEEN, status: 'accepted', requested_at: '2026-09-20T10:00:00Z', decided_at: '2026-09-21T10:00:00Z' });
  db.follows!.push({ follower_id: NO_HANDLE, followed_id: TEEN, created_at: '2026-09-21T10:00:00Z' });
}

describe('a handle-less adult accepted by a teen (adversarial)', () => {
  it('can no longer ask a teen to connect: 409 USERNAME_REQUIRED, and the request transaction is never called', async () => {
    const res = await app().post('/api/v1/profiles/rio/connection-request').set('Authorization', as(NO_HANDLE)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_REQUIRED');
    expect(writes()).toEqual(NO_WRITES);
    // An account with a handle still asks.
    const asked = await app().post('/api/v1/profiles/rio/connection-request').set('Authorization', as(ADULT)).send({});
    expect(asked.status).toBe(202);
    expect(called('request_teen_connection').map(call => call.body)).toEqual([{ p_requester_id: ADULT, p_subject_id: TEEN }]);
  });

  it('is listed among the teen\'s followers with its user id and no handle', async () => {
    legacyAcceptedEdge();
    const res = await app().get('/api/v1/profile/followers').set('Authorization', as(TEEN));
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([expect.objectContaining({ userId: NO_HANDLE, username: null, displayName: 'Pat' })]);
  });

  it('the teen reports it by id, with the session as the reporter', async () => {
    legacyAcceptedEdge();
    const res = await report(TEEN, NO_HANDLE, { category: 'unwanted_contact', note: 'Keeps asking for my number' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ userId: NO_HANDLE, reported: true, reportId: REPORT_ID });
    expect(called('submit_social_report').map(call => call.body)).toEqual([
      { p_reporter_id: TEEN, p_subject_id: NO_HANDLE, p_category: 'unwanted_contact', p_note: 'Keeps asking for my number' },
    ]);
  });

  it('the teen blocks it by id through the session\'s own block write', async () => {
    legacyAcceptedEdge();
    const res = await block(TEEN, NO_HANDLE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: NO_HANDLE, blocked: true });
    expect(blocks.map(call => call.body)).toEqual([{ blocker_id: TEEN, blocked_id: NO_HANDLE }]);
    expect(blocks[0]!.authorization).toMatch(/^Bearer /);
  });

  it('the teen removes it by id; a second removal is 404 with no second write', async () => {
    legacyAcceptedEdge();
    const res = await remove(TEEN, NO_HANDLE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: NO_HANDLE, removed: true });
    expect(called('remove_social_follower').map(call => call.body)).toEqual([{ p_subject_id: TEEN, p_follower_id: NO_HANDLE }]);
    expect(db.follows).toEqual([]);
    expect((await remove(TEEN, NO_HANDLE)).status).toBe(404);
    expect(called('remove_social_follower')).toHaveLength(1);
  });

  it('an accepted consent without a follow edge still admits report and block, not remove', async () => {
    db.social_consent_requests!.push({ id: REQUEST_ID, requester_id: NO_HANDLE, subject_id: TEEN, status: 'accepted', requested_at: '2026-09-20T10:00:00Z', decided_at: '2026-09-21T10:00:00Z' });
    expect((await report(TEEN, NO_HANDLE)).status).toBe(201);
    expect((await block(TEEN, NO_HANDLE)).status).toBe(200);
    expect((await remove(TEEN, NO_HANDLE)).status).toBe(404);
    expect(called('remove_social_follower')).toEqual([]);
  });
});

describe('the viewer\'s own following list, by id', () => {
  it('an adult unfollows, reports and blocks a handle-less account it follows', async () => {
    db.follows!.push({ follower_id: ADULT, followed_id: NO_HANDLE, created_at: '2026-09-21T10:00:00Z' });
    expect((await report(ADULT, NO_HANDLE, { category: 'harassment' })).status).toBe(201);
    expect((await block(ADULT, NO_HANDLE)).status).toBe(200);
    const res = await unfollow(ADULT, NO_HANDLE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: NO_HANDLE, following: false });
    const withdraw = called('withdraw_social_connection');
    expect(withdraw.map(call => call.body)).toEqual([{ p_follower_id: ADULT, p_followed_id: NO_HANDLE }]);
    // The session's own token, never the service key: RLS binds the follower to the caller.
    const jwt = withdraw[0]!.authorization!.replace(/^Bearer /, '').split('.')[1]!;
    expect(JSON.parse(Buffer.from(jwt, 'base64url').toString()).sub).toBe(ADULT);
    expect(called('record_social_protection_event').map(call => call.body.p_event)).toContain('unfollow');
  });

  it('a follower cannot be unfollowed, and a followed account cannot be removed, across the direction', async () => {
    db.follows!.push({ follower_id: ADULT, followed_id: NO_HANDLE, created_at: '2026-09-21T10:00:00Z' });
    expect((await remove(ADULT, NO_HANDLE)).status).toBe(404);
    expect((await unfollow(NO_HANDLE, ADULT)).status).toBe(404);
    expect(writes()).toEqual(NO_WRITES);
  });
});

describe('refused populations (every one leaves every write uncalled)', () => {
  it('a stranger id with no edge is 404 on all four routes', async () => {
    legacyAcceptedEdge();
    for (const res of [await report(TEEN, STRANGER), await block(TEEN, STRANGER), await remove(TEEN, STRANGER), await unfollow(TEEN, STRANGER)]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    expect(writes()).toEqual(NO_WRITES);
  });

  it('someone else\'s connection is not the caller\'s: a stranger cannot act on the teen\'s follower', async () => {
    legacyAcceptedEdge();
    expect((await report(STRANGER, NO_HANDLE)).status).toBe(404);
    expect((await block(STRANGER, NO_HANDLE)).status).toBe(404);
    expect((await remove(STRANGER, NO_HANDLE)).status).toBe(404);
    expect(writes()).toEqual(NO_WRITES);
  });

  it.each(['declined', 'removed', 'withdrawn', 'pending'])('a %s teen request is not a connection here (the queue routes own it)', async status => {
    db.social_consent_requests!.push({ id: REQUEST_ID, requester_id: NO_HANDLE, subject_id: TEEN, status, requested_at: '2026-09-20T10:00:00Z', decided_at: null });
    expect((await report(TEEN, NO_HANDLE)).status).toBe(404);
    expect((await block(TEEN, NO_HANDLE)).status).toBe(404);
    expect(writes()).toEqual(NO_WRITES);
  });

  it('the session\'s own id is 404', async () => {
    legacyAcceptedEdge();
    expect((await report(TEEN, TEEN)).status).toBe(404);
    expect((await block(TEEN, TEEN)).status).toBe(404);
    expect((await remove(TEEN, TEEN)).status).toBe(404);
    expect(writes()).toEqual(NO_WRITES);
  });

  it('refuses anonymous callers, malformed ids, query fields and unknown body fields', async () => {
    legacyAcceptedEdge();
    expect((await app().post(`/api/v1/profile/connections/${NO_HANDLE}/report`).send({ category: 'other' })).status).toBe(401);
    expect((await app().post(`/api/v1/profile/connections/${NO_HANDLE}/block`).send({})).status).toBe(401);
    expect((await app().delete(`/api/v1/profile/followers/id/${NO_HANDLE}`)).status).toBe(401);
    expect((await report(TEEN, 'not-a-uuid')).status).toBe(400);
    expect((await remove(TEEN, 'rio')).status).toBe(400);
    expect((await app().post(`/api/v1/profile/connections/${NO_HANDLE}/block?blocker_id=${STRANGER}`).set('Authorization', as(TEEN)).send({})).status).toBe(400);
    expect((await block(TEEN, NO_HANDLE, { blockerId: STRANGER })).status).toBe(400);
    for (const body of [{}, { category: 'free_form' }, { category: 'other', note: 'x'.repeat(141) }, { category: 'other', reporterId: STRANGER }]) {
      expect((await report(TEEN, NO_HANDLE, body)).status).toBe(400);
    }
    expect(writes()).toEqual(NO_WRITES);
  });

  it('502s without a write when the graph cannot be read, and when the removal is not confirmed', async () => {
    legacyAcceptedEdge();
    failGraphReads = true;
    for (const res of [await report(TEEN, NO_HANDLE), await block(TEEN, NO_HANDLE), await remove(TEEN, NO_HANDLE)]) expect(res.status).toBe(502);
    expect(writes()).toEqual(NO_WRITES);
    failGraphReads = false;
    removeAnswer = { status: 500, body: { message: 'down' } };
    expect((await remove(TEEN, NO_HANDLE)).status).toBe(502);
    removeAnswer = { status: 200, body: false };
    expect((await remove(TEEN, NO_HANDLE)).status).toBe(404);
  });
});
