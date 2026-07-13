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
  birth_date: '1990-05-01',
  created_at: '2026-07-12T00:00:00Z',
};

const ZERO_STATS = { xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0 };

afterEach(() => vi.unstubAllGlobals());

interface StubOpts {
  patchStatus?: number;
  profileRows?: unknown[];
  followRange?: string;
  followEdges?: { follower_id?: string; followed_id?: string }[];
  learningStats?: unknown[];
  blockedRows?: unknown[]; // for GET /blocks (both the either-way check and listBlocked)
  hydrateProfiles?: unknown[];
  hydrateAvatars?: unknown[];
  hydrateTutorIds?: unknown[];
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
      if (url.includes('/rest/v1/profiles') && url.includes('user_id=in.')) {
        return Promise.resolve(jsonResponse(200, opts.hydrateProfiles ?? []));
      }
      if (url.includes('/rest/v1/profiles')) {
        return Promise.resolve(jsonResponse(200, opts.profileRows ?? [PROFILE_ROW]));
      }
      if (url.includes('/rest/v1/avatars') && url.includes('user_id=in.')) {
        return Promise.resolve(jsonResponse(200, opts.hydrateAvatars ?? []));
      }
      if (url.includes('/rest/v1/avatars')) {
        return Promise.resolve(jsonResponse(200, [{ options: { top: ['bob'] } }]));
      }
      if (url.includes('/rest/v1/user_roles') && url.includes('user_id=in.')) {
        return Promise.resolve(jsonResponse(200, opts.hydrateTutorIds ?? []));
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, [{ role: 'parent' }]));
      }
      if (url.includes('/rest/v1/learning_stats')) {
        return Promise.resolve(jsonResponse(200, opts.learningStats ?? [ZERO_STATS]));
      }
      if (url.includes('/rest/v1/blocks')) {
        if (method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
        if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, opts.blockedRows ?? []));
      }
      if (url.includes('/rest/v1/follows')) {
        if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        if (method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
        if (url.includes('order=') && url.includes('limit=')) {
          return Promise.resolve(jsonResponse(200, opts.followEdges ?? []));
        }
        return Promise.resolve(
          new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Content-Range': opts.followRange ?? '0-0/7' },
          }),
        );
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

  it('returns the own profile with avatar options, counts, birthDate, and learningStats', async () => {
    stub({ learningStats: [{ xp_points: 120, minutes_learned: 45, lessons_completed: 3, streak_days: 2 }] });
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
      birthDate: '1990-05-01',
      followers: 7,
      following: 7,
      learningStats: { xpPoints: 120, minutesLearned: 45, lessonsCompleted: 3, streakDays: 2 },
    });
  });
});

