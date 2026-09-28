import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { dataPracticeApplies } from '../services/dataPractices.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S10.3 (OD-9 section 4.2) at the Core boundary: consent for the practices the
 * rebuild introduced. A Tutor answers for their own child; the account answers
 * for itself (a no always, a yes only where the database allows it); the
 * caller is always the actor, never a body field; every named database
 * refusal is mapped, and a failed read is never a yes. Populations: the
 * verified parent Tutor, an unrelated parent, a child, a self-registered teen
 * and a guest. PostgreSQL is the enforcing boundary for every rule
 * (database/migration-od9/prove-od9-postgres.mjs, check "consent enforcement").
 */

const KID = '22222222-2222-4222-8222-222222222222';
const TEEN = '55555555-5555-4555-8555-555555555555';
const GUEST = '88888888-8888-4888-8888-888888888888';
const PARENT = '11111111-1111-4111-8111-111111111111';
const STRANGER = '12121212-1212-4121-8121-121212121212';

const ROLES: Record<string, string[]> = { [KID]: ['kid'], [TEEN]: ['universal'], [GUEST]: ['universal'], [PARENT]: ['parent'], [STRANGER]: ['parent'] };
const GUARDED: Record<string, string[]> = { [PARENT]: [KID], [STRANGER]: [] };

const practice = (over: Record<string, unknown> = {}) => ({
  key: 'mentor.disposition_profile', kind: 'mentor_memory_type', requirement: 'C.7', version: 1, source: 'data_practice_consents',
  consented: false, applies: false, grantor: null, since: null, self_grantable: false, ...over,
});
const state = (practices = [practice()], over: Record<string, unknown> = {}) => ({ migrated: true, has_tutor: true, practices, ...over });

interface Call { url: string; method: string; body: Record<string, unknown> | undefined }
type Reply = { status: number; body: unknown };

