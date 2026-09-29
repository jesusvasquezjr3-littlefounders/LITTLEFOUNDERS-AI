import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { makeDb } from './learnFixtures.js';
import { requestStillActionable } from '../services/supabaseRest.js';

/*
 * E.3 from both request queues (GAP-FIX-R5 social; OD-8's report action for
 * unwanted contact; D-19). An inbound connection request is the first
 * unwanted-contact event: the verified Tutor reports the requester from the
 * child's pending queue, and a self-registered teen reports or blocks the
 * requester from their own. Admission is the request itself (addressed to
 * this child or this session; pending, or closed without a connection in the
 * last 30 days), never the requester's profile visibility. Every refused
 * population leaves the report transaction and the block write uncalled.
 */

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const KID_ID = '22222222-2222-4222-8222-222222222222';
const REQUESTER_ID = '33333333-3333-4333-8333-333333333333';
const TEEN_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_TEEN = '55555555-5555-4555-8555-555555555555';
const STRANGER_KID = '99999999-9999-4999-8999-999999999999';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REPORT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

let db: FakeDb;
let rpc: { name: string; body: Record<string, unknown> }[];
let blocks: { body: Record<string, unknown>; authorization: string | null }[];
let reportReceipt: { status: number; body: unknown };
let blockStatus: number;
let failRequests: boolean;
let revokeAfterWrite: boolean;
const called = (name: string) => rpc.filter(call => call.name === name);

