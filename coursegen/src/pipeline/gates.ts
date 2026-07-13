// The 5 deterministic gates — COURSE_ENGINE.md §4 "gate" stage. Free, no
// network calls, run in order. Gate 1 (contract) gates the rest: if the raw
// JSON doesn't parse against the Zod contract there is no typed document to
// run gates 2-5 against.

import type { TaxonomyFile, FactsFile } from '../catalog/schema.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import type { LessonLocale } from '../contract/core/types.js';
import {
  toCents,
  reachableWithRepetition,
  existsSubsetSumOnce,
  evaluateInfixTokens,
  extractFirstNumber,
  approxEqual,
} from './arithmetic.js';

export type GateNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface GateProblem {
  gate: GateNumber;
  segmentId?: string;
  message: string;
}

export interface GateReport {
  ok: boolean;
  problems: GateProblem[];
  document?: LessonDocumentParsed;
}

// ---- Gate 1: contract Zod parse ---------------------------------------------

export function runContractGate(rawDocument: unknown): { ok: boolean; problems: GateProblem[]; document?: LessonDocumentParsed } {
  const parsed = lessonDocumentSchema.safeParse(rawDocument);
  if (parsed.success) return { ok: true, problems: [], document: parsed.data };
  const problems: GateProblem[] = parsed.error.issues.map((issue) => ({
    gate: 1,
    message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  }));
  return { ok: false, problems };
}

// ---- Gate 2: forbidden vocabulary (Piaget gate, HARD FAIL) ------------------

const COMBINING_DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeText(s: string): string {
  return s.normalize('NFD').replace(COMBINING_DIACRITICS_RE, '').toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildForbiddenRegex(word: string): RegExp {
  const normalized = normalizeText(word);
  const pattern = escapeRegExp(normalized).replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, 'i');
}

/**
 * Object keys that hold structural/enum/id/unit data, never free learner
 * prose — skipped by the vocabulary + canon walkers here AND reused by
 * localize.ts's string-freeze extractor (same reasoning: these must never
 * be rewritten by a translation pass either — `unit` is sometimes literally
 * a currency enum value, e.g. piggy_split's `unit: currencySchema`).
 */
export const NON_VISIBLE_KEYS = new Set([
  'id',
  'type',
  'cast',
  'character',
  'emotion',
  'action',
  'backdrop',
  'tint',
  'currency',
  'unit',
  'kind',
  'instrument',
  'dir',
  'locale',
  'subject',
  'slug',
  'audio_segment_id',
  'image_url',
  'icon',
  'ask_icon',
  'artifact_kind',
  'next',
  'start_node',
  'schema_version',
]);

interface VisitedString {
  path: string;
  value: string;
}

function collectLearnerVisibleStrings(node: unknown, pathStr: string, out: VisitedString[]): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    out.push({ path: pathStr, value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectLearnerVisibleStrings(item, `${pathStr}[${i}]`, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'answer') continue; // server-only, never shipped to a client
      if (NON_VISIBLE_KEYS.has(key)) continue;
      collectLearnerVisibleStrings(value, pathStr ? `${pathStr}.${key}` : key, out);
    }
  }
}

export function runVocabularyGate(document: LessonDocumentParsed, taxonomy: TaxonomyFile, tier: string): GateProblem[] {
  const tierEntry = taxonomy.age_tiers[tier];
  if (!tierEntry) {
    return [{ gate: 2, message: `unknown age tier "${tier}" — cannot resolve forbidden_vocabulary` }];
  }
  const words = tierEntry.forbidden_vocabulary[document.meta.locale] ?? [];
  if (words.length === 0) return [];

  const regexes = words.map((word) => ({ word, re: buildForbiddenRegex(word) }));
  const strings: VisitedString[] = [];
  collectLearnerVisibleStrings(document, '', strings);

  const problems: GateProblem[] = [];
  for (const { path, value } of strings) {
    const normalized = normalizeText(value);
    for (const { word, re } of regexes) {
      if (re.test(normalized)) {
        problems.push({
          gate: 2,
          message: `forbidden word "${word}" (tier ${tier}, ${document.meta.locale}) at ${path}: "${value.slice(0, 80)}"`,
        });
      }
    }
  }
  return problems;
}

// ---- Gate 3: fact gate (denominations must come from facts.yaml) -----------

