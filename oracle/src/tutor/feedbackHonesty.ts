import type { HintLevel } from './hintLadder.js';

/*
 * C.18 — HONEST FEEDBACK: the anti-sycophancy constraint and the per-turn
 * facts behind the answer-reveal-rate metric (Product C.18, Appendix D §3.7,
 * Appendix F §1.2 "Answer-Reveal Rate" and "Sycophancy Audit Score").
 *
 * WHY THIS IS A CONSTRAINT AND NOT A STYLE NOTE. Appendix D §3.7 quantifies
 * the failure: general-purpose LLMs asked to tutor reveal the solution about
 * two thirds of the time and give incorrect feedback on a learner's error
 * more often than not (MathDial), and sycophantic answers are rated MORE
 * favourably by users while producing worse outcomes (Cheng et al.). The
 * model this product runs on is measurably prone to both by default, so the
 * rule lives in three places, strongest last:
 *
 *   1. `ANSWER_HONESTY_RULE` — the system-prompt rule (advice).
 *   2. `affirmsCorrectness` / `endorsesClaim` — deterministic checks run by
 *      the orchestrator on every turn that reacts to a SERVER-VERIFIED wrong
 *      answer or to a stated wrong idea; a hit is repaired once and, if the
 *      repair still affirms, replaced by a scripted line (never delivered).
 *   3. `TurnHonesty` — the per-turn record Core stores (with its own
 *      key-based reveal check against the real answer key, which Oracle never
 *      holds) so the reveal rate is MEASURED per session and per persona and
 *      an elevated rate is treated as a controller defect.
 *
 * Every detector here is PRECISION-FIRST and lexical, like its siblings in
 * `prompt.ts`: a false positive on the blocking check costs one repair
 * attempt, a false negative on the metric is caught later by the calibrated
 * judge and human spot-check Appendix F names as the metric's authoritative
 * source (C.21/C.23, later checkpoints). None of them is a model call.
 */

/** Which kind of learner evidence the turn is reacting to, when it is reacting to one. */
export type VerdictContext = 'after_incorrect' | 'after_correct' | 'after_unsound_claim';

/**
 * Whether the turn sits inside a collaborative-repair or hint-ladder
 * sequence — the denominator of the Answer-Reveal Rate (Appendix F §1.2).
 * `open_activity` is the third place a reveal defeats the teaching: an
 * ungraded activity is on the learner's screen.
 */
export type SequenceKind = 'hint_ladder' | 'repair' | 'open_activity' | 'none';

/**
 * The per-turn honesty facts, sent with the transcript row to Core
 * (`POST /tutor/internal/turns`, `honesty`) and stored in
 * `tutor_turn_honesty`. HAND-MIRRORED in Core's `TurnHonestyBody`
 * (`backend/src/routes/tutor.ts`) and the migration's CHECK lists;
 * `npm run honesty:check` (root) keeps the three copies identical.
 */
export interface TurnHonesty {
  sequenceKind: SequenceKind;
  /** The ladder level reached on the current sub-step, when any help was given. */
  hintLevel: HintLevel | null;
  /** The learner explicitly asked for the answer, or the ladder bottomed out at "tell". */
  revealSanctioned: boolean;
  /** The delivered turn asks a question and states its answer (`answersItsOwnQuestion`). */
  revealSelfAnswered: boolean;
  /** The delivered turn contains an explicit answer statement ("the answer is …"). */
  revealPhrase: boolean;
  /** The ungraded activity on screen, for Core's key-based reveal check. */
  openSegmentId: string | null;
  verdictContext: VerdictContext | null;
  /** A draft of this turn affirmed a wrong answer / unsound idea and was caught. */
  falseAffirmationCaught: boolean;
  /** The DELIVERED turn still affirms — the zero-tolerance audit count; must stay false. */
  falseAffirmationDelivered: boolean;
  /** Praise present in the delivered turn, and whether it names a specific act. */
  praise: 'specific' | 'generic' | null;
}

/**
 * The system-prompt rule. English like the rest of the prompt; the model
 * answers in the session locale. Constant, so the prefix cache holds.
 */
