import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { mintToken } from '../helpers.js';
import { createFakeFetch, type FakeDb } from '../fakePostgrest.js';
import { LESSON_1_ID, makeDb } from '../learnFixtures.js';
import { SIM1_CAPABILITIES } from '../../services/horizonte/sim1/capabilities.js';
import { SIM1_FIXTURES } from '../../services/horizonte/sim1/fixtures.js';

/*
 * F3.0 over HTTP: a seeded segment gets its seed beside its attempt token on start, the same seed on resume,
 * a fresh seed with the retry token on a miss, and Core grades by replaying the seed derived from the VERIFIED
 * token, never one the browser names.
 */

let db: FakeDb;
let token: string;
const userId = '11111111-1111-4111-8111-111111111111';
const SEGMENT = 'chance-coin-heads';
const HEX = /^[0-9a-f]{64}$/;

beforeEach(() => {
  token = mintToken({ sub: userId });
  db = makeDb(userId);
  vi.stubGlobal('fetch', createFakeFetch(db));
});
afterEach(() => vi.unstubAllGlobals());
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

const intro = { id: 'intro-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Meet the coin.', visual: { type: 'speech-plate' },
  payload: { role: 'intro', line: 'Let us flip a coin together.', narration: { mode: 'differentiated', script: 'Today we flip a coin many times and watch what happens to the share of heads.' } } };

function activate(): void {
  const entry = SIM1_FIXTURES.find((fixture) => fixture.id === SEGMENT)!;
  const document = {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'horizonte-sim', chapter_id: 'horizonte-sim1', lesson_id: LESSON_1_ID,
    version_id: 'seed-rev-001', locale: 'en-US', age_band: entry.ageBand, eligibility: entry.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'],
    adventure_scene_id: 'diorama-a', title: entry.title['en-US'], mentor_stage: { character: 'dina', scene: 'diorama-a' },
    required_capabilities: ['visual.speech-plate.v1', ...SIM1_CAPABILITIES['math.chance-sim.v2']], segments: [intro, entry.segment('en-US')],
  };
  const versionId = '99999999-9999-4999-8999-99999999aa02';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{ id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'seed-rev-001', schema_version: 2,
    document, answer_keys: { [SEGMENT]: entry.rubric }, audio: {}, created_at: '2026-09-22T12:00:00.000Z' }];
  const born = new Date();
  born.setUTCFullYear(born.getUTCFullYear() - 11);
  db.profiles[0]!.birth_date = born.toISOString().slice(0, 10);
}

const start = (app: ReturnType<typeof createApp>, body: Record<string, unknown> = {}) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send(body);
const grade = (app: ReturnType<typeof createApp>, runId: string, attemptToken: string, answer: unknown) =>
  auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({ segment_id: SEGMENT, run_id: runId, attempt_token: attemptToken, answer });

describe('F3.0 attempt seeds over the lesson routes', () => {
  it('issues a seed only for the seeded segment, beside its token, and keeps it out of the lesson document', async () => {
    activate();
    const app = createApp();
    const lesson = await auth(request(app).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(lesson.status).toBe(200);
    expect(JSON.stringify(lesson.body.data)).not.toMatch(/attempt_seed|"seed"|"target"/);

    const started = await start(app);
    expect(started.status).toBe(200);
    expect(Object.keys(started.body.data.attempt_tokens)).toEqual([SEGMENT]);
    expect(Object.keys(started.body.data.attempt_seeds)).toEqual([SEGMENT]);
    expect(started.body.data.attempt_seeds[SEGMENT]).toMatch(HEX);
    expect(started.body.data.attempt_tokens[SEGMENT]).not.toContain(started.body.data.attempt_seeds[SEGMENT]);
  });

  it('gives a resumed run the same seed, and a second run its own', async () => {
    activate();
    const app = createApp();
    const first = await start(app);
    const runId = first.body.data.run_id as string;
    const resumed = await start(app, { run_id: runId });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.resumed).toBe(true);
    expect(resumed.body.data.attempt_seeds[SEGMENT]).toBe(first.body.data.attempt_seeds[SEGMENT]);
    const again = await start(app);
    expect(again.body.data.run_id).not.toBe(runId);
    expect(again.body.data.attempt_seeds[SEGMENT]).toMatch(HEX);
    expect(again.body.data.attempt_seeds[SEGMENT]).not.toBe(first.body.data.attempt_seeds[SEGMENT]);
  });

  it('grades the run by the seed of the verified token and refuses a seed the browser names', async () => {
    activate();
    const app = createApp();
    const started = await start(app);
    const runId = started.body.data.run_id as string;
    const seed = started.body.data.attempt_seeds[SEGMENT] as string;
    const attemptToken = started.body.data.attempt_tokens[SEGMENT] as string;
    const other = SIM1_FIXTURES.find((entry) => entry.id === SEGMENT)!.seed as string;

    // A seed that is not this attempt's, a run length that is not a stop and a malformed answer are all refused outright.
    expect((await grade(app, runId, attemptToken, { seed: other, trials: 5000 })).status).toBe(400);
    expect((await grade(app, runId, attemptToken, { seed, trials: 7 })).status).toBe(400);
    expect((await grade(app, runId, attemptToken, { seed, trials: 5000, extra: 1 })).status).toBe(400);
    expect((await grade(app, runId, attemptToken, { trials: 5000 })).status).toBe(400);
    expect(db.lesson_v2_grade_receipts ?? []).toEqual([]);

    // A run not started is no answer yet, so it is refused too. A short run is a miss that costs nothing, and the miss hands back
    // a fresh token and a fresh seed.
    expect((await grade(app, runId, attemptToken, { seed, trials: 0 })).status).toBe(400);
    const short = await grade(app, runId, attemptToken, { seed, trials: 10 });
    expect(short.status).toBe(200);
    expect(short.body.data.verdict).toMatchObject({ correct: false, score: 0, diagnostic: 'value' });
    const retryToken = short.body.data.retry_attempt_token as string;
    const retrySeed = short.body.data.retry_attempt_seed as string;
    expect(retryToken).toBeTruthy();
    expect(retrySeed).toMatch(HEX);
    expect(retrySeed).not.toBe(seed);

    // The old seed no longer opens the retry token; the new one does, and a full run meets the key.
    expect((await grade(app, runId, retryToken, { seed, trials: 5000 })).status).toBe(400);
    const met = await grade(app, runId, retryToken, { seed: retrySeed, trials: 5000 });
    expect(met.status).toBe(200);
    expect(met.body.data.verdict).toEqual({ correct: true, score: 100 });
    expect(met.body.data.retry_attempt_seed).toBeUndefined();
    expect(met.body.data.retry_attempt_token).toBeUndefined();
  });

  it('refuses a token from another run: its seed belongs to that token alone', async () => {
    activate();
    const app = createApp();
    const first = await start(app);
    const second = await start(app);
    const seedOfFirst = first.body.data.attempt_seeds[SEGMENT] as string;
    const refused = await grade(app, second.body.data.run_id as string, first.body.data.attempt_tokens[SEGMENT] as string, { seed: seedOfFirst, trials: 5000 });
    expect(refused.status).toBe(403);
    // The second run's own token with the first run's seed is a seed mismatch.
    const crossed = await grade(app, second.body.data.run_id as string, second.body.data.attempt_tokens[SEGMENT] as string, { seed: seedOfFirst, trials: 5000 });
    expect(crossed.status).toBe(400);
  });
});
