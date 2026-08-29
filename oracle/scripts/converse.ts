/*
 * `npm run tutor:converse` — HOLD A REAL CONVERSATION with the tutor, print the
 * transcript, and read it for the faults a person would notice.
 *
 * WHY IT EXISTS. Every check we had answers "did the machinery work". None
 * answers "was that a good lesson". The defects the owner actually reported all
 * lived in the gap between those two questions and every gate stayed green
 * through all of them: greeting a child nine times in eleven lines, answering
 * its own question one turn after asking it, teaching compound interest with
 * numbers that demonstrate no compounding, promising a game and then closing.
 * A pipeline test cannot see any of that. Only a transcript can, and until now
 * the only way to get one was for a human to sit and type at production.
 *
 * So this drives the REAL `TutorOrchestrator` — the same seal, the same model,
 * the same parse, the same moderation, the same conversation history a learner
 * gets — with a scripted learner, and then reads what came back.
 *
 * WHAT IT IS NOT. It cannot tell you whether a child would enjoy this, and it
 * does not try. It catches the faults that are visible in the TEXT, which is
 * the class that shipped repeatedly and that nobody was looking for. A human
 * reading the same transcript will still see more.
 *
 * It opens no socket, writes no row and needs no learner. Costs one model call
 * and one moderation call per turn.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { TutorOrchestrator } from '../src/tutor/orchestrator.js';
import { tierVocabularyViolation, promisesAnActivity } from '../src/tutor/prompt.js';
import type { SessionContext } from '../src/core/client.js';
import type { SpeechResult } from '../src/voice/speech.js';

/** No audio: the synthesizer seam exists precisely so it can be inert here. */
const silent = async (): Promise<SpeechResult> => ({
  url: null,
  source: 'unavailable',
  billedChars: 0,
});

const SESSION: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 2,
  locale: 'es-MX',
  nickname: 'Chispa',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'open',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: true,
  voiceConsent: false,
  intelDegraded: false,
};

/*
 * The script is deliberately the conversation that BROKE, turn for turn: a
 * question off the lesson plan, a wrong answer with a systematic error behind
 * it, a demand for something to do, and the complaint the owner actually made.
 * A happy path proves nothing here — it is the one every previous check
 * already walked.
 */
interface Scenario {
  name: string;
  session: SessionContext;
  script: string[];
}

const SCENARIOS: Scenario[] = [
  {
    // The conversation that broke, turn for turn.
    name: 'the session that failed',
    session: SESSION,
    script: [
      '¿qué es el interés compuesto?',
      'si algo cuesta 25 y pago con 50 el cambio son 35 verdad?',
      '80 pesos',
      'aqui solo platicamos, no haces nada mas. esto es aburrido',
      'ya entendí, dame otro',
    ],
  },
  {
    /*
     * A SIX-YEAR-OLD. Tier 1 forbids percentages and decimals outright, and
     * the band is where a slip does the most damage — an eight-year-old
     * shrugs at an unfamiliar word, a six-year-old concludes they are bad at
     * money. The questions are deliberately ones an adult would answer with
     * exactly the vocabulary the band forbids.
     */
    name: 'a six-year-old asking hard questions',
    session: { ...SESSION, tier: 1, nickname: 'Tavo' },
    script: [
      'por que el dinero del banco crece solito?',
      'y que es un descuento?',
      'no entendi nada',
      'ya me aburri, quiero jugar',
    ],
  },
  {
    /*
     * A LEARNER WHO KEEPS GETTING IT WRONG. The blueprint's RESCUE strategy
     * exists for this and the guardrail says never two in a row — but the
     * thing that actually matters is whether the tutor keeps its patience,
     * lowers the difficulty, and stops repeating the same explanation. Three
     * identical explanations of compound interest is what the owner saw.
     */
    name: 'a learner who keeps failing',
    session: { ...SESSION, nickname: 'Robi' },
    script: [
      'cuanto es 10 mas 5?',
      '20',
      '25',
      'no se, esto esta muy dificil',
      'sigo sin entender',
    ],
  },
];

interface Beat {
  learner: string;
  tutor: string;
  source: string;
  next: string;
  requestedActivity: boolean;
}

