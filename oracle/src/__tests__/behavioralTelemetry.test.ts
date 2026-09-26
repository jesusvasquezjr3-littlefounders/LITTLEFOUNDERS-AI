import { describe, expect, it } from 'vitest';
import {
  BehavioralTelemetry,
  BehavioralTelemetrySnapshotSchema,
  FUSED_CHANNELS,
  parseTelemetryMode,
  TELEMETRY_CHANNELS,
  TELEMETRY_DEFAULTS,
  type TelemetryInput,
} from '../tutor/behavioralTelemetry.js';

/*
 * C.9 — the Behavioral Telemetry Layer as a unit: its own-baseline readings,
 * the corroboration rule (two channels, never one noisy cue), the
 * default-to-inaction posture, and the C.19 check-in lifecycle it drives.
 */

const TOPIC = 'How much would you save each week for the bike? Saving money for a goal';

const say = (text: string, latencyMs: number | null = null): TelemetryInput => ({
  source: 'typed',
  text,
  latencyMs,
  graded: null,
  topicText: TOPIC,
});

const activity = (correct: boolean, latencyMs: number, pCorrect: number | null = 0.5): TelemetryInput => ({
  source: 'activity',
  text: null,
  latencyMs,
  graded: { correct, pCorrect, answer: null },
  topicText: TOPIC,
});

const answer = (text: string, correct: boolean, pCorrect: number | null = 0.5): TelemetryInput => ({
  source: 'typed',
  text,
  latencyMs: null,
  graded: { correct, pCorrect, answer: text },
  topicText: TOPIC,
});

const ENGAGED = [
  'I would save five dollars every week for the bike',
  'Because the bike costs sixty dollars at the store',
  'Then I need twelve weeks of saving my money',
  'I could also do chores to earn a bit more money',
];

function engaged(layer: BehavioralTelemetry): void {
  for (const text of ENGAGED) layer.observe(say(text));
}

describe('the baseline and the window', () => {
  it('computes nothing until the baseline and the minimum window exist', () => {
    const layer = new BehavioralTelemetry('act', 'en-US');
    engaged(layer);
    for (let i = 0; i < TELEMETRY_DEFAULTS.minWindow - 1; i++) {
      expect(layer.observe(say('idk')).evaluated).toBe(false);
    }
    expect(layer.observe(say('idk')).evaluated).toBe(true);
  });

  it('a steady, engaged learner never fires, however long the session (default to inaction)', () => {
    const layer = new BehavioralTelemetry('act', 'en-US');
    for (let i = 0; i < 30; i++) {
      const reading = layer.observe(say(ENGAGED[i % ENGAGED.length]!, 6_000 + (i % 3) * 800));
      expect(reading.fired).toBe(false);
    }
    const report = layer.report();
    expect(report.evaluatedTurns).toBeGreaterThan(20);
    expect(report.actionTurns).toBe(0);
    expect(report.events).toEqual([]);
  });
});

