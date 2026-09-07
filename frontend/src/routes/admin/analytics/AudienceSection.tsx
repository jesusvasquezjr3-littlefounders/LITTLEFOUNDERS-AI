import { useTranslation } from 'react-i18next';
import { Badge, Card, Icon, SectionHeading, StatCard } from '@/components/ui';
import { useAdminData } from '../adminShared';
import { AudienceChart } from './AudienceChart';
import type { AcquisitionData, AudienceData, FunnelIntegrityData } from './analyticsShared';

/*
 * Who was actually here, from our OWN data rather than from the marketing
 * tracker — and how far that data can be trusted.
 *
 * WHY THIS SECTION EXISTS AT ALL
 *
 * The console could answer "how many lessons were completed" four ways and
 * could not answer "did anyone who is not us visit last week". Everything it
 * showed came from Plausible, which by design sees only ANONYMOUS, CONSENTED
 * visitors on MARKETING pages — so a signed-in parent is invisible to it, and
 * staff were invisible to nothing.
 *
 * Meanwhile `learning_events` had been recording every session with the role
 * attached since 2026-08-03, and `anon_visitors` had been recording landing
 * route, referrer, device, locale and CONVERSION since 0024. Neither was ever
 * read by anything. This section reads them.
 *
 * THE INTEGRITY CARD IS THE POINT, not a footnote. Measured 2026-08-28: 31
 * accounts exist and the client funnel has reported `signup_complete` zero
 * times on every day any of them were created. Any panel built on that stream
 * alone would state "no signups, ever" with total confidence. So the
 * server-side count is shown beside it and the gap is named.
 */

function pct(value: number | null, locale: string): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

