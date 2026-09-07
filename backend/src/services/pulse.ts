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

/**
 * A timezone Node can actually resolve.
 *
 * An unknown IANA name makes `Intl.DateTimeFormat` THROW rather than fall
 * back, and it would throw inside range resolution — i.e. on every analytics
 * read, long after boot, as a 502 with no hint of the cause. Validating the
 * value where the rest of the Pulse env is validated turns that into a
 * startup-shaped error naming the variable.
 */
function isResolvableTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const PulseEnv = z.object({
  PLAUSIBLE_URL: z.url().optional(),
  PLAUSIBLE_API_KEY: z.string().min(10).optional(),
  PLAUSIBLE_SITE_ID: z.string().min(1).optional(),
  /*
   * The timezone the Plausible SITE is configured in — not the server's.
   *
   * Plausible evaluates every date it is given in the site's timezone, so
   * "today" there and "today" in UTC are different days for six hours out of
   * every twenty-four. Resolving our windows in UTC put the tail of every
   * range one day ahead of the data, which `fillDailySeries` then rendered as
   * a zero-traffic today, permanently (RUNBOOK 2026-08-27).
   *
   * Default verified against production on 2026-08-27: Plausible echoed
   * `-06:00` for every resolved range. Override it here if the site's own
   * setting is ever changed — the drift guard in `getPlausibleOverview` is
   * what will tell you it happened.
   */
  PLAUSIBLE_SITE_TIMEZONE: z
    .string()
    .min(1)
    .default('America/Mexico_City')
    .refine(isResolvableTimeZone, { message: 'PLAUSIBLE_SITE_TIMEZONE must be a valid IANA timezone name' }),
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

/**
 * Drop every memoized upstream response.
 *
 * The cache is module-level and keyed by resolved range, so two tests asking
 * for the same window share an answer — including one that stubs a FAILING
 * upstream and silently receives the previous test's success. Tests call this
 * per case so each one exercises the code path it claims to.
 */
export function resetPulseCacheForTests(): void {
  responseCache.clear();
  clearUmamiToken();
}

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
 * Sentinel start for "all time" when a downstream API needs a concrete date
 * (Umami takes startAt/endAt, it has no all-time shorthand). It predates the
 * platform, so it means "everything that exists".
 */
const ALL_TIME_START = '2020-01-01';

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/* Calendar arithmetic on `YYYY-MM-DD` strings, anchored at UTC midnight.
 * Only whole days and whole months are ever added, so no DST transition can
 * shift a boundary: the strings are labels for calendar days, not instants. */
function dayMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function addDays(day: string, delta: number): string {
  return dayKey(dayMs(day) + delta * DAY_MS);
}

function firstOfMonth(day: string, monthsBack = 0): string {
  const d = new Date(dayMs(day));
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1));
}

/** Inclusive day count, so a single-day range is 1 and not 0. */
function daysBetween(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;
}

/**
 * Today's calendar date in a given timezone.
 *
 * `en-CA` is used purely because it formats as `YYYY-MM-DD`; no locale is
 * being asserted about the user.
 */
