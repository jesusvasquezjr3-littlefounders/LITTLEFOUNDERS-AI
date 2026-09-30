#!/usr/bin/env node
// staff-ops-review-cadence.mjs: Appendix N Part 3 Stage 6 and Appendix O
// Part 3 Stage 6 (Post-Launch Recalibration) for Blocks G and H, as a gate and
// a calendar trigger (gap-fix round 7, staff-ops).
//
// Both blocks' thresholds live in docs/operations/STAFF-OPS-RECALIBRATION-LOG.md:
// Block G is reviewed quarterly by the Platform Lead, Block H by the
// Data/Privacy Lead, "consistent with Appendices H, J, L and M". The owner
// decision log (section 8) sends the G.2 30-day window and the G.4 quarterly
// cadence through this log. Same machinery as Block A
// (identity-review-cadence.mjs): a `Kind` column where only `human` rows
// count, a machine-readable "First human review due: YYYY-MM-DD", 90 days
// after the latest human review, here per block (the `Block` column).
//
//   node agent/tools/staff-ops-review-cadence.mjs [--strict]
//     The gate. Fails when the log is unreadable or drifts from the code:
//       - the threshold table must hold exactly the Appendix N and O Part 1
//         metrics in METRICS (same block, part, requirement and kind), each
//         citing its source, and each source must still exist in the code;
//       - every calibration value must equal what Core, dataintel and the
//         latest migration enforce (CALIBRATIONS);
//       - the Stage 6 rollback rule must name its five release gates.
//     An overdue review warns, and fails under --strict (release readiness).
//     npm run spec:check runs it without --strict.
//
//   node agent/tools/staff-ops-review-cadence.mjs --issue-file issue.md \
//     --title-file title.txt [--now <ISO>] [--root <repo>]
//     The quarterly issue (.github/workflows/staff-ops-recalibration-quarterly.yml):
//     both owners, each block's last human review and next due date, every
//     release-gate metric, the calibration values, the rollback rule and the
//     simulated job-failure drill (Appendix O 1.3, "quarterly otherwise").
//     Exit 1 when the log is unreadable (the issue is still written).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, QUARTER_DAYS, readFirstDue, readReviewTable, reportCadence } from './block-d-review-cadence.mjs';
import { quarterLabel } from './identity-review-cadence.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LOG_DOC = 'docs/operations/STAFF-OPS-RECALIBRATION-LOG.md';
export const ISSUE_LABEL = 'staff-ops-review';
export const DRILL_COMMAND = 'npm --prefix backend run ops:drill';
const MIGRATIONS = 'database/migrations';

export const REVIEWS = {
  G: { block: 'G', title: 'Block G Staff Console Recalibration', spec: 'Appendix N Part 3 Stage 6', owner: 'Platform Lead' },
  H: { block: 'H', title: 'Block H Analytics and Operations Recalibration', spec: 'Appendix O Part 3 Stage 6', owner: 'Data/Privacy Lead' },
};
const BLOCK_VALUES = { G: ['G'], H: ['H'], 'G+H': ['G', 'H'] };
const KINDS = ['engineering', 'human'];
const METRIC_KINDS = ['release gate', 'diagnostic', 'documentation'];

