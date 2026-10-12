import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@/i18n';
import { copy } from '@/i18n/copy';

/** The supported locale the application is showing. */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en-US';

  return LOCALES.find((locale) => locale === language) ?? LOCALES.find((locale) => locale.slice(0, 2) === language.slice(0, 2)) ?? 'en-US';
}

/** The shell's own copy in the application's language. */
export function useCoreCopy() {
  return copy[useLocale()].core;
}

/** The landing page's and the cookie choice's copy in the application's language. */
export function useSiteCopy() {
  return copy[useLocale()].site;
}

/** The signed-in application's copy in the application's language. */
export function useAppCopy() {
  return copy[useLocale()].app;
}

/** The onboarding's copy in the application's language. */
export function useOnboardingCopy() {
  return copy[useLocale()].onboarding;
}
