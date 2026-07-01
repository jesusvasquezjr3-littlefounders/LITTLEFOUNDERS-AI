/**
 * i18n Configuration for LittleFounders
 * 
 * This file sets up react-i18next for internationalization.
 * Currently supports: Spanish (es) and English (en)
 * Default language: Spanish
 * 
 * Usage in components:
 * ```tsx
 * import { useTranslation } from 'react-i18next';
 * 
 * function MyComponent() {
 *   const { t } = useTranslation('common');
 *   return <button>{t('buttons.continue')}</button>;
 * }
 * ```
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esLanding from './locales/es/landing.json';
import esLessons from './locales/es/lessons.json';
import esDashboard from './locales/es/dashboard.json';
import esProfile from './locales/es/profile.json';
import esErrors from './locales/es/errors.json';
import esAdventures from './locales/es/adventures.json';
import esSettings from './locales/es/settings.json';
import esAvatar from './locales/es/avatar.json';
import esAdmin from './locales/es/admin.json';
import esOnboarding from './locales/es/onboarding.json';
import esGames from './locales/es/games.json';
import esHackerDefense from './locales/es/hackerDefense.json';
import esChronoBloom from './locales/es/chronoBloom.json';
import esReports from './locales/es/reports.json';
import esPlacement from './locales/es/placement.json';
import esLegal from './locales/es/legal.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enLanding from './locales/en/landing.json';
import enLessons from './locales/en/lessons.json';
import enDashboard from './locales/en/dashboard.json';
import enProfile from './locales/en/profile.json';
import enErrors from './locales/en/errors.json';
import enAdventures from './locales/en/adventures.json';
import enSettings from './locales/en/settings.json';
import enAvatar from './locales/en/avatar.json';
import enAdmin from './locales/en/admin.json';
import enOnboarding from './locales/en/onboarding.json';
import enGames from './locales/en/games.json';
import enHackerDefense from './locales/en/hackerDefense.json';
import enChronoBloom from './locales/en/chronoBloom.json';
import enReports from './locales/en/reports.json';
import enPlacement from './locales/en/placement.json';
import enLegal from './locales/en/legal.json';

// Supported languages
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Language display names
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
    es: 'Español',
    en: 'English',
};

// Language flags (emoji)
export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
    es: '🇲🇽',
    en: '🇺🇸',
};

// Resources configuration
const resources = {
    es: {
        common: esCommon,
        auth: esAuth,
        landing: esLanding,
        lessons: esLessons,
        dashboard: esDashboard,
        profile: esProfile,
        errors: esErrors,
        adventures: esAdventures,
        settings: esSettings,
        avatar: esAvatar,
        admin: esAdmin,
        onboarding: esOnboarding,
        games: esGames,
        hackerDefense: esHackerDefense,
        chronoBloom: esChronoBloom,
        reports: esReports,
        placement: esPlacement,
        legal: esLegal,
    },
    en: {
        common: enCommon,
        auth: enAuth,
        landing: enLanding,
        lessons: enLessons,
        dashboard: enDashboard,
        profile: enProfile,
        errors: enErrors,
        adventures: enAdventures,
        settings: enSettings,
        avatar: enAvatar,
        admin: enAdmin,
        onboarding: enOnboarding,
        games: enGames,
        hackerDefense: enHackerDefense,
        chronoBloom: enChronoBloom,
        reports: enReports,
        placement: enPlacement,
        legal: enLegal,
    },
};

// Custom language detector: query param > localStorage > browser
const getInitialLanguage = (): SupportedLanguage => {
    // 1. Detect from ?lang= query param (redirect from old subdomain or shared link)
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang');
    if (queryLang && SUPPORTED_LANGUAGES.includes(queryLang as SupportedLanguage)) {
        return queryLang as SupportedLanguage;
    }

    // 2. Check if user has explicitly saved a preference
    const savedLang = localStorage.getItem('littlefounders_language') as SupportedLanguage | null;
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
        return savedLang;
    }

    // 3. Detect from browser/system language
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en';

    // If browser language starts with 'es' (es, es-MX, es-ES, es-AR, etc.), use Spanish
    // Otherwise, default to English
    if (browserLang.toLowerCase().startsWith('es')) {
        return 'es';
    }

    return 'en';
};

// Initialize i18next
i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getInitialLanguage(), // Use our custom detection
        fallbackLng: 'en', // English as ultimate fallback
        defaultNS: 'common',

        interpolation: {
            escapeValue: false, // React already escapes values
        },

        // React specific options
        react: {
            useSuspense: false, // Disable suspense for SSR compatibility
        },
    });

/**
 * Change the current language without redirecting.
 * Language is stored in localStorage and applied immediately in-app.
 * @param lang - Language code ('es' or 'en')
 */
export const changeLanguage = (lang: SupportedLanguage): Promise<void> => {
    return i18n.changeLanguage(lang).then(() => {
        localStorage.setItem('littlefounders_language', lang);
    });
};

/**
 * Get the current language
 */
export const getCurrentLanguage = (): SupportedLanguage => {
    const lang = i18n.language?.split('-')[0] as SupportedLanguage;
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : 'es';
};

export default i18n;