// Source files the anchors read.
const F = {
  auth: 'backend/src/middleware/auth.ts',
  adminTest: 'backend/src/__tests__/admin.test.ts',
  adminPg: 'database/scripts/verify-admin-permissions-postgres.py',
  pkg: 'package.json',
  backendPkg: 'backend/package.json',
  staffGate: 'database/scripts/staff-analytics-db-verify.mjs',
  adminData: 'backend/src/services/adminData.ts',
  opsWatch: 'agent/tools/ops-job-watch.mjs',
  opsWatchYml: '.github/workflows/ops-job-watch.yml',
  contentRelease: 'backend/src/services/contentRelease.ts',
  contentPg: 'database/scripts/verify-content-release-postgres.py',
  staffOpsPg: 'database/scripts/verify-staff-ops-postgres.py',
  staffGrants: 'frontend/src/app-routes/staffGrants.ts',
  navTest: 'frontend/src/app-shell/__tests__/navigation.test.ts',
  standing: 'agent/tools/check-staff-standing-constraints.mjs',
  standingTest: 'backend/src/__tests__/staffStandingConstraints.test.ts',
  disclosure: 'backend/src/services/disclosureCoverage.ts',
  analyticsPg: 'database/scripts/verify-analytics-postgres.py',
  governance: 'docs/operations/GOVERNANCE.md',
  warehouseRetentionTest: 'dataintel/src/__tests__/warehouse-retention.test.ts',
  backupTest: 'agent/tools/backup-workflows.test.mjs',
  dataintelRoutes: 'dataintel/src/routes/queries.ts',
  alerts: 'dataintel/src/services/alerts.ts',
  exports: 'dataintel/src/services/exports.ts',
  tasksPage: 'frontend/src/routes/app/tasks/TasksPage.tsx',
  tutorPage: 'frontend/src/routes/app/TutorPage.tsx',
  opsJobs: 'backend/src/services/opsJobs.ts',
  drill: 'backend/src/scripts/opsJobDrill.ts',
  experiments: 'dataintel/src/services/experiments.ts',
  eligibilityTest: 'dataintel/src/__tests__/experiment-age-eligibility.test.ts',
  warehouseAlerts: 'backend/src/services/warehouseAlerts.ts',
  tutorData: 'backend/src/services/tutorData.ts',
};

/**
 * Every Appendix N and O Part 1 metric. `cite` must appear in the row's
 * Source cell. Each `proof` is [file, text or RegExp] that must hold in the
 * code (a file of MIGRATIONS means any migration); each `absent` is
 * [file, RegExp] that must not.
 */
