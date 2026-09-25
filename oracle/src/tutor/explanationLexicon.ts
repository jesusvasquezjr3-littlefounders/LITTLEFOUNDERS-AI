import { foldText, wordsIn } from './telemetryLexicon.js';

/*
 * C.14 / C.15 — THE LEARNER-TEXT READERS OF THE SELF-EXPLANATION MOVE AND THE
 * ALLIANCE CONTROLLER.
 *
 * Three questions are asked of a learner's words here, each deterministically
 * (no model call, OD-23 zero spend, and testable in milliseconds):
 *
 *   1. `classifyExplanation`: after "why did you pick that?", does the reply
 *      CITE the idea behind the decision (Appendix D §3.3: "does it cite the
 *      actual relevant concept, or is it filler?")?
 *   2. `classifyGoalReply`: after the Mentor restates the session goal, did
 *      the learner agree, ask for something else, or neither?
 *   3. `isDecisionQuestion` reads the MENTOR's own line (not learner text):
 *      did it just ask the learner to make a money decision?
 *
 * The first two read what a child types or says, so both are registered in
 * the C.20 bias audit (`safety/biasAudit/registry.ts`) with paired regional,
 * vernacular, code-switched, child-spelled and speech-to-text fixtures. They
 * read FOLDED text (lower case, no accents), the same as every other reader,
 * so a spoken "porque asi ahorro" is read like the typed "porque así ahorro".
 *
 * PRECISION OF THE QUALITY CHECK. It is deliberately lightweight, as the SPEC
 * asks: it answers "did they name the idea", not "is the reasoning correct".
 * Correctness of a stated idea is the C.18 misconception reader's job
 * (`statedMisconception.ts`), which the orchestrator runs on the same reply.
 * A false "filler" costs one targeted follow-up question; a false "concept"
 * costs one missed follow-up. Neither is ever shown to the learner as a
 * verdict on them.
 */

/** The closed concept families a financial decision can rest on. */
export const CONCEPT_FAMILIES = [
  'saving',
  'spending',
  'needs_wants',
  'price_value',
  'budget',
  'earning',
  'trade',
  'sharing',
  'time',
] as const;
export type ConceptFamily = (typeof CONCEPT_FAMILIES)[number];

/**
 * What each family is called in the model instruction that asks for a
 * targeted follow-up ("point them to <this>"). Our text, never the learner's.
 */
export const CONCEPT_WORDING: Record<ConceptFamily, string> = {
  saving: 'saving money for later instead of using it now',
  spending: 'what spending the money now gets them and what it costs them',
  needs_wants: 'the difference between a need and a want',
  price_value: 'comparing prices and what they get for the money',
  budget: 'how much money they have and what fits inside it',
  earning: 'where the money comes from and the work it took',
  trade: 'whether both sides of the trade get something of equal value',
  sharing: 'what sharing or giving does for someone else',
  time: 'what happens later, when time passes or they wait',
};

/*
 * The words and short phrases that NAME each idea, in the three product
 * languages, with the regional, vernacular and child-spelled forms the bias
 * audit pairs them with. Matched as whole words on folded text; a trailing
 * `*` is a stem ("ahorr*" reads "ahorro", "ahorrar", "ahorré").
 */
