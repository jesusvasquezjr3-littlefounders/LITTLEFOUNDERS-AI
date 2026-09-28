import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestratorSnapshotSchema, TutorOrchestrator } from '../tutor/orchestrator.js';
import {
  checkInText,
  continuityOpeningResponse,
  greetingResponse,
  openingResponse,
  renegotiationText,
  selfExplanationText,
} from '../tutor/scripted.js';
import { FRESH_START_NOTE, MEMORY_GAP_NOTE } from '../tutor/allianceController.js';
import type { SpeechResult } from '../voice/speech.js';
import type { SessionContext } from '../core/client.js';
import type { DispositionProfile } from '../tutor/dispositionProfile.js';

/*
 * C.15 (the Alliance Controller), C.14 (the self-explanation move) and C.7
 * (the disposition profile) end to end through the REAL turn pipeline, with
 * the network stubbed at `fetch` only (the seam `checkIn.test.ts` uses).
 *
 * Both moves are ON here (`act`, the production default); the older suites
 * run with them off (`test-setup.ts`).
 */

const ADULT: SessionContext = {
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
  // An adult session runs without the mandatory judge pass, so every model
  // call in these tests is a Mentor turn.
  isMinor: false,
  voiceConsent: true,
  intelDegraded: false,
};

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
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
      usage: { prompt_tokens: 100, completion_tokens: 40 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

let n = 0;
const SUBJECTS = ['piggy bank', 'lemonade stand', 'bike fund', 'birthday gift', 'comic book', 'garden seeds', 'kite shop',
  'bus fare', 'book fair', 'soccer ball', 'paint set', 'field trip', 'puzzle box', 'movie night', 'bake sale', 'yo-yo'];
const VERBS = ['Think about', 'Picture', 'Consider', 'Look again at', 'Remember', 'Imagine', 'Try', 'Check'];
/** Distinct sentences, so the repeated-sentence guards never spend a retry on the fixture itself. */
const uniqueTurn = (extra: Record<string, unknown> = {}) => {
  n += 1;
  return modelReplies({ ...TURN, say: `${VERBS[n % VERBS.length]} the ${SUBJECTS[n % SUBJECTS.length]}. What would you do first?`, ...extra });
};

const silent = async (): Promise<SpeechResult> => ({ url: null, source: 'unavailable', billedChars: 0, wordTimings: null });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.TUTOR_ALLIANCE_CONTROLLER = 'act';
  process.env.TUTOR_SELF_EXPLANATION = 'act';
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
  process.env.TUTOR_ALLIANCE_CONTROLLER = 'off';
  process.env.TUTOR_SELF_EXPLANATION = 'off';
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

const lastModelBody = () => String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? '');
const modelCalls = () => fetchMock.mock.calls.length;

/** Opens a session and settles the goal (the learner agrees in words). */
async function agreedSession(session: SessionContext = ADULT): Promise<TutorOrchestrator> {
  const orchestrator = new TutorOrchestrator(session, Date.now(), silent);
  await orchestrator.greet(Date.now(), session.opening ?? 'greeting');
  await orchestrator.handleLearnerText('I want to learn how to save for a bike', Date.now());
  await orchestrator.handleLearnerText('yes', Date.now());
  return orchestrator;
}

/** Makes the Mentor offer an adaptation on the next model turn, then the learner declines it. */
async function offerAndDecline(orchestrator: TutorOrchestrator, text: string, adaptation: 'slower_pacing' | 'more_examples' | 'less_text' | 'more_visual'): Promise<void> {
  fetchMock.mockImplementationOnce(async () => {
    n += 1;
    return modelReplies({ ...TURN, say: `Would it help if we changed how I explain it, number ${n}?`, offerAdaptation: adaptation });
  });
  const outcome = (await orchestrator.handleLearnerText(text, Date.now()))!;
  expect(outcome.emission.turn.offerAdaptation).toBe(adaptation);
  orchestrator.declineAdaptation(adaptation);
}

