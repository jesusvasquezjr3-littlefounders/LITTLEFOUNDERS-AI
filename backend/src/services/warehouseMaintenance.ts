import { z } from 'zod';
import { getConfig } from '../config.js';

/*
 * H.4 and the Block H non-negotiables (GAP-FIX-R8): the analytics
 * warehouse's family-data maintenance is a watched job, `warehouse_retention`.
 *
 * dataintel runs two steps after every sync (db/sync.ts, every
 * SYNC_INTERVAL_MS, 5 minutes by default) and logs each run, a failed one
 * included, in warehouse_maintenance_log:
 *   warehouse_retention  the 400-day window over the learner-keyed raw events
 *                        and experiment rows (H.2, Appendix O 1.2)
 *   erasure_reapply      an erased account's rows never come back with a later
 *                        sync (E.6)
 * This reads dataintel's GET /api/v1/intel/maintenance/status (internal key)
 * the way services/warehouseAlerts.ts reads /alerts/undelivered, and
 * services/opsJobs.ts judges it with the other watched jobs, so
 * ops-job-watch.yml fails and notifies a human when either step failed, went
 * quiet, or the warehouse cannot be read.
 *
 * A read failure is null, never "never ran": opsJobs.ts turns it into an
 * `unreadable` job that is stale and that the watcher refuses, without turning
 * the whole operations status into a 502 (the other jobs' verdicts must still
 * reach the issue).
 */

/** The steps the job covers; the reply must carry each one. */
export const WAREHOUSE_MAINTENANCE_STEPS = ['warehouse_retention', 'erasure_reapply'] as const;
export type WarehouseMaintenanceStep = (typeof WAREHOUSE_MAINTENANCE_STEPS)[number];

const Step = z.object({
  step: z.string(),
  lastSuccessAt: z.string().datetime({ offset: true }).nullable(),
  lastSuccessRemoved: z.number().int().nullable(),
  lastAttemptAt: z.string().datetime({ offset: true }).nullable(),
  lastAttemptOk: z.boolean().nullable(),
  lastError: z.string().max(500).nullable(),
});
export type WarehouseMaintenanceStepStatus = z.infer<typeof Step> & { step: WarehouseMaintenanceStep };

const Envelope = z.object({
  data: z.object({ steps: z.array(Step).max(20) }).nullable(),
  error: z.unknown().nullable(),
});

/** Pure: the reply's steps in WAREHOUSE_MAINTENANCE_STEPS order, or null when one is missing or the shape is wrong. */
export function parseWarehouseMaintenance(body: unknown): WarehouseMaintenanceStepStatus[] | null {
  const parsed = Envelope.safeParse(body);
  if (!parsed.success || !parsed.data.data) return null;
  const steps: WarehouseMaintenanceStepStatus[] = [];
  for (const name of WAREHOUSE_MAINTENANCE_STEPS) {
    const step = parsed.data.data.steps.find((entry) => entry.step === name);
    if (!step) return null;
    steps.push({ ...step, step: name });
  }
  return steps;
}

/** Every step's last successful and last attempted run, or null when the warehouse could not be read. */
export async function getWarehouseMaintenance(): Promise<WarehouseMaintenanceStepStatus[] | null> {
  const { DATAINTEL_URL, DATAINTEL_INTERNAL_KEY, DATAINTEL_TIMEOUT_MS } = getConfig();
  try {
    const res = await fetch(`${DATAINTEL_URL}/api/v1/intel/maintenance/status`, {
      headers: { 'x-internal-api-key': DATAINTEL_INTERNAL_KEY },
      signal: AbortSignal.timeout(Math.min(DATAINTEL_TIMEOUT_MS, 15_000)),
    });
    if (!res.ok) return null;
    return parseWarehouseMaintenance(await res.json());
  } catch {
    return null;
  }
}