describe('each channel reads the learner against their OWN baseline', () => {
  it('verbosity: shrinking messages and minimal replies raise it; a terse-from-the-start teen does not', () => {
    const dropping = new BehavioralTelemetry('shadow', 'en-US');
    engaged(dropping);
    let reading = dropping.observe(say('ok'));
    for (const text of ['k', 'fine', 'sure']) reading = dropping.observe(say(text));
    expect(reading.strengths.verbosityDrop).toBe(1);

    const terseTeen = new BehavioralTelemetry('shadow', 'en-US');
    for (const text of ['ok', 'k', 'fine', 'ok']) terseTeen.observe(say(text));
    for (const text of ['ok', 'k', 'fine', 'ok']) reading = terseTeen.observe(say(text));
    expect(reading.strengths.verbosityDrop).toBe(0);
  });

  it('hedging counts only a RISE over the learner’s opening rate', () => {
    const rising = new BehavioralTelemetry('shadow', 'en-US');
    engaged(rising);
    let reading = rising.observe(say('I guess it could be ten dollars each week'));
    reading = rising.observe(say("I don't know how many weeks that takes then"));
    for (const text of ENGAGED.slice(0, 2)) reading = rising.observe(say(text));
    expect(reading.strengths.hedging).toBe(1);

    const always = new BehavioralTelemetry('shadow', 'en-US');
    for (let i = 0; i < 4; i++) always.observe(say(`I think it is ${i + 5} dollars for the bike`));
    for (let i = 0; i < 4; i++) reading = always.observe(say(`I think it is ${i + 9} dollars for the bike`));
    expect(reading.strengths.hedging).toBe(0);
  });

  it('repeated answers: the same wrong answer again, in digits or number words', () => {
    const layer = new BehavioralTelemetry('shadow', 'en-US');
    engaged(layer);
    layer.observe(answer('20', false));
    layer.observe(answer('twenty', false));
    layer.observe(answer('twenty dollars', false));
    const reading = layer.observe(answer('20', false));
    expect(reading.strengths.repeatedAnswer).toBe(1);
  });

  it('latency: a slow reply counts only when it ends in a miss or a disengaged reply, never a thoughtful one', () => {
    const productive = new BehavioralTelemetry('shadow', 'en-US');
    for (let i = 0; i < 4; i++) productive.observe(activity(true, 8_000 + i * 200));
    let reading = productive.observe(activity(true, 60_000));
    for (let i = 0; i < 3; i++) reading = productive.observe(activity(true, 60_000));
    expect(reading.strengths.latencyShift).toBe(0);

    const stalled = new BehavioralTelemetry('shadow', 'en-US');
    for (let i = 0; i < 4; i++) stalled.observe(activity(true, 8_000 + i * 200));
    for (let i = 0; i < 4; i++) reading = stalled.observe(activity(false, 60_000));
    expect(reading.strengths.latencyShift).toBe(1);
  });

  it('rapid guessing on unknown items is fused; a fast miss on a KNOWN item is carelessness and is not', () => {
    const guessing = new BehavioralTelemetry('shadow', 'en-US');
    for (let i = 0; i < 4; i++) guessing.observe(activity(true, 9_000 + i * 300, 0.5));
    let reading = guessing.observe(activity(false, 600, 0.4));
    for (let i = 0; i < 3; i++) reading = guessing.observe(activity(false, 600, 0.4));
    expect(reading.strengths.rapidResponse).toBe(1);
    expect(reading.strengths.fastKnownMiss).toBe(0);

    const careless = new BehavioralTelemetry('shadow', 'en-US');
    for (let i = 0; i < 4; i++) careless.observe(activity(true, 9_000 + i * 300, 0.9));
    for (let i = 0; i < 4; i++) reading = careless.observe(activity(false, 600, 0.9));
    expect(reading.strengths.fastKnownMiss).toBe(1);
    expect(reading.strengths.rapidResponse).toBe(0);
    expect(FUSED_CHANNELS).not.toContain('fastKnownMiss');
    expect(reading.elevated).not.toContain('fastKnownMiss');
  });

  it('hint abuse: help asked again with no attempt in between', () => {
    const layer = new BehavioralTelemetry('shadow', 'en-US');
    engaged(layer);
    let reading = layer.observe(say('give me a hint'));
    for (const text of ['help me', 'can you help', 'just tell me the answer']) reading = layer.observe(say(text));
    expect(reading.strengths.hintAbuse).toBe(1);
  });

  it('off-topic drift: contentful messages that share nothing with the lesson', () => {
    const layer = new BehavioralTelemetry('shadow', 'en-US');
    engaged(layer);
    let reading = layer.observe(say('I played fortnite with my cousin yesterday'));
    for (const text of ['my dog chased a squirrel around the yard', 'we are going to the beach on saturday', ENGAGED[0]!]) {
      reading = layer.observe(say(text));
    }
    expect(reading.strengths.offTopic).toBe(1);
  });
});

describe('the fused disengagement signal', () => {
  it('never fires on one channel alone, however strong', () => {
    const layer = new BehavioralTelemetry('act', 'en-US');
    engaged(layer);
    for (let i = 0; i < 8; i++) {
      // Wrong answers repeated at an ordinary pace: repeatedAnswer only.
      expect(layer.observe(answer('20', false)).fired).toBe(false);
    }
    expect(layer.checkInDue).toBe(false);
  });

  it('fires when two independent channels agree, and makes a check-in pending', () => {
    const layer = new BehavioralTelemetry('act', 'en-US');
    engaged(layer);
    const readings = ['idk', 'whatever', 'i dunno', 'idk'].map((t) => layer.observe(say(t)));
    const fired = readings.find((r) => r.fired);
    expect(fired).toBeDefined();
    expect(fired!.elevated.length).toBeGreaterThanOrEqual(TELEMETRY_DEFAULTS.minChannels);
    expect(layer.checkInDue).toBe(true);
    expect(layer.report().actionTurns).toBe(1);
  });

  it('outputs signal strength only — no field or value names a feeling', () => {
    const layer = new BehavioralTelemetry('act', 'en-US');
    engaged(layer);
    for (const t of ['idk', 'whatever', 'i dunno', 'idk']) layer.observe(say(t));
    const serialized = JSON.stringify({ report: layer.report(), snapshot: layer.snapshot(), reading: layer.evaluate() });
    expect(serialized).not.toMatch(/frustrat|bored|boredom|angry|anger|sad|upset|anxious|anxiety|confused|tired|emotion|mood|feel/i);
    for (const channel of TELEMETRY_CHANNELS) expect(channel).not.toMatch(/frustrat|bored|angry|sad|emotion|mood/i);
  });
});

