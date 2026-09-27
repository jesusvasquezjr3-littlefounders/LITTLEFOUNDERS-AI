import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

const PROFILE_ROW = {
  user_id: '11111111-1111-4111-8111-111111111111',
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
  /** Tier the database answers for accounts other than the profile subject (the viewer). */
  viewerTier?: string | null;
  subjectTier?: string | null;
  teenConsent?: boolean;
  approvalResult?: unknown;
  viewerGuardianIds?: string[];
  withdrawalResult?: unknown;
  withdrawalStatus?: number;
  requestResult?: string | null;
  blockStatus?: number;
  targetRoles?: string[] | null;
  guardianIds?: string[] | null;
  patchStatus?: number;
  profileRows?: unknown[];
  followRange?: string;
  followEdges?: { follower_id?: string; followed_id?: string }[];
  learningStats?: unknown[];
  completedBadges?: unknown[];
  ownFollowRows?: unknown[];
  ownOpenRequests?: unknown[];
  ownBlockedRows?: unknown[];
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

      if (url.includes('/rpc/social_tier')) {
        const id = (JSON.parse(String(init?.body ?? '{}')) as { p_user?: string }).p_user;
        if (id === PROFILE_ROW.user_id) {
          if (opts.subjectTier !== undefined) return Promise.resolve(jsonResponse(200, opts.subjectTier));
          if (opts.targetRoles === null) return Promise.resolve(jsonResponse(200, null));
          return Promise.resolve(jsonResponse(200, (opts.targetRoles ?? ['parent']).includes('kid') ? 'guardian' : 'adult'));
        }
        return Promise.resolve(jsonResponse(200, opts.viewerTier === undefined ? 'adult' : opts.viewerTier));
      }
      if (url.includes('/rpc/has_current_teen_consent')) return Promise.resolve(jsonResponse(200, opts.teenConsent ?? false));
      if (url.includes('/rest/v1/social_consent_requests')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rpc/has_current_social_approval')) return Promise.resolve(jsonResponse(200, opts.approvalResult ?? false));
      if (url.includes('/rpc/withdraw_social_connection')) return Promise.resolve(jsonResponse(opts.withdrawalStatus ?? 200, opts.withdrawalResult === undefined ? true : opts.withdrawalResult));
      if (url.includes('/rpc/request_social_connection')) return Promise.resolve(jsonResponse(200, opts.requestResult === undefined ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : opts.requestResult));
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
      if (url.includes('/rest/v1/guardian_links')) {
        const ids = url.includes(`kid_user_id=eq.${PROFILE_ROW.user_id}`) ? opts.guardianIds : (opts.viewerGuardianIds ?? opts.guardianIds);
        return Promise.resolve(jsonResponse(200, ids === null ? null : (ids ?? []).map(parent_user_id => ({ parent_user_id }))));
      }
      if (url.includes('/rest/v1/user_roles')) {
        return Promise.resolve(jsonResponse(200, opts.targetRoles === null ? null : (opts.targetRoles ?? ['parent']).map(role => ({ role }))));
      }
      // E.5, OD-6: the listed and viewed parents are currently ID-verified unless a case says otherwise.
      if (url.includes('/rest/v1/parent_verifications')) {
        return Promise.resolve(jsonResponse(200, [{ status: 'verified', method: 'local-ocr', birth_date: '1988-02-14' }]));
      }
      if (url.includes('/rest/v1/learning_stats')) {
        return Promise.resolve(jsonResponse(200, opts.learningStats ?? [ZERO_STATS]));
      }
      if (url.includes('/rest/v1/rpc/get_completed_course_badges')) {
        return Promise.resolve(jsonResponse(200, opts.completedBadges ?? []));
      }
      if (url.includes('/rest/v1/blocks')) {
        if (method === 'POST') return Promise.resolve(new Response(null, { status: opts.blockStatus ?? 201 }));
        if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        if (url.includes('blocker_id=eq.') && url.includes('blocked_id=eq.')) return Promise.resolve(jsonResponse(200, opts.ownBlockedRows ?? []));
        return Promise.resolve(jsonResponse(200, opts.blockedRows ?? []));
      }
      if (url.includes('/rest/v1/social_connection_requests')) return Promise.resolve(jsonResponse(200, opts.ownOpenRequests ?? []));
      if (url.includes('/rest/v1/follows')) {
        if (url.includes('follower_id=eq.') && url.includes('followed_id=eq.') && url.includes('select=follower_id')) return Promise.resolve(jsonResponse(200, opts.ownFollowRows ?? []));
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

  it('returns the own profile with avatar options, birthDate, social tier and learningStats, but no follower counts (E.9)', async () => {
    const calls = stub({ learningStats: [{ xp_points: 120, minutes_learned: 45, lessons_completed: 3, streak_days: 2 }] });
    const res = await request(createApp())
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      displayName: 'Ana',
      username: 'ana',
      cover: { preset: 'sunset' },
      avatarOptions: { top: ['bob'] },
      email: 'ana@example.com',
      locale: 'es-MX',
      birthDate: '1990-05-01',
      learningStats: { xpPoints: 120, minutesLearned: 45, lessonsCompleted: 3, streakDays: 2 },
      social: { tier: 'adult', privateProfile: false },
      profileReview: { flagged: false, fields: [] },
    });
    expect(res.body.data).not.toHaveProperty('followers');
    expect(res.body.data).not.toHaveProperty('following');
    // No count query is even issued.
    expect(calls.some((call) => call.url.includes('/rest/v1/follows'))).toBe(false);
  });
});

