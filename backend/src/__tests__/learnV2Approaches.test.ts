import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { LESSON_1_ID, makeDb } from './learnFixtures.js';
import { v2PublicLessonSchema, v2CompletionRequiredSegmentIds, v2ViewedSegmentIds, v2ApproachRefusal } from '../services/v2LessonDocument.js';

/*
 * GAP-FIX-R5 learning (Product 10 Block B "Age-band registers" autonomy
 * column; B.24): a 10-12 v2 lesson may offer two or three equally valid,
 * fully graded approach chains for one skill. The learner chooses one; Core
 * pins it on the run, grades and views only that chain, and completes through
 * it. Every refused population is pinned at the server boundary.
 */

let db: FakeDb;
let token: string;
const userId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  token = mintToken({ sub: userId });
  db = makeDb(userId);
  vi.stubGlobal('fetch', createFakeFetch(db));
});
afterEach(() => vi.unstubAllGlobals());
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

const intro = { id: 'intro-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Two ways to plan.', visual: { type: 'speech-plate' },
  payload: { role: 'intro', line: 'Pick the way you like to practise.' } };
const story = (id: string, scene: string) => ({ id, type: 'story.branch.v2', grading: 'server', prompt: 'What do you do?', visual: { type: 'story-scene' },
  payload: { scene, options: [{ id: 'opt-save', label: 'Save 4 coins' }, { id: 'opt-spend', label: 'Spend all now' }] } });
const approaches = { options: [
  { id: 'approach-list', label: 'Make a list', segment_ids: ['story-a'] },
  { id: 'approach-jars', label: 'Use jars', segment_ids: ['story-b'] },
] };

function document(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'saving-basics',
    lesson_id: LESSON_1_ID, version_id: 'approach-rev-001', locale: 'en-US', age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-saving-goal'],
    adventure_scene_id: 'diorama-a', title: 'Plan your saving',
    required_capabilities: ['visual.speech-plate.v1', 'visual.story-scene.v1', 'operation.choose-option.v1'],
    segments: [intro, story('story-a', 'List what you need first.'), story('story-b', 'Split coins into jars.')],
    approaches, mentor_stage: { character: 'dina', scene: 'diorama-a' },
    ...overrides,
  };
}
const keys = { 'story-a': { acceptable_choice_ids: ['opt-save'] }, 'story-b': { acceptable_choice_ids: ['opt-save'] } };

function activate(doc: unknown): void {
  const versionId = '99999999-9999-4999-8999-99999999ab01';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{ id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'approach-rev-001', schema_version: 2,
    document: doc, answer_keys: keys, audio: {}, created_at: '2026-09-22T12:00:00.000Z' }];
  const eleven = new Date();
  eleven.setUTCFullYear(eleven.getUTCFullYear() - 11);
  db.profiles[0]!.birth_date = eleven.toISOString().slice(0, 10);
}

describe('the approach choice in the v2 contract', () => {
  it('accepts two contiguous graded chains at 10-12 and completes through the chosen chain only', () => {
    const parsed = v2PublicLessonSchema.parse(document());
    expect(v2CompletionRequiredSegmentIds(parsed, 'approach-jars')).toEqual(['story-b']);
    expect(v2ViewedSegmentIds(parsed, 'approach-jars')).toEqual(['intro-01']);
    expect(v2ApproachRefusal(parsed, 'story-a', 'approach-jars')).toBe('APPROACH_MISMATCH');
    expect(v2ApproachRefusal(parsed, 'story-a', null)).toBe('APPROACH_REQUIRED');
    expect(v2ApproachRefusal(parsed, 'intro-01', null)).toBeNull();
  });

  it('refuses approaches in a 6-9 lesson, a chain with no graded step, a shared segment, an unknown segment and a single option', () => {
    const young = document({ age_band: '6-9', pathway_id: 'financial-young', eligibility: { minimum_age: 6, maximum_age: 9 } });
    const refused: Array<[string, unknown]> = [
      ['6-9', young],
      ['no graded step', document({ approaches: { options: [{ id: 'approach-talk', label: 'Talk it through', segment_ids: ['intro-01'] }, approaches.options[1]] } })],
      ['shared segment', document({ approaches: { options: [approaches.options[0], { ...approaches.options[1], segment_ids: ['story-a', 'story-b'] }] } })],
      ['unknown segment', document({ approaches: { options: [approaches.options[0], { ...approaches.options[1], segment_ids: ['story-z'] }] } })],
      ['one option', document({ approaches: { options: [approaches.options[0]] } })],
      ['duplicate label', document({ approaches: { options: [approaches.options[0], { ...approaches.options[1], label: 'make a list' }] } })],
    ];
    for (const [name, doc] of refused) expect(v2PublicLessonSchema.safeParse(doc).success, name).toBe(false);
  });
});

