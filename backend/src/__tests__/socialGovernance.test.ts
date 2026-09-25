import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';
import { AVATAR_ARRAY_KEYS, AVATAR_NUMBER_KEYS, projectAvatarOptions, projectCover } from '../services/profileShape.js';
import { MESSAGING_VOCABULARY, SOCIAL_RETENTION_WINDOWS, messagingWords } from '../services/socialGovernance.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * E.10, E.11 and E.12 standing guardrails at Core's boundary
 * (policy: docs/rebuild/policies/SOCIAL-GOVERNANCE.md).
 *
 * The rules themselves live in the database and are exercised against real
 * PostgreSQL by database/scripts/verify-social-governance-postgres.py. This
 * suite proves, by direct request from each population, that Core exposes
 * them only to the callers the policy names, never turns a failed database
 * answer into a reassuring number, never serves a legacy avatar or cover
 * that is not a cartoon option set or a preset, and has no route that is a
 * person-to-person messaging surface.
 */

const A = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
interface Account { id: string; username: string; roles: string[]; tier: string }
const STAFF: Account = { id: A(1), username: 'staff_one', roles: ['universal', 'admin'], tier: 'adult' };
const TUTOR: Account = { id: A(2), username: 'tutor_ana', roles: ['universal', 'parent'], tier: 'adult' };
const KID: Account = { id: A(3), username: 'beto', roles: ['universal', 'kid'], tier: 'guardian' };
const TEEN: Account = { id: A(4), username: 'rio', roles: ['universal'], tier: 'teen' };
const ADULT: Account = { id: A(5), username: 'marta', roles: ['universal'], tier: 'adult' };
const GUEST: Account = { id: A(6), username: 'guest_one', roles: [], tier: 'closed' };
const ACCOUNTS = [STAFF, TUTOR, KID, TEEN, ADULT, GUEST];

const RUN = {
  teenPendingExpired: 1, guardianPendingExpired: 2, teenClosedDeleted: 0, guardianClosedDeleted: 3,
  reportNotesCleared: 1, resolvedReportsDeleted: 0, resolvedCasesDeleted: 0, noticesDeleted: 4,
  unconsentedEdgesRemoved: 2, limit: 500, complete: true,
};
const METRICS = {
  windows: { ...SOCIAL_RETENTION_WINDOWS },
  overdue: { teenPending: 0, guardianPending: 0, teenClosed: 0, guardianClosed: 0, reportNotes: 0, resolvedReports: 0, resolvedCases: 0, notices: 0 },
  unconsentedChildEdges: 0,
  messagingSurfaces: [] as string[],
  offSchema: { avatars: 0, covers: 0 },
  lastSweep: { at: '2026-09-25T04:15:02.123456+00:00', counts: { ...RUN } },
};

interface World {
  run?: { status: number; body: unknown };
  metrics?: { status: number; body: unknown };
  permissions?: string[];
  avatar?: unknown;
  cover?: unknown;
  follows?: [string, string][];
}
interface Call { url: string; method: string; body?: string }

