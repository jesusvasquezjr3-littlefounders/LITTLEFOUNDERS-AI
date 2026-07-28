// The 9 deterministic gates — COURSE_ENGINE.md §4 "gate" stage. Free, no
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
import { runReadabilityGate } from './readability.js';
import { CONTENT_TYPES } from '../contract/registry.js';

export type GateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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
  // Two-sided icon fields (memory_flip card faces). Caught LIVE on the first
  // fire-and-forget track (2026-07-26): only `icon`/`ask_icon` were frozen, so
  // the translator turned `b_icon: "cookie"` into pt-BR "biscoito" — an icon
  // name that cannot render. Every `*_icon` key is a Material Symbols ligature,
  // never prose; nonVisibleKeys.test pins all of them now.
  'a_icon',
  'b_icon',
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
    // A load-bearing INPUT fact hidden in a hint is off-screen — the child can't
    // solve without opening hints. (explanation_md is NOT scanned: it renders
    // after answering and legitimately states the ANSWER/result — a price there
    // is usually the computed answer, not a hidden input.)
    const offScreen = (segment as { hints?: string[] }).hints ?? [];
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
    // INVISIBLE-PROPERTY framing: tiles render ONLY as an icon + a tint, so a pattern of
    // SIZE, PRICE or AMOUNT is unshowable — the child sees identical glyphs and cannot tell
    // chico from grande or $5 from $15. A prompt that frames the beat as price/size (the
    // classic "chico $5, mediano $10, grande $15… para que los precios sigan subiendo") is
    // unsolvable-as-framed even when the color cycle technically has a period. Keep the
    // prompt to "¿Qué sigue en el patrón?" and carry the beat in distinct icons/tints.
    const pcPrompt = ((segment as { prompt_md?: string }).prompt_md ?? '').toLowerCase();
    const SIZE_PRICE = /\$\d|\bpesos?\b|\bprecio|\bchico\b|\bmediano\b|\bgrande\b|barat|\bcar[oa]\b|subiendo|suban|más peque|más grande/i;
    if (SIZE_PRICE.test(pcPrompt)) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `pattern_complete "${segment.id}" frames the pattern by SIZE/PRICE ("${pcPrompt.slice(0, 60)}…") but the tiles are only an icon + a color tint — size and price are invisible, so the child cannot read the pattern the prompt describes. Keep prompt_md to "¿Qué sigue en el patrón?" and encode the beat in DISTINCT icons/tints.`,
      });
    }
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
 * ---- arrange family: two mirrors of the code that actually runs ---------------
 *
 * Both checks below re-implement the real runtime (the NumberLine widget's snap
 * grid + `linearFalloff`; the PatternComplete option bank the child is shown), so
 * each is a PROOF about what the child can actually do, not a heuristic. The
 * ENGINE is right in both cases — what degenerates is a content SHAPE the schema
 * happily allows — which is why this is an authoring gate and not a grader change.
 */

/**
 * frontend/src/lesson-engine/families/arrange/components.tsx — NumberLine:
 *   step = ticks ? (max - min) / ticks : 1
 *   snap(raw) = clamp(min + round((raw - min) / step) * step, min, max)
 * and the same `step` is handed to the KidSlider. So the child can ONLY submit
 * these values — every other point on the line is unreachable by tap OR by drag.
 */
function numberLineLandableValues(min: number, max: number, ticks: number | undefined): number[] {
  const span = max - min;
  if (!(span > 0)) return [];
  const divisions = ticks && ticks > 0 ? ticks : Math.max(1, Math.round(span));
  // `ticks` is schema-capped at 40, but the step-1 fallback is not: a 0–1,000,000
  // line would enumerate a million marks. Such a line is not a kid's number line —
  // decline to reason about it rather than burn the authoring loop on it.
  if (divisions > 1000) return [];
  const step = ticks && ticks > 0 ? span / ticks : 1;
  const out: number[] = [];
  for (let k = 0; k <= divisions; k++) {
    const v = Math.min(max, Math.max(min, min + k * step));
    out.push(Number(v.toFixed(6)));
  }
  return [...new Set(out)];
}