export const METRICS = [
  // Appendix N (Block G).
  { id: 'permission_endpoint_enforcement_coverage', block: 'G', part: '1.1', requirement: 'G.1', kind: 'release gate', cite: 'requireAdminPermission',
    proof: [[F.auth, 'export function requireAdminPermission('], [F.adminTest, "describe('independent staff grant matrix'"], [F.adminPg, 'G.1']] },
  { id: 'cosmetic_permission_regression', block: 'G', part: '1.1', requirement: 'G.1', kind: 'release gate', cite: 'staff:db-verify',
    proof: [[F.adminTest, 'honors a Content grant revocation on the next request'], [F.pkg, '"staff:db-verify":'], [F.staffGate, "'verify-admin-permissions-postgres.py'"]] },
  { id: 'privilege_differentiation_rate', block: 'G', part: '1.1', requirement: 'G.1', kind: 'release gate', cite: 'admin.test.ts',
    proof: [[F.adminTest, 'makes each of the four grants admit only its own named API family']] },
  { id: 'access_review_cadence_compliance', block: 'G', part: '1.1', requirement: 'G.4', kind: 'release gate', cite: 'staff_access_review_status',
    proof: [[MIGRATIONS, 'FUNCTION public.staff_access_review_status('], [F.adminData, '/rpc/staff_access_review_status']] },
  { id: 'stale_grant_rate', block: 'G', part: '1.1', requirement: 'G.4', kind: 'diagnostic', cite: 'staff_access_review_status',
    proof: [[MIGRATIONS, 'FUNCTION public.staff_access_review_status('], [F.opsWatch, 'accessReviews']] },
  { id: 'release_verification_bypass_rate', block: 'G', part: '1.2', requirement: 'G.2', kind: 'release gate', cite: 'content_bypass_metrics',
    proof: [[MIGRATIONS, 'FUNCTION public.content_bypass_metrics('], [F.contentRelease, '/rpc/content_bypass_metrics']] },
  { id: 'bypass_retro_check_completeness', block: 'G', part: '1.2', requirement: 'G.2', kind: 'release gate', cite: 'content_bypass_metrics',
    proof: [[MIGRATIONS, 'TABLE public.content_retro_checks'], [F.contentPg, 'content_retro_checks']] },
  { id: 'live_activity_audit_completeness', block: 'G', part: '1.2', requirement: 'G.3', kind: 'release gate', cite: 'verify-staff-ops-postgres.py',
    proof: [[F.staffOpsPg, '── G.3'], [F.staffGate, "'verify-staff-ops-postgres.py'"]] },
  { id: 'staff_screen_navigation_parity', block: 'G', part: '1.3', requirement: 'G.5', kind: 'release gate', cite: 'STAFF_ROUTE_GRANTS',
    proof: [[F.staffGrants, 'export const STAFF_ROUTE_GRANTS'], [F.navTest, 'shows exactly the pages the route guards admit']] },
  { id: 'standing_constraint_integrity', block: 'G', part: '1.3', requirement: 'G.6', kind: 'release gate', cite: 'check-staff-standing-constraints.mjs',
    proof: [[F.pkg, 'node agent/tools/check-staff-standing-constraints.mjs'], [F.standing, 'G.6'], [F.standingTest, 'G.6']] },
  // Appendix O (Block H).
  { id: 'teen_guest_disclosure_coverage', block: 'H', part: '1.1', requirement: 'H.1', kind: 'release gate', cite: 'disclosureCoverage.ts',
    proof: [[F.disclosure, 'export function buildDisclosureCoverage('], [F.disclosure, 'coverage: number | null']] },
  { id: 'consent_gate_population_gap_rate', block: 'H', part: '1.1', requirement: 'H.1', kind: 'release gate', cite: 'disclosureCoverage.ts',
    proof: [[F.disclosure, 'Consent-Gate Population Gap Rate'], [F.disclosure, /gap: \{ measured: number; rate: number \| null; target: 0;/]] },
  { id: 'kid_role_consent_gate_regression', block: 'H', part: '1.1', requirement: 'H.6', kind: 'release gate', cite: 'verify-analytics-postgres.py',
    proof: [[F.analyticsPg, 'the kid-role consent gate'], [F.staffGate, "'verify-analytics-postgres.py'"]] },
  { id: 'retention_window_reconciliation', block: 'H', part: '1.2', requirement: 'H.2', kind: 'documentation', cite: 'GOVERNANCE.md',
    proof: [[F.governance, '## 3. Analytics retention policy (H.2)'], [F.warehouseRetentionTest, 'prune_learning_events']] },
  { id: 'backup_encryption_confirmation', block: 'H', part: '1.2', requirement: 'H.5', kind: 'documentation', cite: 'backup-workflows.test.mjs',
    proof: [[F.backupTest, 'H.5'], [F.governance, '**Backup encryption.**']] },
  { id: 'incident_response_plan_currency', block: 'H', part: '1.2', requirement: 'H.5', kind: 'documentation', cite: 'check-staff-standing-constraints.mjs',
    proof: [[F.standing, 'incident-response plan'], [F.governance, 'Last reviewed:']] },
  { id: 'instrumentation_consumer_coverage', block: 'H', part: '1.3', requirement: 'H.3', kind: 'release gate', cite: 'ALERT_CHANNEL_UNCONFIGURED',
    proof: [[F.dataintelRoutes, "'ALERT_CHANNEL_UNCONFIGURED'"]] },
  { id: 'alert_notification_delivery_rate', block: 'H', part: '1.3', requirement: 'H.3', kind: 'release gate', cite: 'alertDeliveryRate',
    proof: [[F.alerts, 'export async function alertDeliveryRate('], [F.opsWatch, 'alerts.undelivered']] },
  { id: 'export_job_terminal_state', block: 'H', part: '1.3', requirement: 'H.3', kind: 'documentation', cite: 'exports.ts',
    proof: [[F.exports, 'export-JOB machinery']], absent: [[F.dataintelRoutes, /export_jobs|exports?\/jobs/]] },
  { id: 'missing_emitter_closure', block: 'H', part: '1.3', requirement: 'H.3', kind: 'release gate', cite: "trackInsight('task_view'",
    proof: [[F.tasksPage, "trackInsight('task_view'"], [F.tutorPage, "trackInsight('tutor_open'"]] },
  { id: 'watchdog_notification_coverage', block: 'H', part: '1.3', requirement: 'H.4', kind: 'release gate', cite: 'OPS_JOBS',
    proof: [[F.opsJobs, 'export const OPS_JOBS'], [F.opsWatch, 'export const WATCHED_JOBS'], [F.opsWatchYml, 'ops-watchdog']] },
  { id: 'simulated_job_failure_drill', block: 'H', part: '1.3', requirement: 'H.4', kind: 'release gate', cite: 'ops:drill',
    proof: [[F.backendPkg, '"ops:drill":'], [F.drill, 'SIMULATED JOB-FAILURE DRILL']] },
  { id: 'reference_standard_documentation', block: 'H', part: '1.4', requirement: 'H.6', kind: 'documentation', cite: 'GOVERNANCE.md',
    proof: [[F.governance, 'reference implementation for']] },
  { id: 'experiment_eligibility_policy', block: 'H', part: '1.4', requirement: 'H.7', kind: 'release gate', cite: 'POLICY_MIN_AGE',
    proof: [[F.experiments, 'export const POLICY_MIN_AGE'], [F.governance, '## 6. Experimentation eligibility (H.7)'], [F.eligibilityTest, 'POLICY_MIN_AGE']] },
];

/** The Stage 6 rollback metrics (Appendix N: two; Appendix O: three). */
export const ROLLBACK = [
  'cosmetic_permission_regression',
  'release_verification_bypass_rate',
  'kid_role_consent_gate_regression',
  'alert_notification_delivery_rate',
  'watchdog_notification_coverage',
];

const constant = (name) => new RegExp(`export const ${name}(?:: [^=]+)? = (\\d+);`);

/**
 * Every calibration value, read from every place that enforces it. `read`
 * gets a file reader and returns [{ where, value }] (value null when the
 * source could not be read).
 */
export const CALIBRATIONS = [
  { key: 'g2.retro_check_days', read: (src) => [
    { where: `${F.contentRelease} RETRO_CHECK_DAYS`, value: src.match(F.contentRelease, constant('RETRO_CHECK_DAYS')) },
    { where: 'content_retro_check_days() (latest migration)', value: src.latestMigration(/FUNCTION public\.content_retro_check_days\(\)[^$]*\$\$\s*SELECT (\d+)\s*\$\$/) },
  ] },
  { key: 'g4.access_review_cadence_days', read: (src) => [
    { where: `${F.adminData} ACCESS_REVIEW_CADENCE_DAYS`, value: src.match(F.adminData, constant('ACCESS_REVIEW_CADENCE_DAYS')) },
    { where: 'staff_access_review_status default (latest migration)', value: src.latestMigration(/FUNCTION public\.staff_access_review_status\(p_cadence_days integer DEFAULT (\d+)\)/) },
  ] },
  { key: 'h3.alert_undelivered_window_hours', read: (src) => [
    { where: `${F.warehouseAlerts} ALERT_UNDELIVERED_WINDOW_HOURS`, value: src.match(F.warehouseAlerts, constant('ALERT_UNDELIVERED_WINDOW_HOURS')) },
  ] },
  { key: 'h4.ops_job_stale_hours', read: (src) => {
    const block = src.match(F.opsJobs, /export const OPS_JOB_STALE_HOURS: Record<OpsJob, number> = \{([\s\S]*?)\};/);
    const entries = block === null ? [] : [...block.matchAll(/([a-z_]+): (\d+),?/g)];
    return [
      ...(entries.length === 0
        ? [{ where: `${F.opsJobs} OPS_JOB_STALE_HOURS`, value: null }]
        : entries.map((m) => ({ where: `${F.opsJobs} OPS_JOB_STALE_HOURS.${m[1]}`, value: m[2] }))),
      { where: `${F.tutorData} RETENTION_STALE_HOURS`, value: src.match(F.tutorData, constant('RETENTION_STALE_HOURS')) },
    ];
  } },
  { key: 'h4.deletion_step_failure_hours', read: (src) => [
    { where: `${F.opsJobs} DELETION_STEP_FAILURE_HOURS`, value: src.match(F.opsJobs, constant('DELETION_STEP_FAILURE_HOURS')) },
  ] },
  { key: 'h7.policy_min_age', read: (src) => {
    const block = src.match(F.experiments, /export const POLICY_MIN_AGE: Record<ExperimentEligibilityPolicy, number> = \{([^}]*)\};/);
    const entries = block === null ? [] : [...block.matchAll(/([a-z0-9_]+): (\d+)/g)];
    return [{ where: `${F.experiments} POLICY_MIN_AGE`, value: entries.length ? entries.map((m) => `${m[1]} ${m[2]}`).join(', ') : null }];
  } },
];

