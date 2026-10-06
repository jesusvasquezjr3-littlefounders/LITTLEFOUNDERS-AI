// The Stage 2 gates a v2 document must carry over from the v1 pipeline
// (GAP-FIX-R2 learning; Appendix C Part 3 Stage 2 gates 4, 7 and 8; B.22,
// B.26, B.27; Product G.2 "no structurally exempt path").
//
// S05.4c and GAP-FIX-R1 ran gates 11-16 on v2 documents; gates 2, 3, 4, 17
// and 18 ran only inside the v1 runAllGates, so a new-catalog lesson (OD-24)
// could publish without the reward-mechanic, shame/family-finance, age
// vocabulary, currency-fact and arithmetic re-execution checks. These
// adapters run the same measurement code (or, where the v1 gate reads a v1
// segment shape, the same rule over the v2 shape):
//
//   gate 2  (age vocabulary)  the course taxonomy's forbidden words for every
//                             tier the document's eligibility reaches, over
//                             every learner-visible v2 string;
//   gate 3  (currency facts)  a real-currency money board's denominations
//                             must be the market currency's facts.yaml
//                             denominations (LittleFounders coins are exempt:
//                             simulated currency by the owner glossary);
//   gate 4  (arithmetic)      worked-example steps re-executed (expression =
//                             result), their private expected values equal to
//                             the shown results, change owed = paid - price,
//                             unit prices = price / quantity;
//   gate 5  (rationale/canon) every rejected choice has authored corrective
//                             feedback (per-choice rationale or not_yet), and
//                             every character reference is in the closed canon;
//   gate 6  (anti-genericity) prompts do not echo the title, contain canned
//                             filler, or reduce the activity to "learn/practice";
//   gate 7  (quality)         every graded step has private answer evidence,
//                             quality maps use the playable scale, and emoji
//                             stays out of instructions and answer surfaces;
//   gate 8  (clarity)         concise prompts, no fake questions, answer leaks
//                             or load-bearing facts hidden in help, and a real
//                             visual surface for every graded step;
//   gate 9  (readability)     locale-specific readability at the age ceiling;
//   gate 17 (reward mechanic) runRewardMechanicGate over the raw document;
//   gate 18 (wellbeing)       runWellbeingLanguageGate (self-global,
//                             family-finance moralizing, loss and purchase
//                             lures) over the raw document, the step
//                             `feedback` banners included;
//   gate 19 (age register)    GAP-FIX-R6 (B.20, B.23): runAgeRegisterGate over
//                             the raw document for the eligibility's ages
//                             (a register's forbidden lexicon, praise that
//                             names nothing from age 10), plus Core's
//                             v2FeedbackProblems: every graded step for ages
//                             10 and up names what was done right in
//                             `feedback.met`, feedback sits only on graded
//                             steps, and it carries no number the step does
//                             not show (answerless).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { GateProblem } from '../pipeline/gates.js';
import { buildForbiddenRegex, normalizeText } from '../pipeline/gates.js';
import { readabilityScore, type ReadabilityLocale } from '../pipeline/readability.js';
import { runRewardMechanicGate } from '../pipeline/rewardMechanicGate.js';
import { runAgeRegisterGate, runWellbeingLanguageGate } from '../pipeline/wellbeingGates.js';
import { v2FeedbackProblems } from './v2SegmentFamilies.generated.js';
import { factsFileSchema, taxonomyFileSchema, type FactsFile, type TaxonomyFile } from '../catalog/schema.js';
import { hasNeutralPayload, isNonCopyKey } from './contract.js';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface V2Finding { gate: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 17 | 18 | 19; severity: 'block' | 'review'; segmentId?: string; message: string }
export interface CarriedCourseData { taxonomy?: TaxonomyFile; facts?: FactsFile }

const here = path.dirname(fileURLToPath(import.meta.url));
const CURRICULUM = path.resolve(here, '../../curriculum');
const cache = new Map<string, CarriedCourseData>();

/** The course's taxonomy.yaml and facts.yaml, cached per course (read-only, offline). */
export function loadCarriedCourseData(courseId: string): CarriedCourseData {
  const hit = cache.get(courseId);
  if (hit) return hit;
  const dir = path.join(CURRICULUM, courseId);
  const read = <T>(file: string, schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }): T | undefined => {
    const full = path.join(dir, file);
    if (!/^[a-z0-9-]+$/.test(courseId) || !existsSync(full)) return undefined;
    const parsed = schema.safeParse(parseYaml(readFileSync(full, 'utf8')));
    return parsed.success ? parsed.data : undefined;
  };
  const data: CarriedCourseData = { taxonomy: read('taxonomy.yaml', taxonomyFileSchema), facts: read('facts.yaml', factsFileSchema) };
  cache.set(courseId, data);
  return data;
}

