import { z } from 'zod';

/*
 * Pulse (observability stack) clients — Plausible Stats API v2, Umami API,
 * Uptime Kuma status page. Core is the ONLY thing that talks to these
 * (pulse/AGENTS.md #5): tokens live here server-side, the browser sees only
 * the /api/v1/admin envelope. Every reader is cached in-memory (60s TTL) so
 * admin-panel refreshes stay far under Plausible's 600 req/h default limit.
 *
 * Unlike config.ts (validated at boot), Pulse env is parsed lazily and is
 * OPTIONAL by design: Core must boot and serve the product even when the
 * observability stack is absent (local dev, incidents) — routes answer 503
 * PULSE_UNCONFIGURED instead. An outage here loses telemetry, never product
 * (RUNBOOK.md § Pulse).
 */

const PulseEnv = z.object({
  PLAUSIBLE_URL: z.url().optional(),
  PLAUSIBLE_API_KEY: z.string().min(10).optional(),
  PLAUSIBLE_SITE_ID: z.string().min(1).optional(),
  UMAMI_URL: z.url().optional(),
  UMAMI_USERNAME: z.string().min(1).optional(),
  UMAMI_PASSWORD: z.string().min(1).optional(),
  UMAMI_WEBSITE_ID: z.string().min(1).optional(),
  KUMA_URL: z.url().optional(),
  KUMA_STATUS_SLUG: z.string().min(1).default('pulse'),
});

export type PulseConfig = Readonly<z.infer<typeof PulseEnv>>;

let cachedConfig: PulseConfig | null = null;

export function getPulseConfig(): PulseConfig {
  if (!cachedConfig) cachedConfig = Object.freeze(PulseEnv.parse(process.env));
  return cachedConfig;
}

/** Test-only: drop caches so each test can vary env / fetch stubs. */
export function resetPulseForTests(): void {
  cachedConfig = null;
  responseCache.clear();
  umamiToken = null;
}

// ── tiny TTL cache ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
const responseCache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = responseCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  responseCache.set(key, { at: Date.now(), value });
  return value;
}

// ── Plausible (Stats API v2) ───────────────────────────────────────────────

/*
 * Presets are Plausible Stats API v2 `date_range` shorthands, passed through
 * verbatim so the console agrees with Plausible's own dashboard for the same
 * selection. `custom` is the explicit two-date form the API also accepts.
 */
export const PLAUSIBLE_PERIODS = ['day', '7d', '30d', 'month', '6mo', '12mo', 'year', 'all'] as const;
export type PlausiblePeriod = (typeof PLAUSIBLE_PERIODS)[number];

/** A resolved selection: a preset, or an explicit inclusive [from, to] day range. */
export type AnalyticsRange = { kind: 'preset'; period: PlausiblePeriod } | { kind: 'custom'; from: string; to: string };

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Sentinel start for "all time" when a downstream API needs a concrete
 * timestamp (Umami takes startAt/endAt, it has no all-time shorthand). It
 * predates the platform, so it means "everything that exists".
 */
const ALL_TIME_START_MS = Date.UTC(2020, 0, 1);

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function startOfUtcMonth(ms: number, monthsBack = 0): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1);
}

export interface ResolvedRange {
  /** Value handed to Plausible's `date_range`. */
  dateRange: string | [string, string];
  /** Inclusive day bounds, UTC — what Umami and the comparison window use. */
  startMs: number;
  endMs: number;
  /** The equally long window immediately before this one, or null when there isn't one. */
  previous: [string, string] | null;
  /** Stable cache-key fragment. */
  key: string;
}

/**
 * Resolve a selection to everything the readers need.
 *
 * Two things this fixes. First, the behavioural card used to translate `month`
 * to "the last 30 days" while Plausible read it as "since the 1st", so the two
 * halves of the same screen silently described different windows. One resolver
 * now feeds both. Second, it produces the previous-period window, which is
 * what turns a number into a direction.
 *
 * Bounds are computed in UTC. Plausible evaluates its own shorthands in the
 * SITE's timezone, so on a non-UTC site the comparison window can differ from
 * the headline window by up to a day at the edges; the headline itself stays
 * exactly what Plausible's dashboard shows, which is the number an operator
 * will cross-check.
 */
