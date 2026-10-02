import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RebuildRoot } from '../../../design/controls';
import { checkCopy, type AgeBand, type Locale } from '../../../design/copyBudget';
import { planoWords } from './copy';
import { Plano, type PlanoProps } from './Plano';
import type { PlanoHandleLayer, PlanoPoint } from './model';

/*
 * F0.2: the Plano component. jsdom has no layout, so pointer tests give the plot a 600 by 400 box (one pixel per
 * viewBox unit) and read the points the plane asks for; the drawing itself is checked through the DOM it produces.
 */

const domain = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
const box = { left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

type BoardProps = Partial<PlanoProps> & { start?: PlanoPoint; handle?: Partial<PlanoHandleLayer>; locale?: 'en-US' | 'es-MX' | 'pt-BR'; onChange?: (id: string, point: PlanoPoint) => void };

function Board({ start = { x: 3, y: 4 }, handle, locale = 'en-US', onChange, ...rest }: BoardProps) {
  const [point, setPoint] = useState(start);
  const layers = { handles: [{ id: 'price', label: 'Price', ...point, ...handle }], ...rest.layers };
  return <RebuildRoot theme="light" locale={locale}>
    <Plano label="Price against weeks" domain={domain} snap={1} {...rest} layers={layers} onHandleChange={(id, next) => { onChange?.(id, next); setPoint(next); }} />
  </RebuildRoot>;
}

const plotOf = (container: HTMLElement) => container.querySelector('.lf-plano-plot') as HTMLDivElement;
const status = () => screen.getByRole('status').textContent;

describe('Plano drawing', () => {
  it('names the figure, writes its takeaway, hides the SVG and numbers the axes', () => {
    const { container } = render(<RebuildRoot theme="light" locale="en-US">
      <Plano label="Savings over time" summary="Savings grow by 2 each week." domain={domain} xLabel="Weeks" yLabel="Coins" layers={{ points: [{ id: 'a', x: 2, y: 4, label: 'Start' }] }} />
    </RebuildRoot>);
    const figure = screen.getByRole('figure', { name: 'Savings over time' });
    expect(within(figure).getByText('Savings grow by 2 each week.')).toBeInTheDocument();
    expect(figure.getAttribute('aria-describedby')).toBe(figure.querySelector('.lf-plano-summary')?.id);
    expect(container.querySelector('svg.lf-plano-svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg.lf-plano-svg')?.getAttribute('viewBox')).toBe('0 0 600 400');
    expect(container.querySelector('svg.lf-plano-svg')?.getAttribute('preserveAspectRatio')).toBe('none');
    expect([...container.querySelectorAll('.lf-plano-xaxis .lf-plano-tick')].map((node) => node.textContent)).toEqual(['0', '2', '4', '6', '8', '10']);
    expect([...container.querySelectorAll('.lf-plano-yaxis .lf-plano-tick')].map((node) => node.textContent)).toEqual(['0', '2', '4', '6', '8', '10']);
    expect(container.querySelector('.lf-plano-axis-name--x')?.textContent).toBe('Weeks');
    expect(container.querySelector('.lf-plano-axis-name--y')?.textContent).toBe('Coins');
    expect(container.querySelectorAll('line.lf-plano-grid')).toHaveLength(12);
    expect(container.querySelector('.lf-plano-point-label')?.textContent).toBe('Start');
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('puts a point where its value says, as a percentage of the plot, so it keeps its size at any width', () => {
    const { container } = render(<RebuildRoot theme="light" locale="en-US"><Plano label="Points" domain={domain} layers={{ points: [{ id: 'a', x: 2.5, y: 7.5 }] }} /></RebuildRoot>);
    const mark = container.querySelector('.lf-plano-point') as HTMLElement;
    expect(mark.style.insetInlineStart).toBe('25%');
    expect(mark.style.insetBlockStart).toBe('25%');
    expect((plotOf(container)).style.getPropertyValue('--plano-ratio')).toBe('600 / 400');
  });

  it('draws each series with a second channel: dash, pattern and shape, and a legend that names them', () => {
    const { container } = render(<RebuildRoot theme="light" locale="en-US">
      <Plano label="Two plans" domain={domain} layers={{
        polylines: [{ id: 'a', label: 'Plan A', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }, { id: 'b', label: 'Plan B', points: [{ x: 0, y: 10 }, { x: 10, y: 0 }] }],
        regions: [{ id: 'r', label: 'Safe', series: 2, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] }],
        points: [{ id: 'p', x: 1, y: 1, series: 3 }, { id: 'q', x: 2, y: 2, series: 2 }],
      }} />
    </RebuildRoot>);
    const lines = [...container.querySelectorAll('path.lf-plano-line')];
    expect(lines.map((node) => node.getAttribute('class'))).toEqual(['lf-plano-line lf-plano-series-1', 'lf-plano-line lf-plano-series-2']);
    expect(lines.map((node) => node.getAttribute('stroke-dasharray'))).toEqual([null, '10 6']);
    expect(lines[0]?.getAttribute('d')).toBe('M0,400L600,0');
    const region = container.querySelector('path.lf-plano-region') as SVGPathElement;
    const pattern = /fill:\s*url\(["']?#([^)"']+)["']?\)/.exec(region.getAttribute('style') ?? '')?.[1] ?? '';
    expect(pattern).toMatch(/^plano.+-2$/);
    expect(region.getAttribute('d')).toBe('M0,400L300,400L300,200Z');
    expect(container.querySelector(`pattern[id="${pattern}"]`)).not.toBeNull();
    const legend = screen.getByRole('list', { name: 'Two plans' });
    expect([...legend.querySelectorAll('li')].map((node) => node.textContent)).toEqual(['Plan A', 'Plan B', 'Safe']);
    expect([...container.querySelectorAll('.lf-plano-point')].map((node) => node.getAttribute('data-shape'))).toEqual(['diamond', 'square']);
  });

  it('keeps a single labelled layer out of the legend and unlabelled layers out of it too', () => {
    render(<RebuildRoot theme="light" locale="en-US"><Plano label="One line" domain={domain} layers={{ polylines: [{ id: 'a', label: 'Only', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, { id: 'b', points: [{ x: 0, y: 1 }, { x: 1, y: 0 }] }] }} /></RebuildRoot>);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('samples a curve from its callback and breaks the line at an asymptote', () => {
    const { container } = render(<RebuildRoot theme="light" locale="en-US">
      <Plano label="Reciprocal" domain={{ xMin: -10, xMax: 10, yMin: -10, yMax: 10 }} layers={{ curves: [{ id: 'c', fn: (x) => 1 / (x - 5) }, { id: 'd', fn: (x) => x * x, from: 0, to: 3 }] }} />
    </RebuildRoot>);
    const [reciprocal, square] = [...container.querySelectorAll('path.lf-plano-line')];
    expect((reciprocal?.getAttribute('d')?.match(/M/g) ?? []).length).toBe(2);
    const drawn = square?.getAttribute('d') ?? '';
    expect(drawn.startsWith('M300,')).toBe(true);
    expect(drawn.endsWith(`L${Math.round((13 / 20) * 600 * 100) / 100},${Math.round((1 - 19 / 20) * 400 * 100) / 100}`)).toBe(true);
  });

  it('draws the axes through zero, or along the edge when zero is outside the domain', () => {
    const { container, rerender } = render(<RebuildRoot theme="light" locale="en-US"><Plano label="Centred" domain={{ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }} /></RebuildRoot>);
    const at = () => [...container.querySelectorAll('line.lf-plano-axis')].map((node) => [node.getAttribute('x1'), node.getAttribute('y1')].join(','));
    expect(at()).toEqual(['0,200', '300,0']);
    rerender(<RebuildRoot theme="light" locale="en-US"><Plano label="Shifted" domain={{ xMin: 10, xMax: 20, yMin: 100, yMax: 200 }} /></RebuildRoot>);
    expect(at()).toEqual(['0,400', '0,0']);
  });

  it('writes numerals in the learner locale and borrows its words from the locale', () => {
    const { container } = render(<RebuildRoot theme="light" locale="pt-BR">
      <Plano label="Fracoes" domain={{ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }} tickStep={0.25} layers={{ points: [{ id: 'a', x: 0.5, y: 0.5 }] }} />
    </RebuildRoot>);
    expect([...container.querySelectorAll('.lf-plano-xaxis .lf-plano-tick')].map((node) => node.textContent)).toEqual(['0', '0,25', '0,5', '0,75', '1']);
    expect(screen.getByRole('button', { name: 'Ver como tabela' })).toBeInTheDocument();
  });

  it('keeps a point readable where the locale writes a decimal comma', () => {
    render(<Board locale="pt-BR" start={{ x: 2.5, y: 4 }} snap={0.5} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('x 2,5; y 4');
  });

  it('refuses a domain that cannot be drawn', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Plano label="Broken" domain={{ xMin: 5, xMax: 5, yMin: 0, yMax: 1 }} />)).toThrow(RangeError);
    quiet.mockRestore();
  });
});

describe('Plano handles by keyboard', () => {
  it('is one slider with the whole point in its value text, one tab stop, and a hint for keyboard users', () => {
    render(<Board />);
    const slider = screen.getByRole('slider', { name: 'Price' });
    expect(slider.getAttribute('aria-valuenow')).toBe('3');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('10');
    expect(slider.getAttribute('aria-valuetext')).toBe('x 3, y 4');
    expect(slider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(slider.getAttribute('tabindex')).toBe('0');
    expect(document.getElementById(slider.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Arrow keys move the point. Shift moves farther.');
    expect(document.querySelector('.lf-plano-readout')?.textContent).toBe('Price: x 3, y 4');
  });

  it('moves one step per arrow key and five with Shift, and says what it did', () => {
    const onChange = vi.fn();
    render(<Board onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 4, y: 4 });
    expect(status()).toBe('Price: x 4, y 4');
    fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 4, y: 9 });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 3, y: 8 });
    expect(slider.getAttribute('aria-valuetext')).toBe('x 3, y 8');
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('jumps to the limits with Home and End and says when a key can go no further', () => {
    const onChange = vi.fn();
    render(<Board onChange={onChange} start={{ x: 9, y: 10 }} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
    expect(status()).toBe('Price: x 9, y 10. Limit reached');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 10, y: 10 });
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 0, y: 10 });
  });

  it('snaps to the grid and keeps to the handle own bounds', () => {
    const onChange = vi.fn();
    render(<Board onChange={onChange} snap={2} start={{ x: 4, y: 4 }} handle={{ bounds: { xMax: 6 } }} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 6, y: 4 });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(status()).toBe('Price: x 6, y 4. Limit reached');
    expect(slider.getAttribute('aria-valuemax')).toBe('6');
  });

  it('runs a handle locked to one axis along that axis only, and names only that axis', () => {
    const onChange = vi.fn();
    render(<Board onChange={onChange} xLabel="Weeks" yLabel="Coins" handle={{ axis: 'y' }} />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-orientation')).toBe('vertical');
    expect(slider.getAttribute('aria-valuenow')).toBe('4');
    expect(slider.getAttribute('aria-valuetext')).toBe('Coins 4');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 3, y: 5 });
  });

  it('leaves keys with modifiers and other keys to the browser, and a disabled handle alone', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Board onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(fireEvent.keyDown(slider, { key: 'a' })).toBe(true);
    expect(fireEvent.keyDown(slider, { key: 'ArrowRight', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(slider, { key: 'ArrowRight' })).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<Board onChange={onChange} handle={{ disabled: true }} />);
    expect(screen.getByRole('slider').getAttribute('aria-disabled')).toBe('true');
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('picks another handle with Page Up and Page Down: one tab stop that follows the focus', () => {
    const onActiveChange = vi.fn();
    render(<RebuildRoot theme="light" locale="en-US">
      <Plano label="Two points" domain={domain} snap={1} onActiveChange={onActiveChange}
        layers={{ handles: [{ id: 'a', label: 'First', x: 1, y: 1 }, { id: 'b', label: 'Second', x: 8, y: 8 }, { id: 'c', label: 'Third', x: 5, y: 5, disabled: true }] }} />
    </RebuildRoot>);
    const [first, second] = [screen.getByRole('slider', { name: 'First' }), screen.getByRole('slider', { name: 'Second' })];
    expect([first, second, screen.getByRole('slider', { name: 'Third' })].map((node) => node.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(first.getAttribute('data-active')).toBe('true');
    expect(document.getElementById(first.getAttribute('aria-describedby') ?? '')?.textContent).toContain('Page Up and Page Down pick another point.');
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'PageDown' });
    expect(document.activeElement).toBe(second);
    expect([first, second].map((node) => node.getAttribute('tabindex'))).toEqual(['-1', '0']);
    expect(document.querySelector('.lf-plano-readout')?.textContent).toBe('Second: x 8, y 8');
    fireEvent.keyDown(second, { key: 'PageDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'PageUp' });
    expect(document.activeElement).toBe(second);
    expect(onActiveChange.mock.calls).toEqual([['b'], ['a'], ['b']]);
  });

  it('says nothing of switching when there is one handle, and of tapping unless taps place it', () => {
    const { rerender } = render(<Board />);
    const hint = () => screen.getByRole('figure').querySelector('.lf-visually-hidden')?.textContent;
    expect(hint()).not.toMatch(/Page Up|Tap/);
    rerender(<Board placeOnTap />);
    expect(hint()).toMatch(/Tap the graph to place the point\./);
  });
});

describe('Plano handles by pointer', () => {
  const hadPointer = 'PointerEvent' in window;
  beforeAll(() => {
    if (!hadPointer) {
      Object.defineProperty(window, 'PointerEvent', {
        configurable: true,
        value: class extends MouseEvent {
          pointerId: number; pointerType: string;
          constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse'; }
        },
      });
    }
  });
  afterAll(() => { if (!hadPointer) Reflect.deleteProperty(window, 'PointerEvent'); });

  it('drags a handle with the grab point kept, snapped to the grid, and announces where it landed', () => {
    const onChange = vi.fn();
    const { container } = render(<Board onChange={onChange} start={{ x: 2, y: 2 }} />);
    plotOf(container).getBoundingClientRect = () => box;
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { clientX: 130, clientY: 310, pointerId: 7 });
    expect(slider.getAttribute('data-dragging')).toBe('true');
    fireEvent.pointerMove(slider, { clientX: 310, clientY: 190, pointerId: 7 });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 5, y: 5 });
    fireEvent.pointerMove(slider, { clientX: 9999, clientY: -9999, pointerId: 7 });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 10, y: 10 });
    fireEvent.pointerUp(slider, { pointerId: 7 });
    expect(slider.getAttribute('data-dragging')).toBeNull();
    expect(status()).toBe('Price: x 10, y 10');
  });

  it('ignores another pointer, a move with no drag, and a drag on a disabled handle', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<Board onChange={onChange} start={{ x: 2, y: 2 }} />);
    plotOf(container).getBoundingClientRect = () => box;
    const slider = screen.getByRole('slider');
    fireEvent.pointerMove(slider, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerDown(slider, { clientX: 120, clientY: 320, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 300, clientY: 200, pointerId: 2 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerCancel(slider, { pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 300, clientY: 200, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<Board onChange={onChange} start={{ x: 2, y: 2 }} handle={{ disabled: true }} />);
    fireEvent.pointerDown(screen.getByRole('slider'), { clientX: 120, clientY: 320, pointerId: 3 });
    fireEvent.pointerMove(screen.getByRole('slider'), { clientX: 300, clientY: 200, pointerId: 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps an axis-locked handle on its axis while it is dragged', () => {
    const onChange = vi.fn();
    const { container } = render(<Board onChange={onChange} start={{ x: 2, y: 2 }} handle={{ axis: 'x' }} />);
    plotOf(container).getBoundingClientRect = () => box;
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { clientX: 120, clientY: 320, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 420, clientY: 40, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 7, y: 2 });
  });

  it('places the selected handle where the plane is tapped, snapped, and reports the tap', () => {
    const onChange = vi.fn();
    const onPlaneTap = vi.fn();
    const { container } = render(<Board onChange={onChange} placeOnTap onPlaneTap={onPlaneTap} start={{ x: 2, y: 2 }} />);
    const plot = plotOf(container);
    plot.getBoundingClientRect = () => box;
    expect(plot.getAttribute('data-tap')).toBe('true');
    fireEvent.click(plot, { clientX: 487, clientY: 118 });
    expect(onChange).toHaveBeenLastCalledWith('price', { x: 8, y: 7 });
    expect(onPlaneTap).toHaveBeenLastCalledWith({ x: 8, y: 7 });
    expect(status()).toBe('Price: x 8, y 7');
    fireEvent.click(screen.getByRole('slider'), { clientX: 10, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('takes no taps unless asked, and a tap before layout does nothing', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<Board onChange={onChange} />);
    expect(plotOf(container).getAttribute('data-tap')).toBeNull();
    fireEvent.click(plotOf(container), { clientX: 300, clientY: 200 });
    rerender(<Board onChange={onChange} placeOnTap />);
    fireEvent.click(plotOf(container), { clientX: 300, clientY: 200 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Plano as a table', () => {
  it('lists the same layers in a table, switches back, and hides the switch when there is nothing to list', () => {
    const { container } = render(<Board xLabel="Weeks" yLabel="Coins" layers={{ points: [{ id: 'start', label: 'Start', x: 0, y: 1.5 }], curves: [{ id: 'c', label: 'Growth', fn: (x) => x * 2, from: 0, to: 4 }] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(container.querySelector('.lf-plano-plot')).toBeNull();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Price against weeks')).toBeInTheDocument();
    const cells = [...table.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('.lf-table-value')].map((cell) => cell.textContent));
    expect(cells).toEqual([
      ['Price', '3', '4'], ['Start', '0', '1.5'],
      ['Growth 1', '0', '0'], ['Growth 2', '2', '4'], ['Growth 3', '4', '8'],
    ]);
    expect(within(table).getAllByText('Coins').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Show graph' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelector('.lf-plano-plot')).not.toBeNull();
  });

  it('has no switch for an empty plane', () => {
    render(<RebuildRoot theme="light" locale="en-US"><Plano label="Empty" domain={domain} /></RebuildRoot>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Plano copy', () => {
  it('fits the Copy Budget of its roles in every locale and age band', () => {
    const issues: string[] = [];
    for (const locale of (['en-US', 'es-MX', 'pt-BR'] as Locale[])) {
      for (const ageBand of ['6-9', '10-12', '13-17', 'adult'] as AgeBand[]) {
        const context = { locale, ageBand, surface: 'app' } as const;
        const words = planoWords(locale);
        for (const [role, text] of [['action', words.table], ['action', words.chart], ['body', words.keys], ['body', words.switchKeys], ['body', words.tap]] as const) {
          for (const issue of checkCopy(text, role, context)) issues.push(`${locale} ${ageBand} ${text}: ${issue}`);
        }
      }
    }
    expect(issues).toEqual([]);
  });
});

describe('Plano stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/rebuild/learning/horizonte/plano/plano.css'), 'utf8');
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('gives a handle the 64 px target and draws no motion outside the no-preference query', () => {
    expect(withoutComments).toMatch(/\.lf-plano-handle \{[^}]*inline-size: var\(--target-lg\); block-size: var\(--target-lg\)/);
    const motion = withoutComments.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(motion).toMatch(/transition/);
    expect(withoutComments.replace(motion, '')).not.toMatch(/transition|animation/);
    expect(withoutComments).not.toMatch(/ease-spring|dur-celebration/);
  });

  it('scales with the viewBox ratio and uses tokens rather than raw colours', () => {
    expect(withoutComments).toMatch(/aspect-ratio: var\(--plano-ratio/);
    expect(withoutComments).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
