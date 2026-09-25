import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { GENERIC_REASONS, reasonActionable } from '../services/familyAutonomy.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S07.5 at the Core boundary: D.17 (a graduated-autonomy ladder inside the
 * parent-managed system) and D.18 (a rationale requirement and communication
 * scaffolding for approval and denial), plus their Appendix H metrics.
 * Populations: a parent-created child, a teen who linked a verified parent,
 * an unlinked self-registered teen, an adult learner, a guest, the verified
 * parent Tutor, an unrelated parent, and staff with the support grant, the
 * analytics grant or neither. The database is the enforcing boundary
 * (database/scripts/verify-autonomy-decisions-postgres.py); these tests prove
 * Core refuses the wrong caller before any write, passes the CALLER as child
 * and actor (never a body field), refuses a "not yet" without an actionable
 * reason before any write, maps every database refusal honestly and never
 * reports a state the database did not confirm.
 */

const KID = '22222222-2222-4222-8222-222222222222';
const OTHER_KID = '23232323-2323-4232-8232-232323232323';
const LINKED_TEEN = '56565656-5656-4565-8565-565656565656';
const TEEN = '55555555-5555-4555-8555-555555555555';
const ADULT = '77777777-7777-4777-8777-777777777777';
const GUEST = '88888888-8888-4888-8888-888888888888';
const PARENT = '11111111-1111-4111-8111-111111111111';
const STRANGER = '12121212-1212-4121-8121-121212121212';
const STAFF = '66666666-6666-4666-8666-666666666666';
const TASK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REDEMPTION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CATALOG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DECISION = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REQUEST = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NUDGE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const ROLES: Record<string, string[]> = {
  [KID]: ['kid'], [OTHER_KID]: ['kid'], [LINKED_TEEN]: ['universal'], [TEEN]: ['universal'], [ADULT]: ['universal'], [GUEST]: ['universal'],
  [PARENT]: ['parent'], [STRANGER]: ['parent'], [STAFF]: ['admin'],
};
const ACCESS: Record<string, { kind: string | null; verified_guardians: number }> = {
  [LINKED_TEEN]: { kind: 'teen', verified_guardians: 1 },
  [TEEN]: { kind: 'teen', verified_guardians: 0 },
  [ADULT]: { kind: null, verified_guardians: 0 },
  [GUEST]: { kind: null, verified_guardians: 0 },
};
const GUARDED: Record<string, string[]> = { [PARENT]: [KID, LINKED_TEEN], [STRANGER]: [OTHER_KID] };

const NEXT = {
  level: 2, in_family: true, age: 9, min_age: 8, age_ok: true, approved: 7, min_approved: 10, not_approved: 1, max_not_approved_pct: 25,
  share_ok: true, days_at_level: 0, min_days: 0, days_ok: true, window_days: 60, eligible: false,
};
const STATUS = {
  in_family: true, level: 1, preapproved_limit: 0, stored_level: 1, level_since: null, preapproved_cap: 0, self_log_contributions: false,
  self_log_max_coins: null, next: NEXT, request: null,
};
const decisionRow = (over: Record<string, unknown> = {}) => ({
  id: DECISION, kid_user_id: KID, subject: 'task', task_id: TASK, redemption_id: null, level_request_id: null, prior_status: 'done',
  outcome: 'sent_back', reviews_decision_id: null, actor_user_id: PARENT, actor_kind: 'tutor', reason_code: 'redo',
  reason: 'Rinse the cups in the sink too.', revisit_on: null, legacy: false, created_at: '2026-09-20T10:00:00Z', ...over,
});
const taskRow = (over: Record<string, unknown> = {}) => ({
  id: TASK, assigned_by: PARENT, assigned_to: KID, title: 'Dishes', reward_coins: 3, recurrence: 'once', due_at: null, status: 'done', allocated: false,
  created_at: '2026-09-19T10:00:00Z', evidence_bucket: null, evidence_hash: null, evidence_ext: null, evidence_uploaded_at: null, cancel_reason: null,
  requires_evidence: false, kind: 'bonus', completed_on: '2026-09-20', child_note: 'I also dried them', decision_id: null, ...over,
});
const redemptionRow = (over: Record<string, unknown> = {}) => ({
  id: REDEMPTION, catalog_id: CATALOG, kid_user_id: KID, status: 'requested', created_at: '2026-09-20T10:00:00Z', decided_at: null, decided_by: null,
  fulfilled_at: null, child_reason_kind: 'saved_for_it', child_note: 'Three weeks of saving', decision_id: null, ...over,
});

interface Call { url: string; method: string; body: Record<string, unknown> | undefined }
interface Opts {
  rpc?: Record<string, { status: number; body: unknown }>;
  decisions?: Record<string, unknown>[];
  decision?: Record<string, unknown> | null;
  reviewed?: string[];
  nudges?: Record<string, unknown>[];
  nudgeKid?: string | null;
  requests?: Record<string, unknown>[];
  requestKid?: string | null;
  changes?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  redemptions?: Record<string, unknown>[];
  staffGrants?: string[];
  down?: string[];
}

