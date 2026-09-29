import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { admissionStubResponse, jsonResponse, mintToken } from './helpers.js';

/*
 * /api/v1/tasks — FAMILY_HUB.md's earn/allocate/goal/redeem loop.
 *
 * Unlike /api/v1/family (entirely `requireRole(['parent'])`), this router is
 * reachable by BOTH roles, each scoped to their own rows. The invariant under
 * test throughout is the one that matters most for a kid-facing money
 * surface: a caller can never reach another family's task, wallet or
 * redemption — proven here as a 404 (not a 403), matching family.ts's own
 * "an outsider learns nothing about whether it exists" posture.
 */

const PARENT_ID = randomUUID();
const KID_ID = randomUUID();
const OTHER_KID_ID = randomUUID();
const TASK_ID = randomUUID();
const GOAL_ID = randomUUID();
const CATALOG_ID = randomUUID();
const REDEMPTION_ID = randomUUID();

// A real (if tiny) JPEG signature — sniffImageMime reads only the first
// bytes, so this is enough to pass the magic-byte check without a full,
// decodable image.
const REAL_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);

afterEach(() => vi.unstubAllGlobals());

interface StubOptions {
  bankingFrozen?: boolean | null;
  roles?: string[];
  /** kid ids this parent has a VERIFIED guardian_links row for. */
  parentsKids?: string[];
  /** parent ids this kid has a VERIFIED guardian_links row with. */
  kidsParents?: string[];
  task?: Record<string, unknown> | null;
  taskPatchSucceeds?: boolean;
  allocateResult?: boolean | null;
  decideResult?: boolean | null;
  ledgerRows?: { bucket: string; amount: number }[];
  goal?: Record<string, unknown> | null;
  catalogItem?: Record<string, unknown> | null;
  redemption?: Record<string, unknown> | null;
  writes?: { url: string; method: string; body: unknown }[];
  /** filebase upload — omit for a working default, false to simulate a Depot failure. */
  filebaseUploadOk?: boolean;
  /** filebase byte fetch (GET /:id/evidence) — omit for a working default, false for a failure. */
  filebaseDownloadOk?: boolean;
  /** evidenceStillReferencedElsewhere's answer — omit for "not referenced" (the common case), true to simulate a content-addressed hash collision with another task's evidence. */
  evidenceStillReferenced?: boolean;
  /** captures every DELETE sent to filebase's /api/v1/files/:bucket/:file, so a test can assert cleanup happened (or didn't). */
  deleteCalls?: string[];
  /** S07.3 (D.2): the kid's recorded practised days (chore_streak_days) — omit for none. */
  streakDays?: string[];
  /** the legacy best streak (kid_task_streaks.longest_streak_days) — omit for none. */
  legacyBest?: number;
  /** false simulates an unreadable streak history. */
  streakReadable?: boolean;
  /** the kid's spend_limits row (BANKING.md §5.5) — omit for "no limit configured". */
  spendLimit?: Record<string, unknown> | null;
  /** wallet_ledger rows spend_limit checking sums over — omit for "nothing spent yet". */
  spendLedgerRows?: { bucket: string; amount: number }[];
  /** S07.5: a named database refusal an RPC answers with (P0001), by RPC name. */
  refusals?: Record<string, string>;
  /** S07.5 (D.17): whether the child's level self-logs a chore marked done. */
  selfLogs?: boolean;
  /** S07.5 (D.17): whether the child's level pre-approves a reward request. */
  preapproves?: boolean;
}

