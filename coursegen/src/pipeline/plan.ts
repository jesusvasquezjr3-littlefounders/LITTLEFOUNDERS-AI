// plan stage — blueprint → segment skeleton (COURSE_ENGINE.md §4).
// DeepSeek, temp 0.3, JSON mode. MIX RULES are enforced by a deterministic
// planRepair() BEFORE any LLM retry is spent — cheaper and more reliable
// than hoping the model self-corrects.

import { z } from 'zod';
import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { resolveAllowedTypes, renderPalette } from './prompts/palette.js';
import { TYPE_TO_FAMILY, CONTENT_TYPES, MONEY_TYPES, FLOW_TYPES, type FamilyName } from '../contract/registry.js';
import type { TaxonomyFile } from '../catalog/schema.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues } from './correctiveRetry.js';

export const MIN_SEGMENTS = 8;
export const MAX_SEGMENTS = 14;
export const MIN_DISTINCT_TYPES = 5;
export const MAX_STORYPLAY_FLOWS = 1;
const MAX_PLAN_ATTEMPTS = 3;

export const planSegmentSchema = z.object({
  type: z.string().min(1).max(60),
  brief: z.string().min(1).max(400),
});
export const planSkeletonSchema = z.object({
  segments: z.array(planSegmentSchema).min(MIN_SEGMENTS).max(MAX_SEGMENTS),
});
export type PlanSegment = z.infer<typeof planSegmentSchema>;
export type PlanSkeleton = z.infer<typeof planSkeletonSchema>;

// Spaced-review layer (COURSE_ENGINE.md §3.1) — review-kind topics ground
// their plan/write prompts in the teaching topics they consolidate.
export type ReviewTopicKind = 'review_spaced' | 'review_interleaved' | 'review_quest';

export interface ReviewSourceSummary {
  path: string;
  concept: string;
  learningObjective: string;
  keyVocabulary: string[];
}

export interface PlanReviewContext {
  kind: ReviewTopicKind;
  sources: ReviewSourceSummary[];
}

/** Difficulty ceiling communicated to the model for review-kind lessons. */
export const REVIEW_DIFFICULTY_CAP: Record<ReviewTopicKind, 1 | 2 | 3 | 4 | 5> = {
  review_spaced: 2,
  review_interleaved: 2,
  review_quest: 3,
};

export const CONSOLIDATION_INSTRUCTION =
  'CONSOLIDATION LESSON: retrieval and application ONLY — never introduce a concept absent from the sources.';
export const INTERLEAVE_INSTRUCTION = 'Interleave at least 2 distinct source topics within this lesson plan.';

/** COURSE_ENGINE.md §3.1/§4 — connect-to-prior. Never a cold restart. */
export function connectToPriorInstruction(prior: string): string {
  return (
    `CONNECT TO PRIOR: this lesson must OPEN by explicitly linking to what was just learned — "${prior}". ` +
    'Do NOT restart cold or generic; the first story segment must reference or build on this.'
  );
}

export function registerToneInstruction(toneDirectiveEs: string): string {
  return `AUDIENCE REGISTER (adult): ${toneDirectiveEs}`;
}

export function effectiveDifficulty(ctx: PlanContext): 1 | 2 | 3 | 4 | 5 {
  if (!ctx.review) return ctx.lesson.difficulty;
  return Math.min(ctx.lesson.difficulty, REVIEW_DIFFICULTY_CAP[ctx.review.kind]) as 1 | 2 | 3 | 4 | 5;
}

export function renderReviewSourcesBlock(sources: readonly ReviewSourceSummary[]): string {
  return sources
    .map(
      (s, i) =>
        `${i + 1}. [${s.path}] concept: ${s.concept}\n   objective: ${s.learningObjective}\n   vocabulary: ${s.keyVocabulary.join(', ')}`,
    )
    .join('\n');
}

