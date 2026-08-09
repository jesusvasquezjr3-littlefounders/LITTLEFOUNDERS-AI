import { useTranslation } from 'react-i18next';
import { Card, Icon, Table, type TableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAdminData } from '../adminShared';
import { countryLabel, type BreakdownData, type BreakdownRow, type DimensionKey, type Period } from './analyticsShared';

/*
 * One top-N breakdown (Core /admin/analytics/breakdown → Plausible v2). Lives
 * as a cell of the card grid (1/2/3 cols — /DESIGN.md §Grid Systems), so it
 * keeps to three columns: label + visitors + pageviews. Long labels ellipsis
 * inside the cell (title attr keeps the full text) and the md:+ table sits in
 * Table's own overflow-x-auto container — the page never scrolls sideways.
 * Every label is a button that adds itself as a segment filter.
 */

/** Compact status note for a grid cell (full UnavailableCard is too heavy ×10). */
function PanelNote({ icon, text, spin }: { icon: string; text: string; spin?: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center shadow-glass border border-outline/50">
      <Icon name={icon} className={cn('!text-[28px] text-content-faint', spin && 'animate-spin')} />
      <p className="lf-caption text-content-muted">{text}</p>
    </Card>
  );
}

export function BreakdownCard({
  dimension,
  icon,
  period,
  filterQuery,
  onFilter,
}: {
  dimension: DimensionKey;
  icon: string;
  period: Period;
  filterQuery: string;
  onFilter: (dimension: DimensionKey, value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<BreakdownData>(
    `/admin/analytics/breakdown?period=${period}&dimension=${dimension}&limit=8${filterQuery}`,
  );

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  const pct = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });
  const duration = (seconds: number) => {
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
  };
  const display = (label: string) =>
    dimension === 'country' ? countryLabel(label, i18n.resolvedLanguage) : label || undefined;

  const columns: TableColumn<BreakdownRow>[] = [
    {
      key: 'label',
      header: t(`admin.analytics.dimensions.${dimension}`),
      primary: true,
      cell: (r) => (
        <button
          type="button"
          onClick={() => onFilter(dimension, r.label)}
          title={display(r.label)}
          aria-label={t('admin.analytics.breakdowns.filterBy', { value: display(r.label) })}
          className="max-w-[24ch] truncate rounded-sm text-left underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {display(r.label)}
        </button>
      ),
    },
    {
      key: 'visitors',
      header: t('admin.analytics.web.visitors'),
      numeric: true,
      cell: (r) => nf.format(r.visitors),
    },
    {
      key: 'pageviews',
      header: t('admin.analytics.web.pageviews'),
      numeric: true,
      cell: (r) => nf.format(r.pageviews),
    },
    {
      key: 'bounceRate',
      header: t('admin.analytics.web.bounceRate'),
      numeric: true,
      cell: (r) => pct.format(r.bounceRate / 100),
    },
    {
      key: 'visitDuration',
      header: t('admin.analytics.web.visitDuration'),
      numeric: true,
      cell: (r) => duration(r.visitDuration),
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={t(`admin.analytics.breakdowns.cards.${dimension}`)}>
      <h3 className="lf-title flex items-center gap-2">
        <Icon name={icon} className="!text-[20px] text-content-muted" />
        {t(`admin.analytics.breakdowns.cards.${dimension}`)}
      </h3>
      {data.state === 'error' ? (
        <PanelNote
          icon="cloud_off"
          text={t(`errors.api.${data.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
        />
      ) : data.state === 'ready' ? (
        data.data.rows.length === 0 ? (
          <PanelNote icon="hourglass_disabled" text={t('admin.analytics.breakdowns.empty')} />
        ) : (
          <Table columns={columns} rows={data.data.rows} rowKey={(r) => r.label} />
        )
      ) : (
        <PanelNote icon="progress_activity" spin text={t('admin.loading')} />
      )}
    </section>
  );
}