export function runFactGate(document: LessonDocumentParsed, facts: FactsFile): GateProblem[] {
  const denominationsByCurrency = new Map<string, Set<number>>();
  for (const [id, entry] of Object.entries(facts.facts)) {
    if (!id.includes('denominations') || !entry.unit) continue;
    const values = Array.isArray(entry.value) ? entry.value : [entry.value];
    const set = denominationsByCurrency.get(entry.unit) ?? new Set<number>();
    for (const v of values) if (typeof v === 'number') set.add(v);
    denominationsByCurrency.set(entry.unit, set);
  }

  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'coin_count' && segment.type !== 'make_change') continue;
    const payload = segment.payload as { currency: string; denominations: number[] };
    const known = denominationsByCurrency.get(payload.currency);
    if (!known) {
      problems.push({ gate: 3, segmentId: segment.id, message: `no facts.yaml denominations known for currency "${payload.currency}"` });
      continue;
    }
    for (const d of payload.denominations) {
      if (!known.has(d)) {
        problems.push({
          gate: 3,
          segmentId: segment.id,
          message: `denomination ${d} ${payload.currency} is not a recognized facts.yaml denomination`,
        });
      }
    }
  }
  return problems;
}

// ---- Gate 4: arithmetic re-execution ----------------------------------------

function fillBlankGaps(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'fill_blank') continue;
    const payload = segment.payload as { text_md: string };
    const answer = segment.answer as { gaps: { gap: number }[] } | undefined;
    if (!answer) continue;
    const declared = new Set(
      Array.from(payload.text_md.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1])),
    );
    const inAnswer = new Set(answer.gaps.map((g) => g.gap));
    for (const n of declared) {
      if (!inAnswer.has(n)) problems.push({ gate: 4, segmentId: segment.id, message: `{{${n}}} marker has no matching answer.gaps entry` });
    }
    for (const n of inAnswer) {
      if (!declared.has(n)) problems.push({ gate: 4, segmentId: segment.id, message: `answer.gaps has gap ${n} with no {{${n}}} marker in text_md` });
    }
  }
  return problems;
}

function coinCountAndMakeChange(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type === 'coin_count') {
      const payload = segment.payload as { denominations: number[]; target: number };
      const reachable = reachableWithRepetition(toCents(payload.target), payload.denominations.map(toCents));
      if (reachable === 'too-large') {
        problems.push({ gate: 4, segmentId: segment.id, message: `coin_count target ${payload.target} exceeds the arithmetic gate's verifiable range` });
      } else if (!reachable) {
        problems.push({ gate: 4, segmentId: segment.id, message: `coin_count target ${payload.target} is not reachable from denominations [${payload.denominations.join(', ')}]` });
      }
    }
    if (segment.type === 'make_change') {
      const payload = segment.payload as { denominations: number[]; price: number; paid_with: number };
      const changeDue = payload.paid_with - payload.price;
      if (changeDue < 0) {
        problems.push({ gate: 4, segmentId: segment.id, message: `make_change: paid_with (${payload.paid_with}) is less than price (${payload.price})` });
        continue;
      }
      const reachable = reachableWithRepetition(toCents(changeDue), payload.denominations.map(toCents));
      if (reachable === 'too-large') {
        problems.push({ gate: 4, segmentId: segment.id, message: `make_change amount ${changeDue} exceeds the arithmetic gate's verifiable range` });
      } else if (!reachable) {
        problems.push({ gate: 4, segmentId: segment.id, message: `make_change amount ${changeDue} is not reachable from denominations [${payload.denominations.join(', ')}]` });
      }
    }
  }
  return problems;
}

function savingsGoal(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'savings_goal') continue;
    const payload = segment.payload as { goal: number };
    const answer = segment.answer as { correct?: Record<string, number> } | undefined;
    if (!answer?.correct) continue;
    for (const [weeklyStr, weeks] of Object.entries(answer.correct)) {
      const weekly = Number(weeklyStr);
      if (!Number.isFinite(weekly) || weekly <= 0) {
        problems.push({ gate: 4, segmentId: segment.id, message: `savings_goal.answer.correct has non-numeric/non-positive weekly key "${weeklyStr}"` });
        continue;
      }
      const expected = Math.ceil(payload.goal / weekly);
      if (expected !== weeks) {
        problems.push({
          gate: 4,
          segmentId: segment.id,
          message: `savings_goal weekly=${weekly}: expected weeks=ceil(${payload.goal}/${weekly})=${expected}, got ${weeks}`,
        });
      }
    }
  }
  return problems;
}