export interface PlanContext {
  tier: string;
  taxonomy: TaxonomyFile;
  courseTitle: string;
  adventureNarrativeArc: string;
  topic: {
    concept: string;
    learningObjective: string;
    keyVocabulary: string[];
    priorKnowledge: string;
    factRefs: string[];
  };
  lesson: {
    microObjective: string;
    narrativeBeat: string;
    difficulty: 1 | 2 | 3 | 4 | 5;
    suggestedFamilies: string[];
  };
  /** Present only for review_spaced/review_interleaved/review_quest topics. */
  review?: PlanReviewContext;
  /**
   * Connect-to-prior (COURSE_ENGINE.md §3.1/§4): the previous slot's
   * micro_objective in the linear walk — same topic's previous lesson, or
   * the last lesson of the previous topic when this lesson is position 1.
   * Undefined ONLY for the course's very first lesson (exempt).
   */
  prior?: string;
  /** Audience registers (COURSE_ENGINE.md §3.3). Absent = kid, no prompt changes. */
  register?: { fullPalette: boolean; toneDirectiveEs?: string };
}

export interface PlanResult {
  skeleton: PlanSkeleton;
  allowedTypes: string[];
  fixes: string[];
  attempts: number;
}

function isMoneyRequired(ctx: PlanContext): boolean {
  return ctx.topic.factRefs.length > 0 || ctx.lesson.suggestedFamilies.includes('money');
}

// Deterministic fallback pool, most-generic-first per family — used only to
// repair violations, never to author real content.
const REPAIR_POOL_BY_FAMILY: Record<FamilyName, string[]> = {
  story: ['story_scene', 'story_dialogue', 'key_ideas', 'concept_reveal', 'checkpoint'],
  choice: ['quiz_mcq', 'true_false', 'picture_choice', 'odd_one_out', 'best_decision', 'yes_no_cases'],
  input: ['type_answer', 'number_input', 'fill_blank', 'count_objects'],
  arrange: ['match_pairs', 'sort_buckets', 'order_steps', 'timeline_order'],
  money: ['coin_count', 'needs_wants', 'price_compare', 'make_change'],
  analyze: ['spot_error', 'fact_opinion', 'cause_effect'],
  storyplay: ['would_you_rather'],
  maker: ['measure_read', 'balance_scale'],
};

function familyRepairCandidates(family: FamilyName, allowed: ReadonlySet<string>): string[] {
  return REPAIR_POOL_BY_FAMILY[family].filter((t) => allowed.has(t));
}

function anyRepairCandidate(allowed: ReadonlySet<string>, exclude: ReadonlySet<string> = new Set()): string {
  for (const family of Object.keys(REPAIR_POOL_BY_FAMILY) as FamilyName[]) {
    for (const candidate of REPAIR_POOL_BY_FAMILY[family]) {
      if (allowed.has(candidate) && !exclude.has(candidate)) return candidate;
    }
  }
  // Last resort: first allowed type at all.
  const first = Array.from(allowed).find((t) => !exclude.has(t));
  return first ?? Array.from(allowed)[0] ?? 'quiz_mcq';
}

/**
 * Deterministic MIX RULES repair (COURSE_ENGINE.md §4):
 *  1. Every segment.type must be in the allowed palette.
 *  2. First segment must be a `story` family (content) type.
 *  3. At least MIN_DISTINCT_TYPES distinct types across the lesson.
 *  4. At least one money-family segment when the topic/lesson requires it.
 *  5. At most MAX_STORYPLAY_FLOWS storyplay-family flow segments.
 */