export function todayInZone(timeZone: string, now: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

export interface ResolvedRange {
  /**
   * ALWAYS an explicit inclusive [from, to] pair, never a preset shorthand.
   * See resolveRange for why this is load-bearing.
   */
  dateRange: [string, string];
  /** The same bounds as calendar days — what the UI and every export print. */
  from: string;
  to: string;
  /** Inclusive instant bounds, UTC — what Umami's startAt/endAt use. */
  startMs: number;
  endMs: number;
  /** The equally long window immediately before this one, or null when there isn't one. */
  previous: [string, string] | null;
  /** True for the `all` preset, whose leading emptiness must not be drawn. */
  allTime: boolean;
  /** Stable cache-key fragment — includes the RESOLVED dates, not just the label. */
  key: string;
}

/**
 * Resolve a selection to everything the readers need.
 *
 * WHY THIS NEVER HANDS PLAUSIBLE A PRESET STRING, which it used to do:
 *
 * Passing `"6mo"` through verbatim looked like the safest possible choice —
 * the console would agree with Plausible's own dashboard for the same
 * selection, which is the number an operator cross-checks. It was the bug.
 * Plausible resolves `6mo` as the last six COMPLETE calendar months, ending
 * on the last day of last month, in the SITE's timezone. This resolver
 * computed its own bounds, in UTC, running to today. Nothing reconciled them,
 * so for six months of every year the two disagreed about a whole month —
 * and `fillDailySeries` dutifully padded the difference with zeros, reporting
 * "nobody came in August" for a window Plausible had never been asked about.
 * Measured in production 2026-08-27: every preset except `day` disagreed.
 *
 * So one system resolves the window and BOTH use it. Plausible echoes an
 * explicit range back unchanged (verified), which also gives the drift guard
 * in `getPlausibleOverview` something exact to assert against. Two follow-on
 * defects close with it: the previous-period window is derived from the same
 * dates and can no longer overlap the current one (`6mo` used to compare
 * February against itself), and the dates the exports print as provenance are
 * now the dates the figures actually came from.
 *
 * The trade is deliberate and worth stating: for `6mo`, `12mo` and `year` the
 * console no longer matches Plausible's own dashboard, because we include the
 * current month and Plausible does not. Ours is the reading an operator
 * means by "last 6 months", and it is labelled with its real dates either way.
 */
export function resolveRange(
  range: AnalyticsRange,
  now: number = Date.now(),
  timeZone: string = getPulseConfig().PLAUSIBLE_SITE_TIMEZONE,
): ResolvedRange {
  const today = todayInZone(timeZone, now);

  const [from, to, allTime] = ((): [string, string, boolean] => {
    if (range.kind === 'custom') return [range.from, range.to, false];
    switch (range.period) {
      case 'day':
        return [today, today, false];
      case '7d':
        return [addDays(today, -6), today, false];
      case '30d':
        return [addDays(today, -29), today, false];
      case 'month':
        return [firstOfMonth(today), today, false];
      case '6mo':
        return [firstOfMonth(today, 5), today, false];
      case '12mo':
        return [firstOfMonth(today, 11), today, false];
      case 'year':
        return [`${today.slice(0, 4)}-01-01`, today, false];
      case 'all':
        return [ALL_TIME_START, today, true];
    }
  })();

  const length = daysBetween(from, to);

  return {
    dateRange: [from, to],
    from,
    to,
    startMs: dayMs(from),
    endMs: dayMs(to) + DAY_MS - 1,
    // "All time" has no comparable window before it — say so instead of inventing one.
    previous: allTime ? null : [addDays(from, -length), addDays(from, -1)],
    allTime,
    key: range.kind === 'custom' ? `custom:${from}:${to}` : `${range.period}:${from}:${to}`,
  };
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
/**
 * Stats API v2 also accepts logical operators, whose second element is a list
 * of nested filters rather than a dimension string. Modelled explicitly so the
 * acquisition scope below needs no cast — a cast here would be a claim about
 * the wire format that the compiler could not check.
 */
export type PlausibleLogicalFilter = ['and' | 'or' | 'not', PlausibleQueryFilter[]];
export type PlausibleQueryFilter = PlausibleFilter | PlausibleLogicalFilter;

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

/** A window mismatch between what we asked for and what the upstream answered. */
export interface RangeDrift {
  askedFor: [string, string];
  answeredFor: [string, string];
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
  /** Whether GA4-imported history is inside these figures — see PlausibleMeta. */
  imports: PlausibleMeta;
  /** Non-null only when Plausible answered for a window we did not ask for. */
  rangeDrift: RangeDrift | null;
}

export interface PlausibleBreakdownRow {
  label: string;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  visitDuration: number;
}

/**
 * Rows plus the provenance that makes them readable.
 *
 * The rows alone were the bug: a breakdown summing to 48 under a headline of
 * 1,120 is not wrong, it is INCOMPLETE, and only `imports` can say which.
 */
export interface PlausibleBreakdown {
  rows: PlausibleBreakdownRow[];
  imports: PlausibleMeta;
}

export function plausibleConfigured(cfg: PulseConfig): boolean {
  return Boolean(cfg.PLAUSIBLE_URL && cfg.PLAUSIBLE_API_KEY && cfg.PLAUSIBLE_SITE_ID);
}

/** Filters participate in every cache key — same query + different filters = different entry. */
function filterCacheKey(filters?: PlausibleFilter[]): string {
  // 'scoped' namespaces the key so entries cached before the acquisition scope
  // existed can never be served as if they had it applied.
  return `scoped:${filters?.length ? JSON.stringify(filters) : '-'}`;
}

/*
 * Acquisition scope — applied to EVERY Plausible query, retroactively.
 *
 * Until 2026-08-14 the tracker self-captured SPA navigations (see RUNBOOK:
 * "Plausible records /admin/* and product routes"), so twelve months of stored
 * events include the staff console, the product, and signup. That history
 * cannot be edited — Plausible has no delete-by-filter — but it can be scoped
 * at READ time, which fixes every report at once rather than leaving the
 * console to display known-contaminated numbers until the bad data ages out.
 *
 * It is an ALLOWLIST mirroring `isMarketingPath` in frontend/src/lib/
 * analytics.tsx, not a /admin blocklist: the two definitions of "public
 * acquisition surface" must not be able to drift apart, and a blocklist would
 * silently readmit any future non-marketing route nobody remembered to add.
 * Adding a marketing route means updating BOTH (the frontend gate decides what
 * is recorded; this decides what is reported).
 *
 * Session metrics stay honest under it: Plausible keeps a session whose events
 * include at least one matching page, so a visitor who landed on marketing and
 * then signed up still counts as a visitor — they genuinely visited. Only the
 * events that were never in scope drop out. Measured against production the
 * day it shipped: 539 stored pageviews → 110 in scope, 57 visitors → 48.
 */
const MARKETING_ROOTS = ['how-it-works', 'families', 'faq', 'legal', 'badge'] as const;

const SCOPE_PAGES = ['/', ...MARKETING_ROOTS.map((r) => `/${r}`)];
const SCOPE_PATTERN = `^/(${MARKETING_ROOTS.join('|')})/.*$`;

/** The allowlist expressed against ONE page-valued dimension. */
function pageScopeOn(dimension: string): PlausibleLogicalFilter {
  return [
    'or',
    [
      ['is', dimension, SCOPE_PAGES],
      ['matches', dimension, [SCOPE_PATTERN]],
    ],
  ];
}

export const ACQUISITION_SCOPE: PlausibleLogicalFilter = pageScopeOn('event:page');

/*
 * Session-level page dimensions need the scope applied to THEMSELVES.
 *
 * `ACQUISITION_SCOPE` filters `event:page` — the page a pageview happened on.
 * `visit:entry_page` and `visit:exit_page` describe where a SESSION started
 * and ended, and a session qualifies for an event-level filter as soon as any
 * one of its events matches. So a visitor who landed on `/`, signed in and
 * worked in the console satisfied the scope and then reported an entry or
 * exit page of `/admin/analytics` — out-of-boundary paths surfacing in a
 * report that states it covers public marketing traffic only.
 *
 * Found by an outside reader of the exports on 2026-08-25, four days after
 * the read-time correction shipped and was recorded as verified: the
 * verification measured `event:page` and generalised to "zero out-of-boundary
 * rows", which was true of the one dimension it looked at and false of two
 * others. Measured before this fix, over twelve months: 7 of 11 entry-page
 * rows and 11 of 17 exit-page rows were out of boundary, `/admin/roles` and
 * `/admin/generation` among them. Both read zero after it.
 */
const SESSION_PAGE_DIMENSIONS: Partial<Record<PlausibleDimensionKey, string>> = {
  entry_page: 'visit:entry_page',
  exit_page: 'visit:exit_page',
};

/** The scope clauses a breakdown of `dimensionKey` needs beyond the always-on one. */
export function dimensionScope(dimensionKey: PlausibleDimensionKey): PlausibleQueryFilter[] {
  const sessionDimension = SESSION_PAGE_DIMENSIONS[dimensionKey];
  return sessionDimension ? [pageScopeOn(sessionDimension)] : [];
}

/** Combine the always-on scope with whatever the caller asked for. */
export function scoped(filters?: PlausibleQueryFilter[]): PlausibleQueryFilter[] {
  return filters?.length ? [ACQUISITION_SCOPE, ...filters] : [ACQUISITION_SCOPE];
}

/**
 * What Plausible said ABOUT its own answer, as opposed to the answer.
 *
 * `pulse.ts` used to parse `results` and drop everything else on the floor,
 * which is how a partial answer came to be rendered as a complete one: our
 * always-on `event:page` filter cannot be applied to GA4-imported data (it is
 * stored pre-aggregated per dimension), so Plausible drops twelve months of
 * imported history from every non-page breakdown — and says so, in `meta`, on
 * every single response. An outside reader saw source/country/device summing
 * to 48 under a headline of 1,120 and reasonably concluded that dimensional
 * tracking had only been switched on in late July. Nothing had been switched
 * on or off. We were throwing the explanation away on arrival.
 *
 * §1.14: a caller that reads, modifies and presents a value must be able to
 * tell "this is everything" from "this is what I could get".
 */
export interface PlausibleMeta {
  /** False when GA4-imported history is missing from these numbers. */
  importsIncluded: boolean;
  /** Plausible's machine-readable reason, e.g. `unsupported_query`, `out_of_range`. */
  importsSkipReason: string | null;
  /** Plausible's own sentence about it, worth showing verbatim. */
  importsWarning: string | null;
  /** The window Plausible says it answered for — the drift guard's evidence. */
  queried: [string, string] | null;
}

const PlausibleEnvelope = z.object({
  results: z.array(z.object({ dimensions: z.array(z.union([z.string(), z.number()])), metrics: z.array(z.number()) })),
  meta: z
    .object({
      imports_included: z.boolean().optional(),
      imports_skip_reason: z.string().optional(),
      imports_warning: z.string().optional(),
    })
    .optional(),
  query: z.object({ date_range: z.array(z.string()).optional() }).optional(),
});

export interface PlausibleAnswer {
  results: { dimensions: (string | number)[]; metrics: number[] }[];
  meta: PlausibleMeta;
}

function readMeta(parsed: z.infer<typeof PlausibleEnvelope>): PlausibleMeta {
  const range = parsed.query?.date_range;
  return {
    // Absent means "not applicable to this query" — never silently "yes".
    importsIncluded: parsed.meta?.imports_included ?? false,
    importsSkipReason: parsed.meta?.imports_skip_reason ?? null,
    importsWarning: parsed.meta?.imports_warning ?? null,
    queried:
      range && range.length === 2 && range[0] && range[1]
        ? [range[0].slice(0, 10), range[1].slice(0, 10)]
        : null,
  };
}

/** The widest (i.e. most cautious) reading of several answers that make up one panel. */
function mergeMeta(parts: (PlausibleMeta | null | undefined)[]): PlausibleMeta {
  const present = parts.filter((p): p is PlausibleMeta => Boolean(p));
  const skipped = present.find((p) => !p.importsIncluded);
  return {
    importsIncluded: present.length > 0 && !skipped,
    importsSkipReason: skipped?.importsSkipReason ?? null,
    importsWarning: skipped?.importsWarning ?? null,
    queried: present.find((p) => p.queried)?.queried ?? null,
  };
}

async function plausibleQuery(cfg: PulseConfig, body: Record<string, unknown>): Promise<PlausibleAnswer | null> {
  const res = await fetch(`${cfg.PLAUSIBLE_URL}/api/v2/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.PLAUSIBLE_API_KEY}`, 'Content-Type': 'application/json' },
    // include.imports merges GA4-imported history into every result. The Stats
    // API v2 EXCLUDES imported data by default (unlike Plausible's own dashboard),
    // so without this the admin console shows ~zero for any range predating our
    // native tracking even though the GA4 import populated Plausible (verified
    // 2026-07-22). A body may override `include` if it ever needs to.
    body: JSON.stringify({
      site_id: cfg.PLAUSIBLE_SITE_ID,
      include: { imports: true },
      ...body,
      // Applied here, at the ONE place every Plausible call passes through, so
      // no present or future call site can report out-of-boundary traffic by
      // forgetting to opt in.
      filters: scoped(body.filters as PlausibleQueryFilter[] | undefined),
    }),
  });
  if (!res.ok) return null;
  const parsed = PlausibleEnvelope.safeParse(await res.json());
  if (!parsed.success) return null;
  return { results: parsed.data.results, meta: readMeta(parsed.data) };
}