export function resolveRange(range: AnalyticsRange, now: number = Date.now()): ResolvedRange {
  const today = startOfUtcDay(now);
  const endMs = today + DAY_MS - 1;

  if (range.kind === 'custom') {
    const startMs = Date.parse(`${range.from}T00:00:00Z`);
    const customEnd = Date.parse(`${range.to}T00:00:00Z`) + DAY_MS - 1;
    const lengthMs = customEnd + 1 - startMs;
    return {
      dateRange: [range.from, range.to],
      startMs,
      endMs: customEnd,
      previous: [dayKey(startMs - lengthMs), dayKey(startMs - DAY_MS)],
      key: `custom:${range.from}:${range.to}`,
    };
  }

  const startMs = (() => {
    switch (range.period) {
      case 'day':
        return today;
      case '7d':
        return today - 6 * DAY_MS;
      case '30d':
        return today - 29 * DAY_MS;
      case 'month':
        return startOfUtcMonth(now);
      case '6mo':
        return startOfUtcMonth(now, 5);
      case '12mo':
        return startOfUtcMonth(now, 11);
      case 'year':
        return Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
      case 'all':
        return ALL_TIME_START_MS;
    }
  })();

  // "All time" has no comparable window before it — say so instead of inventing one.
  const previous: [string, string] | null =
    range.period === 'all' ? null : [dayKey(startMs - (endMs + 1 - startMs)), dayKey(startMs - DAY_MS)];

  return { dateRange: range.period, startMs, endMs, previous, key: range.period };
}

/** Parse the wire form (`period` + optional `from`/`to`) into a range, or null if invalid. */
export function parseRange(period: string, from?: string, to?: string): AnalyticsRange | null {
  if (period === 'custom') {
    if (!from || !to) return null;
    const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    if (!isDay(from) || !isDay(to)) return null;
    if (Date.parse(from) > Date.parse(to)) return null;
    // A range that ends in the future would report a partial window as if it
    // were complete; a 5-year window is a query nobody meant to run.
    if (Date.parse(`${to}T00:00:00Z`) > Date.now() + DAY_MS) return null;
    if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * 3 * DAY_MS) return null;
    return { kind: 'custom', from, to };
  }
  if ((PLAUSIBLE_PERIODS as readonly string[]).includes(period)) {
    return { kind: 'preset', period: period as PlausiblePeriod };
  }
  return null;
}

/** Plausible v2 filter clause: [operator, dimension, clauses] — passed through verbatim. */
export type PlausibleFilter = [string, string, (string | number)[]];

/** Console dimension key → Plausible Stats API v2 dimension string. */
export const PLAUSIBLE_DIMENSIONS = {
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
} as const;

export type PlausibleDimensionKey = keyof typeof PLAUSIBLE_DIMENSIONS;

export const PLAUSIBLE_DIMENSION_KEYS = Object.keys(PLAUSIBLE_DIMENSIONS) as [
  PlausibleDimensionKey,
  ...PlausibleDimensionKey[],
];

export interface PlausibleAggregate {
  visitors: number;
  pageviews: number;
  bounce_rate: number;
  visit_duration: number;
}

export interface PlausibleOverview {
  aggregate: PlausibleAggregate;
  timeseries: { date: string; visitors: number; pageviews: number }[];
  /**
   * The same metrics for the equally long window immediately before this one.
   * `null` for all-time (nothing to compare against) or when that read failed
   * — a comparison we could not make is reported as absent, never as zero,
   * which would render as a dramatic and entirely fictional decline.
   */
  previous: (PlausibleAggregate & { from: string; to: string }) | null;
}

export interface PlausibleBreakdownRow {
  label: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  visitDuration: number;
}

export function plausibleConfigured(cfg: PulseConfig): boolean {
  return Boolean(cfg.PLAUSIBLE_URL && cfg.PLAUSIBLE_API_KEY && cfg.PLAUSIBLE_SITE_ID);
}

