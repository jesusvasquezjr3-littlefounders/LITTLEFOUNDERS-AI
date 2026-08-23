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
import enDashboard from './en-US/dashboard.json';
import enProfile from './en-US/profile.json';
import enLesson from './en-US/lesson.json';
import enLearn from './en-US/learn.json';
import enAdmin from './en-US/admin.json';
import enOnboarding from './en-US/onboarding.json';
import enPlacement from './en-US/placement.json';
import enTutor from './en-US/tutor.json';
import esCommon from './es-MX/common.json';
import esMarketing from './es-MX/marketing.json';
import esErrors from './es-MX/errors.json';
import esAuth from './es-MX/auth.json';
import esDashboard from './es-MX/dashboard.json';
import esProfile from './es-MX/profile.json';
import esLesson from './es-MX/lesson.json';
import esLearn from './es-MX/learn.json';
import esAdmin from './es-MX/admin.json';
import esOnboarding from './es-MX/onboarding.json';
import esPlacement from './es-MX/placement.json';
import esTutor from './es-MX/tutor.json';
import ptCommon from './pt-BR/common.json';
import ptMarketing from './pt-BR/marketing.json';
import ptErrors from './pt-BR/errors.json';
import ptAuth from './pt-BR/auth.json';
import ptDashboard from './pt-BR/dashboard.json';
import ptProfile from './pt-BR/profile.json';
import ptLesson from './pt-BR/lesson.json';
import ptLearn from './pt-BR/learn.json';
import ptAdmin from './pt-BR/admin.json';
import ptOnboarding from './pt-BR/onboarding.json';
import ptPlacement from './pt-BR/placement.json';
import ptTutor from './pt-BR/tutor.json';

export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

const resources = {
  'en-US': { translation: { ...enCommon, marketing: enMarketing, errors: enErrors, auth: enAuth, dashboard: enDashboard, profile: enProfile, lesson: enLesson, learn: enLearn, admin: enAdmin, onboarding: enOnboarding, placement: enPlacement, tutor: enTutor } },
  'es-MX': { translation: { ...esCommon, marketing: esMarketing, errors: esErrors, auth: esAuth, dashboard: esDashboard, profile: esProfile, lesson: esLesson, learn: esLearn, admin: esAdmin, onboarding: esOnboarding, placement: esPlacement, tutor: esTutor } },
  'pt-BR': { translation: { ...ptCommon, marketing: ptMarketing, errors: ptErrors, auth: ptAuth, dashboard: ptDashboard, profile: ptProfile, lesson: ptLesson, learn: ptLearn, admin: ptAdmin, onboarding: ptOnboarding, placement: ptPlacement, tutor: ptTutor } },
};

/**
 * Keep `<html lang>` on the language the learner is actually reading.
 *
 * `index.html` ships `lang="en"` and nothing ever changed it, so every Spanish
 * and Portuguese screen in the product declared itself English. That is not a
 * cosmetic attribute:
 *
 * - A SCREEN READER picks its voice and its pronunciation rules from it. A
 *   child using VoiceOver on the Spanish Tutor heard Spanish read aloud by an
 *   English synthesiser — which is the owner's own rule, "SIEMPRE se debe
 *   hablar en el idioma que tiene configurado el usuario", broken on the one
 *   surface where speech IS the product.
 * - Hyphenation, `:lang()` selectors, quote marks, spell-check and the
 *   browser's own translate prompt all key off it.
 *
 * Attached to the instance rather than to a React effect on purpose: the
 * attribute must be right for the FIRST paint and for any consumer that never
 * mounts a component (the marketing shell, a crawler, an error boundary), and
 * i18next resolves the detected language during `init`, before React exists.
 *
 * `i18n.language` can carry a region i18next resolved but we do not ship
 * (`es`, `pt-PT`), so the tag written is the supported locale actually in use.
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
