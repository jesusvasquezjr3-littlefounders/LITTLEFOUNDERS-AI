import { describe, expect, it } from 'vitest';
import {
  axisExtent, CHART_KINDS, CORE_CHART_KINDS, chartAllowed, chartDataSchema, chartProblem, chartReads, chartTable, dayNumber, funnelSteps, heatValue, isReadingChart,
  lorenzCurve, quantile, READING_CHART_GATES, READING_CHART_KINDS, regressionFit, sampleSummary, SITUATIONAL_CHART_KINDS, valueExtent, type ReadingChartKind,
} from '../services/v2ChartModel.js';
import { validateV2LessonForGrading } from '../services/v2LessonDocument.js';

/* Horizonte F1.0: the twelve reading charts, their schema, rules, gates, tables and tap-to-read values. */

const cats = (...labels: string[]) => labels.map((label, i) => ({ id: `cat-${i}`, label }));
const series = (id: string, label: string, values: number[], error?: number[]) => ({ id: `series-${id}`, label, values, ...(error ? { error } : {}) });
const parse = (extra: Record<string, unknown>) => chartDataSchema.parse({ unit: 'coins', ...extra });

const SAMPLES: Record<ReadingChartKind, Record<string, unknown>> = {
  'dot-plot': { categories: cats('Save', 'Spend', 'Share', 'Gifts'), series: [series('a', 'This week', [30, 50, 20, 5])] },
  dumbbell: { categories: cats('Save', 'Spend', 'Share'), series: [series('a', 'Before', [10, 40, 20]), series('b', 'After', [25, 30, 20])] },
  'xy-heatmap': { categories: cats('Mon', 'Tue', 'Wed'), rows: [{ id: 'row-0', label: 'Save' }, { id: 'row-1', label: 'Spend' }],
    cells: [['row-0', 'cat-0', 1], ['row-0', 'cat-1', 4], ['row-0', 'cat-2', 2], ['row-1', 'cat-0', 6], ['row-1', 'cat-1', 3], ['row-1', 'cat-2', 5]].map(([row, col, value]) => ({ row, col, value })) },
  'error-bars': { categories: cats('Week 1', 'Week 2', 'Week 3'), series: [series('a', 'Saved', [20, 26, 31], [3, 5, 2])] },
  funnel: { categories: cats('Visit', 'Browse', 'Cart', 'Buy'), series: [series('a', 'People', [100, 60, 30, 12])] },
  'lorenz-curve': { categories: cats('A', 'B', 'C', 'D'), series: [series('a', 'Money', [60, 25, 10, 5])] },
  'fan-chart': { categories: cats('Year 1', 'Year 2', 'Year 3', 'Year 4'), series: [series('a', 'Forecast', [100, 110, 120, 135])],
    ranges: [{ level: 80, low: [100, 104, 108, 118], high: [100, 116, 132, 152] }, { level: 95, low: [100, 100, 100, 108], high: [100, 120, 140, 166] }] },
  'density-plot': { samples: [{ id: 'grp-a', label: 'Class A', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 9] }, { id: 'grp-b', label: 'Class B', values: [3, 4, 5, 5, 6, 6, 7, 8, 9, 10] }] },
  'violin-plot': { samples: [{ id: 'grp-a', label: 'Class A', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 9] }, { id: 'grp-b', label: 'Class B', values: [3, 4, 5, 5, 6, 6, 7, 8, 9, 10] }] },
  timeline: { events: [{ id: 'ev-a', label: 'Start', date: '2026-09-07' }, { id: 'ev-b', label: 'Saving', date: '2026-09-14', end: '2026-10-05' }, { id: 'ev-c', label: 'Buy', date: '2026-10-12' }] },
  'scatter-regression': { points: [[1, 2], [2, 4], [3, 5], [4, 4], [5, 6]].map(([x, y], i) => ({ id: `pt-${i}`, label: `Week ${i + 1}`, x, y })) },
  'parallel-coordinates': { categories: cats('Price', 'Quality', 'Speed'), records: [{ id: 'rec-a', label: 'Plan A', values: [10, 7, 5] }, { id: 'rec-b', label: 'Plan B', values: [4, 9, 8] }, { id: 'rec-c', label: 'Plan C', values: [7, 5, 9] }] },
};
const sample = (kind: ReadingChartKind, extra: Record<string, unknown> = {}) => parse({ ...SAMPLES[kind], ...extra });