function toAggregate(metrics: number[] | undefined): PlausibleAggregate {
  const m = metrics ?? [0, 0, 0, 0];
  return { visitors: m[0] ?? 0, pageviews: m[1] ?? 0, bounce_rate: m[2] ?? 0, visit_duration: m[3] ?? 0 };
}

/**
 * Makes the series span the window that was ASKED FOR, not the window that
 * happened to have traffic.
 *
 * Plausible returns rows only for days it has data on. A quiet tail therefore
 * came back as no rows at all and the chart simply stopped — so a fortnight
 * with no visitors rendered as a graph ending on the 18th, which reads as a
 * broken view rather than as the honest answer "nobody came". That is
 * /AGENTS.md §1.14 drawn on a chart: an absence must be distinguishable from a
 * fault, and a flat line at zero says the true thing where a missing line says
 * nothing at all.
 *
 * It also fixes the axis. Recharts scales to the data it is handed, so a
 * truncated series silently relabels the x-axis and the range the operator
 * PICKED stops matching the range they are SHOWN — which is exactly how this
 * was reported.
 *
 * `all` fills only from the first day that HAS data: years of leading zeros
 * from before the site existed mean nothing, and the gap that matters is
 * always the recent one.
 *
 * PRECONDITION, and the whole reason this function became dangerous: the
 * window handed in must be the window the UPSTREAM ANSWERED FOR, not the one
 * the caller hoped for. Padding is honest only when a missing day means "no
 * traffic that day"; if it can also mean "never asked", the same zero carries
 * two meanings and the reader cannot tell them apart. That is exactly what
 * happened while presets were passed to Plausible verbatim — see resolveRange.
 * `resolveRange` now emits explicit dates and `getPlausibleOverview` asserts
 * Plausible echoed them back, so a missing day has one meaning again.
 */
