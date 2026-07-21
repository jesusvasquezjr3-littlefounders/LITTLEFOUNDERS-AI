import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import {
  Badge,
  Card,
  Dropdown,
  Icon,
  StatCard,
  Table,
  TrendChart,
  type DropdownOption,
  type TableColumn,
} from '@/components/ui';
import { AdminPage } from './adminShared';

/*
 * Analytics & Health — the console's first section (/DESIGN.md §Screen
 * Recipes → Console). All data is Core-brokered from Pulse
 * (/api/v1/admin/*): the browser never talks to Plausible/Umami/Kuma
 * (pulse/AGENTS.md #5). Upstream-unavailable renders the standard
 * empty-state grammar, never a blank pane.
 */

type Period = 'day' | '7d' | '30d' | 'month' | '6mo' | '12mo';

interface Overview {
  period: Period;
  aggregate: { visitors: number; pageviews: number; bounce_rate: number; visit_duration: number };
  timeseries: { date: string; visitors: number; pageviews: number }[];
}
interface Behavior {
  period: Period;
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}
interface Health {
  summary: { total: number; down: number };
  monitors: { id: number; name: string; status: number; pingMs: number | null; uptime24h: number | null }[];
}

type Loadable<T> = { state: 'loading' } | { state: 'error'; code: string } | { state: 'ready'; data: T };

function UnavailableCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon name="cloud_off" className="!text-[40px] text-content-faint" />
      <p className="lf-label text-content">{title}</p>
      <p className="lf-caption max-w-sm text-content-muted">{body}</p>
    </Card>
  );
}

