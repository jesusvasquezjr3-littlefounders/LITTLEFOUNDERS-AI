import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { OAuthCallbackScreen } from '@/rebuild/identity/RecoveryScreens';

/*
 * `/auth/callback` (A5): GoTrue returns here after a Google sign-in with the
 * session in the URL fragment, or an error. The tokens go to the shared
 * session (as an email sign-in does) and leave the address bar and history at
 * once; the entry is replaced, so Back cannot replay it.
 *
 * Then Learn, through RequireAuth: an account Core has not screened (every
 * first Google sign-in) meets the mandatory age question before anything else
 * opens (A.3). This page never decides that itself.
 *
 * Funnel: Core says whether the account was created just now (the client
 * cannot tell), so a first Google sign-in reports `signup_complete` and a
 * returning one `login_complete`, with the analytics permission Core just
 * resolved, flushed before the navigation leaves the page.
 */
export function AuthCallbackPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const { completeOAuth, getToken } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search.slice(1);
    const params = new URLSearchParams(raw);
    const err = params.get('error_description') ?? params.get('error');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = Number(params.get('expires_in') ?? '3600');
    window.history.replaceState(null, '', window.location.pathname);

    if (err || !accessToken || !refreshToken) {
      playPlatformSound('auth_error');
      setFailed(true);
      return;
    }
    void completeOAuth({ accessToken, refreshToken, expiresIn }).then(({ error, newAccount, analyticsEnabled }) => {
      if (error) {
        playPlatformSound('auth_error');
        setFailed(true);
        return;
      }
      playPlatformSound('auth_success');
      configureInsights({ enabled: analyticsEnabled, getToken });
      trackInsight(newAccount ? 'signup_complete' : 'login_complete', { routeClass: 'marketing' });
      void flushInsights();
      navigate(APP_HOME, { replace: true });
    });
  }, [completeOAuth, getToken, navigate]);

  return <OAuthCallbackScreen locale={locale} failed={failed} onNavigate={onNavigate} />;
}
