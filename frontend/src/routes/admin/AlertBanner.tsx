import { useTranslation } from 'react-i18next';
import { Card, Badge, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { processedSlots, type LiveRunHeartbeat, type GenerationAnalytics } from './generationTypes';
import { formatPct } from './generationI18n';

/*
 * Alert banner displayed at the top of every generation tab when anomalies
 * are detected. Watches both live runs (cost overruns, drops in quality) and
 * historical analytics (deviations from baseline).
 */

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning';
  message: string;
  detail: string;
}

function computeAlerts(
  heartbeat: LiveRunHeartbeat | null,
  analytics: GenerationAnalytics | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  usd: Intl.NumberFormat,
  locale: string,
): AlertItem[] {
  const alerts: AlertItem[] = [];

  // ── Live alerts ──────────────────────────────────────────────────────────
  if (heartbeat) {
    const processed = processedSlots(heartbeat);
    const progressPct = heartbeat.totalSlots > 0
      ? (processed / heartbeat.totalSlots) * 100
      : 0;
    const failRate = processed > 0
      ? heartbeat.failedSlots / processed
      : 0;

    // Cost overrun alert (live)
    const estimatedTotal = heartbeat.completedSlots > 0 && progressPct > 5
      ? (heartbeat.usdUsed / (progressPct / 100))
      : null;
    if (estimatedTotal !== null && estimatedTotal > 100) {
      alerts.push({
        id: 'live-cost',
        severity: 'warning',
        message: t('admin.generation.alerts.liveCost.title', { estimated: usd.format(estimatedTotal) }),
        detail: t('admin.generation.alerts.liveCost.detail', { spent: usd.format(heartbeat.usdUsed), progress: formatPct(progressPct, locale) }),
      });
    }

    // Cache efficiency alert
    const cachePct = heartbeat.tokensUsed > 0 ? (heartbeat.cachedTokens / heartbeat.tokensUsed) * 100 : 0;
    if (heartbeat.tokensUsed > 100_000 && cachePct < 20) {
      alerts.push({
        id: 'live-cache',
        severity: 'critical',
        message: t('admin.generation.alerts.lowCache.title'),
        detail: t('admin.generation.alerts.lowCache.detail', { pct: formatPct(cachePct, locale, 1) }),
      });
    }

    // High failure rate
    if (failRate > 0.3 && processed > 5) {
      alerts.push({
        id: 'live-failrate',
        severity: 'critical',
        message: t('admin.generation.alerts.highFailRate.title', { rate: formatPct(failRate * 100, locale) }),
        detail: t('admin.generation.alerts.highFailRate.detail', { failed: heartbeat.failedSlots, total: processed }),
      });
    }
  }

  // ── Historical alerts (from analytics) ───────────────────────────────────
  if (analytics && analytics.runsAnalyzed > 1) {
    // Quality degradation: latest run dimension means vs average
    if (analytics.qualityTrend.length >= 2) {
      const latest = analytics.qualityTrend[analytics.qualityTrend.length - 1];
      const prev = analytics.qualityTrend[analytics.qualityTrend.length - 2];
      if (latest && prev) {
        for (const dim of ['kid_safety', 'age_fit', 'concreteness'] as const) {
          const lv = latest.dimMeans[dim];
          const pv = prev.dimMeans[dim];
          if (typeof lv === 'number' && typeof pv === 'number' && pv - lv > 0.8) {
            alerts.push({
              id: `hist-${dim}`,
              severity: 'warning',
              message: t('admin.generation.alerts.qualityDrop.title', { dim: t(`admin.generation.dims.${dim}`, { defaultValue: dim }) }),
              detail: t('admin.generation.alerts.qualityDrop.detail', {
                from: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pv),
                to: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(lv),
              }),
            });
          }
        }
      }
    }

    // Cost spike
    if (analytics.costTrend.length >= 2) {
      const costs = analytics.costTrend.filter((c) => c.usdPerPublished !== null).map((c) => c.usdPerPublished!);
      if (costs.length >= 3) {
        const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
        const latestCost = costs[costs.length - 1]!;
        if (latestCost > avg * 2) {
          alerts.push({
            id: 'hist-cost',
            severity: 'critical',
            message: t('admin.generation.alerts.costSpike.title'),
            detail: t('admin.generation.alerts.costSpike.detail', { latest: usd.format(latestCost), avg: usd.format(avg) }),
          });
        }
      }
    }
  }

  return alerts;
}

interface AlertBannerProps {
  heartbeat?: LiveRunHeartbeat | null;
  analytics?: GenerationAnalytics | null;
  className?: string;
}

export function AlertBanner({ heartbeat, analytics, className }: AlertBannerProps) {
  const { t, i18n } = useTranslation();
  const usd = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });
  const loc = i18n.resolvedLanguage ?? 'en-US';
  const alerts = computeAlerts(heartbeat ?? null, analytics ?? null, t, usd, loc);

  if (alerts.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={cn(
            'flex items-start gap-3 p-3 sm:p-4 border-l-4',
            alert.severity === 'critical'
              ? 'border-l-error bg-error-soft/50'
              : 'border-l-accent bg-accent-soft/50',
          )}
        >
          <Icon
            name={alert.severity === 'critical' ? 'error' : 'warning'}
            className={cn(
              'shrink-0 mt-0.5',
              alert.severity === 'critical' ? 'text-error' : 'text-accent',
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <p className="lf-body-sm font-medium text-content">{alert.message}</p>
              <Badge className={alert.severity === 'critical' ? 'bg-error-soft text-error-strong' : 'bg-accent-soft text-accent-strong'}>
                {alert.severity === 'critical' ? t('admin.generation.alerts.critical') : t('admin.generation.alerts.warning')}
              </Badge>
            </div>
            <p className="lf-caption text-content-muted">{alert.detail}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