beforeEach(() => {
  db = makeDb(PARENT_ID);
  db.user_roles = [{ user_id: PARENT_ID, role: 'parent' }, { user_id: KID_ID, role: 'kid' }, { user_id: REQUESTER_ID, role: 'universal' }, { user_id: TEEN_ID, role: 'universal' }];
  db.parent_verifications = [{ user_id: PARENT_ID, status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }];
  db.guardian_links = [
    { parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' },
    { parent_user_id: PARENT_ID, kid_user_id: STRANGER_KID, verification_status: 'pending' },
  ];
  db.social_connection_requests = [{ id: REQUEST_ID, requester_id: REQUESTER_ID, kid_user_id: KID_ID, status: 'pending', requested_at: daysAgo(1), decided_at: null }];
  db.social_consent_requests = [{ id: REQUEST_ID, requester_id: REQUESTER_ID, subject_id: TEEN_ID, status: 'pending', requested_at: daysAgo(1), decided_at: null }];
  rpc = [];
  blocks = [];
  reportReceipt = { status: 200, body: REPORT_ID };
  blockStatus = 201;
  failRequests = false;
  revokeAfterWrite = false;
  const base = createFakeFetch(db);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const rpcName = /\/rpc\/([a-z_]+)/.exec(url)?.[1];
    if (rpcName && rpcName !== 'social_tier') rpc.push({ name: rpcName, body: JSON.parse(String(init?.body ?? '{}')) });
    if (rpcName === 'submit_social_report') {
      if (revokeAfterWrite) db.guardian_links[0]!.verification_status = 'revoked';
      return jsonResponse(reportReceipt.status, reportReceipt.body);
    }
    if (rpcName === 'record_social_protection_event') return new Response(null, { status: 204 });
    if (failRequests && /\/rest\/v1\/social_(connection|consent)_requests/.test(url)) return new Response('{}', { status: 503 });
    if (url.includes('/rest/v1/blocks') && init?.method === 'POST') {
      blocks.push({ body: JSON.parse(String(init.body)), authorization: new Headers(init.headers).get('Authorization') });
      return new Response(null, { status: blockStatus });
    }
    return base(input, init);
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('the 30-day window after a request closed without a connection', () => {
  it('admits pending, and a closed status within 30 days; refuses a connected, an old or an unknown one', () => {
    const now = Date.parse('2026-09-29T12:00:00Z');
    expect(requestStillActionable('pending', null, ['denied'], now)).toBe(true);
    expect(requestStillActionable('denied', '2026-09-01T12:00:00Z', ['denied'], now)).toBe(true);
    expect(requestStillActionable('denied', '2026-08-29T11:59:00Z', ['denied'], now)).toBe(false);
    expect(requestStillActionable('denied', null, ['denied'], now)).toBe(false);
    expect(requestStillActionable('approved', '2026-09-28T12:00:00Z', ['denied'], now)).toBe(false);
    expect(requestStillActionable('denied', 'not a date', ['denied'], now)).toBe(false);
  });
});

describe('POST /api/v1/family/kids/:kidId/social/requests/:requestId/report', () => {
  const token = () => mintToken({ sub: PARENT_ID });
  const path = (kid = KID_ID, id = REQUEST_ID) => `/api/v1/family/kids/${kid}/social/requests/${id}/report`;
  const report = (body: unknown, target = path()) => request(createApp()).post(target).set('Authorization', `Bearer ${token()}`).send(body as object);

  it('files the report against the requester of a pending request, with the session guardian as reporter', async () => {
    const res = await report({ category: 'unwanted_contact', note: 'Asked for our address' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ requestId: REQUEST_ID, reported: true, reportId: REPORT_ID });
    expect(called('submit_social_report').map(call => call.body)).toEqual([
      { p_reporter_id: PARENT_ID, p_subject_id: REQUESTER_ID, p_category: 'unwanted_contact', p_note: 'Asked for our address' },
    ]);
  });

  it.each(['denied', 'revoked'])('admits a request %s in the last 30 days', async status => {
    db.social_connection_requests[0] = { ...db.social_connection_requests[0]!, status, decided_at: daysAgo(29) };
    expect((await report({ category: 'harassment' })).status).toBe(201);
  });

  it.each([
    ['an approved request (a connection: the graph row reports it)', { status: 'approved', decided_at: daysAgo(1) }],
    ['a request denied more than 30 days ago', { status: 'denied', decided_at: daysAgo(31) }],
    ['a closed request without a decision time', { status: 'denied', decided_at: null }],
    ['a request addressed to another child', { kid_user_id: STRANGER_KID }],
  ])('404s for %s, without calling the transaction', async (_name, change) => {
    db.social_connection_requests[0] = { ...db.social_connection_requests[0]!, ...change };
    const res = await report({ category: 'other' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(called('submit_social_report')).toEqual([]);
  });

  it('404s for an unknown request id', async () => {
    expect((await report({ category: 'other' }, path(KID_ID, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'))).status).toBe(404);
    expect(called('submit_social_report')).toEqual([]);
  });

  it('refuses anonymous callers, unlinked or pending-link children and a guardian without current verification', async () => {
    expect((await request(createApp()).post(path()).send({ category: 'other' })).status).toBe(401);
    expect((await report({ category: 'other' }, path(STRANGER_KID))).status).toBe(404);
    db.guardian_links[0]!.verification_status = 'pending';
    expect((await report({ category: 'other' })).status).toBe(404);
    db.guardian_links[0]!.verification_status = 'verified';
    db.parent_verifications = [];
    expect((await report({ category: 'other' })).status).toBe(403);
    expect(called('submit_social_report')).toEqual([]);
  });

  it.each([{}, { category: 'free_form' }, { category: 'other', note: 'x'.repeat(141) }, { category: 'other', note: '   ' }, { category: 'other', reporterId: KID_ID }, { category: 'other', requesterId: TEEN_ID }])(
    'refuses an invalid body %j', async body => {
      expect((await report(body)).status).toBe(400);
      expect(called('submit_social_report')).toEqual([]);
    });

  it('refuses a malformed request id and any query field', async () => {
    expect((await report({ category: 'other' }, path(KID_ID, 'nope'))).status).toBe(400);
    expect((await report({ category: 'other' }, `${path()}?requesterId=${TEEN_ID}`)).status).toBe(400);
    expect(called('submit_social_report')).toEqual([]);
  });

  it('refuses a request whose requester is the reporting guardian', async () => {
    db.social_connection_requests[0]!.requester_id = PARENT_ID;
    expect((await report({ category: 'other' })).status).toBe(400);
    expect(called('submit_social_report')).toEqual([]);
  });

  it('502s when the request cannot be read, and when the report is not confirmed', async () => {
    failRequests = true;
    expect((await report({ category: 'other' })).status).toBe(502);
    expect(called('submit_social_report')).toEqual([]);
    failRequests = false;
    reportReceipt = { status: 200, body: 'not-a-uuid' };
    expect((await report({ category: 'other' })).status).toBe(502);
    reportReceipt = { status: 400, body: { code: 'P0001', message: 'INVALID_SOCIAL_REPORT' } };
    expect((await report({ category: 'other' })).status).toBe(400);
  });

  it('rechecks the guardian link after the write', async () => {
    revokeAfterWrite = true;
    expect((await report({ category: 'other' })).status).toBe(404);
  });
});

describe("the teen's own queue: POST /api/v1/profile/connection-requests/:requestId/report and /block", () => {
  const as = (sub = TEEN_ID) => mintToken({ sub });
  const path = (action: 'report' | 'block', id = REQUEST_ID) => `/api/v1/profile/connection-requests/${id}/${action}`;
  const post = (target: string, body: unknown = {}, sub = TEEN_ID) => request(createApp()).post(target).set('Authorization', `Bearer ${as(sub)}`).send(body as object);

  it('reports the requester of a pending request, with the session as reporter', async () => {
    const res = await post(path('report'), { category: 'unwanted_contact' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ requestId: REQUEST_ID, reported: true, reportId: REPORT_ID });
    expect(called('submit_social_report').map(call => call.body)).toEqual([
      { p_reporter_id: TEEN_ID, p_subject_id: REQUESTER_ID, p_category: 'unwanted_contact', p_note: null },
    ]);
  });

  it('blocks the requester of a pending request through the session\'s own block write', async () => {
    const res = await post(path('block'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ requestId: REQUEST_ID, blocked: true });
    expect(blocks.map(call => call.body)).toEqual([{ blocker_id: TEEN_ID, blocked_id: REQUESTER_ID }]);
    expect(blocks[0]!.authorization).toMatch(/^Bearer /);
  });

  it.each(['declined', 'removed', 'withdrawn'])('admits a request %s in the last 30 days (a decline is not the end of the path)', async status => {
    db.social_consent_requests[0] = { ...db.social_consent_requests[0]!, status, decided_at: daysAgo(3) };
    expect((await post(path('report'), { category: 'harassment' })).status).toBe(201);
    expect((await post(path('block'))).status).toBe(200);
  });

  it.each([
    ['an accepted request (a follower: the list removes it)', { status: 'accepted', decided_at: daysAgo(1) }],
    ['a request declined more than 30 days ago', { status: 'declined', decided_at: daysAgo(40) }],
    ['a request addressed to another teen', { subject_id: OTHER_TEEN }],
  ])('404s for %s, with neither write called', async (_name, change) => {
    db.social_consent_requests[0] = { ...db.social_consent_requests[0]!, ...change };
    expect((await post(path('report'), { category: 'other' })).status).toBe(404);
    expect((await post(path('block'))).status).toBe(404);
    expect(called('submit_social_report')).toEqual([]);
    expect(blocks).toEqual([]);
  });

  it('the requester cannot act on its own outgoing request', async () => {
    expect((await post(path('report'), { category: 'other' }, REQUESTER_ID)).status).toBe(404);
    expect((await post(path('block'), {}, REQUESTER_ID)).status).toBe(404);
    expect(called('submit_social_report')).toEqual([]);
    expect(blocks).toEqual([]);
  });

  it('refuses anonymous callers, malformed ids, query fields and unknown body fields', async () => {
    expect((await request(createApp()).post(path('report')).send({ category: 'other' })).status).toBe(401);
    expect((await request(createApp()).post(path('block')).send({})).status).toBe(401);
    expect((await post(path('report', 'nope'), { category: 'other' })).status).toBe(400);
    expect((await post(`${path('block')}?subject_id=${OTHER_TEEN}`)).status).toBe(400);
    expect((await post(path('block'), { blockedId: TEEN_ID })).status).toBe(400);
    for (const body of [{}, { category: 'free_form' }, { category: 'other', note: 'x'.repeat(141) }, { category: 'other', subjectId: OTHER_TEEN }]) {
      expect((await post(path('report'), body)).status).toBe(400);
    }
    expect(called('submit_social_report')).toEqual([]);
    expect(blocks).toEqual([]);
  });

  it('502s when the request cannot be read, the report is unconfirmed or the block is not written', async () => {
    failRequests = true;
    expect((await post(path('report'), { category: 'other' })).status).toBe(502);
    expect((await post(path('block'))).status).toBe(502);
    expect(called('submit_social_report')).toEqual([]);
    expect(blocks).toEqual([]);
    failRequests = false;
    reportReceipt = { status: 200, body: null };
    expect((await post(path('report'), { category: 'other' })).status).toBe(502);
    blockStatus = 500;
    expect((await post(path('block'))).status).toBe(502);
  });
});