/** Filters participate in every cache key — same query + different filters = different entry. */
function filterCacheKey(filters?: PlausibleFilter[]): string {
  return filters?.length ? JSON.stringify(filters) : '-';
}

async function plausibleQuery(cfg: PulseConfig, body: Record<string, unknown>): Promise<unknown | null> {
  const res = await fetch(`${cfg.PLAUSIBLE_URL}/api/v2/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.PLAUSIBLE_API_KEY}`, 'Content-Type': 'application/json' },
    // include.imports merges GA4-imported history into every result. The Stats
    // API v2 EXCLUDES imported data by default (unlike Plausible's own dashboard),
    // so without this the admin console shows ~zero for any range predating our
    // native tracking even though the GA4 import populated Plausible (verified
    // 2026-07-22). A body may override `include` if it ever needs to.
    body: JSON.stringify({ site_id: cfg.PLAUSIBLE_SITE_ID, include: { imports: true }, ...body }),
  });
  if (!res.ok) return null;
  return res.json();
}

const PlausibleResults = z.object({
  results: z.array(z.object({ dimensions: z.array(z.union([z.string(), z.number()])), metrics: z.array(z.number()) })),
});

function toAggregate(metrics: number[] | undefined): PlausibleAggregate {
  const m = metrics ?? [0, 0, 0, 0];
  return { visitors: m[0] ?? 0, pageviews: m[1] ?? 0, bounce_rate: m[2] ?? 0, visit_duration: m[3] ?? 0 };
}

/** Aggregate + per-day timeseries + previous-period comparison. Null on any upstream failure. */
export function getPlausibleOverview(range: AnalyticsRange, filters?: PlausibleFilter[]): Promise<PlausibleOverview | null> {
  const cfg = getPulseConfig();
  const resolved = resolveRange(range);
  const withFilters = (body: Record<string, unknown>): Record<string, unknown> =>
    filters?.length ? { ...body, filters } : body;
  return cached(`plausible:overview:${resolved.key}:${filterCacheKey(filters)}`, async () => {
    const metrics = ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'];
    const [agg, series, prior] = await Promise.all([
      plausibleQuery(cfg, withFilters({ metrics, date_range: resolved.dateRange })),
      plausibleQuery(
        cfg,
        withFilters({ metrics: ['visitors', 'pageviews'], date_range: resolved.dateRange, dimensions: ['time:day'] }),
      ),
      resolved.previous
        ? plausibleQuery(cfg, withFilters({ metrics, date_range: resolved.previous }))
        : Promise.resolve(null),
    ]);
    if (!agg || !series) return null;
    const aggParsed = PlausibleResults.safeParse(agg);
    const seriesParsed = PlausibleResults.safeParse(series);
    if (!aggParsed.success || !seriesParsed.success) return null;

    // A failed comparison degrades to "no comparison shown" and never blocks
    // the headline numbers, which are the reason the page exists.
    const priorParsed = prior ? PlausibleResults.safeParse(prior) : null;
    const previous =
      resolved.previous && priorParsed?.success
        ? {
            ...toAggregate(priorParsed.data.results[0]?.metrics),
            from: resolved.previous[0],
            to: resolved.previous[1],
          }
        : null;

    return {
      aggregate: toAggregate(aggParsed.data.results[0]?.metrics),
      timeseries: seriesParsed.data.results.map((r) => ({
        date: String(r.dimensions[0] ?? ''),
        visitors: r.metrics[0] ?? 0,
        pageviews: r.metrics[1] ?? 0,
      })),
      previous,
    };
  });
}

