import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorOrchestrator, type TurnOutcome } from '../tutor/orchestrator.js';
import {
  completedCloseText,
  interruptedCloseText,
  openingResponse,
  recapPromptText,
  safetyStopCloseResponse,
} from '../tutor/scripted.js';
import { RECAP_REFLECTION_INSTRUCTION } from '../tutor/sessionClosing.js';
import { classifyLearnerInput } from '../safety/classifier.js';
import type { SpeechResult } from '../voice/speech.js';
import type { SessionContext } from '../core/client.js';

/*
 * C.16 and C.8/C.12, end to end through the real turn pipeline, with the
 * network stubbed at `fetch` only (the same seam `orchestrator.test.ts` uses).
 *
 * C.16: every way a session ends reaches its own script — a completed close
 * is the co-constructed recap question, the Mentor's reflection and a line
 * naming an act the server observed; a budget end names the interruption and
 * the re-entry point; a safety stop never hears a positive line, even when the
 * disclosure lands in the last second of an ended budget.
 *
 * C.8/C.12: the behavioral signature (rising latency variability + surprising
 * misses on the learner's own expected items) makes the Mentor OFFER to stop,
 * with two equal choices — never an automatic close, never a claim about how
 * the learner feels — well before the hard cap.
 */

const KID: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 2,
  locale: 'es-MX',
  nickname: 'Robi',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'course_topic',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: true,
  voiceConsent: true,
  intelDegraded: false,
};

const SKILL = 'financial-education/ahorro';
/** An adult (no mandatory judge pass) with a skill the history says they know well. */
const STRONG_ADULT: SessionContext = {
  ...KID,
  isMinor: false,
  tier: 3,
  locale: 'en-US',
  skillStates: [
    {
      skillKey: SKILL,
      masteryProbability: 0.95,
      uncertainty: 0.1,
      evidenceCount: 12,
      recommendedAction: 'continue',
      reasonCode: 'mastered',
    },
  ],
};

const TURN = {
  say: '¡Buena idea! ¿Cuánto juntarías en cuatro semanas?',
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

function judgeSays(safe: boolean): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ safe }) } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const silent = async (): Promise<SpeechResult> => ({ url: null, source: 'unavailable', billedChars: 0, wordTimings: null });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.JUDGE_API_KEY = 'test-judge-key-0123';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MODEL_API_KEY;
  delete process.env.JUDGE_API_KEY;
  delete process.env.TUTOR_SESSION_END_SIGNAL;
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

const lastModelBody = () => String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? '');
const modelBodies = () => fetchMock.mock.calls.map((c) => String(c[1]?.body ?? ''));

describe('C.16 — the safety stop has its own close, and nothing positive reaches it', () => {
  it('a stopped session answers every later turn, and the farewell, with the calm safety close', async () => {
    const orchestrator = new TutorOrchestrator(KID, Date.now(), silent);
    const stop = (await orchestrator.handleLearnerText('ya no quiero vivir', Date.now()))!;
    expect(stop.closeReason).toBe('safety_stop');
    expect(fetchMock).not.toHaveBeenCalled();

    const later = (await orchestrator.handleLearnerText('hola?', Date.now()))!;
    expect(later.emission.turn.say).toBe(safetyStopCloseResponse('es-MX').say);
    expect(later.closeReason).toBe('safety_stop');

    const bye = await orchestrator.farewell(Date.now(), 'soft');
    expect(bye.emission.turn.say).toBe(safetyStopCloseResponse('es-MX').say);
    expect(bye.closeReason).toBe('safety_stop');
    expect(bye.emission.turn.say).not.toMatch(/muy bien|trabajamos/i);

    expect(orchestrator.closingSummary('safety_stop')).toEqual({ script: 'safety_stop', effort: null, topic: null });
    expect(orchestrator.closeRecord('safety_stop').closingScript).toBe('safety_stop');
  });

  it('a disclosure typed after the budget ended gets the safety line, never the time-is-up line', async () => {
    const orchestrator = new TutorOrchestrator(KID, Date.now() - 60 * 60_000, silent);
    expect(classifyLearnerInput('ya no quiero vivir', 'es-MX').category).toBe('self_harm');
    const outcome = (await orchestrator.handleLearnerText('ya no quiero vivir', Date.now()))!;
    expect(outcome.closeReason).toBe('safety_stop');
    expect(outcome.emission.turn.say).not.toBe(interruptedCloseText('es-MX'));
    expect(outcome.safety?.category).toBe('self_harm');
  });
});

