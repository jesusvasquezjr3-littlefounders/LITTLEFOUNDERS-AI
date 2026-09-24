import { describe, expect, it } from 'vitest';
import { ageWithinBounds } from '../services/experiments.js';

/*
 * H.7: age-based experiment eligibility. An unbounded experiment accepts
 * anyone, including an unknown age; a bounded experiment never assigns or
 * exposes an unknown or out-of-range age — eligibility cannot be guessed.
 */

describe('ageWithinBounds (H.7)', () => {
  it('accepts any age for an unbounded experiment', () => {
    expect(ageWithinBounds(null, null, null)).toBe(true);
    expect(ageWithinBounds(9, null, null)).toBe(true);
  });

  it('accepts an age inside both bounds', () => {
    expect(ageWithinBounds(9, 6, 12)).toBe(true);
    expect(ageWithinBounds(6, 6, null)).toBe(true);
    expect(ageWithinBounds(12, null, 12)).toBe(true);
  });

  it('refuses an unknown age for a bounded experiment', () => {
    expect(ageWithinBounds(null, 6, 12)).toBe(false);
    expect(ageWithinBounds(undefined, 6, null)).toBe(false);
  });

  it('refuses an out-of-range age', () => {
    expect(ageWithinBounds(5, 6, 12)).toBe(false);
    expect(ageWithinBounds(13, 6, 12)).toBe(false);
  });
});