export function fillDailySeries(
  rows: { date: string; visitors: number; pageviews: number }[],
  resolved: Pick<ResolvedRange, 'startMs' | 'endMs' | 'allTime'>,
): { date: string; visitors: number; pageviews: number }[] {
  const byDay = new Map(rows.map((r) => [r.date, r]));

  const allTime = resolved.allTime;
  const firstWithData = rows.length ? Date.parse(`${rows[0]?.date}T00:00:00Z`) : Number.NaN;
  const from =
    allTime && Number.isFinite(firstWithData) ? Math.max(resolved.startMs, firstWithData) : resolved.startMs;

  // A guard, not a policy: a malformed range must not spin here. 800 days is
  // past any window this console offers and still cheap to build.
  const days = Math.floor((resolved.endMs - from) / DAY_MS) + 1;
  if (!Number.isFinite(days) || days < 1 || days > 800) return rows;

  const out = new Map<string, { date: string; visitors: number; pageviews: number }>();
  for (let i = 0; i < days; i += 1) {
    const date = dayKey(from + i * DAY_MS);
    out.set(date, byDay.get(date) ?? { date, visitors: 0, pageviews: 0 });
  }

  /*
   * A UNION, so filling can only ADD zeros and can never LOSE a day.
   *
   * Plausible is given the same `date_range`, so a row outside the window
   * should not exist — but "should not" is how data gets dropped. A timezone
   * edge, a clock skew, or a future change to how the range is built would
   * silently delete real traffic from the chart, and a chart missing a day
   * looks exactly like a day with no traffic. The window is a floor on what is
   * drawn, not a filter on what was measured.
   */
  for (const row of rows) if (!out.has(row.date)) out.set(row.date, row);

  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The window we ASKED for against the window Plausible says it ANSWERED for.
 *
 * With explicit dates these are identical — verified in production, and that
 * is the point: an assertion that is normally a no-op is exactly what catches
 * the day it stops being one (a site timezone change, an API semantics change,
 * a future refactor that reintroduces a shorthand). The defect this replaces
 * ran undetected for weeks because nothing ever compared the two.
 *
 * Reported, never silently corrected: if the two disagree, the numbers are
 * for some other window and the operator needs to know that, not be shown a
 * quietly relabelled chart.
 */
function detectRangeDrift(resolved: ResolvedRange, meta: PlausibleMeta): RangeDrift | null {
  if (!meta.queried) return null;
  const [askedFrom, askedTo] = resolved.dateRange;
  const [gotFrom, gotTo] = meta.queried;
  if (askedFrom === gotFrom && askedTo === gotTo) return null;
  return { askedFor: [askedFrom, askedTo], answeredFor: [gotFrom, gotTo] };
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

    // A failed comparison degrades to "no comparison shown" and never blocks
    // the headline numbers, which are the reason the page exists.
    const previous =
      resolved.previous && prior
        ? { ...toAggregate(prior.results[0]?.metrics), from: resolved.previous[0], to: resolved.previous[1] }
        : null;

    return {
      aggregate: toAggregate(agg.results[0]?.metrics),
      timeseries: fillDailySeries(
        series.results.map((r) => ({
          date: String(r.dimensions[0] ?? ''),
          visitors: r.metrics[0] ?? 0,
          pageviews: r.metrics[1] ?? 0,
        })),
        resolved,
      ),
      previous,
      imports: mergeMeta([agg.meta, series.meta, prior?.meta]),
      rangeDrift: detectRangeDrift(resolved, agg.meta) ?? detectRangeDrift(resolved, series.meta),
    };
  });
}

