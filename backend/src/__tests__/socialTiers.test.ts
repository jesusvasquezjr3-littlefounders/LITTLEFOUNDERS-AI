import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * E.8 age-tiered social layer, E.9 comparison metric and E.13 profile-content
 * review: direct API requests from every population, at Core's boundary.
 *
 * The tier itself is decided by the database (public.social_tier) and is
 * exercised against real PostgreSQL in
 * database/scripts/verify-social-tiers-postgres.py; here each account's tier
 * is what that function would answer, and the suite proves Core honours it on
 * every route: what a viewer sees, how they may connect, and that no route
 * lets a caller name another account as the requester or the deciding teen.
 */

type Tier = 'guardian' | 'teen' | 'adult' | 'closed' | null;
interface Account { id: string; username: string; displayName: string; tier: Tier; roles?: string[]; guardians?: string[] }

const A = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const TEEN: Account = { id: A(1), username: 'rio', displayName: 'Río', tier: 'teen' };
const ADULT: Account = { id: A(2), username: 'marta', displayName: 'Marta', tier: 'adult', roles: ['universal'] };
const KID: Account = { id: A(3), username: 'beto', displayName: 'Beto', tier: 'guardian', roles: ['universal', 'kid'], guardians: [A(5)] };
const GUEST: Account = { id: A(4), username: 'guest_one', displayName: 'Guest', tier: 'closed' };
const TUTOR: Account = { id: A(5), username: 'tutor_ana', displayName: 'Ana', tier: 'adult', roles: ['universal', 'parent'] };
const STRANGER: Account = { id: A(6), username: 'omar', displayName: 'Omar', tier: 'adult', roles: ['universal'] };
const UNSCREENED: Account = { id: A(7), username: 'nadie', displayName: 'Nadie', tier: 'closed', roles: ['universal'] };
const TEEN_TUTOR: Account = { id: A(8), username: 'papa_rio', displayName: 'Papá', tier: 'adult', roles: ['universal', 'parent'] };
const OTHER_TEEN: Account = { id: A(9), username: 'luz', displayName: 'Luz', tier: 'teen' };
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

interface World {
  accounts: Account[];
  follows: [string, string][];
  consents: [string, string][];
  approvals: [string, string][];
  pendingTeen: [string, string][];
  requestTeen?: { status: number; body: unknown };
  decideTeen?: { status: number; body: unknown };
  removeFollower?: { status: number; body: unknown };
  metrics?: unknown;
  permissions?: string[];
  /** S-03: accounts opted in AND still eligible (public.teen_profile_discoverable). */
  discoverable?: string[];
  /** S-03: accounts that may opt in now (public.teen_discoverable_eligible). */
  eligible?: string[];
  setDiscoverable?: { status: number; body: unknown };
}

interface Call { url: string; method: string; body?: string }

function world(overrides: Partial<World> = {}): World {
  return { accounts: [TEEN, ADULT, KID, GUEST, TUTOR, STRANGER, UNSCREENED, TEEN_TUTOR, OTHER_TEEN], follows: [], consents: [], approvals: [], pendingTeen: [], ...overrides };
}

function row(a: Account) {
  return { user_id: a.id, display_name: a.displayName, username: a.username, locale: 'es-MX', theme: 'system', cover: { preset: 'sunset' }, birth_date: null, created_at: '2026-07-12T00:00:00Z' };
}

