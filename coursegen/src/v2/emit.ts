// The zero-spend v2 lesson emitter (S05.4c, OD-17, OD-23).
//
// Turns one v2 lesson plan into the three per-market documents Vault stores
// as immutable `lesson_document_versions` rows (0101): the answerless public
// document plus its private answer keys. Deterministic and offline: no model,
// image, voice or network call happens here, so the emitter is the dry-run
// path the owner-run paid generation will later feed (the model authors the
// plan's `copy`; everything downstream is this code).
//
// What it guarantees before a document leaves Forge:
//   - rubrics go to answer_keys only; the public document carries none;
//   - required_capabilities is exactly the union the segments need;
//   - every learner-visible string comes from the plan's per-market copy, and
//     the three markets fill exactly the same fields (a string left in the
//     locale-neutral payload would ship untranslated);
//   - the Forge content gates for v2 (gates.ts) pass: a blocked lesson emits
//     no documents and returns to Stage 1 with its itemized report
//     (Appendix C Stage 2).
// Contract validity itself is Core's decision: the output is validated by
// Core's strict v2 parser (`npm --prefix backend run forge-v2:check`).

import type { GateProblem } from '../pipeline/gates.js';
import { loadMarketInventory, type MarketInventory } from '../contentGates/regional.js';
import { hasNeutralPayload, isNonCopyKey, requiredCapabilities, V2_ID, V2_LOCALES, type V2Locale, type V2PublicDocument, type V2Segment } from './contract.js';
import { analyzeV2Plan, runV2DocumentGates, type V2Finding } from './gates.js';
import type { V2LessonPlan, V2PlanSegment } from './plan.js';
import { v2AgeScopeProblem, v2ApproachesProblem, v2PayloadScopeProblem } from './v2SegmentFamilies.generated.js';
import { autonomyOfferForBand } from '../pipeline/learnerRegisterPolicy.generated.js';

export interface EmittedV2Document {
  lesson_id: string;
  locale: V2Locale;
  schema_version: 2;
  version_id: string;
  document: V2PublicDocument;
  answer_keys: Record<string, unknown>;
}

export interface V2EmitProblem extends GateProblem {
  locale?: V2Locale;
}