describe('the twelve reading charts: registry and gates', () => {
  it('adds twelve kinds without moving the pinned 25 core and 21 situational ones', () => {
    expect(READING_CHART_KINDS).toHaveLength(12);
    expect(CORE_CHART_KINDS).toHaveLength(25);
    expect(SITUATIONAL_CHART_KINDS).toHaveLength(21);
    expect(CHART_KINDS).toHaveLength(58);
    expect(new Set(CHART_KINDS).size).toBe(58);
    for (const kind of READING_CHART_KINDS) expect(isReadingChart(kind)).toBe(true);
    expect(isReadingChart('pie')).toBe(false);
  });

  it('opens none to ages 6-9, the plain comparisons from 10 and the statistical readings from 13', () => {
    for (const kind of READING_CHART_KINDS) {
      expect(chartAllowed(kind, '6-9', 'financial-education'), `${kind} at 6-9`).toBe(false);
      expect(READING_CHART_GATES[kind].bands).toContain('adult');
    }
    const open = (kind: ReadingChartKind, band: '10-12' | '13-17', course: string) => chartAllowed(kind, band, course);
    expect(open('dot-plot', '10-12', 'anything')).toBe(true);
    expect(open('dumbbell', '10-12', 'investing')).toBe(true);
    expect(open('xy-heatmap', '10-12', 'financial-education')).toBe(true);
    expect(open('timeline', '10-12', 'financial-education')).toBe(true);
    expect(open('scatter-regression', '10-12', 'financial-education')).toBe(true);
    for (const kind of ['error-bars', 'density-plot', 'violin-plot', 'parallel-coordinates'] as const) {
      expect(open(kind, '10-12', 'financial-education'), `${kind} at 10-12`).toBe(false);
      expect(open(kind, '13-17', 'financial-education'), `${kind} at 13-17`).toBe(true);
    }
  });

  it('keeps funnel, Lorenz and fan charts to their subjects', () => {
    expect(chartAllowed('funnel', '10-12', 'entrepreneurship-basics')).toBe(true);
    expect(chartAllowed('funnel', '10-12', 'investing')).toBe(false);
    expect(chartAllowed('lorenz-curve', '13-17', 'financial-education')).toBe(true);
    expect(chartAllowed('lorenz-curve', '13-17', 'investing')).toBe(false);
    expect(chartAllowed('lorenz-curve', '10-12', 'financial-education')).toBe(false);
    expect(chartAllowed('fan-chart', '13-17', 'investing')).toBe(true);
    expect(chartAllowed('fan-chart', '13-17', 'financial-education')).toBe(true);
    expect(chartAllowed('fan-chart', '13-17', 'entrepreneurship')).toBe(false);
  });

  it('is enforced on delivery with the capability each kind derives', () => {
    const lesson = (kind: ReadingChartKind, band: '6-9' | '10-12' | '13-17', course: string) => ({
      schema_version: 2, course_id: course, pathway_id: 'financial-young', chapter_id: 'charts', lesson_id: 'lesson-charts',
      version_id: 'rev-001', locale: 'en-US', age_band: band, eligibility: { minimum_age: band === '6-9' ? 6 : band === '10-12' ? 10 : 13, maximum_age: band === '6-9' ? 9 : band === '10-12' ? 12 : 17 },
      knowledge_component_ids: ['kc-charts'], adventure_scene_id: 'diorama-a', title: 'Charts', required_capabilities: [`visual.${kind}.v1`, 'operation.show-table.v1'],
      segments: [{ id: 'chart-01', type: 'visual.chart.v2', grading: 'none', prompt: 'Look.', visual: { type: kind }, payload: { title: 'Look', data: SAMPLES[kind] && { unit: 'coins', ...SAMPLES[kind] } } }],
    });
    const check = (kind: ReadingChartKind, band: '6-9' | '10-12' | '13-17', course: string) => validateV2LessonForGrading(lesson(kind, band, course), {}, { lessonId: 'lesson-charts', locale: 'en-US' });
    expect(check('dot-plot', '6-9', 'financial-education')).toBeNull();
    expect(check('dot-plot', '10-12', 'financial-education')).not.toBeNull();
    expect(check('funnel', '10-12', 'financial-education')).toBeNull();
    expect(check('funnel', '10-12', 'entrepreneurship')).not.toBeNull();
    expect(check('density-plot', '10-12', 'financial-education')).toBeNull();
    expect(check('density-plot', '13-17', 'financial-education')).not.toBeNull();
  });
});

