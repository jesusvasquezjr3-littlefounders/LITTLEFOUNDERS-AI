// The v2 plan-authoring stage (GAP-FIX-R1 learning; OD-17: authoring targets
// the verified v2 contract through Appendix C's release pipeline; OD-23:
// every paid path has a zero-spend dry-run and an owner runbook).
//
// Appendix C Stage 0 fixes a lesson's skeleton: identity, age pathway, KCs,
// segment kinds with their locale-neutral numbers and the private rubrics.
// Stage 1 authors every learner-visible string per market. This stage does
// Stage 1 with a model (DeepSeek, the same provider configuration Forge uses
// everywhere): it hands the model the skeleton, the brief, the controlled
// glossary and the Copy Budget roles, and asks for the copy in the exact
// shape the skeleton declares. The result is parsed back into a V2 plan
// (plan.ts) and run through the emitter and the v2 content gates; a blocked
// draft goes back to the model with its itemized problems (two corrective
// rounds), never shipped.
//
// Spend: a paid run needs the owner-approved --max-usd ceiling
// (spendCeilingRefusal) and runs under the usage ledger. `--dry-run` uses a
// fixture responder that answers from a committed plan's own copy, so the
// whole stage (prompting, parsing, merging, gating) runs with zero model calls.

import { z } from 'zod';
import { glossaryPromptLines } from '../contentGates/glossary.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';
import type { CompleteOptions } from '../providers/deepseek.js';
import { V2_LOCALES, type V2Locale } from './contract.js';
import { horizonteGuidanceFor } from './horizonte/index.js';
import { emitV2Lesson } from './emit.js';
import { v2LessonPlanSchema, type V2LessonPlan } from './plan.js';
import { writingSkillsPrompt } from './writingSkills.js';
import type { GateNumber } from '../pipeline/gates.js';

export type V2Responder = (request: ChatCompleteRequest, options: CompleteOptions) => Promise<ChatCompleteResult>;

export const AUTHOR_LOCALES: readonly V2Locale[] = V2_LOCALES;

/** A Stage 0 skeleton: a plan whose copy strings are empty placeholders ("") in the exact shape each segment needs. */
export type V2Skeleton = V2LessonPlan;

/** Blank every string in a value, keeping its shape (a skeleton from any plan). */
export function blankCopy(value: unknown): unknown {
  if (typeof value === 'string') return '';
  if (Array.isArray(value)) return value.map(blankCopy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, blankCopy(child)]));
  return value;
}

/** The Stage 0 skeleton of a plan: same structure and rubrics, every learner-visible string blank. */
export function skeletonOf(plan: V2LessonPlan): V2Skeleton {
  return {
    ...plan,
    title: blankCopy(plan.title) as V2LessonPlan['title'],
    segments: plan.segments.map((segment) => ({ ...segment, copy: blankCopy(segment.copy) as typeof segment.copy })),
  };
}

const authoredSchema = z.object({
  title: z.object({ 'en-US': z.string(), 'es-MX': z.string(), 'pt-BR': z.string() }).strict(),
  copy: z.record(z.string(), z.object({ 'en-US': z.unknown(), 'es-MX': z.unknown(), 'pt-BR': z.unknown() }).strict()),
}).strict();