describe('C.15 goal agreement — an explicit session-opening move', () => {
  it('the first learner turn is answered with ONE confirming restatement and the goal chips', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await orchestrator.greet(Date.now());
    fetchMock.mockImplementationOnce(async () =>
      modelReplies({ ...TURN, say: 'So today you want to learn how to save for a bike, right?', segmentRequest: { skillKey: 'x', framing: 'y', rationale: 'z' }, next: 'segment' }),
    );
    const outcome = (await orchestrator.handleLearnerText('I want to learn how to save for a bike', Date.now()))!;
    expect(lastModelBody()).toContain('GOAL AGREEMENT');
    expect(lastModelBody()).toContain('in their own words');
    // The restatement stands alone: no activity, no adaptation offer.
    expect(outcome.emission.turn).toMatchObject({ next: 'ask', segmentRequest: null, offerAdaptation: null });
    expect(outcome.emission.goalCheck).toBe(true);
    expect(orchestrator.goalCheckOpen).toBe(true);
  });

  it('"yes" on the chips settles the goal; a replayed or forged answer steers nothing', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await orchestrator.greet(Date.now());
    expect(await orchestrator.respondToGoalCheck(true, Date.now())).toBeNull(); // nothing open yet
    await orchestrator.handleLearnerText('I want to learn how to save for a bike', Date.now());
    const before = modelCalls();
    const next = (await orchestrator.respondToGoalCheck(true, Date.now()))!;
    expect(modelCalls()).toBeGreaterThan(before);
    expect(lastModelBody()).toContain('confirmed the goal');
    expect(next.emission.goalCheck).toBeUndefined();
    expect(orchestrator.goalCheckOpen).toBe(false);
    expect(await orchestrator.respondToGoalCheck(false, Date.now())).toBeNull();
    // Settled by the learner's second act (the chip after their first message).
    expect(orchestrator.allianceReport).toMatchObject({ goalAgreement: 'agreed', goalSettledAtTurn: 2 });
  });

  it('"something else" asks what they want instead, and THEIR words become the goal', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await orchestrator.greet(Date.now());
    await orchestrator.handleLearnerText('I guess saving', Date.now());
    await orchestrator.handleLearnerText('no, something else', Date.now());
    expect(lastModelBody()).toContain('ask what they would');
    await orchestrator.handleLearnerText('I want to run a lemonade stand', Date.now());
    expect(lastModelBody()).toContain('in their own words, what they want to work on');
    expect(orchestrator.allianceReport).toMatchObject({ goalAgreement: 'renegotiated', goalSettledAtTurn: 3 });
  });

  it('an unclear answer is recorded as unconfirmed and the move never loops', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await orchestrator.greet(Date.now());
    await orchestrator.handleLearnerText('I want to save money', Date.now());
    await orchestrator.handleLearnerText('the bike costs 60 dollars', Date.now());
    expect(lastModelBody()).not.toContain('GOAL AGREEMENT');
    await orchestrator.handleLearnerText('and I have 20 already', Date.now());
    expect(lastModelBody()).not.toContain('GOAL AGREEMENT');
    expect(orchestrator.allianceReport.goalAgreement).toBe('unconfirmed');
  });

  it('a session that never reaches a learner turn is recorded not_reached', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await orchestrator.greet(Date.now());
    expect(orchestrator.closeRecord('learner_left').alliance?.goalAgreement).toBe('not_reached');
  });
});