/** Every file the gate reads besides the log and the migrations (for a scratch copy of the repo). */
export function sourceFiles() {
  const files = new Set(Object.values(F));
  for (const m of METRICS) for (const [file] of [...m.proof, ...(m.absent ?? [])]) if (file !== MIGRATIONS) files.add(file);
  return [...files].sort();
}

/**
 * A reader over a repo root (or an in-memory map, for tests). `match` returns
 * the first capture of `re` in `file` (null when the file or the match is
 * missing); `latestMigration` does the same on the highest-numbered migration
 * that matches, so a later redefinition wins. `overlay` (tests) replaces
 * files ({ files: { path: text | null } }) and appends migrations
 * ({ migrations: [text] }).
 */
export function repoReader(root, overlay = {}) {
  const cache = new Map(Object.entries(overlay.files ?? {}));
  const read = (file) => {
    if (!cache.has(file)) {
      const path = join(root, file);
      cache.set(file, existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null);
    }
    return cache.get(file);
  };
  let migrations = null;
  const migrationTexts = () => {
    if (migrations === null) {
      const dir = join(root, MIGRATIONS);
      migrations = existsSync(dir)
        ? readdirSync(dir).filter((name) => name.endsWith('.sql')).sort().map((name) => read(`${MIGRATIONS}/${name}`) ?? '')
        : [];
      migrations.push(...(overlay.migrations ?? []));
    }
    return migrations;
  };
  return {
    read,
    match(file, re) { const text = read(file); const m = text === null ? null : re.exec(text); return m ? m[1] : null; },
    latestMigration(re) {
      const texts = migrationTexts();
      for (let i = texts.length - 1; i >= 0; i--) { const m = re.exec(texts[i]); if (m) return m[1]; }
      return null;
    },
    anyMigration(needle) { return migrationTexts().some((text) => (needle instanceof RegExp ? needle.test(text) : text.includes(needle))); },
  };
}

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(Date.parse(`${value}T00:00:00Z`)).toISOString().slice(0, 10) === value;
const holds = (text, needle) => (needle instanceof RegExp ? needle.test(text) : text.includes(needle));
const show = (needle) => (needle instanceof RegExp ? String(needle) : `"${needle}"`);