/** Every key the v2 walkers skip: ids, enums and structure (contract.ts isNonCopyKey) plus the segment scaffolding. */
const V2_SKIP_KEYS = new Set(['id', 'type', 'grading', 'visual', 'schema_version', 'course_id', 'pathway_id', 'chapter_id', 'lesson_id', 'version_id',
  'locale', 'age_band', 'eligibility', 'knowledge_component_ids', 'adventure_scene_id', 'required_capabilities', 'representation_progressions',
  'mentor_stage', 'currency', 'mode', 'unit', 'start', 'yes', 'no', 'relation', 'kind', 'role', 'audio_ref', 'from', 'to', 'date', 'level',
  'item_role', 'item_phase', 'variant', 'knowledge_component_id', 'lane', 'sets', 'notation']);

function visible(document: Json): Array<{ segmentId?: string; path: string; text: string }> {
  const out: Array<{ segmentId?: string; path: string; text: string }> = [];
  const walk = (node: unknown, where: string, segmentId?: string) => {
    if (typeof node === 'string') { out.push({ segmentId, path: where, text: node }); return; }
    if (Array.isArray(node)) { node.forEach((item, index) => walk(item, `${where}[${index}]`, segmentId)); return; }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) if (!V2_SKIP_KEYS.has(key) && !isNonCopyKey(key)) walk(value, where ? `${where}.${key}` : key, segmentId);
  };
  if (typeof document.title === 'string') out.push({ path: 'title', text: document.title });
  (Array.isArray(document.segments) ? document.segments : []).forEach((segment: Json, index: number) => {
    const segmentId = typeof segment?.id === 'string' ? segment.id : undefined;
    if (typeof segment?.type !== 'string' || !hasNeutralPayload(segment.type)) { walk(segment, `segments[${index}]`, segmentId); return; }
    // A Horizonte kind's payload is ids, enums and numbers: only its prompt, help, feedback and label names are read.
    for (const key of ['prompt', 'help', 'feedback']) walk(segment[key], `segments[${index}].${key}`, segmentId);
    for (const [labelId, text] of Object.entries(segment.labels ?? {})) walk(text, `segments[${index}].labels.${labelId}`, segmentId);
  });
  return out;
}

