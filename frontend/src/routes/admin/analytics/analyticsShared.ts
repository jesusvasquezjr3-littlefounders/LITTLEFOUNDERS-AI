/*
 * Shared vocabulary for the admin analytics surface (/admin/analytics).
 * Mirrors the backend contract exactly (Core /api/v1/admin/analytics/*):
 * dimension keys map 1:1 to Plausible v2 dimension strings server-side, and
 * `filters` serializes to the Plausible v2 tuple form
 * [["is","visit:country",["US"]]] — values of the same dimension are merged
 * into one tuple (OR semantics), distinct dimensions AND together.
 */

export type Period = 'day' | '7d' | '30d' | 'month' | '6mo' | '12mo';
export const PERIODS: Period[] = ['day', '7d', '30d', 'month', '6mo', '12mo'];

export type DimensionKey =
  | 'page'
  | 'source'
  | 'referrer'
  | 'channel'
  | 'country'
  | 'region'
  | 'device'
  | 'browser'
  | 'os'
  | 'entry_page'
  | 'exit_page'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign';

/** Plausible v2 filter property per dimension — same table the backend uses. */
export const DIMENSION_PROPERTY: Record<DimensionKey, string> = {
  page: 'event:page',
  source: 'visit:source',
  referrer: 'visit:referrer',
  channel: 'visit:channel',
  country: 'visit:country',
  region: 'visit:region',
  device: 'visit:device',
  browser: 'visit:browser',
  os: 'visit:os',
  entry_page: 'visit:entry_page',
  exit_page: 'visit:exit_page',
  utm_source: 'visit:utm_source',
  utm_medium: 'visit:utm_medium',
  utm_campaign: 'visit:utm_campaign',
};

/** The breakdown cards rendered in the grid, with their Material Symbols icon. */
export const BREAKDOWN_CARDS: { dimension: DimensionKey; icon: string }[] = [
  { dimension: 'page', icon: 'description' },
  { dimension: 'source', icon: 'travel_explore' },
  { dimension: 'channel', icon: 'alt_route' },
  { dimension: 'country', icon: 'public' },
  { dimension: 'device', icon: 'devices' },
  { dimension: 'browser', icon: 'web' },
  { dimension: 'os', icon: 'memory' },
  { dimension: 'entry_page', icon: 'login' },
  { dimension: 'exit_page', icon: 'logout' },
  { dimension: 'utm_campaign', icon: 'campaign' },
];

/** Dimensions offered in the manual filter builder (row clicks cover the rest). */
export const BUILDER_DIMENSIONS: DimensionKey[] = ['country', 'source', 'device', 'browser', 'page', 'channel'];

export interface AnalyticsFilter {
  dimension: DimensionKey;
  value: string;
}

/**
 * Serialize active filters to the `&filters=` query fragment (empty string when
 * none). Same-dimension values merge into a single "is" tuple.
 */
export function filtersToQuery(filters: AnalyticsFilter[]): string {
  if (filters.length === 0) return '';
  const byDimension = new Map<DimensionKey, string[]>();
  for (const f of filters) {
    const values = byDimension.get(f.dimension) ?? [];
    if (!values.includes(f.value)) values.push(f.value);
    byDimension.set(f.dimension, values);
  }
  const tuples = [...byDimension.entries()].map(([dimension, values]) => ['is', DIMENSION_PROPERTY[dimension], values]);
  return `&filters=${encodeURIComponent(JSON.stringify(tuples))}`;
}

/**
 * Plausible reports countries as ISO-3166 alpha-2 codes. Map to a flag emoji +
 * the locale-aware region name via Intl.DisplayNames; fall back to the raw
 * code for anything unmappable.
 */
export function countryLabel(code: string, locale?: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return code;
  const flag = cc
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' }).of(cc);
  } catch {
    name = undefined;
  }
  return `${flag} ${name ?? cc}`;
}

/* ── Response shapes (backend contract) ─────────────────────────────── */

export interface OverviewData {
  period: Period;
  aggregate: { visitors: number; pageviews: number; bounce_rate: number; visit_duration: number };
  timeseries: { date: string; visitors: number; pageviews: number }[];
}

export interface BehaviorData {
  period: Period;
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export interface HealthData {
  summary: { total: number; down: number };
  monitors: { id: number; name: string; status: number; pingMs: number | null; uptime24h: number | null }[];
}

export interface BreakdownRow {
  label: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  visitDuration: number;
}

export interface BreakdownData {
  period: string;
  dimension: string;
  rows: BreakdownRow[];
}

/**
 * Base URL for the ONE raw (non-envelope) route: /admin/analytics/report.pdf
 * needs a manual fetch with the Bearer header (a plain <a href> can't carry
 * it). Mirrors the constant in src/lib/api.ts, which doesn't export it.
 */
export const API_BASE_URL: string = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';
