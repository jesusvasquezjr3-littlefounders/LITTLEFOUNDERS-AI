import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { LESSON_1_ID, TOPIC_ID, makeDb } from './learnFixtures.js';

/*
 * GAP-FIX-R1 learning (OD-17, OD-24, B.7, B.8, B.9): a normal authored v2
 * lesson mixes a Mentor turn, an explorable visual and a graded decision.
 * Core pins the run, records a view receipt for each non-scored step, grades
 * the decision, journals it, and completes only when every step is done.
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

function mixedDocument(segments: unknown[], capabilities: string[]) {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
    lesson_id: LESSON_1_ID, version_id: 'mixed-rev-001', locale: 'en-US', age_band: '6-9',
    eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-saving-goal'],
    adventure_scene_id: 'diorama-a', title: 'Save for a kite', required_capabilities: capabilities, segments,
    mentor_stage: { character: 'dina', scene: 'diorama-a' },
  };
}

const intro = { id: 'intro-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Meet your goal.', visual: { type: 'speech-plate' },
  payload: { role: 'intro', line: 'Let us save for a kite together.', narration: { mode: 'differentiated', script: 'Today we plan how to save for a kite, one week at a time.' } } };
const goal = { id: 'goal-01', type: 'visual.goal-bullet.v2', grading: 'none', prompt: 'Move the marker.', visual: { type: 'bullet' },
  payload: { minimum: 0, maximum: 40, target: 20, step: 5, initial: 0, currency: 'coins' },
  help: ['Look at the goal line.'] };
const decide = { id: 'story-01', type: 'story.branch.v2', grading: 'server', prompt: 'What do you do?', visual: { type: 'story-scene' },
  item_role: 'transfer', knowledge_component_id: 'kc-saving-goal', help: ['Think about the kite.', 'Saving gets you closer.'],
  payload: { scene: 'You have 12 coins. Do you save or spend?', options: [{ id: 'opt-save', label: 'Save 4 coins' }, { id: 'opt-spend', label: 'Spend all now' }] } };

function activate(document: unknown, keys: unknown, audio: Record<string, unknown> = {}): void {
  const versionId = '99999999-9999-4999-8999-99999999aa01';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{ id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'mixed-rev-001', schema_version: 2,
    document, answer_keys: keys, audio, created_at: '2026-09-22T12:00:00.000Z' }];
  db.profiles[0]!.birth_date = '2018-09-22';
}

const capabilities = ['visual.speech-plate.v1', 'visual.bullet.v1', 'operation.parameter-slider.v1', 'visual.story-scene.v1', 'operation.choose-option.v1'];

describe('mixed v2 documents (general player, version-pinned completion)', () => {
  it('delivers the adventure theme beside the stage and plays intro, visual and decision to completion', async () => {
    activate(mixedDocument([intro, goal, decide], capabilities), { 'story-01': { acceptable_choice_ids: ['opt-save', 'opt-spend'] } });
    const app = createApp();
    const lesson = await auth(request(app).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(lesson.status).toBe(200);
    expect(lesson.body.data).toMatchObject({ adventure_theme: 'archipelago', mentor_stage: { scene: 'diorama-a' } });
    expect(JSON.stringify(lesson.body.data.document)).not.toContain('acceptable_choice_ids');

    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(Object.keys(started.body.data.attempt_tokens)).toEqual(['story-01']);
    const runId = started.body.data.run_id as string;

    // Completion refuses while a non-scored step has no view receipt.
    const early = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ run_id: runId, seconds_spent: 60, local_date: '2026-09-27' });
    expect(early.status).toBe(409);

    // A graded step can never be "viewed" into completion; an unknown step is refused.
    for (const segmentId of ['story-01', 'nope-01']) {
      const refused = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/views`)).send({ segment_id: segmentId });
      expect(refused.status).toBe(400);
    }
    for (const segmentId of ['intro-01', 'goal-01']) {
      const viewed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/views`)).send({ segment_id: segmentId });
      expect(viewed.status).toBe(200);
    }

    db.__rpc = [{ name: 'record_learner_decisions', status: 200, body: null }];
    // More help steps than the ladder can hold is refused at the boundary.
    const tooMany = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'story-01', run_id: runId, attempt_token: started.body.data.attempt_tokens['story-01'], answer: { choice: 'opt-save' }, hints_used: 5,
    });
    expect(tooMany.status).toBe(400);
    const graded = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'story-01', run_id: runId, attempt_token: started.body.data.attempt_tokens['story-01'], answer: { choice: 'opt-save' }, hints_used: 2,
    });
    expect(graded.status).toBe(200);
    expect(graded.body.data.verdict).toEqual({ correct: true, score: 100 });
    // The stored receipt carries the signals the metrics read.
    expect(db.lesson_v2_grade_receipts![0]!.verdict).toMatchObject({ diagnostic: 'none', hints_used: 2, item_role: 'transfer', kc: 'kc-saving-goal' });
    // B.9: the v2 story decision reached the journal writer.
    const journal = (db.__rpc_calls ?? []).find((call) => call.name === 'record_learner_decisions');
    expect(journal?.body).toMatchObject({ p_decisions: [{ segment_id: 'story-01', segment_type: 'story_branch', choice_id: 'opt-save', choice_text: 'Save 4 coins' }] });

    // A resumed run restores the viewed steps.
    const resumed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({ run_id: runId });
    expect(resumed.body.data.viewed_segment_ids.sort()).toEqual(['goal-01', 'intro-01']);

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ run_id: runId, seconds_spent: 60, local_date: '2026-09-27' });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ passed: true, score: 100, graded_count: 1, viewed_count: 2, hints_used: 2 });
    expect(complete.body.data.receipt).toMatchObject({ graded_count: 1, viewed_count: 2, hints_used: 2 });
  });

  it('completes a visual-only lesson from view receipts alone (score 100, no graded step)', async () => {
    activate(mixedDocument([intro, goal], ['visual.speech-plate.v1', 'visual.bullet.v1', 'operation.parameter-slider.v1']), {});
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.attempt_tokens).toEqual({});
    const runId = started.body.data.run_id as string;
    for (const segmentId of ['intro-01', 'goal-01']) {
      await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${runId}/views`)).send({ segment_id: segmentId });
    }
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ run_id: runId, seconds_spent: 30, local_date: '2026-09-27' });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ passed: true, score: 100, graded_count: 0, viewed_count: 2 });
  });

  it('B.18 (GAP-FIX-R3): resolves each differentiated narration audio_ref against the audio manifest, prompt audio only', async () => {
    const voiced = { ...intro, payload: { ...intro.payload, narration: { ...intro.payload.narration, audio_ref: 'intro-01-voice' } } };
    const wrap = { ...intro, id: 'wrap-01', payload: { role: 'wrap', line: 'Good plan.', narration: { mode: 'differentiated', script: 'You planned four weeks of saving for the kite.', audio_ref: 'wrap-01-voice' } } };
    const unsafe = { ...intro, id: 'bridge-01', payload: { role: 'transition', line: 'Next, choose.', narration: { mode: 'differentiated', script: 'Now you choose what to do with your twelve coins.', audio_ref: 'bridge-01-voice' } } };
    activate(mixedDocument([voiced, unsafe, decide, wrap], ['visual.speech-plate.v1', 'visual.story-scene.v1', 'operation.choose-option.v1']), { 'story-01': { acceptable_choice_ids: ['opt-save'] } },
      { 'intro-01-voice': 'https://cdn.littlefounders.test/audio/intro-01.mp3', 'bridge-01-voice': 'javascript:alert(1)', 'story-01': 'https://cdn.littlefounders.test/audio/story.mp3' });
    const lesson = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(lesson.status).toBe(200);
    // The wrap's ref is not in the manifest (text-only fallback); the unsafe value and the graded segment never resolve.
    expect(lesson.body.data.narration_audio).toEqual({ 'intro-01': 'https://cdn.littlefounders.test/audio/intro-01.mp3' });
    activate(mixedDocument([intro, decide], ['visual.speech-plate.v1', 'visual.story-scene.v1', 'operation.choose-option.v1']), { 'story-01': { acceptable_choice_ids: ['opt-save'] } });
    const silent = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(silent.body.data).not.toHaveProperty('narration_audio');
  });

  it('refuses a segment knowledge component outside the document list, and a stray view body field', async () => {
    activate(mixedDocument([{ ...decide, knowledge_component_id: 'kc-other' }], ['visual.story-scene.v1', 'operation.choose-option.v1']),
      { 'story-01': { acceptable_choice_ids: ['opt-save'] } });
    const app = createApp();
    const lesson = await auth(request(app).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(lesson.status).toBe(422);
    activate(mixedDocument([intro, goal], ['visual.speech-plate.v1', 'visual.bullet.v1', 'operation.parameter-slider.v1']), {});
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const stray = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs/${started.body.data.run_id}/views`)).send({ segment_id: 'intro-01', score: 100 });
    expect(stray.status).toBe(400);
  });

  function evidenceSwitches(engine: 'linear' | 'pathway', evidence: 'off' | 'on' | undefined): void {
    vi.stubEnv('COURSE_PATHWAY_ENGINE', engine);
    if (evidence) vi.stubEnv('COURSE_LESSON_EVIDENCE', evidence);
    resetConfigForTests();
  }
  afterEach(() => { vi.unstubAllEnvs(); resetConfigForTests(); });

  async function gradeOnce(): Promise<Array<Record<string, unknown>>> {
    const kcId = 'abababab-abab-4bab-8bab-abababababab';
    db.topic_knowledge_components = [{ topic_id: TOPIC_ID, kc_id: kcId, role: 'teaches', is_primary: true }];
    db.kc = [{ id: kcId, key: 'saving-goal', strand: 'money', title: { 'en-US': 'Saving goal' }, objective: {}, tier_min: 1, p_l0: 0.2, p_t: 0.15, p_g: 0.2, p_s: 0.1,
      skill_key: null, status: 'active' }];
    db.learner_kc_mastery = []; db.memory_card = []; db.misconception = []; db.kc_attempt = [];
    activate(mixedDocument([decide], ['visual.story-scene.v1', 'operation.choose-option.v1']), { 'story-01': { acceptable_choice_ids: ['opt-save'] } });
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const body = { segment_id: 'story-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['story-01'], answer: { choice: 'opt-save' } };
    expect((await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send(body)).status).toBe(200);
    return db.kc_attempt as Array<Record<string, unknown>>;
  }

  it('P-09 / D-06: under the default linear engine a course grade writes no Mentor evidence, even with the calibration switch on', async () => {
    evidenceSwitches('linear', undefined);
    expect(await gradeOnce()).toHaveLength(0);
    evidenceSwitches('linear', 'on');
    expect(await gradeOnce()).toHaveLength(0);
    expect(db.learner_kc_mastery).toHaveLength(0);
    expect(db.memory_card).toHaveLength(0);
  });
});
