import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S07.1 — D.5 (OD-21) producing and consuming flows, and the D.4 metric, at
 * the Core boundary. Populations: the verified guardian Tutor, a pending
 * second adult, an unrelated verified parent, the parent-created kid, an
 * independent teen (universal role), an unverified adult, staff with and
 * without the analytics grant. The database functions are the enforcing
 * boundary (verified separately on native PostgreSQL); these tests prove
 * Core never reaches them for the wrong caller, passes the acting user
 * through unaltered, maps every refusal honestly and never reports a state
 * the database did not confirm.
 */

const PARENT = '11111111-1111-4111-8111-111111111111';
const KID = '22222222-2222-4222-8222-222222222222';
const SECOND = '33333333-3333-4333-8333-333333333333';
const STRANGER = '44444444-4444-4444-8444-444444444444';
const TEEN = '55555555-5555-4555-8555-555555555555';
const STAFF = '66666666-6666-4666-8666-666666666666';
const GOAL = '77777777-7777-4777-8777-777777777777';
const REDEMPTION = '88888888-8888-4888-8888-888888888888';
const ACTION = '99999999-9999-4999-8999-999999999999';
const LINK_SECOND = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LINK_PARENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_KID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const ROLES: Record<string, string[]> = {
  [PARENT]: ['parent'],
  [SECOND]: ['parent'],
  [STRANGER]: ['parent'],
  [KID]: ['kid'],
  [TEEN]: ['universal'],
  [STAFF]: ['admin'],
};

interface Call { url: string; method: string; body: unknown }
interface Opts {
  rpc?: Record<string, { status: number; body: unknown }>;
  linkRows?: unknown[];
  ownLinks?: unknown[];
  linkStatus?: unknown[];
  goal?: unknown;
  redemption?: unknown;
  ledger?: unknown[];
  actions?: unknown[];
  staffGrants?: string[];
  unverifiedAdult?: string;
}

function stub(opts: Opts = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined });
    const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
    if (rpc) {
      const answer = opts.rpc?.[rpc];
      if (answer) return Promise.resolve(jsonResponse(answer.status, answer.body));
      // S07.4 (D.16): a goal's progress by provenance, read after a withdrawal.
      if (rpc === 'goal_progress_breakdown') {
        const ids = (JSON.parse(String(init?.body)) as { p_goal_ids: string[] }).p_goal_ids;
        return Promise.resolve(jsonResponse(200, ids.map((goal_id) => ({ goal_id, own: 2, bonus: 0, family: 0, total: 2 }))));
      }
      return Promise.resolve(jsonResponse(500, { message: 'unstubbed rpc' }));
    }
    if (url.includes('/rest/v1/goal_next_steps?')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, (ROLES[id] ?? ['universal']).map((role) => ({ user_id: id, role }))));
    }
    if (url.includes('/rest/v1/parent_verifications')) {
      const id = url.match(/user_id=eq\.([0-9a-f-]+)/)![1]!;
      return Promise.resolve(jsonResponse(200, id === opts.unverifiedAdult ? [] : [{ status: 'verified', method: 'local-ocr', birth_date: '1985-01-01' }]));
    }
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (opts.staffGrants ?? []).map((permission) => ({ permission }))));
    }
    if (url.includes('/rest/v1/guardian_links') && url.includes('verification_status=eq.verified') && url.includes('parent_user_id=eq.')) {
      const parent = url.match(/parent_user_id=eq\.([0-9a-f-]+)/)![1]!;
      const kids = parent === PARENT ? [KID] : parent === STRANGER ? [OTHER_KID] : [];
      return Promise.resolve(jsonResponse(200, kids.map((kid) => ({ parent_user_id: parent, kid_user_id: kid, verification_status: 'verified' }))));
    }
    if (url.includes('/rest/v1/guardian_links') && url.includes('verification_status=in.')) {
      return Promise.resolve(jsonResponse(200, opts.ownLinks ?? []));
    }
    if (url.includes('/rest/v1/guardian_links') && url.includes('select=verification_status')) {
      return Promise.resolve(jsonResponse(200, opts.linkStatus ?? [{ verification_status: 'pending' }]));
    }
    if (url.includes('/rest/v1/guardian_links') && url.includes('kid_user_id=eq.')) {
      return Promise.resolve(jsonResponse(200, opts.linkRows ?? []));
    }
    if (url.includes('/rest/v1/profiles?user_id=in.')) {
      return Promise.resolve(jsonResponse(200, [
        { user_id: PARENT, display_name: 'Ana' },
        { user_id: SECOND, display_name: 'Luis' },
        { user_id: KID, display_name: 'Nico' },
      ]));
    }
    if (url.includes('/rest/v1/savings_goals?id=eq.')) {
      return Promise.resolve(jsonResponse(200, opts.goal === undefined ? [] : [opts.goal]));
    }
    if (url.includes('/rest/v1/redemptions?id=eq.')) {
      return Promise.resolve(jsonResponse(200, opts.redemption === undefined ? [] : [opts.redemption]));
    }
    if (url.includes('/rest/v1/wallet_ledger?goal_id=eq.')) {
      return Promise.resolve(jsonResponse(200, [{ amount: 2 }]));
    }
    if (url.includes('/rest/v1/wallet_ledger?kid_user_id=eq.')) {
      return Promise.resolve(jsonResponse(200, opts.ledger ?? []));
    }
    if (url.includes('/rest/v1/wallet_guardian_actions')) {
      return Promise.resolve(jsonResponse(200, opts.actions ?? []));
    }
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const as = (sub: string) => `Bearer ${mintToken({ sub })}`;
const rpcCalls = (calls: Call[]) => calls.filter((c) => c.url.includes('/rest/v1/rpc/'));
const refusal = (message: string) => ({ status: 400, body: { code: 'P0001', message, details: null, hint: null } });

