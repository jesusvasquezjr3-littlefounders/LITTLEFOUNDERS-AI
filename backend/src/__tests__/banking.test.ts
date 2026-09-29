import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { admissionStubResponse, jsonResponse, mintToken } from './helpers.js';
import { computeNextRunAt } from '../routes/banking.js';

/*
 * /api/v1/banking — BANKING.md Waves 0-2. Same posture as tasks.test.ts:
 * a caller can never reach another family's account/rule/credit, proven as
 * a 404 rather than a 403.
 */

const PARENT_ID = randomUUID();
const KID_ID = randomUUID();
const OTHER_KID_ID = randomUUID();
const CREDIT_ID = randomUUID();

afterEach(() => vi.unstubAllGlobals());

interface StubOptions {
  roles?: string[];
  parentsKids?: string[];
  kidsParents?: string[];
  account?: Record<string, unknown> | null;
  accountInsertConflict?: boolean;
  accountPatchRejected?: boolean;
  allowanceRule?: Record<string, unknown> | null;
  savingsBonusRule?: Record<string, unknown> | null;
  spendLimit?: Record<string, unknown> | null;
  ledgerRows?: { bucket: string; amount: number; created_at?: string; reason?: string; guardian_action_id?: string | null }[];
  guardianActions?: unknown[];
  pendingCredit?: Record<string, unknown> | null;
  allocateResult?: boolean | null;
  scheduledCreditsResult?: number | null;
}

function defaultAccount(): Record<string, unknown> {
  return {
    kid_user_id: KID_ID,
    nickname: 'Rocket Fund',
    card_design: 'indigo',
    frozen: false,
    frozen_by: null,
    frozen_at: null,
    opened_by: PARENT_ID,
    opened_at: new Date().toISOString(),
  };
}

function defaultPendingCredit(): Record<string, unknown> {
  return { id: CREDIT_ID, kid_user_id: KID_ID, amount: 10, source: 'allowance', source_ref: null, allocated: false, created_at: new Date().toISOString() };
}

function stub(opts: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      const method = init?.method ?? 'GET';

      if (url.includes('/rest/v1/user_roles?user_id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, (opts.roles ?? ['parent']).map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/audit_logs') && method === 'POST') {
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.') && method === 'GET') {
        const rows = (opts.parentsKids ?? [KID_ID]).map((kid_user_id) => ({ parent_user_id: PARENT_ID, kid_user_id, verification_status: 'verified' }));
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/guardian_links?kid_user_id=eq.') && method === 'GET') {
        const rows = (opts.kidsParents ?? [PARENT_ID]).map((parent_user_id) => ({ parent_user_id }));
        return Promise.resolve(jsonResponse(200, rows));
      }

      if (url.includes('/rest/v1/rpc/run_due_scheduled_credits') && method === 'POST') {
        return opts.scheduledCreditsResult === undefined
          ? Promise.resolve(jsonResponse(200, 0))
          : Promise.resolve(jsonResponse(200, opts.scheduledCreditsResult));
      }

      if (url.includes('/rest/v1/banking_accounts') && method === 'PATCH' && opts.accountPatchRejected) {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/banking_accounts') && method === 'POST') {
        if (opts.accountInsertConflict) return Promise.resolve(new Response(null, { status: 409 }));
        return Promise.resolve(jsonResponse(201, [defaultAccount()]));
      }
      if (url.includes('/rest/v1/banking_accounts?kid_user_id=eq.') && method === 'GET') {
        const rows = opts.account === null ? [] : [opts.account ?? defaultAccount()];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/banking_accounts?kid_user_id=eq.') && method === 'PATCH') {
        const rows = opts.account === null ? [] : [{ ...(opts.account ?? defaultAccount()), ...(init?.body ? JSON.parse(String(init.body)) : {}) }];
        return Promise.resolve(jsonResponse(200, rows));
      }

      if (url.includes('/rest/v1/allowance_rules?kid_user_id=eq.') && method === 'GET') {
        const rows = opts.allowanceRule === null ? [] : [opts.allowanceRule ?? null].filter(Boolean);
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/allowance_rules') && method === 'POST') {
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return Promise.resolve(jsonResponse(201, [{ id: randomUUID(), created_at: new Date().toISOString(), ...body }]));
      }

      // S07.3 (D.11): the database's age framing; these legacy cases are a 13-17 child.
      if (url.includes('/rest/v1/rpc/savings_bonus_framing') && method === 'POST') {
        return Promise.resolve(jsonResponse(200, 'percent'));
      }
      if (url.includes('/rest/v1/savings_bonus_rules?kid_user_id=eq.') && method === 'GET') {
        const rows = opts.savingsBonusRule === null ? [] : [opts.savingsBonusRule ?? null].filter(Boolean);
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/savings_bonus_rules') && method === 'POST') {
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return Promise.resolve(jsonResponse(201, [{ created_at: new Date().toISOString(), ...body }]));
      }

      if (url.includes('/rest/v1/spend_limits?kid_user_id=eq.') && method === 'GET') {
        const rows = opts.spendLimit === null ? [] : [opts.spendLimit ?? null].filter(Boolean);
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/spend_limits') && method === 'POST') {
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return Promise.resolve(jsonResponse(201, [{ created_at: new Date().toISOString(), ...body }]));
      }

      if (url.includes('/rest/v1/wallet_guardian_actions') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.guardianActions ?? []));
      }
      if (url.includes('/rest/v1/wallet_ledger') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.ledgerRows ?? [{ bucket: 'save', amount: 5, created_at: new Date().toISOString() }]));
      }

      if (url.includes('/rest/v1/pending_credits?id=eq.') && method === 'GET') {
        const rows = opts.pendingCredit === null ? [] : [opts.pendingCredit ?? defaultPendingCredit()];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/pending_credits?kid_user_id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [defaultPendingCredit()]));
      }
      if (url.includes('/rest/v1/rpc/allocate_pending_credit') && method === 'POST') {
        return opts.allocateResult === undefined
          ? Promise.resolve(jsonResponse(200, true))
          : Promise.resolve(jsonResponse(200, opts.allocateResult));
      }

      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
}