function stub(opts: StubOptions = {}) {
  // S07.5: the task and redemption as the database leaves them after an RPC,
  // so a route's re-read returns what the flow produced.
  let task: Record<string, unknown> | null = opts.task === null ? null : { ...(opts.task ?? defaultTask()) };
  let redemption: Record<string, unknown> | null = opts.redemption === null ? null : { ...(opts.redemption ?? defaultRedemption()) };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const admission = admissionStubResponse(url);
      if (admission) return Promise.resolve(admission);
      const method = init?.method ?? 'GET';
      if (opts.writes && init?.body) {
        opts.writes.push({ url, method, body: JSON.parse(String(init.body)) as unknown });
      }
      const rpcName = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
      if (rpcName && opts.refusals?.[rpcName]) {
        return Promise.resolve(jsonResponse(400, { code: 'P0001', message: opts.refusals[rpcName], details: null, hint: null }));
      }
      const rpcBody = rpcName && init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (rpcName === 'family_task_mark_done') {
        const self = opts.selfLogs === true;
        task = task && { ...task, status: self ? 'approved' : 'done', completed_on: rpcBody.p_completed_on, child_note: rpcBody.p_note };
        return Promise.resolve(jsonResponse(200, { status: self ? 'approved' : 'done', self_logged: self }));
      }
      if (rpcName === 'family_task_self_log') {
        if (opts.selfLogs === true && task) task = { ...task, status: 'approved' };
        return Promise.resolve(jsonResponse(200, opts.selfLogs === true));
      }
      if (rpcName === 'family_decide_task') {
        const outcome = rpcBody.p_outcome as string;
        const status = outcome === 'approved' ? 'approved' : outcome === 'sent_back' ? 'open' : 'cancelled';
        task = task && { ...task, status, cancel_reason: outcome === 'cancelled' ? rpcBody.p_reason : task.cancel_reason, decided_by: outcome === 'sent_back' ? null : rpcBody.p_actor };
        return Promise.resolve(jsonResponse(200, status));
      }
      if (rpcName === 'family_decide_redemption') {
        const status = rpcBody.p_approve ? 'approved' : 'denied';
        redemption = redemption && { ...redemption, status };
        return Promise.resolve(jsonResponse(200, status));
      }
      if (rpcName === 'family_request_redemption') {
        const pre = opts.preapproves === true;
        redemption = { ...defaultRedemption(), status: pre ? 'approved' : 'requested', child_reason_kind: rpcBody.p_reason_kind, child_note: rpcBody.p_note };
        return Promise.resolve(jsonResponse(200, { id: REDEMPTION_ID, status: pre ? 'approved' : 'requested', preapproved: pre }));
      }

      if (url.includes('/rest/v1/banking_accounts?') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.bankingFrozen === null ? null : opts.bankingFrozen === undefined ? [] : [{ frozen: opts.bankingFrozen }]));
      }
      if (url.includes('/rest/v1/user_roles?user_id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, (opts.roles ?? ['parent']).map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/audit_logs') && method === 'POST') {
        return Promise.resolve(new Response(null, { status: 201 }));
      }

      if (url.includes('/api/v1/files') && method === 'POST') {
        if (opts.filebaseUploadOk === false) return Promise.resolve(new Response(null, { status: 500 }));
        return Promise.resolve(
          jsonResponse(200, { data: { id: 'task-evidence/aa11bb22.jpg', url: '/files/task-evidence/aa11bb22.jpg', bucket: 'task-evidence' } }),
        );
      }
      if (url.includes('/files/') && !url.includes('/rest/v1/') && method === 'GET') {
        if (opts.filebaseDownloadOk === false) return Promise.resolve(new Response(null, { status: 404 }));
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }));
      }
      if (url.includes('/api/v1/files/') && method === 'DELETE') {
        opts.deleteCalls?.push(url);
        return Promise.resolve(jsonResponse(200, { deleted: true, id: 'task-evidence/aa11bb22.jpg' }));
      }
      if (url.includes('/rest/v1/tasks?id=neq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.evidenceStillReferenced ? [{ id: OTHER_KID_ID }] : []));
      }
      if (url.includes('/rest/v1/chore_streak_days?') && method === 'GET') {
        if (opts.streakReadable === false) return Promise.resolve(new Response(null, { status: 500 }));
        const rows = url.includes('offset=0') ? (opts.streakDays ?? []).map((local_date) => ({ kid_user_id: KID_ID, local_date, completions: 1, legacy: false })) : [];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/chore_streak_pauses?') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/kid_task_streaks?') && method === 'GET') {
        const rows = opts.legacyBest === undefined || !url.includes('offset=0') ? [] : [{ kid_user_id: KID_ID, longest_streak_days: opts.legacyBest }];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/kid_task_streaks')) {
        throw new Error('S07.3: Core must never write kid_task_streaks again');
      }

      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.') && method === 'GET') {
        const rows = (opts.parentsKids ?? [KID_ID]).map((kid_user_id) => ({
          parent_user_id: PARENT_ID,
          kid_user_id,
          verification_status: 'verified',
        }));
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/guardian_links?kid_user_id=eq.') && method === 'GET') {
        const rows = (opts.kidsParents ?? [PARENT_ID]).map((parent_user_id) => ({ parent_user_id }));
        return Promise.resolve(jsonResponse(200, rows));
      }

      if (url.includes('/rest/v1/rpc/allocate_task_reward') && method === 'POST') {
        return opts.allocateResult === undefined
          ? Promise.resolve(jsonResponse(200, true))
          : Promise.resolve(jsonResponse(200, opts.allocateResult));
      }
      // S07.4 (D.16): a goal's progress by provenance. The stub reports the
      // ledger total as the child's own coins, as the real function does for
      // chore rewards.
      if (url.includes('/rest/v1/rpc/goal_progress_breakdown') && method === 'POST') {
        const ids = (JSON.parse(String(init?.body)) as { p_goal_ids: string[] }).p_goal_ids;
        const total = (opts.ledgerRows ?? [{ bucket: 'save', amount: 3 }, { bucket: 'spend', amount: 5 }]).reduce((sum, r) => sum + r.amount, 0);
        return Promise.resolve(jsonResponse(200, ids.map((goal_id) => ({ goal_id, own: total, bonus: 0, family: 0, total }))));
      }
      if (url.includes('/rest/v1/goal_next_steps?') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/rpc/decide_redemption') && method === 'POST') {
        return opts.decideResult === undefined
          ? Promise.resolve(jsonResponse(200, true))
          : Promise.resolve(jsonResponse(200, opts.decideResult));
      }

      if (url.includes('/rest/v1/tasks') && method === 'POST') {
        return Promise.resolve(
          jsonResponse(201, [{ id: TASK_ID, assigned_to: KID_ID, assigned_by: PARENT_ID, status: 'open', reward_coins: 10, allocated: false, recurrence: 'once', due_at: null, title: 'Clean the room', created_at: new Date().toISOString() }]),
        );
      }
      if (url.includes('/rest/v1/tasks?id=eq.') && method === 'PATCH' && !url.includes('status=eq')) {
        // setTaskEvidence's PATCH — CAS on status=in.(open,done), not status=eq.<x>,
        // so this branch (matched by the ABSENCE of "status=eq") still isolates it
        // from transitionTaskStatus's PATCH below. opts.taskPatchSucceeds === false
        // simulates the CAS losing the race (status changed since guardOwnTask read it).
        if (opts.taskPatchSucceeds === false) return Promise.resolve(jsonResponse(200, []));
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return Promise.resolve(jsonResponse(200, [{ ...(opts.task ?? defaultTask()), ...body }]));
      }
      if (url.includes('/rest/v1/tasks?id=eq.') && method === 'PATCH') {
        // transitionTaskStatus always sends the target status IN THE BODY
        // ({ status: toStatus, ...extra }) — reading it from there (rather
        // than re-deriving it from the `status=eq.<from>` filter, which
        // cannot distinguish open->done from open->cancelled) is what the
        // real PATCH actually does.
        if (opts.taskPatchSucceeds === false) return Promise.resolve(jsonResponse(200, []));
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return Promise.resolve(jsonResponse(200, [{ ...(opts.task ?? defaultTask()), ...body }]));
      }
      if (url.includes('/rest/v1/tasks?id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, task === null ? [] : [task]));
      }
      if (url.includes('/rest/v1/tasks?assigned_to') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.task === null ? [] : [opts.task ?? defaultTask()]));
      }

      if (url.includes('/rest/v1/spend_limits?kid_user_id=eq.') && method === 'GET') {
        const rows = opts.spendLimit === null ? [] : [opts.spendLimit ?? null].filter(Boolean);
        return Promise.resolve(jsonResponse(200, rows));
      }
      // Spend-limit's own usage query (created_at=gte.) is a DIFFERENT shape
      // than the balances query below — must be matched first, or it falls
      // through to the balances default and always reads "nothing spent".
      if (url.includes('/rest/v1/wallet_ledger') && url.includes('created_at=gte.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.spendLedgerRows ?? []));
      }
      if (url.includes('/rest/v1/wallet_ledger') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.ledgerRows ?? [{ bucket: 'save', amount: 3 }, { bucket: 'spend', amount: 5 }]));
      }

      if (url.includes('/rest/v1/savings_goals') && method === 'POST') {
        return Promise.resolve(jsonResponse(201, [{ id: GOAL_ID, kid_user_id: KID_ID, title: 'A bike', target: 50, icon: 'bike', status: 'active', created_at: new Date().toISOString(), reached_at: null }]));
      }
      if (url.includes('/rest/v1/savings_goals?id=eq.') && method === 'GET') {
        const rows = opts.goal === null ? [] : [opts.goal ?? defaultGoal()];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/savings_goals?id=eq.') && method === 'PATCH') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/rest/v1/savings_goals?kid_user_id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [defaultGoal()]));
      }

      if (url.includes('/rest/v1/redemption_catalog') && method === 'POST') {
        return Promise.resolve(jsonResponse(201, [{ id: CATALOG_ID, parent_user_id: PARENT_ID, title: 'Extra tablet time', cost: 5, active: true, created_at: new Date().toISOString() }]));
      }
      if (url.includes('/rest/v1/redemption_catalog?id=eq.') && method === 'GET') {
        const rows = opts.catalogItem === null ? [] : [opts.catalogItem ?? defaultCatalogItem()];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/redemption_catalog?id=eq.') && method === 'PATCH') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/rest/v1/redemption_catalog?parent_user_id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [defaultCatalogItem()]));
      }
      if (url.includes('/rest/v1/redemption_catalog?parent_user_id=') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [defaultCatalogItem()]));
      }

      if (url.includes('/rest/v1/redemptions') && method === 'POST') {
        return Promise.resolve(jsonResponse(201, [{ id: REDEMPTION_ID, catalog_id: CATALOG_ID, kid_user_id: KID_ID, status: 'requested', created_at: new Date().toISOString(), decided_at: null, decided_by: null }]));
      }
      if (url.includes('/rest/v1/redemptions?id=eq.') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, redemption === null ? [] : [redemption]));
      }
      if (url.includes('/rest/v1/redemptions?kid_user_id') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, [defaultRedemption()]));
      }

      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
}

