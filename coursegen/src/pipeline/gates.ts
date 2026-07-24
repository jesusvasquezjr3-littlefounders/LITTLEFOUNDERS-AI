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
import { runGenerationQualityGate } from './generationQuality.js';
import { CONTENT_TYPES } from '../contract/registry.js';

export type GateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
  // Two-sided / prefixed image URLs (memory_flip card faces, count_objects ask
  // target). Like image_url these are generated Depot URLs — never translate
  // them; localize copies them verbatim so one image serves all 3 locales.
  'a_image_url',
  'b_image_url',
  'ask_image_url',
  'icon',
  'ask_icon',
  'artifact_kind',
  'next',
  'start_node',
  'schema_version',
  // Enum payload/answer vocab missed by the original list — discovered when
  // localize.ts translated fill_blank's `mode: "typed"` into pt-BR prose and
  // broke contract validation (first real QA run, 2026-07-13). The
  // enum-coverage test in gates.test.ts now derives this requirement from
  // the schemas themselves, so a new enum key can't silently slip through.
  'mode',
  'commands',
  'scale',
  'verdict',
  'zones',
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

// ---- Gate 8: clarity / visual-first (deterministic) -------------------------
//
// The QA synthesis (2026-07-23) found the generated course was pedagogically
// planned but IMPLEMENTED wrong for young children: 56/70 exercise prompts were
// text walls (backstory + recap + threat + the instruction buried last),
// non-graded "content" segments posed fake gradeable questions, and prompts
// leaked the keyed answer. These are the deterministic, low-false-positive
// slices of S2/S4/S5 — the nuanced halves (key-derivation, positive framing)
// live in the judge playbook. Story/backstory belongs in narration, not the
// on-screen prompt, so the caps below are TIGHT on purpose.

/** Hard ceiling — the prompt is the on-screen instruction, not the story.
 *  Aim (playbook) is <=140; the gate fails only egregious walls to leave the
 *  author a little slack while still forcing story out of the prompt. */
const MAX_PROMPT_CHARS = 160;
const MAX_PROMPT_SENTENCES = 3;
/** Below this length a correct-option string is too short to be a reliable leak signal. */
const MIN_LEAK_MATCH_LEN = 14;

/** Terminal-punctuation sentence count (handles Spanish ¿¡ by counting closers). */
function sentenceCount(s: string): number {
  const matches = s.match(/[.!?]+/g);
  return matches ? matches.length : s.trim() ? 1 : 0;
}

/** Answer-congratulation phrases a NON-graded segment must not use (it praises an
 *  answer the child never gave). Per-locale, deliberately short. */
const PRAISE_PHRASES_BY_LOCALE: Record<LessonLocale, string[]> = {
  'es-MX': ['exacto', 'correcto', 'muy bien', 'bien hecho', 'asi es', 'excelente'],
  'en-US': ['exactly', 'correct', 'well done', 'great job', 'that is right', "that's right"],
  'pt-BR': ['exato', 'correto', 'muito bem', 'bom trabalho', 'isso mesmo', 'excelente'],
};

/** The plain text of the correct option/item for the choice-style types, when it
 *  is a distinctive string (used for the leak check). Returns null otherwise. */
function correctOptionText(segment: { type: string; answer?: unknown; payload: unknown }): string | null {
  const answer = segment.answer as Record<string, unknown> | undefined;
  const payload = segment.payload as Record<string, unknown>;
  if (!answer) return null;
  const findText = (arr: unknown, id: unknown, key = 'text_md'): string | null => {
    if (!Array.isArray(arr) || typeof id !== 'string') return null;
    const hit = arr.find((o) => (o as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
    const v = hit?.[key] ?? hit?.label;
    return typeof v === 'string' ? v : null;
  };
  switch (segment.type) {
    case 'quiz_mcq':
    case 'confidence_quiz':
      return findText(payload.options, answer.correct_option_id);
    case 'picture_choice':
      return findText(payload.options, answer.correct_option_id, 'label');
    case 'odd_one_out':
      return findText(payload.items, answer.odd_item_id);
    default:
      return null;
  }
}

function clarityTextDensity(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const prompt = (segment as { prompt_md: string }).prompt_md ?? '';
    if (prompt.length > MAX_PROMPT_CHARS) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `prompt_md is ${prompt.length} chars (max ${MAX_PROMPT_CHARS}) — a text wall for young kids; move story/backstory into narration and keep the prompt to the instruction`,
      });
    }
    if (sentenceCount(prompt) > MAX_PROMPT_SENTENCES) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `prompt_md has ${sentenceCount(prompt)} sentences (max ${MAX_PROMPT_SENTENCES}) — one situation line + one instruction/question is enough`,
      });
    }
  }
  return problems;
}

