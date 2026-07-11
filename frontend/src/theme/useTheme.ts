import { useEffect, useState } from 'react';

export type ThemeChoice = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'lf-theme';

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

export function useTheme(): { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void; isDark: boolean } {
  const [choice, setChoice] = useState<ThemeChoice>(initialChoice);
  const [isDark, setIsDark] = useState(() => resolveIsDark(initialChoice()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, choice);
    const apply = () => {
      const dark = resolveIsDark(choice);
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };
    apply();

    if (choice === 'auto' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [choice]);

  return { choice, setChoice, isDark };
}
