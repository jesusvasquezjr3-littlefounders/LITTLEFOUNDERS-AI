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
 *
 * ROUND 74'S HYPOTHESIS, AND WHY IT TOOK SEVEN ROUNDS TO REACH (2026-09-04).
 * Rounds 71, 72 and 73 each isolated one WORDING of one message — the brace
 * nudge, the tier the context declares, the maneuver block a real turn appends
 * — and all three came back 0/12, on every arm including their own controls.
 * Three consecutive nulls is not three failures; it is the instrument telling
 * you the variable is not in the set you are drawing from. And the set had a
 * shape: every one of those changes moves the prompt by a few hundred TOKENS
 * at most, and this file has never once written down how big its prompt is.
 *
 * The one measured correlate of a real empty was recorded at the top of the
 * CONDITIONS block below and then never tested: `prompt_tokens` above 2100 on
 * every empty, climbing with the conversation — 2195, 2389, 2672, 2810, 3030,
 * 3182. Meanwhile this probe's CONTEXT is a stub. `skillStates: []`,
 * `planState: null`, `previousSessions: []`, `pedagogy: null`,
 * `openActivity: null`, `learnerBrief: null`, `courseContext: null` — seven
 * fields empty that a real turn fills, one of which (`learnerBrief`) is alone
 * allowed 3600 characters. So the probe may simply never have crossed the
 * threshold it was built to study, and every 0/12 would then be a true reading
 * of a condition the failure does not live in.
 *
 * Round 74 does two things about that, and the first matters more than the
 * second. It RECORDS `prompt_tokens` on every call and reports min/median/max
 * per condition, so this file stops being unable to say what size it tested
 * at — that number should have been here from the first round. And it adds a
 * `fullContext` arm that fills all seven fields the way a real turn does,
 * against a stub control identical in every other respect.
 *
 * ROUND 74'S RESULT — THE FAILURE REPRODUCES, AND IT IS NOT SIZE (2026-09-04).
 * Three findings, and the first is that this probe had been reproducing the
 * failure since the day it was written, in the three arms nobody was reading:
 *
 *   correction:false, 3 turns   ->  0/12    9571-9579 prompt tokens
 *   correction:false, 10 turns  ->  3/12   10122-10144
 *   correction:false, 20 turns  ->  7/12   10975-10993
 *
 * A dose-response, 0% to 58%, across a 1400-token spread — which kills the
 * size hypothesis this round was built to test, and kills it the useful way.
 * The `fullContext` arms carried 12,829 and 14,543 tokens and returned 0/12
 * BOTH times. Fourteen thousand tokens with the reminder is clean; eleven
 * thousand without it fails the majority of the time. The variable is the
 * NUMBER OF ALTERNATING TURNS preceding the request, not the byte count, and
 * the trailing shape reminder cancels it at every size measured.
 *
 * Second: that is why every round from 45 onward returned 0/12. All of them
 * set `correction: true`, so all of them were measuring inside the mitigation.
 * Seven rounds of conditions were compared against a variable that had already
 * been neutralised in every arm. The controls were not controls.
 *
 * Third, and this is what round 75 is for: one protected arm did fire (1/12,
 * `R71 attempt-0, no nudge`). At N=12, one event cannot be told apart from
 * zero, and the difference decides real work — a residual near 8% accounts for
 * the paid converse gate's empty-completion count on its own, and a true 0%
 * would mean those come from somewhere else entirely. Round 75 raises N on the
 * protected arms and keeps one unprotected arm as a positive control, so the
 * reproduction is re-confirmed in the same run that measures the residual.
 *
 * ROUND 63'S HYPOTHESIS, MEASURED AND REFUTED (2026-08-30). A real browser
 * session hit the scripted fallback TWICE in one 5-turn conversation, at
 * SHORT history (this was the tutor's second and fourth turn). A dedicated
 * investigation traced one occurrence to a genuine repeated-sentence repair
 * whose retry (temp 0.2, the real correction message) came back empty, and
 * separately measured ~8% empty across its own ~24 retry-eligible live
 * calls at short history — matching the PRE-reminder short-history baseline
 * this file's own three unconditioned conditions above also show (0-8%
 * range depending on the run), not the 0% the reminder-protected conditions
 * establish. The gap: every reminder-protected condition above (`repair
 * correction, quote REMOVED` / `quoting own prior text`) was measured ONLY
 * at `historyTurns: 20` — never at the short/medium history a repair retry
 * early in a real conversation actually runs at. Closed with the same
 * discipline as round 45: two new conditions, same real retry shape (temp
 * 0.2 + the correction message) at `historyTurns: 3` and `10`. Result: 0/12
 * empty at BOTH — indistinguishable from the existing full-window
 * measurement. The short-history residual hypothesis does not hold either;
 * round 63's own ~8% was statistical variance from a smaller, less
 * tightly-controlled live sample, not a real gap in the reminder's reach.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { sealContext, type TutorContext } from '../src/context/schema.js';
