import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeChoice = 'auto' | 'light' | 'dark';

interface ThemeContextValue {
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
  isDark: boolean;
}

const STORAGE_KEY = 'lf-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  // matchMedia is absent in some test environments (jsdom) — default to light there.
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(choice: ThemeChoice): boolean {
  return choice === 'auto' ? systemPrefersDark() : choice === 'dark';
}

function initialChoice(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
}

/*
 * Mounted once at the app root so the `dark` class on <html> is correct on
 * first paint regardless of route — some pages (auth) deliberately render no
 * ThemeToggle, so applying the theme can't be conditional on one being on
 * screen. ThemeToggle instances elsewhere just read/write this shared state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(initialChoice);
  const [isDark, setIsDark] = useState(() => resolveIsDark(initialChoice()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, choice);
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const dark = resolveIsDark(choice);

      // Inject transitioning class to trigger smooth CSS animations
      document.documentElement.classList.add('theme-transitioning');

      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);

      // Remove after duration matches the CSS (500ms). Tracked + cleared in the
      // effect cleanup: an un-cleared timer fires after test teardown and shows
      // up as an unhandled error that fails the whole run (frontend CI 2026-07-22).
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 500);
    };
    apply();

    if (choice === 'auto' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => {
        clearTimeout(transitionTimer);
        mq.removeEventListener('change', apply);
      };
    }
    return () => clearTimeout(transitionTimer);
  }, [choice]);

  return <ThemeContext.Provider value={{ choice, setChoice, isDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
