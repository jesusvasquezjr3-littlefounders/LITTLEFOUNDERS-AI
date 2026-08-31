/*
 * Spoken-answer normalization — "cuarenta y dos", "tres pesos con cincuenta
 * centavos", "4 2" → a number. Deterministic, three locales, no model.
 *
 * FAILURE POSTURE (§1.14): returning null means "I could not read a number
 * out of this", and the caller MUST treat that as a no-op conversation turn,
 * never as a wrong answer. Child speech through STT is noisy; an unparseable
 * utterance must not decrement anyone's mastery.
 *
 * Two subtleties this posture directly bears on (round-67 review, findings
 * 1 and 2):
 *   - "un"/"una" (es-MX) and "um"/"uma" (pt-BR) double as indefinite
 *     articles in ordinary speech ("un momento", "uma pergunta"). A bare,
 *     isolated one is trusted as the numeral 1 only when it extends an
 *     already-started count (a real compound, "treinta y un") or sits next
 *     to a currency/counting marker ("un peso", "un cincuenta"); otherwise
 *     it is filler and the whole utterance reads as null, per the posture
 *     above, rather than a guessed 1.
 *   - a low unit or teen word (0-19) immediately followed by a round
 *     multiple of ten (20-90) — "tres cincuenta", "twelve fifty" — is never
 *     a valid standalone integer compound in any of the three languages
 *     (that reading is always tens-first: "cincuenta y tres"). It is
 *     instead the idiomatic way to speak a sub-hundred price, so it is read
 *     as a decimal (3.50, 12.50) rather than summed into an invalid 53/62.
 */

const UNITS: Record<string, Record<string, number>> = {
  'es-MX': {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
    siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
    catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
    cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
    cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
    cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700,
    ochocientos: 800, novecientos: 900, mil: 1000, media: 0.5, medio: 0.5,
  },
  'en-US': {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, half: 0.5,
  },
  'pt-BR': {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
    dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
    cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
    cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
    quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
    novecentos: 900, mil: 1000, meio: 0.5, meia: 0.5,
  },
};

/** Words that connect number words inside one number phrase. */
const CONNECTORS = new Set(['y', 'and', 'e', 'con', 'com', 'with']);

/** Whole-currency words: the number parsed so far was whole units. */
const WHOLE_WORDS = new Set([
  'peso', 'pesos', 'dollar', 'dollars', 'dolar', 'dolares', 'real', 'reais',
  'reales', 'buck', 'bucks',
]);

/** Cents words: the number parsed so far was cents. */
const CENTS_WORDS = new Set(['centavo', 'centavos', 'cent', 'cents', 'centimo', 'centimos']);

/**
 * Words that mean "one" AND double as an indefinite article ("a"/"an") in
 * ordinary speech — "un momento", "uma pergunta". English has no entry here:
 * "a"/"an" are never in UNITS, so they were never ambiguous with a number.
 * "uno" (es-MX) is deliberately excluded — it is never used as an article,
 * only ever as the standalone numeral, so it stays unambiguous.
 */
const ARTICLE_OVERLAP: Record<string, Set<string>> = {
  'es-MX': new Set(['un', 'una']),
  'pt-BR': new Set(['um', 'uma']),
};

/** 0–19: the range that can open the "low-unit + round-ten = decimal" read. */
const isLowUnit = (value: number): boolean => value >= 0 && value < 20;

/** 20, 30, ..., 90: a round ten — the second half of that same read. */
const isRoundTen = (value: number): boolean => value >= 20 && value <= 90 && value % 10 === 0;

const stripDiacritics = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Parse the FIRST number expressed in the utterance. Digit forms win over
 * words ("son 42 creo" → 42); "tres pesos con cincuenta centavos" → 3.50;
 * "cincuenta centavos" → 0.50. Null when nothing number-shaped was found.
 */
