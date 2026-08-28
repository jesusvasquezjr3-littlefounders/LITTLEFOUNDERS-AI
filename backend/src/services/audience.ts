import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * Who is out there, and how many of them became real accounts.
 *
 * WHY THIS IS A SEPARATE SERVICE FROM insights.ts
 *
 * `insights.ts` reads the client-emitted, consent-gated event stream. This one
 * reads it too — but it also reads the SERVER-SIDE record of what actually
 * happened, and the whole value is in keeping the two apart and then setting
 * them side by side.
 *
 * The reason, measured in production on 2026-08-28: 31 accounts exist, and
 * `signup_complete` has fired ZERO times across every single day any of them
 * were created. A console that only reads the event stream reports "no signups
 * ever" with total confidence. That is /AGENTS.md §1.14 — an absence has to be
 * distinguishable from a fault — and it cannot be resolved from inside the
 * stream, because a stream that records nothing looks identical whether nobody
 * came or nothing was recorded.
 *
 * So `readSignupFunnelIntegrity` reports the gap rather than smoothing it, and
 * `readRegistrations` gives every other panel a denominator that no cookie
 * banner, ad blocker or closed tab can suppress.
 */

/* ── Registrations: the consent-independent truth ─────────────────────────── */

const RegistrationRow = z.object({
  day: z.string(),
  role: z.string(),
  registrations: z.coerce.number(),
});
export type RegistrationEntry = z.infer<typeof RegistrationRow>;

/**
 * Accounts created per day per role, from `profiles` — a row exists because an
 * account exists. Retroactive to the first account ever created, where the
 * event stream only begins on 2026-08-03.
 */
export async function readRegistrations(days: number): Promise<RegistrationEntry[] | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await serviceRest<unknown[]>(
    `/insights_registrations_daily?day=gte.${since}&order=day.desc&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(RegistrationRow).safeParse(rows);
  return parsed.success ? parsed.data : null;
}

/* ── Funnel integrity: the truth beside the claim ─────────────────────────── */

const FunnelIntegrityRow = z.object({
  day: z.string(),
  accounts_created: z.coerce.number(),
  signup_start: z.coerce.number(),
  signup_submit: z.coerce.number(),
  signup_complete: z.coerce.number(),
  unobserved: z.coerce.number(),
});
export type FunnelIntegrityEntry = z.infer<typeof FunnelIntegrityRow>;

export interface FunnelIntegrity {
  entries: FunnelIntegrityEntry[];
  /** Accounts the client funnel never saw, over the window. */
  unobserved: number;
  accountsCreated: number;
  signupComplete: number;
  /**
   * Share of real registrations the client funnel actually observed, 0-1, or
   * `null` when there were no registrations to observe.
   *
   * Null rather than 1 on an empty window: "we saw everything" and "there was
   * nothing to see" are different statements, and a panel that renders 100%
   * for a quiet week teaches an operator to trust a number that means nothing.
   */
  observedShare: number | null;
}

export async function readSignupFunnelIntegrity(days: number): Promise<FunnelIntegrity | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await serviceRest<unknown[]>(
    `/insights_signup_funnel_integrity?day=gte.${since}&order=day.desc&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(FunnelIntegrityRow).safeParse(rows);
  if (!parsed.success) return null;

  const entries = parsed.data;
  const accountsCreated = entries.reduce((t, e) => t + e.accounts_created, 0);
  const signupComplete = entries.reduce((t, e) => t + e.signup_complete, 0);
  return {
    entries,
    accountsCreated,
    signupComplete,
    unobserved: entries.reduce((t, e) => t + Math.max(0, e.unobserved), 0),
    observedShare: accountsCreated > 0 ? Math.min(1, signupComplete / accountsCreated) : null,
  };
}

/* ── Audience: distinct sessions per day per role ─────────────────────────── */

const AudienceRow = z.object({
  day: z.string(),
  role: z.string(),
  sessions: z.coerce.number(),
  users: z.coerce.number(),
  visitors: z.coerce.number(),
  events: z.coerce.number(),
  surfaces: z.coerce.number(),
});
export type AudienceEntry = z.infer<typeof AudienceRow>;

/**
 * Roles grouped the way an operator actually reads them.
 *
 * `staff` exists as its own band because on a pre-launch product staff are
 * ~90% of all event volume; drawn together with everyone else they flatten
 * every other line into the axis. Separated, the chart answers the question it
 * is for — who that is NOT us was here.
 */
export type AudienceBand = 'anonymous' | 'registered' | 'staff';

export function bandForRole(role: string): AudienceBand {
  if (role === 'admin' || role === 'superadmin') return 'staff';
  if (role === 'anon') return 'anonymous';
  return 'registered';
}

export interface AudienceSeriesPoint {
  date: string;
  anonymous: number;
  registered: number;
  staff: number;
}

