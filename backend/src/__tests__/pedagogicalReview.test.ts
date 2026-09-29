import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { STAGE3_ITEMS, stage3RefusalMessage } from '../services/pedagogicalReview.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * GAP-FIX-R6 learning, Appendix C Part 3 Stage 3 at the Core boundary:
 *   - GET/POST /admin/content/lessons/:lessonId/pedagogical-review behind
 *     manage_content; the body must answer exactly the ten items, each with a
 *     named finding, name one subject, and never let the reviewer be the author;
 *   - Vault's refusals map to named codes;
 *   - a release Vault's Stage 3 gate refuses answers 409
 *     RELEASE_STAGE3_REVIEW_REQUIRED (course, lesson and v2 version), never 502.
 * The SQL is proven on PostgreSQL by database/scripts/verify-stage3-review-postgres.py.
 */

const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const AUTHOR_ID = '44444444-4444-4444-8444-444444444444';
const LESSON = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const COURSE = '55555555-5555-4555-8555-555555555555';
const ITEM = '66666666-6666-4666-8666-666666666666';
const FINGERPRINT = 'a'.repeat(64);
const auth = () => `Bearer ${mintToken({ sub: STAFF_ID, email: 'staff@littlefounders.ai' })}`;

interface World {
  permissions?: string[];
  rpc?: Record<string, { status: number; body: unknown }>;
  calls?: { url: string; method: string; body?: string }[];
}

function stub(world: World = {}) {
  const calls = world.calls ?? [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'admin' }]));
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (world.permissions ?? ['manage_content']).map((permission) => ({ user_id: STAFF_ID, permission }))));
    }
    const rpc = /\/rest\/v1\/rpc\/([a-z0-9_]+)/.exec(url)?.[1];
    if (rpc && world.rpc?.[rpc]) return Promise.resolve(jsonResponse(world.rpc[rpc].status, world.rpc[rpc].body));
    throw new Error(`pedagogicalReview.test: unexpected ${method} ${url}`);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const path = `/api/v1/admin/content/lessons/${LESSON}/pedagogical-review`;
const finding = 'Checked against the Block B standard for this lesson.';
const allChecks = (overrides: Record<string, unknown> = {}) => ({
  ...Object.fromEntries(STAGE3_ITEMS.map((item) => [item.id, { result: 'pass', finding }])),
  ...overrides,
});
const body = (overrides: Record<string, unknown> = {}) => ({ fingerprint: FINGERPRINT, authorId: AUTHOR_ID, checks: allChecks(), forgeItems: [], ...overrides });

const stateRow = {
  found: true, lesson_id: LESSON, lesson_status: 'review', subject: 'lesson', fingerprint: FINGERPRINT, document_version_id: null,
  locale: null, version_id: null, version_author_id: null,
  latest: {
    id: 'r1', result: 'fail', finding_count: 1, reviewer_id: STAFF_ID, author_id: AUTHOR_ID, author_source: 'named_by_reviewer',
    checks: { practice_zone: { result: 'fail', finding: 'Every item is near-certain to pass.' } }, forge_items: [], recorded_at: '2026-09-29T10:00:00Z',
  },
  open_items: [{ id: ITEM, gate: 17, message: 'mystery-reward language', locale: null, run_id: 'run-1', created_at: '2026-09-29T09:00:00Z' }],
  authors: [{ user_id: STAFF_ID, display_name: 'Me' }, { user_id: AUTHOR_ID, display_name: 'Ana' }],
  refusal: 'the latest Stage 3 pedagogical review of this content failed',
};

describe('Stage 3 review state', () => {
  it('serves the form its subject, latest review, open Forge items and the authors other than the reviewer', async () => {
    const calls = stub({ rpc: { lesson_stage3_review_state: { status: 200, body: stateRow } } });
    const res = await request(createApp()).get(path).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      lessonId: LESSON, subject: 'lesson', fingerprint: FINGERPRINT, refusal: stateRow.refusal,
      latest: { result: 'fail', findingCount: 1, authorSource: 'named_by_reviewer' },
      openItems: [{ id: ITEM, gate: 17, runId: 'run-1' }],
      authors: [{ userId: AUTHOR_ID, displayName: 'Ana' }],
    });
    expect(res.body.data.items).toHaveLength(10);
    expect(JSON.parse(calls.find((c) => c.url.includes('lesson_stage3_review_state'))!.body!)).toEqual({ p_lesson_id: LESSON, p_document_version_id: null });
  });

  it('reads one version with ?versionId=, answers 404 for an unknown subject and 502 for a malformed state', async () => {
    const calls = stub({ rpc: { lesson_stage3_review_state: { status: 200, body: { ...stateRow, subject: 'version', fingerprint: null, document_version_id: VERSION } } } });
    expect((await request(createApp()).get(`${path}?versionId=${VERSION}`).set('Authorization', auth())).status).toBe(200);
    expect(JSON.parse(calls.find((c) => c.url.includes('lesson_stage3_review_state'))!.body!).p_document_version_id).toBe(VERSION);
    stub({ rpc: { lesson_stage3_review_state: { status: 200, body: { found: false } } } });
    expect((await request(createApp()).get(path).set('Authorization', auth())).status).toBe(404);
    stub({ rpc: { lesson_stage3_review_state: { status: 200, body: { found: true, lesson_id: 3 } } } });
    expect((await request(createApp()).get(path).set('Authorization', auth())).status).toBe(502);
    stub();
    expect((await request(createApp()).get(`${path}?versionId=nope`).set('Authorization', auth())).status).toBe(400);
  });

  it('is refused to a staff member without manage_content', async () => {
    const calls = stub({ permissions: ['view_analytics'] });
    expect((await request(createApp()).get(path).set('Authorization', auth())).status).toBe(403);
    expect((await request(createApp()).post(path).set('Authorization', auth()).send(body())).status).toBe(403);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });
});

