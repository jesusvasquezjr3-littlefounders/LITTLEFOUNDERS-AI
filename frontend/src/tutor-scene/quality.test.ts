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

  /*
   * The blur is a MOTION-independent performance decision, and the two are
   * easy to conflate because `ambientMotion` sits next to it and is not. A
   * learner who asked for less movement did not ask for a flatter material.
   */
  it('does not take the HUD blur away for prefers-reduced-motion', () => {
    expect(resolveSettings('high', true).lumenBlur).toBe(true);
    expect(resolveSettings('medium', true).lumenBlur).toBe(true);
  });
});

/*
 * The HUD's `backdrop-filter` is the only setting in the tier that costs the
 * COMPOSITOR rather than the renderer, so it is the only one applied outside
 * three.js — `StageShell` publishes it as an attribute and `index.css` reads
 * it. That split is exactly the kind that drifts, so the tier's half is pinned
 * here and the stylesheet's half in `HudPlate.test.tsx`.
 *
 * Profiled 2026-08-22 (/DESIGN.md §Lumen → The blur, profiled): flat against
 * radius and against blurred area, so there is no cheaper middle setting to
 * offer and the lever is binary — which is why this asserts a boolean ladder
 * with exactly one step in it rather than a scale.
 */
describe('the HUD material on the tier ladder', () => {
  it('keeps the blur wherever the device has shown it can hold a frame', () => {
    expect(QUALITY_SETTINGS.high.lumenBlur).toBe(true);
    expect(QUALITY_SETTINGS.medium.lumenBlur).toBe(true);
  });

  it('takes it away only at the floor, where the device has twice proved it cannot', () => {
    expect(QUALITY_SETTINGS.low.lumenBlur).toBe(false);
  });
});
