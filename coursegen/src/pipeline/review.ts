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
import { withCorrectiveRetry, safeJsonParse, formatZodIssues } from './correctiveRetry.js';
import { TYPE_TO_SCHEMA } from '../contract/registry.js';
import { shapeExample } from './shapeExample.js';

export const MAX_REVISE_CYCLES = 2;
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

function passesJudgeGate(rubric: ReviewRubric): boolean {
  return (
    rubric.kid_safety >= 5 &&
    rubric.age_fit >= 4 &&
    rubric.concreteness >= 4 &&
    // Quality floor added after the QA inspection: an exercise must actually
    // teach (pedagogy), make the kid think (engagement), explain wrong answers
    // (feedback) and offer plausible distractors — all >= 3 (not below average).
    rubric.pedagogy >= 3 &&
    rubric.cognitive_engagement >= 3 &&
    rubric.feedback_quality >= 3 &&
    rubric.distractor_quality >= 3
  );
}

async function judgeDocument(
  document: LessonDocumentParsed,
  judge: typeof completeQwen,
  ledger: UsageLedger | undefined,
  priorMicroObjective?: string | null,
): Promise<ReviewRubric> {
  const system =
    'You are an INDEPENDENT quality judge for a children\'s financial-literacy lesson platform (LittleFounders). ' +
    'You did not write this lesson — review it critically. Output ONLY strict JSON, no prose outside the JSON.';

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
    'Rate this lesson document 1-5 on each dimension:',
    '- age_fit: is the language/complexity right for the stated age band?',
    '- pedagogy: does it teach the stated concept effectively (concrete-before-abstract, formative feedback)?',
    '- narrative_quality: is the story engaging and coherent with the canon characters?',
    '- kid_safety: is EVERY word appropriate for a young child — no scary, sexual, violent, or otherwise unsafe content, no dark patterns?',
    '- naturalness: does the es-MX text read as natural, warm, native Spanish (not machine-translated)?',
    '- concreteness: does at least one segment contain a WORKED CONCRETE instance (a specific number, a named character, or a specific scenario — not purely abstract phrasing)? AND, unless this is the very first lesson of the course, does the lesson OPEN by connecting explicitly to the prior lesson\'s concept instead of restarting cold?',
    '- cognitive_engagement: does solving REQUIRE genuine thinking? 1 = the answer is stated in the prompt/options or is trivially obvious; 5 = the kid must reason with the concept. Penalize answer leakage hard.',
    '- feedback_quality: does the wrong-answer feedback EXPLAIN why a wrong choice is wrong (per-option or targeted), not a generic "try again"? 1 = generic/absent; 5 = specific and instructive. Score 5 for ungraded content types.',
    '- distractor_quality: are the WRONG options plausible-but-wrong (a real misconception), not obviously silly throwaways? 1 = joke/impossible options; 5 = genuinely tempting distractors. Score 5 if the exercise has no multiple-choice options.',
    ...(priorLine ? ['', priorLine] : []),
    '',
    'Respond with EXACTLY: {"age_fit":N,"pedagogy":N,"narrative_quality":N,"kid_safety":N,"naturalness":N,"concreteness":N,"cognitive_engagement":N,"feedback_quality":N,"distractor_quality":N,"notes":"..."}',
    '`notes` must be actionable — if any score is low, say exactly what to fix.',
    '',
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
    'Preserve segment ids, order and count where possible; only change what the judge notes require. ' +
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
    `JUDGE NOTES (fix these):\n${judgeNotes}`,
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
      // Structural-only check here — the FULL gate cascade re-runs after this.
      const shapeCheck = lessonDocumentSchema.safeParse(json.value);
      if (!shapeCheck.success) return { ok: true, data: json.value }; // let runAllGates report the real issues
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

  while (!passesJudgeGate(rubric) && cycles < MAX_REVISE_CYCLES) {
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

  if (!passesJudgeGate(rubric)) {
    throw new ReviewFailedError(rubric, cycles);
  }

  return { document: current, rubric, cycles };
}