/** Top-N rows for one dimension, ordered by visitors desc. Null on any upstream failure. */
export function getPlausibleBreakdown(
  range: AnalyticsRange,
  dimensionKey: PlausibleDimensionKey,
  limit: number,
  filters?: PlausibleFilter[],
): Promise<PlausibleBreakdownRow[] | null> {
  const cfg = getPulseConfig();
  const resolved = resolveRange(range);
  const key = `plausible:breakdown:${resolved.key}:${dimensionKey}:${limit}:${filterCacheKey(filters)}`;
  return cached(key, async () => {
    const dimension = PLAUSIBLE_DIMENSIONS[dimensionKey];
    const query = (metrics: string[]): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        metrics,
        date_range: resolved.dateRange,
        dimensions: [dimension],
        order_by: [[metrics[0], 'desc']], // metrics[0] is always 'visitors' — always sortable
        pagination: { limit },
      };
      if (filters?.length) body.filters = filters;
      return body;
    };
    // Plausible Stats API v2 rejects some metric/dimension combos with a 400 — most
    // notably the pageviews (event) metric against the session-level page dimensions
    // visit:entry_page / visit:exit_page (which describe which page a *visit* started
    // or ended on, not an event). Try the full metric set, then progressively drop the
    // event/session metrics so an incompatible dimension still renders visitor counts
    // instead of 502ing (found in prod 2026-07-22: entry/exit page cards were empty).
    const metricSets = [
      ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'],
      ['visitors', 'bounce_rate', 'visit_duration'],
      ['visitors'],
    ];
    for (const metrics of metricSets) {
      const raw = await plausibleQuery(cfg, query(metrics));
      if (!raw) continue;
      const parsed = PlausibleResults.safeParse(raw);
      if (!parsed.success) continue;
      const at = (name: string): number => metrics.indexOf(name);
      return parsed.data.results.map((r) => ({
        label: String(r.dimensions[0] ?? ''),
        visitors: r.metrics[at('visitors')] ?? 0,
        pageviews: at('pageviews') >= 0 ? (r.metrics[at('pageviews')] ?? 0) : 0,
        bounceRate: at('bounce_rate') >= 0 ? (r.metrics[at('bounce_rate')] ?? 0) : 0,
        visitDuration: at('visit_duration') >= 0 ? (r.metrics[at('visit_duration')] ?? 0) : 0,
      }));
    }
    return null;
  });
}

// ── Analytics report (aggregate + breakdown bundle per audience) ───────────

export type ReportAudience = 'marketing' | 'sales' | 'frontend' | 'full';

export const REPORT_AUDIENCES = ['marketing', 'sales', 'frontend', 'full'] as const;

const AUDIENCE_DIMENSIONS: Record<Exclude<ReportAudience, 'full'>, readonly PlausibleDimensionKey[]> = {
  marketing: ['source', 'channel', 'utm_campaign', 'utm_source', 'country', 'referrer'],
  sales: ['source', 'channel', 'entry_page', 'country', 'device'],
  frontend: ['page', 'entry_page', 'exit_page', 'device', 'browser', 'os'],
};

/** Dimension set for an audience; `full` = deduped union in stable marketing→sales→frontend order. */
export function audienceDimensions(audience: ReportAudience): PlausibleDimensionKey[] {
  if (audience !== 'full') return [...AUDIENCE_DIMENSIONS[audience]];
  return [...new Set([...AUDIENCE_DIMENSIONS.marketing, ...AUDIENCE_DIMENSIONS.sales, ...AUDIENCE_DIMENSIONS.frontend])];
}

export interface PlausibleReportData {
  /** Preset name, or 'custom' — the export prints the resolved dates either way. */
  period: PlausiblePeriod | 'custom';
  /** Inclusive day bounds the figures actually cover. */
  from: string;
  to: string;
  audience: ReportAudience;
  generatedAt: string;
  /** Filters in force when the report was produced, in human-readable form. */
  appliedFilters: string[];
  aggregate: { visitors: number; pageviews: number; bounceRate: number; visitDuration: number };
  previous: { visitors: number; pageviews: number; bounceRate: number; visitDuration: number; from: string; to: string } | null;
  timeseries: { date: string; visitors: number; pageviews: number }[];
  breakdowns: Partial<Record<PlausibleDimensionKey, PlausibleBreakdownRow[]>>;
}

/*
 * Human labels for the export surfaces. They live beside the dimension
 * vocabulary they name so the PDF, the CSV and the spreadsheet cannot drift
 * into calling the same column three different things.
 */