function defaultTask(): Record<string, unknown> {
  return {
    id: TASK_ID,
    assigned_to: KID_ID,
    assigned_by: PARENT_ID,
    status: 'open',
    reward_coins: 10,
    allocated: false,
    recurrence: 'once',
    due_at: null,
    title: 'Clean the room',
    created_at: new Date().toISOString(),
    evidence_bucket: null,
    evidence_hash: null,
    evidence_ext: null,
    evidence_uploaded_at: null,
    cancel_reason: null,
    requires_evidence: false,
    kind: 'bonus',
    completed_on: null,
  };
}
function defaultGoal(): Record<string, unknown> {
  return { id: GOAL_ID, kid_user_id: KID_ID, title: 'A bike', target: 50, icon: 'bike', status: 'active', created_at: new Date().toISOString(), reached_at: null };
}
function defaultCatalogItem(): Record<string, unknown> {
  return { id: CATALOG_ID, parent_user_id: PARENT_ID, title: 'Extra tablet time', cost: 5, active: true, created_at: new Date().toISOString() };
}
function defaultRedemption(): Record<string, unknown> {
  return { id: REDEMPTION_ID, catalog_id: CATALOG_ID, kid_user_id: KID_ID, status: 'requested', created_at: new Date().toISOString(), decided_at: null, decided_by: null };
}

