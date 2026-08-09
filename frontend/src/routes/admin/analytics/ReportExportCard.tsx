import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Card, Dropdown, Icon, type DropdownOption } from '@/components/ui';
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
  const [audience, setAudience] = useState<Audience>('full');
  const [busy, setBusy] = useState<Audience | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
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

  const audienceOptions: DropdownOption<Audience>[] = AUDIENCES.map((item) => ({
    value: item,
    label: t(`admin.analytics.reports.audiences.${item}`),
  }));

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="lf-title flex items-center gap-2">
        <Icon name="picture_as_pdf" className="!text-[20px] text-content-muted" />
        {t('admin.analytics.reports.title')}
      </h3>
      <p className="lf-caption text-content-muted">{t('admin.analytics.reports.caption')}</p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] md:items-end">
        <div className="flex flex-col gap-2">
          <span className="lf-label font-bold text-content">{t('admin.analytics.reports.audienceLabel')}</span>
          <Dropdown
            value={audience}
            options={audienceOptions}
            onChange={setAudience}
            ariaLabel={t('admin.analytics.reports.audienceLabel')}
            align="left"
          />
          <p className="lf-caption text-content-muted">{t(`admin.analytics.reports.descriptions.${audience}`)}</p>
        </div>
        <div className="rounded-xl border border-outline/40 bg-surface-sunken/40 p-3">
          <p className="lf-caption font-bold text-content-muted">{t('admin.analytics.reports.includesTitle')}</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 md:grid-cols-1">
            {(['summary', 'trend', 'segments', 'tables'] as const).map((item) => (
              <li key={item} className="lf-caption flex items-center gap-2 text-content">
                <Icon name="check" className="!text-[16px] text-success-strong" />
                {t(`admin.analytics.reports.includes.${item}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/40 bg-surface-sunken/30 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={AUDIENCE_ICONS[audience]} className="!text-[20px] text-primary" />
          <span className="lf-caption truncate text-content-muted">{t('admin.analytics.reports.currentSelection', { audience: t(`admin.analytics.reports.audiences.${audience}`) })}</span>
        </div>
        <AdminAction tone="primary" icon={busy === audience ? undefined : 'download'} onClick={() => void download()} disabled={busy !== null}>
          {busy === audience && <Icon name="progress_activity" className="!text-[16px] animate-spin" />}
          {t('admin.analytics.reports.download')}
        </AdminAction>
      </div>
      {error && (
        <p role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      )}
    </Card>
  );
}
