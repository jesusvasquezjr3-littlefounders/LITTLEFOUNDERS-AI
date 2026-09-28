// The v2 lesson plan: what Appendix C Stage 0 (scoping) and Stage 1
// (authoring) hand to the emitter for ONE lesson (S05.4c).
//
// Stage 0 fixes the identity, age pathway, knowledge components, segment
// kinds with their locale-neutral numbers, and the private rubrics. Stage 1
// supplies every learner-visible string per market (`copy`). In a live
// generation run a model would author the copy (owner-run, OD-23); in the
// zero-spend dry-run the plan carries fixture copy, so the emitter, the gates
// and Core's validation run on real documents with no model call.
//
// The plan also carries the lesson-policy declarations that gates 14-16 need
// (B.17 `new_concepts`, B.11 `mentor_misjudgment`, B.16 `regional`), exactly
// like a v1 lesson blueprint does.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { marketScenarioSchema } from '../catalog/schema.js';
import { V2_AGE_BANDS, V2_ID, V2_SEGMENT_TYPES, type V2SegmentType } from './contract.js';

const id = z.string().regex(V2_ID);
const localized = <T extends z.ZodType>(value: T) =>
  z.object({ 'en-US': value, 'es-MX': value, 'pt-BR': value }).strict();

/**
 * Learner-visible strings of one segment in one market: the prompt, the
 * optional help ladder (up to two Mentor turns, shown on request), plus string
 * fields merged into the payload.
 */
const segmentCopySchema = z
  .object({ prompt: z.string().trim().min(1).max(500), help: z.array(z.string().trim().min(1).max(160)).min(1).max(2).optional() })
  .catchall(z.unknown());

export const v2PlanSegmentSchema = z
  .object({
    id,
    type: z.enum(V2_SEGMENT_TYPES as [V2SegmentType, ...V2SegmentType[]]),
    grading: z.enum(['server', 'none']),
    visual: z.object({ type: z.string().min(1).max(40) }).strict(),
    /** Locale-neutral payload: numbers, enums and structure. Strings come from `copy`. */
    payload: z.record(z.string(), z.unknown()),
    /** Private rubric: goes to answer_keys, never into the public document. */
    rubric: z.record(z.string(), z.unknown()).optional(),
    /**
     * B.16 / F-06 (GAP-FIX-R1): a per-market rubric, when a market's scenario
     * changes the answer (its own prices or amounts). Each locale's answer
     * keys are written from its own entry; it replaces `rubric`.
     */
    rubric_by_locale: localized(z.record(z.string(), z.unknown())).optional(),
    /** Appendix C 1.1 (GAP-FIX-R1): practice or transfer item, and the KC it evidences. */
    item_role: z.enum(['practice', 'transfer']).optional(),
    item_phase: z.enum(['pre', 'post']).optional(),
    variant: z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/).optional(),
    knowledge_component_id: id.optional(),
    copy: localized(segmentCopySchema),
  })
  .strict()
  .superRefine((segment, ctx) => {
    if (segment.grading === 'server' && !segment.rubric && !segment.rubric_by_locale) ctx.addIssue({ code: 'custom', path: ['rubric'], message: 'a server-graded segment needs its private rubric' });
    if (segment.rubric && segment.rubric_by_locale) ctx.addIssue({ code: 'custom', path: ['rubric_by_locale'], message: 'use either one rubric or one per market, not both' });
    if (segment.grading === 'none' && (segment.rubric || segment.rubric_by_locale)) ctx.addIssue({ code: 'custom', path: ['rubric'], message: 'an ungraded segment carries no rubric' });
  });

export const v2LessonPlanSchema = z
  .object({
    plan_version: z.literal(1),
    course_id: id,
    pathway_id: id,
    chapter_id: id,
    lesson_id: id,
    age_band: z.enum(V2_AGE_BANDS),
    eligibility: z.object({ minimum_age: z.number().int().min(0).max(119), maximum_age: z.number().int().min(0).max(119) }).strict(),
    knowledge_component_ids: z.array(id).min(1),
    adventure_scene_id: id,
    mentor_stage: z.object({ character: z.enum(['rho', 'zara', 'liruf', 'dina']), scene: z.enum(['diorama-a', 'diorama-b']) }).strict().optional(),
    /** Stage 1 author brief in the authoring market (es-MX): the situation this lesson teaches through. */
    brief: z.string().trim().min(20).max(600),
    title: localized(z.string().trim().min(1).max(120)),
    /** B.17: the genuinely new concepts this lesson introduces ([] for practice). Required: undeclared density blocks. */
    new_concepts: z.array(id).max(12),
    /** B.11: a flagged mentor misjudgment-and-recovery episode. */
    mentor_misjudgment: z
      .object({ character: z.enum(['rho', 'zara', 'liruf', 'dina']), misjudgment: z.string().min(20).max(400), recovery: z.string().min(20).max(400) })
      .strict()
      .optional(),
    /** B.16: one scenario per market, or an explicit market-neutral claim. */
    regional: z.union([
      z.object({ universal: z.string().trim().min(10).max(300) }).strict(),
      z.object({ scenarios: localized(marketScenarioSchema) }).strict(),
    ]),
    representation_progressions: z.array(z.unknown()).max(20).optional(),
    segments: z.array(v2PlanSegmentSchema).min(1).max(80),
  })
  .strict();

export type V2LessonPlan = z.infer<typeof v2LessonPlanSchema>;
export type V2PlanSegment = z.infer<typeof v2PlanSegmentSchema>;

export interface LoadedPlan {
  file: string;
  plan?: V2LessonPlan;
  errors: string[];
}

/** Every `*.json` plan in a directory, parsed; a malformed plan is reported, never skipped silently. */
export function loadV2Plans(dir: string): LoadedPlan[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const full = path.join(dir, file);
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(full, 'utf8'));
      } catch (error) {
        return { file, errors: [`not valid JSON: ${(error as Error).message}`] };
      }
      // A red-team sample wraps its plan as { expected_gate, note, plan } so the
      // same command demonstrates each block (Appendix C DoD "Gated").
      if (raw && typeof raw === 'object' && 'expected_gate' in raw && 'plan' in raw) raw = (raw as { plan: unknown }).plan;
      const parsed = v2LessonPlanSchema.safeParse(raw);
      if (!parsed.success) return { file, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(plan)'}: ${issue.message}`) };
      return { file, plan: parsed.data, errors: [] };
    });
}
