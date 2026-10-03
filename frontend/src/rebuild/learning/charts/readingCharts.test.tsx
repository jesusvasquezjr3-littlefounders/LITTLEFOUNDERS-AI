import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkCopy, type Locale } from '../../design/copyBudget';
import { chartDataSchema, chartProblem, chartReads, READING_CHART_KINDS, type ChartData, type ReadingChartKind } from './chartModel.generated';
import { readingCopy } from './readingCopy';
import { longestWord } from './readingGeometry';
import { chartCopy, TeachingChart, W } from './TeachingChart';

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

/*
 * Fix round (layout): a plot is as tall as its content, so the legend sits under
 * the marks. jsdom has no layout, so these tests read the geometry the chart
 * hands to the browser: the viewBox, the drawn shapes and the label anchors.
 */

interface Box { x0: number; y0: number; x1: number; y1: number }
const numbers = (text: string | null) => (text?.match(/-?[0-9]+(?:[.][0-9]+)?/g) ?? []).map(Number);

/** The bounding box of what an SVG draws; `ink` leaves out the invisible tap areas and highlight bands. */
function extent(svg: Element, ink: boolean): Box {
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number) => { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); };
  const num = (element: Element, name: string) => Number(element.getAttribute(name));
  for (const element of svg.querySelectorAll('line, rect, circle, polygon, polyline, path, text')) {
    if (element.closest('defs')) continue;
    if (ink && (element.classList.contains('lf-chart-hit') || element.classList.contains('lf-chart-pick'))) continue;
    switch (element.tagName.toLowerCase()) {
      case 'line': add(num(element, 'x1'), num(element, 'y1')); add(num(element, 'x2'), num(element, 'y2')); break;
      case 'rect': add(num(element, 'x'), num(element, 'y')); add(num(element, 'x') + num(element, 'width'), num(element, 'y') + num(element, 'height')); break;
      case 'circle': add(num(element, 'cx') - num(element, 'r'), num(element, 'cy') - num(element, 'r')); add(num(element, 'cx') + num(element, 'r'), num(element, 'cy') + num(element, 'r')); break;
      case 'polygon': case 'polyline': { const points = numbers(element.getAttribute('points')); for (let i = 0; i + 1 < points.length; i += 2) add(points[i]!, points[i + 1]!); break; }
      case 'path': {
        const d = element.getAttribute('d') ?? ''; const [x, y, r] = numbers(d);
        if (d.includes('a')) { add(x!, y! - r!); add(x! + 2 * r!, y! + r!); } else { const points = numbers(d); for (let i = 0; i + 1 < points.length; i += 2) add(points[i]!, points[i + 1]!); }
        break;
      }
      default: add(num(element, 'x'), num(element, 'y'));
    }
  }
  return box;
}

const canvasOf = (container: HTMLElement) => container.querySelector<HTMLElement>('.lf-chart-canvas--fit')!;
const heightOf = (container: HTMLElement) => numbers(canvasOf(container).querySelector('svg')!.getAttribute('viewBox'))[3]!;
const tags = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.lf-chart-tag')];
const roomOf = (tag: HTMLElement) => parseFloat(tag.style.maxInlineSize) * W / 100;

/** Opens a kind with data other than the shared sample (the schema still has the last word). */
async function openWith(kind: ReadingChartKind, data: Record<string, unknown>, locale: Locale = 'en-US') {
  const parsed = chartDataSchema.parse({ unit: 'coins', ...data });
  expect(chartProblem(kind, parsed), kind).toBeNull();
  const view = render(<TeachingChart kind={kind} data={parsed} title={`Chart ${kind}`} locale={locale} />);
  await screen.findByRole('img', { name: `Chart ${kind}` });
  return view;
}

