import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/*
 * i18next only decides and remembers WHICH language is showing (detected from
 * the browser, persisted on change). The page's own copy is not loaded
 * through it: surfaces import their typed JSON from `./copy.ts`.
 */

export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;

export type Locale = (typeof LOCALES)[number];

const resources = {
  'en-US': { translation: {} },
  'es-MX': { translation: {} },
  'pt-BR': { translation: {} },
};

/**
 * Keep `<html lang>` on the language the visitor is actually reading.
 *
 * `index.html` ships `lang="en"`. A screen reader picks its voice and
 * pronunciation rules from this attribute, and hyphenation, `:lang()`
 * selectors, quote marks, spell-check and the browser's translate prompt all
 * key off it.
 *
 * Attached to the instance rather than to a React effect on purpose: the
 * attribute must be right for the FIRST paint. `i18n.language` can carry a
 * region i18next resolved but we do not ship (`es`, `pt-PT`), so the tag
 * written is the supported locale actually in use.
 */
function publishDocumentLanguage(lng: string | undefined): void {
  if (typeof document === 'undefined') return;

  const resolved =
    LOCALES.find((id) => id === lng) ??
    LOCALES.find((id) => id.slice(0, 2) === (lng ?? '').slice(0, 2).toLowerCase()) ??
    'en-US';

  document.documentElement.setAttribute('lang', resolved);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    supportedLngs: [...LOCALES],
    interpolation: { escapeValue: false },
  });

publishDocumentLanguage(i18n.language);

i18n.on('languageChanged', publishDocumentLanguage);

export default i18n;
