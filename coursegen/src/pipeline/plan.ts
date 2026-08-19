// plan stage — blueprint → segment skeleton (COURSE_ENGINE.md §4).
// DeepSeek, temp 0.3, JSON mode.
//
// MIX RULES are enforced by REPLANNING first and repairing only as a last
// resort. The deterministic `planRepair()` used to run alone, on the reasoning
// that it was cheaper than hoping the model self-corrects — but it can only
// change a segment's TYPE, and a plan is a type AND a brief. Retyping in place
// left the brief describing a mechanic the segment no longer was, and the
// writer dutifully authored the mismatch: the owner's 2026-08-15 report of
// "preguntas que salen de la nada". Feeding the violation back costs one cheap
// DeepSeek call, only when a rule was actually broken, and fixes both halves.

import { z } from 'zod';
import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { resolveAllowedTypes, renderPalette } from './prompts/palette.js';
import { TYPE_TO_FAMILY, CONTENT_TYPES, MONEY_TYPES, FLOW_TYPES, type FamilyName } from '../contract/registry.js';
import type { TaxonomyFile } from '../catalog/schema.js';
import type { CompetencyPromptContext } from '../catalog/competencyGraph.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues, CorrectiveRetryExhaustedError } from './correctiveRetry.js';

export const MIN_SEGMENTS = 8;
/*
 * A 10-minute lesson must feel compact, and the full-document author must be
 * able to complete every planned segment without salvage. The old 14-segment
 * ceiling produced saturated lessons and repeatedly encouraged a model to
 * drop the tail of its own blueprint. Ten is enough for story, retrieval,
 * application and reflection while keeping one author response tractable.
 */
export const MAX_SEGMENTS = 10;
export const MIN_DISTINCT_TYPES = 5;
export const MAX_STORYPLAY_FLOWS = 1;
const MAX_PLAN_ATTEMPTS = 3;

