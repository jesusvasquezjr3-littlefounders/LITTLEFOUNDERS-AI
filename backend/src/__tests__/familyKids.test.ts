import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * POST /api/v1/family/kids — creating a child account and linking it.
 *
 * The invariant under test is §1.3: "A `kid` account MUST have >= 1 verified
 * guardian link. A kid row without one is a bug, not a state." That makes the
 * ORDER of the writes the safety property, not an implementation detail, so
 * these tests assert the order and the rollback rather than only the happy
 * path.
 */

const KID = {
  displayName: 'Sofía',
  username: 'sofia_2016',
  passphrase: 'a-passphrase-she-can-remember',
  birthDate: '2016-04-09',
  locale: 'es-MX',
};

afterEach(() => vi.unstubAllGlobals());

interface StubOptions {
  /** Existing roles for the CALLER. */
  roles?: string[];
  usernameTaken?: boolean;
  /** The username-existence read does not answer (upstream failure). */
  usernameCheckUnavailable?: boolean;
  /** Kids this parent already has, for the per-family cap. */
  existingKids?: number;
  linkedKidId?: string;
  linkFails?: boolean;
  profilePatchFails?: boolean;
  ageWriteFails?: boolean;
  verification?: 'verified' | 'revoked' | 'missing';
  createStatus?: number;
  calls?: string[];
  writes?: { url: string; method: string; body: unknown }[];
}

const KID_ID = randomUUID();

