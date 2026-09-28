import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BeforeAfter, DragPoint, GhostTracePlot, GuidedSandbox, ReactiveText, ThresholdPlot, TradeOffChooser, useGhost, WhatIfBranch } from './operations';
import { canPick, polyline, stepValue, thresholdIndex, tokensLeft, valueAt } from './operationsModel';

/*
 * GAP-FIX-R1 learning (Appendix A Part 2; B.7 part 2): the eight interaction
 * primitives the first release lacked (5, 7, 8, 10, 11, 12, 14, 15) and the
 * drag point they share. Every action has a tap and keyboard path, and the
 * primitive states what changed in a live region.
 */

describe('primitive models', () => {
  it('finds a threshold, spends tokens, steps on the grid and scales a line', () => {
    expect(thresholdIndex([1, 2, 4, 8], 4)).toBe(2);
    expect(thresholdIndex([1, 2], 4)).toBe(-1);
    const options = [{ id: 'a', cost: 2 }, { id: 'b', cost: 2 }, { id: 'c', cost: 1 }];
    expect(tokensLeft(options, ['a'], 3)).toBe(1);
    expect(canPick(options[1]!, options, ['a'], 3)).toBe(false);
    expect(canPick(options[2]!, options, ['a'], 3)).toBe(true);
    expect(stepValue(3, 1, 0, 4, 2)).toBe(4);
    expect(stepValue(0, -1, 0, 4, 2)).toBe(0);
    expect(valueAt(50, 100, 0, 10, 1)).toBe(5);
    expect(valueAt(50, 100, 0, 10, 1, true)).toBe(5);
    expect(polyline([0, 10], 100, 50, 10)).toBe('0,50 100,0');
  });
});

describe('interaction primitives', () => {
  it('what-if branching shows every branch side by side and marks the chosen one', () => {
    const onChoose = vi.fn();
    render(<WhatIfBranch legend="Plan" chosen="a" onChoose={onChoose} branches={[{ id: 'a', label: 'Plan A' }, { id: 'b', label: 'Plan B' }]} render={(id) => <p>{`result ${id}`}</p>} />);
    expect(screen.getByText('result a')).toBeTruthy();
    expect(screen.getByText('result b')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Plan A' }).getAttribute('data-chosen')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Plan B' }));
    expect(onChoose).toHaveBeenCalledWith('b');
  });

  it('before/after swaps two states with one switch', () => {
    function Harness() { const [on, setOn] = useState(false); return <BeforeAfter label="Later" stateLabels={{ on: 'In 10 years', off: 'Today' }} value={on} onChange={setOn} before={<p>100</p>} after={<p>134</p>} />; }
    render(<Harness />);
    expect(screen.getByText('100')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Later' }));
    expect(screen.getByText('134')).toBeTruthy();
  });

  it('a guided sandbox shows only the cues the exploration has earned', () => {
    render(<GuidedSandbox cues={[{ id: 'a', text: 'Cups were left.', active: true }, { id: 'b', text: 'Sold out.', active: false }]}><p>board</p></GuidedSandbox>);
    expect(screen.getByText('Cups were left.')).toBeTruthy();
    expect(screen.queryByText('Sold out.')).toBeNull();
  });

  it('a threshold marker appears exactly where the series first reaches the line, and only once revealed', () => {
    const labels = { threshold: 'Double', crossed: (n: number) => `Doubles in year ${n}`, notYet: 'Not yet' };
    const { rerender, container } = render(<ThresholdPlot values={[100, 150, 210]} threshold={200} max={210} revealed={false} title="Growth" labels={labels} />);
    expect(container.querySelector('.lf-op-flag')).toBeNull();
    rerender(<ThresholdPlot values={[100, 150, 210]} threshold={200} max={210} revealed title="Growth" labels={labels} />);
    expect(container.querySelector('.lf-op-flag')).toBeTruthy();
    expect(screen.getByText('Doubles in year 2')).toBeTruthy();
  });

  it('a trade-off chooser spends tokens, blocks what no longer fits and shows what was given up', () => {
    function Harness() {
      const [picked, setPicked] = useState<string[]>([]);
      return <TradeOffChooser legend="Pick" tokens={3} picked={picked} onChange={setPicked} options={[{ id: 'movie', label: 'Movie', cost: 2 }, { id: 'game', label: 'Game', cost: 2 }, { id: 'book', label: 'Book', cost: 1 }]}
        labels={{ left: (n) => `${n} left`, cost: (n) => `${n} tokens`, gaveUp: 'Given up' }} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Movie · 2 tokens' }));
    expect(screen.getByText('1 left')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Game · 2 tokens' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Book · 1 tokens' }));
    expect(screen.getByRole('heading', { name: 'Given up' })).toBeTruthy();
    expect(screen.getByText('Game')).toBeTruthy();
  });

  it('a drag point moves with the arrow keys on its grid', () => {
    const onChange = vi.fn();
    render(<svg viewBox="0 0 100 100"><DragPoint x={10} y={10} value={0} min={-2} max={2} axis="y" length={40} label="Move demand" valueText="0 steps" onChange={onChange} /></svg>);
    const slider = screen.getByRole('slider', { name: 'Move demand' });
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(-1);
  });

  it('reactive text turns numbers in a sentence into controls', () => {
    const onChange = vi.fn();
    render(<ReactiveText labels={{ decrease: 'Less', increase: 'More' }} onChange={onChange} result="134 coins"
      parts={['If prices rise', { id: 'rate', value: 3, min: 1, max: 10, step: 1, label: 'Rate', text: '3%' }, 'a year']} />);
    expect(screen.getByText('134 coins')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]!);
    expect(onChange).toHaveBeenCalledWith('rate', 4);
  });

  it('a ghost trace keeps the previous run under the current one', () => {
    function Harness() {
      const [key, setKey] = useState('a');
      const run = key === 'a' ? [10, 5, 0] : [10, 8, 4, 0];
      const ghost = useGhost(key, run);
      return <><button onClick={() => setKey('b')}>switch</button>
        <GhostTracePlot current={run} ghost={ghost} max={10} count={4} title="Debt" labels={{ current: 'This plan', ghost: 'Last plan', summary: `ghost ${ghost ? ghost.length : 0}` }} /></>;
    }
    render(<Harness />);
    expect(screen.queryByText('Last plan')).toBeNull();
    fireEvent.click(screen.getByText('switch'));
    expect(screen.getByText('Last plan')).toBeTruthy();
    expect(screen.getByText('ghost 3')).toBeTruthy();
  });
});
