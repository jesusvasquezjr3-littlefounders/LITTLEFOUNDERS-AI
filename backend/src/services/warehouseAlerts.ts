import { z } from 'zod';
import { getConfig } from '../config.js';

/*
 * H.3 (GAP-FIX-R6; Block H: "no alert, event, or export job may be built to
 * record without a real consumer"; Appendix O 1.3 Alert-to-Notification
 * Delivery Rate, target 100%).
 *
 * The warehouse (dataintel) delivers each alert trigger through its channel
 * and retries a failed send a bounded number of times. A trigger that still
 * reached nobody (failed, unconfigured channel, or no outcome recorded) is
 * read here and carried on the operations status as `alerts.undelivered`, so
 * agent/tools/ops-job-watch.mjs fails and names it on the `ops-watchdog`
 * issue: the escalation channel a human is subscribed to. Nobody has to open
 * the staff Intel screen to find out that an alert notified nobody.
 *
 * ONE HOME for the window: ALERT_UNDELIVERED_WINDOW_HOURS. The watch runs
 * daily, so 36 hours is a day plus slack, like the heartbeat jobs.
 *
 * A read failure is `undelivered: null`, never zero: the watcher refuses a
 * reply without the count, so an unreachable warehouse also fails the watch.
 * It never turns the whole operations status into a 502, because the other
 * jobs' verdicts must still reach the issue.
 */

export const ALERT_UNDELIVERED_WINDOW_HOURS = 36;

const UndeliveredAlert = z.object({
  alertId: z.string(),
  name: z.string().nullable(),
  channel: z.string().nullable(),
  triggeredAt: z.string(),
  status: z.enum(['failed', 'unconfigured', 'unrecorded']),
  error: z.string().nullable(),
  attempts: z.number().int().nonnegative().nullable(),
});
export type UndeliveredAlert = z.infer<typeof UndeliveredAlert>;

const Envelope = z.object({
  data: z.object({ hours: z.number().int(), count: z.number().int().nonnegative(), alerts: z.array(UndeliveredAlert) }).nullable(),
  error: z.unknown().nullable(),
});

export interface UndeliveredAlertsStatus {
  /** Triggers in the window that reached nobody; null when the warehouse could not be read. */
  undelivered: number | null;
  windowHours: number;
  /** The newest of them (at most 50), for the notice and the console. */
  alerts: UndeliveredAlert[];
}

export async function getUndeliveredAlerts(): Promise<UndeliveredAlertsStatus> {
  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();
  const unreadable: UndeliveredAlertsStatus = { undelivered: null, windowHours: ALERT_UNDELIVERED_WINDOW_HOURS, alerts: [] };
  try {
    const res = await fetch(`${DATAINTEL_URL}/api/v1/intel/alerts/undelivered?hours=${ALERT_UNDELIVERED_WINDOW_HOURS}`, {
      headers: { 'x-internal-api-key': DATAINTEL_INTERNAL_KEY },
      signal: AbortSignal.timeout(Math.min(DATAINTEL_TIMEOUT_MS, 15_000)),
    });
    if (!res.ok) return unreadable;
    const parsed = Envelope.safeParse(await res.json());
    if (!parsed.success || !parsed.data.data) return unreadable;
    return { undelivered: parsed.data.data.count, windowHours: ALERT_UNDELIVERED_WINDOW_HOURS, alerts: parsed.data.data.alerts };
  } catch {
    return unreadable;
  }
}