describe('PATCH /api/v1/profile', () => {
  it('rejects a valid-looking DOB replacement without issuing a profile write', async () => {
    const calls = stub();
    const res = await request(createApp()).patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({ displayName: 'Changed', birthDate: '1990-01-01' });
    expect(res.status).toBe(400);
    expect(calls.some(c => c.method === 'PATCH')).toBe(false);
  });
  it('updates name/username/locale through the user token', async () => {
    const calls = stub();
    const res = await request(createApp())
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`)
      .send({ displayName: 'Ana María', username: 'AnaMaria_1', locale: 'pt-BR' });
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toContain('"username":"anamaria_1"'); // lowercased
    expect(patch?.body).toContain('"locale":"pt-BR"');
    expect(patch?.body).not.toContain('birth_date');
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
      followEdges: [{ follower_id: '99999999-9999-4999-8999-999999999999' }],
      hydrateProfiles: [{ user_id: '99999999-9999-4999-8999-999999999999', display_name: 'Bea', username: 'bea' }],
      hydrateAvatars: [{ user_id: '99999999-9999-4999-8999-999999999999', options: { top: ['bun'] } }],
      hydrateTutorIds: [{ user_id: '99999999-9999-4999-8999-999999999999' }],
    });
    const res = await request(createApp())
      .get('/api/v1/profile/followers')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([
      { userId: '99999999-9999-4999-8999-999999999999', displayName: 'Bea', username: 'bea', avatarOptions: { top: ['bun'] }, isTutor: true },
    ]);
  });

  it('lists own following', async () => {
    stub({ followEdges: [{ followed_id: '99999999-9999-4999-8999-999999999999' }], hydrateProfiles: [{ user_id: '99999999-9999-4999-8999-999999999999', display_name: 'Bea', username: 'bea' }] });
    const res = await request(createApp())
      .get('/api/v1/profile/following')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ userId: '99999999-9999-4999-8999-999999999999', username: 'bea' });
  });

  it('lists blocked accounts', async () => {
    stub({ blockedRows: [{ blocked_id: '99999999-9999-4999-8999-999999999999' }], hydrateProfiles: [{ user_id: '99999999-9999-4999-8999-999999999999', display_name: 'Bea', username: 'bea' }] });
    const res = await request(createApp())
      .get('/api/v1/profile/blocked')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ userId: '99999999-9999-4999-8999-999999999999', username: 'bea' });
  });

  it('an empty edge list never calls the batch hydrate endpoints', async () => {
    const calls = stub({ followEdges: [] });
    const res = await request(createApp())
      .get('/api/v1/profile/followers')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([]);
    expect(calls.some((c) => c.url.includes('user_id=in.'))).toBe(false);
  });
});

describe('public profiles', () => {
  it('returns whitelisted public fields + follow state + learningStats, never birthDate/email', async () => {
    stub({
      blockedRows: [],
      completedBadges: [
        {
          course_slug: 'financial-education',
          course_title: { 'en-US': 'Financial Education' },
          badge_asset: 'course-badges/financial-education.png',
          completed_at: '2026-08-09T10:00:00Z',
        },
      ],
    });
    const res = await request(createApp())
      .get('/api/v1/profiles/ana')
      .set('Authorization', `Bearer ${mintToken({ sub: '22222222-2222-4222-8222-222222222222' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      displayName: 'Ana',
      username: 'ana',
      isSelf: false,
      isTutor: true,
      requiresGuardianApproval: false,
      learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0 },
      courseBadges: [
        {
          slug: 'financial-education',
          title: { 'en-US': 'Financial Education' },
          badgeAsset: 'course-badges/financial-education.png',
          completedAt: '2026-08-09T10:00:00Z',
        },
      ],
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
    stub({ blockedRows: [{ blocker_id: '11111111-1111-4111-8111-111111111111' }] }); // is_blocked query returns a row => blocked either-way
    const res = await request(createApp())
      .get('/api/v1/profiles/ana')
      .set('Authorization', `Bearer ${mintToken({ sub: '22222222-2222-4222-8222-222222222222' })}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('blocks self-follow', async () => {
    stub({ blockedRows: [] });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/follow')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`);
    expect(res.status).toBe(400);
  });

  it('follows through the user token (RLS-owned write)', async () => {
    const calls = stub({ blockedRows: [] });
    const token = mintToken({ sub: '22222222-2222-4222-8222-222222222222' });
    const res = await request(createApp()).post('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const follow = calls.find((c) => c.url.includes('/rest/v1/follows') && c.method === 'POST');
    expect(follow?.body).toContain('"follower_id":"22222222-2222-4222-8222-222222222222"');
  });

  it('a blocked viewer cannot follow (profile resolves to 404 first)', async () => {
    stub({ blockedRows: [{ blocker_id: '11111111-1111-4111-8111-111111111111' }] });
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/follow')
      .set('Authorization', `Bearer ${mintToken({ sub: '22222222-2222-4222-8222-222222222222' })}`);
    expect(res.status).toBe(404);
  });
});

describe('block / unblock', () => {
  it('confirms the atomic database block without separate follow deletions', async () => {
    const calls = stub();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: '22222222-2222-4222-8222-222222222222' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.blocked).toBe(true);
    expect(calls.some((c) => c.url.includes('/rest/v1/blocks') && c.method === 'POST')).toBe(true);
    const followDeletes = calls.filter((c) => c.url.includes('/rest/v1/follows') && c.method === 'DELETE');
    expect(followDeletes).toHaveLength(0);
  });

  it('does not claim a block when its atomic database transaction fails', async () => {
    const calls = stub({ blockStatus: 503 });
    const res = await request(createApp()).post('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: '22222222-2222-4222-8222-222222222222' })}`);
    expect(res.status).toBe(502);
    expect(res.body.data).toBeNull();
    expect(calls.some(call => call.url.includes('/follows') && call.method === 'DELETE')).toBe(false);
  });

  it('rejects self-block', async () => {
    stub();
    const res = await request(createApp())
      .post('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: '11111111-1111-4111-8111-111111111111' })}`);
    expect(res.status).toBe(400);
  });

  it('unblocks even though the block would otherwise hide the profile from resolveVisible', async () => {
    const calls = stub({ blockedRows: [{ blocker_id: '22222222-2222-4222-8222-222222222222' }], ownBlockedRows: [{ blocker_id: '22222222-2222-4222-8222-222222222222', blocked_id: PROFILE_ROW.user_id }] }); // u-2 has blocked u-1
    const res = await request(createApp())
      .delete('/api/v1/profiles/ana/block')
      .set('Authorization', `Bearer ${mintToken({ sub: '22222222-2222-4222-8222-222222222222' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.blocked).toBe(false);
    expect(calls.some((c) => c.url.includes('/rest/v1/blocks') && c.method === 'DELETE')).toBe(true);
  });
});


describe('E.1 protected discovery admission', () => {
  const viewer = '22222222-2222-4222-8222-222222222222';
  it.each(['', '/followers', '/following', '/follow'])('hides unrelated child profile at %s', async suffix => {
    const calls = stub({ targetRoles: ['kid'] });
    const app = createApp(); const endpoint = `/api/v1/profiles/ana${suffix}`;
    const response = await (suffix === '/follow' ? request(app).post(endpoint) : request(app).get(endpoint))
      .set('Authorization', `Bearer ${mintToken({ sub: viewer })}`);
    expect(response.status).toBe(404);
    expect(calls.some(call => call.method === 'POST' && call.url.includes('/follows'))).toBe(false);
  });
  it('permits linked guardian visibility but never converts the link into follow approval', async () => {
    stub({ targetRoles: ['kid'], guardianIds: [viewer] });
    const token = mintToken({ sub: viewer });
    const profile = await request(createApp()).get('/api/v1/profiles/ana').set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.requiresGuardianApproval).toBe(true);
    const follow = await request(createApp()).post('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(follow.status).toBe(403);
    expect(follow.body.error.code).toBe('GUARDIAN_APPROVAL_REQUIRED');
  });
  it('omits an unrelated child from an existing follower list', async () => {
    stub({ targetRoles: ['kid'], followEdges: [{ follower_id: PROFILE_ROW.user_id }], hydrateProfiles: [PROFILE_ROW] });
    const response = await request(createApp()).get('/api/v1/profile/followers').set('Authorization', `Bearer ${mintToken({ sub: viewer })}`);
    expect(response.status).toBe(200); expect(response.body.data.users).toEqual([]);
  });
  it('hides the profile when role evidence is unavailable', async () => {
    stub({ targetRoles: null });
    expect((await request(createApp()).get('/api/v1/profiles/ana').set('Authorization', `Bearer ${mintToken({ sub: viewer })}`)).status).toBe(404);
  });
});


describe('E.1 connection request admission', () => {
  const viewer = '22222222-2222-4222-8222-222222222222';
  const endpoint = '/api/v1/profiles/ana/connection-request';
  it('records a pending receipt with session identity and no follow write', async () => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [viewer] });
    const res = await request(createApp()).post(endpoint).set('Authorization', `Bearer ${mintToken({ sub: viewer })}`).send({});
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'pending', following: false, decidedBy: 'guardian' });
    expect(calls.find(call => call.url.includes('/rpc/request_social_connection'))?.body).toBe(JSON.stringify({ p_requester_id: viewer, p_kid_user_id: PROFILE_ROW.user_id }));
    expect(calls.some(call => call.url.includes('/rest/v1/follows') && call.method === 'POST')).toBe(false);
  });
  it('does not expose unrelated child profiles or queue requests to them', async () => {
    const calls = stub({ targetRoles: ['kid'] });
    expect((await request(createApp()).post(endpoint).set('Authorization', `Bearer ${mintToken({ sub: viewer })}`)).status).toBe(404);
    expect(calls.some(call => call.url.includes('/rpc/request_social_connection'))).toBe(false);
  });
  it('rejects a forged requester or decision field', async () => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [viewer] });
    expect((await request(createApp()).post(endpoint).set('Authorization', `Bearer ${mintToken({ sub: viewer })}`).send({ requesterId: PROFILE_ROW.user_id, status: 'approved' })).status).toBe(400);
    expect(calls.some(call => call.url.includes('/rpc/request_social_connection'))).toBe(false);
  });
  it('does not claim a queued request when persistence fails', async () => {
    stub({ targetRoles: ['kid'], guardianIds: [viewer], requestResult: null });
    expect((await request(createApp()).post(endpoint).set('Authorization', `Bearer ${mintToken({ sub: viewer })}`)).status).toBe(502);
  });
});


describe('atomic unfollow', () => {
  it('withdraws through the session token and requires a confirmed transaction receipt', async () => {
    const viewer = '22222222-2222-4222-8222-222222222222';
    const token = mintToken({ sub: viewer });
    const calls = stub({ ownFollowRows: [{ follower_id: viewer }] });
    const response = await request(createApp()).delete('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ following: false });
    const withdrawal = calls.find(call => call.url.includes('/rpc/withdraw_social_connection'));
    expect(withdrawal?.method).toBe('POST');
    expect(JSON.parse(withdrawal?.body ?? '{}')).toEqual({ p_follower_id: viewer, p_followed_id: PROFILE_ROW.user_id });
    expect(calls.some(call => call.url.includes('/follows') && call.method === 'DELETE')).toBe(false);
    const rpc = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/rpc/withdraw_social_connection'));
    expect((rpc?.[1]?.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
  });
  it.each([false, null, 'true', {}])('does not report success for a malformed or refused receipt: %j', async receipt => {
    stub({ withdrawalResult: receipt, ownFollowRows: [{ follower_id: '22222222-2222-4222-8222-222222222222' }] });
    const response = await request(createApp()).delete('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${mintToken()}`);
    expect(response.status).toBe(502);
  });
  it('does not report success when the withdrawal transaction fails', async () => {
    stub({ withdrawalStatus: 500, ownFollowRows: [{ follower_id: '22222222-2222-4222-8222-222222222222' }] });
    const response = await request(createApp()).delete('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${mintToken()}`);
    expect(response.status).toBe(502);
  });
});

describe('current approved discovery', () => {
  const viewer = '22222222-2222-4222-8222-222222222222';
  const guardian = '33333333-3333-4333-8333-333333333333';
  it.each(['', '/followers', '/following'])('admits an outsider with a current approval at %s', async suffix => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [guardian], viewerGuardianIds: [], approvalResult: true });
    const response = await request(createApp()).get(`/api/v1/profiles/ana${suffix}`).set('Authorization', `Bearer ${mintToken({ sub: viewer })}`);
    expect(response.status).toBe(200);
    const rpc = calls.find(call => call.url.includes('/rpc/has_current_social_approval'));
    expect(JSON.parse(rpc?.body ?? '{}')).toEqual({ p_viewer: viewer, p_subject: PROFILE_ROW.user_id });
  });
  it.each([false, 'true', {}, []])('hides an outsider without a literal approval receipt: %j', async receipt => {
    stub({ targetRoles: ['kid'], guardianIds: [guardian], viewerGuardianIds: [], approvalResult: receipt });
    const response = await request(createApp()).get('/api/v1/profiles/ana').set('Authorization', `Bearer ${mintToken({ sub: viewer })}`);
    expect(response.status).toBe(404);
  });
  it('does not turn current visibility into permission for a direct child follow', async () => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [guardian], viewerGuardianIds: [], approvalResult: true });
    const response = await request(createApp()).post('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${mintToken({ sub: viewer })}`);
    expect(response.status).toBe(403);
    expect(calls.some(call => call.url.includes('/follows') && call.method === 'POST')).toBe(false);
  });
});


