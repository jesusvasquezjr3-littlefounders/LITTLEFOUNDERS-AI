import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorOrchestrator, type TurnOutcome } from '../tutor/orchestrator.js';
import { checkInText } from '../tutor/scripted.js';
import type { SpeechResult } from '../voice/speech.js';
import type { SessionContext } from '../core/client.js';

/*
 * C.9 + C.19 end to end through the real turn pipeline, with the network
 * stubbed at `fetch` only (the seam `orchestrator.test.ts` uses).
 *
 * The Behavioral Telemetry Layer fires its disengagement signal from the
 * learner's own behaviour; the SYSTEM then checks in — a written line after
 * the Mentor's one-sentence reaction, on every firing — and the learner's
 * answer ("yes" / "not really", chips or words) either continues the plan or
 * starts the repair, which routes through the adaptation offer. Nothing on
 * this path ever tells the learner how they feel.
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
  fetchMock = vi.fn(async () => uniqueTurn());
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
  delete process.env.TUTOR_BEHAVIORAL_TELEMETRY;
  delete process.env.TUTOR_SESSION_END_SIGNAL;
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

const lastModelBody = () => String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? '');
const modelBodies = () => fetchMock.mock.calls.map((c) => String(c[1]?.body ?? ''));

const ENGAGED = [
  'I want to save money for a new bike this summer',
  'It costs sixty dollars at the store near my house',
  'I could do chores on the weekend to earn a bit more',
  'Then I put five dollars in my piggy bank every week',
];
const DISENGAGED = ['idk', 'whatever', 'i dunno', 'idk', 'k', 'whatever'];

/** Drives an engaged opening, then minimal replies, until the check-in arrives. */
async function untilCheckIn(orchestrator: TutorOrchestrator): Promise<TurnOutcome> {
  for (const text of ENGAGED) await orchestrator.handleLearnerText(text, Date.now());
  for (const text of DISENGAGED) {
    const outcome = (await orchestrator.handleLearnerText(text, Date.now()))!;
    if (outcome.after?.emission.checkIn === true) return outcome;
  }
  throw new Error('the check-in never came');
}

