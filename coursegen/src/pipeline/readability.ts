// Readability gate — grade-appropriate reading level as a MEASURED property,
// not a prompt hope (Learn Your Way treats re-leveling as a first-class,
// numeric pipeline stage; our judge enforces Piaget ceilings qualitatively,
// this adds the deterministic number in front of it, before any paid call).
//
// One formula per locale — never share thresholds across languages:
//   en-US  Flesch-Kincaid GRADE LEVEL (lower = easier, ~US school grade)
//   es-MX  Fernández-Huerta EASE score (higher = easier, 0-100+)
//   pt-BR  Flesch EASE adapted for Portuguese (Martins et al.; higher = easier)
//
// Syllable counting is heuristic (vowel groups with locale diphthong rules;
// English silent-e). That is fine: the formulas were built on exactly this
// kind of approximation, and the gate uses CALIBRATED bands with margin, not
// razor thresholds — see the band table below for the measured corpus facts.

import type { LessonDocumentParsed } from '../contract/schema.js';
import type { GateProblem } from './gates.js';

export type ReadabilityLocale = 'en-US' | 'es-MX' | 'pt-BR';

const VOWELS: Record<ReadabilityLocale, RegExp> = {
  'en-US': /[aeiouy]+/gi,
  'es-MX': /[aeiouáéíóúü]+/gi,
  'pt-BR': /[aeiouáéíóúâêôãõà]+/gi,
};

/** Heuristic syllables for one word (≥1 by definition). */
export function syllableCount(word: string, locale: ReadabilityLocale): number {
  const clean = word.toLowerCase().replace(/[^a-záéíóúüâêôãõàñç]/gi, '');
  if (clean.length === 0) return 0;
  const groups = clean.match(VOWELS[locale]);
  let count = groups ? groups.length : 1;
  // English: silent final e ("make", "store") unless the word ends in -le
  // ("table") or the e IS the only vowel ("the" stays 1 → count floor).
  if (locale === 'en-US' && /e$/.test(clean) && !/le$/.test(clean) && count > 1) count -= 1;
  return Math.max(1, count);
}

interface TextStats {
  words: number;
  sentences: number;
  syllables: number;
}

function textStats(text: string, locale: ReadabilityLocale): TextStats {
  // Markdown residue out first — **bold**, _em_, [links](x) — the learner
  // never reads the syntax.
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>]/g, '')
    .trim();
  const words = plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const sentences = plain.split(/[.!?…]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const syllables = words.reduce((acc, w) => acc + syllableCount(w, locale), 0);
  return { words: words.length, sentences: Math.max(1, sentences.length), syllables };
}

/**
 * The locale's readability number for a text. Meaning DIFFERS by locale:
 * en-US is a GRADE (lower = easier); es-MX / pt-BR are EASE scores
 * (higher = easier). Callers must never compare across locales.
 */
export function readabilityScore(text: string, locale: ReadabilityLocale): number | null {
  const { words, sentences, syllables } = textStats(text, locale);
  // Too little text for the formulas to mean anything — no verdict.
  if (words < 30) return null;
  const asl = words / sentences; // average sentence length
  const asw = syllables / words; // average syllables per word
  switch (locale) {
    case 'en-US':
      return 0.39 * asl + 11.8 * asw - 15.59;
    case 'es-MX':
      // Fernández-Huerta: P = syllables per 100 words, F = sentences per 100 words.
      return 206.84 - 0.6 * (asw * 100) - 1.02 * (100 / asl);
    case 'pt-BR':
      return 248.835 - 1.015 * asl - 84.6 * asw;
  }
}

/**
 * Per-tier bands, CALIBRATED against the live corpus 2026-07-25 (186
 * published documents of the tier2 QA course, all judge-approved):
 *   en-US FK grade   min -0.6 · p50 3.0 · p90 6.1 · max 10.1
 *   es-MX FH ease    min 63.8 · p50 94.6 (higher = easier)
 *   pt-BR PT ease    min 56.9 · p50 99.2
 * The formulas skew "hard" on short gamified text (numerals, proper nouns,
 * question fragments), so the bands are deliberately WIDE: this gate exists
 * to catch OUTLIERS — a lesson that reads like an adult paragraph — before a
 * paid judge call, not to litigate one grade level; nuance stays the judge's
 * job. Every band holds the judged-good corpus with margin (the progression
 * validator's 96 false positives taught us: calibrate against reality, not
 * intuition — a gate that fails approved content is a bug).
 */
const EN_MAX_GRADE: Record<string, number> = { tier1: 9, tier2: 11, tier3: 13 };
const ES_MIN_EASE: Record<string, number> = { tier1: 66, tier2: 60, tier3: 54 };
const PT_MIN_EASE: Record<string, number> = { tier1: 58, tier2: 52, tier3: 46 };

/** Learner-facing prose of a document — the text a kid actually reads. */
export function learnerText(document: LessonDocumentParsed): string {
  const parts: string[] = [];
  for (const segment of document.segments as unknown as Array<Record<string, unknown>>) {
    if (typeof segment.prompt_md === 'string') parts.push(segment.prompt_md);
    if (typeof segment.explanation_md === 'string') parts.push(segment.explanation_md);
    const payload = segment.payload as Record<string, unknown> | undefined;
    if (!payload) continue;
    if (typeof payload.body_md === 'string') parts.push(payload.body_md);
    if (Array.isArray(payload.lines)) {
      for (const line of payload.lines as Array<{ text_md?: unknown }>) {
        if (typeof line.text_md === 'string') parts.push(line.text_md);
      }
    }
    if (Array.isArray(payload.ideas)) {
      for (const idea of payload.ideas as Array<{ text_md?: unknown }>) {
        if (typeof idea.text_md === 'string') parts.push(idea.text_md);
      }
    }
  }
  return parts.join(' ');
}

/**
 * Gate: the document's aggregate learner-facing prose must sit inside the
 * tier's band. Aggregate on purpose — per-segment texts are too short for
 * the formulas, and one long sentence in a story is fine if the whole reads
 * at level. Unknown tiers pass (the catalog schema owns tier vocabulary).
 */
export function runReadabilityGate(document: LessonDocumentParsed, tier: string): GateProblem[] {
  const locale = (document as unknown as { meta: { locale: string } }).meta.locale as ReadabilityLocale;
  if (locale !== 'en-US' && locale !== 'es-MX' && locale !== 'pt-BR') return [];
  const score = readabilityScore(learnerText(document), locale);
  if (score === null) return [];

  if (locale === 'en-US') {
    const max = EN_MAX_GRADE[tier];
    if (max !== undefined && score > max) {
      return [
        {
          gate: 9,
          message: `en-US text measures Flesch-Kincaid grade ${score.toFixed(1)} — above the ${tier} ceiling of ${max}. Shorten sentences and prefer everyday words.`,
        },
      ];
    }
    return [];
  }

  const min = (locale === 'es-MX' ? ES_MIN_EASE : PT_MIN_EASE)[tier];
  if (min !== undefined && score < min) {
    return [
      {
        gate: 9,
        message: `${locale} text measures ease ${score.toFixed(0)} — below the ${tier} floor of ${min} (${locale === 'es-MX' ? 'Fernández-Huerta' : 'Flesch-PT'}). Shorten sentences and prefer everyday words.`,
      },
    ];
  }
  return [];
}
