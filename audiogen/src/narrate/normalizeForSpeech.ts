/*
 * normalizeForSpeech — the last text transform before a narration unit is sent
 * to qwen3-tts. Runs AFTER stripMarkdown.
 *
 * WHY THIS FILE IS BIG: qwen3-tts reads the raw string. It has no SSML, no
 * abbreviation dictionary, no number-to-word grammar and no locale awareness
 * beyond voice selection (verified against the DashScope Model Studio docs,
 * 2026-07). Every expansion a human performs silently while reading aloud has to
 * happen in TEXT here, or a child hears the literal characters. Real defects that
 * shipped before this layer existed:
 *
 *   "5 pesos c/u"  → heard as "cinco pesos CE U"        (abbreviation read letter by letter)
 *   "Don Beto compró 1 vaso" → "compró UNO vaso"        (no apocope before a masculine noun)
 *   "1 moneda"     → "UNO moneda"                        (no feminine agreement)
 *   "5+5"          → "five plus five" inside a Spanish lesson
 *
 * The six stages, in order (order matters — later stages assume earlier ones ran):
 *   1. stage directions  — drop "(con entusiasmo)" style acting cues
 *   2. abbreviations     — locale table: c/u → "cada uno", 5 ml → "5 mililitros"
 *   3. ordinals          — "1er día" → "primer día" (apocope-aware)
 *   4. symbols           — "$5" → "5 pesos", "+" → "más", "2x5" → "2 por 5"
 *   5. emojis            — "¡Lo lograste! 🎉" → "¡Lo lograste!" (never spoken)
 *   6. number agreement  — "1 vaso" → "un vaso", "1 moneda" → "una moneda"
 *
 * Pacing/emotion are intentionally NOT handled here: qwen3-tts-flash exposes no
 * speed/rate/pitch parameter and no per-call emotion field (emotion comes from
 * VOICE selection — a casting decision in env, not code). Punctuation is the only
 * prosody lever the model documents, so we preserve it carefully.
 *
 * Anything this layer misses is caught by `auditSpeechText` (speechGuard.ts),
 * which refuses to let unnatural text reach a paid TTS call.
 */

import type { LessonLocale } from '../types/lessonDocument.js';
import {
  ABBREVIATIONS,
  ES_GENDER_EXCEPTIONS,
  ES_ORDINALS,
  EN_ORDINALS,
  PT_GENDER_EXCEPTIONS,
  PT_ORDINALS,
  SYMBOL_WORDS,
  type OrdinalWords,
  type SymbolWords,
} from './speechLexicon.js';

/* ---------------------------------------------------------------- stage directions */

/**
 * Stage-direction stems, all three locales in one list (content is single-locale
 * per document, and these stems don't collide across languages in practice). A
 * parenthetical is dropped only when its trimmed, lowercased, digit-free content
 * STARTS WITH one of these — deliberately narrow to avoid eating real asides like
 * "(5 pesos)" or "(limones, vasos)".
 */
const STAGE_DIRECTION_STEMS = [
  // es-MX
  'con entusiasmo', 'con voz', 'en voz baja', 'entusiasmad', 'emocionad', 'nervios', 'sonrí', 'sonrie', 'riendo', 'ríe', 'rie ',
  'susurr', 'grita', 'gritando', 'pausa', 'suspir', 'señal', 'guiñ', 'asiente', 'asom', 'pensativ', 'con cariño', 'con calma',
  // en-US
  'smil', 'laugh', 'whisper', 'shout', 'pause', 'sigh', 'excited', 'nervous', 'point', 'wink', 'nods', 'softly', 'cheer', 'grins',
  // pt-BR
  'sorri', 'rindo', 'sussurr', 'suspir', 'anima', 'nervos', 'apont', 'pisca', 'acena', 'baixinho', 'com carinho', 'com calma', 'empolgad',
];

function isStageDirection(inner: string): boolean {
  const normalized = inner.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (/\d/.test(normalized)) return false; // a number inside → meaningful aside, keep it
  if (normalized.split(/\s+/).length > 4) return false; // long → prose, not a cue
  return STAGE_DIRECTION_STEMS.some((stem) => normalized.startsWith(stem));
}

/** Drops whole-parenthetical stage directions; leaves every other "(...)" intact. */
function stripStageDirections(text: string): string {
  return text.replace(/\s*\(([^()]*)\)/g, (match, inner: string) => (isStageDirection(inner) ? '' : match));
}