describe('PATCH /api/v1/profile', () => {
  it('updates name/username/locale/birthDate through the user token', async () => {
    const calls = stub();
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`)
      .send({ displayName: 'Ana María', username: 'AnaMaria_1', locale: 'pt-BR', birthDate: '1990-05-01' });
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toContain('"username":"anamaria_1"'); // lowercased
    expect(patch?.body).toContain('"locale":"pt-BR"');
    expect(patch?.body).toContain('"birth_date":"1990-05-01"');
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

  it('rejects a birthDate in the future', async () => {
    stub();
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ birthDate: '2999-01-01' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed birthDate', async () => {
    stub();
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ birthDate: '05/01/1990' });
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

describe('GET /api/v1/profile/followers, /following, /blocked', () => {
  it('lists own followers hydrated with profile + avatar + tutor role', async () => {
    stub({
      followEdges: [{ follower_id: 'u-9' }],
      hydrateProfiles: [{ user_id: 'u-9', display_name: 'Bea', username: 'bea' }],
      hydrateAvatars: [{ user_id: 'u-9', options: { top: ['bun'] } }],
      hydrateTutorIds: [{ user_id: 'u-9' }],
    });
    const res = await request(createApp())
      .get('/api/v1/profile/followers')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([
      { userId: 'u-9', displayName: 'Bea', username: 'bea', avatarOptions: { top: ['bun'] }, isTutor: true },
    ]);
  });

  it('lists own following', async () => {
    stub({ followEdges: [{ followed_id: 'u-9' }], hydrateProfiles: [{ user_id: 'u-9', display_name: 'Bea', username: 'bea' }] });
    const res = await request(createApp())
      .get('/api/v1/profile/following')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ userId: 'u-9', username: 'bea' });
  });

  it('lists blocked accounts', async () => {
    stub({ blockedRows: [{ blocked_id: 'u-9' }], hydrateProfiles: [{ user_id: 'u-9', display_name: 'Bea', username: 'bea' }] });
    const res = await request(createApp())
      .get('/api/v1/profile/blocked')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ userId: 'u-9', username: 'bea' });
  });

  it('an empty edge list never calls the batch hydrate endpoints', async () => {
    const calls = stub({ followEdges: [] });
    const res = await request(createApp())
      .get('/api/v1/profile/followers')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([]);
    expect(calls.some((c) => c.url.includes('user_id=in.'))).toBe(false);
  });
});

describe('public profiles', () => {
  it('returns whitelisted public fields + follow state + learningStats, never birthDate/email', async () => {
    stub({ blockedRows: [] });
    const res = await request(createApp())
      .get('/api/v1/profiles/ana')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-2' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      displayName: 'Ana',
      username: 'ana',
      isSelf: false,
      isTutor: true,
      learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0 },
    });
    expect(res.body.data.email).toBeUndefined();
    expect(res.body.data.birthDate).toBeUndefined();
  });

  it('404s for unknown usernames', async () => {
    stub({ profileRows: [] });
    const res = await request(createApp())
      .get('/api/v1/profiles/ghost')
      .set('Authorization', `Bearer ${mintToken()}`);
    expect(res.status).toBe(404);
  });

  it('404s (not 403) for a profile that blocked the viewer — never leaks the block', async () => {
    stub({ blockedRows: [{ blocker_id: 'u-1' }] }); // is_blocked query returns a row => blocked either-way
    const res = await request(createApp())
      .get('/api/v1/profiles/ana')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-2' })}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('blocks self-follow', async () => {
    stub({ blockedRows: [] });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/follow')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(400);
  });

  it('follows through the user token (RLS-owned write)', async () => {
    const calls = stub({ blockedRows: [] });
    const token = mintToken({ sub: 'u-2' });
    const res = await request(createApp()).post('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const follow = calls.find((c) => c.url.includes('/rest/v1/follows') && c.method === 'POST');
    expect(follow?.body).toContain('"follower_id":"u-2"');
  });

  it('a blocked viewer cannot follow (profile resolves to 404 first)', async () => {
    stub({ blockedRows: [{ blocker_id: 'u-1' }] });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/follow')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-2' })}`);
    expect(res.status).toBe(404);
  });
});

describe('block / unblock', () => {
  it('blocks another user and cleans up both follow directions', async () => {
    const calls = stub();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-2' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.blocked).toBe(true);
    expect(calls.some((c) => c.url.includes('/rest/v1/blocks') && c.method === 'POST')).toBe(true);
    const followDeletes = calls.filter((c) => c.url.includes('/rest/v1/follows') && c.method === 'DELETE');
    expect(followDeletes).toHaveLength(2);
    expect(followDeletes.some((c) => c.url.includes('follower_id=eq.u-2') && c.url.includes('followed_id=eq.u-1'))).toBe(true);
    expect(followDeletes.some((c) => c.url.includes('follower_id=eq.u-1') && c.url.includes('followed_id=eq.u-2'))).toBe(true);
  });

  it('rejects self-block', async () => {
    stub();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-1' })}`);
    expect(res.status).toBe(400);
  });

  it('unblocks even though the block would otherwise hide the profile from resolveVisible', async () => {
    const calls = stub({ blockedRows: [{ blocker_id: 'u-2' }] }); // u-2 has blocked u-1
    const res = await request(createApp())
      .delete('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: 'u-2' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.blocked).toBe(false);
    expect(calls.some((c) => c.url.includes('/rest/v1/blocks') && c.method === 'DELETE')).toBe(true);
  });
});