export function normalizeSpokenNumber(utterance: string, locale: string): number | null {
  const cleaned = stripDiacritics(utterance.toLowerCase())
    .replace(/[$€£]/g, ' ')
    .replace(/[^a-z0-9,.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  // 1) Digit forms: "3.50", "3,50", "42", and "4 2" spoken digit-by-digit.
  const digitMatch = /(\d+(?:[.,]\d{1,2})?)/.exec(cleaned);
  if (digitMatch?.[1] !== undefined) {
    const raw = digitMatch[1].replace(',', '.');
    const value = Number(raw);
    if (Number.isFinite(value)) {
      const pair = /^(\d)\s(\d)$/.exec(cleaned);
      if (pair && !raw.includes('.')) return Number(`${pair[1]}${pair[2]}`);
      return value;
    }
  }

  // 2) Word forms — a small state machine. Numbers accumulate into `acc`;
  // a currency word banks the accumulated number as whole units or cents.
  const units: Record<string, number> = UNITS[locale] ?? UNITS['en-US'] ?? {};
  const articleOverlap = ARTICLE_OVERLAP[locale];
  const words = cleaned.split(' ');

  let acc = 0;
  let hasAcc = false;
  // True exactly when `acc` holds ONE fresh low-unit/teen value (0-19) with
  // nothing added to it yet — the pending left half of a possible "tres
  // cincuenta" (finding 2) decimal read. Cleared by bank() and by any word
  // that turns `acc` into something else.
  let accIsBareLowUnit = false;
  let wholePart: number | null = null;
  let centsPart: number | null = null;

  const bank = (): number => {
    const v = acc;
    acc = 0;
    hasAcc = false;
    accIsBareLowUnit = false;
    return v;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? '';
    if (WHOLE_WORDS.has(word)) {
      if (hasAcc && wholePart === null) wholePart = bank();
      continue;
    }
    if (CENTS_WORDS.has(word)) {
      if (hasAcc && centsPart === null) centsPart = bank();
      continue;
    }
    if (CONNECTORS.has(word)) continue;

    const value = units[word];
    if (value === undefined) {
      // A stray word ends the phrase only if a complete answer is banked or
      // accumulating — trailing chatter ("creo", "i think") must not erase it.
      if (hasAcc || wholePart !== null || centsPart !== null) break;
      continue;
    }

    // Finding 1: "un"/"una"/"um"/"uma" opening a fresh count is genuinely
    // ambiguous with the indefinite article. Trust it as 1 only when it is
    // extending an already-open count (handled below, since `hasAcc` is
    // already true and this branch is skipped) or the very next word marks
    // a count/currency context. Otherwise treat this word as non-numeric
    // filler, exactly like any other unrecognized word.
    if (articleOverlap?.has(word) && !hasAcc) {
      const next = words[i + 1];
      const nextValue = next !== undefined ? units[next] : undefined;
      const isCountContext =
        next !== undefined &&
        (WHOLE_WORDS.has(next) || CENTS_WORDS.has(next) || (nextValue !== undefined && isRoundTen(nextValue)));
      if (!isCountContext) {
        if (wholePart !== null || centsPart !== null) break;
        continue;
      }
    }

    // Finding 2: a bare low unit/teen immediately followed by a round ten
    // ("tres" + "cincuenta", "twelve" + "fifty") is never a valid standalone
    // compound (that would be spoken tens-first) — it is sub-hundred price
    // shorthand for a decimal, not two addends.
    if (accIsBareLowUnit && wholePart === null && isRoundTen(value)) {
      wholePart = acc;
      centsPart = value;
      acc = 0;
      hasAcc = false;
      accIsBareLowUnit = false;
      continue;
    }

    const wasFreshStart = !hasAcc;
    hasAcc = true;
    if (value === 1000) {
      acc = (acc || 1) * 1000;
      accIsBareLowUnit = false;
    } else if (value === 100) {
      acc = (acc || 1) * 100;
      accIsBareLowUnit = false;
    } else {
      acc += value;
      accIsBareLowUnit = wasFreshStart && isLowUnit(value);
    }
  }

  const leftover = hasAcc ? acc : null;

  if (wholePart !== null || centsPart !== null) {
    const whole = wholePart ?? 0;
    // "tres pesos con cincuenta" (cents word omitted): a small leftover after
    // a banked whole part reads as cents.
    const cents = centsPart ?? (wholePart !== null && leftover !== null && leftover < 100 ? leftover : 0);
    return whole + cents / 100;
  }
  return leftover;
}
