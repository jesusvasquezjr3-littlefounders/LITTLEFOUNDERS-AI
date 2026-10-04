import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOLD_MS, motionAllowed, useFoldTween } from './foldTween';

/** A `matchMedia` that answers only the no-preference query, the way a browser does when the person has not asked for less motion. */
const stubMedia = (noPreference: boolean | 'throws' | 'missing') => {
  if (noPreference === 'missing') { vi.stubGlobal('matchMedia', undefined); return; }
  vi.stubGlobal('matchMedia', (query: string) => {
    if (noPreference === 'throws') throw new Error('no media');
    return { matches: query === '(prefers-reduced-motion: no-preference)' ? noPreference : false, media: query };
  });
};

/** A frame loop the test drives by hand, so the tween can be stepped through its 250 ms. */
function frames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queue.set(next, callback); return next++; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { queue.delete(id); }));
  return {
    pending: () => queue.size,
    run: (time: number) => { const due = [...queue.entries()]; queue.clear(); due.forEach(([, callback]) => callback(time)); },
  };
}

describe('the fold tween and reduced motion', () => {
  beforeEach(() => { vi.spyOn(performance, 'now').mockReturnValue(0); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('runs 250 ms at most, matching the pack motion rules', () => {
    expect(FOLD_MS).toBeLessThanOrEqual(250);
  });

  it('allows motion only when the person has not asked for less', () => {
    stubMedia(true);
    expect(motionAllowed()).toBe(true);
    stubMedia(false);
    expect(motionAllowed()).toBe(false);
  });

  it('treats a missing or failing matchMedia as no motion', () => {
    stubMedia('missing');
    expect(motionAllowed()).toBe(false);
    stubMedia('throws');
    expect(motionAllowed()).toBe(false);
  });

  it('jumps straight to the end under reduced motion and never asks for a frame', () => {
    stubMedia(false);
    const loop = frames();
    const { result } = renderHook(() => useFoldTween());
    act(() => result.current.go(1));
    expect(result.current.t).toBe(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(loop.pending()).toBe(0);
    act(() => result.current.go(0));
    expect(result.current.t).toBe(0);
  });

  it('eases to the end in 250 ms under no-preference', () => {
    stubMedia(true);
    const loop = frames();
    const { result } = renderHook(() => useFoldTween());
    act(() => result.current.go(1));
    expect(result.current.t).toBe(0);
    expect(loop.pending()).toBe(1);
    act(() => loop.run(FOLD_MS / 2));
    expect(result.current.t).toBeGreaterThan(0.3);
    expect(result.current.t).toBeLessThan(0.7);
    act(() => loop.run(FOLD_MS));
    expect(result.current.t).toBe(1);
    expect(loop.pending()).toBe(0);
  });

  it('never overshoots: every frame stays between the start and the end', () => {
    stubMedia(true);
    const loop = frames();
    const { result } = renderHook(() => useFoldTween());
    act(() => result.current.go(1));
    for (let time = 10; time <= FOLD_MS + 50; time += 10) {
      act(() => loop.run(time));
      expect(result.current.t).toBeGreaterThanOrEqual(0);
      expect(result.current.t).toBeLessThanOrEqual(1);
    }
  });

  it('lets the scrub slider stop a running fold and jump anywhere', () => {
    stubMedia(true);
    const loop = frames();
    const { result } = renderHook(() => useFoldTween());
    act(() => result.current.go(1));
    act(() => result.current.set(0.4));
    expect(result.current.t).toBe(0.4);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(loop.pending()).toBe(0);
    act(() => result.current.set(3));
    expect(result.current.t).toBe(1);
    act(() => result.current.set(-1));
    expect(result.current.t).toBe(0);
  });

  it('cancels a running fold when the board goes away', () => {
    stubMedia(true);
    const loop = frames();
    const { result, unmount } = renderHook(() => useFoldTween());
    act(() => result.current.go(1));
    expect(loop.pending()).toBe(1);
    unmount();
    expect(loop.pending()).toBe(0);
  });
});