export interface V2EmitResult {
  lessonId: string;
  ok: boolean;
  /** Empty when any gate blocks: a blocked lesson is never emitted. */
  documents: EmittedV2Document[];
  problems: V2EmitProblem[];
  review: Array<V2Finding & { locale?: V2Locale }>;
  notApplicable: Array<{ gate: number; reason: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Leaf paths of every copy string in a value ("steps[0].spokenText"); ids and enums are not copy. */
function stringPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (Array.isArray(value)) return value.flatMap((item, index) => stringPaths(item, `${prefix}[${index}]`));
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([key]) => !isNonCopyKey(key))
      .flatMap(([key, child]) => stringPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

/**
 * Merge one market's copy into the locale-neutral payload. Objects merge by
 * key and arrays by index; copy may only add strings, never replace a number
 * or an enum the plan fixed.
 */
function mergeCopy(payload: unknown, copy: unknown, where: string, problems: string[]): unknown {
  if (copy === undefined) return payload;
  if (typeof copy === 'string') {
    if (payload !== undefined) problems.push(`${where}: copy would overwrite a locale-neutral payload value`);
    return copy;
  }
  if (Array.isArray(copy)) {
    if (!Array.isArray(payload)) {
      problems.push(`${where}: copy is a list but the payload is not`);
      return payload;
    }
    if (copy.length !== payload.length) problems.push(`${where}: copy has ${copy.length} item(s), the payload ${payload.length}`);
    return payload.map((item, index) => mergeCopy(item, copy[index], `${where}[${index}]`, problems));
  }
  if (isRecord(copy)) {
    const base = isRecord(payload) ? payload : {};
    if (payload !== undefined && !isRecord(payload)) problems.push(`${where}: copy is an object but the payload is not`);
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(copy)) out[key] = mergeCopy(base[key], value, where ? `${where}.${key}` : key, problems);
    return out;
  }
  problems.push(`${where}: copy may only carry strings`);
  return payload;
}

/** A Horizonte kind: the payload stays as planned; labels and notation lift to the segment next to it. */
function horizonteExtras(segment: V2PlanSegment, rest: Record<string, unknown>, where: string, problems: string[]): Pick<V2Segment, 'labels' | 'notation'> {
  const { labels, notation, ...stray } = rest;
  for (const key of Object.keys(stray)) problems.push(`${where}.${key}: a Horizonte kind takes only prompt, help, feedback, labels and notation as copy`);
  const spokenText = (notation as { spokenText?: unknown } | undefined)?.spokenText;
  return {
    ...(isRecord(labels) ? { labels: { ...(labels as Record<string, string>) } } : {}),
    ...(segment.notation && typeof spokenText === 'string' ? { notation: { tex: segment.notation.tex, spokenText } } : {}),
  };
}

function buildSegment(segment: V2PlanSegment, locale: V2Locale, problems: string[]): V2Segment {
  const { prompt, help, feedback, ...rest } = segment.copy[locale];
  const where = `segments.${segment.id}.copy.${locale}`;
  const neutral = hasNeutralPayload(segment.type);
  const payload = neutral ? segment.payload : (mergeCopy(segment.payload, rest, where, problems) as Record<string, unknown>);
  return {
    id: segment.id, type: segment.type, grading: segment.grading, prompt, visual: { ...segment.visual }, payload,
    ...(neutral ? horizonteExtras(segment, rest, where, problems) : {}),
    ...(help ? { help: [...help] } : {}),
    ...(feedback ? { feedback: { ...feedback } } : {}),
    ...(segment.item_role ? { item_role: segment.item_role } : {}),
    ...(segment.item_phase ? { item_phase: segment.item_phase } : {}),
    ...(segment.variant ? { variant: segment.variant } : {}),
    ...(segment.knowledge_component_id ? { knowledge_component_id: segment.knowledge_component_id } : {}),
  };
}

/** A version id Vault accepts (`^[a-z0-9][a-z0-9._:-]{2,100}$`) for a Forge run. */
export function forgeVersionId(runId: string): string {
  const slug = runId.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 90);
  const version = `forge-${slug || 'run'}`;
  if (!V2_ID.test(version)) throw new Error(`cannot derive a v2 version id from run id "${runId}"`);
  return version;
}