function stub(rpc: Record<string, Reply> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, body });
    const name = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (name === 'wallet_access') return Promise.resolve(jsonResponse(200, { kind: null, verified_guardians: 0 }));
    if (name && rpc[name]) return Promise.resolve(jsonResponse(rpc[name].status, rpc[name].body));
    if (name) return Promise.resolve(jsonResponse(500, { message: `unstubbed rpc ${name}` }));
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (ROLES[id] ?? ['universal']).map((role) => ({ user_id: id, role }))));
    }
    if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
      const id = url.match(/parent_user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (GUARDED[id] ?? []).map((kid_user_id) => ({ parent_user_id: id, kid_user_id, verification_status: 'verified' }))));
    }
    if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
    return Promise.resolve(jsonResponse(500, { message: `unstubbed ${url}` }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const auth = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const app = () => request(createApp());
const rpcCalls = (calls: Call[], name: string) => calls.filter((c) => c.url.includes(`/rpc/${name}`));
const refusal = (message: string): Reply => ({ status: 400, body: { code: 'P0001', message } });
const KEY = 'mentor.disposition_profile';

describe('OD-9 4.2: a Tutor answers for their own child', () => {
  it('reads the child\'s practices, mapped to the wire, with the child as subject', async () => {
    const calls = stub({ data_practice_state: { status: 200, body: state([practice(), practice({
      key: 'analytics.motivation_events', kind: 'analytics_event_class', requirement: 'B.21', consented: true, applies: true, grantor: 'tutor', since: '2026-09-27T10:00:00Z',
    }), practice({ key: 'research.family_longitudinal', kind: 'research', requirement: 'D.22', source: 'family_research_consents' })]) } });
    const res = await app().get(`/api/v1/family-hub/kids/${KID}/data-practices`).set('Authorization', auth(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.migrated).toBe(true);
    expect(res.body.data.hasTutor).toBe(true);
    expect(res.body.data.practices[1]).toEqual({
      key: 'analytics.motivation_events', kind: 'analytics_event_class', requirement: 'B.21', disclosureVersion: 1, ownFlow: false,
      consented: true, applies: true, grantor: 'tutor', since: '2026-09-27T10:00:00Z', selfGrantable: false,
    });
    expect(res.body.data.practices[2].ownFlow).toBe(true);
    expect(rpcCalls(calls, 'data_practice_state')[0]!.body).toEqual({ p_subject: KID });
  });

  it('a yes names the disclosure it answers, and the caller is the actor', async () => {
    let calls = stub({ data_practice_set_consent: { status: 200, body: state() } });
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(PARENT)).send({ grant: true })).status).toBe(400);
    expect(rpcCalls(calls, 'data_practice_set_consent')).toHaveLength(0);
    calls = stub({ data_practice_set_consent: { status: 200, body: state([practice({ consented: true, applies: true, grantor: 'tutor', since: '2026-09-27T10:00:00Z' })]) } });
    const yes = await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(PARENT)).send({ grant: true, disclosureVersion: 1 });
    expect(yes.status).toBe(200);
    expect(yes.body.data.practices[0].consented).toBe(true);
    expect(rpcCalls(calls, 'data_practice_set_consent')[0]!.body).toEqual({ p_subject: KID, p_actor: PARENT, p_practice: KEY, p_grant: true, p_version: 1 });
    calls = stub({ data_practice_set_consent: { status: 200, body: state() } });
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(PARENT)).send({ grant: false })).status).toBe(200);
    expect(rpcCalls(calls, 'data_practice_set_consent')[0]!.body).toMatchObject({ p_actor: PARENT, p_grant: false });
  });

  it('refuses an unrelated parent (404) before any read or write, a child (403), a bad key and a body naming someone else (400)', async () => {
    const calls = stub({ data_practice_state: { status: 200, body: state() }, data_practice_set_consent: { status: 200, body: state() } });
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/data-practices`).set('Authorization', auth(STRANGER))).status).toBe(404);
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(STRANGER)).send({ grant: false })).status).toBe(404);
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/data-practices`).set('Authorization', auth(KID))).status).toBe(403);
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(KID)).send({ grant: true, disclosureVersion: 1 })).status).toBe(403);
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/Not%20A%20Key`).set('Authorization', auth(PARENT)).send({ grant: false })).status).toBe(400);
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(PARENT)).send({ grant: false, subject: TEEN })).status).toBe(400);
    expect((await app().get(`/api/v1/family-hub/kids/not-a-uuid/data-practices`).set('Authorization', auth(PARENT))).status).toBe(400);
    expect(rpcCalls(calls, 'data_practice_state')).toHaveLength(0);
    expect(rpcCalls(calls, 'data_practice_set_consent')).toHaveLength(0);
  });

  it.each([
    ['DATA_PRACTICE_NOT_ALLOWED', 403], ['DATA_PRACTICE_UNKNOWN', 404], ['DATA_PRACTICE_OTHER_FLOW', 409],
    ['DATA_PRACTICE_DISCLOSURE_STALE', 409], ['DATA_PRACTICE_NOT_NEEDED', 409], ['SOMETHING_ELSE', 502],
  ])('maps the database refusal %s to %i', async (code, status) => {
    stub({ data_practice_set_consent: refusal(code) });
    const res = await app().put(`/api/v1/family-hub/kids/${KID}/data-practices/${KEY}`).set('Authorization', auth(PARENT)).send({ grant: true, disclosureVersion: 1 });
    expect(res.status).toBe(status);
    if (status !== 502) expect(res.body.error.code).toBe(code);
  });

  it('a failed or malformed read is 502, never a state: a consent without its grantor, an unknown kind', async () => {
    stub();
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/data-practices`).set('Authorization', auth(PARENT))).status).toBe(502);
    stub({ data_practice_state: { status: 200, body: state([practice({ consented: true, applies: true })]) } });
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/data-practices`).set('Authorization', auth(PARENT))).status).toBe(502);
    stub({ data_practice_state: { status: 200, body: state([practice({ kind: 'advertising' })]) } });
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/data-practices`).set('Authorization', auth(PARENT))).status).toBe(502);
  });
});

describe('OD-9 4.2: the account answers for itself', () => {
  it.each([['a child', KID, {}], ['a self-registered teen', TEEN, {}], ['a guest', GUEST, { is_anonymous: true }]])(
    '%s reads its own practices and answers with itself as subject and actor', async (_label, who, extra) => {
      const calls = stub({ data_practice_state: { status: 200, body: state() }, data_practice_set_consent: { status: 200, body: state() } });
      expect((await app().get('/api/v1/family-hub/data-practices/me').set('Authorization', auth(who, extra))).status).toBe(200);
      expect(rpcCalls(calls, 'data_practice_state')[0]!.body).toEqual({ p_subject: who });
      expect((await app().put(`/api/v1/family-hub/data-practices/me/${KEY}`).set('Authorization', auth(who, extra)).send({ grant: false })).status).toBe(200);
      expect(rpcCalls(calls, 'data_practice_set_consent')[0]!.body).toEqual({ p_subject: who, p_actor: who, p_practice: KEY, p_grant: false, p_version: 1 });
    });

  it('a yes the database does not allow (a child, or a Tutor-only practice) is 403', async () => {
    stub({ data_practice_set_consent: refusal('DATA_PRACTICE_NOT_ALLOWED') });
    expect((await app().put(`/api/v1/family-hub/data-practices/me/${KEY}`).set('Authorization', auth(KID)).send({ grant: true, disclosureVersion: 1 })).status).toBe(403);
  });

  it('refuses no session at all', async () => {
    const calls = stub();
    expect((await app().get('/api/v1/family-hub/data-practices/me')).status).toBe(401);
    expect(calls.filter((c) => c.url.includes('/rpc/data_practice'))).toHaveLength(0);
  });
});

