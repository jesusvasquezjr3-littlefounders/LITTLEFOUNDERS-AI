/*
 * `npm run model:probe-empty` — WHY does the provider return whitespace, and
 * what actually reduces it?
 *
 * THE PROBLEM, measured and named. `deepseek-chat` returns completions with
 * `finish_reason=stop`, no reasoning, 41-87 completion tokens billed, and
 * `message.content` holding 45-76 characters — of whitespace. `produce()`
 * retries and the second call answers, so no learner ever sees one, but we pay
 * for a second call on a large fraction of turns.
 *
 * WHY THIS SCRIPT EXISTS RATHER THAN ANOTHER CONVERSATION. The first attempt
 * to fix it was measured through `tutor:converse`, which produced 18 empties in
 * one run and 32 in another AT THE SAME SETTING. Against that spread, a change
 * that moved the number to 40 taught me nothing except that I had been reading
 * noise as signal — and I had already shipped the change before noticing. A
 * conversation is the right instrument for "is this a good lesson" and the
 * wrong one for "does this parameter matter": it varies the prompt, the
 * history and the turn count all at once.
 *
 * So this holds everything still and changes ONE thing at a time. Same context,
 * same messages, N identical calls per condition, counting how many come back
 * as whitespace. It is the experiment the conversation could not be.
 *
 * Costs N × (number of conditions) short completions. Nothing is changed.
 *
 * ROUND 45'S HYPOTHESIS, MEASURED AND REFUTED (2026-08-30). A live
 * `tutor:converse` run had 2 of 9 turns in one conversation fall to the
 * scripted fallback after BOTH a repeated-sentence repair retry and its own
 * second attempt came back empty. The repeated-sentence correction
 * (`orchestrator.ts`'s `turnCorrection` for `repeated !== null`) is the only
 * one of seven repair reasons that quotes up to 60 chars of the model's OWN
 * prior output back to it verbatim — a plausible mechanism (some models
 * degenerate when shown their own text in-context), identified but not
 * testable from inside an isolated review worktree with no live credentials.
 * Measured here with two new conditions, same 20-turn window and temperature
 * 0.2 the real retry actually uses, the ONLY difference between them being
 * whether the correction message quotes the model's own text: 0/12 empty for
 * the quoting version, 0/12 for the non-quoting control — indistinguishable
 * from each other and from the existing reminder-protected baseline. The
 * quoting hypothesis does not hold at this N; the 2-of-9 observation was
 * statistical variance in an already-mostly-mitigated issue, consistent with
 * this same run's own `full window` (no correction, no reminder) condition
 * landing at 33% — the baseline risk this reminder already exists to close,
 * with or without a quote riding alongside it.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { sealContext, type TutorContext } from '../src/context/schema.js';
import { TUTOR_SYSTEM_PROMPT, buildContextMessage } from '../src/tutor/prompt.js';
import { fenceUntrusted } from '../src/safety/untrusted.js';

const CONTEXT: TutorContext = {
  nickname: 'Chispa',
  tier: 2,
  locale: 'es-MX',
  character: 'rho',
  intent: 'open',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  turnHistory: [
    { speaker: 'learner', text: '¿qué es el interés compuesto?' },
    { speaker: 'tutor', text: 'Imagina que guardas 100 pesos y cada año ganas 10.' },
    { speaker: 'learner', text: 'si algo cuesta 25 y pago con 50 el cambio son 35 verdad?' },
  ],
  planState: null,
  previousSessions: [],
  pedagogy: null,
  openActivity: null,
  learnerBrief: null,
};

/** The correction the RETRY appends today, and the variable under test. */
const CORRECTION =
  'Reply with ONLY the JSON object described above. No prose, no markdown fence, no blank reply.';

interface Condition {
  name: string;
  temperature: number;
  correction: boolean;
  /** How many prior turns to put in the context. */
  historyTurns: number;
  /**
   * Round 45 (2026-08-30): the REAL repair path sends a SECOND message before
   * the shape reminder — `Your previous reply ${turnCorrection}.` — and one
   * repair reason, the repeated-sentence correction, is the only one of seven
   * that quotes up to 60 chars of the model's OWN prior output back to it
   * verbatim (`orchestrator.ts`'s `turnCorrection` for `repeated !== null`).
   * The four conditions above never modelled this second message at all —
   * "the retry correction" there means only the trailing shape reminder,
   * which every attempt sends regardless of repair reason. `true` here adds
   * the real quoting-shaped message; `false` adds the SAME correction with
   * the quote removed, so the only variable between the two is the quote.
   */
  repairQuotesOwnText?: boolean;
}