const goalRow = { id: GOAL, kid_user_id: KID, title: 'Bike', target: 10, icon: 'bike', status: 'active', created_at: '2026-09-01T00:00:00Z', reached_at: null };
const redemptionRow = { id: REDEMPTION, catalog_id: GOAL, kid_user_id: KID, status: 'approved', created_at: '2026-09-01T00:00:00Z', decided_at: '2026-09-02T00:00:00Z', decided_by: PARENT, fulfilled_at: null };
const action = { id: ACTION, kind: 'manual_adjustment', kid_user_id: KID, actor_user_id: PARENT, bucket: 'spend', goal_id: null, amount: 5, reason: 'Birthday gift', created_at: '2026-09-03T00:00:00Z' };

describe('POST /api/v1/tasks/:kidId/wallet/adjustments (manual_adjustment)', () => {
  const body = { bucket: 'spend', amount: 5, reason: 'Birthday gift' };

  it('passes the verified guardian, the signed amount and the reason to the audited RPC', async () => {
    const calls = stub({ rpc: { guardian_adjust_wallet: { status: 200, body: ACTION } } });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`).set('Authorization', as(PARENT)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ actionId: ACTION });
    expect(rpcCalls(calls)).toHaveLength(1);
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_kid_user_id: KID, p_actor: PARENT, p_bucket: 'spend', p_amount: 5, p_reason: 'Birthday gift' });
  });

  it.each([
    ['the child themself', KID, 403],
    ['an independent teen', TEEN, 403],
    ['staff', STAFF, 403],
    ['an unrelated verified parent', STRANGER, 404],
    ['a pending second adult', SECOND, 404],
  ])('refuses %s before any RPC', async (_label, who, status) => {
    const calls = stub({ rpc: { guardian_adjust_wallet: { status: 200, body: ACTION } } });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`).set('Authorization', as(who)).send(body);
    expect(res.status).toBe(status);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it('refuses anonymous callers', async () => {
    const calls = stub();
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`).send(body);
    expect(res.status).toBe(401);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it.each([
    [{ bucket: 'spend', amount: 5 }],
    [{ bucket: 'spend', amount: 5, reason: '   ' }],
    [{ bucket: 'spend', amount: 5, reason: 'x'.repeat(241) }],
    [{ bucket: 'spend', amount: 0, reason: 'x' }],
    [{ bucket: 'spend', amount: 1001, reason: 'x' }],
    [{ bucket: 'spend', amount: 2.5, reason: 'x' }],
    [{ bucket: 'bank', amount: 5, reason: 'x' }],
    [{ bucket: 'spend', amount: 5, reason: 'x', actor: STRANGER }],
  ])('requires a bucket, a bounded non-zero integer and a real reason (%j)', async (bad) => {
    const calls = stub();
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`).set('Authorization', as(PARENT)).send(bad);
    expect(res.status).toBe(400);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it.each([
    ['INSUFFICIENT_BALANCE', 409],
    ['GOAL_SAVINGS_PROTECTED', 409],
    ['NOT_A_GUARDIAN', 404],
    ['WALLET_ADJUSTMENT_INVALID', 400],
  ])('maps the database refusal %s', async (message, status) => {
    stub({ rpc: { guardian_adjust_wallet: refusal(message) } });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`)
      .set('Authorization', as(PARENT)).send({ bucket: 'spend', amount: -50, reason: 'Correction' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(message === 'NOT_A_GUARDIAN' ? 'NOT_A_GUARDIAN' : message);
  });

  it('never reports success for a transport failure or an unexpected receipt', async () => {
    stub({ rpc: { guardian_adjust_wallet: { status: 503, body: null } } });
    expect((await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`).set('Authorization', as(PARENT)).send(body)).status).toBe(502);
    stub({ rpc: { guardian_adjust_wallet: { status: 200, body: 'not-a-uuid' } } });
    expect((await request(createApp()).post(`/api/v1/tasks/${KID}/wallet/adjustments`).set('Authorization', as(PARENT)).send(body)).status).toBe(502);
  });
});