describe('secondary social-route privacy', () => {
  const viewer = '22222222-2222-4222-8222-222222222222';
  const token = mintToken({ sub: viewer });
  it.each([
    ['post', '/block'], ['delete', '/block'], ['delete', '/follow'],
  ] as const)('does not resolve an unrelated child through %s %s', async (method, suffix) => {
    const calls = stub({ targetRoles: ['kid'] });
    const res = await request(createApp())[method](`/api/v1/profiles/ana${suffix}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(calls.some(call => call.method === 'POST' && call.url.includes('/rest/v1/blocks'))).toBe(false);
    expect(calls.some(call => call.method === 'DELETE' && call.url.includes('/rest/v1/blocks'))).toBe(false);
    expect(calls.some(call => call.url.includes('/rpc/withdraw_social_connection'))).toBe(false);
  });
  it('does not expose an unrelated child through the legacy blocked list', async () => {
    stub({ targetRoles: ['kid'], blockedRows: [{ blocked_id: PROFILE_ROW.user_id }], hydrateProfiles: [PROFILE_ROW] });
    const res = await request(createApp()).get('/api/v1/profile/blocked').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200); expect(res.body.data.users).toEqual([]);
  });
  it('lets a user remove their own existing block of a now-private child', async () => {
    const calls = stub({ targetRoles: ['kid'], ownBlockedRows: [{ blocker_id: viewer, blocked_id: PROFILE_ROW.user_id }] });
    const res = await request(createApp()).delete('/api/v1/profiles/ana/block').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(calls.some(call => call.method === 'DELETE' && call.url.includes('/rest/v1/blocks'))).toBe(true);
  });
  it('lets a user withdraw an existing private-child follow without profile discovery', async () => {
    const calls = stub({ targetRoles: ['kid'], ownFollowRows: [{ follower_id: viewer }] });
    const res = await request(createApp()).delete('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(calls.some(call => call.url.includes('/rpc/withdraw_social_connection'))).toBe(true);
  });
  it('lets a user withdraw a pending private-child request without a follow edge', async () => {
    const calls = stub({ targetRoles: ['kid'], ownOpenRequests: [{ requester_id: viewer, kid_user_id: PROFILE_ROW.user_id }] });
    const res = await request(createApp()).delete('/api/v1/profiles/ana/follow').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(calls.some(call => call.url.includes('/rpc/withdraw_social_connection'))).toBe(true);
  });
  it('permits a linked guardian to block the known child profile', async () => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [viewer] });
    const res = await request(createApp()).post('/api/v1/profiles/ana/block').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(calls.some(call => call.method === 'POST' && call.url.includes('/rest/v1/blocks'))).toBe(true);
  });
});
