import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { LESSON_1_ID, makeDb } from './learnFixtures.js';
import { scoreV2Judgment, scoreV2Visual } from '../services/v2VisualScorer.js';
import { gradeV2Visual, validateV2LessonForGrading } from '../services/v2LessonDocument.js';
import { buildV2CompletionReceipt } from '../services/lessonCompletionReceipt.js';
import { placementFrame, PLACEMENT_RESULT_KEYS } from '../services/placementFraming.js';
import {
  DEFAULT_PRACTICE_BAND, bandWithinGuardRails, classifyJudgmentSignal, classifyPracticeBand,
} from '../services/learningQuality.js';
import { ZPD_TARGET } from '../services/pedagogy/sessionPlan.js';

/*
 * S05.3d adversarial contract tests: B.12 reasoning grading inside the v2
 * attempt architecture, B.5 replay receipts and the consent-gated notice
 * denominator, B.15 placement framing and B.19's staff calibration routes.
 * The SQL transactions are covered by database/scripts/test-learning-quality.sql
 * (physical PostgreSQL evidence is still open); these tests pin Core's
 * boundary: what it accepts, computes, stores and refuses.
 */

let db: FakeDb;
let userId: string;
let token: string;
beforeEach(() => {
  userId = '11111111-1111-4111-8111-111111111111';
  token = mintToken({ sub: userId });
  db = makeDb(userId);
  vi.stubGlobal('fetch', createFakeFetch(db));
});
afterEach(() => vi.unstubAllGlobals());
const auth = (req: request.Test, bearer = token) => req.set('Authorization', `Bearer ${bearer}`);

const payload = {
  choices: [{ id: 'save-first', label: 'Save 4 coins first' }, { id: 'spend-all', label: 'Spend all 12 now' }],
  reasonPrompt: 'Why?',
  reasons: [
    { id: 'reason-goal', label: 'It gets me closer to my goal' },
    { id: 'reason-feel', label: 'It feels good right now' },
    { id: 'reason-lucky', label: 'I just picked one' },
  ],
};
const rubric = {
  acceptableChoiceIds: ['save-first'],
  reasonQuality: { 'reason-goal': 'sound', 'reason-feel': 'partial', 'reason-lucky': 'unsupported' },
};
const scorerPayload = { choiceIds: ['save-first', 'spend-all'], reasonIds: ['reason-goal', 'reason-feel', 'reason-lucky'] };

function reasoningDocument() {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'saving-choices',
    lesson_id: LESSON_1_ID, version_id: 'reasoning-rev-001', locale: 'en-US', age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-saving-plan'],
    adventure_scene_id: 'diorama-a', title: 'Decide and say why',
    required_capabilities: ['visual.decision-card.v1', 'operation.choose-option.v1', 'operation.justify-choice.v1'],
    segments: [{ id: 'decide-01', type: 'reasoning.decide-justify.v2', grading: 'server', prompt: 'You have 12 coins.',
      visual: { type: 'decision-reasons' }, payload }],
  };
}

function activateReasoning(keys: unknown = { 'decide-01': rubric }): string {
  const versionId = '99999999-9999-4999-8999-99999999a001';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'reasoning-rev-001', schema_version: 2,
    document: reasoningDocument(), answer_keys: keys, audio: {}, created_at: '2026-09-24T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2014-09-22';
  return versionId;
}