describe('the twelve reading charts: schema', () => {
  it('accepts a sample of every kind and finds no problem with it', () => {
    for (const kind of READING_CHART_KINDS) expect(chartProblem(kind, sample(kind)), kind).toBeNull();
  });

  it('bounds every new field and refuses non-finite numbers and unknown keys', () => {
    const base = { categories: cats('A', 'B'), series: [series('a', 'A', [1, 2])] };
    const ok = (extra: Record<string, unknown>) => chartDataSchema.safeParse({ unit: 'coins', ...base, ...extra }).success;
    expect(ok({ series: [series('a', 'A', [1, 2], [1, -1])] })).toBe(false);
    expect(ok({ series: [series('a', 'A', [1, 2], [1, Number.POSITIVE_INFINITY])] })).toBe(false);
    expect(ok({ series: [series('a', 'A', [1, Number.NaN])] })).toBe(false);
    expect(ok({ samples: [{ id: 'grp-a', label: 'A', values: [1, 2, 3, 4] }] })).toBe(false);
    expect(ok({ samples: [{ id: 'grp-a', label: 'A', values: Array.from({ length: 61 }, (_, i) => i) }] })).toBe(false);
    expect(ok({ samples: [{ id: 'grp-a', label: 'A', values: [1, 2, 3, 4, 5] }] })).toBe(true);
    expect(ok({ samples: Array.from({ length: 4 }, (_, i) => ({ id: `grp-${i}`, label: 'A', values: [1, 2, 3, 4, 5] })) })).toBe(false);
    expect(ok({ ranges: [1, 2, 3].map(() => ({ level: 80, low: [1, 2], high: [1, 2] })) })).toBe(false);
    expect(ok({ ranges: [{ level: 49, low: [1, 2], high: [1, 2] }] })).toBe(false);
    expect(ok({ rows: Array.from({ length: 9 }, (_, i) => ({ id: `row-${i}`, label: 'R' })) })).toBe(false);
    expect(ok({ cells: [{ col: 'cat-0', row: 'x', value: 1 }] })).toBe(false);
    expect(ok({ events: [{ id: 'ev-a', label: 'A', date: '2026-9-1' }] })).toBe(false);
    expect(ok({ events: Array.from({ length: 13 }, (_, i) => ({ id: `ev-${i}`, label: 'E', date: '2026-09-07' })) })).toBe(false);
    expect(ok({ records: [{ id: 'rec-a', label: 'A', values: [1, 2, 3, 4, 5, 6, 7] }] })).toBe(false);
    expect(ok({ records: Array.from({ length: 9 }, (_, i) => ({ id: `rec-${i}`, label: 'R', values: [1] })) })).toBe(false);
    expect(ok({ records: [{ id: 'rec-a', label: 'A'.repeat(41), values: [1] }] })).toBe(false);
    expect(ok({ records: [{ id: 'rec-a', label: 'A', values: [1], note: 'x' }] })).toBe(false);
  });
});