/** Top-N rows for one dimension, ordered by visitors desc. Null on any upstream failure. */
export function getPlausibleBreakdown(
  range: AnalyticsRange,
  dimensionKey: PlausibleDimensionKey,
  limit: number,
  filters?: PlausibleFilter[],
): Promise<PlausibleBreakdown | null> {
  const cfg = getPulseConfig();
  const resolved = resolveRange(range);
  const key = `plausible:breakdown:${resolved.key}:${dimensionKey}:${limit}:${filterCacheKey(filters)}`;
  return cached(key, async () => {
    const dimension = PLAUSIBLE_DIMENSIONS[dimensionKey];
    // The session-page dimensions need the allowlist restated against
    // themselves; every other dimension is fully covered by the always-on one.
    const scopeClauses = dimensionScope(dimensionKey);
    const query = (metrics: string[]): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        metrics,
        date_range: resolved.dateRange,
        dimensions: [dimension],
        order_by: [[metrics[0], 'desc']], // metrics[0] is always 'visitors' — always sortable
        pagination: { limit },
      };
      const combined = [...scopeClauses, ...(filters ?? [])];
      if (combined.length) body.filters = combined;
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
      const answer = await plausibleQuery(cfg, query(metrics));
      if (!answer) continue;
      const at = (name: string): number => metrics.indexOf(name);
      return {
        rows: answer.results.map((r) => ({
          label: String(r.dimensions[0] ?? ''),
          visitors: r.metrics[at('visitors')] ?? 0,
          pageviews: at('pageviews') >= 0 ? (r.metrics[at('pageviews')] ?? 0) : 0,
          bounceRate: at('bounce_rate') >= 0 ? (r.metrics[at('bounce_rate')] ?? 0) : 0,
          visitDuration: at('visit_duration') >= 0 ? (r.metrics[at('visit_duration')] ?? 0) : 0,
        })),
        imports: answer.meta,
      };
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
  /** Whether the headline figures include GA4-imported history. */
  imports: PlausibleMeta;
  /**
   * The dimensions whose rows EXCLUDE imported history, so every export can
   * say so beside the affected table instead of letting a reader infer a
   * tracking gap from an unexplained shortfall. This is the finding that cost
   * an outside reviewer a whole section of wrong conclusions.
   */
  breakdownsWithoutImports: PlausibleDimensionKey[];
  /** Non-null only when Plausible answered for a window we did not ask for. */
  rangeDrift: RangeDrift | null;
  /*
   * OUR OWN measurement of the same window, or null when it could not be read.
   *
   * Every other field here comes from Plausible, which by design sees only
   * anonymous, consented visitors on marketing pages. An export carrying only
   * that is not wrong, but it is systematically narrower than a reader
   * assumes — on this product it omitted the staff share, every signed-in
   * session, and the fact that 31 accounts existed while the client funnel had
   * observed none of them.
   *
   * Null is a real state and must render as "could not be read", never as
   * zeros: the point of putting it in the export is that a reader can tell the
   * two apart.
   */
  firstParty: FirstPartyReport | null;
}

/** First-party audience figures, carried into every export format. */
export interface FirstPartyReport {
  sessions: { anonymous: number; registered: number; staff: number };
  /** Share of sessions that were not staff, or null when there were none. */
  externalShare: number | null;
  accountsCreated: number;
  signupObserved: number;
  /** Accounts the consent-gated client funnel never recorded. */
  unobserved: number;
  anonymousVisitors: number;
  anonymousConverted: number;
  /** Null when nobody arrived — never a fabricated 0%. */
  conversionRate: number | null;
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
  const breakdownsWithoutImports: PlausibleDimensionKey[] = [];
  for (const [i, dim] of dims.entries()) {
    const breakdown = breakdownLists[i];
    if (!breakdown) return null;
    breakdowns[dim] = breakdown.rows;
    if (!breakdown.imports.importsIncluded) breakdownsWithoutImports.push(dim);
  }
  return {
    period: range.kind === 'custom' ? 'custom' : range.period,
    // The dates the figures ACTUALLY cover. They used to be this service's
    // own assumption about a preset while Plausible answered for something
    // else, which made the provenance line the export exists to provide the
    // least trustworthy line in the file.
    from: resolved.from,
    to: resolved.to,
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
    imports: overview.imports,
    breakdownsWithoutImports,
    rangeDrift: overview.rangeDrift,
    /*
     * Filled by the caller (routes/admin.ts loadReport), not here: this
     * function's job is Plausible, and reaching into the first-party views
     * from inside it would make a Plausible read fail whenever Postgres was
     * slow. Null means "not attached"; the exports render that as unread.
     */
    firstParty: null,
  };
}

// ── Umami (behavioral analytics) ───────────────────────────────────────────

export interface UmamiStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  /**
   * Pageviews in this window recorded on `/admin/*` — traffic the boundary
   * never permitted, captured by the auto-track defect fixed on 2026-08-14
   * (RUNBOOK). Reported rather than subtracted: Umami's API has no negation
   * filter, so `pageviews` can be corrected by subtraction but `visits`,
   * `bounces` and `totaltime` cannot (one visitor may span both). Removing
   * only the summable metric would leave the payload internally inconsistent
   * — bounce rate computed against a visit count that still includes the
   * sessions whose pageviews had been taken out. So the caller is told the
   * size of the contamination and decides, instead of being handed a number
   * that looks clean and is not.
   *
   * `null` means the breakdown could not be read, which is NOT the same as
   * zero and must not be rendered as "clean".
   */
  outOfBoundaryPageviews: number | null;
}

