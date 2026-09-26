import type { Locale } from '../context/schema.js';

/*
 * C.9 / C.19 / C.20 — THE LEXICAL DETECTORS OF THE BEHAVIORAL TELEMETRY LAYER.
 *
 * Every function here reads a LEARNER's words and returns a plain fact about
 * the words (a count, a yes/no, a canonical answer). None of them returns, or
 * is allowed to return, a statement about how the learner feels: the layer
 * that consumes them (`behavioralTelemetry.ts`) outputs signal strength only
 * (Appendix D §1.7).
 *
 * THEY ARE BIAS-AUDITED (C.20). Lexical rules are exactly where dialect bias
 * enters a system like this (Appendix D §1.7: classifiers rating African
 * American English and other vernacular forms as more negative than
 * semantically equivalent standard forms). Each detector is registered in
 * `safety/biasAudit/registry.ts` and run against paired dialect, code-switch,
 * child-spelling and ASR-artifact variants of the same meaning on every CI
 * run (`biasAudit.test.ts`); a variant treated differently from its standard
 * form fails the build. So the lists below are written to be SYMMETRIC: when a
 * standard form is in a list, its regional, vernacular and ASR renderings are
 * in it too, and the audit is what proves it.
 *
 * Matching runs on FOLDED text: lower case, accents removed and curly quotes
 * straightened. Speech-to-text regularly drops accents ("no se", "nao sei"),
 * and a detector that only knew the accented form would read a spoken answer
 * differently from the same answer typed — an ASR bias the audit catches.
 */

