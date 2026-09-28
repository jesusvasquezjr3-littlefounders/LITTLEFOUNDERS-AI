import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('ships the remaining Appendix A situational kinds with their subject and age gates (GAP-FIX-R2)', () => {
    const gates: Array<[string, string, string, boolean]> = [
      ['candlestick', '13-17', 'investing', true], ['candlestick', '10-12', 'investing', false], ['candlestick', '13-17', 'financial-education', false],
      ['treemap', 'adult', 'investing', true], ['treemap', '13-17', 'entrepreneurship', false], ['connected-scatter', '13-17', 'investing', true],
      ['marimekko', '13-17', 'entrepreneurship', true], ['marimekko', '13-17', 'investing', false], ['org-chart', '13-17', 'entrepreneurship', true],
      ['org-chart', '10-12', 'entrepreneurship', false], ['ishikawa', '13-17', 'entrepreneurship-basics', true], ['ishikawa', '13-17', 'financial-education', false],
      ['sunburst', '13-17', 'financial-education', true], ['icicle', '10-12', 'financial-education', false], ['box-plot', '13-17', 'financial-education', true],
      ['bump', '10-12', 'financial-education', true], ['swimlane', '10-12', 'financial-education', true], ['venn', '10-12', 'investing', true],
      ['mind-map', '10-12', 'financial-education', true], ['mind-map', '6-9', 'financial-education', false], ['venn', '6-9', 'financial-education', false],
    ];
    for (const [kind, band, course, allowed] of gates) expect(chartAllowed(kind as never, band as never, course), `${kind} ${band} ${course}`).toBe(allowed);
    expect(SITUATIONAL_CHART_KINDS).toHaveLength(21);
  });

  it('refuses situational data a renderer could not draw truthfully (GAP-FIX-R2)', () => {
    expect(chartProblem('candlestick', data({ ohlc: [{ id: 'day-a', label: 'Mon', open: 10, high: 9, low: 8, close: 12 }, { id: 'day-b', label: 'Tue', open: 1, high: 2, low: 0, close: 1 }] }))).toMatch(/low <= open/);
    expect(chartProblem('box-plot', data({ boxes: [{ id: 'grp-a', label: 'A', min: 1, q1: 5, median: 4, q3: 6, max: 9 }] }))).toMatch(/median/);
    expect(chartProblem('bump', data({ categories: cats(2), series: [{ id: 'series-a', label: 'A', values: [1, 1] }, { id: 'series-b', label: 'B', values: [1, 2] }] }))).toMatch(/no ties/);
    expect(chartProblem('venn', data({ categories: cats(2), regions: [{ sets: ['cat-00', 'cat-99'], value: 3 }] }))).toMatch(/known sets/);
    const tree = { nodes: [{ id: 'node-r', label: 'All' }, { id: 'node-a', label: 'A', value: 3 }, { id: 'node-b', label: 'B' }], links: [{ from: 'node-r', to: 'node-a' }, { from: 'node-r', to: 'node-b' }] };
    expect(chartProblem('treemap', data(tree))).toMatch(/leaf carries a value/);
    expect(chartProblem('ishikawa', data(tree))).toMatch(/fishbone/);
    expect(chartProblem('swimlane', data({ categories: cats(2), nodes: [{ id: 'node-a', label: 'A', lane: 'cat-00' }, { id: 'node-b', label: 'B' }], links: [{ from: 'node-a', to: 'node-b' }] }))).toMatch(/lane/);
    expect(chartProblem('marimekko', data({ categories: cats(2), series: [{ id: 'series-a', label: 'A', values: [0, 2] }, { id: 'series-b', label: 'B', values: [0, 1] }] }))).toMatch(/empty column/);
    const leaves = { nodes: [{ id: 'node-r', label: 'All' }, { id: 'node-a', label: 'A', value: 3 }, { id: 'node-b', label: 'B', value: 5 }], links: [{ from: 'node-r', to: 'node-a' }, { from: 'node-r', to: 'node-b' }] };
    expect(chartProblem('sunburst', data(leaves))).toBeNull();
    expect(chartTable('treemap', data(leaves)).rows.find((row) => row.id === 'node-r')!.cells.at(-1)).toBe(8);
  });

  it('refuses every emitted situational chart moved outside its gate (GAP-FIX-R2 spot-check)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const rows = JSON.parse(readFileSync(path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted.json'), 'utf8')) as Array<{ document: Record<string, any>; answer_keys: Record<string, unknown> }>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const seen = new Set<string>();
    for (const row of rows) {
      const kinds = (row.document.segments as Array<{ type: string; visual: { type: string } }>).filter((segment) => segment.type === 'visual.chart.v2'
        && (SITUATIONAL_CHART_KINDS as readonly string[]).includes(segment.visual.type)).map((segment) => segment.visual.type);
      if (kinds.length === 0) continue;
      kinds.forEach((kind) => seen.add(kind));
      const expected = { lessonId: row.document.lesson_id as string, locale: row.document.locale as string };
      expect(validateV2LessonForGrading(row.document, row.answer_keys, expected), row.document.lesson_id).not.toBeNull();
      const young = { ...row.document, age_band: '6-9', eligibility: { minimum_age: 6, maximum_age: 9 } };
      expect(validateV2LessonForGrading(young, row.answer_keys, expected), `${row.document.lesson_id} at 6-9`).toBeNull();
    }
    for (const kind of ['candlestick', 'marimekko', 'treemap', 'sunburst', 'icicle', 'box-plot', 'connected-scatter', 'bump', 'org-chart', 'swimlane', 'venn', 'ishikawa', 'mind-map']) {
      expect(seen.has(kind), kind).toBe(true);
    }
  });
});
