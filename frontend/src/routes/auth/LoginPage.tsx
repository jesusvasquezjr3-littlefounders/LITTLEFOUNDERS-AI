import { useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import { Button, Icon, SectionHeading } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { AUTH_LINK_CLASS, AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';
import { SocialAuth } from './SocialAuth';

const MENTOR = '/marketing/mentor-zara-bust.webp';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, getToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const detailsId = useId();

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
    <AuthShell character={MENTOR}
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link
            to="/signup"
            className={AUTH_LINK_CLASS}
          >
            {t('auth.login.signupLink')}
          </Link>
        </>
      }
    >
      <SocialAuth />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {errorCode && <ErrorBanner code={errorCode} />}
        {/*
          THE STUDY'S SECTION LOCKUP (/DESIGN.md §The study's component set).
          The two credential fields are a GROUP, and the lockup is how a group
          is named rather than how it is decorated — hence `aria-labelledby`,
          so the fieldset a screen reader meets has a title instead of being an
          unlabelled pair after an "or" divider. Accent, because the one
          primary action below selects in accent too.
        */}
        <section aria-labelledby={detailsId}>
          <SectionHeading as="h2" id={detailsId} icon="badge" tone="accent">
            {t('auth.section.details')}
          </SectionHeading>
          <div className="flex flex-col gap-5">
            {/* NOT `type="email"`. A child signs in with the username their parent
                chose, and an email-typed input gives them an email keyboard on a
                phone and a browser-level rejection of a perfectly valid handle.
                `autoComplete="username"` covers both shapes. */}
            <Field
              label={t('auth.login.identifier')}
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
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
              {/* Ghost tier: no surface, muted ink — it must never compete with
                  the one primary below it. */}
              <Link
                to="/forgot-password"
                className="lf-press lf-caption inline-flex min-h-11 items-center self-end rounded-full px-2 text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('auth.login.forgotPassword')}
              </Link>
            </div>
          </div>
        </section>
        {/* Primary tier, and the only one on the card. */}
        <Button type="submit" disabled={submitting || !email || !password} className="w-full">
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}
