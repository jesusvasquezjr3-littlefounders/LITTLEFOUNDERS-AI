import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S07.2 — D.3 (OD-3 Option B) at the Core boundary. Populations: an eligible
 * self-registered teen with no parent, a teen who linked a verified parent,
 * a parent-created child, an adult learner, a guest, a verified parent Tutor
 * and staff with and without the analytics grant. The database functions are
 * the enforcing boundary (verified on native PostgreSQL by
 * database/scripts/verify-teen-wallet-postgres.py); these tests prove Core
 * admits by the database's own age classification, never reaches an RPC for
 * the wrong caller, passes the CALLER as the holder (never a body field),
 * maps every refusal honestly and never reports a state the database did
 * not confirm. Tasks and anything a parent approves stay guardian-only.
 */

const TEEN = '55555555-5555-4555-8555-555555555555';
const LINKED_TEEN = '56565656-5656-4565-8565-565656565656';
const KID = '22222222-2222-4222-8222-222222222222';
const ADULT = '77777777-7777-4777-8777-777777777777';
const PARENT = '11111111-1111-4111-8111-111111111111';
const STAFF = '66666666-6666-4666-8666-666666666666';
const GUEST = '88888888-8888-4888-8888-888888888888';
const GOAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REWARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACTION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LINK = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OTHER_LINK = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const INVITE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const ROLES: Record<string, string[]> = {
  [TEEN]: ['universal'],
  [LINKED_TEEN]: ['universal'],
  [KID]: ['kid'],
  [ADULT]: ['universal'],
  [GUEST]: ['universal'],
  [PARENT]: ['parent'],
  [STAFF]: ['admin'],
};

/** What the database's wallet_access() answers per account (by age, never role). */
const ACCESS: Record<string, { kind: string | null; verified_guardians: number }> = {
  [TEEN]: { kind: 'teen', verified_guardians: 0 },
  [LINKED_TEEN]: { kind: 'teen', verified_guardians: 1 },
  [ADULT]: { kind: null, verified_guardians: 0 },
  [GUEST]: { kind: null, verified_guardians: 0 },
};

interface Call { url: string; method: string; body: unknown }
interface Opts {
  rpc?: Record<string, { status: number; body: unknown }>;
  accessStatus?: number;
  rewards?: unknown[];
  links?: unknown[];
  invites?: unknown[];
  inviteInsert?: { status: number; body: unknown };
  ledger?: unknown[];
  selfActions?: unknown[];
  staffGrants?: string[];
}

