import { describe, expect, it } from 'vitest';
import { runningLedger } from './runningLedgerModel';

describe('running ledger model', () => {
  it('preserves every signed movement and visibly crosses zero in both directions', () => {
    const snapshot = runningLedger(3, [
      { id: 'cost-1', amount: -5 }, { id: 'sale-1', amount: 4 }, { id: 'sale-2', amount: 4 },
    ]);
    expect(snapshot?.rows.map((row) => row.balance)).toEqual([-2, 2, 6]);
    expect(snapshot).toMatchObject({ balance: 6, minimum: -2, maximum: 6 });
  });

  it('rejects ambiguous or unsafe ledger states instead of silently correcting them', () => {
    expect(runningLedger(3.5, [])).toBeNull();
    expect(runningLedger(0, [{ id: 'sale-1', amount: 0 }])).toBeNull();
    expect(runningLedger(0, [{ id: 'sale-1', amount: 1 }, { id: 'sale-1', amount: 2 }])).toBeNull();
    expect(runningLedger(999_999, [{ id: 'sale-1', amount: 2 }])).toBeNull();
    expect(runningLedger(0, [{ id: 'sale-1', amount: 1 }, { id: 'sale-2', amount: 1 }], 1)).toBeNull();
  });
});
