import { describe, expect, it } from 'vitest';
import { chartAllowed, chartDataSchema, chartProblem, chartTable, CORE_CHART_KINDS, SITUATIONAL_CHART_KINDS, waterfallSteps } from '../services/v2ChartModel.js';
import { validateV2LessonForGrading } from '../services/v2LessonDocument.js';

/* GAP-FIX-R1 learning (B.7 part 1, Appendix A Part 1): the canonical chart model and the situational gate Core enforces on delivery. */

const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `cat-${i}0`, label: `Item ${i}` }));
const data = (extra: Record<string, unknown>) => chartDataSchema.parse({ unit: 'coins', ...extra });

describe('the chart model', () => {
  it('ships every Appendix A Core type and gates the situational ones', () => {
    expect(CORE_CHART_KINDS).toHaveLength(25);
    for (const kind of SITUATIONAL_CHART_KINDS) expect(chartAllowed(kind, '6-9', 'financial-education')).toBe(false);
    expect(chartAllowed('step', '13-17', 'financial-education')).toBe(true);
    expect(chartAllowed('step', '13-17', 'entrepreneurship')).toBe(false);
    expect(chartAllowed('pareto', '13-17', 'entrepreneurship-basics')).toBe(true);
    expect(chartAllowed('pie', '6-9', 'anything')).toBe(true);
  });

  it('refuses data a renderer could not draw truthfully, including the overflow and conservation rules', () => {
    expect(chartProblem('pie', data({ categories: cats(7), series: [{ id: 'series-a', label: 'A', values: [1, 1, 1, 1, 1, 1, 1] }] }))).toMatch(/2-6/);
    expect(chartProblem('waffle', data({ categories: cats(2), series: [{ id: 'series-a', label: 'A', values: [40, 50] }] }))).toMatch(/100/);
    const nodes = [{ id: 'node-a', label: 'A' }, { id: 'node-b', label: 'B' }, { id: 'node-c', label: 'C' }];
    expect(chartProblem('sankey', data({ nodes, links: [{ from: 'node-a', to: 'node-b', value: 10 }, { from: 'node-b', to: 'node-c', value: 7 }] }))).toMatch(/equal flow/);
    expect(chartProblem('tree', data({ nodes, links: [{ from: 'node-a', to: 'node-c' }, { from: 'node-b', to: 'node-c' }] }))).toMatch(/one start|one parent/);
    expect(chartProblem('column', data({ categories: cats(3), series: [{ id: 'series-a', label: 'A', values: [1, 2] }] }))).toMatch(/one value per category/);
    expect(chartDataSchema.safeParse({ unit: 'coins', categories: cats(13) }).success).toBe(false);
  });

  it('computes the waterfall and the table from the same numbers', () => {
    const d = data({ categories: cats(3), series: [{ id: 'series-a', label: 'Change', values: [50, -15, 10] }] });
    expect(waterfallSteps(d).map((s) => s.end)).toEqual([50, 35, 45]);
    expect(chartTable('waterfall', d).rows.map((r) => r.cells[2])).toEqual([50, 35, 45]);
  });

  it('Core refuses a situational chart outside its pathway on delivery', () => {
    const document = {
      schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'charts', lesson_id: 'lesson-charts',
      version_id: 'rev-001', locale: 'en-US', age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-charts'],
      adventure_scene_id: 'diorama-a', title: 'Charts', required_capabilities: ['visual.step.v1', 'operation.show-table.v1'],
      segments: [{ id: 'chart-01', type: 'visual.chart.v2', grading: 'none', prompt: 'Look.', visual: { type: 'step' },
        payload: { title: 'Rate', data: { unit: 'percent', categories: cats(2), series: [{ id: 'series-a', label: 'Rate', values: [1, 2] }] } } }],
    };
    expect(validateV2LessonForGrading(document, {}, { lessonId: 'lesson-charts', locale: 'en-US' })).toBeNull();
    const pie = structuredClone(document);
    pie.required_capabilities = ['visual.pie.v1', 'operation.show-table.v1'];
    pie.segments[0]!.visual.type = 'pie';
    expect(validateV2LessonForGrading(pie, {}, { lessonId: 'lesson-charts', locale: 'en-US' })).not.toBeNull();
  });
});
