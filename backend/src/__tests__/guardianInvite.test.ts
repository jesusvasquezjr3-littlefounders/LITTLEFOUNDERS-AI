import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';

/*
 * A.1's second-verified-guardian flow and kid-suspension lifecycle (migration
 * 0110): invite minting is guarded by the verified-parent boundary AND the
 * existing guardian link; acceptance is a one-shot token exchange whose
 * invalid shapes are indistinguishable from a missing invite; and a kid
 * whose last verified link disappeared is suspended at session admission
 * (sessions revoked) with a lazy 90-day purge that only ever deletes on an
 * unambiguous read.
 */

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_PARENT_ID = '33333333-3333-4333-8333-333333333333';
const KID_ID = '22222222-2222-4222-8222-222222222222';
const STRANGER_KID = '99999999-9999-4999-8999-999999999999';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface FamilyStubOpts {
  parentEvidence?: { status: string; method: string; birth_date: string } | null;
  roles?: string[];
  /** Roles of the linked account (default: a parent-created child). */
  kidRoles?: string[];
  links?: { parent_user_id: string; kid_user_id: string; verification_status: string }[];
  profiles?: unknown[];
  inviteRows?: unknown[];
  rpcResult?: unknown;
  rpcStatus?: number;
  /** S07.1: the link state the database holds after acceptance. */
  acceptedLinkStatus?: string;
  goTrueDeleteStatus?: number;
  goTrueSessionsStatus?: number;
  calls?: { url: string; method: string; body?: string }[];
}

