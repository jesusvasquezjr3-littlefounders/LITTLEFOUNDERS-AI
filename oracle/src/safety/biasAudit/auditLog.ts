import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { BiasAuditReport } from './audit.js';
import { AUDITED_COMPONENTS, componentHash, FUSED_DECISION, REPO_ROOT, type AuditedComponent } from './registry.js';

/*
 * C.20 — THE AUDIT TRACKING LOG (Appendix F Part 1.3, "Bias-Audit Coverage":
 * 100% of the lexical/prosodic components, on a semi-annual recurring cadence
 * or immediately upon any material change to the component).
 *
 * `audit-log.json` records every accepted audit run: the date, the source hash
 * of every registered component at that moment, the totals and the known gaps.
 * Two rules make the cadence enforceable rather than a calendar promise:
 *
 *   MATERIAL CHANGE  a component whose sources hash differently from the
 *                    latest entry has changed since it was last audited. The
 *                    Oracle test suite fails (`biasAudit.test.ts`) until the
 *                    audit is rerun and recorded (`npm run bias-audit --
 *                    --record`), which only records a passing run.
 *   CADENCE          `npm run bias-audit -- --check` also fails when the
 *                    latest entry is older than `CADENCE_DAYS`; the scheduled
 *                    `mentor-bias-audit.yml` workflow runs it monthly, so an
 *                    overdue audit is a red run somebody sees.
 *
 * A live-only component (the model judge) is recorded as `pending_live` until
 * an owner-approved live run (OD-23: zero paid spend during the migration)
 * adds its evidence; Bias-Audit Coverage counts it as NOT covered until then.
 */

/** Proposed, pending calibration (Threshold Recalibration Log): semi-annual. */
export const CADENCE_DAYS = 183;

const LOG_PATH = path.join(REPO_ROOT, 'oracle/src/safety/biasAudit/audit-log.json');

const EntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    trigger: z.enum(['initial', 'cadence', 'material_change']),
    components: z.record(
      z.string(),
      z.object({ hash: z.string(), status: z.enum(['passed', 'pending_live']) }).strict(),
    ),
    totals: z
      .object({ items: z.number().int(), variants: z.number().int(), failures: z.literal(0), knownGaps: z.number().int() })
      .strict(),
    knownGaps: z.array(z.object({ item: z.string(), group: z.string(), reason: z.string() }).strict()),
    sessions: z.array(z.object({ id: z.string(), ok: z.literal(true) }).strict()),
    /** Human review of the run (policy §5); null until a reviewer signs it. */
    reviewedBy: z.string().nullable(),
    notes: z.string(),
  })
  .strict();
export type AuditLogEntry = z.infer<typeof EntrySchema>;

const LogSchema = z.object({ entries: z.array(EntrySchema) }).strict();

export function readAuditLog(file: string = LOG_PATH): AuditLogEntry[] {
  return LogSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).entries;
}

export function latestEntry(entries: readonly AuditLogEntry[]): AuditLogEntry | null {
  return entries.length === 0 ? null : entries[entries.length - 1]!;
}

/** The components whose sources changed since the latest recorded audit (or were never audited). */
export function changedSinceAudit(
  entry: AuditLogEntry | null,
  components: readonly AuditedComponent[] = AUDITED_COMPONENTS,
): string[] {
  const tracked: { id: string; sources: readonly string[] }[] = [...components, FUSED_DECISION];
  return tracked.filter((c) => entry?.components[c.id]?.hash !== componentHash({ sources: [...c.sources] })).map((c) => c.id);
}

/** Days between the latest audit and `now`, or Infinity when none exists. */
export function daysSinceAudit(entry: AuditLogEntry | null, now: Date): number {
  if (entry === null) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - Date.parse(`${entry.date}T00:00:00Z`)) / 86_400_000);
}

/** Appendix F "Bias-Audit Coverage": share of registered components with passing evidence in the latest entry. */
export function coverage(entry: AuditLogEntry | null, components: readonly AuditedComponent[] = AUDITED_COMPONENTS): number {
  if (components.length === 0) return 1;
  const covered = components.filter(
    (c) => entry?.components[c.id]?.status === 'passed' && entry.components[c.id]!.hash === componentHash(c),
  ).length;
  return covered / components.length;
}

/** Everything that makes `--check` fail. */
export function checkProblems(report: BiasAuditReport, entries: readonly AuditLogEntry[], now: Date): string[] {
  const problems: string[] = [];
  if (!report.ok) problems.push(`the audit fails (${report.totals.failures} failure(s) or a session parity break)`);
  const latest = latestEntry(entries);
  for (const id of changedSinceAudit(latest)) {
    problems.push(`${id} changed since the last recorded audit: rerun and record it (npm run bias-audit -- --record)`);
  }
  const days = daysSinceAudit(latest, now);
  if (days > CADENCE_DAYS) problems.push(`the last recorded audit is ${days} days old (cadence ${CADENCE_DAYS} days)`);
  return problems;
}

/** Builds the entry for a passing run. Throws on a failing one: only a passing audit is ever recorded. */
export function entryFor(
  report: BiasAuditReport,
  date: string,
  trigger: AuditLogEntry['trigger'],
  notes: string,
): AuditLogEntry {
  if (!report.ok) throw new Error('refusing to record a failing bias audit');
  return EntrySchema.parse({
    date,
    trigger,
    components: Object.fromEntries([
      ...AUDITED_COMPONENTS.map((c) => [c.id, { hash: componentHash(c), status: c.mode === 'fixture' ? 'passed' : 'pending_live' }]),
      [FUSED_DECISION.id, { hash: componentHash({ sources: [...FUSED_DECISION.sources] }), status: 'passed' }],
    ]),
    totals: {
      items: report.totals.items,
      variants: report.totals.variants,
      failures: 0,
      knownGaps: report.totals.knownGaps,
    },
    knownGaps: report.components.flatMap((c) => c.knownGaps),
    sessions: report.sessions.map((s) => ({ id: s.id, ok: true })),
    reviewedBy: null,
    notes,
  });
}

export function appendEntry(entry: AuditLogEntry, file: string = LOG_PATH): void {
  const entries = readAuditLog(file);
  writeFileSync(file, `${JSON.stringify({ entries: [...entries, entry] }, null, 2)}\n`);
}