export function AnalyticsHealthPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [overview, setOverview] = useState<Loadable<Overview>>({ state: 'loading' });
  const [behavior, setBehavior] = useState<Loadable<Behavior>>({ state: 'loading' });
  const [health, setHealth] = useState<Loadable<Health>>({ state: 'loading' });

  const load = useCallback(async () => {
    const token = await getToken();
    setOverview({ state: 'loading' });
    setBehavior({ state: 'loading' });
    void api<Overview>(`/admin/analytics/overview?period=${period}`, { token }).then((r) =>
      setOverview(r.error ? { state: 'error', code: r.error.code } : { state: 'ready', data: r.data }),
    );
    void api<Behavior>(`/admin/analytics/behavior?period=${period}`, { token }).then((r) =>
      setBehavior(r.error ? { state: 'error', code: r.error.code } : { state: 'ready', data: r.data }),
    );
    void api<Health>('/admin/health/services', { token }).then((r) =>
      setHealth(r.error ? { state: 'error', code: r.error.code } : { state: 'ready', data: r.data }),
    );
  }, [getToken, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const nf = new Intl.NumberFormat(i18n.resolvedLanguage);
  // KPI numerals use compact notation ("2.1K") — display-lg in a 6-col track
  // truncates full figures past 4 digits, and truncated numbers are worse
  // than rounded ones on a dashboard. Tables keep full precision via `nf`.
  const nfCompact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact', maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1 });
  const secondsFmt = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
  };

  const periodOptions: DropdownOption<Period>[] = (['day', '7d', '30d', 'month', '6mo', '12mo'] as const).map((p) => ({
    value: p,
    label: t(`admin.analytics.periods.${p}`),
  }));

  const healthColumns: TableColumn<Health['monitors'][number]>[] = [
    { key: 'name', header: t('admin.health.columns.service'), cell: (m) => m.name, primary: true },
    {
      key: 'status',
      header: t('admin.health.columns.status'),
      cell: (m) =>
        m.status === 1 ? (
          <Badge className="bg-success-soft text-success-strong">{t('admin.health.up')}</Badge>
        ) : (
          <Badge className="bg-error-soft text-error-strong">{t('admin.health.down')}</Badge>
        ),
    },
    {
      key: 'ping',
      header: t('admin.health.columns.latency'),
      numeric: true,
      cell: (m) => (m.pingMs === null ? '—' : `${nf.format(m.pingMs)} ms`),
    },
    {
      key: 'uptime',
      header: t('admin.health.columns.uptime24h'),
      numeric: true,
      cell: (m) => (m.uptime24h === null ? '—' : pct.format(m.uptime24h)),
    },
  ];

  return (
    <AdminPage
      titleKey="admin.analytics.title"
      subtitleKey="admin.analytics.subtitle"
      actions={<Dropdown value={period} options={periodOptions} onChange={setPeriod} ariaLabel={t('admin.analytics.periodLabel') ?? 'Period'} />}
    >
      {/* ── Web analytics (Plausible) ─────────────────── */}
      <section aria-labelledby="admin-web-analytics" className="flex flex-col gap-4">
        <h2 id="admin-web-analytics" className="lf-display-sm">
          {t('admin.analytics.web.title')}
        </h2>

        {overview.state === 'error' ? (
          <UnavailableCard
            title={t('admin.analytics.unavailableTitle')}
            body={t(`errors.api.${overview.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatCard
                dense
                icon={<Icon name="group" />}
                value={overview.state === 'ready' ? nfCompact.format(overview.data.aggregate.visitors) : '…'}
                label={t('admin.analytics.web.visitors')}
              />
              <StatCard
                dense
                icon={<Icon name="visibility" />}
                value={overview.state === 'ready' ? nfCompact.format(overview.data.aggregate.pageviews) : '…'}
                label={t('admin.analytics.web.pageviews')}
              />
              <StatCard
                dense
                icon={<Icon name="u_turn_left" />}
                value={overview.state === 'ready' ? pct.format(overview.data.aggregate.bounce_rate / 100) : '…'}
                label={t('admin.analytics.web.bounceRate')}
              />
              <StatCard
                dense
                icon={<Icon name="timer" />}
                value={overview.state === 'ready' ? secondsFmt(overview.data.aggregate.visit_duration) : '…'}
                label={t('admin.analytics.web.visitDuration')}
                className="col-span-2 md:col-span-3 lg:col-span-3"
              />
            </div>

            <Card className="p-5">
              <p className="lf-label text-content-muted">{t('admin.analytics.web.trend')}</p>
              {overview.state === 'ready' && overview.data.timeseries.length > 0 ? (
                <TrendChart
                  className="mt-3"
                  ariaLabel={t('admin.analytics.web.trendAria')}
                  points={overview.data.timeseries.map((d) => ({ label: d.date, value: d.visitors }))}
                />
              ) : (
                <p className="lf-caption mt-3 text-content-faint">{t('admin.analytics.web.trendEmpty')}</p>
              )}
            </Card>
          </>
        )}
      </section>

      {/* ── Behavioral (Umami — adult surfaces only, §1.9) ── */}
      <section aria-labelledby="admin-behavior" className="flex flex-col gap-4">
        <h2 id="admin-behavior" className="lf-display-sm">
          {t('admin.analytics.behavior.title')}
        </h2>
        <p className="lf-caption -mt-2 text-content-faint">{t('admin.analytics.behavior.scopeNote')}</p>
        {behavior.state === 'error' ? (
          <UnavailableCard
            title={t('admin.analytics.unavailableTitle')}
            body={t(`errors.api.${behavior.code}`, { defaultValue: t('admin.analytics.unavailableBody') })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
                dense
              icon={<Icon name="ads_click" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.pageviews) : '…'}
              label={t('admin.analytics.behavior.pageviews')}
              tone="accent"
            />
            <StatCard
                dense
              icon={<Icon name="person" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.visitors) : '…'}
              label={t('admin.analytics.behavior.visitors')}
              tone="accent"
            />
            <StatCard
                dense
              icon={<Icon name="route" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.visits) : '…'}
              label={t('admin.analytics.behavior.visits')}
              tone="accent"
            />
            <StatCard
                dense
              icon={<Icon name="door_open" />}
              value={behavior.state === 'ready' ? nfCompact.format(behavior.data.bounces) : '…'}
              label={t('admin.analytics.behavior.bounces')}
              tone="accent"
              className="col-span-2 md:col-span-3 lg:col-span-3"
            />
          </div>
        )}
      </section>

      {/* ── System health (Uptime Kuma) ───────────────── */}
      <section aria-labelledby="admin-health" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 id="admin-health" className="lf-display-sm">
            {t('admin.health.title')}
          </h2>
          {health.state === 'ready' &&
            (health.data.summary.down === 0 ? (
              <Badge className="bg-success-soft text-success-strong">{t('admin.health.allUp')}</Badge>
            ) : (
              <Badge className="bg-error-soft text-error-strong">
                {t('admin.health.someDown', { count: health.data.summary.down })}
              </Badge>
            ))}
        </div>
        {health.state === 'error' ? (
          <UnavailableCard
            title={t('admin.health.unavailableTitle')}
            body={t(`errors.api.${health.code}`, { defaultValue: t('admin.health.unavailableBody') })}
          />
        ) : health.state === 'ready' ? (
          <Table columns={healthColumns} rows={health.data.monitors} rowKey={(m) => m.id} />
        ) : (
          <Card className="py-10 text-center">
            <p className="lf-caption text-content-faint">{t('admin.health.loading')}</p>
          </Card>
        )}
      </section>
    </AdminPage>
  );
}