describe('Recording a Stage 3 review', () => {
  const recorded = { status: 200, body: [{ ok: true, code: 'RECORDED', message: 'Stage 3 review recorded.', review_id: 'rev-1', result: 'pass' }] };

  it('records through Vault with the staff actor and the whole review', async () => {
    const forgeItems = [{ id: ITEM, resolution: 'acceptable', note: 'It teaches the mechanic, never offers it.' }];
    const calls = stub({ rpc: { record_lesson_pedagogical_review: recorded } });
    const res = await request(createApp()).post(path).set('Authorization', auth()).send(body({ forgeItems }));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ reviewId: 'rev-1', result: 'pass' });
    const sent = JSON.parse(calls.find((c) => c.url.includes('record_lesson_pedagogical_review'))!.body!);
    expect(sent).toMatchObject({ p_actor: STAFF_ID, p_lesson_id: LESSON, p_document_version_id: null, p_fingerprint: FINGERPRINT, p_author: AUTHOR_ID, p_forge_items: forgeItems });
    expect(Object.keys(sent.p_checks).sort()).toEqual(STAGE3_ITEMS.map((item) => item.id).sort());
  });

  it('refuses, before Vault, a review that is not the ten items each with a named finding', async () => {
    const calls = stub({ rpc: { record_lesson_pedagogical_review: recorded } });
    const nine: Record<string, unknown> = allChecks();
    delete nine.working_memory;
    const invalid = [
      body({ checks: nine }),
      body({ checks: allChecks({ feedback_scope: { result: 'pass', finding: 'approved' } }) }),
      body({ checks: allChecks({ working_memory: { result: 'not_applicable', finding } }) }),
      body({ checks: allChecks({ extra_item: { result: 'pass', finding } }) }),
      body({ checks: allChecks({ age_register: { result: 'pass' } }) }),
      body({ fingerprint: undefined }),
      body({ documentVersionId: VERSION }),
      body({ forgeItems: [{ id: ITEM, resolution: 'acceptable', note: 'fine' }] }),
      body({ forgeItems: [{ id: ITEM, resolution: 'acceptable', note: finding }, { id: ITEM, resolution: 'needs_change', note: finding }] }),
      { ...body(), approved: true },
    ];
    for (const payload of invalid) {
      const res = await request(createApp()).post(path).set('Authorization', auth()).send(payload);
      expect(res.status, JSON.stringify(payload)).toBe(400);
    }
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('accepts not_applicable only on the four scoped items', async () => {
    stub({ rpc: { record_lesson_pedagogical_review: recorded } });
    const scoped = allChecks(Object.fromEntries(STAGE3_ITEMS.filter((item) => item.allowsNotApplicable)
      .map((item) => [item.id, { result: 'not_applicable', finding: 'This lesson has no Mentor moment or choice.' }])));
    const res = await request(createApp()).post(path).set('Authorization', auth()).send(body({ checks: scoped }));
    expect(res.status).toBe(200);
    expect(STAGE3_ITEMS.filter((item) => item.allowsNotApplicable).map((item) => item.id))
      .toEqual(['resolution_efficiency', 'autonomy_real', 'reasoning_authentic', 'mentor_fallibility']);
  });

  it('never lets the reviewer name themselves as the author', async () => {
    const calls = stub({ rpc: { record_lesson_pedagogical_review: recorded } });
    const res = await request(createApp()).post(path).set('Authorization', auth()).send(body({ authorId: STAFF_ID }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('STAGE3_SELF_REVIEW');
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it.each([
    ['FORBIDDEN', 403, 'FORBIDDEN'],
    ['NOT_FOUND', 404, 'NOT_FOUND'],
    ['CONTENT_CHANGED', 409, 'STAGE3_CONTENT_CHANGED'],
    ['AUTHOR_REQUIRED', 400, 'STAGE3_AUTHOR_REQUIRED'],
    ['AUTHOR_MISMATCH', 409, 'STAGE3_AUTHOR_MISMATCH'],
    ['AUTHOR_NOT_STAFF', 400, 'STAGE3_AUTHOR_NOT_STAFF'],
    ['SELF_REVIEW', 409, 'STAGE3_SELF_REVIEW'],
    ['INVALID_REVIEW', 400, 'VALIDATION_ERROR'],
    ['FORGE_ITEMS_UNRESOLVED', 409, 'STAGE3_FORGE_ITEMS_UNRESOLVED'],
    ['SOMETHING_NEW', 409, 'STAGE3_REVIEW_REFUSED'],
  ])('maps Vault refusal %s to %i %s', async (code, status, envelope) => {
    stub({ rpc: { record_lesson_pedagogical_review: { status: 200, body: [{ ok: false, code, message: 'no', review_id: null, result: null }] } } });
    const res = await request(createApp()).post(path).set('Authorization', auth()).send(body());
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(envelope);
  });

  it('answers 502 when Vault cannot confirm the record', async () => {
    stub({ rpc: { record_lesson_pedagogical_review: { status: 500, body: null } } });
    expect((await request(createApp()).post(path).set('Authorization', auth()).send(body())).status).toBe(502);
  });
});

describe('A release no passing Stage 3 review covers', () => {
  const gate = { status: 400, body: { code: 'P0001', message: `STAGE3_REVIEW_REQUIRED: lesson ${LESSON}: no Stage 3 pedagogical review covers this content` } };

  it('reads the refusal message and nothing else', () => {
    expect(stage3RefusalMessage(gate.body)).toBe(`lesson ${LESSON}: no Stage 3 pedagogical review covers this content`);
    expect(stage3RefusalMessage({ message: 'audit store unavailable' })).toBeNull();
    expect(stage3RefusalMessage(null)).toBeNull();
  });

  it('course release: 409 RELEASE_STAGE3_REVIEW_REQUIRED; any other failure stays 502', async () => {
    stub({ rpc: { release_course: gate } });
    const res = await request(createApp()).post(`/api/v1/admin/content/${COURSE}/status`).set('Authorization', auth()).send({ status: 'published' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RELEASE_STAGE3_REVIEW_REQUIRED');
    stub({ rpc: { release_course: { status: 400, body: { message: 'concurrent content change detected' } } } });
    expect((await request(createApp()).post(`/api/v1/admin/content/${COURSE}/status`).set('Authorization', auth()).send({ status: 'published' })).status).toBe(502);
  });

  it('lesson release from the review queue: 409 RELEASE_STAGE3_REVIEW_REQUIRED', async () => {
    stub({ rpc: { release_lesson: gate } });
    const res = await request(createApp()).post(`/api/v1/admin/moderation/${LESSON}/status`).set('Authorization', auth()).send({ status: 'published' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RELEASE_STAGE3_REVIEW_REQUIRED');
  });

  it('v2 version release (G.2): 409 RELEASE_STAGE3_REVIEW_REQUIRED', async () => {
    stub({ rpc: { release_lesson_version: gate } });
    const res = await request(createApp()).post(`/api/v1/admin/content/lessons/${LESSON}/versions/${VERSION}/release`).set('Authorization', auth()).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RELEASE_STAGE3_REVIEW_REQUIRED');
  });
});

describe('Core mirrors Vault', () => {
  it('names the same ten items, with not_applicable on the same four, as stage3_review_items()', () => {
    const dir = fileURLToPath(new URL('../../../database/migrations', import.meta.url));
    const file = readdirSync(dir).find((name) => /^\d{4}_lesson_pedagogical_reviews\.sql$/.test(name));
    expect(file).toBeDefined();
    const sql = readFileSync(join(dir, file!), 'utf8');
    const body = /FUNCTION public\.stage3_review_items\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)![1]!;
    const rows = [...body.matchAll(/\('([a-z_]+)'(?:::text)?, (\d+)::smallint, (true|false)\)/g)]
      .map((m) => ({ id: m[1], position: Number(m[2]), allowsNotApplicable: m[3] === 'true' }));
    expect(rows.map(({ id, allowsNotApplicable }) => ({ id, allowsNotApplicable })))
      .toEqual(STAGE3_ITEMS.map(({ id, allowsNotApplicable }) => ({ id, allowsNotApplicable })));
    expect(rows.map((row) => row.position)).toEqual(STAGE3_ITEMS.map((_, index) => index + 1));
  });
});