describe('C.15 task agreement — repeated declines are a renegotiation trigger, never silent persistence', () => {
  it('two declines in a row: the next Mentor turn only reacts, then the SYSTEM asks what would help', async () => {
    const orchestrator = await agreedSession();
    await offerAndDecline(orchestrator, 'this is hard', 'slower_pacing');
    await offerAndDecline(orchestrator, 'still hard', 'more_examples');
    const outcome = (await orchestrator.handleLearnerText('ok what now', Date.now()))!;
    expect(lastModelBody()).toContain('RENEGOTIATION');
    expect(lastModelBody()).toContain('Do NOT offer another adaptation');
    expect(outcome.emission.turn).toMatchObject({ next: 'ask', segmentRequest: null, offerAdaptation: null });
    const question = outcome.after!;
    expect(question.emission.turn.say).toBe(renegotiationText('en-US'));
    expect(question.emission.source).toBe('scripted');
    expect(question.emission.seq).toBe(outcome.emission.seq + 1);

    // The learner answers in their own words; the Mentor follows it.
    await orchestrator.handleLearnerText('maybe show me with coins', Date.now());
    expect(lastModelBody()).toContain('just told you what would help them');
    const report = orchestrator.allianceReport;
    expect(report).toMatchObject({ adaptationOffers: 2, adaptationDeclines: 2, adaptationAccepts: 0 });
    expect(report.renegotiations).toEqual([
      expect.objectContaining({ observation: 1, mode: 'act', outcome: 'answered', improved: null }),
    ]);
  });

  it('an acceptance between two declines resets the pattern', async () => {
    const orchestrator = await agreedSession();
    await offerAndDecline(orchestrator, 'this is hard', 'slower_pacing');
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'Shall I show more examples this time?', offerAdaptation: 'more_examples' }));
    await orchestrator.handleLearnerText('still hard', Date.now());
    orchestrator.applyAdaptation('more_examples');
    await offerAndDecline(orchestrator, 'hmm', 'less_text');
    await orchestrator.handleLearnerText('ok', Date.now());
    expect(lastModelBody()).not.toContain('RENEGOTIATION');
    expect(orchestrator.allianceReport.renegotiations).toEqual([]);
  });

  it('the improvement window: 4 clean learner turns = improved; a new decline inside it = not improved', async () => {
    const clean = await agreedSession();
    await offerAndDecline(clean, 'this is hard', 'slower_pacing');
    await offerAndDecline(clean, 'still hard', 'more_examples');
    await clean.handleLearnerText('ok what now', Date.now());
    await clean.handleLearnerText('show me with coins', Date.now());
    for (const text of ['five coins', 'then ten coins', 'I get it now', 'fifteen in total']) await clean.handleLearnerText(text, Date.now());
    expect(clean.allianceReport.renegotiations[0]!.improved).toBe(true);

    const worse = await agreedSession();
    await offerAndDecline(worse, 'this is hard', 'slower_pacing');
    await offerAndDecline(worse, 'still hard', 'more_examples');
    await worse.handleLearnerText('ok what now', Date.now());
    await worse.handleLearnerText('show me with coins', Date.now());
    await offerAndDecline(worse, 'hmm no', 'less_text');
    expect(worse.allianceReport.renegotiations[0]!.improved).toBe(false);
  });

  it('a renegotiation the turn could not carry stays due; unanswered at the end is a real miss', async () => {
    const orchestrator = await agreedSession();
    await offerAndDecline(orchestrator, 'this is hard', 'slower_pacing');
    await offerAndDecline(orchestrator, 'still hard', 'more_examples');
    // The model fails twice: the scripted fallback cannot carry the question.
    fetchMock.mockImplementationOnce(async () => new Response('{}', { status: 500 }));
    fetchMock.mockImplementationOnce(async () => new Response('{}', { status: 500 }));
    const failed = (await orchestrator.handleLearnerText('ok what now', Date.now()))!;
    expect(failed.emission.source).toBe('scripted');
    expect(failed.after).toBeUndefined();
    expect(orchestrator.closeRecord('learner_left').alliance!.renegotiations[0]!.outcome).toBe('undelivered');
    // The next turn carries it.
    const carried = (await orchestrator.handleLearnerText('hello?', Date.now()))!;
    expect(carried.after?.emission.turn.say).toBe(renegotiationText('en-US'));
  });

  it('shadow (the Stage 7 rollback): the pattern is recorded, never acted on; goal tracking continues', async () => {
    process.env.TUTOR_ALLIANCE_CONTROLLER = 'shadow';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const orchestrator = await agreedSession();
    await offerAndDecline(orchestrator, 'this is hard', 'slower_pacing');
    await offerAndDecline(orchestrator, 'still hard', 'more_examples');
    const outcome = (await orchestrator.handleLearnerText('ok what now', Date.now()))!;
    expect(lastModelBody()).not.toContain('RENEGOTIATION');
    expect(outcome.after).toBeUndefined();
    const report = orchestrator.allianceReport;
    expect(report.mode).toBe('shadow');
    expect(report.goalAgreement).toBe('agreed');
    expect(report.renegotiations).toEqual([expect.objectContaining({ mode: 'shadow', outcome: 'shadow' })]);
  });

  it("Core's automatic rollback verdict silences an act switch; Core can never turn off 'off'", async () => {
    const shadowed = await agreedSession({ ...ADULT, allianceMode: 'shadow' });
    expect(shadowed.allianceReport.mode).toBe('shadow');
    process.env.TUTOR_ALLIANCE_CONTROLLER = 'off';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const off = new TutorOrchestrator({ ...ADULT, allianceMode: 'act' }, Date.now(), silent);
    await off.greet(Date.now());
    await off.handleLearnerText('I want to save', Date.now());
    expect(lastModelBody()).not.toContain('GOAL AGREEMENT');
    expect(off.closeRecord('completed').alliance).toBeUndefined();
  });

  it('the C.19 check-in wins over a due renegotiation, which it supersedes', async () => {
    const orchestrator = await agreedSession();
    await offerAndDecline(orchestrator, 'I want to save for a new bike this summer', 'slower_pacing');
    await offerAndDecline(orchestrator, 'It costs sixty dollars at the store near my house', 'more_examples');
    for (const text of ['I could do chores on the weekend to earn a bit more', 'Then I put five dollars in my piggy bank every week']) {
      await orchestrator.handleLearnerText(text, Date.now());
    }
    // The renegotiation went out on the first of those; nothing is left due.
    expect(orchestrator.allianceReport.renegotiations[0]!.outcome).not.toBe('undelivered');
    let checkIn = false;
    for (const text of ['idk', 'whatever', 'i dunno', 'idk', 'k', 'whatever']) {
      const outcome = (await orchestrator.handleLearnerText(text, Date.now()))!;
      if (outcome.after?.emission.turn.say === checkInText('en-US')) {
        checkIn = true;
        break;
      }
    }
    expect(checkIn).toBe(true);
  });
});