describe('B.12 canonical reasoning scorer', () => {
  it('grades the decision and the reason independently', () => {
    const cases = [
      [{ choice: 'save-first', reason: 'reason-goal' }, 'met', 'sound'],
      [{ choice: 'save-first', reason: 'reason-lucky' }, 'met', 'unsupported'], // lucky guess
      [{ choice: 'spend-all', reason: 'reason-goal' }, 'review', 'sound'], // sound reasoning, wrong call
      [{ choice: 'spend-all', reason: 'reason-feel' }, 'review', 'partial'],
    ] as const;
    for (const [response, verdict, judgment] of cases) {
      expect(scoreV2Visual('reasoning.decide-justify.v2', scorerPayload, response, rubric)).toBe(verdict);
      expect(scoreV2Judgment('reasoning.decide-justify.v2', scorerPayload, response, rubric)).toBe(judgment);
    }
  });

  it('refuses malformed, smuggled and unknown responses', () => {
    for (const response of [
      { choice: 'save-first' },
      { choice: 'save-first', reason: 'reason-goal', judgment: 'sound' },
      { choice: 'keep', reason: 'reason-goal' },
      { choice: 'save-first', reason: 'save-first' },
      { choice: 3, reason: 'reason-goal' },
      null,
    ]) {
      expect(scoreV2Visual('reasoning.decide-justify.v2', scorerPayload, response, rubric)).toBe('invalid');
      expect(scoreV2Judgment('reasoning.decide-justify.v2', scorerPayload, response, rubric)).toBe('invalid');
    }
    expect(scoreV2Judgment('money.allocation.v2', { total: 10, step: 1 }, { save: 5, spend: 5, share: 0 }, { minimumSave: 2 })).toBe('invalid');
  });

  it('refuses a rubric that cannot disagree with correctness (correctness in disguise)', () => {
    const bad = [
      { ...rubric, reasonQuality: { 'reason-goal': 'sound', 'reason-feel': 'sound', 'reason-lucky': 'partial' } },
      { ...rubric, reasonQuality: { 'reason-goal': 'partial', 'reason-feel': 'partial', 'reason-lucky': 'unsupported' } },
      { ...rubric, acceptableChoiceIds: ['save-first', 'spend-all'] },
      { ...rubric, reasonQuality: { 'reason-goal': 'sound', 'reason-lucky': 'unsupported' } },
      { ...rubric, acceptableChoiceIds: ['keep'] },
      { ...rubric, extra: true },
    ];
    for (const key of bad) {
      expect(scoreV2Visual('reasoning.decide-justify.v2', scorerPayload, { choice: 'save-first', reason: 'reason-goal' }, key)).toBe('invalid');
    }
  });

  it('keeps the private rubric out of the public contract and requires it for grading', () => {
    const document = validateV2LessonForGrading(reasoningDocument(), { 'decide-01': rubric }, { lessonId: LESSON_1_ID, locale: 'en-US' });
    expect(document).not.toBeNull();
    expect(JSON.stringify(reasoningDocument())).not.toMatch(/sound|unsupported|acceptable/);
    expect(validateV2LessonForGrading(reasoningDocument(), {}, { lessonId: LESSON_1_ID, locale: 'en-US' })).toBeNull();
    expect(validateV2LessonForGrading(reasoningDocument(), { 'decide-01': { acceptableChoiceIds: ['save-first'], reasonQuality: { 'reason-goal': 'sound', 'reason-feel': 'sound', 'reason-lucky': 'sound' } } },
      { lessonId: LESSON_1_ID, locale: 'en-US' })).toBeNull();
    const duplicate = reasoningDocument();
    duplicate.segments[0]!.payload = { ...payload, reasons: [...payload.reasons.slice(0, 2), { id: 'save-first', label: 'Copy' }] };
    expect(validateV2LessonForGrading(duplicate, { 'decide-01': rubric }, { lessonId: LESSON_1_ID, locale: 'en-US' })).toBeNull();
    const graded = gradeV2Visual(document!, { 'decide-01': rubric }, 'decide-01', { choice: 'spend-all', reason: 'reason-goal' });
    expect(graded).toMatchObject({ score: 0, correct: false, judgment: 'sound' });
  });
});