describe('POST /api/v1/tasks/:kidId/goals/:goalId/withdrawals (goal_withdrawal)', () => {
  const body = { amount: 4, destination: 'spend', reason: 'Bought the bike' };

  it('runs the audited RPC for the guardian and returns the goal with its new progress', async () => {
    const calls = stub({ goal: goalRow, rpc: { guardian_withdraw_goal: { status: 200, body: ACTION } } });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/goals/${GOAL}/withdrawals`).set('Authorization', as(PARENT)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.actionId).toBe(ACTION);
    expect(res.body.data.goal.saved).toBe(2);
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_goal_id: GOAL, p_actor: PARENT, p_amount: 4, p_destination: 'spend', p_reason: 'Bought the bike' });
  });

  it("404s a goal that belongs to another child, without an RPC", async () => {
    const calls = stub({ goal: { ...goalRow, kid_user_id: OTHER_KID } });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/goals/${GOAL}/withdrawals`).set('Authorization', as(PARENT)).send(body);
    expect(res.status).toBe(404);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it.each([[KID, 403], [TEEN, 403], [STRANGER, 404], [SECOND, 404]])('refuses %s', async (who, status) => {
    const calls = stub({ goal: goalRow });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/goals/${GOAL}/withdrawals`).set('Authorization', as(who)).send(body);
    expect(res.status).toBe(status);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it('rejects Share as a destination and a missing reason', async () => {
    stub({ goal: goalRow });
    expect((await request(createApp()).post(`/api/v1/tasks/${KID}/goals/${GOAL}/withdrawals`).set('Authorization', as(PARENT)).send({ ...body, destination: 'share' })).status).toBe(400);
    expect((await request(createApp()).post(`/api/v1/tasks/${KID}/goals/${GOAL}/withdrawals`).set('Authorization', as(PARENT)).send({ amount: 4, destination: 'spend' })).status).toBe(400);
  });

  it('maps GOAL_BALANCE_INSUFFICIENT to 409', async () => {
    stub({ goal: goalRow, rpc: { guardian_withdraw_goal: refusal('GOAL_BALANCE_INSUFFICIENT') } });
    const res = await request(createApp()).post(`/api/v1/tasks/${KID}/goals/${GOAL}/withdrawals`).set('Authorization', as(PARENT)).send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GOAL_BALANCE_INSUFFICIENT');
  });
});

describe('POST /api/v1/tasks/redemptions/:id/fulfill (fulfilled)', () => {
  it('marks an approved reward delivered for the verified guardian', async () => {
    const calls = stub({ redemption: redemptionRow, rpc: { fulfill_redemption: { status: 200, body: true } } });
    const res = await request(createApp()).post(`/api/v1/tasks/redemptions/${REDEMPTION}/fulfill`).set('Authorization', as(PARENT)).send({});
    expect(res.status).toBe(200);
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_redemption_id: REDEMPTION, p_actor: PARENT });
  });

  it('409s when the database says it is not in the approved state', async () => {
    stub({ redemption: redemptionRow, rpc: { fulfill_redemption: { status: 200, body: false } } });
    expect((await request(createApp()).post(`/api/v1/tasks/redemptions/${REDEMPTION}/fulfill`).set('Authorization', as(PARENT)).send({})).status).toBe(409);
  });

  it.each([[KID, 403], [TEEN, 403], [STRANGER, 404], [SECOND, 404]])('refuses %s before any RPC', async (who, status) => {
    const calls = stub({ redemption: redemptionRow, rpc: { fulfill_redemption: { status: 200, body: true } } });
    const res = await request(createApp()).post(`/api/v1/tasks/redemptions/${REDEMPTION}/fulfill`).set('Authorization', as(who)).send({});
    expect(res.status).toBe(status);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it('turns a database NOT_A_GUARDIAN (link revoked mid-request) into a 404', async () => {
    stub({ redemption: redemptionRow, rpc: { fulfill_redemption: refusal('NOT_A_GUARDIAN') } });
    expect((await request(createApp()).post(`/api/v1/tasks/redemptions/${REDEMPTION}/fulfill`).set('Authorization', as(PARENT)).send({})).status).toBe(404);
  });
});

describe('ledger notes and guardian-action history (consumers)', () => {
  const ledger = [
    { id: 2, kid_user_id: KID, bucket: 'spend', amount: 5, reason: 'manual_adjustment', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: ACTION, created_at: '2026-09-03T00:00:00Z' },
    { id: 1, kid_user_id: KID, bucket: 'save', amount: 3, reason: 'task_approved', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, created_at: '2026-09-02T00:00:00Z' },
  ];

  it("shows the child the guardian's reason on their own history", async () => {
    stub({ ledger, actions: [action] });
    const res = await request(createApp()).get('/api/v1/tasks/wallet/ledger').set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data.entries[0]).toMatchObject({ reason: 'manual_adjustment', note: 'Birthday gift', amount: 5 });
    expect(res.body.data.entries[1].note).toBeNull();
  });

  it('refuses to show a movement whose reason cannot be read', async () => {
    stub({ ledger, actions: [{ broken: true }] });
    expect((await request(createApp()).get('/api/v1/tasks/wallet/ledger').set('Authorization', as(KID))).status).toBe(502);
  });

  it("gives a guardian the child's ledger and correction history, naming only 'you or another Tutor'", async () => {
    stub({ ledger, actions: [action, { ...action, id: LINK_SECOND, actor_user_id: SECOND }] });
    const ledgerRes = await request(createApp()).get(`/api/v1/tasks/${KID}/wallet/ledger`).set('Authorization', as(PARENT));
    expect(ledgerRes.status).toBe(200);
    const history = await request(createApp()).get(`/api/v1/tasks/${KID}/wallet/guardian-actions`).set('Authorization', as(PARENT));
    expect(history.status).toBe(200);
    expect(history.body.data.actions.map((a: { byMe: boolean }) => a.byMe)).toEqual([true, false]);
    expect(JSON.stringify(history.body)).not.toContain(SECOND);
  });

  it.each([[STRANGER, 404], [KID, 403], [TEEN, 403]])('refuses the guardian views to %s', async (who, status) => {
    stub({ ledger, actions: [action] });
    expect((await request(createApp()).get(`/api/v1/tasks/${KID}/wallet/guardian-actions`).set('Authorization', as(who))).status).toBe(status);
    expect((await request(createApp()).get(`/api/v1/tasks/${KID}/wallet/ledger`).set('Authorization', as(who))).status).toBe(status);
  });
});

describe('guardian-link lifecycle (pending / rejected / revoked)', () => {
  const INVITE = 'a'.repeat(32);
  const links = [
    { id: LINK_PARENT, parent_user_id: PARENT, kid_user_id: KID, verification_status: 'verified', created_at: '2026-09-01T00:00:00Z', verified_at: '2026-09-01T00:00:00Z', decided_at: null, revoked_at: null },
    { id: LINK_SECOND, parent_user_id: SECOND, kid_user_id: KID, verification_status: 'pending', created_at: '2026-09-20T00:00:00Z', verified_at: null, decided_at: null, revoked_at: null },
  ];

  it('reports an accepted invite as pending, never as linked', async () => {
    stub({ rpc: { accept_guardian_invite: { status: 200, body: KID } }, linkStatus: [{ verification_status: 'pending' }] });
    const res = await request(createApp()).post(`/api/v1/family/guardian-invite/${INVITE}/accept`).set('Authorization', as(SECOND)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ linked: false, status: 'pending', kidUserId: KID });
  });

  it('reports linked only when the database holds a verified link', async () => {
    stub({ rpc: { accept_guardian_invite: { status: 200, body: KID } }, linkStatus: [{ verification_status: 'verified' }] });
    const res = await request(createApp()).post(`/api/v1/family/guardian-invite/${INVITE}/accept`).set('Authorization', as(SECOND)).send({});
    expect(res.body.data).toEqual({ linked: true, status: 'verified', kidUserId: KID });
  });

  it('502s rather than guessing when the resulting state is unreadable', async () => {
    stub({ rpc: { accept_guardian_invite: { status: 200, body: KID } }, linkStatus: [{ verification_status: 'rejected' }] });
    expect((await request(createApp()).post(`/api/v1/family/guardian-invite/${INVITE}/accept`).set('Authorization', as(SECOND)).send({})).status).toBe(502);
  });

  it("lists the child's Tutors in every state for a verified guardian, display names only", async () => {
    stub({ linkRows: links });
    const res = await request(createApp()).get(`/api/v1/family/kids/${KID}/guardians`).set('Authorization', as(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.guardians).toEqual([
      expect.objectContaining({ linkId: LINK_PARENT, displayName: 'Ana', status: 'verified', isMe: true }),
      expect.objectContaining({ linkId: LINK_SECOND, displayName: 'Luis', status: 'pending', isMe: false }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain(SECOND);
  });

  it.each([[SECOND, 404], [STRANGER, 404], [KID, 403], [TEEN, 403]])('hides the Tutor list from %s', async (who, status) => {
    const calls = stub({ linkRows: links });
    expect((await request(createApp()).get(`/api/v1/family/kids/${KID}/guardians`).set('Authorization', as(who))).status).toBe(status);
    expect(calls.some((c) => c.url.includes('kid_user_id=eq.') && c.url.includes('select=id,parent_user_id'))).toBe(false);
  });

  it('lets the existing guardian confirm or reject a pending Tutor through the RPC', async () => {
    const calls = stub({ linkRows: links, rpc: { decide_guardian_link: { status: 200, body: 'rejected' } } });
    const res = await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/${LINK_SECOND}/decision`).set('Authorization', as(PARENT)).send({ decision: 'reject' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ linkId: LINK_SECOND, status: 'rejected' });
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_link_id: LINK_SECOND, p_actor: PARENT, p_confirm: false });
  });

  it('never lets the pending adult decide their own link', async () => {
    const calls = stub({ linkRows: links, rpc: { decide_guardian_link: { status: 200, body: 'verified' } } });
    const res = await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/${LINK_SECOND}/decision`).set('Authorization', as(SECOND)).send({ decision: 'confirm' });
    expect(res.status).toBe(404);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it("404s a link id that does not belong to this child, and maps an already-decided link to 409", async () => {
    const calls = stub({ linkRows: links, rpc: { decide_guardian_link: refusal('GUARDIAN_LINK_NOT_PENDING') } });
    expect((await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/${ACTION}/decision`).set('Authorization', as(PARENT)).send({ decision: 'confirm' })).status).toBe(404);
    expect(rpcCalls(calls)).toHaveLength(0);
    const res = await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/${LINK_SECOND}/decision`).set('Authorization', as(PARENT)).send({ decision: 'confirm' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GUARDIAN_LINK_NOT_PENDING');
  });

  it('rejects any decision vocabulary beyond confirm/reject', async () => {
    stub({ linkRows: links });
    expect((await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/${LINK_SECOND}/decision`).set('Authorization', as(PARENT)).send({ decision: 'verified' })).status).toBe(400);
  });

  it('lets a guardian step away, and refuses the last one with a named error', async () => {
    const calls = stub({ rpc: { revoke_own_guardian_link: { status: 200, body: true } } });
    const res = await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/leave`).set('Authorization', as(PARENT)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'revoked' });
    expect(rpcCalls(calls)[0]!.body).toEqual({ p_kid_user_id: KID, p_actor: PARENT });
    stub({ rpc: { revoke_own_guardian_link: refusal('LAST_GUARDIAN') } });
    const last = await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/leave`).set('Authorization', as(PARENT)).send({});
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe('LAST_GUARDIAN');
  });

  it("refuses 'leave' for someone who is not this child's verified guardian", async () => {
    const calls = stub({ rpc: { revoke_own_guardian_link: { status: 200, body: true } } });
    expect((await request(createApp()).post(`/api/v1/family/kids/${KID}/guardians/leave`).set('Authorization', as(STRANGER)).send({})).status).toBe(404);
    expect(rpcCalls(calls)).toHaveLength(0);
  });

  it("shows an invited adult their own pending/rejected/revoked links, by the child's display name only", async () => {
    stub({ ownLinks: [{ ...links[1] }, { ...links[1], id: LINK_PARENT, verification_status: 'rejected', decided_at: '2026-09-21T00:00:00Z' }] });
    const res = await request(createApp()).get('/api/v1/family/guardian-links/mine').set('Authorization', as(SECOND));
    expect(res.status).toBe(200);
    expect(res.body.data.links).toEqual([
      // S07.2: who the pending adult waits for (a Tutor here; the teen for a teen's own invite).
      { linkId: LINK_SECOND, kidDisplayName: 'Nico', status: 'pending', awaiting: 'tutor', updatedAt: '2026-09-20T00:00:00Z' },
      { linkId: LINK_PARENT, kidDisplayName: 'Nico', status: 'rejected', awaiting: null, updatedAt: '2026-09-21T00:00:00Z' },
    ]);
    expect(JSON.stringify(res.body)).not.toContain(KID);
  });

  it('keeps the whole lifecycle surface behind verified adulthood', async () => {
    const calls = stub({ unverifiedAdult: SECOND, ownLinks: [] });
    expect((await request(createApp()).get('/api/v1/family/guardian-links/mine').set('Authorization', as(SECOND))).status).toBe(403);
    expect(calls.some((c) => c.url.includes('verification_status=in.'))).toBe(false);
  });
});