function stub(opts: Opts = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, body });
    if (opts.down?.some((part) => url.includes(part))) return Promise.resolve(jsonResponse(503, { message: 'down' }));
    const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (rpc === 'wallet_access') {
      const who = (body as { p_user: string }).p_user;
      return Promise.resolve(jsonResponse(200, ACCESS[who] ?? { kind: null, verified_guardians: 0 }));
    }
    if (rpc) {
      const answer = opts.rpc?.[rpc];
      if (answer) return Promise.resolve(jsonResponse(answer.status, answer.body));
      if (rpc === 'family_autonomy_status') return Promise.resolve(jsonResponse(200, STATUS));
      return Promise.resolve(jsonResponse(500, { message: 'unstubbed rpc' }));
    }
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (ROLES[id] ?? ['universal']).map((role) => ({ user_id: id, role }))));
    }
    if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, (opts.staffGrants ?? []).map((permission) => ({ permission }))));
    if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
    if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
      const id = url.match(/parent_user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (GUARDED[id] ?? []).map((kid_user_id) => ({ parent_user_id: id, kid_user_id, verification_status: 'verified' }))));
    }
    if (url.includes('/rest/v1/family_decisions?id=eq.')) return Promise.resolve(jsonResponse(200, opts.decision === null ? [] : [opts.decision ?? decisionRow()]));
    if (url.includes('/rest/v1/family_decisions?reviews_decision_id=')) return Promise.resolve(jsonResponse(200, (opts.reviewed ?? []).map((id) => ({ reviews_decision_id: id }))));
    if (url.includes('/rest/v1/family_decisions?kid_user_id=')) return Promise.resolve(jsonResponse(200, opts.decisions ?? []));
    if (url.includes('/rest/v1/family_talk_nudges?id=eq.')) return Promise.resolve(jsonResponse(200, opts.nudgeKid === null ? [] : [{ kid_user_id: opts.nudgeKid ?? KID }]));
    if (url.includes('/rest/v1/family_talk_nudges?')) return Promise.resolve(jsonResponse(200, opts.nudges ?? []));
    if (url.includes('/rest/v1/family_autonomy_requests?id=eq.')) return Promise.resolve(jsonResponse(200, opts.requestKid === null ? [] : [{ kid_user_id: opts.requestKid ?? KID }]));
    if (url.includes('/rest/v1/family_autonomy_requests?')) return Promise.resolve(jsonResponse(200, opts.requests ?? []));
    if (url.includes('/rest/v1/family_autonomy_changes?')) return Promise.resolve(jsonResponse(200, opts.changes ?? []));
    if (url.includes('/rest/v1/tasks?id=in.')) return Promise.resolve(jsonResponse(200, [{ id: TASK, title: 'Dishes' }]));
    if (url.includes('/rest/v1/tasks?id=eq.')) return Promise.resolve(jsonResponse(200, [taskRow()]));
    if (url.includes('/rest/v1/tasks?assigned_to=')) return Promise.resolve(jsonResponse(200, opts.tasks ?? [taskRow(), taskRow({ id: '99999999-9999-4999-8999-999999999999', status: 'open', child_note: null })]));
    if (url.includes('/rest/v1/redemptions?id=in.')) return Promise.resolve(jsonResponse(200, [{ id: REDEMPTION, catalog_id: CATALOG }]));
    if (url.includes('/rest/v1/redemptions?id=eq.')) return Promise.resolve(jsonResponse(200, [redemptionRow()]));
    if (url.includes('/rest/v1/redemptions?kid_user_id=')) return Promise.resolve(jsonResponse(200, opts.redemptions ?? [redemptionRow()]));
    if (url.includes('/rest/v1/redemption_catalog?id=eq.')) return Promise.resolve(jsonResponse(200, [{ id: CATALOG, parent_user_id: PARENT, title: 'Cinema', cost: 10, active: true, created_at: '2026-09-01T00:00:00Z' }]));
    if (url.includes('/rest/v1/guardian_links?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, [{ parent_user_id: PARENT }]));
    if (url.includes('/rest/v1/spend_limits?')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/banking_accounts?')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/redemption_catalog?id=in.')) {
      const wantsCost = url.includes('select=id,title,cost');
      return Promise.resolve(jsonResponse(200, [wantsCost ? { id: CATALOG, title: 'Cinema', cost: 10 } : { id: CATALOG, title: 'Cinema' }]));
    }
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const as = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const app = () => request(createApp());
const rpcCalls = (calls: Call[], name: string) => calls.filter((c) => c.url.includes(`/rest/v1/rpc/${name}`));
const writes = (calls: Call[]) => calls.filter((c) => c.url.includes('/rest/v1/rpc/') && !c.url.includes('wallet_access') && !c.url.includes('family_autonomy_status'));
const refusal = (message: string) => ({ status: 400, body: { code: 'P0001', message, details: null, hint: null } });
const CHILDREN: [string, string][] = [['a parent-created child', KID], ['a linked teen', LINKED_TEEN]];
const NOT_CHILDREN: [string, string, { is_anonymous?: boolean }][] = [
  ['an unlinked teen', TEEN, {}], ['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', STAFF, {}],
];
const NON_PARENTS: [string, string, { is_anonymous?: boolean }][] = [
  ['a parent-created child', KID, {}], ['a linked teen', LINKED_TEEN, {}], ['an unlinked teen', TEEN, {}],
  ['an adult learner', ADULT, {}], ['staff', STAFF, {}], ['a guest', GUEST, { is_anonymous: true }],
];
const GOOD = 'Rinse the cups in the sink too, then mark it again.';

// ── D.18: the actionable-reason rule ────────────────────────────────────────

describe('the actionable-reason rule (D.18)', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const fixture = JSON.parse(readFileSync(join(root, 'database/scripts/fixtures/denial-reasons.json'), 'utf8')) as { cases: { text: string; actionable: boolean }[] };

  it('agrees with family_reason_actionable() on every fixture case, in three locales', () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(50);
    for (const c of fixture.cases) expect(reasonActionable(c.text), JSON.stringify(c.text)).toBe(c.actionable);
  });

  it('keeps the brush-off list equal to the database migration', () => {
    const dir = join(root, 'database/migrations');
    const file = readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith('_family_autonomy_ladder.sql'))!), 'utf8');
    const list = file.slice(file.indexOf('IF v_norm = ANY (ARRAY['), file.indexOf(']) THEN', file.indexOf('IF v_norm = ANY (ARRAY[')));
    expect([...list.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...GENERIC_REASONS]);
  });
});

