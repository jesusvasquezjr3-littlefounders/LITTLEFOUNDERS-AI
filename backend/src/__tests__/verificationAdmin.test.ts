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

  it('audits the reason first and writes the revoked row', async () => {
    const writes = stub();
    const res = await request(createApp())
      .post(`/api/v1/admin/users/${TARGET_ID}/verification/revoke`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reason: 'Fraud report confirmed by two guardians' });
    expect(res.status).toBe(200);
    const audit = writes.find((w) => w.url.includes('/rest/v1/audit_logs'));
    expect(audit?.body).toMatchObject({ action: 'admin.parent_verification.revoked', subject: TARGET_ID });
    const row = writes.find((w) => w.url.includes('/rest/v1/parent_verifications') && !w.url.includes('?'));
    expect(row?.body).toMatchObject({ user_id: TARGET_ID, status: 'revoked', method: 'staff-revoked' });
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

  it('carries the justification into its own audit row', async () => {
    const writes = stub({ roles: ['superadmin'] });
    const res = await request(createApp())
      .post('/api/v1/admin/roles/grant')
      .set('Authorization', `Bearer ${superadminToken()}`)
      .send({ userId: TARGET_ID, role: 'parent', justification: 'Support case: parent lost access to their phone and re-verified in person.' });
    expect(res.status).toBe(200);
    const audit = writes.find((w) => w.url.includes('/rest/v1/audit_logs') && (w.body as { action?: string }).action === 'admin.parent_role_justification');
    expect(audit?.body).toMatchObject({ subject: TARGET_ID });
    expect(JSON.stringify(audit?.body)).toContain('lost access to their phone');
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

  it('refuses a kid-role email change', async () => {
    stub({ roles: ['kid'] });
    const res = await request(createApp())
      .post('/api/v1/auth/change-email')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .send({ newEmail: 'escape@example.com', currentPassword: 'whatever' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KID_EMAIL_FORBIDDEN');
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
