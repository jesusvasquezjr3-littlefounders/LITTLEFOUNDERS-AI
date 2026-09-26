import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  DATA_POLICY, RETENTION_EVIDENCE_DAYS, RETENTION_INVITES_DAYS, RETENTION_RECORDS_DAYS, RETENTION_RESEARCH_DAYS,
} from '../services/familyRetention.js';
import { COACHING_REFLECTION_WINDOW_MINUTES, COACHING_TIPS, REFLECTIONS, reviewedTipIds } from '../services/parentCoaching.js';
import { MONEY_BRIDGE_MIN_AGE } from '../services/moneyBridge.js';
import { RESEARCH_DISCLOSURE_VERSION } from '../services/familyResearch.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S07.7 at the Core boundary.
 *   D.23  the reflective prompt is required on every Tutor decision and
 *         recorded as the caller; the monthly tip reaches Tutors only, and only
 *         reviewed tips are ever passed to the database
 *   D.21  the nightly retention run deletes photos from Depot before their
 *         pointer is cleared, never reports an unreachable database as done,
 *         and the policy a family reads is the enforced numbers
 *   D.22  research consent: the Tutor for their own child, the participant's
 *         own no, the caller as actor; everything else refused
 *   D.19  the bridge for wallet holders, by the database's age decision
 *   metrics served to analytics staff only
 * Populations: a parent-created child, a teen who linked a verified parent,
 * an unlinked self-registered teen, an adult learner, a guest, the verified
 * parent Tutor, an unrelated parent, and staff with the analytics grant, the
 * support grant or none. PostgreSQL is the enforcing boundary for every rule
 * (database/scripts/verify-family-governance-postgres.py).
 */

const KID = '22222222-2222-4222-8222-222222222222';
const LINKED_TEEN = '56565656-5656-4565-8565-565656565656';
const TEEN = '55555555-5555-4555-8555-555555555555';
const ADULT = '77777777-7777-4777-8777-777777777777';
const GUEST = '88888888-8888-4888-8888-888888888888';
const PARENT = '11111111-1111-4111-8111-111111111111';
const STRANGER = '12121212-1212-4121-8121-121212121212';
const ANALYST = '66666666-6666-4666-8666-666666666666';
const SUPPORT = '67676767-6767-4676-8676-676767676767';
const TASK = '33333333-3333-4333-8333-333333333333';
const REDEMPTION = '44444444-4444-4444-8444-444444444444';
const DELIVERY = '99999999-9999-4999-8999-999999999999';
const DECISION = '31313131-3131-4313-8313-313131313131';
const REQUEST = '41414141-4141-4414-8414-414141414141';
const INTERNAL_KEY = 'test-internal-key-0123456789';

const ROLES: Record<string, string[]> = {
  [KID]: ['kid'], [LINKED_TEEN]: ['universal'], [TEEN]: ['universal'], [ADULT]: ['universal'], [GUEST]: ['universal'],
  [PARENT]: ['parent'], [STRANGER]: ['parent'], [ANALYST]: ['admin'], [SUPPORT]: ['admin'],
};
const ACCESS: Record<string, { kind: string | null; verified_guardians: number }> = {
  [LINKED_TEEN]: { kind: 'teen', verified_guardians: 1 },
  [TEEN]: { kind: 'teen', verified_guardians: 0 },
  [ADULT]: { kind: null, verified_guardians: 0 },
  [GUEST]: { kind: null, verified_guardians: 0 },
};
const GRANTS: Record<string, string[]> = { [ANALYST]: ['view_analytics'], [SUPPORT]: ['manage_support'] };
const GUARDED: Record<string, string[]> = { [PARENT]: [KID, LINKED_TEEN], [STRANGER]: [] };

const delivery = (over: Record<string, unknown> = {}) => ({
  id: DELIVERY, tip_id: 'keep-promises', period: '2026-09-01', delivered_at: '2026-09-24T10:00:00Z', opened_at: null, dismissed_at: null, ...over,
});
const research = (over: Record<string, unknown> = {}) => ({
  participating: true, admitted: true, grantor: 'tutor', since: '2026-06-01T00:00:00Z', version: 1, adult: false, snapshots: 3, ...over,
});
const bridge = (over: Record<string, unknown> = {}) => ({
  eligible: true, progress: [{ milestone: 'first_pay', step: 0, done_at: '2026-09-20T00:00:00Z' }, { milestone: 'first_pay', step: 2, done_at: '2026-09-21T00:00:00Z' }], ...over,
});

