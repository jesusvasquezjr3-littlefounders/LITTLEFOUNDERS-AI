import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { STATEMENT_MONTHS_BACK, statementMonthAllowed } from '../routes/banking.js';
import {
  FREEZE_HOLDS,
  freezeAuthor,
  presentSpendLimit,
  presentStatement,
  REGISTER_TEEN_MIN_AGE,
  REGISTER_TRANSITION_MIN_AGE,
  TEEN_STATEMENT_LINES,
} from '../services/moneyPresentation.js';
import { PERCENT_FRAMING_MIN_AGE } from '../services/savingsBonus.js';
import { FAMILY_ENGAGEMENT_CHILD_KEYS, FAMILY_ENGAGEMENT_SUMMARY_KEYS } from '../services/insights.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S07.6 at the Core boundary.
 *   D.12  the age register is read from the database (never role, never the
 *         client) and every child-facing number is shaped by it at the server
 *   D.7   the account card is a declared simulation with no card number, and
 *         a freeze lists only what the database holds
 *   D.6   the staff family-engagement insight on the per-child shape, its
 *         uptime record, and the register distribution
 * Populations: a parent-created child, a teen who linked a verified parent,
 * an unlinked self-registered teen, an adult learner, a guest, the verified
 * parent Tutor, an unrelated parent, and staff with the analytics grant, the
 * support grant or none. PostgreSQL is the enforcing boundary for the register
 * and the insight (database/scripts/verify-money-presentation-postgres.py).
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
const UUID_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

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

