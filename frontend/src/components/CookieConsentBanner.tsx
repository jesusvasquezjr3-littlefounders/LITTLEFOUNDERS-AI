import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { useShellLocale } from '@/app-shell/ShellRoot';
import { getCookieConsent, isMarketingRoute, setCookieConsent } from '@/lib/visitor';
import { RebuildEnvironmentContext } from '@/rebuild/design/layers';
import { CookieConsent, type CookieChoice } from '@/rebuild/site/CookieConsent';

/*
 * The bridge that mounts the rebuilt cookie choice (M8, rebuild/site/
 * CookieConsent.tsx) once, above every route (App.tsx), and keeps the
 * contract the rest of the app relies on:
 *
 *   - the choice is the public visitor's `lf` consent cookie (lib/visitor):
 *     unset until the visitor decides, and rejecting deletes the visitor id
 *     and the optional analytics cookies at once;
 *   - the banner shows only to a visitor with no session, on a public page
 *     (`isMarketingRoute`), once identity restoration has finished, until a
 *     choice is made; a signed-in account never sees it (a child's data is
 *     governed by the verified guardian's consent, a teen's by their own
 *     analytics choice);
 *   - `openCookiePreferences()` reopens the preferences from anywhere (the
 *     site footer, the Privacy Notice), for any reader, signed in or not;
 *   - `onDecision` tells App.tsx a choice was made, so measurement starts or
 *     stops immediately instead of on the next navigation.
 *
 * No legacy UI component crosses over (02 rule 23); the surface gets the
 * site's mode and language through the design system's environment context.
 */

const OPEN_PREFERENCES_EVENT = 'lf:open-cookie-preferences';

/** Reopens the cookie preferences (the site footer and the Privacy Notice use this). */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

export function CookieConsentBanner({ onDecision }: { onDecision?: (granted: boolean) => void }) {
  const { session, meLoaded } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
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
  const eligible = meLoaded && !session && isMarketingRoute(pathname);

  const decide = (granted: boolean) => {
    setCookieConsent(granted ? 'granted' : 'denied');
    setChoice(granted ? 'granted' : 'denied');
    setPreferencesOpen(false);
    onDecision?.(granted);
  };

  return <RebuildEnvironmentContext.Provider value={environment}>
    <CookieConsent locale={locale} bannerVisible={eligible && choice === 'unset'} choice={choice}
      preferencesOpen={preferencesOpen} onOpenPreferences={() => setPreferencesOpen(true)} onClosePreferences={() => setPreferencesOpen(false)}
      onDecide={decide} onNavigate={(href) => navigate(href)} />
  </RebuildEnvironmentContext.Provider>;
}

export default CookieConsentBanner;
