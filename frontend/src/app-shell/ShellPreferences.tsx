import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { useTheme } from '@/theme/useTheme';
import { IconButton, SelectField } from '@/rebuild/design/controls';
import { useShellCopy, useShellLocale } from './ShellRoot';

/** Shared header settings; language names remain readable in their own language. */
export function ShellPreferences() {
  const copy = useShellCopy().siteShell;
  const locale = useShellLocale();
  const { i18n } = useTranslation();
  const { isDark, setChoice } = useTheme();
  const selectedLanguageId = useId();
  const languages = [{ value: 'en-US', label: 'English', role: 'data' as const }, { value: 'es-MX', label: 'Español', role: 'data' as const }, { value: 'pt-BR', label: 'Português', role: 'data' as const }];
  return <div className="lf-shell-preferences" data-shell-preferences>
    <span className="lf-visually-hidden" id={selectedLanguageId} data-copy-role="data">{languages.find(language => language.value === locale)?.label}</span>
    <SelectField label={copy.language} labelHidden value={locale} selectedLabel={locale.slice(0, 2).toUpperCase()} aria-describedby={selectedLanguageId}
      onChange={(event) => void i18n.changeLanguage(event.target.value)} options={languages} />
    <IconButton glyph={isDark ? 'sun' : 'moon'} label={isDark ? copy.themeLight : copy.themeDark} onClick={() => setChoice(isDark ? 'light' : 'dark')} />
  </div>;
}