describe('C.16 — the interrupted close names the interruption and the re-entry point', () => {
  it('a budget end with nothing open closes on the interrupted script, with no model call', async () => {
    const orchestrator = new TutorOrchestrator(KID, Date.now() - 60 * 60_000, silent);
    const outcome = (await orchestrator.handleLearnerText('otra pregunta', Date.now()))!;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.emission.turn.say).toBe(interruptedCloseText('es-MX'));
    expect(outcome.closeReason).toBe('hard_budget');
    expect(orchestrator.closingSummary('hard_budget').script).toBe('interrupted');
  });

  it('the grace turn resolves the open question and the SYSTEM adds the interrupted close', async () => {
    const now = Date.now();
    const orchestrator = new TutorOrchestrator(KID, now, silent);
    fetchMock.mockResolvedValueOnce(modelReplies(TURN)).mockResolvedValueOnce(judgeSays(true));
    await orchestrator.handleLearnerText('quiero ahorrar', now);

    fetchMock.mockResolvedValueOnce(modelReplies({ ...TURN, say: '¡Cuarenta pesos, exacto!', next: 'close' }));
    fetchMock.mockResolvedValueOnce(judgeSays(true));
    const grace = (await orchestrator.handleLearnerText('cuarenta', now + 60 * 60_000))!;
    expect(lastModelBody()).toBe(String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? ''));
    expect(modelBodies().some((b) => b.includes('Do NOT say goodbye'))).toBe(true);
    expect(grace.emission.source).toBe('model');
    expect(grace.emission.turn.next).toBe('ask');
    expect(grace.closeReason).toBeNull();
    expect(grace.after?.emission.turn.say).toBe(interruptedCloseText('es-MX'));
    expect(grace.after?.closeReason).toBe('hard_budget');
  });
});

describe('C.16 — the completed close is co-constructed and names an observed act', () => {
  it('a Mentor wrap-up becomes the recap QUESTION, then reflection + the specific effort line', async () => {
    const now = Date.now();
    const orchestrator = new TutorOrchestrator(KID, now, silent);
    fetchMock
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Hoy vimos cómo ahorrar un poco cada semana.', next: 'close' }))
      .mockResolvedValueOnce(judgeSays(true));
    const wrap = (await orchestrator.handleLearnerText('ya entendí', now))!;
    // The model never closes the session itself: the system asks the recap question.
    expect(wrap.closeReason).toBeNull();
    expect(wrap.emission.turn.next).toBe('ask');
    expect(wrap.after?.emission.turn.say).toBe(recapPromptText('es-MX'));
    expect(wrap.after?.closeReason).toBeNull();
    expect(orchestrator.closingInProgress).toBe(true);

    fetchMock
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Sí, ahorrar poquito cada semana suma mucho.', next: 'close' }))
      .mockResolvedValueOnce(judgeSays(true));
    const reflection = (await orchestrator.handleLearnerText('que ahorrar poquito suma', now + 1_000))!;
    expect(lastModelBody()).toBe(String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? ''));
    expect(modelBodies().some((b) => b.includes(RECAP_REFLECTION_INSTRUCTION.slice(0, 60)))).toBe(true);
    expect(reflection.emission.source).toBe('model');
    expect(reflection.emission.turn.next).toBe('ask');
    expect(reflection.closeReason).toBeNull();
    // The learner spoke twice and nothing was graded: the act is the conversation.
    expect(reflection.after?.emission.turn.say).toBe(completedCloseText('es-MX', 'talked_through'));
    expect(reflection.after?.closeReason).toBe('completed');
    expect(orchestrator.closingSummary('completed')).toMatchObject({ script: 'completed', effort: 'talked_through' });
  });

  it('a recap answer is still classified for safety first', async () => {
    const now = Date.now();
    const orchestrator = new TutorOrchestrator(KID, now, silent);
    fetchMock
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Terminamos este tema por hoy.', next: 'close' }))
      .mockResolvedValueOnce(judgeSays(true));
    await orchestrator.handleLearnerText('ok', now);
    fetchMock.mockClear();
    const outcome = (await orchestrator.handleLearnerText('ya no quiero vivir', now + 1_000))!;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.closeReason).toBe('safety_stop');
    expect(outcome.after).toBeUndefined();
  });

  it('leaving by choice gets the completed close naming the act, never a generic one', async () => {
    const orchestrator = new TutorOrchestrator(KID, Date.now(), silent);
    const quiet = await orchestrator.farewell(Date.now(), 'soft');
    expect(quiet.emission.turn.say).toBe(completedCloseText('es-MX', 'none'));
    expect(quiet.closeReason).toBe('completed');
  });

  it('a model failure on the reflection still closes with the effort line, not a "say that again"', async () => {
    const now = Date.now();
    const orchestrator = new TutorOrchestrator(KID, now, silent);
    fetchMock
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Terminamos este tema por hoy.', next: 'close' }))
      .mockResolvedValueOnce(judgeSays(true));
    await orchestrator.handleLearnerText('ok', now);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('upstream down', { status: 503 }));
    const outcome = (await orchestrator.handleLearnerText('ahorrar', now + 1_000))!;
    expect(outcome.emission.turn.say).toBe(completedCloseText('es-MX', 'talked_through'));
    expect(outcome.closeReason).toBe('completed');
  });
});

