import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { yearsOld } from '../routes/auth.js';
import { accountRateLimiter, authRateLimiter } from '../middleware/rateLimit.js';
import { jsonResponse, mintToken } from './helpers.js';

const SESSION = {
  access_token: 'at',
  refresh_token: 'rt',
  expires_in: 3600,
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', user_metadata: { display_name: 'Ana' } },
};

afterEach(() => vi.unstubAllGlobals());

// This file alone drives more than authRateLimiter's max=10/15min through
// every auth route sharing one process-lifetime MemoryStore — reset the
// loopback key after every test so request count never leaks between tests.
// accountRateLimiter (/signup, /guest) has its own separate store/key space
// and needs the same reset.
afterEach(() => {
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    void authRateLimiter.resetKey(key);
    void accountRateLimiter.resetKey(key);
  }
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, confirmedAgeWrite = true) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/rpc/record_age_declaration')) {
      const payload = JSON.parse(String(init?.body));
      expect(Object.keys(payload).sort()).toEqual(['p_age_band', 'p_user_id']);
      return Promise.resolve(jsonResponse(200, confirmedAgeWrite ? payload.p_age_band : null));
    }
    return Promise.resolve(handler(String(input), init));
  }));
}

describe('POST /api/v1/auth/signup', () => {
  it('withholds the new session if its age declaration cannot be stored', async () => {
    stubFetch(() => jsonResponse(200, SESSION), false);
    const res = await request(createApp()).post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana', birthDate: '2000-01-01' });
    expect(res.status).toBe(502);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
  it('creates a session (autoconfirm on)', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://supabase.test/auth/v1/signup');
      return jsonResponse(200, SESSION);
    });
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana', locale: 'es-MX', parentIntent: true, birthDate: '1990-05-14' });
    expect(res.status).toBe(201);
    expect(res.body.data.session.accessToken).toBe('at');
    expect(res.body.data.confirmationRequired).toBe(false);
  });

  it('flags confirmationRequired when GoTrue returns no session (prod autoconfirm off)', async () => {
    stubFetch(() => jsonResponse(200, { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' }));
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana', birthDate: '1990-05-14' });
    expect(res.status).toBe(201);
    expect(res.body.data.session).toBeNull();
    expect(res.body.data.confirmationRequired).toBe(true);
  });

  /*
   * Regression: /signup used to share authRateLimiter's 10-req/15-min budget
   * with every other auth route on the same IP, including /login and
   * /refresh — a shared-IP network (a school, an office, a QA cluster) could
   * exhaust it on OTHER people's traffic before a first-time visitor's own
   * signup attempt ever landed. It now has its own accountRateLimiter
   * (max=30), so more than the old ceiling of 10 must still succeed here.
   */
  it('tolerates more than the old shared budget of 10 requests from one IP', async () => {
    stubFetch(() => jsonResponse(200, SESSION));
    for (let i = 0; i < 15; i += 1) {
      const res = await request(createApp())
        .post('/api/v1/auth/signup')
        .send({ email: `ana${i}@example.com`, password: 'longenough1', displayName: 'Ana', birthDate: '1990-05-14' });
      expect(res.status).toBe(201);
    }
  });

  /*
   * THE AGE SCREEN. The route used to assert in a comment that a fresh signup
   * is "an adult account by construction" because the DB trigger makes it
   * `universal` - which is a fact about our vocabulary, not about the person
   * typing. A child could hand us a name and an email, which is exactly the
   * collection COPPA is about.
   */
  it('refuses to create an account for a child, and says so with its own code', async () => {
    const spy = vi.fn();
    stubFetch(spy);
    const born = new Date(Date.now() - 9 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'nine@example.com', password: 'longenough1', displayName: 'Nine', birthDate: born });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AGE_RESTRICTED');
    // Nothing was created: the address never reached GoTrue.
    expect(spy).not.toHaveBeenCalled();
  });

  /*
   * THE BOUNDARY IS A CALENDAR DATE, SO THE FIXTURE MUST BE ONE.
   *
   * The test above builds its date with `9 * 365.25 * 24 * 3600 * 1000` - the
   * same expression the implementation used to divide by. A nine-year-old is
   * four years from the boundary so it passed anyway, but it could never have
   * failed: written in the units of the code under test, it agreed with the bug
   * by construction. That is the reason this gate is exercised HERE, against
   * `yearsOld` directly, with dates built by UTC calendar arithmetic.
   *
   * The sweep is 1461 days - four years, so every leap-day alignment of a
   * thirteen-year window is covered - and each is evaluated at 00:00 UTC, the
   * first instant of the birthday and the hardest case. Against the previous
   * `/ (365.25 days)` implementation the first of these fails on 1095 of the
   * 1460 days it asserts on - 75.0% - while the second passes on every one,
   * because the drift only ever ran conservative.
   */
  const utcDay = (y: number, m: number, d: number) => Date.UTC(y, m, d);
  const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const SWEEP_DAYS = 1461;

  /*
   * "Thirteen years before this date" does not exist for 29 February: the year
   * thirteen back is never a leap year, and `Date.UTC(y, 1, 29)` silently rolls
   * to 1 March rather than refusing. Asserting on the rolled date would test the
   * claim that somebody born 1 March turns 13 on 29 February, which is false -
   * the first draft of this sweep did exactly that and the implementation was
   * right to disagree. Returns null for the days that have no counterpart.
   */
  const bornExactly = (yearsBefore: number, now: number, dayOffset = 0): string | null => {
    const at = new Date(now);
    const ms = utcDay(at.getUTCFullYear() - yearsBefore, at.getUTCMonth(), at.getUTCDate() + dayOffset);
    const born = new Date(ms);
    const intended = new Date(utcDay(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + dayOffset));
    if (born.getUTCMonth() !== intended.getUTCMonth() || born.getUTCDate() !== intended.getUTCDate()) return null;
    return isoOf(ms);
  };

  it('counts a thirteenth birthday as 13 from its first instant, for four years of alignments', () => {
    const wrong: string[] = [];
    for (let i = 0; i < SWEEP_DAYS; i += 1) {
      const now = utcDay(2026, 0, 1) + i * 86_400_000;
      const born = bornExactly(13, now);
      if (born === null) continue;
      if (yearsOld(born, now) !== 13) wrong.push(`${born} at ${isoOf(now)} -> ${yearsOld(born, now)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('still counts 12 on the day before, so no under-13 is ever admitted', () => {
    const wrong: string[] = [];
    for (let i = 0; i < SWEEP_DAYS; i += 1) {
      const now = utcDay(2026, 0, 1) + i * 86_400_000;
      const born = bornExactly(13, now, 1);
      if (born === null) continue;
      if (yearsOld(born, now) !== 12) wrong.push(`${born} at ${isoOf(now)} -> ${yearsOld(born, now)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('does not drift with the hour of the day', () => {
    const born = '2013-08-27';
    for (const hour of [0, 3, 6, 9, 12, 18, 23]) {
      expect(yearsOld(born, utcDay(2026, 7, 27) + hour * 3_600_000)).toBe(13);
      expect(yearsOld(born, utcDay(2026, 7, 26) + hour * 3_600_000)).toBe(12);
    }
  });

  it('requires a date of birth at all', async () => {
    const spy = vi.fn();
    stubFetch(spy);
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana' });
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('never forwards the date of birth to GoTrue — it screens and is discarded', async () => {
    let sent: unknown = null;
    stubFetch((_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body ?? '{}'));
      return jsonResponse(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' } });
    });
    await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana', birthDate: '1990-05-14' });
    expect(JSON.stringify(sent)).not.toContain('1990-05-14');
  });

  // S-04 (OD-28): a teen's birth month is kept with the first declaration; a sent month must match the date.
  it('keeps a teen birth month, never forwards it to GoTrue, and refuses a mismatched month first', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      calls.push({ url: String(input), body });
      if (String(input).includes('/rpc/record_age_declaration')) return Promise.resolve(jsonResponse(200, body.p_age_band));
      return Promise.resolve(jsonResponse(200, SESSION));
    }));
    const teen = { email: 'teo@example.com', password: 'longenough1', displayName: 'Teo', birthDate: '2011-05-14' };
    const bad = await request(createApp()).post('/api/v1/auth/signup').send({ ...teen, birthMonth: '2011-06' });
    expect(bad.status).toBe(400);
    expect(calls).toEqual([]);
    const res = await request(createApp()).post('/api/v1/auth/signup').send({ ...teen, birthMonth: '2011-05' });
    expect(res.status).toBe(201);
    const signup = calls.find((c) => c.url.endsWith('/auth/v1/signup'));
    expect(JSON.stringify(signup?.body)).not.toMatch(/2011-05/);
    expect(calls.find((c) => c.url.includes('/rpc/record_age_declaration'))?.body)
      .toEqual({ p_user_id: SESSION.user.id, p_age_band: '13_to_17', p_birth_month: '2011-05-01' });
  });

  it('rejects a short password without calling GoTrue', async () => {
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'short', displayName: 'Ana' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps "already registered" to EMAIL_IN_USE', async () => {
    stubFetch(() => jsonResponse(422, { msg: 'User already registered' }));
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana', birthDate: '1990-05-14' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });
});

describe('POST /api/v1/auth/guest', () => {
  it.each([true, false])('returns an age-refusal session only after confirmed provenance: %s', async (confirmed) => {
    const calls: string[] = [];
    stubFetch((url, init) => {
      calls.push(url);
      if (url.includes('/auth/v1/signup')) return jsonResponse(200, SESSION);
      expect(url).toContain('/rpc/mark_under13_origin');
      expect(JSON.parse(String(init?.body))).toEqual({ p_user_id: SESSION.user.id });
      return jsonResponse(200, confirmed);
    });
    const res = await request(createApp()).post('/api/v1/auth/guest').send({ under13Origin: true });
    expect(res.status).toBe(confirmed ? 201 : 502);
    expect(calls).toHaveLength(2);
    if (!confirmed) expect(res.body.data).toBeNull();
  });

  it('rejects attempts to attach a refused birth date or clear an origin flag', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const body of [{ birthDate: '2018-01-01' }, { under13Origin: false }]) {
      const res = await request(createApp()).post('/api/v1/auth/guest').send(body);
      expect(res.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('creates a guest session by relaying GoTrue anonymous sign-in', async () => {
    stubFetch((url, init) => {
      expect(url).toBe('http://supabase.test/auth/v1/signup');
      expect(JSON.parse(String(init?.body))).toEqual({ data: {} });
      return jsonResponse(200, {
        access_token: 'guest-at',
        refresh_token: 'guest-rt',
        expires_in: 3600,
        user: { id: '22222222-2222-4222-8222-222222222222', email: null, is_anonymous: true },
      });
    });
    const res = await request(createApp()).post('/api/v1/auth/guest').send({});
    expect(res.status).toBe(201);
    expect(res.body.data.session.accessToken).toBe('guest-at');
    expect(res.body.data.session.user.email).toBeNull();
  });
});

describe('POST /api/v1/auth/upgrade', () => {
  it('409s NOT_A_GUEST for an already-permanent account, without calling GoTrue', async () => {
    const token = mintToken({ is_anonymous: false });
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp())
      .post('/api/v1/auth/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ana@example.com', password: 'longenough1', refreshToken: 'rt' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_A_GUEST');
    expect(spy).not.toHaveBeenCalled();
  });

  it('attaches a permanent identity in place and returns a refreshed session', async () => {
    const token = mintToken({ sub: '33333333-3333-4333-8333-333333333333', is_anonymous: true });
    stubFetch((url) => {
      if (url === 'http://supabase.test/auth/v1/user') {
        return jsonResponse(200, { id: '33333333-3333-4333-8333-333333333333', email: 'ana@example.com', is_anonymous: false });
      }
      expect(url).toBe('http://supabase.test/auth/v1/token?grant_type=refresh_token');
      return jsonResponse(200, {
        access_token: 'upgraded-at',
        refresh_token: 'upgraded-rt',
        expires_in: 3600,
        user: { id: '33333333-3333-4333-8333-333333333333', email: 'ana@example.com', is_anonymous: false },
      });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ana@example.com', password: 'longenough1', refreshToken: 'old-rt' });
    expect(res.status).toBe(200);
    expect(res.body.data.session.accessToken).toBe('upgraded-at');
  });

  it('401s without a token', async () => {
    const res = await request(createApp())
      .post('/api/v1/auth/upgrade')
      .send({ email: 'ana@example.com', password: 'longenough1', refreshToken: 'rt' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns the session envelope', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://supabase.test/auth/v1/token?grant_type=password');
      return jsonResponse(200, SESSION);
    });
    const res = await request(createApp()).post('/api/v1/auth/login').send({ email: 'ana@example.com', password: 'x'.repeat(8) });
    expect(res.status).toBe(200);
    expect(res.body.data.session.user.email).toBe('ana@example.com');
  });

  it('maps invalid credentials to 401 INVALID_CREDENTIALS', async () => {
    stubFetch(() => jsonResponse(400, { error_description: 'Invalid login credentials' }));
    const res = await request(createApp()).post('/api/v1/auth/login').send({ email: 'ana@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('answers an unknown handle and a wrong passphrase with the same 401 INVALID_CREDENTIALS', async () => {
    stubFetch((url, init) => {
      expect(url).toBe('http://supabase.test/auth/v1/token?grant_type=password');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'somekid@kids.littlefounders.invalid', password: 'guess' });
      return jsonResponse(400, { error_description: 'Invalid login credentials' });
    });
    const probe = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'somekid', password: 'guess' });

    stubFetch(() => jsonResponse(400, { error_description: 'Invalid login credentials' }));
    const wrong = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'somekid', password: 'wrong' });

    // A username probe and a password mistake are indistinguishable at the API
    // boundary: same status, same code, same null data.
    expect(probe.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(probe.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(probe.body.data).toBeNull();
  });

  it('normalises the case of a handle before deriving its synthetic address', async () => {
    stubFetch((url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'anakid@kids.littlefounders.invalid', password: 'x'.repeat(8) });
      return jsonResponse(200, SESSION);
    });
    const res = await request(createApp()).post('/api/v1/auth/login').send({ identifier: 'AnaKid', password: 'x'.repeat(8) });
    expect(res.status).toBe(200);
  });

  it.each(['ab', 'a'.repeat(21), 'with space', 'a-b', 'a.b'])('refuses a non-email identifier that cannot be a handle (%j) before any auth lookup', async (identifier) => {
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp()).post('/api/v1/auth/login').send({ identifier, password: 'x'.repeat(8) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('401s on a dead refresh token', async () => {
    stubFetch(() => jsonResponse(400, { error_description: 'Invalid Refresh Token' }));
    const res = await request(createApp()).post('/api/v1/auth/refresh').send({ refreshToken: 'dead' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('401s without a token', async () => {
    const res = await request(createApp()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401s on a tampered token', async () => {
    const res = await request(createApp())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${mintToken()}x`);
    expect(res.status).toBe(401);
  });

  it('returns user + profile + roles (RLS-scoped fetches)', async () => {
    const token = mintToken({ sub: '99999999-9999-4999-8999-999999999999', email: 'ana@example.com' });
    stubFetch((url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${token}`); // user token, not service key
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse(200, [{ user_id: '99999999-9999-4999-8999-999999999999', display_name: 'Ana', locale: 'es-MX', theme: 'system' }]);
      }
      return jsonResponse(200, [{ role: 'universal' }, { role: 'parent' }]);
    });
    const res = await request(createApp()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.display_name).toBe('Ana');
    expect(res.body.data.roles).toEqual(['universal', 'parent']);
    expect(res.body.data.adminPermissions).toEqual([]);
  });

  it('returns only the current staff member’s own grants for navigation', async () => {
    const userId = '99999999-9999-4999-8999-999999999999';
    const token = mintToken({ sub: userId, email: 'staff@example.com' });
    let grantReads = 0;
    stubFetch((url, init) => {
      if (url.includes('/rest/v1/profiles')) return jsonResponse(200, []);
      if (url.includes('/rest/v1/user_roles')) return jsonResponse(200, [{ role: 'admin' }]);
      if (url.includes('/rest/v1/admin_permissions')) {
        grantReads++;
        expect(url).toContain(`user_id=eq.${userId}`);
        expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
        return jsonResponse(200, [{ permission: 'manage_users' }]);
      }
      return jsonResponse(200, []);
    });
    const res = await request(createApp()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.adminPermissions).toEqual(['manage_users']);
    expect(grantReads).toBe(1);
  });

  it('reports isGuest:true for a guest (anonymous) session', async () => {
    const token = mintToken({ sub: '99999999-9999-4999-8999-999999999998', is_anonymous: true });
    stubFetch((url) => {
      if (url.includes('/rest/v1/profiles')) {
        return jsonResponse(200, [{ user_id: '99999999-9999-4999-8999-999999999998', display_name: '', locale: 'es-MX', theme: 'system' }]);
      }
      return jsonResponse(200, [{ role: 'universal' }]);
    });
    const res = await request(createApp()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isGuest).toBe(true);
  });
});

describe('GET /api/v1/auth/oauth', () => {
  it('lists only the providers GoTrue has enabled', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://supabase.test/auth/v1/settings');
      return jsonResponse(200, { external: { google: true, github: false } });
    });
    const res = await request(createApp()).get('/api/v1/auth/oauth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data.providers).toEqual(['google']);
  });

  it('lists no providers when none are enabled', async () => {
    stubFetch(() => jsonResponse(200, { external: { google: false } }));
    const res = await request(createApp()).get('/api/v1/auth/oauth/providers');
    expect(res.body.data.providers).toEqual([]);
  });

  it('builds the GoTrue authorize URL for google with the /auth/callback redirect', async () => {
    const res = await request(createApp()).get('/api/v1/auth/oauth/google');
    expect(res.status).toBe(200);
    const url = new URL(res.body.data.url);
    expect(url.origin + url.pathname).toBe('http://supabase.test/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toContain('/auth/callback');
  });

  it('forces the Google account chooser (prompt=select_account) so multi-account browsers get to pick', async () => {
    const res = await request(createApp()).get('/api/v1/auth/oauth/google');
    const url = new URL(res.body.data.url);
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('rejects an unsupported provider without touching GoTrue', async () => {
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp()).get('/api/v1/auth/oauth/facebook');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/recover', () => {
  it('always answers sent:true — never reveals whether the address exists', async () => {
    stubFetch((url, init) => {
      const u = new URL(url);
      expect(u.pathname).toBe('/auth/v1/recover');
      expect(u.searchParams.get('redirect_to')).toBe('http://localhost:5173/reset-password');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'ana@example.com' });
      return jsonResponse(200, {});
    });
    const res = await request(createApp()).post('/api/v1/auth/recover').send({ email: 'ana@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
  });

  it('still answers sent:true even if GoTrue errors, so nothing about account existence leaks', async () => {
    stubFetch(() => jsonResponse(400, { msg: 'nope' }));
    const res = await request(createApp()).post('/api/v1/auth/recover').send({ email: 'ana@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
  });

  it('rejects a malformed email without calling GoTrue', async () => {
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp()).post('/api/v1/auth/recover').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('401s without the recovery session token', async () => {
    const res = await request(createApp()).post('/api/v1/auth/reset-password').send({ password: 'longenough1' });
    expect(res.status).toBe(401);
  });

  it('rejects a short password without calling GoTrue', async () => {
    const token = mintToken();
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp())
      .post('/api/v1/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'short' });
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('applies the new password via a genuine recovery session bearer token (amr: otp)', async () => {
    const token = mintToken({ email: 'ana@example.com', amr: [{ method: 'otp', timestamp: 1 }] });
    stubFetch((url, init) => {
      expect(url).toBe('http://supabase.test/auth/v1/user');
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${token}`);
      expect(JSON.parse(String(init?.body))).toEqual({ password: 'longenough1' });
      return jsonResponse(200, { id: 'u1', email: 'ana@example.com' });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'longenough1' });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(true);
  });

  it('403s an ordinary (non-recovery) session token, so a stolen login token cannot silently reset the password', async () => {
    const token = mintToken({ email: 'ana@example.com', amr: [{ method: 'password', timestamp: 1 }] });
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp())
      .post('/api/v1/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'longenough1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(spy).not.toHaveBeenCalled();
  });

  it('403s a token with no amr history at all', async () => {
    const token = mintToken({ email: 'ana@example.com' });
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp())
      .post('/api/v1/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'longenough1' });
    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('401s without a session', async () => {
    const res = await request(createApp())
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'oldpassword1', newPassword: 'newpassword1' });
    expect(res.status).toBe(401);
  });

  it('rejects the wrong current password without touching /user', async () => {
    const token = mintToken({ email: 'ana@example.com' });
    stubFetch((url) => {
      expect(url).toBe('http://supabase.test/auth/v1/token?grant_type=password');
      return jsonResponse(400, { error_description: 'Invalid login credentials' });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpass1', newPassword: 'newpassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('re-verifies the current password, then applies the new one', async () => {
    const token = mintToken({ email: 'ana@example.com' });
    stubFetch((url, init) => {
      if (url.includes('grant_type=password')) {
        expect(JSON.parse(String(init?.body))).toEqual({ email: 'ana@example.com', password: 'oldpassword1' });
        return jsonResponse(200, SESSION);
      }
      expect(url).toBe('http://supabase.test/auth/v1/user');
      expect(JSON.parse(String(init?.body))).toEqual({ password: 'newpassword1' });
      return jsonResponse(200, { id: 'u1', email: 'ana@example.com' });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpassword1', newPassword: 'newpassword1' });
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(true);
  });
});

describe('POST /api/v1/auth/change-email', () => {
  it('401s without a session', async () => {
    const res = await request(createApp())
      .post('/api/v1/auth/change-email')
      .send({ newEmail: 'new@example.com', currentPassword: 'currentpass1' });
    expect(res.status).toBe(401);
  });

  it('rejects the wrong current password without touching /user', async () => {
    const token = mintToken({ email: 'ana@example.com' });
    stubFetch((url) => {
      if (url.includes('/rest/v1/user_roles')) return jsonResponse(200, [{ role: 'universal' }]);
      return jsonResponse(400, { error_description: 'Invalid login credentials' });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new@example.com', currentPassword: 'wrongpass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('re-verifies, then requests the email change with a settings redirect (pending, not applied)', async () => {
    const token = mintToken({ email: 'ana@example.com' });
    stubFetch((url, init) => {
      if (url.includes('/rest/v1/user_roles')) return jsonResponse(200, [{ role: 'universal' }]);
      if (url.includes('grant_type=password')) return jsonResponse(200, SESSION);
      const u = new URL(url);
      expect(u.pathname).toBe('/auth/v1/user');
      expect(u.searchParams.get('redirect_to')).toBe('http://localhost:5173/profile/settings');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'new@example.com' });
      return jsonResponse(200, { id: 'u1', email: 'ana@example.com' });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new@example.com', currentPassword: 'currentpass1' });
    expect(res.status).toBe(200);
    expect(res.body.data.pending).toBe(true);
  });

  it('maps an already-registered new email to EMAIL_IN_USE', async () => {
    const token = mintToken({ email: 'ana@example.com' });
    stubFetch((url) => {
      if (url.includes('/rest/v1/user_roles')) return jsonResponse(200, [{ role: 'universal' }]);
      if (url.includes('grant_type=password')) return jsonResponse(200, SESSION);
      return jsonResponse(422, { msg: 'Email address already registered' });
    });
    const res = await request(createApp())
      .post('/api/v1/auth/change-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new@example.com', currentPassword: 'currentpass1' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });
});
