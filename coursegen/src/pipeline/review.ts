// review stage — independent judge (Qwen, decorrelated provider),
// COURSE_ENGINE.md §4. A failing rubric gate (kid_safety/age_fit/concreteness/
// pedagogy/cognitive_engagement/feedback_quality/distractor_quality — see
// passesJudgeGate) triggers a revise call to DeepSeek with the judge's notes,
// then a full re-gate (the 7 deterministic gates must still pass after
// revision) and re-judge. Max 2 revise cycles — after that the slot fails, it
// never silently ships.

import { z } from 'zod';
import { completeQwen } from '../providers/qwen.js';
import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import { runAllGates, type GateContext } from './gates.js';
import { repairDocument, stripNullValues } from './write.js';
import { CONTENT_PLAYBOOK, JUDGE_PLAYBOOK_ANCHORS } from './contentPlaybook.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues } from './correctiveRetry.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';
import { shapeExample } from './shapeExample.js';

// 3 (was 2): the content-playbook judge is strict on engagement AND age-fit at
// once, and a single revise often fixes one while regressing the other (e.g.
// adding reasoning depth drops age_fit). A third cycle gives the author room to
// converge on all dimensions before the slot fails.
export const MAX_REVISE_CYCLES = 3;
const MAX_JUDGE_ATTEMPTS = 2;
const MAX_REVISE_ATTEMPTS = 3;

export const reviewRubricSchema = z.object({
  age_fit: z.number().min(1).max(5),
  pedagogy: z.number().min(1).max(5),
  narrative_quality: z.number().min(1).max(5),
  kid_safety: z.number().min(1).max(5),
  naturalness: z.number().min(1).max(5),
  /**
   * COURSE_ENGINE.md §4 review stage: ≥1 worked concrete instance (a
   * specific number, character or scenario — gate 6b is the deterministic
   * floor, this is the judge's holistic read) AND the lesson opens by
   * connecting to the prior lesson's concept rather than restarting cold.
   * <4 gates the same way age_fit does — see `passesJudgeGate` below.
   */
  concreteness: z.number().min(1).max(5),
  /**
   * Dimensions the 2026-07-22 QA inspection found weakest (cognitive_engagement
   * avg 2.05/5, feedback_quality 2.44, distractor_quality 2.52) — the judge now
   * scores AND gates them so the generator can't ship an exercise whose answer
   * is leaked/trivial, whose wrong-answer feedback teaches nothing, or whose
   * distractors are obviously silly. Non-applicable (no distractors / ungraded
   * content) scores 5. See `passesJudgeGate`.
   */
  cognitive_engagement: z.number().min(1).max(5),
  feedback_quality: z.number().min(1).max(5),
  distractor_quality: z.number().min(1).max(5),
  notes: z.string().min(1).max(2000),
});
export type ReviewRubric = z.infer<typeof reviewRubricSchema>;

export class ReviewFailedError extends Error {
  readonly rubric: ReviewRubric;
  readonly cycles: number;

  constructor(rubric: ReviewRubric, cycles: number) {
    super(
      `review: judge gate failed after ${cycles} revise cycle(s) ` +
        `(kid_safety=${rubric.kid_safety}, age_fit=${rubric.age_fit}, concreteness=${rubric.concreteness}, ` +
        `pedagogy=${rubric.pedagogy}, cognitive_engagement=${rubric.cognitive_engagement}, ` +
        `feedback_quality=${rubric.feedback_quality}, distractor_quality=${rubric.distractor_quality}). Notes: ${rubric.notes}`,
    );
    this.name = 'ReviewFailedError';
    this.rubric = rubric;
    this.cycles = cycles;
  }
}

/**
 * Types whose learning value is NOT a multi-step decision: ungraded narrative
 * beats (content), fluency/automaticity drills (speed/recall IS the task), and
 * pure reading/recognition. The judge's own calibration says to score these on
 * clarity/curiosity/grounding, not on "did the kid make a hard choice" — so a
 * lesson made ENTIRELY of them gets a lower cognitive_engagement floor. A
 * normal reasoning exercise (even one such segment mixed in) keeps the full
 * floor, so real answer-leakage / trivial exercises still fail.
 */
