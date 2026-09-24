import { inspectAllocation, type Allocation, type AllocationItem } from './allocationModel';

const contract = 'lf-allocation/1';

export function decodeAllocationCheckpoint(raw: string | null, lessonId: string, contentVersion: string | number, item: AllocationItem): Allocation | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (record.contract !== contract || record.lessonId !== lessonId || record.contentVersion !== contentVersion) return null;
    const allocation = record.allocation;
    if (!allocation || typeof allocation !== 'object') return null;
    const answer = allocation as Allocation;
    return inspectAllocation(item, answer) === 'invalid' ? null : { save: answer.save, spend: answer.spend, share: answer.share };
  } catch {
    return null;
  }
}

export function encodeAllocationCheckpoint(lessonId: string, contentVersion: string | number, allocation: Allocation): string {
  return JSON.stringify({ contract, lessonId, contentVersion, allocation });
}
