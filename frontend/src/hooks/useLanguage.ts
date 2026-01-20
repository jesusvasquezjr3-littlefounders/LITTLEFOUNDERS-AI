/**
 * useLanguage Hook
 * 
 * Custom hook for language management in LittleFounders.
 * Provides easy access to language switching and current language state.
 * 
 * Usage:
 * ```tsx
 * const { currentLanguage, changeLanguage, languages, isCurrentLanguage } = useLanguage();
 * ```
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SupportedLanguage,
    SUPPORTED_LANGUAGES,
    LANGUAGE_NAMES,
    LANGUAGE_FLAGS,
    changeLanguage as i18nChangeLanguage,
    getCurrentLanguage,
} from '@/i18n';

export interface LanguageOption {
    code: SupportedLanguage;
    name: string;
    flag: string;
}

export function useLanguage() {
    const { i18n } = useTranslation();

    /**
     * Current active language code
     */
    const currentLanguage = useMemo<SupportedLanguage>(() => {
        return getCurrentLanguage();
    }, [i18n.language]);

    /**
     * List of all available languages with metadata
     */
    const languages = useMemo<LanguageOption[]>(() => {
        return SUPPORTED_LANGUAGES.map((code) => ({
            code,
            name: LANGUAGE_NAMES[code],
            flag: LANGUAGE_FLAGS[code],
        }));
    }, []);

    /**
     * Change the current language
     */
    const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
        await i18nChangeLanguage(lang);
    }, []);

    /**
     * Check if a language is the current one
     */
    const isCurrentLanguage = useCallback(
        (lang: SupportedLanguage) => {
            return currentLanguage === lang;
        },
        [currentLanguage]
    );

    /**
     * Get display info for current language
     */
    const currentLanguageInfo = useMemo<LanguageOption>(() => {
        return {
            code: currentLanguage,
            name: LANGUAGE_NAMES[currentLanguage],
            flag: LANGUAGE_FLAGS[currentLanguage],
        };
    }, [currentLanguage]);

    return {
        currentLanguage,
        currentLanguageInfo,
        languages,
        changeLanguage,
        isCurrentLanguage,
    };
}

export default useLanguage;
