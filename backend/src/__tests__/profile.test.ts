import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

const PROFILE_ROW = {
  user_id: 'u-1',
  display_name: 'Ana',
  username: 'ana',
  locale: 'es-MX',
  theme: 'system',
  cover: { preset: 'sunset' },
  created_at: '2026-07-12T00:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

interface StubOpts {
  patchStatus?: number;
  profileRows?: unknown[];
  calls?: { url: string; method: string; body?: string }[];
}

function stub(opts: StubOpts = {}) {
  const calls: { url: string; method: string; body?: string }[] = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (method === 'PATCH' && url.includes('/rest/v1/profiles')) {
        return Promise.resolve(new Response(null, { status: opts.patchStatus ?? 204 }));
      }
      if (url.includes('/rest/v1/profiles')) {
        return Promise.resolve(jsonResponse(200, opts.profileRows ?? [PROFILE_ROW]));
      }
      if (url.includes('/rest/v1/avatars') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [{ options: { top: ['bob'] } }]));
      }
      if (url.includes('/rest/v1/follows') && method === 'GET') {
        return Promise.resolve(
          new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/7' } }),
        );
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, [{ role: 'parent' }]));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

describe('GET /api/v1/profile', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/profile');
    expect(res.status).toBe(401);
  });

  it('returns the own profile with avatar options and counts', async () => {
    stub();
    const res = await request(createApp())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1', email: 'ana@example.com' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      displayName: 'Ana',
      username: 'ana',
      cover: { preset: 'sunset' },
      avatarOptions: { top: ['bob'] },
      email: 'ana@example.com',
      locale: 'es-MX',
      followers: 7,
      following: 7,
    });
  });
});

describe('PATCH /api/v1/profile', () => {
  it('updates name/username/locale through the user token', async () => {
    const calls = stub();
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`)
      .send({ displayName: 'Ana María', username: 'AnaMaria_1', locale: 'pt-BR' });
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toContain('"username":"anamaria_1"'); // lowercased
    expect(patch?.body).toContain('"locale":"pt-BR"');
  });

  it('maps a unique-violation to USERNAME_TAKEN', async () => {
    stub({ patchStatus: 409 });
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ username: 'taken' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('rejects invalid usernames', async () => {
    stub();
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ username: 'no spaces!' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/profile/cover', () => {
  it('accepts a known preset only — never binary data', async () => {
    stub();
    const okRes = await request(createApp())
      .put('/api/v1/profile/cover')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ preset: 'aurora' });
    expect(okRes.status).toBe(200);

    const badRes = await request(createApp())
      .put('/api/v1/profile/cover')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ preset: 'data:image/png;base64,AAAA' });
    expect(badRes.status).toBe(400);
  });
});

describe('PUT /api/v1/profile/avatar', () => {
  it('accepts a bounded Avataaars option set', async () => {
    stub();
    const res = await request(createApp())
      .put('/api/v1/profile/avatar')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ options: { top: ['shortFlat'], hairColor: ['4a312c'], accessoriesProbability: 0 } });
    expect(res.status).toBe(200);
  });

  it('rejects unknown option keys (strict schema)', async () => {
    stub();
    const res = await request(createApp())
      .put('/api/v1/profile/avatar')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ options: { imageUrl: ['https://evil.example/x.png'] } });
    expect(res.status).toBe(400);
  });
});

describe('public profiles', () => {
  it('returns whitelisted public fields + follow state', async () => {
    stub();
    const res = await request(createApp())
      .get('/api/v1/profiles/ana')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-2' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ displayName: 'Ana', username: 'ana', isSelf: false, isTutor: true });
    expect(res.body.data.email).toBeUndefined(); // never leaks
  });

  it('404s for unknown usernames', async () => {
    stub({ profileRows: [] });
    const res = await request(createApp())
      .get('/api/v1/profiles/ghost')
      .set('Authorization', `Bearer ${mintToken()}`);
    expect(res.status).toBe(404);
  });

  it('blocks self-follow', async () => {
    stub();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/follow')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(400);
  });

  it('follows through the user token (RLS-owned write)', async () => {
    const calls = stub();
    const token = mintToken({ sub: 'u-2' });
    const res = await request(createApp()).post('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const follow = calls.find((c) => c.url.includes('/rest/v1/follows') && c.method === 'POST');
    expect(follow?.body).toContain('"follower_id":"u-2"');
  });
});
