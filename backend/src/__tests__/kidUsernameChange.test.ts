import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S-06 (owner decision OD-28): PUT /api/v1/family/kids/:kidId/username.
 *
 * A verified Tutor may change the username of their linked, parent-created
 * child when the CURRENT handle is flagged (E.13). The rename itself, the
 * sign-in address derived from it and the audit row are one database
 * transaction (guardian_rename_flagged_child, proven against PostgreSQL by
 * database/scripts/verify-kid-username-change-postgres.py); these tests pin
 * Core's boundary: who reaches that call at all, what reaches it, how each
 * refusal is answered, and that the child's sessions end afterwards.
 */

const PARENT = randomUUID();
const KID = randomUUID();
afterEach(() => vi.unstubAllGlobals());

interface Stub {
  callerRoles?: string[];
  verification?: 'verified' | 'revoked' | 'missing';
  linkedKids?: string[];
  kidRoles?: string[];
  rpc?: { ok: true; body: unknown } | { ok: false; message: string };
  revocationFails?: boolean;
}

function stub(opts: Stub = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) as unknown : null });
    if (url.includes(`/rest/v1/user_roles?user_id=eq.${KID}`)) {
      return Promise.resolve(jsonResponse(200, (opts.kidRoles ?? ['kid']).map((role) => ({ role }))));
    }
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      return Promise.resolve(jsonResponse(200, (opts.callerRoles ?? ['parent']).map((role) => ({ role }))));
    }
    if (url.includes('/rest/v1/parent_verifications?')) {
      return Promise.resolve(jsonResponse(200, opts.verification === 'missing' ? [] : [{
        status: opts.verification ?? 'verified', method: 'local-ocr', birth_date: '1990-01-01',
      }]));
    }
    if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
      return Promise.resolve(jsonResponse(200, (opts.linkedKids ?? [KID]).map((kid) => ({
        parent_user_id: PARENT, kid_user_id: kid, verification_status: 'verified',
      }))));
    }
    if (url.includes('/rpc/guardian_rename_flagged_child')) {
      const rpc = opts.rpc ?? { ok: true, body: 'sofia_b' };
      return Promise.resolve(rpc.ok ? jsonResponse(200, rpc.body) : jsonResponse(400, { code: 'P0001', message: rpc.message }));
    }
    if (url.includes(`/auth/v1/admin/users/${KID}/sessions`) && method === 'DELETE') {
      return Promise.resolve(opts.revocationFails ? jsonResponse(500, { msg: 'down' }) : new Response(null, { status: 204 }));
    }
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

const put = (body: unknown, kidId: string = KID, sub: string = PARENT) => request(createApp())
  .put(`/api/v1/family/kids/${kidId}/username`)
  .set('Authorization', `Bearer ${mintToken({ sub })}`)
  .send(body as object);
const renamed = (calls: { url: string }[]) => calls.some((c) => c.url.includes('/rpc/guardian_rename_flagged_child'));

