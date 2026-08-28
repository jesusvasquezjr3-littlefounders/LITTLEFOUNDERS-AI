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

/**
 * A day count for the first-party views, which read Postgres directly and know
 * nothing of Plausible's `date_range` vocabulary.
 *
 * ONE selection drives both halves of the page. Deriving a second window from
 * a second control is how a console ends up with two sections that disagree
 * about what "last 30 days" means — which this one has already done once, and
 * which cost a week of believing a traffic collapse that had not happened.
 *
 * `all` maps to two years rather than to infinity: the first event ever
 * recorded is 2026-08-03, so a longer window only adds empty days, and an
 * unbounded scan is a query nobody meant to run.
 */
export function daysForSelection(selection: PeriodSelection): number {
  if (selection.period === 'custom' && selection.from && selection.to) {
    const from = Date.parse(`${selection.from}T00:00:00Z`);
    const to = Date.parse(`${selection.to}T00:00:00Z`);
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
      return Math.min(365, Math.max(1, Math.round((to - from) / 86_400_000) + 1));
    }
    return 30;
  }
  switch (selection.period) {
    case 'day': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case 'month': return new Date().getUTCDate();
    case '6mo': return 182;
    case '12mo': return 365;
    case 'year': return Math.max(1, Math.ceil((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 86_400_000));
    case 'all': return 365;
    default: return 30;
  }
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
 * Plausible reports countries as ISO-3166 alpha-2 codes. Map to the
 * locale-aware region name via Intl.DisplayNames; fall back to the raw code
 * for anything unmappable.
 *
 * This used to prefix a flag built from regional-indicator emoji codepoints
 * (`0x1F1E6 + letter offset`). Windows ships no glyphs at all for those
 * codepoint pairs — Segoe UI Emoji deliberately omits flags — so every admin
 * on Windows saw a stray empty box or two-letter tofu before the country
 * name, for all ~250 possible codes, not just the 3 the language switcher
 * covers. Building a real flag for every ISO country is a materially bigger
 * asset problem than 3 locale flags and out of proportion for an admin-only
 * table where the name alone is already fully identifying, so this drops the
 * emoji instead of trying to replace it — consistent with DESIGN.md's icon
 * rule, which no longer carries any emoji exception.
 */
export function countryLabel(code: string, locale?: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return code;
  try {
    return new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/* ── Response shapes (backend contract) ─────────────────────────────── */

export interface Aggregate {
  visitors: number;
  pageviews: number;
  bounce_rate: number;
  visit_duration: number;
}

/*
 * What the analytics API said ABOUT its answer, as opposed to the answer.
 *
 * Core used to parse the rows and discard this. That is how a breakdown
 * covering 48 visitors came to be displayed under a headline of 1,120 with
 * nothing on screen to explain the gap — and how an outside reader of the
 * exports concluded, reasonably and wrongly, that dimensional tracking had
 * been switched on late (WALKTHROUGH, 2026-08-27).
 */
export interface ImportsMeta {
  /** False when historical imported (GA4) traffic is missing from these figures. */
  importsIncluded: boolean;
  importsSkipReason: string | null;
  importsWarning: string | null;
  queried: [string, string] | null;
}

/** The upstream answered for a window we did not ask for. Should always be null. */
export interface RangeDrift {
  askedFor: [string, string];
  answeredFor: [string, string];
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
  imports: ImportsMeta;
  /** Non-null means the figures describe a different window than the one shown. */
  rangeDrift: RangeDrift | null;
}

/*
 * Behavioural dimensions (Umami). Twelve of them existed in the warehouse and
 * the console read none: only the five-number aggregate below was surfaced,
 * so path-level behaviour, referrers, devices, languages, screens and
 * geography were collected and never looked at.
 *
 * `city` is included deliberately and is safe: Umami is restricted to
 * marketing plus signed-in ADULT parent surfaces (pulse/AGENTS.md #4) and
 * never runs for kid roles, so no minor's location can reach it.
 */
export type BehaviorDimensionKey =
  | 'path' | 'referrer' | 'title' | 'query'
  | 'browser' | 'os' | 'device' | 'screen'
  | 'language' | 'country' | 'region' | 'city' | 'event';

export const BEHAVIOR_CARDS: { dimension: BehaviorDimensionKey; icon: string }[] = [
  { dimension: 'path', icon: 'description' },
  { dimension: 'referrer', icon: 'travel_explore' },
  { dimension: 'device', icon: 'devices' },
  { dimension: 'browser', icon: 'web' },
  { dimension: 'os', icon: 'memory' },
  { dimension: 'country', icon: 'public' },
  { dimension: 'region', icon: 'map' },
  { dimension: 'city', icon: 'location_city' },
  { dimension: 'language', icon: 'translate' },
  { dimension: 'screen', icon: 'aspect_ratio' },
  { dimension: 'title', icon: 'title' },
  { dimension: 'event', icon: 'bolt' },
];

export interface BehaviorRow {
  label: string;
  value: number;
}

export interface BehaviorBreakdownData {
  period: Period;
  dimension: BehaviorDimensionKey;
  rows: BehaviorRow[];
}

export interface BehaviorSeriesPoint {
  date: string;
  pageviews: number;
  sessions: number;
}

export interface BehaviorSeriesData {
  period: Period;
  from: string;
  to: string;
  series: BehaviorSeriesPoint[];
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
  /**
   * `/admin/*` pageviews Umami stored before the 2026-08-14 tracker fix.
   * `null` means the breakdown could not be read — NOT zero, and it must
   * never be rendered as "clean".
   */
  outOfBoundaryPageviews: number | null;
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
  /** Distinct staff accounts seen at this address. >1 means a shared egress. */
  distinctStaffUsers: number;
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
  imports: ImportsMeta;
}


/*
 * ── Audience (first-party) ─────────────────────────────────────────────────
 *
 * Separate from the Plausible types above because the two answer different
 * questions and must never be silently merged. Plausible measures ANONYMOUS,
 * CONSENTED, MARKETING-ONLY visitors; this measures every session the product
 * itself recorded, including signed-in ones, with the role attached — which is
 * the only thing that can separate staff from real people retroactively.
 */
export interface AudienceSeriesPoint {
  date: string;
  anonymous: number;
  registered: number;
  staff: number;
}

export interface AudienceData {
  days: number;
  series: AudienceSeriesPoint[];
  totals: { anonymous: number; registered: number; staff: number };
  /** Share of sessions that were NOT staff. Null when there were none. */
  externalShare: number | null;
}

/**
 * The server-side record set beside what the client stream claims.
 *
 * `observedShare` is null — never 1 — on a window with no registrations, so a
 * quiet week cannot render as "we observed everything".
 */
export interface FunnelIntegrityData {
  days: number;
  entries: { day: string; accounts_created: number; signup_start: number; signup_submit: number; signup_complete: number; unobserved: number }[];
  accountsCreated: number;
  signupComplete: number;
  unobserved: number;
  observedShare: number | null;
}

export interface AcquisitionBreakdownRow {
  label: string;
  visitors: number;
  converted: number;
}

export interface AcquisitionData {
  days: number;
  visitors: number;
  converted: number;
  /** Null when nobody arrived — never a fabricated 0%. */
  conversionRate: number | null;
  byReferrer: AcquisitionBreakdownRow[];
  byLandingRoute: AcquisitionBreakdownRow[];
  byDevice: AcquisitionBreakdownRow[];
  byLocale: AcquisitionBreakdownRow[];
  /** Every visitor arrived with no campaign tag: a marketing gap, not a data gap. */
  noCampaignsTagged: boolean;
}

export interface RegistrationsData {
  days: number;
  entries: { day: string; role: string; registrations: number }[];
  total: number;
}


/*
 * ── Product usage (first-party) ────────────────────────────────────────────
 *
 * Shapes for three endpoints Core has served since the insights work and that
 * no screen had ever consumed: `/insights/activity`, `/insights/adoption` and
 * `/insights/sessions`. Nine such endpoints existed on 2026-08-28; these are
 * the three whose answers are not already covered by the dataintel console.
 */
export interface ActivityRow {
  day: string;
  role: string;
  event: string;
  route_class: string | null;
  device: string | null;
  locale: string | null;
  events: number;
  users: number;
  sessions: number;
  total_value: number | null;
}

export interface ActivityData {
  days: number;
  entries: ActivityRow[];
  users: { day: string; role: string; users: number }[];
}

export interface AdoptionRow {
  role: string;
  route_class: string | null;
  events: number;
  users: number;
  sessions: number;
  first_at: string | null;
  last_at: string | null;
}

export interface AdoptionData {
  entries: AdoptionRow[];
}

export interface SessionDepthRow {
  session_id: string;
  started_at: string;
  role: string;
  device: string | null;
  locale: string | null;
  events: number;
  surfaces: number;
  lessons_started: number;
  visible_seconds: number | null;
  reported_seconds: number | null;
}

export interface SessionDepthData {
  entries: SessionDepthRow[];
}

/**
 * Base URL for the raw (non-envelope) export routes: report.pdf/.csv/.xlsx
 * need a manual fetch with the Bearer header, which a plain <a href> cannot
 * carry. Re-exported from the API client rather than re-derived, so the two
 * cannot drift apart.
 */
export { BASE_URL as API_BASE_URL } from '@/lib/api';