interface Call { url: string; method: string; body: Record<string, unknown> | undefined }
type Reply = { status: number; body: unknown };

function stub(rpc: Record<string, Reply | ((body: Record<string, unknown>) => Reply)> = {}, opts: { depot?: number; decision?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, body });
    if (url.includes('/api/v1/files/')) return Promise.resolve(new Response(null, { status: opts.depot ?? 204 }));
    const name = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (name === 'wallet_access') return Promise.resolve(jsonResponse(200, ACCESS[(body as { p_user: string }).p_user] ?? { kind: null, verified_guardians: 0 }));
    if (name && rpc[name]) {
      const reply = typeof rpc[name] === 'function' ? (rpc[name] as (b: Record<string, unknown>) => Reply)(body ?? {}) : rpc[name] as Reply;
      return Promise.resolve(jsonResponse(reply.status, reply.body));
    }
    if (name === 'record_decision_reflection') return Promise.resolve(jsonResponse(200, DECISION));
    if (name) return Promise.resolve(jsonResponse(500, { message: `unstubbed rpc ${name}` }));
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (ROLES[id] ?? ['universal']).map((role) => ({ user_id: id, role }))));
    }
    if (url.includes('/rest/v1/admin_permissions')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)?.[1] ?? '';
      return Promise.resolve(jsonResponse(200, (GRANTS[id] ?? []).map((permission) => ({ permission }))));
    }
    if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
      const id = url.match(/parent_user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (GUARDED[id] ?? []).map((kid_user_id) => ({ parent_user_id: id, kid_user_id, verification_status: 'verified' }))));
    }
    if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
    if (url.includes('/rest/v1/tasks?id=eq.')) {
      return Promise.resolve(jsonResponse(200, [{
        id: TASK, assigned_by: PARENT, assigned_to: KID, title: 'Dishes', status: 'done', created_at: '2026-09-20T00:00:00Z', reward_coins: 3,
        recurrence: 'once', due_at: null, allocated: false, evidence_bucket: null, evidence_hash: null, evidence_ext: null, evidence_uploaded_at: null,
        cancel_reason: null, requires_evidence: false, decided_by: null, decided_at: null, completed_on: '2026-09-20', kind: 'bonus', child_note: null, decision_id: null,
      }]));
    }
    if (url.includes('/rest/v1/redemptions?id=eq.')) {
      return Promise.resolve(jsonResponse(200, [{ id: REDEMPTION, catalog_id: TASK, kid_user_id: KID, status: 'requested', created_at: '2026-09-20T00:00:00Z',
        decided_at: null, decided_by: null, fulfilled_by: null, fulfilled_at: null, child_reason_kind: 'treat', child_note: null, decision_id: null }]));
    }
    if (url.includes('/rest/v1/family_decisions?id=eq.')) return Promise.resolve(jsonResponse(200, [opts.decision ?? {}]));
    if (url.includes('/rest/v1/family_autonomy_requests?id=eq.')) return Promise.resolve(jsonResponse(200, [{ kid_user_id: KID }]));
    return Promise.resolve(jsonResponse(500, { message: `unstubbed ${url}` }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const auth = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const app = () => request(createApp());
const rpcCalls = (calls: Call[], name: string) => calls.filter((c) => c.url.includes(`/rpc/${name}`));
const rpcNamed = (calls: Call[]) => calls.filter((c) => c.url.includes('/rpc/') && !c.url.includes('/rpc/wallet_access'));
const refusal = (message: string): Reply => ({ status: 400, body: { code: 'P0001', message } });
const root = fileURLToPath(new URL('../../../', import.meta.url));
const migration = (suffix: string) => {
  const dir = join(root, 'database/migrations');
  const name = readdirSync(dir).find((f) => f.endsWith(`${suffix}.sql`));
  if (!name) throw new Error(`no migration ending ${suffix}`);
  return readFileSync(join(dir, name), 'utf8').split('\r\n').join('\n');
};

const NON_TUTORS: [string, string, { is_anonymous?: boolean }][] = [
  ['a parent-created child', KID, {}], ['a linked teen', LINKED_TEEN, {}], ['an unlinked teen', TEEN, {}], ['an adult learner', ADULT, {}],
  ['a guest', GUEST, { is_anonymous: true }], ['staff', ANALYST, {}],
];

describe('S07.7 constants agree with the database', () => {
  it('the retention periods the family reads are the ones family_retention_days() enforces', () => {
    const sql = migration('_family_data_retention');
    expect(sql).toContain(`WHEN 'evidence' THEN ${RETENTION_EVIDENCE_DAYS}`);
    expect(sql).toContain(`WHEN 'records' THEN ${RETENTION_RECORDS_DAYS}`);
    expect(sql).toContain(`WHEN 'invites' THEN ${RETENTION_INVITES_DAYS}`);
    expect(sql).toContain(`WHEN 'research' THEN ${RETENTION_RESEARCH_DAYS}`);
    expect(DATA_POLICY.map((c) => c.id)).toEqual(['photos', 'records', 'coins', 'insights', 'research', 'erasure', 'sharing']);
    expect(DATA_POLICY.find((c) => c.id === 'photos')!.days).toBe(RETENTION_EVIDENCE_DAYS);
  });

  it('the bridge opens at the age the database checks, the reflection window and disclosure version match', () => {
    expect(migration('_money_bridge')).toContain(`, 0) >= ${MONEY_BRIDGE_MIN_AGE};`);
    expect(migration('_parent_coaching')).toContain(`interval '${COACHING_REFLECTION_WINDOW_MINUTES} minutes'`);
    expect(migration('_family_research_instrumentation')).toContain(`SELECT ${RESEARCH_DISCLOSURE_VERSION}::smallint`);
    expect(REFLECTIONS).toEqual(['written', 'shared', 'skipped']);
  });

  it('every tip has a unique id the database accepts and cites Appendix G; no tip is delivered before its review', () => {
    const ids = COACHING_TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tip of COACHING_TIPS) {
      expect(tip.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(tip.appendixG.length).toBeGreaterThan(0);
    }
    expect(reviewedTipIds([{ id: 'a-tip', appendixG: ['1.1'], reviewed: false }, { id: 'b-tip', appendixG: ['1.2'], reviewed: true }])).toEqual(['b-tip']);
  });
});

describe('D.23: the reflective prompt is required on every Tutor decision', () => {
  const GOOD = 'Please finish drying the plates first';
  const ROUTES: [string, string, Record<string, unknown>, Record<string, Reply>, 'task' | 'redemption' | 'level_request', string][] = [
    ['approve a chore', `/tasks/${TASK}/approve`, {}, { family_decide_task: { status: 200, body: 'approved' } }, 'task', TASK],
    ['send a chore back', `/tasks/${TASK}/send-back`, { reasonCode: 'redo', reason: GOOD }, { family_decide_task: { status: 200, body: 'open' } }, 'task', TASK],
    ['cancel a chore', `/tasks/${TASK}/cancel`, { reasonCode: 'redo', reason: GOOD }, { family_decide_task: { status: 200, body: 'cancelled' } }, 'task', TASK],
    ['answer a reward', `/tasks/redemptions/${REDEMPTION}/decide`, { approve: true }, { family_decide_redemption: { status: 200, body: 'approved' } }, 'redemption', REDEMPTION],
    ['deny a reward', `/tasks/redemptions/${REDEMPTION}/decide`, { approve: false, reasonCode: 'save_more', reason: GOOD },
      { family_decide_redemption: { status: 200, body: 'denied' } }, 'redemption', REDEMPTION],
    ['answer a level request', `/tasks/autonomy/requests/${REQUEST}/decide`, { grant: true, preapprovedLimit: 0 },
      { family_autonomy_decide_request: { status: 200, body: 'granted' } }, 'level_request', REQUEST],
  ];

  for (const [label, path, body, rpc, subject, subjectId] of ROUTES) {
    it(`refuses to ${label} without the reflection step, before any write`, async () => {
      for (const bad of [{}, { reflection: 'maybe' }, { reflection: null }]) {
        const calls = stub(rpc);
        const res = await app().post(`/api/v1${path}`).set('Authorization', auth(PARENT)).send({ ...body, ...bad });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('REFLECTION_REQUIRED');
        expect(rpcNamed(calls)).toHaveLength(0);
      }
    });

    it(`records the reflection of "${label}" as the caller, after the decision`, async () => {
      for (const reflection of REFLECTIONS) {
        const calls = stub(rpc);
        const res = await app().post(`/api/v1${path}`).set('Authorization', auth(PARENT)).send({ ...body, reflection });
        expect(res.status).toBe(200);
        const decided = rpcNamed(calls).findIndex((c) => !c.url.includes('record_decision_reflection'));
        const recorded = rpcNamed(calls).findIndex((c) => c.url.includes('record_decision_reflection'));
        expect(decided).toBeGreaterThanOrEqual(0);
        expect(recorded).toBeGreaterThan(decided);
        expect(rpcCalls(calls, 'record_decision_reflection')[0]!.body).toEqual({ p_actor: PARENT, p_subject: subject, p_subject_id: subjectId, p_reflection: reflection });
      }
    });
  }

  it('records a review of a self-logged chore on the chore it reviewed', async () => {
    const calls = stub({ family_review_decision: { status: 200, body: 'confirmed' } }, {
      decision: { id: DECISION, kid_user_id: KID, subject: 'task', task_id: TASK, redemption_id: null, level_request_id: null, prior_status: 'done',
        outcome: 'self_logged', reviews_decision_id: null, actor_user_id: KID, actor_kind: 'child', reason_code: null, reason: null, revisit_on: null,
        legacy: false, created_at: '2026-09-24T10:00:00Z' },
    });
    expect((await app().post(`/api/v1/tasks/decisions/${DECISION}/review`).set('Authorization', auth(PARENT)).send({ outcome: 'confirmed' })).body.error.code)
      .toBe('REFLECTION_REQUIRED');
    const res = await app().post(`/api/v1/tasks/decisions/${DECISION}/review`).set('Authorization', auth(PARENT)).send({ outcome: 'confirmed', reflection: 'written' });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'record_decision_reflection')[0]!.body).toEqual({ p_actor: PARENT, p_subject: 'task', p_subject_id: TASK, p_reflection: 'written' });
  });

  it('never carries the Tutor\'s words: a reflection text field is refused', async () => {
    const calls = stub({ family_decide_task: { status: 200, body: 'approved' } });
    const res = await app().post(`/api/v1/tasks/${TASK}/approve`).set('Authorization', auth(PARENT)).send({ reflection: 'written', reflectionText: 'I felt unsure' });
    expect(res.status).toBe(400);
    expect(rpcNamed(calls)).toHaveLength(0);
  });

  it('keeps a decision the database recorded even when the reflection record fails', async () => {
    const calls = stub({ family_decide_task: { status: 200, body: 'approved' }, record_decision_reflection: refusal('REFLECTION_NO_DECISION') });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app().post(`/api/v1/tasks/${TASK}/approve`).set('Authorization', auth(PARENT)).send({ reflection: 'skipped' });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'record_decision_reflection')).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('D.23: the monthly tip', () => {
  it('asks the database for this month\'s tip as the caller, passing only reviewed tips', async () => {
    const calls = stub({ parent_coaching_deliver: { status: 200, body: null } });
    const res = await app().get('/api/v1/family-hub/coaching').set('Authorization', auth(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ tip: null });
    expect(rpcCalls(calls, 'parent_coaching_deliver')[0]!.body).toEqual({ p_tutor: PARENT, p_tips: reviewedTipIds() });
    expect(reviewedTipIds()).toEqual(COACHING_TIPS.filter((t) => t.reviewed).map((t) => t.id));
  });

  it('serves a delivered tip by id and month, never a date or another Tutor\'s row', async () => {
    stub({ parent_coaching_deliver: { status: 200, body: delivery() } });
    const res = await app().get('/api/v1/family-hub/coaching').set('Authorization', auth(PARENT));
    expect(res.body.data).toEqual({ tip: { deliveryId: DELIVERY, tipId: 'keep-promises', period: '2026-09', opened: false, dismissed: false } });
  });

  it('refuses a malformed delivery and an unreachable database (502), never a made-up tip', async () => {
    stub({ parent_coaching_deliver: { status: 200, body: { ...delivery(), tutor_user_id: STRANGER } } });
    expect((await app().get('/api/v1/family-hub/coaching').set('Authorization', auth(PARENT))).status).toBe(502);
    stub({ parent_coaching_deliver: { status: 503, body: null } });
    expect((await app().get('/api/v1/family-hub/coaching').set('Authorization', auth(PARENT))).status).toBe(502);
  });

  it('maps "not a Tutor" from the database (a parent with no verified child)', async () => {
    stub({ parent_coaching_deliver: refusal('COACHING_NOT_ELIGIBLE') });
    const res = await app().get('/api/v1/family-hub/coaching').set('Authorization', auth(STRANGER));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COACHING_NOT_ELIGIBLE');
  });

  it('marks opened and dismissed as the caller; another Tutor\'s delivery is a 404', async () => {
    let calls = stub({ parent_coaching_mark: { status: 200, body: delivery({ opened_at: '2026-09-24T11:00:00Z' }) } });
    const res = await app().post(`/api/v1/family-hub/coaching/${DELIVERY}/opened`).set('Authorization', auth(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.tip.opened).toBe(true);
    expect(rpcCalls(calls, 'parent_coaching_mark')[0]!.body).toEqual({ p_delivery: DELIVERY, p_tutor: PARENT, p_action: 'opened' });
    calls = stub({ parent_coaching_mark: refusal('COACHING_NOT_FOUND') });
    expect((await app().post(`/api/v1/family-hub/coaching/${DELIVERY}/dismissed`).set('Authorization', auth(STRANGER))).status).toBe(404);
    expect((await app().post('/api/v1/family-hub/coaching/not-a-uuid/opened').set('Authorization', auth(PARENT))).status).toBe(400);
  });

  for (const [label, who, extra] of NON_TUTORS) {
    it(`refuses ${label} every coaching route before any read`, async () => {
      const calls = stub({ parent_coaching_deliver: { status: 200, body: delivery() }, parent_coaching_mark: { status: 200, body: delivery() } });
      expect((await app().get('/api/v1/family-hub/coaching').set('Authorization', auth(who, extra))).status).toBe(403);
      expect((await app().post(`/api/v1/family-hub/coaching/${DELIVERY}/opened`).set('Authorization', auth(who, extra))).status).toBe(403);
      expect(rpcNamed(calls)).toHaveLength(0);
    });
  }
});

describe('D.21: the policy a family reads and the nightly run', () => {
  it('serves the enforced periods to a Tutor and to a child alike', async () => {
    stub();
    for (const who of [PARENT, KID, TEEN]) {
      const res = await app().get('/api/v1/family-hub/data-policy').set('Authorization', auth(who));
      expect(res.status).toBe(200);
      expect(res.body.data.classes).toEqual(DATA_POLICY.map((c) => ({ ...c })));
    }
    expect((await app().get('/api/v1/family-hub/data-policy')).status).toBe(401);
  });

  const SWEEP = { family_decisions: 2, tasks: 1, redemptions: 0, run_id: 7 };
  const DUE = [
    { task_id: TASK, bucket: 'task-evidence', hash: 'a1b2', ext: 'jpg', shared: false },
    { task_id: REDEMPTION, bucket: 'task-evidence', hash: 'c3d4', ext: 'png', shared: true },
  ];

  it('refuses the run without the internal key, before any database call', async () => {
    const calls = stub({ family_retention_sweep: { status: 200, body: SWEEP } });
    expect((await app().post('/api/v1/family-hub/internal/retention/run')).status).toBe(403);
    expect((await app().post('/api/v1/family-hub/internal/retention/run').set('x-internal-api-key', 'wrong')).status).toBe(403);
    expect((await app().post('/api/v1/family-hub/internal/retention/run').set('Authorization', auth(ANALYST))).status).toBe(403);
    expect(rpcNamed(calls)).toHaveLength(0);
  });

  it('sweeps, deletes each photo from Depot before clearing its pointer, keeps a shared object, and records the run', async () => {
    const calls = stub({
      family_retention_sweep: { status: 200, body: SWEEP }, family_evidence_due: { status: 200, body: DUE },
      family_evidence_cleared: { status: 200, body: true }, record_family_evidence_purge: { status: 200, body: true },
    });
    const res = await app().post('/api/v1/family-hub/internal/retention/run').set('x-internal-api-key', INTERNAL_KEY).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ runId: 7, removed: { family_decisions: 2, tasks: 1, redemptions: 0 }, evidence: { due: 2, deleted: 1, kept: 1, cleared: 2, failed: 0 } });
    const depot = calls.filter((c) => c.url.includes('/api/v1/files/'));
    expect(depot).toHaveLength(1);
    expect(depot[0]!.url).toContain('/api/v1/files/task-evidence/a1b2.jpg');
    expect(depot[0]!.method).toBe('DELETE');
    const order = calls.map((c) => (c.url.includes('/api/v1/files/') ? 'depot' : c.url.match(/\/rpc\/([a-z_]+)/)?.[1] ?? c.url));
    expect(order.indexOf('depot')).toBeLessThan(order.indexOf('family_evidence_cleared'));
    expect(rpcCalls(calls, 'record_family_evidence_purge')[0]!.body).toEqual({ p_run: 7, p_cleared: 2, p_failed: 0 });
    expect(calls.some((c) => c.url.includes('/rest/v1/audit_logs'))).toBe(true);
  });

  it('leaves a photo\'s pointer in place when Depot fails, so the next night retries it', async () => {
    const calls = stub({
      family_retention_sweep: { status: 200, body: SWEEP }, family_evidence_due: { status: 200, body: [DUE[0]] },
      family_evidence_cleared: { status: 200, body: true }, record_family_evidence_purge: { status: 200, body: true },
    }, { depot: 500 });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app().post('/api/v1/family-hub/internal/retention/run').set('x-internal-api-key', INTERNAL_KEY).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.evidence).toEqual({ due: 1, deleted: 0, kept: 0, cleared: 0, failed: 1 });
    expect(rpcCalls(calls, 'family_evidence_cleared')).toHaveLength(0);
    spy.mockRestore();
  });

  it('never reports a run the database did not do (502)', async () => {
    stub({ family_retention_sweep: { status: 503, body: null } });
    expect((await app().post('/api/v1/family-hub/internal/retention/run').set('x-internal-api-key', INTERNAL_KEY).send({})).status).toBe(502);
    stub({ family_retention_sweep: { status: 200, body: { tasks: 'many', run_id: 1 } } });
    expect((await app().post('/api/v1/family-hub/internal/retention/run').set('x-internal-api-key', INTERNAL_KEY).send({})).status).toBe(502);
    stub();
    expect((await app().post('/api/v1/family-hub/internal/retention/run').set('x-internal-api-key', INTERNAL_KEY).send({ limit: 0 })).status).toBe(400);
  });
});