function arrangeMechanicFit(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  const passThreshold = documentPassThreshold(document);

  /** Where each ordering type keeps the items the child arranges. */
  const ORDER_BANK: Record<string, string> = {
    order_steps: 'items',
    rank_choices: 'items',
    build_sentence: 'tokens',
    timeline_order: 'events',
  };

  for (const segment of document.segments) {
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const answer = (segment as { answer?: Record<string, unknown> }).answer;

    /*
     * ---- ordering types: the bank must not RENDER in an accepted order --------
     *
     * Same defect class as code_order, proved the same way — by re-running the REAL
     * display function against the REAL key instead of assuming the shuffle is
     * enough. A fair shuffle lands on the authored order once every n! segments (1
     * in 6 for a 3-item rank_choices, the schema minimum), and the published
     * code_order lesson DID land there, so "assume it is fine" is not available.
     *
     * The check is an EXACT comparison rather than scorer arithmetic because
     * gradeOrder now caps every imperfect ordering at IMPERFECT_ORDER_CEILING (60):
     * below the default 70 gate, only an EXACTLY accepted order can pass. So the
     * question reduces to whether tapping the bank straight down — or straight up,
     * since a reversed rail reads just as naturally to a child — reproduces an
     * accepted ordering. Both directions are checked, and the display order is a
     * pure function of the segment id and the item ids, so reordering the payload
     * cannot dodge this.
     */
    const bankKey = ORDER_BANK[segment.type];
    if (bankKey && passThreshold > IMPERFECT_ORDER_CEILING) {
      const bank = Array.isArray(payload[bankKey]) ? (payload[bankKey] as Array<{ id?: unknown }>) : [];
      const ids = bank.map((b) => b?.id).filter((id): id is string => typeof id === 'string');
      const keyed = Array.isArray(answer?.order) ? (answer.order as unknown[]).map(String) : [];
      const alts = Array.isArray(answer?.accept_orders)
        ? (answer.accept_orders as unknown[])
            .filter((o): o is unknown[] => Array.isArray(o))
            .map((o) => o.map(String))
        : [];
      // Only meaningful when the bank IS the placed set (no distractors left over).
      if (ids.length >= 3 && ids.length === keyed.length) {
        const accepted = [keyed, ...alts.filter((o) => o.length === keyed.length)];
        const shown = seededSortMiddlingIds(ids, segment.id);
        const reversed = [...shown].reverse();
        const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
        const leaks = accepted.some((key) => same(shown, key) || same(reversed, key));
        if (leaks) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `${segment.type} "${segment.id}": the bank RENDERS in an accepted order (${shown.join(' → ')}), so tapping it straight down (or up) scores full marks with no reasoning. Rename or re-id the items so the seeded display order differs from the key.`,
          });
        }
      }
    }

    /*
     * ---- number_line: the instrument must be able to express the answer -------
     *
     * PROMPT_MECHANIC_MISMATCH (confirmed 2026-07-25 on the shipped
     * `number-line` lesson): `{min:0, max:100, ticks:11}` makes step = 100/11 =
     * 9.0909…, so the tappable positions are 0, 9.1, 18.2, 27.3 … — and the
     * prompt asks the child to place 20, which the widget CANNOT express. Its own
     * hints ("la recta va de 10 en 10", "la segunda marca es 20") describe an
     * instrument that is not on screen: `ticks` is the number of DIVISIONS, not
     * of labelled marks, so a by-tens 0–100 line is ticks:10. That lesson only
     * scored 100 by luck — the nearest landable point, 18.18, happens to sit
     * 1.82 from the target and `full_credit_delta` is 2. Author the same line
     * with a tighter tolerance (full 1, zero 4 — an entirely natural choice) and
     * NO tap can score 100: the exercise becomes unwinnable.
     *
     * Fixed here and not in the widget because both plausible engine fixes are
     * worse: snapping the child's tap to `answer.value` would hand full credit to
     * a near-miss, and re-reading `ticks` as MARKS instead of divisions would
     * silently move the grid under every number_line already published (a line
     * authored ticks:4 for quarters would lose 25 as a landable value). The
     * content is what is wrong, so the content is what gets rejected.
     */
    if (segment.type === 'number_line') {
      const min = typeof payload.min === 'number' ? payload.min : NaN;
      const max = typeof payload.max === 'number' ? payload.max : NaN;
      const ticks = typeof payload.ticks === 'number' ? payload.ticks : undefined;
      const target = typeof answer?.value === 'number' ? answer.value : NaN;
      const full = typeof answer?.full_credit_delta === 'number' ? answer.full_credit_delta : NaN;
      const zero = typeof answer?.zero_credit_delta === 'number' ? answer.zero_credit_delta : NaN;
      const landable = numberLineLandableValues(min, max, ticks);
      if (landable.length > 0 && Number.isFinite(target) && Number.isFinite(full) && Number.isFinite(zero)) {
        const lands = landable.some((v) => Math.abs(v - target) < 1e-6);
        if (!lands) {
          const nearest = landable.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
          const nearestScore = linearFalloffScore(nearest, target, full, zero);
          // The smallest `ticks` the schema allows (2–40) that DOES land on the value.
          let suggestion = 0;
          for (let t = 2; t <= 40; t++) {
            const k = ((target - min) * t) / (max - min);
            if (Math.abs(k - Math.round(k)) < 1e-9) { suggestion = t; break; }
          }
          const advice = suggestion > 0
            ? `Use ticks: ${suggestion} so the grid lands exactly on ${target}.`
            : `No ticks value in 2–40 lands on ${target} for a ${min}–${max} line — move min/max (or the target) so the step divides evenly.`;
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `number_line "${segment.id}" targets ${target}, but with min ${min}, max ${max} and ticks ${ticks ?? '(absent → step 1)'} the child can only tap ${landable.slice(0, 4).map((v) => Number(v.toFixed(2))).join(', ')}… — the step is ${Number(((max - min) / (ticks ?? Math.max(1, Math.round(max - min)))).toFixed(4))}, so ${target} is NOT a position the widget can express (nearest is ${Number(nearest.toFixed(2))}, which scores ${nearestScore}). ${advice}`,
          });
        }
        /*
         * NAIVE_STRATEGY_PASSES (same type, same mirror): `full_credit_delta` and
         * `zero_credit_delta` are unbounded in the schema and the author prompt says
         * nothing about them, so a generous pair turns the line into a free pass —
         * `linearFalloff` clears the threshold for every |Δ| ≤ full + 0.3·(zero−full)
         * at a 70 mark. Counted over the positions the child can ACTUALLY tap: if
         * more than half of them already pass, "tap anywhere" wins more often than
         * not and the exercise measures nothing.
         */
        const passing = landable.filter((v) => linearFalloffScore(v, target, full, zero) >= passThreshold).length;
        if (passing * 2 > landable.length) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `number_line "${segment.id}" scores a pass (≥ ${passThreshold}) at ${passing} of the ${landable.length} positions the child can tap — "tap anywhere" passes more often than not, so the exercise measures luck. Tighten full_credit_delta (${full}) and zero_credit_delta (${zero}) relative to the ${min}–${max} range: full credit within about one tick, zero credit within a small multiple of it.`,
          });
        }
      }
    }

    /*
     * ---- pattern_complete: the bank must not label the answer ----------------
     *
     * NAIVE_STRATEGY_PASSES (confirmed 2026-07-25). The child only ever sees each
     * tile's icon + tint, and `clarityPatternComplete` (above) already forces the
     * keyed option to CONTINUE the visible period — which means the right tile is
     * always a repeat of a tile already on screen. Nothing, however, constrains
     * the DISTRACTORS. Author options as "the answer plus two unrelated things"
     * (the default LLM shape: cup, star, moon for a cup→lemon→cup→lemon→? beat)
     * and the whole task collapses into "tap the only tile I have seen before" —
     * no beat, no period, no pre-algebra, and a flat 100 because with
     * missing_slots = 1 the grader's ratio is binary.
     *
     * The rule: when ONE slot is missing, at least two options must be tiles that
     * appear in the visible sequence, so familiarity alone cannot pick the answer
     * and the child has to read the BEAT. Deliberately not applied at
     * missing_slots = 2: there the familiar tiles must also be put in the right
     * ORDER (swapping them scores 0), so familiarity is not by itself an answer —
     * and a period-2 pattern only HAS two distinct tiles, so demanding three
     * would ban a legitimate shape. Scoring cannot fix this: ratio over one slot
     * is already all-or-nothing, and the component cannot invent a decoy it was
     * not given.
     */
    if (segment.type === 'pattern_complete') {
      const seq = Array.isArray(payload.sequence) ? (payload.sequence as Array<{ icon?: string; tint?: string }>) : [];
      const options = Array.isArray(payload.options) ? (payload.options as Array<{ id?: string; icon?: string; tint?: string }>) : [];
      const missing = typeof payload.missing_slots === 'number' ? payload.missing_slots : 0;
      const tileKey = (t: { icon?: string; tint?: string } | undefined) => `${t?.icon}|${t?.tint}`;
      if (missing === 1 && seq.length >= 3 && options.length >= 2) {
        const seqKeys = new Set(seq.map(tileKey));
        const inPattern = options.filter((o) => seqKeys.has(tileKey(o)));
        if (inPattern.length <= 1) {
          const strangers = options.filter((o) => !seqKeys.has(tileKey(o))).map((o) => tileKey(o));
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `pattern_complete "${segment.id}" gives ${options.length} options but only ${inPattern.length} of them is a tile that appears in the visible sequence (the others — ${strangers.join(', ')} — show up nowhere in the pattern). Tiles render as icon + tint only, so "tap the one I have already seen" answers it with zero pattern reasoning and scores 100. Make the distractors OTHER tiles from the same pattern, placed at the wrong beat (for an A,B,A,B,? sequence the options should include both A and B).`,
          });
        }
      }
      // The flip side of the same render truth: options are keyed by ID but drawn as
      // icon + tint, so two options sharing both are indistinguishable on screen and
      // the child's "right" tap is decided by which id the author happened to key.
      if (options.length >= 2) {
        const seen = new Map<string, string>();
        for (const o of options) {
          const key = tileKey(o);
          const twin = seen.get(key);
          if (twin !== undefined) {
            problems.push({
              gate: 8,
              segmentId: segment.id,
              message: `pattern_complete "${segment.id}" has two options ("${twin}" and "${o.id}") with the SAME icon and tint (${key}) — they render as identical tiles, so the child cannot choose between them and grading by option id makes it a coin flip. Give every option a distinct icon/tint pair.`,
            });
            break;
          }
          seen.set(key, String(o.id));
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
    const payload = (
      segment as {
        payload: {
          tokens?: { id?: string; text_md?: string }[];
          rows?: { id?: string; label?: string }[];
          cols?: { id?: string; label?: string }[];
        };
      }
    ).payload;
    const answer = (segment as { answer?: { cells?: Record<string, string> } }).answer;
    const prompt = ((segment as { prompt_md?: string }).prompt_md ?? '').toLowerCase();
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

    // SOLVABILITY GROUNDING: the table has no separate data panel — the ONLY place a
    // child can read the source values is prompt_md. Every cell whose answer token is a
    // DATA value (not a row-label reference = the "best choice" decision) must be fully
    // recoverable from the prompt: both the value AND its row must be named there. If the
    // author parks the prices in a hint/explanation (v4-pro's failure mode), the child is
    // left guessing which stall costs what → a random fail. Force the binding on-screen.
    const rowLabelById = new Map((payload.rows ?? []).map((r) => [r.id ?? '', (r.label ?? '').trim()]));
    const rowLabelSet = new Set([...rowLabelById.values()].map((l) => l.toLowerCase()).filter(Boolean));
    // Decision COLUMN: a column whose id/label reads as "pick the best" (elige / choose /
    // best / mejor). Its cells are derived by comparison, not transcribed — never require
    // their tokens in the prompt (guards against false-fails on Sí/No-per-row decisions).
    const DECISION_COL = /elig|eleg|escoj|escog|choos|pick|best|mejor|winner|ganad/i;
    const decisionColIds = new Set(
      (payload.cols ?? [])
        .filter((c) => DECISION_COL.test(c.id ?? '') || DECISION_COL.test(c.label ?? ''))
        .map((c) => (c.id ?? '').toLowerCase()),
    );
    const promptNums = new Set((prompt.match(/\d+/g) ?? []));
    for (const [cellKey, tokenId] of Object.entries(cells)) {
      const txt = textById.get(tokenId);
      if (!txt) continue;
      const colId = (cellKey.split(':')[1] ?? '').toLowerCase();
      if (decisionColIds.has(colId)) continue;
      // Decision cell: the child PICKS a row (token text == a row label) — derived by
      // comparison, not transcribed. That is the whole exercise; never require it in prompt.
      if (rowLabelSet.has(txt)) continue;
      const rowId = cellKey.split(':')[0] ?? '';
      const rowLabel = (rowLabelById.get(rowId) ?? '').toLowerCase();
      const tokenNums = txt.match(/\d+/g) ?? [];
      const valueGrounded =
        tokenNums.length > 0 ? tokenNums.every((n) => promptNums.has(n)) : prompt.includes(txt);
      if (!valueGrounded) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `compare_table source cell "${cellKey}" needs value "${txt}" but it is NOT stated in prompt_md — the child cannot read it off any panel and would have to guess. State every row's value in the prompt (e.g. "Doña Lula vende los 10 limones por 5 pesos; Don Pepe por 6 pesos"), not in a hint.`,
        });
        continue;
      }
      if (rowLabel && !prompt.includes(rowLabel)) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `compare_table binds "${txt}" to row "${rowLabel}" but the prompt never names that row alongside its value — the value↔row binding is off-screen and unguessable. Name each row and its value together in prompt_md.`,
        });
      }
    }
  }
  return problems;
}

function clarityCoinCount(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'coin_count') continue;
    const prompt = ((segment as { prompt_md?: string }).prompt_md ?? '').toLowerCase();
    // The coin_count engine renders ONLY a target + a denomination palette the child taps
    // to ASSEMBLE coins summing to the target (grade = tray sum === target). It has NO
    // yes/no control. A prompt that poses a sufficiency yes/no question ("¿tiene suficiente
    // para el vaso de 5 pesos?") is unanswerable by the mechanic — the child can only build
    // a sum, and the grader passes ANY combo that reaches the target. Force an assemble task.
    const SUFFICIENCY = /suficient|te alcanza|le alcanza|\balcanza\b|\bbasta\b|le sobra|es bastante|enough/i;
    if (SUFFICIENCY.test(prompt)) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `coin_count "${segment.id}" asks a yes/no SUFFICIENCY question ("${prompt.slice(0, 60)}…") but the player has no yes/no control — it only lets the child ASSEMBLE coins to reach the target. Ask the child to FORM/COUNT the exact amount instead (e.g. "Junta monedas para formar 5 pesos"), never "¿tiene suficiente?".`,
      });
    }
  }
  return problems;
}

function clarityBalanceScale(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'balance_scale') continue;
    const payload = (
      segment as { payload: { left_fixed?: { value?: unknown }[]; weights?: { value?: unknown }[] } }
    ).payload;
    const leftVals = (payload.left_fixed ?? []).map((i) => i.value).filter((v): v is number => typeof v === 'number');
    const bankVals = (payload.weights ?? []).map((w) => w.value).filter((v): v is number => typeof v === 'number');
    if (leftVals.length === 0 || bankVals.length === 0) continue;
    const target = leftVals.reduce((a, b) => a + b, 0);
    const bankSum = bankVals.reduce((a, b) => a + b, 0);
    // The grader passes when the PLACED weights sum exactly to the fixed left plate.
    // If the whole bank sums to exactly the target, "tap every token" is an always-correct
    // strategy — the child passes with zero reasoning and no wrong choice exists. The bank
    // must therefore offer MORE than the target so choosing which weights to place is the
    // actual exercise.
    if (bankSum === target) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `balance_scale "${segment.id}": the weight bank sums to exactly the target (${target}), so tapping EVERY token always balances — the child passes with zero reasoning and no wrong choice exists. Give the bank more total weight than the target (extra/distractor weights) so selecting the right subset is the exercise.`,
      });
      continue;
    }
    // Inverse failure: no subset of the bank can reach the target → unwinnable.
    const reachable = new Set<number>([0]);
    for (const v of bankVals) {
      for (const sum of [...reachable]) reachable.add(sum + v);
    }
    if (!reachable.has(target)) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `balance_scale "${segment.id}": no combination of the bank weights [${bankVals.join(', ')}] can sum to the fixed left plate (${target}) — the exercise is unwinnable, every submission scores 0. Choose weights whose subset can hit the target exactly.`,
      });
    }
  }
  return problems;
}

