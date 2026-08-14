import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAdminData } from '../adminShared';
import type { ExclusionsData } from './analyticsShared';

/*
 * States, beside the web-analytics figures, exactly how far the internal-traffic
 * exclusion reaches.
 *
 * This is the honest answer to "apply the filtering to previous statistics".
 * The warehouse filter IS retroactive — its views hide staff rows wherever they
 * sit in history — but Plausible, Umami and GA4 store their own data upstream,
 * and an exclusion added today cannot remove a pageview recorded last week.
 * Two failure modes follow, and both are silent without this:
 *
 *   - No exclusion exists yet, so staff visits are still being counted while
 *     an operator believes the panel is doing something.
 *   - Exclusions exist, but the selected window reaches back before they were
 *     added, so part of the range is clean and part is not.
 */
export function ExclusionCoverageNote({ windowStart }: { windowStart: string | null }) {
  const { t, i18n } = useTranslation();
  const { data } = useAdminData<ExclusionsData>('/admin/analytics/exclusions?days=30&limit=50');

  if (data.state !== 'ready') return null;
  const active = data.data.active;

  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const earliest = active.length
    ? active.reduce((min, row) => (row.created_at < min ? row.created_at : min), active[0]!.created_at)
    : null;

  // The window predates the first exclusion, so part of it is unfiltered.
  const partiallyCovered = Boolean(earliest && windowStart && windowStart < earliest.slice(0, 10));
  const tone =
    active.length === 0 || partiallyCovered
      ? 'border-warning/40 bg-warning-soft/30 text-warning-strong'
      : 'border-outline/40 bg-surface-sunken/30 text-content-muted';

  return (
    <p className={cn('lf-caption flex items-start gap-2 rounded-xl border p-3', tone)}>
      <Icon name={active.length === 0 ? 'warning' : 'info'} className="!text-[18px] shrink-0" />
      <span>
        {active.length === 0
          ? t('admin.analytics.coverage.none')
          : partiallyCovered
            ? t('admin.analytics.coverage.partial', { date: dateFmt.format(new Date(earliest!)) })
            : t('admin.analytics.coverage.covered', { date: dateFmt.format(new Date(earliest!)) })}
      </span>
    </p>
  );
}
