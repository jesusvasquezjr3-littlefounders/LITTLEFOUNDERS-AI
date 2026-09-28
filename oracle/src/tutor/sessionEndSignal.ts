import { z } from 'zod';

/*
 * C.8 / C.12 — THE BEHAVIORAL-SIGNATURE SESSION-END SIGNAL (Appendix D §2.5).
 *
 * Part of the Extended Mastery Engine (Block C standard). Session budgets are
 * clock- and turn-based, and time-on-task is a documented weak predictor of
 * learning (Baker et al.: ~1.9% of variance, negative in 8 of 19 classrooms).
 * This signal looks instead at the signature the adjacent vigilance
 * literature actually validates:
 *
 *   1. RISING RESPONSE-LATENCY VARIABILITY — the spread of the learner's
 *      answer times (standard deviation of ln(latency), so a slow and a fast
 *      learner are judged on the same scale), in a rolling window of recent
 *      graded turns, against their OWN session-opening baseline.
 *      PER CHANNEL (gap-fix round 1): a typed reply, a spoken reply and an
 *      activity answer are timed differently (the onset-based reply latency
 *      C.9 already computes for typed and spoken answers; the activity's own
 *      answer time), so each source keeps its own baseline — the first
 *      `baselineSize` latencies OF THAT SOURCE — and a window's SD is only
 *      ever compared with the baseline of the same source. Channels are never
 *      mixed. The latency half rises when any measured source rises. Before
 *      this, spoken and typed answers carried no latency at all, so a voice or
 *      typed conversation (the normal Mentor session) could never fire.
 *   2. A RISING "SURPRISING MISS" RATE — the miss rate on items the learner's
 *      own history says they should get right (the controller's predicted
 *      probability of a correct answer at or above `surpriseProbability`),
 *      in the same window, against the same baseline. An ordinary miss on a
 *      hard item is not surprising and does not count.
 *
 * It fires only when BOTH components are measured and BOTH have risen. It is
 * never computed from elapsed time or turn count — neither is an input to
 * `observe()` — so it can fire long before the 25-minute/120-turn hard cap,
 * and it never replaces that cap (session/budget.ts is untouched by it).
 *
 * WHAT IT OUTPUTS: signal STRENGTH (two measured deltas), never an emotional
 * state. Nothing here, and nothing the Mentor is told because of it, may say
 * the learner is tired, bored or frustrated (the Block C non-negotiable; the
 * orchestrator also checks the delivered text, `affectClaims.ts`).
 *
 * WHAT IT DRIVES: an adaptation offer with two equal choices — stop here for
 * today, or do one more — never an automatic close. At most `maxOffers` per
 * session, re-armed only after `rearmAfterObservations` more graded turns.
 *
 * STAGE 7 KILL SWITCH (Appendix F Part 3): `TUTOR_SESSION_END_SIGNAL=shadow`
 * keeps computing and logging but never offers; `off` stops it entirely.
 * Either reverts session management to the time/turn caps alone.
 *
 * Every threshold below is PROPOSED, PENDING CALIBRATION, and is listed in
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md. Appendix D §2.5 is
 * explicit that no study validates this exact design for children; it is a
 * synthesis of adjacent science and must be described that way.
 *
 * Pure and serializable: it rides the park snapshot (snapshotFence.test.ts).
 */

export type SessionEndSignalMode = 'offer' | 'shadow' | 'off';

export interface SessionEndSignalConfig {
  /** Graded observations that form the session-opening baseline. */
  baselineSize: number;
  /** The rolling window (Appendix D §2.5: "last 8–10 graded turns"). */
  windowSize: number;
  /** Observations after the baseline before the window is evaluated at all. */
  minWindow: number;
  /** Predicted P(correct) at or above which a miss counts as surprising. */
  surpriseProbability: number;
  /** Minimum expected-correct items in the window for the rate to be measured. */
  minExpectedItems: number;
  /** Rise of the window's surprising-miss rate over the baseline's. */
  surpriseRateRise: number;
  /** Minimum surprising misses in the window. */
  minSurprisingMisses: number;
  /** Rise of the window's SD of ln(latency) over the baseline's. */
  latencyVariabilityRise: number;
  /** Latency samples needed in the baseline and in the window. */
  minLatencySamples: number;
  /** Offers per session. */
  maxOffers: number;
  /** Graded observations after an offer (or a shadow firing) before it may fire again. */
  rearmAfterObservations: number;
  /** Observations after a firing that decide whether it was confirmed. */
  confirmWindow: number;
}