function tierRange(ages: string): [number, number] | null {
  const match = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(ages.trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function accentedWordRegex(word: string): RegExp {
  const escaped = word.normalize('NFC').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

/** Gate 2: every tier the eligibility reaches contributes its forbidden words (the youngest reader sets the floor). */
export function v2VocabularyGate(document: Json, data: CarriedCourseData): V2Finding[] {
  const min = Number(document.eligibility?.minimum_age); const max = Number(document.eligibility?.maximum_age);
  if (!data.taxonomy) return [{ gate: 2, severity: 'block', message: `no taxonomy.yaml for course "${document.course_id}": the age-vocabulary gate cannot run (G.2: no exempt path)` }];
  const words = new Set<string>();
  for (const tier of Object.values(data.taxonomy.age_tiers)) {
    const range = tierRange(tier.ages);
    if (!range || range[1] < min || range[0] > max) continue;
    for (const word of tier.forbidden_vocabulary[document.locale as string] ?? []) words.add(word);
  }
  const found: V2Finding[] = [];
  // A word spelled with diacritics matches only that spelling: pt-BR "dívida" (debt) is not "divida" (divide).
  const accented = (word: string) => word.normalize('NFD') !== word.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const regexes = [...words].map((word) => ({ word, keepMarks: accented(word),
    re: accented(word) ? accentedWordRegex(word) : buildForbiddenRegex(word) }));
  for (const item of visible(document)) {
    const normalized = normalizeText(item.text);
    for (const { word, re, keepMarks } of regexes) {
      if (re.test(keepMarks ? item.text.normalize('NFC').toLowerCase() : normalized)) found.push({ gate: 2, severity: 'block', ...(item.segmentId ? { segmentId: item.segmentId } : {}),
        message: `forbidden word "${word}" for ages ${min}-${max} (${document.locale}) at ${item.path}: "${item.text.slice(0, 80)}"` });
    }
  }
  return found;
}

const MARKET_CURRENCY: Record<string, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };

/** Gate 3: a real-currency money board uses only the market currency's recorded denominations. */
export function v2FactGate(document: Json, data: CarriedCourseData): V2Finding[] {
  const found: V2Finding[] = [];
  const currency = MARKET_CURRENCY[document.locale as string];
  const known = new Set<number>();
  for (const [factId, entry] of Object.entries(data.facts?.facts ?? {})) {
    if (!factId.includes('denominations') || entry.unit !== currency) continue;
    for (const value of Array.isArray(entry.value) ? entry.value : [entry.value]) if (typeof value === 'number') known.add(Math.round(value * 100));
  }
  for (const segment of (document.segments ?? []) as Json[]) {
    if ((segment.type !== 'money.coin-tray.v2' && segment.type !== 'money.making-change.v2') || segment.payload?.currency !== 'local') continue;
    if (known.size === 0) {
      found.push({ gate: 3, severity: 'block', segmentId: segment.id, message: `no facts.yaml denominations are recorded for ${currency}: a real-currency tray cannot be verified` });
      continue;
    }
    for (const denomination of segment.payload.denominations as Json[]) {
      if (!known.has(denomination.value_minor)) found.push({ gate: 3, severity: 'block', segmentId: segment.id,
        message: `${denomination.value_minor / 100} ${currency} is not a recorded ${currency} denomination (facts.yaml)` });
    }
  }
  return found;
}

/** A worked-step expression in plain arithmetic ("20% × 50", "50 − 10", "3 × 4.50"), or null when it is words. */
export function evaluateExpression(text: string): number | null {
  const source = text.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)').trim();
  if (!/^[\d\s.+\-*/()]+$/.test(source) || !/\d/.test(source)) return null;
  let index = 0;
  const peek = () => source[index];
  const skip = () => { while (peek() === ' ') index += 1; };
  const number = (): number | null => {
    skip();
    if (peek() === '(') { index += 1; const value = sum(); skip(); if (peek() !== ')') return null; index += 1; return value; }
    if (peek() === '-') { index += 1; const value = number(); return value === null ? null : -value; }
    const match = /^\d+(?:\.\d+)?/.exec(source.slice(index));
    if (!match) return null;
    index += match[0].length;
    return Number(match[0]);
  };
  const product = (): number | null => {
    let value = number();
    for (;;) {
      skip();
      const op = peek();
      if (value === null || (op !== '*' && op !== '/')) return value;
      index += 1;
      const right = number();
      if (right === null || (op === '/' && right === 0)) return null;
      value = op === '*' ? value * right : value / right;
    }
  };
  const sum = (): number | null => {
    let value = product();
    for (;;) {
      skip();
      const op = peek();
      if (value === null || (op !== '+' && op !== '-')) return value;
      index += 1;
      const right = product();
      if (right === null) return null;
      value = op === '+' ? value + right : value - right;
    }
  };
  const value = sum();
  skip();
  return value !== null && index === source.length && Number.isFinite(value) ? value : null;
}

function numeric(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const clean = text.trim().replace(/[−–]/g, '-').replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2');
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : null;
}

const CANON_CHARACTERS = new Set(['dina', 'liruf', 'rho', 'zara']);
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0F}\u{20E3}]/u;
const GRAPHEMES = new Intl.Segmenter('es', { granularity: 'grapheme' });

function isRecord(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectCharacterRefs(node: unknown, out: Array<{ character: string; path: string }>, at = ''): void {
  if (Array.isArray(node)) { node.forEach((item, index) => collectCharacterRefs(item, out, `${at}[${index}]`)); return; }
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const next = at ? `${at}.${key}` : key;
    if (key === 'character' && typeof value === 'string') out.push({ character: value, path: next });
    else collectCharacterRefs(value, out, next);
  }
}

function acceptedChoiceIds(key: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isRecord(key)) return ids;
  for (const [name, value] of Object.entries(key)) {
    if (!/(?:acceptable.*ids?|correct_option_id|better_id|choice_id)$/i.test(name)) continue;
    if (typeof value === 'string') ids.add(value);
    else if (Array.isArray(value)) for (const item of value) if (typeof item === 'string') ids.add(item);
  }
  return ids;
}

