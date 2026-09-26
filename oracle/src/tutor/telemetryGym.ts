import {
  BehavioralTelemetry,
  TELEMETRY_DEFAULTS,
  type TelemetryConfig,
  type TelemetryInput,
  type TelemetryReading,
} from './behavioralTelemetry.js';
import type { Locale } from '../context/schema.js';

/*
 * C.9 / C.19 — THE BEHAVIORAL TELEMETRY LAYER AGAINST APPENDIX F'S SIMULATED
 * LEARNERS (Part 3, Stage 2), and the dedicated adversarial test the C.9
 * Definition of Done asks for: "the layer never outputs a declarative emotion
 * label ... across the full simulated-student suite".
 *
 * Each persona is a deterministic stream of learner turns (words, reply
 * latency, verified answers) built from Appendix D's own profiles, with the
 * behaviour the layer must show for it and why:
 *
 *   disengaging          D'Mello/Graesser sink state: an engaged start, then
 *                        minimal replies, off-topic drift and slow misses.
 *                        MUST get the check-in, early.
 *   frustrated           Pekrun high value / low control: the same wrong
 *                        answer again and again with rising uncertainty
 *                        language. MUST get the check-in (frustration wants
 *                        a path forward, and the repair offers one).
 *   productive_struggle  confusion that resolves: long thinking, full
 *                        sentences, eventually right. Must NOT be checked on
 *                        — resolved confusion is where learning happens.
 *   gaming               Baker rapid guessing plus hint abuse. MUST get the
 *                        check-in.
 *   careless             fast misses on items the learner knows, at an engaged
 *                        pace: an attention slip, not disengagement. Must NOT
 *                        be checked on (the slip is recorded, not fused).
 *   reactant_teen        terse and fast FROM THE START (§1.6: a teen's baseline
 *                        terseness is self-presentation), later genuinely
 *                        drifting, and brushing off the check-in. Its baseline
 *                        must not fire; the drift may, at most `maxCheckIns`
 *                        times and never inside the re-arm window.
 *   masking              §1.6 developmental masking: polite and brief, then a
 *                        quiet withdrawal (shorter, slower, missing) with no
 *                        complaint at all. MUST get the check-in — from
 *                        behaviour, never from a feeling word.
 *   steady               in flow for the whole session. Must NOT be checked
 *                        on, however long it runs.
 *
 * Every threshold is the proposed default (Threshold Recalibration Log). The
 * personas are a regression floor, not a validation: Appendix D §1.6 puts
 * text/telemetry-only detection in a "moderately useful, far from certain"
 * range, which is why the layer's only output is a low-stakes question.
 */

export type CheckInAnswer = 'aligned' | 'misaligned' | 'ignore';

export interface TelemetryPersona {
  name: string;
  why: string;
  locale: Locale;
  turns: Omit<TelemetryInput, 'topicText'>[];
  expectCheckIn: boolean;
  /** When a check-in is expected, the latest learner turn (1-based) by which it must have come. */
  checkInBy?: number;
  answer: CheckInAnswer;
}

const TOPIC =
  'Saving for a goal: if the bike costs 60 dollars and you save 5 each week, how many weeks? Money, saving, spending.';

const typed = (text: string, latencyMs: number): Omit<TelemetryInput, 'topicText'> => ({
  source: 'typed',
  text,
  latencyMs,
  graded: null,
});
const graded = (text: string, correct: boolean, latencyMs: number, pCorrect = 0.5): Omit<TelemetryInput, 'topicText'> => ({
  source: 'typed',
  text,
  latencyMs,
  graded: { correct, pCorrect, answer: text },
});
const activity = (correct: boolean, latencyMs: number, pCorrect = 0.5): Omit<TelemetryInput, 'topicText'> => ({
  source: 'activity',
  text: null,
  latencyMs,
  graded: { correct, pCorrect, answer: null },
});

const ENGAGED_OPENING = [
  typed('I want to save money for a new bike this summer', 5_000),
  typed('It costs sixty dollars at the store near my house', 6_000),
  graded('12', true, 7_000),
  typed('Because five times twelve is sixty so twelve weeks', 6_500),
];