/*
 * Blank placeholders — "2 vasos por ___ pesos" (a sign the child completes).
 * A human narrates a blank as a PAUSE, so underscore runs become an ellipsis
 * (the one prosody lever qwen3-tts documents is punctuation). Without this the
 * speechGuard's markdown-residue rule ("__" is also markdown bold) refused the
 * unit — found live on the first full narration of the Testing course
 * (2026-07-26): one build-the-sign lesson, all 3 locales, deterministic.
 */
function expandBlanks(text: string): string {
  return text.replace(/_{2,}/g, '…');
}

/* ------------------------------------------------------------------ abbreviations */

function expandAbbreviations(text: string, locale: LessonLocale): string {
  const table = ABBREVIATIONS[locale] ?? ABBREVIATIONS['es-MX'];
  let out = text;
  for (const { pattern, replacement } of table) {
    // Each pattern carries its own /g flag; reset lastIndex defensively because
    // the same RegExp object is reused across every call in the process.
    pattern.lastIndex = 0;
    out =
      typeof replacement === 'string'
        ? out.replace(pattern, replacement)
        : out.replace(pattern, replacement as (substring: string, ...args: unknown[]) => string);
  }
  return out;
}

/* ----------------------------------------------------------------------- ordinals */

/** Feminine-noun detection is shared with number agreement; see `isFeminineNoun`. */
function expandOrdinals(text: string, locale: LessonLocale): string {
  if (locale === 'en-US') {
    return text.replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/gi, (match, digits: string) => {
      const n = Number(digits);
      return EN_ORDINALS[n] ?? match;
    });
  }
  const table: Record<number, OrdinalWords> = locale === 'pt-BR' ? PT_ORDINALS : ES_ORDINALS;
  // Spanish/Portuguese ordinal digit forms: 1er, 1ro, 1o, 1º, 1a, 1ª, 2do, 3er…
  return text.replace(
    /\b(\d{1,2})(er|ro|do|to|mo|vo|no|o|a|º|ª)(?![\p{L}\d])\.?(\s+[\p{L}]+)?/giu,
    (match, digits: string, suffix: string, tail: string | undefined) => {
      const n = Number(digits);
      const words = table[n];
      if (!words) return match;
      const feminineMarker = suffix === 'a' || suffix === 'ª';
      const following = (tail ?? '').trim();
      if (feminineMarker) return `${words.feminine}${tail ?? ''}`;
      // A noun follows → apocopated form ("1er premio" → "primer premio").
      if (following.length > 0 && !isFeminineNoun(following, locale)) return `${words.apocopated}${tail ?? ''}`;
      if (following.length > 0) return `${words.feminine}${tail ?? ''}`;
      return `${words.full}${tail ?? ''}`;
    },
  );
}

/* ------------------------------------------------------------------------ symbols */

function normalizeSymbols(text: string, w: SymbolWords): string {
  return (
    text
      // Emoji math operators FIRST, mapped onto their plain forms so every rule
      // below (and the spacing-based range/minus logic) applies to them too.
      // Without this they are Extended_Pictographic and stage 5 would silently
      // DELETE them — "2➕3" became "2 3", spoken "dos tres" (caught by the
      // 2026-07-26 adversarial review).
      .replace(/➕/g, '+')
      .replace(/➖/g, '-')
      .replace(/✖/g, '×')
      .replace(/➗/g, '÷')
      // currency FIRST — "$5" → "5 pesos" (before "+"/"=" touch the digits), and
      // agreeing in number so "$1" reads "1 peso", not "1 pesos" (which the
      // agreement stage would then turn into the ungrammatical "un pesos").
      .replace(/(?:R\$|\$)\s*(\d+(?:[.,]\d+)?)/g, (_m, n: string) =>
        `${n} ${n === '1' ? w.currencySingular : w.currency}`)
      // percent — always unambiguous
      .replace(/\s*%/g, ` ${w.percent}`)
      // explicit multiply / divide glyphs
      .replace(/×/g, ` ${w.times} `)
      .replace(/÷/g, ` ${w.dividedBy} `)
      // "*", "/" and a lowercase "x" only BETWEEN digits ("2x5" is a kid-math
      // product; a bare "x" or "/" elsewhere is markdown, a date or a path).
      .replace(/(\d)\s*\*\s*(\d)/g, `$1 ${w.times} $2`)
      .replace(/(\d)\s*[x×]\s*(\d)/gi, `$1 ${w.times} $2`)
      .replace(/(\d)\s*\/\s*(\d)/g, `$1 ${w.dividedBy} $2`)
      // numeric RANGE vs SUBTRACTION is decided by SPACING, the same convention a
      // human reader uses: "3-5 pesos" (tight) is a range → "3 a 5 pesos", while
      // "8 - 3" (spaced) is arithmetic → "8 menos 3" (handled below). En/em dashes
      // are always ranges, spaced or not.
      .replace(/(\d)-(\d)/g, `$1 ${w.rangeTo} $2`)
      .replace(/(\d)\s*[–—]\s*(\d)/g, `$1 ${w.rangeTo} $2`)
      // addition / equality — "+"/"=" mean add/equals in kid math content
      .replace(/\+/g, ` ${w.plus} `)
      .replace(/=/g, ` ${w.equals} `)
      // minus ONLY when spaced between digits ("5 - 3"); never hyphens/ranges
      .replace(/(\d)\s-\s(\d)/g, `$1 ${w.minus} $2`)
      // arrows read as a natural pause, not "flecha"/"arrow"
      .replace(/\s*(?:→|➡|=>)\s*/g, ', ')
  );
}

