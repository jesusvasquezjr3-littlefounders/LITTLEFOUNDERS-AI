import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigForTests } from '../config.js';
import { courseLessonEvidenceEnabled, courseReceiptKey, recordCourseLessonEvidence } from '../services/pedagogy/courseLessonEvidence.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { TOPIC_ID, makeDb } from './learnFixtures.js';

/*
 * GAP-FIX-R3 learning (owner review P-09; D-06; OD-22): a course lesson feeds
 * the Mentor's mastery model only after the B.6 pathway policy is accepted
 * (COURSE_PATHWAY_ENGINE = 'pathway') and the calibration switch
 * COURSE_LESSON_EVIDENCE is 'on'. The gate sits at the single entry point, so
 * both the v2 grade and the v1 completion paths obey it.
 */

const userId = '11111111-1111-4111-8111-111111111111';
const kcId = 'abababab-abab-4bab-8bab-abababababab';
let db: FakeDb;

function switches(engine: 'linear' | 'pathway' | undefined, evidence: 'off' | 'on' | undefined): void {
  vi.unstubAllEnvs();
  if (engine) vi.stubEnv('COURSE_PATHWAY_ENGINE', engine);
  if (evidence) vi.stubEnv('COURSE_LESSON_EVIDENCE', evidence);
  resetConfigForTests();
}

beforeEach(() => {
  db = makeDb(userId);
  db.topic_knowledge_components = [{ topic_id: TOPIC_ID, kc_id: kcId, role: 'teaches', is_primary: true }];
  db.kc = [{ id: kcId, key: 'saving-goal', strand: 'money', title: { 'en-US': 'Saving goal' }, objective: {}, tier_min: 1, p_l0: 0.2, p_t: 0.15, p_g: 0.2, p_s: 0.1,
    skill_key: null, status: 'active' }];
  db.learner_kc_mastery = []; db.memory_card = []; db.misconception = []; db.kc_attempt = [];
  vi.stubGlobal('fetch', createFakeFetch(db));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetConfigForTests(); });

const evidence = (receipt: string) => recordCourseLessonEvidence({ userId, topicId: TOPIC_ID, receiptKey: courseReceiptKey('v2', receipt), score: 100 });

describe('course-lesson evidence gate (P-09 after policy acceptance and calibration)', () => {
  it('defaults to off: the linear engine and a missing switch record nothing', async () => {
    switches(undefined, undefined);
    expect(courseLessonEvidenceEnabled()).toBe(false);
    expect(await evidence('nonce-aaaaaaaa')).toBe('disabled');
    expect(db.kc_attempt).toHaveLength(0);
  });

  it('refuses every partial population: linear + on, pathway + off, pathway + missing switch', async () => {
    for (const [engine, on] of [['linear', 'on'], ['pathway', 'off'], ['pathway', undefined], ['linear', 'off']] as const) {
      switches(engine, on);
      expect(courseLessonEvidenceEnabled()).toBe(false);
      expect(await evidence(`nonce-${engine}-${on ?? 'unset'}`)).toBe('disabled');
    }
    expect(db.kc_attempt).toHaveLength(0);
    expect(db.learner_kc_mastery).toHaveLength(0);
    expect(db.memory_card).toHaveLength(0);
  });

  it('pathway + on writes one idempotent course_lesson row per receipt', async () => {
    switches('pathway', 'on');
    expect(courseLessonEvidenceEnabled()).toBe(true);
    const first = await evidence('nonce-bbbbbbbb');
    expect(first).not.toBe('disabled');
    expect(first).not.toBeNull();
    expect(await evidence('nonce-bbbbbbbb')).toBe('duplicate');
    const attempts = db.kc_attempt as Array<Record<string, unknown>>;
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ kc_id: kcId, source: 'course_lesson', correct: true, receipt_key: 'v2:nonce-bbbbbbbb' });
    expect(Number((db.learner_kc_mastery as Array<Record<string, unknown>>)[0]?.p_known)).toBeGreaterThan(0.2);
  });
});
