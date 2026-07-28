import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, ProgressBar, StatCard, TrendChart } from '@/components/ui';
import { AlertBanner } from './AlertBanner';
import { cn } from '@/lib/utils';
import { toTrendPoints, type GenerationAnalytics } from './generationTypes';
import { failedFromI18nKey, formatPct, formatFixed } from './generationI18n';

/*
 * Cross-run analytics: cost trends, quality over time, cache efficiency,
 * failure breakdown by stage/locale, and platform averages. Fetches
 * /api/v1/admin/generation/analytics on mount and on course selection.
 */

const RUBRIC_DIMENSIONS = [
  'kid_safety',
  'age_fit',
  'concreteness',
  'pedagogy',
  'cognitive_engagement',
  'feedback_quality',
  'distractor_quality',
  'narrative_quality',
  'naturalness',
] as const;

interface AnalyticsChartsProps {
  courseSlug?: string;
  courses?: string[];
  className?: string;
}

export function AnalyticsCharts({ courseSlug, className }: AnalyticsChartsProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [analytics, setAnalytics] = useState<GenerationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const compact = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact' });
  const loc = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const qs = courseSlug ? `?course=${encodeURIComponent(courseSlug)}` : '';
      const res = await api<GenerationAnalytics>(`/admin/generation/analytics${qs}`, { token });
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
        setAnalytics(null);
      } else {
        setAnalytics(res.data);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [courseSlug, getToken]);

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-body-sm flex items-center gap-2 text-content-muted">
          <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
        </p>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-body-sm text-content-muted">{error ?? t('admin.generation.analytics.empty')}</p>
      </Card>
    );
  }

  const costPoints = toTrendPoints(analytics.costTrend, (item) => item.usdPerPublished);
  const cachePoints = toTrendPoints(analytics.cacheEfficiency, (item) => item.cacheHitPct);

  return (
    <div className={cn('space-y-5', className)}>
      {/* Averages cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          dense
          icon={<Icon name="payments" />}
          tone="secondary"
          value={analytics.averages.costPerPublished !== null ? usd.format(analytics.averages.costPerPublished) : t('admin.generation.noData')}
          label={t('admin.generation.analytics.avgCostPerLesson')}
        />
        <StatCard
          dense
          icon={<Icon name="numbers" />}
          tone="primary"
          value={analytics.averages.tokensPerLesson !== null ? compact.format(analytics.averages.tokensPerLesson) : t('admin.generation.noData')}
          label={t('admin.generation.analytics.avgTokensPerLesson')}
        />
        <StatCard
          dense
          icon={<Icon name="bolt" />}
          tone="secondary"
          value={analytics.averages.cacheHitPct !== null ? formatPct(analytics.averages.cacheHitPct, loc, 1) : t('admin.generation.noData')}
          label={t('admin.generation.analytics.avgCacheHit')}
        />
      </div>

      {/* Historical alerts */}
      <AlertBanner analytics={analytics} />

      {/* Cost trend */}
      {costPoints.length > 1 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.analytics.costTrend')}</h3>
          <TrendChart points={costPoints} ariaLabel={t('admin.generation.analytics.costTrend')} />
        </Card>
      )}

      {/* Cache efficiency trend */}
      {cachePoints.length > 1 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.analytics.cacheTrend')}</h3>
          <TrendChart points={cachePoints} ariaLabel={t('admin.generation.analytics.cacheTrend')} />
        </Card>
      )}

      {/* Success rate + cost forecast */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.analytics.successRate')}</h3>
          <StatCard
            dense
            icon={<Icon name="task_alt" />}
            tone="primary"
            value={`${analytics.stageSuccessRate.rate.toFixed(0)}%`}
            label={t('admin.generation.analytics.successRateDetail', { passed: analytics.stageSuccessRate.passed, total: analytics.stageSuccessRate.passed + analytics.stageSuccessRate.failed })}
          />
        </Card>
        {analytics.costForecast && (
          <Card className="p-4 sm:p-5">
            <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.analytics.forecast')}</h3>
            <div className="space-y-2">
              <p className="lf-body-sm text-content-muted">
                {t('admin.generation.analytics.forecastPerLesson', { cost: usd.format(analytics.costForecast.perLesson ?? 0) })}
              </p>
              <p className="lf-headline text-content">
                {t('admin.generation.analytics.forecastPerCourse', { cost: usd.format(analytics.costForecast.perCourse ?? 0) })}
              </p>
              <p className="lf-caption text-content-faint">
                {t('admin.generation.analytics.forecastBasedOn', { count: analytics.costForecast.basedOn })}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Quality dimensions over time */}
      {analytics.qualityTrend.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">
            {t('admin.generation.analytics.qualityTrend', { runs: analytics.qualityTrend.length })}
          </h3>
          <p className="lf-caption mb-3 text-content-faint">{t('admin.generation.judge.note')}</p>
          <div className="space-y-2">
            {RUBRIC_DIMENSIONS.map((dim) => {
              const last = analytics.qualityTrend[analytics.qualityTrend.length - 1];
              const mean = last?.dimMeans[dim];
              return mean !== null && mean !== undefined ? (
                <div key={dim} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                  <span className="lf-caption truncate text-content-muted">{t(`admin.generation.dims.${dim}`, { defaultValue: dim })}</span>
                  <ProgressBar className="col-span-2 sm:col-span-1" value={(mean / 5) * 100} tone={mean >= 4 ? 'primary' : 'accent'} label={dim} />
                  <span className="lf-number lf-caption text-right">{formatFixed(mean, loc, 2)}</span>
                </div>
              ) : null;
            })}
          </div>
        </Card>
      )}

      {/* Failure breakdown by stage */}
      {analytics.failureByStage.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.analytics.failureByStage')}</h3>
          <div className="space-y-2">
            {analytics.failureByStage.map((f) => (
              <div key={f.stage} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <span className="lf-caption truncate text-content-muted">{t(`admin.generation.failedFromLabels.${failedFromI18nKey(f.stage)}`, { defaultValue: f.stage })}</span>
                <div className="col-span-2 sm:col-span-1 flex items-center gap-2">
                  <ProgressBar value={f.pct} tone="accent" label={f.stage} className="flex-1" />
                </div>
                <span className="lf-number lf-caption text-right">{f.count} ({formatPct(f.pct, loc)})</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Platform totals */}
      <Card className="p-4 sm:p-5">
        <h3 className="lf-label mb-1 text-content-muted">{t('admin.generation.analytics.summary')}</h3>
        <p className="lf-caption text-content-muted">
          {t('admin.generation.analytics.runsAnalyzed', { count: analytics.runsAnalyzed })}
        </p>
      </Card>
    </div>
  );
}