const QUOTING_CORRECTION = (priorText: string) =>
  `Your previous reply reused a sentence it has already said in this session ("${priorText.slice(0, 60)}"). Say something new — a child who hears the same compliment after every exercise learns the praise means nothing, and the same question twice learns nobody is listening.`;

const NON_QUOTING_CORRECTION =
  'Your previous reply reused a sentence it has already said in this session. Say something new — a child who hears the same compliment after every exercise learns the praise means nothing, and the same question twice learns nobody is listening.';

/*
 * THE HYPOTHESIS UNDER TEST, and it came from the failure of the last one.
 *
 * A first version of this probe held a THREE-turn history still and produced
 * ZERO whitespace completions in 24 calls — while real conversations were
 * producing 18 to 40. So they are not random, and the correction message is not
 * the variable.
 *
 * The logs say what is: every empty carried `prompt_tokens` above 2100, and the
 * number climbed with the conversation — 2195, 2389, 2672, 2810, 3030, 3182.
 * The suspect is the CONTEXT LENGTH, which means the conversation history added
 * this morning, without which the tutor greeted a child nine times in eleven
 * lines. If that is the cause, the fix is a window, not a parameter.
 */
const CONDITIONS: Condition[] = [
  { name: 'short history (3 turns)', temperature: 0.6, correction: false, historyTurns: 3 },
  { name: 'medium history (10 turns)', temperature: 0.6, correction: false, historyTurns: 10 },
  { name: 'full window (20 turns)', temperature: 0.6, correction: false, historyTurns: 20 },
  { name: 'full window + the retry correction', temperature: 0.6, correction: true, historyTurns: 20 },
  /*
   * Round 45's hypothesis, isolated: same window, same temperature (0.2 is
   * what the real repeated-sentence retry actually uses — see
   * `orchestrator.ts`'s repair-loop lowering it on attempt 1), same shape
   * reminder, same correction message — the ONLY difference between these
   * two is whether that correction quotes the model's own prior text.
   */
  {
    name: 'repair correction, quote REMOVED (control)',
    temperature: 0.2,
    correction: true,
    historyTurns: 20,
    repairQuotesOwnText: false,
  },
  {
    name: 'repair correction, quoting own prior text (repeated-sentence shape)',
    temperature: 0.2,
    correction: true,
    historyTurns: 20,
    repairQuotesOwnText: true,
  },
];

/** A plausible lesson, long enough to fill the window. */
function historyOf(turns: number): TutorContext['turnHistory'] {
  const beats: TutorContext['turnHistory'] = [];
  const questions = [
    '¿qué es el interés compuesto?',
    'si algo cuesta 25 y pago con 50 el cambio son 35 verdad?',
    'no entendí',
    'y si cuesta 30?',
    'ya entendí, dame otro',
  ];
  for (let i = 0; beats.length < turns; i += 1) {
    beats.push({ speaker: 'learner', text: questions[i % questions.length]! });
    if (beats.length >= turns) break;
    beats.push({
      speaker: 'tutor',
      text:
        'Imagina que guardas 100 pesos y cada año ganas 10. Al siguiente año el interés se calcula ' +
        'sobre 110, no sobre 100. Así crece más rápido. ¿Qué crees que pasa después de varios años?',
    });
  }
  return beats.slice(0, turns);
}

/** How many calls per condition. Small enough to be cheap, large enough to see a difference. */
const N = 12;

interface Outcome {
  empty: boolean;
  contentChars: number;
  completionTokens: number;
}

