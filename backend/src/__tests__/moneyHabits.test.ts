import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { RECOMMENDED_SPLIT, splitCoins } from '../services/moneyHabits.js';
import { admissionStubResponse, jsonResponse, mintToken } from './helpers.js';

/*
 * S07.4 at the Core boundary: D.13 (a recommended default split with an easy
 * override), D.14 (a real destination for the Share pocket), D.15 (the
 * next-goal prompt at the celebration) and D.16 (goal progress by
 * provenance), plus their Appendix H diagnostics. Populations: a
 * parent-created child, a teen who linked a verified parent, an unlinked
 * self-registered teen, an adult learner, a guest, the verified parent Tutor,
 * an unrelated parent, and staff with and without the analytics grant. The
 * database is the enforcing boundary (database/scripts/verify-money-habits-postgres.py);
 * these tests prove Core refuses the wrong caller before any write, passes
 * the CALLER as holder and actor (never a body field), maps every database
 * refusal honestly and never reports a state the database did not confirm.
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
const GOAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEXT_GOAL = 'abababab-abab-4aba-8aba-abababababab';
const DEST = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GIFT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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

interface Call { url: string; method: string; body: Record<string, unknown> | undefined }
interface Opts {
  rpc?: Record<string, { status: number; body: unknown }>;
  goals?: Record<string, unknown>[];
  goal?: Record<string, unknown> | null;
  steps?: Record<string, unknown>[] | 'DOWN';
  gift?: Record<string, unknown> | null;
  destination?: Record<string, unknown> | null;
  destinations?: Record<string, unknown>[];
  gifts?: Record<string, unknown>[];
  staffGrants?: string[];
}

const goalRow = (over: Record<string, unknown> = {}) => ({
  id: GOAL, kid_user_id: KID, title: 'Bike', target: 50, icon: 'bike', status: 'active', created_at: '2026-09-01T00:00:00Z', reached_at: null, follows_goal_id: null, ...over,
});

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
    if (rpc) {
      const answer = opts.rpc?.[rpc];
      if (answer) return Promise.resolve(jsonResponse(answer.status, answer.body));
      if (rpc === 'goal_progress_breakdown') {
        return Promise.resolve(jsonResponse(200, (body!.p_goal_ids as string[]).map((goal_id) => ({ goal_id, own: 30, bonus: 0, family: 0, total: 30 }))));
      }
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
    if (url.includes('/rest/v1/savings_goals?kid_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.goals ?? [goalRow()]));
    if (url.includes('/rest/v1/savings_goals?id=eq.')) return Promise.resolve(jsonResponse(200, opts.goal === null ? [] : [opts.goal ?? goalRow()]));
    if (url.includes('/rest/v1/savings_goals') && method === 'POST') {
      return Promise.resolve(jsonResponse(201, [{ ...goalRow({ id: NEXT_GOAL }), ...body }]));
    }
    if (url.includes('/rest/v1/goal_next_steps?')) {
      return Promise.resolve(opts.steps === 'DOWN' ? jsonResponse(503, { message: 'down' }) : jsonResponse(200, opts.steps ?? []));
    }
    if (url.includes('/rest/v1/share_destinations?id=eq.')) return Promise.resolve(jsonResponse(200, opts.destination === null ? [] : [opts.destination ?? destinationRow()]));
    if (url.includes('/rest/v1/share_destinations?holder_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.destinations ?? [destinationRow()]));
    if (url.includes('/rest/v1/share_gifts?id=eq.')) return Promise.resolve(jsonResponse(200, opts.gift === null ? [] : [opts.gift ?? giftRow()]));
    if (url.includes('/rest/v1/share_gifts?holder_user_id=eq.')) return Promise.resolve(jsonResponse(200, opts.gifts ?? [giftRow()]));
    return Promise.resolve(new Response(null, { status: 201 }));
  }));
  return calls;
}

const destinationRow = (over: Record<string, unknown> = {}) => ({
  id: DEST, holder_user_id: KID, title: 'Food bank', kind: 'charity', chosen_by: 'tutor', status: 'active', created_at: '2026-09-01T00:00:00Z', ...over,
});
const giftRow = (over: Record<string, unknown> = {}) => ({
  id: GIFT, holder_user_id: KID, destination_id: DEST, amount: 4, status: 'pledged', pledged_at: '2026-09-20T00:00:00Z', settled_at: null, settled_by: null, note: null, ...over,
});

afterEach(() => vi.unstubAllGlobals());

const as = (sub: string, extra: { is_anonymous?: boolean } = {}) => `Bearer ${mintToken({ sub, ...extra })}`;
const app = () => request(createApp());
const rpcCalls = (calls: Call[], name: string) => calls.filter((c) => c.url.includes(`/rest/v1/rpc/${name}`));
const refusal = (message: string) => ({ status: 400, body: { code: 'P0001', message, details: null, hint: null } });
const HOLDERS: [string, string][] = [['a parent-created child', KID], ['a linked teen', LINKED_TEEN], ['an unlinked teen', TEEN]];
const NON_HOLDERS: [string, string, { is_anonymous?: boolean }][] = [
  ['an adult learner', ADULT, {}], ['a guest', GUEST, { is_anonymous: true }], ['a parent', PARENT, {}], ['staff', STAFF, {}],
];
const NON_PARENTS: [string, string, { is_anonymous?: boolean }][] = [
  ['a parent-created child', KID, {}], ['a linked teen', LINKED_TEEN, {}], ['an unlinked teen', TEEN, {}],
  ['an adult learner', ADULT, {}], ['staff', STAFF, {}], ['a guest', GUEST, { is_anonymous: true }],
];

// ── D.13 ────────────────────────────────────────────────────────────────────

describe('the usual split (D.13)', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const fixture = JSON.parse(readFileSync(join(root, 'database/scripts/fixtures/split-coins.json'), 'utf8')) as {
    cases: { amount: number; pct: { save: number; spend: number; share: number }; coins: { save: number; spend: number; share: number } }[];
  };

  it('splits coins exactly like the database for every fixture case (parity with wallet_split_coins)', () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(200);
    for (const c of fixture.cases) expect(splitCoins(c.amount, c.pct), JSON.stringify(c)).toEqual(c.coins);
  });

  it('recommends 50 / 40 / 10 (the threshold log value)', () => {
    expect(RECOMMENDED_SPLIT).toEqual({ save: 50, spend: 40, share: 10 });
  });

  for (const [label, who] of HOLDERS) {
    it(`reads ${label}'s own usual split and the recommendation`, async () => {
      const calls = stub({ rpc: { wallet_usual_split: { status: 200, body: [{ save_pct: 60, spend_pct: 30, share_pct: 10, custom: true }] } } });
      const res = await app().get('/api/v1/tasks/wallet/split').set('Authorization', as(who));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ usual: { save: 60, spend: 30, share: 10 }, custom: true, recommended: { save: 50, spend: 40, share: 10 } });
      expect(rpcCalls(calls, 'wallet_usual_split')[0]!.body).toEqual({ p_holder: who });
    });

    it(`lets ${label} set their own usual split, as the caller`, async () => {
      const calls = stub({ rpc: { set_wallet_usual_split: { status: 200, body: true } } });
      const res = await app().put('/api/v1/tasks/wallet/split').set('Authorization', as(who)).send({ save: 20, spend: 70, share: 10 });
      expect(res.status).toBe(200);
      expect(rpcCalls(calls, 'set_wallet_usual_split')[0]!.body).toEqual({ p_holder: who, p_actor: who, p_save: 20, p_spend: 70, p_share: 10 });
    });
  }

  for (const [label, who, extra] of NON_HOLDERS) {
    it(`refuses ${label} before any RPC`, async () => {
      const calls = stub();
      expect((await app().get('/api/v1/tasks/wallet/split').set('Authorization', as(who, extra))).status).toBe(403);
      expect((await app().put('/api/v1/tasks/wallet/split').set('Authorization', as(who, extra)).send({ save: 50, spend: 40, share: 10 })).status).toBe(403);
      expect(calls.some((c) => c.url.includes('split'))).toBe(false);
    });
  }

  it('refuses a split that does not add up to 100, or names another holder, before any RPC', async () => {
    const calls = stub();
    for (const body of [{ save: 50, spend: 40, share: 5 }, { save: 101, spend: 0, share: -1 }, { save: 50.5, spend: 39.5, share: 10 }, { save: 50, spend: 40, share: 10, holderId: OTHER_KID }]) {
      expect((await app().put('/api/v1/tasks/wallet/split').set('Authorization', as(KID)).send(body)).status).toBe(400);
    }
    expect(rpcCalls(calls, 'set_wallet_usual_split')).toHaveLength(0);
  });

  it('maps a database refusal and never reports a transport failure as saved', async () => {
    stub({ rpc: { set_wallet_usual_split: refusal('SPLIT_OWNER_ONLY') } });
    expect((await app().put('/api/v1/tasks/wallet/split').set('Authorization', as(KID)).send({ save: 50, spend: 40, share: 10 })).body.error.code).toBe('SPLIT_OWNER_ONLY');
    stub({ rpc: { set_wallet_usual_split: { status: 503, body: null } } });
    expect((await app().put('/api/v1/tasks/wallet/split').set('Authorization', as(KID)).send({ save: 50, spend: 40, share: 10 })).status).toBe(502);
    stub({ rpc: { wallet_usual_split: { status: 200, body: [] } } });
    expect((await app().get('/api/v1/tasks/wallet/split').set('Authorization', as(KID))).status).toBe(502);
  });

  it("shows the Tutor the child's usual split read-only, and 404s a stranger before any read", async () => {
    stub({ rpc: { wallet_usual_split: { status: 200, body: [{ save_pct: 50, spend_pct: 40, share_pct: 10, custom: false }] } } });
    const res = await app().get(`/api/v1/tasks/${KID}/wallet/split`).set('Authorization', as(PARENT));
    expect(res.status).toBe(200);
    expect(res.body.data.custom).toBe(false);
    const calls = stub();
    expect((await app().get(`/api/v1/tasks/${KID}/wallet/split`).set('Authorization', as(STRANGER))).status).toBe(404);
    expect(rpcCalls(calls, 'wallet_usual_split')).toHaveLength(0);
    // No Tutor route writes a child's usual split.
    expect((await app().put(`/api/v1/tasks/${KID}/wallet/split`).set('Authorization', as(PARENT)).send({ save: 100, spend: 0, share: 0 })).status).toBe(404);
  });

  it('passes an allowance goal tag to the database and refuses a goal with nothing in Save', async () => {
    const credit = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const calls = stub({ rpc: { allocate_pending_credit: { status: 200, body: true } } });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined });
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ user_id: KID, role: 'kid' }]));
      if (url.includes('/rest/v1/pending_credits?id=eq.')) return Promise.resolve(jsonResponse(200, [{ id: credit, kid_user_id: KID, amount: 10, source: 'allowance', source_ref: null, allocated: false, created_at: '2026-09-20T00:00:00Z' }]));
      if (url.includes('/rest/v1/banking_accounts')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/rpc/allocate_pending_credit')) return Promise.resolve(jsonResponse(200, true));
      return Promise.resolve(new Response(null, { status: 201 }));
    }));
    const ok = await app().post(`/api/v1/banking/wallet/pending-credits/${credit}/allocate`).set('Authorization', as(KID)).send({ save: 5, spend: 4, share: 1, goalId: GOAL });
    expect(ok.status).toBe(200);
    expect(calls.find((c) => c.url.includes('allocate_pending_credit'))!.body).toMatchObject({ p_save: 5, p_spend: 4, p_share: 1, p_goal_id: GOAL, p_kid_user_id: KID, p_created_by: KID });
    const bad = await app().post(`/api/v1/banking/wallet/pending-credits/${credit}/allocate`).set('Authorization', as(KID)).send({ save: 0, spend: 9, share: 1, goalId: GOAL });
    expect(bad.status).toBe(400);
  });
});

// ── D.14 ────────────────────────────────────────────────────────────────────

describe('the Share destination (D.14)', () => {
  it("shows the holder their destinations and gifts, naming a settler only as 'holder' or 'tutor'", async () => {
    stub({ gifts: [giftRow({ status: 'given', settled_at: '2026-09-22T00:00:00Z', settled_by: PARENT, note: 'We took rice to the food bank' })] });
    const res = await app().get('/api/v1/tasks/share').set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data.destinations[0]).toEqual({ id: DEST, title: 'Food bank', kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: '2026-09-01T00:00:00Z' });
    expect(res.body.data.gifts[0]).toMatchObject({ id: GIFT, status: 'given', settledBy: 'tutor', note: 'We took rice to the food bank' });
    expect(JSON.stringify(res.body)).not.toContain(PARENT);
  });

  for (const [label, who] of HOLDERS) {
    it(`lets ${label} pledge Share coins as the caller`, async () => {
      const calls = stub({ rpc: { share_gift_pledge: { status: 200, body: GIFT } } });
      const res = await app().post('/api/v1/tasks/share/gifts').set('Authorization', as(who)).send({ destinationId: DEST, amount: 4 });
      expect(res.status).toBe(201);
      expect(rpcCalls(calls, 'share_gift_pledge')[0]!.body).toEqual({ p_holder: who, p_destination: DEST, p_amount: 4 });
    });
  }

  for (const [label, who, extra] of NON_HOLDERS) {
    it(`refuses ${label} every holder Share route before any RPC`, async () => {
      const calls = stub();
      const auth = as(who, extra);
      expect((await app().get('/api/v1/tasks/share').set('Authorization', auth)).status).toBe(403);
      expect((await app().post('/api/v1/tasks/share/gifts').set('Authorization', auth).send({ destinationId: DEST, amount: 4 })).status).toBe(403);
      expect((await app().post('/api/v1/tasks/share/destinations').set('Authorization', auth).send({ title: 'Park', kind: 'community' })).status).toBe(403);
      expect((await app().post(`/api/v1/tasks/share/gifts/${GIFT}/settle`).set('Authorization', auth).send({ outcome: 'returned' })).status).toBe(403);
      expect(calls.some((c) => c.url.includes('/rpc/share_'))).toBe(false);
    });
  }

  it('refuses a pledge outside 1..1000 coins or naming a holder, before any RPC', async () => {
    const calls = stub();
    for (const body of [{ destinationId: DEST, amount: 0 }, { destinationId: DEST, amount: 1001 }, { destinationId: DEST, amount: 2, holderId: OTHER_KID }, { destinationId: 'x', amount: 2 }]) {
      expect((await app().post('/api/v1/tasks/share/gifts').set('Authorization', as(KID)).send(body)).status).toBe(400);
    }
    expect(rpcCalls(calls, 'share_gift_pledge')).toHaveLength(0);
  });

  it.each([
    ['INSUFFICIENT_BALANCE', 409], ['ACCOUNT_FROZEN', 409], ['SHARE_DESTINATION_UNAVAILABLE', 409], ['WALLET_HOLDER_REQUIRED', 403],
  ])('maps a %s refusal of a pledge', async (message, status) => {
    stub({ rpc: { share_gift_pledge: refusal(message) } });
    const res = await app().post('/api/v1/tasks/share/gifts').set('Authorization', as(KID)).send({ destinationId: DEST, amount: 4 });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(message);
  });

  it('never reports a pledge that did not land', async () => {
    stub({ rpc: { share_gift_pledge: { status: 503, body: null } } });
    expect((await app().post('/api/v1/tasks/share/gifts').set('Authorization', as(KID)).send({ destinationId: DEST, amount: 4 })).status).toBe(502);
    stub({ rpc: { share_gift_pledge: { status: 200, body: 'nope' } } });
    expect((await app().post('/api/v1/tasks/share/gifts').set('Authorization', as(KID)).send({ destinationId: DEST, amount: 4 })).status).toBe(502);
  });

  it("lets a child take their pledge back as the caller, and passes the database's refusal of 'given' for a Tutor's destination", async () => {
    const calls = stub({ rpc: { share_gift_settle: { status: 200, body: 'returned' } } });
    const res = await app().post(`/api/v1/tasks/share/gifts/${GIFT}/settle`).set('Authorization', as(KID)).send({ outcome: 'returned' });
    expect(res.status).toBe(200);
    expect(rpcCalls(calls, 'share_gift_settle')[0]!.body).toEqual({ p_gift: GIFT, p_actor: KID, p_outcome: 'returned', p_note: null });
    stub({ rpc: { share_gift_settle: refusal('SHARE_GIFT_FORBIDDEN') } });
    const given = await app().post(`/api/v1/tasks/share/gifts/${GIFT}/settle`).set('Authorization', as(KID)).send({ outcome: 'given', note: 'Done' });
    expect(given.status).toBe(403);
  });

  it('lets a teen choose their own destination; a child in a family gets the database refusal (a Tutor chooses)', async () => {
    const calls = stub({ rpc: { share_destination_create: { status: 200, body: DEST } } });
    const teen = await app().post('/api/v1/tasks/share/destinations').set('Authorization', as(TEEN)).send({ title: 'Animal shelter', kind: 'charity' });
    expect(teen.status).toBe(201);
    expect(rpcCalls(calls, 'share_destination_create')[0]!.body).toEqual({ p_holder: TEEN, p_actor: TEEN, p_title: 'Animal shelter', p_kind: 'charity' });
    stub({ rpc: { share_destination_create: refusal('SHARE_DESTINATION_FORBIDDEN') } });
    const kid = await app().post('/api/v1/tasks/share/destinations').set('Authorization', as(KID)).send({ title: 'Park', kind: 'community' });
    expect(kid.status).toBe(403);
    expect(kid.body.error.code).toBe('SHARE_DESTINATION_FORBIDDEN');
  });

  it("refuses a holder archiving someone else's destination without an RPC", async () => {
    const calls = stub({ destination: destinationRow({ holder_user_id: OTHER_KID }) });
    expect((await app().post(`/api/v1/tasks/share/destinations/${DEST}/archive`).set('Authorization', as(KID))).status).toBe(404);
    expect(rpcCalls(calls, 'share_destination_archive')).toHaveLength(0);
  });

  it('lets the Tutor add a destination and record what happened, as the caller', async () => {
    const calls = stub({ rpc: { share_destination_create: { status: 200, body: DEST }, share_gift_settle: { status: 200, body: 'given' } } });
    const add = await app().post(`/api/v1/tasks/${KID}/share/destinations`).set('Authorization', as(PARENT)).send({ title: 'Grandma gift', kind: 'gift' });
    expect(add.status).toBe(201);
    expect(rpcCalls(calls, 'share_destination_create')[0]!.body).toEqual({ p_holder: KID, p_actor: PARENT, p_title: 'Grandma gift', p_kind: 'gift' });
    const give = await app().post(`/api/v1/tasks/${KID}/share/gifts/${GIFT}/settle`).set('Authorization', as(PARENT)).send({ outcome: 'given', note: 'We bought flowers together' });
    expect(give.status).toBe(200);
    expect(rpcCalls(calls, 'share_gift_settle')[0]!.body).toEqual({ p_gift: GIFT, p_actor: PARENT, p_outcome: 'given', p_note: 'We bought flowers together' });
  });

  it('refuses a Tutor settle with no note, a gift of another child, and a stranger, before any RPC', async () => {
    const calls = stub({ gift: giftRow({ holder_user_id: LINKED_TEEN }) });
    expect((await app().post(`/api/v1/tasks/${KID}/share/gifts/${GIFT}/settle`).set('Authorization', as(PARENT)).send({ outcome: 'returned' })).status).toBe(400);
    expect((await app().post(`/api/v1/tasks/${KID}/share/gifts/${GIFT}/settle`).set('Authorization', as(PARENT)).send({ outcome: 'given', note: 'Done' })).status).toBe(404);
    expect((await app().post(`/api/v1/tasks/${KID}/share/gifts/${GIFT}/settle`).set('Authorization', as(STRANGER)).send({ outcome: 'given', note: 'Done' })).status).toBe(404);
    expect((await app().post(`/api/v1/tasks/${KID}/share/destinations`).set('Authorization', as(STRANGER)).send({ title: 'x', kind: 'gift' })).status).toBe(404);
    expect((await app().get(`/api/v1/tasks/${KID}/share`).set('Authorization', as(STRANGER))).status).toBe(404);
    expect(calls.some((c) => c.url.includes('/rpc/share_'))).toBe(false);
  });

  for (const [label, who, extra] of NON_PARENTS) {
    it(`refuses ${label} every Tutor Share route`, async () => {
      const calls = stub();
      const auth = as(who, extra);
      expect((await app().get(`/api/v1/tasks/${KID}/share`).set('Authorization', auth)).status).toBe(403);
      expect((await app().post(`/api/v1/tasks/${KID}/share/destinations`).set('Authorization', auth).send({ title: 'x', kind: 'gift' })).status).toBe(403);
      expect((await app().post(`/api/v1/tasks/${KID}/share/gifts/${GIFT}/settle`).set('Authorization', auth).send({ outcome: 'given', note: 'x' })).status).toBe(403);
      expect(calls.some((c) => c.url.includes('/rpc/share_'))).toBe(false);
    });
  }

  it('reports a given gift in the monthly statement as given, never as spending', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ user_id: KID, role: 'kid' }]));
      if (url.includes('/rest/v1/wallet_ledger')) {
        const at = '2026-09-10T00:00:00Z';
        return Promise.resolve(jsonResponse(200, [
          { id: 'l1', bucket: 'share', amount: 10, reason: 'task_approved', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, created_at: at },
          { id: 'l2', bucket: 'share', amount: -6, reason: 'share_gift', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, created_at: at },
          { id: 'l3', bucket: 'share', amount: -2, reason: 'share_gift', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, created_at: at },
          { id: 'l4', bucket: 'share', amount: 2, reason: 'share_gift_returned', task_id: null, goal_id: null, redemption_id: null, guardian_action_id: null, created_at: at },
        ]));
      }
      return Promise.resolve(jsonResponse(200, []));
    }));
    const res = await app().get('/api/v1/banking/statement?month=2026-09').set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data.statement).toMatchObject({ earned: 10, spent: 0, given: 6 });
  });
});

// ── D.15 / D.16 ─────────────────────────────────────────────────────────────

describe('goals: provenance (D.16) and the next step (D.15)', () => {
  it("returns every goal's progress split into own, bonus and family, with its next step", async () => {
    stub({
      goals: [goalRow({ status: 'reached', reached_at: '2026-09-24T00:00:00Z' })],
      rpc: { goal_progress_breakdown: { status: 200, body: [{ goal_id: GOAL, own: 45, bonus: 5, family: 0, total: 50 }] } },
      steps: [{ goal_id: GOAL, state: 'pending', reached_at: '2026-09-24T00:00:00Z', next_goal_id: null }],
    });
    const res = await app().get('/api/v1/tasks/goals').set('Authorization', as(KID));
    expect(res.status).toBe(200);
    expect(res.body.data.goals[0]).toMatchObject({ id: GOAL, saved: 50, progress: { own: 45, bonus: 5, family: 0, total: 50 }, nextStep: { state: 'pending', nextGoalId: null } });
  });

  it('refuses to show a mixed or empty number when the provenance or the next step cannot be read', async () => {
    stub({ rpc: { goal_progress_breakdown: { status: 503, body: null } } });
    expect((await app().get('/api/v1/tasks/goals').set('Authorization', as(KID))).status).toBe(502);
    stub({ rpc: { goal_progress_breakdown: { status: 200, body: [] } } });
    expect((await app().get('/api/v1/tasks/goals').set('Authorization', as(KID))).status).toBe(502);
    stub({ steps: 'DOWN' });
    expect((await app().get('/api/v1/tasks/goals').set('Authorization', as(KID))).status).toBe(502);
    stub({ rpc: { goal_progress_breakdown: { status: 503, body: null } } });
    expect((await app().get(`/api/v1/tasks/${KID}/goals`).set('Authorization', as(PARENT))).status).toBe(502);
  });

  it('shows the Tutor the same provenance for their child', async () => {
    stub({ rpc: { goal_progress_breakdown: { status: 200, body: [{ goal_id: GOAL, own: 12, bonus: 0, family: 0, total: 12 }] } } });
    const res = await app().get(`/api/v1/tasks/${KID}/goals`).set('Authorization', as(PARENT));
    expect(res.body.data.goals[0].progress).toEqual({ own: 12, bonus: 0, family: 0, total: 12 });
  });

  for (const [label, who] of HOLDERS) {
    it(`celebrates exactly when the database says it is ${label}'s first view`, async () => {
      const calls = stub({ rpc: { goal_next_step_seen: { status: 200, body: true } } });
      const first = await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/seen`).set('Authorization', as(who));
      expect(first.body.data).toEqual({ celebrate: true });
      expect(rpcCalls(calls, 'goal_next_step_seen')[0]!.body).toEqual({ p_holder: who, p_goal: GOAL });
      stub({ rpc: { goal_next_step_seen: { status: 200, body: false } } });
      expect((await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/seen`).set('Authorization', as(who))).body.data).toEqual({ celebrate: false });
    });
  }

  it('records "not now" as the caller, and maps a foreign goal to 404', async () => {
    const calls = stub({ rpc: { goal_next_step_decline: { status: 200, body: true } } });
    expect((await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/decline`).set('Authorization', as(TEEN))).body.data).toEqual({ declined: true });
    expect(rpcCalls(calls, 'goal_next_step_decline')[0]!.body).toEqual({ p_holder: TEEN, p_goal: GOAL });
    stub({ rpc: { goal_next_step_seen: refusal('GOAL_NOT_FOUND') } });
    expect((await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/seen`).set('Authorization', as(KID))).status).toBe(404);
    stub({ rpc: { goal_next_step_seen: { status: 200, body: 'yes' } } });
    expect((await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/seen`).set('Authorization', as(KID))).status).toBe(502);
  });

  for (const [label, who, extra] of NON_HOLDERS) {
    it(`refuses ${label} the next-step routes before any RPC`, async () => {
      const calls = stub();
      expect((await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/seen`).set('Authorization', as(who, extra))).status).toBe(403);
      expect((await app().post(`/api/v1/tasks/goals/${GOAL}/next-step/decline`).set('Authorization', as(who, extra))).status).toBe(403);
      expect(calls.some((c) => c.url.includes('next_step'))).toBe(false);
    });
  }

  it('starts a next goal that follows a reached one, and refuses one that follows a foreign or unreached goal', async () => {
    const calls = stub({ goal: goalRow({ status: 'reached', reached_at: '2026-09-24T00:00:00Z' }) });
    const res = await app().post('/api/v1/tasks/goals').set('Authorization', as(KID)).send({ title: 'Skates', target: 80, icon: 'toy', followsGoalId: GOAL });
    expect(res.status).toBe(201);
    expect(res.body.data.goal).toMatchObject({ followsGoalId: GOAL, progress: { own: 0, bonus: 0, family: 0, total: 0 } });
    expect(calls.find((c) => c.url.includes('/rest/v1/savings_goals') && c.method === 'POST')!.body).toMatchObject({ kid_user_id: KID, follows_goal_id: GOAL });
    const foreign = stub({ goal: goalRow({ kid_user_id: OTHER_KID, reached_at: '2026-09-24T00:00:00Z' }) });
    expect((await app().post('/api/v1/tasks/goals').set('Authorization', as(KID)).send({ title: 'Skates', target: 80, followsGoalId: GOAL })).status).toBe(404);
    expect(foreign.some((c) => c.url.includes('/rest/v1/savings_goals') && c.method === 'POST')).toBe(false);
    stub({ goal: goalRow() });
    expect((await app().post('/api/v1/tasks/goals').set('Authorization', as(KID)).send({ title: 'Skates', target: 80, followsGoalId: GOAL })).status).toBe(409);
  });
});

// ── Appendix H diagnostics ──────────────────────────────────────────────────

describe('S07.4 Appendix H diagnostics', () => {
  const bins = ['0_24h', '24_72h', '72_168h', '168h_plus', 'none'];
  const timing = ['allowance', 'earned'].flatMap((credit_class) => bins.map((bin, i) => ({
    credit_class, bin, requests: i, exposure_hours: bin === 'none' ? null : '48.00', rate_per_100_child_days: bin === 'none' ? null : '12.50',
  })));

  it('serves the redemption-timing rates to analytics staff only', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { family_redemption_credit_timing: { status: 200, body: timing } } });
    const res = await app().get('/api/v1/admin/family/redemption-timing?days=30').set('Authorization', as(STAFF));
    expect(res.status).toBe(200);
    expect(res.body.data.allowance[0]).toEqual({ bin: '0_24h', requests: 0, exposureHours: 48, ratePer100ChildDays: 12.5 });
    expect(res.body.data.earned[4]).toEqual({ bin: 'none', requests: 4, exposureHours: null, ratePer100ChildDays: null });
    stub({ staffGrants: [] });
    expect((await app().get('/api/v1/admin/family/redemption-timing').set('Authorization', as(STAFF))).status).toBe(403);
    stub();
    expect((await app().get('/api/v1/admin/family/redemption-timing').set('Authorization', as(PARENT))).status).toBe(403);
  });

  it('serves split engagement, persistence, the post-goal cliff and Share completion with null rates for empty populations', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: {
      family_split_engagement: { status: 200, body: [{ source: 'allowance', allocations: 0, kept_default: 0, adjusted: 0 }, { source: 'income', allocations: 2, kept_default: 1, adjusted: 1 }, { source: 'task', allocations: 8, kept_default: 6, adjusted: 2 }] },
      family_save_contribution_persistence: { status: 200, body: [{ children: 0, save_contributors: 0, save_coins: 0, own_coins: 0 }] },
      family_post_goal_motivation: { status: 200, body: [{ next_goal_within_2_days: true, goals: 3, mean_before_per_day: '2.000', mean_after_per_day: '1.500', goals_with_drop: 2 }, { next_goal_within_2_days: false, goals: 0, mean_before_per_day: '0', mean_after_per_day: '0', goals_with_drop: 0 }] },
      share_gift_completion: { status: 200, body: [{ pledged: 4, given_in_window: 3, given_later: 0, returned: 1, waiting: 0, holders_with_share: 5, holders_without_destination: 2 }] },
    } });
    const split = await app().get('/api/v1/admin/family/split-engagement').set('Authorization', as(STAFF));
    expect(split.body.data).toMatchObject({ allocations: 10, adjusted: 3, adjustedShare: 0.3 });
    expect(split.body.data.sources[0]).toMatchObject({ source: 'allowance', adjustedShare: null });
    expect((await app().get('/api/v1/admin/family/save-persistence').set('Authorization', as(STAFF))).body.data.saveShare).toBeNull();
    const cliff = await app().get('/api/v1/admin/family/post-goal-motivation').set('Authorization', as(STAFF));
    expect(cliff.body.data.nextGoalWithin2Days).toEqual({ goals: 3, meanBeforePerDay: 2, meanAfterPerDay: 1.5, goalsWithDrop: 2 });
    const share = await app().get('/api/v1/admin/family/share-completion').set('Authorization', as(STAFF));
    expect(share.body.data).toMatchObject({ windowDays: 14, completionRate: 0.75, holdersWithoutDestination: 2 });
  });

  it('answers 502, never a partial, when a diagnostic cannot be read', async () => {
    stub({ staffGrants: ['view_analytics'], rpc: { family_redemption_credit_timing: { status: 200, body: timing.slice(0, 9) } } });
    expect((await app().get('/api/v1/admin/family/redemption-timing').set('Authorization', as(STAFF))).status).toBe(502);
    stub({ staffGrants: ['view_analytics'], rpc: { share_gift_completion: { status: 503, body: null } } });
    expect((await app().get('/api/v1/admin/family/share-completion').set('Authorization', as(STAFF))).status).toBe(502);
    stub({ staffGrants: ['view_analytics'] });
    expect((await app().get('/api/v1/admin/family/split-engagement?days=0').set('Authorization', as(STAFF))).status).toBe(400);
  });
});
