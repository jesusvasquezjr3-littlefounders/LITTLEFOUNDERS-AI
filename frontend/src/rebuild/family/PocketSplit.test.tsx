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
});