describe('D.22: research participation', () => {
  it('lets a Tutor read and answer for their own child, as the caller, naming the description version', async () => {
    let calls = stub({ family_research_state: { status: 200, body: research() } });
    const res = await app().get(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ research: { participating: true, recording: true, grantor: 'tutor', since: '2026-06-01T00:00:00Z', disclosureVersion: 1, adult: false, months: 3 },
      currentVersion: RESEARCH_DISCLOSURE_VERSION });
    calls = stub({ family_research_set_consent: { status: 200, body: research() } });
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(PARENT)).send({ participate: true })).status).toBe(400);
    const yes = await app().put(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(PARENT)).send({ participate: true, disclosureVersion: 1 });
    expect(yes.status).toBe(200);
    expect(rpcCalls(calls, 'family_research_set_consent')[0]!.body).toEqual({ p_subject: KID, p_actor: PARENT, p_participate: true, p_version: 1 });
  });

  it('refuses an unrelated parent before any research read or write (404), and a body naming someone else', async () => {
    const calls = stub({ family_research_state: { status: 200, body: research() }, family_research_set_consent: { status: 200, body: research() } });
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(STRANGER))).status).toBe(404);
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(STRANGER)).send({ participate: false })).status).toBe(404);
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(PARENT)).send({ participate: false, subject: TEEN })).status).toBe(400);
    expect(rpcNamed(calls)).toHaveLength(0);
  });

  it('maps the database refusals: not allowed (403) and an older description (409)', async () => {
    stub({ family_research_set_consent: refusal('RESEARCH_CONSENT_NOT_ALLOWED') });
    expect((await app().put(`/api/v1/family-hub/kids/${LINKED_TEEN}/research`).set('Authorization', auth(PARENT)).send({ participate: true, disclosureVersion: 1 })).body.error.code)
      .toBe('RESEARCH_CONSENT_NOT_ALLOWED');
    stub({ family_research_set_consent: refusal('RESEARCH_DISCLOSURE_STALE') });
    expect((await app().put(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(PARENT)).send({ participate: true, disclosureVersion: 1 })).status).toBe(409);
  });

  it('refuses a state that claims recording without a yes (502)', async () => {
    stub({ family_research_state: { status: 200, body: research({ participating: false, grantor: null, since: null, admitted: true }) } });
    expect((await app().get(`/api/v1/family-hub/kids/${KID}/research`).set('Authorization', auth(PARENT))).status).toBe(502);
  });

  it.each([['a parent-created child', KID], ['a linked teen', LINKED_TEEN], ['an unlinked teen', TEEN]])(
    'lets %s read their own participation and say no, as the caller', async (_label, who) => {
      const calls = stub({ family_research_state: { status: 200, body: research() }, family_research_set_consent: { status: 200, body: research({ participating: false, admitted: false, grantor: null, since: null, snapshots: 0 }) } });
      expect((await app().get('/api/v1/family-hub/research/me').set('Authorization', auth(who))).status).toBe(200);
      const no = await app().put('/api/v1/family-hub/research/me').set('Authorization', auth(who)).send({ participate: false });
      expect(no.status).toBe(200);
      expect(no.body.data.research.months).toBe(0);
      expect(rpcCalls(calls, 'family_research_set_consent')[0]!.body).toEqual({ p_subject: who, p_actor: who, p_participate: false, p_version: RESEARCH_DISCLOSURE_VERSION });
    });

  it.each([['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', ANALYST, {}]])(
    'refuses %s the participant routes before any research call', async (_label, who, extra) => {
      const calls = stub({ family_research_state: { status: 200, body: research() } });
      expect((await app().get('/api/v1/family-hub/research/me').set('Authorization', auth(who, extra))).status).toBe(403);
      expect((await app().put('/api/v1/family-hub/research/me').set('Authorization', auth(who, extra)).send({ participate: false })).status).toBe(403);
      expect(rpcCalls(calls, 'family_research_state')).toHaveLength(0);
      expect(rpcCalls(calls, 'family_research_set_consent')).toHaveLength(0);
    });
});

