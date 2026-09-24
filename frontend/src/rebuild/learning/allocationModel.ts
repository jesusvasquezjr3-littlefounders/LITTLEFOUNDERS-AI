export type Pocket = 'save' | 'spend' | 'share';
export type Allocation = Record<Pocket, number>;

export interface AllocationItem {
  total: number;
  step: number;
  minimumSave: number;
}

export function remaining(item: AllocationItem, value: Allocation): number {
  return item.total - value.save - value.spend - value.share;
}

export function changeAllocation(item: AllocationItem, value: Allocation, pocket: Pocket, direction: -1 | 1): Allocation {
  const next = value[pocket] + direction * item.step;
  if (next < 0 || next > item.total || next % item.step !== 0) return value;
  if (direction > 0 && remaining(item, value) < item.step) return value;
  return { ...value, [pocket]: next };
}

/** Move a boundary between adjacent pockets without creating or losing any money. */
export function reallocateBoundary(item: AllocationItem, value: Allocation, boundary: 'save-spend' | 'spend-share', cumulative: number): Allocation {
  if (inspectAllocation(item, value) === 'invalid' || remaining(item, value) !== 0) return value;
  if (!Number.isSafeInteger(cumulative) || cumulative % item.step !== 0) return value;
  if (boundary === 'save-spend') {
    if (cumulative < 0 || cumulative > value.save + value.spend) return value;
    return { ...value, save: cumulative, spend: value.save + value.spend - cumulative };
  }
  if (cumulative < value.save || cumulative > item.total) return value;
  return { ...value, spend: cumulative - value.save, share: item.total - cumulative };
}

export type AllocationVerdict = 'invalid' | 'incomplete' | 'review' | 'met';

/** Pure interaction model. The production scorer is server-authoritative (Appendix P Part 7). */
export function inspectAllocation(item: AllocationItem, value: Allocation): AllocationVerdict {
  if (!Number.isSafeInteger(item.total) || !Number.isSafeInteger(item.step) || item.total <= 0 || item.step <= 0 || item.total % item.step !== 0) return 'invalid';
  if (!Number.isSafeInteger(item.minimumSave) || item.minimumSave < 0 || item.minimumSave > item.total) return 'invalid';
  if ((['save', 'spend', 'share'] as const).some((pocket) => !Number.isSafeInteger(value[pocket]) || value[pocket] < 0 || value[pocket] % item.step !== 0)) return 'invalid';
  const left = remaining(item, value);
  if (left < 0) return 'invalid';
  if (left > 0) return 'incomplete';
  return value.save >= item.minimumSave ? 'met' : 'review';
}