/*
 * ---- maker family: mirrors of the code that actually runs ---------------------
 *
 * The checks in `makerMechanicFit` back the maker-family fairness fixes
 * (2026-07-25). Each one re-implements the arithmetic of the real runtime — the
 * engine's bank shuffle, `kendall`, `toleranceBands`, the instrument's tick grid,
 * the machine_io widget/grader branch — so each is a PROOF about what the child
 * will actually be able to do, not a heuristic. The mirrors below are small and
 * deliberately literal; if the engine changes, they must change with it.
 */

/** frontend/src/lesson-engine/core/shuffle.ts — `hashCode`. */
function shuffleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** …`mix32` (murmur3 finalizer). */
function shuffleMix32(h: number): number {
  let x = h;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x | 0;
}

/** …`seededSort`, specialised to a list of ids. */
function seededSortIds(ids: readonly string[], seed: string): string[] {
  const rank = new Map<string, number>();
  for (const id of ids) if (!rank.has(id)) rank.set(id, shuffleMix32(shuffleHash(`${seed}:${id}`)));
  return [...ids].sort((a, b) => {
    const d = (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
    return d !== 0 ? d : a < b ? -1 : a > b ? 1 : 0;
  });
}

/** core/scoring.ts — `kendall`: pairwise concordance, 0-100. */
function kendallScore(user: readonly string[], correct: readonly string[]): number {
  if (user.length !== correct.length || correct.length < 2) return 0;
  if (new Set(user).size !== user.length) return 0;
  const pos = new Map(correct.map((id, i) => [id, i] as const));
  if (!user.every((id) => pos.has(id))) return 0;
  let concordant = 0;
  let total = 0;
  for (let i = 0; i < user.length; i++) {
    for (let j = i + 1; j < user.length; j++) {
      total++;
      if ((pos.get(user[i] as string) as number) < (pos.get(user[j] as string) as number)) concordant++;
    }
  }
  return total <= 0 ? 0 : Math.round((concordant / total) * 100);
}

/** The engine's own pass mark, used by `seededSortMiddling`'s band (not the document's). */
const ENGINE_PASS_MARK = 70;
const MIDDLING_ATTEMPTS = 12;

/** …`seededSortMiddling`: the bank order the child is ACTUALLY shown for an ordering bank. */
function seededSortMiddlingIds(ids: readonly string[], seed: string): string[] {
  if (ids.length < 3) return seededSortIds(ids, seed);
  for (let attempt = 0; attempt < MIDDLING_ATTEMPTS; attempt++) {
    const candidate = seededSortIds(ids, attempt === 0 ? seed : `${seed}#${attempt}`);
    const concordance = kendallScore(candidate, ids);
    if (concordance > 100 - ENGINE_PASS_MARK && concordance < ENGINE_PASS_MARK) return candidate;
  }
  const half = Math.floor(ids.length / 2);
  return [...ids.slice(half), ...ids.slice(0, half)];
}

/** families/arrange/grade.ts — `IMPERFECT_ORDER_CEILING`: the cap gradeOrder puts on
 *  ANY inexact ordering (order_steps / rank_choices / build_sentence / timeline_order).
 *  Mirrored here so the ordering checks below stay proofs about the running grader. */
const IMPERFECT_ORDER_CEILING = 60;

/** core/scoring.ts — `linearFalloff` (linear scale): 100 at ≤ full, 0 at ≥ zero. */
function linearFalloffScore(value: number, target: number, fullDelta: number, zeroDelta: number): number {
  const delta = Math.abs(value - target);
  const full = fullDelta;
  const zero = zeroDelta <= fullDelta ? fullDelta + Number.EPSILON : zeroDelta;
  if (delta <= full) return 100;
  if (delta >= zero) return 0;
  return Math.round((1 - (delta - full) / (zero - full)) * 100);
}

/** core/scoring.ts — `toleranceBands`: 100 within tolerance, 50 within 2×, else 0. */
function toleranceBandScore(value: number, target: number, tolerance: number): number {
  const delta = Math.abs(value - target);
  const tol = Math.max(0, tolerance);
  if (delta <= tol) return 100;
  if (delta <= tol * 2) return 50;
  return 0;
}

/** The document's own pass mark (trivialStrategy computes the same value inline). */
function documentPassThreshold(document: LessonDocumentParsed): number {
  const scoring = (document as { scoring?: { pass_threshold?: unknown } }).scoring;
  return typeof scoring?.pass_threshold === 'number' ? scoring.pass_threshold : 70;
}

function makerMechanicFit(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  const passThreshold = documentPassThreshold(document);
  const isWhole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;

  for (const segment of document.segments) {
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const answer = (segment as { answer?: Record<string, unknown> }).answer;

    // ---- code_order: the bank must not RENDER in a passing order --------------
    /*
     * gradeCodeOrder scores `kendall` (best of `order` + `accept_orders`) over the
     * assembled ids, and the child assembles by tapping the bank. The bank is
     * shuffled at render time, so the only question that matters is what the
     * shuffle actually outputs — and for the published `s1-code-order` the plain
     * shuffle returned the authored solution order, making "tap straight down"
     * worth 100. The engine now constrains that order (`seededSortMiddling`), and
     * this gate re-runs the SAME function against the REAL key, in BOTH reading
     * directions, so the no-free-pass claim is proved per segment instead of
     * assumed. The display order is a pure function of the segment id and the
     * BLOCK ids — reordering `payload.blocks` cannot change it.
     */
    if (segment.type === 'code_order') {
      const blocks = Array.isArray(payload.blocks) ? (payload.blocks as Array<{ id?: unknown }>) : [];
      const ids = blocks.map((b) => b?.id).filter((id): id is string => typeof id === 'string');
      const keyed = Array.isArray(answer?.order) ? (answer.order as unknown[]).map(String) : [];
      const alts = Array.isArray(answer?.accept_orders)
        ? (answer.accept_orders as unknown[])
            .filter((o): o is unknown[] => Array.isArray(o))
            .map((o) => o.map(String))
        : [];
      if (ids.length >= 3 && ids.length === blocks.length && keyed.length === ids.length) {
        const accepted = [keyed, ...alts.filter((o) => o.length === keyed.length)];
        const bestOf = (order: readonly string[]) =>
          accepted.reduce((best, key) => Math.max(best, kendallScore(order, key)), 0);
        const shown = seededSortMiddlingIds(ids, segment.id);
        const topDown = bestOf(shown);
        const bottomUp = bestOf([...shown].reverse());
        if (Math.max(topDown, bottomUp) >= passThreshold) {
          const direction = topDown >= bottomUp ? 'top-to-bottom' : 'bottom-to-top';
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `code_order "${segment.id}": the engine renders the block bank as [${shown.join(', ')}], and tapping it ${direction} scores ${Math.max(topDown, bottomUp)} ≥ pass_threshold ${passThreshold} under the real kendall grader — a child passes without reading a single block. The rendered order is a pure function of the segment id and the BLOCK IDS (reordering payload.blocks does NOT change it), so rename the block ids (they are internal, e.g. add a word that describes the step) to move the shuffle.`,
          });
        }
      }
    }

    // ---- debug_hunt: the hunt needs clean blocks to leave alone ---------------
    /*
     * gradeDebugHunt scores `signalDetection` (hitRate − 0.5·falseAlarmRate) since
     * the 2026-07-25 fix. That formula needs NEGATIVES to discriminate against:
     * with every block keyed as a bug the false-alarm rate is always 0 and "tap
     * everything" scores a clean 100 — the same "there must be something to leave
     * alone" rule red_flags/speed_tap already have. And a bug id that is not a real
     * block can never be tapped, so its hit rate is capped below 100 — unwinnable.
     */
    if (segment.type === 'debug_hunt') {
      const blocks = Array.isArray(payload.blocks) ? (payload.blocks as Array<{ id?: unknown }>) : [];
      const blockIds = new Set(blocks.map((b) => String(b?.id)));
      const bugIds = Array.isArray(answer?.bug_ids) ? (answer.bug_ids as unknown[]).map(String) : [];
      const real = new Set(bugIds.filter((id) => blockIds.has(id)));
      if (blocks.length > 0 && real.size >= blocks.length) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `debug_hunt "${segment.id}" keys EVERY one of its ${blocks.length} blocks as a bug, so there is nothing correct to leave alone and "tap every block" scores 100 with zero reasoning. Key ONE faulty block (two at most) and make the rest verifiably correct.`,
        });
      }
      const dangling = [...new Set(bugIds.filter((id) => !blockIds.has(id)))];
      if (blocks.length > 0 && dangling.length > 0) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `debug_hunt "${segment.id}" keys bug id(s) [${dangling.join(', ')}] that do not exist in payload.blocks — the child cannot tap a block that is not on screen, so the hit rate can never reach 100 and the exercise is unwinnable. Every answer.bug_ids entry must be one of the payload.blocks[].id values.`,
        });
      }
    }

    // ---- measure_read: the instrument must be READABLE to the graded value ----
    /*
     * The SVG instrument draws `ticks` evenly spaced marks and labels ONLY `min`
     * and `max`; the child then types a number on a NumberPad and `toleranceBands`
     * grades it. So the graded value has to be derivable by counting marks. The
     * published beaker proved it can fail to be: 0-400 ml over 8 marks puts the
     * step at 57.142857 and the pointer (250) at 4.375 marks — nothing a child can
     * read, with tolerance 0, so the reading task was unanswerable except by
     * guessing the round number. Rules, all mirroring the real grader/renderer:
     * reading the DRAWN pointer must score 100; the pointer must sit on a whole or
     * half mark with a countable step; and no OTHER landmark on the dial may score
     * a pass (which is also what stops a huge tolerance turning "type anything"
     * into a free 100).
     */
    if (segment.type === 'measure_read') {
      const min = typeof payload.min === 'number' ? payload.min : null;
      const max = typeof payload.max === 'number' ? payload.max : null;
      const ticks = typeof payload.ticks === 'number' ? payload.ticks : null;
      const pointer = typeof payload.pointer_value === 'number' ? payload.pointer_value : null;
      const target = typeof answer?.value === 'number' ? answer.value : null;
      const tolerance = typeof answer?.tolerance === 'number' ? answer.tolerance : null;
      const unit = typeof payload.unit === 'string' ? payload.unit : '';
      if (
        min !== null && max !== null && ticks !== null && ticks >= 2 && max > min &&
        pointer !== null && target !== null && tolerance !== null
      ) {
        const spacing = (max - min) / (ticks - 1);
        if (pointer < min || pointer > max) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `measure_read "${segment.id}": pointer_value ${pointer}${unit} is outside the scale (${min}–${max}), and the renderer clamps the needle to the end of the dial — the child sees a pinned needle and cannot read the value. Put pointer_value inside [min, max].`,
          });
        } else if (toleranceBandScore(pointer, target, tolerance) !== 100) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `measure_read "${segment.id}": the instrument draws the pointer at ${pointer}${unit} but the key grades ${target}${unit} ±${tolerance} — a child who reads the instrument EXACTLY RIGHT scores ${toleranceBandScore(pointer, target, tolerance)}, so the exercise is unwinnable. answer.value must be payload.pointer_value.`,
          });
        }
        const index = (pointer - min) / spacing;
        const gridFaults: string[] = [];
        if (!isWhole(index * 2)) {
          gridFaults.push(
            `the pointer sits ${index.toFixed(3)} marks from ${min} — between the marks rather than on one (only a whole or half mark is readable, and no mark carries a number)`,
          );
        }
        if (!isWhole(spacing * 10)) {
          gridFaults.push(
            `the step between marks is ${Number(spacing.toFixed(4))} — not a round amount a child can count in`,
          );
        }
        if (gridFaults.length > 0) {
          const options: string[] = [];
          for (let k = 3; k <= 20; k++) {
            const step = (max - min) / (k - 1);
            if (isWhole((pointer - min) / step) && isWhole(step * 10)) {
              options.push(`${k} (step ${Number(step.toFixed(4))})`);
            }
          }
          const advice = options.length
            ? `Set payload.ticks to ${options.slice(0, 3).join(' or ')} so the pointer lands exactly on a mark.`
            : `No tick count in 2–20 makes ${pointer} readable on a ${min}–${max} scale: move pointer_value (and answer.value with it) onto a round fraction of the range, e.g. its midpoint.`;
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `measure_read "${segment.id}" cannot be read to ${pointer}${unit}: with min ${min}, max ${max} and ${ticks} marks, ${gridFaults.join(' and ')}. ${advice}`,
          });
        }
        const landmarks = [
          ...Array.from({ length: ticks }, (_, i) => min + i * spacing),
          (min + max) / 2,
        ];
        const freebie = landmarks.find(
          (c) => Math.abs(c - target) > 1e-9 && toleranceBandScore(c, target, tolerance) >= passThreshold,
        );
        if (freebie !== undefined) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `measure_read "${segment.id}": answer.tolerance ${tolerance} is so wide that reading ${freebie}${unit} — another mark on the same dial — already scores ${toleranceBandScore(freebie, target, tolerance)} ≥ pass_threshold ${passThreshold}, so a child who misreads the instrument by a whole mark still passes. Keep tolerance well under the ${Number(spacing.toFixed(4))} step between marks (0 when the pointer is on a mark).`,
          });
        }
      }
    }

    // ---- machine_io: the control the child gets must fit the key --------------
    /*
     * The widget branches on `payload.options` (radio cards when present, a
     * NUMBER PAD when absent); gradeMachineIo branches on the KEY
     * (`correct_option_id` first, else numeric `value`). When those two disagree
     * the submission the child can make is not the one the grader reads, and EVERY
     * answer scores 0 — a prompt/mechanic mismatch, not a hard exercise. The same
     * applies to a word-answer machine (`out` values are allowed to be strings):
     * with no options the only control is a number pad, so the child has no way to
     * say "big" or "double". Finally, a probe that repeats one of the example
     * inputs puts the answer on screen already — copy that row and score 100
     * without inducing the rule.
     */
    if (segment.type === 'machine_io') {
      const examples = Array.isArray(payload.examples)
        ? (payload.examples as Array<{ in?: unknown; out?: unknown }>)
        : [];
      const options = Array.isArray(payload.options)
        ? (payload.options as Array<{ id?: unknown }>)
        : null;
      const hasOptions = options !== null && options.length > 0;
      const keyedOption = typeof answer?.correct_option_id === 'string' ? answer.correct_option_id : null;
      const keyedValue = typeof answer?.value === 'number' ? answer.value : null;
      if (hasOptions && keyedOption === null) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `machine_io "${segment.id}" renders ${options.length} option cards (payload.options), so the child can only submit the option they tapped — but the key has no answer.correct_option_id, so the grader takes its numeric branch, finds no number in the submission and scores 0 for EVERY answer. Key correct_option_id (the id of the right card), or drop payload.options and key a numeric answer.value for the number pad.`,
        });
      }
      if (hasOptions && keyedOption !== null && !options.some((o) => o?.id === keyedOption)) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `machine_io "${segment.id}" keys correct_option_id "${keyedOption}", which is not one of the payload.options ids — the winning card is not on screen, so the exercise is unwinnable. Use one of the authored option ids.`,
        });
      }
      if (!hasOptions && keyedValue === null) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `machine_io "${segment.id}" has no payload.options, so the child answers on a NUMBER PAD and the grader needs a numeric answer.value — with none, every submission scores 0. Add answer.value (a number), or give the segment options and key correct_option_id.`,
        });
      }
      if (!hasOptions && examples.some((e) => typeof e?.out !== 'number')) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `machine_io "${segment.id}" is a machine whose OUTPUTS are words, but with no payload.options the only control is a number pad — the child cannot type a word answer at all. Add options (one per candidate output) so the answer is tappable, or make the machine numeric.`,
        });
      }
      const probe = payload.probe_in;
      if (probe !== undefined && examples.some((e) => e?.in !== undefined && String(e.in) === String(probe))) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `machine_io "${segment.id}" probes with ${String(probe)}, which is already one of the example inputs shown above it — the child copies that row's output and scores 100 without inducing the machine's rule. Probe an input the examples do NOT show.`,
        });
      }
    }
  }
  return problems;
}

