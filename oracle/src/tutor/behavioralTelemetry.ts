import { z } from 'zod';
import type { Locale } from '../context/schema.js';
import { isHintRequest, isTellRequest } from './hintLadder.js';
import { countWords, foldText, isHedging, isOffTopic, isTerseReply, normalizeAnswer } from './telemetryLexicon.js';

/*
 * C.9 — THE BEHAVIORAL TELEMETRY LAYER (Appendix D §1.3–1.4, §1.7).
 *
 * The first of the three components the Block C Real-Time Interaction
 * Standard places beside the pedagogy controller: the friction proxy. It
 * reads only what a tutoring session already produces — the learner's words,
 * when they answered, whether a server-verified answer was right, whether
 * they asked for help — and computes, per learner turn, the STRENGTH of eight
 * behavioral signals against that learner's OWN session-opening baseline:
 *
 *   latencyShift    a slow reply (for its channel: typed, spoken or activity)
 *                   that ended in a miss, a terse, hedged or off-topic reply.
 *                   A slow reply that ends in a right or thoughtful answer is
 *                   productive thinking and does not count (§1.3).
 *   rapidResponse   a reply far faster than the learner's own baseline that
 *                   was wrong on an item their history does not predict they
 *                   know: Baker's rapid guessing (§1.4).
 *   verbosityDrop   the learner's messages shrink against their own opening
 *                   messages, or turn into minimal replies ("k", "idk"). Never
 *                   an absolute length: a teen who is terse from the start is
 *                   not dropping (§1.6, developmental masking).
 *   repeatedAnswer  the same wrong answer again (digits or number words, any
 *                   locale), or the same message again.
 *   hedging         a rise in uncertainty language ("no sé", "I guess").
 *   offTopic        a rise in contentful messages that share nothing with the
 *                   lesson.
 *   hintAbuse       help requested again with no attempt in between, or
 *                   requested at a rapid pace: hint abuse (§1.4–1.5).
 *   fastKnownMiss   a fast miss on an item the learner's history says they
 *                   know: carelessness, not gaming (§1.4). RECORDED, but NOT
 *                   fused into the disengagement signal — it wants a "check
 *                   it again" nudge, which the controller already gives.
 *
 * WHAT IT OUTPUTS: numbers. Signal strength per channel in [0, 1] (1 = the
 * channel's evidence reached its proposed threshold), how many channels are
 * elevated, and whether the fused disengagement signal fired. It NEVER
 * outputs, stores or reports an emotion label (Appendix D §1.7): nothing
 * here names a feeling, and the adversarial suite (`telemetryGym.test.ts`)
 * asserts that across every simulated learner.
 *
 * WHAT IT DRIVES: the fused disengagement signal fires only when at least
 * `minChannels` independent channels are elevated at once (corroboration, not
 * one noisy cue), and firing produces exactly one thing: the C.19 check-in
 * ("I want to make sure I'm actually helping — are we on the same page?"),
 * the Mentor's required repair-initiation move. The learner's answer routes
 * through the adaptation-offer mechanism (`checkIn.ts`). Most turns take no
 * action at all — the Default-to-Inaction Rate is instrumented here
 * (`evaluatedTurns` against `actionTurns`) and is a Stage 7 trigger below 85%.
 *
 * STAGE 7 KILL SWITCH (Appendix F Part 3): `TUTOR_BEHAVIORAL_TELEMETRY=shadow`
 * keeps computing and recording but never checks in; `off` stops it. Either
 * reverts to the pre-C.9 baseline (time/turn caps only).
 *
 * Every threshold is PROPOSED, PENDING CALIBRATION (Threshold Recalibration
 * Log). Appendix D §1.6 is explicit that affect detection from these channels
 * lands in a "moderately useful, far from certain" range; that is why the
 * output is a low-stakes question, never a declaration.
 *
 * Pure and serializable: it rides the park snapshot (snapshotFence.test.ts).
 */

export type TelemetryMode = 'act' | 'shadow' | 'off';

export function parseTelemetryMode(raw: string | undefined): TelemetryMode {
  // An unknown value keeps the safeguard on: a typo must not read as a
  // kill-switch pull.
  return raw === 'shadow' || raw === 'off' || raw === 'act' ? raw : 'act';
}

const MODE_RANK: Record<TelemetryMode, number> = { act: 0, shadow: 1, off: 2 };

