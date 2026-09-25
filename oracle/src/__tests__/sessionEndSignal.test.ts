import { describe, expect, it } from 'vitest';
import {
  classifyStopReply,
  EMPTY_SESSION_END_SIGNAL,
  parseSessionEndSignalMode,
  SESSION_END_SIGNAL_DEFAULTS,
  SessionEndSignal,
  SessionEndSignalSnapshotSchema,
  type SessionEndObservation,
} from '../tutor/sessionEndSignal.js';

/*
 * C.8 / C.12 — the behavioral-signature session-end signal (Appendix D §2.5).
 *
 * Pins the mandate's exact composition: it fires only when BOTH rising
 * response-latency variability AND a rising surprising-miss rate are measured
 * against the learner's own session-opening baseline, over a rolling window;
 * neither elapsed time nor turn count is an input, so it can fire long before
 * the hard cap and never fires because of the clock; it offers at most
 * `maxOffers` times, re-arms, and in `shadow` / `off` (the Stage 7 rollback)
 * never reaches the learner.
 */

const CLOCK = { elapsedMs: 4 * 60_000, remainingMs: 21 * 60_000 };

/** A steady learner: consistent answer times, expected items answered right. */
const steady = (i: number): SessionEndObservation => ({
  latencyMs: 8_000 + (i % 2) * 400,
  correct: true,
  pCorrect: 0.85,
});

/** The signature: erratic latencies and misses on items the learner should get right. */
const degrading = (i: number): SessionEndObservation => ({
  latencyMs: i % 2 === 0 ? 2_000 : 30_000,
  correct: i % 3 === 0,
  pCorrect: 0.85,
});

function feed(signal: SessionEndSignal, observations: SessionEndObservation[], clock = CLOCK): boolean[] {
  return observations.map((o) => signal.observe(o, clock).offer);
}

const baseline = () => Array.from({ length: SESSION_END_SIGNAL_DEFAULTS.baselineSize }, (_, i) => steady(i));

describe('the signal fires on the full behavioral signature, and only on it', () => {
  it('offers once the window shows both rising latency variability and surprising misses', () => {
    const signal = new SessionEndSignal('offer');
    const offers = feed(signal, [...baseline(), ...Array.from({ length: 8 }, (_, i) => degrading(i))]);
    expect(offers.some(Boolean)).toBe(true);
    const event = signal.report().events[0];
    expect(event.mode).toBe('offer');
    expect(event.latencySdWindow).toBeGreaterThan(event.latencySdBaseline);
    expect(event.surpriseRateWindow).toBeGreaterThan(event.surpriseRateBaseline);
    // It fired well before the hard cap, and the record says so.
    expect(event.remainingMs).toBeGreaterThan(0);
  });

  it('does not fire for a steady learner, however long the session runs', () => {
    const signal = new SessionEndSignal('offer');
    const late = { elapsedMs: 24 * 60_000, remainingMs: 60_000 };
    const offers = feed(signal, Array.from({ length: 60 }, (_, i) => steady(i)), late);
    expect(offers.some(Boolean)).toBe(false);
    expect(signal.report().events).toEqual([]);
    expect(signal.report().evaluated).toBe(true);
  });

  it('does not fire on latency variability alone (erratic but still correct)', () => {
    const signal = new SessionEndSignal('offer');
    const erratic = (i: number): SessionEndObservation => ({ ...degrading(i), correct: true });
    expect(feed(signal, [...baseline(), ...Array.from({ length: 10 }, (_, i) => erratic(i))]).some(Boolean)).toBe(false);
  });

  it('does not fire on misses alone (steady timing)', () => {
    const signal = new SessionEndSignal('offer');
    const missing = (i: number): SessionEndObservation => ({ ...steady(i), correct: i % 3 === 0 });
    expect(feed(signal, [...baseline(), ...Array.from({ length: 10 }, (_, i) => missing(i))]).some(Boolean)).toBe(false);
  });

  it('does not count ordinary misses on hard items as surprising', () => {
    const signal = new SessionEndSignal('offer');
    const hard = (i: number): SessionEndObservation => ({ ...degrading(i), pCorrect: 0.3 });
    expect(feed(signal, [...baseline(), ...Array.from({ length: 10 }, (_, i) => hard(i))]).some(Boolean)).toBe(false);
  });

  it('never reads a missing prediction as a surprising miss', () => {
    const signal = new SessionEndSignal('offer');
    const unknown = (i: number): SessionEndObservation => ({ ...degrading(i), pCorrect: null });
    expect(feed(signal, [...baseline(), ...Array.from({ length: 10 }, (_, i) => unknown(i))]).some(Boolean)).toBe(false);
  });

  it('is judged against the learner’s OWN opening baseline, not a population norm', () => {
    // A learner who was erratic from the first answer has not "risen".
    const signal = new SessionEndSignal('offer');
    const erraticFromStart = Array.from({ length: 4 }, (_, i) => ({ ...degrading(i), correct: false, pCorrect: 0.85 }));
    expect(feed(signal, [...erraticFromStart, ...Array.from({ length: 10 }, (_, i) => degrading(i))]).some(Boolean)).toBe(false);
  });

  it('waits for the baseline and a minimum window before it can fire', () => {
    const signal = new SessionEndSignal('offer');
    const offers = feed(signal, [...baseline(), ...Array.from({ length: 8 }, (_, i) => degrading(i))]);
    const first = offers.indexOf(true);
    expect(first).toBeGreaterThanOrEqual(SESSION_END_SIGNAL_DEFAULTS.baselineSize + SESSION_END_SIGNAL_DEFAULTS.minWindow - 1);
  });

  it('takes no clock input into the decision — identical observations decide identically at any time', () => {
    const a = new SessionEndSignal('offer');
    const b = new SessionEndSignal('offer');
    const obs = [...baseline(), ...Array.from({ length: 8 }, (_, i) => degrading(i))];
    expect(feed(a, obs, { elapsedMs: 60_000, remainingMs: 24 * 60_000 })).toEqual(
      feed(b, obs, { elapsedMs: 24 * 60_000, remainingMs: 0 }),
    );
  });
});

