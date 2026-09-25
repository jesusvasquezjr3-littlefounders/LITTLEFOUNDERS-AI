import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestratorSnapshotSchema, TutorOrchestrator } from '../tutor/orchestrator.js';
import type { KcState, SessionContext, SessionPlanEntry } from '../core/client.js';
import type { DialogueCalibration } from '../tutor/dialogueCalibration.js';
import type { SpeechResult } from '../voice/speech.js';

/*
 * C.11 (two-tier spaced review) and C.17 (age-band dialogue calibration) end
 * to end through the REAL turn pipeline, with the network stubbed at `fetch`
 * only (the seam `allianceSession.test.ts` uses). Both are ON here (`act`,
 * the production default); the older suites run with them off
 * (`test-setup.ts`).
 *
 * Adult sessions (isMinor false) keep every model call a Mentor turn: the
 * moderation posture is orthogonal to the register, which follows the band.
 */

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const entry = (kcId: string, skillKey: string, pKnown: number, objective: string): SessionPlanEntry => ({
  kcId,
  kcKey: `money.${skillKey}`,
  skillKey,
  reason: 'frontier',
  pKnown,
  targetDifficulty: 3,
  objective,
  prereqKcIds: [],
  misconceptions: [],
});
const KC_STATES: KcState[] = [{ kcId: A, kcKey: 'money.skill-a', pKnown: 0.9, attempts: 3 }];

const BASE: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 3,
  locale: 'en-US',
  nickname: 'Robi',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'course_topic',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: false,
  voiceConsent: true,
  intelDegraded: false,
};
const PLANNED: SessionContext = {
  ...BASE,
  sessionPlan: [
    entry(A, 'skill-a', 0.9, 'Give change by counting up from the price.'),
    entry(B, 'skill-b', 0.4, 'Split a budget into needs and wants.'),
  ],
  kcStates: KC_STATES,
};
const calibrated = (band: DialogueCalibration['band'], extra: Partial<DialogueCalibration> = {}): DialogueCalibration => ({
  band,
  variant: 'calibrated',
  assignment: band === 'adult' ? 'experiment' : 'not_eligible',
  experimentId: band === 'adult' ? '44444444-4444-4444-8444-444444444444' : null,
  ...extra,
});