function asParent(path: string, sub = PARENT_ID) {
  return request(createApp()).get(path).set('Authorization', `Bearer ${mintToken({ sub })}`);
}
function postAsKid(path: string, body: unknown, sub = KID_ID) {
  return request(createApp()).post(path).set('Authorization', `Bearer ${mintToken({ sub })}`).send(body as object);
}
function postAsParent(path: string, body: unknown, sub = PARENT_ID) {
  return request(createApp()).post(path).set('Authorization', `Bearer ${mintToken({ sub })}`).send(body as object);
}

describe('POST /api/v1/tasks (parent creates)', () => {
  it('401s without a session', async () => {
    stub();
    const res = await request(createApp()).post('/api/v1/tasks').send({ assignedTo: KID_ID, title: 'x', rewardCoins: 5 });
    expect(res.status).toBe(401);
  });

  it("403s a kid session — creating a task is parent-only", async () => {
    stub({ roles: ['kid'] });
    const res = await postAsKid('/api/v1/tasks', { assignedTo: KID_ID, title: 'x', rewardCoins: 5 });
    expect(res.status).toBe(403);
  });

  it('404s assigning a task to a child that is not verified under this parent', async () => {
    stub({ parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent('/api/v1/tasks', { assignedTo: KID_ID, title: 'x', rewardCoins: 5 });
    expect(res.status).toBe(404);
  });

  it('rejects a reward above the per-task ceiling', async () => {
    stub({ parentsKids: [KID_ID] });
    const res = await postAsParent('/api/v1/tasks', { assignedTo: KID_ID, title: 'x', rewardCoins: 5000 });
    expect(res.status).toBe(400);
  });

  it('creates the task and audits it', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ parentsKids: [KID_ID], writes });
    const res = await postAsParent('/api/v1/tasks', { assignedTo: KID_ID, title: 'Clean the room', rewardCoins: 10 });
    expect(res.status).toBe(201);
    // Wire shape is camelCase like every other endpoint (routes/family.ts) —
    // the raw DB row (assigned_to/reward_coins) must never leak onto the wire.
    expect(res.body.data.task).toMatchObject({ id: TASK_ID, status: 'open', assignedTo: KID_ID, rewardCoins: 10 });
    expect(res.body.data.task.assigned_to).toBeUndefined();
    expect(res.body.data.task.reward_coins).toBeUndefined();
    expect(writes.some((w) => w.url.includes('/audit_logs'))).toBe(true);
  });
});

describe('POST /api/v1/tasks/:id/complete (kid)', () => {
  it("404s a task that is not this kid's own — no leak of another family's task", async () => {
    stub({ task: { ...defaultTask(), assigned_to: OTHER_KID_ID }, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, {});
    expect(res.status).toBe(404);
  });

  it('409s a task that is not open (already done/approved): the database flow refuses it', async () => {
    stub({ task: defaultTask(), refusals: { family_task_mark_done: 'TASK_NOT_OPEN' }, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TASK_NOT_OPEN');
  });

  it('marks an open task done', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('done');
  });

  it('rejects a malformed localDate', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: '09/08/2026' });
    expect(res.status).toBe(400);
  });

  // S07.3 (D.2): Core never writes a streak. It sends the child's local day
  // (bounded to the server day +/- 1) as completed_on; the database records
  // the practised day from the task. The response carries the lapse-tolerant
  // streak and, only on the day's first chore that reaches 7/30/100, the milestone.
  const today = () => new Date().toISOString().slice(0, 10);
  const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  it('sends the local day as completed_on and never writes kid_task_streaks', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ task: defaultTask(), roles: ['kid'], writes });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: today() });
    expect(res.status).toBe(200);
    // S07.5: one database flow marks it done (the caller as the child, never a body field).
    const call = writes.find((w) => w.url.includes('/rest/v1/rpc/family_task_mark_done'));
    expect(call?.body).toEqual({ p_task: TASK_ID, p_kid: KID_ID, p_completed_on: today(), p_note: null });
    expect(writes.some((w) => w.url.includes('/rest/v1/tasks?id=eq.') && w.method === 'PATCH')).toBe(false);
    expect(writes.some((w) => w.url.includes('kid_task_streaks'))).toBe(false);
    expect(res.body.data.streak).toMatchObject({ status: 'practised_today', current: 1, best: 1, totalDays: 1, restDaysPerWeek: 2 });
    expect(res.body.data.milestone).toBeNull();
  });

  it('replaces a local day more than one day from the server day with the server day', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ task: defaultTask(), roles: ['kid'], writes });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: shift(today(), -3) });
    expect(res.status).toBe(200);
    const call = writes.find((w) => w.url.includes('/rest/v1/rpc/family_task_mark_done'));
    expect((call?.body as { p_completed_on: string }).p_completed_on).toBe(today());
  });

  it('keeps the streak through one missed day (the D.2 defect no longer reproduces)', async () => {
    const t = today();
    stub({ task: defaultTask(), roles: ['kid'], streakDays: [shift(t, -4), shift(t, -3), shift(t, -2)] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: t });
    expect(res.status).toBe(200);
    expect(res.body.data.streak.current).toBe(4);
  });

  it('celebrates the day\'s first chore that reaches 7, and never a second chore that day', async () => {
    const t = today();
    const six = [1, 2, 3, 4, 5, 6].map((n) => shift(t, -n));
    stub({ task: defaultTask(), roles: ['kid'], streakDays: six });
    const first = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: t });
    expect(first.body.data).toMatchObject({ milestone: 'streak-7', streak: { current: 7 } });
    stub({ task: defaultTask(), roles: ['kid'], streakDays: [...six, t] });
    const second = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: t });
    expect(second.body.data).toMatchObject({ milestone: null, streak: { current: 7 } });
  });

  it('still reports the completed chore when the streak history cannot be read', async () => {
    stub({ task: defaultTask(), roles: ['kid'], streakReadable: false });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, { localDate: today() });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ task: { status: 'done' }, streak: null, milestone: null });
  });
});

