import { describe, expect, it } from 'vitest';
import { decideStageMode, FIRST_RENDER_BUDGET_MS, FRAME_RATE_FLOOR, FRAME_RATE_STRIKES, frameRateStrikes, type StageEnvironment } from '../stageMode';

const capable: StageEnvironment = { webgl: true, lowPower: false, saveData: false, reducedMotion: false };

describe('Mentor stage render mode (Frontend Bible 08 §7)', () => {
  it('keeps the budgets 08 §7 sets', () => {
    expect(FIRST_RENDER_BUDGET_MS).toBe(2500);
    expect(FRAME_RATE_FLOOR).toBe(30);
    expect(FRAME_RATE_STRIKES).toBeGreaterThanOrEqual(2);
  });

  it('renders live 3D on a capable device', () => {
    expect(decideStageMode(capable)).toEqual({ mode: 'live', fallback: null });
  });

  it('holds poses (3D, no animation) for reduced motion, which is not a fallback', () => {
    expect(decideStageMode({ ...capable, reducedMotion: true })).toEqual({ mode: 'held', fallback: null });
  });

  it('falls back to stills without WebGL, with data saver, on a low-power device, and says why', () => {
    expect(decideStageMode({ ...capable, webgl: false })).toEqual({ mode: 'still', fallback: 'no-webgl' });
    expect(decideStageMode({ ...capable, saveData: true })).toEqual({ mode: 'still', fallback: 'data-saver' });
    expect(decideStageMode({ ...capable, lowPower: true })).toEqual({ mode: 'still', fallback: 'low-power' });
    // Reduced motion never brings the 3D back on a device that cannot run it.
    expect(decideStageMode({ ...capable, lowPower: true, reducedMotion: true }).mode).toBe('still');
  });

  it('falls back to stills after a renderer failure or a missed frame-rate floor', () => {
    expect(decideStageMode(capable, 'render-error')).toEqual({ mode: 'still', fallback: 'render-error' });
    expect(decideStageMode({ ...capable, reducedMotion: true }, 'frame-rate')).toEqual({ mode: 'still', fallback: 'frame-rate' });
  });

  it('counts consecutive readings under 30 fps only at the lowest tier', () => {
    expect(frameRateStrikes(0, { fps: 20, tier: 'medium' })).toBe(0);
    expect(frameRateStrikes(0, { fps: 0, tier: 'low' })).toBe(0);
    let strikes = 0;
    for (const fps of [25, 28, 29]) strikes = frameRateStrikes(strikes, { fps, tier: 'low' });
    expect(strikes).toBe(3);
    expect(frameRateStrikes(strikes, { fps: 31, tier: 'low' })).toBe(0);
    expect(frameRateStrikes(2, { fps: 30, tier: 'low' })).toBe(0);
  });
});