function stub(w: World) {
  const calls: Call[] = [];
  const byId = (id: string | undefined) => w.accounts.find((a) => a.id === id);
  const param = (url: string, key: string) => new RegExp(`${key}=eq\\.([^&]+)`).exec(url)?.[1];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body as string | undefined;
    calls.push({ url, method, body });
    const json = (b: unknown, status = 200) => Promise.resolve(jsonResponse(status, b));
    const args = body ? JSON.parse(body) as Record<string, string> : {};

    if (url.includes('/rpc/social_tier')) return json(byId(args.p_user)?.tier ?? null);
    if (url.includes('/rpc/has_current_teen_consent')) return json(w.consents.some(([v, s]) => v === args.p_viewer && s === args.p_subject));
    if (url.includes('/rpc/has_current_social_approval')) return json(w.approvals.some(([v, s]) => v === args.p_viewer && s === args.p_subject));
    if (url.includes('/rpc/request_teen_connection')) return json(w.requestTeen?.body ?? REQUEST_ID, w.requestTeen?.status ?? 200);
    if (url.includes('/rpc/decide_teen_connection')) return json(w.decideTeen?.body ?? 'accepted', w.decideTeen?.status ?? 200);
    if (url.includes('/rpc/remove_social_follower')) return json(w.removeFollower?.body ?? true, w.removeFollower?.status ?? 200);
    if (url.includes('/rpc/request_social_connection')) return json(REQUEST_ID);
    if (url.includes('/rpc/social_safety_metrics')) return json(w.metrics ?? null);
    if (url.includes('/rpc/teen_profile_discoverable')) return json((w.discoverable ?? []).includes(args.p_user));
    if (url.includes('/rpc/teen_discoverable_eligible')) return json((w.eligible ?? []).includes(args.p_user));
    if (url.includes('/rpc/set_teen_profile_discoverable')) {
      return w.setDiscoverable ? json(w.setDiscoverable.body, w.setDiscoverable.status) : json((JSON.parse(body!) as { p_discoverable: boolean }).p_discoverable);
    }
    if (url.includes('/rpc/get_completed_course_badges')) return json([]);
    if (url.includes('/rpc/')) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes('/rest/v1/staff_sightings')) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes('/rest/v1/admin_permissions')) return json((w.permissions ?? []).map((permission) => ({ user_id: STRANGER.id, permission })));

    if (url.includes('/rest/v1/profiles')) {
      if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes('user_id=in.(')) {
        const ids = /user_id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',') ?? [];
        return json(ids.map(byId).filter(Boolean).map((a) => ({ user_id: a!.id, display_name: a!.displayName, username: a!.username })));
      }
      const username = param(url, 'username');
      if (username) return json(w.accounts.filter((a) => a.username === username).map(row));
      const id = param(url, 'user_id');
      return json(w.accounts.filter((a) => a.id === id).map(row));
    }
    if (url.includes('/rest/v1/avatars')) return json(url.includes('user_id=in.(') ? [] : [{ options: { top: ['bob'] } }]);
    if (url.includes('/rest/v1/user_roles')) {
      if (url.includes('user_id=in.(')) {
        const ids = /user_id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',') ?? [];
        return json(ids.filter((id) => byId(id)?.roles?.includes('parent')).map((user_id) => ({ user_id })));
      }
      const roles = byId(param(url, 'user_id'))?.roles ?? [];
      const wanted = param(url, 'role');
      return json((wanted ? roles.filter((r) => r === wanted) : roles).map((role) => ({ role })));
    }
    if (url.includes('/rest/v1/guardian_links')) {
      const kid = param(url, 'kid_user_id');
      const parent = param(url, 'parent_user_id');
      const guardians = byId(kid)?.guardians ?? [];
      if (parent) return json(guardians.includes(parent) ? [{ id: REQUEST_ID }] : []);
      return json(guardians.map((parent_user_id) => ({ parent_user_id })));
    }
    if (url.includes('/rest/v1/parent_verifications')) return json([]);
    if (url.includes('/rest/v1/blocks')) return json([]);
    if (url.includes('/rest/v1/social_connection_requests')) return json([]);
    if (url.includes('/rest/v1/social_consent_requests')) {
      const requester = param(url, 'requester_id');
      const subject = param(url, 'subject_id');
      if (requester) return json(w.pendingTeen.some(([r, s]) => r === requester && s === subject) ? [{ id: REQUEST_ID }] : []);
      return json(w.pendingTeen.filter(([, s]) => s === subject).map(([r, s]) => ({
        id: REQUEST_ID, requester_id: r, subject_id: s, status: 'pending', requested_at: '2026-09-24T10:00:00+00:00',
      })));
    }
    if (url.includes('/rest/v1/follows')) {
      if (method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
      const follower = param(url, 'follower_id');
      const followed = param(url, 'followed_id');
      if (follower && followed) return json(w.follows.some(([f, t]) => f === follower && t === followed) ? [{ follower_id: follower, id: 1 }] : []);
      if (followed) return json(w.follows.filter(([, t]) => t === followed).map(([f]) => ({ follower_id: f })));
      if (follower) return json(w.follows.filter(([f]) => f === follower).map(([, t]) => ({ followed_id: t })));
      return json([]);
    }
    if (url.includes('/rest/v1/learning_stats')) {
      return json([{ xp_points: 40, minutes_learned: 12, lessons_completed: 3, streak_days: 2, longest_streak: 2, last_active_date: '2026-09-24' }]);
    }
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const as = (viewer: Account, extra: Record<string, unknown> = {}) => `Bearer ${mintToken({ sub: viewer.id, ...extra })}`;
const get = (viewer: Account, path: string) => request(createApp()).get(`/api/v1${path}`).set('Authorization', as(viewer));
const post = (viewer: Account, path: string, body: unknown = {}) => request(createApp()).post(`/api/v1${path}`).set('Authorization', as(viewer)).send(body as object);
const wrote = (calls: Call[], fragment: string) => calls.some((c) => c.url.includes(fragment) && c.method !== 'GET');

describe('E.8 — what each population sees of an independent teen', () => {
  it('a stranger adult gets only the private card: no name, stats, badges, dates or counts', async () => {
    stub(world());
    const res = await get(STRANGER, '/profiles/rio');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      visibility: 'private', username: 'rio', cover: { preset: 'sunset' }, avatarOptions: { top: ['bob'] },
      isSelf: false, isFollowing: false, requiresGuardianApproval: false, connection: 'teenRequest', requestPending: false,
    });
  });

  it('the card shows a pending request once one exists', async () => {
    stub(world({ pendingTeen: [[STRANGER.id, TEEN.id]] }));
    expect((await get(STRANGER, '/profiles/rio')).body.data.requestPending).toBe(true);
  });

  it('an accepted connection, an account the teen follows, and the teen’s own Tutor see the whole profile', async () => {
    for (const [viewer, w] of [
      [STRANGER, world({ consents: [[STRANGER.id, TEEN.id]], follows: [[STRANGER.id, TEEN.id]] })],
      [STRANGER, world({ follows: [[TEEN.id, STRANGER.id]] })],
      [TEEN_TUTOR, world({ accounts: [{ ...TEEN, guardians: [TEEN_TUTOR.id] }, TEEN_TUTOR, STRANGER] })],
    ] as const) {
      stub(w);
      const res = await get(viewer, '/profiles/rio');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ visibility: 'full', displayName: 'Río', username: 'rio' });
      // E.13: a minor's activity date never leaves to another account.
      expect(res.body.data.learningStats.lastActiveDate).toBeNull();
      expect(res.body.data).not.toHaveProperty('followers');
    }
  });

  it('the teen sees its own activity date', async () => {
    stub(world());
    expect((await get(TEEN, '/profiles/rio')).body.data.learningStats.lastActiveDate).toBe('2026-09-24');
  });

  it('a teen’s followers/following lists stay closed to a card-level viewer', async () => {
    stub(world({ follows: [[OTHER_TEEN.id, TEEN.id]] }));
    expect((await get(STRANGER, '/profiles/rio/followers')).status).toBe(404);
    expect((await get(STRANGER, '/profiles/rio/following')).status).toBe(404);
  });

  it('a private teen never appears in another account’s lists to an unconnected viewer', async () => {
    stub(world({ follows: [[TEEN.id, ADULT.id], [STRANGER.id, ADULT.id]] }));
    const res = await get(OTHER_TEEN, '/profiles/marta/followers');
    expect(res.status).toBe(200);
    expect(res.body.data.users.map((u: { username: string }) => u.username)).toEqual(['omar']);
  });
});

