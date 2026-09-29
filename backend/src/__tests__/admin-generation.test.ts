import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * /api/v1/admin/generation — the Generation console's data plane over the
 * 0017 telemetry tables (coursegen's durable scoreboard). Happy + sad paths
 * per AGENTS.md §7; PostgREST is stubbed at the fetch layer like admin.test.
 */

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const RUN_ROW = {
  run_id: 'trk--adv-one',
  track_id: 'trk',
  course_slug: 'first-lemonade-stand',
  register: 'kid',
  params: { course: 'first-lemonade-stand', locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false, register: 'kid' },
  summary: {
    published: ['a/s/t/l1', 'a/s/t/l2'],
    failed: [{ slotId: 'a/s/t/l3', error: 'judge gate failed', failedFrom: 'written' }],
    slotsEnumerated: 3,
  },
  tokens_used: 500_000,
  usd_used: '1.2345', // PostgREST numerics arrive as strings — the mapper must coerce
  cached_tokens: 200_000,
  images_generated: 12,
  images_billed: 2,
  updated_at: '2026-07-26T02:00:00Z',
};

const TRACK_ROW = {
  track_id: 'trk',
  course_slug: 'first-lemonade-stand',
  budget_usd: '50.0000',
  halted: null,
  report: {
    totals: { slots: 3, published: 2, failed: 1, usd: 1.2345 },
    failureHeatmap: { written: 1 },
    mopUp: ['a/s/t/l3'],
    shards: [{ adventure: 'adv-one' }],
  },
  updated_at: '2026-07-26T02:00:00Z',
};

const LIVE_UPDATED_AT = new Date(Date.now() - 30_000).toISOString();

const LIVE_ROW = {
  run_id: 'live-run-1',
  track_id: null,
  course_slug: 'first-lemonade-stand',
  register: 'kid',
  active_slots: 2,
  completed_slots: 4,
  failed_slots: 1,
  skipped_slots: 1,
  total_slots: 8,
  stage_breakdown: { writing: 2, published: 4, failed: 1, skipped: 1 },
  tokens_used: 250_000,
  usd_used: '0.8750',
  cached_tokens: 100_000,
  images_generated: 8,
  images_billed: 3,
  images_inherited: 5,
  started_at: LIVE_UPDATED_AT,
  updated_at: LIVE_UPDATED_AT,
};

const SLOT_ROWS = [
  {
    slot_id: 'a/s/t/l1',
    state: 'published',
    failed_from: null,
    error: null,
    salvaged: false,
    dropped_segments: 0,
    images_generated: 6,
    images_billed: 1,
    images_inherited: 5,
    duration_ms: 84_000,
    rubric: { kid_safety: 5, age_fit: 5, notes: 'ok' },
    review_cycles: 0,
    early_stopped: false,
  },
  {
    slot_id: 'a/s/t/l3',
    state: 'failed',
    failed_from: 'written',
    error: 'review: judge gate failed after 1 revise cycle(s)',
    salvaged: false,
    dropped_segments: 0,
    images_generated: 0,
    images_billed: 0,
    images_inherited: 0,
    duration_ms: 120_000,
    rubric: { kid_safety: 5, age_fit: 3, notes: 'too advanced' },
    review_cycles: 1,
    early_stopped: true,
  },
];

function stubGeneration(callerRole: 'admin' | 'universal', opts: { vaultDown?: boolean; emptyRun?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: callerRole }]));
      if (url.includes('/rest/v1/admin_permissions')) return Promise.resolve(jsonResponse(200, [{ user_id: ADMIN_ID, permission: 'manage_content' }]));
      if (opts.vaultDown) return Promise.resolve(new Response('upstream down', { status: 503 }));
      if (url.includes('/rest/v1/generation_tracks')) return Promise.resolve(jsonResponse(200, [TRACK_ROW]));
      if (url.includes('/rest/v1/generation_runs_live')) return Promise.resolve(jsonResponse(200, [LIVE_ROW]));
      if (url.includes('/rest/v1/generation_runs')) return Promise.resolve(jsonResponse(200, opts.emptyRun ? [] : [RUN_ROW]));
      if (url.includes('/rest/v1/generation_slots')) return Promise.resolve(jsonResponse(200, SLOT_ROWS));
      throw new Error(`admin-generation.test: unexpected fetch ${url}`);
    }),
  );
}