describe('GET /api/v1/admin/family/state-integrity (D.4 metric)', () => {
  const rows = [
    { table_name: 'redemptions', transitions: 4, outside_service: 0 },
    { table_name: 'tasks', transitions: 9, outside_service: 1 },
  ];

  it('reports transitions and the out-of-band count to analytics staff', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { family_state_integrity: { status: 200, body: rows } } });
    const res = await request(createApp()).get('/api/v1/admin/family/state-integrity?days=7').set('Authorization', as(STAFF));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ transitions: 13, outsideService: 1 });
    expect(res.body.data.tables).toEqual([
      { table: 'redemptions', transitions: 4, outsideService: 0 },
      { table: 'tasks', transitions: 9, outsideService: 1 },
    ]);
  });

  it('refuses staff without the analytics grant and every family population', async () => {
    stub({ staffGrants: ['manage_content'], rpc: { family_state_integrity: { status: 200, body: rows } } });
    expect((await request(createApp()).get('/api/v1/admin/family/state-integrity').set('Authorization', as(STAFF))).status).toBe(403);
    for (const who of [PARENT, KID, TEEN]) {
      expect((await request(createApp()).get('/api/v1/admin/family/state-integrity').set('Authorization', as(who))).status).toBe(403);
    }
  });

  it('validates the window and fails closed on an unreadable metric', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { family_state_integrity: { status: 200, body: [{ nope: 1 }] } } });
    expect((await request(createApp()).get('/api/v1/admin/family/state-integrity?days=0').set('Authorization', as(STAFF))).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/admin/family/state-integrity').set('Authorization', as(STAFF))).status).toBe(502);
  });
});
