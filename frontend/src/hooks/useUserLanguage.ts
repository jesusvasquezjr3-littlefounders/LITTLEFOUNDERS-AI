/**
 * useUserLanguage Hook
 * 
 * Syncs language preference with the backend for authenticated users.
 * Automatically loads user's saved language preference on login,
 * and saves changes to the backend when language is changed.
 * 
 * Usage:
 * ```tsx
 * const { syncLanguagePreference, saveLanguagePreference } = useUserLanguage();
 * 
 * // On login, sync with backend
 * useEffect(() => { syncLanguagePreference(); }, [isLoggedIn]);
 * 
 * // When user changes language
 * const handleLanguageChange = async (lang: string) => {
 *   await saveLanguagePreference(lang);
 * };
 * ```
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '@/config/api';
import { changeLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
import { useToast } from "@/hooks/use-toast";

interface LanguagePreferenceResponse {
    language: string;
    supported_languages: string[];
}

export function useUserLanguage() {
    const { i18n } = useTranslation();
    const { toast } = useToast();

    /**
     * Get auth token from localStorage
     */
    const getToken = useCallback((): string | null => {
        return localStorage.getItem('token');
    }, []);

    /**
     * Check if user is logged in
     */
    const isAuthenticated = useCallback((): boolean => {
        return !!getToken();
    }, [getToken]);

    /**
     * Fetch user's language preference from backend and apply it
     */
    const syncLanguagePreference = useCallback(async (): Promise<void> => {
        const token = getToken();
        if (!token) {
            // Not authenticated, use localStorage or browser detection
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/preferences/language`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data: LanguagePreferenceResponse = await response.json();

                // Only update if the language is different and supported
                if (
                    data.language &&
                    SUPPORTED_LANGUAGES.includes(data.language as SupportedLanguage) &&
                    data.language !== i18n.language
                ) {
                    await changeLanguage(data.language as SupportedLanguage);
                }
            } else if (response.status === 401) {
                // Token invalid or expired
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                console.warn('Session expired, clearing token');
                // Optional: Notify user
                // toast({
                //     title: "Sesión expirada",
                //     description: "Por favor, inicia sesión nuevamente.",
                //     variant: "destructive",
                // });
            }
        } catch (error) {
            console.warn('Failed to sync language preference:', error);
            // Silently fail - user can still use the app with local preference
        }
    }, [getToken, i18n.language]);

    /**
     * Save user's language preference to backend
     */
    const saveLanguagePreference = useCallback(async (language: SupportedLanguage): Promise<boolean> => {
        const token = getToken();
        let backendSuccess = true;

        if (token) {
            try {
                const response = await fetch(`${API_URL}/auth/preferences/language`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ language }),
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }

                backendSuccess = response.ok;
            } catch (error) {
                console.warn('Failed to save language preference to backend:', error);
                // Continue with local change even if backend fails
                backendSuccess = false;
            }
        }

        // Apply local change (client-side only, no redirect)
        await changeLanguage(language);

        return backendSuccess;
    }, [getToken]);

    return {
        syncLanguagePreference,
        saveLanguagePreference,
        isAuthenticated,
    };
}

export default useUserLanguage;
