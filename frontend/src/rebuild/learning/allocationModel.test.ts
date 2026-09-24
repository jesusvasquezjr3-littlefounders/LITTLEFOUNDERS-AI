import { describe, expect, it } from 'vitest';
import { changeAllocation, inspectAllocation, reallocateBoundary, remaining, type AllocationItem } from './allocationModel';

const item: AllocationItem = { total: 12, step: 1, minimumSave: 4 };

describe('allocation interaction', () => {
  it('conserves the issued amount as controls are used', () => {
    let value = { save: 0, spend: 0, share: 0 };
    for (let i = 0; i < 4; i++) value = changeAllocation(item, value, 'save', 1);
    for (let i = 0; i < 8; i++) value = changeAllocation(item, value, 'spend', 1);
    expect(remaining(item, value)).toBe(0);
    expect(changeAllocation(item, value, 'share', 1)).toEqual(value);
    expect(inspectAllocation(item, value)).toBe('met');
  });

  it('does not grade incomplete, overspent or off-grid submissions as success', () => {
    expect(inspectAllocation(item, { save: 4, spend: 0, share: 0 })).toBe('incomplete');
    expect(inspectAllocation(item, { save: 4, spend: 9, share: 0 })).toBe('invalid');
    expect(inspectAllocation({ total: 100, step: 10, minimumSave: 20 }, { save: 25, spend: 75, share: 0 })).toBe('invalid');
    expect(inspectAllocation(item, { save: 3, spend: 9, share: 0 })).toBe('review');
  });

  it('moves a dragged boundary only between adjacent pockets and preserves the total', () => {
    const start = { save: 4, spend: 6, share: 2 };
    expect(reallocateBoundary(item, start, 'save-spend', 7)).toEqual({ save: 7, spend: 3, share: 2 });
    expect(reallocateBoundary(item, start, 'spend-share', 11)).toEqual({ save: 4, spend: 7, share: 1 });
    expect(reallocateBoundary(item, start, 'save-spend', 11)).toBe(start);
    expect(reallocateBoundary(item, start, 'spend-share', 3)).toBe(start);
    expect(reallocateBoundary(item, { save: 4, spend: 0, share: 0 }, 'save-spend', 3)).toEqual({ save: 4, spend: 0, share: 0 });
  });
});