function asParent(path: string, sub = PARENT_ID) {
  return request(createApp()).get(path).set('Authorization', `Bearer ${mintToken({ sub })}`);
}
function asKid(path: string, sub = KID_ID) {
  return request(createApp()).get(path).set('Authorization', `Bearer ${mintToken({ sub })}`);
}
function postAsParent(path: string, body: unknown, sub = PARENT_ID) {
  return request(createApp()).post(path).set('Authorization', `Bearer ${mintToken({ sub })}`).send(body as object);
}
function putAsParent(path: string, body: unknown, sub = PARENT_ID) {
  return request(createApp()).put(path).set('Authorization', `Bearer ${mintToken({ sub })}`).send(body as object);
}
function patchAsParent(path: string, body: unknown, sub = PARENT_ID) {
  return request(createApp()).patch(path).set('Authorization', `Bearer ${mintToken({ sub })}`).send(body as object);
}
function postAsKid(path: string, body: unknown, sub = KID_ID) {
  return request(createApp()).post(path).set('Authorization', `Bearer ${mintToken({ sub })}`).send(body as object);
}

describe('computeNextRunAt', () => {
  it('lands on the next matching weekday, same day if it already matches', () => {
    // 2026-09-08 is a Tuesday (day 2).
    const tuesday = new Date('2026-09-08T12:00:00Z');
    expect(computeNextRunAt('weekly', 2, tuesday).toISOString().slice(0, 10)).toBe('2026-09-08');
    expect(computeNextRunAt('weekly', 5, tuesday).toISOString().slice(0, 10)).toBe('2026-09-11'); // next Friday
  });

  it('monthly rolls to next month once the anchor day has passed', () => {
    const sept20 = new Date('2026-09-20T12:00:00Z');
    expect(computeNextRunAt('monthly', 5, sept20).toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(computeNextRunAt('monthly', 25, sept20).toISOString().slice(0, 10)).toBe('2026-09-25');
  });
});

describe('POST /api/v1/banking/accounts/:kidId (parent opens)', () => {
  it('401s without a session', async () => {
    stub();
    const res = await request(createApp()).post(`/api/v1/banking/accounts/${KID_ID}`).send({});
    expect(res.status).toBe(401);
  });

  it('404s for a kid the caller does not guard', async () => {
    stub({ parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent(`/api/v1/banking/accounts/${KID_ID}`, {});
    expect(res.status).toBe(404);
  });

  it('409s if the account is already open', async () => {
    stub({ account: defaultAccount() });
    const res = await postAsParent(`/api/v1/banking/accounts/${KID_ID}`, {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('opens the account and returns it', async () => {
    stub({ account: null });
    const res = await postAsParent(`/api/v1/banking/accounts/${KID_ID}`, { nickname: 'Rocket Fund', cardDesign: 'emerald' });
    expect(res.status).toBe(201);
    expect(res.body.data.account.nickname).toBe('Rocket Fund');
    // D.7: no card-shaped number is minted, stored or served.
    expect(res.body.data.account).not.toHaveProperty('displayNumber');
    const insert = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url).includes('/rest/v1/banking_accounts') && init?.method === 'POST');
    expect(JSON.parse(String(insert?.[1]?.body))).toEqual({ kid_user_id: KID_ID, nickname: 'Rocket Fund', card_design: 'emerald', opened_by: PARENT_ID });
  });

  it('rejects an unknown card design', async () => {
    stub({ account: null });
    const res = await postAsParent(`/api/v1/banking/accounts/${KID_ID}`, { cardDesign: 'gold' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/banking/accounts/:kidId (parent) and /account (kid)', () => {
  it('returns null when no account exists yet, not an error', async () => {
    stub({ account: null });
    const res = await asParent(`/api/v1/banking/accounts/${KID_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.account).toBeNull();
  });

  it('a kid reads their own account', async () => {
    stub({ account: defaultAccount(), roles: ['kid'] });
    const res = await asKid('/api/v1/banking/account');
    expect(res.status).toBe(200);
    expect(res.body.data.account.nickname).toBe('Rocket Fund');
  });

  it('never serves a card-shaped number, even from a row stored before the column was dropped (D.7)', async () => {
    const legacy = { ...defaultAccount(), display_number: 'LF-1234-5678' };
    stub({ account: legacy });
    const parent = await asParent(`/api/v1/banking/accounts/${KID_ID}`);
    expect(parent.status).toBe(200);
    expect(JSON.stringify(parent.body)).not.toMatch(/displayNumber|display_number|LF-1234-5678/);
    stub({ account: legacy, roles: ['kid'] });
    const kid = await asKid('/api/v1/banking/account');
    expect(kid.status).toBe(200);
    expect(JSON.stringify(kid.body)).not.toMatch(/displayNumber|display_number|LF-1234-5678/);
    // Nor is the column read: the select list no longer names it.
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/rest/v1/banking_accounts') && String(url).includes('display_number'))).toBe(false);
  });

  it('runs the scheduled-credits catch-up before reading (best-effort, never fails the request)', async () => {
    stub({ account: defaultAccount(), scheduledCreditsResult: null, roles: ['kid'] });
    const res = await asKid('/api/v1/banking/account');
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/banking/accounts/:kidId (parent edits nickname/design)', () => {
  it('404s a kid the caller does not guard', async () => {
    stub({ account: defaultAccount(), parentsKids: [OTHER_KID_ID] });
    const res = await patchAsParent(`/api/v1/banking/accounts/${KID_ID}`, { nickname: 'New Bike Fund' });
    expect(res.status).toBe(404);
  });

  it('a guardian can rename and re-color the card', async () => {
    stub({ account: defaultAccount() });
    const res = await patchAsParent(`/api/v1/banking/accounts/${KID_ID}`, { nickname: 'New Bike Fund', cardDesign: 'ocean' });
    expect(res.status).toBe(200);
    expect(res.body.data.account.nickname).toBe('New Bike Fund');
    expect(res.body.data.account.cardDesign).toBe('ocean');
  });

  it('404s when there is no account to update yet', async () => {
    stub({ account: null });
    const res = await patchAsParent(`/api/v1/banking/accounts/${KID_ID}`, { nickname: 'New Bike Fund' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/banking/account (kid edits nickname/design)', () => {
  it('a kid can rename their own card', async () => {
    stub({ account: defaultAccount(), roles: ['kid'] });
    const res = await request(createApp())
      .patch('/api/v1/banking/account')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .send({ nickname: 'New Bike Fund' });
    expect(res.status).toBe(200);
    expect(res.body.data.account.nickname).toBe('New Bike Fund');
  });
});

describe('POST /api/v1/banking/accounts/:kidId/freeze and /account/freeze', () => {
  it('a parent can freeze', async () => {
    stub({ account: defaultAccount() });
    const res = await postAsParent(`/api/v1/banking/accounts/${KID_ID}/freeze`, { frozen: true });
    expect(res.status).toBe(200);
    expect(res.body.data.account.frozen).toBe(true);
  });

  it('a kid can freeze their own card', async () => {
    stub({ account: defaultAccount(), roles: ['kid'] });
    const res = await postAsKid('/api/v1/banking/account/freeze', { frozen: true });
    expect(res.status).toBe(200);
  });

  it('rejects a non-boolean frozen value', async () => {
    stub({ account: defaultAccount() });
    const res = await postAsParent(`/api/v1/banking/accounts/${KID_ID}/freeze`, { frozen: 'yes' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/banking/allowance/:kidId', () => {
  it('409s if the account is not open yet', async () => {
    stub({ account: null });
    const res = await putAsParent(`/api/v1/banking/allowance/${KID_ID}`, { amount: 10, frequency: 'weekly', anchorDay: 5 });
    expect(res.status).toBe(409);
  });

  it('rejects anchorDay 0-6 violated for weekly', async () => {
    stub({ account: defaultAccount() });
    const res = await putAsParent(`/api/v1/banking/allowance/${KID_ID}`, { amount: 10, frequency: 'weekly', anchorDay: 12 });
    expect(res.status).toBe(400);
  });

  it('rejects anchorDay 0 for monthly', async () => {
    stub({ account: defaultAccount() });
    const res = await putAsParent(`/api/v1/banking/allowance/${KID_ID}`, { amount: 10, frequency: 'monthly', anchorDay: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects an amount over the ceiling', async () => {
    stub({ account: defaultAccount() });
    const res = await putAsParent(`/api/v1/banking/allowance/${KID_ID}`, { amount: 5000, frequency: 'weekly', anchorDay: 5 });
    expect(res.status).toBe(400);
  });

  it('saves a valid rule', async () => {
    stub({ account: defaultAccount() });
    const res = await putAsParent(`/api/v1/banking/allowance/${KID_ID}`, { amount: 10, frequency: 'weekly', anchorDay: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.rule.amount).toBe(10);
    expect(res.body.data.rule.frequency).toBe('weekly');
  });
});

describe('GET /api/v1/banking/allowance/:kidId', () => {
  it('returns null when unconfigured', async () => {
    stub({ allowanceRule: null });
    const res = await asParent(`/api/v1/banking/allowance/${KID_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rule).toBeNull();
  });
});

describe('PUT /api/v1/banking/savings-bonus/:kidId', () => {
  it('rejects a rate over the 20% ceiling', async () => {
    stub({ account: defaultAccount() });
    const res = await putAsParent(`/api/v1/banking/savings-bonus/${KID_ID}`, { rateBp: 3000 });
    expect(res.status).toBe(400);
  });

  it('saves a valid rate', async () => {
    stub({ account: defaultAccount() });
    const res = await putAsParent(`/api/v1/banking/savings-bonus/${KID_ID}`, { rateBp: 500 });
    expect(res.status).toBe(200);
    expect(res.body.data.rule.rateBp).toBe(500);
  });
});

describe('PUT /api/v1/banking/spend-limit/:kidId', () => {
  it('saves a valid limit and reports usage', async () => {
    stub({ account: defaultAccount(), ledgerRows: [{ bucket: 'spend', amount: -15, created_at: new Date().toISOString() }] });
    const res = await putAsParent(`/api/v1/banking/spend-limit/${KID_ID}`, { period: 'weekly', cap: 60 });
    expect(res.status).toBe(200);
    expect(res.body.data.status.configured).toBe(true);
    expect(res.body.data.status.cap).toBe(60);
  });
});

describe('GET /api/v1/banking/spend-limit/:kidId and /spend-limit (kid)', () => {
  it('reports unconfigured when no limit is set', async () => {
    stub({ spendLimit: null });
    const res = await asParent(`/api/v1/banking/spend-limit/${KID_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toEqual({ configured: false });
  });

  it('computes remaining from actual spend redemptions', async () => {
    stub({
      roles: ['kid'],
      spendLimit: { kid_user_id: KID_ID, parent_user_id: PARENT_ID, period: 'weekly', cap: 60, active: true, created_at: new Date().toISOString() },
      ledgerRows: [
        { bucket: 'spend', amount: -20, created_at: new Date().toISOString() },
        { bucket: 'spend', amount: -10, created_at: new Date().toISOString() },
      ],
    });
    const res = await asKid('/api/v1/banking/spend-limit');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toEqual({ configured: true, period: 'weekly', cap: 60, used: 30, remaining: 30 });
  });
});

describe('GET/POST pending credits (kid)', () => {
  it('lists unallocated credits', async () => {
    stub({ roles: ['kid'] });
    const res = await asKid('/api/v1/banking/wallet/pending-credits');
    expect(res.status).toBe(200);
    expect(res.body.data.credits).toHaveLength(1);
    expect(res.body.data.credits[0].source).toBe('allowance');
  });

  it('rejects a split that does not sum to the credit amount', async () => {
    stub({ allocateResult: false, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/banking/wallet/pending-credits/${CREDIT_ID}/allocate`, { save: 3, spend: 3, share: 3 });
    expect(res.status).toBe(409);
  });

  it('rejects an all-zero split before even calling the RPC', async () => {
    stub({ roles: ['kid'] });
    const res = await postAsKid(`/api/v1/banking/wallet/pending-credits/${CREDIT_ID}/allocate`, { save: 0, spend: 0, share: 0 });
    expect(res.status).toBe(400);
  });

  it('404s for a credit belonging to another kid', async () => {
    stub({ pendingCredit: { ...defaultPendingCredit(), kid_user_id: OTHER_KID_ID }, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/banking/wallet/pending-credits/${CREDIT_ID}/allocate`, { save: 10, spend: 0, share: 0 });
    expect(res.status).toBe(404);
  });

  it('allocates a valid split', async () => {
    stub({ roles: ['kid'] });
    const res = await postAsKid(`/api/v1/banking/wallet/pending-credits/${CREDIT_ID}/allocate`, { save: 5, spend: 3, share: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.allocated).toBe(true);
  });
});

describe('GET /api/v1/banking/statement/:kidId and /statement (kid)', () => {
  it('rejects a malformed month', async () => {
    stub();
    const res = await asParent(`/api/v1/banking/statement/${KID_ID}?month=september`);
    expect(res.status).toBe(400);
  });

  it('aggregates earned/spent/saved from the ledger', async () => {
    stub({
      roles: ['kid'],
      ledgerRows: [
        { bucket: 'save', amount: 10, created_at: new Date().toISOString() },
        { bucket: 'spend', amount: 5, created_at: new Date().toISOString() },
        { bucket: 'spend', amount: -8, created_at: new Date().toISOString() },
      ],
    });
    const res = await asKid('/api/v1/banking/statement?month=2026-09');
    expect(res.status).toBe(200);
    expect(res.body.data.statement).toEqual({
      month: '2026-09',
      earned: 15,
      spent: 8,
      adjusted: 0,
      given: 0,
      saved: 10,
      entries: expect.any(Array),
    });
  });

  it('never counts a goal withdrawal as income or spending, and reports a guardian correction on its own line with its reason', async () => {
    const action = '99999999-9999-4999-8999-999999999999';
    const now = new Date().toISOString();
    stub({
      roles: ['kid'],
      ledgerRows: [
        { bucket: 'save', amount: 10, created_at: now, reason: 'task_approved' },
        { bucket: 'save', amount: -4, created_at: now, reason: 'goal_withdrawal', guardian_action_id: action },
        { bucket: 'spend', amount: 4, created_at: now, reason: 'goal_withdrawal', guardian_action_id: action },
        { bucket: 'spend', amount: -3, created_at: now, reason: 'manual_adjustment', guardian_action_id: '88888888-8888-4888-8888-888888888888' },
      ],
      guardianActions: [
        { id: action, kind: 'goal_withdrawal', kid_user_id: KID_ID, actor_user_id: null, bucket: 'spend', goal_id: null, amount: 4, reason: 'Bought the bike', created_at: now },
        { id: '88888888-8888-4888-8888-888888888888', kind: 'manual_adjustment', kid_user_id: KID_ID, actor_user_id: null, bucket: 'spend', goal_id: null, amount: -3, reason: 'Lost game fee', created_at: now },
      ],
    });
    const res = await asKid('/api/v1/banking/statement?month=2026-09');
    expect(res.status).toBe(200);
    expect(res.body.data.statement).toMatchObject({ earned: 10, spent: 0, adjusted: -3, saved: 6 });
    expect(res.body.data.statement.entries.map((e: { note: string | null }) => e.note)).toEqual([null, 'Bought the bike', 'Bought the bike', 'Lost game fee']);
  });

  // GAP-FIX-R6 (OD-3 §2, Law 5): the Tutor reads a child's month on the Wallet screen, a linked teen's own entries included.
  const monthOf = (by: number) => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  it("gives the verified Tutor the child's month in full detail, self-directed entries included", async () => {
    const now = new Date().toISOString();
    stub({
      ledgerRows: [
        { bucket: 'spend', amount: 12, created_at: now, reason: 'self_income' },
        { bucket: 'spend', amount: -4, created_at: now, reason: 'personal_reward' },
        { bucket: 'save', amount: -3, created_at: now, reason: 'goal_release' },
        { bucket: 'spend', amount: 3, created_at: now, reason: 'goal_release' },
      ],
    });
    const res = await asParent(`/api/v1/banking/statement/${KID_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.statement).toMatchObject({ month: monthOf(0), earned: 12, spent: 4, adjusted: 0, given: 0, saved: -3 });
    expect(res.body.data.statement.entries.map((e: { reason: string }) => e.reason)).toEqual(['self_income', 'personal_reward', 'goal_release', 'goal_release']);
  });

  it.each([[0], [-1], [-23]])('admits a month %i months from this one', async (by) => {
    stub();
    const res = await asParent(`/api/v1/banking/statement/${KID_ID}?month=${monthOf(by)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.statement.month).toBe(monthOf(by));
  });

  it.each([['next month', monthOf(1)], ['past the paging window', monthOf(-24)], ['no such month', '2026-13'], ['month zero', '2026-00']])(
    'refuses %s before reading anything', async (_label, month) => {
      stub();
      expect((await asParent(`/api/v1/banking/statement/${KID_ID}?month=${month}`)).status).toBe(400);
    });

  it('refuses another family, a child and an extra query parameter', async () => {
    stub({ parentsKids: [OTHER_KID_ID] });
    expect((await asParent(`/api/v1/banking/statement/${KID_ID}`)).status).toBe(404);
    stub({ roles: ['kid'] });
    expect((await asKid(`/api/v1/banking/statement/${KID_ID}`)).status).toBe(403);
    stub();
    expect((await asParent(`/api/v1/banking/statement/${KID_ID}?month=${monthOf(0)}&kid=${OTHER_KID_ID}`)).status).toBe(400);
  });

  it('refuses a statement whose guardian reasons cannot be read', async () => {
    stub({
      roles: ['kid'],
      ledgerRows: [{ bucket: 'spend', amount: 5, created_at: new Date().toISOString(), reason: 'manual_adjustment', guardian_action_id: '88888888-8888-4888-8888-888888888888' }],
      guardianActions: [{ broken: true }],
    });
    expect((await asKid('/api/v1/banking/statement?month=2026-09')).status).toBe(502);
  });
});


describe('D.1 guardian freeze ownership', () => {
  it.each([true, false])('refuses a child overwriting a guardian freeze with %s', async frozen => {
    stub({ roles: ['kid'], account: { ...defaultAccount(), frozen: true, frozen_by: PARENT_ID } });
    const response = await request(createApp()).post('/api/v1/banking/account/freeze')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`).send({ frozen });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('GUARDIAN_FREEZE');
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
  it('allows the child to undo their own freeze with an atomic ownership filter', async () => {
    stub({ roles: ['kid'], account: { ...defaultAccount(), frozen: true, frozen_by: KID_ID } });
    const response = await request(createApp()).post('/api/v1/banking/account/freeze')
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`).send({ frozen: false });
    expect(response.status).toBe(200);
    const patch = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(String(patch?.[0])).toContain(`or=(frozen.eq.false,frozen_by.eq.${KID_ID})`);
  });
});

it('D.1 rejects a child update losing the atomic ownership race and writes no audit success', async () => {
  stub({ roles: ['kid'], account: defaultAccount(), accountPatchRejected: true });
  const response = await request(createApp()).post('/api/v1/banking/account/freeze')
    .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`).send({ frozen: false });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('FREEZE_CHANGED');
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/audit_logs'))).toBe(false);
});


it('D.1 holds pending allowance allocation without calling its mutation', async () => {
  stub({ roles: ['kid'], account: { ...defaultAccount(), frozen: true, frozen_by: PARENT_ID } });
  const response = await postAsKid(`/api/v1/banking/wallet/pending-credits/${CREDIT_ID}/allocate`, { save: 10, spend: 0, share: 0 });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('ACCOUNT_FROZEN');
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/rpc/allocate_pending_credit'))).toBe(false);
});
it('D.1 does not advance scheduled allowances while the account is frozen', async () => {
  stub({ roles: ['kid'], account: { ...defaultAccount(), frozen: true, frozen_by: PARENT_ID } });
  const response = await request(createApp()).get('/api/v1/banking/account')
    .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
  expect(response.status).toBe(200);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/rpc/run_due_scheduled_credits'))).toBe(false);
});