describe('the twelve reading charts: rules', () => {
  it('ranks 2-6 rows in a dot plot and a dumbbell, the dumbbell over exactly two series', () => {
    const rows = (n: number) => ({ categories: cats(...Array.from({ length: n }, (_, i) => `Row ${i}`)), series: [series('a', 'A', Array.from({ length: n }, () => 1)), series('b', 'B', Array.from({ length: n }, () => 2))] });
    expect(chartProblem('dot-plot', parse(rows(7)))).toMatch(/2-6/);
    expect(chartProblem('dot-plot', parse(rows(1)))).toMatch(/2-6/);
    expect(chartProblem('dot-plot', parse(rows(6)))).toBeNull();
    expect(chartProblem('dumbbell', parse({ ...rows(3), series: rows(3).series.slice(0, 1) }))).toMatch(/two series/);
    expect(chartProblem('dumbbell', parse(rows(7)))).toMatch(/2-6/);
    expect(chartProblem('dumbbell', parse(rows(6)))).toBeNull();
    expect(chartProblem('dot-plot', parse({ categories: cats('A', 'B'), series: [series('a', 'A', [1])] }))).toMatch(/one value per category/);
  });

  it('needs an error for every value in error bars', () => {
    expect(chartProblem('error-bars', sample('error-bars', { series: [series('a', 'Saved', [20, 26, 31])] }))).toMatch(/one error per value/);
    expect(chartProblem('error-bars', sample('error-bars', { series: [series('a', 'Saved', [20, 26, 31], [1, 2])] }))).toMatch(/one error per value/);
  });

  it('draws a funnel only from stages that never grow', () => {
    expect(chartProblem('funnel', sample('funnel', { series: [series('a', 'People', [100, 60, 70, 12])] }))).toMatch(/never grow/);
    expect(chartProblem('funnel', sample('funnel', { series: [series('a', 'People', [0, 0, 0, 0])] }))).toMatch(/above zero/);
    expect(chartProblem('funnel', parse({ categories: cats(...'ABCDEFG'.split('')), series: [series('a', 'P', [7, 6, 5, 4, 3, 2, 1])] }))).toMatch(/2-6/);
  });

  it('needs three groups of non-negative money for a Lorenz curve', () => {
    expect(chartProblem('lorenz-curve', parse({ categories: cats('A', 'B'), series: [series('a', 'M', [1, 2])] }))).toMatch(/3\+ groups/);
    expect(chartProblem('lorenz-curve', sample('lorenz-curve', { series: [series('a', 'M', [60, -1, 10, 5])] }))).toMatch(/non-negative/);
    expect(chartProblem('lorenz-curve', sample('lorenz-curve', { series: [series('a', 'M', [0, 0, 0, 0])] }))).toMatch(/non-negative/);
  });

  it('keeps each fan range around the central path and the wider range around the narrower', () => {
    const fan = SAMPLES['fan-chart'] as { ranges: Array<{ level: number; low: number[]; high: number[] }> };
    expect(chartProblem('fan-chart', sample('fan-chart', { ranges: [{ ...fan.ranges[0]!, low: [100, 112, 108, 118] }] }))).toMatch(/central path/);
    expect(chartProblem('fan-chart', sample('fan-chart', { ranges: [fan.ranges[0], { ...fan.ranges[1]!, high: [100, 110, 140, 166] }] }))).toMatch(/central path|wider range/);
    expect(chartProblem('fan-chart', sample('fan-chart', { ranges: [fan.ranges[0], { ...fan.ranges[1]!, high: [100, 116, 132, 152], low: [100, 106, 108, 118] }] }))).toMatch(/wider range/);
    expect(chartProblem('fan-chart', sample('fan-chart', { ranges: [fan.ranges[1], fan.ranges[0]] }))).toMatch(/wider range/);
    expect(chartProblem('fan-chart', sample('fan-chart', { ranges: [] }))).toMatch(/1-2 ranges/);
    expect(chartProblem('fan-chart', sample('fan-chart', { ranges: [{ ...fan.ranges[0]!, low: [100, 104], high: [100, 116] }] }))).toMatch(/central path/);
  });

  it('needs spread in every sample for a density or violin plot', () => {
    for (const kind of ['density-plot', 'violin-plot'] as const) {
      expect(chartProblem(kind, sample(kind, { samples: [{ id: 'grp-a', label: 'A', values: [4, 4, 4, 4, 4] }] }))).toMatch(/spread/);
      expect(chartProblem(kind, sample(kind, { samples: [] }))).toMatch(/1-3 sample groups/);
      expect(chartProblem(kind, sample(kind, { samples: [{ id: 'grp-a', label: 'A', values: [1, 2, 3, 4, 5] }, { id: 'grp-a', label: 'B', values: [1, 2, 3, 4, 5] }] }))).toMatch(/sample groups/);
    }
  });

  it('keeps timeline dates real, ordered and spread over more than one day', () => {
    const day = (date: string, end?: string) => ({ id: `ev-${date}`, label: 'E', date, ...(end ? { end } : {}) });
    expect(chartProblem('timeline', sample('timeline', { events: [day('2026-09-07')] }))).toMatch(/two or more/);
    expect(chartProblem('timeline', sample('timeline', { events: [day('2026-02-30'), day('2026-03-02')] }))).toMatch(/real days/);
    expect(chartProblem('timeline', sample('timeline', { events: [day('2026-09-07', '2026-09-01'), day('2026-09-09')] }))).toMatch(/real days/);
    expect(chartProblem('timeline', sample('timeline', { events: [day('2026-09-09'), day('2026-09-07')] }))).toMatch(/date order/);
    expect(chartProblem('timeline', sample('timeline', { events: [day('2026-09-07'), { ...day('2026-09-07'), id: 'ev-x' }] }))).toMatch(/more than one day/);
    expect(chartProblem('timeline', sample('timeline', { events: [day('2026-09-07'), day('2026-09-07')] }))).toMatch(/two or more/);
  });

  it('needs four varying points for a regression chart', () => {
    const point = (i: number, x: number, y: number) => ({ id: `pt-${i}`, label: `P${i}`, x, y });
    expect(chartProblem('scatter-regression', sample('scatter-regression', { points: [point(0, 1, 1), point(1, 2, 2), point(2, 3, 3)] }))).toMatch(/4\+ points/);
    expect(chartProblem('scatter-regression', sample('scatter-regression', { points: [0, 1, 2, 3].map((i) => point(i, 5, i)) }))).toMatch(/vary/);
    expect(chartProblem('scatter-regression', sample('scatter-regression', { points: [0, 1, 2, 3].map((i) => point(i, i, 5)) }))).toMatch(/vary/);
  });

  it('needs one cell for every column and row pair in a heatmap', () => {
    const cells = (SAMPLES['xy-heatmap'] as { cells: Array<{ row: string; col: string; value: number }> }).cells;
    expect(chartProblem('xy-heatmap', sample('xy-heatmap', { cells: cells.slice(1) }))).toMatch(/one cell for each pair/);
    expect(chartProblem('xy-heatmap', sample('xy-heatmap', { cells: [...cells.slice(1), cells[1]] }))).toMatch(/once/);
    expect(chartProblem('xy-heatmap', sample('xy-heatmap', { cells: [...cells.slice(1), { row: 'row-9', col: 'cat-0', value: 1 }] }))).toMatch(/known column and row/);
    expect(chartProblem('xy-heatmap', sample('xy-heatmap', { rows: [{ id: 'row-0', label: 'Save' }], cells: cells.slice(0, 3) }))).toMatch(/2\+ rows/);
  });

  it('needs 3-6 axes and 2-8 records of matching length in parallel coordinates', () => {
    const records = (SAMPLES['parallel-coordinates'] as { records: unknown[] }).records;
    expect(chartProblem('parallel-coordinates', sample('parallel-coordinates', { categories: cats('Price', 'Quality') }))).toMatch(/3-6 axes/);
    expect(chartProblem('parallel-coordinates', sample('parallel-coordinates', { categories: cats(...'ABCDEFG'.split('')) }))).toMatch(/3-6 axes/);
    expect(chartProblem('parallel-coordinates', sample('parallel-coordinates', { records: records.slice(0, 1) }))).toMatch(/2-8 records/);
    expect(chartProblem('parallel-coordinates', sample('parallel-coordinates', { records: [...records.slice(0, 2), { id: 'rec-c', label: 'Plan C', values: [1, 2] }] }))).toMatch(/one value per axis/);
  });

  it('refuses an author label that starts with the model-word mark, on the reading kinds only', () => {
    expect(chartProblem('dot-plot', sample('dot-plot', { categories: cats('~value', 'Spend', 'Share', 'Gifts') }))).toMatch(/does not start with ~/);
    expect(chartProblem('timeline', sample('timeline', { events: [{ id: 'ev-a', label: '~days', date: '2026-09-07' }, { id: 'ev-b', label: 'B', date: '2026-09-09' }] }))).toMatch(/does not start with ~/);
    expect(chartProblem('density-plot', sample('density-plot', { samples: [{ id: 'grp-a', label: '~median', values: [1, 2, 3, 4, 5] }] }))).toMatch(/does not start with ~/);
    expect(chartProblem('column', parse({ categories: cats('~5 min', 'B'), series: [series('a', 'A', [1, 2])] }))).toBeNull();
  });
});

