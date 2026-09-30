import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { admissionStubResponse, jsonResponse, mintToken } from './helpers.js';

/*
 * S07.3 at the Core boundary: D.2 (the lapse-tolerant chore streak and the
 * Tutor's holiday pause), D.10 (expected contribution versus bonus task) and
 * D.11 (the savings bonus framed by age). Populations: a parent-created
 * child, a teen who linked a verified parent, an unlinked self-registered
 * teen, an adult learner, the verified parent Tutor, an unrelated parent,
 * staff with and without the analytics grant, and a guest. The database is
 * the enforcing boundary (database/scripts/verify-chore-streak-bonus-postgres.py);
 * these tests prove Core refuses the wrong caller before any write, passes
 * the CALLER as the actor (never a body field), mirrors the database's
 * bounds, maps every database refusal honestly and never reports a state the
 * database did not confirm.
 */

const KID = '22222222-2222-4222-8222-222222222222';
const LINKED_TEEN = '56565656-5656-4565-8565-565656565656';
const TEEN = '55555555-5555-4555-8555-555555555555';
const ADULT = '77777777-7777-4777-8777-777777777777';
const PARENT = '11111111-1111-4111-8111-111111111111';
const STRANGER = '12121212-1212-4121-8121-121212121212';
const STAFF = '66666666-6666-4666-8666-666666666666';
const GUEST = '88888888-8888-4888-8888-888888888888';
const TASK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAUSE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ROLES: Record<string, string[]> = {
  [KID]: ['kid'], [LINKED_TEEN]: ['universal'], [TEEN]: ['universal'], [ADULT]: ['universal'], [GUEST]: ['universal'],
  [PARENT]: ['parent'], [STRANGER]: ['parent'], [STAFF]: ['admin'],
};
const ACCESS: Record<string, { kind: string | null; verified_guardians: number }> = {
  [LINKED_TEEN]: { kind: 'teen', verified_guardians: 1 },
  [TEEN]: { kind: 'teen', verified_guardians: 0 },
  [ADULT]: { kind: null, verified_guardians: 0 },
  [GUEST]: { kind: null, verified_guardians: 0 },
};
const GUARDED: Record<string, string[]> = { [PARENT]: [KID, LINKED_TEEN], [STRANGER]: [] };

interface Call { url: string; method: string; body: unknown }
interface Opts {
  rpc?: Record<string, { status: number; body: unknown }>;
  framing?: string | null;
  bonusRule?: Record<string, unknown> | null;
  bonusInsert?: { status: number; body: unknown };
  saved?: number;
  example?: { completed_at: string | null } | null;
  days?: { kid: string; day: string }[];
  pauses?: Record<string, unknown>[];
  pauseKid?: string | null;
  staffGrants?: string[];
}