const LOW_DECISION_TYPES = new Set([
  'story_dialogue',
  'story_scene',
  'key_ideas',
  'concept_reveal',
  'checkpoint',
  'speed_tap',
  'memory_flip',
  'lightning_round',
  'flash_match',
  'count_objects',
  'measure_read',
  'read_chart',
  'group_sets',
]);

function passesJudgeGate(rubric: ReviewRubric, document: LessonDocumentParsed, standalone = false): boolean {
  // A lesson made ENTIRELY of low-decision types (content beats, fluency
  // drills, pure reading/recognition) is not a worked-numeric reasoning
  // exercise, so the judge's concreteness ("a worked concrete instance") and
  // cognitive_engagement ("must reason") dimensions are scored against a
  // different bar — its value is a clear, curious, grounded concept, not a
  // hard choice. Relax those two floors for such lessons (the judge's own
  // calibration already says to judge these types on their own terms). Any
  // lesson with a genuine reasoning exercise mixed in keeps the full floors.
  const allLowDecision = document.segments.every((s) => LOW_DECISION_TYPES.has(s.type));
  const concretenessFloor = allLowDecision ? 3 : 4;
  const engagementFloor = allLowDecision ? 2 : 3;
  // Fluency drills (lightning_round/speed_tap/flash_match/memory_flip) have no
  // per-option rationale field, so their feedback IS the aggregate explanation,
  // not per-choice — the judge scores such feedback low. Relax the floor for
  // all-low-decision lessons, matching the concreteness/engagement relaxations.
  const feedbackFloor = allLowDecision ? 2 : 3;
  return (
    rubric.kid_safety >= 5 &&
    // A standalone coverage harness must exercise tier3-only types (compound
    // growth, profit) even on a tier2 course, so age_fit is a coverage artifact
    // here, not a real-learner signal. kid_safety (>=5) stays the hard guard.
    rubric.age_fit >= (standalone ? 2 : 4) &&
    rubric.concreteness >= concretenessFloor &&
    // Quality floor added after the QA inspection: an exercise must actually
    // teach (pedagogy), make the kid think (engagement), explain wrong answers
    // (feedback) and offer plausible distractors — all >= 3 (not below average).
    rubric.pedagogy >= 3 &&
    rubric.cognitive_engagement >= engagementFloor &&
    rubric.feedback_quality >= feedbackFloor &&
    rubric.distractor_quality >= 3
  );
}

