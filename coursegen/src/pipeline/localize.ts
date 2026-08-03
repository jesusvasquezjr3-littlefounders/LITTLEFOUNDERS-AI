// localize stage — es-MX → {en-US, pt-BR} (COURSE_ENGINE.md §4). Structure
// is FROZEN programmatically: only learner-visible strings are extracted
// into an indexed map, DeepSeek translates just the map, and the result is
// re-injected at the exact same paths — ids/numbers/answers are never seen
// by the model, so they cannot drift. Re-gates vocabulary for the TARGET
// locale afterwards (forbidden-word lists are per-locale).

import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { getConfig } from '../env.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import type { LessonLocale } from '../contract/core/types.js';
import { runVocabularyGate, NON_VISIBLE_KEYS, type GateProblem, type GateContext } from './gates.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues } from './correctiveRetry.js';

type PathSegment = string | number;

interface ExtractedString {
  path: PathSegment[];
  value: string;
}

function extractStrings(node: unknown, path: PathSegment[], out: ExtractedString[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    out.push({ path: [...path], value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => extractStrings(item, [...path, i], out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'answer') continue; // server-only, frozen
      if (NON_VISIBLE_KEYS.has(key)) continue;
      extractStrings(value, [...path, key], out);
    }
  }
}

function setAtPath(root: unknown, path: readonly PathSegment[], value: string): void {
  if (path.length === 0) return;
  let cursor = root as Record<PathSegment, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    cursor = cursor[path[i]!] as Record<PathSegment, unknown>;
  }
  cursor[path[path.length - 1]!] = value;
}

function pathsEqual(a: readonly PathSegment[], b: readonly PropertyKey[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg === b[i]);
}

// ISO currency enum (money schemas) mapped to the target locale's play currency.
const ISO_CURRENCY = new Set(['MXN', 'USD', 'BRL']);
const LOCALE_CURRENCY: Record<'en-US' | 'pt-BR', { code: string; word: string }> = {
  'en-US': { code: 'USD', word: 'dollars' },
  'pt-BR': { code: 'BRL', word: 'reais' },
};

/**
 * Currency lives in fields that the string-freeze SKIPS (the `currency`/`unit`
 * enums are in NON_VISIBLE_KEYS, so they were copied verbatim → an en-US
 * make_change segment stayed `currency: "MXN"` and formatted as pesos). Remap
 * every currency code to the target locale's, and swap a free-word `unit`
 * ("pesos") to the locale word. Amounts are play money — numbers are untouched.
 */
function remapCurrency(node: unknown, target: 'en-US' | 'pt-BR'): void {
  const c = LOCALE_CURRENCY[target];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n && typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if ((key === 'currency' || key === 'unit') && typeof value === 'string' && ISO_CURRENCY.has(value)) {
          obj[key] = c.code;
        } else if (key === 'unit' && typeof value === 'string' && /^pesos?$/i.test(value.trim())) {
          obj[key] = c.word;
        } else {
          walk(value);
        }
      }
    }
  };
  walk(node);
}

export class LocalizeVocabError extends Error {
  readonly locale: LessonLocale;
  readonly problems: GateProblem[];

  constructor(locale: LessonLocale, problems: GateProblem[]) {
    super(`localize: ${locale} re-gate found ${problems.length} forbidden-vocabulary hit(s) after translation`);
    this.name = 'LocalizeVocabError';
    this.locale = locale;
    this.problems = problems;
  }
}

const MAX_TRANSLATE_ATTEMPTS = 3;
/*
 * A complete lesson can expose well over a hundred learner-facing strings.
 * Asking a reasoning model to reproduce the whole map in one JSON response
 * made otherwise valid translations run into the completion ceiling; a retry
 * then repeated the same oversized request and could strand an approved
 * document at the `reviewed` checkpoint. Keep each response small enough to
 * be auditable and resumable. This is input-character budget, rather than a
 * token estimate, because it is deterministic and preserves each string as a
 * single atomic value.
 */
const MAX_TRANSLATE_BATCH_CHARS = 6_000;