describe('C.15 bond — a specific reference is tracked separately from generic praise', () => {
  it('counts delivered turns whose praise names what the learner actually did', async () => {
    const orchestrator = await agreedSession();
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'Great job! You saved 5 dollars every week, so the bike fits.' }));
    await orchestrator.handleLearnerText('I saved 5 dollars every week', Date.now());
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'Great job! Keep it up.' }));
    await orchestrator.handleLearnerText('ok', Date.now());
    expect(orchestrator.allianceReport).toMatchObject({ bondSpecificTurns: 1, bondGenericTurns: 1 });
  });
});

describe('C.15 persona continuity — never falsely familiar', () => {
  it('a first meeting opens with an honest introduction, not a greeting that assumes a history', async () => {
    const session: SessionContext = { ...ADULT, character: 'liruf', allianceContinuity: 'first_meeting' };
    const orchestrator = new TutorOrchestrator(session, Date.now(), silent);
    const opening = await orchestrator.greet(Date.now());
    expect(opening.emission.turn.say).toBe(continuityOpeningResponse('liruf', 'en-US', 'introduce').say);
    expect(opening.emission.turn.say).not.toBe(greetingResponse('liruf', 'en-US').say); // "You came back!"
    await orchestrator.handleLearnerText('I want to save for a bike', Date.now());
    expect(lastModelBody()).toContain(FRESH_START_NOTE.slice(0, 60));
    expect(orchestrator.closeRecord('completed').alliance).toMatchObject({ continuity: 'first_meeting', continuityMove: 'delivered' });
  });

  it('DoD (c): a persona switch mid-relationship — the new persona re-establishes, the old one continues', async () => {
    // Sessions 1–2 with Doctor Rho (Core: first_meeting, then continuing).
    const rhoFirst = new TutorOrchestrator({ ...ADULT, allianceContinuity: 'first_meeting' }, Date.now(), silent);
    expect((await rhoFirst.greet(Date.now())).emission.turn.say).toBe(continuityOpeningResponse('rho', 'en-US', 'introduce').say);
    const rhoAgain = new TutorOrchestrator({ ...ADULT, allianceContinuity: 'continuing' }, Date.now(), silent);
    expect((await rhoAgain.greet(Date.now())).emission.turn.say).toBe(greetingResponse('rho', 'en-US').say);
    await rhoAgain.handleLearnerText('let us keep saving', Date.now());
    expect(lastModelBody()).not.toContain('CONTINUITY');

    // Session 3: the learner switches to Zara (Core: persona_switch).
    const zara = new TutorOrchestrator({ ...ADULT, character: 'zara', allianceContinuity: 'persona_switch' }, Date.now(), silent);
    expect((await zara.greet(Date.now())).emission.turn.say).toBe(continuityOpeningResponse('zara', 'en-US', 'introduce').say);
    // The model claims a shared history: repaired once, never delivered.
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'Last time we worked on saving for your bike. Ready to go on?' }));
    const first = (await zara.handleLearnerText('I want to keep saving for the bike', Date.now()))!;
    expect(lastModelBody()).toContain('NEVER worked with this learner before');
    expect(first.emission.turn.say).not.toMatch(/last time we/i);
    // Every Zara turn carries the note, not only the first.
    await zara.handleLearnerText('yes', Date.now());
    expect(lastModelBody()).toContain(FRESH_START_NOTE.slice(0, 60));
    expect(zara.closeRecord('completed').alliance).toMatchObject({ continuity: 'persona_switch', continuityMove: 'delivered' });
  });

  it('a false shared-history claim that survives the retry is replaced, never delivered', async () => {
    const zara = new TutorOrchestrator({ ...ADULT, character: 'zara', allianceContinuity: 'persona_switch' }, Date.now(), silent);
    await zara.greet(Date.now());
    fetchMock.mockImplementation(async () => {
      n += 1;
      return modelReplies({ ...TURN, say: `I remember you from before, friend number ${n}. Shall we start?` });
    });
    const outcome = (await zara.handleLearnerText('hi', Date.now()))!;
    expect(outcome.emission.source).toBe('scripted');
    expect(outcome.emission.turn.say).not.toMatch(/remember you/i);
  });

  it('a memory gap reconnects honestly and carries the note for the first turns only', async () => {
    const orchestrator = new TutorOrchestrator({ ...ADULT, allianceContinuity: 'memory_gap' }, Date.now(), silent);
    expect((await orchestrator.greet(Date.now())).emission.turn.say).toBe(continuityOpeningResponse('rho', 'en-US', 'reconnect').say);
    await orchestrator.handleLearnerText('I want to save money', Date.now());
    expect(lastModelBody()).toContain(MEMORY_GAP_NOTE.slice(0, 60));
    for (const text of ['yes', 'the bike is 60', 'I have 20', 'so 40 more']) await orchestrator.handleLearnerText(text, Date.now());
    expect(lastModelBody()).not.toContain(MEMORY_GAP_NOTE.slice(0, 60));
  });

  it('a queued C.16 re-engagement keeps precedence and is persona-neutral; the continuity note still applies', async () => {
    const session: SessionContext = { ...ADULT, character: 'dina', allianceContinuity: 'persona_switch', opening: 'reengage_left_resume' };
    const orchestrator = new TutorOrchestrator(session, Date.now(), silent);
    const opening = await orchestrator.greet(Date.now(), 'reengage_left_resume');
    expect(opening.emission.turn.say).toBe(openingResponse('dina', 'en-US', 'reengage_left_resume').say);
    expect(opening.emission.turn.say).not.toMatch(/\bwe\b/i);
    await orchestrator.handleLearnerText('ok', Date.now());
    expect(lastModelBody()).toContain(FRESH_START_NOTE.slice(0, 60));
  });

  it('shadow suspends the continuity re-establishment (Stage 7) and records it', async () => {
    const orchestrator = new TutorOrchestrator({ ...ADULT, character: 'liruf', allianceContinuity: 'first_meeting', allianceMode: 'shadow' }, Date.now(), silent);
    expect((await orchestrator.greet(Date.now())).emission.turn.say).toBe(greetingResponse('liruf', 'en-US').say);
    await orchestrator.handleLearnerText('hi', Date.now());
    expect(lastModelBody()).not.toContain('CONTINUITY');
    expect(orchestrator.closeRecord('completed').alliance).toMatchObject({ continuityMove: 'shadow' });
  });
});

