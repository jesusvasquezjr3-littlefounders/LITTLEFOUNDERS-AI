import { z } from 'zod';
import { growthComparison } from './v2GrowthComparison.js';
import { gradeV2Response, scoreV2Judgment, scoreV2Visual, type V2Detection, type V2Diagnostic, type V2JudgmentQuality, type V2VisualKind } from './v2VisualScorer.js';
import { conceptAllowed, conceptSampleResponse, gradeConcept, V2_CONCEPT_RUBRICS, V2_CONCEPT_TYPES, v2ConceptSegments, type V2ConceptSegment } from './v2ConceptBoards.js';
import { CHART_KINDS, chartAllowed, chartDataSchema, chartProblem } from './v2ChartModel.js';
import { longArithmeticSchema, placeValuePayload, SCHEMA_DIAGRAM_RUBRICS, schemaDiagramPayload, schemaDiagramScorerPayload, placeValueScorerPayload, V2_FAMILY_RUBRICS, v2AgeScopeProblem, v2FamilySampleResponse, v2FamilyScorerPayload, v2FamilySegments, v2PayloadScopeProblem, v2SegmentExtras, type V2FamilySegment } from './v2SegmentFamilies.js';

/*
 * Core's independently authored copy of the public v2 lesson contract.
 * The browser has its own fail-closed parser; Core never imports frontend
 * source because these packages intentionally have no shared runtime types.
 * Keep the two contracts aligned through the focused parity fixtures below.
 */

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
const locale = z.enum(['en-US', 'es-MX', 'pt-BR']);
const ageBand = z.enum(['6-9', '10-12', '13-17', 'adult']);

/*
 * OD-19 (owner log, 24 September 2026) resolves S05.2bh: the compact lesson
 * Mentor stage shows the learner's own chosen Mentor character on the scene
 * the lesson document declares. `mentor_stage` is answerless public metadata
 * — it carries no Tutor context, session state or pedagogy data. The
 * character a document authors is only a catalog suggestion; the delivered
 * projection always resolves the learner's own preference (see
 * `projectV2MentorStage`). The scene is an approved catalog scene id, kept
 * closed here and mirrored by the browser contract so a new scene can never
 * drift onto one side alone.
 */
export const MENTOR_STAGE_CHARACTERS = ['rho', 'zara', 'liruf', 'dina'] as const;
export const MENTOR_STAGE_SCENES = ['diorama-a', 'diorama-b'] as const;
export const v2MentorStageSchema = z.object({
  character: z.enum(MENTOR_STAGE_CHARACTERS),
  scene: z.enum(MENTOR_STAGE_SCENES),
}).strict();
export type V2MentorStage = z.infer<typeof v2MentorStageSchema>;
const eligibility = z.object({ minimum_age: z.number().int().min(0).max(119), maximum_age: z.number().int().min(0).max(119) }).strict()
  .refine((value) => value.minimum_age <= value.maximum_age, 'Invalid age eligibility');
const positive = z.number().int().positive().safe();
const nonnegative = z.number().int().nonnegative().safe();
const base = { id, prompt: z.string().trim().min(1).max(500), ...v2SegmentExtras };
/** Appendix P Parts 1/4.2/7: these visuals may be server-graded (with a private rubric) or explored ungraded. */
const optionalServer = z.enum(['server', 'none']);

/*
 * B.8 (GAP-FIX-R1 learning): the six adventure scene themes a chapter can
 * declare (0007 `adventures.theme` CHECK). Core projects the lesson's theme
 * beside `mentor_stage`, as a closed enum mirrored by the browser, so the
 * compact stage band can draw `scene.<theme>.art` behind the Mentor.
 */
export const ADVENTURE_THEMES = ['archipelago', 'forest', 'city', 'valley', 'kingdom', 'cosmos'] as const;
export type AdventureTheme = (typeof ADVENTURE_THEMES)[number];
export function projectAdventureTheme(theme: unknown): AdventureTheme | null {
  return typeof theme === 'string' && (ADVENTURE_THEMES as readonly string[]).includes(theme) ? theme as AdventureTheme : null;
}

