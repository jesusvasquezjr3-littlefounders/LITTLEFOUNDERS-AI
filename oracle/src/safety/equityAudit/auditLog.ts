import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { componentHash, REPO_ROOT } from '../biasAudit/registry.js';
import type { EquityAuditReport } from './audit.js';

/*
 * C.18 / C.20 / Appendix D §3.7 — THE EQUITY-DRIFT AUDIT RECORD AND CADENCE
 * (policy: docs/rebuild/mentor/EQUITY-AUDIT-POLICY.md).
 *
 * `audit-log.json` keeps every recorded run: the date, whether it was the
 * zero-spend dry run or an owner-run live run, the model it measured, the
 * hash of the sources that decide what the model is told and how a turn is
 * scored, and the verdict. Three rules make it a cadence rather than a
 * promise (`npm run equity-audit -- --check`, run monthly by
 * .github/workflows/mentor-equity-audit.yml):
 *
 *   MATERIAL CHANGE  the audited sources hash differently from the latest
 *                    recorded run: the prompt builder (how the nickname and
 *                    the feedback rules reach the model), the model call, the
 *                    C.18 readers that score a turn, and the audit's own cues,
 *                    scripts and harness. Rerun and record.
 *   CADENCE          the latest recorded run is older than CADENCE_DAYS.
 *   OPEN FINDING     the latest LIVE run drifted: it stays failing until a
 *                    later live run passes.
 *
 * LIVE EVIDENCE is separate and owner-run (OD-23: zero paid spend during the
 * migration). Until a live run is recorded, or when the model or the sources
 * changed since the last one, `--check` WARNS that live evidence is pending
 * or stale, and `--require-live` makes that a failure.
 */

/** Proposed, pending calibration (Threshold Recalibration Log): semi-annual, like the C.20 bias audit. */
export const CADENCE_DAYS = 183;

export const AUDITED_SOURCES = [
  'oracle/src/tutor/prompt.ts',
  'oracle/src/model/provider.ts',
  'oracle/src/tutor/feedbackHonesty.ts',
  'oracle/src/safety/equityAudit/cues.ts',
  'oracle/src/safety/equityAudit/scripts.ts',
  'oracle/src/safety/equityAudit/harness.ts',
  'oracle/src/safety/equityAudit/audit.ts',
] as const;

export function sourcesHash(root: string = REPO_ROOT): string {
  return componentHash({ sources: [...AUDITED_SOURCES] }, root);
}

const LOG_PATH = path.join(REPO_ROOT, 'oracle/src/safety/equityAudit/audit-log.json');

const DriftSummary = z
  .object({ scope: z.string(), dimension: z.string(), metric: z.string(), drift: z.number(), tolerance: z.number(), high: z.string(), low: z.string() })
  .strict();

const EntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: z.enum(['dry_run', 'live']),
    trigger: z.enum(['initial', 'cadence', 'material_change', 'model_change']),
    model: z.string().min(1),
    sourcesHash: z.string().min(8),
    repeats: z.number().int().positive(),
    sessions: z.number().int().positive(),
    modelCalls: z.number().int().nonnegative(),
    verdict: z.enum(['ok', 'drift']),
    drifting: z.array(DriftSummary),
    insufficientCells: z.number().int().nonnegative(),
    /** Human review of the run (policy §5): the Safety/Trust Lead; null until signed. */
    reviewedBy: z.string().nullable(),
    notes: z.string(),
  })
  .strict()
  .refine((e) => e.mode === 'live' || e.verdict === 'ok', { message: 'a dry run is recorded only when it passes' });
export type EquityAuditEntry = z.infer<typeof EntrySchema>;

const LogSchema = z.object({ entries: z.array(EntrySchema) }).strict();

export function readEquityLog(file: string = LOG_PATH): EquityAuditEntry[] {
  return LogSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).entries;
}

export function appendEquityEntry(entry: EquityAuditEntry, file: string = LOG_PATH): void {
  const entries = readEquityLog(file);
  writeFileSync(file, `${JSON.stringify({ entries: [...entries, entry] }, null, 2)}\n`);
}

