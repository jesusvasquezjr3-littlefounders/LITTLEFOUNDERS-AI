import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enUS from './en-US.json';
import esMX from './es-MX.json';
import ptBR from './pt-BR.json';

export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'es-MX': { translation: esMX },
      'pt-BR': { translation: ptBR },
    },
    fallbackLng: 'en-US',
    supportedLngs: [...LOCALES],
    interpolation: { escapeValue: false },
  });

export default i18n;