/** The quieter of two modes: `off` beats `shadow` beats `act`. */
export function strictestTelemetryMode(a: TelemetryMode, b: TelemetryMode): TelemetryMode {
  return MODE_RANK[a] >= MODE_RANK[b] ? a : b;
}

export const TELEMETRY_CHANNELS = [
  'latencyShift',
  'rapidResponse',
  'verbosityDrop',
  'repeatedAnswer',
  'hedging',
  'offTopic',
  'hintAbuse',
  'fastKnownMiss',
] as const;
export type TelemetryChannel = (typeof TELEMETRY_CHANNELS)[number];

/** The channels fused into the disengagement signal (`fastKnownMiss` is recorded only). */
export const FUSED_CHANNELS: readonly TelemetryChannel[] = TELEMETRY_CHANNELS.filter((c) => c !== 'fastKnownMiss');

export type TelemetrySource = 'typed' | 'spoken' | 'activity';

export interface TelemetryConfig {
  /** Learner observations that form the session-opening baseline. */
  baselineSize: number;
  /** The rolling window of post-baseline observations. */
  windowSize: number;
  /** Post-baseline observations before the window is evaluated at all. */
  minWindow: number;
  /** Latency samples, per source, that form that source's baseline. */
  latencyBaselineSize: number;
  /** |z| of ln(1 + latency/1 s) against the source's baseline that marks slow or rapid. */
  latencyZ: number;
  /** Floor on the baseline spread, so a very regular learner is not flagged on noise. */
  latencySdFloor: number;
  /** Predicted P(correct) at or above which a fast miss is carelessness, not guessing. */
  knownProbability: number;
  /** Evidence (count or count above baseline) at which a count channel is at full strength. */
  countThreshold: number;
  /** Relative drop of the median message length (or rise of minimal replies) at full strength. */
  verbosityDropFull: number;
  /** Baseline median words below which a drop is not measured (terse from the start). */
  minBaselineWords: number;
  /** Word-counted messages needed in the verbosity baseline and in the window. */
  minTextObservations: number;
  /** Elevated fused channels needed to fire. */
  minChannels: number;
  /** Check-ins per session. */
  maxCheckIns: number;
  /** Observations after a firing (or after the learner's reply) before it may fire again. */
  rearmAfterObservations: number;
  /**
   * Appendix D §1.3: a long wait that ends in a right or thoughtful answer is
   * productive confusion, not disengagement. Always true in production; the
   * switch exists so the simulated suite can prove it matters.
   */
  productiveSlownessExempt: boolean;
  /**
   * Appendix D §1.4: a fast miss on a known item is carelessness and wants a
   * different response from gaming, so it is recorded but not fused. Always
   * false in production; the switch exists for the same reason.
   */
  carelessnessFused: boolean;
}

export const TELEMETRY_DEFAULTS: TelemetryConfig = {
  baselineSize: 4,
  windowSize: 6,
  minWindow: 4,
  latencyBaselineSize: 3,
  latencyZ: 1.5,
  latencySdFloor: 0.35,
  knownProbability: 0.75,
  countThreshold: 2,
  verbosityDropFull: 0.5,
  minBaselineWords: 3,
  minTextObservations: 3,
  minChannels: 2,
  maxCheckIns: 2,
  rearmAfterObservations: 5,
  productiveSlownessExempt: true,
  carelessnessFused: false,
};

/** What one learner turn contributes. The learner's text is read here and never stored. */
export interface TelemetryInput {
  source: TelemetrySource;
  /** The learner's words (already fenced/cleaned), or null for an activity grade. */
  text: string | null;
  /** Response latency in ms, or null when it was not measurable. */
  latencyMs: number | null;
  /** A server-verified answer: the grade, the prediction made BEFORE it, and the answer itself when known. */
  graded: { correct: boolean; pCorrect: number | null; answer: string | null } | null;
  /** The lesson's own words right now (recent Mentor lines, topic, activity prompt), for off-topic drift. */
  topicText: string;
}

const ObservationSchema = z
  .object({
    source: z.enum(['typed', 'spoken', 'activity']),
    /** z of the transformed latency against the source's baseline; null when not measurable. */
    z: z.number().nullable(),
    /** Conversational message length in words; null for answers, help requests and activity grades. */
    words: z.number().int().min(0).nullable(),
    terse: z.boolean(),
    hedge: z.boolean(),
    offTopic: z.boolean().nullable(),
    help: z.boolean(),
    helpChained: z.boolean(),
    graded: z.boolean(),
    correct: z.boolean().nullable(),
    known: z.boolean().nullable(),
    repeat: z.boolean(),
  })
  .strict();