import { TUTOR_SYSTEM_PROMPT, buildContextMessage, buildTurnMessages } from '../src/tutor/prompt.js';
import { fenceUntrusted } from '../src/safety/untrusted.js';
import { SHAPE_REMINDER } from '../src/tutor/prompt.js';

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

/**
 * THE SEVEN FIELDS `CONTEXT` LEAVES EMPTY, filled the way a real turn fills
 * them (round 74).
 *
 * Sizes are at or near each field's schema cap on purpose. The question is
 * whether prompt SIZE is the variable, so the arm that tests it has to reach
 * the size a real late-conversation turn reaches; a half-filled context would
 * answer a question nobody asked. Every value here is catalog-shaped text of
 * the same class the real field carries — no learner words, because the real
 * field carries none either.
 */
const FULL_CONTEXT: Partial<TutorContext> = {
  adaptations: ['slower_pacing', 'more_examples', 'more_visual', 'repeat_before_advancing'],
  courseContext: {
    courseId: '3f2a1b7c-9d4e-4a51-8b62-0c7d1e9f4a35',
    courseTitle: 'Educación financiera — el dinero de todos los días',
    topicId: '8c5e2d19-4b76-4f30-9a1d-6e2b8f0c3d47',
    topicTitle: 'Repartir en partes iguales y qué hacer con lo que sobra',
  },
  skillStates: Array.from({ length: 12 }, (_, i) => ({
    skillKey: `money.share.equal_parts.remainder.step_${i + 1}`,
    masteryProbability: 0.12 + i * 0.05,
    uncertainty: 0.34,
    evidenceCount: i,
    recommendedAction: (['remediate', 'practice', 'retrieve', 'continue'] as const)[i % 4]!,
    reasonCode: 'low_mastery_high_uncertainty',
  })),
  planState: {
    objective:
      'Repartir una cantidad en partes iguales y nombrar lo que sobra, usando monedas que el ' +
      'niño pueda contar una por una antes de escribir cualquier número.',
    steps: ['warmup', 'explain', 'practice', 'check', 'stretch'],
    stepIndex: 2,
    stuckSkillKey: 'money.share.equal_parts.remainder.step_3',
    stuckCount: 4,
    stylesTried: ['slower_pacing', 'more_examples', 'more_visual'],
    finalStepRoundsCompleted: 0,
  },
  previousSessions: [
    { topic: 'Ahorrar para una meta', skillKeys: ['money.save.goal', 'money.count.coins'], outcome: 'left', gradedCorrect: 2, gradedTotal: 7, daysAgo: 2 },
    { topic: 'Repartir en partes iguales', skillKeys: ['money.share.equal_parts'], outcome: 'stopped', gradedCorrect: 1, gradedTotal: 6, daysAgo: 5 },
    { topic: 'Contar monedas', skillKeys: ['money.count.coins', 'money.count.mixed'], outcome: 'completed', gradedCorrect: 5, gradedTotal: 8, daysAgo: 11 },
  ],
  pedagogy: {
    strategy: 'RESCUE',
    scaffolding: 3,
    kcObjective:
      'Reconocer que al repartir en partes iguales puede sobrar, y nombrar cuánto sobra sin tratarlo como un error.',
    mode: 'remediation',
    misconceptionHint:
      'Cree que si sobra algo la repartición está mal hecha, y cambia el número de partes hasta que no sobre nada.',
  },
  openActivity: {
    type: 'sort_buckets',
    prompt:
      'Tienes 13 canicas y quieres repartirlas entre 3 amigos, iguales para todos. Arrastra las ' +
      'canicas a las tres cajas y deja aparte las que sobren.',
  },
  learnerBrief: {
    learner:
      'Cuenta muy bien de uno en uno y se le nota orgulloso cuando lo hace en voz alta. Se traba ' +
      'cuando una cuenta no sale exacta: llega a borrar lo que ya tenía bien con tal de que no ' +
      'sobre nada. Le gustan las monedas de verdad más que los dibujos, y pide "otra vez" cuando ' +
      'algo le salió. Se cansa alrededor del cuarto ejercicio seguido y ahí empieza a adivinar en ' +
      'vez de contar. Responde mucho mejor a una pregunta corta que a una explicación larga, y ' +
      'suele contestar antes de que termine la frase.',
    pedagogy:
      'Los pasos de una sola instrucción funcionan; los de dos partes se pierden en la segunda. ' +
      'Cuando falla, nombrar el sentimiento antes que la operación lo devuelve a la tarea en un ' +
      'turno; explicar la regla otra vez lo saca. Ha visto la explicación de partes iguales tres ' +
      'veces con palabras distintas y ninguna prendió; lo que sí movió la aguja fue contar ' +
      'monedas físicas y dejar las que sobran a un lado sin comentarlas hasta que él preguntó. ' +
      'Evitar felicitarlo por algo que no hizo: lo detecta y deja de creer el resto. Mantener los ' +
      'turnos por debajo de dos frases; con más, contesta a la primera y olvida el resto.',
  },
};