/** The log's threshold rows. */
export function readThresholds(markdown) {
  const table = readReviewTable(markdown ?? '', 'Thresholds');
  if (!table) return null;
  return table.rows.map((row) => ({
    id: /^`([a-z0-9_]+)`$/.exec(row.metric ?? '')?.[1] ?? null,
    raw: row.metric ?? '',
    block: row.block ?? '',
    part: row.part ?? '',
    requirement: row.requirement ?? '',
    kind: row.kind ?? '',
    target: row.target ?? '',
    source: row.source ?? '',
  }));
}

/** The log's calibration rows: key to value. */
export function readCalibrations(markdown) {
  const table = readReviewTable(markdown ?? '', 'Calibration values');
  if (!table) return null;
  return table.rows.map((row) => ({ key: /^`([a-z0-9_.]+)`$/.exec(row.key ?? '')?.[1] ?? null, raw: row.key ?? '', value: (row.value ?? '').trim() }));
}

/** The text of the `## <heading>` section, or null. */
function section(markdown, heading) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

/** Drift between the log and the code. */
export function checkDrift(markdown, src) {
  const failures = [];
  const doc = LOG_DOC;
  const rows = readThresholds(markdown);
  if (!rows) failures.push(`${doc}: no "## Thresholds" table`);
  else {
    const seen = new Map();
    for (const row of rows) {
      if (!row.id) { failures.push(`${doc}: a threshold row has no backticked metric id ("${row.raw}")`); continue; }
      if (seen.has(row.id)) failures.push(`${doc}: ${row.id} is listed twice`);
      seen.set(row.id, row);
      if (!row.target.trim()) failures.push(`${doc}: ${row.id} has no target`);
      if (!METRIC_KINDS.includes(row.kind)) failures.push(`${doc}: ${row.id} has kind "${row.kind}", not one of ${METRIC_KINDS.join(', ')}`);
    }
    for (const metric of METRICS) {
      const row = seen.get(metric.id);
      const appendix = metric.block === 'G' ? 'Appendix N' : 'Appendix O';
      if (!row) { failures.push(`${doc}: ${appendix} ${metric.part} metric ${metric.id} (${metric.requirement}) has no row`); continue; }
      if (row.block !== metric.block) failures.push(`${doc}: ${metric.id} is Block "${row.block}" in the log but Block ${metric.block} (${appendix})`);
      if (row.part !== metric.part) failures.push(`${doc}: ${metric.id} is Part "${row.part}" in the log but ${appendix} ${metric.part}`);
      if (row.requirement !== metric.requirement) failures.push(`${doc}: ${metric.id} verifies "${row.requirement}" in the log but ${metric.requirement}`);
      if (row.kind !== metric.kind) failures.push(`${doc}: ${metric.id} is "${row.kind}" in the log but "${metric.kind}"`);
      if (!row.source.includes(metric.cite)) failures.push(`${doc}: ${metric.id}'s Source no longer cites ${metric.cite}`);
    }
    const known = new Set(METRICS.map((m) => m.id));
    for (const id of seen.keys()) if (!known.has(id)) failures.push(`${doc}: ${id} is not an Appendix N or O Part 1 metric this gate knows (remove it, or add it to METRICS with its source)`);
  }

  for (const metric of METRICS) {
    for (const [file, needle] of metric.proof) {
      if (file === MIGRATIONS) {
        if (!src.anyMigration(needle)) failures.push(`${metric.id}: no migration contains ${show(needle)} (its source is gone)`);
        continue;
      }
      const text = src.read(file);
      if (text === null) failures.push(`${metric.id}: ${file} is missing (its source is gone)`);
      else if (!holds(text, needle)) failures.push(`${metric.id}: ${file} no longer contains ${show(needle)}`);
    }
    for (const [file, needle] of metric.absent ?? []) {
      const text = src.read(file);
      if (text !== null && holds(text, needle)) failures.push(`${metric.id}: ${file} matches ${show(needle)}; a retired mechanism is back`);
    }
  }

  const values = readCalibrations(markdown);
  if (!values) failures.push(`${doc}: no "## Calibration values" table`);
  else {
    const logged = new Map();
    for (const row of values) {
      if (!row.key) { failures.push(`${doc}: a calibration row has no backticked key ("${row.raw}")`); continue; }
      if (logged.has(row.key)) failures.push(`${doc}: calibration ${row.key} is listed twice`);
      logged.set(row.key, row.value);
    }
    for (const calibration of CALIBRATIONS) {
      if (!logged.has(calibration.key)) { failures.push(`${doc}: calibration ${calibration.key} has no row`); continue; }
      const value = logged.get(calibration.key);
      for (const actual of calibration.read(src)) {
        if (actual.value === null) failures.push(`${calibration.key}: ${actual.where} could not be read`);
        else if (actual.value !== value) failures.push(`${calibration.key}: the log says ${value} but ${actual.where} is ${actual.value} (recalibrate the log, the code and the database together)`);
      }
    }
    const known = new Set(CALIBRATIONS.map((c) => c.key));
    for (const key of logged.keys()) if (!known.has(key)) failures.push(`${doc}: calibration ${key} is not read from any code (remove it, or add it to CALIBRATIONS)`);
  }

  const rollback = section(markdown, 'Stage 6 rollback rule');
  if (rollback === null) failures.push(`${doc}: no "## Stage 6 rollback rule" section`);
  else {
    if (!/immediate rollback/i.test(rollback)) failures.push(`${doc}: the Stage 6 rollback rule no longer says "immediate rollback"`);
    for (const id of ROLLBACK) {
      if (!rollback.includes(`\`${id}\``)) failures.push(`${doc}: the Stage 6 rollback rule does not name \`${id}\``);
      const row = rows?.find((r) => r.id === id);
      if (row && row.kind !== 'release gate') failures.push(`${doc}: ${id} triggers a rollback, so it must stay a release gate`);
    }
  }
  return failures;
}