function clarityFakeQuestion(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  const praise = new Set(PRAISE_PHRASES_BY_LOCALE[document.meta.locale] ?? []);
  for (const segment of document.segments) {
    if (!CONTENT_TYPES.includes(segment.type)) continue; // non-graded types only
    const prompt = ((segment as { prompt_md: string }).prompt_md ?? '').trim();
    // A non-graded segment has no input — ending on a direct question reads as a
    // gradeable question the child then can't answer.
    if (prompt.endsWith('?')) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `non-graded ${segment.type} ends prompt_md with a direct question but takes no answer — rephrase as a statement or make it a graded type`,
      });
    }
    const explanation = normalizeText((segment as { explanation_md?: string }).explanation_md ?? '');
    for (const phrase of praise) {
      if (explanation.includes(normalizeText(phrase))) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `non-graded ${segment.type} explanation congratulates ("${phrase}") an answer the child never gave — keep it outcome-neutral`,
        });
        break;
      }
    }
  }
  return problems;
}

function clarityAnswerLeak(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const answerText = correctOptionText(segment as never);
    if (!answerText) continue;
    const normAnswer = normalizeText(answerText).trim();
    if (normAnswer.length < MIN_LEAK_MATCH_LEN) continue; // too short to be a reliable signal
    const prompt = normalizeText((segment as { prompt_md: string }).prompt_md ?? '');
    const hints = ((segment as { hints?: string[] }).hints ?? []).map((h) => normalizeText(h));
    if (prompt.includes(normAnswer)) {
      problems.push({ gate: 8, segmentId: segment.id, message: `prompt_md contains the correct answer verbatim ("${answerText}") — the exercise is given away` });
    } else if (hints.some((h) => h.includes(normAnswer))) {
      problems.push({ gate: 8, segmentId: segment.id, message: `a hint contains the correct answer verbatim ("${answerText}") — hints scaffold, never reveal` });
    }
  }
  return problems;
}

/**
 * ANSWERABLE-FROM-SCREEN (the 2026-07-24 re-review's dominant new blocker):
 * pushing story out of terse prompts made the author demote LOAD-BEARING facts
 * (a price the answer depends on) into a HINT — "cada vaso cuesta 5 pesos"
 * appears only in hints[0], so a child who never opens hints cannot solve. A
 * price stated in a hint whose number is absent from the prompt AND the visible
 * payload is a hidden required fact: flag it. Numbers already on screen (a hint
 * merely restating them) are fine — that's real scaffolding.
 */
const PRICE_IN_HINT_RE = /(?:cuesta|vale|precio|paga(?:r|n)?|cada\s+\w+\s+(?:es|son)?)\D{0,12}?(\d+)|(\d+)\s*pesos?/gi;

function clarityHintHiddenFact(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    // A load-bearing fact hidden in a hint OR in explanation_md (shown only
    // AFTER answering) is off-screen — both make the exercise unsolvable.
    const hints = [...((segment as { hints?: string[] }).hints ?? [])];
    const expl = (segment as { explanation_md?: string }).explanation_md;
    const offScreen = expl ? [...hints, expl] : hints;
    if (offScreen.length === 0) continue;
    // Numbers the child actually SEES as facts: those written into the on-screen
    // instruction (prompt_md) plus STRUCTURAL numeric values the engine renders
    // (item.price, target, goal, paid_with…). A number embedded in an option/
    // token/case STRING is a distractor or an answer choice, NOT a shown fact —
    // counting it (the old bug) let "cada vaso cuesta 5" hide in a hint while a
    // distractor token "5" masked it. So numeric payload VALUES count; strings don't.
    const onScreen = new Set<string>();
    for (const m of ((segment as { prompt_md: string }).prompt_md ?? '').matchAll(/\d+/g)) onScreen.add(m[0]);
    const walkNums = (n: unknown): void => {
      if (typeof n === 'number') onScreen.add(String(Math.trunc(Math.abs(n))));
      else if (Array.isArray(n)) n.forEach(walkNums);
      else if (n && typeof n === 'object') Object.values(n).forEach(walkNums);
    };
    walkNums((segment as { payload: unknown }).payload);

    for (const text of offScreen) {
      let flagged = false;
      for (const m of text.matchAll(PRICE_IN_HINT_RE)) {
        const num = m[1] ?? m[2];
        if (num && !onScreen.has(num)) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `a required fact ("${m[0].trim()}") whose number ${num} is visible ONLY in a hint/explanation, not in the prompt or payload — the child cannot solve from the screen; move that price/quantity into prompt_md or the payload`,
          });
          flagged = true;
          break;
        }
      }
      if (flagged) break; // one finding per segment is enough
    }
  }
  return problems;
}

