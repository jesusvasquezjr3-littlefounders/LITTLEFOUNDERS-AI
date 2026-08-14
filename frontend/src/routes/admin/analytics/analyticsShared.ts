/*
 * Shared vocabulary for the admin analytics surface (/admin/analytics).
 * Mirrors the backend contract exactly (Core /api/v1/admin/analytics/*):
 * dimension keys map 1:1 to Plausible v2 dimension strings server-side, and
 * `filters` serializes to the Plausible v2 tuple form
 * [["is","visit:country",["US"]]] — values of the same dimension are merged
 * into one tuple (OR semantics), distinct dimensions AND together.
 */

export type Period = 'day' | '7d' | '30d' | 'month' | '6mo' | '12mo' | 'year' | 'all' | 'custom';

/** Presets offered in the picker, in the order they appear. `custom` is chosen separately. */
export const PERIODS: Period[] = ['day', '7d', '30d', 'month', '6mo', '12mo', 'year', 'all'];

/**
 * A window: a preset, or an explicit inclusive day range. Every analytics
 * request on the page is built from ONE of these, so the map, the breakdowns,
 * the behavioural card and the exports can never describe different windows.
 */
export interface PeriodSelection {
  period: Period;
  from?: string;
  to?: string;
}

/** Serialize a selection to the query fragment Core expects (no leading `?`). */
export function periodQuery(selection: PeriodSelection): string {
  if (selection.period !== 'custom') return `period=${selection.period}`;
  return `period=custom&from=${selection.from ?? ''}&to=${selection.to ?? ''}`;
}

/** A selection is only usable once a custom range actually has both ends. */
export function isCompleteSelection(selection: PeriodSelection): boolean {
  return selection.period !== 'custom' || Boolean(selection.from && selection.to);
}

/** The `period=…` fragment, already serialized — what child cards receive. */
export type PeriodQuery = string;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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

/** Lower-frequency dimensions live behind an expandable explorer so the first view stays decision-oriented. */
export const SECONDARY_BREAKDOWN_CARDS: { dimension: DimensionKey; icon: string }[] = [
  { dimension: 'region', icon: 'map' },
  { dimension: 'referrer', icon: 'link' },
  { dimension: 'utm_source', icon: 'source' },
  { dimension: 'utm_medium', icon: 'tune' },
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

export interface Aggregate {
  visitors: number;
  pageviews: number;
  bounce_rate: number;
  visit_duration: number;
}

export interface OverviewData {
  period: Period;
  /** Resolved window bounds. The UI states these, not the label it asked for. */
  from: string;
  to: string;
  aggregate: Aggregate;
  timeseries: { date: string; visitors: number; pageviews: number }[];
  /** Null when there is nothing to compare against, or the comparison read failed. */
  previous: (Aggregate & { from: string; to: string }) | null;
}

export interface BehaviorData {
  period: Period;
  from: string;
  to: string;
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

/* ── Internal-traffic exclusions ─────────────────────────────────────── */

export interface ExclusionRow {
  id: string;
  network: string;
  label: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface StaffSighting {
  address: string;
  userId: string;
  displayName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hits: number;
}

export interface ExclusionsData {
  self: { ip: string | null; excluded: boolean };
  active: ExclusionRow[];
  suggestions: StaffSighting[];
  coveredAddresses: string[];
  windowDays: number;
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
 * Base URL for the raw (non-envelope) export routes: report.pdf/.csv/.xlsx
 * need a manual fetch with the Bearer header, which a plain <a href> cannot
 * carry. Re-exported from the API client rather than re-derived, so the two
 * cannot drift apart.
 */
export { BASE_URL as API_BASE_URL } from '@/lib/api';