describe('the C.19 check-in lifecycle', () => {
  function fired(mode: 'act' | 'shadow' = 'act'): BehavioralTelemetry {
    const layer = new BehavioralTelemetry(mode, 'en-US');
    engaged(layer);
    for (const t of ['idk', 'whatever', 'i dunno', 'idk']) layer.observe(say(t));
    return layer;
  }

  it('pending → open → the learner’s answer; re-armed from the answer, not the firing', () => {
    const layer = fired();
    layer.markCheckInDelivered();
    expect(layer.checkInOpen).toBe(true);
    expect(layer.report().events[0]!.outcome).toBe('unanswered');
    layer.recordCheckInReply('misaligned');
    expect(layer.checkInOpen).toBe(false);
    layer.markRepairOffered(true);
    expect(layer.report().events[0]).toMatchObject({ outcome: 'misaligned', repairOffered: true });
    // The same disengaged pattern right after the answer: not inside the re-arm window.
    for (let i = 0; i < TELEMETRY_DEFAULTS.rearmAfterObservations - 1; i++) {
      expect(layer.observe(say('idk')).fired).toBe(false);
    }
  });

  it('never more than maxCheckIns per session', () => {
    const layer = fired();
    for (let round = 0; round < 6; round++) {
      layer.markCheckInDelivered();
      layer.recordCheckInReply('unanswered');
      for (let i = 0; i < 8; i++) layer.observe(say(i % 2 === 0 ? 'idk' : 'whatever'));
    }
    expect(layer.report().events.filter((e) => e.mode === 'act')).toHaveLength(TELEMETRY_DEFAULTS.maxCheckIns);
  });

  it('an end of session with the check-in never carried: session_ended; carried-past turns make it undelivered', () => {
    expect(fired().report().events[0]!.outcome).toBe('session_ended');
    const missed = fired();
    missed.noteTurnWithoutCheckIn();
    expect(missed.report().events[0]!.outcome).toBe('undelivered');
  });

  it('a safety stop or a closing supersedes a pending check-in', () => {
    const layer = fired();
    layer.supersedeCheckIn();
    expect(layer.checkInDue).toBe(false);
    expect(layer.report().events[0]!.outcome).toBe('superseded');
  });

  it('shadow mode records firings but never makes a check-in pending (Stage 7 rollback)', () => {
    const layer = fired('shadow');
    expect(layer.checkInDue).toBe(false);
    expect(layer.report()).toMatchObject({ mode: 'shadow', actionTurns: 0 });
    expect(layer.report().events[0]!.outcome).toBe('shadow');
  });

  it('off mode computes nothing', () => {
    const layer = new BehavioralTelemetry('off', 'en-US');
    engaged(layer);
    for (const t of ['idk', 'whatever', 'i dunno', 'idk']) expect(layer.observe(say(t)).evaluated).toBe(false);
    expect(layer.report()).toMatchObject({ evaluatedTurns: 0, actionTurns: 0, events: [] });
  });

  it('an unknown kill-switch value keeps the layer acting', () => {
    expect(parseTelemetryMode('shadow')).toBe('shadow');
    expect(parseTelemetryMode('of')).toBe('act');
    expect(parseTelemetryMode(undefined)).toBe('act');
  });

  it('survives a park and resume exactly (snapshot round trip)', () => {
    const layer = fired();
    layer.markCheckInDelivered();
    const snapshot = BehavioralTelemetrySnapshotSchema.parse(JSON.parse(JSON.stringify(layer.snapshot())));
    const resumed = new BehavioralTelemetry('act', 'en-US');
    resumed.restore(snapshot);
    expect(resumed.checkInOpen).toBe(true);
    expect(resumed.report()).toEqual(layer.report());
  });
});

describe('reply latency', () => {
  it('counts from when the Mentor’s queued turns finish playing, never negative', () => {
    const layer = new BehavioralTelemetry('act', 'en-US');
    expect(layer.replyLatency(1_000)).toBeNull();
    layer.noteTutorTurn(10_000, 4_000);
    // A scripted line queued behind it starts only when the first one ends.
    layer.noteTutorTurn(10_500, 2_000);
    expect(layer.replyLatency(20_000)).toBe(4_000);
    expect(layer.replyLatency(11_000)).toBe(0);
    expect(layer.replyLatency(null)).toBeNull();
  });
});