function stub(w: World = {}) {
  const calls: Call[] = [];
  const byId = (id: string | undefined) => ACCOUNTS.find((a) => a.id === id);
  const param = (url: string, key: string) => new RegExp(`${key}=eq\\.([^&]+)`).exec(url)?.[1];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body as string | undefined;
    calls.push({ url, method, body });
    const json = (b: unknown, status = 200) => Promise.resolve(jsonResponse(status, b));
    const args = body ? JSON.parse(body) as Record<string, string> : {};
    if (url.includes('/rpc/run_social_graph_retention')) return json(w.run ? w.run.body : { ...RUN, limit: Number(args.p_limit) }, w.run?.status ?? 200);
    if (url.includes('/rpc/social_governance_metrics')) return json(w.metrics ? w.metrics.body : METRICS, w.metrics?.status ?? 200);
    if (url.includes('/rpc/social_tier')) return json(byId(args.p_user)?.tier ?? null);
    if (url.includes('/rpc/get_completed_course_badges')) return json([]);
    if (url.includes('/rpc/')) return json(false);
    if (url.includes('/rest/v1/staff_sightings')) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes('/rest/v1/admin_permissions')) return json((w.permissions ?? []).map((permission) => ({ user_id: STAFF.id, permission })));
    if (url.includes('/rest/v1/user_roles')) {
      if (url.includes('user_id=in.(')) return json([]);
      const roles = byId(param(url, 'user_id'))?.roles ?? [];
      const wanted = param(url, 'role');
      return json((wanted ? roles.filter((r) => r === wanted) : roles).map((role) => ({ role })));
    }
    if (url.includes('/rest/v1/profiles')) {
      if (method !== 'GET') return Promise.resolve(new Response(null, { status: 204 }));
      const row = (a: Account) => ({ user_id: a.id, display_name: a.username, username: a.username, locale: 'en-US', theme: 'system', cover: w.cover ?? { preset: 'mint' }, birth_date: null, created_at: '2026-07-12T00:00:00Z' });
      if (url.includes('user_id=in.(')) {
        const ids = /user_id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',') ?? [];
        return json(ids.map(byId).filter(Boolean).map((a) => ({ user_id: a!.id, display_name: a!.username, username: a!.username })));
      }
      const username = param(url, 'username');
      if (username) return json(ACCOUNTS.filter((a) => a.username === username).map(row));
      return json(ACCOUNTS.filter((a) => a.id === param(url, 'user_id')).map(row));
    }
    if (url.includes('/rest/v1/avatars')) {
      if (method !== 'GET') return Promise.resolve(new Response(null, { status: 201 }));
      if (url.includes('user_id=in.(')) {
        const ids = /user_id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',') ?? [];
        return json(ids.map((user_id) => ({ user_id, options: w.avatar ?? { top: ['bob'] } })));
      }
      return json([{ options: w.avatar ?? { top: ['bob'] } }]);
    }
    if (url.includes('/rest/v1/follows')) {
      if (method !== 'GET') return Promise.resolve(new Response(null, { status: 201 }));
      const followed = param(url, 'followed_id');
      const follower = param(url, 'follower_id');
      const follows = w.follows ?? [];
      if (follower && followed) return json(follows.some(([f, t]) => f === follower && t === followed) ? [{ follower_id: follower, id: 1 }] : []);
      if (followed) return json(follows.filter(([, t]) => t === followed).map(([f]) => ({ follower_id: f })));
      if (follower) return json(follows.filter(([f]) => f === follower).map(([, t]) => ({ followed_id: t })));
      return json([]);
    }
    if (url.includes('/rest/v1/learning_stats')) return json([{ xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null }]);
    if (url.includes('/rest/v1/')) return json([]);
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const bearer = (a: Account) => `Bearer ${mintToken({ sub: a.id })}`;
const sweep = (key: string | null = getConfig().INTERNAL_API_KEY, body: unknown = {}, as?: Account) => {
  const req = request(createApp()).post('/api/v1/internal/social-retention/run');
  if (key) req.set('x-internal-api-key', key);
  if (as) req.set('Authorization', bearer(as));
  return req.send(body as object);
};
const get = (a: Account | null, path: string) => {
  const req = request(createApp()).get(`/api/v1${path}`);
  return a ? req.set('Authorization', bearer(a)) : req;
};
const rpcCalls = (calls: Call[], name: string) => calls.filter((c) => c.url.includes(`/rpc/${name}`));

