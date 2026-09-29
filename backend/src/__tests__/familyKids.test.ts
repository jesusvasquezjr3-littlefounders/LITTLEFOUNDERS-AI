import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { admissionStubResponse, erasureStubResponse, jsonResponse, mintToken } from './helpers.js';

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
  username: 'sofia_b',
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
  /** Roles of the linked account itself (default: a parent-created child). */
  linkedKidRoles?: string[];
  linkFails?: boolean;
  profilePatchFails?: boolean;
  ageWriteFails?: boolean;
  /** A.4: the band already on record; record_age_declaration answers it (insert-once). */
  storedBand?: string;
  verification?: 'verified' | 'revoked' | 'missing';
  createStatus?: number;
  /** S-06: the linked child's current username (GET /profiles?user_id=in.). */
  currentUsername?: string | null;
  /** S-06: the GoTrue address move answers with this status. */
  emailUpdateStatus?: number;
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
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
      if (opts.writes && init?.body) {
        opts.writes.push({ url, method, body: JSON.parse(String(init.body)) as unknown });
      }

      const erasure = erasureStubResponse(url);
      if (erasure) return Promise.resolve(erasure);
      if (opts.linkedKidId && url.includes(`/rest/v1/user_roles?user_id=eq.${opts.linkedKidId}`) && method === 'GET') {
        // S07.2: the linked account's own roles (a parent-created child holds `kid`).
        return Promise.resolve(jsonResponse(200, (opts.linkedKidRoles ?? ['kid']).map((role) => ({ role }))));
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
      if (url.includes('/rest/v1/profiles?user_id=in.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.currentUsername === undefined ? [] : [{
          user_id: opts.linkedKidId, display_name: 'Sofía', username: opts.currentUsername, birth_date: null,
        }]));
      }
      if (url.includes('/auth/v1/admin/users/') && method === 'PUT' && opts.emailUpdateStatus && opts.emailUpdateStatus >= 400) {
        return Promise.resolve(jsonResponse(opts.emailUpdateStatus, { msg: opts.emailUpdateStatus === 422 ? 'A user with this email address has already been registered' : 'down' }));
      }
      if (url.includes('/rest/v1/profiles?username=eq.')) {
        if (opts.usernameCheckUnavailable) return Promise.resolve(jsonResponse(200, null));
        return Promise.resolve(jsonResponse(200, opts.usernameTaken ? [{ user_id: randomUUID() }] : []));
      }
      if (url.includes('/rpc/record_age_declaration')) {
        const body = JSON.parse(String(init?.body));
        return Promise.resolve(jsonResponse(200, opts.ageWriteFails ? null : opts.storedBand ?? body.p_age_band));
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
  // A.4 / OD-3 (adversarial): a parent-created child is never left without age evidence, so the child is never asked.
  it('refuses a child with neither a birth date nor an age band, before creating an identity', async () => {
    const calls = stub();
    for (const body of [{ ...KID, birthDate: undefined }, { ...KID, birthDate: null }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CHILD_AGE_REQUIRED');
    }
    expect(calls.some(c => c.startsWith('POST ') && c.includes('/admin/users'))).toBe(false);
  });
  it('records a Tutor-chosen band for a child without a birth date, before the role', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ writes });
    expect((await post({ ...KID, birthDate: null, ageBand: '13_to_17' })).status).toBe(201);
    const age = writes.findIndex(w => w.url.includes('/rpc/record_age_declaration'));
    const role = writes.findIndex(w => w.url.includes('user_roles?on_conflict'));
    expect(writes[age]?.body).toEqual({ p_user_id: KID_ID, p_age_band: '13_to_17' });
    expect(role).toBeGreaterThan(age);
  });
  it.each([['adult'], ['nonsense']])('refuses a Tutor band of %s (only under_13 or 13_to_17)', async (ageBand) => {
    const calls = stub();
    expect((await post({ ...KID, birthDate: null, ageBand })).status).toBe(400);
    expect(calls.some(c => c.startsWith('POST ') && c.includes('/admin/users'))).toBe(false);
  });
  it('refuses a band that contradicts the birth date', async () => {
    const calls = stub();
    const res = await post({ ...KID, ageBand: '13_to_17' });
    expect(res.status).toBe(400);
    expect(calls.some(c => c.startsWith('POST ') && c.includes('/admin/users'))).toBe(false);
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
    expect(res.body.data.kid).toMatchObject({ userId: KID_ID, username: 'sofia_b' });

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
    expect(body.email).toBe('sofia_b@kids.littlefounders.invalid');
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
    const res = await post({ ...KID, username: 'Sofia_B' });
    expect(res.status).toBe(201);
    expect(res.body.data.kid.username).toBe('sofia_b');
    const created = writes.find((w) => w.url.includes('admin/users'));
    expect((created?.body as { email: string }).email).toBe('sofia_b@kids.littlefounders.invalid');
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
    expect(serialized).not.toContain('sofia_b');
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

describe('E.13 profile-content review at child creation', () => {
  it.each([
    [{ username: 'ig_sofia' }, ['username']],
    [{ username: 'sofia_2016' }, ['username']],
    [{ displayName: 'Sofía de la calle Reforma' }, ['displayName']],
    [{ username: 'roblox_sofi', displayName: 'Sofi www.sofi.tv' }, ['username', 'displayName']],
  ])('refuses %o before creating any account (fields %o)', async (fields, flagged) => {
    const calls: string[] = [];
    stub({ calls });
    const res = await request(createApp())
      .post('/api/v1/family/kids')
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`)
      .send({ ...KID, ...fields });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'PROFILE_FIELD_UNSAFE', fields: flagged });
    expect(calls.some((c) => c.includes('admin/users') || c.startsWith('POST') || c.startsWith('PATCH'))).toBe(false);
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

  it('refuses every account-holder control for a self-registered teen who linked this parent (S07.2, D.3)', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    const calls = managed({ writes, linkedKidRoles: ['universal'] });
    const bearer = `Bearer ${mintToken({ sub: randomUUID() })}`;
    for (const req of [
      request(createApp()).patch(`/api/v1/family/kids/${KID_ID_2}`).send({ displayName: 'X', birthDate: '2010-01-01' }),
      request(createApp()).post(`/api/v1/family/kids/${KID_ID_2}/passphrase`).send({ passphrase: 'longenough1' }),
      request(createApp()).delete(`/api/v1/family/kids/${KID_ID_2}`),
      request(createApp()).post(`/api/v1/family/kids/${KID_ID_2}/analytics-consent`),
      request(createApp()).delete(`/api/v1/family/kids/${KID_ID_2}/analytics-consent`),
      request(createApp()).post(`/api/v1/family/kids/${KID_ID_2}/guardian-invite`),
    ]) {
      const res = await req.set('Authorization', bearer);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SELF_MANAGED');
    }
    // Nothing reached GoTrue, the profile, the consent table or the invite table.
    expect(calls.some((c) => c.includes('/auth/v1/admin/users'))).toBe(false);
    expect(writes.filter((w) => /profiles|analytics_consents|guardian_invites/.test(w.url))).toEqual([]);
  });

  it('answers 502, never a change, when the linked account type cannot be read', async () => {
    const calls = managed({ linkedKidRoles: undefined });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      if (url.includes(`/rest/v1/user_roles?user_id=eq.${KID_ID_2}`)) return Promise.resolve(jsonResponse(500, { message: 'down' }));
      if (url.includes('/rest/v1/user_roles?user_id=eq.')) return Promise.resolve(jsonResponse(200, [{ role: 'parent' }]));
      if (url.includes('/rest/v1/parent_verifications?')) return Promise.resolve(jsonResponse(200, [{ status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }]));
      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) return Promise.resolve(jsonResponse(200, [{ parent_user_id: 'p', kid_user_id: KID_ID_2, verification_status: 'verified' }]));
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      return Promise.resolve(jsonResponse(200, {}));
    }));
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID_2}`).set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`);
    expect(res.status).toBe(502);
    expect(calls.some((c) => c.includes('/auth/v1/admin/users'))).toBe(false);
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

  it('A.4: records the first age a Tutor gives an existing child, and says so', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    managed({ writes });
    const res = await request(createApp()).patch(`/api/v1/family/kids/${KID_ID_2}`)
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`).send({ ageBand: 'under_13' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ kid: { userId: KID_ID_2 }, ageRecorded: true });
    expect(writes.find(w => w.url.includes('/rpc/record_age_declaration'))?.body).toEqual({ p_user_id: KID_ID_2, p_age_band: 'under_13' });
    expect(writes.some(w => w.url.includes('/profiles?user_id=eq.') && w.method === 'PATCH')).toBe(false);
  });

  it('A.4: a birth date added later records the declaration when none exists yet', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    managed({ writes });
    const res = await request(createApp()).patch(`/api/v1/family/kids/${KID_ID_2}`)
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`).send({ birthDate: '2016-04-09' });
    expect(res.status).toBe(200);
    expect(writes.find(w => w.url.includes('/rpc/record_age_declaration'))?.body).toEqual({ p_user_id: KID_ID_2, p_age_band: 'under_13' });
    expect(writes.find(w => w.url.includes('/profiles?user_id=eq.') && w.method === 'PATCH')?.body).toMatchObject({ birth_date: '2016-04-09' });
  });

  it('A.4: a band-only change of an age already on record is refused (insert-once)', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    managed({ writes, storedBand: 'under_13' });
    const res = await request(createApp()).patch(`/api/v1/family/kids/${KID_ID_2}`)
      .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`).send({ ageBand: '13_to_17' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AGE_ALREADY_RECORDED');
    expect(writes.some(w => w.url.includes('/profiles?user_id=eq.') && w.method === 'PATCH')).toBe(false);
  });

  it('E.13: refuses a display name that would locate the child, before any write', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    managed({ writes });
    for (const displayName of ['Sofía Escuela Juárez', 'sofia@mail.com', 'Sofía 2016', 'Sofía TikTok']) {
      const res = await request(createApp())
        .patch(`/api/v1/family/kids/${KID_ID_2}`)
        .set('Authorization', `Bearer ${mintToken({ sub: randomUUID() })}`)
        .send({ displayName });
      expect(res.status, displayName).toBe(422);
      expect(res.body.error).toMatchObject({ code: 'PROFILE_FIELD_UNSAFE', fields: ['displayName'] });
    }
    expect(writes.some((w) => w.method === 'PATCH')).toBe(false);
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
    // E.6: the child is erased through the shared lifecycle (one database
    // transaction plus Mentor, stored-file and warehouse steps).
    const del = calls.findIndex((c) => c.includes('/rpc/erase_account_data'));
    expect(res.body.data).toMatchObject({ deleted: true, status: 'completed' });
    expect(calls.some((c) => c.includes('/rpc/request_account_deletion'))).toBe(true);
    const firstAudit = calls.findIndex((c) => c.includes('audit_logs'));
    expect(audits.length).toBeGreaterThanOrEqual(2);
    // Afterwards there is no row left to name, and a mid-way failure would
    // otherwise leave no trace that it was attempted.
    expect(firstAudit).toBeLessThan(del);
  });
});

// S-06 (the flagged-handle rename, POST and PUT) is pinned in kidUsernameChange.test.ts:
// one database transaction moves the handle and the sign-in address together.
