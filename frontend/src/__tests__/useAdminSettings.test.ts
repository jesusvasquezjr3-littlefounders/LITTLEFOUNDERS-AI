import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminSettings, ADMIN_SETTINGS_KEY } from '@/hooks/useAdminSettings';

describe('useAdminSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.reduceMotion;
  });

  it('returns defaults when nothing is stored', () => {
    const { result } = renderHook(() => useAdminSettings());
    expect(result.current.settings).toEqual({
      reduceMotion: false,
      showNotifBadge: true,
      notifSound: false,
    });
  });

  it('merges a stored partial over the defaults', () => {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify({ notifSound: true }));
    const { result } = renderHook(() => useAdminSettings());
    expect(result.current.settings.notifSound).toBe(true);
    // Untouched keys keep their default.
    expect(result.current.settings.showNotifBadge).toBe(true);
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useAdminSettings());
    act(() => result.current.update({ reduceMotion: true }));
    expect(result.current.settings.reduceMotion).toBe(true);
    const stored = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) as string);
    expect(stored.reduceMotion).toBe(true);
  });

  it('reflects reduceMotion on the document element', () => {
    const { result } = renderHook(() => useAdminSettings());
    act(() => result.current.update({ reduceMotion: true }));
    expect(document.documentElement.dataset.reduceMotion).toBe('true');
    act(() => result.current.update({ reduceMotion: false }));
    expect(document.documentElement.dataset.reduceMotion).toBe('false');
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(ADMIN_SETTINGS_KEY, '{ not valid json');
    const { result } = renderHook(() => useAdminSettings());
    expect(result.current.settings.showNotifBadge).toBe(true);
  });
});
