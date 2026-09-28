import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * E.4 (OD-3), Appendix J 1.1: the staff-reviewed age correction. Core's
 * boundary refuses every population that may not ask before any write, never
 * takes a staff id from the body, and maps the database's refusals (the
 * database re-checks every rule: verify-age-correction-postgres.py).
 */

const USER = '22222222-2222-4222-8222-222222222222';
const STAFF = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROW = {
  id: REQUEST_ID, user_id: USER, from_age_band: '13_to_17', requested_age_band: 'adult', requested_birth_month: null,
  status: 'pending', decided_by: null, reason_code: null, created_at: '2026-09-27T10:00:00Z', decided_at: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) void authRateLimiter.resetKey(key);
});

interface Stub {
  roles?: { role: string }[] | null;
  grants?: { user_id: string; permission: string }[];
  declaration?: unknown[];
  origins?: unknown[];
  rows?: unknown[] | null;
  rpcStatus?: number;
  rpcBody?: unknown;
}

function stub(opts: Stub = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined });
    if (url.includes('/rpc/request_age_correction')) return Promise.resolve(jsonResponse(opts.rpcStatus ?? 200, opts.rpcBody ?? REQUEST_ID));
    if (url.includes('/rpc/decide_age_correction')) return Promise.resolve(jsonResponse(opts.rpcStatus ?? 200, opts.rpcBody ?? 'approved'));
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, opts.roles === undefined ? [{ role: 'universal' }] : opts.roles));
    if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, opts.grants ?? [{ user_id: STAFF, permission: 'manage_users' }]));
    if (url.includes('/account_age_declarations')) return Promise.resolve(jsonResponse(200, opts.declaration ?? [{ declared_age_band: '13_to_17' }]));
    if (url.includes('/account_safety_origins')) return Promise.resolve(jsonResponse(200, opts.origins ?? []));
    if (url.includes('/age_correction_requests')) return Promise.resolve(jsonResponse(200, opts.rows === undefined ? [ROW] : opts.rows));
    return Promise.resolve(jsonResponse(200, []));
  }));
  return calls;
}

const as = (sub: string, claims: Record<string, unknown> = {}) => `Bearer ${mintToken({ sub, ...claims })}`;
const rpcCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/rpc/request_age_correction') || c.url.includes('/rpc/decide_age_correction'));