export function planRepair(
  skeleton: PlanSkeleton,
  allowedTypes: readonly string[],
  moneyRequired: boolean,
): { skeleton: PlanSkeleton; fixes: string[] } {
  const allowed = new Set(allowedTypes);
  const fixes: string[] = [];
  const segments = skeleton.segments.map((s) => ({ ...s }));

  // Rule 1: unknown/disallowed types → nearest same-family fallback, else any candidate.
  for (const seg of segments) {
    if (allowed.has(seg.type)) continue;
    const family = TYPE_TO_FAMILY.get(seg.type);
    const candidate = family ? familyRepairCandidates(family, allowed)[0] : undefined;
    const replacement = candidate ?? anyRepairCandidate(allowed);
    fixes.push(`replaced disallowed type "${seg.type}" with "${replacement}"`);
    seg.type = replacement;
  }

  // Rule 2: first segment must be `story` family.
  const firstIsStory = segments.length > 0 && CONTENT_TYPES.includes(segments[0]!.type);
  if (!firstIsStory) {
    const laterStoryIndex = segments.findIndex((s) => CONTENT_TYPES.includes(s.type));
    if (laterStoryIndex > 0) {
      const [storySeg] = segments.splice(laterStoryIndex, 1);
      segments.unshift(storySeg!);
      fixes.push(`moved story segment from position ${laterStoryIndex + 1} to the front`);
    } else {
      const openerType = familyRepairCandidates('story', allowed)[0] ?? 'story_scene';
      segments.unshift({ type: openerType, brief: 'Narrative opener introducing the lesson concept.' });
      fixes.push(`inserted missing story opener "${openerType}"`);
    }
  }

  // Rule 5: at most MAX_STORYPLAY_FLOWS storyplay flow segments.
  let storyplayFlowSeen = 0;
  for (const seg of segments) {
    const family = TYPE_TO_FAMILY.get(seg.type);
    if (family === 'storyplay' && FLOW_TYPES.has(seg.type)) {
      storyplayFlowSeen++;
      if (storyplayFlowSeen > MAX_STORYPLAY_FLOWS) {
        const replacement = familyRepairCandidates('choice', allowed)[0] ?? anyRepairCandidate(allowed);
        fixes.push(`demoted extra storyplay flow "${seg.type}" to "${replacement}"`);
        seg.type = replacement;
      }
    }
  }

  // Rule 4: money-family segment required.
  if (moneyRequired && !segments.some((s) => MONEY_TYPES.includes(s.type))) {
    const candidate = familyRepairCandidates('money', allowed)[0];
    if (candidate) {
      // Replace the last graded (non-story) segment to avoid displacing the opener.
      const targetIndex = [...segments].reverse().findIndex((s) => !CONTENT_TYPES.includes(s.type));
      const idx = targetIndex === -1 ? segments.length - 1 : segments.length - 1 - targetIndex;
      fixes.push(`replaced "${segments[idx]!.type}" at position ${idx + 1} with required money-family type "${candidate}"`);
      segments[idx]!.type = candidate;
    }
  }

  // Rule 3: minimum distinct types — fill from unused allowed types, preferring graded ones.
  const distinctCount = () => new Set(segments.map((s) => s.type)).size;
  if (distinctCount() < MIN_DISTINCT_TYPES) {
    const used = new Set(segments.map((s) => s.type));
    const unused = allowedTypes.filter((t) => !used.has(t) && !CONTENT_TYPES.includes(t));
    // Replace duplicate-type segments (scanning from the end) with unused types.
    const seenOnce = new Set<string>();
    for (let i = segments.length - 1; i >= 0 && distinctCount() < MIN_DISTINCT_TYPES; i--) {
      const seg = segments[i]!;
      if (CONTENT_TYPES.includes(seg.type)) continue; // never touch story segments here
      if (!seenOnce.has(seg.type)) {
        seenOnce.add(seg.type);
        continue; // keep the first (last-scanned) occurrence of each type
      }
      const replacement = unused.shift();
      if (!replacement) break;
      fixes.push(`diversified duplicate "${seg.type}" at position ${i + 1} into "${replacement}"`);
      seg.type = replacement;
      used.add(replacement);
    }
  }

  return { skeleton: { segments }, fixes };
}