function stubFamily(opts: FamilyStubOpts = {}) {
  const calls: { url: string; method: string; body?: string }[] = opts.calls ?? [];
  const roles = opts.roles ?? ['parent'];
  const evidence = opts.parentEvidence === undefined
    ? { status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }
    : opts.parentEvidence;
  const links = opts.links ?? [{ parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' }];
  const profiles = opts.profiles ?? [
    { user_id: KID_ID, display_name: 'Niño Test', username: 'ninotest' },
    { user_id: PARENT_ID, display_name: 'Parent', username: 'parent' },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.includes('/rpc/accept_guardian_invite')) {
        return Promise.resolve(jsonResponse(opts.rpcStatus ?? 200, opts.rpcResult === undefined ? KID_ID : opts.rpcResult));
      }
      if (url.includes('/admin/users/') && url.endsWith('/sessions') && method === 'DELETE') {
        return Promise.resolve(jsonResponse(opts.goTrueSessionsStatus ?? 200, {}));
      }
      if (url.includes('/admin/users/') && method === 'DELETE') {
        return Promise.resolve(jsonResponse(opts.goTrueDeleteStatus ?? 200, {}));
      }
      if (url.includes('/rest/v1/parent_verifications')) {
        return Promise.resolve(jsonResponse(200, evidence === null ? null : [evidence]));
      }
      if (url.includes(`/rest/v1/user_roles?user_id=eq.${KID_ID}`)) {
        // S07.2: the linked account itself (a parent-created child holds `kid`).
        return Promise.resolve(jsonResponse(200, (opts.kidRoles ?? ['kid']).map((role) => ({ user_id: KID_ID, role }))));
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, roles.map((role) => ({ user_id: PARENT_ID, role }))));
      }
      if (url.includes('/rest/v1/guardian_links') && url.includes('verification_status=eq.verified') && url.includes('parent_user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, links.map((link) => ({ parent_user_id: link.parent_user_id, kid_user_id: link.kid_user_id }))));
      }
      if (url.includes('/rest/v1/guardian_links') && url.includes('select=verification_status')) {
        return Promise.resolve(jsonResponse(200, [{ verification_status: opts.acceptedLinkStatus ?? 'pending' }]));
      }
      if (url.includes('/rest/v1/guardian_links') && url.includes('kid_user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, links.map((link) => ({ id: `${link.parent_user_id}:${link.kid_user_id}` }))));
      }
      if (url.includes('/rest/v1/guardian_invites') && method === 'POST') {
        return Promise.resolve(jsonResponse(201, null));
      }
      if (url.includes('/rest/v1/guardian_invites')) {
        const rows = opts.inviteRows ?? [];
        const tokenMatch = url.match(/token=eq\.([^&]+)/);
        const filtered = tokenMatch ? rows.filter((row) => (row as { token: string }).token === decodeURIComponent(tokenMatch[1]!)) : rows;
        return Promise.resolve(jsonResponse(200, filtered));
      }
      if (url.includes('/rest/v1/profiles')) {
        const userIdMatch = url.match(/user_id=eq\.([0-9a-f-]+)/);
        const rows = userIdMatch ? profiles.filter((row) => (row as { user_id: string }).user_id === userIdMatch[1]) : profiles;
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test, sub: string = PARENT_ID) => req.set('Authorization', `Bearer ${mintToken({ sub })}`);

describe('POST /api/v1/family/kids/:kidId/guardian-invite', () => {
  it('mints a single-use invite only for a verified kid of this parent', async () => {
    const calls = stubFamily();
    const res = await auth(request(createApp()).post(`/api/v1/family/kids/${KID_ID}/guardian-invite`));
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const insert = calls.find((c) => c.url.includes('/rest/v1/guardian_invites') && c.method === 'POST');
    expect(insert?.body).toContain(KID_ID);
    expect(insert?.body).toContain(PARENT_ID);
  });

  it('refuses to mint for a self-registered teen who linked this parent: only the teen invites (S07.2, D.3)', async () => {
    const calls = stubFamily({ kidRoles: ['universal'] });
    const res = await auth(request(createApp()).post(`/api/v1/family/kids/${KID_ID}/guardian-invite`));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SELF_MANAGED');
    expect(calls.some((c) => c.url.includes('/rest/v1/guardian_invites') && c.method === 'POST')).toBe(false);
  });

  it('refuses a kid this parent does not verifiably supervise', async () => {
    const calls = stubFamily();
    const res = await auth(request(createApp()).post(`/api/v1/family/kids/${STRANGER_KID}/guardian-invite`));
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.url.includes('/rest/v1/guardian_invites') && c.method === 'POST')).toBe(false);
  });

  it('refuses the whole surface for unverified adult evidence', async () => {
    const calls = stubFamily({ parentEvidence: null });
    const res = await auth(request(createApp()).post(`/api/v1/family/kids/${KID_ID}/guardian-invite`));
    expect(res.status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rest/v1/guardian_invites'))).toBe(false);
  });
});

describe('second-guardian preview and accept', () => {
  const INVITE_TOKEN = 'a'.repeat(32);
  const invite = {
    token: INVITE_TOKEN,
    kid_user_id: KID_ID,
    created_by: PARENT_ID,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
  };

  it('previews only kid display fields for a live invite', async () => {
    stubFamily({ inviteRows: [invite] });
    const res = await auth(request(createApp()).get(`/api/v1/family/guardian-invite/${INVITE_TOKEN}`), SECOND_PARENT_ID);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['confirmedBy', 'displayName', 'expiresAt', 'kidUserId', 'username'].sort());
    expect(res.body.data.confirmedBy).toBe('tutor');
  });

  it('tells the joining parent that a teen confirms an invite the teen issued (S07.2)', async () => {
    stubFamily({ inviteRows: [{ ...invite, created_by: KID_ID }] });
    const res = await auth(request(createApp()).get(`/api/v1/family/guardian-invite/${INVITE_TOKEN}`), SECOND_PARENT_ID);
    expect(res.status).toBe(200);
    expect(res.body.data.confirmedBy).toBe('account_holder');
  });

  it('treats an accepted, expired or unknown token as one indistinguishable 404', async () => {
    stubFamily({ inviteRows: [{ ...invite, accepted_at: new Date().toISOString() }] });
    expect((await auth(request(createApp()).get(`/api/v1/family/guardian-invite/${INVITE_TOKEN}`), SECOND_PARENT_ID)).status).toBe(404);
    stubFamily({ inviteRows: [{ ...invite, expires_at: new Date(Date.now() - 1000).toISOString() }] });
    expect((await auth(request(createApp()).get(`/api/v1/family/guardian-invite/${INVITE_TOKEN}`), SECOND_PARENT_ID)).status).toBe(404);
    stubFamily({ inviteRows: [invite] });
    expect((await auth(request(createApp()).get(`/api/v1/family/guardian-invite/${'b'.repeat(32)}`), SECOND_PARENT_ID)).status).toBe(404);
  });

  it('accepts through the one-shot exchange and reports the PENDING link awaiting confirmation (S07.1)', async () => {
    const calls = stubFamily({ inviteRows: [invite] });
    const res = await auth(request(createApp()).post(`/api/v1/family/guardian-invite/${INVITE_TOKEN}/accept`).send({}), SECOND_PARENT_ID);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ linked: false, status: 'pending', kidUserId: KID_ID });
    const rpc = calls.find((c) => c.url.includes('/rpc/accept_guardian_invite'));
    expect(rpc?.body).toContain(INVITE_TOKEN);
    expect(rpc?.body).toContain(SECOND_PARENT_ID);
  });

  it('maps an invalid invite to 404 rather than leaking a reason', async () => {
    stubFamily({ inviteRows: [{ ...invite, accepted_at: new Date().toISOString() }], rpcResult: { code: 'P0001' }, rpcStatus: 400 });
    const res = await auth(request(createApp()).post(`/api/v1/family/guardian-invite/${INVITE_TOKEN}/accept`).send({}), SECOND_PARENT_ID);
    expect(res.status).toBe(404);
  });
});
