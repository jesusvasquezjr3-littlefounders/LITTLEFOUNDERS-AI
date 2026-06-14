/**
 * useAdminSettings Hook
 *
 * Frontend-only admin preferences persisted in localStorage under
 * `admin_settings`. No backend involved. Changes are broadcast to every
 * mounted instance via a custom window event so the header, sidebar and
 * settings page stay in sync without a global store.
 */

import { useCallback, useEffect, useState } from 'react';

export interface AdminSettings {
  /** Minimize animations and transitions across the admin panel. */
  reduceMotion: boolean;
  /** Show the unread-count badge on the notification bell. */
  showNotifBadge: boolean;
  /** Play a subtle sound when a new alert arrives. */
  notifSound: boolean;
}

export const ADMIN_SETTINGS_KEY = 'admin_settings';
const ADMIN_SETTINGS_EVENT = 'admin-settings-changed';

const DEFAULT_SETTINGS: AdminSettings = {
  reduceMotion: false,
  showNotifBadge: true,
  notifSound: false,
};

function readSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Apply panel-wide side effects derived from settings (e.g. reduce motion). */
function applySideEffects(settings: AdminSettings) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSettings>(readSettings);

  // Keep this instance in sync with changes from other instances / tabs.
  useEffect(() => {
    const refresh = () => setSettings(readSettings());
    window.addEventListener(ADMIN_SETTINGS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ADMIN_SETTINGS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Apply derived side effects whenever settings change.
  useEffect(() => {
    applySideEffects(settings);
  }, [settings]);

  const update = useCallback((partial: Partial<AdminSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / privacy-mode errors */
      }
      applySideEffects(next);
      window.dispatchEvent(new Event(ADMIN_SETTINGS_EVENT));
      return next;
    });
  }, []);

  return { settings, update };
}

export default useAdminSettings;
