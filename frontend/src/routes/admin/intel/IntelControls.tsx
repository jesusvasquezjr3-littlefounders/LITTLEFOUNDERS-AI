import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Dropdown, Icon, type DropdownOption } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminAction, useAdminData } from '../adminShared';
import { DateField } from '../analytics/DateField';
import { API_BASE_URL, todayIso } from '../analytics/analyticsShared';

/*
 * Window control, disclosure and export for the intelligence console.
 *
 * These three belong together because they answer the same question — "what
 * exactly am I looking at?" — which the console previously could not answer:
 * the period control reached four of seventeen requests, nothing said staff
 * traffic was 90% of the raw data, and there was no way to take a figure out.
 */

export interface IntelSelection {
  days: number;
  from?: string;
  to?: string;
}

export function intelWindowQuery(selection: IntelSelection): string {
  const base = `days=${selection.days}`;
  return selection.from && selection.to ? `${base}&from=${selection.from}&to=${selection.to}` : base;
}

const PRESET_DAYS = ['7', '30', '90', '365'] as const;
const CUSTOM = 'custom';

export function IntelPeriodPicker({
  selection,
  onChange,
}: {
  selection: IntelSelection;
  onChange: (selection: IntelSelection) => void;
}) {
  const { t } = useTranslation();
  const isCustom = Boolean(selection.from && selection.to);
  const [open, setOpen] = useState(isCustom);
  const [draft, setDraft] = useState({ from: selection.from ?? todayIso(), to: selection.to ?? todayIso() });

  const options: DropdownOption<string>[] = [
    ...PRESET_DAYS.map((value) => ({ value, label: t(`admin.intel.filters.days${value}`) })),
    { value: CUSTOM, label: t('admin.analytics.periods.custom') },
  ];

  const choose = (value: string): void => {
    if (value === CUSTOM) {
      setOpen(true);
      return;
    }
    setOpen(false);
    onChange({ days: Number(value) });
  };

  const apply = (): void => {
    const [from, to] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
    // `days` still travels: it is the fallback the API uses if a range is ever
    // dropped, and it keeps week-grained views (cohorts) meaningful.
    const span = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
    onChange({ days: span, from, to });
  };

  return (
    <div className="flex flex-col gap-2">
      <Dropdown
        value={isCustom ? CUSTOM : String(selection.days)}
        options={options}
        onChange={choose}
        ariaLabel={t('admin.intel.filters.period')}
        align="left"
      />
      {open && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-outline/50 bg-surface-sunken/40 p-3">
          <DateField
            label={t('admin.analytics.customFrom')}
            value={draft.from}
            max={todayIso()}
            onChange={(from) => setDraft((d) => ({ ...d, from }))}
          />
          <DateField
            label={t('admin.analytics.customTo')}
            value={draft.to}
            max={todayIso()}
            onChange={(to) => setDraft((d) => ({ ...d, to }))}
          />
          <AdminAction tone="primary" icon="check" onClick={apply}>
            {t('admin.analytics.customApply')}
          </AdminAction>
        </div>
      )}
    </div>
  );
}

/* ── Disclosure ─────────────────────────────────────────────────────────── */

interface StaffExclusion {
  windowDays: number;
  includedEvents: number;
  excludedEvents: number;
  excludedShare: number | null;
  staffUsers: number;
  includedAttempts: number;
  excludedAttempts: number;
  lastStaffEventAt: string | null;
}

/**
 * States, on screen, how much of the raw data this console is not showing.
 *
 * Without it an operator cannot tell a working filter from one that quietly
 * stopped, and both look like confident numbers. The share is worth watching in
 * its own right: it was 90% when the filter was introduced.
 */
export function StaffExclusionNote({ windowQuery }: { windowQuery: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<StaffExclusion>(`/admin/intel/quality/staff-exclusion?${windowQuery}`);

  if (data.state !== 'ready') return null;
  const { excludedEvents, excludedShare, staffUsers, excludedAttempts } = data.data;
  const pct = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });
  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-3',
        excludedShare !== null && excludedShare > 0.5
          ? 'border-warning/40 bg-warning-soft/30'
          : 'border-outline/40 bg-surface-sunken/30',
      )}
    >
      <Icon name="filter_alt" className="!text-[18px] text-primary" />
      <span className="lf-caption text-content">{t('admin.intel.staffExcluded.title')}</span>
      <Badge className="bg-surface-sunken text-content-muted">
        {t('admin.intel.staffExcluded.events', {
          count: excludedEvents,
          events: nf.format(excludedEvents),
          share: excludedShare === null ? '0%' : pct.format(excludedShare),
        })}
      </Badge>
      {excludedAttempts > 0 && (
        <Badge className="bg-surface-sunken text-content-muted">
          {t('admin.intel.staffExcluded.attempts', { count: excludedAttempts, attempts: nf.format(excludedAttempts) })}
        </Badge>
      )}
      <span className="lf-caption text-content-faint">
        {t('admin.intel.staffExcluded.accounts', { count: staffUsers })}
      </span>
    </div>
  );
}

/* ── Export ─────────────────────────────────────────────────────────────── */

const FORMATS = ['csv', 'xlsx'] as const;
type Format = (typeof FORMATS)[number];

/**
 * Takes the console's current window out as a file. The window travels with the
 * request, so the file cannot describe a different period than the screen did.
 */
export function IntelExportCard({ selection }: { selection: IntelSelection }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (format: Format): Promise<void> => {
    if (busy) return;
    setBusy(format);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/intel-export.${format}?${intelWindowQuery(selection)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setError(t(`errors.api.${body?.error?.code ?? 'INTERNAL'}`, { defaultValue: t('admin.intel.export.failed') }));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `littlefounders-intel.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('admin.intel.export.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="lf-caption text-content-muted">{t('admin.intel.export.label')}</span>
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((format) => (
          <AdminAction
            key={format}
            tone="neutral"
            icon={busy === format ? undefined : format === 'csv' ? 'description' : 'table_chart'}
            onClick={() => void download(format)}
            disabled={busy !== null}
          >
            {busy === format && <Icon name="progress_activity" className="!text-[16px] animate-spin" />}
            {t(`admin.intel.export.${format}`)}
          </AdminAction>
        ))}
      </div>
      {error && (
        <p role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      )}
    </div>
  );
}
