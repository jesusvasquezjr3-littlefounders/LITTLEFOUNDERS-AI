import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A mid-range device (8 cores, 4 GB, WebGL2): the renderer starts at the medium tier.
vi.mock('./quality', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quality')>();
  return {
    ...actual,
    getDeviceProbe: () => ({
      cores: 8, memoryGb: 4, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2' as const, maxTextureSize: 8192, prefersReducedMotion: false,
    }),
  };
});

import { useAdaptiveQuality } from './useAdaptiveQuality';

const frames = (onFrame: (delta: number) => void, delta: number, count: number) => act(() => {
  for (let n = 0; n < count; n++) onFrame(delta);
});

describe('useAdaptiveQuality measures the frames a device actually draws', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drops one long frame (the first frame, a tab coming back), so a capable device is not demoted', () => {
    const { result } = renderHook(() => useAdaptiveQuality());
    expect(result.current.settings.tier).toBe('medium');
    frames(result.current.onFrame, 12, 1);
    frames(result.current.onFrame, 1 / 60, 180);
    expect(result.current.settings.tier).toBe('medium');
    expect(result.current.fps).toBe(60);
  });

  it('counts a device that draws long frame after long frame, so a stage under 2 fps steps down to the low tier (08 §7)', () => {
    const { result } = renderHook(() => useAdaptiveQuality());
    // One frame a second: every frame is over 0.5 s. Dropping them all left the stage unmeasured at its first tier.
    frames(result.current.onFrame, 1, 4);
    expect(result.current.fps).toBe(1);
    expect(result.current.settings.tier).toBe('low');
  });
});
