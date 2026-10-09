import { MorphIcon } from 'morphicons/react';
import { Moon, Sun } from 'lucide';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CircleFlag, LOCALE_FLAG } from '@/components/CircleFlag';
import { SignInDialog } from '@/components/SignInDialog';
import { LOCALES } from '@/i18n';
import { useCoreCopy, useLocale } from '@/i18n/useCopy';
import { useTheme } from '@/theme/useTheme';

/*
 * The two round display controls in the topbar: a theme toggle whose icon
 * morphs between sun and moon, and a language menu that shows flags. Each
 * language is named in its own language (core.json, `languages`).
 */

const ROUND = 'size-12 min-w-0 p-0';

function ThemeToggle() {
  const copy = useCoreCopy().siteShell;
  const { isDark, setChoice } = useTheme();
  const label = isDark ? copy.themeLight : copy.themeDark;

  return <Button type="button" variant="outline" data-icon-only className={ROUND} aria-label={label} title={label} onClick={() => setChoice(isDark ? 'light' : 'dark')}>
    <MorphIcon icon={isDark ? Sun : Moon} size={22} strokeWidth={2} reducedMotion="user" />
  </Button>;
}

function LanguageMenu() {
  const copy = useCoreCopy().siteShell;
  const locale = useLocale();
  const { i18n } = useTranslation();
  const names = useCoreCopy().languages;

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" data-icon-only className={ROUND} aria-label={`${copy.language}: ${names[locale]}`} title={names[locale]}>
        <CircleFlag code={LOCALE_FLAG[locale]!} className="size-7" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label={copy.language}>
      <DropdownMenuRadioGroup value={locale} onValueChange={(next) => { void i18n.changeLanguage(next); }}>
        {LOCALES.map((value) => <DropdownMenuRadioItem key={value} value={value} lang={value} adornment={false}>
          <span className="flex items-center gap-3"><CircleFlag code={LOCALE_FLAG[value]!} className="size-6" />{names[value]}</span>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Theme, then language, then Sign in: the order everywhere they appear. */
export function TopbarControls() {
  return <div className="flex items-center gap-3">
    <ThemeToggle />
    <LanguageMenu />
    <SignInDialog />
  </div>;
}