/**
 * TRIVIAL-STRATEGY gate: refuse exercises a child can pass with a mechanical
 * strategy that involves no reasoning. Each rule mirrors the arithmetic of the
 * REAL grader (backend/src/lesson-contract) for that type, so it is a
 * deterministic proof, not a heuristic. Cut from a code-grounded grader audit
 * (2026-07-24) that found several published lessons passable by rote.
 */
function trivialStrategy(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  const passThreshold =
    typeof (document as { scoring?: { pass_threshold?: unknown } }).scoring?.pass_threshold === 'number'
      ? ((document as { scoring: { pass_threshold: number } }).scoring.pass_threshold)
      : 70;

  for (const segment of document.segments) {
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const answer = (segment as { answer?: Record<string, unknown> }).answer;

    // ---- red_flags / speed_tap: discrimination needs something to reject -------
    // signalDetection scores hitRate − 0.5·falseAlarmRate. With NO non-targets the
    // false-alarm rate is always 0, so "select everything" scores a clean 100.
    if (segment.type === 'red_flags' || segment.type === 'speed_tap') {
      const items = Array.isArray(payload.flags)
        ? (payload.flags as unknown[])
        : Array.isArray(payload.items)
          ? (payload.items as unknown[])
          : [];
      const targetIds = segment.type === 'red_flags'
        ? (answer?.redflag_ids as unknown[] | undefined)
        : (answer?.target_ids as unknown[] | undefined);
      const targets = Array.isArray(targetIds) ? targetIds.length : 0;
      if (items.length > 0 && targets >= items.length) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `${segment.type} "${segment.id}" marks EVERY item as a target (${targets}/${items.length}), so there is nothing to reject and "tap everything" scores 100 with zero reasoning. Include clearly-innocent items the child must leave alone.`,
        });
      }
    }

    // ---- spot_error: most of the list must be RIGHT ---------------------------
    /*
     * gradeSpotError scores set-F1 over the tapped set vs `answer.error_ids`
     * (naive_strategy_passes fix, 2026-07-25 — decisionAccuracy used to pay for
     * untouched steps, so tapping one arbitrary step scored 80 on a 10-step list).
     * set-F1 kills every volume strategy EXCEPT one content shape it cannot fix
     * from the engine side: when most steps are keyed as flawed, "tap every step"
     * has precision = recall = P/N and scores 2P/(N+P) — 80 at 2 of 3 steps. So the
     * arithmetic below is the real grader's, evaluated for the tap-everything
     * submission, which makes this a proof rather than a heuristic.
     *
     * Second rule: an `error_ids` entry that is not a real step id can never be
     * tapped, which caps the best achievable score below 100 (0 when it is the only
     * keyed error) — unwinnable, and now fatal in a way it was not under
     * decisionAccuracy, so it is gated here rather than left to chance.
     */
    if (segment.type === 'spot_error') {
      const steps = Array.isArray(payload.steps) ? (payload.steps as Array<{ id?: unknown }>) : [];
      const stepIds = new Set(steps.map((s) => String(s?.id)));
      const errorIds = Array.isArray(answer?.error_ids) ? (answer.error_ids as unknown[]).map(String) : [];
      // Mirror of core/scoring.ts setF1 for "tap every step": hits = keyed steps
      // that actually exist, |selected| = steps.length, |positives| = error ids.
      const tapEverythingScore = (positives: number) =>
        Math.round(((2 * positives) / (steps.length + positives)) * 100);
      const positives = new Set(errorIds.filter((id) => stepIds.has(id))).size;
      if (steps.length > 0 && positives > 0 && tapEverythingScore(positives) >= passThreshold) {
        let maxFlawed = 0;
        for (let p = 1; p < steps.length; p++) if (tapEverythingScore(p) < passThreshold) maxFlawed = p;
        const advice =
          maxFlawed > 0
            ? `Key at most ${maxFlawed} of these ${steps.length} steps as flawed (and leave the rest verifiably correct).`
            : `Add more correct steps: with only ${steps.length} steps no flaw count can survive a pass_threshold of ${passThreshold}.`;
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `spot_error "${segment.id}" keys ${positives} of its ${steps.length} steps as flawed, so "tap EVERY step" scores ${tapEverythingScore(positives)} ≥ pass_threshold ${passThreshold} (set-F1 of the tapped set vs answer.error_ids) — the child passes with zero reasoning and there is almost nothing correct to leave alone. ${advice}`,
        });
      }
      const dangling = [...new Set(errorIds.filter((id) => !stepIds.has(id)))];
      if (steps.length > 0 && dangling.length > 0) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `spot_error "${segment.id}" keys error id(s) [${dangling.join(', ')}] that do not exist in payload.steps — the child cannot tap a step that is not on screen, so the exercise is unwinnable (it can never reach 100). Every answer.error_ids entry must be one of the payload.steps[].id values.`,
        });
      }
    }

    // ---- yes_no_cases: the rule must both APPLY and NOT APPLY -----------------
    /*
     * gradeYesNoCases scores balancedDecisionAccuracy — mean(sensitivity,
     * specificity) — which pins "press NO on every case" and "press YES on every
     * case" at 50 on every split that has at least one applying case AND at least
     * one non-applying case (naive_strategy_passes fix, 2026-07-25: pooled
     * (TP+TN)/N accuracy used to pay all-NO 75 on 8 cases with 2 applying). What no
     * formula can rescue is a ONE-SIDED key: with `applies_ids` empty, "press NO on
     * every case" IS the answer key and scores 100; with every case keyed, "press
     * YES" is. The schema permits both (`applies_ids` has no min or max). Both
     * strategies are scored below with the real grader's arithmetic, so this is a
     * proof and it tracks any future change to the formula.
     */
    if (segment.type === 'yes_no_cases') {
      const cases = Array.isArray(payload.cases) ? (payload.cases as Array<{ id?: unknown }>) : [];
      const caseIds = cases.map((c) => String(c?.id));
      const keyed = new Set(
        Array.isArray(answer?.applies_ids) ? (answer.applies_ids as unknown[]).map(String) : [],
      );
      // Mirror of core/scoring.ts balancedDecisionAccuracy (a vacuous class rates 1).
      const balancedScore = (pressedYes: (id: string) => boolean) => {
        let truePositives = 0;
        let trueNegatives = 0;
        let positives = 0;
        let negatives = 0;
        for (const id of caseIds) {
          if (keyed.has(id)) {
            positives++;
            if (pressedYes(id)) truePositives++;
          } else {
            negatives++;
            if (!pressedYes(id)) trueNegatives++;
          }
        }
        const sensitivity = positives === 0 ? 1 : truePositives / positives;
        const specificity = negatives === 0 ? 1 : trueNegatives / negatives;
        return Math.round(((sensitivity + specificity) / 2) * 100);
      };
      const allNo = balancedScore(() => false);
      const allYes = balancedScore(() => true);
      if (caseIds.length > 0 && (allNo >= passThreshold || allYes >= passThreshold)) {
        const applying = caseIds.filter((id) => keyed.has(id)).length;
        const worst = allNo >= allYes ? { label: 'NO', score: allNo } : { label: 'YES', score: allYes };
        const dangling = [...keyed].filter((id) => !caseIds.includes(id));
        const note =
          dangling.length > 0
            ? ` (answer.applies_ids entries [${dangling.join(', ')}] match no payload.cases[].id, so the grader ignores them.)`
            : '';
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `yes_no_cases "${segment.id}" keys ${applying} of its ${caseIds.length} cases as ones the rule applies to, so pressing ${worst.label} on every case scores ${worst.score} ≥ pass_threshold ${passThreshold} — a one-sided key turns one repeated tap into the answer itself and no case is ever tested against the rule.${note} Mix them: at least one case the rule DOES cover and at least one it clearly does NOT.`,
        });
      }
    }

    // ---- equation_builder: the bank must pose a choice ------------------------
    if (segment.type === 'equation_builder') {
      const tokens = Array.isArray(payload.tokens) ? (payload.tokens as unknown[]) : [];
      const slots = typeof payload.slots === 'number' ? payload.slots : tokens.length;
      if (tokens.length > 0 && tokens.length <= slots) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `equation_builder "${segment.id}" has ${tokens.length} tokens for ${slots} slots — every tile must be used, so there is no decision to make and the child cannot get the arithmetic wrong. Add distractor tokens (a wrong operand or operator) so choosing correctly IS the exercise.`,
        });
      }
    }

    // ---- build_sentence: partial credit must not mask the objective ------------
    /*
     * STALE MIRROR REPAIRED (partial_credit_too_generous, 2026-07-25). This check
     * used to compute `(slots-1)/slots × 100` — raw `positional` — and reject any
     * build_sentence with distractors and slots ≥ 4. That arithmetic is no longer the
     * grader's: gradeOrder now caps EVERY imperfect ordering at
     * IMPERFECT_ORDER_CEILING (60), so one wrong slot can never reach a 70 threshold
     * however many slots there are. Left as it was, the gate would reject content the
     * engine already grades correctly — a gate must mirror the code that runs, or it
     * is a heuristic pretending to be a proof (§gate-8 contract).
     *
     * It is kept rather than deleted because it is still load-bearing for a document
     * that lowers its own pass_threshold to 60 or less: there the cap stops being
     * protective and one-wrong-slot passes again. Mirror BOTH steps of the real
     * grader — the metric, then the ceiling.
     */
    if (segment.type === 'build_sentence') {
      const tokens = Array.isArray(payload.tokens) ? (payload.tokens as unknown[]) : [];
      const slots = typeof payload.slots === 'number' ? payload.slots : 0;
      const hasDistractors = tokens.length > slots;
      if (hasDistractors && slots > 0) {
        // frontend/src/lesson-engine/families/arrange/grade.ts — gradeOrder:
        // an inexact ordering scores min(positional, IMPERFECT_ORDER_CEILING).
        const oneWrong = Math.min(Math.round(((slots - 1) / slots) * 100), IMPERFECT_ORDER_CEILING);
        if (oneWrong >= passThreshold) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `build_sentence "${segment.id}" has distractor tokens, but one wrong slot still scores ${oneWrong} ≥ pass_threshold ${passThreshold} (positional credit over ${slots} slots, capped at ${IMPERFECT_ORDER_CEILING} for an imperfect order) — so a child who picks the WRONG distractor still passes and never has to do the reasoning the distractors test. Raise this lesson's pass_threshold above ${oneWrong}.`,
          });
        }
      }
    }

    // ---- budget_fit: the discrimination and the ceiling must both be real -----
    /*
     * gradeBudgetFit passes when every `need` is bought AND the total is within
     * budget. Nothing else. Three ways that degenerates, all found in real content:
     *   • no `need` items at all → the grader only checks the ceiling, so tapping
     *     ONE cheap item scores 100 (an author reached this by dropping needs to
     *     dodge an earlier version of this gate);
     *   • no NON-need items → nothing to discriminate, buying everything is right;
     *   • every item together fits the budget → "tap everything" scores 100.
     * The prompt naming the needs is handled by the answer-leak rules, and the
     * on-screen NEED badge is reveal-only in the widget.
     */
    if (segment.type === 'budget_fit') {
      const items = Array.isArray(payload.items)
        ? (payload.items as Array<{ price?: unknown; need?: unknown; label?: unknown }>)
        : [];
      const budget = typeof payload.budget === 'number' ? payload.budget : null;
      if (budget !== null && items.length > 0) {
        const needs = items.filter((i) => i.need === true);
        const wants = items.filter((i) => i.need !== true);
        const priceOf = (i: { price?: unknown }) => (typeof i.price === 'number' ? i.price : 0);
        if (needs.length === 0) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `budget_fit "${segment.id}" marks NO item as a need, so the grader only checks the budget ceiling — buying one cheap item scores 100 and there is no needs-vs-wants decision at all. Mark the genuine needs with need: true.`,
          });
        } else if (wants.length === 0) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `budget_fit "${segment.id}" marks EVERY item as a need, so there is nothing to leave out and buying everything is correct. Include tempting non-needs.`,
          });
        }
        const everythingTotal = items.reduce((sum, i) => sum + priceOf(i), 0);
        if (everythingTotal <= budget) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `budget_fit "${segment.id}": all ${items.length} items together cost ${everythingTotal}, within the ${budget} budget — so "tap everything" scores 100 and the budget never bites. Price the items so the full basket EXCEEDS the budget.`,
          });
        }
        const needsTotal = needs.reduce((sum, i) => sum + priceOf(i), 0);
        if (needsTotal > budget) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `budget_fit "${segment.id}": the required needs alone cost ${needsTotal}, more than the ${budget} budget — the exercise is unwinnable because the grader demands every need AND a total within budget.`,
          });
        }
      }
    }

    // ---- needs_wants: both classes must exist for the balanced grader ---------
    /*
     * gradeNeedsWants uses `balancedDecisionAccuracy`, which pins either blanket
     * answer ("Need" on everything / "Want" on everything) at 50 — but ONLY while
     * both classes are non-empty. With one class empty the mean is undefined, so
     * the scorer falls back to plain accuracy to keep the item set winnable, and
     * then the matching blanket answer scores a clean 100. The engine cannot fix
     * that without making such a lesson unwinnable, so it is gated here — the same
     * "there must be something to reject" rule red_flags/speed_tap already have.
     */
    if (segment.type === 'needs_wants') {
      const items = Array.isArray(payload.items) ? (payload.items as Array<{ id?: unknown }>) : [];
      const itemIds = new Set(items.map((i) => String(i?.id)));
      const keyed = Array.isArray(answer?.needs_ids) ? (answer.needs_ids as unknown[]).map(String) : [];
      const needs = new Set(keyed.filter((id) => itemIds.has(id))).size;
      const wants = items.length - needs;
      if (items.length > 0 && (needs === 0 || wants === 0)) {
        const blanket = needs === 0 ? 'tapping "Want" on every card' : 'tapping "Need" on every card';
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `needs_wants "${segment.id}" keys ${needs} of its ${items.length} items as needs — one side of the classification is empty, so ${blanket} scores 100 with zero needs-vs-wants thinking. Include BOTH real needs and real wants (roughly half and half), each unambiguous on its own.`,
        });
      }
    }

    // ---- piggy_split: the stepper must reach the key, and an even split must
    //      not BE the key ------------------------------------------------------
    /*
     * Two proven defects in one shape. Both are checked with the arithmetic of the
     * REAL pair — frontend PiggySplit (the only control is ±`step` per jar, and
     * canSubmit refuses until the allocation totals the income EXACTLY) and
     * core/scoring `allocationRanges` (100 iff EVERY jar sits inside its
     * [min,max]; anything else is capped at 50, i.e. sub-pass).
     *
     * naive_strategy_passes — "press + on each jar in turn until the money runs
     * out" is executable, deterministic (the jars render in payload order) and
     * completely label-blind, and it always spends the income exactly, so it always
     * submits. When that round-robin split happens to land inside every range it
     * scores 100 and the child never reads a single jar. Loose ranges (or genuinely
     * equal target proportions) are what make it win.
     *
     * prompt_mechanic_mismatch — jar amounts are only reachable as whole multiples
     * of `step`, so a `step` that does not divide `income`, or a target range with
     * no multiple of `step` inside it, describes an allocation the stepper cannot
     * express: the child is either stuck with nothing submittable or capped below
     * 100 forever. A targets/jar id mismatch is the same failure by another route —
     * `allocationRanges` sums the allocation over the TARGET keys, so a jar that has
     * no target never has its money counted and every submission scores 0.
     *
     * Gated at authoring time (not in the grader) because the engine is right for
     * every shape an author is supposed to write: the fix belongs in the content.
     */
    if (segment.type === 'piggy_split') {
      const jars = Array.isArray(payload.jars) ? (payload.jars as Array<{ id?: unknown }>) : [];
      const income = typeof payload.income === 'number' ? payload.income : null;
      const rawTargets = answer?.targets;
      const targets =
        typeof rawTargets === 'object' && rawTargets !== null
          ? (rawTargets as Record<string, { min?: unknown; max?: unknown } | undefined>)
          : null;
      if (jars.length > 0 && income !== null && income > 0 && targets) {
        const jarIds = jars.map((j) => String(j?.id));
        const targetKeys = Object.keys(targets);
        const missing = jarIds.filter((id) => !targetKeys.includes(id));
        const unknownKeys = targetKeys.filter((k) => !jarIds.includes(k));
        if (missing.length > 0 || unknownKeys.length > 0) {
          const detail = [
            missing.length > 0 ? `jars with no target: ${missing.join(', ')}` : '',
            unknownKeys.length > 0 ? `targets for no jar: ${unknownKeys.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('; ');
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `piggy_split "${segment.id}": answer.targets does not cover exactly the payload.jars ids (${detail}). The grader adds the child's allocation up over the TARGET keys, so a jar with no target has its money left out of the total and EVERY submission scores 0 — unwinnable. Give exactly one {min,max} range per jar id, and no extras.`,
          });
        } else {
          // Mirror of the widget's grid: `step` defaults to income/10 (components.tsx).
          const step = typeof payload.step === 'number' && payload.step > 0 ? payload.step : income / 10;
          const stepCents = toCents(step);
          const incomeCents = toCents(income);
          const wholeSteps = stepCents > 0 && incomeCents % stepCents === 0;
          const bounds = jarIds.map((id) => {
            const range = targets[id];
            const min = typeof range?.min === 'number' ? Math.max(0, toCents(range.min)) : 0;
            const max = typeof range?.max === 'number' ? toCents(range.max) : incomeCents;
            return { id, min, max };
          });
          const lo = bounds.map((b) => (stepCents > 0 ? Math.ceil(b.min / stepCents) : 0));
          const hi = bounds.map((b) => (stepCents > 0 ? Math.floor(b.max / stepCents) : -1));
          // Each jar's reachable step-counts form a contiguous integer interval, so the
          // achievable totals do too: feasible ⟺ Σlo ≤ totalSteps ≤ Σhi.
          const emptyRanges = bounds.filter((_, i) => (lo[i] as number) > (hi[i] as number));
          const totalSteps = wholeSteps ? incomeCents / stepCents : 0;
          const loSum = lo.reduce((a, b) => a + b, 0);
          const hiSum = hi.reduce((a, b) => a + b, 0);
          const feasible = wholeSteps && emptyRanges.length === 0 && loSum <= totalSteps && totalSteps <= hiSum;
          if (!feasible) {
            const reason = !wholeSteps
              ? `step ${step} does not divide the income ${income} into whole increments, so the jars can never add up to exactly ${income} and the Check button never unlocks`
              : emptyRanges.length > 0
                ? `jar(s) ${emptyRanges.map((b) => b.id).join(', ')} have a target range that contains no multiple of the ${step} step, so the child cannot land inside it`
                : `no combination of ${step}-sized steps puts every jar inside its range AND totals ${income} (the ranges allow between ${(loSum * stepCents) / 100} and ${(hiSum * stepCents) / 100})`;
            problems.push({
              gate: 8,
              segmentId: segment.id,
              message: `piggy_split "${segment.id}" is unwinnable as authored: the jars only move in ${step} increments and the grader wants every jar inside its range with the whole ${income} allocated, but ${reason}. Pick a step that divides the income and target ranges that sit on that grid.`,
            });
          } else {
            // "+ on each jar in turn until the money runs out": the first `extra` jars
            // (payload order — the order they render) get one more step than the rest.
            const base = Math.floor(totalSteps / jarIds.length);
            const extra = totalSteps % jarIds.length;
            const evenSplitWins = bounds.every((b, i) => {
              const amount = (base + (i < extra ? 1 : 0)) * stepCents;
              return amount >= b.min && amount <= b.max;
            });
            if (evenSplitWins) {
              const shares = bounds.map((_, i) => ((base + (i < extra ? 1 : 0)) * stepCents) / 100);
              problems.push({
                gate: 8,
                segmentId: segment.id,
                message: `piggy_split "${segment.id}": splitting the ${income} evenly across the ${jarIds.length} jars (${shares.join(' / ')}) lands inside EVERY target range, so a child who just taps + on each jar in turn until the money runs out scores 100 without reading a single jar label. Make the intended split genuinely uneven (the jars have different jobs — one needs more than the other) and tighten the ranges so the even split misses at least one jar.`,
              });
            }
          }
        }
      }
    }

    // ---- coin_count / make_change: "tap one of every coin" must not win -------
    /*
     * The money tray grades tray sum === target (`sumEquals`), and the palette can
     * be tapped any number of times — so choosing WHICH coins to assemble is the
     * whole exercise. When the palette's own denominations add up to exactly the
     * target, tapping each button once scores 100 with no arithmetic at all: the
     * mechanical "tap everything on screen" strategy the audit proved. Mirrors
     * clarityBalanceScale's bank-sum rule, on the same arithmetic as the grader.
     */
    if (segment.type === 'coin_count' || segment.type === 'make_change') {
      const denominations = Array.isArray(payload.denominations)
        ? (payload.denominations as unknown[]).filter((v): v is number => typeof v === 'number')
        : [];
      const price = typeof payload.price === 'number' ? payload.price : null;
      const paidWith = typeof payload.paid_with === 'number' ? payload.paid_with : null;
      const target =
        segment.type === 'coin_count'
          ? typeof payload.target === 'number'
            ? payload.target
            : null
          : price !== null && paidWith !== null
            ? paidWith - price
            : null;
      if (denominations.length > 0 && target !== null) {
        const paletteTotal = denominations.reduce((sum, v) => sum + v, 0);
        if (Math.abs(paletteTotal - target) < 1e-9) {
          const amount = segment.type === 'coin_count' ? `target ${target}` : `change due ${target}`;
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `${segment.type} "${segment.id}": the coin palette [${denominations.join(', ')}] adds up to exactly the ${amount}, so tapping ONE OF EVERY coin scores 100 (the grader passes any tray whose sum equals the target) and the child never does the arithmetic. Change a denomination or the amount so the palette total differs from it — the palette should be a set to choose from, not the answer laid out.`,
          });
        }
        /*
         * naive_strategy_passes (2026-07-25): the palette-total rule above only
         * catches "tap one of EVERY coin". The cheaper mechanical win is ONE tap.
         * CoinCount renders the target in a pill via `format(target)` directly above
         * a palette whose buttons are labelled with the SAME Intl currency formatter,
         * so when the target IS one of the denominations the child just taps the
         * button whose label matches the pill — symbol matching, zero counting — and
         * `sumEquals` scores that one-coin tray a clean 100.
         *
         * The right layer is authoring, not the grader: a tray that sums to the
         * target is by definition a correct answer, so refusing it in scoring would
         * fail a legitimate submission. make_change is deliberately exempt — it
         * renders price and paid_with but never the change due, so there is no
         * on-screen number to match a coin label against; that child must subtract
         * before the palette means anything.
         */
        if (segment.type === 'coin_count' && denominations.some((d) => toCents(d) === toCents(target))) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `coin_count "${segment.id}": the target ${target} is itself one of the palette denominations [${denominations.join(', ')}], so tapping that ONE coin scores 100 — the child reads the number off the target pill, finds the coin with the same label, and counts nothing. Drop that denomination or change the target so the tray needs at least TWO coins (e.g. target 5 with [1, 2, 10], never target 5 with [1, 2, 5]).`,
          });
        }
      }
    }

    // ---- would_you_rather: one tap must be able to be the wrong one -----------
    /*
     * naive_strategy_passes (2026-07-25). gradeWouldYouRather returns the authored
     * quality of the side the child tapped (0-1 maps rescaled ×100), and an ALL-ZERO
     * map is treated as a free-choice reflection worth 100 for either tap. The widget
     * is ONE tap between two cards, so when both sides score >= pass_threshold the
     * segment cannot be failed by anyone: "always tap the left card" is a complete,
     * thought-free strategy, and this type is NOT one of review.ts's low-decision
     * types — it is scored as a genuine reasoning exercise and carries real xp. The
     * palette used to promise exactly that shape ("BOTH sides can score 100"); it now
     * asks for a weaker side, and the arithmetic below is the grader's own, so this is
     * a proof rather than a heuristic.
     *
     * NOT fixable in the scorer: the score IS the authored quality, so any formula
     * that pushes the lower side under the threshold (normalizing to the spread, say)
     * would fail a child who took the side an author scored 95 in a deliberate
     * near-tie — a correct answer today. The engine keeps its all-zero → 100 branch as
     * a runtime safety net so already-published lessons stay winnable (gate 7 tolerates
     * that map for the same reason: it asks "can the best answer pass?"). This gate
     * asks the opposite question — "can this be failed?" — and refuses the shape at
     * authoring time, where write.ts has always said "never all zeros".
     */
    if (segment.type === 'would_you_rather') {
      const qualities = answer?.qualities as Record<string, unknown> | undefined;
      const qa = typeof qualities?.a === 'number' ? qualities.a : null;
      const qb = typeof qualities?.b === 'number' ? qualities.b : null;
      if (qa !== null && qb !== null) {
        // Mirror of core/scoring.ts qualityScaleFactor + clampScore, plus the grader's
        // "no better side at all → any valid pick scores 100" branch.
        const maxQuality = Math.max(qa, qb);
        const factor = maxQuality > 0 && maxQuality <= 1 ? 100 : 1;
        const scoreOf = (q: number) =>
          maxQuality === 0 ? 100 : Math.max(0, Math.min(100, Math.round(q * factor)));
        const scoreA = scoreOf(qa);
        const scoreB = scoreOf(qb);
        if (Math.min(scoreA, scoreB) >= passThreshold) {
          const allZero = maxQuality === 0 ? ' (an all-zero map scores 100 for either side)' : '';
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `would_you_rather "${segment.id}" grades side a ${scoreA} and side b ${scoreB}${allZero}, so BOTH taps clear pass_threshold ${passThreshold} — the child makes ONE tap and cannot fail, which makes "always tap the same card" a complete strategy with zero reasoning. Score the weaker trade-off well below ${passThreshold} (≈0-30) and teach the dilemma in \`reveal_md\`, which is shown either way.`,
          });
        }
      }
    }

    // ---- story_branch: real decisions, all keyed, and at least one wrong turn ---
    /*
     * naive_strategy_passes / partial_credit_too_generous (2026-07-25).
     * gradeStoryBranch averages the authored qualities of the choices the child took,
     * counting ONLY nodes that offered >= 2 choices (forced one-choice "continue" nodes
     * stopped being graded in the same audit — that part is the mechanic's, so it lives
     * in the grader). Three content shapes still defeat it, each proved below with that
     * exact arithmetic:
     *   • no multi-choice node at all — a linear story authored as a branch. The grader
     *     falls back to grading the forced steps so it is not unwinnable, and then
     *     tapping "continue" through it scores whatever they were keyed;
     *   • an UNKEYED choice at a real decision node is silently dropped from the mean,
     *     so taking it costs NOTHING: key only {best: 100} and a path that hits one best
     *     choice and every wrong turn after it still scores a clean 100;
     *   • when EVERY root-to-end path scores >= pass_threshold there is no wrong turn to
     *     take at all, so walking the story any way whatsoever passes.
     * The mirror-image check (no path can pass ⇒ unwinnable) comes free from the same
     * enumeration, so it is reported too.
     */
    if (segment.type === 'story_branch') {
      const rawNodes = Array.isArray(payload.nodes) ? (payload.nodes as Array<Record<string, unknown>>) : [];
      const choicesByNode = new Map<string, Array<{ id: string; next: string | null }>>();
      for (const node of rawNodes) {
        if (typeof node?.id !== 'string') continue;
        const rawChoices = Array.isArray(node.choices) ? (node.choices as Array<Record<string, unknown>>) : [];
        choicesByNode.set(
          node.id,
          rawChoices.map((c) => ({
            id: String(c?.id),
            next: typeof c?.next === 'string' ? c.next : null,
          })),
        );
      }
      const keyed = new Map<string, number>();
      const rawQualities = Array.isArray(answer?.qualities)
        ? (answer.qualities as Array<Record<string, unknown>>)
        : [];
      for (const q of rawQualities) {
        if (typeof q?.node_id === 'string' && typeof q?.choice_id === 'string' && typeof q?.score === 'number') {
          keyed.set(`${q.node_id} ${q.choice_id}`, q.score);
        }
      }
      const decisionNodes = [...choicesByNode.entries()].filter(([, choices]) => choices.length >= 2);
      const startNode = typeof payload.start_node === 'string' ? payload.start_node : null;
      if (choicesByNode.size > 0 && decisionNodes.length === 0) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `story_branch "${segment.id}" has no node that offers more than one choice, so the child never decides anything — they tap "continue" to the end and the grader has only forced steps left to score. Give at least one node 2-4 genuinely different choices (that branching decision IS the exercise).`,
        });
      } else if (decisionNodes.length > 0) {
        const unkeyed = decisionNodes.flatMap(([nodeId, choices]) =>
          choices.filter((c) => !keyed.has(`${nodeId} ${c.id}`)).map((c) => `${nodeId}/${c.id}`),
        );
        if (unkeyed.length > 0) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `story_branch "${segment.id}" leaves choice(s) [${unkeyed.join(', ')}] out of \`answer.qualities\` even though their node offers a real decision. The grader averages only the steps it has a quality for, so an unkeyed choice costs the child NOTHING — taking it is free, and a path that hits one keyed best choice and unkeyed wrong turns after it still scores 100. Key EVERY choice of EVERY multi-choice node (a poor turn ≈ 0-30); the one-choice "continue"/ending nodes need no entry.`,
          });
        } else if (startNode !== null && choicesByNode.has(startNode)) {
          // Mirror of families/storyplay/grade.ts: mean of the clamped qualities taken
          // at DECISION nodes only, 0-1 maps rescaled, no keyed decision step → 0.
          const maxQuality = [...keyed.values()].reduce((m, v) => (v > m ? v : m), 0);
          const factor = maxQuality > 0 && maxQuality <= 1 ? 100 : 1;
          const PATH_CAP = 400;
          const pathScores: number[] = [];
          let truncated = false;
          const finalize = (taken: number[]) => {
            const mean = taken.length === 0 ? 0 : taken.reduce((a, b) => a + b, 0) / taken.length;
            pathScores.push(Math.max(0, Math.min(100, Math.round(mean))));
          };
          const walk = (nodeId: string, seen: Set<string>, taken: number[]) => {
            if (pathScores.length >= PATH_CAP) {
              truncated = true;
              return;
            }
            const choices = choicesByNode.get(nodeId) ?? [];
            if (choices.length === 0) {
              finalize(taken);
              return;
            }
            const isDecision = choices.length >= 2;
            for (const choice of choices) {
              const quality = keyed.get(`${nodeId} ${choice.id}`);
              const next =
                isDecision && typeof quality === 'number'
                  ? [...taken, Math.max(0, Math.min(100, Math.round(quality * factor)))]
                  : taken;
              // A dangling/repeated `next` ends the story (the widget ends defensively too).
              if (choice.next === null || !choicesByNode.has(choice.next) || seen.has(choice.next)) {
                finalize(next);
              } else {
                walk(choice.next, new Set(seen).add(choice.next), next);
              }
            }
          };
          walk(startNode, new Set([startNode]), []);
          if (!truncated && pathScores.length > 0) {
            const worst = Math.min(...pathScores);
            const best = Math.max(...pathScores);
            if (worst >= passThreshold) {
              problems.push({
                gate: 8,
                segmentId: segment.id,
                message: `story_branch "${segment.id}": every one of its ${pathScores.length} possible paths scores ${worst}-${best}, all >= pass_threshold ${passThreshold} — there is no wrong turn to take, so walking the story at random passes with zero reasoning. Key the poor choices low (≈0-30) so at least one path genuinely fails.`,
              });
            }
            if (best < passThreshold) {
              problems.push({
                gate: 8,
                segmentId: segment.id,
                message: `story_branch "${segment.id}" is unwinnable: the BEST of its ${pathScores.length} paths scores only ${best}, under pass_threshold ${passThreshold} (the grader averages the qualities of the choices taken at multi-choice nodes). Key the best choice at each decision ≈90-100.`,
              });
            }
          }
        }
      }
    }
  }
  return problems;
}

