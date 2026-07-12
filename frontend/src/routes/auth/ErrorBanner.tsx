import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';

/** Inline API-error banner — code resolves through errors.api.<code>. */
export function ErrorBanner({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-error/40 bg-error-soft px-4 py-3"
    >
      <Icon name="error" className="mt-0.5 shrink-0 text-error-strong" />
      <p className="lf-body text-content">
        {t(`errors.api.${code}`, { defaultValue: t('errors.api.INTERNAL') })}
      </p>
    </div>
  );
}