describe('dataPracticeApplies: anything but a clear yes is a no', () => {
  it.each([
    ['a yes', { status: 200, body: true }, true],
    ['a no', { status: 200, body: false }, false],
    ['a refusal', refusal('SOMETHING'), false],
    ['an unreachable database', { status: 503, body: { message: 'down' } }, false],
    ['a malformed answer', { status: 200, body: 'yes' }, false],
  ] as const)('%s', async (_label, reply, expected) => {
    stub({ data_practice_applies: reply as Reply });
    expect(await dataPracticeApplies(KID, KEY)).toBe(expected);
  });
});

describe('the enforcement migration covers every registered practice', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const read = (suffix: string) => {
    const dir = join(root, 'database/migrations');
    const name = readdirSync(dir).find((f) => f.endsWith(`${suffix}.sql`));
    if (!name) throw new Error(`no migration ending ${suffix}`);
    return readFileSync(join(dir, name), 'utf8').split('\r\n').join('\n');
  };
  it('every data_practices key is enforced somewhere (a table trigger, Core, or research\'s own admission)', () => {
    const registry = read('_od9_legacy_migration');
    const keys = [...registry.matchAll(/^\s+\('([a-z][a-z0-9_.-]+)', '(?:analytics_event_class|mentor_memory_type|sharing_surface|learner_record|research)'/gm)].map((m) => m[1]!);
    expect(keys).toHaveLength(14);
    const enforcement = read('_od9_consent_enforcement');
    const core = ['analytics.achievement_share_initiations'];
    const ownFlow = ['research.family_longitudinal'];
    for (const key of keys) {
      if (core.includes(key) || ownFlow.includes(key)) continue;
      expect(enforcement, key).toContain(`'${key}'`);
    }
    expect(read('_family_research_instrumentation')).toContain('family_research_admitted');
  });

  /*
   * OD-9 4.2 names "a new sharing surface" as a practice that needs fresh
   * consent. The registry pin above only sees practices that were registered;
   * this one catches the unregistered kind: every table a migration at or
   * after the registry creates that ties TWO accounts together (two or more
   * references to auth.users) must be mapped here to a registered practice
   * that some migration enforces through data_practice_applies, or be
   * exempted with the reason. Teen discoverable (0184, before the registry)
   * joins this rule once the owner answers its open question.
   */
  const TWO_ACCOUNT_TABLES: Record<string, string | { exempt: string }> = {
    data_practice_consents: { exempt: 'the consent record itself (subject and grantor)' },
    age_correction_requests: { exempt: 'a staff decision record (the account and the deciding staff member); it shares nothing between accounts' },
    coop_goal_members: 'sharing.cooperative_goals',
    coop_goal_guardian_consents: 'sharing.cooperative_goals',
  };
  it('every table tying two accounts, created at or after the registry, names a registered and enforced practice', () => {
    const dir = join(root, 'database/migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const all = files.map((f) => readFileSync(join(dir, f), 'utf8').split('\r\n').join('\n'));
    const from = files.findIndex((f) => f.endsWith('_od9_legacy_migration.sql'));
    expect(from).toBeGreaterThan(0);
    const registered = new Set(all.flatMap((sql) => [...sql.matchAll(/^\s+\('([a-z][a-z0-9_.-]+)', '(?:analytics_event_class|mentor_memory_type|sharing_surface|learner_record|research)'/gm)].map((m) => m[1]!)));
    const found: string[] = [];
    for (const sql of all.slice(from)) {
      for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z_]+) \(([\s\S]*?)\n\);/g)) {
        if ((m[2]!.match(/REFERENCES auth\.users/g) ?? []).length >= 2) found.push(m[1]!);
      }
    }
    expect(found.sort()).toEqual(Object.keys(TWO_ACCOUNT_TABLES).sort());
    for (const [table, practice] of Object.entries(TWO_ACCOUNT_TABLES)) {
      if (typeof practice !== 'string') continue;
      expect(registered.has(practice), `${table} -> ${practice} is registered`).toBe(true);
      expect(all.some((sql) => sql.includes(`data_practice_applies(p_user, '${practice}')`)), `${practice} is enforced`).toBe(true);
    }
  });
});