// ── D.17: the child's side ──────────────────────────────────────────────────

describe("the child's level and notes (D.17, D.18)", () => {
  for (const [label, who] of CHILDREN) {
    it(`shows ${label} their own level and the rule for the next one, read as the caller`, async () => {
      const calls = stub({ changes: [{ id: DECISION, from_level: 2, to_level: 1, from_limit: 10, to_limit: 0, actor_user_id: PARENT, actor_kind: 'tutor', reason_code: 'practice_more', reason: GOOD, created_at: '2026-09-20T10:00:00Z' }] });
      const res = await app().get('/api/v1/tasks/autonomy').set('Authorization', as(who));
      expect(res.status).toBe(200);
      expect(res.body.data.autonomy).toMatchObject({ level: 1, next: { level: 2, eligible: false, approved: { value: 7, min: 10 } } });
      expect(res.body.data.changes[0]).toMatchObject({ by: 'tutor', byMe: false, reason: GOOD });
      expect(res.body.data.changes[0].actorUserId).toBeUndefined();
      expect(rpcCalls(calls, 'family_autonomy_status')[0]!.body).toEqual({ p_kid: who });
    });

    it(`lets ${label} ask for the next level in their own words, and step down, as the caller`, async () => {
      const calls = stub({ rpc: { family_autonomy_request_level: { status: 200, body: REQUEST }, family_autonomy_step_down: { status: 200, body: 1 } } });
      expect((await app().post('/api/v1/tasks/autonomy/request').set('Authorization', as(who)).send({ note: 'I did every chore' })).status).toBe(201);
      expect(rpcCalls(calls, 'family_autonomy_request_level')[0]!.body).toEqual({ p_kid: who, p_note: 'I did every chore' });
      expect((await app().post('/api/v1/tasks/autonomy/step-down').set('Authorization', as(who)).send({})).body.data.level).toBe(1);
      expect(rpcCalls(calls, 'family_autonomy_step_down')[0]!.body).toEqual({ p_kid: who });
    });
  }

  for (const [label, who, extra] of NOT_CHILDREN) {
    it(`refuses ${label} every child route before any read or write`, async () => {
      const calls = stub();
      for (const [method, path] of [['get', '/api/v1/tasks/autonomy'], ['post', '/api/v1/tasks/autonomy/request'], ['post', '/api/v1/tasks/autonomy/step-down'],
        ['get', '/api/v1/tasks/decisions/mine'], ['post', `/api/v1/tasks/decisions/${DECISION}/talk`]] as const) {
        const res = await (method === 'get' ? app().get(path) : app().post(path).send({})).set('Authorization', as(who, extra));
        expect(res.status, `${label} ${path}`).toBe(403);
      }
      expect(writes(calls)).toHaveLength(0);
      expect(calls.some((c) => c.url.includes('family_autonomy_status') || c.url.includes('family_decisions'))).toBe(false);
    });
  }

  it('refuses a note over 140 characters and a body naming another child, before any write', async () => {
    const calls = stub();
    expect((await app().post('/api/v1/tasks/autonomy/request').set('Authorization', as(KID)).send({ note: 'x'.repeat(141) })).status).toBe(400);
    expect((await app().post('/api/v1/tasks/autonomy/request').set('Authorization', as(KID)).send({ kidId: OTHER_KID })).status).toBe(400);
    expect((await app().post('/api/v1/tasks/autonomy/step-down').set('Authorization', as(KID)).send({ kidId: OTHER_KID })).status).toBe(400);
    expect(writes(calls)).toHaveLength(0);
  });

  it('maps the database refusals and never reports a transport failure as done', async () => {
    stub({ rpc: { family_autonomy_request_level: refusal('AUTONOMY_REQUEST_PENDING'), family_autonomy_step_down: refusal('AUTONOMY_CHILD_STEP_DOWN_ONLY') } });
    expect((await app().post('/api/v1/tasks/autonomy/request').set('Authorization', as(KID)).send({})).body.error.code).toBe('AUTONOMY_REQUEST_PENDING');
    expect((await app().post('/api/v1/tasks/autonomy/step-down').set('Authorization', as(KID)).send({})).body.error.code).toBe('AUTONOMY_CHILD_STEP_DOWN_ONLY');
    stub({ rpc: { family_autonomy_step_down: { status: 503, body: null } } });
    expect((await app().post('/api/v1/tasks/autonomy/step-down').set('Authorization', as(KID)).send({})).status).toBe(502);
    stub({ rpc: { family_autonomy_status: { status: 200, body: { ...STATUS, preapproved_limit: 50, preapproved_cap: 20, level: 3 } } } });
    expect((await app().get('/api/v1/tasks/autonomy').set('Authorization', as(KID))).status).toBe(200);
    stub({ rpc: { family_autonomy_status: { status: 200, body: { ...STATUS, level: 4 } } } });
    expect((await app().get('/api/v1/tasks/autonomy').set('Authorization', as(KID))).status).toBe(502);
  });

  it("shows the child each decision with its reason, whether it is a \"not yet\", and whether they asked to talk; never an actor id", async () => {
    stub({
      decisions: [decisionRow(), decisionRow({ id: REQUEST, outcome: 'self_logged', actor_user_id: KID, actor_kind: 'child', reason_code: null, reason: null })],
      nudges: [{ id: NUDGE, kid_user_id: KID, origin: 'child', decision_id: DECISION, denials: null, status: 'open', created_at: '2026-09-21T10:00:00Z', closed_at: null }],
    });
    const res = await app().get('/api/v1/tasks/decisions/mine').set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data.decisions[0]).toMatchObject({ outcome: 'sent_back', notYet: true, talk: 'open', title: 'Dishes', reason: 'Rinse the cups in the sink too.', by: 'tutor' });
    expect(res.body.data.decisions[1]).toMatchObject({ outcome: 'self_logged', notYet: false, talk: null, by: 'child', byMe: true });
    expect(JSON.stringify(res.body)).not.toContain(PARENT);
  });

  it("lets the child ask to talk about their own decision only; another child's is a 404 before any write", async () => {
    let calls = stub({ rpc: { family_talk_request: { status: 200, body: NUDGE } } });
    expect((await app().post(`/api/v1/tasks/decisions/${DECISION}/talk`).set('Authorization', as(KID)).send({})).status).toBe(201);
    expect(rpcCalls(calls, 'family_talk_request')[0]!.body).toEqual({ p_kid: KID, p_decision: DECISION });
    calls = stub({ decision: decisionRow({ kid_user_id: OTHER_KID }) });
    expect((await app().post(`/api/v1/tasks/decisions/${DECISION}/talk`).set('Authorization', as(KID)).send({})).status).toBe(404);
    expect(writes(calls)).toHaveLength(0);
    stub({ rpc: { family_talk_request: refusal('TALK_NUDGE_INVALID') } });
    expect((await app().post(`/api/v1/tasks/decisions/${DECISION}/talk`).set('Authorization', as(KID)).send({})).body.error.code).toBe('TALK_NUDGE_INVALID');
  });
});

