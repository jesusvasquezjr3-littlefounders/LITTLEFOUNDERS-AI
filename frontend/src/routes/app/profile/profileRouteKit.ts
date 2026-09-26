import { useAuth } from '@/auth/AuthContext';
import { useShellLocale } from '@/app-shell/ShellRoot';
import { useTheme } from '@/theme/useTheme';
import type { ApiError } from '@/lib/api';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * What the profile lane's rebuilt routes share (W2): the application's
 * language and mode as the rebuilt screens take them, the lane's own copy in
 * that language, and the few account facts a screen needs for its tier rules.
 * These are data-plane helpers only; the screens import no legacy UI.
 */

const COPY = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
export type ProfileNamespace = typeof en;

export function useProfileScreenEnvironment() {
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const { roles } = useAuth();
  const kid = roles.includes('kid');
  return {
    locale,
    dark: isDark,
    copy: COPY[locale] as ProfileNamespace,
    /** A.6: the kid role (a parent-created child). Display only: Core decides every rule again. */
    kid,
    /** The youngest copy budget for a child's account (06 §3.1): conservative for every child. */
    ageBand: kid ? ('6-9' as const) : undefined,
  };
}

/** A request that never reached Core (the network, not the server, failed). */
export function isOffline(error: ApiError | null | undefined): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return error?.code === 'INTERNAL' && error.message === 'Network error';
}