/**
 * pattern_complete render truth (the 2026-07-24 screenshot): the engine draws
 * `missing_slots` EMPTY slots AFTER the visible `sequence` and only ever shows
 * each tile's ICON + TINT. Two ways the author breaks it: (a) keying the answer
 * by a sequence index ("5") instead of a slot index ("0"), so nothing grades;
 * (b) an invisible pattern (all tiles the SAME icon+tint, the real pattern
 * being an unrenderable size/price ladder). Both fail here.
 */
function clarityPatternComplete(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'pattern_complete') continue;
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const answer = (segment as { answer?: { correct?: Record<string, string> } }).answer;
    const missing = typeof payload.missing_slots === 'number' ? payload.missing_slots : 0;
    const options = Array.isArray(payload.options) ? (payload.options as Array<{ id?: string }>) : [];
    const optIds = new Set(options.map((o) => o.id));
    const correct = answer?.correct ?? {};
    const keys = Object.keys(correct);
    const expected = Array.from({ length: missing }, (_, i) => String(i));
    if (keys.length !== missing || !expected.every((k) => k in correct)) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `pattern_complete answer.correct keys must be exactly the slot indexes ${JSON.stringify(expected)} (0-based), got ${JSON.stringify(keys)} — a sequence index like "5" grades nothing`,
      });
    }
    for (const id of Object.values(correct)) {
      if (!optIds.has(id)) problems.push({ gate: 8, segmentId: segment.id, message: `pattern_complete answer value "${id}" is not an option id` });
    }
    // Visible pattern: the sequence must vary by icon OR tint (a constant
    // icon+tint sequence carries no visible pattern — it was a size/price ladder).
    const seq = Array.isArray(payload.sequence) ? (payload.sequence as Array<{ icon?: string; tint?: string }>) : [];
    const tileKey = (t: { icon?: string; tint?: string } | undefined) => `${t?.icon}|${t?.tint}`;
    const distinct = new Set(seq.map(tileKey));
    if (seq.length >= 3 && distinct.size < 2) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: 'pattern_complete sequence tiles are all identical (same icon AND tint) — the pattern is invisible; vary the icon or tint so the child can SEE and continue it (never a size/price ladder)',
      });
      continue;
    }
    // The ANSWER must actually CONTINUE the visible pattern. Find the smallest
    // period P that the sequence repeats on; the tile filling slot k sits at
    // position (seq.length + k) and must match seq[(seq.length + k) mod P]. If
    // no clean period exists the pattern is ambiguous (a child can't infer it).
    if (seq.length >= 3 && distinct.size >= 2) {
      const period = (() => {
        // Smallest p in [1, len-1] on which the sequence repeats. A period-3
        // pattern shown as [A,B,C,A,B] (5 tiles, one full + partial repeat) is
        // inferable, so the bound is len-1, not len/2.
        for (let p = 1; p <= seq.length - 1; p++) {
          let ok = true;
          for (let i = p; i < seq.length; i++) if (tileKey(seq[i]) !== tileKey(seq[i - p])) { ok = false; break; }
          if (ok) return p;
        }
        return 0; // not cleanly periodic
      })();
      const optById = new Map(options.map((o) => [o.id, o as { icon?: string; tint?: string }]));
      if (period === 0) {
        problems.push({ gate: 8, segmentId: segment.id, message: 'pattern_complete sequence has no clear repeating period — the pattern is ambiguous; use an obvious repeat like A,B,A,B or A,B,C,A,B,C' });
      } else {
        for (let k = 0; k < missing; k++) {
          const expected = seq[(seq.length + k) % period];
          const chosen = optById.get(correct[String(k)] ?? '');
          if (expected && chosen && tileKey(expected) !== tileKey(chosen)) {
            problems.push({
              gate: 8,
              segmentId: segment.id,
              message: `pattern_complete answer for slot ${k} (option "${correct[String(k)]}", ${tileKey(chosen)}) does NOT continue the visible pattern — the pattern of period ${period} needs ${tileKey(expected)} there`,
            });
          }
        }
      }
    }
  }
  return problems;
}

/**
 * robot_path SOLVABILITY (the 2026-07-24 re-review found an unsolvable maze):
 * the puzzle's own `commands` (its intended solution) must actually walk the
 * cart from `start` to `goal` without leaving the grid or crossing a wall.
 * Grid is screen coords: (0,0) top-left, y grows DOWN; dirs up/right/down/left.
 */
