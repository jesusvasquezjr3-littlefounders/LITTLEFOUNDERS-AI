import type { TrendPoint } from '@/components/ui';

/*
 * Shared types for the admin generation dashboard components.
 * Mirrors backend/src/services/adminData.ts return shapes.
 */

// ── Run kind (Forge lessons — the only producer) ────────────────────────────

/**
 * The single producer that writes to the generation telemetry tables
 * (`generation_runs`, `generation_slots`, `generation_runs_live`).
 * `generation_runs.params.kind` is absent or `'lessons'` for every Forge run.
 */
export const GENERATION_KINDS = ['lessons'] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

/** Forge predates `params.kind`, so an unmarked run is a lesson run. */
export const DEFAULT_GENERATION_KIND: GenerationKind = 'lessons';

/**
 * Narrows an untrusted wire value into a `GenerationKind`.
 *
 * `kind` is the authoritative signal, but it is not available on every path:
 * `generation_runs_live` (migration 0018) has no `kind` column, so the browser's
 * Realtime subscription receives rows without one. There is only one kind
 * today, so any unrecognized or missing value falls back to it.
 */
export function resolveGenerationKind(
  source: { kind?: string | null; runId?: string | null } | null | undefined,
): GenerationKind {
  const declared = source?.kind;
  if (declared) {
    const match = GENERATION_KINDS.find((k) => k === declared);
    if (match) return match;
  }
  return DEFAULT_GENERATION_KIND;
}

// ── Pipeline stages, per kind ───────────────────────────────────────────────

export interface GenerationStageDescriptor {
  /** i18n key suffix under `admin.generation.stages.*` AND the `stageBreakdown` key. */
  key: string;
  /** Material Symbols name. */
  icon: string;
  /** Terminal stage: rendered as done, never pulsed as in-flight. */
  terminal?: boolean;
  /** Not in-flight: a non-zero count here is a queue, not work in progress. */
  idle?: boolean;
}

/**
 * The stage list is keyed by kind for forward compatibility, though only
 * `lessons` exists today.
 */
export const GENERATION_STAGES: Record<GenerationKind, readonly GenerationStageDescriptor[]> = {
  lessons: [
    { key: 'pending', icon: 'pending', idle: true },
    { key: 'planning', icon: 'psychology' },
    { key: 'writing', icon: 'edit_note' },
    { key: 'reviewing', icon: 'grading' },
    { key: 'localizing', icon: 'translate' },
    { key: 'illustrating', icon: 'image' },
    { key: 'publishing', icon: 'cloud_upload' },
    { key: 'published', icon: 'task_alt', terminal: true },
    { key: 'skipped', icon: 'skip_next', terminal: true },
  ],
};

/**
 * Stage list for a run kind. Returns the module-level array, so the identity is
 * STABLE across renders — callers use it as a hook dependency (see the render-loop
 * note in PipelineFlow.tsx). Never build a fresh array here.
 */
export function stagesForKind(kind: GenerationKind): readonly GenerationStageDescriptor[] {
  return GENERATION_STAGES[kind];
}

export interface LiveRunHeartbeat {
  runId: string;
  trackId: string | null;
  courseSlug: string;
  register: string;
  /**
   * Producer marker (`params.kind`). Optional: `generation_runs_live` has no
   * such column today, so the Realtime path leaves it null and callers fall back
   * to `resolveGenerationKind`. Kept as a raw string because it is unvalidated
   * wire data — narrow it with `resolveGenerationKind`, never cast it.
   */
  kind?: string | null;
  activeSlots: number;
  completedSlots: number;
  failedSlots: number;
  skippedSlots: number;
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

export function processedSlots(heartbeat: Pick<LiveRunHeartbeat, 'completedSlots' | 'failedSlots' | 'skippedSlots'>): number {
  return heartbeat.completedSlots + heartbeat.failedSlots + heartbeat.skippedSlots;
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
  /** See `LiveRunHeartbeat.kind`. Narrow with `resolveGenerationKind`. */
  kind?: string | null;
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
