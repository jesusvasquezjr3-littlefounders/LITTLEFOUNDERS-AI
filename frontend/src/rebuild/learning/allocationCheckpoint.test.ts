import { describe, expect, it } from 'vitest';
import { decodeAllocationCheckpoint, encodeAllocationCheckpoint } from './allocationCheckpoint';

const item = { total: 12, step: 1, minimumSave: 4 };

describe('allocation checkpoint', () => {
  it('restores only the same lesson version and a valid conserved state', () => {
    const saved = encodeAllocationCheckpoint('lesson-1', 3, { save: 4, spend: 5, share: 3 });
    expect(decodeAllocationCheckpoint(saved, 'lesson-1', 3, item)).toEqual({ save: 4, spend: 5, share: 3 });
    expect(decodeAllocationCheckpoint(saved, 'lesson-1', 4, item)).toBeNull();
    expect(decodeAllocationCheckpoint(saved, 'lesson-2', 3, item)).toBeNull();
  });

  it('rejects broken or impossible local state before resuming', () => {
    expect(decodeAllocationCheckpoint('{', 'lesson-1', 3, item)).toBeNull();
    expect(decodeAllocationCheckpoint(encodeAllocationCheckpoint('lesson-1', 3, { save: 13, spend: 0, share: 0 }), 'lesson-1', 3, item)).toBeNull();
  });
});