describe('D.19: the older-teen bridge', () => {
  it('reads the bridge as the caller and presents each moment with its ticked steps', async () => {
    const calls = stub({ money_bridge_state: { status: 200, body: bridge() } });
    const res = await app().get('/api/v1/family-hub/bridge').set('Authorization', auth(TEEN));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ eligible: true, minAge: MONEY_BRIDGE_MIN_AGE, moments: [
      { milestone: 'first_pay', arrived: true, steps: [2] }, { milestone: 'first_account', arrived: false, steps: [] }, { milestone: 'first_budget', arrived: false, steps: [] },
    ] });
    expect(rpcCalls(calls, 'money_bridge_state')[0]!.body).toEqual({ p_holder: TEEN });
  });

  it('shows nothing to a holder the database finds too young, and refuses a checklist it claims for them', async () => {
    stub({ money_bridge_state: { status: 200, body: { eligible: false, progress: [] } } });
    expect((await app().get('/api/v1/family-hub/bridge').set('Authorization', auth(KID))).body.data).toEqual({ eligible: false, minAge: MONEY_BRIDGE_MIN_AGE, moments: [] });
    stub({ money_bridge_state: { status: 200, body: { eligible: false, progress: bridge().progress } } });
    expect((await app().get('/api/v1/family-hub/bridge').set('Authorization', auth(KID))).status).toBe(502);
  });

  it('ticks one entry as the caller; no holder, amount or bank field is accepted', async () => {
    const calls = stub({ money_bridge_mark: { status: 200, body: bridge() } });
    const res = await app().post('/api/v1/family-hub/bridge').set('Authorization', auth(LINKED_TEEN)).send({ milestone: 'first_pay', step: 2, done: true });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'money_bridge_mark')[0]!.body).toEqual({ p_holder: LINKED_TEEN, p_milestone: 'first_pay', p_step: 2, p_done: true });
    for (const bad of [{ milestone: 'first_pay', step: 2, done: true, holderId: KID }, { milestone: 'first_pay', step: 2, done: true, amount: 120 },
      { milestone: 'first_loan', step: 0, done: true }, { milestone: 'first_pay', step: 4, done: true }]) {
      expect((await app().post('/api/v1/family-hub/bridge').set('Authorization', auth(LINKED_TEEN)).send(bad)).status).toBe(400);
    }
    expect(rpcCalls(calls, 'money_bridge_mark')).toHaveLength(1);
  });

  it('maps the database refusals: too young (403) and a step before its moment (409)', async () => {
    stub({ money_bridge_mark: refusal('BRIDGE_NOT_ELIGIBLE') });
    expect((await app().post('/api/v1/family-hub/bridge').set('Authorization', auth(KID)).send({ milestone: 'first_pay', step: 0, done: true })).status).toBe(403);
    stub({ money_bridge_mark: refusal('BRIDGE_MOMENT_FIRST') });
    expect((await app().post('/api/v1/family-hub/bridge').set('Authorization', auth(TEEN)).send({ milestone: 'first_pay', step: 1, done: true })).status).toBe(409);
  });

  it.each([['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', ANALYST, {}]])(
    'refuses %s the bridge before any bridge call', async (_label, who, extra) => {
      const calls = stub({ money_bridge_state: { status: 200, body: bridge() }, money_bridge_mark: { status: 200, body: bridge() } });
      expect((await app().get('/api/v1/family-hub/bridge').set('Authorization', auth(who, extra))).status).toBe(403);
      expect((await app().post('/api/v1/family-hub/bridge').set('Authorization', auth(who, extra)).send({ milestone: 'first_pay', step: 0, done: true })).status).toBe(403);
      expect(rpcCalls(calls, 'money_bridge_state')).toHaveLength(0);
      expect(rpcCalls(calls, 'money_bridge_mark')).toHaveLength(0);
    });
});

