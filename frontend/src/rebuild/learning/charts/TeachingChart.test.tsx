import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { checkCopy } from '../../design/copyBudget';
import { CHART_KINDS, CORE_CHART_KINDS, READING_CHART_KINDS, SITUATIONAL_CHART_KINDS, chartDataSchema, chartProblem, chartTable, type ChartKind } from './chartModel.generated';
import { chartCopy, TeachingChart } from './TeachingChart';

/*
 * GAP-FIX-R1 learning (B.7 part 1, Appendix A Part 1, Bible 05 V1/V6): every
 * first-release chart kind draws as one named image with a description, can
 * be read as a table, and never draws data the model refused.
 */

const categories = ['Save', 'Spend', 'Share', 'Gifts'].map((label, i) => ({ id: `cat-${i}00`, label }));
const two = [{ id: 'series-a', label: 'This week', values: [30, 50, 20, 0] }, { id: 'series-b', label: 'Last week', values: [20, 40, 30, 10] }];
const nodes = [{ id: 'node-a', label: 'Income' }, { id: 'node-b', label: 'Save' }, { id: 'node-c', label: 'Spend' }];
const links = [{ from: 'node-a', to: 'node-b', value: 40, label: 'yes' }, { from: 'node-a', to: 'node-c', value: 60, label: 'no' }];