export const SESSION_END_SIGNAL_DEFAULTS: SessionEndSignalConfig = {
  baselineSize: 4,
  windowSize: 8,
  minWindow: 6,
  surpriseProbability: 0.75,
  minExpectedItems: 3,
  surpriseRateRise: 0.25,
  minSurprisingMisses: 2,
  latencyVariabilityRise: 0.3,
  minLatencySamples: 3,
  maxOffers: 2,
  rearmAfterObservations: 4,
  confirmWindow: 4,
};

export function parseSessionEndSignalMode(raw: string | undefined): SessionEndSignalMode {
  // Unknown values fall back to the documented default rather than silently
  // disabling a safeguard: a typo must not look like a kill-switch pull.
  return raw === 'shadow' || raw === 'off' || raw === 'offer' ? raw : 'offer';
}

/** The answer channels, mirroring behavioralTelemetry.ts's TelemetrySource (session-end:check). */
export const LATENCY_SOURCES = ['typed', 'spoken', 'activity'] as const;
export type LatencySource = (typeof LATENCY_SOURCES)[number];

const ObservationSchema = z
  .object({
    latencyMs: z.number().min(0).nullable(),
    correct: z.boolean(),
    /** The controller's predicted probability of a correct answer, or null when unknown. */
    pCorrect: z.number().min(0).max(1).nullable(),
    /** The channel the latency was measured on; defaulted for snapshots written before channels. */
    source: z.enum(LATENCY_SOURCES).default('activity'),
    /** Set when this latency went into its source's baseline, so the window never reuses it. */
    inLatencyBaseline: z.boolean().default(false),
  })
  .strict();
export type SessionEndObservation = z.input<typeof ObservationSchema>;
type StoredObservation = z.output<typeof ObservationSchema>;

const LatencyBaselinesSchema = z
  .object({
    typed: z.array(z.number().min(0)).max(16),
    spoken: z.array(z.number().min(0)).max(16),
    activity: z.array(z.number().min(0)).max(16),
  })
  .strict();

export const OFFER_OUTCOMES = ['pending', 'accepted', 'declined', 'unanswered', 'not_offered'] as const;
export type OfferOutcome = (typeof OFFER_OUTCOMES)[number];

const EventSchema = z
  .object({
    /** 1-based index of the graded observation the signal fired on. */
    observation: z.number().int().min(1),
    elapsedMs: z.number().min(0),
    /** Milliseconds left before the hard cap at the moment it fired (never negative here). */
    remainingMs: z.number().min(0),
    latencySdBaseline: z.number().min(0),
    latencySdWindow: z.number().min(0),
    surpriseRateBaseline: z.number().min(0).max(1),
    surpriseRateWindow: z.number().min(0).max(1),
    mode: z.enum(['offer', 'shadow']),
    outcome: z.enum(OFFER_OUTCOMES),
    /**
     * Precision label (Appendix F §1.1 "Early-Warning Signal Trigger Rate"):
     * true = the learner accepted the stop, or the surprising misses persisted
     * in the next `confirmWindow` observations; false = declined/shadow and the
     * next observations recovered; null = undetermined (session ended first).
     */
    confirmed: z.boolean().nullable(),
  })
  .strict();
export type SessionEndSignalEvent = z.infer<typeof EventSchema>;

export const SessionEndSignalSnapshotSchema = z
  .object({
    count: z.number().int().min(0),
    baseline: z.array(ObservationSchema).max(16),
    recent: z.array(ObservationSchema).max(32),
    /** Per-channel latency baselines (ms): the first `baselineSize` latencies of each source. */
    latencyBaselines: LatencyBaselinesSchema.default({ typed: [], spoken: [], activity: [] }),
    events: z.array(EventSchema).max(10),
    offersMade: z.number().int().min(0),
    offerOpen: z.boolean(),
    /** The observation count before which the signal may not fire again. */
    armedFrom: z.number().int().min(0),
    evaluations: z.number().int().min(0),
  })
  .strict();
export type SessionEndSignalSnapshot = z.infer<typeof SessionEndSignalSnapshotSchema>;

