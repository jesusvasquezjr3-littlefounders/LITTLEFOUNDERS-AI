import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { admissionStubResponse, jsonResponse, mintToken } from './helpers.js';

/*
 * E.1 search/suggestion inventory — adversarial boundary tests.
 *
 * A kid-role profile must not resolve, appear in any username lookup, or be
 * reachable through any read/write surface for an unrelated caller. These
 * tests walk every Core username-resolution surface with the same stub
 * transport as the existing profile suite (profile.test.ts) and assert the
 * approved-connection / own-profile-only / blocked-restricted boundary.
 */

const KID_ROW = {
  user_id: '11111111-1111-4111-8111-111111111111',
  display_name: 'Ana',
  username: 'ana',
  locale: 'es-MX',
  theme: 'system',
  cover: { preset: 'sunset' },
  birth_date: '2015-05-01',
  created_at: '2026-07-12T00:00:00Z',
};

const VIEWER = '22222222-2222-4222-8222-222222222222';
const GUARDIAN = '33333333-3333-4333-8333-333333333333';
const STAFF_ID = '44444444-4444-4444-8444-444444444444';

const ZERO_STATS = { xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0 };

afterEach(() => vi.unstubAllGlobals());

interface StubOpts {
  approvalResult?: unknown;
  targetRoles?: string[] | null;
  guardianIds?: string[] | null;
  viewerGuardianIds?: string[] | null;
  profileRows?: unknown[] | null;
  profileStatus?: number;
  blockedRows?: unknown[];
  followEdges?: { follower_id?: string; followed_id?: string }[];
  hydrateProfiles?: unknown[] | null;
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
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });

      if (url.includes('/rpc/social_tier')) {
        // The database's E.8 tier: the subject's follows its roles; every other account is a screened adult.
        const id = (JSON.parse(String(init?.body ?? '{}')) as { p_user?: string }).p_user;
        if (id !== KID_ROW.user_id) return Promise.resolve(jsonResponse(200, 'adult'));
        if (opts.targetRoles === null) return Promise.resolve(jsonResponse(200, null));
        return Promise.resolve(jsonResponse(200, (opts.targetRoles ?? ['parent']).includes('kid') ? 'guardian' : 'adult'));
      }
      if (url.includes('/rpc/has_current_social_approval')) return Promise.resolve(jsonResponse(200, opts.approvalResult ?? false));
      if (url.includes('/rpc/withdraw_social_connection')) return Promise.resolve(jsonResponse(200, true));
      if (url.includes('/rpc/request_social_connection')) return Promise.resolve(jsonResponse(200, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
      if (url.includes('/rest/v1/profiles') && url.includes('user_id=in.')) {
        return Promise.resolve(jsonResponse(200, opts.hydrateProfiles ?? []));
      }
      if (url.includes('/rest/v1/profiles')) {
        return Promise.resolve(jsonResponse(opts.profileStatus ?? 200, opts.profileRows === undefined ? [KID_ROW] : opts.profileRows));
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
        const ids = url.includes(`kid_user_id=eq.${KID_ROW.user_id}`) ? opts.guardianIds : (opts.viewerGuardianIds ?? opts.guardianIds);
        return Promise.resolve(jsonResponse(200, ids === null ? null : (ids ?? []).map(parent_user_id => ({ parent_user_id }))));
      }
      if (url.includes('/rest/v1/user_roles')) {
        if (url.includes('role=eq.')) {
          const wanted = /role=eq\.([a-z_]+)/.exec(url)?.[1];
          const rows = opts.targetRoles === null ? null : (opts.targetRoles ?? ['parent']).filter(role => role === wanted).map(role => ({ role }));
          return Promise.resolve(jsonResponse(200, rows));
        }
        return Promise.resolve(jsonResponse(200, opts.targetRoles === null ? null : (opts.targetRoles ?? ['parent']).map(role => ({ role }))));
      }
      if (url.includes('/rest/v1/learning_stats')) {
        return Promise.resolve(jsonResponse(200, [ZERO_STATS]));
      }
      if (url.includes('/rpc/get_completed_course_badges')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/blocks')) {
        return Promise.resolve(jsonResponse(200, opts.blockedRows ?? []));
      }
      if (url.includes('/rest/v1/social_connection_requests')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/follows')) {
        if (url.includes('order=') && url.includes('limit=')) return Promise.resolve(jsonResponse(200, opts.followEdges ?? []));
        return Promise.resolve(jsonResponse(200, []));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

function auth(sub: string = VIEWER) {
  return { Authorization: `Bearer ${mintToken({ sub })}` };
}

describe('search surface — anonymous probes', () => {
  it.each([
    ['get', '/api/v1/profiles/ana'],
    ['get', '/api/v1/profiles/ana/followers'],
    ['get', '/api/v1/profiles/ana/following'],
    ['post', '/api/v1/profiles/ana/connection-request'],
    ['post', '/api/v1/profiles/ana/follow'],
    ['post', '/api/v1/profiles/ana/block'],
    ['delete', '/api/v1/profiles/ana/follow'],
    ['delete', '/api/v1/profiles/ana/block'],
  ] as const)('401s %s %s before any profile resolution', async (method, path) => {
    const calls = stub();
    const res = await request(createApp())[method](path).send({});
    expect(res.status).toBe(401);
    expect(calls.some((c) => c.url.includes('/rest/v1'))).toBe(false);
  });
});

describe('search surface — unrelated authenticated probe', () => {
  it.each(['', '/followers', '/following'])('404s an unrelated viewer at %s with no profile data', async (suffix) => {
    const calls = stub({ targetRoles: ['kid'] });
    const res = await request(createApp()).get(`/api/v1/profiles/ana${suffix}`).set(auth());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.data).toBeNull();
    expect(calls.some((c) => c.url.includes('/rest/v1/learning_stats'))).toBe(false);
  });

  it.each([
    ['post', '/connection-request'], ['post', '/follow'], ['post', '/block'],
    ['delete', '/follow'], ['delete', '/block'],
  ] as const)('refuses %s %s without issuing any write', async (method, suffix) => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [GUARDIAN], viewerGuardianIds: [] });
    const res = await request(createApp())[method](`/api/v1/profiles/ana${suffix}`).set(auth()).send({});
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/follows'))).toBe(false);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/blocks'))).toBe(false);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/rest/v1/blocks'))).toBe(false);
    expect(calls.some((c) => c.url.includes('/rpc/withdraw_social_connection'))).toBe(false);
    expect(calls.some((c) => c.url.includes('/rpc/request_social_connection'))).toBe(false);
    if (method === 'post') expect(calls.some((c) => c.url.includes('/rpc/has_current_social_approval'))).toBe(true); // admission was consulted
  });
});

