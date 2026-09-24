import { describe, expect, it } from 'vitest';
import { lessonVersionKey, loadLessonClientDocument, loadMentorStageProjection } from './lessonDocument';
import { numberLinePilotDocument } from './NumberLineBoard';
import { goalBulletPilotDocument } from './GoalBulletBoard';
import { percentGridPilotDocument } from './PercentGridBoard';
import { placeValuePilotDocument } from './PlaceValueBoard';
import { savingsRulePilotDocument } from './SavingsRuleBoard';
import { runningLedgerPilotDocument } from './RunningLedgerBoard';
import { growthComparisonPilotDocument } from './GrowthComparisonBoard';
import { donutPilotDocument, wafflePilotDocument } from './AllocationBoard';
import { ratioTablePilotDocument } from './RatioTableBoard';
import { taxBracketPilotDocument } from './TaxBracketBoard';
import { fractionNumberLinePilotDocument } from './FractionNumberLineBoard';
import { fractionAreaPilotDocument } from './FractionAreaBoard';
import { barModelPilotDocument } from './BarModelBoard';
import { schemaDiagramPilotDocument } from './SchemaDiagramBoard';
import { workedExamplePilotDocument } from './WorkedExampleBoard';
import { functionMachinePilotDocument } from './FunctionMachineBoard';
import { cpaFadingPilotDocument } from './CpaFadingBoard';

const pilot = {
  schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
  lesson_id: 'pilot-allocation', version_id: 'rev-001', locale: 'es-MX', age_band: '6-9',
  eligibility: { minimum_age: 6, maximum_age: 9 },
  knowledge_component_ids: ['kc-saving-allocation'], adventure_scene_id: 'diorama-a', title: 'Divide tu dinero',
  required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
  segments: [{ id: 'allocate-01', type: 'money.allocation.v2', prompt: 'Divide 12 monedas.', grading: 'server',
    visual: { type: 'stacked-bar' }, payload: { total: 12, step: 1, currency: 'coins' } }],
};

