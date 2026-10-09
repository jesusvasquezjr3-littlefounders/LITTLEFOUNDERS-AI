import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { RebuildRoot } from '@/rebuild/design/root';
import type { Locale } from '@/rebuild/design/copyBudget';

/*
 * The bridge between the application's providers and the design system: the
 * design-system root (tokens, mode, page language, overlay environment), fed
 * by the app's own i18n language and theme.
 */

const LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];

/** The supported locale the application is showing. */
export function useShellLocale(): Locale {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en-US';
  return LOCALES.find((locale) => locale === language) ?? LOCALES.find((locale) => locale.slice(0, 2) === language.slice(0, 2)) ?? 'en-US';
}

/** The shell's own copy (`rebuild-core.json`) in the application's language. */
export function useShellCopy() {
  return rebuildNamespaceCopy[useShellLocale()].core;
}

export function ShellRoot({ children }: { children: ReactNode }) {
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const theme = isDark ? 'dark' : 'light';
  return <RebuildRoot theme={theme} locale={locale}>{children}</RebuildRoot>;
}