// ── D.17 and D.18: the child's own requests ─────────────────────────────────

describe("the child's request carries their own words (D.18) and the level decides the tap (D.17)", () => {
  it('marks a chore done with the child\'s note and reports a self-logged chore as the database decided', async () => {
    const calls = stub({ rpc: { family_task_mark_done: { status: 200, body: { status: 'approved', self_logged: true } } } });
    const res = await app().post(`/api/v1/tasks/${TASK}/complete`).set('Authorization', as(KID)).send({ note: 'I also dried them' });
    expect(res.status).toBe(200);
    expect(res.body.data.selfLogged).toBe(true);
    expect(rpcCalls(calls, 'family_task_mark_done')[0]!.body).toMatchObject({ p_task: TASK, p_kid: KID, p_note: 'I also dried them' });
  });

  it('refuses a child note over 140 characters before any write', async () => {
    const calls = stub();
    expect((await app().post(`/api/v1/tasks/${TASK}/complete`).set('Authorization', as(KID)).send({ note: 'x'.repeat(141) })).status).toBe(400);
    expect(writes(calls)).toHaveLength(0);
  });

  it('reports a pre-approved reward as the database decided, and never approves one itself', async () => {
    const calls = stub({ rpc: { family_request_redemption: { status: 200, body: { id: REDEMPTION, status: 'approved', preapproved: true } } } });
    // The catalog item, the spend limit and the freeze are read first (unchanged S07.1 rules).
    const res = await app().post('/api/v1/tasks/redemptions').set('Authorization', as(KID)).send({ catalogId: CATALOG, reasonKind: 'treat', note: 'For the weekend' });
    expect(res.status).toBe(201);
    expect(res.body.data.preapproved).toBe(true);
    expect(rpcCalls(calls, 'family_request_redemption')[0]!.body).toEqual({ p_kid: KID, p_catalog: CATALOG, p_reason_kind: 'treat', p_note: 'For the weekend' });
    expect(calls.some((c) => c.url.includes('/rest/v1/redemptions') && c.method === 'POST')).toBe(false);
    expect(calls.some((c) => c.url.includes('/rpc/decide_redemption') || c.url.includes('/rpc/family_decide_redemption'))).toBe(false);
  });

  it('refuses an unknown reason kind before any write', async () => {
    const calls = stub();
    const res = await app().post('/api/v1/tasks/redemptions').set('Authorization', as(KID)).send({ catalogId: CATALOG, reasonKind: 'because' });
    expect(res.status).toBe(400);
    expect(writes(calls)).toHaveLength(0);
  });
});

// ── D.18: the Tutor's decisions ─────────────────────────────────────────────