/**
 * Three more render-truth defects the grader audit found in published lessons.
 * Each is a distinct class, so each gets its own deterministic check.
 */
function promptIntegrity(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const answer = (segment as { answer?: Record<string, unknown> }).answer;
    const prompt = ((segment as { prompt_md?: string }).prompt_md ?? '').toLowerCase();

    // ---- match_pairs: the prompt must not dictate the pairing ----------------
    // A found example spelled the whole key out in words — "ayuda a poner cada
    // precio con su producto: vaso chico 5, jarra 20, galleta 3" — turning the
    // exercise into transcription. Flag when the prompt contains BOTH sides of a
    // keyed pair, since that pair no longer has to be reasoned about.
    if (segment.type === 'match_pairs' && Array.isArray(answer?.pairs)) {
      const left = Array.isArray(payload.left) ? (payload.left as Array<{ id?: string; text_md?: string }>) : [];
      const right = Array.isArray(payload.right) ? (payload.right as Array<{ id?: string; text_md?: string }>) : [];
      const textById = new Map<string, string>();
      for (const item of [...left, ...right]) {
        if (item.id && typeof item.text_md === 'string') textById.set(item.id, item.text_md.toLowerCase().trim());
      }
      for (const pair of answer.pairs as unknown[]) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const l = textById.get(String(pair[0]));
        const r = textById.get(String(pair[1]));
        if (!l || !r) continue;
        // Compare on the significant tokens so "Vaso chico" matches "vaso chico 5".
        const lHit = l.length > 2 && prompt.includes(l);
        const rNums = r.match(/\d+/g) ?? [];
        const rHit = rNums.length > 0 ? rNums.every((n) => new RegExp(`\\b${n}\\b`).test(prompt)) : prompt.includes(r);
        if (lHit && rHit) {
          problems.push({
            gate: 8,
            segmentId: segment.id,
            message: `match_pairs "${segment.id}" states the pair "${l}" ↔ "${r}" in prompt_md, so the child only has to transcribe the prompt onto the board instead of reasoning about the match. Keep the prompt to the instruction and let the pairs be inferred.`,
          });
          break;
        }
      }
    }

    // ---- debug_hunt / spot_error: the widget selects, it cannot rewrite -------
    // The DebugHunt control only lets a child TAP the faulty block; `answer.fix_md`
    // is revealed after grading. A prompt that says "corrígela" asks for something
    // the mechanic cannot express (found published).
    /*
     * spot_error joined this check (prompt_mechanic_mismatch, 2026-07-25): it is the
     * SAME mechanic under another name. `SpotError` renders `payload.steps` as
     * checkbox OptionCards and nothing else — no text field, no number pad — and
     * `answer.correction_md` is rendered only once a verdict exists, exactly like
     * fix_md. So "corrige la suma" / "escribe la respuesta correcta" is
     * unanswerable there too, and the author instruction actively invites the shape
     * by telling writers to put the corrected arithmetic in `answer.correction_md`
     * (write.ts) — an arithmetic-flaw type is the one most likely to be prompted
     * with "and fix it".
     *
     * Authoring layer, not engine: tapping the flawed step IS the skill this type
     * teaches, so the control set is right and grading is right; only a prompt that
     * demands a second, untypeable answer is out of contract. The regex is
     * deliberately the one already proven on published debug_hunt content, so
     * debug_hunt's behaviour is unchanged by this widening.
     */
    if (segment.type === 'debug_hunt' || segment.type === 'spot_error') {
      const CORRECT_VERB = /corr[íi]gel|corrige|arregl|reescrib|escribe la|fix it|rewrite|correct it|type the/i;
      if (CORRECT_VERB.test(prompt)) {
        const mechanic =
          segment.type === 'debug_hunt'
            ? { what: 'the text', tap: 'tap the faulty block', field: 'answer.fix_md' }
            : { what: 'the arithmetic', tap: 'tap the flawed step', field: 'answer.correction_md' };
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `${segment.type} "${segment.id}" asks the child to CORRECT ${mechanic.what} ("${prompt.slice(0, 60)}…"), but the widget only lets them ${mechanic.tap} — there is no text input, and the fix is only revealed after grading (${mechanic.field}). Ask them to FIND/TAP the mistake; the correction is the feedback.`,
        });
      }
    }

    // ---- any artifact list: a stated total must actually add up --------------
    // A published evidence_hunt receipt read "Vasos 15 / Azúcar 8 / Limones 12 /
    // Total 47" — 15+8+12 is 35. A child who checks the arithmetic (exactly what a
    // money course teaches) finds the app contradicting itself.
    const listKeys = ['sentences', 'lines', 'rows', 'items', 'blocks'] as const;
    for (const key of listKeys) {
      const list = payload[key];
      if (!Array.isArray(list)) continue;
      const entries = (list as Array<{ text_md?: unknown; label?: unknown }>)
        .map((e) => (typeof e.text_md === 'string' ? e.text_md : typeof e.label === 'string' ? e.label : ''))
        .filter((t) => t.length > 0);
      const TOTAL_WORD = /\b(total|suma|totale?s)\b/i;
      const totals = entries.filter((t) => TOTAL_WORD.test(t));
      if (totals.length !== 1) continue;
      const numsOf = (t: string) => (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
      const totalNums = numsOf(totals[0] ?? '');
      if (totalNums.length !== 1) continue;
      const parts = entries.filter((t) => !TOTAL_WORD.test(t)).flatMap(numsOf);
      if (parts.length < 2) continue;
      const sum = parts.reduce((a, b) => a + b, 0);
      const stated = totalNums[0] ?? 0;
      if (Math.abs(sum - stated) > 0.001) {
        problems.push({
          gate: 8,
          segmentId: segment.id,
          message: `${segment.type} "${segment.id}" shows a total that does not add up: the listed values [${parts.join(', ')}] sum to ${sum}, but the line reads "${totals[0]}". A money lesson must never contradict its own arithmetic — fix the numbers so the total is exact.`,
        });
      }
    }
  }
  return problems;
}