function splitTranslationBatches(indexMap: Record<string, string>): Array<Record<string, string>> {
  const batches: Array<Record<string, string>> = [];
  let batch: Record<string, string> = {};
  let batchChars = 2; // `{}`

  for (const [key, value] of Object.entries(indexMap)) {
    const entryChars = JSON.stringify({ [key]: value }).length;
    if (Object.keys(batch).length > 0 && batchChars + entryChars > MAX_TRANSLATE_BATCH_CHARS) {
      batches.push(batch);
      batch = {};
      batchChars = 2;
    }
    batch[key] = value;
    batchChars += entryChars;
  }
  if (Object.keys(batch).length > 0) batches.push(batch);
  return batches;
}

function buildTranslateMessages(
  indexMap: Record<string, string>,
  targetLocale: LessonLocale,
  issues: string | undefined,
  toneDirectiveEs?: string,
) {
  const localeName = targetLocale === 'en-US' ? 'English (US)' : 'Brazilian Portuguese (pt-BR)';
  const audienceLine = toneDirectiveEs
    ? `This content targets ADULT learners, not children — preserve that register when translating. Source-language (es-MX) tone directive: ${toneDirectiveEs}`
    : "Keep the warm, encouraging, age-appropriate register (this is children's content).";
  const currencyLine =
    targetLocale === 'en-US'
      ? 'CURRENCY: this is play money for kids — convert Mexican pesos to US DOLLARS. Replace "peso/pesos" with "dollar/dollars"; keep the "$" symbol and every NUMBER exactly the same (do NOT apply exchange rates — 20 pesos becomes 20 dollars).'
      : 'CURRENCY: this is play money for kids — convert Mexican pesos to Brazilian REAIS. Replace "peso/pesos" with "real/reais" and the "$" symbol with "R$"; keep every NUMBER exactly the same (do NOT apply exchange rates — 20 pesos becomes 20 reais).';
  const colloquialLine =
    targetLocale === 'en-US'
      ? 'COLLOQUIAL TOUCHES: the source may carry an occasional light Mexican colloquialism ("¡órale!", "¡qué padre!", "¡ándale!"). NEVER translate these literally — render each as a natural, G-rated, everyday American English equivalent of the same weight ("awesome!", "no way!", "come on!", "sweet!"), and keep the dosage identical: if a sentence is neutral in the source, keep it neutral — never ADD slang the source does not have. Nothing rude, nothing with a double meaning.'
      : 'COLLOQUIAL TOUCHES: the source may carry an occasional light Mexican colloquialism ("¡órale!", "¡qué padre!", "¡ándale!"). NEVER translate these literally — render each as a natural, G-rated, everyday Brazilian Portuguese equivalent of the same weight ("que legal!", "demais!", "beleza!", "caramba!"), and keep the dosage identical: if a sentence is neutral in the source, keep it neutral — never ADD slang the source does not have. Nothing rude, nothing with a double meaning.';
  const system =
    `You translate financial-literacy content from Mexican Spanish (es-MX) into ${localeName} for LittleFounders. ${audienceLine} ` +
    'Preserve MarkdownLite markup exactly (**bold**, *italic*, `code`, "- " lists, line breaks) and any {{n}} gap markers verbatim. ' +
    'Preserve any EMOJI exactly as-is (same emoji, same position in the sentence) — never drop, add, or swap them. ' +
    'LENGTH: on-screen instructions are hard-capped — a translation must NEVER be meaningfully LONGER than its source string; when your language runs long, compress (drop filler words, use the shorter synonym) rather than exceed the source length. ' +
    `${currencyLine} ${colloquialLine} ` +
    'Output ONLY a strict flat JSON object mapping each input key to its translation — same keys, translated values, nothing else.';
  const user = [
    'Translate every value in this JSON object. Return an object with EXACTLY the same keys.',
    JSON.stringify(indexMap),
  ].join('\n');

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
  if (issues) {
    messages.push({
      role: 'user' as const,
      content: `Your previous reply was invalid. Fix and resend: ${issues}`,
    });
  }
  return messages;
}

/**
 * Feedback for re-injection fixups (localizeLesson) — one entry per
 * translated string whose re-injected value broke the document schema (the
 * "LENGTH" instruction in buildTranslateMessages is a soft ask; this is the
 * hard corrective loop for when the model exceeds it anyway).
 */
const MAX_REINJECT_ATTEMPTS = 3;