function optionRecords(node: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    if (node.length >= 2 && node.every((item) => isRecord(item) && typeof item.id === 'string')) out.push(...node as Json[]);
    else node.forEach((item) => optionRecords(item, out));
  } else if (isRecord(node)) {
    Object.values(node).forEach((value) => optionRecords(value, out));
  }
  return out;
}

/** Gate 5: closed character canon plus wrong-choice teaching coverage. */
export function v2RationaleAndCanonGate(document: Json, answerKeys: Json | undefined): V2Finding[] {
  const found: V2Finding[] = [];
  const refs: Array<{ character: string; path: string }> = [];
  collectCharacterRefs({ mentor_stage: document.mentor_stage, segments: document.segments }, refs);
  for (const ref of refs) if (!CANON_CHARACTERS.has(ref.character)) {
    found.push({ gate: 5, severity: 'block', message: `character "${ref.character}" at ${ref.path} is outside the closed canon {dina,liruf,rho,zara}` });
  }
  for (const segment of (document.segments ?? []) as Json[]) {
    if (segment.grading !== 'server') continue;
    const accepted = acceptedChoiceIds(answerKeys?.[segment.id]);
    if (accepted.size === 0) continue;
    for (const option of optionRecords(segment.payload)) {
      if (accepted.has(option.id)) continue;
      const rationale = option.rationale_md ?? option.rationale ?? option.feedback;
      if (typeof rationale !== 'string' && typeof segment.feedback?.not_yet !== 'string') {
        found.push({ gate: 5, severity: 'block', segmentId: segment.id,
          message: `rejected choice "${option.id}" has no rationale and the step has no feedback.not_yet; a wrong answer must teach, not merely reject` });
      }
    }
  }
  return found;
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length]!;
}

const FILLER: Record<string, string[]> = {
  'en-US': ['this is very important', 'as we already know', 'in this exercise you will learn'],
  'es-MX': ['es muy importante', 'como ya sabemos', 'en este ejercicio aprenderas'],
  'pt-BR': ['isso e muito importante', 'como ja sabemos', 'neste exercicio voce vai aprender'],
};
const GENERIC_TASK: Record<string, RegExp> = {
  'en-US': /^(?:learn|practice|review|think)\s+(?:about\s+)?[\p{L}\s]+[.!?]?$/iu,
  'es-MX': /^(?:aprende|practica|repasa|piensa)\s+(?:sobre\s+)?[\p{L}\s]+[.!?]?$/iu,
  'pt-BR': /^(?:aprenda|pratique|revise|pense)\s+(?:sobre\s+)?[\p{L}\s]+[.!?]?$/iu,
};

/** Gate 6: deterministic anti-genericity over v2 prompt copy. */
export function v2AntiGenericityGate(document: Json): V2Finding[] {
  const found: V2Finding[] = [];
  const title = normalizeText(String(document.title ?? '')).trim();
  const fillers = FILLER[String(document.locale)] ?? [];
  for (const segment of (document.segments ?? []) as Json[]) {
    const prompt = String(segment.prompt ?? '');
    const normalized = normalizeText(prompt).trim();
    const longest = Math.max(title.length, normalized.length);
    if (longest > 0 && levenshtein(title, normalized) / longest <= 0.2) {
      found.push({ gate: 6, severity: 'block', segmentId: segment.id, message: `prompt is a near-duplicate of the title "${document.title}" — it restates instead of teaching` });
    }
    const filler = fillers.find((phrase) => normalized.includes(normalizeText(phrase)));
    if (filler) found.push({ gate: 6, severity: 'block', segmentId: segment.id, message: `prompt contains banned filler phrase "${filler}"` });
    if (GENERIC_TASK[String(document.locale)]?.test(prompt.trim())) {
      found.push({ gate: 6, severity: 'block', segmentId: segment.id, message: 'prompt is a generic learning instruction with no concrete situation, decision, quantity or visible task' });
    }
  }
  return found;
}

function countEmoji(text: string): number {
  let count = 0;
  for (const { segment } of GRAPHEMES.segment(text)) if (EMOJI.test(segment)) count += 1;
  return count;
}

function qualityMaps(node: unknown, out: number[][] = []): number[][] {
  if (Array.isArray(node)) { node.forEach((value) => qualityMaps(value, out)); return out; }
  if (!isRecord(node)) return out;
  for (const [key, value] of Object.entries(node)) {
    if (/^(?:quality|qualities|scores)$/i.test(key) && isRecord(value)) {
      const values = Object.values(value).filter((item): item is number => typeof item === 'number');
      if (values.length) out.push(values);
    }
    qualityMaps(value, out);
  }
  return out;
}