describe('E.11 retention sweep: internal key only, bounded, never a false zero', () => {
  it('refuses every caller without the internal key: no key, a wrong key, and signed-in staff, Tutor, child, teen and guest sessions', async () => {
    for (const as of [undefined, STAFF, TUTOR, KID, TEEN, GUEST]) {
      const calls = stub({ permissions: ['view_analytics', 'manage_users'] });
      const res = await sweep(null, {}, as);
      expect(res.status).toBe(403);
      expect(rpcCalls(calls, 'run_social_graph_retention')).toHaveLength(0);
    }
    const calls = stub();
    expect((await sweep('not-the-key')).status).toBe(403);
    expect(rpcCalls(calls, 'run_social_graph_retention')).toHaveLength(0);
  });

  it('runs one bounded sweep with the default page of 500 and returns the database counts', async () => {
    const calls = stub();
    const res = await sweep();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(RUN);
    const [call] = rpcCalls(calls, 'run_social_graph_retention');
    expect(JSON.parse(call!.body!)).toEqual({ p_limit: 500 });
    expect(call!.method).toBe('POST');
  });

  it('passes an explicit limit and refuses one outside 1..5000, a non-integer or an unknown field before any call', async () => {
    let calls = stub();
    expect((await sweep(undefined, { limit: 25 })).body.data.limit).toBe(25);
    expect(JSON.parse(rpcCalls(calls, 'run_social_graph_retention')[0]!.body!)).toEqual({ p_limit: 25 });
    for (const body of [{ limit: 0 }, { limit: 5001 }, { limit: 2.5 }, { limit: '10' }, { limit: 10, dryRun: false }]) {
      calls = stub();
      expect((await sweep(undefined, body)).status).toBe(400);
      expect(rpcCalls(calls, 'run_social_graph_retention')).toHaveLength(0);
    }
  });

  it('answers 502 when the database fails, returns a malformed answer, or answers for another page size', async () => {
    for (const run of [
      { status: 500, body: { message: 'boom' } },
      { status: 404, body: { message: 'function not found' } },
      { status: 200, body: null },
      { status: 200, body: { ...RUN, noticesDeleted: -1 } },
      { status: 200, body: { ...RUN, graphAuditDeleted: 3 } },
      { status: 200, body: { ...RUN, extra: 1 } },
      { status: 200, body: { ...RUN, complete: 'yes' } },
      { status: 200, body: { ...RUN, limit: 499 } },
    ]) {
      stub({ run });
      const res = await sweep();
      expect(res.status).toBe(502);
      expect(res.body.data).toBeNull();
    }
  });
});

describe('Appendix J governance metric (E.10, E.11, E.12)', () => {
  it('requires view_analytics: no session, a Tutor, a child, a teen and staff without the grant are refused', async () => {
    stub();
    expect((await get(null, '/admin/analytics/social-governance')).status).toBe(401);
    for (const a of [TUTOR, KID, TEEN, ADULT]) {
      stub({ permissions: ['view_analytics'] });
      expect((await get(a, '/admin/analytics/social-governance')).status).toBe(403);
    }
    stub({ permissions: ['manage_content'] });
    expect((await get(STAFF, '/admin/analytics/social-governance')).status).toBe(403);
  });

  it('returns counts and schema names with the three verdicts', async () => {
    stub({ permissions: ['view_analytics'] });
    const res = await get(STAFF, '/admin/analytics/social-governance');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...METRICS, windowsMatchPolicy: true, retentionCompliant: true, messagingSurfaceFree: true });
  });

  it('reports drift, overdue rows, an exposed child and an unreviewed messaging surface as failures, not as healthy', async () => {
    const drift = { ...METRICS, windows: { ...METRICS.windows, reportNoteDays: 900 }, overdue: { ...METRICS.overdue, notices: 3 }, unconsentedChildEdges: 1, messagingSurfaces: ['table:direct_messages', 'text:kid_notes.content'] };
    stub({ permissions: ['view_analytics'], metrics: { status: 200, body: drift } });
    const res = await get(STAFF, '/admin/analytics/social-governance');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ windowsMatchPolicy: false, retentionCompliant: false, messagingSurfaceFree: false });
    stub({ permissions: ['view_analytics'], metrics: { status: 200, body: { ...METRICS, unconsentedChildEdges: 2 } } });
    expect((await get(STAFF, '/admin/analytics/social-governance')).body.data.retentionCompliant).toBe(false);
  });

  it('fails closed on a failed read, a malformed answer, anything that is not a schema name, or query fields', async () => {
    for (const metrics of [
      { status: 500, body: {} },
      { status: 200, body: { ...METRICS, extra: 1 } },
      { status: 200, body: { ...METRICS, overdue: { ...METRICS.overdue, notices: -1 } } },
      { status: 200, body: { ...METRICS, messagingSurfaces: ['table:direct_messages', 'hola, soy Beto'] } },
      { status: 200, body: { ...METRICS, messagingSurfaces: [`text:${A(3)}`] } },
      { status: 200, body: { ...METRICS, lastSweep: { at: 'yesterday', counts: {} } } },
    ]) {
      stub({ permissions: ['view_analytics'], metrics });
      expect((await get(STAFF, '/admin/analytics/social-governance')).status).toBe(502);
    }
    stub({ permissions: ['view_analytics'] });
    expect((await get(STAFF, '/admin/analytics/social-governance?days=7')).status).toBe(400);
  });
});