describe('S07.7 metrics (analytics staff)', () => {
  const METRICS: [string, Record<string, Reply>][] = [
    ['/admin/family/retention-compliance', {
      family_retention_compliance: { status: 200, body: [{ data_class: 'evidence', table_name: 'tasks.evidence', retain_days: 30, overdue: 0 }, { data_class: 'records', table_name: 'tasks', retain_days: 400, overdue: 2 }] },
      family_retention_last_run: { status: 200, body: { ran_at: '2026-09-24T03:00:00Z', removed: { tasks: 1 }, evidence_cleared: 1, evidence_failed: 0 } },
    }],
    ['/admin/family/coaching-delivery?period=2026-09', { parent_coaching_delivery_rate: { status: 200, body: [{ period: '2026-09-01', eligible: 0, delivered: 0, opened: 0, dismissed: 0 }] } }],
    ['/admin/family/coaching-reflections?days=30', { parent_coaching_reflection_rate: { status: 200, body: [{ tutor_decisions: 4, with_reflection: 3, written: 1, shared: 1, skipped: 1 }] } }],
    ['/admin/family/bridge-engagement', { money_bridge_engagement: { status: 200, body: ['all', 'first_pay', 'first_account', 'first_budget'].map((m) => ({ milestone: m, eligible: 4, engaged: 1, arrived: 1, completed: 0 })) } }],
    ['/admin/family/research-completeness', { family_research_completeness: { status: 200, body: [
      { cohort: 'all', long_tenure: 10, enrolled: 4, measurable: 2, complete: 1 }, { cohort: 'bridge_age', long_tenure: 0, enrolled: 0, measurable: 0, complete: 0 }] } }],
  ];

  it('serves each metric to analytics staff, counts only, with no rate for an empty population', async () => {
    const answers: Record<string, unknown>[] = [];
    for (const [path, rpc] of METRICS) {
      stub(rpc);
      const res = await app().get(`/api/v1${path}`).set('Authorization', auth(ANALYST));
      expect(res.status, path).toBe(200);
      expect(JSON.stringify(res.body.data)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      answers.push(res.body.data);
    }
    const [retention, delivery, reflections, , completeness] = answers as Record<string, unknown>[];
    expect(retention).toMatchObject({ pass: false, overdue: 2 });
    expect(delivery).toMatchObject({ eligible: 0, deliveryRate: null, openRate: null, draftedTips: COACHING_TIPS.length });
    expect(reflections).toMatchObject({ tutorDecisions: 4, withReflection: 3, firedRate: 0.75 });
    expect((completeness as { cohorts: Record<string, unknown>[] }).cohorts[0]).toMatchObject({ coverage: 0.4, completeness: 0.5 });
    expect((completeness as { cohorts: Record<string, unknown>[] }).cohorts[1]).toMatchObject({ coverage: null, completeness: null });
  });

  it('refuses support-only staff, a parent and a child before any metric read, and bad windows', async () => {
    for (const [path, rpc] of METRICS) {
      for (const who of [SUPPORT, PARENT, KID]) {
        const calls = stub(rpc);
        expect((await app().get(`/api/v1${path}`).set('Authorization', auth(who))).status, `${path} ${who}`).toBe(403);
        expect(rpcNamed(calls)).toHaveLength(0);
      }
    }
    stub();
    expect((await app().get('/api/v1/admin/family/coaching-delivery?period=2026-13').set('Authorization', auth(ANALYST))).status).toBe(400);
    expect((await app().get('/api/v1/admin/family/research-completeness?months=0').set('Authorization', auth(ANALYST))).status).toBe(400);
  });

  it('answers 502 when a metric cannot be read, never an empty success', async () => {
    for (const [path] of METRICS) {
      stub();
      expect((await app().get(`/api/v1${path}`).set('Authorization', auth(ANALYST))).status, path).toBe(502);
    }
  });
});