function stub(opts: StubOptions = {}) {
  const calls = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
      if (opts.writes && init?.body) {
        opts.writes.push({ url, method, body: JSON.parse(String(init.body)) as unknown });
      }

      if (url.includes('/rest/v1/user_roles?user_id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, (opts.roles ?? ['parent']).map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/parent_verifications?')) {
        return Promise.resolve(jsonResponse(200, opts.verification === 'missing' ? [] : [{
          status: opts.verification ?? 'verified', method: 'local-ocr', birth_date: '1990-01-01',
        }]));
      }
      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.') && method === 'GET') {
        const n = opts.existingKids ?? 0;
        const rows = Array.from({ length: n }, (_, i) => ({
          parent_user_id: 'p',
          kid_user_id: i === 0 && opts.linkedKidId ? opts.linkedKidId : randomUUID(),
          verification_status: 'verified',
        }));
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/profiles?username=eq.')) {
        if (opts.usernameCheckUnavailable) return Promise.resolve(jsonResponse(200, null));
        return Promise.resolve(jsonResponse(200, opts.usernameTaken ? [{ user_id: randomUUID() }] : []));
      }
      if (url.includes('/rpc/record_age_declaration')) {
        const body = JSON.parse(String(init?.body));
        return Promise.resolve(jsonResponse(200, opts.ageWriteFails ? null : body.p_age_band));
      }
      if (url.includes('/auth/v1/admin/users') && method === 'POST') {
        if (opts.createStatus && opts.createStatus >= 400) {
          return Promise.resolve(jsonResponse(opts.createStatus, { msg: 'already registered' }));
        }
        return Promise.resolve(jsonResponse(200, { id: KID_ID, email: `${KID.username}@kids.littlefounders.invalid` }));
      }
      if (url.includes('/rest/v1/guardian_links') && method === 'POST') {
        if (opts.linkFails) return Promise.resolve(jsonResponse(500, { message: 'nope' }));
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      if (url.includes('/rest/v1/profiles?user_id=eq.') && method === 'PATCH') {
        if (opts.profilePatchFails) return Promise.resolve(jsonResponse(500, { message: 'nope' }));
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

function post(body: unknown = KID, sub = randomUUID()) {
  return request(createApp())
    .post('/api/v1/family/kids')
    .set('Authorization', `Bearer ${mintToken({ sub })}`)
    // `body` is `unknown` because several tests deliberately post a malformed
    // shape; supertest's .send() only accepts string | object.
    .send(body as string | object);
}

describe('POST /api/v1/family/kids', () => {
  it.each(['missing', 'revoked'] as const)('rejects parent-role grants with %s adult verification before creating a child', async verification => {
    const calls = stub({ verification });
    expect((await post()).status).toBe(403);
    expect(calls.some(c => c.startsWith('POST ') && c.includes('/admin/users'))).toBe(false);
  });
  it('records only the derived band before granting the child role', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ writes });
    expect((await post()).status).toBe(201);
    const age = writes.findIndex(w => w.url.includes('/rpc/record_age_declaration'));
    const role = writes.findIndex(w => w.url.includes('user_roles?on_conflict'));
    expect(writes[age]?.body).toEqual({ p_user_id: KID_ID, p_age_band: 'under_13' });
    expect(role).toBeGreaterThan(age);
  });
  it('rolls back a newly created identity if its age declaration is not acknowledged', async () => {
    const calls = stub({ ageWriteFails: true });
    expect((await post()).status).toBe(502);
    expect(calls.some(c => c.startsWith('DELETE ') && c.includes(`/admin/users/${KID_ID}`))).toBe(true);
    expect(calls.some(c => c.startsWith('POST ') && c.includes('user_roles?on_conflict'))).toBe(false);
  });
  it.each(['2016-02-30', '2999-01-01', 'not-a-date'])('rejects invalid parent-provided date %s before creating an identity', async birthDate => {
    const calls = stub();
    expect((await post({ ...KID, birthDate })).status).toBe(400);
    expect(calls.some(c => c.startsWith('POST ') && c.includes('/admin/users'))).toBe(false);
  });
  it('401s without a session', async () => {
    stub();
    const res = await request(createApp()).post('/api/v1/family/kids').send(KID);
    expect(res.status).toBe(401);
  });

  it('403s a universal account — only a Guardian-verified parent may create a child', async () => {
    stub({ roles: ['universal'] });
    const res = await post();
    expect(res.status).toBe(403);
  });

  it('creates the account, links it as VERIFIED, then grants the role — in that order', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    const calls = stub({ writes });
    const res = await post();

    expect(res.status).toBe(201);
    expect(res.body.data.kid).toMatchObject({ userId: KID_ID, username: 'sofia_2016' });

    // POST only. The per-family cap now READS guardian_links first, and a
    // filter that matched both would put the read where the write belongs.
    const order = calls.filter((c) => /^POST .*(admin\/users|guardian_links|user_roles\?on_conflict)/.test(c));
    const created = order.findIndex((c) => c.includes('admin/users'));
    const linked = order.findIndex((c) => c.includes('guardian_links'));
    const granted = order.findIndex((c) => c.includes('user_roles?on_conflict'));
    expect(created).toBeGreaterThanOrEqual(0);
    // The link must exist before the role: a kid carrying the role with no
    // link is exactly the state §1.3 calls a bug, and the reverse is inert.
    expect(linked).toBeGreaterThan(created);
    expect(granted).toBeGreaterThan(linked);

    const link = writes.find((w) => w.url.includes('guardian_links'));
    expect(link?.body).toMatchObject({ verification_status: 'verified' });
  });

  it('never sends a real mailbox for the child — the address is synthetic and unroutable', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ writes });
    await post();
    const created = writes.find((w) => w.url.includes('admin/users'));
    const body = created?.body as { email: string; email_confirm: boolean };
    // RFC 2606 reserves `.invalid`, so this can never resolve or receive mail.
    expect(body.email).toBe('sofia_2016@kids.littlefounders.invalid');
    expect(body.email_confirm).toBe(true);
  });

  it('rejects a taken username BEFORE creating anything', async () => {
    const calls = stub({ usernameTaken: true });
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_IN_USE');
    expect(calls.some((c) => c.includes('admin/users'))).toBe(false);
  });

  it('signals a taken username with no profile fields — existence only', async () => {
    stub({ usernameTaken: true });
    const res = await post();
    expect(res.status).toBe(409);
    // The conflict is the whole payload: no user_id, display name, role or
    // profile projection rides along for the caller to harvest.
    expect(res.body.data).toBeNull();
    expect(Object.keys(res.body.error)).toContain('code');
  });

  it('fails closed when the username-existence read does not answer', async () => {
    const calls = stub({ usernameCheckUnavailable: true });
    const res = await post();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
    // An unavailable check must never read as "available": no account is
    // created under a name that might already belong to someone.
    expect(calls.some((c) => c.includes('admin/users'))).toBe(false);
  });

  it('deletes the account again when the guardian link cannot be written', async () => {
    const calls = stub({ linkFails: true });
    const res = await post();
    expect(res.status).toBe(502);
    // §1.3: the account must not outlive a failure to link it.
    expect(calls).toContain(`DELETE /auth/v1/admin/users/${KID_ID}`);
    expect(calls.some((c) => c.includes('user_roles?on_conflict'))).toBe(false);
  });

  it('deletes the account again when the profile patch fails, leaving no orphaned verified link', async () => {
    // The identical §1.3 orphan the test above proves for the LINK failure,
    // one step later: `profiles.username` has no NOT NULL constraint
    // (database/migrations/0005_profile_identity.sql), so a bare `if (!profiled)
    // return fail(...)` here — with the guardian link already written and
    // committed — would leave a verified `guardian_links` row pointing at a
    // kid whose profile.username is permanently null. That kid is
    // un-renameable (username is fixed once set) and, on the frontend,
    // unremovable through ManageKidPanel.tsx's "type the username to
    // confirm" gate, since there is no username to type. The auth-user
    // rollback CASCADEs through profiles, user_roles and guardian_links
    // (§1.3), so this must undo the guardian link too, not just the
    // auth user.
    const writes: { url: string; method: string; body: unknown }[] = [];
    const calls = stub({ profilePatchFails: true, writes });
    const res = await post();

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
    // The rollback that already exists for the link-failure branch must ALSO
    // fire here: the auth user (and, by cascade, the guardian_links row and
    // the profile row it just failed to complete) is removed rather than
    // left behind half-created.
    expect(calls).toContain(`DELETE /auth/v1/admin/users/${KID_ID}`);
    expect(calls.some((c) => c.includes('user_roles?on_conflict'))).toBe(false);

    const rollbackAudit = writes.find(
      (w) => w.url.includes('audit_logs') && JSON.stringify(w.body).includes('kid_create.rolled_back'),
    );
    expect(rollbackAudit).toBeDefined();
    expect(rollbackAudit?.body).toMatchObject({
      action: 'family.kid_create.rolled_back',
      detail: { rollbackSucceeded: true, stage: 'profile_patch' },
    });
  });

  it('rejects a username the database would reject, but NORMALISES case', async () => {
    stub();
    // The DB constraint (0005) is `^[a-z0-9_]{3,20}$`, restated at the edge so
    // a bad handle is a 400 with a message rather than a Postgres 409 after an
    // account already exists.
    for (const username of ['ab', 'sofia-2016', 'sofia 2016', 'a'.repeat(21)]) {
      const res = await post({ ...KID, username });
      expect(res.status, username).toBe(400);
    }
    // Case is NOT a rejection. A parent typing their child's name with a
    // capital is not making a mistake, and bouncing them for it would be the
    // kind of friction Duolingo does not impose either.
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ writes });
    const res = await post({ ...KID, username: 'Sofia_2016' });
    expect(res.status).toBe(201);
    expect(res.body.data.kid.username).toBe('sofia_2016');
    const created = writes.find((w) => w.url.includes('admin/users'));
    expect((created?.body as { email: string }).email).toBe('sofia_2016@kids.littlefounders.invalid');
  });

  it('does not write the child’s name or birth date into the audit log', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ writes });
    await post();
    const audit = writes.filter((w) => w.url.includes('audit_logs'));
    expect(audit.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(audit);
    expect(serialized).not.toContain('Sofía');
    expect(serialized).not.toContain('2016-04-09');
    expect(serialized).not.toContain('sofia_2016');
  });

  it('refuses past the per-family ceiling, before creating anything', async () => {
    const calls = stub({ existingKids: 10 });
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('KID_LIMIT_REACHED');
    // Not a product opinion about family size: a bound on what one compromised
    // parent session can mint, since every child is a real account the platform
    // then generates and stores content for (§1.0).
    expect(calls.some((c) => c.includes('admin/users'))).toBe(false);
  });
});