describe('offers, outcomes and re-arming', () => {
  function fired(): SessionEndSignal {
    const signal = new SessionEndSignal('offer');
    for (const o of [...baseline(), ...Array.from({ length: 12 }, (_, i) => degrading(i))]) {
      if (signal.observe(o, CLOCK).offer) break;
    }
    return signal;
  }

  it('an offer is pending until a turn actually carries it', () => {
    const signal = fired();
    expect(signal.offerOpen).toBe(false);
    signal.markOfferDelivered();
    expect(signal.offerOpen).toBe(true);
  });

  it('an offer the turn did not carry is recorded as not offered, and re-arms at once', () => {
    const signal = fired();
    signal.markOfferNotDelivered();
    expect(signal.report().events[0].outcome).toBe('not_offered');
    // The very next degrading observation may carry it instead.
    expect(signal.observe(degrading(1), CLOCK).offer).toBe(true);
  });

  it('records accepted as a confirmed firing and closes the offer', () => {
    const signal = fired();
    signal.markOfferDelivered();
    signal.recordResponse('accepted');
    expect(signal.offerOpen).toBe(false);
    expect(signal.report().events[0]).toMatchObject({ outcome: 'accepted', confirmed: true });
  });

  it('does not offer again while an offer is open, nor before re-arming', () => {
    const signal = fired();
    signal.markOfferDelivered();
    expect(feed(signal, Array.from({ length: 6 }, (_, i) => degrading(i))).some(Boolean)).toBe(false);
    signal.recordResponse('declined');
    const next = feed(signal, Array.from({ length: SESSION_END_SIGNAL_DEFAULTS.rearmAfterObservations - 1 }, (_, i) => degrading(i)));
    expect(next.some(Boolean)).toBe(false);
  });

  it('offers at most maxOffers times per session', () => {
    const signal = new SessionEndSignal('offer');
    let offers = 0;
    for (const o of [...baseline(), ...Array.from({ length: 80 }, (_, i) => degrading(i))]) {
      if (signal.observe(o, CLOCK).offer) {
        offers += 1;
        signal.markOfferDelivered();
        signal.recordResponse('declined');
      }
    }
    expect(offers).toBe(SESSION_END_SIGNAL_DEFAULTS.maxOffers);
  });

  it('labels a declined firing confirmed when surprising misses persist, and not when they recover', () => {
    const persisting = fired();
    persisting.markOfferDelivered();
    persisting.recordResponse('declined');
    feed(persisting, Array.from({ length: 4 }, () => ({ latencyMs: 25_000, correct: false, pCorrect: 0.9 })));
    expect(persisting.report().events[0].confirmed).toBe(true);

    const recovering = fired();
    recovering.markOfferDelivered();
    recovering.recordResponse('declined');
    feed(recovering, Array.from({ length: 4 }, (_, i) => steady(i)));
    expect(recovering.report().events[0].confirmed).toBe(false);
  });

  it('reports an offer still open at the end as unanswered', () => {
    const signal = fired();
    signal.markOfferDelivered();
    expect(signal.report().events[0].outcome).toBe('unanswered');
  });

  it('ignores a response when no offer is open', () => {
    const signal = new SessionEndSignal('offer');
    signal.recordResponse('accepted');
    expect(signal.report().events).toEqual([]);
  });
});

