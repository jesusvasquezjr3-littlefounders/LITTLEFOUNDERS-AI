import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card, Icon, ProgressBar, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { failedFromI18nKey, formatPct } from './generationI18n';

/*
 * Coach tab — surfaces the forge:coach improvement loop in the admin
 * dashboard. Fetches /api/v1/admin/generation/coach and renders the
 * deterministic diagnosis: what worked, what failed, what the judge says,
 * what it cost, and evidence-backed proposed actions the operator can
 * apply (by editing the playbook/prompts/gates in a commit).
 */

interface CoachReport {
  courseSlug: string | null;
  trackId: string | null;
  runsAnalyzed: number;
  outcomes: { published: number; failed: number; other: number };
  failureHeatmap: Record<string, number>;
  topErrors: { sample: string; count: number }[];
  judge: {
    judged: number;
    dimensionMeans: Record<string, number | null>;
    dimensionMins: Record<string, number | null>;
    cyclesHistogram: { cycle1: number; cycle2: number; cycle3: number; earlyStops: number };
    worstLessons: { slotId: string; dims: string[] }[];
  };
  cost: { totalUsd: number; totalTokens: number; cacheHitPct: number };
  images: { generated: number; billed: number; inherited: number };
  proposedActions: { tag: string; proposal: string; evidence: string }[];
}

const DIMS = [
  'kid_safety', 'age_fit', 'concreteness', 'pedagogy',
  'cognitive_engagement', 'feedback_quality', 'distractor_quality',
  'narrative_quality', 'naturalness',
] as const;

const ACTION_TONES: Record<string, string> = {
  'cost:cache': 'bg-accent-soft text-accent-strong',
  'cost:perLesson': 'bg-warning-soft text-warning-strong',
  'failure:stage': 'bg-error-soft text-error-strong',
};

function actionTone(tag: string): string {
  if (tag.startsWith('judge:')) return 'bg-warning-soft text-warning-strong';
  return ACTION_TONES[tag] ?? 'bg-surface-sunken text-content-muted';
}

interface CoachTabProps {
  courseSlug?: string;
  trackId?: string;
  className?: string;
}