/**
 * CLUSTERED ANSWERS — defence in depth behind the render-time shuffle.
 *
 * Every answer bank is shuffled at render time, so authored position is not what
 * the child sees. But a leak this cheap deserves two locks: an engine-fairness
 * audit (2026-07-24) found shipped content where every speed_tap target occupied
 * the first five of eight slots and every true_false correct justification came
 * first — because the author instruction wrongly promised shuffling for banks that
 * were in fact rendered verbatim. If a renderer ever regresses, clustered content
 * turns instantly into a free pass; unclustered content stays safe either way.
 *
 * The rule: the keyed targets must not occupy a contiguous PREFIX of the bank.
 * That is the shape "tap top-to-bottom" exploits, and it is unambiguous to check.
 */
function clusteredAnswers(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  // bank key → answer key holding the winning ids, per type.
  const BANKS: Record<string, { bank: string; key: string }> = {
    speed_tap: { bank: 'items', key: 'target_ids' },
    red_flags: { bank: 'flags', key: 'redflag_ids' },
    evidence_hunt: { bank: 'sentences', key: 'evidence_ids' },
    yes_no_cases: { bank: 'cases', key: 'applies_ids' },
  };
  for (const segment of document.segments) {
    const spec = BANKS[segment.type];
    if (!spec) continue;
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const answer = (segment as { answer?: Record<string, unknown> }).answer;
    const bank = Array.isArray(payload[spec.bank]) ? (payload[spec.bank] as Array<{ id?: unknown }>) : [];
    const targets = Array.isArray(answer?.[spec.key]) ? (answer[spec.key] as unknown[]).map(String) : [];
    /*
     * A prefix is only a "cluster" when some of the bank is left over AND there
     * are at least TWO targets: with a single target, "first in the list" is an
     * arbitrary position the shuffle randomises anyway, and forbidding it would
     * outlaw 1 of N placements for no gain. The exploit this gate exists for is
     * "tap the first N and get N right", which needs N >= 2. (Caught as a false
     * positive on a regenerated evidence_hunt with one keyed sentence.)
     */
    if (bank.length < 3 || targets.length < 2 || targets.length >= bank.length) continue;
    const targetSet = new Set(targets);
    const positions = bank
      .map((item, i) => (item && targetSet.has(String(item.id)) ? i : -1))
      .filter((i) => i >= 0);
    if (positions.length !== targets.length) continue; // ids don't line up; other gates report that
    const isPrefix = positions.every((pos, i) => pos === i);
    if (isPrefix) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `${segment.type} "${segment.id}" authors all ${targets.length} correct items as the first ${targets.length} of ${bank.length} in \`${spec.bank}\` — a contiguous prefix, which is exactly the shape "tap top-to-bottom" exploits if any renderer shows the bank verbatim. Scatter the targets through the list.`,
      });
    }
  }
  return problems;
}

