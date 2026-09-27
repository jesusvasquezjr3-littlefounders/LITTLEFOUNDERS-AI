import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart, niceMax, RebuildRoot, Sparkline, TrendChart, type VizLabels } from './controls';

/*
 * W2T.3: the shared chart primitives (Frontend Bible 05 §2, §5, §6). A chart is
 * named and described in words, read point by point from the keyboard, and
 * always has Show as table; the SVG itself is a picture the assistive layer
 * never has to parse.
 */

const labels: VizLabels = { table: 'Show as table', chart: 'Show chart', point: 'Day', missing: 'Not measured', keys: 'Arrow keys read each point.' };
const points = [{ key: 'd1', label: 'Sep 1' }, { key: 'd2', label: 'Sep 2' }, { key: 'd3', label: 'Sep 3' }];
const nf = (value: number) => new Intl.NumberFormat('en-US').format(value);

function trend(extra: Partial<Parameters<typeof TrendChart>[0]> = {}) {
  return render(<RebuildRoot theme="light" locale="en-US"><TrendChart label="Line chart of daily visitors" summary="Visitors rose by 4." points={points}
    series={[{ id: 'visitors', label: 'Visitors', values: [2, null, 6] }]} format={nf} labels={labels} {...extra} /></RebuildRoot>);
}

describe('chart primitives (W2T.3)', () => {
  it('names the figure, writes its takeaway, hides the SVG and reads the latest point by default', () => {
    trend();
    const figure = screen.getByRole('figure', { name: 'Line chart of daily visitors' });
    expect(within(figure).getByText('Visitors rose by 4.')).toBeInTheDocument();
    expect(figure.querySelector('svg.lf-viz-svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(figure.querySelector('.lf-viz-readout')?.textContent).toBe('Sep 3: 6');
    const plot = screen.getByRole('group', { name: 'Line chart of daily visitors. Arrow keys read each point.' });
    expect(plot.getAttribute('tabindex')).toBe('0');
    // A missing value breaks the line instead of drawing a zero.
    expect(figure.querySelectorAll('path.lf-viz-line')).toHaveLength(2);
  });

  it('steps through the points with the arrow keys, Home and End, and names a gap in words', () => {
    trend();
    const plot = screen.getByRole('group');
    const readout = () => document.querySelector('.lf-viz-readout')?.textContent;
    fireEvent.keyDown(plot, { key: 'ArrowLeft' });
    expect(readout()).toBe('Sep 2: Not measured');
    fireEvent.keyDown(plot, { key: 'Home' });
    expect(readout()).toBe('Sep 1: 2');
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    fireEvent.keyDown(plot, { key: 'End' });
    expect(readout()).toBe('Sep 3: 6');
    expect(document.querySelector('.lf-viz-readout')?.getAttribute('aria-live')).toBe('polite');
  });

  it('shows the same figures as a table and back', () => {
    trend();
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Line chart of daily visitors' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('Not measured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show chart' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Show chart' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('gives the second and third series a second channel and a legend, and a reference rule its value', () => {
    trend({ series: [{ id: 'a', label: 'Page views', values: [1, 2, 3] }, { id: 'b', label: '7-day average', values: [null, 2, 2] }, { id: 'c', label: 'Visits', values: [1, 1, 1] }],
      reference: { label: 'Average', value: 2 } });
    const legend = screen.getByRole('list', { name: 'Line chart of daily visitors' });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Page views', '7-day average', 'Visits', 'Average: 2']);
    const lines = [...document.querySelectorAll('path.lf-viz-line')];
    expect(lines[0]!.getAttribute('stroke-dasharray')).toBeNull();
    expect(lines.slice(1).map((line) => line.getAttribute('stroke-dasharray'))).toEqual(['10 6', '2 6']);
    expect(document.querySelector('.lf-viz-readout')?.textContent).toBe('Sep 3: Page views 3 · 7-day average 2 · Visits 1');
  });

  it('stacks columns on one scale with patterned parts', () => {
    trend({ kind: 'columns', stacked: true, series: [{ id: 'a', label: 'Anonymous', values: [1, 2, 3] }, { id: 'b', label: 'Staff', values: [4, 4, 4] }] });
    expect(document.querySelectorAll('rect.lf-viz-column')).toHaveLength(6);
    // The pattern is inline paint: a class rule would otherwise repaint the part in the flat hue.
    expect((document.querySelector('rect.lf-viz-series-2') as SVGRectElement).style.fill).toMatch(/^url\(/);
    expect(document.querySelector('.lf-viz-scale')?.textContent).toBe('10');
  });

  it('draws nothing for an empty series list and offers no table toggle', () => {
    trend({ points: [] });
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('writes every bar value as text on a shared scale', () => {
    render(<RebuildRoot theme="light" locale="en-US"><BarChart label="Visitors by device" max={10}
      rows={[{ id: 'm', label: 'Mobile', value: 5, valueText: '5 · 50%' }, { id: 'd', label: 'Desktop', value: 20, valueText: '20' }]} /></RebuildRoot>);
    const list = screen.getByRole('list', { name: 'Visitors by device' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Mobile5 · 50%', 'Desktop20']);
    const fills = [...list.querySelectorAll<HTMLElement>('.lf-viz-bar-fill')].map((fill) => fill.style.inlineSize);
    expect(fills).toEqual(['50%', '100%']);
  });

  it('names a sparkline in words and rounds the scale to a number people use', () => {
    render(<Sparkline label="Visitors, 3 to 9, peak 9" values={[3, 5, 9]} />);
    expect(screen.getByRole('img', { name: 'Visitors, 3 to 9, peak 9' })).toBeInTheDocument();
    expect([niceMax(0), niceMax(7), niceMax(11), niceMax(240), niceMax(2600)]).toEqual([1, 10, 20, 250, 5000]);
  });
});
