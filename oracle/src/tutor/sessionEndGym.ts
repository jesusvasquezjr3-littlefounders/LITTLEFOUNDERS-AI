import {
  SESSION_END_SIGNAL_DEFAULTS,
  SessionEndSignal,
  type SessionEndObservation,
  type SessionEndSignalConfig,
} from './sessionEndSignal.js';

/*
 * C.8 / C.12 — THE SESSION-END SIGNAL AGAINST APPENDIX F'S SIMULATED LEARNERS
 * (Part 3, Stage 2: "a change that degrades behavior against any one persona
 * returns to Stage 1 with an itemized failure report").
 *
 * The signal is a pure function of graded observations, so each persona is a
 * deterministic stream of them — answer latency, correctness, and the
 * probability the learner's OWN history predicted for a correct answer — over
 * a full 25-minute session. Each persona states what the signal must do for
 * it, and why, and the run itemizes every violation:
 *
 *   disengaging    D'Mello/Graesser "sink state": a good start, then erratic
 *                  timing and misses on items they know. MUST be offered a
 *                  stop, well before the hard cap.
 *   frustrated     Pekrun high-value/low-control: moves from easy items to
 *                  hard ones, thinks longer on some, misses the HARD items.
 *                  Productive struggle — must NOT be offered a stop (a miss on
 *                  a hard item is not surprising, however erratic the pace).
 *   slipping       Steady pace, but starts missing items they know: a content
 *                  problem for remediation, not a reason to stop — the timing
 *                  half of the signature is absent, so it must NOT fire.
 *   gaming         Baker rapid guessing: very fast, uniform answers, many
 *                  misses. Offering a stop would reward the guessing; the
 *                  latency half of the signature is absent, so it must NOT fire
 *                  (gaming is the Behavioral Telemetry Layer's job, C.9).
 *   reactant_teen  The disengaging signature, but declines every offer
 *                  (Appendix D §3.6). The decline must be honoured: never more
 *                  than `maxOffers`, and never re-offered inside the re-arm
 *                  window.
 *   masking        Appendix D §1.6: slow, careful and correct. Slowness is not
 *                  the signature — must NOT fire.
 *   steady         A learner in flow for the whole 25 minutes. Must NOT fire,
 *                  however long the session runs (time is never an input).
 *   voice_only     The disengaging signature in a spoken conversation with no
 *                  served activity (the normal Mentor session): reply
 *                  latencies on the spoken channel. MUST be offered a stop.
 *   typed_only     The same signature, typed. MUST be offered a stop.
 *   mixed_channels Misses on known items (the surprise half rises) while the
 *                  learner alternates a slow spoken reply and a fast typed
 *                  one. Each channel alone is steady; only MIXING them would
 *                  look erratic. Must NOT fire (channels never mix).
 *
 * Every threshold is the proposed default (Threshold Recalibration Log); the
 * personas are a floor for regressions, not a validation of the design, which
 * Appendix D §2.5 says plainly no study provides.
 */

export type OfferResponse = 'accept' | 'decline' | 'ignore';

export interface SessionEndPersona {
  name: string;
  why: string;
  /** Graded observations, one per graded turn, with the minute it happened. */
  observations: { minute: number; observation: SessionEndObservation }[];
  expectOffer: boolean;
  /** How this learner answers an offer. */
  respond: OfferResponse;
}

const HARD_CAP_MINUTES = 25;

function stream(
  count: number,
  make: (i: number) => SessionEndObservation,
  startMinute = 0,
  minutesPerTurn = 1.2,
): { minute: number; observation: SessionEndObservation }[] {
  return Array.from({ length: count }, (_, i) => ({ minute: startMinute + i * minutesPerTurn, observation: make(i) }));
}