const auth = () => `Bearer ${mintToken({ sub: ADMIN_ID, email: 'staff@littlefounders.ai' })}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/v1/admin/generation', () => {
  it('returns recent tracks + runs with camelCase shapes and coerced numerics', async () => {
    stubGeneration('admin');
    const res = await request(createApp()).get('/api/v1/admin/generation').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.tracks[0]).toMatchObject({
      trackId: 'trk',
      courseSlug: 'first-lemonade-stand',
      budgetUsd: 50,
      halted: null,
      failureHeatmap: { written: 1 },
      mopUp: ['a/s/t/l3'],
      shards: 1,
    });
    expect(res.body.data.runs[0]).toMatchObject({
      runId: 'trk--adv-one',
      published: 2,
      failed: 1,
      slotsEnumerated: 3,
      usdUsed: 1.2345, // string → number
      cachedTokens: 200_000,
    });
  });

  it('403s a non-staff role', async () => {
    stubGeneration('universal');
    const res = await request(createApp()).get('/api/v1/admin/generation').set('Authorization', auth());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('401s without a session', async () => {
    stubGeneration('admin');
    const res = await request(createApp()).get('/api/v1/admin/generation');
    expect(res.status).toBe(401);
  });

  it('502s when Vault does not answer', async () => {
    stubGeneration('admin', { vaultDown: true });
    const res = await request(createApp()).get('/api/v1/admin/generation').set('Authorization', auth());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/generation/runs/:runId', () => {
  it('returns the run detail with its slots (rubrics included)', async () => {
    stubGeneration('admin');
    const res = await request(createApp()).get('/api/v1/admin/generation/runs/trk--adv-one').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.run).toMatchObject({ runId: 'trk--adv-one', usdUsed: 1.2345 });
    expect(res.body.data.run.params).toMatchObject({ register: 'kid' });
    expect(res.body.data.slots).toHaveLength(2);
    expect(res.body.data.slots[1]).toMatchObject({
      slotId: 'a/s/t/l3',
      state: 'failed',
      failedFrom: 'written',
      reviewCycles: 1,
      earlyStopped: true,
      rubric: { age_fit: 3 },
    });
  });

  it('400s an unsafe runId (never interpolated raw)', async () => {
    stubGeneration('admin');
    const res = await request(createApp())
      .get(`/api/v1/admin/generation/runs/${encodeURIComponent('x;drop table')}`)
      .set('Authorization', auth());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('502s an unknown run id (Vault answered, no row)', async () => {
    stubGeneration('admin', { emptyRun: true });
    const res = await request(createApp()).get('/api/v1/admin/generation/runs/nope').set('Authorization', auth());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/generation/live', () => {
  it('hydrates active runs with exact processed counters and numeric cost', async () => {
    stubGeneration('admin');
    const res = await request(createApp()).get('/api/v1/admin/generation/live').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.activeRuns[0]).toMatchObject({
      runId: 'live-run-1',
      completedSlots: 4,
      failedSlots: 1,
      skippedSlots: 1,
      usdUsed: 0.875,
    });
  });

  it('returns DATA_UNAVAILABLE when live telemetry cannot be read', async () => {
    stubGeneration('admin', { vaultDown: true });
    const res = await request(createApp()).get('/api/v1/admin/generation/live').set('Authorization', auth());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});

// Bible 02 section 1.2 and rule 16 (F4-staff-ops): the coach's proposed
// actions are structured facts the console localizes, never Core-authored
// prose in one language.
describe('GET /api/v1/admin/generation/coach proposed actions', () => {
  it('returns each action as a tag and numeric facts, with no prose', async () => {
    stubGeneration('admin');
    const res = await request(createApp()).get('/api/v1/admin/generation/coach').set('Authorization', auth());
    expect(res.status).toBe(200);
    const actions = res.body.data.proposedActions as { tag: string; params: Record<string, unknown> }[];
    expect(actions).toEqual([
      { tag: 'failure:stage', params: { stage: 'written', count: 1, total: 1 } },
      { tag: 'cost:perLesson', params: { usdPerLesson: 0.61725, totalUsd: 1.2345, published: 2, inherited: 0, billed: 2 } },
    ]);
    for (const action of actions) {
      expect(Object.keys(action).sort()).toEqual(['params', 'tag']);
      for (const value of Object.values(action.params)) expect(['number', 'string'].includes(typeof value) || value === null).toBe(true);
    }
    const text = JSON.stringify(actions);
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/Revisar|lecci|Costo|dimensi/);
  });
});
