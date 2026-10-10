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

function canCrossFade(): boolean {
  return (
    typeof document.startViewTransition === 'function' &&
    !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

function initialChoice(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
}

/*
 * Mounted once at the app root so the `dark` class on <html> stays correct
 * whether or not a ThemeToggle is on screen. ThemeToggle instances just
 * read/write this shared state.
 *
 * It is NOT what makes the theme right on the FIRST paint, and the comment
 * that used to claim so here was wrong for as long as it stood: an effect runs
 * after React commits, which on 2026-09-04 was measured at ~530 ms of a fully
 * rendered LIGHT page in front of a dark-mode visitor, followed by a
 * cross-fade of the whole document into dark — a bug with an animation
 * drawing attention to it. The
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
   * toggle (non-negotiable). Only the very first
   * mount of the whole app skips it.
   */
  const mounted = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, choice);

    /*
     * FIRST APPLY — no transition.
     *
     * CHANGING the theme cross-fades rather than snaps. On mount nothing is
     * changing: index.html already put
     * the right class on <html>, so this pass is a confirmation. Animating it
     * would be animating a no-op — and when the two ever disagree (storage
     * written by another tab, say), a hard correction inside the boot veil is
     * invisible where a half-second cross-fade is exactly what a visitor reads
     * as "the site loaded wrong and then fixed itself".
     */
    const apply = () => {
      const dark = resolveIsDark(choice);
      const root = document.documentElement;
      const paint = () => {
        root.classList.toggle('dark', dark);
        root.dataset.mode = dark ? 'dark' : 'light';
      };
      const animate = mounted.current && root.dataset.mode !== (dark ? 'dark' : 'light') && canCrossFade();

      mounted.current = true;

      /*
       * A real change cross-fades the whole page as one image (the View
       * Transition in app.css), so every surface, text and canvas moves
       * together instead of each property racing on its own clock. Without
       * the API, or with reduced motion, it is the plain instant swap.
       */
      if (animate) document.startViewTransition(paint);
      else paint();

      setIsDark(dark);
    };

    apply();

    if (choice === 'auto' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);

      return () => mq.removeEventListener('change', apply);
    }
  }, [choice]);

  return <ThemeContext.Provider value={{ choice, setChoice, isDark }}>{children}</ThemeContext.Provider>;
}

/** Gives an isolated renderer the current visual theme without changing document or saved preferences. */
export function StaticThemeProvider({ children, isDark }: { children: ReactNode; isDark: boolean }) {
  return <ThemeContext.Provider value={{ choice: isDark ? 'dark' : 'light', setChoice: () => {}, isDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);

  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');

  return ctx;
}

/**
 * Whether the current visual theme is dark, without requiring a provider: the
 * provider's value when one is mounted, else the `dark` class the inline boot
 * script puts on <html>. For renderers that may mount outside the app root.
 */
export function useIsDarkTheme(): boolean {
  const ctx = useContext(ThemeContext);

  if (ctx) return ctx.isDark;

  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}