describe("the Tutor's decisions carry an actionable reason (D.18)", () => {
  it('sends a chore back only with a task reason code and an actionable reason, as the caller', async () => {
    const calls = stub({ rpc: { family_decide_task: { status: 200, body: 'open' } } });
    const res = await app().post(`/api/v1/tasks/${TASK}/send-back`).set('Authorization', as(PARENT)).send({ reasonCode: 'redo', reason: GOOD });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'family_decide_task')[0]!.body).toEqual({ p_task: TASK, p_actor: PARENT, p_outcome: 'sent_back', p_reason_code: 'redo', p_reason: GOOD });
  });

  const BAD: [string, Record<string, unknown>, string][] = [
    ['no reason at all', {}, 'DECISION_REASON_REQUIRED'],
    ['a code with no reason', { reasonCode: 'redo' }, 'DECISION_REASON_REQUIRED'],
    ['a reason with no code', { reason: GOOD }, 'DECISION_REASON_REQUIRED'],
    ['a reward code on a chore', { reasonCode: 'save_more', reason: GOOD }, 'DECISION_REASON_REQUIRED'],
    ['"Not now"', { reasonCode: 'redo', reason: 'Not now' }, 'DECISION_REASON_NOT_ACTIONABLE'],
    ['"Ahora no"', { reasonCode: 'redo', reason: 'Ahora no' }, 'DECISION_REASON_NOT_ACTIONABLE'],
    ['"porque sim"', { reasonCode: 'redo', reason: 'porque sim' }, 'DECISION_REASON_NOT_ACTIONABLE'],
    ['a repeated word', { reasonCode: 'redo', reason: 'no no no no no no' }, 'DECISION_REASON_NOT_ACTIONABLE'],
    ['a date on a code that is not "later"', { reasonCode: 'redo', reason: GOOD, revisitOn: '2026-10-01' }, 'DECISION_REVISIT_INVALID'],
  ];
  for (const [label, body, code] of BAD) {
    it(`refuses sending back or cancelling a chore with ${label}, before any write`, async () => {
      const calls = stub();
      for (const path of ['send-back', 'cancel']) {
        const res = await app().post(`/api/v1/tasks/${TASK}/${path}`).set('Authorization', as(PARENT)).send(body);
        expect(res.status, `${path}`).toBe(400);
        expect(res.body.error.code).toBe(code);
      }
      expect(writes(calls)).toHaveLength(0);
    });
  }

  it('denies a reward only with a reward code and an actionable reason; "later" needs a date 1 to 90 days ahead', async () => {
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    let calls = stub();
    for (const [body, code] of [
      [{ approve: false }, 'DECISION_REASON_REQUIRED'],
      [{ approve: false, reasonCode: 'redo', reason: GOOD }, 'DECISION_REASON_REQUIRED'],
      [{ approve: false, reasonCode: 'later_date', reason: 'Let us wait until after your test on Friday.' }, 'DECISION_REVISIT_INVALID'],
      [{ approve: false, reasonCode: 'later_date', reason: 'Let us wait until after your test on Friday.', revisitOn: day(0) }, 'DECISION_REVISIT_INVALID'],
      [{ approve: false, reasonCode: 'later_date', reason: 'Let us wait until after your test on Friday.', revisitOn: day(95) }, 'DECISION_REVISIT_INVALID'],
      [{ approve: false, reasonCode: 'save_more', reason: 'Mais tarde' }, 'DECISION_REASON_NOT_ACTIONABLE'],
    ] as const) {
      const res = await app().post(`/api/v1/tasks/redemptions/${REDEMPTION}/decide`).set('Authorization', as(PARENT)).send(body);
      expect(res.body.error?.code, JSON.stringify(body)).toBe(code);
    }
    expect(writes(calls)).toHaveLength(0);
    calls = stub({ rpc: { family_decide_redemption: { status: 200, body: 'denied' } } });
    const reason = 'Let us wait until after your test on Friday.';
    const res = await app().post(`/api/v1/tasks/redemptions/${REDEMPTION}/decide`).set('Authorization', as(PARENT)).send({ approve: false, reasonCode: 'later_date', reason, revisitOn: day(3) });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'family_decide_redemption')[0]!.body).toEqual({ p_redemption: REDEMPTION, p_actor: PARENT, p_approve: false, p_reason_code: 'later_date', p_reason: reason, p_revisit_on: day(3) });
  });

  it('never reports a decision the database did not confirm', async () => {
    stub({ rpc: { family_decide_task: { status: 503, body: null } } });
    expect((await app().post(`/api/v1/tasks/${TASK}/send-back`).set('Authorization', as(PARENT)).send({ reasonCode: 'redo', reason: GOOD })).status).toBe(502);
    stub({ rpc: { family_decide_task: { status: 200, body: 'approved' } } });
    expect((await app().post(`/api/v1/tasks/${TASK}/send-back`).set('Authorization', as(PARENT)).send({ reasonCode: 'redo', reason: GOOD })).status).toBe(200);
    stub({ rpc: { family_decide_task: { status: 200, body: 'surprise' } } });
    expect((await app().post(`/api/v1/tasks/${TASK}/send-back`).set('Authorization', as(PARENT)).send({ reasonCode: 'redo', reason: GOOD })).status).toBe(502);
    stub({ rpc: { family_decide_task: refusal('DECISION_REASON_NOT_ACTIONABLE') } });
    expect((await app().post(`/api/v1/tasks/${TASK}/send-back`).set('Authorization', as(PARENT)).send({ reasonCode: 'redo', reason: GOOD })).body.error.code).toBe('DECISION_REASON_NOT_ACTIONABLE');
  });

  it("builds the queue with the child's own words next to each request, and leaves out what was already reviewed", async () => {
    const reviewedId = '31313131-3131-4313-8313-313131313131';
    stub({
      decisions: [decisionRow({ outcome: 'self_logged', actor_user_id: KID, actor_kind: 'child', reason_code: null, reason: null, prior_status: 'done' }),
        decisionRow({ id: reviewedId, outcome: 'preapproved', subject: 'redemption', task_id: null, redemption_id: REDEMPTION, actor_user_id: KID, actor_kind: 'child', reason_code: null, reason: null })],
      reviewed: [reviewedId],
      nudges: [{ id: NUDGE, kid_user_id: KID, origin: 'pattern', decision_id: DECISION, denials: 3, status: 'open', created_at: '2026-09-21T10:00:00Z', closed_at: null }],
      requests: [{ id: REQUEST, kid_user_id: KID, requested_level: 2, child_note: 'I did every chore', status: 'pending', created_at: '2026-09-21T10:00:00Z' }],
    });
    const res = await app().get('/api/v1/tasks/decisions/queue').set('Authorization', as(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.chores[0]).toMatchObject({ status: 'done', childNote: 'I also dried them' });
    expect(res.body.data.openChores[0]).toMatchObject({ status: 'open' });
    expect(res.body.data.rewards[0]).toMatchObject({ childReasonKind: 'saved_for_it', childNote: 'Three weeks of saving', title: 'Cinema', cost: 10 });
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0]).toMatchObject({ outcome: 'self_logged', title: 'Dishes', kidUserId: KID });
    expect(res.body.data.nudges[0]).toMatchObject({ origin: 'pattern', denials: 3 });
    expect(res.body.data.levelRequests[0]).toMatchObject({ level: 2, note: 'I did every chore' });
  });

  it('refuses a queue it cannot fully read (502), never a partial one', async () => {
    stub({ down: ['family_talk_nudges'] });
    expect((await app().get('/api/v1/tasks/decisions/queue').set('Authorization', as(PARENT))).status).toBe(502);
    stub({ down: ['family_decisions?kid_user_id'] });
    expect((await app().get('/api/v1/tasks/decisions/queue').set('Authorization', as(PARENT))).status).toBe(502);
  });

  it('reviews a self-directed item: "looks good", or a question with a reason; never a Tutor\'s own approval', async () => {
    const selfLogged = decisionRow({ outcome: 'self_logged', actor_user_id: KID, actor_kind: 'child', reason_code: null, reason: null });
    let calls = stub({ decision: selfLogged, rpc: { family_review_decision: { status: 200, body: 'questioned' } } });
    expect((await app().post(`/api/v1/tasks/decisions/${DECISION}/review`).set('Authorization', as(PARENT)).send({ outcome: 'questioned' })).body.error.code).toBe('DECISION_REASON_REQUIRED');
    expect(writes(calls)).toHaveLength(0);
    const res = await app().post(`/api/v1/tasks/decisions/${DECISION}/review`).set('Authorization', as(PARENT)).send({ outcome: 'questioned', reasonCode: 'redo', reason: GOOD });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'family_review_decision')[0]!.body).toEqual({ p_decision: DECISION, p_actor: PARENT, p_outcome: 'questioned', p_reason_code: 'redo', p_reason: GOOD });
    calls = stub({ decision: decisionRow({ outcome: 'approved' }) });
    expect((await app().post(`/api/v1/tasks/decisions/${DECISION}/review`).set('Authorization', as(PARENT)).send({ outcome: 'confirmed' })).status).toBe(404);
    expect(writes(calls)).toHaveLength(0);
  });

  it('closes a nudge as "we talked" or dismissed, as the caller', async () => {
    const calls = stub({ rpc: { family_talk_close: { status: 200, body: 'talked' } } });
    expect((await app().post(`/api/v1/tasks/nudges/${NUDGE}/close`).set('Authorization', as(PARENT)).send({ outcome: 'talked' })).status).toBe(200);
    expect(rpcCalls(calls, 'family_talk_close')[0]!.body).toEqual({ p_nudge: NUDGE, p_actor: PARENT, p_outcome: 'talked' });
    expect((await app().post(`/api/v1/tasks/nudges/${NUDGE}/close`).set('Authorization', as(PARENT)).send({ outcome: 'ignored' })).status).toBe(400);
  });

  const TUTOR_ROUTES: [string, string, Record<string, unknown>][] = [
    ['get', `/api/v1/tasks/${KID}/autonomy`, {}],
    ['put', `/api/v1/tasks/${KID}/autonomy`, { level: 2, preapprovedLimit: 10 }],
    ['post', `/api/v1/tasks/autonomy/requests/${REQUEST}/decide`, { grant: true, preapprovedLimit: 0 }],
    ['get', '/api/v1/tasks/decisions/queue', {}],
    ['post', `/api/v1/tasks/decisions/${DECISION}/review`, { outcome: 'confirmed' }],
    ['post', `/api/v1/tasks/nudges/${NUDGE}/close`, { outcome: 'talked' }],
    ['post', `/api/v1/tasks/${TASK}/send-back`, { reasonCode: 'redo', reason: GOOD }],
    ['post', `/api/v1/tasks/${TASK}/cancel`, { reasonCode: 'redo', reason: GOOD }],
    ['post', `/api/v1/tasks/${TASK}/approve`, {}],
    ['post', `/api/v1/tasks/redemptions/${REDEMPTION}/decide`, { approve: false, reasonCode: 'save_more', reason: GOOD }],
  ];
  for (const [label, who, extra] of NON_PARENTS) {
    it(`refuses ${label} every Tutor route before any write`, async () => {
      const calls = stub();
      for (const [method, path, body] of TUTOR_ROUTES) {
        const call = method === 'get' ? app().get(path) : method === 'put' ? app().put(path).send(body) : app().post(path).send(body);
        expect((await call.set('Authorization', as(who, extra))).status, `${label} ${method} ${path}`).toBe(403);
      }
      expect(writes(calls)).toHaveLength(0);
    });
  }

  it("404s an unrelated parent on another family's child, request, nudge, decision, chore and reward before any write", async () => {
    const calls = stub({ requestKid: KID, nudgeKid: KID });
    for (const [method, path, body] of TUTOR_ROUTES.filter(([, path]) => !path.endsWith('/decisions/queue'))) {
      const call = method === 'get' ? app().get(path) : method === 'put' ? app().put(path).send(body) : app().post(path).send(body);
      const res = await call.set('Authorization', as(STRANGER));
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect((await app().get(`/api/v1/tasks/decisions/queue?kidId=${KID}`).set('Authorization', as(STRANGER))).status).toBe(404);
    expect(writes(calls)).toHaveLength(0);
  });
});