describe('E.12: the avatar is a cartoon option set and the cover a preset, on every write and every read', () => {
  const legacyAvatar = { imageUrl: 'https://example.com/me.png', top: ['bob'] };
  const legacyCover = { preset: 'ocean', image: 'https://example.com/c.png' };

  it('refuses an image, a link, free text or an unknown key on the avatar and cover writes, before any write', async () => {
    const writes = [
      ['/profile/avatar', { options: { imageUrl: 'https://example.com/me.png' } }],
      ['/profile/avatar', { options: { photo: 'data:image/png;base64,AAAA' } }],
      ['/profile/avatar', { options: { seed: 'find me on snap' } }],
      ['/profile/avatar', { options: { top: ['https://example.com/x.png'] } }],
      ['/profile/avatar', { options: { top: ['a', 'b', 'c', 'd'] } }],
      ['/profile/avatar', { options: { accessoriesProbability: 101 } }],
      ['/profile/cover', { preset: 'https://example.com/c.png' }],
      ['/profile/cover', { preset: 'nope' }],
      ['/profile/cover', { image: 'x' }],
    ] as const;
    for (const [path, body] of writes) {
      for (const a of [KID, TEEN, ADULT, TUTOR]) {
        const calls = stub();
        const res = await request(createApp()).put(`/api/v1${path}`).set('Authorization', bearer(a)).send(body);
        expect(res.status, `${a.username} ${path} ${JSON.stringify(body)}`).toBe(400);
        expect(calls.some((c) => c.method !== 'GET' && (c.url.includes('/avatars') || c.url.includes('/profiles')))).toBe(false);
      }
    }
  });

  it('accepts a valid option set and a preset', async () => {
    let calls = stub();
    expect((await request(createApp()).put('/api/v1/profile/avatar').set('Authorization', bearer(TEEN)).send({ options: { seed: 'Rio_1', top: ['bob'], accessoriesProbability: 40 } })).status).toBe(200);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/avatars'))).toBe(true);
    calls = stub();
    expect((await request(createApp()).put('/api/v1/profile/cover').set('Authorization', bearer(TEEN)).send({ preset: 'ocean' })).status).toBe(200);
    expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('/profiles'))).toBe(true);
  });

  it('serves a legacy off-schema avatar as the default cartoon and a legacy cover as none: own profile, public profile, lists and /auth/me', async () => {
    stub({ avatar: legacyAvatar, cover: legacyCover, follows: [[ADULT.id, TUTOR.id]] });
    const own = await get(ADULT, '/profile');
    expect(own.status).toBe(200);
    expect(own.body.data.avatarOptions).toEqual({});
    expect(own.body.data.cover).toEqual({});
    const pub = await get(TUTOR, '/profiles/marta');
    expect(pub.status).toBe(200);
    expect(pub.body.data.avatarOptions).toEqual({});
    expect(pub.body.data.cover).toEqual({});
    const followers = await get(TUTOR, '/profile/followers');
    expect(followers.status).toBe(200);
    for (const user of followers.body.data.users) expect(user.avatarOptions).toEqual({});
    const me = await get(ADULT, '/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.avatarOptions).toEqual({});
    expect(me.body.data.profile.cover).toEqual({});
    expect(JSON.stringify([own.body, pub.body, followers.body, me.body])).not.toContain('example.com/');
  });

  it('the projection keeps exactly the closed option set and nothing else', () => {
    expect(projectAvatarOptions({ seed: 'a', top: ['bob'], facialHairProbability: 0 })).toEqual({ seed: 'a', top: ['bob'], facialHairProbability: 0 });
    for (const bad of [null, [], 'x', { url: 'x' }, { top: 'bob' }, { top: [7] }, { seed: 'a b' }, { accessoriesProbability: 1.5 }]) {
      expect(projectAvatarOptions(bad)).toEqual({});
    }
    expect(projectCover({ preset: 'mint' })).toEqual({ preset: 'mint' });
    for (const bad of [null, {}, { preset: 'mint', url: 'x' }, { preset: 'nope' }, 'mint']) expect(projectCover(bad)).toEqual({});
    expect(AVATAR_ARRAY_KEYS).toHaveLength(10);
    expect(AVATAR_NUMBER_KEYS).toHaveLength(2);
  });
});