function buildShortenMessages(
  sourceMap: Record<string, string>,
  feedback: ReadonlyMap<number, string>,
  targetLocale: LessonLocale,
  toneDirectiveEs?: string,
) {
  const localeName = targetLocale === 'en-US' ? 'English (US)' : 'Brazilian Portuguese (pt-BR)';
  const audienceLine = toneDirectiveEs
    ? `This content targets ADULT learners, not children — preserve that register. Source-language (es-MX) tone directive: ${toneDirectiveEs}`
    : "Keep the warm, encouraging, age-appropriate register (this is children's content).";
  const feedbackLines = Object.keys(sourceMap).map((key) => `key "${key}": previous translation ${feedback.get(Number(key)) ?? 'failed validation'}`);
  const system = [
    `You translate financial-literacy content from Mexican Spanish (es-MX) into ${localeName} for LittleFounders. ${audienceLine}`,
    `Your PREVIOUS translation of these ${Object.keys(sourceMap).length} string(s) failed validation:`,
    feedbackLines.join('\n'),
    'Translate them again, SHORTER this time — drop filler words, use the most compact natural phrasing — while preserving the meaning and every {{n}} gap marker. Every output value MUST fit the stated limit.',
    'Output ONLY a strict flat JSON object mapping each input key to its shorter translation — same keys, nothing else.',
  ].join('\n');
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: JSON.stringify(sourceMap) },
  ];
}

export interface LocalizeResult {
  document: LessonDocumentParsed;
  targetLocale: LessonLocale;
}

export interface LocalizeDeps {
  ledger?: UsageLedger;
  translate?: typeof completeDeepSeek;
  /** COURSE_ENGINE.md §3.3 — injected into the translation prompt for the adult register. Absent = kid (no change). */
  registerToneEs?: string;
  /** COURSE_ENGINE.md §3.3 — adult register skips the forbidden-vocabulary re-gate (piaget gates are kid-only). */
  skipVocabularyGate?: boolean;
}