describe('S-06 a verified Tutor changes a flagged child username (OD-28)', () => {
  it('renames through one database call, ends the child sessions, and leaves the audit row to the database', async () => {
    const calls = stub();
    const res = await put({ username: '  Sofia_B ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ kid: { userId: KID, username: 'sofia_b' }, sessionsEnded: true });
    const rpc = calls.find((c) => c.url.includes('/rpc/guardian_rename_flagged_child'));
    expect(rpc?.body).toEqual({ p_guardian: PARENT, p_kid: KID, p_username: 'sofia_b' });
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes(`/admin/users/${KID}/sessions`))).toBe(true);
    // The rename's audit row is written inside the same transaction; Core adds none.
    expect(calls.some((c) => c.url.includes('/audit_logs'))).toBe(false);
    // The admin email API is never used: the address changes with the handle, atomically.
    expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/admin/users/'))).toBe(false);
  });

  it('reports sessions it could not end, and records that, without undoing the rename', async () => {
    const calls = stub({ revocationFails: true });
    const res = await put({ username: 'sofia_b' });
    expect(res.status).toBe(200);
    expect(res.body.data.sessionsEnded).toBe(false);
    const audit = calls.find((c) => c.url.includes('/audit_logs'));
    expect(audit?.body).toEqual({ actor_id: PARENT, action: 'family.kid_username_sessions_not_ended', subject: KID, detail: {} });
  });

  it('refuses without a session', async () => {
    const calls = stub();
    expect((await request(createApp()).put(`/api/v1/family/kids/${KID}/username`).send({ username: 'sofia_b' })).status).toBe(401);
    expect(renamed(calls)).toBe(false);
  });

  it.each([
    ['a learner (no parent role)', { callerRoles: ['universal'] }, 403, 'FORBIDDEN'],
    ['the child itself', { callerRoles: ['kid'] }, 403, 'FORBIDDEN'],
    ['a parent whose adult verification lapsed', { verification: 'revoked' as const }, 403, 'PARENT_VERIFICATION_REQUIRED'],
    ['a parent never verified', { verification: 'missing' as const }, 403, 'PARENT_VERIFICATION_REQUIRED'],
    ['a verified parent of another child', { linkedKids: [randomUUID()] }, 404, 'NOT_FOUND'],
    ['a verified parent with no children', { linkedKids: [] }, 404, 'NOT_FOUND'],
    ['the linked guardian of a self-registered teen', { kidRoles: ['universal'] }, 403, 'ACCOUNT_SELF_MANAGED'],
  ])('refuses %s before the database is asked', async (_label, opts, status, code) => {
    const calls = stub(opts as Stub);
    const res = await put({ username: 'sofia_b' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(renamed(calls)).toBe(false);
  });

  it('refuses a malformed child id', async () => {
    const calls = stub();
    expect((await put({ username: 'sofia_b' }, 'not-a-uuid')).status).toBe(400);
    expect(renamed(calls)).toBe(false);
  });

  it.each([
    ['too short', { username: 'ab' }],
    ['too long', { username: 'a'.repeat(21) }],
    ['a space inside', { username: 'sofia b' }],
    ['punctuation', { username: 'sofia.b' }],
    ['missing', {}],
    ['a forged extra field', { username: 'sofia_b', kidId: randomUUID() }],
    ['a non-string', { username: 42 }],
  ])('refuses a handle that is %s before the database is asked', async (_label, body) => {
    const calls = stub();
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(renamed(calls)).toBe(false);
  });

  it.each(['sofia2016', 'sofia_ig', 'sofia_tiktok'])('refuses a new handle that is itself flagged (%s) with the E.13 answer', async (username) => {
    const calls = stub();
    const res = await put({ username });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'PROFILE_FIELD_UNSAFE', fields: ['username'] });
    expect(renamed(calls)).toBe(false);
  });

  it.each([
    ['USERNAME_NOT_FLAGGED', 409, 'USERNAME_NOT_FLAGGED'],
    ['USERNAME_IN_USE', 409, 'USERNAME_IN_USE'],
    ['USERNAME_UNCHANGED', 409, 'USERNAME_UNCHANGED'],
    ['NOT_GUARDIAN', 404, 'NOT_FOUND'],
    ['ACCOUNT_SELF_MANAGED', 403, 'ACCOUNT_SELF_MANAGED'],
    ['PROFILE_FIELD_UNSAFE', 422, 'PROFILE_FIELD_UNSAFE'],
    ['SIGN_IN_IDENTIFIER_MISMATCH', 409, 'SUPPORT_REQUIRED'],
    ['something unexpected', 502, 'DATA_UNAVAILABLE'],
  ])('answers the database refusal %s and ends no session', async (message, status, code) => {
    const calls = stub({ rpc: { ok: false, message } });
    const res = await put({ username: 'sofia_b' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('never trusts an answer that is not the handle it asked for', async () => {
    stub({ rpc: { ok: true, body: 'someone_else' } });
    expect((await put({ username: 'sofia_b' })).status).toBe(502);
  });
});