export function umamiConfigured(cfg: PulseConfig): boolean {
  return Boolean(cfg.UMAMI_URL && cfg.UMAMI_USERNAME && cfg.UMAMI_PASSWORD && cfg.UMAMI_WEBSITE_ID);
}

let umamiToken: string | null = null;

/** Used by resetPulseCacheForTests, which is declared above this binding. */
function clearUmamiToken(): void {
  umamiToken = null;
}

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
/** `/metrics?type=path` rows: { x: path, y: pageviews }. */
const UmamiPathRows = z.array(z.object({ x: z.string(), y: z.number() }));
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

    /** Authenticated GET against Umami, retrying once on token expiry. */
    const call2 = async (path: string): Promise<unknown | null> => {
      const get = async (): Promise<Response | null> => {
        if (!umamiToken) umamiToken = await umamiLogin(cfg);
        if (!umamiToken) return null;
        return fetch(`${cfg.UMAMI_URL}${path}`, { headers: { Authorization: `Bearer ${umamiToken}` } });
      };
      let r = await get();
      if (r && r.status === 401) {
        umamiToken = null;
        r = await get();
      }
      if (!r || !r.ok) return null;
      return r.json();
    };

    let res = await call();
    if (res && res.status === 401) {
      umamiToken = null; // expired — re-login once
      res = await call();
    }
    if (!res || !res.ok) return null;
    const parsed = UmamiStatsSchema.safeParse(await res.json());
    if (!parsed.success) return null;

    // Best-effort: a failed breakdown degrades to `null`, never to 0, and
    // never blocks the headline stats.
    let outOfBoundaryPageviews: number | null = null;
    const paths = await call2(
      `/api/websites/${cfg.UMAMI_WEBSITE_ID}/metrics?startAt=${startAt}&endAt=${endAt}&type=path&limit=500`,
    );
    if (paths) {
      const rows = UmamiPathRows.safeParse(paths);
      if (rows.success) {
        outOfBoundaryPageviews = rows.data
          .filter((r) => r.x === '/admin' || r.x.startsWith('/admin/'))
          .reduce((sum, r) => sum + r.y, 0);
      }
    }

    return {
      pageviews: metricValue(parsed.data.pageviews),
      visitors: metricValue(parsed.data.visitors),
      visits: metricValue(parsed.data.visits),
      bounces: metricValue(parsed.data.bounces),
      totaltime: metricValue(parsed.data.totaltime),
      outOfBoundaryPageviews,
    };
  });
}


