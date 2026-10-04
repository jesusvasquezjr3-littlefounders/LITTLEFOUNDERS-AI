import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { StandaloneHeader } from '@/rebuild/design/StandaloneHeader';
import { useShellLocale } from './ShellRoot';
export { StandaloneHeader } from '@/rebuild/design/StandaloneHeader';

/** Actual routes share the application's language and persisted display mode. */
export function ConnectedStandaloneHeader({ marketing = false }: { marketing?: boolean }) {
  const locale = useShellLocale();
  const { i18n } = useTranslation();
  const { isDark, setChoice } = useTheme();
  return <StandaloneHeader marketing={marketing} locale={locale} theme={isDark ? 'dark' : 'light'}
    onLocale={next => { void i18n.changeLanguage(next); }} onTheme={setChoice} />;
}
