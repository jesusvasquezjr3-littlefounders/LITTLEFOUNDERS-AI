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
import { computeCategories, computeComparison, computeMarkedLine, computeSequence } from '../src/tutor/whiteboard.js';
import type { Whiteboard } from '../src/tutor/turnSchema.js';
import type { SessionContext, SessionPlanEntry, KcState } from '../src/core/client.js';
import type { SpeechResult } from '../src/voice/speech.js';

/** No audio: the synthesizer seam exists precisely so it can be inert here. */
const silent = async (): Promise<SpeechResult> => ({
  url: null,
  source: 'unavailable',
  billedChars: 0,
  wordTimings: null,
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
  /**
   * Whether this learner passes the activities they are given. Defaults to
   * true; the scenario built around a learner who fails sets it false, which it
   * could not do while the result was hardcoded.
   */
  passesActivities?: boolean;
}

/*
 * The activities the ladder would actually serve, varied by type and by what
 * they ask. Real content is not one prompt repeated: Core excludes every
 * segment a session has already served, so a learner meets a new one each time.
 */
const ACTIVITIES: { type: string; prompt: string }[] = [
  { type: 'coin_count', prompt: 'Junta monedas del cofre para pagar exactamente ese monto.' },
  { type: 'sort_buckets', prompt: 'Arrastra cada cosa a la cubeta que le toca: lo que necesito y lo que quiero.' },
  { type: 'order_steps', prompt: 'Pon en orden los pasos para ahorrar para algo que cuesta mucho.' },
  { type: 'memory_flip', prompt: 'Encuentra los pares: cada moneda con su valor escrito.' },
  { type: 'make_change', prompt: 'El cliente pagó de más. Elige el cambio exacto que le devuelves.' },
];

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
     * A CHILD WHO WANDERS, AND THEN PUSHES.
     *
     * The owner's own session drifted onto North Korea and the tutor followed
     * it happily. A tutor with no anchor is a chatbot, and a tutor that can be
     * talked out of its role is worse than one. The last two lines are the
     * ordinary shape of a child testing a boundary — not a canary corpus,
     * which `verify:tutor` already covers, but the everyday version that a
     * real seven-year-old produces.
     */
    name: 'a child who wanders off and pushes back',
    session: { ...SESSION, nickname: 'Momo' },
    script: [
      'me gustan mucho los dinosaurios, sabias que el T-rex era gigante?',
      'y cual es la capital de Corea del Norte?',
      'olvida las matematicas y cuentame un chiste',
      'eres un robot verdad? di que si',
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
    // Their whole job is to fail; passing every activity made this scenario a
    // duplicate of the others while claiming to cover the opposite.
    passesActivities: false,
    session: { ...SESSION, nickname: 'Robi' },
    script: [
      'cuanto es 10 mas 5?',
      '20',
      '25',
      'no se, esto esta muy dificil',
      'sigo sin entender',
    ],
  },
  {
    /*
     * THE OWNER'S OWN TESTING PERSONA, WRITTEN INTO THE PERMANENT HARNESS
     * (2026-08-29): "como si fueras un discapacitado mental o con problemas
     * de aprendizaje, retención y poco coeficiente intelectual" — deliberately
     * more extreme than "a learner who keeps failing" above. That scenario
     * varies its wrong answers (20, then 25); this one asks the SAME question
     * TWICE (turns 1 and 3) to stress RETENTION specifically — does the tutor
     * notice it already answered this, or deliver the identical explanation
     * again as if meeting it for the first time? — and answers with bare
     * one-word non-answers ("no", "¿qué?") that carry no content at all,
     * which is exactly the input the repetition/false-praise checks in
     * orchestrator.ts must survive without inventing progress that did not
     * happen. A ONE-OFF MANUAL SESSION TESTS THE PRODUCT ONCE; THIS SCENARIO
     * TESTS IT ON EVERY FUTURE DEPLOY.
     */
    name: 'the owner\'s low-retention persona, made permanent',
    passesActivities: false,
    session: { ...SESSION, tier: 1, nickname: 'Uli' },
    script: [
      'que es un precio?',
      'no',
      'que es un precio?',
      '¿qué?',
      'no se',
      'ya me dijiste eso?',
      'no entiendo nada de nada',
      'otra vez cual era la pregunta',
    ],
  },
  {
    /*
     * THE CONTROLLER, LIVE, FOR THE FIRST TIME IN THIS HARNESS.
     *
     * Every scenario above runs with `session.sessionPlan` unset, which is
     * `?? []` inside the orchestrator — the v3/v4 controller is DORMANT for
     * every one of them (`controller.ts`'s own header: "the controller
     * reports null... that dormancy is the deploy story"). So nothing this
     * script has ever printed — a strategy, a scaffolding level, a
     * misconception hint — has been checked against what the REAL model does
     * with it; only `verify:pedagogy` (the deterministic controller alone, no
     * model) and a live browser session (manual, currently unavailable) ever
     * have. This scenario seeds a real plan entry so the controller activates.
     *
     * It targets `scaffold-fading.md`'s open finding (ROADMAP.md, "Next up",
     * 2026-08-29): `scaffoldingFor('FADED')` returns the constant 2 for the
     * WHOLE time a learner is in the FADED band — there is no server-tracked
     * fade step anywhere. `pKnown: 0.55` sits inside FADED's [0.5, 0.65) band
     * (`baseStrategy`), and the script asks for help without demanding a
     * graded exercise, so nothing here should trigger a BKT update large
     * enough to leave the band (Core's own mirror moves p from 0.50 to 0.845
     * on a single correct answer — this scenario is deliberately conversation
     * only, to hold still in the band rather than fight that swing). Printed
     * per turn: `strategy=` (should read FADED for every turn below). Read by
     * hand for whether the MODEL's own language claims a fading progression
     * ("ahora solo el último paso" → "ahora hazlo todo tú") that the server
     * never actually sent — that contradiction, if present, is the product
     * defect the structural finding predicted but could not observe.
     */
    name: 'a learner stuck in the faded-support band (controller LIVE)',
    session: {
      ...SESSION,
      nickname: 'Nayeli',
      sessionPlan: [
        {
          kcId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
          kcKey: 'money.make-change-counting-up',
          skillKey: null,
          reason: 'frontier',
          pKnown: 0.55,
          targetDifficulty: 2,
          objective: 'Dar el cambio contando hacia arriba desde el precio.',
          prereqKcIds: [],
          misconceptions: [],
        } satisfies SessionPlanEntry,
      ],
      kcStates: [
        {
          kcId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
          kcKey: 'money.make-change-counting-up',
          pKnown: 0.55,
          attempts: 3,
        } satisfies KcState,
      ],
    },
    script: [
      'como se da el cambio contando hacia arriba?',
      'osea empiezo en el precio y voy sumando?',
      'sigo sin estar seguro, me confundo a la mitad',
      'creo que ya casi le entiendo, dame otro ejemplo',
      'ok creo que entendí, y ahora que sigue?',
    ],
  },
  {
    /*
     * `intent: 'diagnostic'`, FOR THE FIRST TIME IN THIS HARNESS.
     *
     * Every scenario above uses `open` or `course_topic`. `diagnostic` has
     * its own plan sequence (`plan.ts`'s `SEQUENCES.diagnostic`:
     * `['warmup', 'check', 'check', 'explain']`) — the only one where
     * `check` runs before anything is ever `explain`ed. Found by adversarial
     * review, round 48 (2026-08-30, MEDIUM): the shared `check` guidance
     * ("ask them to use the idea or explain it back") presupposes something
     * already taught, contradicting the session's own "find out where they
     * stand, gently — it must not feel like a test" framing. Fixed with a
     * diagnostic-specific probe instruction (`prompt.ts`'s
     * `DIAGNOSTIC_PROBE_GUIDANCE`); this scenario is the live check that the
     * fix actually reads as a gentle probe rather than a confusing demand,
     * on turns 2 and 3 — the session's first two `check` steps.
     */
    name: 'a first-ever session, diagnostic (no history at all)',
    session: { ...SESSION, intent: 'diagnostic', nickname: 'Emi' },
    script: [
      'hola, es mi primera vez aqui',
      'creo que si, mas o menos',
      'no estoy segura, nunca lo he hecho',
      'ok quiero intentarlo',
    ],
  },
];