/*
 * ── Umami breakdowns and series ────────────────────────────────────────────
 *
 * Umami was collecting behavioural data that NOTHING read: the only thing
 * exposed was a five-number aggregate, and no admin page consumed even that.
 * Twelve dimensions of real product behaviour sat in the database unused.
 *
 * Everything below reuses resolveRange(), the same resolver Plausible uses, so
 * the two panels can never disagree about what "this month" means — that class
 * of bug (one card reading month-to-date while another read 30 days) has
 * already been fixed once here and must not come back through a second door.
 */

/** Console dimension key → Umami `metrics?type=` value. */
export const UMAMI_DIMENSIONS = {
  path: 'path',
  referrer: 'referrer',
  title: 'title',
  query: 'query',
  browser: 'browser',
  os: 'os',
  device: 'device',
  screen: 'screen',
  language: 'language',
  country: 'country',
  region: 'region',
  city: 'city',
  event: 'event',
} as const;

export type UmamiDimension = keyof typeof UMAMI_DIMENSIONS;

export interface UmamiRow {
  label: string;
  value: number;
}

export interface UmamiSeriesPoint {
  date: string;
  pageviews: number;
  sessions: number;
}

/** `{x,y}` is Umami's shape for every metric and series row. */
const UmamiXY = z.array(z.object({ x: z.string().nullable(), y: z.number() }));
const UmamiSeries = z.object({ pageviews: UmamiXY, sessions: UmamiXY });