describe('C.19 — a fired disengagement signal always produces the check-in', () => {
  it('the Mentor reacts in one sentence, then the SYSTEM asks the written check-in', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    const outcome = await untilCheckIn(orchestrator);

    // The model was told to react only — no question, no feelings — and the
    // turn is stripped of anything that would compete with the check-in.
    expect(lastModelBody()).toContain('CHECK-IN');
    expect(lastModelBody()).toContain('do NOT describe how they feel');
    expect(outcome.emission.source).toBe('model');
    expect(outcome.emission.turn).toMatchObject({ next: 'ask', segmentRequest: null, offerAdaptation: null });
    expect(outcome.closeReason).toBeNull();

    // The check-in itself: human-written, scripted, flagged for the chips, next seq.
    const checkIn = outcome.after!;
    expect(checkIn.emission.turn.say).toBe(checkInText('en-US'));
    expect(checkIn.emission.source).toBe('scripted');
    expect(checkIn.emission.checkIn).toBe(true);
    expect(checkIn.emission.seq).toBe(outcome.emission.seq + 1);
    expect(checkIn.closeReason).toBeNull();
    expect(orchestrator.checkInOpen).toBe(true);

    // Recorded as signal strength, never a label.
    const report = orchestrator.telemetryReport;
    expect(report.actionTurns).toBe(1);
    expect(report.events[0]).toMatchObject({ mode: 'act', outcome: 'unanswered' });
    expect(JSON.stringify(report)).not.toMatch(/frustrat|bored|angry|sad|upset|anxious|tired|emotion|mood/i);
  });

  it('"yes" on the chips continues the plan; a replayed answer steers nothing', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await untilCheckIn(orchestrator);
    const next = (await orchestrator.respondToCheckIn(true, Date.now()))!;
    expect(lastModelBody()).toContain('confirmed that your help is working');
    expect(next.emission.source).toBe('model');
    expect(next.after).toBeUndefined();
    expect(orchestrator.checkInOpen).toBe(false);
    expect(orchestrator.telemetryReport.events[0]!.outcome).toBe('aligned');
    expect(await orchestrator.respondToCheckIn(false, Date.now())).toBeNull();
  });

  it('"not really" on the chips is the repair, routed through the adaptation offer', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await untilCheckIn(orchestrator);
    fetchMock.mockImplementationOnce(async () =>
      modelReplies({ ...TURN, say: "I'll explain it a different way. Would going slower help?", offerAdaptation: 'slower_pacing' }),
    );
    const repair = (await orchestrator.respondToCheckIn(false, Date.now()))!;
    const body = lastModelBody();
    expect(body).toContain('REPAIR');
    expect(body).toContain('Do NOT continue the plan as if nothing happened');
    expect(body).toContain('offerAdaptation');
    expect(repair.emission.turn.offerAdaptation).toBe('slower_pacing');
    expect(orchestrator.telemetryReport.events[0]).toMatchObject({ outcome: 'misaligned', repairOffered: true });
    // The offer is a real, acceptable adaptation offer (learner-controlled).
    orchestrator.applyAdaptation('slower_pacing');
    const snapshot = await (async () => {
      await orchestrator.awaitPendingCosts();
      return orchestrator.snapshot();
    })();
    expect(snapshot.adaptations).toContain('slower_pacing');
  });

  it('the answer in words: "not really" repairs, "yes" continues, anything else is an ordinary turn', async () => {
    const repairIn = new TutorOrchestrator(ADULT, Date.now(), silent);
    await untilCheckIn(repairIn);
    await repairIn.handleLearnerText('not really', Date.now());
    expect(lastModelBody()).toContain('REPAIR');
    expect(repairIn.telemetryReport.events[0]!.outcome).toBe('misaligned');

    const alignedIn = new TutorOrchestrator(ADULT, Date.now(), silent);
    await untilCheckIn(alignedIn);
    await alignedIn.handleLearnerText('yeah we good', Date.now());
    expect(lastModelBody()).toContain('confirmed that your help is working');
    expect(lastModelBody()).not.toContain('REPAIR');
    expect(alignedIn.telemetryReport.events[0]!.outcome).toBe('aligned');

    const movedOn = new TutorOrchestrator(ADULT, Date.now(), silent);
    await untilCheckIn(movedOn);
    await movedOn.handleLearnerText('I would save it in the bank', Date.now());
    expect(lastModelBody()).not.toContain('REPAIR');
    expect(lastModelBody()).not.toContain('CHECK-IN');
    expect(movedOn.telemetryReport.events[0]!.outcome).toBe('unanswered');
    expect(movedOn.checkInOpen).toBe(false);
  });

  it('a check-in the Mentor turn could not carry is carried by the next turn, never lost', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    for (const text of ENGAGED) await orchestrator.handleLearnerText(text, Date.now());
    // The model fails from the start of the disengaged stretch on: every
    // reacting turn is the scripted model-down line, which cannot carry it.
    fetchMock.mockImplementation(async () => new Response('upstream down', { status: 503 }));
    for (const text of DISENGAGED.slice(0, 4)) await orchestrator.handleLearnerText(text, Date.now());
    expect(orchestrator.checkInOpen).toBe(false);
    // Session ends here: the firing is a REAL miss (a turn went out without it).
    expect(orchestrator.telemetryReport.events[0]!.outcome).toBe('undelivered');

    // The model is back: the very next learner turn carries the check-in.
    fetchMock.mockImplementation(async () => uniqueTurn());
    const outcome = (await orchestrator.handleLearnerText('ok', Date.now()))!;
    expect(outcome.after?.emission.checkIn).toBe(true);
    expect(orchestrator.checkInOpen).toBe(true);
  });

  it('a safety stop supersedes a pending check-in: it is never asked after a disclosure', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    for (const text of ENGAGED) await orchestrator.handleLearnerText(text, Date.now());
    fetchMock.mockImplementation(async () => new Response('upstream down', { status: 503 }));
    for (const text of DISENGAGED.slice(0, 4)) await orchestrator.handleLearnerText(text, Date.now());
    const stop = (await orchestrator.handleLearnerText('i want to die', Date.now()))!;
    expect(stop.closeReason).toBe('safety_stop');
    expect(stop.after).toBeUndefined();
    expect(orchestrator.telemetryReport.events[0]!.outcome).toBe('superseded');
  });

  it('survives a cross-replica resume with the check-in open', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await untilCheckIn(orchestrator);
    await orchestrator.awaitPendingCosts();
    const snapshot = JSON.parse(JSON.stringify(orchestrator.snapshot()));
    const resumed = TutorOrchestrator.restore(snapshot, ADULT, Date.now(), silent);
    expect(resumed.checkInOpen).toBe(true);
    const next = await resumed.respondToCheckIn(true, Date.now());
    expect(next).not.toBeNull();
    expect(resumed.telemetryReport.events[0]!.outcome).toBe('aligned');
  });
});

