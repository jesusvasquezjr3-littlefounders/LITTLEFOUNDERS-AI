import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Day {
  date: string;
  count: number;
}

const PERIODS = [
  { days: 30, key: '30d' },
  { days: 90, key: '90d' },
  { days: 365, key: '1y' },
] as const;

export function SignupTimeline() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    const token = await getToken();
    const r = await api<{ timeline: Day[] }>(`/admin/users/timeline?days=${days}`, { token });
    if (!cancelled && !r.error) setData(r.data.timeline);
    if (!cancelled) setLoading(false);
    return () => { cancelled = true; };
  }, [days, getToken]);

  useEffect(() => {
    const cancel = load();
    return () => { void cancel.then((fn) => fn?.()); };
  }, [load]);

  const { max, smooth } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.count), 1);
    const cellW = Math.max(4, Math.floor(700 / Math.max(data.length, 1)));
    const every = Math.max(1, Math.ceil(data.length / 30));
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += every) {
      const d = data[i];
      if (d) labels.push({ x: i * cellW + cellW / 2, label: d.date.slice(5) });
    }
    return { max, smooth: { cellW, labels } };
  }, [data]);

  const H = 100;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="lf-label text-content-muted">{t('admin.users.timelineTitle')}</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setDays(p.days)}
              className={cn(
                'lf-caption rounded-full px-2.5 py-1 font-bold transition-colors',
                days === p.days ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-content-muted hover:text-content',
              )}
            >
              {t(`admin.users.timelinePeriods.${p.key}`)}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex h-[120px] items-center justify-center">
          <p className="lf-caption text-content-faint">{t('admin.loading')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${Math.max(smooth.cellW * data.length, 280)} ${H + 22}`}
            className="h-[122px] w-full min-w-[280px]"
            aria-label={t('admin.users.timelineAria')}
          >
            {smooth.labels.map((l) => (
              <text key={l.label} x={l.x} y={H + 16} textAnchor="middle" className="lf-caption fill-content-faint" fontSize="10">
                {l.label}
              </text>
            ))}
            {data.map((d, i) => (
              <rect
                key={d.date}
                x={i * smooth.cellW + 1}
                y={H - (d.count / max) * H}
                width={Math.max(1, smooth.cellW - 2)}
                height={(d.count / max) * H}
                rx="2"
                className="fill-accent transition-opacity"
              />
            ))}
          </svg>
        </div>
      )}
    </Card>
  );
}
