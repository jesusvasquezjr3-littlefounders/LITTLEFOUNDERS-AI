/*
 * Locale speech lexicons — the data half of `normalizeForSpeech`.
 *
 * Kept separate from the transform so the tables can be reviewed and extended by
 * anyone writing content, without touching the regex pipeline. Everything here
 * exists because qwen3-tts reads the RAW STRING: it has no SSML, no abbreviation
 * dictionary and no grammar model, so anything a human would silently expand
 * while reading aloud must be expanded in text first or the child hears garbage
 * ("c/u" → "ce u", "1 vaso" → "uno vaso").
 */

import type { LessonLocale } from '../types/lessonDocument.js';

export interface SymbolWords {
  plus: string;
  minus: string;
  equals: string;
  percent: string;
  times: string;
  dividedBy: string;
  /** Bare "$N" reads as a plain amount in the locale's everyday currency. */
  currency: string;
  /** Singular form — "$1" must read "1 peso", never "1 pesos". */
  currencySingular: string;
  /** Joins a numeric range: "3-5 pesos" → "3 a 5 pesos". */
  rangeTo: string;
}

export const SYMBOL_WORDS: Record<LessonLocale, SymbolWords> = {
  'es-MX': {
    plus: 'más', minus: 'menos', equals: 'igual a', percent: 'por ciento',
    times: 'por', dividedBy: 'entre', currency: 'pesos', currencySingular: 'peso', rangeTo: 'a',
  },
  'en-US': {
    plus: 'plus', minus: 'minus', equals: 'equals', percent: 'percent',
    times: 'times', dividedBy: 'divided by', currency: 'dollars', currencySingular: 'dollar', rangeTo: 'to',
  },
  'pt-BR': {
    plus: 'mais', minus: 'menos', equals: 'igual a', percent: 'por cento',
    times: 'vezes', dividedBy: 'dividido por', currency: 'reais', currencySingular: 'real', rangeTo: 'a',
  },
};

/**
 * Abbreviation → spoken words, per locale. ORDER MATTERS: entries are applied in
 * array order, so longer/more specific patterns come first ("c/u" before "c/").
 * Patterns are matched case-insensitively unless the regex says otherwise.
 */
export interface Abbreviation {
  pattern: RegExp;
  /** A plain string (with $1… refs) or a function for number-dependent forms. */
  replacement: string | ((match: string, ...groups: string[]) => string);
}

/**
 * Units are only expanded when they directly follow a number (never bare
 * letters — "l" alone must stay "l"), and the expansion agrees in number:
 * "1 kg" → "1 kilo", "5 kg" → "5 kilos".
 */