describe('search surface — blocked-direction probe', () => {
  it('answers a blocked viewer with the same envelope as an unknown username', async () => {
    stub({ targetRoles: ['kid'], blockedRows: [{ blocker_id: KID_ROW.user_id }] });
    const blocked = await request(createApp()).get('/api/v1/profiles/ana').set(auth());

    stub({ targetRoles: ['kid'], profileRows: [] });
    const unknown = await request(createApp()).get('/api/v1/profiles/ghost').set(auth());

    expect(blocked.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(blocked.body.error.code).toBe(unknown.body.error.code);
    expect(blocked.body.data).toBe(unknown.body.data);
  });

  it('refuses a blocked-direction write probe without a write', async () => {
    const calls = stub({ targetRoles: ['kid'], blockedRows: [{ blocker_id: KID_ROW.user_id }] });
    const res = await request(createApp()).post('/api/v1/profiles/ana/follow').set(auth());
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/rest/v1/follows'))).toBe(false);
  });
});

describe('search surface — malformed query refusal', () => {
  it.each(['ab', 'a'.repeat(21), 'with space!', 'UPPER-AND-DASH', '../ana'])('404s malformed username %j without a profile-store read', async (username) => {
    const calls = stub({ targetRoles: ['kid'] });
    const res = await request(createApp()).get(`/api/v1/profiles/${encodeURIComponent(username)}`).set(auth());
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.url.includes('/rest/v1/profiles?username=eq.'))).toBe(false);
  });
});