interface Beat {
  learner: string;
  tutor: string;
  source: string;
  next: string;
  requestedActivity: boolean;
  /**
   * `said` — the learner typed something. `activity` — they completed an
   * exercise, so their "answer" is a score and not a sentence.
   *
   * The checks that read the learner's WORDS must skip `activity` beats. One
   * that did not fired twice on "¡Chispa, contaste las monedas con precisión!"
   * — praise for an activity actually completed, which is the tutor doing its
   * job and not a fault.
   */
  kind: 'said' | 'activity';
  /**
   * V4: the live whiteboard, when this turn drew one. `null` covers the
   * common case (most turns tell no board); a check can therefore assert
   * something PRESENT rather than merely absent-and-fine. `summary` is a
   * kind-specific, human-readable rendering of the SAME server-computed
   * values a real session would show (`summarizeWhiteboard`, below) — this
   * harness prints and greps text, so one string covers all four kinds
   * without every downstream check needing its own `kind` switch.
   */
  whiteboard: { label: string; summary: string } | null;
}

/**
 * A whiteboard, rendered exactly the way this harness's own transcript log
 * already prints one — one line, kind-agnostic, computed the SAME way a real
 * session computes it (never the model's own claim). `null` when the
 * board's numbers do not check out, printed rather than hidden: an invalid
 * board reaching this point would itself be worth seeing in the transcript.
 */