function balanceScale(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'balance_scale') continue;
    const payload = segment.payload as { left_fixed: { value: number }[]; weights: { value: number }[] };
    const leftSum = payload.left_fixed.reduce((sum, f) => sum + f.value, 0);
    if (!existsSubsetSumOnce(leftSum, payload.weights.map((w) => w.value))) {
      problems.push({ gate: 4, segmentId: segment.id, message: `balance_scale: no subset of weights sums to left_fixed total ${leftSum}` });
    }
  }
  return problems;
}

function equationBuilder(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'equation_builder') continue;
    const payload = segment.payload as { tokens: { id: string; text: string }[]; target_result: number; slots: number };
    const answer = segment.answer as { accepted: string[] } | undefined;
    if (!answer) continue;
    const tokenById = new Map(payload.tokens.map((t) => [t.id, t.text]));

    let anyValid = false;
    for (const sequence of answer.accepted) {
      const ids = sequence.trim().split(/\s+/);
      const texts = ids.map((id) => tokenById.get(id));
      if (texts.some((t) => t === undefined)) {
        problems.push({ gate: 4, segmentId: segment.id, message: `equation_builder accepted sequence "${sequence}" references an unknown token id` });
        continue;
      }
      const value = evaluateInfixTokens(texts as string[]);
      if (value !== null && approxEqual(value, payload.target_result, 1e-6)) {
        anyValid = true;
      }
    }
    if (!anyValid) {
      problems.push({
        gate: 4,
        segmentId: segment.id,
        message: `equation_builder: no accepted sequence evaluates to target_result ${payload.target_result}`,
      });
    }
  }
  return problems;
}

function interestPeek(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'interest_peek') continue;
    const payload = segment.payload as {
      principal: number;
      rate_pct: number;
      periods: number;
      prediction: { kind: 'choice'; options: { id: string; text_md: string }[] } | { kind: 'slider'; min: number; max: number };
    };
    const answer = segment.answer as { correct_option_id?: string; value?: number; tolerance?: number } | undefined;
    if (!answer) continue;
    const computed = payload.principal * (1 + payload.rate_pct / 100) ** payload.periods;

    if (payload.prediction.kind === 'slider') {
      if (answer.value === undefined) continue;
      const tolerance = answer.tolerance ?? 0;
      if (Math.abs(answer.value - computed) > tolerance + 1e-6) {
        problems.push({
          gate: 4,
          segmentId: segment.id,
          message: `interest_peek: answer.value ${answer.value} is outside tolerance of computed compound value ${computed.toFixed(2)}`,
        });
      }
    } else {
      if (!answer.correct_option_id) continue;
      const option = payload.prediction.options.find((o) => o.id === answer.correct_option_id);
      if (!option) {
        problems.push({ gate: 4, segmentId: segment.id, message: `interest_peek: correct_option_id does not match any prediction option` });
        continue;
      }
      const parsed = extractFirstNumber(option.text_md);
      if (parsed !== null) {
        const tolerance = Math.max(1, computed * 0.05);
        if (Math.abs(parsed - computed) > tolerance) {
          problems.push({
            gate: 4,
            segmentId: segment.id,
            message: `interest_peek: correct option value ~${parsed} is far from computed compound value ${computed.toFixed(2)}`,
          });
        }
      }
    }
  }
  return problems;
}

export function runArithmeticGate(document: LessonDocumentParsed): GateProblem[] {
  return [
    ...coinCountAndMakeChange(document),
    ...savingsGoal(document),
    ...balanceScale(document),
    ...equationBuilder(document),
    ...interestPeek(document),
    ...fillBlankGaps(document),
  ];
}

// ---- Gate 5: rationale + character canon gates -------------------------------

interface OptionWithRationale {
  id: string;
  rationale_md?: string;
}