describe('answerless versioned lesson client document', () => {
  it('accepts a supported pilot and pins its exact version and locale', () => {
    const result = loadLessonClientDocument(pilot);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(lessonVersionKey(result.document)).toBe('pilot-allocation@rev-001:es-MX');
  });

  it('refuses unsupported formats rather than skipping them and granting completion', () => {
    expect(loadLessonClientDocument({ ...pilot, schema_version: 3 }).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...pilot, segments: [{ ...pilot.segments[0], type: 'unknown.v3' }] }).status).toBe('upgrade-required');
    expect(loadLessonClientDocument(pilot, ['visual.stacked-bar.v1']).status).toBe('upgrade-required');
  });

  it('rejects answer keys, duplicate segments and invalid operation ranges', () => {
    expect(loadLessonClientDocument(({ ...pilot, eligibility: undefined } as unknown)).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, eligibility: { minimum_age: 10, maximum_age: 6 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, answer_keys: {} }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, segments: [{ ...pilot.segments[0], answer: { minimumSave: 4 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, segments: [pilot.segments[0], pilot.segments[0]] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, required_capabilities: ['visual.stacked-bar.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, required_capabilities: [...pilot.required_capabilities, 'operation.scale-toggle.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, segments: [{ ...pilot.segments[0], payload: { total: 12, step: 5, currency: 'coins' } }] }).status).toBe('invalid');
  });

  it('requires the exact waffle capability and ten-row youngest-tier fixture', () => {
    const waffle = wafflePilotDocument('es-MX') as { required_capabilities: string[];
      segments: [{ payload: { total: number; step: number }; answer?: number }] };
    expect(loadLessonClientDocument(waffle).status).toBe('ready');
    expect(loadLessonClientDocument(waffle, ['visual.stacked-bar.v1', 'operation.reallocate.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...waffle, required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...waffle, age_band: 'adult' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...waffle, segments: [{ ...waffle.segments[0], payload: {
      ...waffle.segments[0].payload, total: 12 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...waffle, segments: [{ ...waffle.segments[0], answer: 3 }] }).status).toBe('invalid');
  });

  it('requires a tween-only donut capability without changing allocation semantics', () => {
    const donut = donutPilotDocument('pt-BR') as { required_capabilities: string[];
      segments: [{ payload: { total: number }; answer?: number }] };
    expect(loadLessonClientDocument(donut).status).toBe('ready');
    expect(loadLessonClientDocument(donut, ['visual.stacked-bar.v1', 'operation.reallocate.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...donut, required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...donut, age_band: '6-9' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...donut, segments: [{ ...donut.segments[0], payload: {
      ...donut.segments[0].payload, total: 65 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...donut, segments: [{ ...donut.segments[0], answer: 20 }] }).status).toBe('invalid');
  });

  it('pins the controlled tween ratio-table scenario and its client capabilities', () => {
    const ratio = ratioTablePilotDocument('en-US') as { required_capabilities: string[]; age_band: string; segments: [{ payload: { pricePerPack: number } }] };
    expect(loadLessonClientDocument(ratio).status).toBe('ready');
    expect(loadLessonClientDocument(ratio, ['visual.ratio-table.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...ratio, age_band: '13-17' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...ratio, segments: [{ ...ratio.segments[0], payload: { ...ratio.segments[0].payload, pricePerPack: 18 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...ratio, segments: [{ ...ratio.segments[0], answer: 5 }] }).status).toBe('invalid');
  });

  it('validates the bounded number-line capability and rejects impossible placements', () => {
    const line = numberLinePilotDocument('es-MX', '6-9') as { required_capabilities: string[]; segments: [{ payload: { initial: number } }] };
    expect(loadLessonClientDocument(line).status).toBe('ready');
    expect(loadLessonClientDocument({ ...line, required_capabilities: ['visual.number-line.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...line, segments: [{ ...line.segments[0], payload: { ...line.segments[0].payload, initial: 11 } }] }).status).toBe('invalid');
  });

  it('accepts a client-safe bullet chart and refuses unreachable goal ranges', () => {
    const goal = goalBulletPilotDocument('es-MX', '6-9') as { required_capabilities: string[]; segments: [{ payload: { target: number } }] };
    expect(loadLessonClientDocument(goal).status).toBe('ready');
    expect(loadLessonClientDocument({ ...goal, required_capabilities: ['operation.parameter-slider.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...goal, segments: [{ ...goal.segments[0], payload: { ...goal.segments[0].payload, target: 11 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...goal, segments: [{ ...goal.segments[0], answer: 12 }] }).status).toBe('invalid');
  });

  it('requires a client-safe linked percent grid with whole-value outcomes', () => {
    const percent = percentGridPilotDocument('es-MX', '10-12') as { required_capabilities: string[];
      segments: [{ payload: { baseUnits: number; step: number }; answer?: number }] };
    expect(loadLessonClientDocument(percent).status).toBe('ready');
    expect(loadLessonClientDocument({ ...percent, eligibility: { minimum_age: 10, maximum_age: 14 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...percent, required_capabilities: ['visual.percent-grid.v1', 'operation.parameter-slider.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...percent, segments: [{ ...percent.segments[0], payload: { ...percent.segments[0].payload, baseUnits: 201 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...percent, segments: [{ ...percent.segments[0], payload: { ...percent.segments[0].payload, step: 7 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...percent, segments: [{ ...percent.segments[0], answer: 50 }] }).status).toBe('invalid');
  });

  it('accepts answerless base-ten exchange and refuses impossible or keyed payloads', () => {
    const blocks = placeValuePilotDocument('es-MX') as { required_capabilities: string[];
      segments: [{ payload: { total: number } }] };
    expect(loadLessonClientDocument(blocks).status).toBe('ready');
    expect(loadLessonClientDocument({ ...blocks, required_capabilities: ['visual.base-ten.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument(blocks, ['visual.base-ten.v1', 'operation.trade-ten.v1',
      'operation.linked-representations.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...blocks, segments: [{ ...blocks.segments[0], payload: { total: 9 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...blocks, segments: [{ ...blocks.segments[0], payload: { total: 30 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...blocks, age_band: 'adult' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...blocks, segments: [{ ...blocks.segments[0], answer: 14 }] }).status).toBe('invalid');
  });

  it('bounds the answerless savings rule and its 10–12 pathway', () => {
    const rule = savingsRulePilotDocument('pt-BR') as { required_capabilities: string[];
      segments: [{ payload: { goal: number; shortfall: number } }] };
    expect(loadLessonClientDocument(rule).status).toBe('ready');
    expect(rule.required_capabilities).toContain('operation.choose-connective.v1');
    expect(rule.required_capabilities).not.toContain('operation.build-rule.v1');
    expect(loadLessonClientDocument({ ...rule, required_capabilities: ['visual.rule-diagram.v1',
      'operation.build-rule.v1', 'operation.case-step.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...rule, age_band: 'adult' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...rule, required_capabilities: ['visual.rule-diagram.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...rule, segments: [{ ...rule.segments[0], payload: { goal: 10, shortfall: 10 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...rule, segments: [{ ...rule.segments[0], answer: 'and' }] }).status).toBe('invalid');
  });

  it('bounds the answerless running ledger and its teen pathway', () => {
    const ledger = runningLedgerPilotDocument('en-US') as { required_capabilities: string[];
      segments: [{ payload: { maxEntries: number } }] };
    expect(loadLessonClientDocument(ledger).status).toBe('ready');
    expect(loadLessonClientDocument({ ...ledger, age_band: 'adult' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...ledger, required_capabilities: ['visual.balance-meter.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...ledger, required_capabilities: ['visual.balance-meter.v1', 'operation.running-ledger.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument(ledger, ['visual.balance-meter.v1', 'operation.running-ledger.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...ledger, segments: [{ ...ledger.segments[0], payload: { ...ledger.segments[0].payload, maxEntries: 9 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...ledger, segments: [{ ...ledger.segments[0], answer: 6 }] }).status).toBe('invalid');
  });

  it('keeps the comparison prediction answerless and within its permitted range', () => {
    const comparison = growthComparisonPilotDocument('es-MX') as { required_capabilities: string[];
      segments: [{ payload: { initialRateBps: number; predictionMaximumMinor: number } }] };
    expect(loadLessonClientDocument(comparison).status).toBe('ready');
    expect(loadLessonClientDocument({ ...comparison, age_band: '6-9' }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...comparison, required_capabilities: ['visual.multi-line.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...comparison, segments: [{ ...comparison.segments[0], answer: 500 }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...comparison, segments: [{ ...comparison.segments[0], payload: {
      ...comparison.segments[0].payload, initialRateBps: 750 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...comparison, segments: [{ ...comparison.segments[0], payload: {
      ...comparison.segments[0].payload, predictionMaximumMinor: 20_000 } }] }).status).toBe('invalid');
  });

  it("requires M20's exact 14–17 policy, linked-representation capability, and bounded brackets", () => {
    const tax = taxBracketPilotDocument('en-US') as { eligibility: { minimum_age: number; maximum_age: number }; required_capabilities: string[];
      segments: [{ payload: { brackets: Array<{ upToMinor: number | null }> }; answer?: number }] };
    expect(loadLessonClientDocument(tax).status).toBe('ready');
    expect(loadLessonClientDocument({ ...tax, eligibility: { minimum_age: 13, maximum_age: 17 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...tax, required_capabilities: ['visual.stacked-bar.v1', 'operation.parameter-slider.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...tax, segments: [{ ...tax.segments[0], payload: { ...tax.segments[0].payload,
      brackets: [{ upToMinor: 30_000 }, { upToMinor: 10_000 }, { upToMinor: null }] } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...tax, segments: [{ ...tax.segments[0], payload: { ...tax.segments[0].payload,
      brackets: [{ upToMinor: 10_000, rateBasisPoints: 10_001 }, { upToMinor: null, rateBasisPoints: 3_000 }] } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...tax, segments: [{ ...tax.segments[0], answer: 60_000 }] }).status).toBe('invalid');
  });

  it('keeps M3 fraction placement bounded, linked, and answerless for its tween pathway', () => {
    const fraction = fractionNumberLinePilotDocument('en-US') as { required_capabilities: string[]; segments: [{ payload: Record<string, unknown>; answer?: string }] };
    expect(loadLessonClientDocument(fraction).status).toBe('ready');
    expect(loadLessonClientDocument({ ...fraction, required_capabilities: ['visual.number-line.v1', 'operation.place-point.v1'] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...fraction, segments: [{ ...fraction.segments[0], payload: { ...fraction.segments[0].payload, targetNumerator: 3 } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...fraction, segments: [{ ...fraction.segments[0], answer: '3/4' }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...fraction, eligibility: { minimum_age: 9, maximum_age: 12 } }).status).toBe('invalid');
  });

  it('keeps M6 equal-area partitions answerless within the exact safe age subset', () => {
    const area = fractionAreaPilotDocument('en-US') as { eligibility: { minimum_age: number; maximum_age: number }; segments: [{ payload: Record<string, unknown> }] };
    expect(loadLessonClientDocument(area).status).toBe('ready');
    expect(loadLessonClientDocument({ ...area, eligibility: { minimum_age: 6, maximum_age: 9 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...area, segments: [{ ...area.segments[0], payload: { ...area.segments[0].payload, targetNumerator: 1 } }] }).status).toBe('invalid');
  });

  it('requires the ordered M7 structure-and-answer pair for its exact tween pathway', () => {
    const bar = barModelPilotDocument('en-US') as { eligibility: { minimum_age: number; maximum_age: number }; segments: Array<Record<string, unknown>> };
    expect(loadLessonClientDocument(bar).status).toBe('ready');
    expect(loadLessonClientDocument({ ...bar, eligibility: { minimum_age: 9, maximum_age: 12 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...bar, segments: [bar.segments[1]!, bar.segments[0]!] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...bar, segments: [bar.segments[0]!]}).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...bar, segments: [{ ...bar.segments[0], answer: { model: 'comparison' } }, bar.segments[1]!]}).status).toBe('invalid');
  });

  it('requires M8 schema, slots, and answer to remain answerless and ordered', () => {
    const schema = schemaDiagramPilotDocument('en-US') as { eligibility: { minimum_age: number; maximum_age: number }; segments: Array<Record<string, unknown>> };
    expect(loadLessonClientDocument(schema).status).toBe('ready');
    expect(loadLessonClientDocument({ ...schema, eligibility: { minimum_age: 9, maximum_age: 12 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...schema, segments: [schema.segments[1]!, schema.segments[0]!, schema.segments[2]!]}).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...schema, segments: schema.segments.slice(0, 2) }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...schema, segments: [{ ...schema.segments[0], answer: { schema: 'change' } }, schema.segments[1]!, schema.segments[2]!]}).status).toBe('invalid');
  });

  it('bounds the M9/M10 worked-example candidate to its controlled pathway and public teaching steps', () => {
    const worked = workedExamplePilotDocument('en-US', 1) as { eligibility: { minimum_age: number; maximum_age: number };
      required_capabilities: string[]; segments: [{ payload: { fade_count: number; steps: Array<Record<string, unknown>> } }] };
    expect(loadLessonClientDocument(worked).status).toBe('ready');
    expect(loadLessonClientDocument(worked, ['visual.worked-example.v1', 'operation.step-replay.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...worked, eligibility: { minimum_age: 9, maximum_age: 12 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...worked, segments: [{ ...worked.segments[0], payload: {
      ...worked.segments[0].payload, fade_count: worked.segments[0].payload.steps.length } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...worked, segments: [{ ...worked.segments[0], payload: {
      ...worked.segments[0].payload, steps: [worked.segments[0].payload.steps[0]!, worked.segments[0].payload.steps[0]!, worked.segments[0].payload.steps[2]!],
    } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...worked, segments: [{ ...worked.segments[0], answer: { target: '40' } }] }).status).toBe('invalid');
  });

  it('keeps M13 function-machine examples public, linear, and restricted to its safe tween pilot', () => {
    const machine = functionMachinePilotDocument('en-US') as { eligibility: { minimum_age: number; maximum_age: number };
      required_capabilities: string[]; segments: [{ payload: { examples: Array<{ input: number; output: number }> }; answer?: unknown }] };
    expect(loadLessonClientDocument(machine).status).toBe('ready');
    expect(loadLessonClientDocument(machine, ['visual.function-machine.v1', 'operation.try-input.v1']).status).toBe('upgrade-required');
    expect(loadLessonClientDocument({ ...machine, eligibility: { minimum_age: 9, maximum_age: 12 } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...machine, segments: [{ ...machine.segments[0], payload: { ...machine.segments[0].payload,
      examples: [{ input: 1, output: 15 }, { input: 2, output: 20 }, { input: 3, output: 26 }] } }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...machine, segments: [{ ...machine.segments[0], answer: { multiplier: 5 } }] }).status).toBe('invalid');
  });

  it('requires M1 to keep one problem across concrete, pictorial, and abstract stages with fading steps', () => {
    const cpa = cpaFadingPilotDocument('en-US') as { representation_progressions: [{ stages: Array<{ worked_steps_shown: number }> }]; segments: Array<{ payload: { left: number; right: number; spokenText: string } }> };
    expect(loadLessonClientDocument(cpa).status).toBe('ready');
    expect(loadLessonClientDocument({ ...cpa, representation_progressions: [{ ...cpa.representation_progressions[0], stages: [
      ...cpa.representation_progressions[0].stages.slice(0, 2), { ...cpa.representation_progressions[0].stages[2], worked_steps_shown: 2 },
    ] }] }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...cpa, segments: cpa.segments.slice(0, 2) }).status).toBe('invalid');
    const { spokenText: _spokenText, ...withoutSpeech } = cpa.segments[0]!.payload;
    expect(loadLessonClientDocument({ ...cpa, segments: [{ ...cpa.segments[0], payload: withoutSpeech }, ...cpa.segments.slice(1)] }).status).toBe('invalid');
  });

  it('authors pronounceable M1 mathematics for every supported locale', () => {
    const spoken = (locale: 'en-US' | 'es-MX' | 'pt-BR') => (cpaFadingPilotDocument(locale) as { segments: Array<{ payload: { spokenText: string } }> }).segments[0]!.payload.spokenText;
    expect(spoken('en-US')).toBe('four plus three');
    expect(spoken('es-MX')).toBe('cuatro más tres');
    expect(spoken('pt-BR')).toBe('quatro mais três');
  });
});

describe('mentor stage projection contract (OD-19 / S05.2bh)', () => {
  it('accepts a strictly validated answerless mentor stage and keeps documents without one valid', () => {
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { character: 'rho', scene: 'diorama-a' } }).status).toBe('ready');
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { character: 'liruf', scene: 'diorama-b' } }).status).toBe('ready');
    expect(loadLessonClientDocument(pilot).status).toBe('ready');
  });

  it('fails closed on unknown characters, unknown scenes, extra fields and malformed shapes', () => {
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { character: 'mickey', scene: 'diorama-a' } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { character: 'dina', scene: 'diorama-z' } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { character: 'dina', scene: 'diorama-a', backdrop: 'night' } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { character: 'dina' } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: { scene: 'diorama-a' } }).status).toBe('invalid');
    expect(loadLessonClientDocument({ ...pilot, mentor_stage: 'dina' }).status).toBe('invalid');
  });

  it('parses the response projection fail-closed so a malformed stage simply means no stage', () => {
    expect(loadMentorStageProjection({ character: 'zara', scene: 'diorama-b' })).toEqual({ character: 'zara', scene: 'diorama-b' });
    expect(loadMentorStageProjection({ character: 'zara', scene: 'diorama-z' })).toBeNull();
    expect(loadMentorStageProjection({ character: 'bob', scene: 'diorama-a' })).toBeNull();
    expect(loadMentorStageProjection({ character: 'dina', scene: 'diorama-a', extra: true })).toBeNull();
    expect(loadMentorStageProjection(null)).toBeNull();
    expect(loadMentorStageProjection('zara')).toBeNull();
    expect(loadMentorStageProjection(undefined)).toBeNull();
  });
});
