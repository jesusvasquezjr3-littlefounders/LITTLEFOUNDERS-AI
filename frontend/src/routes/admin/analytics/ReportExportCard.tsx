import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Card, Icon } from '@/components/ui';
import { AdminAction } from '../adminShared';
import { API_BASE_URL, type Period } from './analyticsShared';

/*
 * Branded, watermarked PDF reports per team. /admin/analytics/report.pdf is
 * the ONE raw (non-envelope) admin route, and it requires the Bearer header —
 * so a plain <a href> can't do it: we fetch the bytes, read them as a blob and
 * trigger the download through a temporary object-URL anchor. On non-2xx the
 * backend falls back to the JSON envelope; we surface that error inline
 * instead of downloading garbage.
 */

const AUDIENCES = ['marketing', 'sales', 'frontend', 'full'] as const;
type Audience = (typeof AUDIENCES)[number];

const AUDIENCE_ICONS: Record<Audience, string> = {
  marketing: 'campaign',
  sales: 'storefront',
  frontend: 'code',
  full: 'summarize',
};

function filenameFrom(disposition: string | null, audience: Audience, period: Period): string {
  const name = disposition?.match(/filename="([^"]+)"/)?.[1];
  return name ?? `littlefounders-analytics-${audience}-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

export function ReportExportCard({ period, filterQuery }: { period: Period; filterQuery: string }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState<Audience | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (audience: Audience) => {
    if (busy) return;
    setBusy(audience);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/analytics/report.pdf?period=${period}&audience=${audience}${filterQuery}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        const code = body?.error?.code ?? 'INTERNAL';
        setError(t(`errors.api.${code}`, { defaultValue: t('admin.analytics.reports.failed') }));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filenameFrom(res.headers.get('content-disposition'), audience, period);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('admin.analytics.reports.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="lf-title flex items-center gap-2">
        <Icon name="picture_as_pdf" className="!text-[20px] text-content-muted" />
        {t('admin.analytics.reports.title')}
      </h3>
      <p className="lf-caption text-content-muted">{t('admin.analytics.reports.caption')}</p>
      <div className="flex flex-wrap gap-2">
        {AUDIENCES.map((audience) => (
          <AdminAction
            key={audience}
            tone="primary"
            icon={busy === audience ? undefined : AUDIENCE_ICONS[audience]}
            onClick={() => void download(audience)}
            disabled={busy !== null}
          >
            {busy === audience && <Icon name="progress_activity" className="!text-[16px] animate-spin" />}
            {t(`admin.analytics.reports.audiences.${audience}`)}
          </AdminAction>
        ))}
      </div>
      {error && (
        <p role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      )}
    </Card>
  );
}