describe('GET /api/v1/tasks/streak (kid)', () => {
  it('reports none for a kid with no practised day yet', async () => {
    stub({ roles: ['kid'] });
    const res = await request(createApp()).get('/api/v1/tasks/streak').set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.streak).toMatchObject({ status: 'none', current: 0, best: 0, totalDays: 0, pausedUntil: null });
  });

  it('shows a resting streak with the best still visible, and a legacy best as the floor', async () => {
    const t = new Date().toISOString().slice(0, 10);
    const back = (n: number) => new Date(Date.parse(`${t}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
    stub({ roles: ['kid'], streakDays: [back(12), back(11), back(10)], legacyBest: 9 });
    const res = await request(createApp()).get(`/api/v1/tasks/streak?today=${t}`).set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.streak).toMatchObject({ status: 'resting', current: 0, best: 9, totalDays: 3 });
  });

  it('502s an unreadable history instead of showing no streak', async () => {
    stub({ roles: ['kid'], streakReadable: false });
    const res = await request(createApp()).get('/api/v1/tasks/streak').set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(502);
  });
});

describe('POST /api/v1/tasks/:id/approve (parent)', () => {
  it('404s approving a task belonging to a child not verified under this parent', async () => {
    stub({ task: { ...defaultTask(), status: 'done' }, parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, { reflection: 'skipped' });
    expect(res.status).toBe(404);
  });

  it('approves a done task', async () => {
    stub({ task: { ...defaultTask(), status: 'done' }, parentsKids: [KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, { reflection: 'skipped' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('approved');
  });

  it('records the deciding guardian through the decision flow so the database can re-check it (D.4, D.18)', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ task: { ...defaultTask(), status: 'done' }, parentsKids: [KID_ID], writes });
    await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, { reflection: 'skipped' });
    const call = writes.find((w) => w.url.includes('/rest/v1/rpc/family_decide_task'));
    expect(call?.body).toEqual({ p_task: TASK_ID, p_actor: PARENT_ID, p_outcome: 'approved', p_reason_code: null, p_reason: null });
  });

  it('409s approving a task that requires a photo but has none attached yet', async () => {
    stub({ task: { ...defaultTask(), status: 'done', requires_evidence: true }, parentsKids: [KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, { reflection: 'skipped' });
    expect(res.status).toBe(409);
  });

  it('approves a photo-required task once evidence is attached', async () => {
    stub({
      task: { ...defaultTask(), status: 'done', requires_evidence: true, evidence_bucket: 'task-evidence', evidence_hash: 'aa11bb22', evidence_ext: 'jpg' },
      parentsKids: [KID_ID],
    });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, { reflection: 'skipped' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/tasks/:id/cancel (parent)', () => {
  const REASON = { reasonCode: 'not_finished', reason: 'The bed still needs the pillows on top', reflection: 'skipped' };

  it('404s cancelling a task belonging to a child not verified under this parent', async () => {
    stub({ task: defaultTask(), parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/cancel`, REASON);
    expect(res.status).toBe(404);
  });

  it('409s cancelling a task that is already decided (approved/cancelled): the decision flow refuses it', async () => {
    stub({ task: { ...defaultTask(), status: 'approved' }, parentsKids: [KID_ID], refusals: { family_decide_task: 'DECISION_OUTCOME_INVALID' } });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/cancel`, REASON);
    expect(res.status).toBe(409);
  });

  it('refuses a cancellation with no reason before any write (D.18: no "not yet" without a reason)', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ task: defaultTask(), parentsKids: [KID_ID], writes });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/cancel`, { reflection: 'skipped' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DECISION_REASON_REQUIRED');
    expect(writes.some((w) => w.url.includes('/rpc/'))).toBe(false);
  });

  it("cancels a task with a reason, and returns it on the wire so the kid can see why", async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ task: defaultTask(), parentsKids: [KID_ID], writes });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/cancel`, REASON);
    expect(res.status).toBe(200);
    expect(res.body.data.task.cancelReason).toBe(REASON.reason);
    const call = writes.find((w) => w.url.includes('/rest/v1/rpc/family_decide_task'));
    expect(call?.body).toEqual({ p_task: TASK_ID, p_actor: PARENT_ID, p_outcome: 'cancelled', p_reason_code: 'not_finished', p_reason: REASON.reason });
  });

  it('rejects a reason over 240 characters', async () => {
    stub({ task: defaultTask(), parentsKids: [KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/cancel`, { reason: 'x'.repeat(241), reflection: 'skipped' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/tasks/:id/allocate (kid)', () => {
  const approvedTask = { ...defaultTask(), status: 'approved', reward_coins: 10 };

  it('rejects a split that does not sum to more than zero', async () => {
    stub({ task: approvedTask, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 0, spend: 0, share: 0 });
    expect(res.status).toBe(400);
  });

  it("409s when the DB function refuses (wrong split, already allocated, wrong status)", async () => {
    stub({ task: approvedTask, allocateResult: false, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 3, spend: 3, share: 3 });
    expect(res.status).toBe(409);
  });

  it('502s when the RPC call itself fails (transport)', async () => {
    stub({ task: approvedTask, allocateResult: null, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 5, spend: 3, share: 2 });
    expect(res.status).toBe(502);
  });

  it('allocates a valid split and reports success', async () => {
    stub({ task: approvedTask, allocateResult: true, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 5, spend: 3, share: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.allocated).toBe(true);
  });

  it("404s allocating a task that is not this kid's own", async () => {
    stub({ task: { ...approvedTask, assigned_to: OTHER_KID_ID }, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 10, spend: 0, share: 0 });
    expect(res.status).toBe(404);
  });

  // S07.4: the goal-reached flip happens inside allocate_task_reward's own
  // transaction; Core never writes a goal status, it reports the goal as the
  // database now has it (with its provenance) so the child's surface can
  // celebrate it once (D.15).
  it('returns the goal as the database reached it, with its provenance, and never writes a goal status itself', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ task: approvedTask, allocateResult: true, roles: ['kid'], writes, ledgerRows: [{ bucket: 'save', amount: 50 }],
      goal: { ...defaultGoal(), status: 'reached', reached_at: '2026-09-24T10:00:00Z' } });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 10, spend: 0, share: 0, goalId: GOAL_ID });
    expect(res.status).toBe(200);
    expect(res.body.data.goal).toMatchObject({ id: GOAL_ID, status: 'reached', saved: 50, progress: { own: 50, bonus: 0, family: 0, total: 50 } });
    expect(writes.some((w) => w.url.includes('/savings_goals') && w.method === 'PATCH')).toBe(false);
  });

  it('reports no goal when the split named none', async () => {
    stub({ task: approvedTask, allocateResult: true, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 5, spend: 3, share: 2 });
    expect(res.body.data).toEqual({ allocated: true, goal: null });
  });
});