async function judgeDocument(
  document: LessonDocumentParsed,
  judge: typeof completeQwen,
  ledger: UsageLedger | undefined,
  priorMicroObjective?: string | null,
): Promise<ReviewRubric> {
  // PREFIX-CACHE DISCIPLINE (AGENTS.md "Mass generation" #12): the judge's
  // rubric/calibrations are ~66% of the prompt and byte-identical across the
  // 345 judge calls of a full run — they live in the SYSTEM message so the
  // provider's implicit context cache serves them as one stable prefix.
  // Everything per-lesson (priorLine, the document, retry notes) stays in the
  // user message, AFTER the prefix.
  const system = [
    'You are an INDEPENDENT quality judge for a children\'s financial-literacy lesson platform (LittleFounders). ' +
      'You did not write this lesson — review it critically. Output ONLY strict JSON, no prose outside the JSON.',
    '',
    // The single most important check: judge what a child SEES rendered, and
    // PROVE the exercise is solvable from the screen. This is what a JSON-only
    // read misses (2026-07-24 render-truth review).
    'BEFORE scoring, do a SOLVABILITY PASS on every graded segment, using ONLY what renders on screen BEFORE answering:',
    'RENDER FACTS: a child sees prompt_md (the instruction), the payload widget, and any image_url illustration. They do NOT see hints until they ask, and NEVER see explanation_md until AFTER answering. Numbers written in prompt_md or shown as structural payload values (a price, a target) are visible; a number that is ONLY inside a token/option/case string is an ANSWER CHOICE, not a given fact.',
    'For each graded segment, RE-DERIVE the correct answer yourself using only the visible facts, then check it equals the answer key. If a fact you NEED (e.g. "each cup costs 5 pesos") appears only in a hint or explanation_md, the exercise is UNSOLVABLE from the screen → set fitness=1 and say so. If the payload cannot actually form the keyed answer (e.g. build_sentence with 2 slots but the answer is a single number "10", or tokens that cannot arrange into it), fitness=1. If two options/tokens render IDENTICAL text but the key binds them to different slots, it is a random-fail → fitness<=2. If the MECHANIC (arrange word tokens into a sentence, drag into a table) does not match the TASK the prompt asks (compute a price, pick the cheaper stand), clarity<=2.',
    'ORDER TYPES (order_steps/rank_choices/build_sentence/timeline_order/code_order): if a task has more than one genuinely-valid ordering, the answer key may carry `answer.accept_orders` — a list of additional orderings that ALSO score full credit. When judging solvability, treat EVERY ordering in `order` + `accept_orders` as correct; do NOT fault a fine-order task for having swappable steps that accept_orders already covers. Only flag order ambiguity when a defensible ordering exists that is NEITHER `order` NOR in `accept_orders`.',
    'PLATFORM: generated images must show objects+setting only — flag any depicted person/human/character. Currency is local (es-MX pesos here). Characters are dina/liruf/rho/zara only; do not fault the absence of others.',
    '',
    'Rate this lesson document 1-5 on each dimension:',
    '- age_fit: is the language/complexity right for the stated age band?',
    '- pedagogy: does it teach the stated concept effectively (concrete-before-abstract, formative feedback)?',
    '- narrative_quality: is the story engaging and coherent with the canon characters?',
    '- kid_safety: is EVERY word appropriate for a young child — no scary, sexual, violent, or otherwise unsafe content, no dark patterns?',
    '- naturalness: does the es-MX text read as natural, warm, native Spanish (not machine-translated)?',
    '- concreteness: does at least one segment contain a WORKED CONCRETE instance (a specific number, a named character, or a specific scenario — not purely abstract phrasing)? AND, unless this is the very first lesson of the course, does the lesson OPEN by connecting explicitly to the prior lesson\'s concept instead of restarting cold?',
    '- cognitive_engagement: does solving REQUIRE genuine thinking? 1 = the answer is stated in the prompt/options or is trivially obvious; 5 = the kid must reason with the concept. Penalize answer leakage hard.',
    '- feedback_quality: does the wrong-answer feedback EXPLAIN why a wrong choice is wrong (per-option or targeted), not a generic "try again"? 1 = generic/absent; 5 = specific and instructive. Score 5 for ungraded content types. ALSO score 5 for SELF-CONTAINED graded types that have NO multiple-choice options (make_change, coin_count, balance_scale, budget_fit, count_objects, number_input, savings_goal, robot_path, memory_flip, number_line, estimate_slider): their feedback is the grader\'s tilt/tally outcome plus the outcome-neutral explanation_md, not per-option rationales — do NOT penalize them for lacking per-option feedback.',
    '- distractor_quality: are the WRONG options plausible-but-wrong (a real misconception), not obviously silly throwaways? 1 = joke/impossible options; 5 = genuinely tempting distractors. Score 5 if the exercise has no multiple-choice options.',
    '',
    'FLUENCY/DRILL CALIBRATION: speed_tap, memory_flip, lightning_round, flash_match, count_objects, measure_read train FLUENCY/AUTOMATICITY — fast recognition/recall of an already-taught concept, which is legitimate learning science. For THESE types score cognitive_engagement on: every item still carries the money concept meaningfully, nothing leaks answers, and the drill is grounded in the story — NOT on multi-step reasoning (speed IS the challenge; do not fail a drill for being a drill). The ungraded `checkpoint` recap is a reflection beat — score its engagement on the quality of the recap/reflective hook, never demand a puzzle. A lesson whose only graded segment is one such drill is a DELIBERATE isolated-practice lesson (QA/practice catalogs use these) — judge it as a drill, not as a full teaching arc.',
    'CONTENT-ONLY LESSON CALIBRATION: a lesson whose segments are ALL story-family types (story_dialogue, story_scene, key_ideas, concept_reveal, checkpoint, eavesdrop — zero graded segments) is a DELIBERATE narrative teaching beat: it introduces/consolidates a concept the FOLLOWING lessons exercise. NEVER score cognitive_engagement low for "no exercise present" — that is its design. Score it instead on: does the story open a genuine curiosity gap, teach through a concrete worked instance inside the narrative, and set up the concept the next lesson will drill? A vivid, curiosity-opening, concretely-grounded story scores 4-5.',
    '',
    JUDGE_PLAYBOOK_ANCHORS,
    '',
    'Respond with EXACTLY: {"age_fit":N,"pedagogy":N,"narrative_quality":N,"kid_safety":N,"naturalness":N,"concreteness":N,"cognitive_engagement":N,"feedback_quality":N,"distractor_quality":N,"notes":"..."}',
    '`notes` must be actionable — if any score is low, say exactly what to fix.',
    'EAVESDROP CALIBRATION: eavesdrop is an overheard conversation whose ==highlighted== money terms carry tap-to-explain notes. Judge it as a story beat AND check: every highlighted term is a REAL expression in this locale (never invented slang), and each note explains its term in kid words without introducing new unexplained jargon.',
  ].join('\n');

  // Ground the "connect to prior lesson" half of concreteness in FACT instead
  // of the judge's guess: undefined = caller didn't say (legacy behavior),
  // null = this IS the course's first lesson (exempt), string = the actual
  // prior micro-objective the opening should connect to. On the first real
  // QA run the judge repeatedly wrote "assuming this isn't the first lesson"
  // and failed lessons on that assumption.
  const priorLine =
    priorMicroObjective === undefined
      ? null
      : priorMicroObjective === null
        ? 'PRIOR-LESSON FACT: this IS the very first lesson of the course — do NOT penalize concreteness for not referencing a previous lesson.'
        : `PRIOR-LESSON FACT: the previous lesson's micro-objective was: "${priorMicroObjective}". Judge the connect-to-prior half of concreteness against THIS, not a guess.`;

  const user = [
    ...(priorLine ? [priorLine, ''] : []),
    'LESSON DOCUMENT:',
    JSON.stringify(document),
  ].join('\n');

  const { data } = await withCorrectiveRetry<ReviewRubric>({
    maxAttempts: MAX_JUDGE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: issues ? `${user}\n\nYour previous reply was invalid JSON: ${issues}. Resend valid JSON only.` : user },
      ];
      const result = await judge({ messages, temperature: 0.2, jsonMode: true }, { operation: 'review', ledger });
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: json.error };
      const parsed = reviewRubricSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssues(parsed.error.issues) };
      return { ok: true, data: parsed.data };
    },
  });
  return data;
}