describe('E.10: Core has no person-to-person messaging route', () => {
  const routesDir = fileURLToPath(new URL('../routes/', import.meta.url));
  const appFile = fileURLToPath(new URL('../app.ts', import.meta.url));

  /** Every literal path Core mounts or routes (app.use mounts and router.<verb> paths). */
  function routePaths(): { file: string; path: string }[] {
    const out: { file: string; path: string }[] = [];
    const scan = (file: string, source: string) => {
      for (const m of source.matchAll(/\b(?:app|router)\.(?:use|get|post|put|patch|delete|all)\(\s*(['"`])([^'"`]*)\1/g)) out.push({ file, path: m[2]! });
    };
    scan('app.ts', readFileSync(appFile, 'utf8'));
    for (const name of readdirSync(routesDir).filter((f) => f.endsWith('.ts'))) scan(name, readFileSync(join(routesDir, name), 'utf8'));
    return out;
  }

  it('the scanner finds every route file and a realistic number of paths', () => {
    const paths = routePaths();
    expect(new Set(paths.map((p) => p.file)).size).toBeGreaterThanOrEqual(10);
    expect(paths.length).toBeGreaterThan(100);
    expect(paths).toContainEqual({ file: 'socialRetention.ts', path: '/run' });
  });

  it('no mounted or routed path carries a messaging word', () => {
    const hits = routePaths().filter((p) => messagingWords(p.path).length > 0);
    expect(hits).toEqual([]);
  });

  it('the word test catches the shapes a future feature would take', () => {
    for (const path of ['/messages', '/kids/:kidId/chat', '/profiles/:username/say-hi/reply', '/directMessages', '/family/inbox', '/comments/:id', '/threads', '/dm/:id', '/greetings']) {
      expect(messagingWords(path).length, path).toBeGreaterThan(0);
    }
    for (const path of ['/profiles/:username/connection-request', '/report', '/family/kids/:kidId/social', '/admin/analytics/social-governance', '/tasks/:id/evidence']) {
      expect(messagingWords(path), path).toEqual([]);
    }
    expect(new Set(MESSAGING_VOCABULARY).size).toBe(MESSAGING_VOCABULARY.length);
  });
});
