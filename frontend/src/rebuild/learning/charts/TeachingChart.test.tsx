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

  it('carries series by hue and a pattern, and shortens a long label only in the drawing', () => {
    const data = chartDataSchema.parse({ unit: 'coins', categories: [{ id: 'cat-long', label: 'A very long category name' }, { id: 'cat-b00', label: 'B' }], series: two.map((s) => ({ ...s, values: [1, 2] })) });
    const { container } = render(<TeachingChart kind="grouped-bar" data={data} title="Weeks" locale="en-US" />);
    expect(container.querySelectorAll('pattern')).toHaveLength(3);
    expect(container.querySelector('text')?.textContent).toMatch(/…$/);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByText('A very long category name')).toBeTruthy();
  });

  it('keeps chart words inside the Copy Budget in three locales', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      expect(checkCopy(chartCopy[locale].showTable, 'action', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(checkCopy(chartCopy[locale].showChart, 'action', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(checkCopy(chartCopy[locale].each('10'), 'body', { locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
    }
  });
});
