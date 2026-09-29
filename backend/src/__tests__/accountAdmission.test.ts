import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { readAccountAdmission } from '../middleware/accountAdmission.js';
import { getConfig } from '../config.js';

/*
 * F3-identity-site (A.1 FAQ 'cancelTutor', Appendix M Part 2.1 criterion 2,
 * OD-3 section 2): a paused child is refused on every path, not only on
 * GET /auth/me. Sign-in and refresh are refused (GoTrue's ban, and Core's own
 * re-check after GoTrue answers); an access token minted before the pause is
 * refused ahead of Learn, the Mentor session mint, the Wallet and the other
 * product routers; an unreadable marker is never a pass; a newly verified
 * link (the marker cleared) restores access. A self-registered teen who lost
 * a link is never paused (Option B).
 */

const KID = '22222222-2222-4222-8222-222222222222';
const SESSION = {
  access_token: 'at', refresh_token: 'rt', expires_in: 3600,
  user: { id: KID, email: 'ana_kid@kids.littlefounders.invalid', user_metadata: {} },
};

interface Pause {
  marker?: 'paused' | 'none' | 'unreadable';
  roles?: string[] | null;
  gotrue?: 'ok' | 'banned';
}

function stub(pause: Pause = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url.includes('/rest/v1/profiles?') && url.includes('suspended_at=not.is.null')) {
      const marker = pause.marker ?? 'paused';
      if (marker === 'unreadable') return Promise.resolve(jsonResponse(500, { message: 'down' }));
      return Promise.resolve(jsonResponse(200, marker === 'paused' ? [{ suspended_at: '2026-09-01T00:00:00+00:00' }] : []));
    }
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      if (pause.roles === null) return Promise.resolve(jsonResponse(500, { message: 'down' }));
      return Promise.resolve(jsonResponse(200, (pause.roles ?? ['kid']).map((role) => ({ role }))));
    }
    if (url.includes('/auth/v1/token?grant_type=password')) {
      return Promise.resolve(pause.gotrue === 'banned'
        ? jsonResponse(400, { code: 400, error_code: 'user_banned', msg: 'User is banned' })
        : jsonResponse(200, SESSION));
    }
    if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
      return Promise.resolve(pause.gotrue === 'banned'
        ? jsonResponse(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: User Banned' })
        : jsonResponse(200, SESSION));
    }
    if (url.includes('/auth/v1/admin/users/') || url.includes('/auth/v1/logout')) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    // Anything past the admission check answers "unavailable", so a pass is visible as a non-403.
    return Promise.resolve(jsonResponse(500, { message: 'not stubbed' }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const bearer = () => ({ Authorization: `Bearer ${mintToken({ sub: KID })}` });
const productReads = (calls: string[]) => calls.filter((c) => c.includes('/rest/v1/')
  && !c.includes('suspended_at=not.is.null') && !c.includes('/user_roles?user_id=eq.'));

describe('readAccountAdmission', () => {
  it('is active with no marker, after one read', async () => {
    const calls = stub({ marker: 'none' });
    await expect(readAccountAdmission(KID)).resolves.toBe('active');
    expect(calls).toHaveLength(1);
  });

  it('is suspended for a kid-role account with the marker', async () => {
    stub();
    await expect(readAccountAdmission(KID)).resolves.toBe('suspended');
  });

  it('keeps a self-registered teen active even with the marker (Option B)', async () => {
    stub({ roles: ['universal'] });
    await expect(readAccountAdmission(KID)).resolves.toBe('active');
  });

  it('is unavailable, never active, when the marker or the roles cannot be read', async () => {
    stub({ marker: 'unreadable' });
    await expect(readAccountAdmission(KID)).resolves.toBe('unavailable');
    stub({ roles: null });
    await expect(readAccountAdmission(KID)).resolves.toBe('unavailable');
    await expect(readAccountAdmission('not-a-uuid')).resolves.toBe('unavailable');
  });
});

describe('a paused child is refused on every product path, not only on /auth/me', () => {
  const routes: [string, 'get' | 'post', string][] = [
    ['Learn', 'get', '/api/v1/learn/courses'],
    ['the Mentor session mint', 'post', '/api/v1/tutor/sessions'],
    ['the Wallet', 'get', '/api/v1/wallet/access'],
    ['the banking account', 'get', '/api/v1/banking/account'],
    ['placement', 'get', '/api/v1/placement/financial-education/intake'],
    ['own profile', 'get', '/api/v1/profile'],
    ['tasks', 'get', '/api/v1/tasks'],
    ['cooperative goals', 'get', '/api/v1/coop-goals'],
  ];

  it.each(routes)('refuses %s with 403 ACCOUNT_SUSPENDED before any product read', async (_name, method, path) => {
    const calls = stub();
    const res = await request(createApp())[method](path).set(bearer()).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(productReads(calls)).toEqual([]);
  });

  it.each(routes)('answers 503 on %s when the pause cannot be read (fail closed)', async (_name, method, path) => {
    const calls = stub({ marker: 'unreadable' });
    const res = await request(createApp())[method](path).set(bearer()).send({});
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ACCOUNT_STATE_UNAVAILABLE');
    expect(productReads(calls)).toEqual([]);
  });

  it('lets the route decide once a newly verified link cleared the marker', async () => {
    stub({ marker: 'none' });
    const res = await request(createApp()).get('/api/v1/learn/courses').set(bearer());
    expect(res.body.error?.code).not.toBe('ACCOUNT_SUSPENDED');
    expect(res.status).not.toBe(503);
  });

  it('never reads the marker for a request without a session (public reads stay public, the route answers 401)', async () => {
    const calls = stub();
    const res = await request(createApp()).get('/api/v1/learn/courses');
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('leaves internal-key routes to their key', async () => {
    const calls = stub();
    const res = await request(createApp()).post('/api/v1/tutor/internal/evaluation/run').set(bearer()).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(calls).toEqual([]);
  });
});

describe('Oracle mid-session admission (GET /tutor/internal/admission/:userId)', () => {
  const internal = () => ({ 'x-internal-api-key': getConfig().INTERNAL_API_KEY });
  const path = `/api/v1/tutor/internal/admission/${KID}`;

  it('tells Oracle a paused child is no longer admitted, so a session opened before the pause ends on its next turn', async () => {
    stub();
    const res = await request(createApp()).get(path).set(internal());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ active: false });
  });

  it('answers active with no marker, and for a teen with the marker (Option B)', async () => {
    stub({ marker: 'none' });
    expect((await request(createApp()).get(path).set(internal())).body.data).toEqual({ active: true });
    stub({ roles: ['universal'] });
    expect((await request(createApp()).get(path).set(internal())).body.data).toEqual({ active: true });
  });

  it('answers 503, never active, when the marker or the roles cannot be read', async () => {
    stub({ marker: 'unreadable' });
    const marker = await request(createApp()).get(path).set(internal());
    expect(marker.status).toBe(503);
    expect(marker.body.error.code).toBe('ACCOUNT_STATE_UNAVAILABLE');
    stub({ roles: null });
    expect((await request(createApp()).get(path).set(internal())).status).toBe(503);
  });

  it('refuses a caller without the internal key and a malformed id before any read', async () => {
    const calls = stub();
    expect((await request(createApp()).get(path).set(bearer())).status).toBe(403);
    expect((await request(createApp()).get('/api/v1/tutor/internal/admission/not-a-uuid').set(internal())).status).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe('sign-in and refresh', () => {
  it('answers a GoTrue ban on sign-in with the uniform INVALID_CREDENTIALS (GoTrue checks the ban before the password, E.1)', async () => {
    stub({ gotrue: 'banned' });
    const res = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'ana_kid', password: 'x'.repeat(8) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.data).toBeNull();
  });

  it('hands a paused child no session even where the ban is missing, and revokes every session', async () => {
    const calls = stub();
    const res = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'ana_kid', password: 'x'.repeat(8) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.data).toBeNull();
    expect(calls.some((c) => c.startsWith('DELETE') && c.includes(`/admin/users/${KID}/sessions`))).toBe(true);
  });

  it('ends only the new session and answers 503 when the pause cannot be read at sign-in', async () => {
    const calls = stub({ marker: 'unreadable' });
    const res = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'ana_kid', password: 'x'.repeat(8) });
    expect(res.status).toBe(503);
    expect(res.body.data).toBeNull();
    expect(calls.some((c) => c.includes('/auth/v1/logout?scope=local'))).toBe(true);
    expect(calls.some((c) => c.includes('/admin/users/'))).toBe(false);
  });

  it('refuses a refresh GoTrue bans, naming the pause to the token holder', async () => {
    stub({ gotrue: 'banned' });
    const res = await request(createApp()).post('/api/v1/auth/refresh').send({ refreshToken: 'rt' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('refuses a refresh for a paused child even where the ban is missing', async () => {
    stub();
    const res = await request(createApp()).post('/api/v1/auth/refresh').send({ refreshToken: 'rt' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.data).toBeNull();
  });

  it('restores sign-in and refresh once a newly verified link cleared the marker', async () => {
    stub({ marker: 'none' });
    const login = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'ana_kid', password: 'x'.repeat(8) });
    expect(login.status).toBe(200);
    expect(login.body.data.session.accessToken).toBe('at');
    const refresh = await request(createApp()).post('/api/v1/auth/refresh').send({ refreshToken: 'rt' });
    expect(refresh.status).toBe(200);
  });
});