// ── D.17: the Tutor moves a level ───────────────────────────────────────────

describe('the Tutor moves a level within the documented rule (D.17)', () => {
  it('moves a level up as the caller, and lets the database judge eligibility', async () => {
    let calls = stub({ rpc: { family_autonomy_set: { status: 200, body: 2 } } });
    expect((await app().put(`/api/v1/tasks/${KID}/autonomy`).set('Authorization', as(PARENT)).send({ level: 2, preapprovedLimit: 15 })).status).toBe(200);
    expect(rpcCalls(calls, 'family_autonomy_set')[0]!.body).toEqual({ p_kid: KID, p_actor: PARENT, p_level: 2, p_limit: 15, p_reason_code: null, p_reason: null });
    calls = stub({ rpc: { family_autonomy_set: refusal('AUTONOMY_NOT_ELIGIBLE') } });
    const refused = await app().put(`/api/v1/tasks/${KID}/autonomy`).set('Authorization', as(PARENT)).send({ level: 2, preapprovedLimit: 15 });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('AUTONOMY_NOT_ELIGIBLE');
  });

  it('refuses an amount over the level cap, a reason on a raise, and a lowering without an actionable reason, before any write', async () => {
    const lowered = { ...STATUS, level: 2, stored_level: 2, preapproved_limit: 10, preapproved_cap: 20, self_log_contributions: true };
    const calls = stub({ rpc: { family_autonomy_status: { status: 200, body: lowered } } });
    const put = (body: Record<string, unknown>) => app().put(`/api/v1/tasks/${KID}/autonomy`).set('Authorization', as(PARENT)).send(body);
    expect((await put({ level: 2, preapprovedLimit: 21 })).body.error.code).toBe('AUTONOMY_LIMIT_INVALID');
    expect((await put({ level: 3, preapprovedLimit: 10, reasonCode: 'practice_more', reason: GOOD })).body.error.code).toBe('AUTONOMY_REASON_INVALID');
    expect((await put({ level: 1, preapprovedLimit: 0 })).body.error.code).toBe('AUTONOMY_REASON_REQUIRED');
    expect((await put({ level: 1, preapprovedLimit: 0, reasonCode: 'practice_more', reason: 'Maybe later' })).body.error.code).toBe('AUTONOMY_REASON_REQUIRED');
    expect((await put({ level: 1, preapprovedLimit: 0, reasonCode: 'practice_more', reason: GOOD, kidId: OTHER_KID })).status).toBe(400);
    expect(rpcCalls(calls, 'family_autonomy_set')).toHaveLength(0);
  });

  it('answers the child\'s ask: grant as the caller, or "not yet" only with a level code and an actionable reason', async () => {
    let calls = stub({ rpc: { family_autonomy_decide_request: { status: 200, body: 'granted' } } });
    expect((await app().post(`/api/v1/tasks/autonomy/requests/${REQUEST}/decide`).set('Authorization', as(PARENT)).send({ grant: true, preapprovedLimit: 5 })).status).toBe(200);
    expect(rpcCalls(calls, 'family_autonomy_decide_request')[0]!.body).toEqual({ p_request: REQUEST, p_actor: PARENT, p_grant: true, p_limit: 5, p_reason_code: null, p_reason: null, p_revisit_on: null });
    calls = stub();
    for (const body of [{ grant: false }, { grant: false, reasonCode: 'redo', reason: GOOD }, { grant: false, reasonCode: 'talk_first', reason: 'Not now' }]) {
      expect((await app().post(`/api/v1/tasks/autonomy/requests/${REQUEST}/decide`).set('Authorization', as(PARENT)).send(body)).status).toBe(400);
    }
    expect(writes(calls)).toHaveLength(0);
  });
});