/**
 * count_objects must be ILLUSTRATABLE.
 *
 * `write.ts` has long told the author that omitting these labels "fails the gate" —
 * and that gate did not exist. Found 2026-07-25 while building image inheritance: the
 * published count-objects lesson has scene items carrying only {icon, tint, count},
 * so `planTargets` found nothing to illustrate and the lesson shipped with ZERO
 * pictures in a visual-first product, silently, in all three locales.
 *
 * The label is what the image stage draws AND what a screen reader announces, so a
 * missing one costs both the picture and the accessibility text.
 */
function countObjectsLabels(document: LessonDocumentParsed): GateProblem[] {
  const problems: GateProblem[] = [];
  for (const segment of document.segments) {
    if (segment.type !== 'count_objects') continue;
    const payload = (segment as { payload: Record<string, unknown> }).payload;
    const scene = Array.isArray(payload.scene) ? (payload.scene as Array<Record<string, unknown>>) : [];
    const unlabelled = scene.filter((item) => typeof item.label !== 'string' || (item.label as string).trim().length === 0);
    if (scene.length > 0 && unlabelled.length > 0) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `count_objects "${segment.id}": ${unlabelled.length} of ${scene.length} scene item(s) have no \`label\`, so there is nothing for the image stage to draw and nothing for a screen reader to announce — the lesson ships as bare icons in a visual-first product. Give every scene item a short literal object name ("moneda", "galleta", "vaso de limonada").`,
      });
    }
    const askLabel = payload.ask_label;
    if (typeof askLabel !== 'string' || askLabel.trim().length === 0) {
      problems.push({
        gate: 8,
        segmentId: segment.id,
        message: `count_objects "${segment.id}" has no \`ask_label\`, so the object the child must COUNT is never named in words — only as an icon. Set it to the scene item being counted.`,
      });
    }
  }
  return problems;
}

export function runClarityGate(document: LessonDocumentParsed): GateProblem[] {
  return [
    ...trivialStrategy(document),
    ...promptIntegrity(document),
    ...clusteredAnswers(document),
    ...clarityTextDensity(document),
    ...clarityFakeQuestion(document),
    ...clarityAnswerLeak(document),
    ...clarityHintHiddenFact(document),
    ...clarityPatternComplete(document),
    ...arrangeMechanicFit(document),
    ...robotPathSolvable(document),
    ...clarityBuildSentence(document),
    ...clarityCompareTable(document),
    ...clarityCoinCount(document),
    ...clarityBalanceScale(document),
    ...countObjectsLabels(document),
    ...makerMechanicFit(document),
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
    // Gate 9 — deterministic readability band per tier×locale (readability.ts);
    // catches text that reads like an adult paragraph BEFORE a paid judge call.
    ...runReadabilityGate(document, ctx.tier),
  ];
  return { ok: problems.length === 0, problems, document };
}
