import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { checkCopy, type Locale } from '../../design/copyBudget';
import { chartDataSchema, chartProblem, chartReads, READING_CHART_KINDS, type ChartData, type ReadingChartKind } from './chartModel.generated';
import { readingCopy } from './readingCopy';
import { chartCopy, TeachingChart } from './TeachingChart';

/*
 * Horizonte F1.0 (Bible 05 V1, V3, V4, V6): the twelve reading charts draw one
 * lazy chunk, can be read by tap or by keyboard, and say every word in the
 * learner's language.
 */

const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const cats = (...labels: string[]) => labels.map((label, i) => ({ id: `cat-${i}00`, label }));
const line = (label: string, values: number[], extra: Record<string, unknown> = {}) => ({ id: 'series-a', label, values, ...extra });
const days = (date: string, end?: string) => ({ id: `ev-${date}`, label: 'Day', date, ...(end ? { end } : {}) });

const DATA: Record<ReadingChartKind, Record<string, unknown>> = {
  'dot-plot': { categories: cats('Save', 'Spend', 'Share', 'Gifts'), series: [line('This week', [30, 50, 20, 5])] },
  dumbbell: { categories: cats('Save', 'Spend', 'Share'), series: [line('Before', [10, 40, 20]), { ...line('After', [25, 30, 20]), id: 'series-b' }] },
  'xy-heatmap': { categories: cats('Mon', 'Tue', 'Wed'), rows: [{ id: 'row-a', label: 'Save' }, { id: 'row-b', label: 'Spend' }],
    cells: ['row-a', 'row-b'].flatMap((row, r) => ['cat-000', 'cat-100', 'cat-200'].map((col, c) => ({ row, col, value: (r + 1) * (c + 2) }))) },
  'error-bars': { categories: cats('Week 1', 'Week 2', 'Week 3'), series: [line('Saved', [20, 26, 31], { error: [3, 5, 2] })] },
  funnel: { categories: cats('Visit', 'Browse', 'Cart', 'Buy'), series: [line('People', [100, 60, 30, 12])] },
  'lorenz-curve': { categories: cats('A', 'B', 'C', 'D'), series: [line('Money', [60, 25, 10, 5])] },
  'fan-chart': { categories: cats('Year 1', 'Year 2', 'Year 3', 'Year 4'), series: [line('Forecast', [100, 110, 120, 135])],
    ranges: [{ level: 80, low: [100, 104, 108, 118], high: [100, 116, 132, 152] }, { level: 95, low: [100, 100, 100, 108], high: [100, 120, 140, 166] }] },
  'density-plot': { samples: [{ id: 'grp-100', label: 'Class A', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 9] }, { id: 'grp-200', label: 'Class B', values: [3, 4, 5, 5, 6, 6, 7, 8, 9, 10] }] },
  'violin-plot': { samples: [{ id: 'grp-100', label: 'Class A', values: [1, 2, 2, 3, 3, 3, 4, 4, 5, 9] }, { id: 'grp-200', label: 'Class B', values: [3, 4, 5, 5, 6, 6, 7, 8, 9, 10] }] },
  timeline: { events: [days('2026-09-07'), days('2026-09-14', '2026-10-05'), days('2026-10-12')] },
  'scatter-regression': { points: [[1, 2], [2, 4], [3, 5], [4, 4], [5, 6]].map(([x, y], i) => ({ id: `pt-${i}00`, label: `Week ${i + 1}`, x: x!, y: y! })) },
  'parallel-coordinates': { categories: cats('Price', 'Quality', 'Speed'), records: [{ id: 'rec-100', label: 'Plan A', values: [10, 7, 5] }, { id: 'rec-200', label: 'Plan B', values: [4, 9, 8] }, { id: 'rec-300', label: 'Plan C', values: [7, 5, 9] }] },
};

const parse = (kind: ReadingChartKind): ChartData => chartDataSchema.parse({ unit: 'coins', ...DATA[kind] });

async function open(kind: ReadingChartKind, locale: Locale = 'en-US') {
  const data = parse(kind);
  expect(chartProblem(kind, data), kind).toBeNull();
  const view = render(<TeachingChart kind={kind} data={data} title={`Chart ${kind}`} locale={locale} />);
  await screen.findByRole('img', { name: `Chart ${kind}` });
  return { ...view, data, reads: chartReads(kind, data) };
}

const readout = () => screen.getByRole('status');

