import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const FIELDS = {
  givenNames: 'María Fernanda',
  surnames: 'Gómez Hernández',
  birthDate: '1988-02-14',
  address: 'Av Siempre Viva 742, Col Centro',
};

afterEach(() => vi.unstubAllGlobals());

interface StubOptions {
  existingRoles?: string[];
  verdict?: { verified: boolean; checks: Record<string, boolean> };
  guardianStatus?: number;
  calls?: string[];
  /** Bodies of every service-role write, so a test can assert what is stored. */
  writes?: { url: string; body: unknown }[];
}

function stubBackends(opts: StubOptions = {}) {
  const calls: string[] = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.startsWith('http://guardian.test/')) {
        if (opts.guardianStatus && opts.guardianStatus >= 400) {
          return Promise.resolve(jsonResponse(opts.guardianStatus, { data: null, error: { code: 'X', message: 'x' } }));
        }
        return Promise.resolve(jsonResponse(200, { data: opts.verdict ?? { verified: true, checks: {} }, error: null }));
      }
      if (url.includes('/rest/v1/user_roles?user_id=eq.') && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(jsonResponse(200, (opts.existingRoles ?? []).map((role) => ({ role }))));
      }
      // service-role writes: parent_verifications, user_roles insert, audit_logs
      if (opts.writes && init?.body) {
        opts.writes.push({ url, body: JSON.parse(String(init.body)) as unknown });
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

function post(token: string, fields: Record<string, string> = FIELDS, attachFile = true) {
  const req = request(createApp()).post('/api/v1/verification/parent').set('Authorization', `Bearer ${token}`);
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  if (attachFile) req.attach('document', PNG_1PX, { filename: 'id.png', contentType: 'image/png' });
  return req;
}

describe('POST /api/v1/verification/parent', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post('/api/v1/verification/parent');
    expect(res.status).toBe(401);
  });

  it('400s without the document image', async () => {
    stubBackends();
    const res = await post(mintToken(), FIELDS, false);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects minors at the edge', async () => {
    stubBackends();
    const res = await post(mintToken(), { ...FIELDS, birthDate: '2015-01-01' });
    expect(res.status).toBe(400);
  });

  it('verified verdict → stores the record and grants parent', async () => {
    const calls = stubBackends({ verdict: { verified: true, checks: { nameMatch: true } } });
    const res = await post(mintToken({ sub: randomUUID() }));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ verified: true, role: 'parent' });
    expect(calls.some((c) => c.startsWith('POST http://supabase.test/rest/v1/parent_verifications'))).toBe(true);
    expect(calls.some((c) => c.startsWith('POST http://supabase.test/rest/v1/user_roles'))).toBe(true);
  });

  it('unverified verdict → 200 with checks, audit entry, NO role grant', async () => {
    const calls = stubBackends({ verdict: { verified: false, checks: { nameMatch: false, notExpired: true } } });
    const res = await post(mintToken({ sub: randomUUID() }));
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.checks.nameMatch).toBe(false);
    expect(calls.some((c) => c.includes('/rest/v1/audit_logs'))).toBe(true);
    expect(calls.some((c) => c.startsWith('POST http://supabase.test/rest/v1/user_roles'))).toBe(false);
  });

  it('409s when the account is already a parent', async () => {
    stubBackends({ existingRoles: ['universal', 'parent'] });
    const res = await post(mintToken({ sub: randomUUID() }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_VERIFIED');
  });

  it('502s (never fails open) when Guardian is down', async () => {
    stubBackends({ guardianStatus: 500 });
    const res = await post(mintToken({ sub: randomUUID() }));
    expect(res.status).toBe(502);
  });

  it('passes DOCUMENT_UNREADABLE through as 422', async () => {
    stubBackends({ guardianStatus: 422 });
    const res = await post(mintToken({ sub: randomUUID() }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DOCUMENT_UNREADABLE');
  });

  it('rate-limits after 5 attempts for the same user', async () => {
    stubBackends({ verdict: { verified: false, checks: {} } });
    const sub = randomUUID();
    for (let i = 0; i < 5; i++) {
      const okRes = await post(mintToken({ sub }));
      expect(okRes.status).toBe(200);
    }
    const res = await post(mintToken({ sub }));
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  /*
   * A HOME ADDRESS MUST NOT SURVIVE THE REQUEST. It used to be `required`,
   * validated and persisted - and never forwarded to Guardian, which verifies
   * exactly four things (documentReadable, nameMatch, birthDateMatch,
   * notExpired) and has no occurrence of the word in its source. Nothing ever
   * read the column back. That is write-only PII on the one screen whose most
   * prominent element is a promise about what we do not keep (§1.9), and it sat
   * in a table whose own contract (migration 0004) says only data MATCHED
   * AGAINST THE DOCUMENT lands there.
   *
   * The field is still SENT here on purpose: dropping it from the form is not
   * the guarantee. The guarantee is that a client which supplies one - an old
   * cached bundle, a curl, a probe - still cannot get it stored.
   */
  it('never stores a home address, even when the client sends one', async () => {
    const writes: { url: string; body: unknown }[] = [];
    stubBackends({ writes });
    const res = await post(mintToken({ sub: randomUUID() }));
    expect(res.status).toBe(200);

    const stored = writes.filter((w) => w.url.includes('/parent_verifications'));
    expect(stored.length).toBe(1);
    expect(Object.keys(stored[0]!.body as Record<string, unknown>)).not.toContain('address');
    expect(JSON.stringify(writes)).not.toContain('Siempre Viva');
  });
});
