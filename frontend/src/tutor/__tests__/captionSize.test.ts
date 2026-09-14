import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isCaptionLarge, setCaptionLarge, useCaptionLarge } from '../captionSize';

const KEY = 'lf.tutor.captionLarge';

describe('captionSize — a device preference, not an on/off for the caption itself', () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEY);
    setCaptionLarge(false);
  });

  afterEach(() => {
    window.localStorage.removeItem(KEY);
    setCaptionLarge(false);
  });

  it('defaults to the normal size', () => {
    expect(isCaptionLarge()).toBe(false);
  });

  it('setCaptionLarge persists across a fresh read', () => {
    setCaptionLarge(true);
    expect(isCaptionLarge()).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('1');
  });

  it('useCaptionLarge re-renders every subscriber the instant the preference changes', () => {
    const { result } = renderHook(() => useCaptionLarge());
    expect(result.current).toBe(false);

    act(() => setCaptionLarge(true));
    expect(result.current).toBe(true);

    act(() => setCaptionLarge(false));
    expect(result.current).toBe(false);
  });
});
