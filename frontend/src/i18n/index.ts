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
    },
};

// Helper to determine if we are on a main domain (no lang subdomain)
const isMainDomain = (hostname: string): boolean => {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === 'littlefounders.ai' ||
        hostname === 'www.littlefounders.ai' ||
        // Match Vercel preview URLs (e.g. littlefounders-ai-git-main-username.vercel.app)
        // Ensure it doesn't match en.littlefounders.vercel.app if we ever do that
        (hostname.endsWith('.vercel.app') && !hostname.startsWith('es.') && !hostname.startsWith('en.'))
    );
};

// Helper to construct a new URL with a given language subdomain
const getSubdomainUrl = (lang: SupportedLanguage): string => {
    const currentDomain = window.location.hostname;

    // If we're already on a language subdomain, replace it
    if (currentDomain.startsWith('es.') || currentDomain.startsWith('en.')) {
        const newDomain = currentDomain.replace(/^(es|en)\./, `${lang}.`);
        return `${window.location.protocol}//${newDomain}${window.location.port ? `:${window.location.port}` : ''}${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    // If we're on a main domain and want to switch to a subdomain (optional, based on your logic)
    // For now, we only construct subdomain URLs if we were already on one, 
    // BUT the requirement states user wants es. or en.
    // If they are on littlefounders.ai and switch language, do we send them to es.littlefounders.ai?
    // Let's assume yes, if it's production.
    if (currentDomain === 'littlefounders.ai' || currentDomain === 'www.littlefounders.ai') {
        const baseDomain = currentDomain.replace(/^www\./, '');
        return `${window.location.protocol}//${lang}.${baseDomain}${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    // Default fallback (e.g. localhost) - just return current URL + something or handle elsewhere
    return window.location.href;
};

// Custom language detector that maps browser language to our supported languages
const getInitialLanguage = (): SupportedLanguage => {
    const hostname = window.location.hostname;

    // 1. Detect from subdomain (Overrides everything)
    if (hostname.startsWith('es.')) return 'es';
    if (hostname.startsWith('en.')) return 'en';

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
 * Change the current language and handle subdomain redirection if necessary
 * @param lang - Language code ('es' or 'en')
 */
export const changeLanguage = (lang: SupportedLanguage): Promise<void> => {
    const hostname = window.location.hostname;

    return i18n.changeLanguage(lang).then(() => {
        // Store preference in localStorage
        localStorage.setItem('littlefounders_language', lang);

        // Handle redirection
        if (isMainDomain(hostname)) {
            // If we are on littlefounders.ai and want to force them to the subdomain:
            if (hostname === 'littlefounders.ai' || hostname === 'www.littlefounders.ai') {
                window.location.href = getSubdomainUrl(lang);
            }
            // If localhost or vercel preview, just let i18n change the state without redirecting
            // (or optionally redirect to lang.localhost if configured locally, but usually not)
        } else {
            // We are on a subdomain (e.g., es.littlefounders.ai)
            // Redirect to the new subdomain
            const currentLang = hostname.startsWith('es.') ? 'es' : 'en';
            if (currentLang !== lang) {
                window.location.href = getSubdomainUrl(lang);
            }
        }
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
