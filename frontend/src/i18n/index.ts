import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/*
 * Locale resources are fragmented per route area (frontend/AGENTS.md §i18n):
 * <locale>/common.json    — spread at the root: the not-found fallback, the
 *                           theme labels, the legacy 2D characters' greeting
 *                           and the family.badge share copy
 * <locale>/marketing.json — the public badge page (mounted under "marketing")
 * <locale>/lesson.json   — the v1 lesson player (the OD-24 legacy island)
 * <locale>/tutor.json    — the Mentor stage's scene and microphone strings
 * The legacy namespaces no screen reads any more (errors, auth, dashboard,
 * profile, learn, admin, onboarding, placement) left with the legacy UI in
 * S10L.1. New UI never adds a namespace here (Frontend Bible 02 rule 23).
 *
 * The REBUILT UI's copy is deliberately not loaded here: it is one
 * `<locale>/rebuild-<namespace>.json` per wave-2 lane (core, site, learn,
 * mentor, family, profile, staff), imported as typed JSON by the surface that
 * owns it, or merged by `./rebuild.ts` (REBUILD_NAMESPACES). A rebuilt string
 * missing from its namespace is then a type error, never a raw key on screen.
 */
import enCommon from './en-US/common.json';
import enMarketing from './en-US/marketing.json';
import enLesson from './en-US/lesson.json';
import enTutor from './en-US/tutor.json';
import esCommon from './es-MX/common.json';
import esMarketing from './es-MX/marketing.json';
import esLesson from './es-MX/lesson.json';
import esTutor from './es-MX/tutor.json';
import ptCommon from './pt-BR/common.json';
import ptMarketing from './pt-BR/marketing.json';
import ptLesson from './pt-BR/lesson.json';
import ptTutor from './pt-BR/tutor.json';

export const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

/** i18next's own `language`/`resolvedLanguage` are plain `string` — this is the narrowing gate. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

const resources = {
  'en-US': { translation: { ...enCommon, marketing: enMarketing, lesson: enLesson, tutor: enTutor } },
  'es-MX': { translation: { ...esCommon, marketing: esMarketing, lesson: esLesson, tutor: esTutor } },
  'pt-BR': { translation: { ...ptCommon, marketing: ptMarketing, lesson: ptLesson, tutor: ptTutor } },
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
    /*
     * The event this emits is what lets the test suite catch a key that only
     * exists at runtime (see src/test-setup.ts).
     *
     * `check-t-keys` says it plainly in its own output: under a dynamic
     * segment only the static namespace is verified, and the leaf keys below
     * it are not checked and CANNOT be. There are around 170 such call sites.
     * One of them shipped a key that did not exist and rendered as itself,
     * in Spanish, across the top of the web-analytics chart.
     *
     * Costs nothing in production: i18next emits an event and carries on
     * rendering exactly as before. It is a signal, not a behaviour change.
     */
    saveMissing: true,
    missingKeyNoValueFallbackToKey: false,
  });

publishDocumentLanguage(i18n.language);
i18n.on('languageChanged', publishDocumentLanguage);

export default i18n;
