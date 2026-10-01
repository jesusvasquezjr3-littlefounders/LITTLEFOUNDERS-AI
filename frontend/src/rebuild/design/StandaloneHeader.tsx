import './standaloneHeader.css';
import { useId } from 'react';
import { BrandMark, IconButton, SelectField } from '@/rebuild/design/controls';
import type { Locale } from '@/rebuild/design/copyBudget';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';

/** Provider-independent header for standalone screens and their preview fixtures. */
export function StandaloneHeader({ locale, theme, onLocale, onTheme }: {
  locale: Locale; theme: 'light' | 'dark'; onLocale?: (locale: Locale) => void; onTheme?: (theme: 'light' | 'dark') => void;
}) {
  const copy = rebuildNamespaceCopy[locale].core.siteShell;
  const languageId = useId();
  const languageName = locale === 'es-MX' ? 'Español' : locale === 'pt-BR' ? 'Português' : 'English';
  return <header className="lf-standalone-header">
    <BrandMark name="LittleFounders" />
    <div className="lf-shell-preferences" data-shell-preferences>
      <span className="lf-visually-hidden" id={languageId} data-copy-role="data">{languageName}</span>
      <SelectField aria-describedby={languageId} label={copy.language} labelHidden value={locale} selectedLabel={locale.slice(0, 2).toUpperCase()}
        onChange={event => onLocale?.(event.target.value as Locale)}
        options={[{ value: 'en-US', label: 'English', role: 'data' }, { value: 'es-MX', label: 'Español', role: 'data' }, { value: 'pt-BR', label: 'Português', role: 'data' }]} />
      <IconButton glyph={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? copy.themeLight : copy.themeDark}
        onClick={() => onTheme?.(theme === 'dark' ? 'light' : 'dark')} />
    </div>
  </header>;
}