/**
 * A real move body, as `strategyInstruction` appends it — this is
 * `frustration-rescue.md`'s own procedure plus the wording rule, which is what
 * a struggling learner's turn actually carries.
 */
const MANEUVER_BLOCK = [
  'Strategy for this turn: RESCUE — the feeling first, the math later.',
  '',
  'They are frustrated. Nothing you teach in this state will land; your only job',
  'this turn is to make continuing feel safe.',
  '',
  '1. Name the feeling without drama and side WITH them. Say that this part is',
  '   hard, that being stuck here is ordinary, and that you are on their side —',
  '   IN YOUR OWN WORDS, built from what THEY just tried.',
  '2. Shrink the mountain: hand them one step so small it is almost unfair, one',
  '   they will certainly get. The point is a win, not progress.',
  '3. When they get it, point at the win specifically — name the thing THEY did,',
  '   in the words they used for it.',
  '4. Offer a real choice of path, not an exit — two ways forward, phrased for',
  '   what they are working on right now.',
  '',
  'Never reuse a sentence you have already said in this session. A quoted example',
  'in these instructions is a SHAPE, never a line to copy: say it your own way,',
  'built from what this learner just did.',
].join('\n');

interface Condition {
  name: string;
  temperature: number;
  correction: boolean;
  /*
   * ROUND 71'S `braceNudge` IS GONE, not merely unused (round 76).
   *
   * It was reverted from the product after `probe-empty` refuted it, and this
   * file now builds its messages with the product's own `buildTurnMessages`.
   * A condition the product has no way to send is not a condition — keeping
   * the field would let a future round measure something that cannot ship,
   * which is how the 43->24 and 43->17 numbers got believed in the first place.
   */
  /**
   * Round 72 (2026-09-04): the tier the CONTEXT declares.
   *
   * Every condition before this one ran at tier 2, and every "0%" this file
   * reports was measured there. The failure that motivated round 71 was
   * measured somewhere else entirely — a tier-1 walk, 43 whitespace
   * completions in 48 turns — and round 71's conditions came back 0/12 at
   * tier 2 for all three, which does not refute the tier-1 number so much as
   * fail to reach it. Tier is the untested variable between the two.
   */
  tier?: 1 | 2 | 3;
  /**
   * Round 73 (2026-09-04): the MANEUVER, which every condition before this
   * one omitted entirely.
   *
   * A real turn does not end at the learner's line. `strategyInstruction`
   * appends the selected move's whole body, plus `SKILL_WORDING_RULE`, plus
   * any instrument guidance the move named — hundreds of words of procedure,
   * in the same trailing user content, on most turns. For a struggling
   * learner it is on nearly every turn, because RESCUE and REMEDIATE both
   * carry one. This probe has been measuring a message the product does not
   * send.
   */
  maneuver?: boolean;
  /**
   * Round 74 (2026-09-04): the SEVEN CONTEXT FIELDS this probe has always
   * left empty, and with them the prompt's actual size.
   *
   * `false`/absent keeps the stub context every round so far measured — the
   * one whose `skillStates`, `previousSessions`, `planState`, `pedagogy`,
   * `openActivity`, `courseContext` and `learnerBrief` are all empty or null.
   * `true` fills them at realistic size, which is the only change in this
   * round that moves `prompt_tokens` by thousands rather than hundreds.
   */
  fullContext?: boolean;
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

/*
 * PHRASED TO COMPLETE `Your previous reply ${...}.`, which is the contract
 * `buildTurnMessages` and the orchestrator's own `turnCorrection` share. These
 * used to be whole sentences carrying that prefix themselves, which was
 * correct while this file built its own message array and would now produce
 * "Your previous reply Your previous reply reused…".
 */
const QUOTING_CORRECTION = (priorText: string) =>
  `reused a sentence it has already said in this session ("${priorText.slice(0, 60)}"). Say something new — a child who hears the same compliment after every exercise learns the praise means nothing, and the same question twice learns nobody is listening`;

const NON_QUOTING_CORRECTION =
  'reused a sentence it has already said in this session. Say something new — a child who hears the same compliment after every exercise learns the praise means nothing, and the same question twice learns nobody is listening';

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
  /*
   * ROUND 71 (2026-09-04) — does the brace nudge help, and does its POSITION
   * matter? Measured through a conversation it looked like 43 -> 24 folded and
   * 43 -> 17 separate, one sample each. This file exists because that is not a
   * measurement. All three hold the full window and the real attempt-0
   * temperature still, and differ in nothing else.
   */
  /*
   * ROUND 72 — the tier. Same messages, same window, same temperature, same
   * reminder: the only difference is the tier the context declares, which is
   * the one variable separating this file's own 0% from a real tier-1 walk's
   * 43-in-48.
   */
  /*
   * ROUND 73 — the maneuver. Rounds 71 and 72 both came back 0/12 and neither
   * reached the real failure, which says the difference is something this
   * probe was not sending at all. A real turn carries the selected move's
   * whole procedure in the same trailing content; a struggling learner's turn
   * carries one on nearly every turn.
   */
  /*
   * ROUND 74 — the SIZE, at last. Four arms crossing the one boundary the
   * logs actually pointed at, holding tier, temperature, correction and
   * maneuver still and varying only how much context rides along. If the
   * threshold is real, the two `fullContext` arms are where it shows, and the
   * per-condition `prompt_tokens` column says whether the earlier rounds were
   * even in the neighbourhood.
   */
  /*
   * ROUND 75 — is the protected residual real? Three arms, meant to be run
   * with `--only R75 --n 40`: two protected at the history lengths that broke
   * the unprotected ones, and one UNPROTECTED positive control, so a run that
   * finds 0/40 twice still has to show the failure it claims to have closed.
   * A control that cannot fail is not evidence, which is the mistake round 71
   * shipped on.
   */
  { name: 'R75 protected, 20-turn history', temperature: 0.6, correction: true, historyTurns: 20, tier: 1 },
  { name: 'R75 protected, 40-turn history (schema max)', temperature: 0.6, correction: true, historyTurns: 40, tier: 1 },
  { name: 'R75 UNPROTECTED, 20-turn history (positive control)', temperature: 0.6, correction: false, historyTurns: 20, tier: 1 },
  { name: 'R74 FULL real context, 20-turn history, tier 1 + maneuver', temperature: 0.6, correction: true, historyTurns: 20, tier: 1, maneuver: true, fullContext: true },
  { name: 'R74 stub context, same everything else (control)', temperature: 0.6, correction: true, historyTurns: 20, tier: 1, maneuver: true, fullContext: false },
  { name: 'R74 FULL real context, 40-turn history (schema max)', temperature: 0.6, correction: true, historyTurns: 40, tier: 1, maneuver: true, fullContext: true },
  { name: 'R74 stub context, 40-turn history (control)', temperature: 0.6, correction: true, historyTurns: 40, tier: 1, maneuver: true, fullContext: false },
  { name: 'R73 tier 1 + the real maneuver block', temperature: 0.6, correction: true, historyTurns: 20, tier: 1, maneuver: true },
  { name: 'R73 tier 1, no maneuver (control)', temperature: 0.6, correction: true, historyTurns: 20, tier: 1, maneuver: false },
  { name: 'R72 tier 1 (the struggling learner)', temperature: 0.6, correction: true, historyTurns: 20, tier: 1 },
  { name: 'R72 tier 2 (control, this file default)', temperature: 0.6, correction: true, historyTurns: 20, tier: 2 },
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
  /*
   * Round 63 (2026-08-30): a real live session hit the scripted fallback
   * TWICE in a 5-turn conversation, at SHORT history. Traced to a genuine
   * repeated-sentence repair whose retry (temp 0.2, the real correction
   * message) came back empty. Every condition above that uses the real
   * retry shape (temp 0.2 + a correction message) was only ever measured
   * at `historyTurns: 20` — the "0%" this file's own header comment and
   * `oracle/AGENTS.md` cite for the shape reminder was never actually
   * measured at the short/medium history a repair retry early in a real
   * conversation actually runs at. These two conditions close that gap.
   */
  {
    name: 'repair correction (real retry shape) at short history (3 turns)',
    temperature: 0.2,
    correction: true,
    historyTurns: 3,
    repairQuotesOwnText: false,
  },
  {
    name: 'repair correction (real retry shape) at medium history (10 turns)',
    temperature: 0.2,
    correction: true,
    historyTurns: 10,
    repairQuotesOwnText: false,
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

/**
 * How many calls per condition. Small enough to be cheap, large enough to see
 * a difference — and round 74 showed exactly where that stops being true.
 *
 * Twelve separates 0% from 58% comfortably, which is what every round until
 * now needed. It cannot separate 0% from 8%: one event either way. Round 75's
 * question IS that difference, so `--n` raises it for a focused run, and
 * `--only <substring>` runs just the arms that question needs instead of
 * paying for all nineteen.
 */
const N = (() => {
  const flag = process.argv.indexOf('--n');
  const value = flag >= 0 ? Number(process.argv[flag + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 12;
})();

/** Run only conditions whose name contains this. Absent = all of them. */
const ONLY = (() => {
  const flag = process.argv.indexOf('--only');
  return flag >= 0 ? (process.argv[flag + 1] ?? null) : null;
})();

interface Outcome {
  empty: boolean;
  contentChars: number;
  completionTokens: number;
  /**
   * THE NUMBER THIS FILE SHOULD HAVE RECORDED FROM ROUND ONE (round 74).
   *
   * The only measured correlate of a real whitespace completion is that its
   * prompt was over 2100 tokens. Seven rounds of conditions were compared
   * against each other without any of them ever writing down the quantity the
   * observation was about, so a 0/12 could equally have meant "this variable
   * does not matter" or "this probe never got near the failure" — and those
   * are not the same result.
   */
  promptTokens: number;
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
  /*
   * BUILT BY THE PRODUCT'S OWN `buildTurnMessages` (round 76, 2026-09-04).
   *
   * This array was hand-written here, in parallel with the orchestrator's own
   * copy, for every round up to 75 — and rounds 74/75 ended on a gap that
   * shape could not close: 0 empties in 80 protected calls here against ~14%
   * in production at the same prompt size. There was no way to tell whether
   * that was a fact about the provider or a divergence between two hand-kept
   * copies of one message array, which is the same defect as measuring a
   * shared object through the wrong parent. Now there is one copy, so a result
   * from this file is a statement about the product.
   *
   * `correction: false` is what makes an arm UNPROTECTED, and it now has to
   * strip the reminder the builder always appends — deliberately awkward: the
   * product has no way to send that message array, and the arm exists only as
   * the positive control that proves a clean run could have failed.
   */
  const built = buildTurnMessages({
    systemContent: TUTOR_SYSTEM_PROMPT,
    contextMessage: buildContextMessage(
      sealContext({
        ...CONTEXT,
        ...(condition.fullContext === true ? FULL_CONTEXT : {}),
        tier: condition.tier ?? CONTEXT.tier,
        turnHistory: history,
      }),
    ),
    conversation: history.map((turn) =>
      turn.speaker === 'tutor'
        ? { role: 'assistant' as const, content: turn.text }
        : { role: 'user' as const, content: fenceUntrusted(turn.text, maxChars).block },
    ),
    userContent:
      fenceUntrusted('no entendí, explícamelo otra vez', maxChars).block +
      (condition.maneuver === true ? `\n\n${MANEUVER_BLOCK}` : ''),
    correction: repairCorrection,
    isRetry: repairCorrection !== null,
  });
  const messages = condition.correction
    ? built
    : built.filter((m) => m.content !== SHAPE_REMINDER);

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
      usage?: { completion_tokens?: number; prompt_tokens?: number };
    };
    const content =
      typeof body.choices?.[0]?.message?.content === 'string'
        ? (body.choices[0].message.content as string)
        : '';
    return {
      empty: content.trim() === '',
      contentChars: content.length,
      completionTokens: body.usage?.completion_tokens ?? 0,
      promptTokens: body.usage?.prompt_tokens ?? 0,
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
  const selected = ONLY === null ? CONDITIONS : CONDITIONS.filter((c) => c.name.includes(ONLY));
  if (selected.length === 0) {
    console.error(`No condition name contains ${JSON.stringify(ONLY)}.`);
    process.exit(1);
  }
  for (const condition of selected) {
    let empties = 0;
    let usable = 0;
    let billedForNothing = 0;
    const prompts: number[] = [];
    for (let i = 0; i < N; i += 1) {
      const outcome = await once(condition, context);
      if (outcome === null) continue;
      usable += 1;
      prompts.push(outcome.promptTokens);
      if (outcome.empty) {
        empties += 1;
        billedForNothing += outcome.completionTokens;
      }
    }
    results.push({ condition, empties, usable });
    const pct = usable > 0 ? Math.round((empties / usable) * 100) : 0;
    /*
     * The prompt size is printed on EVERY row, not only the interesting ones,
     * because its job is to make a 0% legible: a zero measured at 1400 tokens
     * and a zero measured at 4000 are different findings about a failure whose
     * only known correlate is size.
     */
    const size = prompts.length > 0 ? `${Math.min(...prompts)}-${Math.max(...prompts)} tok` : 'no calls';
    console.log(
      `  ${String(pct).padStart(3)}%  ${String(empties).padStart(2)}/${usable}  ` +
        `${size.padStart(13)}  ${condition.name}` +
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
