import { z } from 'zod';
import { growthComparison } from './growthComparisonModel.generated';

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
const locale = z.enum(['en-US', 'es-MX', 'pt-BR']);
const ageBand = z.enum(['6-9', '10-12', '13-17', 'adult']);

/*
 * OD-19 / S05.2bh: the compact lesson Mentor stage projection contract,
 * mirrored hand-for-hand with Core's v2LessonDocument.ts. `mentor_stage` is
 * answerless public metadata on the document and the shape of the
 * response-level projection the authenticated lesson route resolves. The
 * character in the projection is the learner's own stored choice (catalog
 * default when never chosen); the scene is the document's declared,
 * approved scene. Closed enums on both sides mean a new character or scene
 * can never drift onto one side alone.
 */
export const MENTOR_STAGE_CHARACTERS = ['rho', 'zara', 'liruf', 'dina'] as const;
export const MENTOR_STAGE_SCENES = ['diorama-a', 'diorama-b'] as const;
export const mentorStageSchema = z.object({
  character: z.enum(MENTOR_STAGE_CHARACTERS),
  scene: z.enum(MENTOR_STAGE_SCENES),
}).strict();
export type LessonMentorStage = z.infer<typeof mentorStageSchema>;
const eligibility = z.object({ minimum_age: z.number().int().min(0).max(119), maximum_age: z.number().int().min(0).max(119) }).strict()
  .refine((value) => value.minimum_age <= value.maximum_age, 'Invalid age eligibility');
const positiveInteger = z.number().int().positive().safe();
const nonnegativeInteger = z.number().int().nonnegative().safe();

