import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/routes/app/navConfig';
import type { Locale } from '@/i18n';
import { Button, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { Checkbox } from '@/components/ui/Checkbox';
import { AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';
import { SocialAuth } from './SocialAuth';

/*
 * Signup — every account starts as `universal` (server/DB enforced, zero
 * friction). The Tutor checkbox only records intent: the parent role itself
 * is granted exclusively by Guardian verification (/verify-parent).
 */
export function SignupPage() {
  const { t, i18n } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [parentIntent, setParentIntent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return;
    setSubmitting(true);
    setErrorCode(null);
    const { error, confirmationRequired } = await signup({
      email,
      password,
      displayName,
      locale: ((i18n.resolvedLanguage as Locale) ?? 'en-US'),
      parentIntent,
    });
    setSubmitting(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    if (confirmationRequired) {
      setConfirmationPending(true);
      return;
    }
    navigate(parentIntent ? '/verify-parent' : APP_HOME, { replace: true });
  }

  if (confirmationPending) {
    return (
      <AuthShell title={t('auth.signup.confirmTitle')}>
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
    <AuthShell
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.haveAccount')}{' '}
          <Link
            to="/login"
            className="lf-label rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.signup.loginLink')}
          </Link>
        </>
      }
    >
      <SocialAuth />
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
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
        <Checkbox
          label={t('auth.signup.tutorIntent')}
          help={t('auth.signup.tutorIntentHelp')}
          checked={parentIntent}
          onChange={(e) => setParentIntent(e.target.checked)}
        />
        <Button
          type="submit"
          disabled={submitting || !displayName || !email || password.length < 8}
          className="mt-1 w-full"
        >
          {submitting ? t('auth.signup.submitting') : t('auth.signup.submit')}
        </Button>
        <p className="lf-caption text-center text-content-muted">{t('auth.signup.universalNote')}</p>
      </form>
    </AuthShell>
  );
}
