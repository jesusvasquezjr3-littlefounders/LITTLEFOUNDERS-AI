import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { AuthShell } from './AuthShell';

/*
 * OAuth landing. GoTrue redirects here after a social sign-in with the session in
 * the URL fragment (#access_token=…&refresh_token=…&expires_in=…) — or an error.
 * We hand the tokens to the shared session context (same as email login) and go
 * to the app. Tokens are scrubbed from the URL/history immediately.
 */
export function AuthCallbackPage() {
  const { completeOAuth } = useAuth();
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
      setFailed(true);
      return;
    }
    void completeOAuth({ accessToken, refreshToken, expiresIn }).then((e) => {
      if (e) setFailed(true);
      else navigate(APP_HOME, { replace: true });
    });
  }, [completeOAuth, navigate]);

  return (
    <AuthShell
      title={failed ? t('auth.social.callbackErrorTitle') : t('auth.social.callbackSigningIn')}
      subtitle={failed ? t('auth.social.callbackError') : undefined}
      footer={
        failed ? (
          <Link
            to="/login"
            className="lf-label rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
