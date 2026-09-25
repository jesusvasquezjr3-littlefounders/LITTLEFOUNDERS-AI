import { z } from 'zod';
import { ACCOUNT_DELETION_SLA_HOURS } from './accountDeletion.js';
import { countServiceRows, serviceRest } from './supabaseRest.js';

/*
 * Appendix J "Deletion-Request Clarity" for E.6, plus the operational view
 * staff need to see that deletions actually finish.
 *
 * THE SLA (published in docs/rebuild/policies/ACCOUNT-DELETION.md): every
 * self-service request is answered with its date at the moment it is made
 * (the request response and the deletion screen carry scheduled_for), and
 * the erasure completes within ACCOUNT_DELETION_SLA_HOURS of that date.
 *   statedTimelineRate  requests in the window that carry a stated date /
 *                       requests in the window — 1.0 by construction, since
 *                       scheduled_for is NOT NULL, and reported so a
 *                       regression would show rather than be assumed
 *   withinSlaRate       completed requests finished within the SLA /
 *                       completed requests (null when none completed)
 *   overdue             open requests more than the SLA past their date
 *
 * Counts only: no account id leaves this function. Every count is exact or
 * the whole read fails (§1.14).
 */

export interface AccountDeletionMetrics {
  windowDays: number;
  since: string;
  slaHours: number;
  requested: {
    total: number;
    byInitiator: { self: number; guardian: number; suspension_expiry: number };
    byPopulation: Record<'adult' | 'parent' | 'teen' | 'unscreened' | 'guest' | 'child' | 'kid', number>;
  };
  cancelled: number;
  completed: number;
  statedTimelineRate: number | null;
  withinSlaRate: number | null;
  open: { pending: number; processing: number; held: number; overdue: number };
}

const q = (value: string) => encodeURIComponent(value);
const POPULATIONS = ['adult', 'parent', 'teen', 'unscreened', 'guest', 'child', 'kid'] as const;
const Completed = z.array(z.object({ scheduled_for: z.string(), completed_at: z.string() }));

export async function getAccountDeletionMetrics(windowDays: number, now: Date = new Date()): Promise<AccountDeletionMetrics | null> {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const overdueBefore = new Date(now.getTime() - ACCOUNT_DELETION_SLA_HOURS * 60 * 60 * 1000).toISOString();
  const inWindow = `/account_deletion_requests?select=id&requested_at=gte.${q(since)}`;

  const counts = await Promise.all([
    countServiceRows(inWindow),
    countServiceRows(`${inWindow}&scheduled_for=not.is.null`),
    countServiceRows(`${inWindow}&initiated_by=eq.self`),
    countServiceRows(`${inWindow}&initiated_by=eq.guardian`),
    countServiceRows(`${inWindow}&initiated_by=eq.suspension_expiry`),
    ...POPULATIONS.map((population) => countServiceRows(`${inWindow}&population=eq.${population}`)),
    countServiceRows(`/account_deletion_requests?select=id&status=eq.cancelled&cancelled_at=gte.${q(since)}`),
    countServiceRows('/account_deletion_requests?select=id&status=eq.pending'),
    countServiceRows('/account_deletion_requests?select=id&status=eq.processing'),
    countServiceRows('/account_deletion_requests?select=id&status=eq.held'),
    countServiceRows(`/account_deletion_requests?select=id&status=in.(pending,processing)&scheduled_for=lt.${q(overdueBefore)}`),
  ]);
  const completedRows = await serviceRest<unknown>(
    `/account_deletion_requests?select=scheduled_for,completed_at&status=eq.completed&completed_at=gte.${q(since)}&limit=10000`,
  );
  const completed = Completed.safeParse(completedRows);
  if (counts.some((value) => value === null) || !completed.success) return null;
  const values = counts as number[];
  const [total, stated, self, guardian, suspension] = values;
  const byPopulation = Object.fromEntries(POPULATIONS.map((population, index) => [population, values[5 + index]!])) as AccountDeletionMetrics['requested']['byPopulation'];
  const [cancelled, pending, processing, held, overdue] = values.slice(5 + POPULATIONS.length);
  const slaMs = ACCOUNT_DELETION_SLA_HOURS * 60 * 60 * 1000;
  const withinSla = completed.data.filter((row) => Date.parse(row.completed_at) - Date.parse(row.scheduled_for) <= slaMs).length;

  return {
    windowDays,
    since,
    slaHours: ACCOUNT_DELETION_SLA_HOURS,
    requested: {
      total: total!,
      byInitiator: { self: self!, guardian: guardian!, suspension_expiry: suspension! },
      byPopulation,
    },
    cancelled: cancelled!,
    completed: completed.data.length,
    statedTimelineRate: total! === 0 ? null : stated! / total!,
    withinSlaRate: completed.data.length === 0 ? null : withinSla / completed.data.length,
    open: { pending: pending!, processing: processing!, held: held!, overdue: overdue! },
  };
}