describe('C.9 — default to inaction, and the Stage 7 kill switch', () => {
  it('an engaged learner is never checked on, however long the session', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    for (let i = 0; i < 16; i++) {
      const outcome = (await orchestrator.handleLearnerText(`${ENGAGED[i % ENGAGED.length]} in week ${i + 1}`, Date.now()))!;
      expect(outcome.after).toBeUndefined();
    }
    expect(modelBodies().some((b) => b.includes('CHECK-IN'))).toBe(false);
    const report = orchestrator.telemetryReport;
    expect(report.evaluatedTurns).toBeGreaterThan(5);
    expect(report.actionTurns).toBe(0);
  });

  it('shadow: computed and recorded, never acted on', async () => {
    process.env.TUTOR_BEHAVIORAL_TELEMETRY = 'shadow';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    for (const text of [...ENGAGED, ...DISENGAGED]) {
      const outcome = (await orchestrator.handleLearnerText(text, Date.now()))!;
      expect(outcome.after).toBeUndefined();
    }
    expect(modelBodies().some((b) => b.includes('CHECK-IN'))).toBe(false);
    expect(orchestrator.closeRecord('completed').behavioralTelemetry).toMatchObject({ mode: 'shadow', actionTurns: 0 });
    expect(orchestrator.telemetryReport.events[0]).toMatchObject({ mode: 'shadow', outcome: 'shadow' });
  });

  it("Core's automatic Stage 7 rollback (context `shadow`) silences the layer even with the switch on `act`", async () => {
    const orchestrator = new TutorOrchestrator({ ...ADULT, behavioralTelemetryMode: 'shadow' }, Date.now(), silent);
    for (const text of [...ENGAGED, ...DISENGAGED]) {
      const outcome = (await orchestrator.handleLearnerText(text, Date.now()))!;
      expect(outcome.after).toBeUndefined();
    }
    expect(modelBodies().some((b) => b.includes('CHECK-IN'))).toBe(false);
    expect(orchestrator.closeRecord('completed').behavioralTelemetry).toMatchObject({ mode: 'shadow', actionTurns: 0 });
  });

  it('Core can never make the layer louder than the operator set it (switch `off`, context `act`)', async () => {
    process.env.TUTOR_BEHAVIORAL_TELEMETRY = 'off';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const orchestrator = new TutorOrchestrator({ ...ADULT, behavioralTelemetryMode: 'act' }, Date.now(), silent);
    for (const text of [...ENGAGED, ...DISENGAGED]) await orchestrator.handleLearnerText(text, Date.now());
    expect(orchestrator.closeRecord('completed').behavioralTelemetry).toBeUndefined();
  });

  it('the check-in line fits the Mentor copy budget in every locale (Bible 06: 12 words for ages 6–9, one question)', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const text = checkInText(locale);
      expect(text.split(/\s+/).filter(Boolean).length, locale).toBeLessThanOrEqual(12);
      expect((text.match(/\?/g) ?? []).length, locale).toBe(1);
      expect(text, locale).not.toMatch(/frustrat|bored|confus|sad|upset|tired|feel|frustr|aburr|cansad|sient|sente/i);
    }
  });

  it('off: nothing is computed and nothing is reported', async () => {
    process.env.TUTOR_BEHAVIORAL_TELEMETRY = 'off';
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    for (const text of [...ENGAGED, ...DISENGAGED]) await orchestrator.handleLearnerText(text, Date.now());
    expect(orchestrator.closeRecord('completed').behavioralTelemetry).toBeUndefined();
    expect(orchestrator.checkInOpen).toBe(false);
  });

  it('reads the reply latency of typed and spoken turns into their own baselines', async () => {
    const orchestrator = new TutorOrchestrator(ADULT, Date.now(), silent);
    await orchestrator.handleLearnerText(ENGAGED[0]!, Date.now(), undefined, { source: 'typed', onsetAtMs: Date.now() });
    await orchestrator.handleLearnerText(ENGAGED[1]!, Date.now(), undefined, {
      source: 'spoken',
      onsetAtMs: Date.now() + 60_000,
    });
    await orchestrator.awaitPendingCosts();
    const { latencyBaselines } = orchestrator.snapshot().behavioralTelemetry;
    expect(latencyBaselines.spoken).toHaveLength(1);
    // A reply that starts while the Mentor is still talking reads as zero, not negative.
    expect(latencyBaselines.typed.every((v) => v >= 0)).toBe(true);
  });
});