/** Gate 7: answer evidence, playable quality scales and emoji discipline. */
export function v2GenerationQualityGate(document: Json, answerKeys: Json | undefined): V2Finding[] {
  const found: V2Finding[] = [];
  if (typeof document.title === 'string' && EMOJI.test(document.title)) found.push({ gate: 7, severity: 'block', message: 'title carries an emoji — title chrome is never decorated' });
  for (const segment of (document.segments ?? []) as Json[]) {
    const key = answerKeys?.[segment.id];
    if (segment.grading === 'server' && (!isRecord(key) || Object.keys(key).length === 0)) {
      found.push({ gate: 7, severity: 'block', segmentId: segment.id, message: `graded segment type "${segment.type}" has no private answer evidence — it can never be graded` });
    }
    for (const values of qualityMaps(key)) {
      const max = Math.max(...values);
      if (max <= 1 && !(segment.type === 'story.would-you-rather.v2' && max === 0)) {
        found.push({ gate: 7, severity: 'block', segmentId: segment.id, message: `quality map uses an unplayable 0–1 scale (max ${max}); author quality on 0–100` });
      }
    }
    for (const item of visible({ segments: [segment] })) {
      if (!EMOJI.test(item.text)) continue;
      const isNarrative = /^story\.|^voice\./.test(String(segment.type)) && item.path.includes('.payload.');
      if (!isNarrative) found.push({ gate: 7, severity: 'block', segmentId: segment.id, message: `${item.path} carries an emoji — instructions, help, feedback and answer-critical copy are never decorated` });
    }
    const narrativeText = visible({ segments: [segment] }).filter((item) => item.path.includes('.payload.')).map((item) => item.text).join(' ');
    if (/^story\.|^voice\./.test(String(segment.type)) && countEmoji(narrativeText) > 2) {
      found.push({ gate: 7, severity: 'block', segmentId: segment.id, message: 'more than two emojis in one narrative segment reads as clutter' });
    }
  }
  return found;
}

const MAX_PROMPT_CHARS = 160;
const MIN_LEAK_CHARS = 14;
const PRAISE: Record<string, string[]> = {
  'en-US': ['exactly', 'correct', 'well done', 'great job', 'that is right'],
  'es-MX': ['exacto', 'correcto', 'muy bien', 'bien hecho', 'asi es'],
  'pt-BR': ['exato', 'correto', 'muito bem', 'bom trabalho', 'isso mesmo'],
};
// A hidden INPUT fact, not a procedure or a derived result. Requiring a unit
// after the number keeps "divide the price by 12" / "total 50" / "× 100"
// out: those are methods/results, while "each badge costs 17 coins" supplies
// scenario data the board does not otherwise show.
const FACT_WITH_NUMBER = /(?:costs?|paid|pays?|has|gets?|cuesta|paga|tiene|recibe|custa|paga|tem|recebe)\D{0,18}?(\d+(?:[.,]\d+)?)\s*(?:coins?|dollars?|pesos?|reais|moedas?|euros?|usd|mxn|brl)\b/iu;
const LEAK_CUE: Record<string, RegExp> = {
  'en-US': /(?:answer|correct|choose|pick|select|best|better)(?:\s+answer|\s+choice)?\s+(?:is)?\s*$/i,
  'es-MX': /(?:respuesta|correcta|elige|escoge|selecciona|mejor)(?:\s+respuesta|\s+opcion)?\s+(?:es)?\s*$/i,
  'pt-BR': /(?:resposta|correta|escolha|selecione|melhor)(?:\s+resposta|\s+opcao)?\s+(?:e)?\s*$/i,
};

function optionTextById(payload: unknown, ids: Set<string>): string[] {
  const texts: string[] = [];
  for (const option of optionRecords(payload)) if (ids.has(option.id)) {
    for (const key of ['text', 'text_md', 'label', 'name', 'message', 'choice']) if (typeof option[key] === 'string') texts.push(option[key]);
  }
  return texts;
}

function numericEvidence(node: unknown, out = new Set<string>()): Set<string> {
  if (typeof node === 'number') out.add(String(node));
  else if (Array.isArray(node)) node.forEach((item) => numericEvidence(item, out));
  else if (isRecord(node)) Object.values(node).forEach((value) => numericEvidence(value, out));
  return out;
}