/** Normalised for comparison: accents, case and punctuation removed. */
function flatten(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9¿?¡! ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let problems = 0;
function fault(label: string, detail: string): void {
  problems += 1;
  console.log(`  PROBLEM  ${label}`);
  console.log(`           ${detail}`);
}

/**
 * The faults a person notices, looked for in the transcript.
 *
 * Each one is a defect the shipped product actually committed, so none of these
 * is hypothetical — they are regression checks written from real sessions.
 */
function review(beats: Beat[], tier: 1 | 2 | 3, nickname: string): void {
  console.log('');
  console.log('== Reading the transcript back ==');

  // 1. GREETING EVERY TURN. Nine "¡Hola, Jason!" in an eleven-line session was
  // the symptom that exposed the conversation never reaching the model.
  const greetings = beats.filter((b) => /\bhola\b/.test(flatten(b.tutor)));
  if (greetings.length > 1) {
    fault(
      `greets the learner ${greetings.length} times in ${beats.length} turns`,
      greetings.map((b) => b.tutor.slice(0, 60)).join(' | '),
    );
  }

  // 2. INTRODUCING ITSELF AGAIN. It did this at line seven of one session.
  const intros = beats.filter((b) => /\bsoy \w+/.test(flatten(b.tutor)));
  if (intros.length > 0) {
    fault('introduces itself mid-conversation', intros[0]!.tutor.slice(0, 80));
  }

  // 3. ANSWERING ITS OWN QUESTION. The worst of them: it asked "how much do
  // two cost?" and then said "ten pesos!" itself, taking from the learner the
  // one act that does the teaching.
  for (let i = 1; i < beats.length; i += 1) {
    const asked = beats[i - 1]!.tutor;
    const numbersAsked = asked.match(/\d+/g) ?? [];
    const isQuestion = asked.includes('?');
    const learnerAnswered = flatten(beats[i]!.learner).length > 0;
    if (!isQuestion || !learnerAnswered) continue;
    // A tutor stating a number the learner never said, immediately after
    // asking for it, in a turn that also praises — that is answering itself.
    const said = beats[i]!.tutor;
    const praises = /excelente|exacto|muy bien|correcto/i.test(said);
    const learnerNumbers = beats[i]!.learner.match(/\d+/g) ?? [];
    const newNumber = (said.match(/\d+/g) ?? []).find(
      (n) => !learnerNumbers.includes(n) && !numbersAsked.includes(n),
    );
    if (praises && newNumber !== undefined && learnerNumbers.length === 0) {
      fault('praises an answer the learner never gave', said.slice(0, 100));
    }
  }

  /*
   * 3b. AFFIRMING AND THEN CONTRADICTING — the worst one found so far.
   *
   * Observed 2026-08-29, tier 2: the tutor asked "20 menos 5" and the learner
   * said "20". The tutor replied "¡Exacto! 20 menos 5 es 15." It affirmed a
   * wrong answer and stated the right one in the same breath, then two turns
   * later said "¡Muy bien, 25! Veo que ya manejas sumas y restas" to another
   * wrong answer. A tutor telling a struggling child they are doing well is
   * worse than one that says nothing: it removes the only signal they have.
   *
   * The shape is detectable without doing the arithmetic ourselves: praise,
   * plus a RESULT stated in the same turn that differs from the number the
   * learner just gave. If the learner were right, there would be nothing to
   * correct.
   */
  for (let i = 0; i < beats.length; i += 1) {
    const said = beats[i]!.tutor;
    const praises = /\b(exacto|muy bien|correcto|perfecto|excelente)\b/i.test(said);
    if (!praises) continue;
    const learnerNumbers = beats[i]!.learner.match(/\d+/g) ?? [];
    if (learnerNumbers.length !== 1) continue;
    // "X menos Y es Z" / "son Z" / "es Z" — the result the tutor states.
    const stated = /\b(?:es|son)\s+(\d+)/i.exec(said)?.[1];
    if (stated !== undefined && stated !== learnerNumbers[0]) {
      fault(
        `turn ${i + 1} praises "${learnerNumbers[0]}" and then states the answer is ${stated}`,
        said.slice(0, 120),
      );
    }
  }

  // 4. REPEATING ITSELF. Three near-identical explanations of compound
  // interest in one session, each asking the same question again.
  for (let i = 1; i < beats.length; i += 1) {
    const a = flatten(beats[i - 1]!.tutor);
    const b = flatten(beats[i]!.tutor);
    const aWords = new Set(a.split(' ').filter((w) => w.length > 4));
    const bWords = b.split(' ').filter((w) => w.length > 4);
    if (aWords.size === 0 || bWords.length === 0) continue;
    const overlap = bWords.filter((w) => aWords.has(w)).length / bWords.length;
    if (overlap > 0.6) {
      fault(
        `turn ${i + 1} repeats turn ${i} (${Math.round(overlap * 100)}% of its words)`,
        beats[i]!.tutor.slice(0, 100),
      );
    }
  }

  // 5. A PROMISE IT DID NOT KEEP. Announced a game, requested nothing.
  for (const [i, b] of beats.entries()) {
    if (promisesAnActivity(b.tutor) && !b.requestedActivity) {
      fault(`turn ${i + 1} announces an activity but requests none`, b.tutor.slice(0, 100));
    }
  }

  // 6. VOCABULARY ABOVE THE BAND.
  for (const [i, b] of beats.entries()) {
    const slip = tierVocabularyViolation(b.tutor, tier);
    if (slip !== null) fault(`turn ${i + 1} uses ${slip}, above tier ${tier}`, b.tutor.slice(0, 100));
  }

  // 7. A CANNED FAILURE LINE. Two of eight turns in the owner's session were
  // these, and they are indistinguishable from teaching unless you look.
  const scripted = beats.filter((b) => b.source === 'scripted');
  if (scripted.length > 0) {
    fault(
      `${scripted.length} of ${beats.length} turns were canned fallback lines, not teaching`,
      scripted.map((b) => b.tutor.slice(0, 50)).join(' | '),
    );
  }

  // 8. NEVER ASKING ANYTHING. A tutor that only tells is a lecture.
  const asks = beats.filter((b) => b.tutor.includes('?') || b.tutor.includes('¿')).length;
  if (asks < Math.ceil(beats.length / 2)) {
    fault(`only ${asks} of ${beats.length} turns asked the learner anything`, 'a tutor that only tells is a lecture');
  }

  void nickname;
}

async function main(): Promise<void> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) {
    console.error('MODEL_API_KEY is not set — there is no tutor to talk to.');
    process.exit(1);
  }

  let spent = 0;
  for (const scenario of SCENARIOS) {
    console.log('');
    console.log(
      `== ${scenario.name} (${config.MODEL_NAME}, tier ${scenario.session.tier}, ${scenario.session.locale}) ==`,
    );
    const orchestrator = new TutorOrchestrator(scenario.session, Date.now(), silent);

    const opening = await orchestrator.greet(Date.now());
    console.log('');
    console.log(`  tutor    ${opening.emission.turn.say}`);

    const beats: Beat[] = [];
    for (const line of scenario.script) {
      const started = Date.now();
      const outcome = await orchestrator.handleLearnerText(line, Date.now());
      const ms = Date.now() - started;
      console.log('');
      console.log(`  learner  ${line}`);
      if (outcome === null) {
        console.log('  tutor    (no turn was produced)');
        continue;
      }
      const turn = outcome.emission.turn;
      console.log(`  tutor    ${turn.say}`);
      console.log(
        `           [${ms} ms · ${outcome.emission.source} · next=${turn.next}` +
          `${turn.segmentRequest ? ` · asks for ${turn.segmentRequest.skillKey}` : ''}]`,
      );
      beats.push({
        learner: line,
        tutor: turn.say,
        source: outcome.emission.source,
        next: turn.next,
        requestedActivity: turn.segmentRequest != null,
      });
    }

    review(beats, scenario.session.tier, scenario.session.nickname);
    spent += orchestrator.totalCostUsd;
  }

  console.log('');
  console.log(`  cost across ${SCENARIOS.length} conversations: $${spent.toFixed(4)}`);
  if (problems > 0) {
    console.log('');
    console.log(`tutor:converse — ${problems} problem(s) a person would notice.`);
    process.exit(1);
  }
  console.log('');
  console.log('tutor:converse — nothing a person would notice went wrong.');
}

await main();