function rationaleGate(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type === 'quiz_mcq' || segment.type === 'confidence_quiz') {
      const payload = segment.payload as { options: OptionWithRationale[] };
      const answer = segment.answer as { correct_option_id?: string } | undefined;
      for (const option of payload.options) {
        if (option.id !== answer?.correct_option_id && !option.rationale_md) {
          problems.push({ gate: 5, segmentId: segment.id, message: `wrong option "${option.id}" is missing rationale_md (P7)` });
        }
      }
    }
    if (segment.type === 'picture_choice') {
      const payload = segment.payload as { options: OptionWithRationale[] };
      const answer = segment.answer as { correct_option_id?: string } | undefined;
      for (const option of payload.options) {
        if (option.id !== answer?.correct_option_id && !option.rationale_md) {
          problems.push({ gate: 5, segmentId: segment.id, message: `wrong picture option "${option.id}" is missing rationale_md (P7)` });
        }
      }
    }
  }
  return problems;
}

const CANON_CHARACTERS = new Set(['dina', 'liruf', 'rho', 'zara']);

function collectCharacterRefs(node: unknown, out: Set<string>): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectCharacterRefs(item, out));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'answer') continue;
      if (key === 'character' && typeof value === 'string') out.add(value);
      else collectCharacterRefs(value, out);
    }
  }
}

function canonGate(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  const cast = new Set(document.meta.cast);
  for (const segment of document.segments) {
    const refs = new Set<string>();
    collectCharacterRefs(segment, refs);
    for (const character of refs) {
      if (!CANON_CHARACTERS.has(character)) {
        problems.push({ gate: 5, segmentId: segment.id, message: `character "${character}" is outside the closed canon {dina,liruf,rho,zara}` });
      } else if (!cast.has(character as (typeof document.meta.cast)[number])) {
        problems.push({ gate: 5, segmentId: segment.id, message: `character "${character}" is used but not declared in meta.cast` });
      }
    }
  }
  return problems;
}

export function runRationaleAndCanonGate(document: LessonDocumentParsed): GateProblem[] {
  return [...rationaleGate(document), ...canonGate(document)];
}

// ---- Gate 6: anti-genericity (deterministic, COURSE_ENGINE.md §4 gate 6) ---
//
// Cheap garbage never reaches the (paid) judge — a two-phase pattern shared
// with gates 2-5. Three independent detectors, all deterministic:
//  (a) prompt_md that's basically just the lesson/topic title restated.
//  (b) explanation_md that's too short, or has no grounding (no digit, no
//      canon character, no string traceable back to this segment's payload).
//  (c) a small curated per-locale filler-phrase list.

const NEAR_DUPLICATE_MAX_RATIO = 0.2;
const MIN_EXPLANATION_MD_LENGTH = 40;

/** Classic DP edit distance — strings here are short (titles/prompts), no need for a library. */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[n]!;
}

/** Normalized edit distance <= 20% of the longer (normalized) string's length. */
function isNearDuplicateText(a: string, b: string): boolean {
  const na = normalizeText(a).trim();
  const nb = normalizeText(b).trim();
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return false;
  return levenshteinDistance(na, nb) / maxLen <= NEAR_DUPLICATE_MAX_RATIO;
}

function genericityTitleEcho(document: LessonDocumentParsed, topicTitle: string | undefined): GateProblem[] {
  const problems: GateProblem[] = [];
  const titles = [document.meta.title, topicTitle].filter((t): t is string => Boolean(t));
  for (const segment of document.segments) {
    const promptMd = (segment as { prompt_md: string }).prompt_md;
    for (const title of titles) {
      if (isNearDuplicateText(promptMd, title)) {
        problems.push({
          gate: 6,
          segmentId: segment.id,
          message: `prompt_md is a near-duplicate of the title "${title}" (restates instead of teaching)`,
        });
        break;
      }
    }
  }
  return problems;
}

function hasCharacterNameMention(text: string): boolean {
  const normalized = normalizeText(text);
  return Array.from(CANON_CHARACTERS).some((name) => buildForbiddenRegex(name).test(normalized));
}

/** Short (>=4 char) word-tokens drawn from every learner-visible payload string — a cheap proxy for "named entity". */
function payloadEntityTokens(payload: unknown): string[] {
  const strings: VisitedString[] = [];
  collectLearnerVisibleStrings(payload, '', strings);
  const tokens = new Set<string>();
  for (const { value } of strings) {
    for (const word of normalizeText(value).split(/[^a-z0-9]+/)) {
      if (word.length >= 4) tokens.add(word);
    }
  }
  return Array.from(tokens);
}

