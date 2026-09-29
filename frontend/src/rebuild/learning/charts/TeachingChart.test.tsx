import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { checkCopy } from '../../design/copyBudget';
import { CHART_KINDS, chartDataSchema, chartProblem, type ChartKind } from './chartModel.generated';
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
    default: return { ...base, categories, series: [two[0]!] };
  }
}

describe('teaching charts', () => {
  for (const kind of CHART_KINDS) {
    it(`draws ${kind} as a named image with a description, and as a table`, () => {
      const data = chartDataSchema.parse(sample(kind));
      expect(chartProblem(kind, data), kind).toBeNull();
      const { container } = render(<TeachingChart kind={kind} data={data} title={`Chart ${kind}`} locale="en-US" />);
      const image = screen.getByRole('img', { name: `Chart ${kind}` });
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

  it('GAP-FIX-R3: no kind draws a word as SVG text or ends a label in an ellipsis; words are HTML tags over the drawing', () => {
    for (const kind of CHART_KINDS) {
      const { container, unmount } = render(<TeachingChart kind={kind} data={chartDataSchema.parse(sample(kind))} title={`Chart ${kind}`} locale="en-US" />);
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
      expect(checkCopy(chartCopy[locale].showChart, 'action', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(checkCopy(chartCopy[locale].each('10'), 'body', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
    }
  });
});
