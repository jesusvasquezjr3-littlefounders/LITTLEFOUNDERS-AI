import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { makeDb } from './learnFixtures.js';

/*
 * E.1/E.2/E.3/E.13 (GAP-FIX-R3 social): the verified Tutor ends or reports a
 * connection of their child from the Family panel. Every refused population
 * (anonymous, unlinked child, stale guardian, self-managed teen, an account
 * that is not a current connection, malformed input, an unreadable answer)
 * leaves the transaction uncalled or reports failure, never success.
 */

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const KID_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const STRANGER_KID = '99999999-9999-4999-8999-999999999999';
const REPORT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let db: FakeDb;
let rpc: { name: string; body: Record<string, unknown> }[];
let endReceipt: { status: number; body: unknown };
let reportReceipt: { status: number; body: unknown };
let failFollows: boolean;
let revokeAfterWrite: boolean;
const token = () => mintToken({ sub: PARENT_ID });
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token()}`);
const endpoint = (kid = KID_ID, other = OTHER_ID) => `/api/v1/family/kids/${kid}/social/connections/${other}`;
const called = (name: string) => rpc.filter(call => call.name === name);

beforeEach(() => {
  db = makeDb(PARENT_ID);
  db.user_roles = [{ user_id: PARENT_ID, role: 'parent' }, { user_id: KID_ID, role: 'kid' }, { user_id: OTHER_ID, role: 'parent' }];
  db.parent_verifications = [{ user_id: PARENT_ID, status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }];
  db.guardian_links = [
    { parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' },
    { parent_user_id: PARENT_ID, kid_user_id: STRANGER_KID, verification_status: 'pending' },
  ];
  db.profiles = [
    { user_id: KID_ID, display_name: 'Niño', username: 'nino' },
    { user_id: OTHER_ID, display_name: 'Zed', username: 'zed' },
  ];
  db.follows = [{ follower_id: OTHER_ID, followed_id: KID_ID }, { follower_id: KID_ID, followed_id: OTHER_ID }];
  db.social_safety_notices = [];
  rpc = [];
  endReceipt = { status: 200, body: 2 };
  reportReceipt = { status: 200, body: REPORT_ID };
  failFollows = false;
  revokeAfterWrite = false;
  const base = createFakeFetch(db);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const rpcName = /\/rpc\/([a-z_]+)/.exec(url)?.[1];
    if (rpcName && rpcName !== 'social_tier') rpc.push({ name: rpcName, body: JSON.parse(String(init?.body ?? '{}')) });
    if (rpcName === 'guardian_end_social_connection') {
      if (revokeAfterWrite) db.guardian_links[0]!.verification_status = 'revoked';
      return jsonResponse(endReceipt.status, endReceipt.body);
    }
    if (rpcName === 'submit_social_report') {
      if (revokeAfterWrite) db.guardian_links[0]!.verification_status = 'revoked';
      return jsonResponse(reportReceipt.status, reportReceipt.body);
    }
    if (rpcName === 'record_social_protection_event') return new Response(null, { status: 204 });
    if (failFollows && url.includes('/rest/v1/follows')) return new Response('{}', { status: 503 });
    return base(input, init);
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('DELETE /api/v1/family/kids/:kidId/social/connections/:userId', () => {
  it('ends a current connection through the transaction, with the session guardian, and records each removed edge', async () => {
    const res = await auth(request(createApp()).delete(endpoint()));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ended: true, removed: 2 });
    expect(called('guardian_end_social_connection').map(call => call.body)).toEqual([{ p_guardian: PARENT_ID, p_kid: KID_ID, p_other: OTHER_ID }]);
    await vi.waitFor(() => expect(called('record_social_protection_event')).toHaveLength(2));
    expect(called('record_social_protection_event').map(call => call.body)).toEqual([
      { p_event: 'unfollow', p_viewer: PARENT_ID, p_subject: KID_ID }, { p_event: 'unfollow', p_viewer: PARENT_ID, p_subject: KID_ID },
    ]);
  });

  it('ends a one-way connection too', async () => {
    db.follows = [{ follower_id: KID_ID, followed_id: OTHER_ID }];
    endReceipt = { status: 200, body: 1 };
    expect((await auth(request(createApp()).delete(endpoint()))).body.data).toEqual({ ended: true, removed: 1 });
  });

  it('refuses anonymous callers', async () => {
    expect((await request(createApp()).delete(endpoint())).status).toBe(401);
    expect(called('guardian_end_social_connection')).toEqual([]);
  });

  it.each(['pending', 'revoked'])('refuses a %s guardian link without calling the transaction', async status => {
    db.guardian_links[0]!.verification_status = status;
    expect((await auth(request(createApp()).delete(endpoint()))).status).toBe(404);
    expect((await auth(request(createApp()).delete(endpoint(STRANGER_KID)))).status).toBe(404);
    expect(called('guardian_end_social_connection')).toEqual([]);
  });

  it('refuses a guardian without current adult verification', async () => {
    db.parent_verifications = [];
    expect((await auth(request(createApp()).delete(endpoint()))).status).toBe(403);
    expect(called('guardian_end_social_connection')).toEqual([]);
  });

  it.each([endpoint(KID_ID, 'zed'), endpoint(KID_ID, KID_ID), `${endpoint()}?guardianId=${OTHER_ID}`])('refuses a malformed target %s', async path => {
    expect((await auth(request(createApp()).delete(path))).status).toBe(400);
    expect(called('guardian_end_social_connection')).toEqual([]);
  });

  it('404s for an account that is not a current connection, without calling the transaction', async () => {
    db.follows = [{ follower_id: OTHER_ID, followed_id: STRANGER_KID }];
    const res = await auth(request(createApp()).delete(endpoint()));
    expect(res.status).toBe(404);
    expect(called('guardian_end_social_connection')).toEqual([]);
  });

  it('502s when the connection cannot be read', async () => {
    failFollows = true;
    expect((await auth(request(createApp()).delete(endpoint()))).status).toBe(502);
    expect(called('guardian_end_social_connection')).toEqual([]);
  });

  it.each([
    ['GUARDIAN_DECISION_FORBIDDEN', 403, 'GUARDIAN_DECISION_FORBIDDEN'],
    ['SOCIAL_SELF_MANAGED', 403, 'ACCOUNT_SELF_MANAGED'],
    ['INVALID_SOCIAL_END', 400, 'VALIDATION_ERROR'],
    ['INJECTED_FAILURE', 502, 'DATA_UNAVAILABLE'],
  ])('maps the transactional refusal %s', async (message, status, code) => {
    endReceipt = { status: 400, body: { code: 'P0001', message } };
    const res = await auth(request(createApp()).delete(endpoint()));
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(called('record_social_protection_event')).toEqual([]);
  });

  it.each([true, '2', 3, -1, null, { removed: 2 }])('never claims success from an unreadable answer: %j', async body => {
    endReceipt = { status: 200, body };
    expect((await auth(request(createApp()).delete(endpoint()))).status).toBe(502);
  });

  it('404s when the transaction found nothing left to end (a concurrent unfollow)', async () => {
    endReceipt = { status: 200, body: 0 };
    expect((await auth(request(createApp()).delete(endpoint()))).status).toBe(404);
    expect(called('record_social_protection_event')).toEqual([]);
  });

  it('rechecks the guardian link after the write', async () => {
    revokeAfterWrite = true;
    expect((await auth(request(createApp()).delete(endpoint()))).status).toBe(404);
  });
});

describe('POST /api/v1/family/kids/:kidId/social/connections/:userId/report', () => {
  const report = (body: unknown, path = `${endpoint()}/report`) => auth(request(createApp()).post(path)).send(body as object);

  it('files the report with the guardian as reporter for a current connection', async () => {
    const res = await report({ category: 'unwanted_contact', note: 'Asked for a phone number' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ reported: true, reportId: REPORT_ID });
    expect(called('submit_social_report').map(call => call.body)).toEqual([
      { p_reporter_id: PARENT_ID, p_subject_id: OTHER_ID, p_category: 'unwanted_contact', p_note: 'Asked for a phone number' },
    ]);
  });

  it('files the report for an account named in this guardian\'s notice for the child, even after the connection ended', async () => {
    db.follows = [];
    db.social_safety_notices = [{ id: REPORT_ID, guardian_id: PARENT_ID, kid_user_id: KID_ID, kind: 'social.report', subject_id: OTHER_ID, report_id: null, created_at: '2026-09-24T10:00:00Z' }];
    expect((await report({ category: 'harassment' })).status).toBe(201);
  });

  it('404s for an account neither connected nor in a notice for this child', async () => {
    db.follows = [];
    db.social_safety_notices = [{ id: REPORT_ID, guardian_id: PARENT_ID, kid_user_id: STRANGER_KID, kind: 'social.report', subject_id: OTHER_ID, report_id: null, created_at: '2026-09-24T10:00:00Z' }];
    expect((await report({ category: 'harassment' })).status).toBe(404);
    expect(called('submit_social_report')).toEqual([]);
  });

  it.each([{}, { category: 'free_form' }, { category: 'other', note: 'x'.repeat(141) }, { category: 'other', reporterId: OTHER_ID }])('refuses an invalid body %j', async body => {
    expect((await report(body)).status).toBe(400);
    expect(called('submit_social_report')).toEqual([]);
  });

  it('refuses reporting the child or the guardian from the Family panel', async () => {
    expect((await report({ category: 'other' }, `${endpoint(KID_ID, KID_ID)}/report`)).status).toBe(400);
    expect((await report({ category: 'other' }, `${endpoint(KID_ID, PARENT_ID)}/report`)).status).toBe(400);
    expect(called('submit_social_report')).toEqual([]);
  });

  it('refuses anonymous callers and unlinked children', async () => {
    expect((await request(createApp()).post(`${endpoint()}/report`).send({ category: 'other' })).status).toBe(401);
    expect((await report({ category: 'other' }, `${endpoint(STRANGER_KID)}/report`)).status).toBe(404);
    expect(called('submit_social_report')).toEqual([]);
  });

  it('502s when neither admission can be read, and when the report is not confirmed', async () => {
    failFollows = true;
    expect((await report({ category: 'other' })).status).toBe(502);
    expect(called('submit_social_report')).toEqual([]);
    failFollows = false;
    reportReceipt = { status: 200, body: 'not-a-uuid' };
    expect((await report({ category: 'other' })).status).toBe(502);
  });
});

describe('Family surfaces offer the actions only where they apply', () => {
  it('the graph says a guardian-tier child\'s connections can be ended', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/family/kids/${KID_ID}/social?direction=followers`));
    expect(res.status).toBe(200);
    expect(res.body.data.canEnd).toBe(true);
  });

  it('the graph keeps a self-registered teen\'s list read-only', async () => {
    db.user_roles = db.user_roles.filter(row => !(row.user_id === KID_ID && row.role === 'kid'));
    db.user_roles.push({ user_id: KID_ID, role: 'universal' });
    db.account_age_declarations = [{ user_id: KID_ID, declared_age_band: '13_to_17' }];
    const res = await auth(request(createApp()).get(`/api/v1/family/kids/${KID_ID}/social?direction=followers`));
    expect(res.status).toBe(200);
    expect(res.body.data.canEnd).toBe(false);
  });

  it('a named notice about a current connection offers the end action; an ended one does not', async () => {
    db.social_safety_notices = [{ id: REPORT_ID, guardian_id: PARENT_ID, kid_user_id: KID_ID, kind: 'social.report', subject_id: OTHER_ID, report_id: null, created_at: '2026-09-24T10:00:00Z' }];
    const first = await auth(request(createApp()).get('/api/v1/family/social-notices'));
    expect(first.status).toBe(200);
    expect(first.body.data.notices[0]).toMatchObject({ subjectId: OTHER_ID, subjectName: 'Zed', canEnd: true });
    db.follows = [];
    const second = await auth(request(createApp()).get('/api/v1/family/social-notices'));
    expect(second.body.data.notices[0]).toMatchObject({ subjectName: 'Zed', canEnd: false });
  });

  it('notices 502 rather than hide the action when the connection cannot be read', async () => {
    db.social_safety_notices = [{ id: REPORT_ID, guardian_id: PARENT_ID, kid_user_id: KID_ID, kind: 'social.report', subject_id: OTHER_ID, report_id: null, created_at: '2026-09-24T10:00:00Z' }];
    failFollows = true;
    expect((await auth(request(createApp()).get('/api/v1/family/social-notices'))).status).toBe(502);
  });
});
