#!/usr/bin/env node
// identity-review-cadence.mjs — Appendix M Part 3 Stage 6 (Post-Launch
// Recalibration) as a gate and a calendar trigger (GAP-FIX-R6 identity-site).
//
// Block A's thresholds live in docs/operations/IDENTITY-RECALIBRATION-LOG.md,
// owned by the Trust/Identity Lead and reviewed quarterly "consistent with
// Appendices H, J and L". Blocks D and E already had logs and overdue gates;
// this is Block A's, on the same machinery as Block D
// (block-d-review-cadence.mjs: a `Kind` column where only `human` rows count,
// a machine-readable "First human review due: YYYY-MM-DD", 90 days after the
// latest human review).
//
//   node agent/tools/identity-review-cadence.mjs [--strict]
//     The gate. Fails when the log is unreadable or its threshold table drifts
//     from the metrics Core reports (backend/src/services/identityMetrics.ts:
//     every metric(...) and IDENTITY_ADVERSARIAL entry has exactly one row, of
//     the same kind). An overdue review warns, and fails under --strict
//     (release readiness). The repo gates run it without --strict.
//
//   node agent/tools/identity-review-cadence.mjs --issue-file issue.md \
//     --title-file title.txt [--report identity.json] [--now <ISO>] [--root <repo>]
//     The quarterly issue (.github/workflows/identity-recalibration-quarterly.yml):
//     owner, last human review, next due date, every release-gate metric and,
//     when the staff console's identity report is attached (the JSON of
//     GET /api/v1/admin/analytics/identity), the gates reading missed or no data.
//     Exit 1 when the log or the report is unreadable (the issue is still written).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReviewCadence, readReviewTable, reportCadence, reviewSchedule } from './block-d-review-cadence.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ISSUE_LABEL = 'identity-review';
export const METRICS_SOURCE = 'backend/src/services/identityMetrics.ts';

export const IDENTITY_REVIEW = {
  id: 'identity-recalibration',
  title: 'Block A Identity Recalibration',
  spec: 'Appendix M Part 3 Stage 6',
  doc: 'docs/operations/IDENTITY-RECALIBRATION-LOG.md',
  heading: 'Review history',
  owner: 'Trust/Identity Lead',
  cadence: 'quarterly',
  record: 'Review every metric against the last quarter of the staff console identity report (the "What a recalibration looks at" list), then add a `human` row to the review history.',
};

const KIND_OF = { release_gate: 'release gate', diagnostic: 'diagnostic', adversarial: 'adversarial' };

