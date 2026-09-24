import { z } from 'zod';
import { growthComparison } from './v2GrowthComparison.js';
import { scoreV2Visual, type V2VisualKind } from './v2VisualScorer.js';

/*
 * Core's independently authored copy of the public v2 lesson contract.
 * The browser has its own fail-closed parser; Core never imports frontend
 * source because these packages intentionally have no shared runtime types.
 * Keep the two contracts aligned through the focused parity fixtures below.
 */

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
const locale = z.enum(['en-US', 'es-MX', 'pt-BR']);
const ageBand = z.enum(['6-9', '10-12', '13-17', 'adult']);
const eligibility = z.object({ minimum_age: z.number().int().min(0).max(119), maximum_age: z.number().int().min(0).max(119) }).strict()
  .refine((value) => value.minimum_age <= value.maximum_age, 'Invalid age eligibility');
const positive = z.number().int().positive().safe();
const nonnegative = z.number().int().nonnegative().safe();
const base = { id, prompt: z.string().trim().min(1).max(500) };

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
const schemaDiagramPayload = z.object({ income: positive.max(100), spending: positive.max(99), incomeLabel: z.string().trim().min(1).max(40), spendingLabel: z.string().trim().min(1).max(40), remainingLabel: z.string().trim().min(1).max(40), spokenText: z.string().trim().min(1).max(120) }).strict().refine((v) => v.spending < v.income, 'Invalid schema diagram');
const schemaDiagramStructure = z.object({ ...base, type: z.literal('math.schema-diagram.structure.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const schemaDiagramSlots = z.object({ ...base, type: z.literal('math.schema-diagram.slots.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const schemaDiagramAnswer = z.object({ ...base, type: z.literal('math.schema-diagram.answer.v2'), grading: z.literal('server'), visual: z.object({ type: z.literal('schema-diagram') }).strict(), payload: schemaDiagramPayload }).strict();
const goalBullet = z.object({
  ...base, type: z.literal('visual.goal-bullet.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('bullet') }).strict(),
  payload: z.object({ minimum: nonnegative, maximum: positive, target: positive, step: positive, initial: nonnegative,
    currency: z.enum(['coins', 'local']) }).strict().refine((v) => v.maximum > v.minimum && v.target > v.minimum && v.target < v.maximum
      && (v.maximum - v.minimum) % v.step === 0 && (v.target - v.minimum) % v.step === 0 && v.initial >= v.minimum
      && v.initial <= v.maximum && (v.initial - v.minimum) % v.step === 0, 'Invalid goal range'),
}).strict();
const percentGrid = z.object({
  ...base, type: z.literal('visual.percent-grid.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('percent-grid') }).strict(),
  payload: z.object({ baseUnits: positive.max(1_000_000), step: positive.max(100), initialPercent: nonnegative.max(100),
    mode: z.enum(['discount', 'tax']), currency: z.enum(['coins', 'local']) }).strict()
    .refine((v) => 100 % v.step === 0 && v.baseUnits * v.step % 100 === 0 && v.initialPercent % v.step === 0, 'Invalid percent range'),
}).strict();
const placeValue = z.object({
  ...base, type: z.literal('math.place-value.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('base-ten') }).strict(),
  payload: z.object({ total: positive.min(10).max(29) }).strict(),
}).strict();
const savingsRule = z.object({
  ...base, type: z.literal('logic.savings-rule.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('rule-diagram') }).strict(),
  payload: z.object({ goal: positive.min(2).max(100), shortfall: positive }).strict().refine((v) => v.shortfall < v.goal, 'Invalid savings rule'),
}).strict();
const ledger = z.object({
  ...base, type: z.literal('money.running-ledger.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('balance-meter') }).strict(),
  payload: z.object({ initial: nonnegative.max(100), sale: positive.max(100), cost: positive.max(100), maxEntries: positive.max(8) }).strict(),
}).strict();
const growth = z.object({
  ...base, type: z.literal('visual.growth-comparison.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('multi-line') }).strict(),
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
  ...base, type: z.literal('visual.tax-bracket.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('stacked-bar') }).strict(),
  payload: z.object({ minimumIncomeMinor: nonnegative, maximumIncomeMinor: positive.max(10_000_000), incomeStepMinor: positive,
    initialIncomeMinor: nonnegative, brackets: z.array(z.object({ upToMinor: nonnegative.nullable(), rateBasisPoints: nonnegative.max(10_000) }).strict()).min(2).max(6) }).strict()
    .refine((v) => v.maximumIncomeMinor > v.minimumIncomeMinor && (v.maximumIncomeMinor - v.minimumIncomeMinor) % v.incomeStepMinor === 0
      && v.initialIncomeMinor >= v.minimumIncomeMinor && v.initialIncomeMinor <= v.maximumIncomeMinor && (v.initialIncomeMinor - v.minimumIncomeMinor) % v.incomeStepMinor === 0
      && v.brackets.at(-1)?.upToMinor === null && v.brackets.every((b, i) => b.upToMinor === null ? i === v.brackets.length - 1 : i === 0 ? b.upToMinor > 0 : b.upToMinor > (v.brackets[i - 1]?.upToMinor ?? Infinity)), 'Invalid tax brackets'),
}).strict();
const ratioTable = z.object({
  ...base, type: z.literal('math.ratio-table.v2'), grading: z.literal('none'), visual: z.object({ type: z.literal('ratio-table') }).strict(),
  payload: z.object({ itemsPerPack: positive.max(12), pricePerPack: positive.max(1_000), minimumPacks: positive.max(8),
    maximumPacks: positive.max(8), initialPacks: positive.max(8), currency: z.literal('coins') }).strict()
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

const segment = z.discriminatedUnion('type', [allocation, savingsLine, numberLine, fractionNumberLine, fractionArea, barModelStructure, barModelAnswer, schemaDiagramStructure, schemaDiagramSlots, schemaDiagramAnswer, goalBullet, percentGrid, placeValue, savingsRule, ledger, growth, taxBracket, ratioTable, workedExample, functionMachine, cpaCount]);
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
} as const;

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
}).strict().superRefine((document, ctx) => {
  const segmentIds = new Set<string>();
  const declared = new Set(document.required_capabilities);
  if (new Set(document.knowledge_component_ids).size !== document.knowledge_component_ids.length) ctx.addIssue({ code: 'custom', path: ['knowledge_component_ids'], message: 'Duplicate knowledge component' });
  if (declared.size !== document.required_capabilities.length) ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Duplicate capability' });
  const expected = new Set<string>();
  for (const [index, value] of document.segments.entries()) {
    if (segmentIds.has(value.id)) ctx.addIssue({ code: 'custom', path: ['segments', index, 'id'], message: 'Duplicate segment id' });
    segmentIds.add(value.id);
    const needed = value.type === 'money.allocation.v2' && value.visual.type !== 'stacked-bar'
      ? [`visual.${value.visual.type}.v1`, 'operation.reallocate.v1'] : capabilities[value.type];
    needed.forEach((capability) => expected.add(capability));
    if (needed.some((capability) => !declared.has(capability))) ctx.addIssue({ code: 'custom', path: ['required_capabilities'], message: 'Missing segment capability' });
    if (value.type === 'math.place-value.v2' && document.age_band !== '6-9') ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Invalid place-value pathway' });
    if (value.type === 'math.number-line.fraction.v2'
      && (document.age_band !== '10-12' || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid fraction number-line pathway' });
    }
    if (value.type === 'math.fraction-area.v2'
      && (document.age_band !== '6-9' || document.eligibility.minimum_age !== 7 || document.eligibility.maximum_age !== 9)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid fraction-area pathway' });
    }
    if ((value.type === 'math.bar-model.structure.v2' || value.type === 'math.bar-model.answer.v2')
      && (document.age_band !== '10-12' || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid bar-model pathway' });
    }
    if (value.type === 'money.allocation.v2' && value.visual.type === 'waffle' && (document.age_band !== '6-9' || value.payload.total !== 10 || value.payload.step !== 1 || value.payload.currency !== 'coins')) ctx.addIssue({ code: 'custom', path: ['segments', index], message: 'Invalid waffle pilot' });
    if (value.type === 'money.allocation.v2' && value.visual.type === 'donut' && (document.age_band !== '10-12' || value.payload.total !== 60 || value.payload.step !== 5 || value.payload.currency !== 'coins')) ctx.addIssue({ code: 'custom', path: ['segments', index], message: 'Invalid donut pilot' });
    if (value.type === 'logic.savings-rule.v2' && document.age_band !== '10-12') ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Invalid savings-rule pathway' });
    if (value.type === 'visual.percent-grid.v2' && (document.age_band !== '10-12' || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid percent-grid pathway' });
    if ((value.type === 'money.running-ledger.v2' || value.type === 'visual.growth-comparison.v2') && document.age_band !== '13-17') ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Invalid teen pathway' });
    if (value.type === 'visual.tax-bracket.v2' && (document.age_band !== '13-17' || document.eligibility.minimum_age !== 14 || document.eligibility.maximum_age !== 17)) ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid tax-bracket pathway' });
    if (value.type === 'math.ratio-table.v2' && (document.age_band !== '10-12' || value.payload.itemsPerPack !== 3 || value.payload.pricePerPack !== 15 || value.payload.minimumPacks !== 1 || value.payload.maximumPacks !== 4 || value.payload.initialPacks !== 2 || value.payload.currency !== 'coins')) ctx.addIssue({ code: 'custom', path: ['segments', index], message: 'Invalid ratio-table pilot' });
    if (value.type === 'math.worked-example.v2' && (document.age_band !== '10-12'
      || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid worked-example pathway' });
    }
    if (value.type === 'math.function-machine.v2' && (document.age_band !== '10-12'
      || document.eligibility.minimum_age !== 10 || document.eligibility.maximum_age !== 12)) {
      ctx.addIssue({ code: 'custom', path: ['eligibility'], message: 'Invalid function-machine pathway' });
    }
    if (value.type === 'math.cpa-count.v2' && (document.age_band !== '6-9' && document.age_band !== '10-12')) {
      ctx.addIssue({ code: 'custom', path: ['age_band'], message: 'Invalid CPA count pathway' });
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
  'math.schema-diagram.structure.v2': z.object({ schema: z.literal('change') }).strict(),
  'math.schema-diagram.slots.v2': z.object({ income: positive.max(100), spending: positive.max(99) }).strict(),
  'math.schema-diagram.answer.v2': z.object({ target: nonnegative.max(100) }).strict(),
  'math.worked-example.v2': z.object({ expectedValues: z.record(z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/), z.string().trim().min(1).max(40)) }).strict(),
  'math.function-machine.v2': z.object({ multiplier: positive.max(12), offset: nonnegative.max(100), heldOutInputs: z.array(nonnegative.max(24)).min(2).max(4) }).strict()
    .refine((value) => new Set(value.heldOutInputs).size === value.heldOutInputs.length, 'Duplicate held-out input'),
  'math.cpa-count.v2': z.object({ target: positive.max(30) }).strict(),
} as const;

export type V2PublicLesson = z.infer<typeof v2PublicLessonSchema>;
type V2Segment = z.infer<typeof segment>;
export type V2GradeResult = { score: 0 | 100; correct: boolean; document: V2PublicLesson; segmentId: string };

/** The canonical scorer accepts only the semantic fields, never renderer metadata. */
function scorerPayload(item: Extract<V2Segment, { grading: 'server' }>): Record<string, unknown> {
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
          : (item.type === 'math.schema-diagram.structure.v2' || item.type === 'math.schema-diagram.slots.v2' || item.type === 'math.schema-diagram.answer.v2')
            ? { income: item.payload.income, spending: item.payload.spending }
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
  const scored = parsed.data.segments.filter((segment): segment is Extract<V2Segment, { grading: 'server' }> => segment.grading === 'server');
  if (Object.keys(keys).length !== scored.length) return null;
  for (const item of scored) {
    if (!Object.hasOwn(keys, item.id)) return null;
    const rubric = rubricByKind[item.type as keyof typeof rubricByKind].safeParse(keys[item.id]);
    const sample = item.type === 'money.allocation.v2' ? { save: 0, spend: item.payload.total, share: 0 }
      : item.type === 'math.number-line.whole.v2' ? { value: String(item.payload.minimum) }
        : item.type === 'math.number-line.fraction.v2' ? { value: '0/1' }
          : item.type === 'math.fraction-area.v2' ? { n: 0, d: item.payload.minimumParts }
            : item.type === 'math.bar-model.structure.v2' ? { model: 'comparison' }
              : item.type === 'math.schema-diagram.structure.v2' ? { schema: 'change' }
                : item.type === 'math.schema-diagram.slots.v2' ? { income: String(item.payload.income), spending: String(item.payload.spending) }
                  : item.type === 'math.worked-example.v2' ? { values: Object.fromEntries(item.payload.response_step_ids.map((stepId) => [stepId, '0'])) }
                  : item.type === 'math.function-machine.v2' ? { multiplier: '1', offset: '0' }
                  : item.type === 'math.cpa-count.v2' ? { value: '0' }
                  : { value: '0' };
    if (!rubric.success || scoreV2Visual(item.type as V2VisualKind, scorerPayload(item), sample, rubric.data) === 'invalid') return null;
  }
  return parsed.data;
}

/** Server-only semantic scoring. A malformed response never becomes a score. */
export function gradeV2Visual(document: V2PublicLesson, answerKeys: Record<string, unknown>, segmentId: string, response: unknown): V2GradeResult | null {
  const segment = document.segments.find((item) => item.id === segmentId);
  if (!segment || segment.grading !== 'server' || !Object.hasOwn(answerKeys, segmentId)) return null;
  const rubric = rubricByKind[segment.type as keyof typeof rubricByKind].safeParse(answerKeys[segmentId]);
  if (!rubric.success) return null;
  const verdict = scoreV2Visual(segment.type as V2VisualKind, scorerPayload(segment), response, rubric.data);
  if (verdict === 'invalid' || verdict === 'valid') return null;
  return { score: verdict === 'met' ? 100 : 0, correct: verdict === 'met', document, segmentId };
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
