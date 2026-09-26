import { useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { Button, Icon, SectionHeading } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';

/*
 * Attaches a permanent email+password identity to the CURRENT guest session,
 * in place — never the normal /signup, which would mint a second, blank
 * identity. Same auth.users.id afterward, so progress/streak/profile carry
 * over with zero data migration (see AuthContext.upgradeAccount).
 */
const MENTOR = '/marketing/mentor-zara-bust.webp';

export function UpgradeAccountPage() {
  const { t } = useTranslation();
  const { isGuest, upgradeAccount } = useAuth();
  const navigate = useNavigate();
  const detailsId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (!isGuest) return <Navigate to={APP_HOME} replace />;

  const passwordTooShort = password.length > 0 && password.length < 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return;
    setSubmitting(true);
    setErrorCode(null);
    const { error } = await upgradeAccount({ email, password });
    setSubmitting(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    navigate(APP_HOME, { replace: true });
  }

  return (
    <AuthShell character={MENTOR} title={t('auth.upgrade.title')} subtitle={t('auth.upgrade.subtitle')}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        {errorCode && <ErrorBanner code={errorCode} />}
        <section aria-labelledby={detailsId}>
          <SectionHeading as="h2" id={detailsId} icon="badge" tone="accent">
            {t('auth.section.details')}
          </SectionHeading>
          <div className="flex flex-col gap-5">
            <Field
              label={t('auth.upgrade.email')}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label={t('auth.upgrade.password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={t('auth.upgrade.passwordHint')}
              error={passwordTooShort ? t('auth.upgrade.passwordTooShort') : undefined}
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
          </div>
        </section>
        {/*
          THE ACTION ROW, IN THE STUDY'S TIERS: ghost (no surface, muted ink)
          then primary (solid accent). They were stacked as two full-width
          blocks, which reads as two calls to action of equal weight — and this
          screen exists precisely to make ONE of them the obvious answer.
          `flex-col-reverse` keeps the primary FIRST on a phone, where a single
          column has no left and right to order by.
        */}
        <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate(APP_HOME)}
            className="lf-press lf-label inline-flex min-h-11 items-center justify-center rounded-full px-4 text-content-muted transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.upgrade.later')}
          </button>
          <Button type="submit" disabled={submitting || !email || password.length < 8} className="w-full sm:w-auto">
            {submitting ? t('auth.upgrade.submitting') : t('auth.upgrade.submit')}
          </Button>
        </div>
        <p className="lf-body text-center text-content-muted">
          {t('auth.upgrade.loginPrompt')}{' '}
          <Link
            to="/login"
            className="lf-press lf-label rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.upgrade.loginLink')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
