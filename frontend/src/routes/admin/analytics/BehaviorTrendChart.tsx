import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Icon } from '@/components/ui';
import type { BehaviorSeriesPoint } from './analyticsShared';

/*
 * Behavioural volume over the selected window (Umami pageviews + sessions).
 *
 * Two series on one axis on purpose: pageviews alone cannot distinguish "more
 * people came" from "the same people went deeper", and that distinction is the
 * entire reason to keep a behavioural tool alongside an acquisition one.
 *
 * Design tokens are space-separated RGB channels, so every colour here must go
 * through rgb(var(--token)) — passing the bare variable yields an invalid SVG
 * paint and the series renders invisible.
 */

const PAGEVIEWS = 'rgb(var(--lf-primary))';
const SESSIONS = 'rgb(var(--lf-accent))';

export function BehaviorTrendChart({ data }: { data: BehaviorSeriesPoint[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';

  const axisDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  );
  const fullDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    [locale],
  );
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, p) => ({ pageviews: acc.pageviews + p.pageviews, sessions: acc.sessions + p.sessions }),
        { pageviews: 0, sessions: 0 },
      ),
    [data],
  );

  if (data.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center shadow-glass border border-outline/50">
        <Icon name="show_chart" className="!text-[28px] text-content-faint" />
        <p className="lf-caption text-content-muted">{t('admin.analytics.behavior.noSeries')}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 shadow-glass border border-outline/50">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="lf-label font-bold text-content">{t('admin.analytics.behavior.trendTitle')}</h3>
        <div className="flex flex-wrap items-center gap-4">
          <span className="lf-caption flex items-center gap-1.5 text-content-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PAGEVIEWS }} />
            {t('admin.analytics.behavior.pageviews')} · <span className="tabular-nums">{nf.format(totals.pageviews)}</span>
          </span>
          <span className="lf-caption flex items-center gap-1.5 text-content-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SESSIONS }} />
            {t('admin.analytics.behavior.sessions')} · <span className="tabular-nums">{nf.format(totals.sessions)}</span>
          </span>
        </div>
      </div>

      {/* Fixed height + ResponsiveContainer: the chart reflows with the column
          instead of forcing a horizontal page scroll on mobile. */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="lf-behavior-pv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PAGEVIEWS} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PAGEVIEWS} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="lf-behavior-se" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SESSIONS} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SESSIONS} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--lf-outline))" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => axisDate.format(new Date(`${d}T00:00:00Z`))}
              tick={{ fontSize: 11, fill: 'rgb(var(--lf-content-faint))' }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgb(var(--lf-content-faint))' }}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgb(var(--lf-surface))',
                border: '1px solid rgb(var(--lf-outline))',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(d) => fullDate.format(new Date(`${String(d)}T00:00:00Z`))}
              formatter={(value: number, name: string) => [
                nf.format(value),
                t(`admin.analytics.behavior.${name === 'pageviews' ? 'pageviews' : 'sessions'}`),
              ]}
            />
            <Area
              type="monotone"
              dataKey="pageviews"
              stroke={PAGEVIEWS}
              strokeWidth={2}
              fill="url(#lf-behavior-pv)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke={SESSIONS}
              strokeWidth={2}
              fill="url(#lf-behavior-se)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
