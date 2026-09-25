import type { ReactNode } from 'react';
import type { AgeBand } from './copyBudget';
import './tokens.css';
import './system.css';

/**
 * The rebuilt design system's root for a surface that a real application
 * route mounts (the preview entry has its own). Every token, the `app`
 * container that the layouts query (02 §7 rule 9), the theme and the page
 * language live on `.lf-rebuild`; a rebuilt surface rendered without this
 * root has no colours, no container widths and the wrong mode.
 */
export function RebuildRoot({ theme, locale, ageBand, children }: {
  theme: 'light' | 'dark'; locale: string; ageBand?: AgeBand; children: ReactNode;
}) {
  return <div className="lf-rebuild" data-theme={theme} lang={locale} data-age-band={ageBand}>{children}</div>;
}
