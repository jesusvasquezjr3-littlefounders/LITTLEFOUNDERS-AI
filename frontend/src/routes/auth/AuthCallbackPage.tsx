import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { AuthShell } from './AuthShell';

/*
 * OAuth landing. GoTrue redirects here after a social sign-in with the session in
 * the URL fragment (#access_token=…&refresh_token=…&expires_in=…) — or an error.
 * We hand the tokens to the shared session context (same as email login) and go
 * to the app. Tokens are scrubbed from the URL/history immediately.
 */
export function AuthCallbackPage() {
  const { completeOAuth, getToken } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const raw = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.search.slice(1);
    const params = new URLSearchParams(raw);
    const err = params.get('error_description') ?? params.get('error');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = Number(params.get('expires_in') ?? '3600');

    // Never leave tokens sitting in the address bar / history.
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
      /*
       * Social sign-in is a funnel path like any other, and it was the only
       * one that reported nothing. Google signups therefore never appeared as
       * conversions, and — worse — the retention prune later deleted their
       * anonymous visitor rows as non-converters, so the campaigns that
       * produced them read as permanently zero-yield.
       *
       * `newAccount` comes from Core (the client cannot tell a first-ever
       * Google sign-in from a returning one). configureInsights() is called
       * explicitly, right here, with the analyticsEnabled value completeOAuth
       * just resolved — waiting for useInsightsBeacon's own effect to pick it
       * up from context on the next render left this event sitting in
       * insights.ts's pre-consent buffer, where a later configureInsights()
       * call can legitimately (and silently) discard it. The flush is
       * immediate because the very next thing this component does is
       * navigate away.
       */
      configureInsights({ enabled: analyticsEnabled, getToken });
      trackInsight(newAccount ? 'signup_complete' : 'login_complete', { routeClass: 'marketing' });
      void flushInsights();
      navigate(APP_HOME, { replace: true });
    });
  }, [completeOAuth, getToken, navigate]);

  return (
    <AuthShell
      title={failed ? t('auth.social.callbackErrorTitle') : t('auth.social.callbackSigningIn')}
      subtitle={failed ? t('auth.social.callbackError') : undefined}
      footer={
        failed ? (
          <Link
            to="/login"
            className="lf-press lf-label rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.social.backToLogin')}
          </Link>
        ) : undefined
      }
    >
      <div className="flex items-center justify-center py-6" role="status" aria-live="polite">
        {failed ? (
          <span className="lf-body text-content-muted">{t('auth.social.callbackError')}</span>
        ) : (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-outline border-t-primary" />
        )}
      </div>
    </AuthShell>
  );
}
