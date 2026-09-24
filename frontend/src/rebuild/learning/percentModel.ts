export interface PercentScenario {
  baseUnits: number;
  step: number;
  initialPercent: number;
  mode: 'discount' | 'tax';
}

/** A pure, integer-valued model for a bounded percent exploration. */
export function percentOutcome(scenario: PercentScenario, percent: number): { change: number; final: number } | null {
  const { baseUnits, step, initialPercent, mode } = scenario;
  if (!Number.isSafeInteger(baseUnits) || baseUnits <= 0 || baseUnits > 1_000_000
    || !Number.isSafeInteger(step) || step <= 0 || step > 100 || 100 % step !== 0
    || baseUnits * step % 100 !== 0 || !Number.isSafeInteger(initialPercent) || initialPercent < 0
    || initialPercent > 100 || initialPercent % step !== 0 || !Number.isSafeInteger(percent)
    || percent < 0 || percent > 100 || percent % step !== 0 || (mode !== 'discount' && mode !== 'tax')) return null;
  const change = baseUnits * percent / 100;
  return { change, final: mode === 'discount' ? baseUnits - change : baseUnits + change };
}