describe('the twelve reading charts: numbers', () => {
  it('computes quantiles, summaries and the regression line', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([], 0.5)).toBe(0);
    expect(sampleSummary([5, 1, 3, 2, 4])).toEqual({ n: 5, min: 1, q1: 2, median: 3, q3: 4, max: 5, mean: 3 });
    const fit = regressionFit([1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 })))!;
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(1);
    expect(fit.r2).toBeCloseTo(1);
    expect(regressionFit([{ x: 1, y: 1 }, { x: 1, y: 5 }])).toBeNull();
    expect(regressionFit([{ x: 1, y: 1 }])).toBeNull();
    expect(regressionFit([1, 2, 3].map((x) => ({ x, y: 4 })))!.r2).toBe(0);
  });

  it('computes the Lorenz curve and its Gini index', () => {
    const equal = lorenzCurve([10, 10, 10, 10]);
    expect(equal.gini).toBeCloseTo(0);
    expect(equal.share).toEqual([0.25, 0.5, 0.75, 1]);
    const one = lorenzCurve([0, 0, 0, 10]);
    expect(one.gini).toBeCloseTo(0.75);
    const mixed = lorenzCurve([60, 25, 10, 5]);
    expect(mixed.order).toEqual([3, 2, 1, 0]);
    expect(mixed.people).toEqual([0.25, 0.5, 0.75, 1]);
    expect(mixed.share[3]).toBeCloseTo(1);
    expect(mixed.gini).toBeGreaterThan(0.3);
    expect(mixed.gini).toBeLessThan(0.5);
  });

  it('computes funnel shares of the first and of the previous stage', () => {
    expect(funnelSteps([100, 60, 30])).toEqual([{ value: 100, ofFirst: 100, ofPrevious: 100 }, { value: 60, ofFirst: 60, ofPrevious: 60 }, { value: 30, ofFirst: 30, ofPrevious: 50 }]);
    expect(funnelSteps([0, 0]).map((step) => step.ofFirst)).toEqual([0, 0]);
  });

  it('reads calendar days as whole day numbers and refuses days that are not real', () => {
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2028-02-29')).toBe(dayNumber('2028-02-28') + 1);
    expect(Number.isNaN(dayNumber('2026-02-29'))).toBe(true);
    expect(Number.isNaN(dayNumber('2026-13-01'))).toBe(true);
    expect(Number.isNaN(dayNumber('September'))).toBe(true);
    expect(dayNumber('2026-10-05') - dayNumber('2026-09-14')).toBe(21);
  });

  it('finds the axis extents and heat values the drawings use', () => {
    const parallel = sample('parallel-coordinates');
    expect(axisExtent(parallel, 0)).toEqual([4, 10]);
    expect(axisExtent(parallel, 2)).toEqual([5, 9]);
    const heat = sample('xy-heatmap');
    expect(heatValue(heat, 'cat-1', 'row-0')).toBe(4);
    expect(heatValue(heat, 'cat-9', 'row-0')).toBe(0);
  });

  it('fits each kind its own value range', () => {
    expect(valueExtent('fan-chart', sample('fan-chart'))).toEqual([100, 166]);
    expect(valueExtent('xy-heatmap', sample('xy-heatmap'))).toEqual([1, 6]);
    expect(valueExtent('density-plot', sample('density-plot'))).toEqual([1, 10]);
    expect(valueExtent('lorenz-curve', sample('lorenz-curve'))).toEqual([0, 1]);
    expect(valueExtent('error-bars', sample('error-bars'))).toEqual([0, 33]);
    expect(valueExtent('error-bars', sample('error-bars', { series: [series('a', 'Saved', [2, 3, 4], [5, 1, 1])] }))).toEqual([-3, 7]);
    expect(valueExtent('dot-plot', sample('dot-plot'))).toEqual([0, 50]);
  });
});

