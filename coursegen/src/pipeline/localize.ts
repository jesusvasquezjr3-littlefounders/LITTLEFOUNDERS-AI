// localize stage — es-MX → {en-US, pt-BR} (COURSE_ENGINE.md §4). Structure
// is FROZEN programmatically: only learner-visible strings are extracted
// into an indexed map, DeepSeek translates just the map, and the result is
// re-injected at the exact same paths — ids/numbers/answers are never seen
// by the model, so they cannot drift. Re-gates vocabulary for the TARGET
// locale afterwards (forbidden-word lists are per-locale).

import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
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
  const system =
    `You translate financial-literacy content from Mexican Spanish (es-MX) into ${localeName} for LittleFounders. ${audienceLine} ` +
    'Preserve MarkdownLite markup exactly (**bold**, *italic*, `code`, "- " lists, line breaks) and any {{n}} gap markers verbatim. ' +
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

  const { data: translatedMap } = await withCorrectiveRetry<Record<string, string>>({
    maxAttempts: MAX_TRANSLATE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = buildTranslateMessages(indexMap, targetLocale, issues, deps.registerToneEs);
      const result = await translate(
        { messages, temperature: 0.3, jsonMode: true },
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
      const expectedKeys = Object.keys(indexMap);
      const missing = expectedKeys.filter((k) => !(k in record));
      if (missing.length > 0) return { ok: false, issues: `missing keys: ${missing.slice(0, 10).join(', ')}` };
      const nonString = expectedKeys.filter((k) => typeof record[k] !== 'string');
      if (nonString.length > 0) return { ok: false, issues: `non-string values at keys: ${nonString.slice(0, 10).join(', ')}` };
      const out: Record<string, string> = {};
      for (const k of expectedKeys) out[k] = record[k] as string;
      return { ok: true, data: out };
    },
  });

  extracted.forEach((entry, i) => {
    setAtPath(cloned, entry.path, translatedMap[String(i)] ?? entry.value);
  });
  (cloned as { meta: { locale: string } }).meta.locale = targetLocale;

  const parsed = lessonDocumentSchema.safeParse(cloned);
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