type Observation = z.infer<typeof ObservationSchema>;

export const CHECK_IN_OUTCOMES = [
  'pending',
  'open',
  'aligned',
  'misaligned',
  'unanswered',
  'undelivered',
  'session_ended',
  'superseded',
  'shadow',
] as const;
export type CheckInOutcome = (typeof CHECK_IN_OUTCOMES)[number];

const EventSchema = z
  .object({
    /** 1-based index of the learner observation it fired on. */
    observation: z.number().int().min(1),
    latencyShift: z.number().min(0).max(1),
    rapidResponse: z.number().min(0).max(1),
    verbosityDrop: z.number().min(0).max(1),
    repeatedAnswer: z.number().min(0).max(1),
    hedging: z.number().min(0).max(1),
    offTopic: z.number().min(0).max(1),
    hintAbuse: z.number().min(0).max(1),
    fastKnownMiss: z.number().min(0).max(1),
    /** How many fused channels were elevated. */
    channels: z.number().int().min(0).max(8),
    mode: z.enum(['act', 'shadow']),
    outcome: z.enum(CHECK_IN_OUTCOMES),
    /** Whether the repair turn after a "not really" carried an adaptation offer; null otherwise. */
    repairOffered: z.boolean().nullable(),
  })
  .strict();
export type TelemetryEvent = z.infer<typeof EventSchema>;

export const BehavioralTelemetrySnapshotSchema = z
  .object({
    count: z.number().int().min(0),
    /** The session's first `baselineSize` learner observations. */
    baseline: z.array(ObservationSchema).max(16),
    /** The most recent post-baseline observations (a bounded tail). */
    recent: z.array(ObservationSchema).max(32),
    latencyBaselines: z
      .object({
        typed: z.array(z.number()).max(8),
        spoken: z.array(z.number()).max(8),
        activity: z.array(z.number()).max(8),
      })
      .strict(),
    wordBaseline: z.array(z.number().int().min(0)).max(8),
    recentWrongAnswers: z.array(z.string().max(120)).max(5),
    recentMessages: z.array(z.string().max(240)).max(3),
    /** Whether the previous learner turn was a help request with no attempt since. */
    helpOpen: z.boolean(),
    evaluatedTurns: z.number().int().min(0),
    actionTurns: z.number().int().min(0),
    events: z.array(EventSchema).max(10),
    armedFrom: z.number().int().min(0),
    checkIn: z.enum(['none', 'pending', 'open']),
    /** Turns produced while a check-in was pending that could not carry it. */
    missedTurns: z.number().int().min(0),
    /** When the latest Mentor turn is expected to have finished playing (ms epoch), for reply latency. */
    tutorFreeAtMs: z.number().nullable(),
  })
  .strict();
export type BehavioralTelemetrySnapshot = z.infer<typeof BehavioralTelemetrySnapshotSchema>;

export const EMPTY_BEHAVIORAL_TELEMETRY: BehavioralTelemetrySnapshot = {
  count: 0,
  baseline: [],
  recent: [],
  latencyBaselines: { typed: [], spoken: [], activity: [] },
  wordBaseline: [],
  recentWrongAnswers: [],
  recentMessages: [],
  helpOpen: false,
  evaluatedTurns: 0,
  actionTurns: 0,
  events: [],
  armedFrom: 0,
  checkIn: 'none',
  missedTurns: 0,
  tutorFreeAtMs: null,
};

export type ChannelStrengths = Record<TelemetryChannel, number>;

/** One turn's reading: strengths only, never a label. */
export interface TelemetryReading {
  observation: number;
  /** False while the baseline is still forming (no strengths are computed). */
  evaluated: boolean;
  strengths: ChannelStrengths;
  elevated: TelemetryChannel[];
  fired: boolean;
}

/** Reported outcomes (the internal `pending`/`open` never leave Oracle). */
export const REPORTED_CHECK_IN_OUTCOMES = [
  'aligned',
  'misaligned',
  'unanswered',
  'undelivered',
  'session_ended',
  'superseded',
  'shadow',
] as const;
export type ReportedCheckInOutcome = (typeof REPORTED_CHECK_IN_OUTCOMES)[number];