describe('GET /api/v1/tasks/wallet (kid) and /:kidId/wallet (parent)', () => {
  it("sums the ledger into three buckets, never trusting a stored counter", async () => {
    stub({ ledgerRows: [{ bucket: 'save', amount: 4 }, { bucket: 'save', amount: 6 }, { bucket: 'spend', amount: 2 }], roles: ['kid'] });
    const res = await request(createApp()).get('/api/v1/tasks/wallet').set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.balances).toEqual({ save: 10, spend: 2, share: 0 });
  });

  it("404s a parent reading a kid's wallet without a verified link", async () => {
    stub({ parentsKids: [OTHER_KID_ID] });
    const res = await asParent(`/api/v1/tasks/${KID_ID}/wallet`);
    expect(res.status).toBe(404);
  });

  it("lets a verified parent read the kid's wallet", async () => {
    stub({ parentsKids: [KID_ID], ledgerRows: [{ bucket: 'spend', amount: 5 }] });
    const res = await asParent(`/api/v1/tasks/${KID_ID}/wallet`);
    expect(res.status).toBe(200);
    expect(res.body.data.balances.spend).toBe(5);
  });
});

describe('POST /api/v1/tasks/goals (kid)', () => {
  it('rejects a target of zero', async () => {
    stub({ roles: ['kid'] });
    const res = await postAsKid('/api/v1/tasks/goals', { title: 'A bike', target: 0, icon: 'bike' });
    expect(res.status).toBe(400);
  });

  it('creates a goal', async () => {
    stub({ roles: ['kid'] });
    const res = await postAsKid('/api/v1/tasks/goals', { title: 'A bike', target: 50, icon: 'bike' });
    expect(res.status).toBe(201);
    expect(res.body.data.goal).toMatchObject({ id: GOAL_ID, title: 'A bike', target: 50, status: 'active', kidUserId: KID_ID, saved: 0 });
    expect(res.body.data.goal.kid_user_id).toBeUndefined();
  });
});