const ROBOT_CW = ['up', 'right', 'down', 'left'] as const;
const ROBOT_STEP: Record<string, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

function robotPathSolvable(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'robot_path') continue;
    const p = (segment as { payload: Record<string, unknown> }).payload as {
      grid?: { w: number; h: number };
      start?: { x: number; y: number; dir: string };
      goal?: { x: number; y: number };
      walls?: { x: number; y: number }[];
      commands?: string[];
    };
    if (!p.grid || !p.start || !p.goal || !Array.isArray(p.commands)) continue;
    const wall = new Set((p.walls ?? []).map((w) => `${w.x},${w.y}`));
    let x = p.start.x, y = p.start.y;
    let dirIdx = ROBOT_CW.indexOf(p.start.dir as (typeof ROBOT_CW)[number]);
    if (dirIdx < 0) dirIdx = 0;
    // Mirror the frontend grader exactly: a forward into a wall/border makes the
    // cart STAY in place (a blocked step, not an error); turns always rotate.
    for (const cmd of p.commands) {
      if (cmd === 'left') dirIdx = (dirIdx + 3) % 4;
      else if (cmd === 'right') dirIdx = (dirIdx + 1) % 4;
      else if (cmd === 'forward') {
        const [dx, dy] = ROBOT_STEP[ROBOT_CW[dirIdx]!]!;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < p.grid.w && ny < p.grid.h && !wall.has(`${nx},${ny}`)) { x = nx; y = ny; }
      }
    }
    if (x !== p.goal.x || y !== p.goal.y) {
      problems.push({ gate: 8, segmentId: segment.id, message: `robot_path: the payload commands end at (${x},${y}) but the goal is (${p.goal.x},${p.goal.y}) — the intended solution does not reach the goal, so the puzzle is unsolvable as authored` });
    }
  }
  return problems;
}

/** build_sentence must build a SENTENCE, not be an arithmetic quiz in disguise
 *  (2026-07-24: tokens ["5","10","15","20"], slots 2, answer "10 5" — nonsense).
 *  If every token is a bare number/operator the child has no sentence to build;
 *  it should be a number_input/quiz. */
function clarityBuildSentence(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'build_sentence') continue;
    const tokens = ((segment as { payload: { tokens?: { text_md?: string }[] } }).payload.tokens ?? []);
    if (tokens.length === 0) continue;
    const isWordless = (s: string) => !/[a-záéíóúñ]{2,}/i.test(s); // no real word
    if (tokens.every((t) => typeof t.text_md === 'string' && isWordless(t.text_md))) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: 'build_sentence has only number/symbol tokens (no words) — there is no sentence to build; use number_input or quiz_mcq for an arithmetic answer, or add real word tokens ("Dos vasos cuestan ___ pesos")',
      });
    }
  }
  return problems;
}

/** compare_table cells that bind two IDENTICAL-text tokens to different cells
 *  render as indistinguishable chips → a child can swap them and fail at random. */
function clarityCompareTable(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'compare_table') continue;
    const payload = (segment as { payload: { tokens?: { id?: string; text_md?: string }[] } }).payload;
    const answer = (segment as { answer?: { cells?: Record<string, string> } }).answer;
    const cells = answer?.cells ?? {};
    const usedIds = new Set(Object.values(cells));
    const textById = new Map((payload.tokens ?? []).map((t) => [t.id, (t.text_md ?? '').trim().toLowerCase()]));
    const usedText = new Map<string, string>(); // normalized text -> first id
    for (const id of usedIds) {
      const txt = textById.get(id);
      if (!txt) continue;
      const prev = usedText.get(txt);
      if (prev && prev !== id) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `compare_table binds two tokens with IDENTICAL text ("${txt}") to different cells — they render indistinguishable and can be swapped for a random fail; use one shared token or make the values distinct`,
        });
        break;
      }
      usedText.set(txt, id);
    }
  }
  return problems;
}

export function runClarityGate(document: LessonDocumentParsed): GateProblem[] {
  return [
    ...clarityTextDensity(document),
    ...clarityFakeQuestion(document),
    ...clarityAnswerLeak(document),
    ...clarityHintHiddenFact(document),
    ...clarityPatternComplete(document),
    ...robotPathSolvable(document),
    ...clarityBuildSentence(document),
    ...clarityCompareTable(document),
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
    ...runGenerationQualityGate(document),
    ...runClarityGate(document),
  ];
  return { ok: problems.length === 0, problems, document };
}
