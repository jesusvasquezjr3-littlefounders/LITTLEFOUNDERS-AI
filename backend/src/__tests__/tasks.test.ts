import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

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

afterEach(() => vi.unstubAllGlobals());

interface StubOptions {
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
}

function stub(opts: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (opts.writes && init?.body) {
        opts.writes.push({ url, method, body: JSON.parse(String(init.body)) as unknown });
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
        // setTaskEvidence's PATCH — no status filter, updates evidence_* only.
        if (opts.taskPatchSucceeds === false) return Promise.resolve(jsonResponse(200, []));
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        return Promise.resolve(jsonResponse(200, [{ ...(opts.task ?? defaultTask()), ...body }]));
      }
      if (url.includes('/rest/v1/tasks?id=eq.') && method === 'PATCH') {
        if (opts.taskPatchSucceeds === false) return Promise.resolve(jsonResponse(200, []));
        const status = /status=eq\.([a-z]+)/.exec(url)?.[1];
        return Promise.resolve(jsonResponse(200, [{ ...(opts.task ?? defaultTask()), status: statusAfter(status) }]));
      }
      if (url.includes('/rest/v1/tasks?id=eq.') && method === 'GET') {
        const rows = opts.task === null ? [] : [opts.task ?? defaultTask()];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/tasks?assigned_to') && method === 'GET') {
        return Promise.resolve(jsonResponse(200, opts.task === null ? [] : [opts.task ?? defaultTask()]));
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
        const rows = opts.redemption === null ? [] : [opts.redemption ?? defaultRedemption()];
        return Promise.resolve(jsonResponse(200, rows));
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
function statusAfter(fromInUrl: string | undefined): string {
  // The route always PATCHes ?status=eq.<from>, so the mock doesn't need to
  // know the target — it only has to prove the CONDITIONAL filter was sent.
  return fromInUrl === 'open' ? 'done' : fromInUrl === 'done' ? 'approved' : 'cancelled';
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

  it('409s a task that is not open (already done/approved)', async () => {
    stub({ task: defaultTask(), taskPatchSucceeds: false, roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, {});
    expect(res.status).toBe(409);
  });

  it('marks an open task done', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await postAsKid(`/api/v1/tasks/${TASK_ID}/complete`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('done');
  });
});

describe('POST /api/v1/tasks/:id/approve (parent)', () => {
  it('404s approving a task belonging to a child not verified under this parent', async () => {
    stub({ task: { ...defaultTask(), status: 'done' }, parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, {});
    expect(res.status).toBe(404);
  });

  it('approves a done task', async () => {
    stub({ task: { ...defaultTask(), status: 'done' }, parentsKids: [KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/${TASK_ID}/approve`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('approved');
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

describe('POST /api/v1/tasks/redemptions/:id/decide (parent)', () => {
  it("404s deciding a redemption for a kid not verified under this parent", async () => {
    stub({ redemption: defaultRedemption(), parentsKids: [OTHER_KID_ID] });
    const res = await postAsParent(`/api/v1/tasks/redemptions/${REDEMPTION_ID}/decide`, { approve: true });
    expect(res.status).toBe(404);
  });

  it('409s approving when the balance no longer covers the cost', async () => {
    stub({ redemption: defaultRedemption(), parentsKids: [KID_ID], decideResult: false });
    const res = await postAsParent(`/api/v1/tasks/redemptions/${REDEMPTION_ID}/decide`, { approve: true });
    expect(res.status).toBe(409);
  });

  it('approves a redemption', async () => {
    stub({ redemption: defaultRedemption(), parentsKids: [KID_ID], decideResult: true });
    const res = await postAsParent(`/api/v1/tasks/redemptions/${REDEMPTION_ID}/decide`, { approve: true });
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
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID });
    expect(res.status).toBe(404);
  });

  it('requests a redemption against a verified guardian catalog item', async () => {
    stub({ catalogItem: defaultCatalogItem(), kidsParents: [PARENT_ID], roles: ['kid'] });
    const res = await postAsKid('/api/v1/tasks/redemptions', { catalogId: CATALOG_ID });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/tasks/:id/evidence (kid)', () => {
  it('rejects a task that already has a decision', async () => {
    stub({ task: { ...defaultTask(), status: 'approved' }, roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', Buffer.from([1, 2, 3]), { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(409);
  });

  it("404s a task that is not this kid's own", async () => {
    stub({ task: { ...defaultTask(), assigned_to: OTHER_KID_ID }, roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', Buffer.from([1, 2, 3]), { filename: 'proof.jpg', contentType: 'image/jpeg' });
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
      .attach('photo', Buffer.from([1, 2, 3]), { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(502);
  });

  it('uploads a photo and reports it attached', async () => {
    stub({ task: defaultTask(), roles: ['kid'] });
    const res = await request(createApp())
      .post(`/api/v1/tasks/${TASK_ID}/evidence`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID_ID })}`)
      .attach('photo', Buffer.from([1, 2, 3]), { filename: 'proof.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.data.task.hasEvidence).toBe(true);
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
