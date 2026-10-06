import { z } from 'zod';
import type { V2LessonPlan } from './plan.js';
import type { LessonDesignFinding } from './lessonDesign.js';

export type NumericExpression = { input: number } | { constant: 0 | 1 | 100 } | { op: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max'; args: [NumericExpression, NumericExpression] };
const expression: z.ZodType<NumericExpression> = z.lazy(() => z.union([
  z.object({ input: z.number().int().min(0).max(30) }).strict(),
  z.object({ constant: z.union([z.literal(0), z.literal(1), z.literal(100)]) }).strict(),
  z.object({ op: z.enum(['add', 'subtract', 'multiply', 'divide', 'min', 'max']), args: z.tuple([expression, expression]) }).strict(),
]));
export const numericProofSchema = z.object({
  source: z.enum(['scene', 'prompt', 'chart-values']),
  visible_inputs: z.array(z.number().finite()).min(1).max(31),
  expression,
}).strict();

function calculate(node: NumericExpression, inputs: number[], depth = 0): number {
  if (depth > 12) throw new Error('Arithmetic expression exceeds the supported depth.');
  if ('constant' in node) return node.constant;
  if ('input' in node) { const value = inputs[node.input]; if (value === undefined) throw new Error('Arithmetic refers to an absent visible input.'); return value; }
  const left = calculate(node.args[0], inputs, depth + 1), right = calculate(node.args[1], inputs, depth + 1);
  if (node.op === 'divide' && right === 0) throw new Error('Arithmetic divides by zero.');
  const result = node.op === 'add' ? left + right : node.op === 'subtract' ? left - right : node.op === 'multiply' ? left * right : node.op === 'min' ? Math.min(left, right) : node.op === 'max' ? Math.max(left, right) : left / right;
  if (!Number.isFinite(result)) throw new Error('Arithmetic has a non-finite result.');
  return result;
}
const numericChoice = (label: unknown, locale: string): number | null => {
  if (typeof label !== 'string') return null;
  const normalized = (locale === 'pt-BR' ? label.replace(/\./g, '').replace(/,/g, '.') : label.replace(/,/g, '')).replace(/−/g, '-');
  if (!/^\s*-?\d+(?:\.\d+)?(?:\s*\+\s*-?\d+(?:\.\d+)?)*\s*$/.test(normalized)) return null;
  return normalized.split('+').reduce((sum, token) => sum + Number(token.trim()), 0);
};
function visibleNumbers(text: string, locale: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map(match => Number(locale === 'pt-BR' ? match[0].replace(/\./g, '').replace(',', '.') : match[0].replace(/,/g, '')));
}

/** Recompute numeric choice keys from visible data. This does not prove the prose describes the correct financial model. */
export function checkNumericEvidence(plan: V2LessonPlan): LessonDesignFinding[] {
  const findings: LessonDesignFinding[] = [];
  const fail = (segmentId: string, message: string) => findings.push({ gate: 14, severity: 'block', segmentId, message });
  for (const segment of plan.segments) {
    if (segment.grading !== 'server') continue;
    const payload = segment.payload as { options?: Array<{id: string}>; question?: {options?: Array<{id: string}>}; data?: {series?: Array<{values: number[]}>} };
    const options = payload.options ?? payload.question?.options;
    const proof = segment.numeric_proof;
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const copy = segment.copy[locale] as {scene?: string; prompt: string; options?: Array<{label: string}>; question?: {options?: Array<{label: string}>} };
      const labels = copy.options ?? copy.question?.options;
      const values = labels?.map(option => numericChoice(option.label, locale));
      if (!proof) {
        if (plan.instruction && values?.length && values.every(value => value !== null)) fail(segment.id, `${locale}: numeric choices require a numeric_proof; solvability alone does not establish the right arithmetic key.`);
        continue;
      }
      if (!options || !values || values.some(value => value === null)) { fail(segment.id, `${locale}: numeric_proof requires numeric choice labels.`); continue; }
      const inputs = proof.source === 'chart-values' ? payload.data?.series?.[0]?.values : visibleNumbers(String(copy[proof.source] ?? ''), locale);
      if (!inputs || JSON.stringify(inputs) !== JSON.stringify(proof.visible_inputs)) { fail(segment.id, `${locale}: visible arithmetic inputs differ from the proof; update or repair the localized scenario.`); continue; }
      try {
        const expected = calculate(proof.expression, inputs);
        const matching = options.filter((_, index) => values[index] !== null && Math.abs(values[index]! - expected) < 1e-8).map(option => option.id).sort();
        const rubric = segment.rubric_by_locale?.[locale] ?? segment.rubric;
        const accepted = Array.isArray(rubric?.acceptable_choice_ids) ? [...rubric.acceptable_choice_ids].sort() : [];
        if (!matching.length || JSON.stringify(matching) !== JSON.stringify(accepted)) fail(segment.id, `${locale}: recalculated answer ${expected} does not match exactly the accepted visible options.`);
      } catch (error) { fail(segment.id, `${locale}: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }
  return findings;
}
