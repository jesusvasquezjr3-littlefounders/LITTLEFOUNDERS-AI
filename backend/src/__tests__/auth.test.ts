import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

const SESSION = {
  access_token: 'at',
  refresh_token: 'rt',
  expires_in: 3600,
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', user_metadata: { display_name: 'Ana' } },
};

afterEach(() => vi.unstubAllGlobals());

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

  it('rejects an unsupported provider without touching GoTrue', async () => {
    const spy = vi.fn();
    stubFetch(spy as never);
    const res = await request(createApp()).get('/api/v1/auth/oauth/facebook');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(spy).not.toHaveBeenCalled();
  });
});
