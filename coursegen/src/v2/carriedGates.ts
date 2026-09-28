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
//   gate 17 (reward mechanic) runRewardMechanicGate over the raw document;
//   gate 18 (wellbeing)       runWellbeingLanguageGate (self-global,
//                             family-finance moralizing, loss and purchase
//                             lures) over the raw document.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { GateProblem } from '../pipeline/gates.js';
import { buildForbiddenRegex, normalizeText } from '../pipeline/gates.js';
import { runRewardMechanicGate } from '../pipeline/rewardMechanicGate.js';
import { runWellbeingLanguageGate } from '../pipeline/wellbeingGates.js';
import { factsFileSchema, taxonomyFileSchema, type FactsFile, type TaxonomyFile } from '../catalog/schema.js';
import { isNonCopyKey } from './contract.js';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface V2Finding { gate: 2 | 3 | 4 | 17 | 18; severity: 'block' | 'review'; segmentId?: string; message: string }
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
  (Array.isArray(document.segments) ? document.segments : []).forEach((segment: Json, index: number) => walk(segment, `segments[${index}]`, typeof segment?.id === 'string' ? segment.id : undefined));
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

/** Gate 4: re-execute the arithmetic a v2 document states or keys. */
export function v2ArithmeticGate(document: Json, answerKeys: Json | undefined): V2Finding[] {
  const found: V2Finding[] = [];
  const block = (segmentId: string, message: string) => found.push({ gate: 4, severity: 'block', segmentId, message });
  for (const segment of (document.segments ?? []) as Json[]) {
    const key = answerKeys?.[segment.id];
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

/** All carried gates for one emitted document. */
export function runV2CarriedGates(document: Json, answerKeys?: Json): { problems: GateProblem[]; review: V2Finding[] } {
  const data = loadCarriedCourseData(String(document.course_id ?? ''));
  const findings = [...v2VocabularyGate(document, data), ...v2FactGate(document, data), ...v2ArithmeticGate(document, answerKeys), ...v2RewardAndWellbeingGates(document)];
  return {
    problems: findings.filter((item) => item.severity === 'block').map((item) => ({ gate: item.gate, ...(item.segmentId ? { segmentId: item.segmentId } : {}), message: item.message })),
    review: findings.filter((item) => item.severity === 'review'),
  };
}