const FAMILY_TERMS: Record<ConceptFamily, readonly string[]> = {
  saving: [
    'save*', 'saving*', 'piggy', 'bank', 'keep it', 'keep the', 'put away', 'put it away', 'stash',
    'ahorr*', 'aorr*', 'guard*', 'alcanc*', 'cochinito', 'juntar', 'junto', 'juntando', 'apartar', 'aparto',
    'poup*', 'guardar', 'guardo', 'guardei', 'cofrinho', 'economiz*', 'juntar', 'juntei',
  ],
  spending: [
    'spend*', 'spent', 'buy*', 'bought', 'purchase*', 'cop', 'copped', 'use it', 'use the money',
    'gast*', 'compra', 'compras', 'comprar', 'compro', 'compre', 'compraria', 'kompra', 'komprar', 'usarlo', 'usar el dinero',
    'gastar', 'gastei', 'comprar', 'comprei', 'compro',
  ],
  needs_wants: [
    'need*', 'nead*', 'want*', 'wanna', 'have to', 'must', 'important', 'survive', 'food', 'water', 'medicine',
    'necesit*', 'nesesit*', 'necesidad*', 'quiero', 'kiero', 'quieres', 'queria', 'deseo', 'antojo', 'importante',
    'hace falta', 'sin eso', 'comida', 'medicina',
    'precis*', 'necessidade*', 'necesidade*', 'quero', 'kero', 'vontade', 'desejo', 'importante', 'sem isso', 'comida',
    'remedio',
  ],
  price_value: [
    'cheap*', 'expensive', 'price*', 'cost*', 'costs less', 'costs more', 'less money', 'more money', 'worth', 'value',
    'deal', 'each', 'per', 'for the same', 'more for', 'bigger', 'lasts', 'better quality', 'quality',
    'barat*', 'caro', 'cara', 'precio*', 'cuesta*', 'vale', 'valor', 'rinde', 'cada uno', 'por cada', 'mas por',
    'menos dinero', 'mas dinero', 'dura', 'calidad', 'oferta', 'ganga',
    'mais barat*', 'barat*', 'preco*', 'custa*', 'vale a pena', 'valor', 'rende', 'dura mais', 'qualidade',
    'promocao', 'pechincha', 'menos dinheiro', 'mais dinheiro', 'cada um',
  ],
  budget: [
    'budget', 'afford*', 'enough', 'left over', 'leftover', 'have left', 'limit', 'total', 'adds up', 'add up',
    'fits', 'too much', 'over the', 'under the', 'short',
    'presupuesto', 'alcanz*', 'me sobra', 'sobra*', 'me falta', 'falta*', 'limite', 'total', 'suma', 'cabe',
    'demasiado', 'me queda', 'queda',
    'orcamento', 'da pra', 'dar pra', 'sobra', 'sobrar', 'sobrou', 'sobrando', 'falt*', 'limite', 'total', 'soma', 'cabe', 'demais', 'resta',
  ],
  earning: [
    'earn*', 'work*', 'job', 'chores', 'paid', 'pay', 'sell*', 'sold', 'profit', 'business',
    'gan*', 'trabaj*', 'chamba', 'chambe*', 'pag*', 'vend*', 'negocio', 'tarea*', 'quehacer*',
    'ganh*', 'trabalh*', 'trampo', 'bico', 'vend*', 'lucro', 'negocio', 'tarefa*',
  ],
  trade: [
    'fair', 'unfair', 'trade*', 'swap*', 'exchange*', 'same value', 'worth the same', 'both get', 'wins',
    'justo', 'injusto', 'intercambi*', 'cambi*', 'trueque', 'mismo valor', 'vale lo mismo', 'los dos', 'parejo', 'gana',
    'troc*', 'mesmo valor', 'vale o mesmo', 'os dois', 'ganha',
  ],
  sharing: [
    'share*', 'sharing', 'give*', 'gave', 'donat*', 'help*', 'friend*', 'family', 'charity',
    'compart*', 'dar', 'doy', 'regal*', 'donar', 'dono', 'donacion', 'ayud*', 'amig*', 'familia',
    'dividir', 'divido', 'doar', 'doei', 'dou', 'ajud*', 'amig*', 'familia',
  ],
  time: [
    'later', 'wait*', 'future', 'tomorrow', 'next week', 'weeks', 'months', 'grow*', 'interest', 'someday', 'after',
    'despues', 'luego', 'esper*', 'futuro', 'manana', 'semana*', 'mes', 'meses', 'crec*', 'interes', 'intereses', 'algun dia', 'al rato',
    'depois', 'esper*', 'futuro', 'amanha', 'semana*', 'mes', 'meses', 'cresc*', 'juros', 'um dia', 'mais tarde',
  ],
};

/*
 * FILLER: a reply that gives no reason at all. Matched against the WHOLE
 * reply (after folding and trimming punctuation), so "because it's right" is
 * filler and "because it's cheaper, so it's right" is not.
 */
const FILLER_WHOLE = new RegExp(
  '^(?:' +
    [
      // en, incl. vernacular, child spelling and ASR
      "(?:just |cause |cuz |cos |bc |b/c |because |becuz |becaus |becos )?(?:it'?s |its |it is |that'?s |thats )?(?:right|correct|rite|the right one|the answer|good|better|the best|fine)",
      "(?:just )?(?:because|cause|cuz|cos|bc|becuz|becaus|becos)(?: (?:i|yes|yeah|so))?",
      "because i (?:wanted|want|felt like|said so|like it|liked it)(?: to)?",
      "(?:i )?(?:dunno|don'?t know|dont no|do not know|idk|ion know|no idea)",
      '(?:i )?(?:guessed|just guessed|picked it|chose it|just picked|just did)',
      'no reason|for no reason|nothing|whatever|i felt like it|felt like it',
      // es, incl. MX colloquial, child spelling and ASR
      '(?:pues |pos |nomas |nomás )?porque (?:si|sí|asi|así|ya|nomas|nada mas)',
      'porque (?:esta|es) (?:bien|correcto|la correcta|la buena|lo correcto)',
      '(?:porque )?(?:quise|me dio la gana|se me antojo elegirlo)',
      '(?:yo )?(?:no se|nose|ni idea|quien sabe|kien sabe)',
      '(?:la |lo )?(?:adivine|elegi al azar|nomas la elegi|la escogi|lo escogi)',
      'porque (?:ya|nomas)|porq si|xq si|pq si|por que si',
      // pt, incl. colloquial, child spelling and ASR
      '(?:ah )?porque (?:sim|sim ue|e|é)',
      'porque (?:e|é|ta|está|esta) (?:certo|correto|o certo|a certa|a resposta)',
      '(?:porque )?(?:quis|eu quis|deu vontade)',
      '(?:eu )?(?:nao sei|sei la|num sei|naum sei|n sei)',
      '(?:eu )?(?:chutei|escolhi|so escolhi|foi no chute)',
      'pq sim|pq e|porq sim',
    ].join('|') +
    ')$',
  'u',
);

