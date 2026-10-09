import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/theme/useTheme';
import { useShellLocale } from '@/ShellRoot';
import { getCookieConsent, setCookieConsent } from '@/lib/visitor';
import { RebuildEnvironmentContext } from '@/rebuild/design/layers';
import { CookieConsent, type CookieChoice } from '@/rebuild/site/CookieConsent';

/*
 * Mounts the cookie choice (rebuild/site/CookieConsent.tsx) once, above the
 * page. The choice is stored by lib/visitor and stays unset until the visitor
 * decides. `openCookiePreferences()` reopens the preferences from anywhere
 * (the site footer); `onDecision` tells the app a choice was made, so
 * measurement starts or stops immediately.
 */

const OPEN_PREFERENCES_EVENT = 'lf:open-cookie-preferences';

/** Reopens the cookie preferences (the site footer uses this). */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

export function CookieConsentBanner({ onDecision }: { onDecision?: (granted: boolean) => void }) {
  const { isDark } = useTheme();
  const locale = useShellLocale();
  const [choice, setChoice] = useState<CookieChoice>(getCookieConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => {
      setChoice(getCookieConsent());
      setPreferencesOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  const environment = useMemo(() => ({ theme: isDark ? 'dark' as const : 'light' as const, locale }), [isDark, locale]);

  const decide = (granted: boolean) => {
    setCookieConsent(granted ? 'granted' : 'denied');
    setChoice(granted ? 'granted' : 'denied');
    setPreferencesOpen(false);
    onDecision?.(granted);
  };

  return <RebuildEnvironmentContext.Provider value={environment}>
    <CookieConsent locale={locale} bannerVisible={choice === 'unset'} choice={choice}
      preferencesOpen={preferencesOpen} onOpenPreferences={() => setPreferencesOpen(true)} onClosePreferences={() => setPreferencesOpen(false)}
      onDecide={decide} />
  </RebuildEnvironmentContext.Provider>;
}
