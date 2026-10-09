import { MorphIcon } from 'morphicons/react';
import { Moon, Sun } from 'lucide';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CircleFlag, LOCALE_FLAG } from '@/components/CircleFlag';
import { LOCALES, type Locale } from '@/i18n';
import { useCoreCopy, useLocale } from '@/i18n/useCopy';
import { useTheme } from '@/theme/useTheme';

/*
 * The two round display controls in the topbar: a theme toggle whose icon
 * morphs between sun and moon, and a language menu that shows flags. Each
 * language is named in its own language, never translated.
 */

const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = { 'es-MX': 'Español', 'en-US': 'English', 'pt-BR': 'Português' };

const ROUND = 'size-12 min-w-0 p-0';

function ThemeToggle() {
  const copy = useCoreCopy().siteShell;
  const { isDark, setChoice } = useTheme();
  const label = isDark ? copy.themeLight : copy.themeDark;

  return <Button type="button" variant="outline" className={ROUND} aria-label={label} title={label} onClick={() => setChoice(isDark ? 'light' : 'dark')}>
    <MorphIcon icon={isDark ? Sun : Moon} size={22} strokeWidth={2} reducedMotion="user" />
  </Button>;
}

function LanguageMenu() {
  const copy = useCoreCopy().siteShell;
  const locale = useLocale();
  const { i18n } = useTranslation();

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" className={ROUND} aria-label={`${copy.language}: ${LANGUAGE_NAMES[locale]}`} title={LANGUAGE_NAMES[locale]}>
        <CircleFlag code={LOCALE_FLAG[locale]!} className="size-7" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label={copy.language}>
      <DropdownMenuRadioGroup value={locale} onValueChange={(next) => { void i18n.changeLanguage(next); }}>
        {LOCALES.map((value) => <DropdownMenuRadioItem key={value} value={value} lang={value} adornment={false}>
          <span className="flex items-center gap-3"><CircleFlag code={LOCALE_FLAG[value]!} className="size-6" />{LANGUAGE_NAMES[value]}</span>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Theme, then language: the order everywhere they appear. */
export function TopbarControls() {
  return <div className="flex items-center gap-3">
    <ThemeToggle />
    <LanguageMenu />
  </div>;
}