export interface AudienceSummary {
  /** One row per day, zero-filled across the window. */
  series: AudienceSeriesPoint[];
  /** Per-role detail, for the table view and the tooltip. */
  entries: AudienceEntry[];
  totals: { anonymous: number; registered: number; staff: number };
  /** Share of sessions that were NOT staff, 0-1, or null when there were none. */
  externalShare: number | null;
}

/**
 * Fills every day in the window, including the empty ones.
 *
 * A quiet day has to render as a zero and not as a gap, for the same reason the
 * analytics timeseries does: a chart that simply stops reads as a broken view
 * rather than as the honest answer "nobody came" (§1.14, and the
 * `fillDailySeries` note in pulse.ts).
 */
function fillDays(byDay: Map<string, AudienceSeriesPoint>, days: number): AudienceSeriesPoint[] {
  const out: AudienceSeriesPoint[] = [];
  const today = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDay.get(date) ?? { date, anonymous: 0, registered: 0, staff: 0 });
  }
  // A row outside the computed window is kept rather than dropped — the window
  // is a floor on what is drawn, never a filter on what was measured.
  for (const [date, point] of byDay) if (!out.some((p) => p.date === date)) out.push(point);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function readAudience(days: number): Promise<AudienceSummary | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await serviceRest<unknown[]>(
    `/insights_audience_daily?day=gte.${since}&order=day.desc&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(AudienceRow).safeParse(rows);
  if (!parsed.success) return null;

  const byDay = new Map<string, AudienceSeriesPoint>();
  const totals = { anonymous: 0, registered: 0, staff: 0 };
  for (const row of parsed.data) {
    const point = byDay.get(row.day) ?? { date: row.day, anonymous: 0, registered: 0, staff: 0 };
    const band = bandForRole(row.role);
    point[band] += row.sessions;
    totals[band] += row.sessions;
    byDay.set(row.day, point);
  }

  const all = totals.anonymous + totals.registered + totals.staff;
  return {
    series: fillDays(byDay, days),
    entries: parsed.data,
    totals,
    externalShare: all > 0 ? (totals.anonymous + totals.registered) / all : null,
  };
}

/* ── Anonymous acquisition: a table nothing had ever read ─────────────────── */

const AcquisitionRow = z.object({
  first_seen_day: z.string(),
  landing_route: z.string().nullable(),
  referrer_class: z.string(),
  device: z.string(),
  locale: z.string(),
  utm_source: z.string(),
  utm_campaign: z.string(),
  visitors: z.coerce.number(),
  converted: z.coerce.number(),
  avg_days_to_convert: z.coerce.number().nullable(),
});
export type AcquisitionEntry = z.infer<typeof AcquisitionRow>;

export interface AcquisitionBreakdown {
  label: string;
  visitors: number;
  converted: number;
}

export interface AcquisitionSummary {
  visitors: number;
  converted: number;
  /** Conversion rate 0-1, or null when nobody arrived — never a fabricated 0%. */
  conversionRate: number | null;
  byReferrer: AcquisitionBreakdown[];
  byLandingRoute: AcquisitionBreakdown[];
  byDevice: AcquisitionBreakdown[];
  byLocale: AcquisitionBreakdown[];
  /**
   * True when every visitor in the window arrived with no campaign tag at all.
   * Worth stating rather than rendering an empty card: it means no link we have
   * ever shared carried a UTM, which is a marketing gap and not a data gap.
   */
  noCampaignsTagged: boolean;
}

function group(entries: AcquisitionEntry[], key: (e: AcquisitionEntry) => string): AcquisitionBreakdown[] {
  const map = new Map<string, AcquisitionBreakdown>();
  for (const entry of entries) {
    const label = key(entry);
    const row = map.get(label) ?? { label, visitors: 0, converted: 0 };
    row.visitors += entry.visitors;
    row.converted += entry.converted;
    map.set(label, row);
  }
  return [...map.values()].sort((a, b) => b.visitors - a.visitors);
}

export async function readAnonAcquisition(days: number): Promise<AcquisitionSummary | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await serviceRest<unknown[]>(
    `/insights_anon_acquisition?first_seen_day=gte.${since}&order=visitors.desc&select=*`,
  );
  if (rows === null) return null;
  const parsed = z.array(AcquisitionRow).safeParse(rows);
  if (!parsed.success) return null;

  const entries = parsed.data;
  const visitors = entries.reduce((t, e) => t + e.visitors, 0);
  const converted = entries.reduce((t, e) => t + e.converted, 0);
  return {
    visitors,
    converted,
    conversionRate: visitors > 0 ? converted / visitors : null,
    byReferrer: group(entries, (e) => e.referrer_class),
    byLandingRoute: group(entries, (e) => e.landing_route ?? '(unknown)'),
    byDevice: group(entries, (e) => e.device),
    byLocale: group(entries, (e) => e.locale),
    noCampaignsTagged: visitors > 0 && entries.every((e) => e.utm_source === '(none)'),
  };
}