async function once(condition: Condition, context: TutorContext): Promise<Outcome | null> {
  const config = getConfig();
  void context;
  /*
   * BUILT THE WAY `produce()` BUILDS IT, and the previous version was not.
   *
   * The first attempt put the history into `turnHistory` and varied its length
   * — 3, 10, 20 turns — and every condition returned zero whitespace. Of
   * course it did: `buildContextMessage` does not render `turnHistory`. That
   * is the original defect this whole day started with, and I reproduced it
   * inside the instrument meant to study its consequences.
   *
   * The real path sends history as ALTERNATING chat messages, and re-fences
   * every learner line — which repeats the fence's four-line instruction once
   * per historical learner turn. That repetition is the thing this probe now
   * varies, because it is the only structural difference between a call that
   * returns whitespace and one that does not.
   */
  const history = historyOf(condition.historyTurns);
  const maxChars = config.TURN_MAX_INPUT_CHARS;
  // The text a repeated-sentence correction would quote, in the real path: the
  // tutor's own most recent prior turn.
  const priorTutorText = [...history].reverse().find((turn) => turn.speaker === 'tutor')?.text ?? '';
  const repairCorrection =
    condition.repairQuotesOwnText === undefined
      ? null
      : condition.repairQuotesOwnText
        ? QUOTING_CORRECTION(priorTutorText)
        : NON_QUOTING_CORRECTION;
  const messages = [
    { role: 'system', content: TUTOR_SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildContextMessage(sealContext({ ...CONTEXT, turnHistory: history })),
    },
    ...history.map((turn) =>
      turn.speaker === 'tutor'
        ? { role: 'assistant', content: turn.text }
        : { role: 'user', content: fenceUntrusted(turn.text, maxChars).block },
    ),
    { role: 'user', content: fenceUntrusted('no entendí, explícamelo otra vez', maxChars).block },
    ...(repairCorrection !== null ? [{ role: 'user', content: repairCorrection }] : []),
    ...(condition.correction ? [{ role: 'user', content: CORRECTION }] : []),
  ];
  try {
    const response = await fetch(`${config.MODEL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}` },
      body: JSON.stringify({
        model: config.MODEL_NAME,
        messages,
        temperature: condition.temperature,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { completion_tokens?: number };
    };
    const content =
      typeof body.choices?.[0]?.message?.content === 'string'
        ? (body.choices[0].message.content as string)
        : '';
    return {
      empty: content.trim() === '',
      contentChars: content.length,
      completionTokens: body.usage?.completion_tokens ?? 0,
    };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) {
    console.error('MODEL_API_KEY is not set — nothing to measure.');
    process.exit(1);
  }
  const context = sealContext(CONTEXT);

  console.log(`== Whitespace completions from ${config.MODEL_NAME}, ${N} calls per condition ==`);
  console.log('');

  const results: { condition: Condition; empties: number; usable: number }[] = [];
  for (const condition of CONDITIONS) {
    let empties = 0;
    let usable = 0;
    let billedForNothing = 0;
    for (let i = 0; i < N; i += 1) {
      const outcome = await once(condition, context);
      if (outcome === null) continue;
      usable += 1;
      if (outcome.empty) {
        empties += 1;
        billedForNothing += outcome.completionTokens;
      }
    }
    results.push({ condition, empties, usable });
    const pct = usable > 0 ? Math.round((empties / usable) * 100) : 0;
    console.log(
      `  ${String(pct).padStart(3)}%  ${String(empties).padStart(2)}/${usable}  ` +
        `${condition.name}` +
        (billedForNothing > 0 ? `  — ${billedForNothing} completion tokens billed for whitespace` : ''),
    );
  }

  console.log('');
  /*
   * Twelve calls per condition cannot separate small differences, and saying so
   * is the point — the last change was shipped on a difference this instrument
   * could not have measured.
   */
  const rates = results
    .filter((r) => r.usable > 0)
    .map((r) => ({ name: r.condition.name, rate: r.empties / r.usable }));
  if (rates.length < 2) {
    console.log('  not enough usable calls to compare.');
    process.exit(1);
  }
  const lowest = rates.reduce((a, b) => (b.rate < a.rate ? b : a));
  const highest = rates.reduce((a, b) => (b.rate > a.rate ? b : a));
  if (highest.rate - lowest.rate < 0.2) {
    console.log('  All conditions within what 12 calls can distinguish. Not a result.');
    return;
  }
  console.log(
    `  Lowest: ${lowest.name} (${Math.round(lowest.rate * 100)}%). ` +
      `Highest: ${highest.name} (${Math.round(highest.rate * 100)}%).`,
  );
}

await main();