function sample(kind: ChartKind) {
  const base = { unit: 'coins' as const };
  switch (kind) {
    case 'pie': case 'donut': return { ...base, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [30, 50, 20] }] };
    case 'waffle': return { ...base, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [30, 50, 20] }] };
    case 'pictogram': return { ...base, icon_value: 10, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [30, 50, 20] }] };
    case 'slope': return { ...base, categories: categories.slice(0, 2), series: [{ ...two[0]!, values: [3, 5] }] };
    case 'stat-tile': return { ...base, stat: { value: 120, delta: 15 } };
    case 'bullet': case 'gauge': return { ...base, stat: { value: 70 }, target: 100, bands: [50, 80] };
    case 'scatter': return { ...base, points: [1, 2, 3].map((n) => ({ id: `pt-${n}00`, label: `Week ${n}`, x: n, y: n * 3 })) };
    case 'bubble': return { ...base, points: [1, 2, 3].map((n) => ({ id: `pt-${n}00`, label: `Fund ${n}`, x: n, y: n * 3, size: n * 10 })) };
    case 'calendar-heatmap': return { ...base, days: Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(i + 7).padStart(2, '0')}`, value: i % 3 })) };
    case 'sankey': return { ...base, nodes, links: links.map(({ label: _, ...link }) => link) };
    case 'flowchart': case 'decision-tree': case 'tree': return { ...base, nodes, links: links.map(({ value: _, ...link }) => link) };
    case 'histogram': case 'pareto': case 'waterfall': return { ...base, categories, series: [{ ...two[0]!, values: kind === 'waterfall' ? [50, -15, -10, 20] : [30, 50, 20, 5] }] };
    case 'grouped-bar': case 'stacked-bar': case 'stacked-bar-100': case 'stacked-area': case 'stacked-area-100': return { ...base, categories, series: two };
    // GAP-FIX-R2 (B.7 part 1): the remaining Appendix A situational kinds.
    case 'marimekko': return { ...base, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [30, 50, 20] }, { ...two[1]!, values: [20, 40, 30] }] };
    case 'bump': return { ...base, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [1, 2, 1] }, { ...two[1]!, values: [2, 1, 2] }] };
    case 'candlestick': return { ...base, ohlc: [{ id: 'day-100', label: 'Mon', open: 10, high: 14, low: 9, close: 13 }, { id: 'day-200', label: 'Tue', open: 13, high: 13, low: 8, close: 9 }] };
    case 'box-plot': return { ...base, boxes: [{ id: 'grp-100', label: 'Class A', min: 2, q1: 5, median: 8, q3: 12, max: 20 }, { id: 'grp-200', label: 'Class B', min: 1, q1: 3, median: 4, q3: 9, max: 15 }] };
    case 'connected-scatter': return { ...base, points: [1, 2, 3].map((n) => ({ id: `pt-${n}00`, label: `Year ${n}`, x: n * 2, y: 10 - n })) };
    case 'venn': return { ...base, categories: categories.slice(0, 2), regions: [{ sets: ['cat-000'], value: 12 }, { sets: ['cat-100'], value: 7 }, { sets: ['cat-000', 'cat-100'], value: 5 }] };
    case 'swimlane': return { ...base, categories: categories.slice(0, 2), nodes: [{ id: 'node-a', label: 'Ask', lane: 'cat-000' }, { id: 'node-b', label: 'Approve', lane: 'cat-100' }, { id: 'node-c', label: 'Buy', lane: 'cat-000' }],
      links: [{ from: 'node-a', to: 'node-b' }, { from: 'node-b', to: 'node-c' }] };
    case 'treemap': case 'sunburst': case 'icicle': return { ...base, nodes: [{ id: 'node-root', label: 'Budget' }, { id: 'node-food', label: 'Food' }, { id: 'node-fun', label: 'Fun' },
      { id: 'node-snacks', label: 'Snacks', value: 20 }, { id: 'node-lunch', label: 'Lunch', value: 40 }, { id: 'node-games', label: 'Games', value: 30 }],
      links: [{ from: 'node-root', to: 'node-food' }, { from: 'node-root', to: 'node-fun' }, { from: 'node-food', to: 'node-snacks' }, { from: 'node-food', to: 'node-lunch' }, { from: 'node-fun', to: 'node-games' }] };
    case 'org-chart': case 'mind-map': return { ...base, nodes, links: links.map(({ value: _, label: __, ...link }) => link) };
    case 'ishikawa': return { ...base, nodes: [{ id: 'node-eff', label: 'Low sales' }, { id: 'node-price', label: 'Price' }, { id: 'node-place', label: 'Place' },
      { id: 'node-high', label: 'Too high' }, { id: 'node-hidden', label: 'Hidden stand' }],
      links: [{ from: 'node-eff', to: 'node-price' }, { from: 'node-eff', to: 'node-place' }, { from: 'node-price', to: 'node-high' }, { from: 'node-place', to: 'node-hidden' }] };
    // Horizonte F1.0: the twelve reading charts.
    case 'dot-plot': return { ...base, categories, series: [two[0]!] };
    case 'dumbbell': return { ...base, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [30, 50, 20] }, { ...two[1]!, values: [20, 40, 30] }] };
    case 'xy-heatmap': return { ...base, categories: categories.slice(0, 3), rows: [{ id: 'row-a', label: 'Mon' }, { id: 'row-b', label: 'Tue' }],
      cells: ['row-a', 'row-b'].flatMap((row, r) => categories.slice(0, 3).map((cat, c) => ({ row, col: cat.id, value: (r + 1) * (c + 2) }))) };
    case 'error-bars': return { ...base, categories: categories.slice(0, 3), series: [{ ...two[0]!, values: [30, 50, 20], error: [4, 6, 3] }] };
    case 'funnel': return { ...base, categories, series: [{ ...two[0]!, values: [100, 60, 30, 12] }] };
    case 'lorenz-curve': return { ...base, categories, series: [{ ...two[0]!, values: [60, 25, 10, 5] }] };
    case 'fan-chart': return { ...base, categories, series: [{ ...two[0]!, values: [100, 110, 120, 135] }],
      ranges: [{ level: 80, low: [100, 104, 108, 118], high: [100, 116, 132, 152] }, { level: 95, low: [100, 100, 100, 108], high: [100, 120, 140, 166] }] };
    case 'density-plot': case 'violin-plot': return { ...base, samples: [{ id: 'grp-100', label: 'Class A', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 9] }, { id: 'grp-200', label: 'Class B', values: [3, 4, 5, 5, 6, 6, 7, 8, 9, 10] }] };
    case 'timeline': return { ...base, events: [{ id: 'ev-100', label: 'Start', date: '2026-09-07' }, { id: 'ev-200', label: 'Saving', date: '2026-09-14', end: '2026-10-05' }, { id: 'ev-300', label: 'Buy', date: '2026-10-12' }] };
    case 'scatter-regression': return { ...base, points: [[1, 2], [2, 4], [3, 5], [4, 4], [5, 6]].map(([x, y], i) => ({ id: `pt-${i}00`, label: `Week ${i + 1}`, x: x!, y: y! })) };
    case 'parallel-coordinates': return { ...base, categories: categories.slice(0, 3), records: [{ id: 'rec-100', label: 'Plan A', values: [10, 7, 5] }, { id: 'rec-200', label: 'Plan B', values: [4, 9, 8] }, { id: 'rec-300', label: 'Plan C', values: [7, 5, 9] }] };
    default: return { ...base, categories, series: [two[0]!] };
  }
}

describe('teaching charts', () => {
  for (const kind of CHART_KINDS) {
    it(`draws ${kind} as a named image with a description, and as a table`, async () => {
      const data = chartDataSchema.parse(sample(kind));
      expect(chartProblem(kind, data), kind).toBeNull();
      const { container } = render(<TeachingChart kind={kind} data={data} title={`Chart ${kind}`} locale="en-US" />);
      const image = await screen.findByRole('img', { name: `Chart ${kind}` });
      expect(image.getAttribute('aria-describedby')).toBeTruthy();
      expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(1);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(screen.getByRole('table', { name: 'Chart data' })).toBeTruthy();
    });
  }

  it('carries series by hue and a pattern, and never shortens a label (02 D1; 05 §5)', () => {
    const data = chartDataSchema.parse({ unit: 'coins', categories: [{ id: 'cat-long', label: 'A very long category name' }, { id: 'cat-b00', label: 'B' }], series: two.map((s) => ({ ...s, values: [1, 2] })) });
    const { container } = render(<TeachingChart kind="grouped-bar" data={data} title="Weeks" locale="en-US" />);
    expect(container.querySelectorAll('pattern')).toHaveLength(3);
    const tag = [...container.querySelectorAll('.lf-chart-tag')].find((node) => node.textContent === 'A very long category name');
    expect(tag?.getAttribute('data-copy-role')).toBe('data');
    expect(container.textContent).not.toContain('…');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByText('A very long category name')).toBeTruthy();
  });

  it('GAP-FIX-R3: no kind draws a word as SVG text or ends a label in an ellipsis; words are HTML tags over the drawing', async () => {
    for (const kind of CHART_KINDS) {
      const { container, unmount } = render(<TeachingChart kind={kind} data={chartDataSchema.parse(sample(kind))} title={`Chart ${kind}`} locale="en-US" />);
      await screen.findByRole('img', { name: `Chart ${kind}` });
      for (const text of container.querySelectorAll('svg text')) expect(text.textContent, `${kind}: "${text.textContent}"`).not.toMatch(/\p{L}/u);
      expect(container.textContent, kind).not.toContain('…');
      for (const tag of container.querySelectorAll<HTMLElement>('.lf-chart-tag')) {
        expect(tag.style.maxInlineSize, `${kind} ${tag.textContent}`).toMatch(/%$/);
        expect(tag.getAttribute('data-copy-role')).toBe('data');
      }
      unmount();
    }
    // A diagram's node names and a category axis are tags, whole.
    const { container } = render(<TeachingChart kind="flowchart" data={chartDataSchema.parse(sample('flowchart'))} title="Flow" locale="en-US" />);
    expect([...container.querySelectorAll('.lf-chart-tag')].map((node) => node.textContent)).toEqual(expect.arrayContaining(['Income', 'Save', 'Spend', 'yes', 'no']));
  });

  it('keeps chart words inside the Copy Budget in three locales', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      expect(checkCopy(chartCopy[locale].showTable, 'action', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(checkCopy(chartCopy[locale].label, 'data', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(checkCopy(chartCopy[locale].showChart, 'action', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(checkCopy(chartCopy[locale].each('10'), 'body', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
    }
  });
});

/*
 * Fix round: all 58 kinds, one by one. Each is a named image whose SVG is hidden
 * from assistive tech and described by real text, draws finite numbers, and has
 * a table fallback with a header per column and a data-label on every cell (the
 * stacked narrow-width table reads its labels from them).
 */
describe('every chart kind: drawing, description and table fallback', () => {
  it('covers 58 kinds: 25 core, 21 situational and 12 reading', () => {
    expect(CORE_CHART_KINDS).toHaveLength(25);
    expect(SITUATIONAL_CHART_KINDS).toHaveLength(21);
    expect(READING_CHART_KINDS).toHaveLength(12);
    expect(CHART_KINDS).toHaveLength(58);
    expect(new Set(CHART_KINDS).size).toBe(58);
  });

  for (const kind of CHART_KINDS) {
    it(`${kind}: SVG with a name and a description, and a table that matches the model`, async () => {
      const data = chartDataSchema.parse(sample(kind));
      const { container } = render(<TeachingChart kind={kind} data={data} title={`Chart ${kind}`} locale="en-US" />);
      const image = await screen.findByRole('img', { name: `Chart ${kind}` });

      const svg = container.querySelector('svg')!;
      expect(svg, kind).toBeTruthy();
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('viewBox')).toMatch(/^0 0 320 [0-9]+(?:[.][0-9]+)?$/);
      expect(svg.childElementCount, kind).toBeGreaterThan(1);
      expect(svg.outerHTML, `${kind} draws a non-finite number`).not.toMatch(/NaN|undefined|Infinity/);

      const description = image.getAttribute('aria-describedby')!;
      const described = container.querySelector(`[id="${description}"]`);
      expect(described, `${kind} has no description element`).toBeTruthy();
      expect(described!.textContent!.trim().length, `${kind} description is empty`).toBeGreaterThan(8);
      expect(described!.textContent, kind).not.toMatch(/NaN|undefined|~/);

      const model = chartTable(kind, data);
      expect(model.rows.length, kind).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'Chart data' });
      expect(container.querySelector('svg'), `${kind} keeps the SVG beside its table`).toBeNull();
      const head = within(table).getAllByRole('columnheader');
      expect(head, kind).toHaveLength(Math.max(model.columns.length + 1, ...model.rows.map((row) => row.cells.length)));
      const body = table.querySelectorAll('tbody tr');
      expect(body, kind).toHaveLength(model.rows.length);
      for (const row of body) {
        expect(row.children, kind).toHaveLength(head.length);
        for (const cell of row.children) {
          expect(cell.getAttribute('data-label'), `${kind} cell "${cell.textContent}"`).toBeTruthy();
          expect(cell.textContent, kind).not.toMatch(/^~|NaN|undefined/);
        }
      }
      expect(table.textContent, kind).not.toContain('~');

      fireEvent.click(screen.getByRole('button', { name: 'Show chart' }));
      expect(await screen.findByRole('img', { name: `Chart ${kind}` })).toBeTruthy();
      expect(container.querySelector('svg'), kind).toBeTruthy();
    });
  }

  it('describes a diagram, which has no numbers, by its structure', async () => {
    const description = async (kind: ChartKind) => {
      const { container, unmount } = render(<TeachingChart kind={kind} data={chartDataSchema.parse(sample(kind))} title={`Chart ${kind}`} locale="en-US" />);
      const image = await screen.findByRole('img', { name: `Chart ${kind}` });
      const text = container.querySelector(`[id="${image.getAttribute('aria-describedby')}"]`)!.textContent;
      unmount();
      return text;
    };
    expect(await description('flowchart')).toBe('Income → Save (yes); Income → Spend (no)');
    expect(await description('org-chart')).toBe('Income; Income → Save; Income → Spend');
    expect(await description('swimlane')).toBe('Ask (Save) → Approve; Approve (Spend) → Buy; Buy (Save)');
  });

  it('labels every table cell with its column in three locales', async () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const kind of READING_CHART_KINDS) {
        const data = chartDataSchema.parse(sample(kind));
        const { container, unmount } = render(<TeachingChart kind={kind} data={data} title={`Chart ${kind}`} locale={locale} />);
        await screen.findByRole('img', { name: `Chart ${kind}` });
        fireEvent.click(screen.getByRole('button', { name: chartCopy[locale].showTable }));
        const heads = [...container.querySelectorAll('thead th')].map((node) => node.textContent);
        for (const row of container.querySelectorAll('tbody tr')) {
          [...row.children].forEach((cell, index) => {
            expect(cell.getAttribute('data-label'), `${locale} ${kind}`).toBe(heads[index]);
            expect(cell.textContent, `${locale} ${kind}`).not.toMatch(/~/);
          });
        }
        expect(container.querySelector('table')!.textContent, `${locale} ${kind}`).not.toContain('~');
        unmount();
      }
    }
  });
});
