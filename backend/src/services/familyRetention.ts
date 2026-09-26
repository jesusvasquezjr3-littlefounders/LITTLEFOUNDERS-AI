import { z } from 'zod';
import { getConfig } from '../config.js';
import { isRefusal, rpc, UNAVAILABLE } from './familyLifecycle.js';

/*
 * S07.7 — D.21: the Block D retention and deletion policy at the Core
 * boundary. The database decides and enforces (family_data_retention); Core
 * runs the nightly job, deletes the photos that live in Depot (outside
 * PostgreSQL), serves the periods to families from the same numbers, and
 * serves the compliance audit to analytics staff.
 *
 * The periods are written in three places kept equal by
 * agent/tools/check-block-d-retention.mjs: this file, the migration's
 * family_retention_days() and docs/operations/block-d-retention.json (the
 * policy's registry, which the written policy FAMILY-DATA-RETENTION.md
 * explains). A family reads them from GET /api/v1/family-hub/data-policy, so
 * what a Tutor is told is what the database does.
 */

export const RETENTION_EVIDENCE_DAYS = 30;
export const RETENTION_RECORDS_DAYS = 400;
export const RETENTION_INVITES_DAYS = 30;
export const RETENTION_RESEARCH_DAYS = 1100;
/** How many photos one run deletes at most; the next night continues. */
export const RETENTION_EVIDENCE_BATCH = 200;

/**
 * What a family is told, in the order they read it. `days` is null where the
 * rule is not a period: the coin record lives as long as the account, an
 * erasure removes everything, and nothing is shared outside LittleFounders.
 */
export const DATA_POLICY = [
  { id: 'photos', days: RETENTION_EVIDENCE_DAYS },
  { id: 'records', days: RETENTION_RECORDS_DAYS },
  { id: 'coins', days: null },
  { id: 'insights', days: RETENTION_RECORDS_DAYS },
  { id: 'research', days: RETENTION_RESEARCH_DAYS },
  { id: 'erasure', days: null },
  { id: 'sharing', days: null },
] as const;

const Int = z.union([z.number(), z.string().regex(/^-?\d+$/)]).transform((v) => Number(v)).pipe(z.number().int());
const Removed = z.record(z.string().regex(/^[a-z_]+$/), Int);

export interface RetentionRun {
  runId: number;
  removed: Record<string, number>;
  evidence: { due: number; deleted: number; kept: number; cleared: number; failed: number };
}

const DueRows = z.array(z.object({
  task_id: z.string().uuid(), bucket: z.string().regex(/^[a-z0-9-]+$/), hash: z.string().regex(/^[A-Za-z0-9_-]+$/),
  ext: z.string().regex(/^[a-z0-9]+$/), shared: z.boolean(),
}).strict());

type DepotOutcome = 'deleted' | 'failed';

/** One Depot object; a 404 is already gone, which is the state wanted. */
async function deleteDepotObject(bucket: string, hash: string, ext: string): Promise<DepotOutcome> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  if (!FILEBASE_URL || !FILEBASE_INTERNAL_KEY) return 'failed';
  try {
    const res = await fetch(`${FILEBASE_URL}/api/v1/files/${encodeURIComponent(bucket)}/${encodeURIComponent(`${hash}.${ext}`)}`, {
      method: 'DELETE',
      headers: { 'x-internal-api-key': FILEBASE_INTERNAL_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok || res.status === 404 ? 'deleted' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * The nightly run: the database sweep, then the photos. A photo's pointer is
 * cleared only after Depot confirmed the delete (or when another chore still
 * needs the same content-addressed object), so a failed call leaves the
 * pointer in place for the next night and the chore row is never deleted
 * before its photo (the sweep waits for a cleared pointer). Returns null when
 * the sweep itself could not run: "nothing was due" and "the job did not
 * run" must stay different answers.
 */
export async function runFamilyRetention(batch = RETENTION_EVIDENCE_BATCH): Promise<RetentionRun | null> {
  const swept = await rpc('family_retention_sweep', {}, z.record(z.string(), z.unknown()));
  if (swept === UNAVAILABLE || isRefusal(swept)) return null;
  const runId = Int.safeParse(swept.run_id);
  const counts = Object.fromEntries(Object.entries(swept).filter(([key]) => key !== 'run_id'));
  const removed = Removed.safeParse(counts);
  if (!runId.success || !removed.success) return null;

  const due = await rpc('family_evidence_due', { p_limit: batch }, DueRows);
  const evidence = { due: 0, deleted: 0, kept: 0, cleared: 0, failed: 0 };
  if (due === UNAVAILABLE || isRefusal(due)) {
    evidence.failed = 1;
  } else {
    evidence.due = due.length;
    // Sequential: a burst of deletes against Depot helps nobody at night.
    for (const row of due) {
      if (!row.shared) {
        const outcome = await deleteDepotObject(row.bucket, row.hash, row.ext);
        if (outcome === 'failed') { evidence.failed += 1; continue; }
        evidence.deleted += 1;
      } else {
        evidence.kept += 1;
      }
      const cleared = await rpc('family_evidence_cleared', { p_task: row.task_id, p_bucket: row.bucket, p_hash: row.hash, p_ext: row.ext }, z.boolean());
      if (cleared === true) evidence.cleared += 1;
      else evidence.failed += 1;
    }
  }
  const recorded = await rpc('record_family_evidence_purge', { p_run: runId.data, p_cleared: evidence.cleared, p_failed: evidence.failed }, z.boolean());
  if (recorded !== true) console.error(`[family-retention] run ${runId.data}: the photo result could not be recorded`);
  return { runId: runId.data, removed: removed.data, evidence };
}

const ComplianceRows = z.array(z.object({
  data_class: z.enum(['evidence', 'records', 'invites', 'research']), table_name: z.string().regex(/^[a-z_.]+$/),
  retain_days: Int, overdue: Int,
}).strict());
const LastRun = z.object({
  ran_at: z.string(), removed: Removed, evidence_cleared: Int.nullable(), evidence_failed: Int.nullable(),
}).strict().nullable();

export interface RetentionCompliance {
  pass: boolean;
  overdue: number;
  tables: { dataClass: string; table: string; retainDays: number; overdue: number }[];
  lastRun: { ranAt: string; removed: Record<string, number>; evidenceCleared: number | null; evidenceFailed: number | null } | null;
}

/** Appendix H's Retention-Policy Compliance Audit (pass every release): zero rows past their period anywhere. */
export async function readRetentionCompliance(): Promise<RetentionCompliance | null> {
  const [rows, last] = await Promise.all([
    rpc('family_retention_compliance', {}, ComplianceRows),
    rpc('family_retention_last_run', {}, LastRun),
  ]);
  if (rows === UNAVAILABLE || isRefusal(rows) || last === UNAVAILABLE || isRefusal(last)) return null;
  const overdue = rows.reduce((sum, r) => sum + r.overdue, 0);
  return {
    pass: overdue === 0,
    overdue,
    tables: rows.map((r) => ({ dataClass: r.data_class, table: r.table_name, retainDays: r.retain_days, overdue: r.overdue })),
    lastRun: last ? { ranAt: last.ran_at, removed: last.removed, evidenceCleared: last.evidence_cleared, evidenceFailed: last.evidence_failed } : null,
  };
}