export function emitV2Lesson(plan: V2LessonPlan, options: { versionId: string; markets?: MarketInventory; requireLessonDesign?: boolean }): V2EmitResult {
  const markets = options.markets ?? loadMarketInventory();
  const problems: V2EmitProblem[] = [];
  const review: Array<V2Finding & { locale?: V2Locale }> = [];

  // Plan-level lesson-policy gates (14-16), decided before any document exists.
  const policy = analyzeV2Plan(plan, markets, { required: options.requireLessonDesign });
  for (const finding of policy.findings) {
    if (finding.severity === 'block') problems.push({ gate: finding.gate, ...(finding.segmentId ? { segmentId: finding.segmentId } : {}), message: finding.message });
    else review.push(finding);
  }

  // Structure: strings come from copy only, and every market fills the same fields.
  for (const segment of plan.segments) {
    const neutral = hasNeutralPayload(segment.type) ? [] : stringPaths(segment.payload);
    if (neutral.length > 0) {
      problems.push({ gate: 1, segmentId: segment.id, message: `payload strings (${neutral.join(', ')}) must come from the per-market copy, or they ship untranslated` });
    }
    if (hasNeutralPayload(segment.type)) {
      const spoken = V2_LOCALES.map((locale) => typeof (segment.copy[locale].notation as { spokenText?: unknown } | undefined)?.spokenText === 'string');
      if (spoken.some((has) => has !== Boolean(segment.notation))) {
        problems.push({ gate: 1, segmentId: segment.id, message: 'a notation needs its tex and a spokenText in all three markets, or neither' });
      }
    }
    const shapes = V2_LOCALES.map((locale) => stringPaths(segment.copy[locale]).sort().join('|'));
    if (new Set(shapes).size !== 1) {
      problems.push({ gate: 1, segmentId: segment.id, message: 'the three markets do not fill the same copy fields' });
    }
    // GAP-FIX-R4 (Appendix P Parts 1-3 ages column, Part 4.10; Bible 05 §7): the same age scope and content
    // rules Core enforces on delivery (the byte-for-byte copy of Core's families), so Forge never emits them.
    const visual = segment.visual as { type: string };
    const scopeKey = segment.type === 'money.allocation.v2' && visual.type !== 'stacked-bar' ? `${segment.type}:${visual.type}` : segment.type;
    const scope = v2AgeScopeProblem(scopeKey, plan) ?? v2PayloadScopeProblem({ type: segment.type, visual, payload: segment.payload }, plan.age_band);
    if (scope) problems.push({ gate: 1, segmentId: segment.id, message: `age scope: ${scope}` });
  }

  // B.16 / F-06: each market's answer keys come from its own rubric when the plan gives one per market.
  const answerKeysFor = (locale: V2Locale) => Object.fromEntries(plan.segments
    .filter((segment) => segment.rubric || segment.rubric_by_locale)
    .map((segment) => [segment.id, segment.rubric_by_locale ? segment.rubric_by_locale[locale] : segment.rubric!]));
  const documents: EmittedV2Document[] = [];
  let notApplicable: Array<{ gate: number; reason: string }> = [];
  for (const locale of V2_LOCALES) {
    const mergeProblems: string[] = [];
    const segments = plan.segments.map((segment) => buildSegment(segment, locale, mergeProblems));
    for (const message of mergeProblems) problems.push({ gate: 1, locale, message });
    const document: V2PublicDocument = {
      schema_version: 2,
      course_id: plan.course_id,
      pathway_id: plan.pathway_id,
      chapter_id: plan.chapter_id,
      lesson_id: plan.lesson_id,
      version_id: options.versionId,
      locale,
      age_band: plan.age_band,
      eligibility: { ...plan.eligibility },
      knowledge_component_ids: [...plan.knowledge_component_ids],
      adventure_scene_id: plan.adventure_scene_id,
      title: plan.title[locale],
      required_capabilities: requiredCapabilities(segments),
      segments,
      ...(plan.representation_progressions ? { representation_progressions: plan.representation_progressions } : {}),
      ...(plan.mentor_stage ? { mentor_stage: { ...plan.mentor_stage } } : {}),
      ...(plan.approaches ? { approaches: { options: plan.approaches.options.map((option) => ({ id: option.id, label: option.label[locale], segment_ids: [...option.segment_ids] })) } } : {}),
    };
    // GAP-FIX-R5 (B.24, Block B autonomy): every approach chain complete and gradable, offered only where the register allows it.
    const approachProblem = v2ApproachesProblem(document as Parameters<typeof v2ApproachesProblem>[0], autonomyOfferForBand(plan.age_band).approach);
    if (approachProblem) problems.push({ gate: 1, locale, message: `approaches: ${approachProblem}` });
    const report = runV2DocumentGates(document, policy.regional, markets, answerKeysFor(locale));
    for (const problem of report.problems) problems.push({ ...problem, locale });
    for (const finding of report.review) review.push({ ...finding, locale });
    notApplicable = report.notApplicable;
    documents.push({ lesson_id: plan.lesson_id, locale, schema_version: 2, version_id: options.versionId, document, answer_keys: answerKeysFor(locale) });
  }

  const ok = problems.length === 0;
  return { lessonId: plan.lesson_id, ok, documents: ok ? documents : [], problems, review, notApplicable };
}
