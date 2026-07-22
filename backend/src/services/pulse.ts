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
  // Mirror of pulse-plausible's IP_BLOCKLIST (comma/whitespace separated).
  // Read-only reflection for the console — enforcement lives in Plausible's env.
  PLAUSIBLE_IP_BLOCKLIST: z.string().optional(),
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

export type PlausiblePeriod = 'day' | '7d' | '30d' | 'month' | '6mo' | '12mo';

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

export interface PlausibleOverview {
  aggregate: { visitors: number; pageviews: number; bounce_rate: number; visit_duration: number };
  timeseries: { date: string; visitors: number; pageviews: number }[];
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

/** Aggregate + per-day timeseries for the period (optionally filtered). Null on any upstream failure. */
export function getPlausibleOverview(period: PlausiblePeriod, filters?: PlausibleFilter[]): Promise<PlausibleOverview | null> {
  const cfg = getPulseConfig();
  const withFilters = (body: Record<string, unknown>): Record<string, unknown> =>
    filters?.length ? { ...body, filters } : body;
  return cached(`plausible:overview:${period}:${filterCacheKey(filters)}`, async () => {
    const metrics = ['visitors', 'pageviews', 'bounce_rate', 'visit_duration'];
    const [agg, series] = await Promise.all([
      plausibleQuery(cfg, withFilters({ metrics, date_range: period })),
      plausibleQuery(cfg, withFilters({ metrics: ['visitors', 'pageviews'], date_range: period, dimensions: ['time:day'] })),
    ]);
    if (!agg || !series) return null;
    const aggParsed = PlausibleResults.safeParse(agg);
    const seriesParsed = PlausibleResults.safeParse(series);
    if (!aggParsed.success || !seriesParsed.success) return null;
    const a = aggParsed.data.results[0]?.metrics ?? [0, 0, 0, 0];
    return {
      aggregate: { visitors: a[0] ?? 0, pageviews: a[1] ?? 0, bounce_rate: a[2] ?? 0, visit_duration: a[3] ?? 0 },
      timeseries: seriesParsed.data.results.map((r) => ({
        date: String(r.dimensions[0] ?? ''),
        visitors: r.metrics[0] ?? 0,
        pageviews: r.metrics[1] ?? 0,
      })),
    };
  });
}

/** Top-N rows for one dimension, ordered by visitors desc. Null on any upstream failure. */
export function getPlausibleBreakdown(
  period: PlausiblePeriod,
  dimensionKey: PlausibleDimensionKey,
  limit: number,
  filters?: PlausibleFilter[],
): Promise<PlausibleBreakdownRow[] | null> {
  const cfg = getPulseConfig();
  const key = `plausible:breakdown:${period}:${dimensionKey}:${limit}:${filterCacheKey(filters)}`;
  return cached(key, async () => {
    const dimension = PLAUSIBLE_DIMENSIONS[dimensionKey];
    const query = (metrics: string[]): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        metrics,
        date_range: period,
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
  period: PlausiblePeriod;
  audience: ReportAudience;
  generatedAt: string;
  aggregate: { visitors: number; pageviews: number; bounceRate: number; visitDuration: number };
  timeseries: { date: string; visitors: number; pageviews: number }[];
  breakdowns: Partial<Record<PlausibleDimensionKey, PlausibleBreakdownRow[]>>;
}

/**
 * Full report payload: aggregate + timeseries + the audience's breakdowns
 * (top 10 each). Null if ANY upstream read fails — a report with silently
 * missing sections would misinform, so it's all-or-nothing.
 */
export async function getPlausibleReportData(
  period: PlausiblePeriod,
  audience: ReportAudience,
  filters?: PlausibleFilter[],
): Promise<PlausibleReportData | null> {
  const dims = audienceDimensions(audience);
  const [overview, breakdownLists] = await Promise.all([
    getPlausibleOverview(period, filters),
    Promise.all(dims.map((dim) => getPlausibleBreakdown(period, dim, 10, filters))),
  ]);
  if (!overview) return null;
  const breakdowns: PlausibleReportData['breakdowns'] = {};
  for (const [i, dim] of dims.entries()) {
    const rows = breakdownLists[i];
    if (!rows) return null;
    breakdowns[dim] = rows;
  }
  return {
    period,
    audience,
    generatedAt: new Date().toISOString(),
    aggregate: {
      visitors: overview.aggregate.visitors,
      pageviews: overview.aggregate.pageviews,
      bounceRate: overview.aggregate.bounce_rate,
      visitDuration: overview.aggregate.visit_duration,
    },
    timeseries: overview.timeseries,
    breakdowns,
  };
}

/**
 * IPs excluded from analytics ingestion — a read-only mirror of the
 * IP_BLOCKLIST env enforced on pulse-plausible. Editing happens in Railway
 * variables (infra step), never through Core.
 */
export function getExcludedIps(): string[] {
  const raw = getPulseConfig().PLAUSIBLE_IP_BLOCKLIST ?? '';
  return raw
    .split(/[\s,]+/)
    .map((ip) => ip.trim())
    .filter(Boolean);
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

/** Umami website stats for the trailing window. Retries once on 401 (token expiry). */
export function getUmamiStats(period: PlausiblePeriod): Promise<UmamiStats | null> {
  const cfg = getPulseConfig();
  return cached(`umami:stats:${period}`, async () => {
    const days = period === 'day' ? 1 : period === '7d' ? 7 : period === '30d' || period === 'month' ? 30 : period === '6mo' ? 182 : 365;
    const endAt = Date.now();
    const startAt = endAt - days * 24 * 60 * 60 * 1000;

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