function termPattern(term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '*' ? c : `\\${c}`));
  return escaped.endsWith('*') ? `${escaped.slice(0, -1)}[\\p{L}]*` : escaped;
}

const FAMILY_PATTERN: Record<ConceptFamily, RegExp> = Object.fromEntries(
  CONCEPT_FAMILIES.map((family) => [
    family,
    new RegExp(`(?<![\\p{L}\\p{N}'])(?:${FAMILY_TERMS[family].map(termPattern).join('|')})(?![\\p{L}\\p{N}'])`, 'u'),
  ]),
) as Record<ConceptFamily, RegExp>;

/** Which families a folded text names (a comparison with a number counts as price/budget reasoning). */
export function conceptsNamed(text: string): ConceptFamily[] {
  const t = foldText(text);
  const named = CONCEPT_FAMILIES.filter((family) => FAMILY_PATTERN[family].test(t));
  // "8 is less than 10", "cuesta 5 menos": a number compared is price/budget reasoning.
  if (/\d/.test(t) && /(?<![\p{L}])(?:less|more|fewer|menos|mas|mais|than|que)(?![\p{L}])/u.test(t)) {
    if (!named.includes('price_value')) named.push('price_value');
    if (!named.includes('budget')) named.push('budget');
  }
  return named;
}

export type ExplanationQuality = 'concept' | 'off_concept' | 'filler';

/**
 * The lightweight explanation-quality check (Appendix D §3.3). `families` is
 * the set of ideas the decision rests on (`familiesForDecision`); a reply
 * that names one of them is `concept`; a reply that gives no reason at all
 * is `filler`; a contentful reply naming none of them is `off_concept`.
 */