export const DIMENSION_TITLES: Record<PlausibleDimensionKey, string> = {
  page: 'Top pages',
  source: 'Top sources',
  referrer: 'Top referrers',
  channel: 'Channels',
  country: 'Countries',
  region: 'Regions',
  device: 'Devices',
  browser: 'Browsers',
  os: 'Operating systems',
  entry_page: 'Entry pages',
  exit_page: 'Exit pages',
  utm_source: 'UTM sources',
  utm_medium: 'UTM mediums',
  utm_campaign: 'UTM campaigns',
};

export const PERIOD_LABELS: Record<PlausiblePeriod | 'custom', string> = {
  day: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  '6mo': 'Last 6 months',
  '12mo': 'Last 12 months',
  year: 'This year',
  all: 'All time',
  custom: 'Custom range',
};

/** Render a Plausible filter tuple as something a human can read in an export footer. */
export function describeFilters(filters?: PlausibleFilter[]): string[] {
  if (!filters?.length) return [];
  return filters.map(([operator, dimension, clauses]) => `${dimension.replace(/^(visit|event):/, '')} ${operator} ${clauses.join(', ')}`);
}

/**
 * Full report payload: aggregate + timeseries + the audience's breakdowns
 * (top 10 each). Null if ANY upstream read fails — a report with silently
 * missing sections would misinform, so it's all-or-nothing.
 */
export async function getPlausibleReportData(
  range: AnalyticsRange,
  audience: ReportAudience,
  filters?: PlausibleFilter[],
  rowsPerBreakdown = 10,
): Promise<PlausibleReportData | null> {
  const dims = audienceDimensions(audience);
  const resolved = resolveRange(range);
  const [overview, breakdownLists] = await Promise.all([
    getPlausibleOverview(range, filters),
    Promise.all(dims.map((dim) => getPlausibleBreakdown(range, dim, rowsPerBreakdown, filters))),
  ]);
  if (!overview) return null;
  const breakdowns: PlausibleReportData['breakdowns'] = {};
  for (const [i, dim] of dims.entries()) {
    const rows = breakdownLists[i];
    if (!rows) return null;
    breakdowns[dim] = rows;
  }
  return {
    period: range.kind === 'custom' ? 'custom' : range.period,
    from: new Date(resolved.startMs).toISOString().slice(0, 10),
    to: new Date(resolved.endMs).toISOString().slice(0, 10),
    audience,
    generatedAt: new Date().toISOString(),
    appliedFilters: describeFilters(filters),
    aggregate: {
      visitors: overview.aggregate.visitors,
      pageviews: overview.aggregate.pageviews,
      bounceRate: overview.aggregate.bounce_rate,
      visitDuration: overview.aggregate.visit_duration,
    },
    previous: overview.previous
      ? {
          visitors: overview.previous.visitors,
          pageviews: overview.previous.pageviews,
          bounceRate: overview.previous.bounce_rate,
          visitDuration: overview.previous.visit_duration,
          from: overview.previous.from,
          to: overview.previous.to,
        }
      : null,
    timeseries: overview.timeseries,
    breakdowns,
  };
}

// ── Umami (behavioral analytics) ───────────────────────────────────────────

export interface UmamiStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export function umamiConfigured(cfg: PulseConfig): boolean {
  return Boolean(cfg.UMAMI_URL && cfg.UMAMI_USERNAME && cfg.UMAMI_PASSWORD && cfg.UMAMI_WEBSITE_ID);
}

let umamiToken: string | null = null;

