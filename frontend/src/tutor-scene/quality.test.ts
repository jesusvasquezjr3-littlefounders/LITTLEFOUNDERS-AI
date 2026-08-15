import { describe, expect, it } from 'vitest';
import {
  lowerTier,
  pickInitialTier,
  QUALITY_SETTINGS,
  raiseTier,
  resolveSettings,
  type DeviceProbe,
} from './quality';

/** A capable desktop that answered every question. */
function probe(overrides: Partial<DeviceProbe> = {}): DeviceProbe {
  return {
    cores: 8,
    memoryGb: 16,
    coarsePointer: false,
    devicePixelRatio: 2,
    webgl: 'webgl2',
    maxTextureSize: 16384,
    prefersReducedMotion: false,
    ...overrides,
  };
}

describe('pickInitialTier', () => {
  it('gives a strong desktop the high tier', () => {
    expect(pickInitialTier(probe())).toBe('high');
  });

  /*
   * The defect this pins is the one /AGENTS.md §1.14 exists to prevent:
   * `deviceMemory` is Chromium-only and `hardwareConcurrency` can be withheld,
   * so treating "not reported" as a low number would silently push every
   * Safari and Firefox user onto the degraded tier. Absent is not zero.
   */
  it('does not punish a browser that withholds its specs', () => {
    expect(pickInitialTier(probe({ memoryGb: null }))).toBe('high');
    expect(pickInitialTier(probe({ cores: null, memoryGb: null }))).toBe('medium');
  });

  it('caps touch-primary devices at medium even with strong reported specs', () => {
    expect(pickInitialTier(probe({ coarsePointer: true, cores: 12, memoryGb: 16 }))).toBe('medium');
  });

  it('forces the floor on genuinely constrained hardware', () => {
    expect(pickInitialTier(probe({ cores: 2 }))).toBe('low');
    expect(pickInitialTier(probe({ memoryGb: 2 }))).toBe('low');
    expect(pickInitialTier(probe({ maxTextureSize: 2048 }))).toBe('low');
    expect(pickInitialTier(probe({ webgl: 'webgl1' }))).toBe('low');
    expect(pickInitialTier(probe({ webgl: 'none' }))).toBe('low');
  });

  it('treats an unknown max texture size as unknown, not as small', () => {
    expect(pickInitialTier(probe({ maxTextureSize: null }))).toBe('high');
  });
});

describe('tier ladder', () => {
  it('clamps at both ends instead of running off the array', () => {
    expect(lowerTier('low')).toBe('low');
    expect(raiseTier('high')).toBe('high');
    expect(lowerTier('high')).toBe('medium');
    expect(raiseTier('low')).toBe('medium');
  });
});

describe('resolveSettings', () => {
  it('passes tier settings through untouched by default', () => {
    expect(resolveSettings('high', false)).toEqual(QUALITY_SETTINGS.high);
  });

  /*
   * prefers-reduced-motion is an accessibility instruction, not a performance
   * signal — it must survive on the fastest device we have, and it must not be
   * confused with the ambientMotion the low tier disables for frame budget.
   */
  it('honours prefers-reduced-motion at every tier without changing the tier', () => {
    const high = resolveSettings('high', true);
    expect(high.ambientMotion).toBe(false);
    expect(high.tier).toBe('high');
    expect(high.shadows).toBe(true);
  });
});
