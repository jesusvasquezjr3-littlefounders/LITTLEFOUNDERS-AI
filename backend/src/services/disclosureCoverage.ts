import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * Teen/Guest Consent-Adjacent Disclosure Coverage: the share of self-registered
 * 13-17 and guest accounts active in the window that were shown the teen
 * analytics disclosure/opt-out, or whose analytics are suppressed outright
 * (a guest, or a protected under-13 origin). Target: 100%.
 *
 * public.analytics_disclosure_coverage (migration analytics_disclosure_coverage)
 * returns COUNTS; this module turns them into the rate and the verdict. A teen
 * with an event admitted without an opt-in is never counted as covered: a
 * disclosure that gates nothing is not what is required. Counts only; a
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
  /**
   * Consent-Gate Population Gap Rate: the share of the same
   * population measured with no choice behind it (a teen's event admitted
   * without an opt-in, or a guest's admitted event). Target: zero.
   */
  gap: { measured: number; rate: number | null; target: 0; status: 'met' | 'missed' | 'no_data' };
}

/** Pure: the report for one set of counts. */
export function buildDisclosureCoverage(counts: DisclosureCounts, days: number): DisclosureCoverageReport {
  const covered = counts.teens.covered + counts.guests.suppressed;
  const population = counts.teens.active + counts.guests.active;
  const coverage = population === 0 ? null : covered / population;
  const measured = counts.teens.measuredWithoutOptIn + counts.guests.measured;
  const gapRate = population === 0 ? null : measured / population;
  return {
    ...counts,
    days,
    covered,
    population,
    coverage,
    target: 1,
    status: coverage === null ? 'no_data' : coverage >= 1 ? 'met' : 'missed',
    gap: { measured, rate: gapRate, target: 0, status: gapRate === null ? 'no_data' : gapRate === 0 ? 'met' : 'missed' },
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
