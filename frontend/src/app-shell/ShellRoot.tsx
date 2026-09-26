import { useCallback, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { RebuildProvider, RebuildRoot } from '@/rebuild/design/controls';
import type { Locale } from '@/rebuild/design/copyBudget';

/*
 * The bridge between the application's providers and the rebuilt design
 * system (W2 Lane 0). Every mounted shell renders inside it: the design-system
 * root (tokens, the `app` container the layouts query, the mode, the page
 * language) and the provider (overlay environment, announcer, toasts), fed by
 * the app's own i18n language and theme context, so a person's choice of
 * language and mode applies to the rebuilt shell and to the legacy page body
 * inside it alike.
 */

const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/** The supported locale the application is showing. */
export function useShellLocale(): Locale {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en-US';
  return LOCALES.find((locale) => locale === language) ?? LOCALES.find((locale) => locale.slice(0, 2) === language.slice(0, 2)) ?? 'en-US';
}

/** Lane 0's own copy (`rebuild-core.json`) in the application's language. */
export function useShellCopy() {
  return rebuildNamespaceCopy[useShellLocale()].core;
}

/** Client-side navigation for the shells' links (a plain click stays in the SPA; modified clicks open normally). */
export function useShellNavigate() {
  const navigate = useNavigate();
  return useCallback((href: string) => navigate(href), [navigate]);
}

/*
 * Route focus across a remount. The shells move focus to the new page's
 * heading when their route key changes in place (rebuild/design/shells.tsx
 * useRouteFocus). On a real route the whole shell usually REMOUNTS instead:
 * RequireAuth's age-screen gate (RequireAgeScreen) re-checks every new path
 * with Core and shows its own loading screen meanwhile, so the shell of the
 * next page is a new mount that sees no key change. The gate must stay that
 * strict, so the shell remembers the last path it showed and treats a mount
 * on a different path as the route change it is. The first load of the app
 * (nothing remembered) and React's development double-mount (same path) move
 * nothing.
 */
let lastShellPath: string | null = null;

function useRouteFocusAcrossRemount() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (lastShellPath === null || lastShellPath === pathname) return;
    window.scrollTo(0, 0);
    const main = document.querySelector<HTMLElement>('[data-shell] main');
    const target = main?.querySelector<HTMLElement>('h1') ?? main;
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    // Mount only: an in-place route change is the shell's own useRouteFocus.
  }, []);
  useEffect(() => { lastShellPath = pathname; }, [pathname]);
}

export function ShellRoot({ children }: { children: ReactNode }) {
  useRouteFocusAcrossRemount();
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const theme = isDark ? 'dark' : 'light';
  const copy = rebuildNamespaceCopy[locale].core.appShell;
  return <RebuildRoot theme={theme} locale={locale}>
    <RebuildProvider environment={{ theme, locale }} labels={{ dismiss: copy.dismiss }}>{children}</RebuildProvider>
  </RebuildRoot>;
}

/**
 * A legacy page body inside a rebuilt shell, until its lane rebuilds it
 * (OD-15). It restores the legacy page's own typography and content box
 * (what AppLayout, MarketingLayout and AuthLayout used to give it) and marks
 * the subtree so the design system's element rules leave it alone
 * (`[data-legacy-body]` in rebuild/design/system.css). Rebuilt panels embedded
 * in a legacy page keep their own root and rules.
 */
export function LegacyBody({ frame, routeKey, children }: { frame: 'app' | 'site' | 'auth'; routeKey: string; children: ReactNode }) {
  const box = frame === 'app' ? 'mx-auto w-full max-w-container px-5 pb-10 pt-6 md:px-8 lg:pt-10' : 'w-full';
  return <div key={routeKey} data-legacy-body={frame} className={`lf-page-enter font-body text-content antialiased ${box}`}>{children}</div>;
}
