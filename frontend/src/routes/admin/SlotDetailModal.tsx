import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Badge, Card, Icon, ProgressBar } from '@/components/ui';
import { failedFromI18nKey, formatFixed } from './generationI18n';

/*
 * Slot detail modal — full inspection of a single generated lesson.
 * Opened from the slot table in Run History by clicking a lesson row.
 * Shows: rubric breakdown, error detail, metrics, and run context.
 */

interface SlotDetail {
  slotId: string;
  runId: string;
  state: string;
  failedFrom: string | null;
  error: string | null;
  salvaged: boolean;
  droppedSegments: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  durationMs: number | null;
  durationHuman: string | null;
  rubric: Record<string, number | string> | null;
  reviewCycles: number | null;
  earlyStopped: boolean;
  updatedAt: string;
  run: { courseSlug: string; register: string; updatedAt: string } | null;
}

const DIMS = [
  'kid_safety', 'age_fit', 'concreteness', 'pedagogy',
  'cognitive_engagement', 'feedback_quality', 'distractor_quality',
  'narrative_quality', 'naturalness',
] as const;

const STATE_BADGE: Record<string, string> = {
  published: 'bg-success-soft text-success-strong',
  failed: 'bg-error-soft text-error-strong',
  'dry-run': 'bg-surface-sunken text-content-muted',
  skipped: 'bg-warning-soft text-warning-strong',
};

interface SlotDetailModalProps {
  runId: string;
  slotId: string;
  onClose: () => void;
}

export function SlotDetailModal({ runId, slotId, onClose }: SlotDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [detail, setDetail] = useState<SlotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const loc = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      const res = await api<SlotDetail>(
        `/admin/generation/slots/${encodeURIComponent(runId)}/${encodeURIComponent(slotId)}`,
        { token },
      );
      if (!cancelled) {
        setDetail(res.error ? null : res.data);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [runId, slotId, getToken]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-outline/30 bg-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline/20 bg-surface px-5 py-4 rounded-t-2xl">
          <div className="min-w-0">
            <h2 className="lf-title truncate">{slotId.split('/').slice(-2).join(' / ')}</h2>
            {detail?.run && (
              <p className="lf-caption text-content-muted">{detail.run.courseSlug} · {detail.run.register}</p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-surface-sunken transition-colors" aria-label={t('actions.close')}>
            <Icon name="close" className="text-[20px] text-content-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="lf-body-sm flex items-center gap-2 text-content-muted">
              <Icon name="progress_activity" className="animate-spin" /> {t('admin.generation.loading')}
            </p>
          ) : !detail ? (
            <p className="lf-body-sm text-content-muted">{t('admin.generation.slotDetail.notFound')}</p>
          ) : (
            <>
              {/* Status row */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATE_BADGE[detail.state] ?? 'bg-surface-sunken text-content-muted'}>
                  {t(`admin.generation.states.${detail.state}`, { defaultValue: detail.state })}
                </Badge>
                {detail.salvaged && <Badge className="bg-warning-soft text-warning-strong">{t('admin.generation.salvaged')}</Badge>}
                {detail.earlyStopped && <Badge className="bg-error-soft text-error-strong">{t('admin.generation.earlyStop')}</Badge>}
                {detail.failedFrom && (
                  <Badge className="bg-surface-sunken text-content-muted">
                    {t('admin.generation.slotDetail.failedFrom')}: {t(`admin.generation.failedFromLabels.${failedFromI18nKey(detail.failedFrom)}`, { defaultValue: detail.failedFrom })}
                  </Badge>
                )}
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Metric label={t('admin.generation.slotDetail.duration')} value={detail.durationHuman ?? t('admin.generation.noData')} />
                <Metric label={t('admin.generation.slots.cycles')} value={detail.reviewCycles !== null ? String(detail.reviewCycles) : t('admin.generation.noData')} />
                <Metric label={t('admin.generation.slotDetail.dropped')} value={detail.droppedSegments > 0 ? String(detail.droppedSegments) : '0'} />
                <Metric label={t('admin.generation.slotDetail.images')} value={`${detail.imagesBilled}+${detail.imagesInherited}`} />
              </div>

              {/* Error */}
              {detail.error && (
                <Card className="p-4 border-l-4 border-l-error bg-error-soft/30">
                  <h3 className="lf-label mb-1 text-error">{t('admin.generation.slotDetail.error')}</h3>
                  <pre className="lf-caption whitespace-pre-wrap break-words text-content">{detail.error}</pre>
                </Card>
              )}

              {/* Rubric */}
              {detail.rubric && (
                <div className="space-y-2">
                  <h3 className="lf-label text-content-muted">{t('admin.generation.judge.title', { count: 1 })}</h3>
                  {DIMS.map((dim) => {
                    const v = detail.rubric?.[dim];
                    if (typeof v !== 'number') return null;
                    return (
                      <div key={dim} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
                        <span className="lf-caption truncate text-content-muted">{t(`admin.generation.dims.${dim}`, { defaultValue: dim })}</span>
                        <ProgressBar className="col-span-2 sm:col-span-1" value={(v / 5) * 100} tone={v >= 4 ? 'primary' : 'accent'} label={dim} />
                        <span className="lf-number lf-caption text-right">{formatFixed(v, loc, 2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Run context */}
              {detail.run && (
                <p className="lf-caption text-content-faint">
                  {t('admin.generation.slotDetail.runId')}: {detail.runId} · {new Date(detail.run.updatedAt).toLocaleString(loc)}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-sunken px-3 py-2">
      <p className="lf-caption text-content-faint">{label}</p>
      <p className="lf-number lf-title">{value}</p>
    </div>
  );
}