async function umamiLogin(cfg: PulseConfig): Promise<string | null> {
  const res = await fetch(`${cfg.UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.UMAMI_USERNAME, password: cfg.UMAMI_PASSWORD }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { token?: string };
  return body.token ?? null;
}

const UmamiMetric = z.union([z.number(), z.object({ value: z.number() })]);
const UmamiStatsSchema = z.object({
  pageviews: UmamiMetric,
  visitors: UmamiMetric,
  visits: UmamiMetric.optional(),
  bounces: UmamiMetric,
  totaltime: UmamiMetric,
});

function metricValue(m: number | { value: number } | undefined): number {
  if (m === undefined) return 0;
  return typeof m === 'number' ? m : m.value;
}

/**
 * Umami website stats for the SAME window Plausible is being asked about.
 *
 * This used to translate the period itself — `month` became "the last 30
 * days" while Plausible read it as "since the 1st", and `6mo` became a flat
 * 182 days. Two cards on one screen, labelled with one period, describing
 * different windows. Both now come from resolveRange().
 *
 * Retries once on 401 (token expiry).
 */
export function getUmamiStats(range: AnalyticsRange): Promise<UmamiStats | null> {
  const cfg = getPulseConfig();
  const resolved = resolveRange(range);
  return cached(`umami:stats:${resolved.key}`, async () => {
    const startAt = resolved.startMs;
    const endAt = resolved.endMs;

    const call = async (): Promise<Response | null> => {
      if (!umamiToken) umamiToken = await umamiLogin(cfg);
      if (!umamiToken) return null;
      return fetch(`${cfg.UMAMI_URL}/api/websites/${cfg.UMAMI_WEBSITE_ID}/stats?startAt=${startAt}&endAt=${endAt}`, {
        headers: { Authorization: `Bearer ${umamiToken}` },
      });
    };

    let res = await call();
    if (res && res.status === 401) {
      umamiToken = null; // expired — re-login once
      res = await call();
    }
    if (!res || !res.ok) return null;
    const parsed = UmamiStatsSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    return {
      pageviews: metricValue(parsed.data.pageviews),
      visitors: metricValue(parsed.data.visitors),
      visits: metricValue(parsed.data.visits),
      bounces: metricValue(parsed.data.bounces),
      totaltime: metricValue(parsed.data.totaltime),
    };
  });
}

// ── Uptime Kuma (system health) ────────────────────────────────────────────

export interface KumaMonitor {
  id: number;
  name: string;
  /** 1 = up, 0 = down (Kuma heartbeat convention; 2/3 = pending/maintenance → reported as-is). */
  status: number;
  pingMs: number | null;
  uptime24h: number | null;
}

export function kumaConfigured(cfg: PulseConfig): boolean {
  return Boolean(cfg.KUMA_URL);
}

const KumaStatusPage = z.object({
  publicGroupList: z.array(
    z.object({
      name: z.string(),
      monitorList: z.array(z.object({ id: z.number(), name: z.string() })),
    }),
  ),
});

const KumaHeartbeats = z.object({
  heartbeatList: z.record(z.string(), z.array(z.object({ status: z.number(), ping: z.number().nullable() }))),
  uptimeList: z.record(z.string(), z.number()),
});

/** Per-monitor status from Kuma's public status-page JSON (no Kuma auth needed). */
export function getKumaHealth(): Promise<KumaMonitor[] | null> {
  const cfg = getPulseConfig();
  return cached('kuma:health', async () => {
    const [pageRes, beatRes] = await Promise.all([
      fetch(`${cfg.KUMA_URL}/api/status-page/${cfg.KUMA_STATUS_SLUG}`),
      fetch(`${cfg.KUMA_URL}/api/status-page/heartbeat/${cfg.KUMA_STATUS_SLUG}`),
    ]);
    if (!pageRes.ok || !beatRes.ok) return null;
    const page = KumaStatusPage.safeParse(await pageRes.json());
    const beats = KumaHeartbeats.safeParse(await beatRes.json());
    if (!page.success || !beats.success) return null;

    const monitors: KumaMonitor[] = [];
    for (const group of page.data.publicGroupList) {
      for (const mon of group.monitorList) {
        const list = beats.data.heartbeatList[String(mon.id)] ?? [];
        const last = list[list.length - 1];
        monitors.push({
          id: mon.id,
          name: mon.name,
          status: last?.status ?? 0,
          pingMs: last?.ping ?? null,
          uptime24h: beats.data.uptimeList[`${mon.id}_24`] ?? null,
        });
      }
    }
    return monitors;
  });
}
