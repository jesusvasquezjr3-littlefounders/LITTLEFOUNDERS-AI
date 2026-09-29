import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PocketSplit } from './PocketSplit';

/*
 * Frontend Bible 05 §7 Money row (GAP-FIX-R1): the lesson's Save/Spend/Share
 * board reuses the Wallet's own pocket rows. Both Wallet surfaces and the
 * lesson board render this one component; none keeps its own pocket markup.
 */

const labels = { save: 'Save', spend: 'Spend', share: 'Share' };
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

describe('the shared pocket split', () => {
  it('is the only pocket-row implementation: the Wallet chooser, the usual split and the lesson board all use it', () => {
    for (const file of ['SplitChooser.tsx', 'UsualSplit.tsx', '../learning/AllocationBoard.tsx']) {
      const source = readFileSync(path.join(here, file), 'utf8');
      expect(source, file).toMatch(/import \{ PocketSplit \} from '(\.\/|\.\.\/family\/)PocketSplit'/);
      expect(source, file).toMatch(/<PocketSplit /);
      expect(source, file).not.toMatch(/className="lf-money-habits-pockets"/);
    }
  });

  it('steps a pocket within its bound and shows the remaining line', () => {
    const onChange = vi.fn();
    render(<PocketSplit mode="stepper" labels={labels} values={{ save: 2, spend: 1, share: 0 }} max={(b) => ({ save: 3, spend: 2, share: 1 })[b]}
      stepLabels={() => ({ decrease: 'Less', increase: 'More' })} onChange={onChange} remaining="1 coin left" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save: More' }));
    expect(onChange).toHaveBeenCalledWith('save', 3);
    expect(screen.getByText('1 coin left')).toBeTruthy();
    expect(document.querySelectorAll('[data-pocket]')).toHaveLength(3);
  });

  it('types a count up to the payout and keeps −/+ beside it', () => {
    const onChange = vi.fn();
    render(<PocketSplit mode="typed" labels={labels} values={{ save: 0, spend: 0, share: 0 }} max={() => 10} typedMax={10}
      stepLabels={(b) => ({ decrease: `Less ${b}`, increase: `More ${b}` })} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Spend'), { target: { value: '25' } });
    expect(onChange).toHaveBeenLastCalledWith('spend', 10);
    fireEvent.click(screen.getByRole('button', { name: 'More share' }));
    expect(onChange).toHaveBeenLastCalledWith('share', 1);
  });

  // GAP-FIX-R4 (Frontend Bible 02 §4.3): colour, icon and label at once, and the split bar under the rows.
  for (const mode of ['stepper', 'typed', 'readonly'] as const) {
    it(`marks each pocket with its own icon in ${mode} mode`, () => {
      render(<PocketSplit mode={mode} labels={labels} values={{ save: 5, spend: 4, share: 1 }} max={() => 10}
        stepLabels={() => ({ decrease: 'Less', increase: 'More' })} onChange={vi.fn()} />);
      for (const pocket of ['save', 'spend', 'share']) {
        const row = document.querySelector(`[data-pocket="${pocket}"]`)!;
        expect(row.querySelector(`img[data-asset-id="pocket.${pocket}.icon"]`)).not.toBeNull();
        expect(row.textContent).toContain(labels[pocket as keyof typeof labels]);
      }
    });
  }

  it('draws the split bar: three decorative segments sized by the counts, plus the unplaced rest', () => {
    const { rerender } = render(<PocketSplit mode="typed" labels={labels} values={{ save: 5, spend: 4, share: 1 }} max={() => 10} total={10}
      stepLabels={() => ({ decrease: 'Less', increase: 'More' })} onChange={vi.fn()} />);
    const bar = document.querySelector('[data-split-bar]') as HTMLElement;
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    const parts = () => [...bar.querySelectorAll<HTMLElement>('[data-split-segment]')].map((s) => [s.dataset.splitSegment, s.style.flexGrow, s.dataset.empty ?? '']);
    expect(parts()).toEqual([['save', '5', ''], ['spend', '4', ''], ['share', '1', '']]);
    rerender(<PocketSplit mode="typed" labels={labels} values={{ save: 7, spend: 0, share: 1 }} max={() => 10} total={10}
      stepLabels={() => ({ decrease: 'Less', increase: 'More' })} onChange={vi.fn()} />);
    expect(parts()).toEqual([['save', '7', ''], ['spend', '0', 'true'], ['share', '1', ''], ['left', '2', '']]);
  });

  it('leaves the bar out where the caller draws its own teaching chart (the lesson board)', () => {
    render(<PocketSplit mode="stepper" bar={false} labels={labels} values={{ save: 1, spend: 1, share: 1 }} max={() => 3}
      stepLabels={() => ({ decrease: 'Less', increase: 'More' })} onChange={vi.fn()} />);
    expect(document.querySelector('[data-split-bar]')).toBeNull();
  });
});
