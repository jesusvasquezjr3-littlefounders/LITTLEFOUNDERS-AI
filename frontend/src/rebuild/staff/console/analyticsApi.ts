/*
 * S5 Analytics & Health (view_analytics), W2T.3: the wire shapes Core serves
 * under /admin/analytics/*, /admin/insights/* and /admin/health/services,
 * hand-mirrored (no shared types across packages by design) and checked on
 * arrival. The period and filter vocabulary is Core's own (backend
 * routes/admin.ts PeriodSchema, BreakdownQuerySchema, parseFilters), carried
 * over from the legacy page it replaces.
 *
 * Four sources answer four different questions and are never merged:
 * our own event stream (who was here, with the role attached), the product's
 * own usage views, Plausible (anonymous, consented, marketing pages only) and
 * Umami (marketing plus signed-in adult surfaces; never a child's session).
 * The consent gate (H.1) acts at the source: a child's events exist only when
 * a verified guardian consented, so every figure here is already gated.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isNullableNumber = (value: unknown): value is number | null => value === null || isNumber(value);
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const arrayOf = <T>(value: unknown, item: (entry: unknown) => entry is T): value is T[] => Array.isArray(value) && value.every(item);
const isPair = (value: unknown): value is [string, string] => Array.isArray(value) && value.length === 2 && value.every(isString);

/* ---- The window ----------------------------------------------------------- */

export const PERIODS = ['day', '7d', '30d', 'month', '6mo', '12mo', 'year', 'all'] as const;
export type Period = (typeof PERIODS)[number] | 'custom';

/** One window drives every read on the page, so no two blocks can describe different periods. */
export interface PeriodSelection { period: Period; from?: string; to?: string }
export const DEFAULT_PERIOD: PeriodSelection = { period: '30d' };

/** The `period=` fragment Core expects (a custom range only with both ends). */
export function periodQuery(selection: PeriodSelection): string {
  if (selection.period !== 'custom' || !selection.from || !selection.to) return `period=${selection.period === 'custom' ? '30d' : selection.period}`;
  return `period=custom&from=${selection.from}&to=${selection.to}`;
}

/**
 * The same window as a day count, for the first-party views (they read
 * Postgres and take `days`, 1-365). `all` is a year: the first event ever
 * recorded is 2026-08-03, so more only adds empty days.
 */