function referencesPayloadEntity(normalizedExplanation: string, payload: unknown): boolean {
  return payloadEntityTokens(payload).some((token) => normalizedExplanation.includes(token));
}

function genericityExplanation(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const explanation = (segment as { explanation_md?: string }).explanation_md;
    if (!explanation) continue; // explanation_md is optional — only checked when present
    const trimmed = explanation.trim();
    if (trimmed.length < MIN_EXPLANATION_MD_LENGTH) {
      problems.push({
        gate: 6,
        segmentId: segment.id,
        message: `explanation_md is too short (${trimmed.length} chars, minimum ${MIN_EXPLANATION_MD_LENGTH}) — too generic to teach anything`,
      });
      continue;
    }
    const hasDigit = /\d/.test(trimmed);
    const hasCharacter = hasCharacterNameMention(trimmed);
    const hasEntity = referencesPayloadEntity(normalizeText(trimmed), (segment as { payload: unknown }).payload);
    if (!hasDigit && !hasCharacter && !hasEntity) {
      problems.push({
        gate: 6,
        segmentId: segment.id,
        message: 'explanation_md has no digit, no canon character name, and no string traceable to this segment\'s payload — too generic',
      });
    }
  }
  return problems;
}

/** Small curated per-locale filler lists — deliberately short; expand only with real judge-flagged offenders. */
const BANNED_FILLER_BY_LOCALE: Record<LessonLocale, string[]> = {
  'es-MX': ['es muy importante', 'como ya sabemos', 'en este ejercicio aprenderas'],
  'en-US': ['this is very important', 'as we already know', 'in this exercise you will learn'],
  'pt-BR': ['isso e muito importante', 'como ja sabemos', 'neste exercicio voce vai aprender'],
};

function genericityFiller(document: LessonDocumentParsed): GateProblem[] {
  const fillers = BANNED_FILLER_BY_LOCALE[document.meta.locale] ?? [];
  if (fillers.length === 0) return [];
  const normalizedFillers = fillers.map((f) => normalizeText(f));

  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const fields: { field: string; value: string | undefined }[] = [
      { field: 'prompt_md', value: (segment as { prompt_md: string }).prompt_md },
      { field: 'explanation_md', value: (segment as { explanation_md?: string }).explanation_md },
    ];
    for (const { field, value } of fields) {
      if (!value) continue;
      const normalized = normalizeText(value);
      normalizedFillers.forEach((filler, i) => {
        if (normalized.includes(filler)) {
          problems.push({ gate: 6, segmentId: segment.id, message: `${field} contains banned filler phrase "${fillers[i]}"` });
        }
      });
    }
  }
  return problems;
}

export function runAntiGenericityGate(document: LessonDocumentParsed, opts: { topicTitle?: string } = {}): GateProblem[] {
  return [
    ...genericityTitleEcho(document, opts.topicTitle),
    ...genericityExplanation(document),
    ...genericityFiller(document),
  ];
}

// ---- Orchestration -----------------------------------------------------------

export interface GateContext {
  taxonomy: TaxonomyFile;
  tier: string;
  facts: FactsFile;
  /** Powers gate 6a's near-duplicate check against the topic title (document.meta.title is always checked regardless). */
  topicTitle?: string;
  /** COURSE_ENGINE.md §3.3 — adult register skips gate 2 (the Piaget vocabulary gate is a kid-only invariant). */
  skipVocabularyGate?: boolean;
}

export function runAllGates(rawDocument: unknown, ctx: GateContext): GateReport {
  const gate1 = runContractGate(rawDocument);
  if (!gate1.ok || !gate1.document) {
    return { ok: false, problems: gate1.problems };
  }
  const document = gate1.document;
  const problems: GateProblem[] = [
    ...(ctx.skipVocabularyGate ? [] : runVocabularyGate(document, ctx.taxonomy, ctx.tier)),
    ...runFactGate(document, ctx.facts),
    ...runArithmeticGate(document),
    ...runRationaleAndCanonGate(document),
    ...runAntiGenericityGate(document, { topicTitle: ctx.topicTitle }),
  ];
  return { ok: problems.length === 0, problems, document };
}