/** A compact ranked list — used for the four acquisition dimensions. */
function RankedList({ title, rows, locale }: { title: string; rows: { label: string; visitors: number; converted: number }[]; locale: string }) {
  const { t } = useTranslation();
  const nf = new Intl.NumberFormat(locale);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.visitors), 1);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/*
        The study's own eyebrow class, not a hand-rolled imitation of it. Four
        of these sit side by side INSIDE a card that already carries a full
        lockup, so they take the typography and not the tile — four more tinted
        squares here would be decoration competing with the bars underneath.
      */}
      <h4 className="lf-eyebrow text-content-faint">{title}</h4>
      <ul className="flex flex-col gap-1.5">
        {rows.slice(0, 6).map((row) => (
          <li key={row.label} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="lf-caption truncate text-content" title={row.label}>{row.label}</span>
              <span className="lf-number lf-caption shrink-0 text-content-muted">
                {nf.format(row.visitors)}
                {row.converted > 0 && (
                  <span className="text-success"> · {t('admin.analytics.audience.convertedShort', { count: row.converted })}</span>
                )}
              </span>
            </div>
            {/* A bar, because a ranked list of bare numbers makes the reader do
                the comparison the chart is supposed to do for them. */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(row.visitors / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AudienceSection({ days }: { days: number }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const nf = new Intl.NumberFormat(locale);

  const { data: audience } = useAdminData<AudienceData>(`/admin/insights/audience?days=${days}`);
  const { data: integrity } = useAdminData<FunnelIntegrityData>(`/admin/insights/funnel-integrity?days=${days}`);
  const { data: acquisition } = useAdminData<AcquisitionData>(`/admin/insights/acquisition?days=${days}`);

  return (
    <section aria-labelledby="admin-audience" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading
          icon="groups"
          tone="accent"
          id="admin-audience"
          className="mb-0 min-w-0 flex-1"
          meta={t('admin.analytics.audience.source')}
        >
          {t('admin.analytics.audience.title')}
        </SectionHeading>
      </div>

      {/* ── Who was here ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Icon name="visibility" className="!text-[24px]" />}
          value={audience.state === 'ready' ? nf.format(audience.data?.totals?.anonymous ?? 0) : '…'}
          label={t('admin.analytics.audience.bands.anonymous')}
          tone="primary"
        />
        <StatCard
          icon={<Icon name="how_to_reg" className="!text-[24px]" />}
          value={audience.state === 'ready' ? nf.format(audience.data?.totals?.registered ?? 0) : '…'}
          label={t('admin.analytics.audience.bands.registered')}
          tone="secondary"
        />
        <StatCard
          icon={<Icon name="shield_person" className="!text-[24px]" />}
          value={audience.state === 'ready' ? nf.format(audience.data?.totals?.staff ?? 0) : '…'}
          label={t('admin.analytics.audience.bands.staff')}
          tone="accent"
        />
        <StatCard
          icon={<Icon name="groups" className="!text-[24px]" />}
          value={
            audience.state === 'ready'
              ? (pct(audience.data?.externalShare ?? null, locale) ?? t('admin.analytics.audience.noData'))
              : '…'
          }
          label={t('admin.analytics.audience.externalShare')}
          tone="primary"
        />
      </div>

      <Card className="flex flex-col gap-3 p-5 shadow-glass">
        <div className="flex flex-col">
          <SectionHeading icon="stacked_line_chart" tone="accent" as="h3" className="mb-1">
            {t('admin.analytics.audience.chartTitle')}
          </SectionHeading>
          <p className="lf-caption text-content-muted">{t('admin.analytics.audience.chartSub')}</p>
        </div>
        {audience.state === 'ready' && audience.data?.series ? (
          <AudienceChart series={audience.data.series} />
        ) : (
          <p className="lf-caption py-8 text-center text-content-muted">
            {audience.state === 'error' ? t('admin.analytics.unavailableBody') : t('admin.loading')}
          </p>
        )}
      </Card>

      {/* ── How far the client funnel can be trusted ───────────── */}
      {integrity.state === 'ready' && typeof integrity.data?.accountsCreated === 'number' && (
        <Card className="flex flex-col gap-3 p-5 shadow-glass">
          {/*
            Warning when the client funnel has a gap, success when the two
            sources agree — the hue says which of those two the card is
            reporting before the numbers are read.
          */}
          <SectionHeading
            icon="fact_check"
            tone={integrity.data.unobserved > 0 ? 'warning' : 'success'}
            as="h3"
            className="mb-0"
            meta={
              integrity.data.unobserved > 0 ? (
                <Badge className="bg-warning-soft text-warning-strong">
                  {t('admin.analytics.audience.unobservedBadge', { count: integrity.data.unobserved })}
                </Badge>
              ) : undefined
            }
          >
            {t('admin.analytics.audience.integrityTitle')}
          </SectionHeading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="lf-number text-2xl font-semibold text-content">{nf.format(integrity.data.accountsCreated)}</p>
              <p className="lf-caption text-content-muted">{t('admin.analytics.audience.accountsCreated')}</p>
            </div>
            <div>
              <p className="lf-number text-2xl font-semibold text-content">{nf.format(integrity.data.signupComplete)}</p>
              <p className="lf-caption text-content-muted">{t('admin.analytics.audience.signupObserved')}</p>
            </div>
            <div>
              <p className="lf-number text-2xl font-semibold text-content">
                {pct(integrity.data.observedShare, locale) ?? t('admin.analytics.audience.noData')}
              </p>
              <p className="lf-caption text-content-muted">{t('admin.analytics.audience.observedShare')}</p>
            </div>
          </div>
          {/*
            Stated in words, not left as an inference from two numbers. The
            whole reason this card exists is that "0 signups observed" and "0
            signups happened" are indistinguishable without it.
          */}
          <p className="lf-caption flex items-start gap-1.5 text-content-muted">
            <Icon name="info" className="!text-[14px] shrink-0 translate-y-0.5" aria-hidden />
            {integrity.data.unobserved > 0
              ? t('admin.analytics.audience.integrityGap')
              : t('admin.analytics.audience.integrityClean')}
          </p>
        </Card>
      )}

      {/* ── Anonymous visitors, and whether they ever came back ── */}
      {acquisition.state === 'ready' && typeof acquisition.data?.visitors === 'number' && (
        <Card className="flex flex-col gap-4 p-5 shadow-glass">
          <div className="flex flex-col">
            <SectionHeading icon="travel_explore" tone="delight" as="h3" className="mb-1">
              {t('admin.analytics.audience.acquisitionTitle')}
            </SectionHeading>
            <p className="lf-caption text-content-muted">{t('admin.analytics.audience.acquisitionSub')}</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="lf-number text-2xl font-semibold text-content">{nf.format(acquisition.data.visitors)}</p>
              <p className="lf-caption text-content-muted">{t('admin.analytics.audience.visitors')}</p>
            </div>
            <div>
              <p className="lf-number text-2xl font-semibold text-content">{nf.format(acquisition.data.converted)}</p>
              <p className="lf-caption text-content-muted">{t('admin.analytics.audience.converted')}</p>
            </div>
            <div>
              <p className="lf-number text-2xl font-semibold text-content">
                {pct(acquisition.data.conversionRate, locale) ?? t('admin.analytics.audience.noData')}
              </p>
              <p className="lf-caption text-content-muted">{t('admin.analytics.audience.conversionRate')}</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <RankedList title={t('admin.analytics.audience.byLandingRoute')} rows={acquisition.data.byLandingRoute} locale={locale} />
            <RankedList title={t('admin.analytics.audience.byReferrer')} rows={acquisition.data.byReferrer} locale={locale} />
            <RankedList title={t('admin.analytics.audience.byDevice')} rows={acquisition.data.byDevice} locale={locale} />
            <RankedList title={t('admin.analytics.audience.byLocale')} rows={acquisition.data.byLocale} locale={locale} />
          </div>
          {acquisition.data.noCampaignsTagged && (
            <p className="lf-caption flex items-start gap-1.5 text-content-muted">
              <Icon name="campaign" className="!text-[14px] shrink-0 translate-y-0.5" aria-hidden />
              {t('admin.analytics.audience.noCampaigns')}
            </p>
          )}
        </Card>
      )}
    </section>
  );
}