/** Gate 8: clear, answerless, answerable-from-screen and visual-first. */
export function v2ClarityGate(document: Json, answerKeys: Json | undefined): V2Finding[] {
  const found: V2Finding[] = [];
  const praise = PRAISE[String(document.locale)] ?? [];
  for (const segment of (document.segments ?? []) as Json[]) {
    const prompt = String(segment.prompt ?? '');
    // Intl's sentence iterator does not split currency decimals/thousands
    // (4.00, 2.000), unlike counting every period as punctuation.
    const sentences = prompt.trim()
      ? [...new Intl.Segmenter(String(document.locale).split('-')[0], { granularity: 'sentence' }).segment(prompt)]
        .filter((part) => /[\p{L}\p{N}]/u.test(part.segment)).length
      : 0;
    if (prompt.length > MAX_PROMPT_CHARS) found.push({ gate: 8, severity: 'block', segmentId: segment.id, message: `prompt is ${prompt.length} chars (max ${MAX_PROMPT_CHARS}) — move story into narration and keep the on-screen instruction concise` });
    if (sentences > 3) found.push({ gate: 8, severity: 'block', segmentId: segment.id, message: `prompt has ${sentences} sentences (max 3) — one situation line plus one instruction is enough` });
    if (segment.grading === 'none' && !String(segment.type).startsWith('voice.') && prompt.trim().endsWith('?')) found.push({ gate: 8, severity: 'block', segmentId: segment.id, message: `non-graded ${segment.type} ends with a question but takes no answer` });
    if (segment.grading === 'none' && praise.some((phrase) => normalizeText(String(segment.feedback?.met ?? '')).includes(normalizeText(phrase)))) {
      found.push({ gate: 8, severity: 'block', segmentId: segment.id, message: `non-graded ${segment.type} congratulates an answer the learner never gave` });
    }
    const accepted = acceptedChoiceIds(answerKeys?.[segment.id]);
    const screens = [prompt, ...(Array.isArray(segment.help) ? segment.help : [])].map((text) => normalizeText(String(text)));
    for (const answer of optionTextById(segment.payload, accepted)) {
      const normalizedAnswer = normalizeText(answer).trim();
      if (normalizedAnswer.length < MIN_LEAK_CHARS) continue;
      const leaked = screens.some((screenText) => {
        const index = screenText.indexOf(normalizedAnswer);
        if (index < 0) return false;
        if (screenText.trim() === normalizedAnswer) return true;
        return (LEAK_CUE[String(document.locale)] ?? LEAK_CUE['en-US']!).test(screenText.slice(Math.max(0, index - 55), index).trim());
      });
      if (leaked) found.push({ gate: 8, severity: 'block', segmentId: segment.id, message: `prompt/help explicitly reveals the correct answer ("${answer}") — the exercise is given away` });
    }
    const shown = numericEvidence(segment.payload);
    for (const match of prompt.matchAll(/\d+(?:[.,]\d+)?/g)) shown.add(match[0].replace(',', '.'));
    for (const help of (Array.isArray(segment.help) ? segment.help : [])) {
      const match = FACT_WITH_NUMBER.exec(help);
      const number = match?.[1]?.replace(',', '.');
      if (number && !shown.has(number)) found.push({ gate: 8, severity: 'block', segmentId: segment.id,
        message: `help hides a load-bearing fact ("${match![0]}") whose number is absent from the prompt and visible payload; the task must be solvable before opening help` });
    }
    const visual = isRecord(segment.visual) ? String(segment.visual.type ?? '') : '';
    if (segment.grading === 'server' && (!visual || /^(?:none|text|generic)$/i.test(visual))) {
      found.push({ gate: 8, severity: 'block', segmentId: segment.id, message: `graded ${segment.type} has no concrete visual surface (visual.type=${JSON.stringify(visual || null)}); v2 is visual-first` });
    }
  }
  return found;
}

const READABILITY_BANDS: Record<string, { en: number; es: number; pt: number }> = {
  '6-9': { en: 9, es: 66, pt: 58 }, '10-12': { en: 11, es: 60, pt: 52 },
  '13-17': { en: 13, es: 54, pt: 46 }, adult: { en: 15, es: 48, pt: 40 },
};