describe('E.8 — closed tier (guests, unscreened) and the strictest tier', () => {
  it.each([GUEST, UNSCREENED])('%s sees no profile and cannot connect', async (viewer) => {
    const calls = stub(world());
    expect((await get(viewer, '/profiles/marta')).status).toBe(404);
    expect((await post(viewer, '/profiles/marta/follow')).status).toBe(404);
    expect((await post(viewer, '/profiles/rio/connection-request')).status).toBe(404);
    expect(wrote(calls, '/rest/v1/follows') || wrote(calls, 'request_teen_connection')).toBe(false);
  });

  it('nobody sees a guest profile', async () => {
    stub(world());
    expect((await get(STRANGER, '/profiles/guest_one')).status).toBe(404);
  });

  it('an unreadable tier is no access, never an adult', async () => {
    stub(world({ accounts: [{ ...ADULT, tier: null }, STRANGER] }));
    expect((await get(STRANGER, '/profiles/marta')).status).toBe(404);
  });

  it('a child sees a public adult but its Tutor manages its connections: follow refused, no write', async () => {
    const calls = stub(world());
    const res = await get(KID, '/profiles/omar');
    expect(res.body.data).toMatchObject({ visibility: 'full', connection: 'managed' });
    const follow = await post(KID, '/profiles/omar/follow');
    expect(follow.status).toBe(403);
    expect(follow.body.error.code).toBe('GUARDIAN_MANAGED_CONNECTIONS');
    expect(wrote(calls, '/rest/v1/follows')).toBe(false);
  });

  it('a child may follow inside its family and back to an approved connection', async () => {
    let calls = stub(world());
    expect((await get(KID, '/profiles/tutor_ana')).body.data.connection).toBe('follow');
    expect((await post(KID, '/profiles/tutor_ana/follow')).status).toBe(200);
    expect(calls.some((c) => c.url.includes('/rest/v1/follows') && c.method === 'POST')).toBe(true);
    calls = stub(world({ approvals: [[STRANGER.id, KID.id]] }));
    expect((await post(KID, '/profiles/omar/follow')).status).toBe(200);
  });

  it('a child cannot ask a teen to connect, and sees the teen only as a card', async () => {
    const calls = stub(world());
    expect((await get(KID, '/profiles/rio')).body.data).toMatchObject({ visibility: 'private', connection: 'managed' });
    const res = await post(KID, '/profiles/rio/connection-request');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GUARDIAN_MANAGED_CONNECTIONS');
    expect(calls.some((c) => c.url.includes('request_teen_connection'))).toBe(false);
  });

  it('an outsider still cannot find a child at all (E.1 unchanged)', async () => {
    stub(world());
    expect((await get(STRANGER, '/profiles/beto')).status).toBe(404);
    expect((await get(TEEN, '/profiles/beto')).status).toBe(404);
  });
});