// ── Staff: the rollback path and the Appendix H metrics ─────────────────────

describe('staff: the product-team rollback (D.17 DoD (d)) and the Appendix H metrics', () => {
  it('lets support staff lower a level with a reason, as the caller; analytics-only and ungranted staff are refused', async () => {
    let calls = stub({ staffGrants: ['manage_support'], rpc: { family_autonomy_staff_lower: { status: 200, body: 1 } } });
    const reason = 'Support review found the level was reached by mistake.';
    expect((await app().post(`/api/v1/admin/family-autonomy/${KID}/lower`).set('Authorization', as(STAFF)).send({ level: 1, reason })).status).toBe(200);
    expect(rpcCalls(calls, 'family_autonomy_staff_lower')[0]!.body).toEqual({ p_kid: KID, p_staff: STAFF, p_level: 1, p_reason: reason });
    expect((await app().post(`/api/v1/admin/family-autonomy/${KID}/lower`).set('Authorization', as(STAFF)).send({ level: 1, reason: 'Not now' })).status).toBe(400);
    expect((await app().post(`/api/v1/admin/family-autonomy/${KID}/lower`).set('Authorization', as(STAFF)).send({ level: 3, reason })).status).toBe(400);
    for (const grants of [['view_analytics'], []]) {
      calls = stub({ staffGrants: grants });
      expect((await app().post(`/api/v1/admin/family-autonomy/${KID}/lower`).set('Authorization', as(STAFF)).send({ level: 1, reason })).status).toBe(403);
      expect(rpcCalls(calls, 'family_autonomy_staff_lower')).toHaveLength(0);
    }
    for (const who of [PARENT, KID, ADULT]) {
      expect((await app().post(`/api/v1/admin/family-autonomy/${KID}/lower`).set('Authorization', as(who)).send({ level: 1, reason })).status).toBe(403);
    }
    stub({ staffGrants: ['manage_support'], rpc: { family_autonomy_staff_lower: refusal('AUTONOMY_STAFF_LOWER_ONLY') } });
    expect((await app().post(`/api/v1/admin/family-autonomy/${KID}/lower`).set('Authorization', as(STAFF)).send({ level: 2, reason })).status).toBe(409);
  });

  it('serves the progression, nudge and actionability metrics to analytics staff only, with null rates for empty populations', async () => {
    stub({
      staffGrants: ['view_analytics'],
      rpc: {
        family_autonomy_progression: { status: 200, body: [{ level: 2, judged: 3, progressed: 1, waiting: 1 }, { level: 3, judged: 0, progressed: 0, waiting: 0 }] },
        family_autonomy_step_downs: { status: 200, body: [{ actor_kind: 'child', step_downs: 0 }, { actor_kind: 'staff', step_downs: 0 }, { actor_kind: 'system', step_downs: 1 }, { actor_kind: 'tutor', step_downs: 1 }] },
        family_talk_nudge_rate: { status: 200, body: [{ patterns: 2, nudged: 1, child_asks: 1, talked: 1, dismissed: 0, still_open: 1 }] },
        family_denial_actionability: { status: 200, body: [{ denials: 9, structured: 9, admitted: 8, scored: 4, actionable: 3 }] },
      },
    });
    const progression = await app().get('/api/v1/admin/family/autonomy-progression').set('Authorization', as(STAFF));
    expect(progression.body.data.levels).toEqual([
      { level: 2, judged: 3, progressed: 1, waiting: 1, progressionRate: 1 / 3 }, { level: 3, judged: 0, progressed: 0, waiting: 0, progressionRate: null },
    ]);
    expect(progression.body.data.stepDowns).toEqual({ child: 0, staff: 0, system: 1, tutor: 1 });
    expect((await app().get('/api/v1/admin/family/talk-nudges').set('Authorization', as(STAFF))).body.data).toMatchObject({ patterns: 2, nudged: 1, triggerRate: 0.5 });
    expect((await app().get('/api/v1/admin/family/denial-actionability').set('Authorization', as(STAFF))).body.data).toMatchObject({ structuredRate: 1, actionabilityRate: 0.75 });
    stub({ staffGrants: [] });
    for (const path of ['autonomy-progression', 'talk-nudges', 'denial-actionability', 'denial-reasons/sample']) {
      expect((await app().get(`/api/v1/admin/family/${path}`).set('Authorization', as(STAFF))).status, path).toBe(403);
    }
    stub({ staffGrants: ['view_analytics'], rpc: { family_talk_nudge_rate: { status: 200, body: [] } } });
    expect((await app().get('/api/v1/admin/family/talk-nudges').set('Authorization', as(STAFF))).status).toBe(502);
  });

  it('samples reasons with no identity beyond an opaque id, and records a score as the caller', async () => {
    let calls = stub({
      staffGrants: ['view_analytics'],
      rpc: { family_denial_reason_sample: { status: 200, body: [{ decision_id: DECISION, subject: 'task', outcome: 'sent_back', reason_code: 'redo', reason: GOOD, created_at: '2026-09-20T10:00:00Z' }] } },
    });
    const sample = await app().get('/api/v1/admin/family/denial-reasons/sample?limit=5').set('Authorization', as(STAFF));
    expect(sample.body.data.reasons).toEqual([{ id: DECISION, subject: 'task', outcome: 'sent_back', reasonCode: 'redo', reason: GOOD, passesStructuralCheck: true }]);
    expect(rpcCalls(calls, 'family_denial_reason_sample')[0]!.body).toMatchObject({ p_limit: 5 });
    expect((await app().get('/api/v1/admin/family/denial-reasons/sample?limit=500').set('Authorization', as(STAFF))).status).toBe(400);
    calls = stub({ staffGrants: ['view_analytics'], rpc: { family_score_denial_reason: { status: 200, body: true } } });
    expect((await app().post(`/api/v1/admin/family/denial-reasons/${DECISION}/score`).set('Authorization', as(STAFF)).send({ actionable: true })).status).toBe(200);
    expect(rpcCalls(calls, 'family_score_denial_reason')[0]!.body).toEqual({ p_decision: DECISION, p_staff: STAFF, p_actionable: true });
    stub({ staffGrants: ['view_analytics'], rpc: { family_score_denial_reason: refusal('DENIAL_SCORE_INVALID') } });
    expect((await app().post(`/api/v1/admin/family/denial-reasons/${DECISION}/score`).set('Authorization', as(STAFF)).send({ actionable: true })).status).toBe(404);
  });
});
