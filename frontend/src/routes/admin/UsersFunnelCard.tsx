import { useTranslation } from 'react-i18next';
import { Card, Icon, SectionHeading } from '@/components/ui';
import { useAdminData } from './adminShared';
import type { AcquisitionData, FunnelIntegrityData, RegistrationsData } from './analytics/analyticsShared';

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
  /*
   * Registrations carry the ROLE split, which nothing else does — funnel
   * integrity has the daily total but not who those accounts were. Degenerate
   * today (production is all `universal`) and the reason it is here anyway is
   * that the day families launch, "who registered" is the first question, and
   * a panel that has to be built at that moment gets built in a hurry.
   */
  const { data: registrations } = useAdminData<RegistrationsData>(`/admin/insights/registrations?days=${days}`);

  if (acquisition.state !== 'ready' || integrity.state !== 'ready') return null;

  /*
   * Shape-checked, not assumed.
   *
   * A card that trusts its payload takes the WHOLE page down when the payload
   * is partial — and the users directory is not an acceptable casualty of a
   * supplementary panel failing. Caught by AdminUsersPage.test.tsx, whose api
   * mock answers unknown paths with `{}`: exactly the shape a degraded or
   * older Core would return.
   */
  const visitors = acquisition.data?.visitors;
  const accounts = integrity.data?.accountsCreated;
  if (typeof visitors !== 'number' || typeof accounts !== 'number') return null;
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
        <SectionHeading icon="filter_alt" tone="success" as="h3" className="mb-0">{t('admin.users.funnel.title')}</SectionHeading>
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

      {/* Who those accounts were, when there is more than one kind. */}
      {registrations.state === 'ready' && (registrations.data?.entries?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(
            (registrations.data.entries ?? []).reduce<Record<string, number>>((acc, row) => {
              acc[row.role] = (acc[row.role] ?? 0) + row.registrations;
              return acc;
            }, {}),
          )
            .sort((a, b) => b[1] - a[1])
            .map(([role, count]) => (
              <span key={role} className="lf-caption text-content-muted">
                <span className="lf-number text-content">{nf.format(count)}</span> {role}
              </span>
            ))}
        </div>
      )}

      <p className="lf-caption flex items-start gap-1.5 text-content-muted">
        <Icon name="info" className="!text-[14px] shrink-0 translate-y-0.5" aria-hidden />
        {(integrity.data?.unobserved ?? 0) > 0
          ? t('admin.users.funnel.serverTruth', { count: integrity.data.unobserved })
          : t('admin.users.funnel.sourcesAgree')}
      </p>
    </Card>
  );
}
