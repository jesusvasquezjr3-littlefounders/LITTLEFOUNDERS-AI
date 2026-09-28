import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * Appendix O Part 1.1 (Teen/Guest Consent-Adjacent Disclosure Coverage) for
 * H.1, and Part 2.1 criterion 3 ("Measured"): the share of self-registered
 * 13-17 and guest accounts active in the window that were shown the teen
 * analytics disclosure/opt-out, or whose analytics are suppressed outright
 * (a guest, or a protected under-13 origin). Target: 100% once H.1 ships.
 *
 * public.analytics_disclosure_coverage (migration analytics_disclosure_coverage)
 * returns COUNTS; this module turns them into the rate and the verdict. A teen
 * with an event admitted without an opt-in is never counted as covered: a
 * disclosure that gates nothing is not what H.1 requires. Counts only; a
 * malformed or missing answer fails the read, never renders zeros.
 */

const n = z.coerce.number().int().nonnegative();
const Counts = z.object({
  window: z.object({ from: z.string(), to: z.string() }),
  teens: z.object({
    active: n, disclosed: n, optedIn: n, optedOut: n, protectedOrigin: n, measuredWithoutOptIn: n, covered: n,
  }),
  guests: z.object({ active: n, suppressed: n, measured: n }),
});
export type DisclosureCounts = z.infer<typeof Counts>;

export interface DisclosureCoverageReport extends DisclosureCounts {
  days: number;
  covered: number;
  population: number;
  /** covered / population (0-1), or null when no teen or guest was active. */
  coverage: number | null;
  target: 1;
  status: 'met' | 'missed' | 'no_data';
}

/** Pure: the report for one set of counts. */
export function buildDisclosureCoverage(counts: DisclosureCounts, days: number): DisclosureCoverageReport {
  const covered = counts.teens.covered + counts.guests.suppressed;
  const population = counts.teens.active + counts.guests.active;
  const coverage = population === 0 ? null : covered / population;
  return {
    ...counts,
    days,
    covered,
    population,
    coverage,
    target: 1,
    status: coverage === null ? 'no_data' : coverage >= 1 ? 'met' : 'missed',
  };
}

export async function getDisclosureCoverage(days: number, now: Date = new Date()): Promise<DisclosureCoverageReport | null> {
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  const raw = await serviceRest<unknown>('/rpc/analytics_disclosure_coverage', {
    method: 'POST',
    body: JSON.stringify({ p_from: from, p_to: now.toISOString() }),
  });
  const parsed = Counts.safeParse(raw);
  return parsed.success ? buildDisclosureCoverage(parsed.data, days) : null;
}
