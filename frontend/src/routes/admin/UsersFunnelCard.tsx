import { useTranslation } from 'react-i18next';
import { Card, Icon } from '@/components/ui';
import { useAdminData } from './adminShared';
import type { AcquisitionData, FunnelIntegrityData } from './analytics/analyticsShared';

/*
 * The people who are NOT in the users table.
 *
 * Everything else on this page counts accounts, which makes the page an
 * accurate answer to a question nobody asked. The interesting number for a
 * pre-launch product is the ratio: how many strangers arrived, and how many of
 * them ever became one of the rows below.
 *
 * Both halves come from data that already existed and that nothing read.
 * `anon_visitors` has been recording landing route, referrer, device and
 * CONVERSION since migration 0024; the server-side registration count has
 * always been derivable from `profiles` and never was.
 *
 * The integrity line is not decoration. Measured 2026-08-28: the client-side
 * signup funnel had observed ZERO completed signups across 31 real accounts,
 * so a conversion rate computed from the event stream alone would have been
 * confidently, silently wrong. The rate here is computed against the
 * server-side count for exactly that reason, and the gap is stated.
 */
export function UsersFunnelCard({ days = 90 }: { days?: number }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const nf = new Intl.NumberFormat(locale);
  const pf = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });

  const { data: acquisition } = useAdminData<AcquisitionData>(`/admin/insights/acquisition?days=${days}`);
  const { data: integrity } = useAdminData<FunnelIntegrityData>(`/admin/insights/funnel-integrity?days=${days}`);

  if (acquisition.state !== 'ready' || integrity.state !== 'ready') return null;

  const visitors = acquisition.data.visitors;
  const accounts = integrity.data.accountsCreated;
  /*
   * Accounts per visitor, against the SERVER-SIDE account count rather than
   * against the funnel's own `converted` field — the two disagree, and the
   * server one is the one that cannot be suppressed by a cookie banner.
   * Null, never 0%, when nobody arrived: an empty window is not a failure to
   * convert.
   */
  const rate = visitors > 0 ? accounts / visitors : null;

  return (
    <Card className="flex flex-col gap-4 p-5 shadow-glass">
      <div className="flex flex-col gap-1">
        <h3 className="lf-title text-content">{t('admin.users.funnel.title')}</h3>
        <p className="lf-caption text-content-muted">{t('admin.users.funnel.subtitle', { days })}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="lf-number text-2xl font-semibold text-content">{nf.format(visitors)}</p>
          <p className="lf-caption text-content-muted">{t('admin.users.funnel.anonymous')}</p>
        </div>
        <div>
          <p className="lf-number text-2xl font-semibold text-content">{nf.format(accounts)}</p>
          <p className="lf-caption text-content-muted">{t('admin.users.funnel.registered')}</p>
        </div>
        <div>
          <p className="lf-number text-2xl font-semibold text-content">
            {rate === null ? t('admin.users.funnel.noData') : pf.format(rate)}
          </p>
          <p className="lf-caption text-content-muted">{t('admin.users.funnel.rate')}</p>
        </div>
      </div>

      {/* One proportional bar: the comparison IS the point, so it is drawn
          rather than left as two numbers the reader has to divide. */}
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        aria-label={t('admin.users.funnel.barAria', { visitors, accounts })}
      >
        <div
          className="h-full bg-success"
          style={{ width: `${visitors > 0 ? Math.min(100, (accounts / visitors) * 100) : 0}%` }}
        />
      </div>

      <p className="lf-caption flex items-start gap-1.5 text-content-muted">
        <Icon name="info" className="!text-[14px] shrink-0 translate-y-0.5" aria-hidden />
        {integrity.data.unobserved > 0
          ? t('admin.users.funnel.serverTruth', { count: integrity.data.unobserved })
          : t('admin.users.funnel.sourcesAgree')}
      </p>
    </Card>
  );
}