const segmentBase = { id, prompt: z.string().trim().min(1).max(500) };
const allocationSegment = z.object({
  ...segmentBase,
  type: z.literal('money.allocation.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.enum(['stacked-bar', 'waffle', 'donut']) }).strict(),
  payload: z.object({ total: positiveInteger, step: positiveInteger, currency: z.enum(['coins', 'local']) }).strict()
    .refine((value) => value.total % value.step === 0, 'Step must divide the total'),
}).strict();
const timelineSegment = z.object({
  ...segmentBase,
  type: z.literal('visual.savings-line.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('line') }).strict(),
  payload: z.object({ periods: positiveInteger.max(24), minimum: nonnegativeInteger, maximum: positiveInteger,
    step: positiveInteger, initial: nonnegativeInteger, currency: z.enum(['coins', 'local']), unit: z.enum(['week', 'month']) }).strict()
    .refine((value) => value.maximum >= value.minimum && (value.maximum - value.minimum) % value.step === 0
      && value.initial >= value.minimum && value.initial <= value.maximum && (value.initial - value.minimum) % value.step === 0,
    'Invalid timeline range'),
}).strict();
const numberLineSegment = z.object({
  ...segmentBase,
  type: z.literal('math.number-line.whole.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('number-line') }).strict(),
  payload: z.object({ minimum: nonnegativeInteger, maximum: positiveInteger, step: positiveInteger, initial: nonnegativeInteger }).strict()
    .refine((value) => value.maximum > value.minimum && (value.maximum - value.minimum) % value.step === 0
      && value.initial >= value.minimum && value.initial <= value.maximum && (value.initial - value.minimum) % value.step === 0,
    'Invalid number-line range'),
}).strict();

const fractionNumberLineSegment = z.object({
  ...segmentBase,
  type: z.literal('math.number-line.fraction.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('number-line') }).strict(),
  payload: z.object({
    maximumWhole: z.union([z.literal(1), z.literal(2)]), divisions: positiveInteger.max(12), initialUnits: nonnegativeInteger,
    spokenText: z.string().trim().min(1).max(120),
  }).strict().refine(
    (value) => value.divisions >= 2 && value.initialUnits <= value.maximumWhole * value.divisions,
    'Invalid fraction number-line range',
  ),
}).strict();

const fractionAreaSegment = z.object({
  ...segmentBase,
  type: z.literal('math.fraction-area.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('fraction-area') }).strict(),
  payload: z.object({
    minimumParts: positiveInteger.min(2).max(6), maximumParts: positiveInteger.min(2).max(6), initialParts: positiveInteger.min(2).max(6),
    initialShaded: nonnegativeInteger, spokenText: z.string().trim().min(1).max(120),
  }).strict().refine(
    (value) => value.minimumParts <= value.maximumParts && value.initialParts >= value.minimumParts
      && value.initialParts <= value.maximumParts && value.initialShaded <= value.initialParts,
    'Invalid fraction-area range',
  ),
}).strict();
const barModelPayload = z.object({ whole: positiveInteger.max(100), difference: positiveInteger.max(99), knownLabel: z.string().trim().min(1).max(40), unknownLabel: z.string().trim().min(1).max(40), spokenText: z.string().trim().min(1).max(120) }).strict()
  .refine((value) => value.difference < value.whole, 'Invalid bar-model range');
const barModelStructureSegment = z.object({ ...segmentBase, type: z.literal('math.bar-model.structure.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('bar-model') }).strict(), payload: barModelPayload }).strict();
const barModelAnswerSegment = z.object({ ...segmentBase, type: z.literal('math.bar-model.answer.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('bar-model') }).strict(), payload: barModelPayload }).strict();
const schemaDiagramPayload = z.object({ income: positiveInteger.max(100), spending: positiveInteger.max(99), incomeLabel: z.string().trim().min(1).max(40), spendingLabel: z.string().trim().min(1).max(40), remainingLabel: z.string().trim().min(1).max(40), spokenText: z.string().trim().min(1).max(120) }).strict()
  .refine((value) => value.spending < value.income, 'Invalid schema-diagram range');
const schemaDiagramStructureSegment = z.object({ ...segmentBase, type: z.literal('math.schema-diagram.structure.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const schemaDiagramSlotsSegment = z.object({ ...segmentBase, type: z.literal('math.schema-diagram.slots.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const schemaDiagramAnswerSegment = z.object({ ...segmentBase, type: z.literal('math.schema-diagram.answer.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();

const goalBulletSegment = z.object({
  ...segmentBase,
  type: z.literal('visual.goal-bullet.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('bullet') }).strict(),
  payload: z.object({ minimum: nonnegativeInteger, maximum: positiveInteger, target: positiveInteger, step: positiveInteger,
    initial: nonnegativeInteger, currency: z.enum(['coins', 'local']) }).strict()
    .refine((value) => value.maximum > value.minimum && value.target > value.minimum && value.target < value.maximum
      && (value.maximum - value.minimum) % value.step === 0 && (value.target - value.minimum) % value.step === 0
      && value.initial >= value.minimum && value.initial <= value.maximum && (value.initial - value.minimum) % value.step === 0,
    'Invalid goal range'),
}).strict();

const percentGridSegment = z.object({
  ...segmentBase,
  type: z.literal('visual.percent-grid.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('percent-grid') }).strict(),
  payload: z.object({ baseUnits: positiveInteger.max(1_000_000), step: positiveInteger.max(100),
    initialPercent: nonnegativeInteger.max(100), mode: z.enum(['discount', 'tax']), currency: z.enum(['coins', 'local']) }).strict()
    .refine((value) => 100 % value.step === 0 && value.baseUnits * value.step % 100 === 0
      && value.initialPercent % value.step === 0, 'Invalid percent range'),
}).strict();

const placeValueSegment = z.object({
  ...segmentBase,
  type: z.literal('math.place-value.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('base-ten') }).strict(),
  payload: z.object({ total: positiveInteger.min(10).max(29) }).strict(),
}).strict();

const savingsRuleSegment = z.object({
  ...segmentBase,
  type: z.literal('logic.savings-rule.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('rule-diagram') }).strict(),
  payload: z.object({ goal: positiveInteger.min(2).max(100), shortfall: positiveInteger }).strict()
    .refine((value) => value.shortfall < value.goal, 'Shortfall must be smaller than the goal'),
}).strict();

const runningLedgerSegment = z.object({
  ...segmentBase,
  type: z.literal('money.running-ledger.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('balance-meter') }).strict(),
  payload: z.object({ initial: nonnegativeInteger.max(100), sale: positiveInteger.max(100),
    cost: positiveInteger.max(100), maxEntries: positiveInteger.max(8) }).strict(),
}).strict();

const growthComparisonSegment = z.object({
  ...segmentBase,
  type: z.literal('visual.growth-comparison.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('multi-line') }).strict(),
  payload: z.object({
    principalMinor: positiveInteger.max(1_000_000),
    minimumRateBps: positiveInteger.min(100).max(1_500),
    maximumRateBps: positiveInteger.min(100).max(1_500),
    rateStepBps: positiveInteger.max(1_400),
    initialRateBps: positiveInteger.min(100).max(1_500),
    minimumYears: positiveInteger.max(30),
    maximumYears: positiveInteger.max(30),
    yearStep: positiveInteger.max(29),
    initialYears: positiveInteger.max(30),
    predictionStepMinor: positiveInteger.max(100_000),
    predictionMaximumMinor: positiveInteger.max(100_000_000),
  }).strict().refine((value) => {
    const range = value.maximumRateBps - value.minimumRateBps;
    const yearRange = value.maximumYears - value.minimumYears;
    const maximum = growthComparison({ principalMinor: value.principalMinor,
      rateBasisPoints: value.maximumRateBps, years: value.maximumYears })?.at(-1)?.compoundMinor;
    return value.principalMinor >= 100 && range > 0 && range % value.rateStepBps === 0
      && value.initialRateBps >= value.minimumRateBps && value.initialRateBps <= value.maximumRateBps
      && (value.initialRateBps - value.minimumRateBps) % value.rateStepBps === 0
      && yearRange > 0 && yearRange % value.yearStep === 0
      && value.initialYears >= value.minimumYears && value.initialYears <= value.maximumYears
      && (value.initialYears - value.minimumYears) % value.yearStep === 0
      && value.predictionMaximumMinor > value.principalMinor
      && (value.predictionMaximumMinor - value.principalMinor) % value.predictionStepMinor === 0
      && maximum !== undefined && maximum <= value.predictionMaximumMinor;
  }, 'Invalid growth-comparison range'),
}).strict();

const taxBracketSegment = z.object({
  ...segmentBase,
  type: z.literal('visual.tax-bracket.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('stacked-bar') }).strict(),
  payload: z.object({
    minimumIncomeMinor: nonnegativeInteger, maximumIncomeMinor: positiveInteger.max(10_000_000), incomeStepMinor: positiveInteger,
    initialIncomeMinor: nonnegativeInteger,
    brackets: z.array(z.object({ upToMinor: nonnegativeInteger.nullable(), rateBasisPoints: nonnegativeInteger.max(10_000) }).strict()).min(2).max(6),
  }).strict().refine((value) => value.maximumIncomeMinor > value.minimumIncomeMinor
    && (value.maximumIncomeMinor - value.minimumIncomeMinor) % value.incomeStepMinor === 0
    && value.initialIncomeMinor >= value.minimumIncomeMinor && value.initialIncomeMinor <= value.maximumIncomeMinor
    && (value.initialIncomeMinor - value.minimumIncomeMinor) % value.incomeStepMinor === 0
    && value.brackets.at(-1)?.upToMinor === null
    && value.brackets.every((bracket, index) => bracket.upToMinor === null ? index === value.brackets.length - 1
      : index === 0 ? bracket.upToMinor > 0 : bracket.upToMinor > (value.brackets[index - 1]?.upToMinor ?? Infinity)), 'Invalid tax-bracket range'),
}).strict();

const ratioTableSegment = z.object({
  ...segmentBase,
  type: z.literal('math.ratio-table.v2'),
  grading: z.literal('none'),
  visual: z.object({ type: z.literal('ratio-table') }).strict(),
  payload: z.object({
    itemsPerPack: positiveInteger.max(12), pricePerPack: positiveInteger.max(1_000),
    minimumPacks: positiveInteger.max(8), maximumPacks: positiveInteger.max(8), initialPacks: positiveInteger.max(8),
    currency: z.literal('coins'),
  }).strict().refine((value) => value.maximumPacks > value.minimumPacks && value.initialPacks >= value.minimumPacks
    && value.initialPacks <= value.maximumPacks && value.pricePerPack % value.itemsPerPack === 0,
  'Invalid ratio-table range'),
}).strict();

/**
 * M9/M10 teaching data is intentionally public: these are the values shown in
 * a worked example. It contains no learner answer, private rubric or mastery
 * decision. Core chooses the fade count only when it publishes a document.
 */
const workedExampleSegment = z.object({
  ...segmentBase,
  type: z.literal('math.worked-example.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('worked-example') }).strict(),
  payload: z.object({
    steps: z.array(z.object({
      id,
      expression: z.string().trim().min(1).max(80),
      result: z.string().trim().min(1).max(40),
      spokenText: z.string().trim().min(1).max(120),
    }).strict()).min(3).max(4),
    fade_count: nonnegativeInteger.max(3),
    response_step_ids: z.array(id).min(2).max(3),
  }).strict().refine((value) => value.fade_count < value.steps.length
    && new Set(value.steps.map((step) => step.id)).size === value.steps.length
    && value.response_step_ids.join(':') === value.steps.slice(1).map((step) => step.id).join(':'),
  'Invalid worked-example steps'),
}).strict();

const functionMachineSegment = z.object({
  ...segmentBase,
  type: z.literal('math.function-machine.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('function-machine') }).strict(),
  payload: z.object({
    examples: z.array(z.object({ input: nonnegativeInteger.max(12), output: nonnegativeInteger.max(200) }).strict()).min(3).max(5),
    multiplierMaximum: positiveInteger.max(12), offsetMaximum: nonnegativeInteger.max(100),
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
const cpaCountSegment = z.object({
  ...segmentBase,
  type: z.literal('math.cpa-count.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('cpa-count') }).strict(),
  payload: z.object({ left: positiveInteger.max(20), right: positiveInteger.max(20), spokenText: z.string().trim().min(1).max(120) }).strict()
    .refine((value) => value.left + value.right <= 30, 'Invalid CPA count'),
}).strict();

/**
 * B.12 (Law 4): decide, then say why. Mirrors Core's `decideJustify`. The
 * labels are public; which choice is acceptable and how each reason is judged
 * stay in Core's private answer key, so the browser can never grade either.
 */
const reasoningOption = z.object({ id, label: z.string().trim().min(1).max(80) }).strict();
const decideJustifySegment = z.object({
  ...segmentBase,
  type: z.literal('reasoning.decide-justify.v2'),
  grading: z.literal('server'),
  visual: z.object({ type: z.literal('decision-reasons') }).strict(),
  payload: z.object({
    choices: z.array(reasoningOption).min(2).max(4),
    reasonPrompt: z.string().trim().min(1).max(200),
    reasons: z.array(reasoningOption).min(3).max(5),
  }).strict().refine((value) => new Set([...value.choices, ...value.reasons].map((option) => option.id)).size
    === value.choices.length + value.reasons.length, 'Invalid decision reasons'),
}).strict();

const segment = z.discriminatedUnion('type', [allocationSegment, timelineSegment, numberLineSegment, fractionNumberLineSegment, fractionAreaSegment, barModelStructureSegment, barModelAnswerSegment, schemaDiagramStructureSegment, schemaDiagramSlotsSegment, schemaDiagramAnswerSegment, goalBulletSegment, percentGridSegment, placeValueSegment, savingsRuleSegment, runningLedgerSegment, growthComparisonSegment, taxBracketSegment, ratioTableSegment, workedExampleSegment, functionMachineSegment, cpaCountSegment, decideJustifySegment]);
type SegmentType = z.infer<typeof segment>['type'];
export const REQUIRED_SEGMENT_CAPABILITIES = {
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
  'math.place-value.v2': ['visual.base-ten.v1', 'operation.trade-ten.v1', 'operation.linked-representations.v1',
    'operation.step-replay.v1'],
  'logic.savings-rule.v2': ['visual.rule-diagram.v1', 'operation.choose-connective.v1', 'operation.case-step.v1'],
  'money.running-ledger.v2': ['visual.balance-meter.v1', 'operation.running-ledger.v1', 'operation.step-replay.v1'],
  'visual.growth-comparison.v2': ['visual.multi-line.v1', 'operation.parameter-slider.v1', 'operation.predict-reveal.v1', 'operation.scale-toggle.v1'],
  'visual.tax-bracket.v2': ['visual.stacked-bar.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.ratio-table.v2': ['visual.ratio-table.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.worked-example.v2': ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
  'math.function-machine.v2': ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'],
  'math.cpa-count.v2': ['visual.cpa-count.v1', 'operation.count-objects.v1', 'operation.symbolic-answer.v1'],
  'reasoning.decide-justify.v2': ['visual.decision-card.v1', 'operation.choose-option.v1', 'operation.justify-choice.v1'],
} as const satisfies Record<SegmentType, readonly string[]>;
export const LESSON_CLIENT_CAPABILITIES = [...new Set([...Object.values(REQUIRED_SEGMENT_CAPABILITIES).flat(),
  'visual.waffle.v1', 'visual.donut.v1'])];
const knownTypes = new Set(Object.keys(REQUIRED_SEGMENT_CAPABILITIES));
const representationProgression = z.object({
  fading_group_id: id,
  problem_id: id,
  stages: z.tuple([
    z.object({ segment_id: id, stage: z.literal('concrete'), worked_steps_shown: nonnegativeInteger.max(8) }).strict(),
    z.object({ segment_id: id, stage: z.literal('pictorial'), worked_steps_shown: nonnegativeInteger.max(8) }).strict(),
    z.object({ segment_id: id, stage: z.literal('abstract'), worked_steps_shown: nonnegativeInteger.max(8) }).strict(),
  ]),
}).strict();
export const lessonClientDocumentSchema = z.object({
  schema_version: z.literal(2),
  course_id: id,
  pathway_id: id,
  chapter_id: id,
  lesson_id: id,
  version_id: id,
  locale,
  age_band: ageBand,
  eligibility,
  knowledge_component_ids: z.array(id).min(1),
  adventure_scene_id: id,
  title: z.string().trim().min(1).max(120),
  required_capabilities: z.array(id).min(1),
  segments: z.array(segment).min(1).max(80),
  representation_progressions: z.array(representationProgression).min(1).max(20).optional(),
  mentor_stage: mentorStageSchema.optional(),
}).strict().superRefine((document, ctx) => {
  const ids = new Set<string>();
  for (const [index, value] of document.segments.entries()) {
    if (ids.has(value.id)) ctx.addIssue({ code: 'custom', path: ['segments', index, 'id'], message: 'Duplicate segment id' });
    ids.add(value.id);
  }
  if (new Set(document.knowledge_component_ids).size !== document.knowledge_component_ids.length) {
    ctx.addIssue({ code: 'custom', path: ['knowledge_component_ids'], message: 'Duplicate knowledge component id' });
  }
  const declared = new Set(document.required_capabilities);
  if (declared.size !== document.required_capabilities.length) {
    ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Duplicate capability' });
  }
  const expected = new Set<string>();
  for (const [index, value] of document.segments.entries()) {
    const needed = value.type === 'money.allocation.v2' && value.visual.type !== 'stacked-bar'
      ? [`visual.${value.visual.type}.v1`, 'operation.reallocate.v1'] : REQUIRED_SEGMENT_CAPABILITIES[value.type];
    needed.forEach((capability) => expected.add(capability));
    if (needed.some((capability) => !declared.has(capability))) {
      ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Missing segment capability declaration' });
    }
    if (value.type === 'math.place-value.v2' && document.age_band !== '6-9') {
      ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Place-value pilot is restricted to ages 6–9' });
    }
    if (value.type === 'math.number-line.fraction.v2'
      && (document.age_band !== '10-12' || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Fraction number-line pilot is restricted to ages 10–12' });
    }
    if (value.type === 'math.fraction-area.v2'
      && (document.age_band !== '6-9' || document.eligibility.minimum_age !== 7 || document.eligibility.maximum_age !== 9)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Fraction-area pilot is restricted to ages 7–9' });
    }
    if ((value.type === 'math.bar-model.structure.v2' || value.type === 'math.bar-model.answer.v2')
      && (document.age_band !== '10-12' || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Bar-model pilot is restricted to ages 10–12' });
    }
    if (value.type === 'money.allocation.v2' && value.visual.type === 'waffle'
      && (document.age_band !== '6-9' || value.payload.total !== 10 || value.payload.step !== 1
        || value.payload.currency !== 'coins')) {
      ctx.addIssue({ code: 'custom', path: ['segments', index, 'payload'],
        message: 'This waffle pilot requires ten one-coin rows for ages 6–9' });
    }
    if (value.type === 'money.allocation.v2' && value.visual.type === 'donut'
      && (document.age_band !== '10-12' || value.payload.total !== 60 || value.payload.step !== 5
        || value.payload.currency !== 'coins')) {
      ctx.addIssue({ code: 'custom', path: ['segments', index, 'payload'],
        message: 'This donut pilot requires sixty five-coin steps for ages 10–12' });
    }
    if (value.type === 'logic.savings-rule.v2' && document.age_band !== '10-12') {
      ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Savings-rule pilot is restricted to ages 10–12' });
    }
    if (value.type === 'visual.percent-grid.v2' && (document.age_band !== '10-12'
      || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Percent-grid pilot is restricted to the controlled 10–12 pathway' });
    }
    if (value.type === 'money.running-ledger.v2' && document.age_band !== '13-17') {
      ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Running-ledger pilot is restricted to ages 13–17' });
    }
    if (value.type === 'visual.growth-comparison.v2' && document.age_band !== '13-17') {
      ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Growth-comparison pilot is restricted to ages 13–17' });
    }
    if (value.type === 'visual.tax-bracket.v2' && (document.age_band !== '13-17'
      || document.eligibility.minimum_age !== 14 || document.eligibility.maximum_age !== 17)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Tax-bracket pilot is restricted to ages 14–17' });
    }
    if (value.type === 'math.ratio-table.v2' && (document.age_band !== '10-12' || value.payload.itemsPerPack !== 3
      || value.payload.pricePerPack !== 15 || value.payload.minimumPacks !== 1 || value.payload.maximumPacks !== 4
      || value.payload.initialPacks !== 2 || value.payload.currency !== 'coins')) {
      ctx.addIssue({ code: 'custom', path: ['segments', index, 'payload'],
        message: 'This ratio-table pilot requires the controlled three-items-for-fifteen-coins scenario for ages 10–12' });
    }
    if (value.type === 'math.worked-example.v2' && (document.age_band !== '10-12'
      || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'],
        message: 'Worked-example pilot is restricted to ages 10–12' });
    }
    if (value.type === 'math.function-machine.v2' && (document.age_band !== '10-12'
      || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'],
        message: 'Function-machine pilot is restricted to ages 10–12' });
    }
    if (value.type === 'math.cpa-count.v2' && (document.age_band !== '6-9' && document.age_band !== '10-12')) {
      ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'CPA count is restricted to ages 6–12' });
    }
  }
  const hasBarModel = document.segments.some((value) => value.type === 'math.bar-model.structure.v2' || value.type === 'math.bar-model.answer.v2');
  if (hasBarModel && (document.segments.length !== 2
    || document.segments[0]?.type !== 'math.bar-model.structure.v2'
    || document.segments[1]?.type !== 'math.bar-model.answer.v2')) {
    ctx.addIssue({ code: 'custom', path: ['segments'], message: 'Bar-model pilot requires an ordered structure and answer pair' });
  }
  const hasSchemaDiagram = document.segments.some((value) => value.type === 'math.schema-diagram.structure.v2' || value.type === 'math.schema-diagram.slots.v2' || value.type === 'math.schema-diagram.answer.v2');
  if (hasSchemaDiagram && (document.age_band !== '10-12' || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12
    || document.segments.length !== 3 || document.segments[0]?.type !== 'math.schema-diagram.structure.v2'
    || document.segments[1]?.type !== 'math.schema-diagram.slots.v2' || document.segments[2]?.type !== 'math.schema-diagram.answer.v2')) {
    ctx.addIssue({ code: 'custom', path: ['segments'], message: 'Schema-diagram pilot requires an ordered 10–12 structure, slots and answer sequence' });
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
    if (!expected.has(capability)) {
      ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Unexpected capability declaration' });
    }
  }
});

export type LessonClientDocument = z.infer<typeof lessonClientDocumentSchema>;
export type LessonClientSegment = LessonClientDocument['segments'][number];

/** Client-visible policy mirrors the server gate; it never contains a learner's actual age or birth date. */
export function ageEligibilityForBand(value: z.infer<typeof ageBand>): z.infer<typeof eligibility> {
  switch (value) {
    case '6-9': return { minimum_age: 6, maximum_age: 9 };
    case '10-12': return { minimum_age: 10, maximum_age: 12 };
    case '13-17': return { minimum_age: 13, maximum_age: 17 };
    case 'adult': return { minimum_age: 18, maximum_age: 119 };
  }
}

export type LessonLoadResult = { status: 'ready'; document: LessonClientDocument }
  | { status: 'upgrade-required' | 'invalid'; reason: string };

/** Fail closed: an unknown segment or missing capability cannot become a passing lesson. */
export function loadLessonClientDocument(raw: unknown, capabilities: readonly string[] = LESSON_CLIENT_CAPABILITIES): LessonLoadResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { status: 'invalid', reason: 'Document is not an object' };
  const candidate = raw as Record<string, unknown>;
  if (candidate.schema_version !== 2) return { status: 'upgrade-required', reason: 'Unsupported document version' };
  if (Array.isArray(candidate.segments) && candidate.segments.some((value) => typeof value === 'object' && value !== null
    && !knownTypes.has(String((value as Record<string, unknown>).type)))) return { status: 'upgrade-required', reason: 'Unsupported segment type' };
  const parsed = lessonClientDocumentSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', reason: 'Malformed or answer-bearing document' };
  const missing = parsed.data.required_capabilities.find((capability) => !capabilities.includes(capability));
  if (missing) return { status: 'upgrade-required', reason: `Missing capability: ${missing}` };
  return { status: 'ready', document: parsed.data };
}

/** Active attempts pin this exact lesson version and locale through reloads. */
export function lessonVersionKey(document: LessonClientDocument): string {
  return `${document.lesson_id}@${document.version_id}:${document.locale}`;
}

/**
 * The response-level Mentor stage projection, parsed fail-closed: a missing
 * or malformed projection simply means no stage — the lesson itself never
 * depends on this cosmetic read. Mirrors Core's `projectV2MentorStage`
 * output shape.
 */
export function loadMentorStageProjection(raw: unknown): LessonMentorStage | null {
  const parsed = mentorStageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