export async function localizeLesson(
  sourceDocument: LessonDocumentParsed,
  targetLocale: 'en-US' | 'pt-BR',
  gateCtx: GateContext,
  deps: LocalizeDeps = {},
): Promise<LocalizeResult> {
  const translate = deps.translate ?? completeDeepSeek;

  const cloned = structuredClone(sourceDocument) as unknown;
  const extracted: ExtractedString[] = [];
  extractStrings(cloned, [], extracted);

  const indexMap: Record<string, string> = {};
  extracted.forEach((entry, i) => {
    indexMap[String(i)] = entry.value;
  });

  const translatedMap: Record<string, string> = {};
  for (const batch of splitTranslationBatches(indexMap)) {
    const { data } = await withCorrectiveRetry<Record<string, string>>({
      maxAttempts: MAX_TRANSLATE_ATTEMPTS,
      callModel: async (issues) => {
        const messages = buildTranslateMessages(batch, targetLocale, issues, deps.registerToneEs);
        const result = await translate(
          { messages, temperature: 0.3, jsonMode: true, maxTokens: getConfig().FORGE_DOCUMENT_MAX_TOKENS },
          { operation: 'localize', ledger: deps.ledger },
        );
        return result.content;
      },
      parse: (raw) => {
        const json = safeJsonParse(raw);
        if (!json.ok) return { ok: false, issues: `invalid JSON: ${json.error}` };
        if (typeof json.value !== 'object' || json.value === null || Array.isArray(json.value)) {
          return { ok: false, issues: 'expected a flat JSON object of key→translated string' };
        }
        const record = json.value as Record<string, unknown>;
        const expectedKeys = Object.keys(batch);
        const missing = expectedKeys.filter((k) => !(k in record));
        if (missing.length > 0) return { ok: false, issues: `missing keys: ${missing.slice(0, 10).join(', ')}` };
        const nonString = expectedKeys.filter((k) => typeof record[k] !== 'string');
        if (nonString.length > 0) return { ok: false, issues: `non-string values at keys: ${nonString.slice(0, 10).join(', ')}` };
        const out: Record<string, string> = {};
        for (const k of expectedKeys) out[k] = record[k] as string;
        return { ok: true, data: out };
      },
    });
    Object.assign(translatedMap, data);
  }

  extracted.forEach((entry, i) => {
    setAtPath(cloned, entry.path, translatedMap[String(i)] ?? entry.value);
  });
  remapCurrency(cloned, targetLocale);
  (cloned as { meta: { locale: string } }).meta.locale = targetLocale;

  let parsed = lessonDocumentSchema.safeParse(cloned);
  /*
   * Re-injection can break the document schema even when the translation
   * response itself was valid JSON (the corrective loop above only checks
   * "same keys, string values") — the LENGTH instruction in
   * buildTranslateMessages is a soft ask, and the model routinely runs long
   * anyway (production: "options.1.label: Too big: expected string to have
   * <=60 characters"). Before this fix, ANY such overflow threw immediately
   * and cost the WHOLE lesson a from-scratch regen (replan + rewrite +
   * rejudge) over a single translated string — the mildest possible mistake
   * treated as the most expensive possible failure. Fix ONLY the strings
   * that actually broke, by index, same corrective-feedback shape as write.ts.
   */
  for (let attempt = 1; !parsed.success && attempt <= MAX_REINJECT_ATTEMPTS; attempt++) {
    const feedback = new Map<number, string>();
    for (const issue of parsed.error.issues) {
      const index = extracted.findIndex((e) => pathsEqual(e.path, issue.path));
      if (index === -1) continue; // a path we never translated is a different bug — surface it below, not here.
      const current = translatedMap[String(index)] ?? '';
      const detail =
        issue.code === 'too_big' && 'maximum' in issue && typeof issue.maximum === 'number'
          ? `is too long: ${current.length} characters, must be at most ${issue.maximum}`
          : issue.message;
      feedback.set(index, detail);
    }
    if (feedback.size === 0) break; // nothing here a re-translate can fix.

    const sourceMap: Record<string, string> = {};
    for (const index of feedback.keys()) sourceMap[String(index)] = extracted[index]!.value;
    const messages = buildShortenMessages(sourceMap, feedback, targetLocale, deps.registerToneEs);
    const result = await translate(
      { messages, temperature: 0.3, jsonMode: true, maxTokens: getConfig().FORGE_DOCUMENT_MAX_TOKENS },
      { operation: 'localize', ledger: deps.ledger },
    );
    const json = safeJsonParse(result.content);
    if (json.ok && typeof json.value === 'object' && json.value !== null && !Array.isArray(json.value)) {
      const record = json.value as Record<string, unknown>;
      for (const index of feedback.keys()) {
        const value = record[String(index)];
        if (typeof value === 'string') {
          translatedMap[String(index)] = value;
          setAtPath(cloned, extracted[index]!.path, value);
        }
      }
    }
    remapCurrency(cloned, targetLocale);
    parsed = lessonDocumentSchema.safeParse(cloned);
  }

  if (!parsed.success) {
    /*
     * Last resort: any field STILL failing after the corrective retries falls
     * back to its ORIGINAL es-MX source string — guaranteed to satisfy the
     * schema (it already did, in the source language). One field shipping
     * untranslated is a far smaller defect than losing the whole lesson to a
     * paid from-scratch regen over a length overflow.
     */
    for (const issue of parsed.error.issues) {
      const index = extracted.findIndex((e) => pathsEqual(e.path, issue.path));
      if (index === -1) continue;
      setAtPath(cloned, extracted[index]!.path, extracted[index]!.value);
    }
    remapCurrency(cloned, targetLocale);
    parsed = lessonDocumentSchema.safeParse(cloned);
  }

  if (!parsed.success) {
    throw new Error(`localize: re-injected ${targetLocale} document failed contract validation: ${formatZodIssues(parsed.error.issues)}`);
  }

  if (!deps.skipVocabularyGate) {
    const vocabProblems = runVocabularyGate(parsed.data, gateCtx.taxonomy, gateCtx.tier);
    if (vocabProblems.length > 0) {
      throw new LocalizeVocabError(targetLocale, vocabProblems);
    }
  }

  return { document: parsed.data, targetLocale };
}

export interface TranslateTitleDeps {
  ledger?: UsageLedger;
  translate?: typeof completeDeepSeek;
}