describe('B.12 reasoning through the signed v2 attempt route', () => {
  it('records a judgment beside the score, never in it, and summarizes the first try on completion', async () => {
    activateReasoning();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(JSON.stringify(started.body)).not.toMatch(/reasonQuality|acceptableChoiceIds|unsupported/);
    const runId = started.body.data.run_id as string;

    // Sound reason, unacceptable decision: the Law 4 divergence the family exists to see.
    const first = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'decide-01', run_id: runId, attempt_token: started.body.data.attempt_tokens['decide-01'],
      answer: { choice: 'spend-all', reason: 'reason-goal' },
    });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ verdict: { correct: false, score: 0, judgment: { quality: 'sound' } }, retry_attempt_token: expect.any(String) });

    // A client cannot assert its own judgment: extra answer keys are not a response.
    const forged = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'decide-01', run_id: runId, attempt_token: first.body.data.retry_attempt_token,
      answer: { choice: 'save-first', reason: 'reason-lucky', judgment: 'sound' },
    });
    expect(forged.status).toBe(400);

    const second = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'decide-01', run_id: runId, attempt_token: first.body.data.retry_attempt_token,
      answer: { choice: 'save-first', reason: 'reason-lucky' },
    });
    expect(second.body.data).toEqual({ verdict: { correct: true, score: 100, judgment: { quality: 'unsupported' } }, replayed: false });
    const stored = (db.lesson_v2_grade_receipts ?? []).map((row) => row.verdict);
    expect(stored).toEqual([
      { correct: false, score: 0, judgment: { quality: 'sound' } },
      { correct: true, score: 100, judgment: { quality: 'unsupported' } },
    ]);

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ run_id: runId, seconds_spent: 95, local_date: '2026-09-24' });
    expect(complete.status).toBe(200);
    expect(complete.body.data.receipt).toMatchObject({
      first_try_correct: 0, graded_count: 1, awarded_xp: 20, duration_seconds: 95,
      judgment: { assessed: 1, sound: 1, partial: 0, unsupported: 0 },
    });
    // The judgment never becomes the score or the XP.
    expect(complete.body.data).toMatchObject({ score: 0, passed: true, xp_earned: 20 });
  });

  it('refuses another learner replaying the signed attempt', async () => {
    activateReasoning();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const intruderId = '12121212-1212-4212-8212-121212121212';
    db.profiles.push({ ...db.profiles[0]!, id: intruderId });
    db.account_age_declarations!.push({ user_id: intruderId, declared_age_band: '13_to_17' });
    const intruder = mintToken({ sub: intruderId });
    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`), intruder).send({
      segment_id: 'decide-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['decide-01'],
      answer: { choice: 'save-first', reason: 'reason-goal' },
    });
    expect([403, 404]).toContain(res.status);
    expect(db.lesson_v2_grade_receipts ?? []).toHaveLength(0);
  });

  it('refuses to start a reasoning run whose rubric cannot discriminate', async () => {
    activateReasoning({ 'decide-01': { ...rubric, reasonQuality: { 'reason-goal': 'sound', 'reason-feel': 'sound', 'reason-lucky': 'sound' } } });
    const started = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).not.toBe(200);
    expect(db.lesson_v2_runs ?? []).toHaveLength(0);
  });
});

describe('B.5 authenticated replay receipt and XP policy', () => {
  async function legacyRun(app: ReturnType<typeof createApp>, runId: string, option: 'a' | 'b') {
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: option }, attempt_number: 1, run_id: runId,
    });
    return auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60, run_id: runId, local_date: '2026-09-24' });
  }

  async function events(name: string) {
    for (let n = 0; n < 50; n++) {
      await new Promise((done) => setTimeout(done, 5));
      const rows = (db.learning_events ?? []).filter((row) => row.event === name);
      if (rows.length) return rows;
    }
    return [];
  }

  it('states the kept best on a lower replay, keeps best and XP, and pays nothing for repetition', async () => {
    db.user_roles = [{ user_id: userId, role: 'universal' }];
    db.teen_analytics_preferences = [{ user_id: userId, enabled: true, disclosure_version: 1 }];
    const app = createApp();
    const first = await legacyRun(app, 'aaaaaaaa-0000-4000-8000-000000000001', 'a');
    expect(first.body.data).toMatchObject({ score: 100, xp_delta: 20, replay: { kind: 'first', notice: 'none', previous_best_score: null, xp_policy: 'improvement_only' } });

    const lower = await legacyRun(app, 'aaaaaaaa-0000-4000-8000-000000000002', 'b');
    expect(lower.body.data).toMatchObject({
      score: 0, best_score: 100, xp_delta: 0, xp_earned: 20,
      replay: { kind: 'replay', notice: 'best_kept', previous_best_score: 100, best_score_kept: true, xp_policy: 'improvement_only' },
    });
    expect(db.lesson_progress.find((row) => row.lesson_id === LESSON_1_ID)).toMatchObject({ best_score: 100, passed: true, xp_earned: 20 });
    expect(db.learning_stats.find((row) => row.user_id === userId)?.xp_points).toBe(20);

    const denominator = await events('replay_below_best');
    expect(denominator).toHaveLength(1);
    expect(denominator[0]).toMatchObject({ lesson_id: LESSON_1_ID, route_class: 'learn' });

    // A lost response replays the stored receipt; it neither pays again nor double-counts the denominator.
    const again = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60, run_id: 'aaaaaaaa-0000-4000-8000-000000000002', local_date: '2026-09-24' });
    expect(again.body.data).toMatchObject({ xp_delta: 0, replay: { notice: 'best_kept' } });
    await new Promise((done) => setTimeout(done, 50));
    expect((db.learning_events ?? []).filter((row) => row.event === 'replay_below_best')).toHaveLength(1);
  });

  it('never records the denominator for a kid without guardian consent, or a teen who opted out', async () => {
    db.user_roles = [{ user_id: userId, role: 'kid' }];
    const app = createApp();
    await legacyRun(app, 'aaaaaaaa-0000-4000-8000-000000000011', 'a');
    const lower = await legacyRun(app, 'aaaaaaaa-0000-4000-8000-000000000012', 'b');
    expect(lower.body.data.replay.notice).toBe('best_kept');
    await new Promise((done) => setTimeout(done, 50));
    expect((db.learning_events ?? []).filter((row) => row.event === 'replay_below_best')).toHaveLength(0);

    db.user_roles = [{ user_id: userId, role: 'universal' }];
    db.teen_analytics_preferences = [{ user_id: userId, enabled: false, disclosure_version: 1 }];
    await legacyRun(app, 'aaaaaaaa-0000-4000-8000-000000000013', 'b');
    await new Promise((done) => setTimeout(done, 50));
    expect((db.learning_events ?? []).filter((row) => row.event === 'replay_below_best')).toHaveLength(0);
  });

  it('refuses a client-forged denominator on the events ingest but accepts the view event', async () => {
    db.user_roles = [{ user_id: userId, role: 'universal' }];
    db.teen_analytics_preferences = [{ user_id: userId, enabled: true, disclosure_version: 1 }];
    const res = await auth(request(createApp()).post('/api/v1/events'))
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36').send({ events: [
      { event: 'replay_below_best', routeClass: 'learn', lessonId: LESSON_1_ID },
      { event: 'replay_notice_view', routeClass: 'learn', lessonId: LESSON_1_ID },
    ] });
    expect(res.status).toBe(202);
    const stored = (db.learning_events ?? []).map((row) => row.event);
    expect(stored).toEqual(['replay_notice_view']);
  });

  it('builds no v2 receipt from a pre-migration completion (never invents numbers)', () => {
    const base = { score: 100, passed: true, best_score: 100, xp_earned: 20, xp_delta: 20, streak_days: 1, longest_streak: 1,
      streak_extended: true, first_today: true, minutes_learned: 1, lessons_completed: 1, first_completion: true, replayed: true };
    expect(buildV2CompletionReceipt({ completion: base, runId: 'r', document: { lesson_id: 'lesson-x', version_id: 'rev-1', locale: 'en-US' }, secondsSpent: 5 })).toBeNull();
  });
});

describe('B.15 placement outcome frame', () => {
  it('frames every path as prior exposure and never carries a score or comparison', () => {
    for (const method of ['adaptive_quiz', 'learner_chose_start', 'learner_adjusted', 'no_probe_content_fallback'] as const) {
      for (const credited of [[], ['l1']]) {
        const frame = placementFrame({ method, creditedLessonIds: credited });
        expect(frame).toEqual({ path: method, start: credited.length ? 'further_in' : 'beginning', basis: 'prior_exposure',
          learner_chosen: method === 'learner_chose_start' || method === 'learner_adjusted' });
      }
    }
    expect(PLACEMENT_RESULT_KEYS.join(',')).not.toMatch(/score|percent|rank|correct|compare|level/i);
  });
});

describe('B.19 practice success band', () => {
  it('classifies against the band only with enough evidence', () => {
    const band = { lowerPct: 70, upperPct: 85, minSample: 30 };
    expect(classifyPracticeBand({ firstAttempts: 29, successes: 29, ...band })).toBe('insufficient_sample');
    expect(classifyPracticeBand({ firstAttempts: 100, successes: 69, ...band })).toBe('below_band');
    expect(classifyPracticeBand({ firstAttempts: 100, successes: 70, ...band })).toBe('in_band');
    expect(classifyPracticeBand({ firstAttempts: 100, successes: 85, ...band })).toBe('in_band');
    expect(classifyPracticeBand({ firstAttempts: 100, successes: 86, ...band })).toBe('above_band');
  });

  it('keeps the guard rails away from the near-certain zone and the Mentor target inside the default band', () => {
    expect(bandWithinGuardRails(70, 85)).toBe(true);
    expect(bandWithinGuardRails(90, 99)).toBe(false);
    expect(bandWithinGuardRails(40, 60)).toBe(false);
    expect(bandWithinGuardRails(80, 82)).toBe(false);
    expect(ZPD_TARGET * 100).toBeGreaterThanOrEqual(DEFAULT_PRACTICE_BAND.lowerPct);
    expect(ZPD_TARGET * 100).toBeLessThanOrEqual(DEFAULT_PRACTICE_BAND.upperPct);
  });
});

describe('Appendix C thresholds computed by Core', () => {
  it('flags a judgment signal that only tracks correctness, once the sample is large enough', () => {
    expect(classifyJudgmentSignal({ attempts: 29, divergentShare: 0 })).toBe('insufficient_sample');
    expect(classifyJudgmentSignal({ attempts: 30, divergentShare: 0.05 })).toBe('tracks_correctness');
    expect(classifyJudgmentSignal({ attempts: 30, divergentShare: 0.1 })).toBe('distinct');
  });
});

describe('B.19 staff calibration routes', () => {
  const STAFF_ID = '22222222-2222-4222-8222-222222222222';
  const staff = mintToken({ sub: STAFF_ID });
  const REVIEW_ID = 'bbbbbbbb-0000-4000-8000-000000000001';

  function scriptReads() {
    db.__rpc = [
      { name: 'practice_success_band_metrics', body: [{ lesson_id: LESSON_1_ID, lesson_slug: 'lesson-1', lesson_title: { 'en-US': 'Lesson One' },
        first_attempts: 120, successes: 114, assisted: 3, success_pct: '95.0', lower_pct: 70, upper_pct: 85, min_sample: 30,
        band_scope: 'default', status: 'above_band', families: [{ family: 'legacy', first_attempts: 120, successes: 114 }] }] },
      { name: 'learning_judgment_differentiation', body: [{ lesson_id: LESSON_1_ID, attempts: 40, correct_sound: 20, correct_not_sound: 8,
        incorrect_sound: 5, incorrect_not_sound: 7, divergent_share: '0.3250', correlation: '0.3100' }] },
      { name: 'learning_replay_notice_display_rate', body: [{ below_best: 10, shown: 10, display_rate: '1.0000' }] },
      { name: 'sync_practice_difficulty_reviews', body: 1 },
      { name: 'resolve_practice_difficulty_review', body: { status: 'resolved' } },
      { name: 'set_practice_difficulty_band', body: { status: 'set', band: { lower_pct: 75, upper_pct: 88, min_sample: 30 } } },
    ];
    db.practice_difficulty_reviews = [{ id: REVIEW_ID, lesson_id: LESSON_1_ID, direction: 'above_band', window_days: 28,
      evidence: { current: { success_pct: 95 } }, status: 'open', decision: null, decision_note: null,
      opened_at: '2026-09-24T00:00:00Z', resolved_at: null }];
    db.practice_difficulty_bands = [{ lesson_id: null, lower_pct: 70, upper_pct: 85, min_sample: 30, rationale: 'Starting hypothesis', set_at: new Date().toISOString() }];
    db.practice_difficulty_band_log = [];
  }

  function grantStaff(permissions: string[]) {
    db.user_roles = [{ user_id: STAFF_ID, role: 'admin' }];
    db.admin_permissions = permissions.map((permission) => ({ user_id: STAFF_ID, permission }));
  }

  it('shows the tracked metric per lesson to the content team', async () => {
    grantStaff(['manage_content']);
    scriptReads();
    const res = await auth(request(createApp()).get('/api/v1/admin/content/learning-quality?days=28'), staff);
    expect(res.status).toBe(200);
    expect(res.body.data.lessons[0]).toMatchObject({ lesson_id: LESSON_1_ID, success_pct: 95, status: 'above_band' });
    expect(res.body.data.judgment[0]).toMatchObject({ divergent_share: 0.325, status: 'distinct' });
    expect(res.body.data.replayNotice).toEqual({ below_best: 10, shown: 10, display_rate: 1, target: 1, belowTarget: false });
    expect(res.body.data.defaultBand).toMatchObject({ lower_pct: 70, upper_pct: 85, reviewDue: false });
    expect(JSON.stringify(res.body)).not.toContain(userId);
  });

  it('refuses every non-content population: learner, parent, analytics-only staff, guest', async () => {
    scriptReads();
    db.user_roles = [{ user_id: userId, role: 'kid' }];
    expect((await auth(request(createApp()).get('/api/v1/admin/content/learning-quality'))).status).toBe(403);
    db.user_roles = [{ user_id: userId, role: 'parent' }];
    expect((await auth(request(createApp()).post('/api/v1/admin/content/learning-quality/bands')).send({ lessonId: null, lowerPct: 60, upperPct: 90, rationale: 'try something new' })).status).toBe(403);
    grantStaff(['view_analytics']);
    expect((await auth(request(createApp()).post(`/api/v1/admin/content/learning-quality/reviews/${REVIEW_ID}/resolve`), staff)
      .send({ decision: 'no_change', note: 'still reviewing it' })).status).toBe(403);
    const guest = mintToken({ sub: '13131313-1313-4313-8313-131313131313', is_anonymous: true });
    expect((await auth(request(createApp()).get('/api/v1/admin/content/learning-quality'), guest)).status).toBe(403);
    expect(db.__rpc_calls ?? []).toHaveLength(0);
  });

  it('records a decision with the verified staff actor and refuses bands outside the guard rails', async () => {
    grantStaff(['manage_content']);
    scriptReads();
    const app = createApp();
    const sync = await auth(request(app).post('/api/v1/admin/content/learning-quality/reviews/sync'), staff).send({});
    expect(sync.body.data).toEqual({ opened: 1 });

    const tooEasyBand = await auth(request(app).post('/api/v1/admin/content/learning-quality/bands'), staff)
      .send({ lessonId: LESSON_1_ID, lowerPct: 90, upperPct: 99, rationale: 'learners love it this easy' });
    expect(tooEasyBand.status).toBe(400);
    const missingNote = await auth(request(app).post(`/api/v1/admin/content/learning-quality/reviews/${REVIEW_ID}/resolve`), staff)
      .send({ decision: 'make_harder', note: 'short' });
    expect(missingNote.status).toBe(400);
    const bandWithoutAdjust = await auth(request(app).post(`/api/v1/admin/content/learning-quality/reviews/${REVIEW_ID}/resolve`), staff)
      .send({ decision: 'no_change', note: 'no change for now please', lowerPct: 70, upperPct: 85 });
    expect(bandWithoutAdjust.status).toBe(400);

    const resolved = await auth(request(app).post(`/api/v1/admin/content/learning-quality/reviews/${REVIEW_ID}/resolve`), staff)
      .send({ decision: 'make_harder', note: 'Add a transfer item and remove the hint.' });
    expect(resolved.status).toBe(200);
    const call = (db.__rpc_calls ?? []).find((row) => row.name === 'resolve_practice_difficulty_review');
    expect(call?.body).toMatchObject({ p_review_id: REVIEW_ID, p_actor: STAFF_ID, p_decision: 'make_harder', p_lower: null, p_upper: null });

    const band = await auth(request(app).post('/api/v1/admin/content/learning-quality/bands'), staff)
      .send({ lessonId: LESSON_1_ID, lowerPct: 75, upperPct: 88, rationale: 'Teen pathway: first tries trend higher.' });
    expect(band.status).toBe(200);
    expect((db.__rpc_calls ?? []).find((row) => row.name === 'set_practice_difficulty_band')?.body).toMatchObject({ p_actor: STAFF_ID, p_lesson_id: LESSON_1_ID });
  });

  it('maps a database refusal and an already resolved review to explicit errors', async () => {
    grantStaff(['manage_content']);
    scriptReads();
    db.__rpc = db.__rpc!.map((row) => row.name === 'resolve_practice_difficulty_review' ? { ...row, body: { status: 'already_resolved' } } : row);
    const res = await auth(request(createApp()).post(`/api/v1/admin/content/learning-quality/reviews/${REVIEW_ID}/resolve`), staff)
      .send({ decision: 'no_change', note: 'reviewed twice by mistake' });
    expect(res.status).toBe(409);
    db.__rpc = db.__rpc!.map((row) => row.name === 'set_practice_difficulty_band' ? { ...row, status: 400, body: { message: 'Content permission required' } } : row);
    const refused = await auth(request(createApp()).post('/api/v1/admin/content/learning-quality/bands'), staff)
      .send({ lessonId: null, lowerPct: 70, upperPct: 85, rationale: 'restating the default band' });
    expect(refused.status).toBe(403);
  });
});
