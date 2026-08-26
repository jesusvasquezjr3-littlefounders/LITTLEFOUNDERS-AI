import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { configureInsights, flushInsights, trackInsight } from '@/lib/insights';
import { playPlatformSound } from '@/lib/sound';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import type { Locale } from '@/i18n';
import { Button, DateField, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { Checkbox } from '@/components/ui/Checkbox';
import { AUTH_LINK_CLASS, AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';
import { SocialAuth } from './SocialAuth';

/*
 * Signup — every account starts as `universal` (server/DB enforced, zero
 * friction). The Tutor checkbox only records intent: the parent role itself
 * is granted exclusively by Guardian verification (/verify-parent).
 */
const MENTOR = '/marketing/mentor-liruf-bust.webp';

export function SignupPage() {
  const { t, i18n } = useTranslation();
  const { signup, getToken } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [parentIntent, setParentIntent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const startedRef = useRef(false);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const birthDateReady = BIRTH_DATE_RE.test(birthDate);

  // Funnel step 2 (/INSIGHTS.md): fired once, when the visitor first engages
  // with the form rather than merely landing on it — "started the signup" has
  // to mean intent, or the funnel's biggest drop is an artefact of pageviews.
  function markSignupStart() {
    if (startedRef.current) return;
    startedRef.current = true;
    trackInsight('signup_start', { routeClass: 'marketing' });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return;
    trackInsight('signup_submit', { routeClass: 'marketing' });
    setSubmitting(true);
    setErrorCode(null);
    const { error, confirmationRequired, analyticsEnabled } = await signup({
      email,
      password,
      displayName,
      locale: ((i18n.resolvedLanguage as Locale) ?? 'en-US'),
      parentIntent,
      birthDate,
    });
    setSubmitting(false);
    if (error) {
      playPlatformSound('auth_error');
      setErrorCode(error.code);
      return;
    }
    playPlatformSound('auth_success');
    // configureInsights() is called explicitly with the FRESH value signup()
    // just resolved, rather than waiting for the next render's
    // useInsightsBeacon effect to pick it up from context — otherwise this
    // event sits in insights.ts's pre-consent buffer, where a later
    // configureInsights() call can legitimately (and silently) discard it.
    configureInsights({ enabled: analyticsEnabled, getToken });
    // Funnel step 3 — the account exists (whether or not email confirmation
    // is still pending; that is a separate, later gate).
    trackInsight('signup_complete', { routeClass: 'marketing' });
    void flushInsights();
    if (confirmationRequired) {
      setConfirmationPending(true);
      return;
    }
    navigate(parentIntent ? '/verify-parent' : APP_HOME, { replace: true });
  }

  /*
   * A CHILD IS NOT TURNED AWAY FROM THE PRODUCT, only from handing us an
   * email. The guest path collects nothing at all, so the honest answer here
   * is the way forward rather than a closed door: keep learning now, and a
   * parent can create the real account from theirs later, keeping the progress.
   */
  if (errorCode === 'AGE_RESTRICTED') {
    return (
      <AuthShell character={MENTOR} title={t('auth.signup.ageBlockedTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
            <Icon name="escalator_warning" className="text-primary" />
          </span>
          <p className="lf-body text-content">{t('auth.signup.ageBlockedBody')}</p>
          <Link to="/">
            <Button>{t('auth.signup.ageBlockedCta')}</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (confirmationPending) {
    return (
      <AuthShell character={MENTOR} title={t('auth.signup.confirmTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <Icon name="mark_email_read" className="text-success-strong" />
          </span>
          <p className="lf-body text-content">{t('auth.signup.confirmBody', { email })}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell character={MENTOR}
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.haveAccount')}{' '}
          <Link
            to="/login"
            className={AUTH_LINK_CLASS}
          >
            {t('auth.signup.loginLink')}
          </Link>
        </>
      }
    >
      <SocialAuth />
      <form onSubmit={(e) => void onSubmit(e)} onFocusCapture={markSignupStart} noValidate className="flex flex-col gap-5">
        {errorCode && <ErrorBanner code={errorCode} />}
        <Field
          label={t('auth.signup.displayName')}
          autoComplete="name"
          required
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Field
          label={t('auth.signup.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t('auth.signup.password')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t('auth.signup.passwordHint')}
          error={passwordTooShort ? t('auth.signup.passwordTooShort') : undefined}
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
        <DateField
          label={t('auth.signup.birthDate')}
          hint={t('auth.signup.birthDateHint')}
          required
          value={birthDate}
          onChange={setBirthDate}
          dayLabel={t('auth.signup.dayLabel')}
          monthLabel={t('auth.signup.monthLabel')}
          yearLabel={t('auth.signup.yearLabel')}
        />
        <Checkbox
          label={t('auth.signup.tutorIntent')}
          help={t('auth.signup.tutorIntentHelp')}
          checked={parentIntent}
          onChange={(e) => setParentIntent(e.target.checked)}
        />
        <Button
          type="submit"
          disabled={submitting || !displayName || !email || password.length < 8 || !birthDateReady}
          className="mt-1 w-full"
        >
          {submitting ? t('auth.signup.submitting') : t('auth.signup.submit')}
        </Button>
        <p className="lf-caption text-center text-content-muted">{t('auth.signup.universalNote')}</p>
      </form>
    </AuthShell>
  );
}