const today = () => new Date().toISOString().slice(0, 10);
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function stub(opts: Opts = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const admission = admissionStubResponse(url);
    if (admission) return Promise.resolve(admission);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, method, body });
    const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (rpc === 'wallet_access') {
      const who = (body as { p_user: string }).p_user;
      return Promise.resolve(jsonResponse(200, ACCESS[who] ?? { kind: null, verified_guardians: 0 }));
    }
    if (rpc === 'savings_bonus_framing') {
      return Promise.resolve(opts.framing === undefined ? jsonResponse(200, 'per_ten') : opts.framing === 'DOWN' ? jsonResponse(503, { message: 'down' }) : jsonResponse(200, opts.framing));
    }
    if (rpc) {
      const answer = opts.rpc?.[rpc];
      return Promise.resolve(answer ? jsonResponse(answer.status, answer.body) : jsonResponse(500, { message: 'unstubbed rpc' }));
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
    if (url.includes('/rest/v1/tasks') && method === 'POST') {
      return Promise.resolve(jsonResponse(201, [{
        id: TASK, status: 'open', allocated: false, created_at: new Date().toISOString(), evidence_bucket: null, evidence_hash: null, evidence_ext: null,
        evidence_uploaded_at: null, cancel_reason: null, completed_on: null, ...body,
      }]));
    }
    if (url.includes('/rest/v1/chore_streak_days?')) {
      const first = url.includes('offset=0');
      if (url.includes('local_date=gte.')) return Promise.resolve(jsonResponse(200, first ? [...new Set((opts.days ?? []).map((d) => d.kid))].map((kid_user_id) => ({ kid_user_id })) : []));
      return Promise.resolve(jsonResponse(200, first ? (opts.days ?? []).filter((d) => url.includes(d.kid)).map((d) => ({ kid_user_id: d.kid, local_date: d.day, completions: 1, legacy: false })) : []));
    }
    if (url.includes('/rest/v1/chore_streak_pauses?id=eq.')) return Promise.resolve(jsonResponse(200, opts.pauseKid === null ? [] : [{ kid_user_id: opts.pauseKid ?? KID }]));
    if (url.includes('/rest/v1/chore_streak_pauses?')) return Promise.resolve(jsonResponse(200, url.includes('offset=0') ? opts.pauses ?? [] : []));
    if (url.includes('/rest/v1/kid_task_streaks?')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/banking_accounts')) {
      return Promise.resolve(jsonResponse(200, [{ kid_user_id: KID, nickname: 'Fund', card_design: 'indigo', frozen: false, frozen_by: null, frozen_at: null, opened_by: PARENT, opened_at: '2026-09-01T00:00:00Z' }]));
    }
    if (url.includes('/rest/v1/savings_bonus_rules') && method === 'POST') {
      const answer = opts.bonusInsert ?? { status: 201, body: [{ created_at: '2026-09-01T00:00:00Z', ...body }] };
      return Promise.resolve(jsonResponse(answer.status, answer.body));
    }
    if (url.includes('/rest/v1/savings_bonus_rules?')) return Promise.resolve(jsonResponse(200, opts.bonusRule ? [opts.bonusRule] : []));
    if (url.includes('/rest/v1/savings_bonus_explanations?')) return Promise.resolve(jsonResponse(200, opts.example ? [opts.example] : []));
    if (url.includes('/rest/v1/wallet_ledger?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, [{ bucket: 'save', amount: opts.saved ?? 0 }]));
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const as = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const writesTo = (calls: Call[], fragment: string) => calls.filter((c) => c.method !== 'GET' && c.url.includes(fragment));
const refusal = (message: string) => ({ status: 400, body: { code: 'P0001', message, details: null, hint: null } });
const app = () => request(createApp());
const NON_PARENTS: [string, string, { is_anonymous?: boolean }][] = [
  ['a parent-created child', KID, {}], ['a linked teen', LINKED_TEEN, {}], ['an unlinked teen', TEEN, {}],
  ['an adult learner', ADULT, {}], ['staff', STAFF, {}], ['a guest', GUEST, { is_anonymous: true }],
];

// ── D.10 ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/tasks: expected contribution versus bonus task (D.10)', () => {
  it('creates an unpaid family contribution with its kind', async () => {
    const calls = stub();
    const res = await app().post('/api/v1/tasks').set('Authorization', as(PARENT)).send({ assignedTo: KID, title: 'Set the table', kind: 'contribution', rewardCoins: 0 });
    expect(res.status).toBe(201);
    expect(res.body.data.task).toMatchObject({ kind: 'contribution', rewardCoins: 0 });
    expect(writesTo(calls, '/rest/v1/tasks')[0]!.body).toMatchObject({ assigned_by: PARENT, assigned_to: KID, kind: 'contribution', reward_coins: 0 });
  });

  it('creates a nominal contribution (2 coins) and a bonus task for a linked teen', async () => {
    const calls = stub();
    expect((await app().post('/api/v1/tasks').set('Authorization', as(PARENT)).send({ assignedTo: KID, title: 'Feed the cat', kind: 'contribution', rewardCoins: 2 })).status).toBe(201);
    expect((await app().post('/api/v1/tasks').set('Authorization', as(PARENT)).send({ assignedTo: LINKED_TEEN, title: 'Wash the car', kind: 'bonus', rewardCoins: 40 })).status).toBe(201);
    expect(writesTo(calls, '/rest/v1/tasks').map((c) => (c.body as { kind: string }).kind)).toEqual(['contribution', 'bonus']);
  });

  it('keeps an older client that sends no kind as a paid bonus task', async () => {
    const calls = stub();
    const res = await app().post('/api/v1/tasks').set('Authorization', as(PARENT)).send({ assignedTo: KID, title: 'Rake leaves', rewardCoins: 10 });
    expect(res.status).toBe(201);
    expect(writesTo(calls, '/rest/v1/tasks')[0]!.body).toMatchObject({ kind: 'bonus', reward_coins: 10 });
  });

  it.each([
    ['a 3-coin contribution', { kind: 'contribution', rewardCoins: 3 }],
    ['a 0-coin bonus task', { kind: 'bonus', rewardCoins: 0 }],
    ['a 0-coin task with no kind', { rewardCoins: 0 }],
    ['a 501-coin bonus task', { kind: 'bonus', rewardCoins: 501 }],
    ['an unknown kind', { kind: 'job', rewardCoins: 5 }],
    ['a fractional reward', { kind: 'bonus', rewardCoins: 1.5 }],
  ])('rejects %s with 400 before any write', async (_label, bad) => {
    const calls = stub();
    const res = await app().post('/api/v1/tasks').set('Authorization', as(PARENT)).send({ assignedTo: KID, title: 'x', ...bad });
    expect(res.status).toBe(400);
    expect(writesTo(calls, '/rest/v1/tasks')).toHaveLength(0);
  });

  it('404s an unrelated parent and refuses every non-parent population, never writing', async () => {
    const calls = stub();
    expect((await app().post('/api/v1/tasks').set('Authorization', as(STRANGER)).send({ assignedTo: KID, title: 'x', kind: 'contribution', rewardCoins: 0 })).status).toBe(404);
    for (const [, who, extra] of NON_PARENTS) {
      const res = await app().post('/api/v1/tasks').set('Authorization', as(who, extra)).send({ assignedTo: KID, title: 'x', kind: 'contribution', rewardCoins: 0 });
      expect(res.status).toBe(403);
    }
    expect(writesTo(calls, '/rest/v1/tasks')).toHaveLength(0);
  });
});

// ── D.2 ─────────────────────────────────────────────────────────────────────

describe('the chore streak (D.2)', () => {
  it('shows the child in a family their streak; the linked teen too; refuses the unlinked teen, an adult and a guest', async () => {
    const t = today();
    stub({ days: [{ kid: KID, day: shift(t, -3) }, { kid: KID, day: shift(t, -2) }, { kid: KID, day: t }] });
    const res = await app().get(`/api/v1/tasks/streak?today=${t}`).set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data.streak).toMatchObject({ status: 'practised_today', current: 3, restDaysPerWeek: 2 });
    expect((await app().get('/api/v1/tasks/streak').set('Authorization', as(LINKED_TEEN))).status).toBe(200);
    const unlinked = await app().get('/api/v1/tasks/streak').set('Authorization', as(TEEN));
    expect(unlinked.status).toBe(403);
    expect(unlinked.body.error.code).toBe('GUARDIAN_LINK_REQUIRED');
    expect((await app().get('/api/v1/tasks/streak').set('Authorization', as(ADULT))).status).toBe(403);
    expect((await app().get('/api/v1/tasks/streak').set('Authorization', as(GUEST, { is_anonymous: true }))).status).toBe(403);
  });

  it('shows the Tutor the streak and the running or upcoming pauses only', async () => {
    const t = today();
    stub({
      days: [{ kid: KID, day: shift(t, -1) }],
      pauses: [
        { id: PAUSE, kid_user_id: KID, starts_on: shift(t, -1), ends_on: shift(t, 3), created_by: PARENT, created_at: '2026-09-01T00:00:00Z', cancelled_at: null },
        { id: TASK, kid_user_id: KID, starts_on: shift(t, -20), ends_on: shift(t, -15), created_by: PARENT, created_at: '2026-09-01T00:00:00Z', cancelled_at: null },
      ],
    });
    const res = await app().get(`/api/v1/tasks/${KID}/streak?today=${t}`).set('Authorization', as(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.streak).toMatchObject({ pausedUntil: shift(t, 3), current: 1 });
    expect(res.body.data.pauses).toEqual([{ id: PAUSE, startsOn: shift(t, -1), endsOn: shift(t, 3), state: 'running' }]);
  });

  it('404s an unrelated parent and refuses the child and every non-parent on the Tutor routes', async () => {
    const calls = stub({ rpc: { guardian_pause_chore_streak: { status: 200, body: PAUSE } } });
    const body = { startsOn: today(), endsOn: shift(today(), 2) };
    expect((await app().get(`/api/v1/tasks/${KID}/streak`).set('Authorization', as(STRANGER))).status).toBe(404);
    expect((await app().post(`/api/v1/tasks/${KID}/streak/pauses`).set('Authorization', as(STRANGER)).send(body)).status).toBe(404);
    for (const [, who, extra] of NON_PARENTS) {
      expect((await app().post(`/api/v1/tasks/${KID}/streak/pauses`).set('Authorization', as(who, extra)).send(body)).status).toBe(403);
    }
    expect(calls.filter((c) => c.url.includes('/rpc/guardian_pause_chore_streak'))).toHaveLength(0);
  });

  it('passes the CALLER as the pausing Tutor', async () => {
    const calls = stub({ rpc: { guardian_pause_chore_streak: { status: 200, body: PAUSE } } });
    const body = { startsOn: shift(today(), -3), endsOn: shift(today(), 4) };
    const res = await app().post(`/api/v1/tasks/${LINKED_TEEN}/streak/pauses`).set('Authorization', as(PARENT)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.pauseId).toBe(PAUSE);
    expect(calls.find((c) => c.url.includes('/rpc/guardian_pause_chore_streak'))!.body).toEqual({ p_kid: LINKED_TEEN, p_actor: PARENT, p_starts_on: body.startsOn, p_ends_on: body.endsOn });
  });

  it.each([
    ['22 days', { startsOn: today(), endsOn: shift(today(), 21) }],
    ['a start 8 days back', { startsOn: shift(today(), -8), endsOn: shift(today(), -8) }],
    ['a start 121 days ahead', { startsOn: shift(today(), 121), endsOn: shift(today(), 122) }],
    ['an end before the start', { startsOn: shift(today(), 3), endsOn: shift(today(), 2) }],
    ['a malformed day', { startsOn: '09/25/2026', endsOn: shift(today(), 2) }],
    ['an actor named in the body', { startsOn: today(), endsOn: today(), actorId: STRANGER }],
  ])('rejects %s with 400 before any RPC', async (_label, bad) => {
    const calls = stub({ rpc: { guardian_pause_chore_streak: { status: 200, body: PAUSE } } });
    const res = await app().post(`/api/v1/tasks/${KID}/streak/pauses`).set('Authorization', as(PARENT)).send(bad);
    expect(res.status).toBe(400);
    expect(calls.filter((c) => c.url.includes('/rpc/'))).toHaveLength(0);
  });

  it.each([
    ['STREAK_PAUSE_OVERLAP', 409],
    ['STREAK_PAUSE_LIMIT', 409],
    ['STREAK_PAUSE_INVALID', 400],
    ['NOT_A_GUARDIAN', 404],
  ])('maps the database refusal %s to %i', async (code, status) => {
    stub({ rpc: { guardian_pause_chore_streak: refusal(code) } });
    const res = await app().post(`/api/v1/tasks/${KID}/streak/pauses`).set('Authorization', as(PARENT)).send({ startsOn: today(), endsOn: today() });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('never reports a pause the database did not confirm', async () => {
    stub({ rpc: { guardian_pause_chore_streak: { status: 503, body: { message: 'down' } } } });
    expect((await app().post(`/api/v1/tasks/${KID}/streak/pauses`).set('Authorization', as(PARENT)).send({ startsOn: today(), endsOn: today() })).status).toBe(502);
    stub({ rpc: { guardian_pause_chore_streak: { status: 200, body: 'not-a-uuid' } } });
    expect((await app().post(`/api/v1/tasks/${KID}/streak/pauses`).set('Authorization', as(PARENT)).send({ startsOn: today(), endsOn: today() })).status).toBe(502);
  });

  it('ends a pause only for the child it belongs to', async () => {
    let calls = stub({ pauseKid: LINKED_TEEN, rpc: { guardian_end_chore_streak_pause: { status: 200, body: 'ended' } } });
    expect((await app().post(`/api/v1/tasks/${KID}/streak/pauses/${PAUSE}/end`).set('Authorization', as(PARENT))).status).toBe(404);
    expect(calls.filter((c) => c.url.includes('/rpc/'))).toHaveLength(0);
    calls = stub({ pauseKid: KID, rpc: { guardian_end_chore_streak_pause: { status: 200, body: 'ended' } } });
    const res = await app().post(`/api/v1/tasks/${KID}/streak/pauses/${PAUSE}/end`).set('Authorization', as(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('ended');
    expect(calls.find((c) => c.url.includes('/rpc/guardian_end_chore_streak_pause'))!.body).toEqual({ p_pause: PAUSE, p_actor: PARENT });
    stub({ pauseKid: KID, rpc: { guardian_end_chore_streak_pause: refusal('STREAK_PAUSE_OVER') } });
    expect((await app().post(`/api/v1/tasks/${KID}/streak/pauses/${PAUSE}/end`).set('Authorization', as(PARENT))).status).toBe(409);
  });
});

// ── D.11 ────────────────────────────────────────────────────────────────────

describe('the savings bonus framed by age (D.11)', () => {
  it('tells the Tutor the framing: a fixed 1-per-10 under 13, a 0-20% rate at 13-17', async () => {
    stub({ framing: 'per_ten', bonusRule: { kid_user_id: KID, parent_user_id: PARENT, rate_bp: 1000, active: true, next_run_at: '2026-10-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z', reframed_from_rate_bp: 2000 } });
    const young = await app().get(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(PARENT));
    expect(young.status).toBe(200);
    expect(young.body.data).toMatchObject({ framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { reframedFromRateBp: 2000 } });
    stub({ framing: 'percent' });
    const teen = await app().get(`/api/v1/banking/savings-bonus/${LINKED_TEEN}`).set('Authorization', as(PARENT));
    expect(teen.body.data).toMatchObject({ framing: 'percent', perTen: null, maxRateBp: 2000, rule: null });
  });

  it('refuses a percentage for a younger child before any write, and saves the fixed ratio when the Tutor switches it on', async () => {
    let calls = stub({ framing: 'per_ten' });
    const refused = await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(PARENT)).send({ rateBp: 1500, active: true });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('SAVINGS_BONUS_FIXED_FOR_AGE');
    expect(writesTo(calls, '/savings_bonus_rules')).toHaveLength(0);
    calls = stub({ framing: 'per_ten' });
    const saved = await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(PARENT)).send({ active: true });
    expect(saved.status).toBe(200);
    expect(writesTo(calls, '/savings_bonus_rules')[0]!.body).toMatchObject({ kid_user_id: KID, parent_user_id: PARENT, rate_bp: 1000, active: true, reframed_from_rate_bp: null });
  });

  it('needs a rate for a 13-17 child and saves the Tutor\'s choice', async () => {
    let calls = stub({ framing: 'percent' });
    expect((await app().put(`/api/v1/banking/savings-bonus/${LINKED_TEEN}`).set('Authorization', as(PARENT)).send({ active: true })).status).toBe(400);
    expect(writesTo(calls, '/savings_bonus_rules')).toHaveLength(0);
    calls = stub({ framing: 'percent' });
    const res = await app().put(`/api/v1/banking/savings-bonus/${LINKED_TEEN}`).set('Authorization', as(PARENT)).send({ rateBp: 1500, active: true });
    expect(res.status).toBe(200);
    expect(res.body.data.rule).toMatchObject({ rateBp: 1500, active: true, reframedFromRateBp: null });
  });

  it('maps the database refusing a percentage (the child\'s age changed meanwhile), and never reports an unconfirmed save', async () => {
    stub({ framing: 'percent', bonusInsert: refusal('SAVINGS_BONUS_FIXED_FOR_AGE') });
    const res = await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(PARENT)).send({ rateBp: 1500 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SAVINGS_BONUS_FIXED_FOR_AGE');
    stub({ framing: 'percent', bonusInsert: { status: 201, body: [] } });
    expect((await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(PARENT)).send({ rateBp: 1500 })).status).toBe(502);
    stub({ framing: 'DOWN' });
    expect((await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(PARENT)).send({ active: true })).status).toBe(502);
  });

  it('404s an unrelated parent and refuses every non-parent before reading the framing', async () => {
    const calls = stub({ framing: 'percent' });
    expect((await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(STRANGER)).send({ rateBp: 500 })).status).toBe(404);
    for (const [, who, extra] of NON_PARENTS) {
      expect((await app().put(`/api/v1/banking/savings-bonus/${KID}`).set('Authorization', as(who, extra)).send({ rateBp: 500 })).status).toBe(403);
    }
    expect(calls.filter((c) => c.url.includes('savings_bonus'))).toHaveLength(0);
  });

  it('shows a younger child their own concrete numbers: 57 saved means 5 more next week', async () => {
    stub({ framing: 'per_ten', saved: 57, bonusRule: { kid_user_id: KID, parent_user_id: PARENT, rate_bp: 1000, active: true, next_run_at: '2026-10-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z', reframed_from_rate_bp: null } });
    const res = await app().get('/api/v1/banking/savings-bonus').set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ framing: 'per_ten', perTen: { unit: 10, coins: 1 }, saved: 57, nextBonus: 5, example: null });
    expect(res.body.data.rule).not.toHaveProperty('reframedFromRateBp');
  });

  it('shows a 13-17 child the percentage and their worked-example progress', async () => {
    stub({ framing: 'percent', saved: 57, example: { completed_at: null }, bonusRule: { kid_user_id: LINKED_TEEN, parent_user_id: PARENT, rate_bp: 1500, active: true, next_run_at: '2026-10-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z', reframed_from_rate_bp: null } });
    const res = await app().get('/api/v1/banking/savings-bonus').set('Authorization', as(LINKED_TEEN));
    expect(res.body.data).toMatchObject({ framing: 'percent', maxRateBp: 2000, saved: 57, nextBonus: 8, example: { shown: true, completed: false } });
  });

  it('records the worked example for the CALLER and returns the database\'s verdict', async () => {
    let calls = stub({ rpc: { record_savings_bonus_explanation: { status: 200, body: true } } });
    const res = await app().post('/api/v1/banking/savings-bonus/example').set('Authorization', as(LINKED_TEEN)).send({ step: 'answered', exampleSaved: 200, answer: 30 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ correct: true });
    expect(calls.find((c) => c.url.includes('/rpc/record_savings_bonus_explanation'))!.body).toEqual({ p_user: LINKED_TEEN, p_step: 'answered', p_example_saved: 200, p_answer: 30 });
    calls = stub({ rpc: { record_savings_bonus_explanation: refusal('EXAMPLE_NOT_APPLICABLE') } });
    const young = await app().post('/api/v1/banking/savings-bonus/example').set('Authorization', as(KID)).send({ step: 'shown' });
    expect(young.status).toBe(409);
    expect(young.body.error.code).toBe('EXAMPLE_NOT_APPLICABLE');
  });

  it.each([
    ['a missing step', {}],
    ['a verdict sent by the client', { step: 'answered', exampleSaved: 200, answer: 30, correct: true }],
    ['a user named in the body', { step: 'shown', userId: KID }],
    ['an example below 10 coins', { step: 'answered', exampleSaved: 5, answer: 0 }],
  ])('rejects %s with 400 before any RPC', async (_label, bad) => {
    const calls = stub({ rpc: { record_savings_bonus_explanation: { status: 200, body: true } } });
    expect((await app().post('/api/v1/banking/savings-bonus/example').set('Authorization', as(LINKED_TEEN)).send(bad)).status).toBe(400);
    expect(calls.filter((c) => c.url.includes('/rpc/record_savings_bonus_explanation'))).toHaveLength(0);
  });

  it('refuses the worked example to an unlinked teen, an adult, a parent and a guest before any RPC', async () => {
    const calls = stub({ rpc: { record_savings_bonus_explanation: { status: 200, body: true } } });
    for (const [who, extra] of [[TEEN, {}], [ADULT, {}], [PARENT, {}], [GUEST, { is_anonymous: true }]] as const) {
      expect((await app().post('/api/v1/banking/savings-bonus/example').set('Authorization', as(who, extra)).send({ step: 'shown' })).status).toBe(403);
    }
    expect(calls.filter((c) => c.url.includes('/rpc/record_savings_bonus_explanation'))).toHaveLength(0);
  });
});