describe('C.9 × C.8 — the check-in wins over the stop-or-continue offer on the same turn', () => {
  const SKILL = 'financial-education/ahorro';
  const STRONG: SessionContext = {
    ...ADULT,
    skillStates: [
      { skillKey: SKILL, masteryProbability: 0.95, uncertainty: 0.1, evidenceCount: 12, recommendedAction: 'continue', reasonCode: 'mastered' },
    ],
  };
  let seg = 0;
  async function grade(orchestrator: TutorOrchestrator, correct: boolean, latencyMs: number): Promise<TurnOutcome> {
    const id = `33333333-3333-4333-8333-${String(100000000000 + seg).slice(-12)}`;
    seg += 1;
    orchestrator.noteSegmentServed(id, SKILL);
    vi.setSystemTime(Date.now() + latencyMs);
    return (await orchestrator.handleSegmentResult(id, correct ? 100 : 0, correct, Date.now()))!;
  }
  const PATTERN = (i: number): [boolean, number] => (i < 4 ? [true, 8_000 + (i % 2) * 300] : [(i - 4) % 3 === 0, (i - 4) % 2 === 0 ? 2_000 : 30_000]);

  it('the offer is recorded as not offered (and re-arms); the learner gets the check-in', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 1. Find the graded turn on which the stop offer fires.
    const probe = new TutorOrchestrator(STRONG, Date.now(), silent);
    let k = -1;
    for (let i = 0; i < 14 && k < 0; i++) {
      const [correct, latency] = PATTERN(i);
      const outcome = await grade(probe, correct, latency);
      if (outcome.emission.sessionEndOffer) k = i;
    }
    expect(k).toBeGreaterThan(3);

    // 2. Replay up to the turn before it, with a check-in pending in the telemetry layer.
    const replay = new TutorOrchestrator(STRONG, Date.now(), silent);
    for (let i = 0; i < k; i++) {
      const [correct, latency] = PATTERN(i);
      await grade(replay, correct, latency);
    }
    await replay.awaitPendingCosts();
    const snapshot = replay.snapshot();
    snapshot.behavioralTelemetry.checkIn = 'pending';
    snapshot.behavioralTelemetry.events.push({
      observation: snapshot.behavioralTelemetry.count,
      latencyShift: 1, rapidResponse: 0, verbosityDrop: 1, repeatedAnswer: 0, hedging: 0, offTopic: 0, hintAbuse: 0,
      fastKnownMiss: 0, channels: 2, mode: 'act', outcome: 'pending', repairOffered: null,
    });
    const both = TutorOrchestrator.restore(snapshot, STRONG, Date.now(), silent);

    // 3. The turn on which the offer would fire.
    const [correct, latency] = PATTERN(k);
    const outcome = await grade(both, correct, latency);
    expect(outcome.emission.sessionEndOffer).toBeUndefined();
    expect(outcome.after?.emission.checkIn).toBe(true);
    expect(lastModelBody()).toContain('CHECK-IN');
    expect(lastModelBody()).not.toContain('SESSION-END OFFER');
    expect(both.sessionEndOfferOpen).toBe(false);
    expect(both.sessionEndReport.events.at(-1)!.outcome).toBe('not_offered');
  });
});

describe('the repair instruction', () => {
  it('never re-offers a declined adaptation, and falls back to a fresh explanation when none is left', async () => {
    const { repairInstruction } = await import('../tutor/checkIn.js');
    const { ADAPTATIONS } = await import('../context/schema.js');
    const some = repairInstruction(['slower_pacing']);
    expect(some).toContain('offerAdaptation');
    expect(some).not.toContain('slower pacing');
    const none = repairInstruction([...ADAPTATIONS]);
    expect(none).not.toContain('offerAdaptation');
    expect(none).toContain('different concrete example');
    // Never phrased as an activity promise ("let's try"), which would cost a retry.
    expect(some).not.toMatch(/let'?s try/i);
  });
});