export const ANSWER_HONESTY_RULE: string = [
  '## Mentors, not mascots: honest feedback',
  '',
  'A LEARNER FEELING PLEASED IS NOT EVIDENCE THAT THEY ARE RIGHT. The rules',
  'below are never outweighed by wanting them to feel good in the moment:',
  '- Praise names ONE specific thing they actually did ("you counted up from',
  '  the price instead of adding"). Never generic praise on its own ("great',
  '  job!", "you are so smart") — it teaches that your approval is unrelated',
  '  to their work.',
  '- Never tell them a wrong answer is right, never call it "almost" when it',
  '  is not close, and never agree with an idea because they sound sure. Say',
  '  kindly and plainly what is not right yet, then help with that step.',
  '- If they choose or propose a MONEY DECISION THAT IS NOT SOUND — spending',
  '  everything they saved, borrowing for something they only want, ignoring',
  '  a cost or a risk — do NOT call it a good idea, even inside a game or a',
  '  story. Name what was sensible in their reasoning, show one concrete',
  '  consequence of the decision, and ask what they would change.',
  '- Do not hand them the answer while they are still working it out: ask a',
  '  smaller question or give the next hint. State the answer only when the',
  '  turn instructions say they explicitly asked for it or the hint ladder',
  '  has reached "tell".',
].join('\n');

/*
 * CONFIRMATION — words that assert an ANSWER (or a claim) is right, in the
 * three product languages. Two classes, because several of these words are
 * also ordinary conversation ("Certo, vamos ver" is "OK, let's see"; "let's
 * correct it" is a verb):
 *
 *   EXCLAMATIONS count only as a sentence's opening exclamation — at the
 *   start of a sentence, followed by punctuation ("¡Correcto!", "Muy bien,
 *   Robi."). "Muy bien que lo intentaste" (praising the TRYING, which is the
 *   sanctioned shape after a miss) is followed by a word, not punctuation,
 *   and does not count.
 *   PHRASES are unambiguous anywhere, unless negated just before them.
 *
 * Deliberately not "warm" words ("¡vamos!", "good try"): encouraging effort
 * after a wrong answer is exactly what the rule asks for, and reading it as
 * sycophancy would teach the Mentor to withhold encouragement from the
 * children who need it most.
 */
const EXCLAMATIONS = [
  'correcto',
  'exacto',
  'exactamente',
  'perfecto',
  'muy bien',
  'excelente',
  'bien hecho',
  'eso es',
  'así es',
  'eso',
  'correct',
  'exactly',
  'perfect',
  'well done',
  'great job',
  'correto',
  'exato',
  'exatamente',
  'perfeito',
  'muito bem',
  'isso',
  'isso mesmo',
];

const PHRASES = [
  // es
  'es correcto',
  'está correcto',
  'es la respuesta correcta',
  'tienes razón',
  'acertaste',
  'le atinaste',
  'lo lograste',
  'lo hiciste bien',
  'lo hiciste muy bien',
  'vas muy bien',
  'estás sumando con confianza',
  // en
  "that's right",
  'that is right',
  "that's correct",
  'that is correct',
  "you're right",
  'you are right',
  'you got it',
  "you're doing great",
  'you did it right',
  'is the right answer',
  // pt
  'está certo',
  'está correto',
  'é a resposta certa',
  'você acertou',
  'acertou',
  'tem razão',
  'isso mesmo',
  'mandou bem',
  'você foi muito bem',
];

/** Extra endorsement words for a stated IDEA or DECISION (not an answer). */
const ENDORSEMENTS = [
  'buena idea',
  'gran idea',
  'buen plan',
  'me parece bien',
  'me parece genial',
  'suena bien',
  'good idea',
  'great idea',
  'good plan',
  'great plan',
  'sounds good',
  'sounds great',
  'boa ideia',
  'ótima ideia',
  'bom plano',
  'parece bom',
  'parece ótimo',
];

