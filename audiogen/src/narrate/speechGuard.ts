/*
 * speechGuard — the regulator that stands between a narration unit and a paid
 * TTS call. `normalizeForSpeech` EXPANDS what a human would say aloud; this
 * module PROVES nothing unspeakable survived, and refuses the call if something
 * did.
 *
 * WHY IT EXISTS: normalization is a set of pattern rules, and pattern rules have
 * gaps. Before this guard, a gap shipped straight to a child's ears and we only
 * learned about it by listening — "5 pesos c/u" became "cinco pesos CE U", "1
 * vaso" became "UNO vaso". Those are not acceptable failure modes for a product
 * meant to teach a six-year-old, and they must not be discoverable only by a
 * human QA pass over hundreds of audio files.
 *
 * DESIGN — deterministic, not an LLM:
 *   • It runs on EVERY unit of EVERY lesson (a 1000-lesson course is ~15k units),
 *     so it has to be free and instant. An LLM regulator at that volume would
 *     cost more than the TTS it guards and would itself be nondeterministic.
 *   • Each rule encodes a class of defect we have actually heard, with the
 *     locale-correct expansion the normalizer should have produced. When a rule
 *     fires, that is a BUG IN NORMALIZATION with a known fix — not a judgement
 *     call needing a model.
 *   • `severity: 'block'` means "do not synthesize this": the unit is reported as
 *     a failure so the batch summary shows it, and no money is spent narrating
 *     text we already know reads badly. `severity: 'warn'` is for things that are
 *     suspicious but legitimately occur in prose.
 *
 * The guard is the safety net, not the strategy: every `block` that fires in
 * practice should be fixed by extending `speechLexicon.ts` / `normalizeForSpeech`
 * so the text is spoken correctly, rather than by relaxing the rule.
 */

import type { LessonLocale } from '../types/lessonDocument.js';

export type SpeechIssueSeverity = 'block' | 'warn';

export interface SpeechIssue {
  /** Stable machine code, for aggregation across a mass run. */
  code: string;
  severity: SpeechIssueSeverity;
  /** The offending fragment, for a log a human can act on. */
  excerpt: string;
  /** What the normalizer should have produced instead. */
  hint: string;
}

interface Rule {
  code: string;
  severity: SpeechIssueSeverity;
  /** Locales the rule applies to; omit for all. */
  locales?: LessonLocale[];
  pattern: RegExp;
  hint: string;
}

