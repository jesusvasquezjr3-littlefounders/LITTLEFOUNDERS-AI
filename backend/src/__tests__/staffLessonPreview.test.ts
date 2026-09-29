import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { gradeStaffPreview, staffLessonDocument } from '../services/staffLessonPreview.js';
import type { LessonDocumentRow } from '../services/supabaseRest.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * GAP-FIX-R6 (staff-ops): the human review plays the lesson a child will be
 * served. Bible 02 rule 23 / D13, OD-24 (the v1 player only for the v1
 * catalog), Appendix C Part 3 Stage 3, Product 10 G.2.
 *
 *   - the review and the Live updates preview get the v2 document as a
 *     learner is served it: answerless, the Mentor stage projected, and
 *     `playable` when Core would deliver it at all;
 *   - GET /admin/content/lessons/:lessonId/versions/:versionId serves a
 *     pending version's document (manage_content);
 *   - POST /admin/content/lessons/:lessonId/preview-grade checks a preview
 *     answer with the learner's scorer and records NOTHING.
 */

const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const LESSON = '11111111-1111-4111-8111-111111111111';
const OTHER_LESSON = '44444444-4444-4444-8444-444444444444';
const VERSION = '22222222-2222-4222-8222-222222222222';
const auth = () => `Bearer ${mintToken({ sub: STAFF_ID, email: 'staff@littlefounders.ai' })}`;

function v2Document(lessonId = LESSON, locale = 'en-US') {
  return {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
    lesson_id: lessonId, version_id: 'rev-001', locale, age_band: '6-9',
    eligibility: { minimum_age: 8, maximum_age: 10 }, knowledge_component_ids: ['kc-saving-allocation'],
    adventure_scene_id: 'diorama-b', title: 'Split your coins',
    mentor_stage: { character: 'zara', scene: 'diorama-b' },
    required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
    segments: [{ id: 'allocate-01', type: 'money.allocation.v2', grading: 'server', prompt: 'Split 12 coins.',
      visual: { type: 'stacked-bar' }, payload: { total: 12, step: 1, currency: 'coins' } }],
  };
}
const KEYS = { 'allocate-01': { minimumSave: 4 } };

function versionRow(overrides: Record<string, unknown> = {}) {
  return { id: VERSION, lesson_id: LESSON, locale: 'en-US', schema_version: 2, document: v2Document(), answer_keys: KEYS, audio: {}, created_at: '2026-09-28T10:00:00Z', ...overrides };
}

interface World {
  permissions?: string[];
  roles?: string[];
  version?: { status: number; body: unknown };
  current?: { status: number; body: unknown };
  v1?: { status: number; body: unknown };
  calls?: { url: string; method: string }[];
}

function stub(world: World = {}) {
  const calls = world.calls ?? [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, (world.roles ?? ['admin']).map((role) => ({ role }))));
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (world.permissions ?? ['manage_content']).map((permission) => ({ user_id: STAFF_ID, permission }))));
    }
    if (url.includes('/rest/v1/lesson_document_version_current')) {
      return Promise.resolve(jsonResponse(world.current?.status ?? 200, world.current?.body ?? [{ lesson_id: LESSON, locale: 'en-US', document_version_id: VERSION }]));
    }
    if (url.includes('/rest/v1/lesson_document_versions')) return Promise.resolve(jsonResponse(world.version?.status ?? 200, world.version?.body ?? [versionRow()]));
    if (url.includes('/rest/v1/lesson_documents')) return Promise.resolve(jsonResponse(world.v1?.status ?? 200, world.v1?.body ?? []));
    throw new Error(`staffLessonPreview.test: unexpected ${method} ${url}`);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const row = (overrides: Partial<LessonDocumentRow> = {}): LessonDocumentRow => ({
  document_version_id: VERSION, lesson_id: LESSON, locale: 'en-US', schema_version: 2, document: v2Document(), answer_keys: KEYS, audio: {}, updated_at: 'x', ...overrides,
});