describe('PATCH /api/v1/tasks/goals/:id (kid archives)', () => {
  it("404s archiving a goal that is not this kid's own", async () => {
    stub({ goal: { ...defaultGoal(), kid_user_id: OTHER_KID_ID }, roles: ['kid'] });
    const res = await request(createApp()).patch(`/api/v1/tasks/goals/${GOAL_ID}`).set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`).send({});
    expect(res.status).toBe(404);
  });

  it('archives an own goal', async () => {
    stub({ goal: defaultGoal(), roles: ['kid'], ledgerRows: [] });
    const res = await request(createApp()).patch(`/api/v1/tasks/goals/${GOAL_ID}`).set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.goal.status).toBe('archived');
  });
});

describe('PATCH /api/v1/tasks/catalog/:id (parent toggles a reward)', () => {
  it('404s toggling a catalog item that belongs to a different parent', async () => {
    stub({ catalogItem: { ...defaultCatalogItem(), parent_user_id: OTHER_KID_ID } });
    const res = await request(createApp()).patch(`/api/v1/tasks/catalog/${CATALOG_ID}`).set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`).send({ active: false });
    expect(res.status).toBe(404);
  });

  it('rejects a non-boolean active value', async () => {
    stub({ catalogItem: defaultCatalogItem() });
    const res = await request(createApp()).patch(`/api/v1/tasks/catalog/${CATALOG_ID}`).set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`).send({ active: 'off' });
    expect(res.status).toBe(400);
  });

  it('turns a reward off', async () => {
    stub({ catalogItem: defaultCatalogItem() });
    const res = await request(createApp()).patch(`/api/v1/tasks/catalog/${CATALOG_ID}`).set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`).send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.item.active).toBe(false);
  });
});

