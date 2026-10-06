import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { v2LessonPlanSchema } from '../v2/plan.js';
import { checkNumericEvidence } from '../v2/numericEvidence.js';
import { emitV2Lesson } from '../v2/emit.js';

function fixture() {
  const plan = v2LessonPlanSchema.parse(JSON.parse(readFileSync(new URL('../../curriculum-recovery/financial-education/course-plans/fe-solid-07-a-week-of-real-payments.json', import.meta.url), 'utf8')));
  const segment = plan.segments.find(item => item.id === 'practice-02')!;
  const options = segment.payload.options as Array<{id: string}>;
  const key = (segment.rubric!.acceptable_choice_ids as string[])[0]!;
  return { plan, segment, options, good: options.findIndex(option => option.id === key), bad: options.findIndex(option => option.id !== key) };
}
describe('numeric choice evidence is recomputed, not inferred from a solvable key', () => {
  it('accepts the independently derived balance and keeps its proof private', () => {
    const { plan } = fixture();
    expect(checkNumericEvidence(plan)).toEqual([]);
    const emitted = emitV2Lesson(plan, { versionId: 'numeric-proof-test' });
    expect(emitted.ok).toBe(true);
    expect(JSON.stringify(emitted.documents.map(row => row.document))).not.toContain('numeric_proof');
  });
  it('blocks a technically valid but arithmetically wrong answer key', () => {
    const { plan, segment, options, bad } = fixture();
    segment.rubric!.acceptable_choice_ids = [options[bad]!.id];
    expect(checkNumericEvidence(plan).some(finding => finding.message.includes('recalculated answer'))).toBe(true);
    expect(emitV2Lesson(plan, { versionId: 'numeric-proof-test' }).ok).toBe(false);
  });
  it('blocks a translation that changes a visible operand', () => {
    const { plan, segment } = fixture();
    segment.copy['es-MX'].scene = String(segment.copy['es-MX'].scene).replace('70', '75');
    expect(checkNumericEvidence(plan).map(finding => finding.message)).toEqual([expect.stringContaining('es-MX: visible arithmetic inputs differ')]);
  });
  it('does not accept a second mathematically correct option being marked wrong', () => {
    const { plan, segment, good, bad } = fixture();
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const labels = segment.copy[locale].options as Array<{label: string}>;
      labels[bad]!.label = labels[good]!.label;
    }
    expect(checkNumericEvidence(plan)).toHaveLength(3);
  });
  it('blocks removing the proof from a numeric instructional item', () => {
    const { plan, segment } = fixture(); delete segment.numeric_proof;
    expect(checkNumericEvidence(plan)).toHaveLength(3);
  });
  it('rejects division by zero without evaluating arbitrary code', () => {
    const { plan, segment } = fixture();
    segment.numeric_proof!.expression = { op: 'divide', args: [{input: 0}, {constant: 0}] };
    expect(checkNumericEvidence(plan)[0]?.message).toContain('divides by zero');
  });
  it('reads market-specific thousands separators in the same visible calculation', () => {
    const { plan, segment, good } = fixture();
    segment.numeric_proof = { source: 'scene', visible_inputs: [1000, 250], expression: {op: 'subtract', args: [{input: 0}, {input: 1}]} };
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      segment.copy[locale].scene = locale === 'pt-BR' ? '1.000, 250' : '1,000, 250';
      const labels = segment.copy[locale].options as Array<{label: string}>;
      labels.forEach((label, index) => { label.label = index === good ? '750' : String(index * 100); });
    }
    expect(checkNumericEvidence(plan)).toEqual([]);
  });
});