describe('the Stage 7 kill switch', () => {
  it('shadow computes and records, but never offers', () => {
    const signal = new SessionEndSignal('shadow');
    const offers = feed(signal, [...baseline(), ...Array.from({ length: 12 }, (_, i) => degrading(i))]);
    expect(offers.some(Boolean)).toBe(false);
    const events = signal.report().events;
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.mode === 'shadow' && e.outcome === 'not_offered')).toBe(true);
  });

  it('off computes nothing', () => {
    const signal = new SessionEndSignal('off');
    feed(signal, [...baseline(), ...Array.from({ length: 12 }, (_, i) => degrading(i))]);
    expect(signal.report()).toEqual({ evaluated: false, events: [] });
  });

  it('an unknown mode falls back to offer, never to silently off', () => {
    expect(parseSessionEndSignalMode('shadow')).toBe('shadow');
    expect(parseSessionEndSignalMode('off')).toBe('off');
    expect(parseSessionEndSignalMode('Off')).toBe('offer');
    expect(parseSessionEndSignalMode(undefined)).toBe('offer');
  });
});

describe('it rides the park snapshot', () => {
  it('round-trips through JSON without losing the baseline or an open offer', () => {
    const signal = new SessionEndSignal('offer');
    for (const o of [...baseline(), ...Array.from({ length: 12 }, (_, i) => degrading(i))]) {
      if (signal.observe(o, CLOCK).offer) {
        signal.markOfferDelivered();
        break;
      }
    }
    const restored = new SessionEndSignal('offer');
    restored.restore(SessionEndSignalSnapshotSchema.parse(JSON.parse(JSON.stringify(signal.snapshot()))));
    expect(restored.snapshot()).toEqual(signal.snapshot());
    expect(restored.offerOpen).toBe(true);
    expect(SessionEndSignalSnapshotSchema.parse(EMPTY_SESSION_END_SIGNAL)).toEqual(EMPTY_SESSION_END_SIGNAL);
  });
});

describe('the learner’s answer to the offer, in words', () => {
  it('reads an explicit stop as acceptance in every locale', () => {
    for (const text of ["let's stop", 'I am done for today', 'paremos aquí', 'ya terminé', 'vamos parar', 'chega por hoje']) {
      expect(classifyStopReply(text), text).toBe('accept');
    }
  });

  it('reads an explicit "keep going" as a decline — including negated stops', () => {
    for (const text of ['one more please', "don't stop", 'no quiero parar', 'otra más', 'mais uma', 'não quero parar', 'todavía no']) {
      expect(classifyStopReply(text), text).toBe('decline');
    }
  });

  it('never reads an ambiguous reply as either', () => {
    for (const text of ['yes', 'sí', 'ok', 'hmm', '', 'what is 5 plus 3?']) {
      expect(classifyStopReply(text), text).toBe('unclear');
    }
  });
});
