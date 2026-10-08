import './standaloneHeader.css';
import { BrandMark } from '@/rebuild/design/controls';
import { TopbarControls } from './topbarControls';
import type { Locale } from '@/rebuild/design/copyBudget';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';

/** Only public marketing surfaces may opt into a topbar. Application states render no header. */
export function StandaloneHeader({ locale, theme, onLocale, onTheme, marketing = false }: {
  locale: Locale; theme: 'light' | 'dark'; onLocale?: (locale: Locale) => void; onTheme?: (theme: 'light' | 'dark') => void;
  marketing?: boolean;
}) {
  const copy = rebuildNamespaceCopy[locale].core.siteShell;
  if (!marketing) return null;
  return <header className="lf-standalone-header">
    <BrandMark name="LittleFounders" />
    <TopbarControls locale={locale} dark={theme === 'dark'} copy={copy} onLocale={(next) => onLocale?.(next)}
      onToggleTheme={() => onTheme?.(theme === 'dark' ? 'light' : 'dark')} />
  </header>;
}
