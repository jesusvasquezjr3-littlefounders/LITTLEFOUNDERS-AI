import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Button, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { AuthShell } from './AuthShell';
import { ErrorBanner } from './ErrorBanner';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
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
    const error = await login(email, password);
    setSubmitting(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? '/', { replace: true });
  }

  return (
    <AuthShell
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link
            to="/signup"
            className="lf-label rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('auth.login.signupLink')}
          </Link>
        </>
      }
    >
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
    </AuthShell>
  );
}