describe('reading charts: layout', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('sizes every plot from its content: viewBox, aspect ratio, marks inside, no dead band, in every locale', async () => {
    for (const locale of LOCALES) {
      for (const kind of READING_CHART_KINDS) {
        const { container, unmount } = await open(kind, locale);
        const where = `${locale} ${kind}`;
        const canvas = canvasOf(container); const svg = canvas.querySelector('svg')!;
        const height = heightOf(container);
        expect(svg.getAttribute('viewBox'), where).toBe(`0 0 ${W} ${height}`);
        expect(height, where).toBeGreaterThanOrEqual(40);
        expect(height, where).toBeLessThanOrEqual(180);
        expect(canvas.style.aspectRatio.replace(/\s/g, ''), where).toBe(`${W}/${height}`);
        expect(parseFloat(canvas.style.maxInlineSize), where).toBeCloseTo(Math.min((W * 16) / 9, (320 * W) / height), 0);

        const all = extent(svg, false); const ink = extent(svg, true);
        for (const [name, value, low, high] of [['left', all.x0, 0, W], ['right', all.x1, 0, W], ['top', all.y0, 0, height], ['bottom', all.y1, 0, height]] as const) {
          expect(value, `${where} ${name} edge of the drawing`).toBeGreaterThanOrEqual(low - 0.5);
          expect(value, `${where} ${name} edge of the drawing`).toBeLessThanOrEqual(high + 0.5);
        }
        expect(ink.y0, `${where} blank band above the marks`).toBeLessThanOrEqual(24);
        expect(height - ink.y1, `${where} blank band under the marks`).toBeLessThanOrEqual(20);

        for (const tag of tags(container)) {
          expect(parseFloat(tag.style.left), `${where} "${tag.textContent}"`).toBeGreaterThanOrEqual(0);
          expect(parseFloat(tag.style.left), `${where} "${tag.textContent}"`).toBeLessThanOrEqual(100);
          expect(parseFloat(tag.style.top), `${where} "${tag.textContent}"`).toBeGreaterThanOrEqual(0);
          expect(parseFloat(tag.style.top), `${where} "${tag.textContent}"`).toBeLessThanOrEqual(100);
        }
        unmount();
      }
    }
  });

  it('keeps the heatmap and the timeline short: the legend sits right under the marks', async () => {
    for (const [kind, ceiling] of [['xy-heatmap', 100], ['timeline', 120]] as const) {
      const { container, unmount } = await open(kind);
      expect(heightOf(container), kind).toBeLessThanOrEqual(ceiling);
      const [canvas, description, legend] = [...canvasOf(container).parentElement!.children];
      expect(canvas, kind).toBe(canvasOf(container));
      expect(description!.className, kind).toContain('lf-visually-hidden');
      expect(legend!.className, kind).toBe('lf-chart-legend');
      unmount();
    }
    const css = readFileSync(resolve(__dirname, 'charts.css'), 'utf8');
    expect(css).toMatch(/\.lf-chart-canvas--fit \{\s*margin-block: var\(--lf-chart-over-top, 0px\) calc\(var\(--lf-chart-over-bottom, var\(--spacing-4\)\) \+ var\(--spacing-2\)\);/);
  });

  it('grows the heatmap with its rows and gives a long row label the room of its longest word', async () => {
    const rows = ['Allowance', 'Pocket money', 'Chores', 'Gifts'].map((label, i) => ({ id: `row-${i}`, label }));
    const base = (picked: typeof rows) => ({ categories: cats('Mon', 'Tue', 'Wed'), rows: picked,
      cells: picked.flatMap((row, r) => ['cat-000', 'cat-100', 'cat-200'].map((col, c) => ({ row: row.id, col, value: r + c + 1 }))) });
    const two = await openWith('xy-heatmap', base(rows.slice(0, 2)));
    const short = heightOf(two.container); two.unmount();
    const four = await openWith('xy-heatmap', base(rows));
    expect(heightOf(four.container)).toBeGreaterThan(short);
    for (const tag of tags(four.container).filter((node) => rows.some((row) => row.label === node.textContent))) {
      expect(roomOf(tag), tag.textContent!).toBeGreaterThanOrEqual(longestWord(tag.textContent!) - 0.1);
    }
    four.unmount();
  });

  it('gives a timeline label the room of its longest word and keeps a crowded timeline inside the box', async () => {
    const labels = ['Allowance day', 'Birthday money', 'Bike bought', 'Piggy bank full', 'School trip', 'Lemonade stand', 'Garage sale', 'Goal reached'];
    const events = labels.map((label, i) => ({ id: `ev-${i}00`, label, date: `2026-09-${String(3 + i * 3).padStart(2, '0')}`, ...(i % 3 === 1 ? { end: `2026-09-${String(5 + i * 3).padStart(2, '0')}` } : {}) }));
    const { container, unmount } = await openWith('timeline', { events });
    const height = heightOf(container);
    expect(height).toBeLessThanOrEqual(180);
    for (const tag of tags(container)) expect(roomOf(tag), tag.textContent!).toBeGreaterThanOrEqual(longestWord(tag.textContent!) - 0.1);
    const all = extent(canvasOf(container).querySelector('svg')!, false);
    expect(all.y0).toBeGreaterThanOrEqual(-0.5);
    expect(all.y1).toBeLessThanOrEqual(height + 0.5);
    unmount();
  });

  it('gives each end label of a parallel-coordinates axis the room of its longest word', async () => {
    const { container, unmount } = await openWith('parallel-coordinates', { categories: cats('Allowance', 'Savings', 'Chores'),
      records: [{ id: 'rec-100', label: 'Plan A', values: [10, 7, 5] }, { id: 'rec-200', label: 'Plan B', values: [4, 9, 8] }] });
    const ends = tags(container).filter((tag) => ['Allowance', 'Chores'].includes(tag.textContent!));
    expect(ends).toHaveLength(2);
    for (const tag of ends) expect(roomOf(tag), tag.textContent!).toBeGreaterThanOrEqual(longestWord(tag.textContent!) - 0.1);
    unmount();
  });

  it('keeps the most rows a row chart takes a label tall apart and inside the box', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `cat-${i}00`, label: `Item ${i + 1}` }));
    const values = six.map((_, i) => 100 - i * 15);
    const sets = [['dot-plot', { categories: six, series: [line('Week', values)] }], ['dumbbell', { categories: six, series: [line('Before', values), { ...line('After', values.map((v) => v - 5)), id: 'series-b' }] }],
      ['funnel', { categories: six, series: [line('People', values)] }]] as const;
    for (const [kind, data] of sets) {
      const { container, unmount } = await openWith(kind, data);
      const height = heightOf(container);
      const tops = tags(container).filter((tag) => /^Item /.test(tag.textContent!)).map((tag) => parseFloat(tag.style.top) * height / 100);
      expect(tops, kind).toHaveLength(6);
      for (let i = 1; i < tops.length; i += 1) expect(tops[i]! - tops[i - 1]!, `${kind} row ${i}`).toBeGreaterThanOrEqual(16);
      expect(height, kind).toBeLessThanOrEqual(180);
      expect(extent(canvasOf(container).querySelector('svg')!, false).y1, kind).toBeLessThanOrEqual(height + 0.5);
      unmount();
    }
  });

  it('keeps a wide heatmap and a many-category error-bar chart inside the box', async () => {
    const columns = Array.from({ length: 10 }, (_, i) => ({ id: `cat-${i}00`, label: `Day ${i + 1}` }));
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: `row-${i}`, label: `Habit ${i + 1}` }));
    const heat = await openWith('xy-heatmap', { categories: columns, rows, cells: rows.flatMap((row, r) => columns.map((col, c) => ({ row: row.id, col: col.id, value: r * 3 + c }))) });
    const wide = heightOf(heat.container);
    expect(wide).toBeLessThanOrEqual(180);
    expect(extent(canvasOf(heat.container).querySelector('svg')!, false).y1).toBeLessThanOrEqual(wide + 0.5);
    heat.unmount();
    const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `cat-${String(i).padStart(2, '0')}0`, label: `Week ${i + 1}` }));
    const bars = await openWith('error-bars', { categories: twelve, series: [line('Saved', twelve.map((_, i) => 20 + i * 3), { error: twelve.map(() => 2) })] });
    const tall = heightOf(bars.container);
    expect(tall).toBeLessThanOrEqual(180);
    expect(extent(canvasOf(bars.container).querySelector('svg')!, false).x1).toBeLessThanOrEqual(W + 0.5);
    bars.unmount();
  });

  it('measures how far the shown labels hang past the drawing and gives that room to the canvas, rounded up to the 4 px grid', async () => {
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.classList.contains('lf-chart-canvas')) return rect(0, 0, 320, 100);
      const host = this.closest('.lf-chart-canvas');
      const index = host ? [...host.querySelectorAll('.lf-chart-tag')].indexOf(this) : -1;
      if (index === 0) return rect(10, 95, 30, 16);
      if (index === 1) return rect(60, -8, 30, 16);
      return rect(110 + index * 40, 40, 30, 16);
    });
    const { container } = await open('dot-plot');
    const canvas = canvasOf(container);
    expect(canvas.style.getPropertyValue('--lf-chart-over-bottom')).toBe('12px');
    expect(canvas.style.getPropertyValue('--lf-chart-over-top')).toBe('8px');
    expect(canvas.dataset.labelsDropped).toBe('0');
  });

  it('leaves the margins of a canvas that is not measured yet to the stylesheet fallback', async () => {
    const { container } = await open('dot-plot');
    expect(canvasOf(container).style.getPropertyValue('--lf-chart-over-bottom')).toBe('');
  });
});