const TURN = {
  say: 'Good thinking. How much would you save in four weeks?',
  emotion: 'happy',
  action: 'nod',
  next: 'ask',
  segmentRequest: null,
  offerAdaptation: null,
  savePlan: false,
};
function modelReplies(payload: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { prompt_tokens: 100, completion_tokens: 40 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
let n = 0;
const SUBJECTS = ['piggy bank', 'lemonade stand', 'bike fund', 'birthday gift', 'comic book', 'garden seeds', 'kite shop', 'bus fare', 'book fair', 'soccer ball', 'paint set', 'field trip', 'puzzle box', 'movie night', 'bake sale', 'yo-yo'];
const VERBS = ['Think about', 'Picture', 'Consider', 'Look again at', 'Remember', 'Imagine', 'Try', 'Check'];
const uniqueTurn = (extra: Record<string, unknown> = {}) => {
  n += 1;
  return modelReplies({ ...TURN, say: `${VERBS[n % VERBS.length]} the ${SUBJECTS[n % SUBJECTS.length]}. What would you do first?`, ...extra });
};
const silent = async (): Promise<SpeechResult> => ({ url: null, source: 'unavailable', billedChars: 0, wordTimings: null });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.TUTOR_SPACED_REVIEW = 'act';
  process.env.TUTOR_DIALOGUE_CALIBRATION = 'act';
  fetchMock = vi.fn(async () => uniqueTurn());
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MODEL_API_KEY;
  process.env.TUTOR_SPACED_REVIEW = 'off';
  process.env.TUTOR_DIALOGUE_CALIBRATION = 'off';
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

const bodies = () => fetchMock.mock.calls.map((call) => String(call[1]?.body ?? ''));
const lastModelBody = () => bodies().at(-1) ?? '';
let seg = 0;
async function answer(o: TutorOrchestrator, skillKey: string, correct: boolean): Promise<void> {
  seg += 1;
  const id = `seg-${seg}`;
  o.noteSegmentServed(id, skillKey, 'sort_buckets', 'Sort these into the right boxes.');
  await o.handleSegmentResult(id, correct ? 100 : 20, correct, Date.now());
}

describe('C.11 — the within-session tier brings a shaky answer back after a short gap', () => {
  it('a near-threshold miss is queued, re-checked after the plan moved on, and handed off at close if not retired', async () => {
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false); // turn 1: the miss on A (belief 0.9 before it)
    await answer(o, 'skill-a', true); // turn 2: massed, not counted
    await answer(o, 'skill-a', true); // turn 3: corroborated mastery → the plan moves to B
    expect(o.activeKcId).toBe(B);
    expect(o.spacedReviewReport.decisions).toEqual([
      expect.objectContaining({ kcId: A, tier: 'within_session', reason: 'near_threshold', source: 'first_miss', pBefore: 0.9 }),
    ]);

    // Turn 4: a conversational turn with nothing higher owning it — the gap has elapsed.
    await o.handleLearnerText('ok, what is next', Date.now());
    expect(lastModelBody()).toContain('IN-SESSION REVIEW:');
    expect(lastModelBody()).toContain('Give change by counting up from the price.');
    expect(o.activeKcId).toBe(A);
    expect(o.activeSkillKey).toBe('skill-a');
    expect(o.activeStrategy).toBe('SPACED');
    expect(o.spacedReviewReport.detoursOpened).toBe(1);

    // The re-check comes back correct: the detour closes, the plan pointer never moved.
    await answer(o, 'skill-a', true);
    expect(lastModelBody()).toContain('IN-SESSION REVIEW RESULT');
    expect(lastModelBody()).toContain('got it right');
    expect(o.activeKcId).toBe(B);
    // 1 spaced success − 1 miss = 0: not yet retired, so the close hands it off.
    const record = o.closeRecord('completed');
    expect(record.spacedReview?.mode).toBe('act');
    expect(record.spacedReview?.decisions[0]).toMatchObject({ kcId: A, outcome: 'session_ended', successes: 1, failures: 1 });
  });

  it('two spaced successes retire it', async () => {
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false);
    await answer(o, 'skill-a', true);
    await answer(o, 'skill-a', true);
    await o.handleLearnerText('ok', Date.now());
    await answer(o, 'skill-a', true); // first re-check
    for (const text of ['sure', 'fine', 'go on']) await o.handleLearnerText(text, Date.now());
    expect(o.activeKcId).toBe(A); // the second re-check opened after another gap
    await answer(o, 'skill-a', true);
    expect(o.spacedReviewReport.decisions[0]).toMatchObject({ outcome: 'retired', successes: 2 });
    expect(o.spacedReviewReport.detoursOpened).toBe(2);
  });

  it('a miss minutes before the wrap-up is handed to the cross-session scheduler — never crammed', async () => {
    const startedAt = Date.now() - 12 * 60_000; // 3 minutes before the 15-minute wrap-up
    const o = new TutorOrchestrator(PLANNED, startedAt, silent);
    await answer(o, 'skill-a', false);
    expect(o.spacedReviewReport.decisions).toEqual([
      expect.objectContaining({ tier: 'cross_session', reason: 'time_budget', outcome: 'handed_off' }),
    ]);
    for (const text of ['ok', 'sure', 'fine', 'go on']) await o.handleLearnerText(text, Date.now());
    expect(bodies().some((b) => b.includes('IN-SESSION REVIEW'))).toBe(false);
  });

  it('a miss far below the threshold is teaching, not review: handed off, no detour', async () => {
    const o = new TutorOrchestrator({ ...PLANNED, sessionPlan: [entry(B, 'skill-b', 0.2, 'Split a budget.')], kcStates: [] }, Date.now(), silent);
    await answer(o, 'skill-b', false);
    expect(o.spacedReviewReport.decisions[0]).toMatchObject({ tier: 'cross_session', reason: 'far_from_threshold' });
  });

  it("Core's shadow verdict records every decision and never opens a re-check", async () => {
    const o = new TutorOrchestrator({ ...PLANNED, spacedReviewMode: 'shadow' }, Date.now(), silent);
    await answer(o, 'skill-a', false);
    await answer(o, 'skill-a', true);
    await answer(o, 'skill-a', true);
    for (const text of ['ok', 'sure', 'fine']) await o.handleLearnerText(text, Date.now());
    expect(bodies().some((b) => b.includes('IN-SESSION REVIEW'))).toBe(false);
    expect(o.spacedReviewReport).toMatchObject({ mode: 'shadow', detoursOpened: 0 });
    expect(o.spacedReviewReport.decisions[0]).toMatchObject({ tier: 'within_session' });
  });

  it('a check-in or other higher directive keeps its turn; the re-check waits', async () => {
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false);
    await answer(o, 'skill-a', true);
    await answer(o, 'skill-a', true);
    // A help request is the ladder's turn, not a re-check's.
    await o.handleLearnerText('I need help', Date.now());
    expect(lastModelBody()).not.toContain('IN-SESSION REVIEW:');
    await o.handleLearnerText('ok', Date.now());
    expect(lastModelBody()).toContain('IN-SESSION REVIEW:');
  });

  it('never opens while an activity for the main KC is still on screen: its grade stays with the KC it was served for', async () => {
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false);
    await answer(o, 'skill-a', true);
    await answer(o, 'skill-a', true);
    o.noteSegmentServed('seg-open-b', 'skill-b', 'sort_buckets', 'Sort these.');
    await o.handleLearnerText('ok', Date.now());
    expect(lastModelBody()).not.toContain('IN-SESSION REVIEW:');
    expect(o.activeKcId).toBe(B);
    await o.handleSegmentResult('seg-open-b', 100, true, Date.now());
    // The graded activity was B's; the re-check opens on the turn after it.
    expect(o.trajectorySteps.at(-1)?.kcId).toBe(B);
    expect(lastModelBody()).toContain('IN-SESSION REVIEW:');
  });

  it('the queue and the open detour survive a cross-replica resume', async () => {
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false);
    await answer(o, 'skill-a', true);
    await answer(o, 'skill-a', true);
    await o.handleLearnerText('ok', Date.now());
    const snapshot = OrchestratorSnapshotSchema.parse(JSON.parse(JSON.stringify(o.snapshot())));
    const restored = TutorOrchestrator.restore(snapshot, PLANNED, o.startedAt, silent);
    expect(restored.activeKcId).toBe(A);
    expect(restored.spacedReviewReport).toEqual(o.spacedReviewReport);
    // A snapshot parked by the previous build (no router, no detour) restores clean.
    const legacy = { ...snapshot } as Record<string, unknown>;
    delete legacy.spacedReview;
    delete legacy.dialogueCalibration;
    expect(() => OrchestratorSnapshotSchema.parse(legacy)).not.toThrow();
  });

  it('the close record carries ids, labels and numbers only — never the learner’s words', async () => {
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false);
    await o.handleLearnerText('my secret word is banana', Date.now());
    const text = JSON.stringify(o.closeRecord('completed').spacedReview);
    expect(text).not.toContain('banana');
    expect(text).not.toMatch(/nickname|Robi|user/i);
  });
});