/** Lower case, accents removed, apostrophes straightened, whitespace collapsed. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words (letters or digits, with inner apostrophes), from already-folded or raw text. */
export function wordsIn(text: string): string[] {
  return foldText(text).match(/[\p{L}\p{N}]+(?:'[\p{L}]+)*/gu) ?? [];
}

/** The verbosity measure: how many words the learner wrote or said. */
export function countWords(text: string): number {
  return wordsIn(text).length;
}

/*
 * Whole-word matching that works on folded text and never treats a letter as
 * a boundary (`\b` is ASCII-only in JavaScript).
 */
const phrase = (alternation: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}'])(?:${alternation})(?![\\p{L}\\p{N}'])`, 'u');

// ── Hedging / uncertainty language (Appendix D §1.3, §1.6) ───────────────────

/*
 * "I don't know", "this doesn't make sense", "I guess": an UNCERTAINTY marker
 * (ITSPOKE's most transferable finding, Appendix D §1.6), in the three product
 * languages and the forms children actually type or say. Every standard form
 * sits beside its vernacular and speech-to-text renderings, so the same
 * uncertainty is read the same way whoever says it.
 */
const HEDGES_EN = phrase(
  [
    // "I don't (rightly / even / really) know", and "ion know" (AAE),
    // "i dont no" (child spelling).
    "i ?(?:don'?t|do not|dont) (?:rightly |even |really |quite )?(?:know|no)",
    'ion know',
    'idk',
    'idek',
    'i dunno',
    'dunno',
    "i ain'?t (?:sure|know)",
    "i (?:on'?t|ont) know",
    'i (?:guess|gess)',
    'i think',
    // Southern / Appalachian "I reckon" is the same hedge as "I guess".
    'i reckon',
    'maybe',
    'probably',
    "(?:i'?m |i am )?not (?:really |too )?sure",
    'makes no sense',
    // "doesn't make (any / a lick of / no) sense", incl. AAE "don't make no
    // sense" and child spellings of "doesn't".
    "(?:doesn'?t|does not|don'?t|do not|dosent|dosen'?t|dosnt) make (?:[\\p{L}']+ ){0,3}sense",
    "i ?don'?t (?:get it|understand)",
    'i do not (?:get it|understand)',
    "i ain'?t get(?:ting)? it",
    '(?:this is |that is |that\'s |this |it\'s |its )?(?:so |real |really )?confusing',
    "i'?m (?:so |real |really )?confused",
    'i am (?:so |really )?confused',
  ].join('|'),
);

const HEDGES_ES = phrase(
  [
    // "no sé" — but NOT the reflexive "no se puede / no se hace": only when it
    // ends the thought or is followed by what is not known.
    'no se(?=$|[,.!?]| (?:que|como|cuanto|cuantos|cuantas|cual|si|nada|bien|la|el|los|las|jaja|pues|eh|y|ni|todavia|nel))',
    'ni idea',
    'creo que',
    'a lo mejor',
    'alomejor',
    'a la mejor',
    // Rioplatense "capaz que" = "maybe".
    'capaz que',
    'igual y',
    'tal vez',
    'talvez',
    'quizas?',
    'no estoy segur[oa]',
    'no tiene (?:ningun )?sentido',
    'no le (?:entiendo|entendi)',
    'no (?:entiendo|entendi)',
    'me confunde',
    'estoy (?:bien |muy )?confundid[oa]',
    'quien sabe',
    '^sepa(?= |$)',
    'sepa (?:la bola|dios)',
    'no se ni',
  ].join('|'),
);

const HEDGES_PT = phrase(
  [
    'nao sei',
    'num sei',
    // "naum" is how children spell "não".
    'naum sei',
    'n sei',
    'nsei',
    'sei nao',
    'sei nem',
    'sei la',
    'sla',
    '(?:acho|axo) que',
    'talvez',
    'vai saber',
    'nao tenho (?:certeza|ctz)',
    'nao faz (?:nenhum )?sentido',
    '(?:nao|num|naum) (?:entendi|entendo)',
    '(?:to|tou|estou|t[oô]) (?:meio |muito )?confus[oa]',
  ].join('|'),
);

/*
 * Tokens that only mean "I don't know" in ONE language and mean something
 * else in another ("nose" is "no sé" typed fast or transcribed, and also the
 * English word for a body part). They are read only in the session's locale.
 */
const HEDGES_LOCAL: Partial<Record<Locale, RegExp>> = {
  'es-MX': phrase('nose|no c'),
};

/** True when the utterance carries hedging or uncertainty language. */
export function isHedging(text: string, locale: Locale): boolean {
  const t = foldText(text);
  if (t === '') return false;
  if (HEDGES_EN.test(t) || HEDGES_ES.test(t) || HEDGES_PT.test(t)) return true;
  return HEDGES_LOCAL[locale]?.test(t) ?? false;
}

// ── Terse replies (Appendix D §1.3: "k", "idk", "fine") ─────────────────────

/*
 * A minimal-engagement reply: the whole message is one of these, or nothing
 * but punctuation. Yes/no are NOT here — they answer questions. Every
 * standard "ok" sits beside its regional and vernacular equivalents ("bet",
 * "sale", "blz"), so the same minimal reply is read the same way everywhere.
 */
const TERSE_REPLIES = new Set([
  // en (incl. AAE and regional colloquial)
  'k', 'kk', 'ok', 'okay', 'okey', 'oki', 'okie', 'fine', 'whatever', 'whatevs', 'meh', 'idk', 'idc', 'nvm',
  'watever', 'wateva', 'whateva', 'bet', 'aight', 'ight', 'iight', 'alright', 'cool', 'mhm', 'mm', 'mmm', 'hmm', 'hm', 'eh', 'sure', 'yeah whatever',
  'ok whatever', 'i guess', 'if you say so',
  // es (incl. MX colloquial)
  'va', 'sale', 'vale', 'aja', 'ya', 'equis', 'x', 'como sea', 'lo que sea', 'da igual', 'me da igual', 'pues',
  'ok ok', 'esta bien', 'ta bien', 'sta bien', 'ajam', 'ps', 'pss', 'nimodo', 'ni modo', 'aha',
  // pt (incl. colloquial)
  'blz', 'beleza', 'ta', 'aham', 'uhum', 'tanto faz', 'tanto fas', 'tudo bem', 'tudo bom', 'de boa', 'firmeza', 'suave', 'pode ser', 'ta bom', 'tabom',
]);

/** True when the whole reply is a minimal-engagement token (or only punctuation). */
export function isTerseReply(text: string): boolean {
  const raw = text.trim();
  if (raw === '') return false;
  if (!/[\p{L}\p{N}]/u.test(raw)) return true;
  const words = wordsIn(raw);
  if (words.length === 0 || words.length > 4) return false;
  return TERSE_REPLIES.has(words.join(' '));
}

// ── Off-topic drift (Appendix D §1.3) ──────────────────────────────────────

/*
 * Off-topic is read as "a contentful message that shares nothing with the
 * lesson": no word of the recent Mentor lines or the topic, no word of the
 * lesson domain, no word about the lesson itself ("explain", "example"), and
 * no number. Messages under three content words are never judged.
 *
 * THE DIALECT RISK IS VOCABULARY. A child who says "lana", "feria", "grana",
 * "bread" or "bucks" is talking about money, and an overlap test that only
 * knows "dinero"/"dinheiro"/"money" would call it off-topic. Domain words are
 * therefore canonicalized through regional synonym sets before comparison,
 * and the bias audit pairs every standard domain word with its regional forms.
 */
const STOPWORDS = new Set(
  (
    // en, incl. colloquial function words
    'a an the and or but so if then than to of in on at by for with from up down out over about into as is am are was were be been being ' +
    'do does did done doing have has had having i me my mine we us our you your yours he him his she her they them their it its ' +
    "this that these those there here what which who whom whose when where why how all any some no not yes yeah yep ok okay " +
    "just very really too also still yet only even ever again already can could would should will shall may might must " +
    "im i'm it's its i'll i'd you're we're they're don't dont didn't didnt isn't isnt ain't aint gonna wanna gotta ima imma finna " +
    "y'all yall lol like got get gets go goes going went one ones thing things stuff kinda sorta oh um uh hey hi bro dude man " +
    // es, incl. MX colloquial
    'el la los las un una unos unas y o pero si no que de del al a en por para con sin sobre entre hasta desde es son era fue ser estar ' +
    'esta estan esto eso ese esa este estos esas yo tu te ti mi mis me nos nosotros ustedes usted el ella ellos ellas le les lo ' +
    'se su sus muy mas menos ya tambien pues pos pa pal ahi aqui alla como cuando donde porque por que cual quien hay tengo tiene ' +
    'tienes voy va vas vamos hace hago oye neta wey guey bueno ok jaja jajaja este eh ay mmm tipo osea o sea nomas nada todo algo ' +
    // pt, incl. colloquial
    'o os um uma uns umas e ou mas se nao que de do da dos das no na nos nas em por pra pro para com sem sobre ate desde e sao era foi ' +
    'ser estar esta estao isso isto esse essa este eu tu voce vc ce ele ela eles elas me te nos seu sua meu minha muito mais menos ' +
    'ja tambem ai aqui la como quando onde porque qual quem tem tenho vou vai vamos faz fazer tipo ne ta to tou mano cara bom beleza kkk'
  ).split(/\s+/),
);

/** Regional synonyms of the lesson domain, folded, mapped to one canonical key. */
const DOMAIN_SYNONYMS: Record<string, readonly string[]> = {
  money: [
    'money', 'cash', 'buck', 'bucks', 'bread', 'dough', 'dollar', 'dollars', 'coin', 'coins', 'cents', 'change', 'bills', 'moolah',
    'racks', 'paper', 'allowance',
    'dinero', 'lana', 'feria', 'varo', 'varos', 'plata', 'billete', 'billetes', 'moneda', 'monedas', 'peso', 'pesos', 'centavos',
    'cambio', 'domingo', 'mesada', 'quintos',
    'dinheiro', 'grana', 'bufunfa', 'din', 'trocado', 'trocados', 'moeda', 'moedas', 'reais', 'centavo', 'troco', 'mesada',
    'nota', 'notas', 'dindin',
  ],
  save: ['save', 'saving', 'savings', 'saved', 'ahorrar', 'ahorro', 'ahorros', 'ahorre', 'guardar', 'guardo', 'poupar', 'poupanca', 'economizar', 'guardei', 'juntar', 'junto', 'alcancia', 'cofrinho', 'piggy'],
  spend: ['spend', 'spent', 'spending', 'buy', 'bought', 'buying', 'purchase', 'gastar', 'gasto', 'gaste', 'comprar', 'compro', 'compre', 'compra', 'gastei', 'comprei', 'cop', 'copped'],
  price: ['price', 'prices', 'cost', 'costs', 'expensive', 'cheap', 'precio', 'cuesta', 'cuestan', 'caro', 'barato', 'preco', 'custa', 'custam', 'baratinho', 'carinho', 'pricey'],
  earn: ['earn', 'earned', 'work', 'job', 'chores', 'pay', 'paid', 'ganar', 'gane', 'trabajo', 'trabajar', 'chamba', 'chambear', 'pagar', 'pago', 'ganhar', 'ganhei', 'trabalho', 'trampo', 'bico', 'pagar'],
  sell: ['sell', 'sold', 'selling', 'business', 'customer', 'customers', 'profit', 'vender', 'vendo', 'negocio', 'cliente', 'clientes', 'ganancia', 'vender', 'vendi', 'lucro', 'freguês', 'fregues'],
  goal: ['goal', 'goals', 'want', 'wants', 'need', 'needs', 'meta', 'quiero', 'necesito', 'necesidad', 'deseo', 'objetivo', 'quero', 'preciso', 'necessidade', 'desejo'],
  bank: ['bank', 'account', 'interest', 'banco', 'cuenta', 'interes', 'conta', 'juros', 'loan', 'prestamo', 'emprestimo', 'debt', 'deuda', 'divida'],
  store: ['store', 'shop', 'market', 'tienda', 'mercado', 'tiendita', 'abarrotes', 'loja', 'mercadinho', 'feira', 'bodega'],
};

/** Words about the lesson itself: asking about it is never drift. */
const LESSON_TALK = new Set(
  (
    'explain example again help hint answer question understand mean means meaning why how repeat activity lesson number numbers ' +
    'count add plus minus subtract total math sum equal more less half double twice times divide ' +
    'explica explicame ejemplo otra vez ayuda pista respuesta pregunta entiendo entender significa porque repite actividad clase ' +
    'numero numeros contar suma sumar resta restar mas menos total mitad doble igual veces dividir ' +
    'explica explicar exemplo denovo ajuda dica resposta pergunta entendo entender significa repete atividade aula numero numeros ' +
    'contar soma somar menos subtrair total metade dobro igual vezes dividir'
  )
    .split(/\s+/)
    .map((w) => stem(foldText(w))),
);

const CANONICAL = new Map<string, string>();
for (const [key, words] of Object.entries(DOMAIN_SYNONYMS)) for (const w of words) CANONICAL.set(foldText(w), key);

/** Singular-ish stem: "monedas" and "moneda", "coins" and "coin" compare equal. */
function stem(word: string): string {
  // Crude on purpose: both sides of every comparison are stemmed the same
  // way, so consistency matters more than morphology.
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function canonical(word: string): string {
  return CANONICAL.get(word) ?? CANONICAL.get(stem(word)) ?? stem(word);
}

/** The content words of a text, canonicalized. */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of wordsIn(text)) {
    if (STOPWORDS.has(w) || /^\d+$/.test(w) || w.length < 2) continue;
    out.add(canonical(w));
  }
  return out;
}

const DOMAIN_KEYS = new Set(Object.keys(DOMAIN_SYNONYMS));

/**
 * Off-topic drift. `true` = a contentful message sharing nothing with the
 * lesson; `false` = on topic; `null` = not judgeable (too short, or no lesson
 * text to compare with). Never a verdict on the learner, only on the words.
 */
export function isOffTopic(text: string, topicText: string): boolean | null {
  if (/\d/.test(text)) return false;
  const learner = contentWords(text);
  if (learner.size < 3) return null;
  const topic = contentWords(topicText);
  if (topic.size < 2) return null;
  for (const word of learner) {
    if (DOMAIN_KEYS.has(word) || LESSON_TALK.has(word) || topic.has(word)) return false;
  }
  return true;
}

// ── Answer normalization (repeated identical answers, Appendix D §1.3) ──────

const EN_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const ES_NUMBERS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
};
const PT_NUMBERS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17,
  dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
};
const NUMBER_WORDS: Record<Locale, Record<string, number>> = { 'en-US': EN_NUMBERS, 'es-MX': ES_NUMBERS, 'pt-BR': PT_NUMBERS };
const CONNECTORS: Record<Locale, ReadonlySet<string>> = {
  'en-US': new Set(['and']),
  'es-MX': new Set(['y']),
  'pt-BR': new Set(['e']),
};
/** Units and fillers said beside an answer; they do not change it. */
const ANSWER_FILLERS = new Set([
  'dollar', 'dollars', 'buck', 'bucks', 'cent', 'cents', 'coin', 'coins', 'peso', 'pesos', 'moneda', 'monedas', 'varo', 'varos',
  'centavo', 'centavos', 'real', 'reais', 'moeda', 'moedas', 'answer', 'respuesta', 'resposta', 'think', 'guess', 'maybe',
  'probably', 'week', 'weeks', 'semana', 'semanas', 'conto', 'contos', 'creo', 'acho', 'talvez', 'quizas', 'quiza', 'sure', 'like', 'tipo', 'uh', 'um', 'umm', 'eh', 'este', 'humm', 'mmm',
  'is', 'es', 'son', 'sao', 'e', 'it', "it's", 'its', 'the', 'la', 'el', 'da', 'como', 'que',
]);

const EN_TENS = ['twenty', 'thirty', 'forty', 'fourty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * The value of one number word, or null. Beyond the exact table it reads the
 * forms the C.20 bias audit found children and speech-to-text produce: an
 * English compound written as one word ("twentyfive"), and the phonetic
 * spellings of young writers ("beinticinco" for "veinticinco", "sinco" for
 * "cinco", "vinti" for "vinte"). Without them a child who writes the same
 * wrong answer twice the way they hear it was never seen repeating it.
 */
function numberWordValue(word: string, table: Record<string, number>): number | null {
  if (Object.hasOwn(table, word)) return table[word]!;
  if (table === EN_NUMBERS) {
    for (const tens of EN_TENS) {
      const unit = word.startsWith(tens) ? word.slice(tens.length) : '';
      if (unit !== '' && Object.hasOwn(EN_NUMBERS, unit) && EN_NUMBERS[unit]! < 10) return EN_NUMBERS[tens]! + EN_NUMBERS[unit]!;
    }
    return null;
  }
  if (word.length < 3) return null;
  const variants = new Set([
    word.replace(/b/g, 'v'),
    word.replace(/s/g, 'c'),
    word.replace(/z/g, 's'),
    word.replace(/k/g, 'qu'),
    word.replace(/i$/, 'e'),
    word.replace(/b/g, 'v').replace(/i$/, 'e'),
    word.replace(/^h/, ''),
  ]);
  for (const variant of variants) if (Object.hasOwn(table, variant)) return table[variant]!;
  return null;
}

/**
 * A canonical form of a learner's answer, so that "25", "twenty-five
 * dollars", "veinticinco pesos" and "vinte e cinco reais" compare equal —
 * speech-to-text writes numbers as words or digits unpredictably, and a
 * repeated answer must be seen as repeated either way. The numbers come
 * first, then the remaining content words (so "una bici" and "una pelota"
 * stay different answers).
 */
export function normalizeAnswer(text: string, locale: Locale): string {
  const words = wordsIn(text.replace(/(\d)[.,](?=\d{3}(?!\d))/g, '$1').replace(/-/g, ' '));
  const numbers: number[] = [];
  const rest = new Set<string>();
  const table = NUMBER_WORDS[locale];
  const connectors = CONNECTORS[locale];
  let current: number | null = null;
  const flush = () => {
    if (current !== null) numbers.push(current);
    current = null;
  };
  for (const word of words) {
    if (/^\d+$/.test(word)) {
      flush();
      numbers.push(Number(word));
      continue;
    }
    if (word === 'hundred' && locale === 'en-US') {
      current = (current ?? 1) * 100;
      continue;
    }
    if (current !== null && (connectors.has(word) || (locale === 'en-US' && word === 'a'))) continue;
    const value = numberWordValue(word, table);
    if (value !== null) {
      // "twenty five" adds; "five twenty" is two numbers.
      if (current !== null && (current % 10 !== 0 || value >= current)) flush();
      current = (current ?? 0) + value;
      continue;
    }
    flush();
    if (ANSWER_FILLERS.has(word) || STOPWORDS.has(word) || word.length < 2) continue;
    rest.add(canonical(word));
  }
  flush();
  return [...numbers.map(String), ...[...rest].sort()].join(' ');
}

// ── The learner's answer to the check-in (C.19) ─────────────────────────────

/*
 * "Are we on the same page?" — the Mentor's humble check-in. The read is
 * deliberately narrow, like the stop-offer reply: an explicit "not really"
 * starts the repair; an explicit "yes" continues; anything else is unclear
 * and is answered as an ordinary turn (the learner may simply have answered
 * the lesson). The regional forms of yes and no ("simón", "nel", "sussa",
 * "nah", "bet") are read exactly like the standard ones.
 */
const CHECK_IN_ALIGNED_IDIOMS = phrase("no problem|no worries|sin problema|no hay problema|sem problema|nao tem problema");
const CHECK_IN_MISALIGNED = phrase(
  [
    "i'?m (?:kinda |kind of |so |really )?lost",
    'i am (?:so |really )?lost',
    "i (?:still )?(?:don'?t|do not|ain'?t) (?:get|understand|getting)(?: it| this)?",
    "(?:not|isn'?t|is not|ain'?t) (?:really )?helping",
    'not really',
    'not at all',
    'not much',
    'more or less',
    'kind of|kinda|sort of|sorta',
    'confus\\w*',
    'explain (?:it |that )?again',
    'no (?:le )?(?:entiendo|entendi)',
    'estoy (?:bien |muy )?(?:perdid[oa]|confundid[oa])',
    'no mucho|no tanto|la verdad no|pues no|para nada|mas o menos|mas menos|no me (?:esta )?ayudando',
    '(?:nao|num|naum) (?:entendi|entendo)',
    '(?:to|tou|estou) (?:meio |muito )?(?:perdid[oa]|confus[oa])',
    'nao muito|na verdade nao|mais ou menos|nao (?:ta|esta) ajudando',
  ].join('|'),
);
const CHECK_IN_ALIGNED = phrase(
  [
    'i get it',
    'got it',
    'makes sense',
    "we'?re good|we are good|we good|i'?m good|all good|all right|alright|aight",
    'ya entendi|si entiendo|si le entiendo|le entiendo|todo bien|vamos bien|todo claro',
    'entendi|to entendendo|estou entendendo|tudo bem|tudo certo|de boa|sussa|suave',
  ].join('|'),
);
const MISALIGNED_START = /^(?:no|nope|nah|naw|nay|nel|nop|nou|nao|nem|n)(?![\p{L}\p{N}])/u;
const ALIGNED_START =
  /^(?:yes|yeah|yea|yep|yup|ya|yas|yess+|yessir|sure|ok|okay|okey|k|bet|si|sip|simon|claro|va|sale|vale|aja|sim|aham|uhum|ta|beleza|blz|isso)(?![\p{L}\p{N}])/u;

export type CheckInReply = 'aligned' | 'misaligned' | 'unclear';

export function classifyCheckInReply(text: string): CheckInReply {
  const t = foldText(text);
  if (t === '') return 'unclear';
  if (CHECK_IN_ALIGNED_IDIOMS.test(t)) return 'aligned';
  if (CHECK_IN_MISALIGNED.test(t)) return 'misaligned';
  if (CHECK_IN_ALIGNED.test(t)) return 'aligned';
  if (MISALIGNED_START.test(t)) return 'misaligned';
  if (ALIGNED_START.test(t)) return 'aligned';
  return 'unclear';
}