/**
 * One authenticated GET against Umami with a single retry on token expiry.
 * Returns null on any failure — callers must not turn that into an empty list,
 * because "Umami did not answer" and "there is no traffic" are different
 * answers and only one of them is safe to render as a zero.
 */
async function umamiGet(cfg: PulseConfig, path: string): Promise<unknown | null> {
  const attempt = async (): Promise<Response | null> => {
    if (!umamiToken) umamiToken = await umamiLogin(cfg);
    if (!umamiToken) return null;
    return fetch(`${cfg.UMAMI_URL}${path}`, { headers: { Authorization: `Bearer ${umamiToken}` } });
  };
  let res = await attempt();
  if (res && res.status === 401) {
    umamiToken = null;
    res = await attempt();
  }
  if (!res || !res.ok) return null;
  return res.json();
}

/**
 * Top values for one dimension.
 *
 * Umami returns `x: null` for "not recorded" (no referrer, unknown region).
 * Those rows are kept and labelled by the caller rather than dropped: a
 * breakdown whose rows silently fail to sum to the total invites the reader to
 * assume data loss.
 */
export function getUmamiBreakdown(
  range: AnalyticsRange,
  dimension: UmamiDimension,
  limit: number,
): Promise<UmamiRow[] | null> {
  const cfg = getPulseConfig();
  const resolved = resolveRange(range);
  return cached(`umami:breakdown:${resolved.key}:${dimension}:${limit}`, async () => {
    const type = UMAMI_DIMENSIONS[dimension];
    const body = await umamiGet(
      cfg,
      `/api/websites/${cfg.UMAMI_WEBSITE_ID}/metrics` +
        `?startAt=${resolved.startMs}&endAt=${resolved.endMs}&type=${type}&limit=${limit}`,
    );
    if (!body) return null;
    const parsed = UmamiXY.safeParse(body);
    if (!parsed.success) return null;
    return parsed.data.map((row) => ({ label: row.x ?? '', value: row.y }));
  });
}

/** Per-day pageviews and sessions for the resolved window. */
export function getUmamiSeries(range: AnalyticsRange): Promise<UmamiSeriesPoint[] | null> {
  const cfg = getPulseConfig();
  const resolved = resolveRange(range);
  return cached(`umami:series:${resolved.key}`, async () => {
    const body = await umamiGet(
      cfg,
      `/api/websites/${cfg.UMAMI_WEBSITE_ID}/pageviews` +
        `?startAt=${resolved.startMs}&endAt=${resolved.endMs}&unit=day&timezone=UTC`,
    );
    if (!body) return null;
    const parsed = UmamiSeries.safeParse(body);
    if (!parsed.success) return null;
    // Sessions and pageviews are separate arrays that need not align, so the
    // series is keyed by date rather than zipped by index.
    const sessions = new Map(parsed.data.sessions.map((p) => [p.x ?? '', p.y]));
    return parsed.data.pageviews.map((p) => ({
      date: (p.x ?? '').slice(0, 10),
      pageviews: p.y,
      sessions: sessions.get(p.x ?? '') ?? 0,
    }));
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
