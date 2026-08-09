import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card } from '@/components/ui';

interface Day {
  date: string;
  count: number;
}

interface Range {
  startIndex: number;
  endIndex: number;
}

function validRange(range: Range, length: number): Range {
  const last = Math.max(length - 1, 0);
  const startIndex = Math.min(Math.max(range.startIndex, 0), last);
  const endIndex = Math.min(Math.max(range.endIndex, startIndex), last);
  return { startIndex, endIndex };
}

export function SignupTimeline() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [data, setData] = useState<Day[]>([]);
  const [range, setRange] = useState<Range>({ startIndex: 0, endIndex: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFailed(false);
      const token = await getToken();
      const result = await api<{ timeline: Day[] }>('/admin/users/timeline?days=365', { token });
      if (cancelled) return;
      if (result.error) {
        setData([]);
        setFailed(true);
      } else {
        setData(result.data.timeline);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [getToken]);

  useEffect(() => {
    setRange({ startIndex: 0, endIndex: Math.max(data.length - 1, 0) });
  }, [data.length]);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric', year: 'numeric' }),
    [i18n.resolvedLanguage],
  );
  const axisDateFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric' }),
    [i18n.resolvedLanguage],
  );
  const numberFormat = useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const selectedRange = validRange(range, data.length);
  const visibleData = useMemo(
    () => data.slice(selectedRange.startIndex, selectedRange.endIndex + 1),
    [data, selectedRange.endIndex, selectedRange.startIndex],
  );
  const summary = useMemo(() => {
    const signups = visibleData.reduce((total, point) => total + point.count, 0);
    const peak = visibleData.reduce((highest, point) => Math.max(highest, point.count), 0);
    return { signups, peak, average: visibleData.length ? signups / visibleData.length : 0 };
  }, [visibleData]);
  const rangeStart = data[selectedRange.startIndex];
  const rangeEnd = data[selectedRange.endIndex];
  const rangeLabel = rangeStart && rangeEnd
    ? t('admin.users.timelineRange', {
      start: dateFormat.format(new Date(`${rangeStart.date}T12:00:00`)),
      end: dateFormat.format(new Date(`${rangeEnd.date}T12:00:00`)),
    })
    : '';

  if (loading) {
    return (
      <Card className="flex h-64 items-center justify-center p-4">
        <p className="lf-caption text-content-faint">{t('admin.loading')}</p>
      </Card>
    );
  }

  if (failed || data.length === 0) {
    return (
      <Card className="flex min-h-64 items-center justify-center p-4 text-center">
        <p className="lf-caption text-content-muted">{t('admin.users.timelineEmpty')}</p>
      </Card>
    );
  }

  const tooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length || !label) return null;
    return (
      <div className="lf-glass rounded-md border border-outline/50 bg-surface p-3 shadow-pop">
        <p className="lf-caption text-content-muted">{dateFormat.format(new Date(`${label}T12:00:00`))}</p>
        <p className="lf-number mt-1 text-content">{numberFormat.format(Number(payload[0]?.value ?? 0))}</p>
        <p className="lf-caption text-content-muted">{t('admin.users.timelineSignups')}</p>
      </div>
    );
  };

  return (
    <Card className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h3 className="lf-title text-content">{t('admin.users.timelineTitle')}</h3>
          <p className="lf-caption mt-1 text-content-muted">{t('admin.users.timelineSubtitle')}</p>
        </div>
        <p className="lf-caption shrink-0 text-content-muted">{rangeLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3" aria-label={t('admin.users.timelineSummaryAria')}>
        <div>
          <p className="lf-caption text-content-muted">{t('admin.users.timelineSignups')}</p>
          <p className="lf-number mt-1 text-content">{numberFormat.format(summary.signups)}</p>
        </div>
        <div>
          <p className="lf-caption text-content-muted">{t('admin.users.timelineDailyAverage')}</p>
          <p className="lf-number mt-1 text-content">{numberFormat.format(summary.average)}</p>
        </div>
        <div>
          <p className="lf-caption text-content-muted">{t('admin.users.timelinePeak')}</p>
          <p className="lf-number mt-1 text-content">{numberFormat.format(summary.peak)}</p>
        </div>
      </div>

      <div className="h-72 w-full" aria-label={t('admin.users.timelineAria')}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="signupTimelineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--lf-primary))" stopOpacity={0.32} />
                <stop offset="100%" stopColor="rgb(var(--lf-primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(var(--lf-outline))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={36}
              tick={{ className: 'fill-content-faint', fontSize: 11 }}
              tickFormatter={(date: string) => axisDateFormat.format(new Date(`${date}T12:00:00`))}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={36}
              tick={{ className: 'fill-content-faint', fontSize: 11 }}
            />
            <Tooltip content={tooltip} cursor={{ stroke: 'rgb(var(--lf-primary))', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="count"
              name={t('admin.users.timelineSignups')}
              stroke="rgb(var(--lf-primary))"
              strokeWidth={2.5}
              fill="url(#signupTimelineFill)"
              isAnimationActive={false}
            />
            <Brush
              dataKey="date"
              height={32}
              startIndex={selectedRange.startIndex}
              endIndex={selectedRange.endIndex}
              travellerWidth={12}
              stroke="rgb(var(--lf-primary))"
              fill="rgb(var(--lf-surface-sunken))"
              tickFormatter={(date: string) => axisDateFormat.format(new Date(`${date}T12:00:00`))}
              onChange={({ startIndex, endIndex }) => setRange({ startIndex: startIndex ?? 0, endIndex: endIndex ?? Math.max(data.length - 1, 0) })}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="lf-caption text-content-faint">{t('admin.users.timelineZoomHint')}</p>
    </Card>
  );
}