function unit(abbr: string, singular: string, plural: string): Abbreviation {
  return {
    pattern: new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${abbr}\\b\\.?`, 'gi'),
    replacement: (_match: string, n: string) => `${n} ${n === '1' ? singular : plural}`,
  };
}

const ES_ABBREVIATIONS: Abbreviation[] = [
  // The one that started this: "5 pesos c/u" was read "cinco pesos ce u".
  { pattern: /\bc\/u\b\.?/gi, replacement: 'cada uno' },
  { pattern: /\bc\/\s?(?=[a-záéíóúñ])/gi, replacement: 'con ' },
  { pattern: /\bp\/\s?(?=[a-záéíóúñ])/gi, replacement: 'para ' },
  { pattern: /\baprox\b\.?/gi, replacement: 'aproximadamente' },
  { pattern: /\betc\b\.?/gi, replacement: 'etcétera' },
  { pattern: /\bSrta\b\.?/g, replacement: 'señorita' },
  { pattern: /\bSra\b\.?/g, replacement: 'señora' },
  { pattern: /\bSr\b\.?/g, replacement: 'señor' },
  { pattern: /\bDra\b\.?/g, replacement: 'doctora' },
  { pattern: /\bDr\b\.?/g, replacement: 'doctor' },
  { pattern: /\b(?:No|Núm|Nro)\b\.?(?=\s*\d)/gi, replacement: 'número' },
  { pattern: /\bNº|\bN°/gi, replacement: 'número ' },
  { pattern: /\bpág\b\.?/gi, replacement: 'página' },
  { pattern: /\bud\b\.?/gi, replacement: 'unidad' },
  { pattern: /\bmáx\b\.?/gi, replacement: 'máximo' },
  { pattern: /\bmín\b\.?/gi, replacement: 'mínimo' },
  unit('kg', 'kilo', 'kilos'),
  unit('gr?', 'gramo', 'gramos'),
  unit('ml', 'mililitro', 'mililitros'),
  unit('lt?', 'litro', 'litros'),
  unit('cm', 'centímetro', 'centímetros'),
  unit('mts?', 'metro', 'metros'),
  unit('min', 'minuto', 'minutos'),
  unit('hrs?', 'hora', 'horas'),
  unit('seg', 'segundo', 'segundos'),
];

const EN_ABBREVIATIONS: Abbreviation[] = [
  { pattern: /\bea\b\.?/gi, replacement: 'each' },
  { pattern: /\bapprox\b\.?/gi, replacement: 'approximately' },
  { pattern: /\betc\b\.?/gi, replacement: 'et cetera' },
  { pattern: /\bvs\b\.?/gi, replacement: 'versus' },
  { pattern: /\bMrs\b\.?/g, replacement: 'Missus' },
  { pattern: /\bMr\b\.?/g, replacement: 'Mister' },
  { pattern: /\bMs\b\.?/g, replacement: 'Miz' },
  { pattern: /\bDr\b\.?/g, replacement: 'Doctor' },
  { pattern: /\bNo\b\.?(?=\s*\d)/g, replacement: 'number' },
  { pattern: /\bp\b\.?(?=\s*\d)/gi, replacement: 'page' },
  unit('kg', 'kilogram', 'kilograms'),
  unit('lbs?', 'pound', 'pounds'),
  unit('oz', 'ounce', 'ounces'),
  unit('ml', 'milliliter', 'milliliters'),
  unit('cm', 'centimeter', 'centimeters'),
  unit('min', 'minute', 'minutes'),
  unit('hrs?', 'hour', 'hours'),
  unit('sec', 'second', 'seconds'),
];

const PT_ABBREVIATIONS: Abbreviation[] = [
  { pattern: /\bc\/u\b\.?/gi, replacement: 'cada um' },
  { pattern: /\bc\/\s?(?=[a-záéíóúãõç])/gi, replacement: 'com ' },
  { pattern: /\bp\/\s?(?=[a-záéíóúãõç])/gi, replacement: 'para ' },
  { pattern: /\baprox\b\.?/gi, replacement: 'aproximadamente' },
  { pattern: /\betc\b\.?/gi, replacement: 'et cetera' },
  { pattern: /\bSra\b\.?/g, replacement: 'senhora' },
  { pattern: /\bSr\b\.?/g, replacement: 'senhor' },
  { pattern: /\bDra\b\.?/g, replacement: 'doutora' },
  { pattern: /\bDr\b\.?/g, replacement: 'doutor' },
  { pattern: /\bn[ºo]\b\.?(?=\s*\d)/gi, replacement: 'número' },
  { pattern: /\bpág\b\.?/gi, replacement: 'página' },
  unit('kg', 'quilo', 'quilos'),
  unit('gr?', 'grama', 'gramas'),
  unit('ml', 'mililitro', 'mililitros'),
  unit('lt?', 'litro', 'litros'),
  unit('cm', 'centímetro', 'centímetros'),
  unit('min', 'minuto', 'minutos'),
  unit('hrs?', 'hora', 'horas'),
  unit('seg', 'segundo', 'segundos'),
];

export const ABBREVIATIONS: Record<LessonLocale, Abbreviation[]> = {
  'es-MX': ES_ABBREVIATIONS,
  'en-US': EN_ABBREVIATIONS,
  'pt-BR': PT_ABBREVIATIONS,
};

/**
 * Ordinal digit forms → words. Spanish/Portuguese apocopate before a masculine
 * noun ("1er premio" → "primer premio", not "primero premio"), so each entry
 * carries both forms; the transform picks by what follows.
 */
export interface OrdinalWords {
  /** Used when a noun follows: "primer día". */
  apocopated: string;
  /** Standalone / feminine handled separately: "el primero". */
  full: string;
  feminine: string;
}

export const ES_ORDINALS: Record<number, OrdinalWords> = {
  1: { apocopated: 'primer', full: 'primero', feminine: 'primera' },
  2: { apocopated: 'segundo', full: 'segundo', feminine: 'segunda' },
  3: { apocopated: 'tercer', full: 'tercero', feminine: 'tercera' },
  4: { apocopated: 'cuarto', full: 'cuarto', feminine: 'cuarta' },
  5: { apocopated: 'quinto', full: 'quinto', feminine: 'quinta' },
  6: { apocopated: 'sexto', full: 'sexto', feminine: 'sexta' },
  7: { apocopated: 'séptimo', full: 'séptimo', feminine: 'séptima' },
  8: { apocopated: 'octavo', full: 'octavo', feminine: 'octava' },
  9: { apocopated: 'noveno', full: 'noveno', feminine: 'novena' },
  10: { apocopated: 'décimo', full: 'décimo', feminine: 'décima' },
};

export const PT_ORDINALS: Record<number, OrdinalWords> = {
  1: { apocopated: 'primeiro', full: 'primeiro', feminine: 'primeira' },
  2: { apocopated: 'segundo', full: 'segundo', feminine: 'segunda' },
  3: { apocopated: 'terceiro', full: 'terceiro', feminine: 'terceira' },
  4: { apocopated: 'quarto', full: 'quarto', feminine: 'quarta' },
  5: { apocopated: 'quinto', full: 'quinto', feminine: 'quinta' },
  6: { apocopated: 'sexto', full: 'sexto', feminine: 'sexta' },
  7: { apocopated: 'sétimo', full: 'sétimo', feminine: 'sétima' },
  8: { apocopated: 'oitavo', full: 'oitavo', feminine: 'oitava' },
  9: { apocopated: 'nono', full: 'nono', feminine: 'nona' },
  10: { apocopated: 'décimo', full: 'décimo', feminine: 'décima' },
};

export const EN_ORDINALS: Record<number, string> = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
  6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
};

/**
 * FEMININE nouns whose ending would otherwise be read as masculine, and
 * MASCULINE nouns whose ending would otherwise be read as feminine. Only
 * exceptions live here — regular endings are handled by suffix rules in
 * `grammaticalGender`. Domain-first: everything a lemonade-stand / money course
 * for kids actually says.
 */
export const ES_GENDER_EXCEPTIONS: Record<string, 'm' | 'f'> = {
  // -a but masculine (Greek-origin -ma, plus the classic irregulars)
  dia: 'm', mapa: 'm', problema: 'm', sistema: 'm', tema: 'm', programa: 'm',
  clima: 'm', idioma: 'm', drama: 'm', planeta: 'm', sofa: 'm', tranvia: 'm',
  // -o but feminine
  mano: 'f', foto: 'f', moto: 'f',
  // consonant/-e endings that are feminine (not covered by suffix rules)
  clase: 'f', llave: 'f', calle: 'f', noche: 'f', tarde: 'f', leche: 'f',
  carne: 'f', gente: 'f', suerte: 'f', parte: 'f', fuente: 'f', nube: 'f',
  sal: 'f', miel: 'f', piel: 'f', flor: 'f', red: 'f', sed: 'f', vez: 'f',
  luz: 'f', paz: 'f', voz: 'f', cruz: 'f', nariz: 'f', raiz: 'f',
};

export const PT_GENDER_EXCEPTIONS: Record<string, 'm' | 'f'> = {
  dia: 'm', mapa: 'm', problema: 'm', sistema: 'm', tema: 'm', programa: 'm',
  clima: 'm', idioma: 'm', planeta: 'm', sofa: 'm', cinema: 'm',
  mao: 'f', foto: 'f', moto: 'f', tribo: 'f',
  classe: 'f', chave: 'f', noite: 'f', tarde: 'f', carne: 'f', gente: 'f',
  sorte: 'f', parte: 'f', fonte: 'f', nuvem: 'f', flor: 'f', luz: 'f',
  paz: 'f', voz: 'f', cruz: 'f', vez: 'f',
};
