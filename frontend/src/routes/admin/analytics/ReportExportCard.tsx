import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Card, Dropdown, Icon, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction } from '../adminShared';
import { API_BASE_URL, type PeriodQuery } from './analyticsShared';

/*
 * Report exports. The three formats are one query rendered three ways, so a
 * PDF mailed to a partner and the spreadsheet someone pivots from cannot
 * disagree about the window, the filters or the figures.
 *
 * These are the ONE class of raw (non-envelope) admin route, and they need the
 * Bearer header, which a plain <a href> cannot carry: fetch the bytes, read
 * them as a blob, download through a temporary object-URL anchor. On non-2xx
 * the backend still answers the JSON envelope, surfaced inline instead of
 * downloading garbage.
 */

const AUDIENCES = ['marketing', 'sales', 'frontend', 'full'] as const;
type Audience = (typeof AUDIENCES)[number];

const FORMATS = [
  { id: 'pdf', icon: 'picture_as_pdf', extension: 'pdf' },
  { id: 'xlsx', icon: 'table_chart', extension: 'xlsx' },
  { id: 'csv', icon: 'description', extension: 'csv' },
] as const;
type Format = (typeof FORMATS)[number]['id'];

const AUDIENCE_ICONS: Record<Audience, string> = {
  marketing: 'campaign',
  sales: 'storefront',
  frontend: 'code',
  full: 'summarize',
};

/** Rows per breakdown. A PDF page holds about ten; a spreadsheet is where you go for more. */
const ROW_CHOICES = ['10', '25', '50', '200'] as const;
type RowChoice = (typeof ROW_CHOICES)[number];

function filenameFrom(disposition: string | null, audience: Audience, extension: string): string {
  const name = disposition?.match(/filename="([^"]+)"/)?.[1];
  return name ?? `littlefounders-analytics-${audience}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function ReportExportCard({ periodQuery, filterQuery }: { periodQuery: PeriodQuery; filterQuery: string }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [audience, setAudience] = useState<Audience>('full');
  const [format, setFormat] = useState<Format>('pdf');
  const [rows, setRows] = useState<RowChoice>('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const chosen = FORMATS.find((item) => item.id === format) ?? FORMATS[0];
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/analytics/report.${chosen.extension}?${periodQuery}&audience=${audience}&rows=${rows}${filterQuery}`,
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
      anchor.download = filenameFrom(res.headers.get('content-disposition'), audience, chosen.extension);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('admin.analytics.reports.failed'));
    } finally {
      setBusy(false);
    }
  };

  const audienceOptions: DropdownOption<Audience>[] = AUDIENCES.map((item) => ({
    value: item,
    label: t(`admin.analytics.reports.audiences.${item}`),
  }));
  const rowOptions: DropdownOption<RowChoice>[] = ROW_CHOICES.map((value) => ({
    value,
    label: t('admin.analytics.reports.rowsOption', { count: Number(value) }),
  }));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="lf-title flex items-center gap-2 text-content">
          <Icon name="download" className="!text-[20px] text-primary" />
          {t('admin.analytics.reports.title')}
        </h3>
        <p className="lf-caption mt-1 text-content-muted">{t('admin.analytics.reports.caption')}</p>
      </div>

      {/* Format first: it is the choice that changes what the file is for. */}
      <div className="flex flex-col gap-2">
        <span className="lf-label font-bold text-content">{t('admin.analytics.reports.formatLabel')}</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('admin.analytics.reports.formatLabel')}>
          {FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={format === item.id}
              onClick={() => setFormat(item.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                format === item.id
                  ? 'border-primary/60 bg-primary-soft/40'
                  : 'border-outline/40 bg-surface-sunken/30 hover:border-outline',
              )}
            >
              <Icon name={item.icon} className={cn('!text-[22px]', format === item.id ? 'text-primary' : 'text-content-muted')} />
              <span className="min-w-0">
                <span className="lf-label block font-bold text-content">{t(`admin.analytics.reports.formats.${item.id}.name`)}</span>
                <span className="lf-caption block text-content-muted">{t(`admin.analytics.reports.formats.${item.id}.hint`)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
        <div className="flex flex-col gap-2">
          <span className="lf-label font-bold text-content">{t('admin.analytics.reports.rowsLabel')}</span>
          <Dropdown
            value={rows}
            options={rowOptions}
            onChange={setRows}
            ariaLabel={t('admin.analytics.reports.rowsLabel')}
            align="left"
          />
          <p className="lf-caption text-content-muted">{t('admin.analytics.reports.rowsHint')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/40 bg-surface-sunken/30 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={AUDIENCE_ICONS[audience]} className="!text-[20px] text-primary" />
          <span className="lf-caption truncate text-content-muted">
            {t('admin.analytics.reports.currentSelection', {
              audience: t(`admin.analytics.reports.audiences.${audience}`),
            })}
          </span>
        </div>
        <AdminAction tone="primary" icon={busy ? undefined : 'download'} onClick={() => void download()} disabled={busy}>
          {busy && <Icon name="progress_activity" className="!text-[16px] animate-spin" />}
          {t('admin.analytics.reports.download')}
        </AdminAction>
      </div>

      <p className="lf-caption text-content-faint">{t('admin.analytics.reports.provenance')}</p>

      {error && (
        <p role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      )}
    </Card>
  );
}