/** Gate 9: the locale's own readability formula against the document's age band. */
export function v2ReadabilityGate(document: Json): V2Finding[] {
  const locale = document.locale as ReadabilityLocale;
  const band = READABILITY_BANDS[String(document.age_band)];
  if (!band || !['en-US', 'es-MX', 'pt-BR'].includes(locale)) return [];
  // Match v1's learnerText contract: prose, not terse option/diagram labels.
  // Readability formulas badly misclassify a board made of short fragments;
  // the Copy Budget owns those labels independently.
  const prose: string[] = [];
  for (const segment of (document.segments ?? []) as Json[]) {
    if (typeof segment.prompt === 'string') prose.push(segment.prompt);
    if (Array.isArray(segment.help)) prose.push(...segment.help.filter((item: unknown): item is string => typeof item === 'string'));
    if (isRecord(segment.feedback)) for (const value of Object.values(segment.feedback)) if (typeof value === 'string') prose.push(value);
    if (/^(?:story|voice)\./.test(String(segment.type))) {
      const narrative = visible({ segments: [{ ...segment, prompt: '', help: [], feedback: undefined }] });
      prose.push(...narrative.filter((item) => item.path.includes('.payload.')).map((item) => item.text));
    }
  }
  const score = readabilityScore(prose.join(' '), locale);
  if (score === null) return [];
  if (locale === 'en-US' && score > band.en) return [{ gate: 9, severity: 'block', message: `en-US text measures Flesch-Kincaid grade ${score.toFixed(1)} — above the ${document.age_band} ceiling of ${band.en}` }];
  const floor = locale === 'es-MX' ? band.es : band.pt;
  if (locale !== 'en-US' && score < floor) return [{ gate: 9, severity: 'block', message: `${locale} text measures ease ${score.toFixed(0)} — below the ${document.age_band} floor of ${floor}` }];
  return [];
}

/** Gate 4: re-execute the arithmetic a v2 document states or keys. */
export function v2ArithmeticGate(document: Json, answerKeys: Json | undefined): V2Finding[] {
  const found: V2Finding[] = [];
  const block = (segmentId: string, message: string) => found.push({ gate: 4, severity: 'block', segmentId, message });
  for (const segment of (document.segments ?? []) as Json[]) {
    const key = answerKeys?.[segment.id];
    // A displayed worked equality must also be true when narrated as prose.
    // Deliberately wrong candidate answers and the Mentor's misjudgment are excluded.
    const assertion = segment.type === 'voice.mentor-turn.v2' ? segment.payload?.line
      : segment.type === 'voice.mentor-episode.v2' ? segment.payload?.recovery : undefined;
    if (typeof assertion === 'string') {
      const term = '[-−]?\\d+(?:[.,]\\d+)*%?';
      const equalities = new RegExp(`(${term}(?:\\s*[+−×÷*/-]\\s*${term})+)\\s*=\\s*(${term})`, 'g');
      const normalize = (text: string) => document.locale === 'pt-BR' ? text.replace(/\./g, '').replace(/,/g, '.') : text.replace(/,/g, '');
      for (const match of assertion.matchAll(equalities)) {
        const actual = evaluateExpression(normalize(match[1]!));
        const stated = evaluateExpression(normalize(match[2]!));
        if (actual === null || stated === null || Math.abs(actual - stated) > 1e-9) {
          block(segment.id, `displayed equality is false or undefined: ${match[0]}`);
        }
      }
    }
    if (segment.type === 'math.worked-example.v2') {
      for (const step of segment.payload.steps as Json[]) {
        const value = evaluateExpression(step.expression); const result = numeric(step.result);
        if (value !== null && result !== null && Math.abs(value - result) > 1e-9) {
          block(segment.id, `step "${step.id}": ${step.expression} is ${Number(value.toFixed(6))}, not ${step.result}`);
        }
      }
      for (const [stepId, expected] of Object.entries((key?.expectedValues ?? {}) as Record<string, string>)) {
        const step = (segment.payload.steps as Json[]).find((item) => item.id === stepId);
        const shown = numeric(step?.result); const keyed = numeric(expected);
        if (step && shown !== null && keyed !== null && shown !== keyed) block(segment.id, `the private key expects ${expected} for "${stepId}" but the worked step shows ${step.result}`);
      }
    }
    if (segment.type === 'money.making-change.v2' && key && key.change_minor !== segment.payload.paid_minor - segment.payload.price_minor) {
      block(segment.id, `change owed is ${segment.payload.paid_minor} - ${segment.payload.price_minor} = ${segment.payload.paid_minor - segment.payload.price_minor}, not ${key.change_minor}`);
    }
    if (segment.type === 'money.unit-price.v2' && key?.unit_prices) {
      const scale = segment.payload.currency === 'local' ? 100 : 1;
      for (const offer of segment.payload.offers as Json[]) {
        const text = String(key.unit_prices[offer.id] ?? '');
        const [n, d] = text.includes('/') ? text.split('/').map(Number) : [Number(text), 1];
        if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0 || Math.abs(n! / d! - offer.price_minor / (offer.quantity * scale)) > 1e-9) {
          block(segment.id, `offer "${offer.id}": ${offer.price_minor / scale} for ${offer.quantity} is ${Number((offer.price_minor / (offer.quantity * scale)).toFixed(6))} each, not ${text}`);
        }
      }
    }
  }
  return found;
}