function stub(opts: Opts = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined });
    const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (rpc === 'wallet_access') {
      if (opts.accessStatus) return Promise.resolve(jsonResponse(opts.accessStatus, { message: 'down' }));
      const who = (JSON.parse(String(init?.body)) as { p_user: string }).p_user;
      return Promise.resolve(jsonResponse(200, ACCESS[who] ?? { kind: null, verified_guardians: 0 }));
    }
    if (rpc) {
      const answer = opts.rpc?.[rpc];
      return Promise.resolve(answer ? jsonResponse(answer.status, answer.body) : jsonResponse(500, { message: 'unstubbed rpc' }));
    }
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (ROLES[id] ?? ['universal']).map((role) => ({ user_id: id, role }))));
    }
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (opts.staffGrants ?? []).map((permission) => ({ permission }))));
    }
    if (url.includes('/rest/v1/personal_rewards?holder_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.rewards ?? []));
    if (url.includes('/rest/v1/personal_rewards?id=in.')) return Promise.resolve(jsonResponse(200, [{ id: REWARD, title: 'Movie night' }]));
    if (url.includes('/rest/v1/wallet_self_actions')) return Promise.resolve(jsonResponse(200, opts.selfActions ?? []));
    if (url.includes('/rest/v1/wallet_guardian_actions')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/guardian_links?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.links ?? []));
    if (url.includes('/rest/v1/guardian_invites') && method === 'POST') {
      const answer = opts.inviteInsert ?? { status: 201, body: null };
      return Promise.resolve(new Response(answer.body === null ? null : JSON.stringify(answer.body), { status: answer.status }));
    }
    if (url.includes('/rest/v1/guardian_invites')) return Promise.resolve(jsonResponse(200, opts.invites ?? []));
    if (url.includes('/rest/v1/profiles?user_id=in.')) return Promise.resolve(jsonResponse(200, [{ user_id: PARENT, display_name: 'Ana' }]));
    if (url.includes('/rest/v1/savings_goals?id=eq.')) {
      return Promise.resolve(jsonResponse(200, [{ id: GOAL, kid_user_id: TEEN, title: 'Headphones', target: 10, icon: 'star', status: 'reached', created_at: '2026-09-01T00:00:00Z', reached_at: '2026-09-24T00:00:00Z' }]));
    }
    if (url.includes('/rest/v1/savings_goals?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/wallet_ledger?goal_id=eq.')) return Promise.resolve(jsonResponse(200, [{ amount: 10 }]));
    if (url.includes('/rest/v1/wallet_ledger?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.ledger ?? []));
    if (url.includes('/rest/v1/tasks?assigned_to=eq.')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/banking_accounts')) return Promise.resolve(jsonResponse(200, []));
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const as = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const rpcCalls = (calls: Call[], name?: string) => calls.filter((c) => c.url.includes('/rest/v1/rpc/') && !c.url.includes('/rpc/wallet_access')
  && (!name || c.url.includes(`/rpc/${name}`)));
const refusal = (message: string) => ({ status: 400, body: { code: 'P0001', message, details: null, hint: null } });
const app = () => request(createApp());

describe('GET /api/v1/wallet/access', () => {
  it.each([
    ['an independent teen', TEEN, {}, { holder: 'teen', familyChild: false }],
    ['a teen who linked a parent', LINKED_TEEN, {}, { holder: 'teen', familyChild: true }],
    ['a parent-created child', KID, {}, { holder: 'managed_child', familyChild: true }],
    ['an adult learner', ADULT, {}, { holder: null, familyChild: false }],
    ['a verified parent', PARENT, {}, { holder: null, familyChild: false }],
    ['staff', STAFF, {}, { holder: null, familyChild: false }],
    ['a guest', GUEST, { is_anonymous: true }, { holder: null, familyChild: false }],
  ])('answers %s from the database classification', async (_label, who, extra, expected) => {
    const calls = stub();
    const res = await app().get('/api/v1/wallet/access').set('Authorization', as(who, extra));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expected);
    // Parents, staff, children and guests never need the age read; everyone else is classified by the database.
    const asked = calls.some((c) => c.url.includes('/rpc/wallet_access'));
    expect(asked).toBe([TEEN, LINKED_TEEN, ADULT].includes(who));
  });

  it('answers 502, never "no wallet" or "wallet", when the classification cannot be read', async () => {
    stub({ accessStatus: 503 });
    const res = await app().get('/api/v1/wallet/access').set('Authorization', as(TEEN));
    expect(res.status).toBe(502);
  });

  it('requires a session', async () => {
    stub();
    expect((await app().get('/api/v1/wallet/access')).status).toBe(401);
  });
});

describe('POST /api/v1/wallet/income (logged income, split at once, no approval)', () => {
  const body = { source: 'earned', save: 10, spend: 6, share: 4, goalId: GOAL };

  it('passes the CALLER as the holder with the exact split, and returns the goal the database reached', async () => {
    const calls = stub({ rpc: { teen_log_income: { status: 200, body: ACTION } } });
    const res = await app().post('/api/v1/wallet/income').set('Authorization', as(TEEN)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.actionId).toBe(ACTION);
    expect(res.body.data.goal).toMatchObject({ id: GOAL, status: 'reached', saved: 10, target: 10 });
    expect(rpcCalls(calls)).toHaveLength(1);
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_holder: TEEN, p_source: 'earned', p_save: 10, p_spend: 6, p_share: 4, p_goal_id: GOAL });
  });

  it('keeps logging income after a parent links (the self-directed foundation stays)', async () => {
    const calls = stub({ rpc: { teen_log_income: { status: 200, body: ACTION } } });
    const res = await app().post('/api/v1/wallet/income').set('Authorization', as(LINKED_TEEN)).send({ source: 'gift', save: 0, spend: 5, share: 0 });
    expect(res.status).toBe(201);
    expect(rpcCalls(calls)[0]!.body).toMatchObject({ p_holder: LINKED_TEEN, p_goal_id: null });
  });

  it.each([
    ['a parent-created child', KID, {}],
    ['an adult learner', ADULT, {}],
    ['a verified parent', PARENT, {}],
    ['staff', STAFF, {}],
    ['a guest who declared 13-17', GUEST, { is_anonymous: true }],
  ])('refuses %s before any RPC', async (_label, who, extra) => {
    const calls = stub({ rpc: { teen_log_income: { status: 200, body: ACTION } } });
    const res = await app().post('/api/v1/wallet/income').set('Authorization', as(who, extra)).send(body);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TEEN_WALLET_REQUIRED');
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it.each([
    ['a holder named in the body', { ...body, holderId: ADULT }],
    ['an empty split', { source: 'gift', save: 0, spend: 0, share: 0 }],
    ['more than 1000 coins', { source: 'gift', save: 600, spend: 600, share: 0 }],
    ['a goal without coins in Save', { source: 'gift', save: 0, spend: 5, share: 0, goalId: GOAL }],
    ['an unknown source', { source: 'salary', save: 1, spend: 0, share: 0 }],
    ['a fractional amount', { source: 'gift', save: 1.5, spend: 0, share: 0 }],
    ['a negative pocket', { source: 'gift', save: -1, spend: 5, share: 0 }],
  ])('rejects %s with 400 before any RPC', async (_label, bad) => {
    const calls = stub({ rpc: { teen_log_income: { status: 200, body: ACTION } } });
    const res = await app().post('/api/v1/wallet/income').set('Authorization', as(TEEN)).send(bad);
    expect(res.status).toBe(400);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it.each([
    ['ACCOUNT_FROZEN', 409],
    ['TEEN_WALLET_REQUIRED', 403],
    ['GOAL_NOT_ACTIVE', 409],
    ['SELF_INCOME_INVALID', 400],
    ['SOMETHING_NEW', 409],
  ])('maps the database refusal %s to %i and never reports success', async (code, status) => {
    stub({ rpc: { teen_log_income: refusal(code) } });
    const res = await app().post('/api/v1/wallet/income').set('Authorization', as(TEEN)).send(body);
    expect(res.status).toBe(status);
    expect(res.body.data).toBeNull();
  });

  it('answers 502 on a transport failure or an unconfirmed receipt, never success', async () => {
    stub({ rpc: { teen_log_income: { status: 503, body: { message: 'upstream' } } } });
    expect((await app().post('/api/v1/wallet/income').set('Authorization', as(TEEN)).send(body)).status).toBe(502);
    stub({ rpc: { teen_log_income: { status: 200, body: 'not-a-uuid' } } });
    expect((await app().post('/api/v1/wallet/income').set('Authorization', as(TEEN)).send(body)).status).toBe(502);
  });

  it('answers 502 when the age classification cannot be read, never an admission', async () => {
    const calls = stub({ accessStatus: 500, rpc: { teen_log_income: { status: 200, body: ACTION } } });
    expect((await app().post('/api/v1/wallet/income').set('Authorization', as(TEEN)).send(body)).status).toBe(502);
    expect(rpcCalls(calls)).toHaveLength(0);
  });
});

describe('personal rewards (in place of a parent-curated catalog)', () => {
  const reward = { id: REWARD, holder_user_id: TEEN, title: 'Movie night', cost: 5, status: 'active', created_at: '2026-09-24T00:00:00Z', archived_at: null };

  it('lists only the caller\'s own rewards', async () => {
    const calls = stub({ rewards: [reward] });
    const res = await app().get('/api/v1/wallet/rewards').set('Authorization', as(TEEN));
    expect(res.status).toBe(200);
    expect(res.body.data.rewards).toEqual([{ id: REWARD, title: 'Movie night', cost: 5, status: 'active', createdAt: '2026-09-24T00:00:00Z', archivedAt: null }]);
    expect(calls.find((c) => c.url.includes('/personal_rewards'))!.url).toContain(`holder_user_id=eq.${TEEN}`);
  });

  it('creates, marks and archives through the audited RPCs with the caller as holder', async () => {
    const calls = stub({ rpc: {
      teen_create_personal_reward: { status: 200, body: REWARD },
      teen_claim_personal_reward: { status: 200, body: ACTION },
      teen_archive_personal_reward: { status: 200, body: true },
    } });
    const created = await app().post('/api/v1/wallet/rewards').set('Authorization', as(TEEN)).send({ title: '  Movie night ', cost: 5 });
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual({ rewardId: REWARD });
    const claimed = await app().post(`/api/v1/wallet/rewards/${REWARD}/claim`).set('Authorization', as(TEEN)).send({});
    expect(claimed.status).toBe(201);
    const archived = await app().post(`/api/v1/wallet/rewards/${REWARD}/archive`).set('Authorization', as(TEEN)).send({});
    expect(archived.body.data).toEqual({ archived: true });
    expect(rpcCalls(calls).map((c) => c.body)).toEqual([
      { p_holder: TEEN, p_title: 'Movie night', p_cost: 5 },
      { p_holder: TEEN, p_reward: REWARD },
      { p_holder: TEEN, p_reward: REWARD },
    ]);
  });

  it.each([
    ['INSUFFICIENT_BALANCE', 409],
    ['PERSONAL_REWARD_UNAVAILABLE', 404],
    ['SPEND_LIMIT_REACHED', 409],
    ['ACCOUNT_FROZEN', 409],
  ])('maps a refused mark (%s) to %i', async (code, status) => {
    stub({ rpc: { teen_claim_personal_reward: refusal(code) } });
    const res = await app().post(`/api/v1/wallet/rewards/${REWARD}/claim`).set('Authorization', as(TEEN)).send({});
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it.each([
    ['a parent-created child', KID],
    ['an adult learner', ADULT],
    ['a verified parent', PARENT],
  ])('refuses %s every reward action before any RPC', async (_label, who) => {
    const calls = stub({ rpc: { teen_create_personal_reward: { status: 200, body: REWARD }, teen_claim_personal_reward: { status: 200, body: ACTION } } });
    expect((await app().get('/api/v1/wallet/rewards').set('Authorization', as(who))).status).toBe(403);
    expect((await app().post('/api/v1/wallet/rewards').set('Authorization', as(who)).send({ title: 'x', cost: 5 })).status).toBe(403);
    expect((await app().post(`/api/v1/wallet/rewards/${REWARD}/claim`).set('Authorization', as(who)).send({})).status).toBe(403);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it.each([
    [{ title: '', cost: 5 }], [{ title: 'x'.repeat(61), cost: 5 }], [{ title: 'x', cost: 0 }], [{ title: 'x', cost: 501 }], [{ title: 'x', cost: 5, holderId: ADULT }],
  ])('rejects an invalid reward %j with 400', async (bad) => {
    const calls = stub();
    expect((await app().post('/api/v1/wallet/rewards').set('Authorization', as(TEEN)).send(bad)).status).toBe(400);
    expect(rpcCalls(calls)).toHaveLength(0);
  });
});

describe('POST /api/v1/wallet/goals/:id/release', () => {
  it('moves coins out of the teen\'s own goal through the audited RPC', async () => {
    const calls = stub({ rpc: { teen_release_goal: { status: 200, body: ACTION } } });
    const res = await app().post(`/api/v1/wallet/goals/${GOAL}/release`).set('Authorization', as(TEEN)).send({ amount: 4, destination: 'spend' });
    expect(res.status).toBe(201);
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_holder: TEEN, p_goal_id: GOAL, p_amount: 4, p_destination: 'spend' });
  });

  it('refuses Share as a destination, and a child or an adult, before any RPC', async () => {
    const calls = stub({ rpc: { teen_release_goal: { status: 200, body: ACTION } } });
    expect((await app().post(`/api/v1/wallet/goals/${GOAL}/release`).set('Authorization', as(TEEN)).send({ amount: 4, destination: 'share' })).status).toBe(400);
    expect((await app().post(`/api/v1/wallet/goals/${GOAL}/release`).set('Authorization', as(KID)).send({ amount: 4, destination: 'spend' })).status).toBe(403);
    expect((await app().post(`/api/v1/wallet/goals/${GOAL}/release`).set('Authorization', as(ADULT)).send({ amount: 4, destination: 'spend' })).status).toBe(403);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it('maps GOAL_BALANCE_INSUFFICIENT and GOAL_NOT_FOUND honestly', async () => {
    stub({ rpc: { teen_release_goal: refusal('GOAL_BALANCE_INSUFFICIENT') } });
    expect((await app().post(`/api/v1/wallet/goals/${GOAL}/release`).set('Authorization', as(TEEN)).send({ amount: 40, destination: 'save' })).status).toBe(409);
    stub({ rpc: { teen_release_goal: refusal('GOAL_NOT_FOUND') } });
    expect((await app().post(`/api/v1/wallet/goals/${GOAL}/release`).set('Authorization', as(TEEN)).send({ amount: 4, destination: 'save' })).status).toBe(404);
  });
});

describe('inviting a parent later (teen-initiated, optional)', () => {
  it('issues a single-use invite for the teen\'s OWN account, created by the teen', async () => {
    const calls = stub();
    const res = await app().post('/api/v1/wallet/guardian-invite').set('Authorization', as(TEEN)).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const insert = calls.find((c) => c.url.includes('/rest/v1/guardian_invites') && c.method === 'POST')!;
    expect(insert.body).toMatchObject({ kid_user_id: TEEN, created_by: TEEN });
  });

  it('maps the outstanding-invite bound to 409 and a transport failure to 502', async () => {
    stub({ inviteInsert: refusal('GUARDIAN_INVITE_LIMIT') });
    expect((await app().post('/api/v1/wallet/guardian-invite').set('Authorization', as(TEEN)).send({})).status).toBe(409);
    stub({ inviteInsert: { status: 503, body: { message: 'down' } } });
    expect((await app().post('/api/v1/wallet/guardian-invite').set('Authorization', as(TEEN)).send({})).status).toBe(502);
  });

  it.each([['a parent-created child', KID], ['an adult learner', ADULT], ['a verified parent', PARENT]])('refuses %s', async (_label, who) => {
    const calls = stub();
    expect((await app().post('/api/v1/wallet/guardian-invite').set('Authorization', as(who)).send({})).status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rest/v1/guardian_invites') && c.method === 'POST')).toBe(false);
  });

  it('shows the teen their parents, and marks only a pending link from the teen\'s own invite as theirs to decide', async () => {
    stub({
      links: [
        { id: LINK, parent_user_id: PARENT, verification_status: 'pending', created_at: '2026-09-24T00:00:00Z', verified_at: null, decided_at: null, revoked_at: null, invite_id: INVITE },
        { id: OTHER_LINK, parent_user_id: PARENT, verification_status: 'pending', created_at: '2026-09-24T00:00:00Z', verified_at: null, decided_at: null, revoked_at: null, invite_id: null },
      ],
      invites: [{ id: INVITE }],
    });
    const res = await app().get('/api/v1/wallet/guardians').set('Authorization', as(TEEN));
    expect(res.status).toBe(200);
    expect(res.body.data.guardians.map((g: { linkId: string; awaitingMe: boolean; displayName: string }) => [g.linkId, g.awaitingMe, g.displayName]))
      .toEqual([[LINK, true, 'Ana'], [OTHER_LINK, false, 'Ana']]);
    expect(JSON.stringify(res.body)).not.toContain(PARENT);
  });

  it('confirms through the audited RPC with the caller as the deciding teen, and maps a decided link to 409', async () => {
    const calls = stub({ rpc: { teen_decide_guardian_link: { status: 200, body: 'verified' } } });
    const res = await app().post(`/api/v1/wallet/guardians/${LINK}/decision`).set('Authorization', as(TEEN)).send({ decision: 'confirm' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ linkId: LINK, status: 'verified' });
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_link_id: LINK, p_teen: TEEN, p_confirm: true });
    stub({ rpc: { teen_decide_guardian_link: refusal('GUARDIAN_LINK_NOT_PENDING') } });
    expect((await app().post(`/api/v1/wallet/guardians/${LINK}/decision`).set('Authorization', as(TEEN)).send({ decision: 'reject' })).status).toBe(409);
  });

  it('refuses a parent deciding through the teen route, before any RPC', async () => {
    const calls = stub({ rpc: { teen_decide_guardian_link: { status: 200, body: 'verified' } } });
    expect((await app().post(`/api/v1/wallet/guardians/${LINK}/decision`).set('Authorization', as(PARENT)).send({ decision: 'confirm' })).status).toBe(403);
    expect(rpcCalls(calls)).toHaveLength(0);
  });
});

describe('the same wallet endpoints for every holder; tasks and approvals stay guardian-only', () => {
  it('admits the independent teen to their own balances, history and goals (the family wallet endpoints)', async () => {
    stub({
      ledger: [{ id: 1, kid_user_id: TEEN, bucket: 'spend', amount: -5, reason: 'personal_reward', task_id: null, goal_id: null, redemption_id: null,
        guardian_action_id: null, self_action_id: ACTION, created_at: '2026-09-24T00:00:00Z' }],
      selfActions: [{ id: ACTION, kind: 'personal_reward', holder_user_id: TEEN, source: null, personal_reward_id: REWARD, goal_id: null, destination: null }],
    });
    expect((await app().get('/api/v1/tasks/wallet').set('Authorization', as(TEEN))).status).toBe(200);
    const ledger = await app().get('/api/v1/tasks/wallet/ledger').set('Authorization', as(TEEN));
    expect(ledger.status).toBe(200);
    expect(ledger.body.data.entries[0]).toMatchObject({ reason: 'personal_reward', rewardTitle: 'Movie night', source: null, note: null });
    expect((await app().get('/api/v1/tasks/goals').set('Authorization', as(TEEN))).status).toBe(200);
  });

  it.each([
    ['GET', '/api/v1/tasks/mine'],
    ['GET', '/api/v1/tasks/streak'],
    ['GET', '/api/v1/tasks/catalog/available'],
    ['GET', '/api/v1/tasks/redemptions/mine'],
    ['POST', '/api/v1/tasks/redemptions'],
    ['POST', `/api/v1/tasks/${GOAL}/complete`],
    ['POST', `/api/v1/tasks/${GOAL}/allocate`],
    ['GET', '/api/v1/banking/account'],
    ['GET', '/api/v1/banking/wallet/pending-credits'],
  ])('refuses an unlinked teen %s %s (guardian-only)', async (method, path) => {
    const calls = stub();
    const req = method === 'GET' ? app().get(path) : app().post(path).send({});
    const res = await req.set('Authorization', as(TEEN));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GUARDIAN_LINK_REQUIRED');
    expect(calls.some((c) => /\/rest\/v1\/(tasks|redemptions|redemption_catalog|pending_credits)/.test(c.url))).toBe(false);
  });

  it('admits a teen who linked a verified parent to the family mechanics on the same wallet', async () => {
    stub();
    expect((await app().get('/api/v1/tasks/mine').set('Authorization', as(LINKED_TEEN))).status).toBe(200);
  });

  it.each([
    ['an adult learner', ADULT, 'WALLET_UNAVAILABLE'],
    ['a verified parent', PARENT, 'WALLET_UNAVAILABLE'],
    ['staff', STAFF, 'WALLET_UNAVAILABLE'],
  ])('never gives %s a personal wallet', async (_label, who, code) => {
    stub();
    for (const path of ['/api/v1/tasks/wallet', '/api/v1/tasks/wallet/ledger', '/api/v1/tasks/goals', '/api/v1/banking/statement']) {
      const res = await app().get(path).set('Authorization', as(who));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(code);
    }
    const created = await app().post('/api/v1/tasks/goals').set('Authorization', as(who)).send({ title: 'Car', target: 100 });
    expect(created.status).toBe(403);
  });

  it('builds the teen\'s monthly statement, counting a goal release as neither income nor spending', async () => {
    stub({
      ledger: [
        { id: 1, kid_user_id: TEEN, bucket: 'save', amount: 10, reason: 'self_income', task_id: null, goal_id: GOAL, redemption_id: null, guardian_action_id: null, self_action_id: ACTION, created_at: '2026-09-24T00:00:00Z' },
        { id: 2, kid_user_id: TEEN, bucket: 'save', amount: -4, reason: 'goal_release', task_id: null, goal_id: GOAL, redemption_id: null, guardian_action_id: null, self_action_id: ACTION, created_at: '2026-09-24T00:00:00Z' },
        { id: 3, kid_user_id: TEEN, bucket: 'spend', amount: 4, reason: 'goal_release', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, self_action_id: ACTION, created_at: '2026-09-24T00:00:00Z' },
        { id: 4, kid_user_id: TEEN, bucket: 'spend', amount: -3, reason: 'personal_reward', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, self_action_id: ACTION, created_at: '2026-09-24T00:00:00Z' },
      ],
    });
    const res = await app().get('/api/v1/banking/statement?month=2026-09').set('Authorization', as(TEEN));
    expect(res.status).toBe(200);
    expect(res.body.data.statement).toMatchObject({ earned: 10, spent: 3, adjusted: 0, saved: 6 });
  });
});

describe('GET /api/v1/admin/family/teen-wallet-adoption (Appendix H, Diagnostic)', () => {
  it('serves counts only, behind the analytics grant', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { teen_wallet_adoption: { status: 200, body: [{ eligible_teens: 4, adopters: 3, independent_adopters: 2, linked_adopters: 1, new_adopters: 1 }] } } });
    const res = await app().get('/api/v1/admin/family/teen-wallet-adoption?days=30').set('Authorization', as(STAFF));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ eligibleTeens: 4, adopters: 3, independentAdopters: 2, linkedAdopters: 1, newAdopters: 1, adoptionRate: 0.75 });
  });

  it('refuses staff without the grant, and every non-staff population', async () => {
    const calls = stub({ staffGrants: ['manage_support'] });
    expect((await app().get('/api/v1/admin/family/teen-wallet-adoption').set('Authorization', as(STAFF))).status).toBe(403);
    for (const who of [TEEN, PARENT, ADULT, KID]) {
      expect((await app().get('/api/v1/admin/family/teen-wallet-adoption').set('Authorization', as(who))).status).toBe(403);
    }
    expect(rpcCalls(calls, 'teen_wallet_adoption')).toHaveLength(0);
  });

  it('reports an empty population as a null rate, not 0% or 100%', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { teen_wallet_adoption: { status: 200, body: [{ eligible_teens: 0, adopters: 0, independent_adopters: 0, linked_adopters: 0, new_adopters: 0 }] } } });
    const res = await app().get('/api/v1/admin/family/teen-wallet-adoption').set('Authorization', as(STAFF));
    expect(res.body.data.adoptionRate).toBeNull();
  });
});
