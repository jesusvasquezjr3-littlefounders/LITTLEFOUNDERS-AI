import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { SOCIAL_PROTECTION_EVENTS, SOCIAL_PROTECTION_METRIC_KEYS } from '../services/socialProtection.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Appendix J Part 1.1-1.2 for E.1-E.5 at Core's boundary (migration
 * social_protection_metrics). The counting is proven against real PostgreSQL
 * by database/scripts/verify-social-protection-postgres.py; this suite proves
 * that the metric reaches only staff holding view_analytics, never turns a
 * failed or malformed answer into a number, and that Core records the events
 * only it sees (a profile resolution and its verdict, a follow refusal, an
 * unfollow, a Tutor badge shown) with the session as the viewer.
 */

const A = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
interface Account { id: string; username: string; roles: string[]; tier: string }
const STAFF: Account = { id: A(1), username: 'staff_one', roles: ['universal', 'admin'], tier: 'adult' };
const TUTOR: Account = { id: A(2), username: 'tutor_ana', roles: ['universal', 'parent'], tier: 'adult' };
const KID: Account = { id: A(3), username: 'beto', roles: ['universal', 'kid'], tier: 'guardian' };
const TEEN: Account = { id: A(4), username: 'rio', roles: ['universal'], tier: 'teen' };
const ADULT: Account = { id: A(5), username: 'marta', roles: ['universal'], tier: 'adult' };
const ACCOUNTS = [STAFF, TUTOR, KID, TEEN, ADULT];

const METRICS = {
  days: 30,
  discovery: { unrelatedAttempts: 4, unrelatedReached: 0, resolutions: 120, rate: 0 },
  unauthorizedConnections: { followAttempts: 10, refusedGuardianApproval: 1, refusedSubjectConsent: 2, guardianRequests: 3, unrelatedGuardianRequests: 0, rate: 0.23 },
  approvalLatency: { guardianDecided: 2, guardianPending: 1, guardianP50Hours: 4, guardianP95Hours: 5.8, teenDecided: 0, teenP50Hours: null, teenP95Hours: null },
  reports: { filed: 3, resolved: 1, open: 2, p50ResolutionHours: 12.5, p95ResolutionHours: 12.5 },
  patternEscalation: { qualifying: 1, escalated: 1, rate: 1 },
  ageBoundary: { guardianPath: 1, reviewedFunction: 2, other: 0 },
  tutorBadge: { shown: 5, shownUnrelated: 0 },
  familySocialPanel: { views: 7, guardiansWithLinkedChild: 4 },
  auditCompleteness: { follows: 3, followsAudited: 3, blocks: 1, blocksAudited: 1, reports: 3, reportsAudited: 3, unfollows: 1, unfollowsAudited: 1, unblocks: 0, unblocksAudited: 0, rate: 1 },
};

