import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { playPlatformSound } from '@/lib/sound';
import { Button, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { AUTH_LINK_CLASS, AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';

/*
 * Landing page for the recovery.html link (GoTrue redirect_to=/reset-password
 * — backend/src/routes/auth.ts POST /recover). GoTrue hands back a SHORT-
 * LIVED `type=recovery` session in the URL fragment, same shape as the OAuth
 * callback — but unlike AuthCallbackPage this token is NEVER persisted as a
 * normal session: it exists only to authorize the one POST /reset-password
 * call below, then the user signs in fresh with the new password.
 */
const MENTOR = '/marketing/mentor-rho-bust.webp';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const ran = useRef(false);

  const [recoveryToken, setRecoveryToken] = useState<string | null | undefined>(undefined); // undefined = still parsing
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search.slice(1);
    const params = new URLSearchParams(raw);
    const accessToken = params.get('access_token');
    // Never leave the recovery token sitting in the address bar / history.
    window.history.replaceState(null, '', window.location.pathname);
    setRecoveryToken(accessToken);
  }, []);

  const passwordTooShort = password.length > 0 && password.length < 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8 || !recoveryToken) return;
    setSubmitting(true);
    setErrorCode(null);
    const { error } = await api('/auth/reset-password', { method: 'POST', token: recoveryToken, body: { password } });
    setSubmitting(false);
    if (error) {
      playPlatformSound('auth_error');
      setErrorCode(error.code);
      return;
    }
    playPlatformSound('auth_success');
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell character={MENTOR} title={t('auth.resetPassword.doneTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <Icon name="check_circle" className="text-success-strong" />
          </span>
          <p className="lf-body text-content">{t('auth.resetPassword.doneBody')}</p>
          <Link
            to="/login"
            className={AUTH_LINK_CLASS}
          >
            {t('auth.resetPassword.goToLogin')}
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (recoveryToken === null) {
    return (
      <AuthShell character={MENTOR} title={t('auth.resetPassword.expiredTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="lf-body text-content-muted">{t('auth.resetPassword.expiredBody')}</p>
          <Link
            to="/forgot-password"
            className={AUTH_LINK_CLASS}
          >
            {t('auth.resetPassword.requestNew')}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell character={MENTOR} title={t('auth.resetPassword.title')} subtitle={t('auth.resetPassword.subtitle')}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5" aria-busy={recoveryToken === undefined}>
        {errorCode && <ErrorBanner code={errorCode} />}
        <Field
          label={t('auth.resetPassword.password')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t('auth.resetPassword.passwordHint')}
          error={passwordTooShort ? t('auth.resetPassword.passwordTooShort') : undefined}
          trailing={
            <button
              type="button"
              aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
            </button>
          }
        />
        <Button type="submit" disabled={submitting || recoveryToken === undefined || password.length < 8} className="mt-1 w-full">
          {submitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
