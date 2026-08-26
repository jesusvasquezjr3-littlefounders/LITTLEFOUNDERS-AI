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
  linkFails?: boolean;
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
      if (url.includes('/rest/v1/profiles?username=eq.')) {
        return Promise.resolve(jsonResponse(200, opts.usernameTaken ? [{ user_id: randomUUID() }] : []));
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
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

function post(body: unknown = KID, sub = randomUUID()) {
  return request(createApp())
    .post('/api/v1/family/kids')
    .set('Authorization', `Bearer ${mintToken({ sub })}`)
    .send(body);
}

describe('POST /api/v1/family/kids', () => {
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

    const order = calls.filter((c) => /admin\/users|guardian_links|user_roles\?on_conflict/.test(c));
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

  it('deletes the account again when the guardian link cannot be written', async () => {
    const calls = stub({ linkFails: true });
    const res = await post();
    expect(res.status).toBe(502);
    // §1.3: the account must not outlive a failure to link it.
    expect(calls).toContain(`DELETE /auth/v1/admin/users/${KID_ID}`);
    expect(calls.some((c) => c.includes('user_roles?on_conflict'))).toBe(false);
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
});