async function reviseDocument(
  document: LessonDocumentParsed,
  judgeNotes: string,
  author: typeof completeDeepSeek,
  ledger: UsageLedger | undefined,
): Promise<unknown> {
  const system =
    'You are Forge, revising a children\'s lesson document based on independent judge feedback. ' +
    'Preserve every segment\'s id, type, order and count, and the lesson\'s learning objective. ' +
    'For FORMAT/factual notes make the minimal fix. But when the judge flags ENGAGEMENT, PEDAGOGY, or ' +
    'DISTRACTOR quality (a boring premise, a leaked/obvious answer, throwaway wrong options), you MUST ' +
    'REDESIGN that segment\'s premise/scenario/options to the CONTENT PLAYBOOK bar below — a minimal patch ' +
    'will fail again. CRITICAL: fix the flagged dimension WITHOUT regressing the others — keep it ' +
    'age-appropriate (for a young tier, engagement comes from a relatable STAKE and ONE simple reasoning ' +
    'step, NEVER from harder math or longer text), and keep the connection to the prior lesson. ' +
    'Output ONLY the full corrected JSON document — same shape as the input.';

  // Same fix as write.ts: without an exact shape reminder, revisions
  // sometimes drift a segment's payload/answer field names even though a
  // valid document is right there in the prompt (observed empirically —
  // e.g. a revise call renaming a valid `backdrop` enum value while
  // "fixing" unrelated tone feedback).
  const uniqueTypes = [...new Set(document.segments.map((s) => (s as { type: string }).type))];
  const shapeExamplesText = uniqueTypes
    .map((type) => {
      const schema = TYPE_TO_SCHEMA.get(type);
      if (!schema) return null;
      return `type="${type}":\n${JSON.stringify(shapeExample(schema))}`;
    })
    .filter((s): s is string => s !== null)
    .join('\n\n');

  const user = [
    CONTENT_PLAYBOOK,
    '',
    `JUDGE NOTES (fix these — if they are about engagement/pedagogy/distractors, REDESIGN to the playbook above, do not just patch):\n${judgeNotes}`,
    '',
    'CURRENT DOCUMENT:',
    JSON.stringify(document),
    '',
    'EXACT JSON SHAPE per type in this document (field names/nesting/enum options are LAW — never invent, rename, or move a field while revising):',
    shapeExamplesText,
  ].join('\n');

  const { data } = await withCorrectiveRetry<unknown>({
    maxAttempts: MAX_REVISE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: issues ? `${user}\n\nYour previous JSON was invalid: ${issues}. Resend the FULL corrected JSON.` : user },
      ];
      // Same silent-truncation risk as write.ts: revise resends the FULL document.
      const result = await author({ messages, temperature: 0.4, jsonMode: true, maxTokens: 8192 }, { operation: 'revise', ledger });
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: json.error };
      // Strip null-valued optional fields the model stubbornly emits (same
      // fix as write.ts) before any schema check, then apply deterministic
      // constraint repairs (balance_scale subset-sum etc.).
      const sanitized = repairDocument(stripNullValues(json.value));
      // Structural-only check here — the FULL gate cascade re-runs after this.
      const shapeCheck = lessonDocumentSchema.safeParse(sanitized);
      if (!shapeCheck.success) return { ok: true, data: sanitized }; // let runAllGates report the real issues
      return { ok: true, data: shapeCheck.data };
    },
  });
  return data;
}