describe('C.14 self-explanation — a distinct, quality-checked dialogue move', () => {
  async function servedDecision(orchestrator: TutorOrchestrator, type: string, id = 'seg-1'): Promise<void> {
    orchestrator.noteSegmentServed(id, 'saving-basics', type, 'You have 10 coins. Split them between save, spend and share.');
  }

  it('after a decision activity: the Mentor only reacts, then the SYSTEM asks "why did you pick that?"', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'piggy_split');
    const outcome = (await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now()))!;
    expect(lastModelBody()).toContain('SELF-EXPLANATION');
    expect(outcome.emission.turn).toMatchObject({ next: 'ask', segmentRequest: null, offerAdaptation: null });
    expect(outcome.after!.emission.turn.say).toBe(selfExplanationText('en-US', 'why'));
    expect(outcome.after!.emission.seq).toBe(outcome.emission.seq + 1);

    // A reason that names the idea passes, and is acknowledged SPECIFICALLY.
    await orchestrator.handleLearnerText('because I want to save some for later and share with my sister', Date.now());
    expect(lastModelBody()).toContain('Acknowledge the SPECIFIC reason');
    expect(orchestrator.selfExplanationReport.events).toEqual([
      expect.objectContaining({ source: 'activity', family: 'saving', variant: 'why', firstQuality: 'concept', outcome: 'passed_first' }),
    ]);
  });

  it('filler gets ONE targeted follow-up (never silent acceptance); a second miss gets the reason stated once', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'needs_wants');
    await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now());
    const followup = (await orchestrator.handleLearnerText('because its right', Date.now()))!;
    const body = lastModelBody();
    expect(body).toContain('did not give a reason that names the idea');
    expect(body).toContain('the difference between a need and a want');
    expect(body).toContain('do NOT give the reason yourself');
    expect(followup.emission.turn).toMatchObject({ segmentRequest: null, offerAdaptation: null });
    expect(followup.after).toBeUndefined();

    await orchestrator.handleLearnerText('i dunno', Date.now());
    expect(lastModelBody()).toContain('state the reason');
    const event = orchestrator.selfExplanationReport.events[0]!;
    expect(event).toMatchObject({ firstQuality: 'filler', followupQuality: 'filler', outcome: 'explained_by_mentor' });
    // The move never loops: the next turn is an ordinary one.
    await orchestrator.handleLearnerText('ok', Date.now());
    expect(lastModelBody()).not.toMatch(/state the reason|SELF-EXPLANATION|did not give a reason/);
  });

  it('a follow-up answered with the idea passes on the second attempt', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'price_compare');
    await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now());
    await orchestrator.handleLearnerText('just because', Date.now());
    await orchestrator.handleLearnerText('the big one is cheaper for each cookie', Date.now());
    expect(orchestrator.selfExplanationReport.events[0]).toMatchObject({ firstQuality: 'filler', followupQuality: 'concept', outcome: 'passed_followup' });
  });

  it('a verified-wrong decision is asked "how", and a stated wrong idea goes to the C.18 unsound path', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'budget_fit');
    const outcome = (await orchestrator.handleSegmentResult('seg-1', 20, false, Date.now()))!;
    expect(outcome.after!.emission.turn.say).toBe(selfExplanationText('en-US', 'how'));
    await orchestrator.handleLearnerText('I can afford the ball, and also the notebook, and also the paints', Date.now());
    expect(lastModelBody()).toContain('DETECTED BY THE SYSTEM');
    expect(orchestrator.selfExplanationReport.events[0]).toMatchObject({ firstQuality: 'misconception', outcome: 'misconception_corrected' });
  });

  it('a help request while the question is open is honoured by the hint ladder, not quality-checked', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'savings_goal');
    await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now());
    await orchestrator.handleLearnerText('can you give me a hint', Date.now());
    expect(lastModelBody()).toContain('hint ladder');
    expect(orchestrator.selfExplanationReport.events[0]).toMatchObject({ firstQuality: 'help', outcome: 'skipped_help' });
  });

  it('a counting activity is not a decision point; spacing and the per-session cap bound the move', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'coin_count');
    const counting = (await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now()))!;
    expect(counting.after).toBeUndefined();

    await servedDecision(orchestrator, 'piggy_split', 'seg-2');
    expect((await orchestrator.handleSegmentResult('seg-2', 100, true, Date.now()))!.after).toBeDefined();
    await orchestrator.handleLearnerText('to save for later', Date.now());
    // The very next decision is too close (fewer than 3 learner turns).
    await servedDecision(orchestrator, 'piggy_split', 'seg-3');
    expect((await orchestrator.handleSegmentResult('seg-3', 100, true, Date.now()))!.after).toBeUndefined();
  });

  it('a conversational money decision ("save it or spend it?") gets the same move', async () => {
    const orchestrator = await agreedSession();
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'You got 20 dollars for your birthday. Would you save it or spend it?' }));
    await orchestrator.handleLearnerText('what is next', Date.now());
    await orchestrator.handleLearnerText('lol', Date.now());
    await orchestrator.handleLearnerText('ok', Date.now());
    fetchMock.mockImplementationOnce(async () => modelReplies({ ...TURN, say: 'New one: you found 5 dollars. Should you keep it in your bank or buy a toy?' }));
    await orchestrator.handleLearnerText('another one please', Date.now());
    const outcome = (await orchestrator.handleLearnerText('save it', Date.now()))!;
    expect(lastModelBody()).toContain('SELF-EXPLANATION');
    expect(outcome.after!.emission.turn.say).toBe(selfExplanationText('en-US', 'why'));
    expect(orchestrator.selfExplanationReport.events[0]).toMatchObject({ source: 'conversation' });
  });

  it('shadow records decision points and never prompts; off records nothing', async () => {
    process.env.TUTOR_SELF_EXPLANATION = 'shadow';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const shadow = await agreedSession();
    await servedDecision(shadow, 'piggy_split');
    expect((await shadow.handleSegmentResult('seg-1', 100, true, Date.now()))!.after).toBeUndefined();
    expect(shadow.selfExplanationReport).toMatchObject({ mode: 'shadow', prompts: 0, events: [expect.objectContaining({ outcome: 'shadow' })] });
    process.env.TUTOR_SELF_EXPLANATION = 'off';
    resetConfigCache();
    const off = await agreedSession();
    await servedDecision(off, 'piggy_split');
    await off.handleSegmentResult('seg-1', 100, true, Date.now());
    expect(off.closeRecord('completed').selfExplanation).toBeUndefined();
  });

  it('the scaffolded sentence stem is used when the disposition profile says explanations need scaffolding (C.7)', async () => {
    const profile: DispositionProfile = {
      sessionsObserved: 6,
      helpStyle: 'independent',
      persistence: 'persists',
      explanation: 'needs_scaffold',
      persistentlyDeclined: [],
      typicalTypedReplyMs: null,
      typicalSpokenReplyMs: null,
    };
    const orchestrator = await agreedSession({ ...ADULT, dispositionProfile: profile });
    await servedDecision(orchestrator, 'piggy_split');
    const outcome = (await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now()))!;
    expect(outcome.after!.emission.turn.say).toBe(selfExplanationText('en-US', 'scaffolded'));
    expect(orchestrator.closeRecord('completed').disposition.applied).toContain('scaffolded_explanation');
  });

  it('the record never carries what the learner said', async () => {
    const orchestrator = await agreedSession();
    await servedDecision(orchestrator, 'piggy_split');
    await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now());
    await orchestrator.handleLearnerText('because my grandma Lupita told me to save', Date.now());
    const record = JSON.stringify(orchestrator.closeRecord('completed'));
    expect(record).not.toMatch(/Lupita|grandma/i);
    expect(record).not.toMatch(/frustrat|bored|angry|sad|upset|anxious|tired|emotion|mood/i);
  });
});