describe('reading charts: tap and keyboard', () => {
  it('reads the values of a tapped mark and clears on a second tap', async () => {
    const { container } = await open('dot-plot');
    expect(readout().textContent).toBe(readingCopy['en-US'].hint);
    const hits = container.querySelectorAll('.lf-chart-hit');
    expect(hits).toHaveLength(4);
    fireEvent.click(hits[1]!);
    expect(readout().textContent).toContain('Spend');
    expect(readout().textContent).toContain('50');
    expect(container.querySelector('.lf-chart-pick[data-on="yes"]')).toBeTruthy();
    fireEvent.click(hits[1]!);
    expect(readout().textContent).toBe(readingCopy['en-US'].hint);
    expect(container.querySelector('.lf-chart-pick[data-on="yes"]')).toBeNull();
  });

  it('walks the marks with Next and Previous, wrapping at both ends', async () => {
    await open('dot-plot');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(readout().textContent).toContain('Save');
    expect(screen.getByText('1 of 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(readout().textContent).toContain('Spend');
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(readout().textContent).toContain('Gifts');
    expect(screen.getByText('4 of 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(readout().textContent).toContain('Save');
  });

  it('steps with the arrow keys inside the reader and clears with Escape', async () => {
    await open('funnel');
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();
    fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(readout().textContent).toContain('Visit');
    fireEvent.keyDown(next, { key: 'ArrowDown' });
    expect(readout().textContent).toContain('Browse');
    expect(readout().textContent).toContain('60% of first');
    fireEvent.keyDown(next, { key: 'ArrowLeft' });
    expect(readout().textContent).toContain('Visit');
    fireEvent.keyDown(next, { key: 'ArrowUp' });
    expect(readout().textContent).toContain('Buy');
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(readout().textContent).toBe(readingCopy['en-US'].hint);
  });

  it('gives the reader a name and a polite live read-out on every kind', async () => {
    for (const kind of READING_CHART_KINDS) {
      const { unmount } = await open(kind);
      expect(screen.getByRole('group', { name: readingCopy['en-US'].read }), kind).toBeTruthy();
      expect(readout().getAttribute('aria-live'), kind).toBe('polite');
      expect(screen.getAllByRole('button', { name: /^(Previous|Next)$/ }), kind).toHaveLength(2);
      unmount();
    }
  });

  it('puts a tap area on every readable mark of every kind, and every read can be reached by stepping', async () => {
    for (const kind of READING_CHART_KINDS) {
      const { container, reads, unmount } = await open(kind);
      expect(container.querySelectorAll('.lf-chart-hit').length, `${kind} tap areas`).toBeGreaterThanOrEqual(reads.length);
      const seen = new Set<string>();
      for (let i = 0; i < reads.length; i += 1) {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        seen.add(readout().textContent ?? '');
      }
      expect(seen.size, `${kind} distinct read-outs`).toBe(reads.length);
      unmount();
    }
  });

  it('reads a timeline span with its days in the learner\'s date order', async () => {
    await open('timeline', 'es-MX');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(readout().textContent).toContain('14/09/2026 – 05/10/2026');
    expect(readout().textContent).toContain('Días: 21');
    expect(screen.getByText('2 de 3')).toBeTruthy();
  });
});

describe('reading charts: words in three locales', () => {
  it('shows the table with the model words and dates in the learner\'s language', async () => {
    await open('funnel', 'es-MX');
    fireEvent.click(screen.getByRole('button', { name: chartCopy['es-MX'].showTable }));
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('% del primero');
    expect(table.textContent).toContain('% del anterior');
    expect(table.textContent).not.toContain('~');
  });

  it('shows a timeline table with dates written the learner\'s way', async () => {
    await open('timeline', 'pt-BR');
    fireEvent.click(screen.getByRole('button', { name: chartCopy['pt-BR'].showTable }));
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Data');
    expect(table.textContent).toContain('07/09/2026');
    expect(table.textContent).toContain('05/10/2026');
    expect(table.textContent).not.toContain('2026-09-07');
  });

  it('keeps author labels as written and never shows a model mark', async () => {
    for (const locale of LOCALES) {
      for (const kind of READING_CHART_KINDS) {
        const { container, unmount } = await open(kind, locale);
        fireEvent.click(screen.getByRole('button', { name: chartCopy[locale].showTable }));
        expect(container.textContent, `${locale} ${kind}`).not.toContain('~');
        unmount();
      }
    }
  });

  it('draws numerals only in the SVG and no ellipsis, in every locale', async () => {
    for (const locale of LOCALES) {
      for (const kind of READING_CHART_KINDS) {
        const { container, unmount } = await open(kind, locale);
        expect(container.querySelector('svg')?.childElementCount, `${locale} ${kind}`).toBeGreaterThan(1);
        for (const text of container.querySelectorAll('svg text')) expect(text.textContent, `${locale} ${kind}: "${text.textContent}"`).not.toMatch(/\p{L}/u);
        expect(container.textContent, `${locale} ${kind}`).not.toContain('…');
        for (const tag of container.querySelectorAll<HTMLElement>('.lf-chart-tag')) expect(tag.getAttribute('data-copy-role')).toBe('data');
        unmount();
      }
    }
  });

  it('writes the how-to-read note of each kind in the learner\'s language', async () => {
    for (const locale of LOCALES) {
      const { container, unmount } = await open('lorenz-curve', locale);
      const note = container.querySelector('.lf-chart-note');
      expect(note?.textContent).toBe(readingCopy[locale].note['lorenz-curve']);
      expect(note?.getAttribute('data-copy-role')).toBe('body');
      unmount();
    }
  });

  it('keeps every reading chart string inside the Copy Budget at every age it opens to', () => {
    for (const locale of LOCALES) {
      for (const ageBand of ['10-12', '13-17', 'adult'] as const) {
        const context = { locale, ageBand, surface: 'app' } as const;
        const copy = readingCopy[locale];
        for (const text of [copy.read, copy.previous, copy.next]) expect(checkCopy(text, 'action', context), `${locale} ${text}`).toEqual([]);
        for (const text of [copy.hint, ...Object.values(copy.note)]) expect(checkCopy(text, 'body', context), `${locale} ${ageBand} ${text}`).toEqual([]);
      }
      expect(Object.keys(readingCopy[locale].note).sort()).toEqual([...READING_CHART_KINDS].sort());
    }
  });
});

describe('reading charts: motion', () => {
  it('moves only when the learner has not asked for reduced motion, in the component token, with no spring', () => {
    const css = readFileSync(resolve(__dirname, 'charts.css'), 'utf8');
    const block = /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/.exec(css);
    expect(block).toBeTruthy();
    const outside = css.replace(block![0], '');
    expect(outside).not.toMatch(/transition|animation/);
    expect(block![0]).toContain('var(--dur-component)');
    expect(css).not.toMatch(/spring|cubic-bezier|overshoot/);
  });
});