describe('the twelve reading charts: the table and the values a learner reads', () => {
  it('shows every kind as a table whose rows match its columns', () => {
    for (const kind of READING_CHART_KINDS) {
      const table = chartTable(kind, sample(kind));
      expect(table.rows.length, kind).toBeGreaterThan(1);
      for (const row of table.rows) expect(row.cells.length, `${kind} ${row.id}`).toBe(table.columns.length + 1);
      expect(new Set(table.rows.map((row) => row.id)).size, `${kind} row ids`).toBe(table.rows.length);
    }
  });

  it('names computed columns with the model-word mark and author labels without it', () => {
    expect(chartTable('dumbbell', sample('dumbbell')).columns).toEqual(['Before', 'After', '~change']);
    expect(chartTable('dumbbell', sample('dumbbell')).rows[0]!.cells).toEqual(['Save', 10, 25, 15]);
    expect(chartTable('funnel', sample('funnel')).columns).toEqual(['~value', '~of first %', '~of previous %']);
    expect(chartTable('density-plot', sample('density-plot')).columns).toEqual(['~n', '~min', '~q1', '~median', '~q3', '~max']);
    expect(chartTable('timeline', sample('timeline')).columns).toEqual(['~date', '~end']);
    expect(chartTable('timeline', sample('timeline')).rows[0]!.cells).toEqual(['Start', '2026-09-07', '']);
    expect(chartTable('xy-heatmap', sample('xy-heatmap')).columns).toEqual(['Mon', 'Tue', 'Wed']);
    expect(chartTable('fan-chart', sample('fan-chart')).columns).toEqual(['Forecast', '~low 80%', '~high 80%', '~low 95%', '~high 95%']);
    expect(chartTable('error-bars', sample('error-bars')).columns).toEqual(['Saved', 'Saved ±']);
    const lorenz = chartTable('lorenz-curve', sample('lorenz-curve'));
    expect(lorenz.rows.map((row) => row.cells[0])).toEqual(['D', 'C', 'B', 'A', '~gini']);
    expect(chartTable('scatter-regression', sample('scatter-regression')).rows.slice(-2).map((row) => row.cells[0])).toEqual(['~slope', '~r2']);
  });

  it('gives every kind tap-to-read values with unique ids and finite numbers', () => {
    for (const kind of READING_CHART_KINDS) {
      const reads = chartReads(kind, sample(kind));
      expect(reads.length, kind).toBeGreaterThan(1);
      expect(new Set(reads.map((read) => read.id)).size, `${kind} read ids`).toBe(reads.length);
      for (const read of reads) {
        expect(read.label.length, `${kind} ${read.id}`).toBeGreaterThan(0);
        for (const part of read.parts) expect(Number.isFinite(part.value), `${kind} ${read.id} ${part.name}`).toBe(true);
      }
    }
    expect(chartReads('pie', parse({ categories: cats('A', 'B'), series: [series('a', 'A', [1, 2])] }))).toEqual([]);
  });

  it('reads a heatmap cell by row and column, a funnel by stage and a timeline span by its days', () => {
    const heat = chartReads('xy-heatmap', sample('xy-heatmap'));
    expect(heat).toHaveLength(6);
    expect(heat[1]).toEqual({ id: 'row-0:cat-1', label: 'Save, Tue', parts: [{ name: '~value', value: 4 }] });
    const funnel = chartReads('funnel', sample('funnel'));
    expect(funnel[0]!.parts.map((part) => part.name)).toEqual(['~value', '~of first %']);
    expect(funnel[1]!.parts.map((part) => part.name)).toEqual(['~value', '~of first %', '~of previous %']);
    const timeline = chartReads('timeline', sample('timeline'));
    expect(timeline[0]).toEqual({ id: 'ev-a', label: 'Start', text: '2026-09-07', parts: [] });
    expect(timeline[1]).toEqual({ id: 'ev-b', label: 'Saving', text: '2026-09-14 – 2026-10-05', parts: [{ name: '~days', value: 21 }] });
    const lorenz = chartReads('lorenz-curve', sample('lorenz-curve'));
    expect(lorenz.map((read) => read.label)).toEqual(['D', 'C', 'B', 'A']);
    expect(lorenz[3]!.parts.find((part) => part.name === '~total %')!.value).toBeCloseTo(100);
  });

  it('reads a regression point against the fitted line and a record along every axis', () => {
    const points = chartReads('scatter-regression', sample('scatter-regression'));
    expect(points[0]!.parts.map((part) => part.name)).toEqual(['~x', '~y', '~fit']);
    const fit = regressionFit(sample('scatter-regression').points!)!;
    expect(points[2]!.parts[2]!.value).toBeCloseTo(fit.slope * 3 + fit.intercept);
    expect(chartReads('parallel-coordinates', sample('parallel-coordinates'))[1]!.parts).toEqual([{ name: 'Price', value: 4 }, { name: 'Quality', value: 9 }, { name: 'Speed', value: 8 }]);
    expect(chartReads('fan-chart', sample('fan-chart'))[3]!.parts.map((part) => part.name)).toEqual(['Forecast', '~low 80%', '~high 80%', '~low 95%', '~high 95%']);
    expect(chartReads('density-plot', sample('density-plot'))[0]!.parts.map((part) => part.name)).toEqual(['~median', '~q1', '~q3', '~min', '~max']);
  });
});