/* ------------------------------------------------------------------------- emojis */

/**
 * Lesson text may garnish narration lines with a sparse emoji ("¡Lo lograste!
 * 🎉" — coursegen's gate 7 caps the dosage). The TTS must never see one:
 * qwen3-tts either reads a pictograph aloud ("cara sonriente") or produces a
 * glitch, and both interrupt the narration. Stripped AFTER normalizeSymbols so
 * the arrow-family conversions there (→/➡/=> → a pause comma) keep working —
 * ➡ is itself Extended_Pictographic and would otherwise vanish before that
 * rule saw it. Covers: pictographs, regional-indicator flag pairs, skin-tone
 * modifiers, the ZWJ that welds family/profession sequences, variation
 * selector-16, and the keycap combiner. A unit whose whole text was an emoji
 * normalizes to empty and is dropped by extractNarratables — correct: it
 * should produce no audio.
 */
const EMOJI_PATTERN = /\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}]|\u{FE0F}|\u{200D}|\u{20E3}|\p{Extended_Pictographic}/gu;

function stripEmojis(text: string): string {
  return text.replace(EMOJI_PATTERN, ' ');
}

/* -------------------------------------------------------------- number agreement */

/** Strips accents so lexicon lookups are accent-insensitive ("día" → "dia"). */
function fold(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Is this Spanish/Portuguese noun feminine? Exceptions table first, then suffix
 * rules, then the language default (masculine). Plurals are singularised crudely
 * (drop a trailing "s"/"es") because the gender of the plural equals the gender
 * of the singular.
 *
 * This only has to be right often enough to pick "un" vs "una" for the words a
 * money course for kids actually uses; `auditSpeechText` is the backstop, and a
 * wrong guess degrades to a small grammar slip, never to unintelligible audio.
 */
export function isFeminineNoun(rawWord: string, locale: LessonLocale): boolean {
  if (locale === 'en-US') return false; // English has no grammatical gender
  const exceptions = locale === 'pt-BR' ? PT_GENDER_EXCEPTIONS : ES_GENDER_EXCEPTIONS;
  const word = fold(rawWord.replace(/[^\p{L}]/gu, ''));
  if (word.length === 0) return false;

  const singular = word.replace(/(?:es|s)$/u, '') || word;
  const known = exceptions[word] ?? exceptions[singular];
  if (known) return known === 'f';

  const feminineSuffixes = locale === 'pt-BR'
    ? ['cao', 'sao', 'dade', 'tude', 'agem', 'eza', 'ura', 'ncia', 'ise', 'gem']
    : ['cion', 'sion', 'zon', 'dad', 'tad', 'tud', 'umbre', 'eza', 'ura', 'ncia', 'itis', 'ie'];
  if (feminineSuffixes.some((s) => singular.endsWith(s))) return true;

  const masculineSuffixes = locale === 'pt-BR'
    ? ['or', 'ismo', 'mento', 'ente']
    : ['or', 'aje', 'ismo', 'miento', 'ante', 'ente'];
  if (masculineSuffixes.some((s) => singular.endsWith(s))) return false;

  if (singular.endsWith('a')) return true;   // regular feminine
  if (singular.endsWith('o')) return false;  // regular masculine
  return false;                              // language default: masculine
}

/** "un"/"una" (es) · "um"/"uma" (pt) · digits kept for en-US. */
function indefiniteForm(locale: LessonLocale, feminine: boolean): string {
  if (locale === 'pt-BR') return feminine ? 'uma' : 'um';
  return feminine ? 'una' : 'un';
}

/**
 * Spanish/Portuguese: the bare digit "1" before a noun must be spoken as the
 * apocopated article, never as the counting word "uno"/"um". Numbers ENDING in 1
 * behave the same ("21 vasos" → "veintiún vasos"), so those are spelled out too.
 * Standalone "1" (end of clause, before punctuation) stays a count → left as the
 * digit, which the TTS reads correctly as "uno"/"um".
 *
 * Everything else keeps its digits on purpose: qwen3-tts reads plain numerals
 * naturally, and spelling every number out makes long amounts ("ciento
 * cuarenta y siete pesos") harder for a child to follow than "147 pesos".
 */
const ES_TENS_ONE: Record<number, string> = {
  21: 'veintiún', 31: 'treinta y un', 41: 'cuarenta y un', 51: 'cincuenta y un',
  61: 'sesenta y un', 71: 'setenta y un', 81: 'ochenta y un', 91: 'noventa y un', 101: 'ciento un',
};
const ES_TENS_ONE_F: Record<number, string> = {
  21: 'veintiuna', 31: 'treinta y una', 41: 'cuarenta y una', 51: 'cincuenta y una',
  61: 'sesenta y una', 71: 'setenta y una', 81: 'ochenta y una', 91: 'noventa y una', 101: 'ciento una',
};
const PT_TENS_ONE: Record<number, string> = {
  21: 'vinte e um', 31: 'trinta e um', 41: 'quarenta e um', 51: 'cinquenta e um',
  61: 'sessenta e um', 71: 'setenta e um', 81: 'oitenta e um', 91: 'noventa e um', 101: 'cento e um',
};
const PT_TENS_ONE_F: Record<number, string> = {
  21: 'vinte e uma', 31: 'trinta e uma', 41: 'quarenta e uma', 51: 'cinquenta e uma',
  61: 'sessenta e uma', 71: 'setenta e uma', 81: 'oitenta e uma', 91: 'noventa e uma', 101: 'cento e uma',
};

function applyNumberAgreement(text: string, locale: LessonLocale): string {
  if (locale === 'en-US') return text;
  const tens = locale === 'pt-BR' ? PT_TENS_ONE : ES_TENS_ONE;
  const tensF = locale === 'pt-BR' ? PT_TENS_ONE_F : ES_TENS_ONE_F;

  // A number followed by a word. The word must be a real noun-ish token, so we
  // require letters only, and we skip the case where the "noun" is itself a
  // spoken unit we just produced ("1 kilo") — that is already correct grammar,
  // but "un kilo" is what a human says, so we DO convert it too.
  return text.replace(/\b(\d{1,3})\s+(\p{L}[\p{L}-]*)/gu, (match, digits: string, next: string) => {
    const n = Number(digits);
    const isOne = n === 1;
    const isTensOne = n in tens;
    if (!isOne && !isTensOne) return match;
    // "1 por ciento" / "1 más" — the follower is a symbol word we injected, not a
    // noun; leave the digit alone so the arithmetic still reads as arithmetic.
    if (/^(?:más|mais|menos|por|igual|entre|vezes|plus|minus|times|equals)$/i.test(next)) return match;
    const feminine = isFeminineNoun(next, locale);
    const word = isOne ? indefiniteForm(locale, feminine) : (feminine ? tensF[n] : tens[n]);
    return `${word} ${next}`;
  });
}

/* ------------------------------------------------------------------------ tidying */

/** Collapse doubled spaces the replacements introduce, and tidy space-before-punctuation. */
function tidySpacing(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * The whole transform. Locale drives every table; unknown locales fall back to
 * es-MX (the authoring locale) rather than leaving raw symbols/abbreviations.
 */
export function normalizeForSpeech(text: string, locale: LessonLocale): string {
  const words = SYMBOL_WORDS[locale] ?? SYMBOL_WORDS['es-MX'];
  const effective: LessonLocale = SYMBOL_WORDS[locale] ? locale : 'es-MX';
  let out = stripStageDirections(text);
  out = expandBlanks(out);
  out = expandAbbreviations(out, effective);
  out = expandOrdinals(out, effective);
  out = normalizeSymbols(out, words);
  out = stripEmojis(out); // after symbols: ➡ must reach the arrow→comma rule first
  out = applyNumberAgreement(out, effective);
  return tidySpacing(out);
}
