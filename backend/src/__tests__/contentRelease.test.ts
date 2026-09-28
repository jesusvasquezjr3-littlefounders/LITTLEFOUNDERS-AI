import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { bypassRates } from '../services/contentRelease.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * GAP-FIX-R2 staff-ops, G.2 at the Core boundary:
 *   - a new v2 version of a live lesson goes live only through
 *     POST /admin/content/lessons/:lessonId/versions/:versionId/release
 *     (manage_content; Vault re-checks the actor and the course verification);
 *   - a rejection needs a reason;
 *   - GET /admin/content/bypass-checks returns Appendix N 1.2's two rates and
 *     the overdue retroactive checks.
 * The SQL is proven on PostgreSQL by database/scripts/verify-content-release-postgres.py.
 */

const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const LESSON = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const auth = () => `Bearer ${mintToken({ sub: STAFF_ID, email: 'staff@littlefounders.ai' })}`;

interface World {
  roles?: string[];
  permissions?: string[];
  rpc?: Record<string, { status: number; body: unknown }>;
  pending?: { status: number; body: unknown };
  calls?: { url: string; method: string; body?: string }[];
}

function stub(world: World = {}) {
  const calls = world.calls ?? [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body as string | undefined });
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, (world.roles ?? ['admin']).map((role) => ({ role }))));
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (world.permissions ?? ['manage_content']).map((permission) => ({ user_id: STAFF_ID, permission }))));
    }
    const rpc = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(url)?.[1];
    if (rpc && world.rpc?.[rpc]) return Promise.resolve(jsonResponse(world.rpc[rpc].status, world.rpc[rpc].body));
    if (url.includes('/rest/v1/lesson_version_activation_requests')) {
      return Promise.resolve(jsonResponse(world.pending?.status ?? 200, world.pending?.body ?? []));
    }
    throw new Error(`contentRelease.test: unexpected ${method} ${url}`);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const releasePath = `/api/v1/admin/content/lessons/${LESSON}/versions/${VERSION}/release`;
const rejectPath = `/api/v1/admin/content/lessons/${LESSON}/versions/${VERSION}/reject`;