describe('POST /api/v1/tasks/redemptions/:id/decide (parent)', () => {
  it("404s deciding a redemption for a kid not verified under this parent", async () => {
    stub({ redemption: defaultRedemption(), parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/redemptions/${REDEMPTION_ID}/decide`, { approve: true, reflection: 'skipped' });
    expect(res.status).toBe(404);
  });

  it('409s approving when the balance no longer covers the cost', async () => {
    stub({ redemption: defaultRedemption(), parentsKids: [KID_ID], refusals: { family_decide_redemption: 'INSUFFICIENT_BALANCE' } });
    const res = await postAsParent(`/api/v1/tasks/redemptions/${REDEMPTION_ID}/decide`, { approve: true, reflection: 'skipped' });
    expect(res.status).toBe(409);
  });

  it('approves a redemption', async () => {
    stub({ redemption: defaultRedemption(), parentsKids: [KID_ID], decideResult: true });
    const res = await postAsParent(`/api/v1/tasks/redemptions/${REDEMPTION_ID}/decide`, { approve: true, reflection: 'skipped' });
    expect(res.status).toBe(200);
    expect(res.body.data.decided).toBe(true);
  });
});

describe('GET /api/v1/tasks/catalog/available (kid)', () => {
  it("only returns a guardian's catalog — a stranger's parent_user_id never matches", async () => {
    stub({ kidsParents: [PARENT_ID], roles: ['kid'] });
    const res = await request(createApp()).get('/api/v1/tasks/catalog/available').set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});

describe('POST /api/v1/tasks/redemptions (kid)', () => {
  it("404s requesting a reward that belongs to someone who is not this kid's guardian", async () => {
    stub({ catalogItem: defaultCatalogItem(), kidsParents: [OTHER_KID_ID], roles: ['kid'] });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID, reasonKind: 'saved_for_it' });
    expect(res.status).toBe(404);
  });

  it('requests a redemption against a verified guardian catalog item, with the child\'s reason', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ catalogItem: defaultCatalogItem(), kidsParents: [PARENT_ID], roles: ['kid'], writes });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID, reasonKind: 'saved_for_it' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ preapproved: false, redemption: { status: 'requested', childReasonKind: 'saved_for_it' } });
    const call = writes.find((w) => w.url.includes('/rest/v1/rpc/family_request_redemption'));
    expect(call?.body).toEqual({ p_kid: KID_ID, p_catalog: CATALOG_ID, p_reason_kind: 'saved_for_it', p_note: null });
  });

  it('refuses a request without the child\'s reason before any write (D.18)', async () => {
    const writes: { url: string; method: string; body: unknown }[] = [];
    stub({ catalogItem: defaultCatalogItem(), kidsParents: [PARENT_ID], roles: ['kid'], writes });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REDEMPTION_REASON_REQUIRED');
    expect(writes.some((w) => w.url.includes('/rpc/'))).toBe(false);
  });

  // BANKING.md §5.5/§6.3 — enforced at REQUEST time, before this ever
  // reaches a parent's approval queue.
  it('blocks a request that would push past an active weekly spend limit', async () => {
    stub({
      catalogItem: defaultCatalogItem(), // cost: 5
      kidsParents: [PARENT_ID],
      roles: ['kid'],
      spendLimit: { kid_user_id: KID_ID, parent_user_id: PARENT_ID, period: 'weekly', cap: 10, active: true, created_at: new Date().toISOString() },
      spendLedgerRows: [{ bucket: 'spend', amount: -8 }], // 8 already used, +5 more would exceed a cap of 10
    });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID, reasonKind: 'saved_for_it' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SPEND_LIMIT_REACHED');
  });

  it('allows a request that stays within an active spend limit', async () => {
    stub({
      catalogItem: defaultCatalogItem(), // cost: 5
      kidsParents: [PARENT_ID],
      roles: ['kid'],
      spendLimit: { kid_user_id: KID_ID, parent_user_id: PARENT_ID, period: 'weekly', cap: 10, active: true, created_at: new Date().toISOString() },
      spendLedgerRows: [{ bucket: 'spend', amount: -3 }],
    });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID, reasonKind: 'saved_for_it' });
    expect(res.status).toBe(201);
  });

  it('ignores an INACTIVE spend limit entirely', async () => {
    stub({
      catalogItem: defaultCatalogItem(),
      kidsParents: [PARENT_ID],
      roles: ['kid'],
      spendLimit: { kid_user_id: KID_ID, parent_user_id: PARENT_ID, period: 'weekly', cap: 1, active: false, created_at: new Date().toISOString() },
      spendLedgerRows: [{ bucket: 'spend', amount: -100 }],
    });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID, reasonKind: 'saved_for_it' });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/v1/tasks/redemptions/mine (kid)', () => {
  it("lists the caller's own redemption requests", async () => {
    stub({ roles: ['kid'] });
    const res = await request(createApp()).get('/api/v1/tasks/redemptions/mine').set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.redemptions).toHaveLength(1);
    expect(res.body.data.redemptions[0].id).toBe(REDEMPTION_ID);
  });
});

describe('POST /api/v1/tasks/:id/evidence (kid)', () => {
  it('rejects a task that already has a decision', async () => {
    stub({ task: { ...defaultTask(), status: 'approved' }, roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(409);
  });

  it("404s a task that is not this kid's own", async () => {
    stub({ task: { ...defaultTask(), assigned_to: OTHER_KID_ID }, roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(404);
  });

  it('rejects a missing or unsupported file', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(400);
  });

  it('502s when Depot upload fails, and never invents a pointer to bytes never stored', async () => {
    stub({ task: defaultTask(), roles: ['kid'], filebaseUploadOk: false });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(502);
  });

  it('uploads a photo and reports it attached', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.hasEvidence).toBe(true);
  });

  it('rejects a file whose real bytes do not match its declared Content-Type', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', Buffer.from([1, 2, 3]), { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('409s (never 502) when a parent decides the task between the status check and the write, and cleans up the orphaned upload', async () => {
    const deleteCalls: string[] = [];
    stub({ task: defaultTask(), roles: ['kid'], taskPatchSucceeds: false, deleteCalls });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(409);
    expect(deleteCalls.some((u) => u.includes('aa11bb22.jpg'))).toBe(true);
  });

  it('deletes the superseded photo when replacing one, once confirmed no other task still points at it', async () => {
    const deleteCalls: string[] = [];
    stub({
      task: { ...defaultTask(), evidence_bucket: 'task-evidence', evidence_hash: 'oldhash', evidence_ext: 'jpg' },
      roles: ['kid'],
      deleteCalls,
      evidenceStillReferenced: false,
    });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(deleteCalls.some((u) => u.includes('oldhash.jpg'))).toBe(true);
  });

  it('does NOT delete the superseded photo if another task still points at the same content-addressed bytes', async () => {
    const deleteCalls: string[] = [];
    stub({
      task: { ...defaultTask(), evidence_bucket: 'task-evidence', evidence_hash: 'oldhash', evidence_ext: 'jpg' },
      roles: ['kid'],
      deleteCalls,
      evidenceStillReferenced: true,
    });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', REAL_JPEG, { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(deleteCalls).toHaveLength(0);
  });
});

describe('GET /api/v1/tasks/:id/evidence', () => {
  it('404s for a stranger — no guardian link and not the kid themself', async () => {
    stub({ task: { ...defaultTask(), evidence_bucket: 'task-evidence', evidence_hash: 'aa11bb22', evidence_ext: 'jpg' }, parentsKids: [OTHER_KID_ID], roles: ['parent'] });
    const res = await request(createApp())
      .get(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`);
    expect(res.status).toBe(404);
  });

  it('404s a task with no photo attached', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await request(createApp())
      .get(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(404);
  });

  it('streams the photo back to the kid who owns the task', async () => {
    stub({ task: { ...defaultTask(), evidence_bucket: 'task-evidence', evidence_hash: 'aa11bb22', evidence_ext: 'jpg' }, roles: ['kid'] });
    const res = await request(createApp())
      .get(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('streams the photo back to a verified guardian', async () => {
    stub({ task: { ...defaultTask(), evidence_bucket: 'task-evidence', evidence_hash: 'aa11bb22', evidence_ext: 'jpg' }, parentsKids: [KID_ID], roles: ['parent'] });
    const res = await request(createApp())
      .get(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`);
    expect(res.status).toBe(200);
  });

  it('502s when Depot cannot serve the bytes', async () => {
    stub({ task: { ...defaultTask(), evidence_bucket: 'task-evidence', evidence_hash: 'aa11bb22', evidence_ext: 'jpg' }, roles: ['kid'], filebaseDownloadOk: false });
    const res = await request(createApp())
      .get(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`);
    expect(res.status).toBe(502);
  });
});

describe('D.1 frozen movement admission', () => {
  it.each([true, null])('refuses redemption requests when freeze state is %s', async bankingFrozen => {
    stub({ roles: ['kid'], bankingFrozen });
    const response = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID, reasonKind: 'saved_for_it' });
    expect(response.status).toBe(bankingFrozen === null ? 502 : 409);
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) => String(url).includes('/rest/v1/redemptions') && init?.method === 'POST')).toBe(false);
  });
  it.each([true, null])('holds task allocations when freeze state is %s', async bankingFrozen => {
    stub({ roles: ['kid'], bankingFrozen });
    const response = await postAsKid(`/api/v1/tasks/${TASK_ID}/allocate`, { save: 10, spend: 0, share: 0 });
    expect(response.status).toBe(bankingFrozen === null ? 502 : 409);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/rpc/allocate_task_reward'))).toBe(false);
  });
});