export function CoachTab({ courseSlug, trackId, className }: CoachTabProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const compact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact' });
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const loc = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const params = new URLSearchParams();
      if (courseSlug) params.set('course', courseSlug);
      if (trackId) params.set('track', trackId);
      const qs = params.toString();
      const res = await api<CoachReport>(`/admin/generation/coach${qs ? `?${qs}` : ''}`, { token });
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
      } else {
        setReport(res.data);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [courseSlug, trackId, getToken]);

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-caption flex items-center gap-2 text-content-muted">
          <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
        </p>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-caption text-content-muted">{error ?? t('admin.generation.coach.empty')}</p>
      </Card>
    );
  }

  const heatmapEntries = Object.entries(report.failureHeatmap).sort((a, b) => b[1] - a[1]);
  const totalFailures = heatmapEntries.reduce((a, [, c]) => a + c, 0);
  const costPerPub = report.outcomes.published > 0 ? report.cost.totalUsd / report.outcomes.published : null;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Header */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="lf-headline">{t('admin.generation.coach.title')}</h2>
            <p className="lf-caption text-content-muted">
              {report.courseSlug
                ? `${report.courseSlug} · `
                : ''}{t('admin.generation.coach.runsAnalyzed', { count: report.runsAnalyzed })}
            </p>
          </div>
          <Badge className="bg-accent-soft text-accent-strong">{t('admin.generation.coach.deterministic')}</Badge>
        </div>
      </Card>

      {/* Outcomes KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard dense icon={<Icon name="task_alt" />} tone="primary" value={String(report.outcomes.published)} label={t('admin.generation.kpi.published')} />
        <StatCard dense icon={<Icon name="error" />} tone="accent" value={String(report.outcomes.failed)} label={t('admin.generation.kpi.failed')} />
        <StatCard dense icon={<Icon name="payments" />} tone="secondary" value={usd.format(report.cost.totalUsd)} label={t('admin.generation.kpi.cost')} />
        <StatCard dense icon={<Icon name="bolt" />} tone="secondary" value={`${report.cost.cacheHitPct.toFixed(1)}%`} label={t('admin.generation.kpi.cacheHit')} />
        <StatCard dense icon={<Icon name="image" />} tone="accent" value={`${report.images.billed}+${report.images.inherited}`} label={t('admin.generation.kpi.images')} />
      </div>

      {/* Failure heatmap + Top errors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.coach.heatmap')}</h3>
          {totalFailures === 0 ? (
            <p className="lf-caption text-content-muted">{t('admin.generation.heatmap.empty')}</p>
          ) : (
            <div className="space-y-2">
              {heatmapEntries.map(([stage, count]) => (
                <div key={stage} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
                  <span className="lf-caption truncate text-content-muted">{t(`admin.generation.failedFromLabels.${failedFromI18nKey(stage)}`, { defaultValue: stage })}</span>
                  <ProgressBar value={(count / totalFailures) * 100} tone="accent" label={stage} className="col-span-2 sm:col-span-1" />
                  <span className="lf-number lf-caption text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.coach.topErrors')}</h3>
          {report.topErrors.length === 0 ? (
            <p className="lf-caption text-content-muted">{t('admin.generation.coach.noErrors')}</p>
          ) : (
            <ul className="space-y-2">
              {report.topErrors.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Badge className="shrink-0 bg-error-soft text-error-strong">×{e.count}</Badge>
                  <span className="lf-caption break-words text-content-muted">{e.sample}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Judge dimensions */}
      {report.judge.judged > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-1 text-content-muted">
            {t('admin.generation.coach.judgeTitle', { count: report.judge.judged })}
          </h3>
          <p className="lf-caption mb-3 text-content-faint">{t('admin.generation.judge.note')}</p>
          <div className="space-y-2">
            {DIMS.map((dim) => {
              const mean = report.judge.dimensionMeans[dim];
              if (mean === null || mean === undefined) return null;
              const min = report.judge.dimensionMins[dim];
              return (
                <div key={dim} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                  <span className="lf-caption truncate text-content-muted">{t(`admin.generation.dims.${dim}`, { defaultValue: dim })}</span>
              <ProgressBar className="col-span-2 sm:col-span-1" value={(mean / 5) * 100} tone={mean >= 4 ? 'primary' : 'accent'} label={dim} />
              <span className="lf-number lf-caption text-right">
                {mean.toFixed(2)}
                <span className="text-content-faint">{t('admin.generation.coach.minLabel')}{min != null ? min.toFixed(2) : t('admin.generation.noData')}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cycles histogram */}
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="lf-caption rounded-full bg-surface-sunken px-3 py-1 text-content-muted">
              {t('admin.generation.coach.cycle1')}<span className="lf-number">{report.judge.cyclesHistogram.cycle1}</span>
            </span>
            <span className="lf-caption rounded-full bg-surface-sunken px-3 py-1 text-content-muted">
              {t('admin.generation.coach.cycle2')}<span className="lf-number">{report.judge.cyclesHistogram.cycle2}</span>
            </span>
            <span className="lf-caption rounded-full bg-surface-sunken px-3 py-1 text-content-muted">
              {t('admin.generation.coach.cycle3')}<span className="lf-number">{report.judge.cyclesHistogram.cycle3}</span>
            </span>
            <span className="lf-caption rounded-full bg-warning-soft px-3 py-1 text-warning-strong">
              {t('admin.generation.earlyStop')}: <span className="lf-number">{report.judge.cyclesHistogram.earlyStops}</span>
            </span>
          </div>
        </Card>
      )}

      {/* Worst lessons */}
      {report.judge.worstLessons.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.coach.worstLessons')}</h3>
          <ul className="space-y-1">
            {report.judge.worstLessons.map((l) => (
              <li key={l.slotId} className="lf-caption flex flex-wrap items-center gap-1.5 text-content-muted">
                <span className="text-content">{l.slotId.split('/').slice(-2).join('/')}</span>
                {l.dims.map((d) => (
                  <Badge key={d} className="bg-error-soft text-error-strong">{d}</Badge>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Cost breakdown */}
      <Card className="p-4 sm:p-5">
        <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.coach.costTitle')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="lf-caption text-content-faint">{t('admin.generation.coach.costTotal')}</p>
            <p className="lf-number lf-headline">{usd.format(report.cost.totalUsd)}</p>
          </div>
          <div>
            <p className="lf-caption text-content-faint">{t('admin.generation.coach.tokensTotal')}</p>
            <p className="lf-number lf-headline">{compact.format(report.cost.totalTokens)}</p>
          </div>
          <div>
            <p className="lf-caption text-content-faint">{t('admin.generation.coach.costPerLesson')}</p>
            <p className="lf-number lf-headline">{costPerPub !== null ? usd.format(costPerPub) : t('admin.generation.noData')}</p>
          </div>
          <div>
            <p className="lf-caption text-content-faint">{t('admin.generation.coach.imageEfficiency')}</p>
            <p className="lf-number lf-headline">
              {report.images.generated > 0
                ? formatPct(report.images.inherited / report.images.generated * 100, loc, 0)
                : t('admin.generation.noData')}
            </p>
            <p className="lf-caption text-content-muted">
              {report.images.inherited} {t('admin.generation.coach.inherited')} / {report.images.billed} {t('admin.generation.coach.billed')}
            </p>
          </div>
        </div>
      </Card>

      {/* Proposed actions */}
      {report.proposedActions.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.coach.actionsTitle')}</h3>
          <p className="lf-caption mb-3 text-content-faint">{t('admin.generation.coach.actionsNote')}</p>
          <ul className="space-y-3">
            {report.proposedActions.map((a, i) => (
              <li key={i} className="rounded-xl border border-outline/30 bg-surface-sunken p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <Badge className={actionTone(a.tag)}>{a.tag}</Badge>
                </div>
                <p className="lf-caption text-content">{a.proposal}</p>
                <p className="lf-caption mt-1.5 text-content-faint">{a.evidence}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* No issues banner */}
      {report.proposedActions.length === 0 && totalFailures === 0 && (
        <Card className={cn('p-5', className)}>
          <div className="flex items-center gap-3">
            <Icon name="check_circle" className="text-success" />
            <p className="lf-body text-content">{t('admin.generation.coach.allClear')}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