describe('E.8 — the teen decides who connects', () => {
  it('a follow into a teen is refused: only the teen’s consent creates the connection', async () => {
    const calls = stub(world({ follows: [[TEEN.id, STRANGER.id]] }));
    const res = await post(STRANGER, '/profiles/rio/follow');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBJECT_CONSENT_REQUIRED');
    expect(wrote(calls, '/rest/v1/follows')).toBe(false);
  });

  it('a request binds the session requester and the resolved teen, and refuses identity fields', async () => {
    const calls = stub(world());
    expect((await post(STRANGER, '/profiles/rio/connection-request', { requesterId: ADULT.id })).status).toBe(400);
    expect(calls.some((c) => c.url.includes('request_teen_connection'))).toBe(false);
    const res = await post(STRANGER, '/profiles/rio/connection-request');
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ requestId: REQUEST_ID, status: 'pending', following: false, decidedBy: 'subject' });
    expect(JSON.parse(calls.find((c) => c.url.includes('request_teen_connection'))!.body!)).toEqual({ p_requester_id: STRANGER.id, p_subject_id: TEEN.id });
    expect(wrote(calls, '/rest/v1/follows')).toBe(false);
  });

  it.each([
    ['SOCIAL_REQUEST_COOLDOWN', 409, 'SOCIAL_REQUEST_COOLDOWN'],
    ['SOCIAL_REQUEST_LIMIT', 429, 'SOCIAL_REQUEST_LIMIT'],
    ['SOCIAL_ALREADY_CONNECTED', 409, 'SOCIAL_ALREADY_CONNECTED'],
    ['PROFILE_REVIEW_REQUIRED', 403, 'PROFILE_REVIEW_REQUIRED'],
    ['SOCIAL_REQUEST_UNAVAILABLE', 404, 'NOT_FOUND'],
    ['SOMETHING_ELSE', 502, 'DATA_UNAVAILABLE'],
  ])('maps the database refusal %s to %i without claiming a request', async (message, status, code) => {
    stub(world({ requestTeen: { status: 400, body: { code: 'P0001', message } } }));
    const res = await post(STRANGER, '/profiles/rio/connection-request');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.data).toBeNull();
  });

  it('the teen reads only its own queue, with who asked', async () => {
    const calls = stub(world({ pendingTeen: [[STRANGER.id, TEEN.id]] }));
    const res = await get(TEEN, '/profile/connection-requests');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      requests: [{ requestId: REQUEST_ID, requestedAt: '2026-09-24T10:00:00+00:00', requester: { username: 'omar', displayName: 'Omar', avatarOptions: {} } }],
      nextOffset: null,
    });
    expect(calls.find((c) => c.url.includes('/social_consent_requests'))!.url).toContain(`subject_id=eq.${TEEN.id}`);
    expect((await get(TEEN, `/profile/connection-requests?subject_id=${OTHER_TEEN.id}`)).status).toBe(400);
  });

  it('the decision is always the session’s own, and every outcome is mapped honestly', async () => {
    const calls = stub(world());
    const res = await post(TEEN, `/profile/connection-requests/${REQUEST_ID}/decision`, { decision: 'accept' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ requestId: REQUEST_ID, status: 'accepted' });
    expect(JSON.parse(calls.find((c) => c.url.includes('decide_teen_connection'))!.body!)).toEqual({ p_request_id: REQUEST_ID, p_subject_id: TEEN.id, p_accept: true });
    for (const bad of [{ decision: 'approve' }, { decision: 'accept', subjectId: OTHER_TEEN.id }, {}]) {
      expect((await post(TEEN, `/profile/connection-requests/${REQUEST_ID}/decision`, bad)).status).toBe(400);
    }
    expect((await post(TEEN, '/profile/connection-requests/not-a-uuid/decision', { decision: 'accept' })).status).toBe(400);
    for (const [body, status] of [
      [{ code: 'P0001', message: 'SOCIAL_REQUEST_NOT_FOUND' }, 404],
      [{ code: 'P0001', message: 'SOCIAL_DECISION_CONFLICT' }, 409],
      [{ code: 'P0001', message: 'SOCIAL_CONNECTION_BLOCKED' }, 409],
      [{ code: 'P0001', message: 'PROFILE_REVIEW_REQUIRED' }, 403],
      [{ message: 'down' }, 502],
    ] as const) {
      stub(world({ decideTeen: { status: 400, body } }));
      expect((await post(TEEN, `/profile/connection-requests/${REQUEST_ID}/decision`, { decision: 'decline' })).status).toBe(status);
    }
    stub(world({ decideTeen: { status: 200, body: 'accepted' } }));
    expect((await post(TEEN, `/profile/connection-requests/${REQUEST_ID}/decision`, { decision: 'decline' })).status).toBe(502);
  });

  it('the teen removes a follower; a non-follower is 404 without any write', async () => {
    let calls = stub(world({ follows: [[STRANGER.id, TEEN.id]] }));
    const res = await request(createApp()).delete('/api/v1/profile/followers/omar').set('Authorization', as(TEEN));
    expect(res.status).toBe(200);
    expect(JSON.parse(calls.find((c) => c.url.includes('remove_social_follower'))!.body!)).toEqual({ p_subject_id: TEEN.id, p_follower_id: STRANGER.id });
    calls = stub(world());
    expect((await request(createApp()).delete('/api/v1/profile/followers/omar').set('Authorization', as(TEEN))).status).toBe(404);
    expect(calls.some((c) => c.url.includes('remove_social_follower'))).toBe(false);
    stub(world({ follows: [[STRANGER.id, TEEN.id]], removeFollower: { status: 500, body: { message: 'down' } } }));
    expect((await request(createApp()).delete('/api/v1/profile/followers/omar').set('Authorization', as(TEEN))).status).toBe(502);
  });
});

