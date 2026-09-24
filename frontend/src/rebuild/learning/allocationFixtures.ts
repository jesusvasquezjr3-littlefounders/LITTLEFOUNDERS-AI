import type { AgeBand } from '../design/copyBudget';
import type { AllocationItem } from './allocationModel';

export type LearningFixture = {
  id: string;
  contentVersion: number;
  item: AllocationItem;
  currency: 'coins' | 'local';
  titleKey: 'young' | 'tween' | 'teen' | 'adult';
};

/** Controlled design fixtures, never published lesson or answer-key data. */
export const learningFixtures: Record<AgeBand, LearningFixture> = {
  '6-9': { id: 'pilot-allocation-young', contentVersion: 1, item: { total: 12, step: 1, minimumSave: 4 }, currency: 'coins', titleKey: 'young' },
  '10-12': { id: 'pilot-allocation-tween', contentVersion: 1, item: { total: 60, step: 5, minimumSave: 20 }, currency: 'coins', titleKey: 'tween' },
  '13-17': { id: 'pilot-allocation-teen', contentVersion: 1, item: { total: 300, step: 25, minimumSave: 100 }, currency: 'coins', titleKey: 'teen' },
  adult: { id: 'pilot-allocation-adult', contentVersion: 1, item: { total: 1200, step: 100, minimumSave: 400 }, currency: 'local', titleKey: 'adult' },
};
