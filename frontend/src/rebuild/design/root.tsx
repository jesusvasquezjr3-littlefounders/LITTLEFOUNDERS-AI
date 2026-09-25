import { useMemo, type ReactNode } from 'react';
import type { AgeBand, Locale } from './copyBudget';
import { RebuildEnvironmentContext } from './layers';
import './tokens.css';
import './system.css';

const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/**
 * The rebuilt design system's root for a surface that a real application
 * route mounts (the preview entry has its own). Every token, the `app`
 * container that the layouts query (02 §7 rule 9), the theme and the page
 * language live on `.lf-rebuild`; a rebuilt surface rendered without this
 * root has no colours, no container widths and the wrong mode.
 *
 * It also provides the surface's environment (mode, language, age band) to
 * everything inside it, so an overlay opened from a rebuilt surface on a real
 * route renders its body-level host in the same mode and language instead of
 * the light, en-US default. The announcer and the toast region need translated
 * labels and stay with `RebuildProvider`.
 */
export function RebuildRoot({ theme, locale, ageBand, children }: {
  theme: 'light' | 'dark'; locale: string; ageBand?: AgeBand; children: ReactNode;
}) {
  const environmentLocale: Locale = (LOCALES as readonly string[]).includes(locale) ? locale as Locale : 'en-US';
  const environment = useMemo(() => ({ theme, locale: environmentLocale, ageBand }), [theme, environmentLocale, ageBand]);
  return <div className="lf-rebuild" data-theme={theme} lang={locale} data-age-band={ageBand}>
    <RebuildEnvironmentContext.Provider value={environment}>{children}</RebuildEnvironmentContext.Provider>
  </div>;
}