describe('managing an existing child', () => {
  const KID_ID_2 = randomUUID();

  function managed(extra: StubOptions = {}) {
    return stub({ existingKids: 1, linkedKidId: KID_ID_2, ...extra });
  }

  it('404s for a child that is not this caller’s', async () => {
    managed();
    const other = randomUUID();
    for (const req of [
      request(createApp()).patch(`/api/v1/family/kids/${other}`).send({ displayName: 'X' }),
      request(createApp()).post(`/api/v1/family/kids/${other}/passphrase`).send({ passphrase: 'longenough1' }),
      request(createApp()).delete(`/api/v1/family/kids/${other}`),
    ]) {
      const res = await req.set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`);
      // 404 and not 403: asking about someone else's child must not reveal
      // whether that child exists.
      expect(res.status).toBe(404);
    }
  });

  it('renames a child but REFUSES to rename their username', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    managed({ writes });
    const res = await request(createApp())
      .patch(`/api/v1/family/kids/${KID_ID_2}`)
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`)
      .send({ displayName: 'Sofía Ren', username: 'nuevo_handle' });
    expect(res.status).toBe(200);
    const patch = writes.find((w) => w.url.includes('/profiles?user_id=eq.') && w.method === 'PATCH');
    // The auth address is DERIVED from the username, so renaming the handle
    // alone would strand the account at sign-in.
    expect(Object.keys(patch?.body as Record<string, unknown>)).not.toContain('username');
    expect((patch?.body as Record<string, unknown>).display_name).toBe('Sofía Ren');
  });

  it('rotates the passphrase without ever writing it down', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    managed({ writes });
    const res = await request(createApp())
      .post(`/api/v1/family/kids/${KID_ID_2}/passphrase`)
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`)
      .send({ passphrase: 'una-frase-nueva-y-larga' });
    expect(res.status).toBe(200);
    const audit = writes.filter((w) => w.url.includes('audit_logs'));
    expect(audit.length).toBeGreaterThan(0);
    // audit_logs is append-only and staff-readable.
    expect(JSON.stringify(audit)).not.toContain('una-frase-nueva-y-larga');
  });

  it('deletes the account and audits the attempt BEFORE it can fail', async () => {
    const calls = managed();
    const res = await request(createApp())
      .delete(`/api/v1/family/kids/${KID_ID_2}`)
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`);
    expect(res.status).toBe(200);
    const audits = calls.filter((c) => c.includes('audit_logs'));
    const del = calls.findIndex((c) => c === `DELETE /auth/v1/admin/users/${KID_ID_2}`);
    const firstAudit = calls.findIndex((c) => c.includes('audit_logs'));
    expect(audits.length).toBeGreaterThanOrEqual(2);
    // Afterwards there is no row left to name, and a mid-way failure would
    // otherwise leave no trace that it was attempted.
    expect(firstAudit).toBeLessThan(del);
  });
});
