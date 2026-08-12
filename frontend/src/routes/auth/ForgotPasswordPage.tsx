import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { playPlatformSound } from '@/lib/sound';
import { Button, Icon } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { AuthSplit } from './AuthSplit';

/*
 * Kicks off the recovery.html email (Courier). The backend always answers
 * `{sent: true}` — GoTrue never reveals whether the address has an account —
 * so this screen shows the SAME confirmation regardless of what was typed.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await api('/auth/recover', { method: 'POST', body: { email } });
    setSubmitting(false);
    playPlatformSound('auth_success');
    setSent(true);
  }

  if (sent) {
    return (
      <AuthSplit title={t('auth.forgotPassword.sentTitle')}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
            <Icon name="mark_email_read" className="text-success-strong" />
          </span>
          <p className="lf-body text-content">{t('auth.forgotPassword.sentBody', { email })}</p>
          <Link
            to="/login"
            className="lf-label rounded-sm text-[#ff775c] hover:text-[#e55f45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff775c]"
          >
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.subtitle')}
      footer={
        <Link
          to="/login"
          className="lf-label rounded-sm text-[#ff775c] hover:text-[#e55f45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff775c]"
        >
          {t('auth.forgotPassword.backToLogin')}
        </Link>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <Field
          label={t('auth.forgotPassword.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={submitting || !email} className="mt-1 w-full">
          {submitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
        </Button>
      </form>
    </AuthSplit>
  );
}