/** Gates 17 and 18 over the raw v2 document, through the v1 gates' own measurement code. */
export function v2RewardAndWellbeingGates(document: Json): V2Finding[] {
  const reward = runRewardMechanicGate(document);
  const wellbeing = runWellbeingLanguageGate(document, V2_SKIP_KEYS);
  const at = (finding: { segmentId?: string }) => finding.segmentId ? { segmentId: finding.segmentId } : {};
  return [
    ...reward.blocking.map((finding) => ({ gate: 17 as const, severity: 'block' as const, ...at(finding), message: `${finding.path}: ${finding.message}` })),
    ...reward.review.map((finding) => ({ gate: 17 as const, severity: 'review' as const, ...at(finding), message: `${finding.path}: ${finding.message}` })),
    ...wellbeing.blocking.map((finding) => ({ gate: 18 as const, severity: 'block' as const, ...at(finding), message: `${finding.path}: ${finding.message}` })),
    ...wellbeing.review.map((finding) => ({ gate: 18 as const, severity: 'review' as const, ...at(finding), message: `${finding.path}: ${finding.message}` })),
  ];
}

/** Gate 19 over the raw v2 document: the age register (B.23) and the authored feedback rules (B.20). */
export function v2AgeRegisterGate(document: Json): V2Finding[] {
  const eligibility = document.eligibility as { minimum_age?: unknown; maximum_age?: unknown } | undefined;
  const ages = typeof eligibility?.minimum_age === 'number' && typeof eligibility.maximum_age === 'number'
    ? `${eligibility.minimum_age}-${Math.min(99, eligibility.maximum_age)}` : undefined;
  const register = runAgeRegisterGate(document, V2_SKIP_KEYS, ages);
  const at = (finding: { segmentId?: string }) => finding.segmentId ? { segmentId: finding.segmentId } : {};
  const segments = Array.isArray(document.segments) ? document.segments : [];
  const feedback = typeof document.age_band === 'string' ? v2FeedbackProblems({ age_band: document.age_band, segments }) : [];
  return [
    ...register.blocking.map((finding) => ({ gate: 19 as const, severity: 'block' as const, ...at(finding), message: `${finding.path}: ${finding.message}` })),
    ...register.review.map((finding) => ({ gate: 19 as const, severity: 'review' as const, ...at(finding), message: `${finding.path}: ${finding.message}` })),
    ...feedback.map((message) => ({ gate: 19 as const, severity: 'block' as const, segmentId: message.slice(0, message.indexOf(':')), message })),
  ];
}

/** All carried gates for one emitted document. */
export function runV2CarriedGates(document: Json, answerKeys?: Json): { problems: GateProblem[]; review: V2Finding[] } {
  const data = loadCarriedCourseData(String(document.course_id ?? ''));
  const findings = [
    ...v2VocabularyGate(document, data), ...v2FactGate(document, data), ...v2ArithmeticGate(document, answerKeys),
    ...v2RationaleAndCanonGate(document, answerKeys), ...v2AntiGenericityGate(document), ...v2GenerationQualityGate(document, answerKeys),
    ...v2ClarityGate(document, answerKeys), ...v2ReadabilityGate(document), ...v2RewardAndWellbeingGates(document), ...v2AgeRegisterGate(document),
  ];
  return {
    problems: findings.filter((item) => item.severity === 'block').map((item) => ({ gate: item.gate, ...(item.segmentId ? { segmentId: item.segmentId } : {}), message: item.message })),
    review: findings.filter((item) => item.severity === 'review'),
  };
}
