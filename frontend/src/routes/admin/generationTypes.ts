import type { TrendPoint } from '@/components/ui';

/*
 * Shared types for the admin generation dashboard components.
 * Mirrors backend/src/services/adminData.ts return shapes.
 */

export interface LiveRunHeartbeat {
  runId: string;
  trackId: string | null;
  courseSlug: string;
  register: string;
  activeSlots: number;
  completedSlots: number;
  failedSlots: number;
  totalSlots: number;
  stageBreakdown: Record<string, number>;
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  startedAt: string;
  updatedAt: string;
}

export interface LiveGenerationStatus {
  activeRuns: LiveRunHeartbeat[];
}

export interface GenerationAnalytics {
  courseSlug: string | null;
  runsAnalyzed: number;
  costTrend: { runId: string; updatedAt: string; usdPerPublished: number | null; tokensPerLesson: number | null }[];
  qualityTrend: { runId: string; updatedAt: string; dimMeans: Record<string, number | null> }[];
  cacheEfficiency: { runId: string; updatedAt: string; cacheHitPct: number }[];
  failureByStage: { stage: string; count: number; pct: number }[];
  failureByLocale: { locale: string; count: number; pct: number }[];
  stageSuccessRate: { stage: string; passed: number; failed: number; rate: number };
  costForecast: { perLesson: number | null; perCourse: number | null; basedOn: number } | null;
  averages: {
    costPerPublished: number | null;
    tokensPerLesson: number | null;
    cacheHitPct: number | null;
  };
}

export interface RunListItem {
  runId: string;
  trackId: string | null;
  courseSlug: string;
  register: string;
  published: number;
  failed: number;
  slotsEnumerated: number;
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
  updatedAt: string;
}

export interface TrackListItem {
  trackId: string;
  courseSlug: string;
  budgetUsd: number | null;
  halted: string | null;
  totals: Record<string, number>;
  failureHeatmap: Record<string, number>;
  mopUp: string[];
  shards: number;
  updatedAt: string;
}

export interface GenerationOverview {
  tracks: TrackListItem[];
  runs: RunListItem[];
}

export interface SlotItem {
  slotId: string;
  state: string;
  failedFrom: string | null;
  error: string | null;
  salvaged: boolean;
  droppedSegments: number;
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  durationMs: number | null;
  rubric: Record<string, number | string> | null;
  reviewCycles: number | null;
  earlyStopped: boolean;
}

export interface RunDetail {
  run: RunListItem;
  slots: SlotItem[];
}

export function toTrendPoints<T extends { runId: string; updatedAt: string }>(
  items: T[],
  getValue: (item: T) => number | null,
  labelFn?: (item: T) => string,
): TrendPoint[] {
  return items
    .map((item) => {
      const v = getValue(item);
      return v !== null ? { label: labelFn ? labelFn(item) : item.runId.slice(0, 12), value: v } : null;
    })
    .filter((p): p is TrendPoint => p !== null)
    .slice()
    .reverse(); // chronological order — .slice() prevents mutation of caller's array
}