describe('staffLessonDocument: the v2 document as a learner is served it', () => {
  it('is answerless, projects the Mentor stage with the catalog default character, and says it is playable', () => {
    const doc = staffLessonDocument(row({ document: { ...v2Document(), answer_keys: { leak: true } } as never }), LESSON);
    expect(doc).toMatchObject({ locale: 'en-US', schemaVersion: 2, documentVersionId: VERSION, playable: true, mentorStage: { character: 'rho', scene: 'diorama-b' }, narrationAudio: {} });
    expect(doc.document).not.toHaveProperty('answer_keys');
    expect(doc.document).not.toHaveProperty('mentor_stage');
  });

  it('flags a document Core would not deliver (its rubric does not match) instead of hiding it', () => {
    const doc = staffLessonDocument(row({ answer_keys: {} }), LESSON);
    expect(doc).toMatchObject({ playable: false, mentorStage: null });
    expect(staffLessonDocument(row({ lesson_id: LESSON }), OTHER_LESSON).playable).toBe(false);
  });

  it('leaves a v1 row as the answerless v1 document with no version id and no v2 fields', () => {
    const doc = staffLessonDocument(row({ schema_version: 1, document: { schema_version: 1, segments: [{ id: 's1', type: 'mcq', answer: 2 }] } as never }), LESSON);
    expect(doc).toEqual({ locale: 'en-US', schemaVersion: 1, documentVersionId: null, audio: {}, document: { schema_version: 1, segments: [{ id: 's1', type: 'mcq' }] } });
  });

  it('checks a preview answer with the learner scorer; a v1 row or an unplayable one is never graded', () => {
    expect(gradeStaffPreview(row(), LESSON, 'allocate-01', { save: 4, spend: 8, share: 0 })).toEqual({ status: 'graded', verdict: { correct: true, score: 100 } });
    expect(gradeStaffPreview(row(), LESSON, 'allocate-01', { save: 3, spend: 8, share: 1 })).toMatchObject({ status: 'graded', verdict: { correct: false, score: 0 } });
    expect(gradeStaffPreview(row(), LESSON, 'allocate-01', { save: 'x' })).toEqual({ status: 'invalid' });
    expect(gradeStaffPreview(row(), LESSON, 'no-such-step', { save: 4, spend: 8, share: 0 })).toEqual({ status: 'invalid' });
    expect(gradeStaffPreview(row({ schema_version: 1 }), LESSON, 'allocate-01', {})).toEqual({ status: 'unplayable' });
    expect(gradeStaffPreview(row({ answer_keys: {} }), LESSON, 'allocate-01', {})).toEqual({ status: 'unplayable' });
  });
});

const versionPath = `/api/v1/admin/content/lessons/${LESSON}/versions/${VERSION}`;
const gradePath = `/api/v1/admin/content/lessons/${LESSON}/preview-grade`;

describe('GET /admin/content/lessons/:lessonId/versions/:versionId', () => {
  it('serves the pending version as a learner would get it, with no answer key', async () => {
    stub();
    const res = await request(createApp()).get(versionPath).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ lessonId: LESSON, documentVersionId: VERSION, locale: 'en-US', schemaVersion: 2, playable: true });
    expect(JSON.stringify(res.body.data)).not.toContain('minimumSave');
  });

  it('answers 404 for a version of another lesson or none, 502 when the read fails, 400 for a malformed id', async () => {
    stub({ version: { status: 200, body: [versionRow({ lesson_id: OTHER_LESSON })] } });
    expect((await request(createApp()).get(versionPath).set('Authorization', auth())).status).toBe(404);
    stub({ version: { status: 200, body: [] } });
    expect((await request(createApp()).get(versionPath).set('Authorization', auth())).status).toBe(404);
    stub({ version: { status: 500, body: null } });
    expect((await request(createApp()).get(versionPath).set('Authorization', auth())).status).toBe(502);
    stub();
    expect((await request(createApp()).get(`/api/v1/admin/content/lessons/${LESSON}/versions/x`).set('Authorization', auth())).status).toBe(400);
  });

  it('is refused before any document read for staff without manage_content and for a family account', async () => {
    for (const world of [{ permissions: ['view_analytics'] }, { roles: ['parent'] }]) {
      const calls = stub(world);
      expect((await request(createApp()).get(versionPath).set('Authorization', auth())).status).toBe(403);
      expect(calls.some((call) => call.url.includes('lesson_document'))).toBe(false);
    }
  });
});