export function authoringMessages(skeleton: V2Skeleton, problems: string[] = []): ChatCompleteRequest['messages'] {
  const shape = {
    title: skeleton.title,
    copy: Object.fromEntries(skeleton.segments.map((segment) => [segment.id, segment.copy])),
  };
  const kinds = skeleton.segments.map((segment) => `${segment.id}: ${segment.type} (${segment.teaching_role ? `${segment.teaching_role}, ` : ''}${segment.grading === 'server' ? 'graded on Core' : 'explored'})`).join('; ');
  const system = [
    'You author learner-visible copy for one LittleFounders financial-literacy lesson in the v2 lesson format.',
    `Audience: ages ${skeleton.eligibility.minimum_age}-${skeleton.eligibility.maximum_age} (pathway ${skeleton.age_band}). Author in Mexican Spanish (es-MX) first, then adapt, never literally translate, into US English (en-US) and Brazilian Portuguese (pt-BR).`,
    'Fill EVERY empty string in the JSON shape you are given and nothing else: same keys, same array lengths, no new fields. Numbers, ids and rubrics are fixed by the skeleton and are never written in the copy.',
    'Never state or hint the answer of a graded segment in its prompt. Prompts are one or two short sentences; option labels are a few words; Mentor lines are at most two short sentences.',
    'Law 2 tone: speak like a mentor, never like a bank; no hype, urgency, shame, loss or "lives". The in-app currency is coins.',
    ...writingSkillsPrompt(skeleton),
    glossaryPromptLines('es-MX'), glossaryPromptLines('en-US'), glossaryPromptLines('pt-BR'),
    ...horizonteGuidanceFor(skeleton.segments.map((segment) => segment.type)),
    'Output ONLY the JSON object {"title": {...}, "copy": {...}} with every string filled.',
  ].join('\n');
  const user = [
    `Lesson brief (es-MX): ${skeleton.brief}`,
    `Segments: ${kinds}.`,
    `Shape to fill: ${JSON.stringify(shape)}`,
    ...(problems.length ? [`Your previous draft was blocked by the content gates; fix exactly these problems: ${problems.slice(0, 12).join(' | ')}`] : []),
  ].join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** Merge authored copy into the skeleton, strictly: every segment, every market, parsed as a V2 plan. */
export function mergeAuthoredCopy(skeleton: V2Skeleton, content: string): { plan?: V2LessonPlan; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(content); } catch (error) { return { errors: [`the model did not return JSON: ${(error as Error).message}`] }; }
  const authored = authoredSchema.safeParse(raw);
  if (!authored.success) return { errors: authored.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const missing = skeleton.segments.filter((segment) => !authored.data.copy[segment.id]).map((segment) => segment.id);
  if (missing.length) return { errors: [`copy missing for segment(s) ${missing.join(', ')}`] };
  const candidate = {
    ...skeleton,
    title: authored.data.title,
    segments: skeleton.segments.map((segment) => ({ ...segment, copy: authored.data.copy[segment.id] })),
  };
  const parsed = v2LessonPlanSchema.safeParse(candidate);
  if (!parsed.success) return { errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(plan)'}: ${issue.message}`) };
  return { plan: parsed.data, errors: [] };
}

/** The dry-run responder: answers from a committed plan's own copy, with no network and no spend. */
export function fixtureResponder(reference: V2LessonPlan): V2Responder {
  return async () => ({
    content: JSON.stringify({ title: reference.title, copy: Object.fromEntries(reference.segments.map((segment) => [segment.id, segment.copy])) }),
    promptTokens: 0, completionTokens: 0,
  } as ChatCompleteResult);
}

/**
 * Appendix C Part 1.3 (Forge Gate Pass Rate per gate, on FIRST submission;
 * GAP-FIX-R7): what the first draft of a lesson got right, per market, before
 * any corrective round told the model what to fix. `evaluated` is false when
 * the reply failed the plan schema (unparseable): the gates never ran, so the
 * draft counts as a gate 1 (contract) failure and never as a pass of 2-19.
 */
export interface V2FirstSubmission { locale: V2Locale; evaluated: boolean; unparseable: boolean; failedGates: GateNumber[] }

export interface V2AuthorResult { plan?: V2LessonPlan; ok: boolean; attempts: number; problems: string[]; firstSubmission: V2FirstSubmission[] }

/** The first round's gate outcome per market: a problem without a locale counts against every market. */
export function firstSubmissionOf(outcome: { unparseable: true } | { unparseable: false; problems: ReadonlyArray<{ gate: GateNumber; locale?: V2Locale }> }): V2FirstSubmission[] {
  return AUTHOR_LOCALES.map((locale) => outcome.unparseable
    ? { locale, evaluated: false, unparseable: true, failedGates: [1] }
    : { locale, evaluated: true, unparseable: false,
      failedGates: [...new Set(outcome.problems.filter((problem) => problem.locale === undefined || problem.locale === locale).map((problem) => problem.gate))].sort((a, b) => a - b) });
}

/**
 * Stage 1 for one skeleton: prompt, merge, emit, gate; up to two corrective
 * rounds with the itemized problems. The caller owns the responder (the live
 * DeepSeek chokepoint under a ledger, or the fixture responder) and the spend
 * ceiling refusal.
 */
export async function authorV2Plan(skeleton: V2Skeleton, responder: V2Responder, options: CompleteOptions & { maxRounds?: number }): Promise<V2AuthorResult> {
  const rounds = options.maxRounds ?? 3;
  let problems: string[] = [];
  // Recorded once, from round 1 only: a corrective round is not a first submission.
  let firstSubmission: V2FirstSubmission[] = [];
  for (let attempt = 1; attempt <= rounds; attempt += 1) {
    const reply = await responder({ messages: authoringMessages(skeleton, problems), temperature: 0.4, jsonMode: true }, { operation: 'v2-author', ledger: options.ledger });
    const merged = mergeAuthoredCopy(skeleton, reply.content);
    if (!merged.plan) {
      if (attempt === 1) firstSubmission = firstSubmissionOf({ unparseable: true });
      problems = merged.errors;
      continue;
    }
    const emitted = emitV2Lesson(merged.plan, { versionId: 'forge-author-check' });
    if (attempt === 1) firstSubmission = firstSubmissionOf({ unparseable: false, problems: emitted.problems });
    if (emitted.ok) return { plan: merged.plan, ok: true, attempts: attempt, problems: [], firstSubmission };
    problems = emitted.problems.map((problem) => `[gate ${problem.gate}] ${problem.segmentId ?? ''} ${problem.locale ?? ''} ${problem.message}`.trim());
  }
  return { ok: false, attempts: rounds, problems, firstSubmission };
}