/**
 * Each block's schedule from the review history: parse failures, the last
 * human review covering the block, and the next due date.
 */
export function reviewSchedules(markdown) {
  const failures = [];
  const empty = { G: { lastHuman: null, due: null }, H: { lastHuman: null, due: null } };
  if (markdown === null || markdown === undefined) return { failures: [`${LOG_DOC} is missing`], blocks: empty };
  const firstDue = readFirstDue(markdown);
  if (!firstDue) failures.push(`${LOG_DOC}: no machine-readable "First human review due: YYYY-MM-DD" line`);
  const table = readReviewTable(markdown, 'Review history');
  if (!table) return { failures: [...failures, `${LOG_DOC}: no "## Review history" table`], blocks: empty };
  for (const column of ['date', 'kind', 'block']) {
    if (!table.columns.includes(column)) failures.push(`${LOG_DOC}: the review history needs a ${column[0].toUpperCase()}${column.slice(1)} column`);
  }
  const human = { G: [], H: [] };
  for (const row of table.rows) {
    const date = row.date ?? '';
    if (!validDate(date)) { failures.push(`${LOG_DOC}: a review history row has no valid date ("${date}")`); continue; }
    if (!KINDS.includes(row.kind)) { failures.push(`${LOG_DOC}: the ${date} row's kind is "${row.kind}", not one of ${KINDS.join(' or ')}`); continue; }
    const blocks = BLOCK_VALUES[row.block];
    if (!blocks) { failures.push(`${LOG_DOC}: the ${date} row's block is "${row.block}", not one of ${Object.keys(BLOCK_VALUES).join(', ')}`); continue; }
    if (row.kind === 'human') for (const b of blocks) human[b].push(date);
  }
  const blocks = {};
  for (const b of ['G', 'H']) {
    const lastHuman = human[b].sort().at(-1) ?? null;
    blocks[b] = { lastHuman, due: failures.length ? null : lastHuman ? addDays(lastHuman, QUARTER_DAYS) : firstDue };
  }
  return { failures, blocks };
}