describe('C.7 disposition profile — read beside mastery, server-side only', () => {
  const PROFILE: DispositionProfile = {
    sessionsObserved: 8,
    helpStyle: 'tell_early',
    persistence: 'disengages_early',
    explanation: 'explains',
    persistentlyDeclined: ['less_text'],
    typicalTypedReplyMs: 40_000,
    typicalSpokenReplyMs: null,
  };

  it('never reaches the model context: no field of it appears in any request body', async () => {
    const orchestrator = await agreedSession({ ...ADULT, dispositionProfile: PROFILE });
    await orchestrator.handleLearnerText('ok', Date.now());
    for (const call of fetchMock.mock.calls) {
      const body = String(call[1]?.body ?? '');
      expect(body).not.toMatch(/tell_early|disengages_early|helpStyle|persistence|persistentlyDeclined|typicalTypedReplyMs|sessionsObserved/);
    }
  });

  it('seeds the cross-session declines, so a turned-down adaptation is not re-offered unprompted', async () => {
    const orchestrator = new TutorOrchestrator({ ...ADULT, dispositionProfile: PROFILE }, Date.now(), silent);
    expect(orchestrator.snapshot().plan.declinedAdaptations).toEqual(['less_text']);
    const record = orchestrator.closeRecord('completed').disposition;
    expect(record.profileReceived).toBe(true);
    expect(record.applied).toEqual(expect.arrayContaining(['stuck_degrade_early', 'seeded_declines']));
  });

  it('reports this session’s observations as numbers and closed labels only', async () => {
    const orchestrator = await agreedSession();
    orchestrator.noteSegmentServed('seg-1', 'saving-basics', 'coin_count', 'Count the coins.');
    await orchestrator.handleLearnerText('can you give me a hint', Date.now());
    await orchestrator.handleLearnerText('just tell me the answer', Date.now());
    const d = orchestrator.closeRecord('completed').disposition;
    expect(d).toMatchObject({ hintRequests: 1, tellRequests: 1, profileReceived: false, applied: [] });
    expect(d.learnerTurns).toBeGreaterThanOrEqual(4);
    expect(Object.keys(d).sort()).toEqual(
      ['acceptedAdaptations', 'applied', 'declinedAdaptations', 'hintRequests', 'learnerTurns', 'profileReceived', 'spokenReplyMs', 'tellRequests', 'typedReplyMs'].sort(),
    );
  });
});