export function classifyExplanation(text: string, families: readonly ConceptFamily[]): ExplanationQuality {
  const t = foldText(text)
    .replace(/[¿?¡!.,;:…"()]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t === '') return 'filler';
  const named = conceptsNamed(t);
  if (named.some((family) => families.includes(family))) return 'concept';
  if (FILLER_WHOLE.test(t)) return 'filler';
  // Three words or fewer with no idea named is not a reason ("the red one").
  if (wordsIn(t).length <= 3) return 'filler';
  return 'off_concept';
}

/**
 * The families a graded activity's decision rests on, by the Lesson Engine
 * type. Only DECISION types are here: counting and computing types
 * (`coin_count`, `make_change`, `interest_peek`, `number_line`) are not
 * decisions, and "why did you pick that?" after them would be noise.
 */
const ALL_FAMILIES: readonly ConceptFamily[] = CONCEPT_FAMILIES;
export const DECISION_SEGMENT_FAMILIES: Readonly<Record<string, readonly ConceptFamily[]>> = {
  piggy_split: ['saving', 'spending', 'sharing', 'time', 'budget'],
  needs_wants: ['needs_wants'],
  price_compare: ['price_value', 'budget'],
  budget_fit: ['budget', 'price_value', 'needs_wants'],
  savings_goal: ['saving', 'time', 'budget', 'earning'],
  fair_trade: ['trade', 'price_value'],
  best_decision: ALL_FAMILIES,
  story_branch: ALL_FAMILIES,
  dialogue_choice: ALL_FAMILIES,
  would_you_rather: ALL_FAMILIES,
};

/** The families behind a decision activity, or null when the type is not a decision. */
export function familiesForDecision(segmentType: string | null | undefined): readonly ConceptFamily[] | null {
  if (!segmentType) return null;
  return DECISION_SEGMENT_FAMILIES[segmentType] ?? null;
}

/*
 * A MONEY-DECISION QUESTION, read from the Mentor's own last line: a question
 * that offers a choice ("or", "o", "ou", "which", "cuál", "qual") about money
 * (a decision verb or a money word). Our own text, so not bias-audited; the
 * learner's reply to it is what the quality check reads.
 */
const DECISION_VERB =
  /(?<![\p{L}])(?:save|spend|buy|share|give|keep|choose|pick|trade|swap|ahorrar|ahorras|ahorrarias|gastar|gastas|gastarias|comprar|compras|comprarias|guardar|guardas|compartir|elegir|elegirias|escoger|escogerias|cambiar|intercambiar|poupar|poupa|gastaria|comprar|compraria|guardar|guarda|guardaria|dividir|escolher|escolheria|trocar|trocaria)(?![\p{L}])/u;
const CHOICE_MARKER = /(?:\s(?:or|o|ou)\s|(?<![\p{L}])(?:which|cual|cuales|qual|quais|would you rather|preferirias|preferirias|prefere|prefieres)(?![\p{L}]))/u;

export function isDecisionQuestion(tutorLine: string): boolean {
  const t = foldText(tutorLine);
  if (!t.includes('?')) return false;
  // The question sentence itself (the last one ending in "?").
  const question = t.split(/(?<=[.!?])\s+/u).filter((s) => s.includes('?')).pop() ?? t;
  return DECISION_VERB.test(question) && CHOICE_MARKER.test(question);
}

/**
 * Whether the learner's reply to a money-decision question actually MAKES a
 * choice: it names one of the ideas ("save it", "lo gasto", "guardo") or
 * repeats a content word of the question's own options ("the bike", "a
 * bicicleta"). "lol", "ok" or "jaja" is not a decision, and asking "why did
 * you pick that?" after it would be noise. Reads learner text, so it is
 * bias-audited with the rest of this file.
 */
export function answersDecision(reply: string, tutorQuestion: string): boolean {
  const r = foldText(reply);
  if (r === '' || FILLER_WHOLE.test(r.replace(/[¿?¡!.,;:…]+/gu, ' ').replace(/\s+/g, ' ').trim())) return false;
  if (conceptsNamed(r).length > 0) return true;
  const question = foldText(tutorQuestion).split(/(?<=[.!?])\s+/u).filter((x) => x.includes('?')).pop() ?? '';
  const optionWords = new Set(wordsIn(question).filter((w) => w.length >= 4));
  return wordsIn(r).some((w) => w.length >= 4 && optionWords.has(w));
}

// ── C.15: the learner's answer to the goal-agreement restatement ────────────

export type GoalReply = 'agree' | 'other' | 'unclear';

const GOAL_OTHER = new RegExp(
  '(?<![\\p{L}\\p{N}\'])(?:' +
    [
      "something else|something different|another thing|other thing|not that|not really|not exactly|not right|isn'?t right|not it|nah not|no not",
      "i'?d rather|i would rather|i want to do|i wanna do|can we do|instead",
      'otra cosa|algo mas|algo diferente|otra onda|eso no|no es eso|no exactamente|no tanto|mejor (?:quiero|otra)|prefiero|en vez',
      'outra coisa|algo diferente|isso nao|nao e isso|nao exatamente|nao bem|prefiro|em vez|melhor outra',
    ].join('|') +
    ')(?![\\p{L}\\p{N}\'])',
  'u',
);
const GOAL_AGREE = new RegExp(
  '(?<![\\p{L}\\p{N}\'])(?:' +
    [
      "that'?s it|that'?s right|thats it|thats right|exactly|correct|you got it|right|sounds good|let'?s do it|lets do it|let'?s go|lets go",
      'eso|asi es|exacto|correcto|justo eso|ese mero|esa mera|va|sale|orale|dale|vamos',
      'isso|isso mesmo|exato|exatamente|certo|bora|vamos|fechou|pode ser',
    ].join('|') +
    ')(?![\\p{L}\\p{N}\'])',
  'u',
);
const OTHER_START = /^(?:no|nope|nah|naw|nel|nop|nao|naum|num|n)(?![\p{L}\p{N}])/u;
const AGREE_START =
  /^(?:yes|yeah|yea|yep|yup|ya|yas|yess+|sure|ok|okay|okey|k|bet|uh huh|mhm|si|sip|simon|claro|aja|sim|aham|uhum|ss|beleza|blz)(?![\p{L}\p{N}])/u;

/**
 * The learner's reply to "so today you want to …, right?". `other` asks for
 * a different goal; `agree` confirms it; `unclear` is anything else (they may
 * simply have started on the lesson), which the Alliance Controller records
 * as unconfirmed and never loops on.
 */
export function classifyGoalReply(text: string): GoalReply {
  const t = foldText(text).replace(/[¿?¡!.,;:…]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (t === '') return 'unclear';
  if (GOAL_OTHER.test(t)) return 'other';
  if (OTHER_START.test(t)) return 'other';
  if (GOAL_AGREE.test(t)) return 'agree';
  if (AGREE_START.test(t)) return 'agree';
  return 'unclear';
}