describe('G.2 — pending v2 versions of live lessons', () => {
  it('lists the pending versions with their lesson', async () => {
    stub({ pending: { status: 200, body: [{
      id: 'r1', lesson_id: LESSON, locale: 'es-MX', document_version_id: VERSION, version_id: 'forge-v2-run-7',
      document_sha256: 'abc', run_id: 'run-7', created_at: '2026-09-27T10:00:00Z',
      lessons: { slug: 'ahorro', title: { 'es-MX': 'Ahorro', 'en-US': 'Saving', bad: 3 }, status: 'published' },
    }] } });
    const res = await request(createApp()).get('/api/v1/admin/content/lesson-versions').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.versions[0]).toMatchObject({
      lessonId: LESSON, documentVersionId: VERSION, versionId: 'forge-v2-run-7', locale: 'es-MX', lessonStatus: 'published',
      lessonTitle: { 'es-MX': 'Ahorro', 'en-US': 'Saving' },
    });
  });

  it('answers 502, never an empty queue, when the read fails or is malformed', async () => {
    stub({ pending: { status: 500, body: null } });
    expect((await request(createApp()).get('/api/v1/admin/content/lesson-versions').set('Authorization', auth())).status).toBe(502);
    stub({ pending: { status: 200, body: [{ id: 3 }] } });
    expect((await request(createApp()).get('/api/v1/admin/content/lesson-versions').set('Authorization', auth())).status).toBe(502);
  });

  it('releases through Vault with the staff actor', async () => {
    const calls = stub({ rpc: { release_lesson_version: { status: 200, body: [{ ok: true, code: 'RELEASED', message: 'The version is live.' }] } } });
    const res = await request(createApp()).post(releasePath).set('Authorization', auth()).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ lessonId: LESSON, versionId: VERSION, status: 'released' });
    const call = calls.find((c) => c.url.includes('/rpc/release_lesson_version'))!;
    expect(JSON.parse(call.body!)).toEqual({ p_actor: STAFF_ID, p_lesson_id: LESSON, p_document_version_id: VERSION });
  });

  it.each([
    ['VERIFICATION_REQUIRED', 409, 'RELEASE_VERIFICATION_REQUIRED'],
    ['VERIFICATION_INCOMPLETE', 409, 'RELEASE_VERIFICATION_INCOMPLETE'],
    ['NOT_PENDING', 409, 'VERSION_NOT_PENDING'],
    ['NOT_FOUND', 404, 'NOT_FOUND'],
    ['FORBIDDEN', 403, 'FORBIDDEN'],
    ['SOMETHING_NEW', 409, 'RELEASE_BLOCKED'],
  ])('maps the refusal %s to %i %s', async (code, status, envelope) => {
    stub({ rpc: { release_lesson_version: { status: 200, body: [{ ok: false, code, message: 'no' }] } } });
    const res = await request(createApp()).post(releasePath).set('Authorization', auth()).send({});
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(envelope);
  });

  it('is refused before any release call for staff without manage_content and for a family account', async () => {
    const calls = stub({ permissions: ['view_analytics'] });
    expect((await request(createApp()).post(releasePath).set('Authorization', auth()).send({})).status).toBe(403);
    const family = stub({ roles: ['parent'] });
    expect((await request(createApp()).post(releasePath).set('Authorization', auth()).send({})).status).toBe(403);
    expect([...calls, ...family].some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('refuses a malformed id, a body on release and a short rejection reason, with no call', async () => {
    const calls = stub();
    expect((await request(createApp()).post(`/api/v1/admin/content/lessons/x/versions/${VERSION}/release`).set('Authorization', auth()).send({})).status).toBe(400);
    expect((await request(createApp()).post(releasePath).set('Authorization', auth()).send({ force: true })).status).toBe(400);
    expect((await request(createApp()).post(rejectPath).set('Authorization', auth()).send({ reason: 'no' })).status).toBe(400);
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('rejects with a reason through Vault; an unreadable answer is a 502', async () => {
    const calls = stub({ rpc: { reject_lesson_version: { status: 200, body: [{ ok: true, code: 'REJECTED', message: 'off' }] } } });
    const res = await request(createApp()).post(rejectPath).set('Authorization', auth()).send({ reason: 'The example uses a foreign currency.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/reject_lesson_version'))!.body!).p_reason).toBe('The example uses a foreign currency.');
    stub({ rpc: { reject_lesson_version: { status: 500, body: null } } });
    expect((await request(createApp()).post(rejectPath).set('Authorization', auth()).send({ reason: 'The example uses a foreign currency.' })).status).toBe(502);
  });
});

describe('G.2 / Appendix N 1.2 — GET /admin/content/bypass-checks', () => {
  const CHECK = {
    id: 7, action: 'content.live_document_patched', lesson_id: LESSON, course_id: VERSION, locale: 'es-MX',
    occurred_at: '2026-08-01T00:00:00Z', due_at: '2026-08-31T00:00:00Z', justified: true, closed_at: null, closing_verified_at: null, state: 'overdue',
  };

  it('returns the two rates, the counts and the overdue rows', async () => {
    const calls = stub({ rpc: {
      content_bypass_metrics: { status: 200, body: [{ publish_actions: 10, bypasses: 3, decided: 2, unverified: 1, complete: 1, overdue_open: 1 }] },
      content_bypass_checks: { status: 200, body: [CHECK] },
    } });
    const res = await request(createApp()).get('/api/v1/admin/content/bypass-checks?days=60').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      windowDays: 60, retroCheckDays: 30, bypassRate: 0.1, completenessRate: 0.5,
      counts: { publishActions: 10, bypasses: 3, decided: 2, unverified: 1, complete: 1, pending: 1, overdue: 1 },
    });
    expect(res.body.data.checks[0]).toMatchObject({ id: 7, state: 'overdue', justified: true, courseId: VERSION });
    expect(JSON.parse(calls.find((c) => c.url.includes('/rpc/content_bypass_metrics'))!.body!)).toEqual({ p_days: 60 });
  });

  it('is behind manage_content, validates the window and answers 502 on a failed read', async () => {
    stub({ permissions: ['view_analytics'] });
    expect((await request(createApp()).get('/api/v1/admin/content/bypass-checks').set('Authorization', auth())).status).toBe(403);
    stub();
    expect((await request(createApp()).get('/api/v1/admin/content/bypass-checks?days=1').set('Authorization', auth())).status).toBe(400);
    stub({ rpc: { content_bypass_metrics: { status: 500, body: null }, content_bypass_checks: { status: 200, body: [] } } });
    expect((await request(createApp()).get('/api/v1/admin/content/bypass-checks').set('Authorization', auth())).status).toBe(502);
  });

  it('computes the rates with honest nulls', () => {
    expect(bypassRates({ publish_actions: 0, bypasses: 0, decided: 0, unverified: 0, complete: 0, overdue_open: 0 })).toEqual({ bypassRate: null, completenessRate: null });
    expect(bypassRates({ publish_actions: 4, bypasses: 1, decided: 1, unverified: 0, complete: 1, overdue_open: 0 })).toEqual({ bypassRate: 0, completenessRate: 1 });
  });
});