export const planSegmentSchema = z.object({
  type: z.string().min(1).max(60),
  brief: z.string().min(1).max(400),
  /**
   * Set by `planRepair` ONLY, never by the model: the type this segment had
   * when its `brief` was written, before a last-resort mix-rule repair changed
   * it. The brief then describes a DIFFERENT mechanic than the one that will be
   * authored, and the writer is told so explicitly (see write.ts).
   *
   * This is the "question out of nowhere" bug (owner report 2026-08-15). The
   * repair used to rewrite `seg.type` in five places and never touch
   * `seg.brief`, so a brief written for a decision quiz — "Zara decide si sube
   * el precio de la limonada" — could arrive at the writer typed as
   * `piggy_split`. The writer then had to invent a jar-splitting exercise with
   * no relationship to the narrative the lesson had just set up, and it landed
   * at the END of the lesson because both the money rule and the diversify rule
   * scan from the back. Mix-rule violations are now fed back to the PLANNER
   * first (which re-plans a coherent brief for the corrected type); this flag
   * only marks the cases where every replan attempt still failed.
   */
  retypedFrom: z.string().min(1).max(60).optional(),
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

/**
 * COURSE_ENGINE.md §3.1/§4 — connect-to-prior. Never a cold restart.
 *
 * Production incident 2026-08-03: the judge's concreteness dimension kept
 * failing lessons whose opener DID mention the prior lesson — e.g. "como
 * hiciste al emparejar tus objetos en la isla" — but only as narrative flavor
 * ("a vague callback [that] doesn't REINVOKE or BUILD ON the mechanic — it
 * just references it narratively", per judge notes). The old wording ("must
 * reference or build on this") let the model satisfy the weaker half of that
 * either/or. The judge's actual bar is the STRONGER half only: an explicit
 * RETRIEVAL moment that makes the child reapply the same skill, not a
 * reference to the prior scene/characters/setting. Spell that out instead of
 * leaving it to be inferred.
 */
export function connectToPriorInstruction(prior: string): string {
  return (
    `CONNECT TO PRIOR: this lesson must OPEN with an EXPLICIT RETRIEVAL of the specific skill from the prior lesson's ` +
    `micro-objective — "${prior}" — NOT a narrative callback to the prior scene/characters/setting. ` +
    'A retrieval moment makes the child ACTIVELY REAPPLY that same skill right now (e.g. a direct recall line like ' +
    '"Recuerda: la última vez emparejaste X con Y — ¿qué harías con estos dos?", or the first exercise re-exercising ' +
    'the same mechanic before moving on). Merely mentioning that something happened before ("como hiciste en la isla", ' +
    '"recuerdas cuando...") WITHOUT making the child redo or restate the skill itself does NOT satisfy this rule — ' +
    'the callback must be functional, not decorative.'
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

/** Render the per-topic graph slice after the stable prompt prefix. */
export function renderCompetencyGraphBlock(context: CompetencyPromptContext, emptyIncomingLine?: string): string {
  const current = [
    `CURRENT COMPETENCY [${context.current.topicPath}] (${context.current.role})`,
    `concept: ${context.current.concept}`,
    `objective: ${context.current.objective}`,
    `vocabulary: ${context.current.vocabulary.join(', ') || '(none)'}`,
    `evidence: ${context.current.evidence}`,
  ].join('\n');
  const incoming = context.incoming.length === 0
    ? (emptyIncomingLine ?? 'No earlier competency edge; this is a graph root and must establish the concept from first principles.')
    : context.incoming
        .map(
          (edge, index) =>
            `${index + 1}. [${edge.kind}/${edge.strength}] ${edge.source.topicPath} — ${edge.source.concept}\n` +
            `   objective: ${edge.source.objective}\n` +
            `   vocabulary: ${edge.source.vocabulary.join(', ') || '(none)'}\n` +
            `   why: ${edge.reason}`,
        )
        .join('\n');
  return [
    'COMPETENCY GRAPH CONTEXT (deterministic; do not invent or skip these edges):',
    current,
    'EARLIER COMPETENCIES CONNECTED TO THIS TOPIC:',
    incoming,
    'GRAPH AUTHORING RULES:',
    '- Respect every hard edge: do not assume a concept the learner has not encountered; briefly bridge it or keep the exercise within the prerequisite boundary.',
    '- Use sequence edges to connect the opening to prior learning without restarting cold.',
    '- For retrieval edges, retrieve and apply the cited competency; do not introduce a new concept in a review lesson.',
  ].join('\n');
}

/**
 * The competency block a prompt actually sends. For review lessons the graph
 * derives one retrieval edge per `review_of` source and resolveReviewSources
 * renders those SAME topics in the SOURCE TOPICS block — so the retrieval edges
 * duplicated 100% of the source material (measured 21,754 chars of repeated
 * text on a 48-edge review prompt, resent on every retry) for zero information
 * gain. Retrieval edges whose source topic already appears in the review
 * sources are omitted; prerequisite/sequence edges and unmatched retrieval
 * edges survive. Block ORDER in the prompt is untouched (prefix-cache
 * discipline), and non-review lessons render exactly as before.
 */
export function renderCompetencyBlockForPrompt(
  competency: CompetencyPromptContext | undefined,
  review: PlanReviewContext | undefined,
): string | undefined {
  if (!competency) return undefined;
  if (!review) return renderCompetencyGraphBlock(competency);
  const sourcePaths = new Set(review.sources.map((source) => source.path));
  const incoming = competency.incoming.filter(
    (edge) => !(edge.kind === 'retrieval' && sourcePaths.has(edge.source.topicPath)),
  );
  if (incoming.length === competency.incoming.length) return renderCompetencyGraphBlock(competency);
  if (incoming.length === 0) {
    // Never let the deduped block claim "graph root / first principles" — that
    // would contradict the consolidation directive the review lesson carries.
    return renderCompetencyGraphBlock(
      { ...competency, incoming },
      'Every incoming retrieval edge cites a topic already listed under SOURCE TOPICS below — retrieve from that block; this topic is NOT a graph root.',
    );
  }
  return renderCompetencyGraphBlock({ ...competency, incoming });
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
  /** Derived per-topic competency graph context; authored YAML remains the source of truth. */
  competency?: CompetencyPromptContext;
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

const NUMERIC_TYPE_ANSWER_MARKERS = /\b(?:cu[aá]nt[oa]s?|total|suma|resultado|calcula|n[uú]mero|pesos?|monedas?|\d+)\b/i;
const SPEED_TAP_ITEM_COUNT_MARKER = /\b(?:[6-9]|1[0-4]|seis|siete|ocho|nueve|diez|once|doce|trece|catorce)\b/i;

/** Types whose interaction contract constrains which briefs can honestly author them. */
function briefFitsType(type: string, brief: string): boolean {
  if (type === 'type_answer') return NUMERIC_TYPE_ANSWER_MARKERS.test(brief);
  if (type === 'speed_tap') return SPEED_TAP_ITEM_COUNT_MARKER.test(brief);
  return true;
}

/*
 * The ONLY way a repair may change a segment's type. Assigning `seg.type`
 * directly silently divorces the segment from its `brief`, which was written
 * for the OLD mechanic — the "question out of nowhere" bug (owner report
 * 2026-08-15). Recording the original type is what lets write.ts tell the
 * author, in the prompt, that the brief describes a different exercise and
 * must be re-anchored rather than transcribed.
 *
 * `retypedFrom` always holds the type the BRIEF was written for, so two
 * successive repairs of one segment do not lose the origin — and a repair
 * that lands back on the original type clears the flag, because then the
 * brief and the type agree again.
 */
function retype(segment: PlanSegment, next: string): void {
  if (segment.type === next) return;
  segment.retypedFrom ??= segment.type;
  segment.type = next;
  if (segment.retypedFrom === segment.type) delete segment.retypedFrom;
}

function repairSemanticTypeConstraints(segments: PlanSegment[], allowed: ReadonlySet<string>, fixes: string[]): void {
  for (const segment of segments) {
    if (segment.type === 'type_answer' && !briefFitsType(segment.type, segment.brief)) {
      const replacement = allowed.has('quiz_mcq') ? 'quiz_mcq' : anyRepairCandidate(allowed);
      fixes.push(`replaced open-ended type_answer with "${replacement}" because its brief is not numeric applied practice`);
      retype(segment, replacement);
    }
    if (segment.type === 'speed_tap' && !briefFitsType(segment.type, segment.brief)) {
      const replacement = allowed.has('quiz_mcq') ? 'quiz_mcq' : anyRepairCandidate(allowed);
      fixes.push(`replaced underspecified speed_tap with "${replacement}" because its brief does not require 6-14 items`);
      retype(segment, replacement);
    }
  }
}

/**
 * The MIX RULES, expressed as a read-only INSPECTION in the planner's own
 * vocabulary. Returned strings are fed straight back into the next plan call.
 *
 * Why inspect before repairing: the repair can only change a segment's TYPE,
 * and a type is half of a plan — the other half is the `brief`, which the
 * repair cannot rewrite. Re-planning fixes both at once, for the price of one
 * cheap DeepSeek call, and only when a rule was actually broken. The
 * deterministic repair stays as the last-resort net beneath it.
 */
export function describeMixRuleViolations(
  skeleton: PlanSkeleton,
  allowedTypes: readonly string[],
  moneyRequired: boolean,
): string[] {
  const allowed = new Set(allowedTypes);
  const segments = skeleton.segments;
  const issues: string[] = [];

  for (const [i, seg] of segments.entries()) {
    if (!allowed.has(seg.type)) {
      issues.push(`segment ${i + 1} uses type "${seg.type}", which is not in the PALETTE — pick a palette type and write a brief that genuinely fits it`);
    } else if (!briefFitsType(seg.type, seg.brief)) {
      issues.push(
        seg.type === 'type_answer'
          ? `segment ${i + 1} is type_answer but its brief is not one-step numeric practice — either name the exact number the child types, or choose a different type`
          : `segment ${i + 1} is speed_tap but its brief does not call for 6-14 short items with a concrete matching rule — fix the brief or choose a different type`,
      );
    }
  }

  if (segments.length > 0 && !CONTENT_TYPES.includes(segments[0]!.type)) {
    issues.push('segment 1 must be a `story` family type that introduces the concept before anything is graded');
  }

  const flows = segments.filter((s) => TYPE_TO_FAMILY.get(s.type) === 'storyplay' && FLOW_TYPES.has(s.type)).length;
  if (flows > MAX_STORYPLAY_FLOWS) {
    issues.push(`${flows} storyplay flow segments — at most ${MAX_STORYPLAY_FLOWS} is allowed; replace the extras with shorter exercise types`);
  }

  if (moneyRequired && !segments.some((s) => MONEY_TYPES.includes(s.type))) {
    issues.push('this topic touches money but no `money` family segment is planned — add one, with a brief built around the money situation');
  }

  const distinct = new Set(segments.map((s) => s.type)).size;
  if (distinct < MIN_DISTINCT_TYPES) {
    issues.push(`only ${distinct} distinct types — use at least ${MIN_DISTINCT_TYPES}, giving each new type a brief written for that mechanic`);
  }

  return issues;
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
    retype(seg, replacement);
  }

  // Type-specific minimums and interaction semantics are part of the plan,
  // not something the writer can safely infer after spending a full response.
  // A prose/open-answer brief cannot satisfy type_answer's numeric contract,
  // and speed_tap is not a five-item recap; demote either to a simple choice
  // exercise before authoring rather than buying a predictable invalid draft.
  repairSemanticTypeConstraints(segments, allowed, fixes);

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
        retype(seg, replacement);
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
      retype(segments[idx]!, candidate);
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
      // Semantic fit is re-checked HERE because this rule runs AFTER
      // repairSemanticTypeConstraints: handing a duplicate's untouched brief to
      // type_answer/speed_tap would reintroduce the exact violation that pass
      // just removed, with nothing behind it to re-check.
      const candidateIndex = unused.findIndex((t) => briefFitsType(t, seg.brief));
      if (candidateIndex === -1) continue; // no unused type fits this brief — try the next duplicate
      const [replacement] = unused.splice(candidateIndex, 1);
      fixes.push(`diversified duplicate "${seg.type}" at position ${i + 1} into "${replacement!}"`);
      retype(seg, replacement!);
      used.add(replacement!);
    }
  }

  return { skeleton: { segments }, fixes };
}

/*
 * PREFIX-CACHE DISCIPLINE (AGENTS.md "Mass generation" #12): the rules used
 * to splice per-lesson conditionals MID-LIST and renumber everything, so
 * even the always-true rules changed bytes between a money and a non-money
 * lesson — the shared prefix died a few hundred tokens in, and the ~10KB
 * palette sat at the very END where it could never be cached. Now the
 * numbered list is FROZEN (always-true rules only, fixed numbering), the
 * palette leads the user message (stable per tier within a run), and every
 * conditional lives in an unnumbered LESSON DIRECTIVES block beside the
 * per-lesson context.
 *
 * Hoisted to module scope (was inline in buildPlanMessages) so an
 * out-of-pipeline authoring harness renders the SAME rules rather than
 * keeping a paraphrased second copy that drifts. Pure move — the rendered
 * bytes are unchanged, which the prefix cache depends on.
 */
export const MIX_RULES: readonly string[] = [
  `Produce ${MIN_SEGMENTS}-${MAX_SEGMENTS} segments as {"segments":[{"type":"...","brief":"..."}]}.`,
  'The FIRST segment must be a `story` family type (story_dialogue, story_scene, key_ideas, concept_reveal or checkpoint).',
  'Teach before you test: introduce a concept with a story/content segment before any graded segment that exercises it.',
  'PREMISE QUALITY STARTS HERE: each `brief` must name a CONCRETE, kid-real micro-situation with a decision and a stake — a named character (dina/liruf/rho/zara), a real thing with a price, a choice to make ("Zara debe decidir si sube el precio de la limonada con más clientela"). NEVER a generic "practica la suma" / "pregunta sobre el ahorro". A boring brief produces a boring exercise.',
  `Use at least ${MIN_DISTINCT_TYPES} DISTINCT segment types across the lesson.`,
  `At most ${MAX_STORYPLAY_FLOWS} segment(s) from the storyplay family (flows are long — do not overload a single lesson).`,
  '`type_answer` is NUMERIC applied practice only: use it only for a one-step calculation whose brief names the exact number the child will type. Never plan it for an open-ended sentence, opinion, vocabulary definition, or reflection; use a choice/input type that matches that task instead.',
  '`speed_tap` briefs MUST explicitly call for 6-14 short items and a concrete matching rule; never use it for a two-to-five-example recap.',
  'Ramp difficulty roughly low→high across the lesson (the WRITE stage assigns exact difficulty 1-5 per segment).',
  'Use ONLY the type ids listed in the PALETTE — nothing else.',
];

function buildPlanMessages(ctx: PlanContext, paletteText: string, issues: string | undefined) {
  const system =
    'You are Forge, the lesson-planning stage of a financial-literacy platform for children (LittleFounders). ' +
    'You output ONLY strict JSON matching the requested shape — no prose, no markdown fences. ' +
    'Never invent numeric facts; the writer stage will ground numbers, you only plan segment TYPES and one-sentence BRIEFS.';

  const rules = MIX_RULES.map((line, i) => `${i + 1}. ${line}`).join('\n');

  const directives = [
    isMoneyRequired(ctx)
      ? 'This topic touches money — include AT LEAST ONE segment from the `money` family.'
      : undefined,
    ctx.review ? CONSOLIDATION_INSTRUCTION : undefined,
    ctx.review && (ctx.review.kind === 'review_interleaved' || ctx.review.kind === 'review_quest')
      ? INTERLEAVE_INSTRUCTION
      : undefined,
    ctx.prior ? connectToPriorInstruction(ctx.prior) : undefined,
    ctx.register?.toneDirectiveEs ? registerToneInstruction(ctx.register.toneDirectiveEs) : undefined,
  ].filter((line): line is string => Boolean(line));

  const directivesBlock =
    directives.length > 0
      ? ['', 'LESSON DIRECTIVES (non-negotiable for THIS lesson, same force as the mix rules):', ...directives.map((d) => `- ${d}`)].join('\n')
      : '';

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

  const renderedCompetency = renderCompetencyBlockForPrompt(ctx.competency, ctx.review);
  const competencyBlock = renderedCompetency ? `\n\n${renderedCompetency}` : '';

  const reviewBlock = ctx.review
    ? [
        '',
        `SOURCE TOPICS (this is a ${ctx.review.kind} review lesson — ground every segment in these, introduce nothing new):`,
        renderReviewSourcesBlock(ctx.review.sources),
      ].join('\n')
    : '';

  // Static-first: palette (stable per tier) → frozen mix rules → per-lesson tail.
  const user = [
    'PALETTE (allowed types for this age tier only):',
    paletteText,
    '',
    'MIX RULES:',
    rules,
    directivesBlock,
    '',
    'LESSON CONTEXT:',
    context,
    competencyBlock,
    reviewBlock,
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

  /*
   * MIX-RULE VIOLATIONS ARE A REPLAN, NOT A SILENT MUTATION (owner report
   * 2026-08-15: "hay preguntas que salen de la nada").
   *
   * `planRepair` can only change a segment's TYPE. A plan is a type AND a
   * brief, and the brief is what carries the micro-situation the lesson has
   * been building. Retyping in place kept the mix rules satisfied while
   * handing the writer an exercise mechanic that had nothing to do with the
   * narrative — and both the money rule and the diversify rule pick their
   * victim from the END of the lesson, which is exactly where a child feels a
   * question arrive from nowhere.
   *
   * So a violation now goes back to the planner as feedback, and it re-plans
   * type and brief together. That costs one extra cheap DeepSeek call, only
   * when a rule was actually broken. `planRepair` still runs underneath as the
   * last-resort net for the case where every attempt failed — but it is now a
   * rarity worth logging rather than the normal path.
   *
   * The last contract-VALID skeleton is kept so exhaustion degrades to
   * "repair the best plan we got" instead of killing the slot: a plan whose
   * only fault is a mix-rule violation is still a usable plan.
   */
  let lastValidSkeleton: PlanSkeleton | undefined;
  let planned: { data: PlanSkeleton; attempts: number } | undefined;
  let unresolvedViolations: string[] = [];

  try {
    planned = await withCorrectiveRetry<PlanSkeleton>({
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
        lastValidSkeleton = parsed.data;
        const violations = describeMixRuleViolations(parsed.data, allowed, moneyRequired);
        if (violations.length > 0) {
          unresolvedViolations = violations;
          return {
            ok: false,
            issues: `${violations.join('; ')}. Resend the FULL plan with BOTH the type and its brief corrected — a brief written for the old type is not acceptable.`,
          };
        }
        unresolvedViolations = [];
        return { ok: true, data: parsed.data };
      },
    });
  } catch (err) {
    // Only mix-rule exhaustion may degrade. An unparseable/contract-invalid
    // plan never produced a `lastValidSkeleton`, and that is a real failure.
    if (!(err instanceof CorrectiveRetryExhaustedError) || !lastValidSkeleton) throw err;
  }

  const data = planned?.data ?? lastValidSkeleton!;
  const attempts = planned?.attempts ?? MAX_PLAN_ATTEMPTS;
  const { skeleton, fixes } = planRepair(data, allowed, moneyRequired);
  if (!planned) {
    fixes.unshift(
      `planner could not satisfy the mix rules in ${MAX_PLAN_ATTEMPTS} attempts (${unresolvedViolations.join('; ')}) — ` +
        'fell back to deterministic repair; any retyped segment is flagged for the writer',
    );
  }
  return { skeleton, allowedTypes: allowed, fixes, attempts };
}