/** Every metric Core reports, with its kind: metric('<id>', '<part>', '<req>', '<kind>') and IDENTITY_ADVERSARIAL ids. */
export function readCoreMetrics(source) {
  const metrics = [...source.matchAll(/metric\('([a-z0-9_]+)',\s*'(1\.[1-4])',\s*'([^']+)',\s*'(release_gate|diagnostic)'/g)]
    .map((m) => ({ id: m[1], part: m[2], requirement: m[3], kind: KIND_OF[m[4]] }));
  const block = /export const IDENTITY_ADVERSARIAL = \[([\s\S]*?)\] as const;/.exec(source)?.[1] ?? '';
  const adversarial = [...block.matchAll(/\{ id: '([a-z0-9_]+)', requirement: '([^']+)'/g)]
    .map((m) => ({ id: m[1], part: null, requirement: m[2], kind: KIND_OF.adversarial }));
  return [...metrics, ...adversarial];
}

/** The log's threshold rows: metric id (from the backticked cell), part, requirement, kind, target. */
export function readThresholds(markdown) {
  const table = readReviewTable(markdown ?? '', 'Thresholds');
  if (!table) return null;
  return table.rows.map((row) => ({
    id: /^`([a-z0-9_]+)`$/.exec(row.metric ?? '')?.[1] ?? null,
    raw: row.metric ?? '',
    part: row.part ?? '',
    requirement: row.requirement ?? '',
    kind: row.kind ?? '',
    target: row.target ?? '',
  }));
}

/** Drift between the log's threshold table and Core's metrics. */
export function checkThresholdCoverage(markdown, source) {
  const failures = [];
  const doc = IDENTITY_REVIEW.doc;
  const rows = readThresholds(markdown);
  if (!rows) return [`${doc}: no "## Thresholds" table`];
  const core = readCoreMetrics(source);
  if (core.length === 0) return [`${METRICS_SOURCE}: no metric(...) or IDENTITY_ADVERSARIAL entry could be read`];
  const seen = new Map();
  for (const row of rows) {
    if (!row.id) { failures.push(`${doc}: a threshold row has no backticked metric id ("${row.raw}")`); continue; }
    if (seen.has(row.id)) failures.push(`${doc}: ${row.id} is listed twice`);
    seen.set(row.id, row);
    if (!row.target.trim()) failures.push(`${doc}: ${row.id} has no target`);
  }
  for (const metric of core) {
    const row = seen.get(metric.id);
    if (!row) { failures.push(`${doc}: Core reports ${metric.id} (${metric.kind}) but the log has no row for it`); continue; }
    if (row.kind !== metric.kind) failures.push(`${doc}: ${metric.id} is "${row.kind}" in the log but "${metric.kind}" in Core`);
    if (row.requirement !== metric.requirement) failures.push(`${doc}: ${metric.id} verifies "${row.requirement}" in the log but "${metric.requirement}" in Core`);
    if (metric.part && row.part !== metric.part) failures.push(`${doc}: ${metric.id} is Appendix M ${row.part} in the log but ${metric.part} in Core`);
  }
  const ids = new Set(core.map((m) => m.id));
  for (const id of seen.keys()) if (!ids.has(id)) failures.push(`${doc}: ${id} is not a metric Core reports (remove it or instrument it)`);
  return failures;
}

/** The gate: coverage drift and log parse failures always fail; an overdue review warns, and fails under `strict`. */
export function checkIdentityReview({ markdown, source, today, strict = false }) {
  const cadence = checkReviewCadence({ markdown, review: IDENTITY_REVIEW, today, strict });
  const coverage = markdown == null ? [] : checkThresholdCoverage(markdown, source ?? '');
  return { failures: [...cadence.failures, ...coverage], warnings: cadence.warnings, schedule: cadence.schedule };
}

/**
 * The release gates of a staff console identity report (its `data`, or the
 * report itself) that are not met: status 'missed' or 'no_data'. Throws on a
 * shape that is not an identity report.
 */
export function unmetGates(report) {
  const body = report && typeof report === 'object' && 'data' in report ? report.data : report;
  if (!body || !Array.isArray(body.metrics)) throw new Error('not an identity report (no metrics array)');
  return body.metrics
    .filter((m) => m && m.kind === 'release_gate' && (m.status === 'missed' || m.status === 'no_data'))
    .map((m) => ({ id: String(m.id), status: m.status, numerator: m.numerator, denominator: m.denominator }));
}

/** "2026-Q4" for any instant in October to December 2026 (UTC). */
export function quarterLabel(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('quarterLabel: not a date');
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export const issueTitle = (now) => `Quarterly Block A identity recalibration: ${quarterLabel(now)}`;

/**
 * The issue body. `report` is { ok: true, unmet } from an attached identity
 * report, { ok: false, problem } when one was attached but unreadable, or null.
 */
export function buildIssue({ markdown, now, report = null, runUrl = '' }) {
  const today = new Date(now).toISOString().slice(0, 10);
  const r = IDENTITY_REVIEW;
  const schedule = reviewSchedule(markdown, r);
  const rows = readThresholds(markdown) ?? [];
  const lines = [
    `The ${quarterLabel(now)} Block A recalibration (${r.spec}). A human review by the ${r.owner}; an engineering row never counts as one.`,
    '',
    `- Owner: ${r.owner}.`,
    `- Log: \`${r.doc}\`.`,
  ];
  if (schedule.failures.length === 0) {
    const state = today > schedule.due ? 'overdue' : 'due';
    lines.push(`- Last human review: ${schedule.lastHuman ?? 'none recorded yet'}.`, `- Next due: **${schedule.due}** (${state}).`);
  } else {
    lines.push(`- The log could not be read: ${schedule.failures.join('; ')}. The review is still due; fix the log when recording it.`);
  }
  lines.push(`- To complete it: ${r.record}`, '', '### Release-gate metrics', '');
  for (const row of rows.filter((x) => x.kind === 'release gate')) lines.push(`- [ ] \`${row.id}\` (${row.requirement}): target ${row.target}`);
  lines.push('', '### Missed release gates in the attached identity report', '');
  if (report === null) {
    lines.push('No identity report was attached to this run. Export the staff console identity report (Analytics, Identity, 90 days) and list every release gate that reads missed or no data; a missed gate is a regression to roll back, not a threshold to relax (Stage 6).');
  } else if (!report.ok) {
    lines.push(`The attached identity report could not be read: ${report.problem}. Export it again from the staff console.`);
  } else if (report.unmet.length === 0) {
    lines.push('None: every release gate in the attached report is met.');
  } else {
    for (const g of report.unmet) {
      const value = g.status === 'no_data' ? 'no data' : `missed (${g.numerator} of ${g.denominator})`;
      lines.push(`- **\`${g.id}\`**: ${value}`);
    }
  }
  lines.push('', 'Release readiness fails while this review is overdue (`identity-review-cadence.mjs --strict`). Close this issue when a `human` row is recorded.');
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return lines.join('\n');
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function readOrNull(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = arg('--root') ?? ROOT;
  const now = new Date(arg('--now') ?? Date.now());
  if (Number.isNaN(now.getTime())) {
    console.error('identity-review-cadence: --now is not a date');
    process.exit(1);
  }
  const markdown = readOrNull(join(root, IDENTITY_REVIEW.doc));
  const source = readOrNull(join(root, METRICS_SOURCE));
  const issueFile = arg('--issue-file');
  const titleFile = arg('--title-file');
  if (issueFile || titleFile) {
    if (!issueFile || !titleFile) {
      console.error('Usage: identity-review-cadence.mjs --issue-file <path> --title-file <path> [--report <json>] [--now <ISO>] [--root <repo>]');
      process.exit(1);
    }
    let report = null;
    const reportPath = arg('--report');
    if (reportPath) {
      try { report = { ok: true, unmet: unmetGates(JSON.parse(readFileSync(reportPath, 'utf8'))) }; }
      catch (error) { report = { ok: false, problem: error instanceof Error ? error.message : String(error) }; }
    }
    writeFileSync(issueFile, buildIssue({ markdown, now, report, runUrl: process.env.RUN_URL ?? '' }));
    writeFileSync(titleFile, issueTitle(now));
    const schedule = reviewSchedule(markdown, IDENTITY_REVIEW);
    console.log(schedule.failures.length ? `unreadable: ${schedule.failures.join('; ')}` : `due ${schedule.due}`);
    process.exit(schedule.failures.length === 0 && (report === null || report.ok) ? 0 : 1);
  }
  const result = checkIdentityReview({ markdown, source, today: now.toISOString().slice(0, 10), strict: process.argv.includes('--strict') });
  if (reportCadence(result)) process.exit(1);
  console.log(`identity-review-cadence OK — ${readThresholds(markdown)?.length ?? 0} Block A metrics logged; next human review due ${result.schedule.due}`);
}
