import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * A.5/A.6 adversarial boundary tests: the staff console distinguishes
 * ID-verified from staff-granted parent verifications, a parent-role staff
 * grant requires an audited justification, revocation is a real trigger
 * path with a mandatory reason, and the kid-role Settings surface refuses
 * email change and profile-username edits at the API boundary.
 */

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TARGET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KID_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

afterEach(() => vi.unstubAllGlobals());

function adminToken() {
  return mintToken({ sub: ADMIN_ID, email: 'staff@littlefounders.ai' });
}

function superadminToken() {
  return mintToken({ sub: ADMIN_ID, email: 'boss@littlefounders.ai' });
}

interface StubOpts {
  roles?: string[];
  adminPerms?: string[];
  verificationRows?: unknown[];
  writes?: { url: string; body: unknown }[];
  /** The database function's answer: a status and a body (PostgREST error shape on refusal). */
  rpc?: { status: number; body: unknown };
}

function stub(opts: StubOpts = {}) {
  const writes: { url: string; body: unknown }[] = opts.writes ?? [];
  const roles = opts.roles ?? ['admin'];
  const offset = (url: string) => Number(new URLSearchParams(url.split('?')[1] ?? '').get('offset') ?? '0');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (init?.body) writes.push({ url, body: JSON.parse(String(init.body)) as unknown });
      if (url.includes('/rest/v1/rpc/grant_parent_role_with_justification')) {
        return Promise.resolve(jsonResponse(opts.rpc?.status ?? 200, opts.rpc?.body ?? 'granted'));
      }
      // A.2/A.5 (F3-identity-site): Tutors whose own age record says a minor.
      if (url.includes('/rest/v1/rpc/list_minor_record_tutors')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/rpc/revoke_parent_verification')) {
        return Promise.resolve(jsonResponse(opts.rpc?.status ?? 200, opts.rpc?.body ?? 'revoked'));
      }
      if (url.includes('/rest/v1/admin_permissions')) {
        return Promise.resolve(jsonResponse(200, (opts.adminPerms ?? ['manage_users']).map((permission) => ({ permission }))));
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, roles.map((role) => ({ role }))));
      }
      // E.8/E.13: the database's social tier for the renamed account (a kid role is the guardian tier).
      if (url.includes('/rpc/social_tier')) return Promise.resolve(jsonResponse(200, roles.includes('kid') ? 'guardian' : 'adult'));
      if (url.includes('/rest/v1/parent_verifications?')) {
        return Promise.resolve(jsonResponse(200, offset(url) > 0 ? [] : (opts.verificationRows ?? [])));
      }
      if (url.includes('/rest/v1/parent_verifications') && method === 'POST') {
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      if (url.includes('/rest/v1/profiles')) {
        return Promise.resolve(jsonResponse(200, offset(url) > 0 ? [] : [{ user_id: TARGET_ID, display_name: 'Target', username: 'target', locale: 'es-MX', created_at: '2026-01-01T00:00:00Z', birth_date: null }]));
      }
      if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes('/auth/v1/')) return Promise.resolve(jsonResponse(200, {}));
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return writes;
}

describe('admin verification revoke (A.5)', () => {
  it('requires a reason and refuses without manage_users', async () => {
    const writes = stub({ adminPerms: ['view_analytics'] });
    const noGrant = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Fraud report confirmed by two guardians' });
    expect(noGrant.status).toBe(403);
    const writes2 = stub();
    const noReason = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'short' });
    expect(noReason.status).toBe(400);
    expect(writes2.some((w) => w.url.includes('/rest/v1/parent_verifications'))).toBe(false);
    expect(writes.some((w) => w.url.includes('/rest/v1/parent_verifications'))).toBe(false);
  });

  it('writes the revoked row and its audited reason in one database call', async () => {
    const writes = stub();
    const res = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Fraud report confirmed by two guardians' });
    expect(res.status).toBe(200);
    const rpc = writes.find((w) => w.url.includes('/rpc/revoke_parent_verification'));
    expect(rpc?.body).toEqual({ p_user: TARGET_ID, p_actor: ADMIN_ID, p_reason: 'Fraud report confirmed by two guardians' });
    // No second, separately failing write: the function owns both rows.
    expect(writes.some((w) => w.url.includes('/rest/v1/audit_logs') || (w.url.includes('/rest/v1/parent_verifications') && !w.url.includes('?')))).toBe(false);
  });

  it('answers 502, never "revoked", when the database cannot confirm the revocation', async () => {
    stub({ rpc: { status: 500, body: { code: 'XX000', message: 'audit store unavailable' } } });
    const res = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Fraud report confirmed by two guardians' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('answers 404 for an unknown account and 409 when the database refuses the actor', async () => {
    stub({ rpc: { status: 200, body: 'not_found' } });
    const missing = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Fraud report confirmed by two guardians' });
    expect(missing.status).toBe(404);
    stub({ rpc: { status: 403, body: { code: '42501', message: 'PARENT_REVOKE_FORBIDDEN: only staff revoke a verification' } } });
    const refused = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Fraud report confirmed by two guardians' });
    expect(refused.status).toBe(409);
  });
});