describe('POST /admin/content/lessons/:lessonId/preview-grade', () => {
  it('checks the answer against the named version and records nothing', async () => {
    const calls = stub();
    const met = await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: { save: 4, spend: 8, share: 0 } });
    expect(met.status).toBe(200);
    expect(met.body.data).toEqual({ verdict: { correct: true, score: 100 }, recorded: false });
    const review = await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: { save: 3, spend: 8, share: 1 } });
    expect(review.body.data.verdict).toMatchObject({ correct: false, score: 0 });
    expect(calls.every((call) => call.method === 'GET')).toBe(true);
    expect(calls.some((call) => /v2_runs|lesson_grades|audit_logs|\/rpc\//.test(call.url))).toBe(false);
  });

  it('without a version id, checks the document a learner is served in that locale', async () => {
    const calls = stub();
    const res = await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', segment_id: 'allocate-01', answer: { save: 5, spend: 7, share: 0 } });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict.correct).toBe(true);
    expect(calls.some((call) => call.url.includes('lesson_document_version_current'))).toBe(true);
  });

  it('answers 404 for a locale or a version the lesson does not have', async () => {
    stub();
    expect((await request(createApp()).post(gradePath).set('Authorization', auth()).send({ locale: 'es-MX', segment_id: 'allocate-01', answer: {} })).status).toBe(404);
    stub({ version: { status: 200, body: [versionRow({ lesson_id: OTHER_LESSON })] } });
    expect((await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: {} })).status).toBe(404);
    stub({ version: { status: 200, body: [versionRow({ locale: 'pt-BR' })] } });
    expect((await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: {} })).status).toBe(404);
  });

  it('refuses to check a v1 lesson or one Core would not deliver (422), and an answer its scorer refuses (400)', async () => {
    stub({ current: { status: 200, body: [] }, v1: { status: 200, body: [{ lesson_id: LESSON, locale: 'en-US', schema_version: 1, document: { schema_version: 1, segments: [] }, answer_keys: {}, audio: {}, updated_at: 'x' }] } });
    expect((await request(createApp()).post(gradePath).set('Authorization', auth()).send({ locale: 'en-US', segment_id: 's1', answer: 1 })).status).toBe(422);
    stub({ version: { status: 200, body: [versionRow({ answer_keys: {} })] } });
    expect((await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: { save: 4, spend: 8, share: 0 } })).status).toBe(422);
    stub();
    const invalid = await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: { save: 'all' } });
    expect(invalid.status).toBe(400);
  });

  it('refuses a malformed body with no document read, and a read failure is a 502', async () => {
    const calls = stub();
    for (const body of [{ locale: 'fr-FR', segment_id: 'a', answer: 1 }, { locale: 'en-US', segment_id: 'a' }, { locale: 'en-US', segment_id: 'a', answer: 1, run_id: 'x' }]) {
      expect((await request(createApp()).post(gradePath).set('Authorization', auth()).send(body)).status).toBe(400);
    }
    expect(calls.some((call) => call.url.includes('lesson_document'))).toBe(false);
    stub({ version: { status: 500, body: null } });
    expect((await request(createApp()).post(gradePath).set('Authorization', auth())
      .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: {} })).status).toBe(502);
  });

  it('is refused for staff without manage_content and for a family account, before any document read', async () => {
    for (const world of [{ permissions: ['view_analytics', 'manage_support'] }, { roles: ['parent'] }]) {
      const calls = stub(world);
      const res = await request(createApp()).post(gradePath).set('Authorization', auth())
        .send({ locale: 'en-US', document_version_id: VERSION, segment_id: 'allocate-01', answer: { save: 4, spend: 8, share: 0 } });
      expect(res.status).toBe(403);
      expect(calls.some((call) => call.url.includes('lesson_document'))).toBe(false);
    }
  });
});
