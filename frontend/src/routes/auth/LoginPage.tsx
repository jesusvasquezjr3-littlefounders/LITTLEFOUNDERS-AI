import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { AuthSplit } from './AuthSplit';
import { ErrorBanner } from './ErrorBanner';
import { SocialAuth } from './SocialAuth';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, getToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorCode(null);
    const { error, analyticsEnabled } = await login(email, password);
    setSubmitting(false);
    if (error) {
      playPlatformSound('auth_error');
      setErrorCode(error.code);
      return;
    }
    playPlatformSound('auth_success');
    // configureInsights() is called explicitly with the FRESH value login()
    // just resolved, rather than waiting for the next render's
    // useInsightsBeacon effect to pick it up from context — otherwise this
    // event sits in insights.ts's pre-consent buffer, where a later
    // configureInsights() call can legitimately (and silently) discard it.
    configureInsights({ enabled: analyticsEnabled, getToken });
    // Returning-user signal — the numerator of "do they come back at all",
    // distinct from signup_complete which only ever fires once per account.
    trackInsight('login_complete', { routeClass: 'marketing' });
    void flushInsights();
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? APP_HOME, { replace: true });
  }

  return (
    <AuthSplit
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link
            to="/signup"
            className="lf-label rounded-sm text-[#ff775c] hover:text-[#e55f45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff775c]"
          >
            {t('auth.login.signupLink')}
          </Link>
        </>
      }
    >
      <SocialAuth />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {errorCode && <ErrorBanner code={errorCode} />}
        <Field
          label={t('auth.login.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t('auth.login.password')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        <Button type="submit" disabled={submitting || !email || !password} className="mt-1 w-full">
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
    </AuthSplit>
  );
}