function buildPlanMessages(ctx: PlanContext, paletteText: string, issues: string | undefined) {
  const system =
    'You are Forge, the lesson-planning stage of a financial-literacy platform for children (LittleFounders). ' +
    'You output ONLY strict JSON matching the requested shape — no prose, no markdown fences. ' +
    'Never invent numeric facts; the writer stage will ground numbers, you only plan segment TYPES and one-sentence BRIEFS.';

  const rules = [
    `Produce ${MIN_SEGMENTS}-${MAX_SEGMENTS} segments as {"segments":[{"type":"...","brief":"..."}]}.`,
    'The FIRST segment must be a `story` family type (story_dialogue, story_scene, key_ideas, concept_reveal or checkpoint).',
    'Teach before you test: introduce a concept with a story/content segment before any graded segment that exercises it.',
    `Use at least ${MIN_DISTINCT_TYPES} DISTINCT segment types across the lesson.`,
    isMoneyRequired(ctx)
      ? 'This topic touches money — include AT LEAST ONE segment from the `money` family.'
      : undefined,
    `At most ${MAX_STORYPLAY_FLOWS} segment(s) from the storyplay family (flows are long — do not overload a single lesson).`,
    'Ramp difficulty roughly low→high across the lesson (the WRITE stage assigns exact difficulty 1-5 per segment).',
    'Use ONLY the type ids listed in the palette below — nothing else.',
    ctx.review ? CONSOLIDATION_INSTRUCTION : undefined,
    ctx.review && (ctx.review.kind === 'review_interleaved' || ctx.review.kind === 'review_quest')
      ? INTERLEAVE_INSTRUCTION
      : undefined,
    ctx.prior ? connectToPriorInstruction(ctx.prior) : undefined,
    ctx.register?.toneDirectiveEs ? registerToneInstruction(ctx.register.toneDirectiveEs) : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .map((line, i) => `${i + 1}. ${line}`)
    .join('\n');

  const context = [
    `Course: ${ctx.courseTitle}`,
    `Adventure arc: ${ctx.adventureNarrativeArc}`,
    `Age tier: ${ctx.tier}`,
    `Topic concept: ${ctx.topic.concept}`,
    `Learning objective: ${ctx.topic.learningObjective}`,
    `Key vocabulary: ${ctx.topic.keyVocabulary.join(', ')}`,
    `Prior knowledge: ${ctx.topic.priorKnowledge}`,
    `Lesson micro-objective: ${ctx.lesson.microObjective}`,
    `Narrative beat: ${ctx.lesson.narrativeBeat}`,
    `Target difficulty: ${effectiveDifficulty(ctx)}/5`,
    `Suggested families: ${ctx.lesson.suggestedFamilies.join(', ') || '(none specified)'}`,
  ].join('\n');

  const reviewBlock = ctx.review
    ? [
        '',
        `SOURCE TOPICS (this is a ${ctx.review.kind} review lesson — ground every segment in these, introduce nothing new):`,
        renderReviewSourcesBlock(ctx.review.sources),
      ].join('\n')
    : '';

  const user = [
    'MIX RULES:',
    rules,
    '',
    'LESSON CONTEXT:',
    context,
    reviewBlock,
    '',
    'PALETTE (allowed types for this age tier only):',
    paletteText,
  ].join('\n');

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];

  if (issues) {
    messages.push({
      role: 'user' as const,
      content: `Your previous JSON was invalid. Fix these issues and resend the FULL corrected JSON:\n${issues}`,
    });
  }

  return messages;
}

export interface PlanDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

/**
 * QA/authoring override (COURSE_ENGINE.md §4 addendum) — builds a
 * `PlanSkeleton` directly from a catalog lesson's `forced_types`, bypassing
 * `planLesson`'s DeepSeek call and MIX RULES entirely (no MIN_SEGMENTS/
 * MIN_DISTINCT_TYPES enforcement — this is a deliberate, hand-pinned
 * skeleton, not a model-authored one). `write`/`gates`/`review`/`localize`/
 * `images`/`publish` all still run unchanged downstream, so this exercises
 * the real content-authoring pipeline for exactly the requested type(s)
 * while making per-type coverage deterministic and cheap to verify.
 */
export function buildForcedSkeleton(types: readonly string[], microObjective: string): PlanSkeleton {
  return {
    segments: types.map((type) => ({
      type,
      brief: `Práctica aislada del tipo "${type}" — ${microObjective}`,
    })),
  };
}

export async function planLesson(ctx: PlanContext, deps: PlanDeps = {}): Promise<PlanResult> {
  const complete = deps.complete ?? completeDeepSeek;
  const { allowed } = resolveAllowedTypes(ctx.taxonomy, ctx.tier, { fullPalette: ctx.register?.fullPalette });
  const paletteText = renderPalette(allowed);
  const moneyRequired = isMoneyRequired(ctx);

  const { data, attempts } = await withCorrectiveRetry<PlanSkeleton>({
    maxAttempts: MAX_PLAN_ATTEMPTS,
    callModel: async (issues) => {
      const messages = buildPlanMessages(ctx, paletteText, issues);
      const result = await complete({ messages, temperature: 0.3, jsonMode: true }, { operation: 'plan', ledger: deps.ledger });
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: `invalid JSON: ${json.error}` };
      const parsed = planSkeletonSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssues(parsed.error.issues) };
      return { ok: true, data: parsed.data };
    },
  });

  const { skeleton, fixes } = planRepair(data, allowed, moneyRequired);
  return { skeleton, allowedTypes: allowed, fixes, attempts };
}