const account = (over: Record<string, unknown> = {}) => ({
  kid_user_id: KID, nickname: 'Rocket Fund', card_design: 'emerald', display_number: 'LF-1234-5678', frozen: false, frozen_by: null,
  frozen_at: null, opened_by: PARENT, opened_at: '2026-09-01T00:00:00Z', ...over,
});
const ledger = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1, kid_user_id: KID, bucket: i % 3 === 0 ? 'save' : i % 3 === 1 ? 'spend' : 'share', amount: i === 11 ? -4 : 5,
  reason: i === 11 ? 'redemption' : 'task_approved', task_id: null, goal_id: null, guardian_action_id: null, created_at: `2026-09-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
}));

const INSIGHT = {
  summary: { children: 8, children_with_tasks: 5, active_children: 3, tasks_created: 8, tasks_approved: 6, active_days: 30, listed_children: 2 },
  children: [
    { guardians: 1, tasks_created: 4, tasks_approved: 3, first_link_on: '2026-09-01', last_task_on: '2026-09-24' },
    { guardians: 2, tasks_created: 1, tasks_approved: 0, first_link_on: '2026-08-01', last_task_on: null },
  ],
};

interface Call { url: string; method: string; body: Record<string, unknown> | undefined }
interface Opts {
  register?: string | null | 'down';
  account?: Record<string, unknown> | null;
  spendLimit?: Record<string, unknown> | null;
  insight?: { status: number; body: unknown };
  uptime?: unknown;
  distribution?: unknown;
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
    if (rpc === 'wallet_access') return Promise.resolve(jsonResponse(200, ACCESS[(body as { p_user: string }).p_user] ?? { kind: null, verified_guardians: 0 }));
    if (rpc === 'family_money_register') {
      if (opts.register === 'down') return Promise.resolve(jsonResponse(503, { message: 'down' }));
      return Promise.resolve(jsonResponse(200, opts.register === undefined ? 'young' : opts.register));
    }
    if (rpc === 'run_due_scheduled_credits') return Promise.resolve(jsonResponse(200, 0));
    if (rpc === 'family_engagement_insight') return Promise.resolve(jsonResponse(opts.insight?.status ?? 200, opts.insight?.body ?? INSIGHT));
    if (rpc === 'record_staff_insight_check') return Promise.resolve(new Response(null, { status: 204 }));
    if (rpc === 'staff_insight_uptime') return Promise.resolve(jsonResponse(200, opts.uptime ?? [
      { source: 'probe', checks: 30, ok: 30, last_outcome: 'ok', last_checked_at: '2026-09-24T07:30:00Z' },
      { source: 'request', checks: 0, ok: 0, last_outcome: null, last_checked_at: null },
    ]));
    if (rpc === 'family_money_register_distribution') return Promise.resolve(jsonResponse(200, opts.distribution ?? [
      { register: 'young', holders: 2 }, { register: 'transition', holders: 1 }, { register: 'teen', holders: 1 },
    ]));
    if (rpc) return Promise.resolve(jsonResponse(500, { message: 'unstubbed rpc' }));
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (ROLES[id] ?? ['universal']).map((role) => ({ user_id: id, role }))));
    }
    if (url.includes('/rest/v1/user_roles?role=eq.kid')) return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Range': '0-0/5' } }));
    if (url.includes('/rest/v1/analytics_consents?revoked_at=is.null')) return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Range': '0-0/3' } }));
    if (url.includes('/rest/v1/admin_permissions')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)?.[1] ?? '';
      return Promise.resolve(jsonResponse(200, (GRANTS[id] ?? []).map((permission) => ({ permission }))));
    }
    if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
      const id = url.match(/parent_user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (GUARDED[id] ?? []).map((kid_user_id) => ({ parent_user_id: id, kid_user_id, verification_status: 'verified' }))));
    }
    if (url.includes('/rest/v1/banking_accounts?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.account === null ? [] : [opts.account ?? account()]));
    if (url.includes('/rest/v1/spend_limits?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.spendLimit === null || opts.spendLimit === undefined ? [] : [opts.spendLimit]));
    if (url.includes('/rest/v1/wallet_ledger?') && url.includes('select=bucket,amount')) return Promise.resolve(jsonResponse(200, ledger.map((e) => ({ bucket: e.bucket, amount: e.amount }))));
    if (url.includes('/rest/v1/wallet_ledger?')) return Promise.resolve(jsonResponse(200, ledger));
    if (url.includes('/rest/v1/pending_credits?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, [{ id: 'c1', kid_user_id: KID, amount: 10, source: 'allowance', allocated: false, created_at: '2026-09-20T00:00:00Z' }]));
    if (url.includes('/rest/v1/wallet_guardian_actions')) return Promise.resolve(jsonResponse(200, []));
    return Promise.resolve(jsonResponse(500, { message: `unstubbed ${url}` }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const auth = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const get = (path: string, sub: string, extra: { is_anonymous?: boolean } = {}) =>
  request(createApp()).get(`/api/v1${path}`).set('Authorization', auth(sub, extra));
const rpcCalls = (calls: Call[], name: string) => calls.filter((c) => c.url.includes(`/rpc/${name}`));

describe('S07.6 thresholds and pure shaping', () => {
  it('the teen register starts exactly where the D.11 percentage framing does; transition at 10', () => {
    expect(REGISTER_TEEN_MIN_AGE).toBe(PERCENT_FRAMING_MIN_AGE);
    expect(REGISTER_TRANSITION_MIN_AGE).toBe(10);
  });

  it('the migration decides the register with the same cutoffs (never role)', () => {
    const dir = join(fileURLToPath(new URL('../../../', import.meta.url)), 'database/migrations');
    const name = readdirSync(dir).find((f) => f.endsWith('_family_money_register.sql'));
    expect(name).toBeDefined();
    const sql = readFileSync(join(dir, name!), 'utf8').split('\r\n').join('\n');
    expect(sql).toContain("public.savings_bonus_framing(p_user) = 'percent' THEN\n        RETURN 'teen'");
    expect(sql).toContain(`v_age >= ${REGISTER_TRANSITION_MIN_AGE} THEN`);
    const body = sql.slice(sql.indexOf('FUNCTION public.family_money_register(p_user uuid)'), sql.indexOf('REVOKE ALL ON FUNCTION public.family_money_register(uuid)'));
    expect(body).not.toMatch(/user_roles|role/);
  });

  it('shapes the spending limit per register: young reads what is left, never a ratio', () => {
    const limit = { configured: true as const, period: 'weekly', cap: 20, used: 15, remaining: 5 };
    expect(presentSpendLimit('young', limit)).toEqual({ configured: true, period: 'weekly', remaining: 5 });
    expect(presentSpendLimit('transition', limit)).toEqual({ configured: true, period: 'weekly', cap: 20, used: 15, remaining: 5 });
    expect(presentSpendLimit('teen', limit)).toEqual({ configured: true, period: 'weekly', cap: 20, used: 15, remaining: 5, usedPercent: 75 });
    expect(presentSpendLimit('teen', { configured: false })).toEqual({ configured: false });
  });

  it('shapes the month per register: three totals, then given and corrected, then the latest lines', () => {
    const s = { month: '2026-09', earned: 30, spent: 4, adjusted: 1, given: 2, saved: 20,
      entries: ledger.map((e) => ({ id: e.id, bucket: e.bucket, amount: e.amount, reason: e.reason, createdAt: e.created_at, taskId: null })) };
    expect(Object.keys(presentStatement('young', s)).sort()).toEqual(['earned', 'month', 'saved', 'spent']);
    expect(Object.keys(presentStatement('transition', s)).sort()).toEqual(['adjusted', 'earned', 'given', 'month', 'saved', 'spent']);
    const teen = presentStatement('teen', s) as { lines: Record<string, unknown>[] };
    expect(teen.lines).toHaveLength(TEEN_STATEMENT_LINES);
    expect(Object.keys(teen.lines[0]!).sort()).toEqual(['amount', 'bucket', 'createdAt', 'id', 'reason']);
  });

  it('attributes a freeze relative to the reader; an unattributed freeze is a Tutor\'s', () => {
    expect(freezeAuthor(false, KID, KID, KID)).toBeNull();
    expect(freezeAuthor(true, KID, KID, KID)).toBe('you');
    expect(freezeAuthor(true, PARENT, KID, KID)).toBe('tutor');
    expect(freezeAuthor(true, null, KID, KID)).toBe('tutor');
    expect(freezeAuthor(true, KID, PARENT, KID)).toBe('child');
    expect(freezeAuthor(true, STRANGER, PARENT, KID)).toBe('tutor');
  });
});

describe('GET /api/v1/banking/register (D.12)', () => {
  it.each([['a parent-created child', KID, 'young'], ['a linked teen', LINKED_TEEN, 'teen'], ['an independent teen', TEEN, 'teen']])(
    'serves %s their own register from the database', async (_label, who, register) => {
      const calls = stub({ register });
      const res = await get('/banking/register', who);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ register });
      expect(rpcCalls(calls, 'family_money_register')[0]!.body).toEqual({ p_user: who });
    });

  it.each([['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', ANALYST, {}]])(
    'refuses %s before any register read', async (_label, who, extra) => {
      const calls = stub();
      const res = await get('/banking/register', who, extra);
      expect(res.status).toBe(403);
      expect(rpcCalls(calls, 'family_money_register')).toHaveLength(0);
    });

  it('ignores any register the client names', async () => {
    const calls = stub({ register: 'young' });
    const res = await get('/banking/register?register=teen', KID);
    expect(res.body.data.register).toBe('young');
    expect(rpcCalls(calls, 'family_money_register')[0]!.body).toEqual({ p_user: KID });
  });

  it('502s when the register cannot be read, and never guesses one', async () => {
    stub({ register: 'down' });
    const res = await get('/banking/register', KID);
    expect(res.status).toBe(502);
    expect(res.body.data ?? null).toBeNull();
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('refuses an account the database says holds no wallet', async () => {
    stub({ register: null });
    expect((await get('/banking/register', KID)).status).toBe(403);
  });
});

describe('GET /api/v1/banking/overview (D.7, D.12)', () => {
  it.each([['an unlinked teen', TEEN, {}], ['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', ANALYST, {}]])(
    'refuses %s before any account read', async (_label, who, extra) => {
      const calls = stub();
      const res = await get('/banking/overview', who, extra);
      expect(res.status).toBe(403);
      expect(calls.filter((c) => c.url.includes('/banking_accounts') || c.url.includes('/wallet_ledger'))).toHaveLength(0);
    });

  it('serves the account as a declared simulation with no card number and every real freeze hold', async () => {
    stub({ register: 'young' });
    const res = await get('/banking/overview', KID);
    expect(res.status).toBe(200);
    const { account: card } = res.body.data;
    expect(card).toEqual({ nickname: 'Rocket Fund', design: 'emerald', simulated: true,
      freeze: { frozen: false, by: null, since: null, holds: [...FREEZE_HOLDS], canChange: true } });
    expect(JSON.stringify(res.body)).not.toContain('LF-1234-5678');
    expect(JSON.stringify(res.body)).not.toMatch(/displayNumber|display_number/);
  });

  it('a child may lift only a freeze they set; a Tutor\'s freeze reads "tutor" and cannot be changed by the child', async () => {
    stub({ account: account({ frozen: true, frozen_by: KID, frozen_at: '2026-09-20T00:00:00Z' }) });
    const own = (await get('/banking/overview', KID)).body.data.account.freeze;
    expect(own).toMatchObject({ frozen: true, by: 'you', since: '2026-09-20T00:00:00Z', canChange: true });
    stub({ account: account({ frozen: true, frozen_by: PARENT, frozen_at: '2026-09-21T00:00:00Z' }) });
    const tutor = (await get('/banking/overview', KID)).body.data.account.freeze;
    expect(tutor).toMatchObject({ frozen: true, by: 'tutor', canChange: false });
  });

  const LIMIT = { kid_user_id: KID, parent_user_id: PARENT, period: 'weekly', cap: 20, active: true, created_at: '2026-09-01T00:00:00Z' };

  it('young: the limit is what is left and the month is three totals, never a ratio or a line list', async () => {
    stub({ register: 'young', spendLimit: LIMIT });
    const data = (await get('/banking/overview', KID)).body.data;
    expect(data.register).toBe('young');
    expect(Object.keys(data.spendLimit).sort()).toEqual(['configured', 'period', 'remaining']);
    expect(Object.keys(data.statement).sort()).toEqual(['earned', 'month', 'saved', 'spent']);
    expect(JSON.stringify(data)).not.toMatch(/Percent|percent|cap|lines/);
    expect(data.pockets).toEqual({ save: 20, spend: 20, share: 11 });
    expect(data.pendingCredits).toBe(1);
  });

  it('transition: adds the cap and what was used, given and corrected, still no percentage', async () => {
    stub({ register: 'transition', spendLimit: LIMIT });
    const data = (await get('/banking/overview', KID)).body.data;
    expect(Object.keys(data.spendLimit).sort()).toEqual(['cap', 'configured', 'period', 'remaining', 'used']);
    expect(Object.keys(data.statement).sort()).toEqual(['adjusted', 'earned', 'given', 'month', 'saved', 'spent']);
    expect(JSON.stringify(data)).not.toMatch(/Percent|lines/);
  });

  it('teen: the used share as a percentage and the latest lines', async () => {
    stub({ register: 'teen', spendLimit: LIMIT });
    const data = (await get('/banking/overview', LINKED_TEEN)).body.data;
    expect(data.spendLimit).toHaveProperty('usedPercent');
    expect(data.statement.lines.length).toBeLessThanOrEqual(TEEN_STATEMENT_LINES);
  });

  it.each(['family_money_register', '/banking_accounts', '/spend_limits', '/pending_credits'])('502s when %s cannot be read', async (part) => {
    stub(part === 'family_money_register' ? { register: 'down' } : { down: [part] });
    const res = await get('/banking/overview', KID);
    expect(res.status).toBe(502);
    expect(res.body.data ?? null).toBeNull();
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('serves no account card before a Tutor opens one', async () => {
    stub({ account: null });
    const res = await get('/banking/overview', KID);
    expect(res.status).toBe(200);
    expect(res.body.data.account).toBeNull();
  });
});

describe('GET /api/v1/banking/accounts/:kidId/freeze (D.7, the Tutor)', () => {
  it.each([['the child', KID, {}], ['a linked teen', LINKED_TEEN, {}], ['an unlinked teen', TEEN, {}], ['an adult learner', ADULT, {}],
    ['a guest', GUEST, { is_anonymous: true }], ['staff', ANALYST, {}]])('refuses %s', async (_label, who, extra) => {
    const calls = stub();
    const res = await get(`/banking/accounts/${KID}/freeze`, who, extra);
    expect(res.status).toBe(403);
    expect(calls.filter((c) => c.url.includes('/banking_accounts'))).toHaveLength(0);
  });

  it('404s an unrelated parent before any account read', async () => {
    const calls = stub();
    const res = await get(`/banking/accounts/${KID}/freeze`, STRANGER);
    expect(res.status).toBe(404);
    expect(calls.filter((c) => c.url.includes('/banking_accounts'))).toHaveLength(0);
  });

  it('tells the Tutor who froze it, what it holds and which register the child reads', async () => {
    stub({ register: 'transition', account: account({ frozen: true, frozen_by: KID, frozen_at: '2026-09-22T00:00:00Z' }) });
    const res = await get(`/banking/accounts/${KID}/freeze`, PARENT);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ register: 'transition', account: { nickname: 'Rocket Fund', design: 'emerald', simulated: true,
      freeze: { frozen: true, by: 'child', since: '2026-09-22T00:00:00Z', holds: [...FREEZE_HOLDS], canChange: true } } });
    stub({ account: account({ frozen: true, frozen_by: PARENT }) });
    expect((await get(`/banking/accounts/${KID}/freeze`, PARENT)).body.data.account.freeze.by).toBe('you');
  });

  it('400s a malformed child id', async () => {
    stub();
    expect((await get('/banking/accounts/not-a-uuid/freeze', PARENT)).status).toBe(400);
  });
});

describe('GET /api/v1/admin/insights/families (D.6)', () => {
  it('serves the per-child shape, records the outcome and carries no identity', async () => {
    const calls = stub();
    const res = await get('/admin/insights/families?limit=50', ANALYST);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual(INSIGHT.summary);
    expect(res.body.data.children).toEqual(INSIGHT.children);
    expect(res.body.data.consent).toEqual({ kidsTotal: 5, kidsConsented: 3 });
    expect(JSON.stringify(res.body.data)).not.toMatch(UUID_TEXT);
    expect(rpcCalls(calls, 'family_engagement_insight')[0]!.body).toEqual({ p_limit: 50, p_active_days: 30 });
    expect(rpcCalls(calls, 'record_staff_insight_check').map((c) => c.body)).toEqual([{ p_insight: 'family_engagement', p_source: 'request', p_outcome: 'ok' }]);
  });

  it('the legacy per-family shape is a recorded shape mismatch, never served (the D.6 defect)', async () => {
    const calls = stub({ insight: { status: 200, body: [{ family_id: KID, family_created_at: '2026-07-01T00:00:00Z', members: 3, tasks_created: 9, tasks_completed: 7, last_task_at: null }] } });
    const res = await get('/admin/insights/families', ANALYST);
    expect(res.status).toBe(502);
    expect(rpcCalls(calls, 'record_staff_insight_check').map((c) => c.body?.p_outcome)).toEqual(['shape_mismatch']);
  });

  it('refuses a per-child row that smuggles an identity', async () => {
    const leaky = { ...INSIGHT, children: [{ ...INSIGHT.children[0], kid_user_id: KID }] };
    stub({ insight: { status: 200, body: leaky } });
    expect((await get('/admin/insights/families', ANALYST)).status).toBe(502);
  });

  it('an unreachable database is a recorded "unavailable"', async () => {
    const calls = stub({ insight: { status: 503, body: { message: 'down' } } });
    expect((await get('/admin/insights/families', ANALYST)).status).toBe(502);
    expect(rpcCalls(calls, 'record_staff_insight_check').map((c) => c.body?.p_outcome)).toEqual(['unavailable']);
  });

  it.each([['support-only staff', SUPPORT], ['a parent', PARENT], ['a child', KID], ['an adult learner', ADULT]])('refuses %s before any read', async (_label, who) => {
    const calls = stub();
    const res = await get('/admin/insights/families', who);
    expect(res.status).toBe(403);
    expect(rpcCalls(calls, 'family_engagement_insight')).toHaveLength(0);
    expect(rpcCalls(calls, 'record_staff_insight_check')).toHaveLength(0);
  });

  it('pins the contract keys the migration and the console share', () => {
    expect([...FAMILY_ENGAGEMENT_SUMMARY_KEYS].sort()).toEqual(Object.keys(INSIGHT.summary).sort());
    expect([...FAMILY_ENGAGEMENT_CHILD_KEYS].sort()).toEqual(Object.keys(INSIGHT.children[0]!).sort());
  });
});

describe('Appendix H metrics (D.6, D.12)', () => {
  it('uptime per source, with no rate for an empty window', async () => {
    stub();
    const res = await get('/admin/family/engagement-uptime?days=30', ANALYST);
    expect(res.status).toBe(200);
    expect(res.body.data.target).toBe(1);
    expect(res.body.data.probe).toMatchObject({ checks: 30, ok: 30, uptime: 1, lastOutcome: 'ok' });
    expect(res.body.data.requests).toMatchObject({ checks: 0, ok: 0, uptime: null, lastOutcome: null });
  });

  it('the register distribution, counts only', async () => {
    stub();
    const res = await get('/admin/family/register-distribution', ANALYST);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4);
    expect(res.body.data.registers).toEqual([
      { register: 'young', holders: 2, share: 0.5 }, { register: 'transition', holders: 1, share: 0.25 }, { register: 'teen', holders: 1, share: 0.25 },
    ]);
  });

  it('an empty population has no share, never a made-up number', async () => {
    stub({ distribution: [{ register: 'young', holders: 0 }, { register: 'transition', holders: 0 }, { register: 'teen', holders: 0 }] });
    const res = await get('/admin/family/register-distribution', ANALYST);
    expect(res.body.data.registers.every((r: { share: unknown }) => r.share === null)).toBe(true);
  });

  it.each(['/admin/family/engagement-uptime', '/admin/family/register-distribution'])('%s is analytics-only', async (path) => {
    stub();
    expect((await get(path, SUPPORT)).status).toBe(403);
    expect((await get(path, PARENT)).status).toBe(403);
  });

  it('502s a malformed uptime answer rather than reporting one', async () => {
    stub({ uptime: [{ source: 'probe', checks: 1 }] });
    expect((await get('/admin/family/engagement-uptime', ANALYST)).status).toBe(502);
  });
});

describe('GET /api/v1/banking/overview/month (F5-K, W2F.3)', () => {
  const now = new Date();
  const monthAt = (back: number) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  it('pages back through whole calendar months only, never ahead', () => {
    const at = new Date(Date.UTC(2026, 8, 27));
    expect(statementMonthAllowed('2026-09', at)).toBe(true);
    expect(statementMonthAllowed('2026-10', at)).toBe(false);
    expect(statementMonthAllowed('2024-10', at)).toBe(true);
    expect(statementMonthAllowed('2024-09', at)).toBe(false);
    expect(STATEMENT_MONTHS_BACK).toBe(24);
    for (const bad of ['2026-00', '2026-13', '20-09']) expect(statementMonthAllowed(bad, at), bad).toBe(false);
  });

  it.each([['an unlinked teen', TEEN, {}], ['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', ANALYST, {}]])(
    'refuses %s before any ledger read', async (_label, who, extra) => {
      const calls = stub();
      const res = await get(`/banking/overview/month?month=${monthAt(1)}`, who, extra);
      expect(res.status).toBe(403);
      expect(calls.filter((c) => c.url.includes('/wallet_ledger'))).toHaveLength(0);
    });

  it('refuses a missing, malformed, future or too-old month before any read', async () => {
    for (const query of ['', '?month=abc', '?month=2026-13', `?month=${monthAt(-1)}`, `?month=${monthAt(STATEMENT_MONTHS_BACK)}`, `?month=${monthAt(1)}&kid=${TEEN}`]) {
      const calls = stub();
      const res = await get(`/banking/overview/month${query}`, KID);
      expect(res.status, query).toBe(400);
      expect(calls.filter((c) => c.url.includes('/wallet_ledger') || c.url.includes('family_money_register')), query).toHaveLength(0);
    }
  });

  it('serves the requested month in the child\'s own register, read over that month only', async () => {
    const calls = stub({ register: 'young' });
    const month = monthAt(2);
    const res = await get(`/banking/overview/month?month=${month}`, KID);
    expect(res.status).toBe(200);
    expect(res.body.data.register).toBe('young');
    expect(Object.keys(res.body.data.statement).sort()).toEqual(['earned', 'month', 'saved', 'spent']);
    expect(res.body.data.statement.month).toBe(month);
    const read = calls.find((c) => c.url.includes('/wallet_ledger?') && !c.url.includes('select=bucket,amount'));
    expect(read?.url).toContain(`kid_user_id=eq.${KID}`);
    expect(decodeURIComponent(read!.url)).toContain(`${month}-01T00:00:00.000Z`);
  });

  it('teen register: the latest lines of that month', async () => {
    stub({ register: 'teen' });
    const res = await get(`/banking/overview/month?month=${monthAt(0)}`, LINKED_TEEN);
    expect(res.status).toBe(200);
    expect(res.body.data.statement.lines.length).toBeLessThanOrEqual(TEEN_STATEMENT_LINES);
  });

  it('502s, never a guessed register, when the register cannot be read', async () => {
    stub({ register: 'down' });
    const res = await get(`/banking/overview/month?month=${monthAt(1)}`, KID);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});
