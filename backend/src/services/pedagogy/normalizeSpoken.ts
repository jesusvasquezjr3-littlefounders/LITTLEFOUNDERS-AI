/*
 * Spoken-answer normalization — "cuarenta y dos", "tres pesos con cincuenta
 * centavos", "4 2" → a number. Deterministic, three locales, no model.
 *
 * FAILURE POSTURE (§1.14): returning null means "I could not read a number
 * out of this", and the caller MUST treat that as a no-op conversation turn,
 * never as a wrong answer. Child speech through STT is noisy; an unparseable
 * utterance must not decrement anyone's mastery.
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
  if (digitMatch) {
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
  const units = UNITS[locale] ?? UNITS['en-US'];
  const words = cleaned.split(' ');

  let acc = 0;
  let hasAcc = false;
  let wholePart: number | null = null;
  let centsPart: number | null = null;

  const bank = (): number => {
    const v = acc;
    acc = 0;
    hasAcc = false;
    return v;
  };

  for (const word of words) {
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
    hasAcc = true;
    if (value === 1000) acc = (acc || 1) * 1000;
    else if (value === 100) acc = (acc || 1) * 100;
    else acc += value;
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
