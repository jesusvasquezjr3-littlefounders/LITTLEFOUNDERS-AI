import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { asLocale, type ConsoleLocale } from '@/rebuild/family/console/consoleParts';
import type { ConsoleTransport } from '@/rebuild/family/console/consoleApi';

/*
 * W2F.1 route adapters: bind the rebuilt Family console (which imports
 * nothing outside the rebuild) to the application's Core client, session,
 * language and mode. A fresh token per call (getToken refreshes an expiring
 * session). A failure while the browser reports no connection is NETWORK, so
 * the screens can say "offline" instead of "our side"; Core's message is
 * never read or shown, only its code.
 */
export function useConsoleTransport(): ConsoleTransport {
  const { getToken } = useAuth();
  return useMemo<ConsoleTransport>(() => async (path, options = {}) => {
    const token = await getToken();
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    const result = await api<unknown>(path, { method: options.method, body: options.body, token });
    if (result.error) return { data: null, error: { code: typeof navigator !== 'undefined' && navigator.onLine === false ? 'NETWORK' : result.error.code } };
    return { data: result.data, error: null };
  }, [getToken]);
}

export function useConsoleEnvironment(): { locale: ConsoleLocale; dark: boolean; family: (typeof rebuildNamespaceCopy)['en-US']['family']; copy: (typeof rebuildNamespaceCopy)['en-US'] } {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = asLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en-US');
  const copy = rebuildNamespaceCopy[locale];
  return { locale, dark: isDark, family: copy.family, copy };
}

/** The Family console's address for one child, so every way back returns to the child it came from. */
export const familyHref = (kidId: string) => `/family?child=${encodeURIComponent(kidId)}`;
