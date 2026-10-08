import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { TopbarControls } from '@/rebuild/design/topbarControls';
import { useShellCopy, useShellLocale } from './ShellRoot';

/** The round theme toggle and flag language menu, wired to the app's theme and i18n. Used on every shell. */
export function SiteTopbarControls() {
  const copy = useShellCopy().siteShell;
  const locale = useShellLocale();
  const { i18n } = useTranslation();
  const { isDark, setChoice } = useTheme();
  return <TopbarControls locale={locale} dark={isDark} copy={copy} onLocale={(next) => { void i18n.changeLanguage(next); }} onToggleTheme={() => setChoice(isDark ? 'light' : 'dark')} />;
}