const allocation = z.object({
  ...base, type: z.literal('money.allocation.v2'), grading: z.literal('server'),
  visual: z.object({ type: z.enum(['stacked-bar', 'waffle', 'donut']) }).strict(),
  payload: z.object({ total: positive, step: positive, currency: z.enum(['coins', 'local']) }).strict()
    .refine((value) => value.total % value.step === 0, 'Step must divide total'),
}).strict();
const savingsLine = z.object({
  ...base, type: z.literal('visual.savings-line.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('line') }).strict(),
  payload: z.object({ periods: positive.max(24), minimum: nonnegative, maximum: positive, step: positive, initial: nonnegative,
    currency: z.enum(['coins', 'local']), unit: z.enum(['week', 'month']) }).strict()
    .refine((v) => v.maximum >= v.minimum && (v.maximum - v.minimum) % v.step === 0 && v.initial >= v.minimum
      && v.initial <= v.maximum && (v.initial - v.minimum) % v.step === 0, 'Invalid timeline range'),
}).strict();
const numberLine = z.object({
  ...base, type: z.literal('math.number-line.whole.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('number-line') }).strict(),
  payload: z.object({ minimum: nonnegative, maximum: positive, step: positive, initial: nonnegative }).strict()
    .refine((v) => v.maximum > v.minimum && (v.maximum - v.minimum) % v.step === 0 && v.initial >= v.minimum
      && v.initial <= v.maximum && (v.initial - v.minimum) % v.step === 0, 'Invalid number line range'),
}).strict();
const fractionNumberLine = z.object({
  ...base, type: z.literal('math.number-line.fraction.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('number-line') }).strict(),
  payload: z.object({ maximumWhole: z.union([z.literal(1), z.literal(2)]), divisions: positive.max(12), initialUnits: nonnegative,
    spokenText: z.string().trim().min(1).max(120) }).strict()
    .refine(
      (v) => v.divisions >= 2 && v.initialUnits <= v.maximumWhole * v.divisions,
      'Invalid fraction number line',
    ),
}).strict();
const fractionArea = z.object({
  ...base, type: z.literal('math.fraction-area.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('fraction-area') }).strict(),
  payload: z.object({ minimumParts: positive.min(2).max(6), maximumParts: positive.min(2).max(6), initialParts: positive.min(2).max(6),
    initialShaded: nonnegative, spokenText: z.string().trim().min(1).max(120) }).strict()
    .refine(
      (v) => v.minimumParts <= v.maximumParts && v.initialParts >= v.minimumParts && v.initialParts <= v.maximumParts && v.initialShaded <= v.initialParts,
      'Invalid fraction area',
    ),
}).strict();
const barModelPayload = z.object({ whole: positive.max(100), difference: positive.max(99), knownLabel: z.string().trim().min(1).max(40), unknownLabel: z.string().trim().min(1).max(40), spokenText: z.string().trim().min(1).max(120) }).strict().refine((v) => v.difference < v.whole, 'Invalid bar model');
const barModelStructure = z.object({ ...base, type: z.literal('math.bar-model.structure.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('bar-model') }).strict(), payload: barModelPayload }).strict();
const barModelAnswer = z.object({ ...base, type: z.literal('math.bar-model.answer.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('bar-model') }).strict(), payload: barModelPayload }).strict();
// M8 (GAP-FIX-R2): a schema-neutral payload from v2SegmentFamilies; the schema and the slot places are private.
const schemaDiagramStructure = z.object({ ...base, type: z.literal('math.schema-diagram.structure.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const schemaDiagramSlots = z.object({ ...base, type: z.literal('math.schema-diagram.slots.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const schemaDiagramAnswer = z.object({ ...base, type: z.literal('math.schema-diagram.answer.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const goalBullet = z.object({
  ...base, type: z.literal('visual.goal-bullet.v2'), grading: optionalServer, visual: z.object({ type: z.literal('bullet') }).strict(),
  payload: z.object({ minimum: nonnegative, maximum: positive, target: positive, step: positive, initial: nonnegative,
    currency: z.enum(['coins', 'local']) }).strict().refine((v) => v.maximum > v.minimum && v.target > v.minimum && v.target < v.maximum
      && (v.maximum - v.minimum) % v.step === 0 && (v.target - v.minimum) % v.step === 0 && v.initial >= v.minimum
      && v.initial <= v.maximum && (v.initial - v.minimum) % v.step === 0, 'Invalid goal range'),
}).strict();
const percentGrid = z.object({
  ...base, type: z.literal('visual.percent-grid.v2'), grading: optionalServer, visual: z.object({ type: z.literal('percent-grid') }).strict(),
  payload: z.object({ baseUnits: positive.max(1_000_000), step: positive.max(100), initialPercent: nonnegative.max(100),
    mode: z.enum(['discount', 'tax']), currency: z.enum(['coins', 'local']) }).strict()
    .refine((v) => 100 % v.step === 0 && v.baseUnits * v.step % 100 === 0 && v.initialPercent % v.step === 0, 'Invalid percent range'),
}).strict();
const placeValue = z.object({
  ...base, type: z.literal('math.place-value.v2'), grading: optionalServer, visual: z.object({ type: z.literal('base-ten') }).strict(),
  payload: placeValuePayload,
}).strict();
const savingsRule = z.object({
  ...base, type: z.literal('logic.savings-rule.v2'), grading: optionalServer, visual: z.object({ type: z.literal('rule-diagram') }).strict(),
  payload: z.object({ goal: positive.min(2).max(100), shortfall: positive }).strict().refine((v) => v.shortfall < v.goal, 'Invalid savings rule'),
}).strict();
const ledger = z.object({
  ...base, type: z.literal('money.running-ledger.v2'), grading: optionalServer, visual: z.object({ type: z.literal('balance-meter') }).strict(),
  payload: z.object({ initial: nonnegative.max(100), sale: positive.max(100), cost: positive.max(100), maxEntries: positive.max(8) }).strict(),
}).strict();
const growth = z.object({
  ...base, type: z.literal('visual.growth-comparison.v2'), grading: optionalServer, visual: z.object({ type: z.literal('multi-line') }).strict(),
  payload: z.object({ principalMinor: positive.max(1_000_000), minimumRateBps: positive.min(100).max(1_500), maximumRateBps: positive.min(100).max(1_500),
    rateStepBps: positive.max(1_400), initialRateBps: positive.min(100).max(1_500), minimumYears: positive.max(30), maximumYears: positive.max(30),
    yearStep: positive.max(29), initialYears: positive.max(30), predictionStepMinor: positive.max(100_000), predictionMaximumMinor: positive.max(100_000_000) }).strict()
    .refine((v) => {
      const maximum = growthComparison({ principalMinor: v.principalMinor, rateBasisPoints: v.maximumRateBps, years: v.maximumYears })?.at(-1)?.compoundMinor;
      return v.principalMinor >= 100 && v.maximumRateBps > v.minimumRateBps && (v.maximumRateBps - v.minimumRateBps) % v.rateStepBps === 0
        && v.initialRateBps >= v.minimumRateBps && v.initialRateBps <= v.maximumRateBps && (v.initialRateBps - v.minimumRateBps) % v.rateStepBps === 0
        && v.maximumYears > v.minimumYears && (v.maximumYears - v.minimumYears) % v.yearStep === 0 && v.initialYears >= v.minimumYears
        && v.initialYears <= v.maximumYears && (v.initialYears - v.minimumYears) % v.yearStep === 0 && v.predictionMaximumMinor > v.principalMinor
        && (v.predictionMaximumMinor - v.principalMinor) % v.predictionStepMinor === 0 && maximum !== undefined && maximum <= v.predictionMaximumMinor;
    }, 'Invalid growth range'),
}).strict();
const taxBracket = z.object({
  ...base, type: z.literal('visual.tax-bracket.v2'), grading: optionalServer, visual: z.object({ type: z.literal('stacked-bar') }).strict(),
  payload: z.object({ minimumIncomeMinor: nonnegative, maximumIncomeMinor: positive.max(10_000_000), incomeStepMinor: positive,
    initialIncomeMinor: nonnegative, brackets: z.array(z.object({ upToMinor: nonnegative.nullable(), rateBasisPoints: nonnegative.max(10_000) }).strict()).min(2).max(6) }).strict()
    .refine((v) => v.maximumIncomeMinor > v.minimumIncomeMinor && (v.maximumIncomeMinor - v.minimumIncomeMinor) % v.incomeStepMinor === 0
      && v.initialIncomeMinor >= v.minimumIncomeMinor && v.initialIncomeMinor <= v.maximumIncomeMinor && (v.initialIncomeMinor - v.minimumIncomeMinor) % v.incomeStepMinor === 0
      && v.brackets.at(-1)?.upToMinor === null && v.brackets.every((b, i) => b.upToMinor === null ? i === v.brackets.length - 1 : i === 0 ? b.upToMinor > 0 : b.upToMinor > (v.brackets[i - 1]?.upToMinor ?? Infinity)), 'Invalid tax brackets'),
}).strict();
const ratioTable = z.object({
  ...base, type: z.literal('math.ratio-table.v2'), grading: optionalServer, visual: z.object({ type: z.literal('ratio-table') }).strict(),
  payload: z.object({ itemsPerPack: positive.max(12), pricePerPack: positive.max(1_000), minimumPacks: positive.max(8),
    maximumPacks: positive.max(8), initialPacks: positive.max(8), currency: z.enum(['coins', 'local']) }).strict()
    .refine((v) => v.maximumPacks > v.minimumPacks && v.initialPacks >= v.minimumPacks && v.initialPacks <= v.maximumPacks
      && v.pricePerPack % v.itemsPerPack === 0, 'Invalid ratio table'),
}).strict();
/** Public teaching values for M9/M10; learner responses and mastery policy remain outside this document. */
const workedExample = z.object({
  ...base, type: z.literal('math.worked-example.v2'), grading: z.literal('server'),
  visual: z.object({ type: z.literal('worked-example') }).strict(),
  payload: z.object({
    steps: z.array(z.object({
      id, expression: z.string().trim().min(1).max(80), result: z.string().trim().min(1).max(40),
      spokenText: z.string().trim().min(1).max(120),
    }).strict()).min(3).max(4),
    fade_count: nonnegative.max(3),
    response_step_ids: z.array(id).min(2).max(3),
    // M9 (GAP-FIX-R1): the optional written algorithm, drawn in the locale's own layout.
    algorithm: longArithmeticSchema.optional(),
  }).strict().refine((value) => value.fade_count < value.steps.length
    && new Set(value.steps.map((step) => step.id)).size === value.steps.length
    && value.response_step_ids.join(':') === value.steps.slice(1).map((step) => step.id).join(':'), 'Invalid worked-example steps'),
}).strict();

const functionMachine = z.object({
  ...base, type: z.literal('math.function-machine.v2'), grading: z.literal('server'),
  visual: z.object({ type: z.literal('function-machine') }).strict(),
  payload: z.object({
    examples: z.array(z.object({ input: nonnegative.max(12), output: nonnegative.max(200) }).strict()).min(3).max(5),
    multiplierMaximum: positive.max(12), offsetMaximum: nonnegative.max(100),
  }).strict().refine((value) => {
    if (new Set(value.examples.map((example) => example.input)).size !== value.examples.length) return false;
    const ordered = [...value.examples].sort((a, b) => a.input - b.input);
    const first = ordered[0]; const second = ordered[1];
    if (!first || !second || second.input === first.input) return false;
    const numerator = second.output - first.output; const denominator = second.input - first.input;
    if (!Number.isSafeInteger(numerator / denominator) || numerator / denominator < 1 || numerator / denominator > value.multiplierMaximum) return false;
    const multiplier = numerator / denominator; const offset = first.output - multiplier * first.input;
    return offset >= 0 && offset <= value.offsetMaximum && ordered.every((example) => example.output === multiplier * example.input + offset);
  }, 'Invalid function-machine examples'),
}).strict();

/** M1's concrete -> pictorial -> abstract addition pilot. The progression itself is validated at document level. */
const cpaCount = z.object({
  ...base, type: z.literal('math.cpa-count.v2'), grading: z.literal('server'),
  visual: z.object({ type: z.literal('cpa-count') }).strict(),
  payload: z.object({ left: positive.max(20), right: positive.max(20), spokenText: z.string().trim().min(1).max(120) }).strict()
    .refine((value) => value.left + value.right <= 30, 'Invalid CPA count'),
}).strict();

/**
 * B.12 (Law 4): decide, then say why. The decision is graded like any other
 * v2 answer; the reason is graded separately against a private rubric into a
 * judgment quality that never changes the score. Choices and reasons are
 * public labels only: which choice is acceptable and how each reason is
 * judged stay in the answer key.
 */
const reasoningOption = z.object({ id, label: z.string().trim().min(1).max(80) }).strict();
const decideJustify = z.object({
  ...base, type: z.literal('reasoning.decide-justify.v2'), grading: z.literal('server'),
  visual: z.object({ type: z.literal('decision-reasons') }).strict(),
  payload: z.object({
    choices: z.array(reasoningOption).min(2).max(4),
    reasonPrompt: z.string().trim().min(1).max(200),
    reasons: z.array(reasoningOption).min(3).max(5),
  }).strict().refine((value) => new Set([...value.choices, ...value.reasons].map((option) => option.id)).size
    === value.choices.length + value.reasons.length, 'Invalid decision reasons'),
}).strict();

/*
 * B.7 part 1 (GAP-FIX-R1): a teaching chart of any Appendix A kind the first
 * release draws, from the canonical chart model (v2ChartModel.ts). Explored,
 * or graded when it carries a question read off the chart (answer ids are
 * private). Situational kinds are gated by age pathway and subject below.
 */
const chartQuestion = z.object({ prompt: z.string().trim().min(1).max(160), options: z.array(z.object({ id, label: z.string().trim().min(1).max(80) }).strict()).min(2).max(4) }).strict();
const chart = z.object({
  ...base, type: z.literal('visual.chart.v2'), grading: optionalServer,
  visual: z.object({ type: z.enum(CHART_KINDS) }).strict(),
  payload: z.object({ title: z.string().trim().min(1).max(60), data: chartDataSchema, question: chartQuestion.optional() }).strict(),
}).strict().superRefine((value, ctx) => {
  const problem = chartProblem(value.visual.type, value.payload.data);
  if (problem) ctx.addIssue({ code: 'custom', path: ['payload', 'data'], message: problem });
  if ((value.grading === 'server') !== !!value.payload.question) ctx.addIssue({ code: 'custom', path: ['grading'], message: 'A graded chart asks one question; an explored chart asks none' });
});

const segment = z.discriminatedUnion('type', [allocation, savingsLine, numberLine, fractionNumberLine, fractionArea, barModelStructure, barModelAnswer, schemaDiagramStructure, schemaDiagramSlots, schemaDiagramAnswer, goalBullet, percentGrid, placeValue, savingsRule, ledger, growth, taxBracket, ratioTable, workedExample, functionMachine, cpaCount, decideJustify, chart, ...v2FamilySegments, ...v2ConceptSegments]);
const capabilities = {
  'money.allocation.v2': ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
  'visual.savings-line.v2': ['visual.line.v1', 'operation.parameter-slider.v1'],
  'math.number-line.whole.v2': ['visual.number-line.v1', 'operation.place-point.v1'],
  'math.number-line.fraction.v2': ['visual.number-line.v1', 'visual.fraction-area.v1', 'operation.place-point.v1', 'operation.linked-representations.v1'],
  'math.fraction-area.v2': ['visual.fraction-area.v1', 'operation.partition-equal.v1', 'operation.shade-parts.v1', 'operation.split-equivalent.v1'],
  'math.bar-model.structure.v2': ['visual.bar-model.v1', 'operation.build-slots.v1', 'operation.structure-check.v1'],
  'math.bar-model.answer.v2': ['visual.bar-model.v1', 'operation.number-input.v1'],
  'math.schema-diagram.structure.v2': ['visual.schema-diagram.v1', 'operation.build-slots.v1', 'operation.structure-check.v1'],
  'math.schema-diagram.slots.v2': ['visual.schema-diagram.v1', 'operation.build-slots.v1'],
  'math.schema-diagram.answer.v2': ['visual.schema-diagram.v1', 'operation.number-input.v1'],
  'visual.goal-bullet.v2': ['visual.bullet.v1', 'operation.parameter-slider.v1'],
  'visual.percent-grid.v2': ['visual.percent-grid.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.place-value.v2': ['visual.base-ten.v1', 'operation.trade-ten.v1', 'operation.linked-representations.v1', 'operation.step-replay.v1'],
  'logic.savings-rule.v2': ['visual.rule-diagram.v1', 'operation.choose-connective.v1', 'operation.case-step.v1'],
  'money.running-ledger.v2': ['visual.balance-meter.v1', 'operation.running-ledger.v1', 'operation.step-replay.v1'],
  'visual.growth-comparison.v2': ['visual.multi-line.v1', 'operation.parameter-slider.v1', 'operation.predict-reveal.v1', 'operation.scale-toggle.v1'],
  'visual.tax-bracket.v2': ['visual.stacked-bar.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.ratio-table.v2': ['visual.ratio-table.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.worked-example.v2': ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
  'math.function-machine.v2': ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'],
  'math.cpa-count.v2': ['visual.cpa-count.v1', 'operation.count-objects.v1', 'operation.symbolic-answer.v1'],
  'reasoning.decide-justify.v2': ['visual.decision-card.v1', 'operation.choose-option.v1', 'operation.justify-choice.v1'],
  // B.7 part 1: plus `visual.<kind>.v1` for the drawn kind, and choose-option when it asks a question.
  'visual.chart.v2': ['operation.show-table.v1'],
  // GAP-FIX-R1 learning (Appendix P Part 8 first release; B.8, B.9, B.11).
  'logic.rule-checker.v2': ['visual.rule-cards.v1', 'operation.flip-card.v1'],
  'logic.euler.v2': ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1'],
  'logic.flowchart.v2': ['visual.flowchart.v1', 'operation.step-flowchart.v1'],
  'money.spend-decision.v2': ['visual.decision-tree.v1', 'operation.step-flowchart.v1'],
  'logic.sort-by-rule.v2': ['visual.sort-bins.v1', 'operation.sort-to-bin.v1', 'operation.move-menu.v1', 'operation.justify-choice.v1'],
  'money.needs-wants.v2': ['visual.sort-bins.v1', 'operation.sort-to-bin.v1', 'operation.move-menu.v1', 'operation.justify-choice.v1'],
  'logic.scam-spotter.v2': ['visual.message-list.v1', 'operation.flag-item.v1'],
  'money.scam-check.v2': ['visual.message-list.v1', 'operation.flag-item.v1'],
  'money.coin-tray.v2': ['visual.coin-tray.v1', 'operation.count-money.v1'],
  'money.making-change.v2': ['visual.coin-tray.v1', 'operation.count-money.v1', 'operation.make-change.v1'],
  'story.branch.v2': ['visual.story-scene.v1', 'operation.choose-option.v1'],
  'story.dialogue-choice.v2': ['visual.dialogue.v1', 'operation.choose-option.v1'],
  'story.would-you-rather.v2': ['visual.would-you-rather.v1', 'operation.choose-option.v1'],
  'voice.mentor-turn.v2': ['visual.speech-plate.v1'],
  'voice.mentor-episode.v2': ['visual.speech-plate.v1', 'operation.step-replay.v1'],
  // GAP-FIX-R1 learning (Appendix A Parts 2 and 3; B.7 part 2): the concept boards and the primitives they compose.
  'money.amortization.v2': ['visual.amortization.v1', 'operation.step-replay.v1', 'operation.number-input.v1'],
  'econ.supply-demand.v2': ['visual.supply-demand.v1', 'operation.drag-point.v1', 'operation.curve-shift.v1'],
  'money.opportunity-cost.v2': ['visual.token-chooser.v1', 'operation.trade-off-chooser.v1'],
  'money.inflation.v2': ['visual.inflation.v1', 'operation.parameter-slider.v1', 'operation.scale-toggle.v1', 'operation.before-after.v1', 'operation.reactive-text.v1'],
  'money.rule-of-72.v2': ['visual.doubling.v1', 'operation.parameter-slider.v1', 'operation.threshold-marker.v1'],
  'money.debt-payoff.v2': ['visual.debt-race.v1', 'operation.what-if-branch.v1', 'operation.ghost-trace.v1'],
  'money.diversification.v2': ['visual.portfolio.v1', 'operation.reallocate.v1', 'operation.linked-representations.v1'],
  'money.lemonade-stand.v2': ['visual.waterfall.v1', 'operation.guided-sandbox.v1', 'operation.running-ledger.v1'],
} as const;

/** Every occurrence of a chain member sits inside a complete, in-order run of the whole chain. */
export function contiguousChains(types: readonly string[], chain: readonly string[]): boolean {
  for (let index = 0; index < types.length; index += 1) {
    const position = chain.indexOf(types[index]!);
    if (position < 0) continue;
    if (position !== 0) return false;
    for (let step = 1; step < chain.length; step += 1) if (types[index + step] !== chain[step]) return false;
    index += chain.length - 1;
  }
  return true;
}

const representationProgression = z.object({
  fading_group_id: id,
  problem_id: id,
  stages: z.tuple([
    z.object({ segment_id: id, stage: z.literal('concrete'), worked_steps_shown: nonnegative.max(8) }).strict(),
    z.object({ segment_id: id, stage: z.literal('pictorial'), worked_steps_shown: nonnegative.max(8) }).strict(),
    z.object({ segment_id: id, stage: z.literal('abstract'), worked_steps_shown: nonnegative.max(8) }).strict(),
  ]),
}).strict();

export const v2PublicLessonSchema = z.object({
  schema_version: z.literal(2), course_id: id, pathway_id: id, chapter_id: id, lesson_id: id, version_id: id, locale, age_band: ageBand,
  eligibility, knowledge_component_ids: z.array(id).min(1), adventure_scene_id: id, title: z.string().trim().min(1).max(120),
  required_capabilities: z.array(id).min(1), segments: z.array(segment).min(1).max(80),
  representation_progressions: z.array(representationProgression).min(1).max(20).optional(),
  mentor_stage: v2MentorStageSchema.optional(),
}).strict().superRefine((document, ctx) => {
  const segmentIds = new Set<string>();
  const declared = new Set(document.required_capabilities);
  if (new Set(document.knowledge_component_ids).size !== document.knowledge_component_ids.length) ctx.addIssue({ code: 'custom', path: ['knowledge_component_ids'], message: 'Duplicate knowledge component' });
  if (declared.size !== document.required_capabilities.length) ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Duplicate capability' });
  const expected = new Set<string>();
  for (const [index, value] of document.segments.entries()) {
    if (segmentIds.has(value.id)) ctx.addIssue({ code: 'custom', path: ['segments', index, 'id'], message: 'Duplicate segment id' });
    if (value.knowledge_component_id !== undefined && !document.knowledge_component_ids.includes(value.knowledge_component_id)) {
      ctx.addIssue({ code: 'custom', path: ['segments', index, 'knowledge_component_id'], message: 'Unknown knowledge component' });
    }
    segmentIds.add(value.id);
    const needed: readonly string[] = value.type === 'money.allocation.v2' && value.visual.type !== 'stacked-bar'
      ? [`visual.${value.visual.type}.v1`, 'operation.reallocate.v1']
      : value.type === 'visual.chart.v2' ? [`visual.${value.visual.type}.v1`, ...capabilities[value.type], ...(value.payload.question ? ['operation.choose-option.v1'] : [])]
        : capabilities[value.type];
    // Appendix A: situational chart kinds appear only in their age pathways and subjects, enforced on delivery.
    if (value.type === 'visual.chart.v2' && !chartAllowed(value.visual.type, document.age_band, document.course_id)) {
      ctx.addIssue({ code: 'custom', path: ['segments', index, 'visual'], message: 'This chart kind is not open to this age pathway or subject' });
    }
    needed.forEach((capability) => expected.add(capability));
    if (needed.some((capability) => !declared.has(capability))) ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Missing segment capability' });
    // Appendix A Part 3: the concept boards open by age (teens, except opportunity cost and the lemonade stand).
    if (isConcept(value) && !conceptAllowed(value.type, document.age_band)) {
      ctx.addIssue({ code: 'custom', path: ['segments', index, 'type'], message: 'This concept board is not open to this age pathway' });
    }
    // B.7 part 3 / Appendix P Part 1 and Part 8, OD-16 (GAP-FIX-R2): each kind's age range and generic parameters, not pilot pins.
    const scopeKey = value.type === 'money.allocation.v2' && value.visual.type !== 'stacked-bar' ? `${value.type}:${value.visual.type}` : value.type;
    const scopeProblem = v2AgeScopeProblem(scopeKey, document) ?? v2PayloadScopeProblem(value, document.age_band);
    if (scopeProblem) ctx.addIssue({ code: 'custom', path: ['segments', index], message: scopeProblem });
  }
  // OD-17 / B.7 (GAP-FIX-R1): a mixed document may surround these sequences
  // with other segments, but each M7 chain stays contiguous and ordered, since
  // Core gates every later step on the met receipt of the one before it.
  if (!contiguousChains(document.segments.map((value) => value.type), ['math.bar-model.structure.v2', 'math.bar-model.answer.v2'])) {
    ctx.addIssue({ code: 'custom', path: ['segments'], message: 'Bar-model pilot requires an ordered structure and answer pair' });
  }
  if (!contiguousChains(document.segments.map((value) => value.type), ['math.schema-diagram.structure.v2', 'math.schema-diagram.slots.v2', 'math.schema-diagram.answer.v2'])) {
    ctx.addIssue({ code: 'custom', path: ['segments'], message: 'Schema diagrams require an ordered structure, slots and answer sequence' });
  }
  const cpaSegments = document.segments.filter((value) => value.type === 'math.cpa-count.v2');
  if (cpaSegments.length > 0) {
    const progressions = document.representation_progressions ?? [];
    const claimed = new Set(progressions.flatMap((progression) => progression.stages.map((stage) => stage.segment_id)));
    if (progressions.length !== 1 || cpaSegments.length !== 3 || claimed.size !== 3 || claimed.size !== cpaSegments.length
      || cpaSegments.some((item) => !claimed.has(item.id))) {
      ctx.addIssue({ code: 'custom', path: ['representation_progressions'], message: 'CPA count requires one complete fading progression' });
    }
    for (const progression of progressions) {
      const selected = progression.stages.map((stage) => document.segments.find((item) => item.id === stage.segment_id));
      const validKinds = selected.every((item) => item?.type === 'math.cpa-count.v2');
      const values = selected.filter((item): item is Extract<typeof cpaSegments[number], { type: 'math.cpa-count.v2' }> => item?.type === 'math.cpa-count.v2');
      const sameProblem = values.length === 3 && values.every((item) => item.payload.left === values[0]?.payload.left && item.payload.right === values[0]?.payload.right);
      if (new Set(progression.stages.map((stage) => stage.segment_id)).size !== 3 || !validKinds || !sameProblem
        || !(progression.stages[0].worked_steps_shown > progression.stages[1].worked_steps_shown
          && progression.stages[1].worked_steps_shown > progression.stages[2].worked_steps_shown)) {
        ctx.addIssue({ code: 'custom', path: ['representation_progressions'], message: 'Invalid CPA fading progression' });
      }
    }
  } else if (document.representation_progressions) {
    ctx.addIssue({ code: 'custom', path: ['representation_progressions'], message: 'Fading progression requires CPA count segments' });
  }
  for (const capability of declared) {
    if (!expected.has(capability)) ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Unexpected capability' });
  }
});

const rubricByKind = {
  'money.allocation.v2': z.object({ minimumSave: nonnegative }).strict(),
  'math.number-line.whole.v2': z.object({ target: nonnegative }).strict(),
  'math.number-line.fraction.v2': z.object({ targetNumerator: nonnegative, targetDenominator: positive.max(12), toleranceUnits: nonnegative.max(2) }).strict(),
  'math.fraction-area.v2': z.object({ targetNumerator: nonnegative, targetDenominator: positive.min(2).max(6) }).strict(),
  'math.bar-model.structure.v2': z.object({ model: z.literal('comparison') }).strict(),
  'math.bar-model.answer.v2': z.object({ target: nonnegative.max(100) }).strict(),
  ...SCHEMA_DIAGRAM_RUBRICS,
  'math.worked-example.v2': z.object({ expectedValues: z.record(z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/), z.string().trim().min(1).max(40)) }).strict(),
  'math.function-machine.v2': z.object({ multiplier: positive.max(12), offset: nonnegative.max(100), heldOutInputs: z.array(nonnegative.max(24)).min(2).max(4) }).strict()
    .refine((value) => new Set(value.heldOutInputs).size === value.heldOutInputs.length, 'Duplicate held-out input'),
  'math.cpa-count.v2': z.object({ target: positive.max(30) }).strict(),
  'reasoning.decide-justify.v2': z.object({
    acceptableChoiceIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/)).min(1).max(3),
    reasonQuality: z.record(z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/), z.enum(['sound', 'partial', 'unsupported'])),
  }).strict(),
  // Appendix P Parts 1, 4.2 and 7 (GAP-FIX-R1): the formerly presentation-only visuals.
  'math.place-value.v2': z.object({ trades: positive.max(20) }).strict(),
  'math.ratio-table.v2': z.object({ target_packs: positive.max(8) }).strict(),
  'visual.percent-grid.v2': z.object({ target_percent: nonnegative.max(100) }).strict(),
  'visual.growth-comparison.v2': z.object({ tolerance_minor: nonnegative }).strict(),
  'visual.tax-bracket.v2': z.object({ income_minor: nonnegative }).strict(),
  'logic.savings-rule.v2': z.object({ comparator: z.enum(['>=', '>', '<=', '<']), threshold: nonnegative.max(200), link: z.enum(['and', 'or', 'none']),
    held_out: z.array(z.object({ saved: nonnegative.max(200), goal_day: z.boolean() }).strict()).min(2).max(8) }).strict(),
  'visual.goal-bullet.v2': z.object({ minimum_value: nonnegative }).strict(),
  'money.running-ledger.v2': z.object({ target_balance: z.number().int().safe() }).strict(),
  'visual.chart.v2': z.object({ acceptable_choice_ids: z.array(id).min(1).max(3) }).strict(),
  ...V2_FAMILY_RUBRICS,
  ...V2_CONCEPT_RUBRICS,
} as const;

export type V2PublicLesson = z.infer<typeof v2PublicLessonSchema>;
type V2Segment = z.infer<typeof segment>;
type ServerSegment = V2Segment & { grading: 'server' };
export type V2GradeResult = {
  score: 0 | 100; correct: boolean; document: V2PublicLesson; segmentId: string; judgment?: V2JudgmentQuality;
  /** Appendix P Part 4.5: the closed diagnostic code, and the detection counts for L12/$11. */
  diagnostic: V2Diagnostic; detection?: V2Detection;
};

/** The canonical scorer accepts only the semantic fields, never renderer metadata. */
const FAMILY_TYPES = new Set<string>(v2FamilySegments.map((schema) => schema.shape.type.value));
function isFamily(item: V2Segment): item is V2Segment & V2FamilySegment { return FAMILY_TYPES.has(item.type); }
const CONCEPT_TYPES = new Set<string>(V2_CONCEPT_TYPES);
/** The concept boards grade from the whole segment through their own canonical model (v2ConceptBoards.ts). */
function isConcept(item: V2Segment): item is V2Segment & V2ConceptSegment { return CONCEPT_TYPES.has(item.type); }

function scorerPayload(item: ServerSegment): Record<string, unknown> {
  if (isFamily(item)) return v2FamilyScorerPayload(item);
  if (isConcept(item)) return { type: item.type };
  switch (item.type) {
    case 'math.place-value.v2': return placeValueScorerPayload(item.payload);
    case 'math.ratio-table.v2': return { itemsPerPack: item.payload.itemsPerPack, pricePerPack: item.payload.pricePerPack,
      minimumPacks: item.payload.minimumPacks, maximumPacks: item.payload.maximumPacks };
    case 'visual.percent-grid.v2': return { baseUnits: item.payload.baseUnits, step: item.payload.step };
    case 'visual.growth-comparison.v2': return { principalMinor: item.payload.principalMinor, minimumRateBps: item.payload.minimumRateBps,
      maximumRateBps: item.payload.maximumRateBps, rateStepBps: item.payload.rateStepBps, minimumYears: item.payload.minimumYears,
      maximumYears: item.payload.maximumYears, yearStep: item.payload.yearStep, predictionStepMinor: item.payload.predictionStepMinor,
      predictionMaximumMinor: item.payload.predictionMaximumMinor };
    case 'visual.tax-bracket.v2': return { minimumIncomeMinor: item.payload.minimumIncomeMinor, maximumIncomeMinor: item.payload.maximumIncomeMinor,
      incomeStepMinor: item.payload.incomeStepMinor, brackets: item.payload.brackets };
    case 'logic.savings-rule.v2': return { goal: item.payload.goal };
    case 'visual.goal-bullet.v2': return { minimum: item.payload.minimum, maximum: item.payload.maximum, step: item.payload.step };
    case 'money.running-ledger.v2': return { initial: item.payload.initial, sale: item.payload.sale, cost: item.payload.cost, maxEntries: item.payload.maxEntries };
    case 'visual.chart.v2': return { choiceIds: (item.payload.question?.options ?? []).map((option) => option.id) };
    default: break;
  }
  return item.type === 'money.allocation.v2'
    ? { total: item.payload.total, step: item.payload.step }
    : item.type === 'math.number-line.whole.v2'
      ? { minimum: item.payload.minimum, maximum: item.payload.maximum, step: item.payload.step }
      : item.type === 'math.number-line.fraction.v2'
        ? { maximumWhole: item.payload.maximumWhole, divisions: item.payload.divisions }
        : item.type === 'math.fraction-area.v2'
          ? { minimumParts: item.payload.minimumParts, maximumParts: item.payload.maximumParts }
          : item.type === 'math.worked-example.v2'
            ? { response_step_ids: item.payload.response_step_ids }
            : item.type === 'math.function-machine.v2'
              ? { multiplierMaximum: item.payload.multiplierMaximum, offsetMaximum: item.payload.offsetMaximum,
                exampleInputs: item.payload.examples.map((example) => example.input) }
              : item.type === 'math.cpa-count.v2'
                ? { left: item.payload.left, right: item.payload.right }
              : item.type === 'reasoning.decide-justify.v2'
                ? { choiceIds: item.payload.choices.map((option) => option.id), reasonIds: item.payload.reasons.map((option) => option.id) }
          : (item.type === 'math.schema-diagram.structure.v2' || item.type === 'math.schema-diagram.slots.v2' || item.type === 'math.schema-diagram.answer.v2')
            ? schemaDiagramScorerPayload(item.payload)
          : { whole: item.payload.whole, difference: item.payload.difference };
}

/**
 * Parse a complete public document and its private rubrics as one contract.
 * Only the supported canonical v2 scored segment types are gradeable today; all other
 * segments must remain keyless until their server scorer exists.
 */
export function validateV2LessonForGrading(document: unknown, answerKeys: unknown, expected: { lessonId: string; locale: string }): V2PublicLesson | null {
  const parsed = v2PublicLessonSchema.safeParse(document);
  if (!parsed.success || parsed.data.lesson_id !== expected.lessonId || parsed.data.locale !== expected.locale
    || !answerKeys || typeof answerKeys !== 'object' || Array.isArray(answerKeys)) return null;
  const keys = answerKeys as Record<string, unknown>;
  const scored = parsed.data.segments.filter((segment): segment is ServerSegment => segment.grading === 'server');
  if (Object.keys(keys).length !== scored.length) return null;
  for (const item of scored) {
    if (!Object.hasOwn(keys, item.id)) return null;
    const rubric = rubricByKind[item.type as keyof typeof rubricByKind].safeParse(keys[item.id]);
    // L2 (Appendix P Part 2): ages 8-9 build a single IF, so their rule key never needs a connective.
    if (item.type === 'logic.savings-rule.v2' && parsed.data.age_band === '6-9' && rubric.success && (rubric.data as { link: string }).link !== 'none') return null;
    if (isConcept(item)) {
      if (!rubric.success || gradeConcept(item, conceptSampleResponse(item), rubric.data).verdict === 'invalid') return null;
      continue;
    }
    const sample = item.type === 'money.allocation.v2' ? { save: 0, spend: item.payload.total, share: 0 }
      : item.type === 'math.number-line.whole.v2' ? { value: String(item.payload.minimum) }
        : item.type === 'math.number-line.fraction.v2' ? { value: '0/1' }
          : item.type === 'math.fraction-area.v2' ? { n: 0, d: item.payload.minimumParts }
            : item.type === 'math.bar-model.structure.v2' ? { model: 'comparison' }
                : item.type === 'math.schema-diagram.structure.v2' ? { schema: 'change' }
                : item.type === 'math.schema-diagram.slots.v2' ? { schema: 'group', slots: { part: item.payload.quantities[0].id, other: item.payload.quantities[1].id, total: 'unknown' } }
                  : item.type === 'math.worked-example.v2' ? { values: Object.fromEntries(item.payload.response_step_ids.map((stepId) => [stepId, '0'])) }
                  : item.type === 'math.function-machine.v2' ? { multiplier: '1', offset: '0' }
                  : item.type === 'math.cpa-count.v2' ? { value: '0' }
                  : item.type === 'reasoning.decide-justify.v2' ? { choice: item.payload.choices[0]!.id, reason: item.payload.reasons[0]!.id }
                  : v2SampleResponse(item);
    if (!rubric.success || scoreV2Visual(item.type as V2VisualKind, scorerPayload(item), sample, rubric.data) === 'invalid') return null;
  }
  return parsed.data;
}

/** A well-formed response for the contract validator: it proves the rubric is scorable, never that it is met. */
function v2SampleResponse(item: ServerSegment): unknown {
  if (isFamily(item)) return v2FamilySampleResponse(item);
  switch (item.type) {
    case 'math.place-value.v2': return { trades: [], hundreds: '0', tens: '0', ones: '0' };
    case 'math.ratio-table.v2': return { packs: item.payload.minimumPacks, price: '0' };
    case 'visual.percent-grid.v2': return { percent: item.payload.initialPercent, amount: '0' };
    case 'visual.growth-comparison.v2': return { rateBps: item.payload.initialRateBps, years: item.payload.initialYears, predictionMinor: item.payload.principalMinor };
    case 'visual.tax-bracket.v2': return { incomeMinor: item.payload.initialIncomeMinor, taxMinor: '0', marginalBps: 0 };
    case 'logic.savings-rule.v2': return { comparator: '>=', threshold: 0, link: 'none' };
    case 'visual.goal-bullet.v2': return { value: item.payload.initial };
    case 'money.running-ledger.v2': return { entries: [], balance: String(item.payload.initial) };
    case 'visual.chart.v2': return { choice: item.payload.question?.options[0]?.id ?? '' };
    default: return { value: '0' };
  }
}

/** Server-only semantic scoring. A malformed response never becomes a score. */
export function gradeV2Visual(document: V2PublicLesson, answerKeys: Record<string, unknown>, segmentId: string, response: unknown): V2GradeResult | null {
  const segment = document.segments.find((item) => item.id === segmentId);
  if (!segment || segment.grading !== 'server' || !Object.hasOwn(answerKeys, segmentId)) return null;
  const rubric = rubricByKind[segment.type as keyof typeof rubricByKind].safeParse(answerKeys[segmentId]);
  if (!rubric.success) return null;
  if (isConcept(segment)) {
    const concept = gradeConcept(segment, response, rubric.data);
    if (concept.verdict === 'invalid' || concept.verdict === 'valid') return null;
    return { score: concept.verdict === 'met' ? 100 : 0, correct: concept.verdict === 'met', document, segmentId, diagnostic: concept.diagnostic };
  }
  const detailed = gradeV2Response(segment.type as V2VisualKind, scorerPayload(segment as ServerSegment), response, rubric.data);
  const verdict = detailed.verdict;
  if (verdict === 'invalid' || verdict === 'valid') return null;
  const graded: V2GradeResult = { score: verdict === 'met' ? 100 : 0, correct: verdict === 'met', document, segmentId, diagnostic: detailed.diagnostic,
    ...(detailed.detection ? { detection: detailed.detection } : {}) };
  if (segment.type !== 'reasoning.decide-justify.v2') return graded;
  // B.12: the same signed response yields a judgment, never folded into the score.
  const judgment = scoreV2Judgment(segment.type, scorerPayload(segment as ServerSegment), response, rubric.data);
  return judgment === 'invalid' ? null : { ...graded, judgment };
}

/** M7 arithmetic cannot be submitted until Core has recorded the preceding structure receipt. */
export function v2GradePrerequisiteSegmentId(document: V2PublicLesson, segmentId: string): string | null {
  const index = document.segments.findIndex((segment) => segment.id === segmentId);
  if (index <= 0) return null;
  const previous = document.segments[index - 1];
  const current = document.segments[index];
  if (current?.type === 'math.bar-model.answer.v2' && previous?.type === 'math.bar-model.structure.v2') return previous.id;
  if (current?.type === 'math.schema-diagram.slots.v2' && previous?.type === 'math.schema-diagram.structure.v2') return previous.id;
  if (current?.type === 'math.schema-diagram.answer.v2' && previous?.type === 'math.schema-diagram.slots.v2') return previous.id;
  return null;
}

/** Only Core derives M1 diagnostic metadata from an already validated immutable document. */
export function v2FirstUnaidedStage(document: V2PublicLesson, segmentId: string): { fadingGroupId: string; stage: 'concrete' | 'pictorial' | 'abstract' } | null {
  const progression = document.representation_progressions?.find((item) => item.stages.some((stage) => stage.segment_id === segmentId));
  const stage = progression?.stages.find((item) => item.segment_id === segmentId);
  return progression && stage ? { fadingGroupId: progression.fading_group_id, stage: stage.stage } : null;
}

/**
 * M1 stages must be experienced in representation order. `undefined` means
 * that the segment is not part of an M1 progression; `null` is the first
 * stage, and a string is the immediately preceding stage that only needs an
 * attempted receipt (a review is still a legitimate learning attempt).
 */
export function v2CpaAttemptPrerequisiteSegmentId(document: V2PublicLesson, segmentId: string): string | null | undefined {
  const progression = document.representation_progressions?.find((item) => item.stages.some((stage) => stage.segment_id === segmentId));
  if (!progression) return undefined;
  const index = progression.stages.findIndex((stage) => stage.segment_id === segmentId);
  return index > 0 ? progression.stages[index - 1]!.segment_id : null;
}

/**
 * M1 grades the final symbolic response. Earlier representations are required
 * experiences and diagnostics, so a review there must not make completion
 * impossible after the learner correctly completes the abstract stage.
 */
export function v2CompletionRequiredSegmentIds(document: V2PublicLesson): string[] {
  const cpaStages = document.representation_progressions?.flatMap((progression) => progression.stages) ?? [];
  const cpaStageIds = new Set(cpaStages.map((stage) => stage.segment_id));
  const finalCpaStageIds = new Set(cpaStages.filter((stage) => stage.stage === 'abstract').map((stage) => stage.segment_id));
  return document.segments
    .filter((segment) => segment.grading === 'server' && (!cpaStageIds.has(segment.id) || finalCpaStageIds.has(segment.id)))
    .map((segment) => segment.id);
}

/**
 * The response-level Mentor stage projection (OD-19 / S05.2bh). The
 * character is ALWAYS the learner's own stored preference — catalog default
 * when never chosen — never the document's authored `mentor_stage.character`
 * and never anything a client supplied. The scene is the document's
 * declared, already-validated scene. The stored character is re-validated
 * against the catalog here so a drifted preference row fails closed (no
 * stage) instead of sending an unknown character to a renderer.
 */
export function projectV2MentorStage(document: V2PublicLesson, character: string | null | undefined): V2MentorStage | null {
  const declared = document.mentor_stage;
  if (!declared) return null;
  const parsed = v2MentorStageSchema.shape.character.safeParse(character);
  if (!parsed.success) return null;
  return { character: parsed.data, scene: declared.scene };
}

/**
 * The delivered document must not carry the authored `mentor_stage`: the
 * per-learner character is resolved at the route and projected as the
 * response's own `mentor_stage` field. Stripping it here — the same posture
 * as answer material — keeps the delivered document answerless, learner-free
 * authoring data with the projection explicit beside it.
 */
export function stripV2MentorStage(document: unknown): unknown {
  if (typeof document !== 'object' || document === null || Array.isArray(document)
    || !Object.hasOwn(document, 'mentor_stage')) return document;
  const stripped = { ...(document as Record<string, unknown>) };
  delete stripped.mentor_stage;
  return stripped;
}

/**
 * GAP-FIX-R1 (OD-17, B.7): the non-scored steps a mixed document requires the
 * learner to act on (Mentor turns, explored visuals). Completion needs a view
 * receipt for each, and a met receipt for every server-graded step.
 */
export function v2ViewedSegmentIds(document: V2PublicLesson): string[] {
  return document.segments.filter((segment) => segment.grading === 'none').map((segment) => segment.id);
}
