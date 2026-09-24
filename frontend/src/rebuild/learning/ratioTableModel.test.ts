import { describe, expect, it } from 'vitest';
import { ratioTableRows } from './ratioTableModel';

const item = { itemsPerPack: 3, pricePerPack: 15, minimumPacks: 1, maximumPacks: 4, initialPacks: 2 };

describe('ratio table model', () => {
  it('keeps item count, total price and unit price linked to the same base ratio', () => {
    expect(ratioTableRows(item, 3)).toEqual([
      { packs: 1, items: 3, price: 15, unitPrice: 5 },
      { packs: 2, items: 6, price: 30, unitPrice: 5 },
      { packs: 3, items: 9, price: 45, unitPrice: 5 },
    ]);
  });

  it('rejects fractional or off-range authored ratios', () => {
    expect(ratioTableRows({ ...item, pricePerPack: 14 }, 2)).toBeNull();
    expect(ratioTableRows(item, 5)).toBeNull();
    expect(ratioTableRows({ ...item, maximumPacks: 9 }, 2)).toBeNull();
  });
});