export const TELEMETRY_PERSONAS: TelemetryPersona[] = [
  {
    name: 'disengaging',
    why: 'sink state: minimal replies, off-topic drift and slow misses after an engaged start',
    locale: 'en-US',
    turns: [
      ...ENGAGED_OPENING,
      typed('ok', 20_000),
      typed('I played fortnite with my cousin all night yesterday', 25_000),
      typed('k', 30_000),
      graded('3', false, 40_000),
      typed('whatever', 28_000),
      typed('my dog chased a squirrel around the yard today', 35_000),
      typed('k', 30_000),
      graded('4', false, 42_000),
    ],
    expectCheckIn: true,
    checkInBy: 10,
    answer: 'misaligned',
  },
  {
    name: 'frustrated',
    why: 'stuck on the same wrong answer with rising uncertainty language: the repair is the path forward',
    locale: 'es-MX',
    turns: [
      typed('Quiero ahorrar dinero para comprar una bici nueva', 5_000),
      typed('Cuesta sesenta pesos en la tienda de la esquina', 6_000),
      graded('12', true, 7_000),
      typed('Porque cinco por doce son sesenta entonces doce semanas', 6_500),
      graded('20', false, 9_000),
      typed('no sé, no le entiendo a esto', 8_000),
      graded('veinte', false, 9_500),
      typed('no tiene sentido, creo que son veinte', 8_000),
      graded('20', false, 10_000),
      typed('ni idea la verdad', 9_000),
    ],
    expectCheckIn: true,
    checkInBy: 10,
    answer: 'misaligned',
  },
  {
    name: 'productive_struggle',
    why: 'confusion that resolves through long, thoughtful answers: never checked on',
    locale: 'en-US',
    turns: [
      ...ENGAGED_OPENING,
      typed('Wait so if I save ten dollars instead then it would take fewer weeks right', 45_000),
      graded('6', true, 50_000),
      typed('Because sixty divided by ten is six weeks of saving money', 40_000),
      typed('So saving more each week makes the goal come faster for the bike', 38_000),
      graded('4', true, 55_000),
      typed('Fifteen dollars a week means four weeks to buy the bike', 42_000),
      graded('3', true, 48_000),
      typed('And twenty a week is three weeks, the more I save the faster it goes', 44_000),
    ],
    expectCheckIn: false,
    answer: 'ignore',
  },
  {
    name: 'gaming',
    why: 'rapid guessing and help requested again with no attempt in between',
    locale: 'en-US',
    turns: [
      activity(true, 9_000),
      activity(true, 10_000),
      activity(true, 8_500),
      typed('I would save the money for the bike first', 6_000),
      activity(false, 700, 0.4),
      typed('give me a hint', 500),
      typed('another hint', 400),
      typed('help me', 300),
      activity(false, 600, 0.4),
      typed('just tell me the answer', 300),
      activity(false, 500, 0.4),
    ],
    expectCheckIn: true,
    checkInBy: 10,
    answer: 'aligned',
  },
  {
    name: 'careless',
    why: 'fast misses on items the learner knows, at an engaged pace: an attention slip, not disengagement',
    locale: 'pt-BR',
    turns: [
      activity(true, 9_000, 0.9),
      activity(true, 10_000, 0.9),
      typed('Eu quero juntar dinheiro para comprar uma bicicleta', 6_000),
      activity(true, 9_600, 0.9),
      typed('Custa sessenta reais na loja perto de casa', 6_500),
      activity(false, 900, 0.9),
      typed('Ah errei, eram doze semanas de poupança mesmo', 6_000),
      activity(false, 800, 0.9),
      typed('De novo, é cinco vezes doze que dá sessenta reais', 6_200),
      activity(true, 9_500, 0.9),
      typed('Agora sim, doze semanas guardando cinco reais', 6_000),
    ],
    expectCheckIn: false,
    answer: 'ignore',
  },
  {
    name: 'reactant_teen',
    why: 'terse from the start, later drifting, brushing off the check-in: baseline never fires; at most maxCheckIns',
    locale: 'en-US',
    turns: [
      typed('ok', 1_500),
      typed('k', 1_200),
      graded('12', true, 2_000),
      typed('sure', 1_400),
      typed('ok', 1_600),
      typed('k', 1_300),
      typed('fine', 1_500),
      typed('ok', 1_400),
      typed('bro i was at the skatepark with my friends all day', 30_000),
      graded('7', false, 40_000),
      typed('i dunno', 35_000),
      typed('we went to the mall and got pizza after that', 32_000),
      graded('8', false, 45_000),
      typed('idk', 38_000),
      typed('the new game drops friday and everybody is hyped', 30_000),
      graded('9', false, 41_000),
      typed('idk man', 36_000),
      typed('my brother took my phone again last night', 33_000),
      graded('7', false, 44_000),
      typed('i dunno', 37_000),
    ],
    expectCheckIn: true,
    answer: 'ignore',
  },
  {
    name: 'masking',
    why: 'polite and brief, then a quiet withdrawal with no complaint: detected from behaviour, never from a feeling word',
    locale: 'es-MX',
    turns: [
      typed('Sí, quiero ahorrar para la bici', 6_000),
      typed('Son sesenta pesos en la tienda', 6_500),
      graded('12', true, 7_000, 0.6),
      typed('Doce semanas ahorrando cinco pesos', 6_000),
      typed('ok', 22_000),
      graded('10', false, 38_000, 0.6),
      typed('ya', 30_000),
      graded('10', false, 41_000, 0.6),
      typed('sale', 33_000),
      graded('diez', false, 44_000, 0.6),
    ],
    expectCheckIn: true,
    checkInBy: 10,
    answer: 'aligned',
  },
  {
    name: 'steady',
    why: 'in flow for the whole session: never checked on',
    locale: 'en-US',
    turns: Array.from({ length: 24 }, (_, i) =>
      i % 3 === 2
        ? graded(String(12 + i), i % 7 !== 3, 7_000 + (i % 4) * 700)
        : typed(
            // A learner in flow does not repeat themselves word for word.
            `${
              [
                'I think saving five dollars a week is a good plan for the bike',
                'If I earn money from chores I can save a bit more each week',
                'Spending less on snacks leaves more money for my goal',
                'Then the bike takes fewer weeks because I save more',
              ][i % 4]
            } by week ${i + 1}`,
            5_500 + (i % 5) * 600,
          ),
    ),
    expectCheckIn: false,
    answer: 'ignore',
  },
];