const RULES: Rule[] = [
  {
    // The original reported defect: "c/u" read out as letters.
    code: 'slash-abbreviation',
    severity: 'block',
    pattern: /\b[\p{L}]{1,3}\/[\p{L}]{1,3}\b/u,
    hint: 'A slash abbreviation (like "c/u") is read letter by letter. Add it to ABBREVIATIONS in speechLexicon.ts so it expands ("cada uno").',
  },
  {
    code: 'residual-currency-symbol',
    severity: 'block',
    pattern: /[$€£]/,
    hint: 'A currency symbol reached the TTS. normalizeSymbols must turn "$5" into "5 pesos"/"5 dollars"/"5 reais".',
  },
  {
    code: 'residual-math-symbol',
    severity: 'block',
    pattern: /[+=%×÷]/,
    hint: 'A math symbol reached the TTS, which reads it inconsistently (often in English). It must be spelled out per locale.',
  },
  {
    code: 'digit-glued-to-word',
    severity: 'block',
    pattern: /\d(?=[\p{L}]{2,})/u,
    hint: 'A number is glued to a word ("5pesos"), which the TTS runs together. Insert a space, or expand the unit.',
  },
  {
    code: 'unexpanded-unit',
    severity: 'block',
    // A number followed by a short unit token — after normalization these should
    // all be words. Word-boundary + explicit list keeps prose ("5 minutos") safe.
    pattern: /\d\s*(?:kg|ml|cm|mm|lt|hrs?|min|seg|oz|lbs?)\b/i,
    hint: 'A unit abbreviation survived after a number. Add it to the unit() list in speechLexicon.ts so it is spoken in full.',
  },
  {
    code: 'unexpanded-ordinal',
    severity: 'block',
    locales: ['es-MX', 'pt-BR'],
    pattern: /\b\d{1,2}(?:er|ro|do|to|mo|vo|º|ª)(?![\p{L}\d])/iu,
    hint: 'An ordinal digit form survived ("1er"). It must be spoken as a word with the right apocope ("primer día").',
  },
  {
    code: 'unexpanded-ordinal',
    severity: 'block',
    locales: ['en-US'],
    pattern: /\b\d{1,2}(?:st|nd|rd|th)\b/i,
    hint: 'An ordinal digit form survived ("1st"). It must be spoken as a word ("first").',
  },
  {
    // es/pt only: a bare "1" before a NOUN must have become "un"/"una"/"um"/"uma".
    // The negative lookahead mirrors the SKIP list in applyNumberAgreement: when
    // the follower is a symbol word we injected ("1 más 2", "1 por ciento") the
    // digit is arithmetic, not a count, and must stay a digit. Without this the
    // rule false-positives on real content — measured on the live corpus, where
    // "(1 más 2)" was refused before this exclusion existed.
    code: 'number-agreement-missing',
    severity: 'block',
    locales: ['es-MX', 'pt-BR'],
    pattern: /(?<![\d.,])\b(?:1|[2-9]1|[1-9]01)\s+(?!(?:más|mais|menos|por|igual|entre|vezes|mil|millones|milhões)\b)[\p{L}]{3,}/iu,
    hint: 'A number ending in 1 sits before a noun; the TTS says the counting word ("uno vaso"). applyNumberAgreement must turn it into the article ("un vaso").',
  },
  {
    code: 'markdown-residue',
    severity: 'block',
    pattern: /\*\*|__|`|\]\(|^#{1,6}\s|~~/m,
    hint: 'Markdown syntax reached the TTS and is read aloud as punctuation. stripMarkdown must remove it.',
  },
  {
    // Lesson text may carry sparse decorative emojis; stripEmojis (stage 5 of
    // normalizeForSpeech) must have removed every one before synthesis — a
    // pictograph is read aloud ("cara sonriente") or glitches the audio.
    code: 'residual-emoji',
    severity: 'block',
    pattern: /\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}]|\p{Extended_Pictographic}/u,
    hint: 'An emoji reached the TTS. stripEmojis in normalizeForSpeech must remove it before synthesis.',
  },
  {
    code: 'url-or-email',
    severity: 'block',
    pattern: /https?:\/\/|\bwww\.|[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/u,
    hint: 'A URL or email would be read character by character. It does not belong in narrated text.',
  },
  {
    code: 'letter-by-letter-acronym',
    severity: 'warn',
    /*
     * An all-caps token is only unspeakable when it has NO VOWEL — "QA", "XP",
     * "SMS" cannot be pronounced as a word, so any TTS spells them out. All-caps
     * tokens that DO have a vowel are emphasis of a real word ("la limonada NO le
     * parece cara", "CRECE cada día", "does NOT need", "NÃO precisa") and are read
     * correctly, so flagging them is pure noise.
     *
     * Measured on the live 693-unit corpus: a length-based rule warned 16 times
     * and then 5 times, every single hit being legitimate emphasis. The
     * vowel test drops all of them while still catching real acronyms.
     *
     * Note the `u` flag and \p{L} lookarounds: plain \b is ASCII-only, so it
     * treats "Ã" as a non-word character and split "NÃO" into a spurious "ÃO".
     */
    pattern: /(?<!\p{L})(?!XP(?!\p{L}))[BCDFGHJKLMNPQRSTVWXYZ]{2,}(?!\p{L})/u,
    hint: 'An all-caps token with no vowel is spelled out letter by letter by the TTS. Write it as a word if it should be spoken.',
  },
  {
    code: 'stray-stage-direction',
    severity: 'warn',
    pattern: /\((?:[^()]*\b(?:sonr|smil|laugh|susurr|whisper|riendo|pausa|sigh)[^()]*)\)/i,
    hint: 'An acting cue survived inside parentheses; it makes narration sound clipped. Emotion belongs in the narrator.emotion field.',
  },
  {
    code: 'repeated-punctuation',
    severity: 'warn',
    pattern: /([!?])\1{1,}|\.{4,}/,
    hint: 'Repeated punctuation produces odd prosody. One mark is enough; "..." is fine, "...." is not.',
  },
];

/**
 * Audits FINAL speech text (post-normalizeForSpeech). Returns every issue found;
 * an empty array means the text is safe to synthesize.
 */
export function auditSpeechText(text: string, locale: LessonLocale): SpeechIssue[] {
  const issues: SpeechIssue[] = [];
  for (const rule of RULES) {
    if (rule.locales && !rule.locales.includes(locale)) continue;
    const match = rule.pattern.exec(text);
    if (!match) continue;
    issues.push({
      code: rule.code,
      severity: rule.severity,
      excerpt: match[0].slice(0, 40),
      hint: rule.hint,
    });
  }
  return issues;
}

/** True when the text must NOT be sent to a paid TTS call. */
export function isBlocked(issues: readonly SpeechIssue[]): boolean {
  return issues.some((i) => i.severity === 'block');
}

/** One-line, log-ready summary of why a unit was refused. */
export function describeIssues(issues: readonly SpeechIssue[]): string {
  return issues.map((i) => `${i.severity}:${i.code}("${i.excerpt}")`).join(', ');
}