describe('parent-role staff grant justification (A.5)', () => {
  it('refuses a parent grant without a justification', async () => {
    const writes = stub({ roles: ['superadmin'] });
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', `Bearer ${superadminToken()}`)
      .send({ userId: TARGET_ID, role: 'parent' });
    expect(res.status).toBe(400);
    expect(writes.some((w) => w.url.includes('/rest/v1/user_roles'))).toBe(false);
  });

  it('commits the role and its justification in one database call', async () => {
    const writes = stub({ roles: ['superadmin'] });
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', `Bearer ${superadminToken()}`)
      .send({ userId: TARGET_ID, role: 'parent', justification: 'Support case: parent lost access to their phone and re-verified in person.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'parent', granted: true });
    const rpc = writes.find((w) => w.url.includes('/rpc/grant_parent_role_with_justification'));
    expect(rpc?.body).toEqual({ p_user: TARGET_ID, p_actor: ADMIN_ID, p_justification: 'Support case: parent lost access to their phone and re-verified in person.' });
    // Never the old two-step: a role insert, then a separately failing audit row.
    expect(writes.some((w) => w.url.includes('/rest/v1/user_roles') || w.url.includes('/rest/v1/audit_logs'))).toBe(false);
  });

  it('answers 502, never "granted", when the grant and its justification cannot be confirmed', async () => {
    stub({ roles: ['superadmin'], rpc: { status: 503, body: null } });
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', `Bearer ${superadminToken()}`)
      .send({ userId: TARGET_ID, role: 'parent', justification: 'Support case: parent re-verified in person.' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('maps the database refusals: a reason out of bounds is 400, a refused actor or trigger is 409', async () => {
    stub({ roles: ['superadmin'], rpc: { status: 400, body: { code: '22023', message: 'PARENT_GRANT_JUSTIFICATION_REQUIRED: a justification of 10-200 characters is required' } } });
    const invalid = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', `Bearer ${superadminToken()}`)
      .send({ userId: TARGET_ID, role: 'parent', justification: '          padded          ' });
    expect(invalid.status).toBe(400);
    stub({ roles: ['superadmin'], rpc: { status: 403, body: { code: '42501', message: 'PARENT_GRANT_FORBIDDEN: only a superadmin grants the parent role' } } });
    const refused = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', `Bearer ${superadminToken()}`)
      .send({ userId: TARGET_ID, role: 'parent', justification: 'Support case: parent re-verified in person.' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('ROLE_REJECTED');
  });
});

describe('admin users list verification projection (A.5)', () => {
  it('distinguishes id-verified, staff-granted, revoked and none', async () => {
    stub({ verificationRows: [
      { user_id: TARGET_ID, status: 'verified', method: 'local-ocr' },
      { user_id: randomUUID(), status: 'verified', method: 'staff-granted' },
    ] });
    const res = await request(createApp()).get('/api/v1/admin/users').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    const user = res.body.data.users.find((u: { userId: string }) => u.userId === TARGET_ID);
    expect(user.verification).toBe('id-verified');
  });
});

describe('A.6 role-branched Settings boundaries', () => {
  it('refuses a kid-role profile username edit', async () => {
    stub({ roles: ['kid'] });
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .send({ username: 'newkidname' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KID_USERNAME_LOCKED');
  });

  it('refuses a kid-role email change and counts the refusal without the address (Appendix M 1.3)', async () => {
    const writes = stub({ roles: ['kid'] });
    const res = await request(createApp())
      .post('/api/v1/auth/change-email')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .send({ newEmail: 'escape@example.com', currentPassword: 'whatever' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KID_EMAIL_FORBIDDEN');
    const audit = writes.find((w) => w.url.includes('/rest/v1/audit_logs'));
    expect(audit?.body).toEqual({ actor_id: KID_ID, action: 'auth.kid_email_change.refused', subject: KID_ID, detail: {} });
    expect(JSON.stringify(writes)).not.toContain('escape@example.com');
  });

  it('still permits a display-name and locale edit for a kid', async () => {
    stub({ roles: ['kid'] });
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .send({ displayName: 'Renamed kid', locale: 'es-MX' });
    expect(res.status).toBe(200);
  });
});