export interface TelemetryPersonaReport {
  persona: string;
  checkIns: number[];
  evaluatedTurns: number;
  actionTurns: number;
  /** Every reading, for the no-emotion-label assertion. */
  readings: TelemetryReading[];
  problems: string[];
}

/** Emotion vocabulary that must never appear in anything the layer outputs (3 languages). */
export const EMOTION_LABEL =
  /frustrat|bored|boredom|aburrid|entediad|angry|anger|enojad|brav[oa]|\bsad\b|triste|upset|anxious|anxiety|ansios|nervous|nervios|confused|confundid|confus[oa]|tired|cansad|emotion|emoci|mood|feeling|sentiment/i;

export function runTelemetryPersona(
  persona: TelemetryPersona,
  config: TelemetryConfig = TELEMETRY_DEFAULTS,
): TelemetryPersonaReport {
  const layer = new BehavioralTelemetry('act', persona.locale, config);
  const checkIns: number[] = [];
  const readings: TelemetryReading[] = [];
  const problems: string[] = [];
  /** The observation count at which the learner last answered a check-in. */
  let lastAnswerAt: number | null = null;

  for (const [index, turn] of persona.turns.entries()) {
    // The learner moved past an open check-in without answering it.
    if (layer.checkInOpen) {
      layer.recordCheckInReply('unanswered');
      lastAnswerAt = index;
    }
    const reading = layer.observe({ ...turn, topicText: TOPIC });
    readings.push(reading);
    if (!layer.checkInDue) continue;
    // The Mentor's reacting turn carries it (the orchestrator's job).
    layer.markCheckInDelivered();
    checkIns.push(index + 1);
    // Judged against the POLICY values, not the config under test: a broken
    // config must not be able to excuse itself.
    const window = TELEMETRY_DEFAULTS.rearmAfterObservations;
    if (lastAnswerAt !== null && index + 1 - lastAnswerAt < window) {
      problems.push(`checked in again ${index + 1 - lastAnswerAt} turn(s) after the learner answered (window ${window})`);
    }
    if (persona.answer !== 'ignore') {
      layer.recordCheckInReply(persona.answer);
      lastAnswerAt = index + 1;
      if (persona.answer === 'misaligned') layer.markRepairOffered(true);
    }
  }

  const report = layer.report();
  if (persona.expectCheckIn && checkIns.length === 0) problems.push(`never checked in (${persona.why})`);
  if (persona.expectCheckIn && checkIns.length > 0 && persona.checkInBy !== undefined && checkIns[0]! > persona.checkInBy) {
    problems.push(`first check-in only at turn ${checkIns[0]} (expected by turn ${persona.checkInBy})`);
  }
  if (!persona.expectCheckIn && checkIns.length > 0) problems.push(`checked in at turn ${checkIns[0]} (${persona.why})`);
  if (checkIns.length > TELEMETRY_DEFAULTS.maxCheckIns) {
    problems.push(`checked in ${checkIns.length} times (max ${TELEMETRY_DEFAULTS.maxCheckIns})`);
  }
  // Disengagement-Repair Initiation Rate: every act-mode firing was carried.
  const fired = report.events.filter((e) => e.mode === 'act');
  if (fired.length !== checkIns.length) {
    problems.push(`${fired.length} firing(s) but ${checkIns.length} check-in(s): the repair initiation rate is below 100%`);
  }
  // C.9 Definition of Done (b): no emotion label in anything the layer outputs.
  const output = JSON.stringify({ report, readings, snapshot: layer.snapshot() });
  const label = EMOTION_LABEL.exec(output);
  if (label) problems.push(`the layer's output carries an emotion label ("${label[0]}")`);
  return {
    persona: persona.name,
    checkIns,
    evaluatedTurns: report.evaluatedTurns,
    actionTurns: report.actionTurns,
    readings,
    problems,
  };
}

/** Stage 7's floor on the Default-to-Inaction Rate, applied to the simulated suite as a whole. */
export const DEFAULT_TO_INACTION_FLOOR = 0.85;

export function runTelemetryGym(personas: readonly TelemetryPersona[] = TELEMETRY_PERSONAS): {
  reports: TelemetryPersonaReport[];
  defaultToInaction: number;
  ok: boolean;
} {
  const reports = personas.map((p) => runTelemetryPersona(p));
  const evaluated = reports.reduce((n, r) => n + r.evaluatedTurns, 0);
  const actions = reports.reduce((n, r) => n + r.actionTurns, 0);
  const defaultToInaction = evaluated === 0 ? 1 : 1 - actions / evaluated;
  const ok = reports.every((r) => r.problems.length === 0) && defaultToInaction >= DEFAULT_TO_INACTION_FLOOR;
  return { reports, defaultToInaction, ok };
}