export const EMPTY_SESSION_END_SIGNAL: SessionEndSignalSnapshot = {
  count: 0,
  baseline: [],
  recent: [],
  latencyBaselines: { typed: [], spoken: [], activity: [] },
  events: [],
  offersMade: 0,
  offerOpen: false,
  armedFrom: 0,
  evaluations: 0,
};

export interface SignalEvaluation {
  fired: boolean;
  /** Null when the component could not be measured (too few samples). */
  latencySdBaseline: number | null;
  latencySdWindow: number | null;
  /** The channel whose baseline and window the latency figures above come from. */
  latencySource: LatencySource | null;
  surpriseRateBaseline: number | null;
  surpriseRateWindow: number | null;
  surprisingMisses: number;
}

/** What Core records at close (tutor_session_end_signal + tutor_sessions.end_signal_evaluated). */
export interface SessionEndSignalReport {
  /** Whether the session produced enough graded observations for the window to be evaluated at least once. */
  evaluated: boolean;
  events: SessionEndSignalEvent[];
}

function lnSd(values: number[]): number {
  const logs = values.map((v) => Math.log(Math.max(1, v)));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length;
  return Math.sqrt(variance);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class SessionEndSignal {
  private state: SessionEndSignalSnapshot = structuredClone(EMPTY_SESSION_END_SIGNAL);

  constructor(
    readonly mode: SessionEndSignalMode = 'offer',
    readonly config: SessionEndSignalConfig = SESSION_END_SIGNAL_DEFAULTS,
  ) {}

  snapshot(): SessionEndSignalSnapshot {
    return structuredClone(this.state);
  }

  restore(snapshot: SessionEndSignalSnapshot): void {
    this.state = SessionEndSignalSnapshotSchema.parse(structuredClone(snapshot));
  }

  /** Whether an offer is on screen, waiting for the learner's choice. */
  get offerOpen(): boolean {
    return this.state.offerOpen;
  }

  private surpriseRate(observations: StoredObservation[]): { rate: number | null; misses: number } {
    const expected = observations.filter(
      (o) => o.pCorrect !== null && o.pCorrect >= this.config.surpriseProbability,
    );
    const misses = expected.filter((o) => !o.correct).length;
    return { rate: expected.length === 0 ? null : misses / expected.length, misses };
  }

  /**
   * The latency half, per channel: each source's window SD against the
   * baseline of the SAME source. Returns the measured source with the largest
   * rise (null figures when no source has enough samples on both sides).
   */
  private latencyReading(window: StoredObservation[]): { baseline: number | null; window: number | null; source: LatencySource | null } {
    let best: { baseline: number; window: number; source: LatencySource } | null = null;
    for (const source of LATENCY_SOURCES) {
      const base = this.state.latencyBaselines[source];
      if (base.length < this.config.minLatencySamples) continue;
      const latencies = window
        .filter((o) => o.source === source && o.latencyMs !== null && !o.inLatencyBaseline)
        .map((o) => o.latencyMs as number);
      if (latencies.length < this.config.minLatencySamples) continue;
      const reading = { baseline: lnSd(base), window: lnSd(latencies), source };
      if (best === null || reading.window - reading.baseline > best.window - best.baseline) best = reading;
    }
    return best ?? { baseline: null, window: null, source: null };
  }

  /** The current reading, without recording anything. */
  evaluate(): SignalEvaluation {
    const none: SignalEvaluation = {
      fired: false,
      latencySdBaseline: null,
      latencySdWindow: null,
      latencySource: null,
      surpriseRateBaseline: null,
      surpriseRateWindow: null,
      surprisingMisses: 0,
    };
    const afterBaseline = this.state.count - this.state.baseline.length;
    if (this.state.baseline.length < this.config.baselineSize || afterBaseline < this.config.minWindow) {
      return none;
    }
    const window = this.state.recent.slice(-Math.min(this.config.windowSize, afterBaseline));
    const baselineSurprise = this.surpriseRate(this.state.baseline);
    const windowSurprise = this.surpriseRate(window);
    const expectedInWindow = window.filter(
      (o) => o.pCorrect !== null && o.pCorrect >= this.config.surpriseProbability,
    ).length;
    const surpriseMeasured = expectedInWindow >= this.config.minExpectedItems;
    const latency = this.latencyReading(window);
    const latencySdBaseline = latency.baseline;
    const latencySdWindow = latency.window;
    // A baseline with no expected-correct items opened with no reason to
    // expect anything, so its surprising-miss rate is zero by definition.
    const baselineRate = baselineSurprise.rate ?? 0;
    const surpriseRising =
      surpriseMeasured &&
      windowSurprise.rate !== null &&
      windowSurprise.misses >= this.config.minSurprisingMisses &&
      windowSurprise.rate - baselineRate >= this.config.surpriseRateRise;
    const latencyRising =
      latencySdBaseline !== null &&
      latencySdWindow !== null &&
      latencySdWindow - latencySdBaseline >= this.config.latencyVariabilityRise;
    return {
      fired: surpriseRising && latencyRising,
      latencySdBaseline,
      latencySdWindow,
      latencySource: latency.source,
      surpriseRateBaseline: baselineSurprise.rate ?? 0,
      surpriseRateWindow: surpriseMeasured ? windowSurprise.rate : null,
      surprisingMisses: windowSurprise.misses,
    };
  }

  /**
   * Records one graded observation and says whether the Mentor should make
   * the stop-or-continue offer on the turn that reacts to it.
   *
   * `clock` only STAMPS a firing for the Trigger Rate metric ("fired before
   * the hard cap"); it never influences whether the signal fires.
   */
  observe(observation: SessionEndObservation, clock: { elapsedMs: number; remainingMs: number }): { offer: boolean } {
    if (this.mode === 'off') return { offer: false };
    const clean = ObservationSchema.parse(observation);
    // Each channel's own opening baseline: its first `baselineSize` latencies.
    const sourceBaseline = this.state.latencyBaselines[clean.source];
    if (clean.latencyMs !== null && sourceBaseline.length < this.config.baselineSize) {
      sourceBaseline.push(clean.latencyMs);
      clean.inLatencyBaseline = true;
    }
    this.state.count += 1;
    if (this.state.baseline.length < this.config.baselineSize) this.state.baseline.push(clean);
    else {
      this.state.recent.push(clean);
      if (this.state.recent.length > 32) this.state.recent.shift();
    }
    this.confirmPriorEvents();

    const reading = this.evaluate();
    const afterBaseline = this.state.count - this.state.baseline.length;
    if (afterBaseline >= this.config.minWindow) this.state.evaluations += 1;
    if (!reading.fired || this.state.count < this.state.armedFrom || this.state.offerOpen) return { offer: false };
    if (this.state.events.length >= 10) return { offer: false };

    const offering = this.mode === 'offer' && this.state.offersMade < this.config.maxOffers;
    if (this.mode === 'offer' && !offering) return { offer: false };
    this.state.events.push({
      observation: this.state.count,
      elapsedMs: Math.max(0, Math.round(clock.elapsedMs)),
      remainingMs: Math.max(0, Math.round(clock.remainingMs)),
      latencySdBaseline: round3(reading.latencySdBaseline ?? 0),
      latencySdWindow: round3(reading.latencySdWindow ?? 0),
      surpriseRateBaseline: round3(reading.surpriseRateBaseline ?? 0),
      surpriseRateWindow: round3(reading.surpriseRateWindow ?? 0),
      mode: offering ? 'offer' : 'shadow',
      // A shadow firing never reaches the learner; an offer is pending until
      // the Mentor's turn actually carries it (`markOfferDelivered`).
      outcome: offering ? 'pending' : 'not_offered',
      confirmed: null,
    });
    this.state.armedFrom = this.state.count + this.config.rearmAfterObservations;
    return { offer: offering };
  }

  /** The turn that was meant to carry the offer delivered it. */
  markOfferDelivered(): void {
    const event = this.state.events.at(-1);
    if (!event || event.outcome !== 'pending') return;
    this.state.offersMade += 1;
    this.state.offerOpen = true;
  }

  /**
   * The turn that was meant to carry the offer did NOT (a scripted fallback,
   * a safety line, an activity request). The firing stays on record as
   * not offered and the signal re-arms at once, so the next graded turn can
   * carry it instead — an offer is never silently lost.
   */
  markOfferNotDelivered(): void {
    const event = this.state.events.at(-1);
    if (!event || event.outcome !== 'pending') return;
    event.outcome = 'not_offered';
    this.state.armedFrom = this.state.count;
  }

  /** The learner answered the open offer (chips, or a classified reply). */
  recordResponse(outcome: 'accepted' | 'declined' | 'unanswered'): void {
    if (!this.state.offerOpen) return;
    this.state.offerOpen = false;
    // The re-arm window counts from the learner's answer, not from the
    // firing: observations made while the offer sat open are not "more
    // graded turns" after a decline.
    this.state.armedFrom = Math.max(this.state.armedFrom, this.state.count + this.config.rearmAfterObservations);
    const event = [...this.state.events].reverse().find((e) => e.mode === 'offer' && e.outcome === 'pending');
    if (!event) return;
    event.outcome = outcome;
    if (outcome === 'accepted') event.confirmed = true;
  }

  /** Labels earlier firings once enough later observations exist. */
  private confirmPriorEvents(): void {
    // Firings only happen after the baseline, so every observation that can
    // follow one lives in `recent`; `recentStart` is the 1-based index of
    // `recent[0]` (the array is a bounded tail, so it may have shifted).
    const recentStart = this.state.count - this.state.recent.length + 1;
    for (const event of this.state.events) {
      if (event.confirmed !== null) continue;
      const after = this.state.recent.slice(Math.max(0, event.observation + 1 - recentStart));
      if (after.length < this.config.confirmWindow) continue;
      const next = after.slice(0, this.config.confirmWindow);
      const surprising = next.filter(
        (o) => o.pCorrect !== null && o.pCorrect >= this.config.surpriseProbability && !o.correct,
      ).length;
      event.confirmed = surprising >= this.config.minSurprisingMisses;
    }
  }

  report(): SessionEndSignalReport {
    return {
      evaluated: this.state.evaluations > 0,
      events: this.state.events.map((e) => ({
        ...e,
        // An offer still open when the session ended was never answered.
        outcome: e.outcome === 'pending' ? 'unanswered' : e.outcome,
      })),
    };
  }
}

/*
 * THE LEARNER'S ANSWER TO THE OFFER, IN WORDS.
 *
 * The rebuilt stage shows two equal choices (`session_end_response`), but a
 * learner can also just say it, and the legacy screen has no chips. The read
 * is deliberately NARROW: only an explicit stop is an acceptance, only an
 * explicit "keep going" is a decline, and everything else is "unanswered" —
 * which continues the lesson. An ambiguous "yes" to "stop, or one more?" is
 * never read as either (Frontend Bible 08 §4: never a default-accepted path).
 */
/*
 * Whole-word matching that understands accented letters: JavaScript's `\b`
 * treats "é", "í" and "ã" as non-word characters, so "ya terminé" or "aún no"
 * never matched a `\b`-bounded pattern.
 */
const wordsOf = (alternation: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, 'iu');

const DECLINE_PATTERNS: RegExp[] = [
  wordsOf("one more|another one|keep (?:on )?go(?:ing|in'?)|continue|don'?t stop|do not stop|not yet|more please"),
  wordsOf('otr[oa] m[aá]s|una m[aá]s|otr[oa]|seguir|sigamos|seguimos|continuar|continuemos|no (?:quiero )?parar|todav[ií]a no|a[uú]n no'),
  wordsOf('mais uma|mais um|outr[ao]|continuar|vamos continuar|n[aã]o (?:quero )?parar|ainda n[aã]o'),
];
const ACCEPT_PATTERNS: RegExp[] = [
  wordsOf("stop|let'?s stop|stop here|i'?m done|i am done|done for today|that'?s enough|enough for today|finish|bye"),
  wordsOf('parar|paremos|paramos|para aqu[ií]|terminar|terminemos|terminamos|ya termin[eé]|hasta aqu[ií]|basta por hoy|ya estuvo|adi[oó]s'),
  wordsOf('parar|paramos|vamos parar|(?:vamos |bora )?para por hoje|terminar|terminamos|chega por hoje|por hoje [ée] s[oó]|tchau'),
];

export function classifyStopReply(text: string): 'accept' | 'decline' | 'unclear' {
  const cleaned = text.normalize('NFC').trim();
  if (cleaned === '') return 'unclear';
  // A decline is checked FIRST: "don't stop" and "no quiero parar" contain
  // the accept word, and reading them as acceptance would end a lesson the
  // learner explicitly asked to continue.
  if (DECLINE_PATTERNS.some((p) => p.test(cleaned))) return 'decline';
  if (ACCEPT_PATTERNS.some((p) => p.test(cleaned))) return 'accept';
  return 'unclear';
}