/**
 * Short-string translator for topic titles. Adventures/sagas are authored
 * trilingual by hand in the curriculum YAML (`title: {en-US, es-MX, pt-BR}`);
 * topics are authored es-MX-only (`title_es`) — hand-translating every topic
 * title across thousands of blueprints doesn't scale, so this fills in
 * en-US/pt-BR at publish time instead. Without it, `title_es` was copied
 * verbatim into all 3 locale slots and topic pills never changed language.
 */
/*
 * Memoized per (title, locale) for the life of the process.
 *
 * run.ts calls this per SLOT, not per topic, and a topic holds ~4 lessons — so the
 * same title was re-translated once per lesson (≈2000 calls for a 1000-slot run
 * instead of ≈250). Worse than the waste: each call is nondeterministic, so sibling
 * workers wrote DIFFERENT translations into the same shared `topics` row and the
 * title drifted depending on which worker finished last. Caching fixes the cost, the
 * drift and the concurrency race at once. In-memory is the right scope: a resumed
 * invocation re-translates, which is correct — it may be running new code.
 */
const titleCache = new Map<string, Promise<string>>();

export async function translateTitle(
  titleEs: string,
  targetLocale: 'en-US' | 'pt-BR',
  deps: TranslateTitleDeps = {},
): Promise<string> {
  // Tests inject their own `translate`, so they must not share the cache.
  if (!deps.translate) {
    const key = `${targetLocale}::${titleEs}`;
    const hit = titleCache.get(key);
    if (hit) return hit;
    const pending = translateTitleUncached(titleEs, targetLocale, deps);
    titleCache.set(key, pending);
    // A failure must not be cached — the slot retry has to be able to try again.
    pending.catch(() => titleCache.delete(key));
    return pending;
  }
  return translateTitleUncached(titleEs, targetLocale, deps);
}

async function translateTitleUncached(
  titleEs: string,
  targetLocale: 'en-US' | 'pt-BR',
  deps: TranslateTitleDeps = {},
): Promise<string> {
  const translate = deps.translate ?? completeDeepSeek;
  const localeName = targetLocale === 'en-US' ? 'English (US)' : 'Brazilian Portuguese (pt-BR)';
  const messages = [
    {
      role: 'system' as const,
      content:
        `Translate this short lesson-topic title from Mexican Spanish (es-MX) into ${localeName}, ` +
        "for a children's financial-literacy app. Keep it short and warm — a section heading, not a sentence. " +
        'Output ONLY the translated title: no quotes, no explanation, nothing else.',
    },
    { role: 'user' as const, content: titleEs },
  ];
  const result = await translate(
    /*
     * 1500, not 60. DEEPSEEK_MODEL is a REASONING model, so the completion budget is
     * spent thinking before any content appears: measured on this exact prompt,
     * translating a three-word title consumed 477 reasoning tokens, and budgets of 60
     * AND 300 both returned an EMPTY string with finish_reason 'length'. That empty
     * string is what shipped nine of ten topics with blank en-US/pt-BR names. The
     * headroom above the measured cost absorbs the natural variance in reasoning
     * length; openAiCompatibleComplete now also refuses a starved completion outright.
     */
    { messages, temperature: 0.3, maxTokens: 1500 },
    { operation: 'localize', ledger: deps.ledger },
  );
  /*
   * VALIDATE — never trust this straight into the database.
   *
   * `openAiCompatibleComplete` coerces a missing or blank completion to '' and
   * returns it as SUCCESS (tokens still billed), and this function had no
   * corrective retry, no schema and no emptiness check — so an empty reply was
   * trimmed and upserted into `topics.title`, leaving a BLANK topic pill in that
   * locale forever, with nothing logged and the lesson still counted as published.
   *
   * Not hypothetical: measured on the live course, 9 of 10 topics were blank in BOTH
   * en-US and pt-BR. Throwing hands the failure to the slot's normal retry path,
   * which is exactly where a transient provider hiccup belongs.
   */
  const title = result.content.trim().replace(/^["']|["']$/g, '');
  if (title.length === 0) {
    throw new Error(
      `translateTitle(${targetLocale}) returned an EMPTY title for "${titleEs}" — refusing to publish a blank topic title`,
    );
  }
  return title;
}