/** A negation or hedge in the few words before a phrase turns it around (folded text). */
const NEGATED_BEFORE =
  /(?:\bno\b|\bnot\b|\bnao\b|\bnem\b|n't|\bnunca\b|\bnever\b|\btodavia no\b|\bainda nao\b|\bnot yet\b|\bnot quite\b|\bcasi\b|\balmost\b|\bquase\b)[^.!?]{0,24}$/;

/** Accent-insensitive lowercase so "Así"/"asi", "está"/"esta" all match. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

function escapeRe(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A sentence's opening exclamation: "¡Correcto!", "Muy bien, Robi." */
function opensWithExclamation(sentence: string, words: readonly string[]): boolean {
  const text = fold(sentence).replace(/^[\s¡"«(]+/, '');
  return words.some((word) => new RegExp(`^${escapeRe(fold(word))}\\s*(?:[!.,:;\u2014\u2013-]|$)`).test(text));
}

/** An unambiguous phrase anywhere, not negated in the few words before it. */
function containsPhrase(say: string, phrases: readonly string[]): boolean {
  const text = fold(say);
  for (const phrase of phrases) {
    const re = new RegExp(`(?:^|[^\\p{L}])${escapeRe(fold(phrase))}(?![\\p{L}])`, 'gu');
    for (const match of text.matchAll(re)) {
      const at = match.index ?? 0;
      if (!NEGATED_BEFORE.test(text.slice(Math.max(0, at - 32), at + 1))) return true;
    }
  }
  return false;
}

function sentencesOf(say: string): string[] {
  return say.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim() !== '');
}

/** The turn tells the learner a (server-verified wrong) answer is right. */
export function affirmsCorrectness(say: string): boolean {
  return (
    sentencesOf(say).some((sentence) => opensWithExclamation(sentence, EXCLAMATIONS)) ||
    containsPhrase(say, PHRASES)
  );
}

/** The turn agrees with, or praises, a stated wrong idea or unsound decision. */
export function endorsesClaim(say: string): boolean {
  return affirmsCorrectness(say) || containsPhrase(say, ENDORSEMENTS);
}

/** Whether the draft is sycophantic FOR THIS verdict — the orchestrator's one call. */
export function isSycophantic(say: string, verdict: VerdictContext | null | undefined): boolean {
  if (verdict === 'after_incorrect') return affirmsCorrectness(say);
  if (verdict === 'after_unsound_claim') return endorsesClaim(say);
  return false;
}

/**
 * An explicit answer statement — the MathDial "reveals the solution" shape
 * in words ("la respuesta es 12", "the answer is 12", "a resposta é 12").
 * The key-based check (does the turn contain the activity's real answer) is
 * Core's, because only Core holds the key; this catches the phrasing when
 * no key applies (a conversational question). Matched on folded text.
 */
const ANSWER_STATEMENT =
  /\b(?:la respuesta (?:correcta |buena )?(?:es|era|seria)|el resultado (?:correcto )?es|the (?:right |correct )?answer (?:is|was|would be)|the answer's|a resposta (?:certa |correta )?(?:e|era|seria)|o resultado (?:certo |correto )?e)\b/;

export function statesTheAnswer(say: string): boolean {
  // A QUESTION about the answer ("what do you think the answer is?") is the
  // opposite of revealing it.
  return sentencesOf(say).some((sentence) => !/[?]\s*$/.test(sentence.trim()) && ANSWER_STATEMENT.test(fold(sentence)));
}

/*
 * PRAISE, SPECIFIC OR GENERIC — the Sycophancy Audit Score's general
 * measure (Appendix F §1.2), recorded per turn as a PROXY until the sampled
 * transcript audit exists. "Specific" means the praising sentence (or the
 * one right after it) points at something the learner did: a number, one of
 * the learner's own words, or an action verb addressed to them ("contaste",
 * "you compared", "você somou").
 */
const PRAISE_EXCLAMATIONS = [
  ...EXCLAMATIONS,
  'genial',
  'increíble',
  'bravo',
  'great',
  'awesome',
  'amazing',
  'nice',
  'ótimo',
  'incrível',
  'legal',
];
const PRAISE_PHRASES = [
  ...PHRASES,
  'good job',
  'buen trabajo',
  'bom trabalho',
  'so smart',
  'muy inteligente',
  'muito inteligente',
];

const ACTION_VERBS =
  /\b(?:contaste|sumaste|restaste|elegiste|escogiste|ahorraste|comparaste|explicaste|separaste|pensaste|revisaste|calculaste|repartiste|ordenaste|you (?:counted|added|subtracted|chose|picked|saved|compared|explained|checked|worked|split|sorted|noticed)|voce (?:contou|somou|subtraiu|escolheu|economizou|comparou|explicou|separou|pensou|calculou|dividiu|percebeu))\b/;

const STOPWORDS = new Set([
  'para',
  'porque',
  'pero',
  'como',
  'cuando',
  'donde',
  'esto',
  'esta',
  'este',
  'that',
  'this',
  'with',
  'have',
  'what',
  'when',
  'there',
  'isso',
  'esse',
  'essa',
  'quando',
  'onde',
  'mais',
  'menos',
]);

export function classifyPraise(say: string, learnerText: string): 'specific' | 'generic' | null {
  const sentences = sentencesOf(say);
  const praising = sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(
      ({ sentence }) =>
        opensWithExclamation(sentence, PRAISE_EXCLAMATIONS) || containsPhrase(sentence, PRAISE_PHRASES),
    );
  if (praising.length === 0) return null;
  const learnerWords = new Set(
    fold(learnerText)
      .split(/[^\p{L}\d]+/u)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
  for (const { sentence, index } of praising) {
    const scope = fold(`${sentence} ${sentences[index + 1] ?? ''}`);
    if (/\d/.test(scope)) return 'specific';
    if (ACTION_VERBS.test(scope)) return 'specific';
    if (scope.split(/[^\p{L}\d]+/u).some((w) => learnerWords.has(w))) return 'specific';
  }
  return 'generic';
}
