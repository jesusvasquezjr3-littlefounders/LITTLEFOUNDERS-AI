import { useMemo, type ReactNode } from 'react';
import type { Locale } from './copyBudget';
import { RebuildEnvironmentContext } from './layers';
import './tokens.css';
import './system.css';
import './controls.css';

const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/**
 * The design system's root. Every token, the `app` container that the
 * layouts query, the theme and the page language live on `.lf-rebuild`; a surface rendered without this
 * root has no colours, no container widths and the wrong mode.
 *
 * It also provides the surface's environment (mode, language) to everything
 * inside it, so an overlay opened from it renders its body-level host in the
 * same mode and language instead of the light, en-US default.
 */
export function RebuildRoot({ theme, locale, children }: {
  theme: 'light' | 'dark'; locale: string; children: ReactNode;
}) {
  const environmentLocale: Locale = (LOCALES as readonly string[]).includes(locale) ? locale as Locale : 'en-US';
  const environment = useMemo(() => ({ theme, locale: environmentLocale }), [theme, environmentLocale]);
  return <div className="lf-rebuild" data-theme={theme} lang={locale}>
    <RebuildEnvironmentContext.Provider value={environment}>{children}</RebuildEnvironmentContext.Provider>
  </div>;
}