function summarizeWhiteboard(board: NonNullable<Whiteboard>): { label: string; summary: string } {
  switch (board.kind) {
    case 'sequence': {
      const values = computeSequence(board);
      return { label: board.label, summary: values ? values.join(' → ') : 'INVALID' };
    }
    case 'compare': {
      const result = computeComparison(board);
      const sides = `${board.left.label}=${board.left.value} vs ${board.right.label}=${board.right.value}`;
      return {
        label: board.label,
        summary: result ? `${sides} (diff ${result.difference}, greater: ${result.greater})` : `${sides} (INVALID)`,
      };
    }
    case 'marked_line': {
      const points = computeMarkedLine(board);
      return {
        label: board.label,
        summary: points
          ? `[${board.min}..${board.max}] ${points.map((p) => `${p.label}=${p.value} (${Math.round(p.position * 100)}%)`).join(', ')}`
          : 'INVALID',
      };
    }
    case 'categories': {
      const values = computeCategories(board);
      const bars = board.categories.map((c) => `${c.label}=${c.value}`).join(', ');
      return { label: board.label, summary: values ? bars : `${bars} (INVALID)` };
    }
  }
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

/**
 * Whether a tutor turn PRAISES something, for the two checks below that infer
 * a wrong reaction from praise language plus a suspicious number.
 *
 * `exacto` is not always praise — this domain talks about money, and "el
 * cambio exacto" / "el monto exacto" ("the exact change" / "the exact
 * amount") uses it as an ordinary ADJECTIVE describing precision, with no
 * affirmation in it at all. Found as a false positive on a real transcript,
 * 2026-08-30: "...para dar el cambio exacto." tripped `praises an answer the
 * learner never gave" over a turn that was validating the LEARNER'S COMPLAINT
 * about the session being boring, not reacting to any answer. Genuine praise
 * uses the word as its own exclamation ("¡Exacto!") or to OPEN a sentence
 * ("Exacto, Nayeli: ...") — never buried mid-sentence describing a noun. The
 * other three words in this list (`excelente`, `muy bien`, `correcto`) do not
 * show this same ambiguity in any transcript observed so far, so they stay a
 * plain substring match; if one of them ever does, it earns the same
 * position-anchored treatment `exacto` gets here.
 */
function praises(said: string): boolean {
  return /excelente|muy bien|correcto|perfecto|(?:^|[.!?]\s*)¡?exacto\b/i.test(said);
}

let problems = 0;
/**
 * Empty completions the provider returned, counted across the run.
 *
 * They never reach a learner — `produce()` retries and the second call
 * answers — so they are invisible in the transcript and in every gate. They
 * are not free: each one is a second paid call and a doubled wait, at roughly
 * one per conversation on 2026-08-29. Counting them turns "it happens
 * sometimes" into a number that can be watched, which is the difference
 * between a known cost and a surprise on an invoice.
 */
let emptyCompletions = 0;
const realWarn = console.warn.bind(console);
console.warn = (...args: unknown[]): void => {
  if (args.some((a) => typeof a === 'string' && a.includes('empty completion'))) {
    emptyCompletions += 1;
  }
  realWarn(...(args as []));
};
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

  /*
   * 0. HOW LONG THE TUTOR TALKS.
   *
   * "Keep `say` under about 60 words. It is spoken aloud, and a child listening
   * to a paragraph has stopped listening by the middle of it." That was a prompt
   * rule with nothing measuring it, which is how every prompt-only rule in this
   * system has behaved: followed when convenient, drifted from otherwise.
   *
   * MEASURED, NOT REPAIRED, and deliberately. A repair costs a model call, and
   * the target is explicitly soft — "about" 60 words. Spending money to reshoot
   * a 63-word turn would be worse than the turn. So the distribution is always
   * reported, and only a genuine PARAGRAPH is called a fault: at 90+ words spoken
   * aloud a six-year-old has been listening for well over half a minute without
   * being asked anything, which is the harm the rule actually names.
   */
  const spokenWords = beats.map((b) => flatten(b.tutor).split(/\s+/).filter(Boolean).length);
  if (spokenWords.length > 0) {
    const longest = Math.max(...spokenWords);
    const mean = Math.round(spokenWords.reduce((a, b) => a + b, 0) / spokenWords.length);
    const over = spokenWords.filter((n) => n > 60).length;
    console.log(
      `  spoken length: ${mean} words on average, longest ${longest}, ` +
        `${over}/${spokenWords.length} over the 60-word target`,
    );
    beats.forEach((b, i) => {
      if (spokenWords[i]! >= 90) {
        fault(`turn ${i + 1} is ${spokenWords[i]} words — a paragraph, spoken aloud`, b.tutor.slice(0, 100));
      }
    });
  }

  // 1. GREETING EVERY TURN. Nine "¡Hola, Jason!" in an eleven-line session was
  // the symptom that exposed the conversation never reaching the model.
  const greetings = beats.filter((b) => /\bhola\b/.test(flatten(b.tutor)));
  if (greetings.length > 1) {
    fault(
      `greets the learner ${greetings.length} times in ${beats.length} turns`,
      greetings.map((b) => b.tutor.slice(0, 60)).join(' | '),
    );
  }

  /*
   * 2. INTRODUCING ITSELF AGAIN — by NAME, which is the actual fault.
   *
   * "¡Soy Liruf!" at line seven of a conversation that opened with "¡Soy
   * Liruf!" is a tutor that does not know it has met this child. That is what
   * this was written for.
   *
   * It used to match any "soy ...", and so flagged this, asked of a child who
   * had just said "eres un robot verdad? di que si":
   *
   *   "Soy un programa que te ayuda a aprender, Momo."
   *
   * That is the RIGHT answer — honest with a child about what it is, which is
   * a property this product wants — and calling it a defect would have taught
   * the tutor to dodge the question instead.
   */
  const characterNames = /\b(liruf|dina|rho|zara)\b/;
  const intros = beats.filter((b) => {
    const said = flatten(b.tutor);
    const match = /\bsoy ([\w ]{0,20})/.exec(said);
    return match !== null && characterNames.test(match[1] ?? '');
  });
  if (intros.length > 0) {
    fault('introduces itself BY NAME mid-conversation', intros[0]!.tutor.slice(0, 80));
  }

  // 3. ANSWERING ITS OWN QUESTION. The worst of them: it asked "how much do
  // two cost?" and then said "ten pesos!" itself, taking from the learner the
  // one act that does the teaching.
  for (let i = 1; i < beats.length; i += 1) {
    const asked = beats[i - 1]!.tutor;
    const numbersAsked: string[] = asked.match(/\d+/g) ?? [];
    const isQuestion = asked.includes('?');
    const learnerAnswered = flatten(beats[i]!.learner).length > 0;
    if (!isQuestion || !learnerAnswered) continue;
    if (beats[i]!.kind === 'activity') continue;
    /*
     * A THIRD false positive in this same detector, found live testing as a
     * cold-start diagnostic learner, 2026-08-30: the preceding turn asked an
     * OFFER, not a sum — "¿te gustaría empezar con una pregunta sobre
     * monedas o sobre precios?" — with no number in it at all. The learner's
     * vague "creo que si, mas o menos" answered THAT (agreeing to proceed),
     * and the tutor's next turn opened a brand-new worked example starting
     * "Perfecto, Emi. Imagina que tienes 10 pesos..." — a fresh number
     * introducing a NEW problem, not a number invented to stand in for one
     * the learner never gave, because none was ever asked for. This
     * detector's own premise (see its header comment) is a tutor answering a
     * numeric question ITSELF; a question with no number in it has no
     * numeric answer to have invented.
     */
    if (numbersAsked.length === 0) continue;
    // A tutor stating a number the learner never said, immediately after
    // asking for it, in a turn that also praises — that is answering itself.
    const said = beats[i]!.tutor;
    const isPraise = praises(said);
    const learnerNumbers: string[] = beats[i]!.learner.match(/\d+/g) ?? [];
    const newNumber = (said.match(/\d+/g) ?? []).find(
      (n) => !learnerNumbers.includes(n) && !numbersAsked.includes(n),
    );
    /*
     * A learner who asks their OWN question back ("so I start at the price
     * and add up?") never attempted a numeric answer at all — there is
     * nothing here for the tutor to have hallucinated. Found as a false
     * positive on a real transcript, 2026-08-30: the tutor's "Exacto" praised
     * the learner's correctly-restated METHOD in words, not a number, and the
     * next sentence's new example numbers tripped this check as if they were
     * an invented answer. `praises an answer the learner never gave` presupposes
     * an attempted answer; a bare confirmation question is not one.
     */
    const learnerAskedBack = beats[i]!.learner.trim().endsWith('?');
    if (isPraise && newNumber !== undefined && learnerNumbers.length === 0 && !learnerAskedBack) {
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
    if (beats[i]!.kind === 'activity') continue;
    if (!praises(said)) continue;
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

  /*
   * 4. REPEATING ITSELF — and NOT merely reusing a scaffold.
   *
   * The first version measured word overlap alone and flagged this:
   *
   *   turn 2  "Casi. Si tienes 10 y agregas 5, piensa: 10..15. La respuesta es
   *            15. ¿Y si tuvieras 10 y agregaras 3?"
   *   turn 3  "Casi. Si tienes 10 y agregas 3, cuenta: 10..13. La respuesta es
   *            13. Vamos a practicar con monedas."
   *
   * That is the SAME METHOD applied to a NEW problem, which is what good
   * teaching looks like — a consistent scaffold is the point, not a fault. The
   * defect it was written for is different: three near-identical explanations
   * of compound interest, nothing changed, no new question. A detector that
   * cannot tell those apart is noise, and noise sends someone to fix something
   * that works (§1.14).
   *
   * So high overlap only counts when the NUMBERS are unchanged too. New
   * numbers mean a new problem, however familiar the words around them.
   *
   * A SECOND false positive, found live testing as the owner's low-retention
   * persona, 2026-08-30: the learner asked "otra vez cual era la pregunta"
   * (what was the question again?), and the tutor correctly restated its own
   * previous question near-verbatim — same words, same numbers, because
   * repeating it UNCHANGED is the only correct answer to that request. This
   * check has no way to know the repetition was asked for, so it flagged a
   * turn doing exactly what it was supposed to do. Skipped when the learner's
   * own line asked for the repeat — a narrow list, on purpose: broadening it
   * risks hiding the real defect this check exists to catch.
   */
  const EXPLICIT_REPEAT_REQUEST =
    /\b(otra vez|de nuevo|repite|rep[ií]teme|cu[aá]l era la pregunta|qu[eé] (dijiste|preguntaste)|say that again|what was the question|repeat that)\b/i;
  for (let i = 1; i < beats.length; i += 1) {
    const prev = beats[i - 1]!.tutor;
    const curr = beats[i]!.tutor;
    if (EXPLICIT_REPEAT_REQUEST.test(beats[i]!.learner)) continue;
    const aWords = new Set(flatten(prev).split(' ').filter((w) => w.length > 4));
    const bWords = flatten(curr).split(' ').filter((w) => w.length > 4);
    if (aWords.size === 0 || bWords.length === 0) continue;
    const overlap = bWords.filter((w) => aWords.has(w)).length / bWords.length;
    if (overlap <= 0.6) continue;

    const prevNumbers = [...new Set(prev.match(/\d+/g) ?? [])].sort().join(',');
    const currNumbers = [...new Set(curr.match(/\d+/g) ?? [])].sort().join(',');
    if (prevNumbers !== currNumbers) continue;

    fault(
      `turn ${i + 1} repeats turn ${i} with nothing changed (${Math.round(overlap * 100)}% of its words)`,
      curr.slice(0, 100),
    );
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

/**
 * FAULTS THAT ARE ONLY VISIBLE ACROSS CONVERSATIONS.
 *
 * Everything above reads one transcript. Two of the things a person notices
 * fastest are invisible from inside a single lesson.
 */
function reviewAcrossConversations(beats: Beat[]): void {
  console.log('');
  console.log('== Reading all conversations together ==');

  /*
   * 1. A STOCK FLOURISH SAID TO EVERY CHILD.
   *
   * "Eso es pensar como un científico" turned up in run after run, to
   * different children, in different scenarios. Inside one lesson it reads as
   * warmth; across three it reads as a machine with a catchphrase, and a child
   * who hears it twice learns that the praise means nothing. No single
   * transcript can show it.
   */
  const sentences = new Map<string, number>();
  for (const beat of beats) {
    for (const raw of beat.tutor.split(/(?<=[.!?])\s+/)) {
      const s = flatten(raw);
      // Long enough to be a distinctive flourish rather than "muy bien".
      if (s.split(' ').length < 4) continue;
      sentences.set(s, (sentences.get(s) ?? 0) + 1);
    }
  }
  /*
   * THREE, not two — and the calibration is the point.
   *
   * This found what it was written for: "eso es pensar como un científico" four
   * times, and the same follow-up question four times. Both are fixed, and what
   * it reports now is different in kind: "¿quieres que lo practiquemos con
   * monedas?" said in two separate conversations, which is a natural sentence
   * for a natural situation, not a catchphrase.
   *
   * A tutor will and should reuse the language of its subject. Two children
   * hearing the same sentence about the same activity is a coincidence; four
   * is a machine with a script. Reporting the first teaches whoever reads this
   * to skim it, and a check nobody reads is worse than no check.
   */
  for (const [sentence, count] of sentences) {
    if (count > 2) {
      /*
       * Said "N times", not "to N learners": this counts sentences across
       * every conversation without tracking who heard them, and a message
       * that claims more than it measured is the kind of small lie that makes
       * a whole report untrustworthy.
       */
      fault(`the same sentence was used ${count} times`, sentence.slice(0, 90));
    }
  }

  /*
   * 2. TURNS THAT RUN LONG.
   *
   * The system prompt asks for "1-3 short sentences", because this is SPOKEN
   * to a six-year-old and a paragraph read aloud is a paragraph nobody hears.
   * Nothing has ever checked whether that instruction is obeyed; it is a
   * request in prose, exactly like the rules that turned out not to hold.
   */
  const spoken = beats.filter((b) => b.kind === 'said');
  const long = spoken.filter((b) => b.tutor.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length > 4);
  if (long.length > spoken.length / 3) {
    fault(
      `${long.length} of ${spoken.length} turns ran past 4 sentences`,
      'the prompt asks for 1-3, and this is read aloud to a child',
    );
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) {
    console.error('MODEL_API_KEY is not set — there is no tutor to talk to.');
    process.exit(1);
  }
  /*
   * A HARNESS THAT CANNOT OPERATE THE SURFACE MUST SAY SO, NOT BLAME THE
   * PRODUCT (CLAUDE.md §1.14).
   *
   * Every scenario here is a minor, so every turn requires a model moderation
   * pass, and with no judge configured that pass fails CLOSED — which is the
   * correct safety behaviour and completely destroys the measurement. What came
   * out was a transcript of five identical canned fallback lines and the verdict
   * "14 problems a person would notice": a confident, entirely false report that
   * the tutor is broken, produced by a missing local environment variable.
   * Production had the key the whole time.
   *
   * The failure had to be indistinguishable from a real one to be worth
   * guarding, and it was — repetition and canned-fallback counts are exactly
   * what this script exists to detect, so the fallbacks tripped its own best
   * detectors. Refusing to start is the only honest option.
   */
  if (!config.JUDGE_API_KEY) {
    console.error('JUDGE_API_KEY is not set.');
    console.error('');
    console.error('Every scenario here is a minor, so every turn needs a moderation pass, and');
    console.error('without a judge that pass fails closed. The tutor would answer with canned');
    console.error('fallback lines and this script would report them as repetition — measuring');
    console.error('the missing key, not the product. Set the key or run nothing.');
    process.exit(1);
  }

  let spent = 0;
  const allBeats: Beat[] = [];
  for (const scenario of SCENARIOS) {
    // Per conversation, so each one walks the catalogue from the start.
    let activityIndex = 0;
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
          `${turn.segmentRequest ? ` · asks for ${turn.segmentRequest.skillKey}` : ''}` +
          `${orchestrator.activeStrategy ? ` · strategy=${orchestrator.activeStrategy}` : ''}]`,
      );
      const whiteboardSummary = turn.whiteboard ? summarizeWhiteboard(turn.whiteboard) : null;
      if (whiteboardSummary) {
        console.log(`           [whiteboard "${whiteboardSummary.label}" — ${whiteboardSummary.summary}]`);
      }
      beats.push({
        learner: line,
        tutor: turn.say,
        source: outcome.emission.source,
        next: turn.next,
        requestedActivity: turn.segmentRequest != null,
        kind: 'said',
        whiteboard: whiteboardSummary,
      });

      /*
       * THE ACTIVITY ARRIVES, because in production it does.
       *
       * Without this the harness asks the tutor for an activity and never
       * delivers one, so from the tutor's side the practice never starts and it
       * keeps announcing it — which the repetition check then reported as a
       * product defect. It is not one: `ws/server.ts` serves the segment and
       * feeds the result back. A harness that omits a step the product performs
       * reports faults the product does not have, which is the fourth time
       * today that shape has cost a cycle.
       *
       * The activity is a stand-in, deliberately: what is under test here is
       * the CONVERSATION around it, and the ladder that picks real content has
       * its own checks. Grading it correct keeps the lesson moving; a learner
       * who fails everything is the third scenario's job.
       */
      if (turn.segmentRequest != null) {
        const served = `seg-${beats.length}`;
        /*
         * A DIFFERENT ACTIVITY EACH TIME, because that is what the product does.
         * Core excludes segments a session has already served, so a real learner
         * never sees the same one twice — but this harness handed the
         * orchestrator ONE hardcoded `coin_count` prompt on every request. The
         * tutor then reacted identically to what it had been told was an
         * identical activity, four times in one conversation, and the run
         * reported that repetition as a product defect. It was correct behaviour
         * on input the product would never produce.
         */
        const activity = ACTIVITIES[activityIndex % ACTIVITIES.length]!;
        activityIndex += 1;
        orchestrator.noteSegmentServed(served, turn.segmentRequest.skillKey, activity.type, activity.prompt);
        /*
         * THE SCENARIO DECIDES WHETHER IT WAS PASSED.
         *
         * This call was `handleSegmentResult(served, 100, Date.now())` against a
         * four-parameter signature: `correct` received a timestamp — truthy, so
         * EVERY activity passed, including in the scenario whose entire job is a
         * learner who fails — and `nowMs` received `undefined`, feeding NaN into
         * every time-based guardrail in the controller. Three cycles of
         * conversation evidence were read through that, and no type-check
         * covered this directory to say so.
         */
        const passed = scenario.passesActivities !== false;
        const reaction = await orchestrator.handleSegmentResult(
          served,
          passed ? 100 : 40,
          passed,
          Date.now(),
          undefined,
          { misconceptionCode: passed ? null : 'adds-instead-of-counts-up', attemptNumber: 1 },
        );
        if (reaction !== null) {
          console.log(
            `  [activity] ${turn.segmentRequest.skillKey} (${activity.type}) — ` +
              `served and answered ${passed ? 'correctly' : 'INCORRECTLY'}`,
          );
          console.log(`  tutor    ${reaction.emission.turn.say}`);
          beats.push({
            learner: '(completed the activity)',
            tutor: reaction.emission.turn.say,
            source: reaction.emission.source,
            next: reaction.emission.turn.next,
            requestedActivity: reaction.emission.turn.segmentRequest != null,
            kind: 'activity',
          
        whiteboard: null,});
        }
      }
    }

    review(beats, scenario.session.tier, scenario.session.nickname);
    allBeats.push(...beats);
    spent += orchestrator.totalCostUsd;
  }

  reviewAcrossConversations(allBeats);

  /*
   * V4: DID THE WHITEBOARD ACTUALLY FIRE ON THE REAL MODEL?
   *
   * Every arithmetic guarantee around this feature already has unit tests
   * (computeSequence bounds, the schema refusal, the wire recomputation) —
   * what NONE of those can prove is that a live model, told "show your
   * work" in the prompt, actually sets the field on a real growth story.
   * "the session that failed" is literally the owner's own transcript
   * ("¿qué es el interés compuesto?"), so this is the direct, automatable
   * check that today's fix reaches the exact conversation that reported it.
   */
  const boards = allBeats.filter((b) => b.whiteboard !== null);
  if (boards.length === 0) {
    fault(
      'no whiteboard appeared in any conversation',
      'a growth-story scenario ran and the model never drew a board — either the prompt instruction is not landing, or something upstream is dropping it',
    );
  } else {
    for (const b of boards) {
      console.log(`  whiteboard: "${b.whiteboard!.label}" — ${b.whiteboard!.summary}`);
    }
  }

  console.log('');
  console.log(`  cost across ${SCENARIOS.length} conversations: $${spent.toFixed(4)}`);
  console.log(
    `  empty completions the provider forced us to retry: ${emptyCompletions}` +
      (emptyCompletions > 0 ? ' (absorbed — no learner saw one)' : ''),
  );
  if (problems > 0) {
    console.log('');
    console.log(`tutor:converse — ${problems} problem(s) a person would notice.`);
    process.exit(1);
  }
  console.log('');
  console.log('tutor:converse — nothing a person would notice went wrong.');
}

await main();