/** What Core records at close (Default-to-Inaction and Disengagement-Repair Initiation Rates). */
export interface BehavioralTelemetryReport {
  mode: 'act' | 'shadow';
  /** Learner turns on which the layer computed a reading (post-baseline). */
  evaluatedTurns: number;
  /** Of those, turns on which it took an action (a check-in fired in `act` mode). */
  actionTurns: number;
  events: (Omit<TelemetryEvent, 'outcome'> & { outcome: ReportedCheckInOutcome })[];
}

/** ln(1 + latency in seconds): compresses long waits, keeps sub-second replies distinct. */
function transform(latencyMs: number): number {
  return Math.log1p(Math.max(0, latencyMs) / 1000);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sd(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Spoken Mentor lines are paced at about 2.5 words a second (children-directed speech). */
export function estimateSpeechMs(text: string): number {
  return Math.round(countWords(text) * 400);
}

const ZERO_STRENGTHS: ChannelStrengths = Object.fromEntries(TELEMETRY_CHANNELS.map((c) => [c, 0])) as ChannelStrengths;

export class BehavioralTelemetry {
  private state: BehavioralTelemetrySnapshot = structuredClone(EMPTY_BEHAVIORAL_TELEMETRY);

  constructor(
    readonly mode: TelemetryMode = 'act',
    readonly locale: Locale = 'en-US',
    readonly config: TelemetryConfig = TELEMETRY_DEFAULTS,
  ) {}

  snapshot(): BehavioralTelemetrySnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: BehavioralTelemetrySnapshot): void {
    this.state = structuredClone(snapshot);
  }

  // ── Reply latency ──────────────────────────────────────────────────────────

  /**
   * A Mentor turn went out at `atMs` and takes about `speechMs` to play.
   * Turns queue on the client (a scripted line after a model turn plays
   * after it), so the next one starts no earlier than the previous one ends.
   */
  noteTutorTurn(atMs: number, speechMs: number): void {
    const start = Math.max(atMs, this.state.tutorFreeAtMs ?? atMs);
    this.state.tutorFreeAtMs = start + Math.max(0, speechMs);
  }

  /**
   * The learner's reply latency: from when the Mentor's latest turn finished
   * playing to when they started answering (the microphone press for a
   * spoken reply, the message for a typed one). Null before any Mentor turn.
   * A reply that starts while the Mentor is still talking reads as zero.
   */
  replyLatency(onsetAtMs: number | null): number | null {
    if (onsetAtMs === null || this.state.tutorFreeAtMs === null) return null;
    return Math.max(0, onsetAtMs - this.state.tutorFreeAtMs);
  }

  // ── Observation ────────────────────────────────────────────────────────────

  private latencyZ(source: TelemetrySource, latencyMs: number | null): number | null {
    if (latencyMs === null) return null;
    const baseline = this.state.latencyBaselines[source];
    const x = transform(latencyMs);
    if (baseline.length < this.config.latencyBaselineSize) {
      baseline.push(round3(x));
      return null;
    }
    return (x - mean(baseline)) / Math.max(sd(baseline), this.config.latencySdFloor);
  }

  /**
   * Records one learner turn and returns its reading. `fired` says whether
   * the disengagement signal fired on THIS turn (in `act` mode that makes a
   * check-in pending — `checkInDue`).
   */
  observe(input: TelemetryInput): TelemetryReading {
    if (this.mode === 'off') {
      return { observation: this.state.count, evaluated: false, strengths: { ...ZERO_STRENGTHS }, elevated: [], fired: false };
    }
    const text = input.text ?? '';
    const help = input.text !== null && (isHintRequest(text) || isTellRequest(text));
    const helpChained = help && this.state.helpOpen;
    const graded = input.graded !== null;
    const conversational = input.text !== null && !graded && !help;
    let repeat = false;
    if (input.graded && !input.graded.correct && input.graded.answer !== null) {
      const key = normalizeAnswer(input.graded.answer, this.locale);
      if (key !== '') {
        repeat = this.state.recentWrongAnswers.includes(key);
        this.state.recentWrongAnswers = [...this.state.recentWrongAnswers, key.slice(0, 120)].slice(-5);
      }
    } else if (conversational && countWords(text) >= 2) {
      const key = foldText(text).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 240);
      repeat = key !== '' && this.state.recentMessages.includes(key);
      this.state.recentMessages = [...this.state.recentMessages, key].slice(-3);
    }
    const words = conversational ? countWords(text) : null;
    if (words !== null && this.state.wordBaseline.length < this.config.minTextObservations) {
      this.state.wordBaseline.push(words);
    }
    const observation: Observation = {
      source: input.source,
      z: this.latencyZ(input.source, input.latencyMs),
      words,
      terse: input.text !== null && !graded && isTerseReply(text),
      hedge: input.text !== null && isHedging(text, this.locale),
      offTopic: conversational ? isOffTopic(text, input.topicText) : null,
      help,
      helpChained,
      graded,
      correct: input.graded ? input.graded.correct : null,
      known:
        input.graded && input.graded.pCorrect !== null ? input.graded.pCorrect >= this.config.knownProbability : null,
      repeat,
    };
    // A help request stays "open" until the learner attempts something.
    this.state.helpOpen = help || (this.state.helpOpen && !graded && !conversational);
    this.state.count += 1;
    if (this.state.baseline.length < this.config.baselineSize) this.state.baseline.push(observation);
    else this.state.recent = [...this.state.recent, observation].slice(-32);

    const reading = this.evaluate();
    if (!reading.evaluated) return reading;
    this.state.evaluatedTurns += 1;

    const armed = this.state.count >= this.state.armedFrom && this.state.checkIn === 'none';
    const actFirings = this.state.events.filter((e) => e.mode === 'act').length;
    const canFire =
      armed &&
      this.state.events.length < 10 &&
      (this.mode === 'shadow' || actFirings < this.config.maxCheckIns) &&
      reading.elevated.length >= this.config.minChannels;
    if (!canFire) return { ...reading, fired: false };

    this.state.events.push({
      observation: this.state.count,
      ...(Object.fromEntries(TELEMETRY_CHANNELS.map((c) => [c, round3(reading.strengths[c])])) as ChannelStrengths),
      channels: reading.elevated.length,
      mode: this.mode === 'act' ? 'act' : 'shadow',
      outcome: this.mode === 'act' ? 'pending' : 'shadow',
      repairOffered: null,
    });
    this.state.armedFrom = this.state.count + this.config.rearmAfterObservations;
    if (this.mode === 'act') {
      this.state.checkIn = 'pending';
      this.state.missedTurns = 0;
      this.state.actionTurns += 1;
    }
    return { ...reading, fired: true };
  }

  /** The strengths of the current window, without recording anything. */
  evaluate(): TelemetryReading {
    const baseline = this.state.baseline;
    const postBaseline = this.state.count - baseline.length;
    const none: TelemetryReading = {
      observation: this.state.count,
      evaluated: false,
      strengths: { ...ZERO_STRENGTHS },
      elevated: [],
      fired: false,
    };
    if (baseline.length < this.config.baselineSize || postBaseline < this.config.minWindow) return none;
    const window = this.state.recent.slice(-Math.min(this.config.windowSize, postBaseline));
    const zHigh = this.config.latencyZ;
    const count = (predicate: (o: Observation) => boolean) => window.filter(predicate).length;
    const unproductive = (o: Observation) =>
      !this.config.productiveSlownessExempt ||
      (o.graded && o.correct === false) ||
      o.terse ||
      o.hedge ||
      o.offTopic === true;

    const rate = (list: Observation[], predicate: (o: Observation) => boolean, of: (o: Observation) => boolean) => {
      const pool = list.filter(of);
      return pool.length === 0 ? 0 : pool.filter(predicate).length / pool.length;
    };
    const texty = (o: Observation) => o.source !== 'activity' && !o.graded;
    // Evidence above the learner's own opening rate: a learner who hedges
    // from the first minute is not hedging MORE.
    const aboveBaseline = (predicate: (o: Observation) => boolean, of: (o: Observation) => boolean) => {
      const pool = window.filter(of);
      const expected = rate(baseline, predicate, of) * pool.length;
      return Math.max(0, pool.filter(predicate).length - expected);
    };

    const evidence: ChannelStrengths = {
      latencyShift: count((o) => o.z !== null && o.z >= zHigh && unproductive(o)),
      rapidResponse: count((o) => o.z !== null && o.z <= -zHigh && o.graded && o.correct === false && o.known !== true),
      verbosityDrop: 0,
      repeatedAnswer: count((o) => o.repeat),
      hedging: aboveBaseline((o) => o.hedge, texty),
      offTopic: aboveBaseline((o) => o.offTopic === true, (o) => o.offTopic !== null),
      hintAbuse: count((o) => o.helpChained || (o.help && o.z !== null && o.z <= -zHigh)),
      fastKnownMiss: count((o) => o.z !== null && o.z <= -zHigh && o.graded && o.correct === false && o.known === true),
    };
    const strengths = Object.fromEntries(
      TELEMETRY_CHANNELS.map((c) => [c, Math.min(1, evidence[c] / this.config.countThreshold)]),
    ) as ChannelStrengths;

    // Verbosity: the window's median message length against the learner's
    // own first messages, or a rise in minimal replies — whichever is larger.
    const wordBaseline = this.state.wordBaseline;
    const windowWords = window.filter((o) => o.words !== null).map((o) => o.words!);
    const terseRise =
      rate(window, (o) => o.terse, texty) - rate(baseline, (o) => o.terse, texty);
    const terseMeasured = window.filter(texty).length >= this.config.minTextObservations;
    let drop = 0;
    if (
      wordBaseline.length >= this.config.minTextObservations &&
      windowWords.length >= this.config.minTextObservations &&
      median(wordBaseline) >= this.config.minBaselineWords
    ) {
      drop = Math.max(0, 1 - median(windowWords) / median(wordBaseline));
    }
    const verbosityEvidence = Math.max(drop, terseMeasured ? Math.max(0, terseRise) : 0);
    strengths.verbosityDrop = Math.min(1, verbosityEvidence / this.config.verbosityDropFull);

    const fused = this.config.carelessnessFused ? TELEMETRY_CHANNELS : FUSED_CHANNELS;
    const elevated = fused.filter((c) => strengths[c] >= 1);
    return { observation: this.state.count, evaluated: true, strengths, elevated, fired: false };
  }

  // ── The C.19 check-in lifecycle ────────────────────────────────────────────

  /** A check-in fired (or was carried) and the next Mentor turn must carry it. */
  get checkInDue(): boolean {
    return this.state.checkIn === 'pending';
  }

  /** The check-in was asked and is waiting for the learner's reply. */
  get checkInOpen(): boolean {
    return this.state.checkIn === 'open';
  }

  private latestAct(outcome: CheckInOutcome): TelemetryEvent | undefined {
    return [...this.state.events].reverse().find((e) => e.mode === 'act' && e.outcome === outcome);
  }

  /** The Mentor's turn carried the check-in. */
  markCheckInDelivered(): void {
    if (this.state.checkIn !== 'pending') return;
    const event = this.latestAct('pending');
    if (event) event.outcome = 'open';
    this.state.checkIn = 'open';
  }

  /**
   * A Mentor turn went out while a check-in was pending and could not carry
   * it (a scripted fallback, a blocked draft). It stays pending for the next
   * learner turn; the count decides whether an unanswered end of session is
   * reported as `undelivered` (a real miss) or `session_ended`.
   */
  noteTurnWithoutCheckIn(): void {
    if (this.state.checkIn === 'pending') this.state.missedTurns += 1;
  }

  /** A safety stop wins over the check-in (it is never asked after one). */
  supersedeCheckIn(): void {
    if (this.state.checkIn !== 'pending') return;
    const event = this.latestAct('pending');
    if (event) event.outcome = 'superseded';
    this.state.checkIn = 'none';
  }

  /** The learner answered the open check-in (chips, or a classified reply). */
  recordCheckInReply(reply: 'aligned' | 'misaligned' | 'unanswered'): void {
    if (this.state.checkIn !== 'open') return;
    const event = this.latestAct('open');
    if (event) event.outcome = reply;
    this.state.checkIn = 'none';
    // Re-armed from the reply, never from the firing.
    this.state.armedFrom = Math.max(this.state.armedFrom, this.state.count + this.config.rearmAfterObservations);
  }

  /** The repair turn after a "not really" did (or did not) carry an adaptation offer. */
  markRepairOffered(offered: boolean): void {
    const event = [...this.state.events].reverse().find((e) => e.outcome === 'misaligned' && e.repairOffered === null);
    if (event) event.repairOffered = offered;
  }

  report(): BehavioralTelemetryReport {
    return {
      mode: this.mode === 'shadow' ? 'shadow' : 'act',
      evaluatedTurns: this.state.evaluatedTurns,
      actionTurns: this.state.actionTurns,
      events: this.state.events.map((e) => ({
        ...e,
        outcome:
          e.outcome === 'pending'
            ? this.state.missedTurns > 0
              ? 'undelivered'
              : 'session_ended'
            : e.outcome === 'open'
              ? 'unanswered'
              : e.outcome,
      })),
    };
  }
}
