export interface GrowthItem {
  periods: number;
  minimum: number;
  maximum: number;
  step: number;
  initial: number;
}

export interface GrowthPoint { period: number; balance: number }

export function growthTimeline(item: GrowthItem, contribution: number): GrowthPoint[] | null {
  const values = [item.periods, item.minimum, item.maximum, item.step, item.initial, contribution];
  if (values.some((value) => !Number.isSafeInteger(value))) return null;
  if (item.periods < 1 || item.periods > 24 || item.minimum < 0 || item.step < 1 || item.maximum < item.minimum) return null;
  if ((item.maximum - item.minimum) % item.step !== 0 || (item.initial - item.minimum) % item.step !== 0) return null;
  if (item.initial < item.minimum || item.initial > item.maximum || contribution < item.minimum || contribution > item.maximum || (contribution - item.minimum) % item.step !== 0) return null;
  if (!Number.isSafeInteger(item.maximum * item.periods)) return null;
  return Array.from({ length: item.periods + 1 }, (_, period) => ({ period, balance: contribution * period }));
}
