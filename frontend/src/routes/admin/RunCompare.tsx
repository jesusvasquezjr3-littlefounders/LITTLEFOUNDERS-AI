import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card, Dropdown, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatPct, formatFixed } from './generationI18n';
import type { DropdownOption } from '@/components/ui';
import type { RunListItem } from './generationTypes';

/*
 * Run comparison — side-by-side diff of two generation runs.
 * Select two runs from a dropdown, fetches /admin/generation/compare,
 * and displays per-run stats with computed deltas (green/red diffs).
 */

interface CompareRun {
  runId: string;
  courseSlug: string;
  register: string;
  published: number;
  failed: number;
  slotsEnumerated: number;
  usdUsed: number;
  tokensUsed: number;
  cachedTokens: number;
  cacheHitPct: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  judgeMeans: Record<string, number | null>;
  failureHeatmap: Record<string, number>;
  updatedAt: string;
}

interface RunComparison {
  runs: CompareRun[];
  deltas: { published: number; failed: number; usdUsed: number; cacheHitPct: number } | null;
}

const DIMS = [
  'kid_safety', 'age_fit', 'concreteness', 'pedagogy',
  'cognitive_engagement', 'feedback_quality', 'distractor_quality',
  'narrative_quality', 'naturalness',
] as const;

interface RunCompareProps {
  runs: RunListItem[];
  className?: string;
}

function deltaClass(delta: number, invert = false): string {
  if (delta === 0) return 'text-content-muted';
  const good = invert ? delta < 0 : delta > 0;
  return good ? 'text-success' : 'text-error';
}

export function RunCompare({ runs, className }: RunCompareProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [runA, setRunA] = useState<string>('');
  const [runB, setRunB] = useState<string>('');
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const loc = i18n.resolvedLanguage ?? 'en-US';
  const usd = new Intl.NumberFormat(loc, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' });

  const runOptions: DropdownOption<string>[] = runs.map((r) => ({
    value: r.runId,
    label: `${r.runId.slice(0, 24)} · ${new Date(r.updatedAt).toLocaleDateString(loc)}`,
  }));

  useEffect(() => {
    if (!runA || !runB) { setComparison(null); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const token = await getToken();
      const res = await api<RunComparison>(
        `/admin/generation/compare?runA=${encodeURIComponent(runA)}&runB=${encodeURIComponent(runB)}`,
        { token },
      );
      if (!cancelled) {
        setComparison(res.error ? null : res.data);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [runA, runB, getToken]);

  if (runs.length < 2) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="lf-caption text-content-muted">{t('admin.generation.compare.needTwo')}</p>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Selectors — stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <Dropdown value={runA} options={runOptions} onChange={setRunA} ariaLabel={t('admin.generation.compare.runA')} compact align="left" />
        </div>
        <div className="hidden sm:flex items-center justify-center shrink-0">
          <Icon name="arrow_forward" className="text-content-muted" />
        </div>
        <div className="flex items-center justify-center sm:hidden">
          <Icon name="arrow_downward" className="text-content-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <Dropdown value={runB} options={runOptions} onChange={setRunB} ariaLabel={t('admin.generation.compare.runB')} compact align="left" />
        </div>
      </div>

      {loading && (
        <Card className="p-5">
          <p className="lf-caption flex items-center gap-2 text-content-muted">
            <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
          </p>
        </Card>
      )}

      {comparison && comparison.runs.length === 2 && (
        <>
          {/* KPI comparison */}
          <div className="grid grid-cols-2 gap-3">
            {comparison.runs.map((run) => (
              <Card key={run.runId} className="p-4 sm:p-5">
                <h3 className="lf-label mb-2 truncate text-content-muted">{run.runId.slice(0, 24)}</h3>
                <div className="space-y-3">
                  <CompareRow label={t('admin.generation.kpi.published')} value={`${run.published}/${run.slotsEnumerated}`} />
                  <CompareRow label={t('admin.generation.kpi.failed')} value={String(run.failed)} />
                  <CompareRow label={t('admin.generation.kpi.cost')} value={usd.format(run.usdUsed)} />
                  <CompareRow label={t('admin.generation.kpi.cacheHit')} value={formatPct(run.cacheHitPct, loc, 1)} />
                  <CompareRow label={t('admin.generation.kpi.images')} value={`${run.imagesBilled}+${run.imagesInherited}`} />
                </div>
              </Card>
            ))}
          </div>

          {/* Deltas */}
          {comparison.deltas && (
            <Card className="p-4 sm:p-5">
              <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.compare.deltas')}</h3>
              <div className="flex flex-wrap gap-4">
                <DeltaBadge label={t('admin.generation.kpi.published')} delta={comparison.deltas.published} />
                <DeltaBadge label={t('admin.generation.kpi.failed')} delta={comparison.deltas.failed} invert />
                <DeltaBadge label={t('admin.generation.kpi.cost')} delta={comparison.deltas.usdUsed} invert />
                <DeltaBadge label={t('admin.generation.kpi.cacheHit')} delta={comparison.deltas.cacheHitPct} />
              </div>
            </Card>
          )}

          {/* Judge comparison */}
          <Card className="p-4 sm:p-5">
            <h3 className="lf-label mb-3 text-content-muted">{t('admin.generation.compare.judge')}</h3>
            <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-2 items-center">
              {DIMS.map((dim) => {
                const a = comparison.runs[0]?.judgeMeans[dim] ?? null;
                const b = comparison.runs[1]?.judgeMeans[dim] ?? null;
                if (a === null && b === null) return null;
                const diff = (typeof a === 'number' && typeof b === 'number') ? b - a : null;
                return (
                  <React.Fragment key={dim}>
                    <span className="lf-caption text-content-muted col-span-4 sm:col-span-1">{t(`admin.generation.dims.${dim}`, { defaultValue: dim })}</span>
                    <span className="lf-number lf-caption col-span-2 sm:col-span-1">{a !== null ? formatFixed(a, loc, 2) : t('admin.generation.noData')}</span>
                    <span className="lf-number lf-caption col-span-2 sm:col-span-1">{b !== null ? formatFixed(b, loc, 2) : t('admin.generation.noData')}</span>
                    <span className={cn('lf-number lf-caption col-span-4 sm:col-span-1 text-right', diff !== null ? deltaClass(diff) : 'text-content-muted')}>
                      {diff !== null ? (diff >= 0 ? '+' : '') + formatFixed(diff, loc, 2) : ''}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="lf-caption text-content-muted">{label}</span>
      <span className="lf-number lf-caption font-medium">{value}</span>
    </div>
  );
}

function DeltaBadge({ label, delta, invert = false }: { label: string; delta: number; invert?: boolean; t?: (k: string) => string }) {
  const positive = invert ? delta < 0 : delta > 0;
  return (
    <Badge className={cn(positive ? 'bg-success-soft text-success-strong' : delta === 0 ? 'bg-surface-sunken text-content-muted' : 'bg-error-soft text-error-strong')}>
      {label}: {delta >= 0 ? '+' : ''}{delta.toFixed(delta % 1 === 0 ? 0 : 2)}
    </Badge>
  );
}