describe('C.17 — the register follows the band, and the band never reaches the model context', () => {
  it('the teen register: autonomy-supportive note on every turn, controlling language repaired once', async () => {
    const o = new TutorOrchestrator({ ...BASE, dialogueCalibration: calibrated('teen') }, Date.now(), silent);
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'You have to divide the money into four parts.' }));
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'You could try splitting the money into four parts. Want to?' }));
    const outcome = (await o.handleLearnerText('how do I split my allowance', Date.now()))!;
    expect(outcome.emission.turn.say).toBe('You could try splitting the money into four parts. Want to?');
    const [first, retry] = bodies();
    expect(first).toContain('autonomy-supportive');
    expect(retry).toContain('used controlling language');
    expect(o.dialogueCalibrationReport).toMatchObject({ band: 'teen', variant: 'calibrated', controllingCaught: 1, controllingDelivered: 0 });
    // The band is never a context field: the sealed context carries the tier only.
    expect(first).not.toMatch(/"band"|young_child|"teen"|dialogueCalibration/);
  });

  it('a controlling phrase that survives the retry is delivered and COUNTED, never hidden', async () => {
    const o = new TutorOrchestrator({ ...BASE, dialogueCalibration: calibrated('teen') }, Date.now(), silent);
    fetchMock.mockImplementation(async () => modelReplies({ ...TURN, say: 'Tienes que dividirlo en cuatro partes.' }));
    await o.handleLearnerText('how do I split my allowance', Date.now());
    expect(o.dialogueCalibrationReport).toMatchObject({ controllingCaught: 1, controllingDelivered: 1 });
  });

  it('the younger-child register: the shorter ladder and "together" wording on each hint request', async () => {
    const o = new TutorOrchestrator({ ...BASE, tier: 1, dialogueCalibration: calibrated('young_child') }, Date.now(), silent);
    await o.handleLearnerText('I need help', Date.now());
    expect(lastModelBody()).toContain('show with one small, concrete example why it does not work');
    await o.handleLearnerText('I need help', Date.now());
    expect(lastModelBody()).toContain('let them say only the missing piece');
    await o.handleLearnerText('I need help', Date.now());
    expect(lastModelBody()).toContain('show the answer once, plainly, doing it together');
    expect(lastModelBody()).toContain("let's do this one together");
    expect(o.dialogueCalibrationReport).toMatchObject({ ladderRungs: 4, hintRequests: 3 });
  });

  it('the control arm is the uniform pre-C.17 register: no note, no gate, the full ladder', async () => {
    const o = new TutorOrchestrator(
      { ...BASE, dialogueCalibration: calibrated('adult', { variant: 'control' }) },
      Date.now(),
      silent,
    );
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'You have to divide the money into four parts.' }));
    const outcome = (await o.handleLearnerText('how do I split it', Date.now()))!;
    expect(outcome.emission.turn.say).toBe('You have to divide the money into four parts.');
    expect(lastModelBody()).not.toContain('Dialogue register');
    await o.handleLearnerText('I need help', Date.now());
    expect(lastModelBody()).toContain('give an indirect hint that points at the idea without naming it');
    expect(o.dialogueCalibrationReport).toMatchObject({ variant: 'control', ladderRungs: 5, controllingCaught: 0 });
  });

  it('the ask-first register offers an adaptation instead of changing the approach on its own', async () => {
    const teen = new TutorOrchestrator({ ...BASE, dialogueCalibration: calibrated('teen') }, Date.now(), silent);
    await answer(teen, 'skill-x', false);
    await answer(teen, 'skill-x', false);
    expect(lastModelBody()).toContain('offer ONE adaptation via offerAdaptation');
    expect(lastModelBody()).not.toContain('change the approach entirely');
    expect(teen.dialogueCalibrationReport).toMatchObject({ pacingOffers: 1, unilateralStyleChanges: 0 });

    const control = new TutorOrchestrator({ ...BASE, dialogueCalibration: calibrated('teen', { variant: 'control' }) }, Date.now(), silent);
    await answer(control, 'skill-x', false);
    await answer(control, 'skill-x', false);
    expect(lastModelBody()).toContain('change the approach entirely');
    expect(control.dialogueCalibrationReport).toMatchObject({ pacingOffers: 0, unilateralStyleChanges: 1 });
  });

  it('an older Core: the tier decides the band (tier 3 → tween, never teen)', async () => {
    const o = new TutorOrchestrator(BASE, Date.now(), silent);
    await o.handleLearnerText('hello', Date.now());
    expect(lastModelBody()).toContain('offer them the choice of approach');
    expect(o.dialogueCalibrationReport).toMatchObject({ band: 'tween', assignment: 'tier_fallback' });
  });

  it('the close record carries the register and its counts', () => {
    const o = new TutorOrchestrator({ ...BASE, dialogueCalibration: calibrated('adult') }, Date.now(), silent);
    expect(o.closeRecord('completed').dialogueCalibration).toEqual({
      band: 'adult',
      variant: 'calibrated',
      assignment: 'experiment',
      experimentId: '44444444-4444-4444-8444-444444444444',
      ladderRungs: 5,
      hintRequests: 0,
      tellRequests: 0,
      controllingCaught: 0,
      controllingDelivered: 0,
      pacingOffers: 0,
      unilateralStyleChanges: 0,
    });
  });
});

describe('the operator switches', () => {
  it('TUTOR_DIALOGUE_CALIBRATION=off runs the control register for everyone, recorded as operator_off', async () => {
    process.env.TUTOR_DIALOGUE_CALIBRATION = 'off';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const o = new TutorOrchestrator({ ...BASE, dialogueCalibration: calibrated('teen') }, Date.now(), silent);
    await o.handleLearnerText('hello', Date.now());
    expect(lastModelBody()).not.toContain('Dialogue register');
    expect(o.dialogueCalibrationReport).toMatchObject({ band: 'teen', variant: 'control', assignment: 'operator_off' });
  });

  it('TUTOR_SPACED_REVIEW=off routes and reports nothing', async () => {
    process.env.TUTOR_SPACED_REVIEW = 'off';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const o = new TutorOrchestrator(PLANNED, Date.now(), silent);
    await answer(o, 'skill-a', false);
    expect(o.closeRecord('completed').spacedReview).toBeUndefined();
  });
});