export const SESSION_END_PERSONAS: SessionEndPersona[] = [
  {
    name: 'disengaging',
    why: 'sink state: erratic timing and misses on items they know — the signature itself',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 9_000 + (i % 2) * 500, correct: true, pCorrect: 0.85 })),
      ...stream(12, (i) => ({ latencyMs: i % 2 === 0 ? 2_500 : 34_000, correct: i % 3 === 0, pCorrect: 0.85 }), 6),
    ],
    expectOffer: true,
    respond: 'accept',
  },
  {
    name: 'frustrated',
    why: 'productive struggle on hard items: misses there are expected, even at an erratic pace',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 9_000 + (i % 2) * 500, correct: true, pCorrect: 0.85 })),
      ...stream(14, (i) => ({ latencyMs: i % 2 === 0 ? 6_000 : 38_000, correct: i % 3 === 0, pCorrect: 0.35 }), 6),
    ],
    expectOffer: false,
    respond: 'decline',
  },
  {
    name: 'slipping',
    why: 'misses on known items at a steady pace: remediation, not a stop',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 9_000 + (i % 2) * 500, correct: true, pCorrect: 0.85 })),
      ...stream(14, (i) => ({ latencyMs: 9_500 + (i % 2) * 500, correct: i % 3 === 0, pCorrect: 0.85 }), 6),
    ],
    expectOffer: false,
    respond: 'decline',
  },
  {
    name: 'gaming',
    why: 'rapid uniform guessing: surprising misses without the latency half of the signature',
    observations: stream(20, (i) => ({ latencyMs: 900 + (i % 2) * 100, correct: i % 4 === 0, pCorrect: 0.8 })),
    expectOffer: false,
    respond: 'accept',
  },
  {
    name: 'reactant_teen',
    why: 'the signature, but declines every offer: the decline must be honoured',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 7_000 + (i % 2) * 400, correct: true, pCorrect: 0.85 })),
      ...stream(18, (i) => ({ latencyMs: i % 2 === 0 ? 2_000 : 30_000, correct: i % 3 === 0, pCorrect: 0.85 }), 6, 1),
    ],
    expectOffer: true,
    respond: 'decline',
  },
  {
    name: 'masking',
    why: 'slow, careful and correct: slowness alone is not the signature',
    observations: stream(18, (i) => ({ latencyMs: 40_000 + (i % 2) * 2_000, correct: i % 7 !== 3, pCorrect: 0.8 })),
    expectOffer: false,
    respond: 'ignore',
  },
  {
    name: 'voice_only',
    why: 'the sink-state signature in a spoken conversation: erratic spoken replies and misses on items they know',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 2_400 + (i % 2) * 300, correct: true, pCorrect: 0.85, source: 'spoken' as const })),
      ...stream(12, (i) => ({ latencyMs: i % 2 === 0 ? 700 : 11_000, correct: i % 3 === 0, pCorrect: 0.85, source: 'spoken' as const }), 6),
    ],
    expectOffer: true,
    respond: 'accept',
  },
  {
    name: 'typed_only',
    why: 'the sink-state signature in a typed conversation: erratic typed replies and misses on items they know',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 5_000 + (i % 2) * 400, correct: true, pCorrect: 0.85, source: 'typed' as const })),
      ...stream(12, (i) => ({ latencyMs: i % 2 === 0 ? 1_200 : 26_000, correct: i % 3 === 0, pCorrect: 0.85, source: 'typed' as const }), 6),
    ],
    expectOffer: true,
    respond: 'accept',
  },
  {
    name: 'mixed_channels',
    why: 'misses on known items while each channel stays steady: only mixing a slow spoken reply with a fast typed one would look erratic',
    observations: [
      ...stream(5, (i) => ({ latencyMs: 5_000 + (i % 2) * 200, correct: true, pCorrect: 0.85, source: 'typed' as const })),
      ...stream(16, (i) =>
        i % 2 === 0
          ? { latencyMs: 30_000 + (i % 4) * 250, correct: i % 3 === 0, pCorrect: 0.85, source: 'spoken' as const }
          : { latencyMs: 5_000 + (i % 4) * 100, correct: i % 3 === 0, pCorrect: 0.85, source: 'typed' as const },
      6),
    ],
    expectOffer: false,
    respond: 'ignore',
  },
  {
    name: 'steady',
    why: 'in flow for the whole session: time on task is never a reason to stop',
    observations: stream(21, (i) => ({ latencyMs: 8_000 + (i % 3) * 600, correct: i % 9 !== 4, pCorrect: 0.85 })),
    expectOffer: false,
    respond: 'ignore',
  },
];

export interface SessionEndPersonaReport {
  persona: string;
  offers: { observation: number; minute: number }[];
  /** Firings recorded in total (offered or not). */
  firings: number;
  problems: string[];
}

export function runSessionEndPersona(
  persona: SessionEndPersona,
  config: SessionEndSignalConfig = SESSION_END_SIGNAL_DEFAULTS,
): SessionEndPersonaReport {
  const signal = new SessionEndSignal('offer', config);
  const offers: { observation: number; minute: number }[] = [];
  const problems: string[] = [];
  let lastAnswerAt: number | null = null;

  for (const [index, { minute, observation }] of persona.observations.entries()) {
    const elapsedMs = minute * 60_000;
    const { offer } = signal.observe(observation, { elapsedMs, remainingMs: HARD_CAP_MINUTES * 60_000 - elapsedMs });
    if (!offer) continue;
    signal.markOfferDelivered();
    offers.push({ observation: index + 1, minute });
    // Judged against the POLICY (the proposed defaults), not the config under
    // test — a broken config must not be able to excuse itself.
    const window = SESSION_END_SIGNAL_DEFAULTS.rearmAfterObservations;
    if (lastAnswerAt !== null && index + 1 - lastAnswerAt < window) {
      problems.push(`re-offered ${index + 1 - lastAnswerAt} graded turn(s) after the learner answered (window ${window})`);
    }
    if (persona.respond === 'accept') {
      // Accepting starts the completed close: no graded turn follows.
      signal.recordResponse('accepted');
      break;
    }
    if (persona.respond === 'decline') {
      signal.recordResponse('declined');
      lastAnswerAt = index + 1;
    }
  }

  const report = signal.report();
  if (persona.expectOffer && offers.length === 0) {
    problems.push(`never offered a stop (${persona.why})`);
  }
  const first = offers[0];
  if (!persona.expectOffer && first) {
    problems.push(`offered a stop at minute ${first.minute.toFixed(1)} (${persona.why})`);
  }
  if (persona.expectOffer && first && first.minute >= HARD_CAP_MINUTES - 5) {
    problems.push(`first offer only at minute ${first.minute.toFixed(1)} — not "well before" the hard cap`);
  }
  const maxOffers = SESSION_END_SIGNAL_DEFAULTS.maxOffers;
  if (offers.length > maxOffers) problems.push(`offered ${offers.length} times (max ${maxOffers})`);
  if (persona.respond === 'accept' && offers.length > 0 && report.events[0]?.confirmed !== true) {
    problems.push('an accepted offer was not recorded as a confirmed firing');
  }
  for (const event of report.events) {
    // Signal strength only: the record carries numbers, never a label.
    if (Object.keys(event).some((k) => /emotion|affect|mood|tired|bored|frustrat/i.test(k))) {
      problems.push('the event record carries an emotional label');
    }
  }
  return { persona: persona.name, offers, firings: report.events.length, problems };
}

export function runSessionEndGym(
  personas: readonly SessionEndPersona[] = SESSION_END_PERSONAS,
): { reports: SessionEndPersonaReport[]; ok: boolean } {
  const reports = personas.map((p) => runSessionEndPersona(p));
  return { reports, ok: reports.every((r) => r.problems.length === 0) };
}