describe('E.13 — a minor’s fields that could locate them', () => {
  it('a flagged teen is hidden from everyone but itself and its Tutor', async () => {
    const flagged = { ...TEEN, username: 'rio_2011', guardians: [TEEN_TUTOR.id] };
    stub(world({ accounts: [flagged, STRANGER, TEEN_TUTOR], consents: [[STRANGER.id, TEEN.id]], follows: [[STRANGER.id, TEEN.id]] }));
    expect((await get(STRANGER, '/profiles/rio_2011')).status).toBe(404);
    expect((await get(TEEN_TUTOR, '/profiles/rio_2011')).status).toBe(200);
  });

  it('a flagged child is hidden from an approved outsider but not from its family', async () => {
    const flagged = { ...KID, displayName: 'Beto Escuela Juárez' };
    stub(world({ accounts: [flagged, STRANGER, TUTOR], approvals: [[STRANGER.id, KID.id]] }));
    expect((await get(STRANGER, '/profiles/beto')).status).toBe(404);
    expect((await get(TUTOR, '/profiles/beto')).status).toBe(200);
    stub(world({ approvals: [[STRANGER.id, KID.id]] }));
    expect((await get(STRANGER, '/profiles/beto')).status).toBe(200);
  });

  it('a teen cannot rename itself to a locating name; an adult can; the owner learns which field', async () => {
    let calls = stub(world());
    for (const [body, fields] of [
      [{ username: 'ig_rio' }, ['username']], [{ displayName: 'Río 555 123 4567' }, ['displayName']],
      [{ username: 'rio_ttv', displayName: 'Rio @ Colegio Madrid' }, ['username', 'displayName']],
    ] as const) {
      const res = await request(createApp()).patch('/api/v1/profile').set('Authorization', as(TEEN)).send(body);
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({ code: 'PROFILE_FIELD_UNSAFE', fields });
    }
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect((await request(createApp()).patch('/api/v1/profile').set('Authorization', as(TEEN)).send({ displayName: 'Río M' })).status).toBe(200);
    calls = stub(world());
    expect((await request(createApp()).patch('/api/v1/profile').set('Authorization', as(ADULT)).send({ displayName: 'Marta 1985 Maple Street' })).status).toBe(200);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(true);
    stub(world({ accounts: [{ ...TEEN, displayName: 'Río TikTok' }] }));
    const own = await get(TEEN, '/profile');
    expect(own.body.data.profileReview).toEqual({ flagged: true, fields: ['displayName'] });
    expect(own.body.data.social).toEqual({ tier: 'teen', privateProfile: true, discoverable: { canChoose: false, enabled: false } });
  });

  it('an unreadable tier refuses a rename rather than skipping the review', async () => {
    const calls = stub(world({ accounts: [{ ...TEEN, tier: null }] }));
    expect((await request(createApp()).patch('/api/v1/profile').set('Authorization', as(TEEN)).send({ username: 'rio_ok' })).status).toBe(502);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('a flagged teen cannot follow outside its family', async () => {
    const calls = stub(world({ accounts: [{ ...TEEN, displayName: 'Río www.rio.tv' }, STRANGER] }));
    const res = await post(TEEN, '/profiles/omar/follow');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROFILE_REVIEW_REQUIRED');
    expect(wrote(calls, '/rest/v1/follows')).toBe(false);
  });
});

describe('E.9 — no follower or following count on any profile surface', () => {
  it('the public profile of an adult carries no count and issues no count query', async () => {
    const calls = stub(world({ follows: [[STRANGER.id, ADULT.id], [TEEN.id, ADULT.id]] }));
    const res = await get(STRANGER, '/profiles/marta');
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('followers');
    expect(res.body.data).not.toHaveProperty('following');
    expect(calls.some((c) => c.url.includes('/rest/v1/follows') && c.url.includes('select=follower_id') && !c.url.includes('follower_id=eq.'))).toBe(false);
  });
});

describe('E.5 in lists — the Tutor badge is not a list-wide signal either', () => {
  it('a stranger listing an adult’s followers does not see the parent role as a badge', async () => {
    stub(world({ follows: [[TUTOR.id, ADULT.id]] }));
    const res = await get(STRANGER, '/profiles/marta/followers');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([{ userId: TUTOR.id, displayName: 'Ana', username: 'tutor_ana', avatarOptions: {}, isTutor: false }]);
  });
});

describe('Appendix J social-safety metrics (E.8 tiers, E.13 coverage)', () => {
  const metrics = {
    accountsByTier: { guardian: 6, teen: 25, adult: 5, closed: 4 },
    profileReview: { inScope: 31, reviewed: 31, flagged: 1, guardianTierInScope: 6, guardianTierReviewed: 6 },
    teenConsent: { pending: 20, accepted: 0, declined: 1, withdrawnOrRemoved: 3 },
  };
  const staff = { ...STRANGER, roles: ['admin'] };

  it('requires view_analytics and returns counts with the coverage rates', async () => {
    stub(world({ accounts: [staff], metrics, permissions: ['view_analytics'] }));
    const res = await get(staff, '/admin/analytics/social-safety');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...metrics, reviewCoverage: 1, guardianTierReviewCoverage: 1 });
    stub(world({ accounts: [staff], metrics, permissions: ['manage_content'] }));
    expect((await get(staff, '/admin/analytics/social-safety')).status).toBe(403);
    stub(world({ metrics }));
    expect((await get(TUTOR, '/admin/analytics/social-safety')).status).toBe(403);
  });

  it('fails closed on a malformed answer or extra query fields', async () => {
    stub(world({ accounts: [staff], metrics: { ...metrics, extra: 1 }, permissions: ['view_analytics'] }));
    expect((await get(staff, '/admin/analytics/social-safety')).status).toBe(502);
    stub(world({ accounts: [staff], metrics, permissions: ['view_analytics'] }));
    expect((await get(staff, '/admin/analytics/social-safety?tier=teen')).status).toBe(400);
  });
});

