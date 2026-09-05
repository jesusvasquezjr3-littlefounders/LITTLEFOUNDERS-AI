import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

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
 * Mounted once at the app root so the `dark` class on <html> stays correct on
 * every route — some pages (auth) deliberately render no ThemeToggle, so
 * applying the theme can't be conditional on one being on screen. ThemeToggle
 * instances elsewhere just read/write this shared state.
 *
 * It is NOT what makes the theme right on the FIRST paint, and the comment
 * that used to claim so here was wrong for as long as it stood: an effect runs
 * after React commits, which on 2026-09-04 was measured at ~530 ms of a fully
 * rendered LIGHT page in front of a dark-mode visitor, followed by the
 * `theme-transitioning` rule below cross-fading the whole document into dark
 * over another 500 ms — a bug with an animation drawing attention to it. The
 * first paint belongs to the inline script in index.html, which resolves the
 * same key with the same `auto` semantics before <body> is parsed. This
 * provider then AGREES with what is already on the element (see FIRST APPLY).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(initialChoice);
  const [isDark, setIsDark] = useState(() => resolveIsDark(initialChoice()));
  /*
   * A ref and not a local, because this effect RE-RUNS on every `choice`
   * change: a local would reset to true on each run and silently kill the
   * cross-fade on the one event it exists for — a visitor pressing the theme
   * toggle (/DESIGN.md §Motion recipe 6, non-negotiable). Only the very first
   * mount of the whole app skips it.
   */
  const mounted = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, choice);
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    /*
     * FIRST APPLY — no transition.
     *
     * `theme-transitioning` exists so that CHANGING the theme cross-fades
     * rather than snaps. On mount nothing is changing: index.html already put
     * the right class on <html>, so this pass is a confirmation. Animating it
     * would be animating a no-op — and when the two ever disagree (storage
     * written by another tab, say), a hard correction inside the boot veil is
     * invisible where a half-second cross-fade is exactly what a visitor reads
     * as "the site loaded wrong and then fixed itself".
     */
    const apply = () => {
      const dark = resolveIsDark(choice);

      if (mounted.current) {
        // Inject transitioning class to trigger smooth CSS animations
        document.documentElement.classList.add('theme-transitioning');
      }
      mounted.current = true;

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
