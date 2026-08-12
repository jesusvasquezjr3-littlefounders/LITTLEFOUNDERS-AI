import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
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
afterEach(() => {
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) void authRateLimiter.resetKey(key);
});

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init))));
}

describe('POST /api/v1/auth/signup', () => {
  it('creates a session (autoconfirm on)', async () => {
    stubFetch((url) => {
      expect(url).toBe('http://supabase.test/auth/v1/signup');
      return jsonResponse(200, SESSION);
    });
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana', locale: 'es-MX', parentIntent: true });
    expect(res.status).toBe(201);
    expect(res.body.data.session.accessToken).toBe('at');
    expect(res.body.data.confirmationRequired).toBe(false);
  });

  it('flags confirmationRequired when GoTrue returns no session (prod autoconfirm off)', async () => {
    stubFetch(() => jsonResponse(200, { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' }));
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana' });
    expect(res.status).toBe(201);
    expect(res.body.data.session).toBeNull();
    expect(res.body.data.confirmationRequired).toBe(true);
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
      .send({ email: 'ana@example.com', password: 'longenough1', displayName: 'Ana' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });
});

describe('POST /api/v1/auth/guest', () => {
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

  it('applies the new password via the recovery session bearer token', async () => {
    const token = mintToken({ email: 'ana@example.com' });
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
    stubFetch(() => jsonResponse(400, { error_description: 'Invalid login credentials' }));
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