export interface ReviewDeps {
  ledger?: UsageLedger;
  judge?: typeof completeQwen;
  author?: typeof completeDeepSeek;
  /** null = this IS the course's first lesson (exempt from connect-to-prior); string = the actual prior micro-objective; undefined = unknown (legacy). */
  priorMicroObjective?: string | null;
  /** A type-coverage / practice harness (catalog `standalone: true`): relaxes
   *  the age_fit floor, because it exercises EVERY type on one fixed tier and a
   *  type that's inherently a different tier (interest_peek/compound growth on a
   *  tier2 course) is a coverage artifact, not a real age mismatch — the course
   *  is explicitly "not for learners". Normal courses keep the full age_fit floor. */
  standalone?: boolean;
}

export interface ReviewResult {
  document: LessonDocumentParsed;
  rubric: ReviewRubric;
  cycles: number;
}

export async function reviewLesson(
  document: LessonDocumentParsed,
  gateCtx: GateContext,
  deps: ReviewDeps = {},
): Promise<ReviewResult> {
  const judge = deps.judge ?? completeQwen;
  const author = deps.author ?? completeDeepSeek;

  let current = document;
  let rubric = await judgeDocument(current, judge, deps.ledger, deps.priorMicroObjective);
  let cycles = 0;

  while (!passesJudgeGate(rubric, current, deps.standalone) && cycles < MAX_REVISE_CYCLES) {
    cycles++;
    const revised = await reviseDocument(current, rubric.notes, author, deps.ledger);
    const gateReport = runAllGates(revised, gateCtx);
    if (!gateReport.ok || !gateReport.document) {
      const gateSummary = gateReport.problems.slice(0, 3).map((p) => p.message).join('; ');
      rubric = { ...rubric, notes: `${rubric.notes}\n(revise cycle ${cycles} broke deterministic gates: ${gateSummary})` };
      continue;
    }
    current = gateReport.document;
    rubric = await judgeDocument(current, judge, deps.ledger, deps.priorMicroObjective);
  }

  if (!passesJudgeGate(rubric, current, deps.standalone)) {
    throw new ReviewFailedError(rubric, cycles);
  }

  return { document: current, rubric, cycles };
}