interface World {
  metrics?: { status: number; body: unknown };
  permissions?: string[];
  follows?: [string, string][];
  verifiedParents?: string[];
  recordFails?: boolean;
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
    const args = body ? JSON.parse(body) as Record<string, unknown> : {};
    if (url.includes('/rpc/social_protection_metrics')) return json(w.metrics ? w.metrics.body : { ...METRICS, days: Number(args.p_days) }, w.metrics?.status ?? 200);
    if (url.includes('/rpc/record_social_protection_event')) return w.recordFails ? Promise.reject(new Error('down')) : Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes('/rpc/withdraw_social_connection')) return json(true);
    if (url.includes('/rpc/social_tier')) return json(byId(args.p_user as string)?.tier ?? null);
    if (url.includes('/rpc/get_completed_course_badges')) return json([]);
    if (url.includes('/rpc/')) return json(false);
    if (url.includes('/rest/v1/staff_sightings')) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes('/rest/v1/admin_permissions')) return json((w.permissions ?? []).map((permission) => ({ user_id: STAFF.id, permission })));
    if (url.includes('/rest/v1/parent_verifications')) {
      const id = param(url, 'user_id');
      return json((w.verifiedParents ?? []).includes(id ?? '') ? [{ status: 'verified', method: 'local-ocr', birth_date: '1985-01-01' }] : []);
    }
    if (url.includes('/rest/v1/user_roles')) {
      if (url.includes('user_id=in.(')) return json([]);
      const roles = byId(param(url, 'user_id'))?.roles ?? [];
      const wanted = param(url, 'role');
      return json((wanted ? roles.filter((r) => r === wanted) : roles).map((role) => ({ role })));
    }
    if (url.includes('/rest/v1/profiles')) {
      if (method !== 'GET') return Promise.resolve(new Response(null, { status: 204 }));
      const row = (a: Account) => ({ user_id: a.id, display_name: a.username, username: a.username, locale: 'en-US', theme: 'system', cover: { preset: 'mint' }, birth_date: null, created_at: '2026-07-12T00:00:00Z' });
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
      return json([{ options: { top: ['bob'] } }]);
    }
    if (url.includes('/rest/v1/follows')) {
      if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
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
const get = (a: Account | null, path: string) => {
  const req = request(createApp()).get(`/api/v1${path}`);
  return a ? req.set('Authorization', bearer(a)) : req;
};
const send = (verb: 'post' | 'delete', a: Account, path: string) => request(createApp())[verb](`/api/v1${path}`).set('Authorization', bearer(a)).send({});
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const events = (calls: Call[]) => calls.filter((c) => c.url.includes('/rpc/record_social_protection_event')).map((c) => JSON.parse(c.body!) as Record<string, string>);
const PATH = '/admin/analytics/social-protection';

describe('Appendix J E.1-E.5 metric: staff with view_analytics only, never a false number', () => {
  it('refuses no session, a Tutor, a child, a teen, an adult and staff without the grant', async () => {
    stub();
    expect((await get(null, PATH)).status).toBe(401);
    for (const a of [TUTOR, KID, TEEN, ADULT]) {
      const calls = stub({ permissions: ['view_analytics'] });
      expect((await get(a, PATH)).status, a.username).toBe(403);
      expect(calls.some((c) => c.url.includes('/rpc/social_protection_metrics'))).toBe(false);
    }
    stub({ permissions: ['manage_content'] });
    expect((await get(STAFF, PATH)).status).toBe(403);
  });

  it('returns the nine metrics with the Appendix J verdicts, for the window asked (default 30 days)', async () => {
    let calls = stub({ permissions: ['view_analytics'] });
    const res = await get(STAFF, PATH);
    expect(res.status).toBe(200);
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/social_protection_metrics'))!.body!)).toEqual({ p_days: 30 });
    expect(res.body.data).toEqual({ ...METRICS, discoveryAtTarget: true, ageBoundaryAtTarget: true, tutorBadgeAtTarget: true, patternEscalationAtTarget: true, auditCompletenessAtTarget: true });
    calls = stub({ permissions: ['view_analytics'] });
    expect((await get(STAFF, `${PATH}?days=7`)).body.data.days).toBe(7);
  });

  it('reports a regression on every zero-target and 100% metric as off target, and an empty population as null', async () => {
    const bad = { ...METRICS, discovery: { ...METRICS.discovery, unrelatedReached: 1, rate: 0.25 }, ageBoundary: { ...METRICS.ageBoundary, other: 1 },
      tutorBadge: { shown: 5, shownUnrelated: 1 }, patternEscalation: { qualifying: 2, escalated: 1, rate: 0.5 },
      auditCompleteness: { ...METRICS.auditCompleteness, followsAudited: 2, rate: 0.875 } };
    stub({ permissions: ['view_analytics'], metrics: { status: 200, body: bad } });
    expect((await get(STAFF, PATH)).body.data).toMatchObject({ discoveryAtTarget: false, ageBoundaryAtTarget: false, tutorBadgeAtTarget: false,
      patternEscalationAtTarget: false, auditCompletenessAtTarget: false });
    stub({ permissions: ['view_analytics'], metrics: { status: 200, body: { ...METRICS, patternEscalation: { qualifying: 0, escalated: 0, rate: null } } } });
    expect((await get(STAFF, PATH)).body.data.patternEscalationAtTarget).toBeNull();
  });

  it('fails closed on a failed read, a dropped or extra metric, a negative count, a rate above 1 or another window', async () => {
    const withoutDiscovery = Object.fromEntries(Object.entries(METRICS).filter(([key]) => key !== 'discovery'));
    for (const metrics of [
      { status: 500, body: {} },
      { status: 200, body: withoutDiscovery },
      { status: 200, body: { ...METRICS, extra: 1 } },
      { status: 200, body: { ...METRICS, tutorBadge: { shown: -1, shownUnrelated: 0 } } },
      { status: 200, body: { ...METRICS, auditCompleteness: { ...METRICS.auditCompleteness, rate: 1.2 } } },
      { status: 200, body: { ...METRICS, discovery: { ...METRICS.discovery, viewer: A(3) } } },
      { status: 200, body: { ...METRICS, days: 90 } },
    ]) {
      stub({ permissions: ['view_analytics'], metrics });
      expect((await get(STAFF, PATH)).status).toBe(502);
    }
    for (const query of ['?days=0', '?days=367', '?days=ten', '?days=7&who=beto']) {
      stub({ permissions: ['view_analytics'] });
      expect((await get(STAFF, `${PATH}${query}`)).status, query).toBe(400);
    }
  });
});

describe('Core records the E.1-E.5 events only it sees, with the session as the viewer', () => {
  it('a stranger resolving a guardian-tier child is recorded as a refused profile resolution, and still gets 404', async () => {
    const calls = stub();
    expect((await get(ADULT, '/profiles/beto')).status).toBe(404);
    await settle();
    expect(events(calls)).toContainEqual({ p_event: 'profile_refused', p_viewer: ADULT.id, p_subject: KID.id });
  });

  it('a followers list asked of a child records a refused list resolution', async () => {
    const calls = stub();
    expect((await get(ADULT, '/profiles/beto/followers')).status).toBe(404);
    await settle();
    expect(events(calls)).toContainEqual({ p_event: 'list_refused', p_viewer: ADULT.id, p_subject: KID.id });
  });

  it('a follow into a teen records the attempt and the SUBJECT_CONSENT_REQUIRED refusal', async () => {
    const calls = stub();
    const res = await send('post', ADULT, '/profiles/rio/follow');
    await settle();
    if (res.status === 403) {
      expect(res.body.error.code).toBe('SUBJECT_CONSENT_REQUIRED');
      expect(events(calls).map((e) => e.p_event)).toEqual(expect.arrayContaining(['follow_attempt', 'follow_refused_teen']));
    } else {
      // The teen is private by default: an unconnected adult does not even resolve it.
      expect(res.status).toBe(404);
      expect(events(calls).map((e) => e.p_event)).toContain('action_refused');
    }
    for (const e of events(calls)) expect(e.p_viewer).toBe(ADULT.id);
  });

  it('an unfollow is recorded for the audit-completeness reconciliation', async () => {
    const calls = stub({ follows: [[ADULT.id, TUTOR.id]] });
    expect((await send('delete', ADULT, '/profiles/tutor_ana/follow')).status).toBe(200);
    await settle();
    expect(events(calls)).toContainEqual({ p_event: 'unfollow', p_viewer: ADULT.id, p_subject: TUTOR.id });
  });

  it('a Tutor badge rendered to someone else is recorded; the Tutor looking at themself is not', async () => {
    let calls = stub({ verifiedParents: [TUTOR.id], follows: [[ADULT.id, TUTOR.id], [TUTOR.id, ADULT.id]] });
    const res = await get(ADULT, '/profiles/tutor_ana');
    expect(res.status).toBe(200);
    await settle();
    if (res.body.data.isTutor) expect(events(calls)).toContainEqual({ p_event: 'tutor_badge_shown', p_viewer: ADULT.id, p_subject: TUTOR.id });
    calls = stub({ verifiedParents: [TUTOR.id] });
    await get(TUTOR, '/profile');
    await settle();
    expect(events(calls).filter((e) => e.p_event === 'tutor_badge_shown')).toEqual([]);
  });

  it('a failed recording never changes the answer', async () => {
    const calls = stub({ recordFails: true });
    expect((await get(ADULT, '/profiles/beto')).status).toBe(404);
    await settle();
    expect(events(calls).length).toBeGreaterThan(0);
  });
});

describe('the nine metrics stay wired end to end (social:check pins the same)', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  it('the migration answers every key Core validates, and records only the events Core may send', () => {
    const dir = join(root, 'database/migrations');
    const name = readdirSync(dir).find((f) => f.endsWith('_social_protection_metrics.sql'));
    expect(name).toBeDefined();
    const sql = readFileSync(join(dir, name!), 'utf8');
    for (const key of SOCIAL_PROTECTION_METRIC_KEYS) expect(sql, key).toContain(`'${key}', `);
    for (const event of SOCIAL_PROTECTION_EVENTS) expect(sql, event).toContain(`'${event}'`);
    const family = readFileSync(join(root, 'backend/src/routes/family.ts'), 'utf8');
    expect(family).toContain("noteSocialProtectionEvent('family_social_panel_view', authedUser(res).id, kidId)");
  });
});