// ── Appendix H metrics ──────────────────────────────────────────────────────

describe('S07.3 staff metrics (Appendix H, Diagnostic, counts only)', () => {
  const routes = ['chore-tag-adoption', 'chore-streak-rest-days', 'savings-bonus-comprehension'];

  it('serves the Chore-Tag Adoption Rate', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { chore_tag_adoption: { status: 200, body: [{ contribution_tasks: 3, bonus_tasks: 9, tutors: 4, tutors_using_contribution: 2 }] } } });
    const res = await app().get('/api/v1/admin/family/chore-tag-adoption?days=30').set('Authorization', as(STAFF));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ contributionTasks: 3, bonusTasks: 9, contributionShare: 0.25, tutors: 4, tutorsUsingContribution: 2 });
  });

  it('serves the rest-day utilization from the model over recorded days', async () => {
    // Rest days are two per ISO week (habitStreak.ts), so the outcome depends on
    // where the missed days fall in the week: on a Wednesday the gap below
    // crosses a Monday and the new week's fresh rest days cover every miss.
    // Only Date is faked, so request and fetch timers run normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z')); // a Tuesday
    try {
      const t = today();
      // Practised four days ending five days ago (Mon 21 to Thu 24 September):
      // Fri 25 and Sat 26 use the week's two rest days, and Sun 27 ends the run.
      stub({ staffGrants: ['view_analytics'], days: [8, 7, 6, 5].map((n) => ({ kid: KID, day: shift(t, -n) })) });
      const res = await app().get('/api/v1/admin/family/chore-streak-rest-days?days=30').set('Authorization', as(STAFF));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ children: 1, restDayCovered: 2, runsEnded: 1 });
      expect(res.body.data.coveredShare).toBeCloseTo(2 / 3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('serves the Age-Tier Bonus Comprehension Proxy, with a null rate for an empty population', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { savings_bonus_comprehension: { status: 200, body: [{ eligible: 5, shown: 4, completed: 3 }] } } });
    expect((await app().get('/api/v1/admin/family/savings-bonus-comprehension').set('Authorization', as(STAFF))).body.data)
      .toMatchObject({ eligible: 5, shown: 4, completed: 3, completionRate: 0.75 });
    stub({ staffGrants: ['view_analytics'], rpc: { savings_bonus_comprehension: { status: 200, body: [{ eligible: 0, shown: 0, completed: 0 }] } } });
    expect((await app().get('/api/v1/admin/family/savings-bonus-comprehension').set('Authorization', as(STAFF))).body.data.completionRate).toBeNull();
  });

  it('refuses staff without the grant and every non-staff population', async () => {
    const calls = stub({ staffGrants: ['manage_support'] });
    for (const route of routes) {
      expect((await app().get(`/api/v1/admin/family/${route}`).set('Authorization', as(STAFF))).status).toBe(403);
      for (const who of [PARENT, KID, LINKED_TEEN, ADULT]) {
        expect((await app().get(`/api/v1/admin/family/${route}`).set('Authorization', as(who))).status).toBe(403);
      }
    }
    expect(calls.filter((c) => c.url.includes('/rpc/') && !c.url.includes('wallet_access'))).toHaveLength(0);
    expect(calls.filter((c) => c.url.includes('chore_streak_days'))).toHaveLength(0);
  });
});