export function daysForSelection(selection: PeriodSelection, now = new Date()): number {
  if (selection.period === 'custom' && selection.from && selection.to) {
    const from = Date.parse(`${selection.from}T00:00:00Z`);
    const to = Date.parse(`${selection.to}T00:00:00Z`);
    return Number.isFinite(from) && Number.isFinite(to) && to >= from ? Math.min(365, Math.max(1, Math.round((to - from) / 86_400_000) + 1)) : 30;
  }
  switch (selection.period) {
    case 'day': return 1;
    case '7d': return 7;
    case 'month': return now.getUTCDate();
    case '6mo': return 182;
    case '12mo': case 'all': return 365;
    case 'year': return Math.max(1, Math.ceil((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86_400_000));
    default: return 30;
  }
}

/* ---- Segment filters (Plausible) ------------------------------------------ */

export const DIMENSIONS = ['page', 'source', 'referrer', 'channel', 'country', 'region', 'device', 'browser', 'os',
  'entry_page', 'exit_page', 'utm_source', 'utm_medium', 'utm_campaign'] as const;
export type DimensionKey = (typeof DIMENSIONS)[number];
/** Core's Plausible v2 filter property per dimension. */
const PROPERTY: Record<DimensionKey, string> = {
  page: 'event:page', source: 'visit:source', referrer: 'visit:referrer', channel: 'visit:channel', country: 'visit:country',
  region: 'visit:region', device: 'visit:device', browser: 'visit:browser', os: 'visit:os', entry_page: 'visit:entry_page',
  exit_page: 'visit:exit_page', utm_source: 'visit:utm_source', utm_medium: 'visit:utm_medium', utm_campaign: 'visit:utm_campaign',
};
/** The breakdowns shown first; the rest sit behind "More breakdowns". */
export const MAIN_BREAKDOWNS: readonly DimensionKey[] = ['page', 'source', 'channel', 'country', 'device', 'browser', 'os', 'entry_page', 'exit_page', 'utm_campaign'];
export const MORE_BREAKDOWNS: readonly DimensionKey[] = ['region', 'referrer', 'utm_source', 'utm_medium'];
/** Dimensions offered in the filter form (a breakdown row adds the rest). */
export const FILTER_DIMENSIONS: readonly DimensionKey[] = ['country', 'source', 'device', 'browser', 'page', 'channel'];

export interface SegmentFilter { dimension: DimensionKey; value: string }

/** `&filters=` for Core: values of one dimension merge into one "is" tuple (OR); dimensions AND together. */
export function filtersToQuery(filters: readonly SegmentFilter[]): string {
  if (!filters.length) return '';
  const by = new Map<DimensionKey, string[]>();
  for (const filter of filters) {
    const values = by.get(filter.dimension) ?? [];
    if (!values.includes(filter.value)) values.push(filter.value);
    by.set(filter.dimension, values);
  }
  return `&filters=${encodeURIComponent(JSON.stringify([...by].map(([dimension, values]) => ['is', PROPERTY[dimension], values])))}`;
}

export function withFilter(filters: readonly SegmentFilter[], next: SegmentFilter): SegmentFilter[] {
  return filters.some((filter) => filter.dimension === next.dimension && filter.value === next.value) ? [...filters] : [...filters, next];
}

/** A country name in the surface's language, or the code as reported (ISO 3166-1 alpha-2 from Plausible). */
export function countryLabel(code: string, locale: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return code;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/* ---- Web analytics (Plausible) -------------------------------------------- */

export interface Aggregate { visitors: number; pageviews: number; bounce_rate: number; visit_duration: number }
export interface ImportsMeta { importsIncluded: boolean }
export interface WebOverview {
  from: string; to: string;
  aggregate: Aggregate;
  timeseries: { date: string; visitors: number; pageviews: number }[];
  /** Null when there is nothing to compare against (all time) or the comparison failed. */
  previous: (Aggregate & { from: string; to: string }) | null;
  imports: ImportsMeta;
  /** Non-null: Plausible answered for a window the console did not ask for (it happened for two weeks in August 2026). */
  rangeDrift: { askedFor: [string, string]; answeredFor: [string, string] } | null;
}
const isAggregate = (value: unknown): value is Aggregate => isRecord(value) && isNumber(value.visitors) && isNumber(value.pageviews)
  && isNumber(value.bounce_rate) && isNumber(value.visit_duration);
const isImports = (value: unknown): value is ImportsMeta => isRecord(value) && typeof value.importsIncluded === 'boolean';
export const isWebOverview = (value: unknown): value is WebOverview => isRecord(value) && isString(value.from) && isString(value.to)
  && isAggregate(value.aggregate) && isImports(value.imports)
  && arrayOf(value.timeseries, (p): p is WebOverview['timeseries'][number] => isRecord(p) && isString(p.date) && isNumber(p.visitors) && isNumber(p.pageviews))
  && (value.previous === null || (isAggregate(value.previous) && isString((value.previous as unknown as Record<string, unknown>).from)))
  && (value.rangeDrift === null || value.rangeDrift === undefined || (isRecord(value.rangeDrift) && isPair(value.rangeDrift.askedFor) && isPair(value.rangeDrift.answeredFor)));

export interface BreakdownRow { label: string; visitors: number; pageviews: number; bounceRate: number; visitDuration: number }
export interface Breakdown { rows: BreakdownRow[]; imports: ImportsMeta }
export const isBreakdown = (value: unknown): value is Breakdown => isRecord(value) && isImports(value.imports)
  && arrayOf(value.rows, (r): r is BreakdownRow => isRecord(r) && isString(r.label) && isNumber(r.visitors) && isNumber(r.pageviews)
    && isNumber(r.bounceRate) && isNumber(r.visitDuration));

/** Period-over-period change as a share, or null when there is no comparison or the prior value was zero (never a fabricated 0%). */
export function change(current: number, prior: number | undefined): number | null {
  return prior === undefined || prior === 0 ? null : (current - prior) / prior;
}

/** A trailing mean over `window` points, null until a full window exists. */
export function movingAverage(values: readonly number[], window = 7): (number | null)[] {
  return values.map((_, index) => (index + 1 < window ? null : values.slice(index + 1 - window, index + 1).reduce((a, b) => a + b, 0) / window));
}

/* ---- Behaviour (Umami: marketing and signed-in adult surfaces only) ------ */

export interface Behavior { pageviews: number; visitors: number; visits: number; bounces: number; totaltime: number; outOfBoundaryPageviews: number | null }
export const isBehavior = (value: unknown): value is Behavior => isRecord(value) && isNumber(value.pageviews) && isNumber(value.visitors)
  && isNumber(value.visits) && isNumber(value.bounces) && isNumber(value.totaltime) && isNullableNumber(value.outOfBoundaryPageviews);
export const BEHAVIOR_DIMENSIONS = ['path', 'referrer', 'device', 'browser', 'os', 'country', 'region', 'city', 'language', 'screen', 'title', 'event'] as const;
export type BehaviorDimension = (typeof BEHAVIOR_DIMENSIONS)[number];
export const isBehaviorBreakdown = (value: unknown): value is { rows: { label: string; value: number }[] } => isRecord(value)
  && arrayOf(value.rows, (r): r is { label: string; value: number } => isRecord(r) && isString(r.label) && isNumber(r.value));
export const isBehaviorSeries = (value: unknown): value is { series: { date: string; pageviews: number; sessions: number }[] } => isRecord(value)
  && arrayOf(value.series, (p): p is { date: string; pageviews: number; sessions: number } => isRecord(p) && isString(p.date) && isNumber(p.pageviews) && isNumber(p.sessions));

/* ---- Health (Uptime Kuma through Pulse) ---------------------------------- */

export interface Monitor { id: number; name: string; status: number; pingMs: number | null; uptime24h: number | null }
export interface HealthDetail { summary: { total: number; down: number }; monitors: Monitor[] }
export const isHealthDetail = (value: unknown): value is HealthDetail => isRecord(value) && isRecord(value.summary)
  && isNumber(value.summary.total) && isNumber(value.summary.down)
  && arrayOf(value.monitors, (m): m is Monitor => isRecord(m) && isNumber(m.id) && isString(m.name) && isNumber(m.status)
    && isNullableNumber(m.pingMs ?? null) && isNullableNumber(m.uptime24h ?? null));

/* ---- Audience and product usage (our own stream) -------------------------- */

export interface AudiencePoint { date: string; anonymous: number; registered: number; staff: number }
export interface Audience { series: AudiencePoint[]; totals: { anonymous: number; registered: number; staff: number }; externalShare: number | null }
export const isAudience = (value: unknown): value is Audience => isRecord(value) && isRecord(value.totals)
  && isNumber(value.totals.anonymous) && isNumber(value.totals.registered) && isNumber(value.totals.staff) && isNullableNumber(value.externalShare)
  && arrayOf(value.series, (p): p is AudiencePoint => isRecord(p) && isString(p.date) && isNumber(p.anonymous) && isNumber(p.registered) && isNumber(p.staff));

export interface FunnelIntegrity { accountsCreated: number; signupComplete: number; unobserved: number; observedShare: number | null }
export const isFunnelIntegrityDetail = (value: unknown): value is FunnelIntegrity => isRecord(value) && isNumber(value.accountsCreated)
  && isNumber(value.signupComplete) && isNumber(value.unobserved) && isNullableNumber(value.observedShare);

export interface AcquisitionRow { label: string; visitors: number; converted: number }
export interface Acquisition {
  visitors: number; converted: number; conversionRate: number | null; noCampaignsTagged: boolean;
  byReferrer: AcquisitionRow[]; byLandingRoute: AcquisitionRow[]; byDevice: AcquisitionRow[]; byLocale: AcquisitionRow[];
}
const isAcquisitionRow = (r: unknown): r is AcquisitionRow => isRecord(r) && isString(r.label) && isNumber(r.visitors) && isNumber(r.converted);
export const isAcquisitionDetail = (value: unknown): value is Acquisition => isRecord(value) && isNumber(value.visitors) && isNumber(value.converted)
  && isNullableNumber(value.conversionRate) && typeof value.noCampaignsTagged === 'boolean'
  && arrayOf(value.byReferrer, isAcquisitionRow) && arrayOf(value.byLandingRoute, isAcquisitionRow)
  && arrayOf(value.byDevice, isAcquisitionRow) && arrayOf(value.byLocale, isAcquisitionRow);

export interface ActivityRow { event: string; role: string; route_class: string | null; events: number; sessions: number }
export const isActivity = (value: unknown): value is { entries: ActivityRow[] } => isRecord(value)
  && arrayOf(value.entries, (r): r is ActivityRow => isRecord(r) && isString(r.event) && isString(r.role) && isNullableString(r.route_class)
    && isNumber(r.events) && isNumber(r.sessions));
export interface AdoptionRow { role: string; route_class: string | null; users: number; sessions: number }
export const isAdoption = (value: unknown): value is { entries: AdoptionRow[] } => isRecord(value)
  && arrayOf(value.entries, (r): r is AdoptionRow => isRecord(r) && isString(r.role) && isNullableString(r.route_class) && isNumber(r.users) && isNumber(r.sessions));
export interface SessionRow { role: string; events: number; surfaces: number }
export const isSessionDepth = (value: unknown): value is { entries: SessionRow[] } => isRecord(value)
  && arrayOf(value.entries, (r): r is SessionRow => isRecord(r) && isString(r.role) && isNumber(r.events) && isNumber(r.surfaces));

/* ---- Internal-traffic exclusions (manage_support) ------------------------- */

export interface Exclusion { id: string; network: string; label: string; created_at: string }
export interface Sighting { address: string; userId: string; displayName: string; lastSeenAt: string; hits: number; distinctStaffUsers: number }
export interface Exclusions { self: { ip: string | null; excluded: boolean }; active: Exclusion[]; suggestions: Sighting[]; windowDays: number }
export const isExclusions = (value: unknown): value is Exclusions => isRecord(value) && isRecord(value.self)
  && isNullableString(value.self.ip) && typeof value.self.excluded === 'boolean' && isNumber(value.windowDays)
  && arrayOf(value.active, (r): r is Exclusion => isRecord(r) && isString(r.id) && isString(r.network) && isString(r.label) && isString(r.created_at))
  && arrayOf(value.suggestions, (s): s is Sighting => isRecord(s) && isString(s.address) && isString(s.userId) && isString(s.displayName)
    && isString(s.lastSeenAt) && isNumber(s.hits) && isNumber(s.distinctStaffUsers));
export const EXCLUSIONS_PATH = '/admin/analytics/exclusions?days=30&limit=50';
/** An address or a CIDR range (IPv4 or IPv6), checked before it reaches Core, which checks it again. */
export const NETWORK = /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|[0-9a-f:]+:[0-9a-f:.]*(?:\/\d{1,3})?)$/i;

/** The earliest active exclusion, and whether the window reaches back before it (then part of the window is unfiltered). */
export function coverage(active: readonly Exclusion[], windowStart: string | null): { state: 'none' | 'partial' | 'covered'; since: string | null } {
  if (!active.length) return { state: 'none', since: null };
  const since = active.reduce((min, row) => (row.created_at < min ? row.created_at : min), active[0]!.created_at);
  return { state: windowStart && windowStart < since.slice(0, 10) ? 'partial' : 'covered', since };
}

/* ---- Reports (Core renders the files) ------------------------------------ */

export const REPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
export const REPORT_AUDIENCES = ['full', 'marketing', 'sales', 'frontend'] as const;
export type ReportAudience = (typeof REPORT_AUDIENCES)[number];
export const REPORT_ROWS = ['10', '25', '50', '200'] as const;

export function reportPath(format: ReportFormat, selection: PeriodSelection, filters: readonly SegmentFilter[], audience: ReportAudience, rows: string, locale: string): string {
  return `/admin/analytics/report.${format}?${periodQuery(selection)}&audience=${audience}&rows=${rows}${filtersToQuery(filters)}&locale=${encodeURIComponent(locale)}`;
}

/* ---- Views ----------------------------------------------------------------- */

export const ANALYTICS_VIEWS = ['audience', 'web', 'behavior', 'health', 'trust', 'tools'] as const;
export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];
export function analyticsView(value: string | null): AnalyticsView {
  return (ANALYTICS_VIEWS as readonly string[]).includes(value ?? '') ? (value as AnalyticsView) : 'audience';
}
