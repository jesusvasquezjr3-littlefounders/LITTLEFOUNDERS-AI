import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/*
 * Locale resources are fragmented per route area (frontend/AGENTS.md §i18n):
 * <locale>/common.json    — app-wide chrome (app, theme, language)
 * <locale>/marketing.json — marketing site pages (mounted under "marketing")
 * <locale>/errors.json    — API error codes (mounted under "errors")
 * New product sections add a new file per locale (e.g. learn.json → "learn").
 * Key paths seen by t() are unchanged by the fragmentation.
 */
import enCommon from './en-US/common.json';
import enMarketing from './en-US/marketing.json';
import enErrors from './en-US/errors.json';
import enAuth from './en-US/auth.json';
import esCommon from './es-MX/common.json';
import esMarketing from './es-MX/marketing.json';
import esErrors from './es-MX/errors.json';
import esAuth from './es-MX/auth.json';
import ptCommon from './pt-BR/common.json';
import ptMarketing from './pt-BR/marketing.json';
import ptErrors from './pt-BR/errors.json';
import ptAuth from './pt-BR/auth.json';

export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

const resources = {
  'en-US': { translation: { ...enCommon, marketing: enMarketing, errors: enErrors, auth: enAuth } },
  'es-MX': { translation: { ...esCommon, marketing: esMarketing, errors: esErrors, auth: esAuth } },
  'pt-BR': { translation: { ...ptCommon, marketing: ptMarketing, errors: ptErrors, auth: ptAuth } },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    supportedLngs: [...LOCALES],
    interpolation: { escapeValue: false },
  });

export default i18n;
