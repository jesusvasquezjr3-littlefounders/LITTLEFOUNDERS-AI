import { useTranslation } from 'react-i18next';
import { Card, Icon, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAdminData } from '../adminShared';
import {
  countryLabel,
  type BehaviorBreakdownData,
  type BehaviorDimensionKey,
  type BehaviorRow,
  type PeriodQuery,
} from './analyticsShared';

/*
 * One behavioural top-N (Core /admin/analytics/behavior/breakdown → Umami).
 *
 * Sibling of BreakdownCard, deliberately NOT a shared component: Plausible
 * rows carry two metrics (visitors + pageviews) and Umami rows carry one, so
 * merging them would mean a column that is empty half the time. Same grid
 * cell, same overflow discipline, same three states.
 *
 * Percentages are computed against the sum of the ROWS SHOWN, not a total
 * fetched separately, and the card says so — a share that silently measures
 * against a different denominator than the list it sits on is worse than no
 * share at all.
 */

function PanelNote({ icon, text, spin }: { icon: string; text: string; spin?: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center shadow-glass border border-outline/50">
      <Icon name={icon} className={cn('!text-[28px] text-content-faint', spin && 'animate-spin')} />
      <p className="lf-caption text-content-muted">{text}</p>
    </Card>
  );
}

/** Human label for a raw Umami value, per dimension. */
function rowLabel(
  dimension: BehaviorDimensionKey,
  raw: string,
  locale: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  // Umami returns an empty value for "not recorded" — no referrer, unknown
  // region. Those rows are kept (dropping them makes the column stop summing
  // to the total) and named, because a blank cell reads as a rendering bug.
  if (raw === '') return t('admin.analytics.behavior.notRecorded');
  if (dimension === 'country') return countryLabel(raw, locale);
  if (dimension === 'language') {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(raw) ?? raw;
    } catch {
      return raw;
    }
  }
  if (dimension === 'region') {
    /*
     * Umami reports ISO 3166-2 ("MX-CMX"), which is genuinely better than
     * Plausible's plain names here — the country half is resolvable, so show
     * "CMX · México" rather than an opaque code.
     */
    const [country, sub] = raw.split('-');
    if (country && sub) return `${sub} · ${countryLabel(country, locale)}`;
    return raw;
  }
  return raw;
}

export function BehaviorBreakdownCard({
  dimension,
  icon,
  periodQuery,
}: {
  dimension: BehaviorDimensionKey;
  icon: string;
  periodQuery: PeriodQuery;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const { data } = useAdminData<BehaviorBreakdownData>(
    `/admin/analytics/behavior/breakdown?${periodQuery}&dimension=${dimension}&limit=8`,
  );
  const nf = new Intl.NumberFormat(locale);
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const title = t(`admin.analytics.behavior.dimensions.${dimension}`);

  if (data.state === 'loading') return <PanelNote icon="progress_activity" text={t('admin.loading')} spin />;
  if (data.state === 'error') {
    // Never an empty table: "Umami did not answer" and "no behaviour recorded"
    // must not look the same on screen.
    return <PanelNote icon="cloud_off" text={t(`errors.api.${data.code}`, { defaultValue: t('admin.analytics.unavailableBody') })} />;
  }

  const rows = data.data.rows;
  const shown = rows.reduce((sum, r) => sum + r.value, 0);

  const columns: TableColumn<BehaviorRow>[] = [
    {
      key: 'label',
      header: title,
      primary: true,
      cell: (row) => (
        <span className="block max-w-[16rem] truncate" title={rowLabel(dimension, row.label, locale, t)}>
          {rowLabel(dimension, row.label, locale, t)}
        </span>
      ),
    },
    {
      key: 'value',
      header: t('admin.analytics.behavior.views'),
      numeric: true,
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {nf.format(row.value)}
          {shown > 0 && <span className="lf-caption ml-1.5 text-content-faint">{pct.format(row.value / shown)}</span>}
        </span>
      ),
    },
  ];

  return (
    <Card className="flex flex-col gap-3 shadow-glass border border-outline/50">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="!text-[20px] text-content-muted" />
        <h3 className="lf-label font-bold text-content">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="lf-caption py-6 text-center text-content-muted">{t('admin.analytics.behavior.noRows')}</p>
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(row) => row.label} />
          <p className="lf-caption text-content-faint">{t('admin.analytics.behavior.shareNote')}</p>
        </>
      )}
    </Card>
  );
}
