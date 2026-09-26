/*
 * `npm run bias-audit` — C.20: THE DIALECT / ACCENT / ASR-ARTIFACT BIAS AUDIT
 * of every lexical component that feeds the Behavioral Telemetry Layer (C.9),
 * the check-in and stop-offer replies, and content moderation.
 *
 * A thin CLI over `src/safety/biasAudit/` (which has its own vitest suite,
 * `src/__tests__/biasAudit.test.ts`). Fixture-based and free: no network, no
 * model, no voice provider. Policy: docs/rebuild/mentor/BIAS-AUDIT-POLICY.md.
 *
 *   (no flag)       run the audit and print the report; exit 1 on any failure
 *   --json          the same report as JSON
 *   --check         also fail when a component changed since the last recorded
 *                   audit or the last audit is older than the cadence (the
 *                   scheduled `mentor-bias-audit.yml` runs this)
 *   --record [--trigger initial|cadence|material_change] [--notes "..."]
 *                   run and, ONLY if it passes, append an entry to
 *                   `src/safety/biasAudit/audit-log.json` (commit it)
 *   --judge-plan    print what the live model-judge audit would send, and how
 *                   many calls it would make; sends nothing
 *   --judge-live    OWNER-RUN ONLY (a paid model call per variant; OD-23
 *                   forbids spend without approval). Refuses unless
 *                   BIAS_AUDIT_JUDGE_LIVE=approved is set and a model key is
 *                   configured. Requires every dialect variant of a Mentor
 *                   line to be judged exactly like the standard line.
 */

import process from 'node:process';
import { runBiasAudit, type BiasAuditReport } from '../src/safety/biasAudit/audit.js';
import {
  appendEntry,
  CADENCE_DAYS,
  checkProblems,
  coverage,
  daysSinceAudit,
  entryFor,
  latestEntry,
  readAuditLog,
  type AuditLogEntry,
} from '../src/safety/biasAudit/auditLog.js';
import { JUDGE_ITEMS, VARIANT_GROUPS } from '../src/safety/biasAudit/fixtures.js';

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function printHuman(report: BiasAuditReport): void {
  console.log('== C.20 bias audit: dialect, code-switch, child-spelling and ASR variants ==');
  console.log('');
  for (const component of report.components) {
    if (component.mode === 'live_only') {
      console.log(`  live  ${component.id} (${component.kind}) — model judge, run with --judge-plan / --judge-live`);
      continue;
    }
    const status = component.failures.length === 0 ? 'ok  ' : 'FAIL';
    console.log(`  ${status}  ${component.id} (${component.items} items, ${component.variants} variants, hash ${component.sourceHash})`);
    for (const [locale, groups] of Object.entries(component.byLocaleGroup)) {
      const cells = Object.entries(groups)
        .map(([group, s]) => `${group} ${s.agree}/${s.n}${s.falsePositive ? ` FP${s.falsePositive}` : ''}${s.falseNegative ? ` FN${s.falseNegative}` : ''}`)
        .join('  ');
      console.log(`        ${locale}: ${cells}`);
    }
    for (const f of component.failures) {
      console.log(`        ↳ ${f.kind.toUpperCase()} ${f.item} [${f.group}] "${f.text}": expected ${f.expected}, got ${f.got}`);
    }
    for (const g of component.knownGaps) console.log(`        ↳ KNOWN GAP ${g.item} [${g.group}]: ${g.reason}`);
  }
  console.log('');
  console.log('  Fused parity (the same behaviour in each dialect → the same check-ins):');
  for (const session of report.sessions) {
    const cells = Object.entries(session.checkIns)
      .map(([group, turns]) => `${group} [${turns!.join(',')}]`)
      .join('  ');
    console.log(`  ${session.ok ? 'ok  ' : 'FAIL'}  ${session.id}: ${cells}`);
  }
  console.log('');
  const t = report.totals;
  console.log(
    `bias-audit ${report.ok ? 'OK' : 'FAILED'} — ${t.fixtureComponents}/${t.components} components run on fixtures, ${t.items} items, ${t.variants} variants, ${t.failures} failure(s), ${t.knownGaps} known gap(s).`,
  );
}

async function judgeLive(): Promise<number> {
  if (process.env.BIAS_AUDIT_JUDGE_LIVE !== 'approved') {
    console.error('Refusing: --judge-live makes one paid model call per variant (OD-23).');
    console.error('The owner approves the spend and runs it with BIAS_AUDIT_JUDGE_LIVE=approved.');
    return 2;
  }
  const { moderateTutorOutput } = await import('../src/safety/moderation.js');
  let failures = 0;
  for (const item of JUDGE_ITEMS) {
    const standard = await moderateTutorOutput({ text: item.variants.standard, locale: item.locale, tier: 2, requireModelPass: true });
    for (const group of VARIANT_GROUPS) {
      const text = item.variants[group];
      if (text === undefined) continue;
      const verdict = group === 'standard' ? standard : await moderateTutorOutput({ text, locale: item.locale, tier: 2, requireModelPass: true });
      const label = verdict.allowed ? 'allowed' : verdict.reason;
      const ok = label === item.expected && label === (standard.allowed ? 'allowed' : standard.reason);
      if (!ok) failures += 1;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${item.id} [${group}] → ${label}`);
    }
  }
  console.log(`judge-live ${failures === 0 ? 'OK' : 'FAILED'} — ${failures} variant(s) judged differently from the expected label.`);
  return failures === 0 ? 0 : 1;
}

function judgePlan(): void {
  const calls = JUDGE_ITEMS.reduce((n, item) => n + Object.keys(item.variants).length, 0);
  console.log('== C.20 live judge audit plan (nothing is sent) ==');
  for (const item of JUDGE_ITEMS) console.log(`  ${item.id}: ${Object.keys(item.variants).length} variants, expected ${item.expected}`);
  console.log(`${JUDGE_ITEMS.length} items, ${calls} judge calls (plus retries on a thrown call). Owner-run: BIAS_AUDIT_JUDGE_LIVE=approved npm run bias-audit -- --judge-live`);
}

async function main(): Promise<number> {
  if (process.argv.includes('--judge-plan')) {
    judgePlan();
    return 0;
  }
  if (process.argv.includes('--judge-live')) return judgeLive();

  const report = runBiasAudit();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);

  const entries = readAuditLog();
  const latest: AuditLogEntry | null = latestEntry(entries);
  const now = new Date();
  if (!process.argv.includes('--json')) {
    console.log(
      `Bias-Audit Coverage ${(coverage(latest) * 100).toFixed(0)}% (the live-only judge counts as not covered until its live run); last recorded audit ${
        latest === null ? 'never' : `${latest.date}, ${daysSinceAudit(latest, now)} day(s) ago`
      } (cadence ${CADENCE_DAYS} days).`,
    );
  }

  if (process.argv.includes('--record')) {
    if (!report.ok) {
      console.error('Not recorded: only a passing audit is recorded.');
      return 1;
    }
    const trigger = (argValue('--trigger') ?? 'material_change') as AuditLogEntry['trigger'];
    const entry = entryFor(report, now.toISOString().slice(0, 10), trigger, argValue('--notes') ?? '');
    appendEntry(entry);
    console.log(`Recorded the ${entry.date} audit (${trigger}). Commit src/safety/biasAudit/audit-log.json.`);
    return 0;
  }

  if (process.argv.includes('--check')) {
    const problems = checkProblems(report, entries, now);
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    return problems.length === 0 ? 0 : 1;
  }
  return report.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