/** The gate: drift and parse failures always fail; an overdue review warns, and fails under `strict`. */
export function checkStaffOpsReview({ markdown, src, today, strict = false }) {
  const schedule = reviewSchedules(markdown);
  const failures = [...schedule.failures];
  const warnings = [];
  for (const b of ['G', 'H']) {
    const { due, lastHuman } = schedule.blocks[b];
    const review = REVIEWS[b];
    if (due && today > due) {
      (strict ? failures : warnings).push(`the ${review.title} (${review.spec}, ${review.owner}) was due ${due} and no human review of Block ${b} is recorded in ${LOG_DOC} since ${lastHuman ?? 'the start'}`);
    }
  }
  if (markdown !== null && markdown !== undefined) failures.push(...checkDrift(markdown, src));
  return { failures, warnings, schedule };
}

export const issueTitle = (now) => `Quarterly staff and operations recalibration (Blocks G and H): ${quarterLabel(now)}`;

/** The quarterly issue body, for both owners. */
export function buildIssue({ markdown, now, runUrl = '' }) {
  const today = new Date(now).toISOString().slice(0, 10);
  const schedule = reviewSchedules(markdown);
  const rows = readThresholds(markdown) ?? [];
  const values = readCalibrations(markdown) ?? [];
  const lines = [
    `The ${quarterLabel(now)} Post-Launch Recalibration of Blocks G and H (Appendix N and Appendix O, Part 3 Stage 6). Each block is a human review by its own owner; an engineering row never counts as one.`,
    '',
    `Log: \`${LOG_DOC}\`.`,
  ];
  if (schedule.failures.length) {
    lines.push('', `The log could not be read: ${schedule.failures.join('; ')}. Both reviews are still due; fix the log when recording them.`);
  }
  for (const b of ['G', 'H']) {
    const review = REVIEWS[b];
    const { lastHuman, due } = schedule.blocks[b];
    lines.push('', `### Block ${b}: ${review.owner} (${review.spec})`, '');
    if (due) lines.push(`- Last human review: ${lastHuman ?? 'none recorded yet'}.`, `- Next due: **${due}** (${today > due ? 'overdue' : 'due'}).`);
    lines.push('- Release-gate metrics:');
    for (const row of rows.filter((r) => r.block === b && r.kind === 'release gate')) lines.push(`  - [ ] \`${row.id}\` (${row.requirement}): target ${row.target}`);
    const other = rows.filter((r) => r.block === b && r.kind !== 'release gate');
    if (other.length) lines.push(`- Also review: ${other.map((r) => `\`${r.id}\` (${r.kind})`).join(', ')}.`);
  }
  lines.push(
    '',
    '### Simulated job-failure drill (Appendix O 1.3, quarterly otherwise)',
    '',
    `- [ ] Run \`${DRILL_COMMAND}\` (every target) and record its result in the Block H history row. A drill against the deployed Core is the ops owner's; the local drill never contacts production.`,
    '',
    '### Calibration values',
    '',
    ...values.map((v) => `- \`${v.key}\`: ${v.value}`),
    '',
    'A value moves only on real production data, with the owner decision recorded, and in one change with the code and the database (`staff-ops-review-cadence.mjs` fails on any disagreement).',
    '',
    '### Stage 6 rollback rule',
    '',
    `A regression in ${ROLLBACK.map((id) => `\`${id}\``).join(', ')} triggers an immediate rollback, never a patch under pressure, and never a relaxed target.`,
    '',
    'Release readiness fails while either review is overdue (`staff-ops-review-cadence.mjs --strict`). Close this issue when a `human` row is recorded for each block (one `G+H` row when both leads review together).',
  );
  if (runUrl) lines.push('', `Run: ${runUrl}`);
  return lines.join('\n');
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = arg('--root') ?? ROOT;
  const now = new Date(arg('--now') ?? Date.now());
  if (Number.isNaN(now.getTime())) {
    console.error('staff-ops-review-cadence: --now is not a date');
    process.exit(1);
  }
  const src = repoReader(root);
  const markdown = src.read(LOG_DOC);
  const issueFile = arg('--issue-file');
  const titleFile = arg('--title-file');
  if (issueFile || titleFile) {
    if (!issueFile || !titleFile) {
      console.error('Usage: staff-ops-review-cadence.mjs --issue-file <path> --title-file <path> [--now <ISO>] [--root <repo>]');
      process.exit(1);
    }
    writeFileSync(issueFile, buildIssue({ markdown, now, runUrl: process.env.RUN_URL ?? '' }));
    writeFileSync(titleFile, issueTitle(now));
    const schedule = reviewSchedules(markdown);
    console.log(schedule.failures.length ? `unreadable: ${schedule.failures.join('; ')}` : `Block G due ${schedule.blocks.G.due}; Block H due ${schedule.blocks.H.due}`);
    process.exit(schedule.failures.length === 0 ? 0 : 1);
  }
  const result = checkStaffOpsReview({ markdown, src, today: now.toISOString().slice(0, 10), strict: process.argv.includes('--strict') });
  if (reportCadence(result)) process.exit(1);
  const { G, H } = result.schedule.blocks;
  console.log(`staff-ops-review-cadence OK: ${METRICS.length} Block G/H metrics and ${CALIBRATIONS.length} calibration values match the code; Block G review due ${G.due}, Block H review due ${H.due}`);
}