describe('the new state rides the park snapshot', () => {
  it('an open self-explanation question, the goal and a renegotiation window survive a cross-replica resume', async () => {
    const orchestrator = await agreedSession();
    orchestrator.noteSegmentServed('seg-1', 'saving-basics', 'piggy_split', 'Split your coins.');
    await orchestrator.handleSegmentResult('seg-1', 100, true, Date.now());
    await orchestrator.awaitPendingCosts();
    const snapshot = OrchestratorSnapshotSchema.parse(JSON.parse(JSON.stringify(orchestrator.snapshot())));
    const restored = TutorOrchestrator.restore(snapshot, ADULT, orchestrator.startedAt, silent);
    expect(restored.snapshot()).toEqual(orchestrator.snapshot());
    await restored.handleLearnerText('to save for later', Date.now());
    expect(restored.selfExplanationReport.events[0]).toMatchObject({ outcome: 'passed_first' });
    expect(restored.allianceReport.goalAgreement).toBe('agreed');
  });

  it('a record parked by the previous build (no new fields) restores with empty defaults', () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    const legacy = orchestrator.snapshot() as unknown as Record<string, unknown>;
    delete legacy.alliance;
    delete legacy.selfExplanation;
    delete legacy.dispositionObserver;
    const parsed = OrchestratorSnapshotSchema.parse(legacy);
    expect(parsed.alliance.goal).toBe('pending');
    expect(parsed.selfExplanation.events).toEqual([]);
  });
});