describe('POST /learn/lessons/:id/v2-runs/:runId/approach and the pinned chain', () => {
  it('grades and completes only the chain the learner pinned', async () => {
    activate(document());
    const app = createApp();
    const lesson = await auth(request(app).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(lesson.status, JSON.stringify(lesson.body)).toBe(200);
    expect(lesson.body.data.document.approaches.options.map((option: { id: string }) => option.id)).toEqual(['approach-list', 'approach-jars']);

    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.approach_id).toBeNull();
    const runId = started.body.data.run_id as string;
    const tokens = started.body.data.attempt_tokens as Record<string, string>;
    const grade = (segmentId: string) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`))
      .send({ segment_id: segmentId, run_id: runId, attempt_token: tokens[segmentId], answer: { choice: 'opt-save' } });
    const choose = (body: unknown) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/approach`)).send(body as object);
    const complete = () => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ run_id: runId, seconds_spent: 60, local_date: '2026-09-27' });

    // Before choosing: no chain step is graded, and nothing completes.
    const early = await grade('story-a');
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('APPROACH_REQUIRED');
    expect((await complete()).status).toBe(409);

    // Malformed, unknown, extra fields: refused, nothing pinned.
    for (const body of [{}, { approach_id: 'Bad Id!' }, { approach_id: 'approach-other' }, { approach_id: 'approach-jars', user_id: userId }]) {
      expect((await choose(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(db.lesson_v2_runs![0]!.approach_id).toBeUndefined();

    const chosen = await choose({ approach_id: 'approach-jars' });
    expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
    expect(chosen.body.data).toEqual({ approach_id: 'approach-jars' });
    // A replay of the same choice answers the same; a different later choice is refused.
    expect((await choose({ approach_id: 'approach-jars' })).status).toBe(200);
    const switched = await choose({ approach_id: 'approach-list' });
    expect(switched.status).toBe(409);
    expect(switched.body.error.code).toBe('APPROACH_CHOSEN');

    const other = await grade('story-a');
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe('APPROACH_MISMATCH');
    expect((await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/views`)).send({ segment_id: 'intro-01' })).status).toBe(200);
    const met = await grade('story-b');
    expect(met.status, JSON.stringify(met.body)).toBe(200);
    expect(met.body.data.verdict).toEqual({ correct: true, score: 100 });

    // The resumed run restores the pinned approach.
    const resumed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({ run_id: runId });
    expect(resumed.body.data.approach_id).toBe('approach-jars');

    const done = await complete();
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.data).toMatchObject({ passed: true, score: 100, graded_count: 1, viewed_count: 1 });

    // A completed run cannot take an approach.
    expect((await choose({ approach_id: 'approach-jars' })).status).toBe(409);
  });

  it('refuses another learner\'s run and a run id that is not a uuid', async () => {
    activate(document());
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const runId = started.body.data.run_id as string;
    db.lesson_v2_runs![0]!.user_id = '22222222-2222-4222-8222-222222222222';
    expect((await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/approach`)).send({ approach_id: 'approach-list' })).status).toBe(409);
    expect((await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/not-a-run/approach`)).send({ approach_id: 'approach-list' })).status).toBe(400);
    const anonymous = await request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/approach`).send({ approach_id: 'approach-list' });
    expect(anonymous.status).toBe(401);
  });

  it('a lesson without approaches is untouched: no approach_id on the run, and the route refuses a pick', async () => {
    const { approaches: _unused, ...plain } = document({ segments: [intro, story('story-a', 'List what you need first.')] });
    void _unused;
    activate(plain);
    db.lesson_document_versions![0]!.answer_keys = { 'story-a': keys['story-a'] };
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data).not.toHaveProperty('approach_id');
    const pick = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${started.body.data.run_id}/approach`)).send({ approach_id: 'approach-list' });
    expect(pick.status).toBe(400);
  });
});