describe('the account asks for an age correction', () => {
  it('reports eligibility and the latest request for a self-registered teen', async () => {
    stub();
    const res = await request(createApp()).get('/api/v1/account/age-correction').set('Authorization', as(USER));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ eligible: true, request: {
      id: REQUEST_ID, status: 'pending', requestedBand: 'adult', reason: null, createdAt: '2026-09-27T10:00:00Z', decidedAt: null,
    } });
  });

  it.each([
    ['a parent-created child', { roles: [{ role: 'kid' }] }],
    ['an under-13 origin', { origins: [{ under13_origin: true }] }],
    ['an unscreened account', { declaration: [] }],
  ])('is not offered to %s', async (_label, opts) => {
    stub({ ...opts, rows: [] });
    const res = await request(createApp()).get('/api/v1/account/age-correction').set('Authorization', as(USER));
    expect(res.body.data).toEqual({ eligible: false, request: null });
  });

  it('keeps only the band for an adult date and the month for a teen date, never the day', async () => {
    const calls = stub({ rows: [ROW] });
    const res = await request(createApp()).post('/api/v1/account/age-correction').set('Authorization', as(USER)).send({ birthDate: '1990-05-17' });
    expect(res.status).toBe(201);
    expect(rpcCalls(calls)[0]?.body).toEqual({ p_user: USER, p_age_band: 'adult', p_birth_month: null });
    const teen = new Date().getUTCFullYear() - 15;
    const calls2 = stub({ rows: [ROW] });
    await request(createApp()).post('/api/v1/account/age-correction').set('Authorization', as(USER)).send({ birthDate: `${teen}-05-17` });
    expect(rpcCalls(calls2)[0]?.body).toEqual({ p_user: USER, p_age_band: '13_to_17', p_birth_month: `${teen}-05-01` });
  });

  it.each([
    ['a parent-created child', { roles: [{ role: 'kid' }] }, {}, 403, 'KID_AGE_BY_TUTOR'],
    ['a guest', {}, { is_anonymous: true }, 403, 'NOT_ELIGIBLE'],
    ['an unreadable role', { roles: null }, {}, 502, 'DATA_UNAVAILABLE'],
  ])('refuses %s before any write', async (_label, opts, claims, status, code) => {
    const calls = stub(opts as Stub);
    const res = await request(createApp()).post('/api/v1/account/age-correction').set('Authorization', as(USER, claims)).send({ birthDate: '1990-05-17' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(rpcCalls(calls)).toEqual([]);
  });

  it.each([[{ birthDate: '2999-01-01' }], [{ birthDate: '1990-02-30' }], [{ birthDate: '1990-05-17', userId: STAFF }], [{}]])(
    'refuses a malformed body %o before any write', async (body) => {
      const calls = stub();
      const res = await request(createApp()).post('/api/v1/account/age-correction').set('Authorization', as(USER)).send(body);
      expect(res.status).toBe(400);
      expect(rpcCalls(calls)).toEqual([]);
    });

  it.each([
    ['CORRECTION_PENDING', 409], ['AGE_UNCHANGED', 409], ['AGE_PROTECTED', 409], ['AGE_SCREEN_REQUIRED', 409], ['KID_AGE_BY_TUTOR', 403],
  ])('passes the database refusal %s on', async (message, status) => {
    stub({ rpcStatus: 400, rpcBody: { code: 'P0001', message } });
    const res = await request(createApp()).post('/api/v1/account/age-correction').set('Authorization', as(USER)).send({ birthDate: '1990-05-17' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(message);
  });
});

describe('staff decide an age correction (manage_users)', () => {
  it('denies an admin without manage_users before any read or decision', async () => {
    const calls = stub({ roles: [{ role: 'admin' }], grants: [{ user_id: STAFF, permission: 'view_analytics' }] });
    const list = await request(createApp()).get('/api/v1/admin/age-corrections').set('Authorization', as(STAFF));
    const decide = await request(createApp()).post(`/api/v1/admin/age-corrections/${REQUEST_ID}/decision`).set('Authorization', as(STAFF))
      .send({ decision: 'approve', reason: 'evidence_verified' });
    expect([list.status, decide.status]).toEqual([403, 403]);
    expect(calls.some((c) => c.url.includes('age_correction'))).toBe(false);
  });

  it('denies an account holder who is not staff', async () => {
    const calls = stub();
    const res = await request(createApp()).post(`/api/v1/admin/age-corrections/${REQUEST_ID}/decision`).set('Authorization', as(USER))
      .send({ decision: 'approve', reason: 'evidence_verified' });
    expect(res.status).toBe(403);
    expect(rpcCalls(calls)).toEqual([]);
  });

  it('lists the pending queue with the band change and a teen month only', async () => {
    const calls = stub({ roles: [{ role: 'admin' }], rows: [{ ...ROW, requested_age_band: '13_to_17', from_age_band: 'adult', requested_birth_month: '2011-05-01' }] });
    const res = await request(createApp()).get('/api/v1/admin/age-corrections').set('Authorization', as(STAFF));
    expect(res.status).toBe(200);
    expect(res.body.data.requests).toEqual([{
      id: REQUEST_ID, userId: USER, status: 'pending', fromBand: 'adult', requestedBand: '13_to_17', requestedBirthMonth: '2011-05', reason: null,
      createdAt: '2026-09-27T10:00:00Z', decidedAt: null, decidedBy: null,
    }]);
    expect(calls.find((c) => c.url.includes('/age_correction_requests'))?.url).toContain('status=eq.pending');
  });

  it('decides as the signed-in staff member, never an id from the body', async () => {
    const calls = stub({ roles: [{ role: 'admin' }] });
    const res = await request(createApp()).post(`/api/v1/admin/age-corrections/${REQUEST_ID}/decision`).set('Authorization', as(STAFF))
      .send({ decision: 'approve', reason: 'evidence_verified' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: REQUEST_ID, status: 'approved' });
    expect(rpcCalls(calls)[0]?.body).toEqual({ p_request: REQUEST_ID, p_staff: STAFF, p_approve: true, p_reason: 'evidence_verified' });
    const forged = await request(createApp()).post(`/api/v1/admin/age-corrections/${REQUEST_ID}/decision`).set('Authorization', as(STAFF))
      .send({ decision: 'approve', reason: 'evidence_verified', staffId: USER });
    expect(forged.status).toBe(400);
  });

  it.each([
    [{ decision: 'approve', reason: 'not_credible' }], [{ decision: 'reject', reason: 'entry_error' }], [{ decision: 'maybe', reason: 'entry_error' }],
  ])('refuses a reason that does not match the decision %o', async (body) => {
    const calls = stub({ roles: [{ role: 'admin' }] });
    const res = await request(createApp()).post(`/api/v1/admin/age-corrections/${REQUEST_ID}/decision`).set('Authorization', as(STAFF)).send(body);
    expect(res.status).toBe(400);
    expect(rpcCalls(calls)).toEqual([]);
  });

  it.each([['SELF_DECISION', 403], ['NOT_PENDING', 409], ['NOT_FOUND', 404], ['NOT_STAFF', 403]])(
    'passes the database refusal %s on (a staff member deciding their own request, a decided request)', async (message, status) => {
      stub({ roles: [{ role: 'admin' }], rpcStatus: 400, rpcBody: { code: 'P0001', message } });
      const res = await request(createApp()).post(`/api/v1/admin/age-corrections/${REQUEST_ID}/decision`).set('Authorization', as(STAFF))
        .send({ decision: 'reject', reason: 'evidence_missing' });
      expect(res.status).toBe(status);
    });
});