const latest = (entries: readonly EquityAuditEntry[], mode?: EquityAuditEntry['mode']) =>
  [...entries].reverse().find((e) => mode === undefined || e.mode === mode) ?? null;

export function daysSince(date: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}

/** Builds the entry for a run. A failing dry run is never recorded (it is a harness defect, not evidence). */
export function entryFor(
  report: EquityAuditReport,
  date: string,
  trigger: EquityAuditEntry['trigger'],
  notes: string,
  hash: string = sourcesHash(),
): EquityAuditEntry {
  if (report.mode === 'stub' && !report.ok) throw new Error('refusing to record a failing dry run: fix the harness first');
  if (!report.controlled.ok) throw new Error('refusing to record a run whose variation was not controlled');
  return EntrySchema.parse({
    date,
    mode: report.mode === 'stub' ? 'dry_run' : 'live',
    trigger,
    model: report.model,
    sourcesHash: hash,
    repeats: report.repeats,
    sessions: report.sessions,
    modelCalls: report.modelCalls,
    verdict: report.ok ? 'ok' : 'drift',
    drifting: report.cells
      .filter((c) => c.verdict === 'drift')
      .map((c) => ({ scope: c.scope, dimension: c.dimension, metric: c.metric, drift: c.drift!, tolerance: c.tolerance, high: c.extremes!.high, low: c.extremes!.low })),
    insufficientCells: report.totals.insufficient,
    reviewedBy: null,
    notes,
  });
}

export interface CheckResult {
  problems: string[];
  warnings: string[];
  live: 'pending' | 'stale' | 'current';
}

/** What `--check` fails and warns on. `report` is a fresh dry run. */
export function checkEquity(
  report: EquityAuditReport,
  entries: readonly EquityAuditEntry[],
  now: Date,
  opts: { model: string; hash?: string; requireLive?: boolean } = { model: 'unknown' },
): CheckResult {
  const problems: string[] = [];
  const warnings: string[] = [];
  const hash = opts.hash ?? sourcesHash();
  if (!report.ok) problems.push('the dry run fails: drift from a cue-blind stub, an uncontrolled variation or a delivered false affirmation is a harness defect');
  const last = latest(entries);
  if (last === null) problems.push('no equity-drift audit is recorded: run and record it (npm run equity-audit -- --record --trigger initial)');
  else {
    if (last.sourcesHash !== hash) problems.push(`the audited sources changed since the ${last.date} run: rerun and record it (npm run equity-audit -- --record --trigger material_change)`);
    const days = daysSince(last.date, now);
    if (days > CADENCE_DAYS) problems.push(`the last recorded equity-drift audit is ${days} days old (cadence ${CADENCE_DAYS} days)`);
  }
  const lastLive = latest(entries, 'live');
  if (lastLive?.verdict === 'drift') {
    const cells = lastLive.drifting.map((d) => `${d.scope}/${d.dimension}/${d.metric} ${d.drift} > ${d.tolerance}`).join('; ');
    problems.push(`the ${lastLive.date} live run found equity drift (${cells}); it stays open until a later live run passes (Safety/Trust Lead)`);
  }
  let live: CheckResult['live'] = 'current';
  if (lastLive === null) {
    live = 'pending';
    warnings.push('no live run is recorded yet: the owner-run live audit is pending (OD-23; npm run equity-audit -- --live-plan)');
  } else if (lastLive.model !== opts.model || lastLive.sourcesHash !== hash) {
    live = 'stale';
    warnings.push(`the ${lastLive.date} live run measured ${lastLive.model} on sources ${lastLive.sourcesHash}; the model or the sources changed since: a live re-audit is due (owner step)`);
  } else if (daysSince(lastLive.date, now) > CADENCE_DAYS) {
    live = 'stale';
    warnings.push(`the ${lastLive.date} live run is older than the ${CADENCE_DAYS}-day cadence: a live re-audit is due (owner step)`);
  }
  if (opts.requireLive && live !== 'current') problems.push(...warnings);
  return { problems, warnings: opts.requireLive ? [] : warnings, live };
}
