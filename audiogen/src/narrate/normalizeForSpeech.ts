/*
 * normalizeForSpeech — the last text transform before a narration unit is sent
 * to qwen3-tts. Runs AFTER stripMarkdown. Two jobs, both forced on us by what
 * the DashScope Qwen3-TTS API does NOT do (verified against the official Model
 * Studio docs, 2026-07):
 *
 *  1. Symbols → locale words. qwen3-tts does not localize or even reliably
 *     read math/currency symbols ("+", "=", "%", "×", "÷", "$") — a Spanish
 *     lesson would hear "5 plus 5" (English) or a literal "plus sign". The API
 *     has no symbol-handling spec and no SSML, so we spell them out per locale
 *     BEFORE synthesis. "5+5" → "5 más 5" (es-MX) / "5 plus 5" (en-US) /
 *     "5 mais 5" (pt-BR).
 *
 *  2. Drop stage-direction parentheticals. Acting/emotion cues embedded in
 *     spoken text — "(con entusiasmo)", "(smiles)" — make narration feel
 *     "cortada" when read aloud. We drop a parenthetical ONLY when its whole
 *     content is such a cue (curated stems, no digits inside), so meaningful
 *     asides like "(5 pesos)" or "(limones, vasos)" are always kept. Emotion
 *     belongs in the structured `emotion`/`action` fields, never in the text —
 *     a coursegen author rule enforces that going forward; this is the safety
 *     net for content that slips through.
 *
 * Pacing/emotion are intentionally NOT handled here: qwen3-tts-flash exposes no
 * speed/rate/pitch parameter and no per-call emotion field (emotion comes from
 * VOICE selection — a casting decision in env, not code). Punctuation is the
 * only prosody lever the model documents, so we preserve it carefully.
 */

import type { LessonLocale } from '../types/lessonDocument.js';

interface SymbolWords {
  plus: string;
  minus: string;
  equals: string;
  percent: string;
  times: string;
  dividedBy: string;
  /** Bare "$N" reads as a plain amount in the locale's everyday currency. */
  currency: string;
}

const SYMBOL_WORDS: Record<LessonLocale, SymbolWords> = {
  'es-MX': { plus: 'más', minus: 'menos', equals: 'igual a', percent: 'por ciento', times: 'por', dividedBy: 'entre', currency: 'pesos' },
  'en-US': { plus: 'plus', minus: 'minus', equals: 'equals', percent: 'percent', times: 'times', dividedBy: 'divided by', currency: 'dollars' },
  'pt-BR': { plus: 'mais', minus: 'menos', equals: 'igual a', percent: 'por cento', times: 'vezes', dividedBy: 'dividido por', currency: 'reais' },
};

/**
 * Stage-direction stems, all three locales in one list (content is single-
 * locale per document, and these stems don't collide across languages in
 * practice). A parenthetical is dropped only when its trimmed, lowercased,
 * digit-free content STARTS WITH one of these — deliberately narrow to avoid
 * eating real asides.
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

function normalizeSymbols(text: string, w: SymbolWords): string {
  return (
    text
      // currency FIRST — "$5" → "5 pesos" (before "+"/"=" touch the digits)
      .replace(/(?:R\$|\$)\s*(\d+(?:[.,]\d+)?)/g, `$1 ${w.currency}`)
      // percent — always unambiguous
      .replace(/\s*%/g, ` ${w.percent}`)
      // explicit multiply / divide glyphs
      .replace(/×/g, ` ${w.times} `)
      .replace(/÷/g, ` ${w.dividedBy} `)
      // "*" and "/" only BETWEEN digits (avoid stray markdown / dates / paths)
      .replace(/(\d)\s*\*\s*(\d)/g, `$1 ${w.times} $2`)
      .replace(/(\d)\s*\/\s*(\d)/g, `$1 ${w.dividedBy} $2`)
      // addition / equality — "+"/"=" mean add/equals in kid math content
      .replace(/\+/g, ` ${w.plus} `)
      .replace(/=/g, ` ${w.equals} `)
      // minus ONLY when spaced between digits ("5 - 3"); never hyphens/ranges
      .replace(/(\d)\s-\s(\d)/g, `$1 ${w.minus} $2`)
      // arrows read as a natural pause, not "flecha"/"arrow"
      .replace(/\s*(?:→|➡|=>)\s*/g, ', ')
  );
}

/** Collapse the doubled spaces the symbol replacements introduce, and tidy space-before-punctuation. */
function tidySpacing(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * The whole transform. Locale drives symbol wording; unknown locales fall back
 * to es-MX (the authoring locale) rather than leaving raw symbols.
 */
export function normalizeForSpeech(text: string, locale: LessonLocale): string {
  const words = SYMBOL_WORDS[locale] ?? SYMBOL_WORDS['es-MX'];
  const stripped = stripStageDirections(text);
  const normalized = normalizeSymbols(stripped, words);
  return tidySpacing(normalized);
}