describe('C.16 — the queued re-engagement opening', () => {
  it('opens with the re-engagement line Core queued, and records it at close', async () => {
    const orchestrator = new TutorOrchestrator({ ...KID, opening: 'reengage_left_resume' }, Date.now(), silent);
    const hello = await orchestrator.greet(Date.now(), 'reengage_left_resume');
    expect(hello.emission.turn.say).toBe(openingResponse('rho', 'es-MX', 'reengage_left_resume').say);
    expect(orchestrator.closeRecord('learner_left')).toMatchObject({ closingScript: 'learner_left', opening: 'reengage_left_resume' });
  });
});

describe('C.8/C.12 — the behavioral-signature offer, through the real pipeline', () => {
  let n = 0;
  // Distinct sentences, so the repeated-sentence and same-script guards (which
  // would spend the turn's one retry) never fire on the fixture itself.
  const SUBJECTS = ['piggy bank', 'lemonade stand', 'bike fund', 'birthday gift', 'comic book', 'garden seeds', 'kite shop',
    'bus fare', 'book fair', 'soccer ball', 'paint set', 'field trip', 'puzzle box', 'movie night', 'bake sale', 'yo-yo'];
  const VERBS = ['Think about', 'Picture', 'Consider', 'Look again at', 'Remember', 'Imagine', 'Try', 'Check'];
  const uniqueTurn = () => {
    n += 1;
    const say = `${VERBS[n % VERBS.length]} the ${SUBJECTS[n % SUBJECTS.length]}. What would you do first?`;
    return modelReplies({ ...TURN, say });
  };

  async function grade(orchestrator: TutorOrchestrator, correct: boolean, latencyMs: number): Promise<TurnOutcome> {
    const id = `33333333-3333-4333-8333-${String(100000000000 + n).slice(-12)}`;
    n += 1;
    orchestrator.noteSegmentServed(id, SKILL);
    vi.setSystemTime(Date.now() + latencyMs);
    return (await orchestrator.handleSegmentResult(id, correct ? 100 : 0, correct, Date.now()))!;
  }

  it('offers to stop, with two equal choices, well before the hard cap — and never claims a feeling', async () => {
    delete process.env.JUDGE_API_KEY;
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.now();
    fetchMock.mockImplementation(async () => uniqueTurn());
    const orchestrator = new TutorOrchestrator(STRONG_ADULT, start, silent);

    for (let i = 0; i < 4; i++) await grade(orchestrator, true, 8_000 + (i % 2) * 300);
    let offered: TurnOutcome | null = null;
    for (let i = 0; i < 10 && offered === null; i++) {
      const outcome = await grade(orchestrator, i % 3 === 0, i % 2 === 0 ? 2_000 : 30_000);
      if (outcome.emission.sessionEndOffer) offered = outcome;
    }
    expect(offered).not.toBeNull();
    // The instruction the model got: the offer, no feelings, no activity.
    expect(lastModelBody()).toContain('SESSION-END OFFER');
    expect(offered!.emission.turn.next).toBe('ask');
    expect(offered!.emission.turn.segmentRequest).toBeNull();
    expect(offered!.closeReason).toBeNull();
    expect(orchestrator.sessionEndOfferOpen).toBe(true);
    const event = orchestrator.sessionEndReport.events[0];
    expect(event.remainingMs).toBeGreaterThan(10 * 60_000);
    expect(Date.now() - start).toBeLessThan(15 * 60_000);

    // Declining continues the lesson (a model turn), never closes it.
    const declined = (await orchestrator.respondToSessionEndOffer(false, Date.now()))!;
    expect(declined.closeReason).toBeNull();
    expect(declined.after).toBeUndefined();
    expect(orchestrator.sessionEndOfferOpen).toBe(false);
    expect(orchestrator.sessionEndReport.events[0].outcome).toBe('declined');
    // A replayed response steers nothing.
    expect(await orchestrator.respondToSessionEndOffer(true, Date.now())).toBeNull();
  });

  it('accepting starts the completed close with the recap question', async () => {
    delete process.env.JUDGE_API_KEY;
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    fetchMock.mockImplementation(async () => uniqueTurn());
    const orchestrator = new TutorOrchestrator(STRONG_ADULT, Date.now(), silent);
    for (let i = 0; i < 4; i++) await grade(orchestrator, true, 8_000 + (i % 2) * 300);
    for (let i = 0; i < 10 && !orchestrator.sessionEndOfferOpen; i++) {
      await grade(orchestrator, i % 3 === 0, i % 2 === 0 ? 2_000 : 30_000);
    }
    expect(orchestrator.sessionEndOfferOpen).toBe(true);
    const accepted = (await orchestrator.respondToSessionEndOffer(true, Date.now()))!;
    expect(accepted.emission.turn.say).toBe(recapPromptText('en-US'));
    expect(accepted.closeReason).toBeNull();
    expect(orchestrator.closingInProgress).toBe(true);
    expect(orchestrator.sessionEndReport.events[0]).toMatchObject({ outcome: 'accepted', confirmed: true });
  });

  it('an offer answered in words: only an explicit stop accepts', async () => {
    delete process.env.JUDGE_API_KEY;
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    fetchMock.mockImplementation(async () => uniqueTurn());
    const orchestrator = new TutorOrchestrator(STRONG_ADULT, Date.now(), silent);
    for (let i = 0; i < 4; i++) await grade(orchestrator, true, 8_000 + (i % 2) * 300);
    for (let i = 0; i < 10 && !orchestrator.sessionEndOfferOpen; i++) {
      await grade(orchestrator, i % 3 === 0, i % 2 === 0 ? 2_000 : 30_000);
    }
    expect(orchestrator.sessionEndOfferOpen).toBe(true);
    const unclear = (await orchestrator.handleLearnerText('yes', Date.now()))!;
    expect(unclear.emission.turn.say).not.toBe(recapPromptText('en-US'));
    expect(orchestrator.sessionEndOfferOpen).toBe(false);
    expect(orchestrator.sessionEndReport.events[0].outcome).toBe('unanswered');
    expect(orchestrator.closingInProgress).toBe(false);
  });

  it('in shadow mode the signal is recorded but the learner is never offered anything', async () => {
    delete process.env.JUDGE_API_KEY;
    process.env.TUTOR_SESSION_END_SIGNAL = 'shadow';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    fetchMock.mockImplementation(async () => uniqueTurn());
    const orchestrator = new TutorOrchestrator(STRONG_ADULT, Date.now(), silent);
    for (let i = 0; i < 4; i++) await grade(orchestrator, true, 8_000 + (i % 2) * 300);
    for (let i = 0; i < 10; i++) {
      const outcome = await grade(orchestrator, i % 3 === 0, i % 2 === 0 ? 2_000 : 30_000);
      expect(outcome.emission.sessionEndOffer).toBeUndefined();
    }
    expect(modelBodies().some((b) => b.includes('SESSION-END OFFER'))).toBe(false);
    expect(orchestrator.sessionEndReport.events.length).toBeGreaterThan(0);
    expect(orchestrator.sessionEndReport.events.every((e) => e.mode === 'shadow')).toBe(true);
  });

  it('the Mentor telling the learner how they feel is repaired, never delivered', async () => {
    const orchestrator = new TutorOrchestrator(KID, Date.now(), silent);
    fetchMock
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Te ves cansado. ¿Paramos por hoy o hacemos una más?' }))
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: '¿Paramos por hoy o hacemos una más?' }))
      .mockResolvedValueOnce(judgeSays(true));
    const outcome = (await orchestrator.handleLearnerText('no sé', Date.now()))!;
    expect(outcome.emission.turn.say).toBe('¿Paramos por hoy o hacemos una más?');
    expect(lastModelBody()).toBe(String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? ''));
    expect(String(fetchMock.mock.calls[1]?.[1]?.body ?? '')).toContain('how they feel');
  });

  it('a claim that survives the repair is replaced by a scripted line', async () => {
    const orchestrator = new TutorOrchestrator(KID, Date.now(), silent);
    fetchMock
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Te ves cansado. ¿Paramos por hoy?' }))
      .mockResolvedValueOnce(modelReplies({ ...TURN, say: 'Estás muy aburrido. ¿Paramos por hoy?' }));
    const outcome = (await orchestrator.handleLearnerText('no sé', Date.now()))!;
    expect(outcome.emission.source).toBe('scripted');
    expect(outcome.emission.turn.say).not.toMatch(/cansado|aburrido/);
  });
});