/*
 * S-03 (owner decision OD-27 (2)): a 16- or 17-year-old may opt in to a
 * discoverable profile. The database decides eligibility (teen tier, age
 * evidence proving 16, unflagged) and is exercised against PostgreSQL in
 * database/scripts/verify-teen-discoverable-postgres.py; here Core honours it.
 */
describe('S-03 — a 16- or 17-year-old may opt in to a discoverable profile', () => {
  const put = (viewer: Account, body: unknown, extra: Record<string, unknown> = {}) =>
    request(createApp()).put('/api/v1/profile/discoverable').set('Authorization', as(viewer, extra)).send(body as object);

  it('private stays the default: without an opt-in a stranger gets the card', async () => {
    stub(world({ eligible: [TEEN.id] }));
    expect((await get(STRANGER, '/profiles/rio')).body.data.visibility).toBe('private');
  });

  it('an opted-in teen is discoverable to a stranger, while a follow still needs the teen and stats stay hidden', async () => {
    const calls = stub(world({ discoverable: [TEEN.id], eligible: [TEEN.id] }));
    const res = await get(STRANGER, '/profiles/rio');
    expect(res.body.data).toMatchObject({ visibility: 'full', displayName: 'Río', connection: 'teenRequest' });
    expect(res.body.data.learningStats.lastActiveDate).toBeNull();
    const follow = await post(STRANGER, '/profiles/rio/follow');
    expect(follow.status).toBe(403);
    expect(follow.body.error.code).toBe('SUBJECT_CONSENT_REQUIRED');
    expect(wrote(calls, '/rest/v1/follows')).toBe(false);
    // Lists: a discoverable teen may appear in another account's lists.
    stub(world({ discoverable: [TEEN.id], follows: [[TEEN.id, ADULT.id]] }));
    const list = await get(OTHER_TEEN, '/profiles/marta/followers');
    expect(list.body.data.users.map((u: { username: string }) => u.username)).toEqual(['rio']);
  });

  it('a flagged profile stays hidden even when opted in (E.13 is checked first)', async () => {
    stub(world({ accounts: [{ ...TEEN, displayName: 'Río TikTok' }, STRANGER], discoverable: [TEEN.id] }));
    expect((await get(STRANGER, '/profiles/rio')).status).toBe(404);
  });

  it('a guest or unscreened viewer still sees nothing', async () => {
    stub(world({ discoverable: [TEEN.id] }));
    expect((await get(GUEST, '/profiles/rio')).status).toBe(404);
    expect((await get(UNSCREENED, '/profiles/rio')).status).toBe(404);
  });

  it('the owner reads the choice; privateProfile turns false only while discoverable', async () => {
    stub(world({ eligible: [TEEN.id] }));
    expect((await get(TEEN, '/profile')).body.data.social).toEqual({ tier: 'teen', privateProfile: true, discoverable: { canChoose: true, enabled: false } });
    stub(world({ eligible: [TEEN.id], discoverable: [TEEN.id] }));
    expect((await get(TEEN, '/profile')).body.data.social).toEqual({ tier: 'teen', privateProfile: false, discoverable: { canChoose: true, enabled: true } });
    stub(world());
    expect((await get(ADULT, '/profile')).body.data.social).toEqual({ tier: 'adult', privateProfile: false, discoverable: { canChoose: false, enabled: false } });
    expect((await get(KID, '/profile')).body.data.social.discoverable).toEqual({ canChoose: false, enabled: false });
  });

  it('an eligible teen opts in and out explicitly; each change goes through the audited database call', async () => {
    const calls = stub(world({ eligible: [TEEN.id], discoverable: [TEEN.id] }));
    const on = await put(TEEN, { discoverable: true });
    expect(on.status).toBe(200);
    expect(on.body.data).toEqual({ discoverable: { canChoose: true, enabled: true } });
    const set = calls.find((c) => c.url.includes('/rpc/set_teen_profile_discoverable'));
    expect(JSON.parse(set!.body!)).toEqual({ p_user: TEEN.id, p_discoverable: true });
    stub(world({ eligible: [TEEN.id] }));
    const off = await put(TEEN, { discoverable: false });
    expect(off.status).toBe(200);
    expect(off.body.data.discoverable.enabled).toBe(false);
  });

  it.each([
    ['a 13-to-15-year-old (or a teen whose age cannot prove 16)', TEEN],
    ['a parent-created child', KID],
    ['an adult', ADULT],
    ['an unscreened account', UNSCREENED],
  ])('refuses %s turning it on with the database refusal', async (_label, viewer) => {
    stub(world({ setDiscoverable: { status: 400, body: { code: 'P0001', message: 'DISCOVERABLE_NOT_ELIGIBLE' } } }));
    const res = await put(viewer, { discoverable: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DISCOVERABLE_NOT_ELIGIBLE');
  });

  it('refuses a guest before the database, and any body that is not one literal boolean', async () => {
    const calls = stub(world());
    expect((await put(GUEST, { discoverable: true }, { is_anonymous: true })).status).toBe(403);
    for (const body of [{}, { discoverable: 'yes' }, { discoverable: 1 }, { discoverable: true, userId: OTHER_TEEN.id }]) {
      expect((await put(TEEN, body)).status).toBe(400);
    }
    expect(calls.some((c) => c.url.includes('/rpc/set_teen_profile_discoverable'))).toBe(false);
    expect((await request(createApp()).put('/api/v1/profile/discoverable').send({ discoverable: true })).status).toBe(401);
  });

  it('never reports a choice the database did not confirm', async () => {
    stub(world({ setDiscoverable: { status: 200, body: null } }));
    expect((await put(TEEN, { discoverable: true })).status).toBe(502);
  });
});