describe('search surface — approved-connection success', () => {
  it('serves an approved outsider only the whitelisted projection', async () => {
    const calls = stub({ targetRoles: ['kid'], guardianIds: [GUARDIAN], viewerGuardianIds: [], approvalResult: true });
    const res = await request(createApp()).get('/api/v1/profiles/ana').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      displayName: 'Ana',
      username: 'ana',
      cover: { preset: 'sunset' },
      avatarOptions: { top: ['bob'] },
      memberSince: KID_ROW.created_at,
      isFollowing: false,
      requiresGuardianApproval: true,
      isSelf: false,
      isTutor: false,
    });
    for (const field of ['email', 'birthDate', 'locale', 'theme']) {
      expect(res.body.data[field]).toBeUndefined();
    }
    const rpc = calls.find((c) => c.url.includes('/rpc/has_current_social_approval'));
    expect(JSON.parse(rpc?.body ?? '{}')).toEqual({ p_viewer: VIEWER, p_subject: KID_ROW.user_id });
  });
});

describe('search surface — own-profile self-search', () => {
  it('serves the own profile without family or approval evidence', async () => {
    const calls = stub({ targetRoles: ['kid'] });
    const res = await request(createApp()).get('/api/v1/profiles/ana').set(auth(KID_ROW.user_id));
    expect(res.status).toBe(200);
    expect(res.body.data.isSelf).toBe(true);
    expect(res.body.data.requiresGuardianApproval).toBe(true);
    expect(calls.some((c) => c.url.includes('/rpc/has_current_social_approval'))).toBe(false);
  });
});

describe('search surface — failed reads fail closed', () => {
  it('maps a failed profile read to NOT_FOUND, never a partial profile', async () => {
    stub({ targetRoles: ['kid'], profileRows: null });
    const res = await request(createApp()).get('/api/v1/profiles/ana').set(auth());
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });

  it('hides the profile when role evidence is unavailable', async () => {
    stub({ targetRoles: null });
    const res = await request(createApp()).get('/api/v1/profiles/ana').set(auth());
    expect(res.status).toBe(404);
  });

  it('hides the profile when the approval predicate does not answer', async () => {
    stub({ targetRoles: ['kid'], guardianIds: [GUARDIAN], viewerGuardianIds: [], approvalResult: null });
    const res = await request(createApp()).get('/api/v1/profiles/ana').set(auth());
    expect(res.status).toBe(404);
  });

  it('turns a failed own-list hydrate into an empty list, never raw identifiers', async () => {
    stub({ targetRoles: ['kid'], followEdges: [{ follower_id: KID_ROW.user_id }], hydrateProfiles: null });
    const res = await request(createApp()).get('/api/v1/profile/followers').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([]);
  });
});

describe('staff search surfaces keep their own grants', () => {
  it('lists a kid-role profile through the superadmin candidate search without social filtering', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const admission = admissionStubResponse(url);
        if (admission) return Promise.resolve(admission);
        calls.push(url);
        if (url.includes('/rest/v1/user_roles?user_id=eq.') && !url.includes('user_id=in.')) {
          return Promise.resolve(jsonResponse(200, [{ role: 'superadmin' }]));
        }
        if (url.includes('/rest/v1/profiles?or=')) {
          return Promise.resolve(jsonResponse(200, [
            { user_id: KID_ROW.user_id, display_name: 'Ana', username: 'ana', locale: 'es-MX', created_at: KID_ROW.created_at },
          ]));
        }
        if (url.includes('/rest/v1/user_roles') && url.includes('user_id=in.')) {
          return Promise.resolve(jsonResponse(200, [{ user_id: KID_ROW.user_id, role: 'kid' }]));
        }
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
    const res = await request(createApp()).get('/api/v1/admin/roles/candidates?q=ana').set(auth(STAFF_ID));
    expect(res.status).toBe(200);
    expect(res.body.data.candidates).toEqual([
      { userId: KID_ROW.user_id, displayName: 'Ana', username: 'ana', locale: 'es-MX', createdAt: KID_ROW.created_at, roles: ['kid'] },
    ]);
    expect(calls.some((c) => c.includes('/rpc/has_current_social_approval'))).toBe(false);
  });

  it('keeps the candidate search out of non-staff hands', async () => {
    stub({ targetRoles: ['universal'] });
    const res = await request(createApp()).get('/api/v1/admin/roles/candidates?q=ana').set(auth());
    expect(res.status).toBe(403);
  });
});
