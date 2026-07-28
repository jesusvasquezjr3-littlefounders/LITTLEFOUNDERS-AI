import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, TrendChart } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TrendPoint } from '@/components/ui';

/*
 * Run timeline — plots the progression curve of a generation run from
 * heartbeat snapshots (0020). Shows completed slots, cost, and per-stage
 * activity over time so the team can see how the run evolved.
 */

interface SnapshotData {
  runId: string;
  snapshots: {
    id: number;
    completedSlots: number;
    failedSlots: number;
    stageBreakdown: Record<string, number>;
    tokensUsed: number;
    usdUsed: number;
    imagesGenerated: number;
    createdAt: string;
  }[];
}

interface RunTimelineProps {
  runId: string;
  className?: string;
}

export function RunTimeline({ runId, className }: RunTimelineProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const loc = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      const res = await api<SnapshotData>(
        `/admin/generation/snapshots/${encodeURIComponent(runId)}`,
        { token },
      );
      if (!cancelled) {
        setData(res.error ? null : res.data);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [runId, getToken]);

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-body-sm flex items-center gap-2 text-content-muted">
          <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
        </p>
      </Card>
    );
  }

  // Guard the array itself, not just the envelope: this page has no error
  // boundary above it, so an envelope without `snapshots` would white-screen
  // the whole run inspector instead of degrading to the empty state.
  if (!data?.snapshots?.length || data.snapshots.length < 2) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-body-sm text-content-muted">{t('admin.generation.timeline.insufficient')}</p>
      </Card>
    );
  }

  const snaps = data.snapshots;
  const timeFmt = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const completedPoints: TrendPoint[] = snaps.map((s) => ({
    label: timeFmt.format(new Date(s.createdAt)),
    value: s.completedSlots + s.failedSlots,
  }));

  const costPoints: TrendPoint[] = snaps.map((s) => ({
    label: timeFmt.format(new Date(s.createdAt)),
    value: Number(s.usdUsed.toFixed(4)),
  }));

  // Per-stage progression: pick the "active" stages (not pending/published)
  const stages = ['planning', 'writing', 'reviewing', 'localizing', 'illustrating', 'publishing'];
  const stageColors: Record<string, string> = {
    planning: 'stroke-accent', writing: 'stroke-primary', reviewing: 'stroke-warning',
    localizing: 'stroke-error', illustrating: 'stroke-success', publishing: 'stroke-secondary',
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Card className="p-4 sm:p-5">
        <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.timeline.progress')}</h3>
        <TrendChart points={completedPoints} ariaLabel={t('admin.generation.timeline.progress')} />
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.timeline.cost')}</h3>
        <TrendChart points={costPoints} ariaLabel={t('admin.generation.timeline.cost')} />
      </Card>

      {/* Per-stage mini charts */}
      <Card className="p-4 sm:p-5">
        <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.timeline.stages')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stages.map((stage) => {
            const points: TrendPoint[] = snaps.map((s) => ({
              label: timeFmt.format(new Date(s.createdAt)),
              value: (s.stageBreakdown as Record<string, number>)[stage] ?? 0,
            }));
            const max = Math.max(...points.map((p) => p.value), 1);
            const h = 50;
            const w = 160;
            const stepX = points.length > 1 ? w / (points.length - 1) : 0;
            const yv = (v: number) => h - (v / max) * h;
            const coords = points.map((p, i) => `${(i * stepX).toFixed(1)},${yv(p.value).toFixed(1)}`);
            const line = coords.length > 1 ? `M${coords.join(' L')}` : '';

            return (
              <div key={stage} className="rounded-xl bg-surface-sunken p-2">
                <p className="lf-caption text-content-muted truncate">{t(`admin.generation.stages.${stage}`, { defaultValue: stage })}</p>
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10 mt-1" preserveAspectRatio="none">
                  {line && <path d={line} className={cn('fill-none', stageColors[stage] ?? 'stroke-outline')} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}
                </svg>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
