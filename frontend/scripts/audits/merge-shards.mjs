import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOCALES, STATES, THEMES, WIDTHS } from './states.mjs';

/*
 * Merges the reports of a split rebuild-audit run (AUDIT_SHARD=k/n, one CI job
 * per shard) into one report per audit, and refuses a split run that did not
 * measure the whole gate (Frontend Bible 02 §7 item 10, 03 §5, 06 §7).
 *
 *   node scripts/audits/merge-shards.mjs <reports-dir> [--out <dir>]
 *
 * <reports-dir> is searched recursively for text-fit.json, proportion.json and
 * copy-budget.json (one folder per downloaded shard artifact). The merged
 * reports go to --out (default ../audit-results/rebuild-audits/merged).
 *
 * It fails (exit 2) unless, for every audit: shards 1..n are each present
 * exactly once; no report was narrowed by AUDIT_STATES or by a trimmed locale,
 * theme or width list; and the shards' states together are every state in
 * audits/states.mjs, each measured once. It also repeats the driver's
 * identical-markup check across shards (two states that render the same page
 * mean the driver is not reaching one of them), which a single shard cannot
 * see. Findings or JS errors in the merged reports exit 1; clean exits 0.
 */
export const AUDITS = ['text-fit', 'proportion', 'copy-budget'];

const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((value, index) => String(value) === String(b[index]));

/**
 * Merge one audit's shard reports. Returns the merged report and every reason
 * the split run does not count as the full gate (empty when it does).
 */
export function mergeAuditReports(audit, reports, expectedStates = [...STATES.map((state) => state.id)]) {
  const problems = [];
  if (!reports.length) return { merged: null, problems: [`${audit}: no shard report found`] };
  const counts = new Set();
  const seen = new Map();
  for (const report of reports) {
    const match = /^(\d+)\/(\d+)$/.exec(report.shard ?? '');
    if (!match) { problems.push(`${audit}: a report carries no AUDIT_SHARD (shard ${JSON.stringify(report.shard ?? null)})`); continue; }
    counts.add(Number(match[2]));
    if (seen.has(Number(match[1]))) problems.push(`${audit}: shard ${report.shard} reported twice`);
    seen.set(Number(match[1]), report);
    if (report.filtered) problems.push(`${audit}: shard ${report.shard} was narrowed by AUDIT_STATES`);
    if (!sameList(report.locales, LOCALES)) problems.push(`${audit}: shard ${report.shard} measured locales ${report.locales}, not ${LOCALES}`);
    if (!sameList(report.themes, THEMES)) problems.push(`${audit}: shard ${report.shard} measured themes ${report.themes}, not ${THEMES}`);
    if (!sameList(report.widths, WIDTHS)) problems.push(`${audit}: shard ${report.shard} measured widths ${report.widths}, not ${WIDTHS}`);
  }
  if (counts.size > 1) problems.push(`${audit}: shards disagree on the shard count (${[...counts].join(', ')})`);
  const total = counts.size === 1 ? [...counts][0] : 0;
  for (let index = 1; index <= total; index++) if (!seen.has(index)) problems.push(`${audit}: shard ${index}/${total} is missing`);

  const measured = new Map();
  for (const report of reports) for (const id of report.states ?? []) {
    if (measured.has(id)) problems.push(`${audit}: state ${id} measured by shard ${measured.get(id)} and shard ${report.shard}`);
    else measured.set(id, report.shard);
  }
  const missing = expectedStates.filter((id) => !measured.has(id));
  if (missing.length) problems.push(`${audit}: ${missing.length} state(s) never measured: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', ...' : ''}`);

  const bySignature = new Map();
  for (const report of reports) for (const [signature, id] of report.signatures ?? []) {
    const other = bySignature.get(signature);
    if (other !== undefined && other !== id) problems.push(`${audit}: states ${other} and ${id} render identical markup (the driver is not reaching one of them)`);
    else bySignature.set(signature, id);
  }

  const groups = new Map();
  for (const report of reports) for (const group of report.groups ?? []) {
    const known = groups.get(group.key);
    if (known) known.count += group.count;
    else groups.set(group.key, { key: group.key, count: group.count, example: group.example });
  }
  const merged = {
    audit,
    date: new Date().toISOString(),
    shards: total,
    states: [...measured.keys()],
    locales: LOCALES,
    themes: THEMES,
    widths: WIDTHS,
    configurations: reports.reduce((sum, report) => sum + (report.configurations ?? 0), 0),
    findings: reports.reduce((sum, report) => sum + (report.findings ?? 0), 0),
    groups: [...groups.values()].sort((a, b) => b.count - a.count),
    jsErrors: reports.flatMap((report) => report.jsErrors ?? []),
    mediaErrors: reports.flatMap((report) => report.mediaErrors ?? []),
    authenticated: reports.flatMap((report) => report.authenticated ?? []),
    unansweredCoreRequests: [...new Set(reports.flatMap((report) => report.unansweredCoreRequests ?? []))].sort(),
    problems,
  };
  return { merged, problems };
}

/** Every <audit>.json under a folder, grouped by audit. */
export function collectReports(dir) {
  const found = Object.fromEntries(AUDITS.map((audit) => [audit, []]));
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) { if (name !== 'merged') walk(path); continue; }
      const audit = basename(name, '.json');
      if (AUDITS.includes(audit)) found[audit].push(JSON.parse(readFileSync(path, 'utf8')));
    }
  };
  walk(dir);
  return found;
}

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const out = resolve(outAt === -1 ? '../audit-results/rebuild-audits/merged' : args[outAt + 1]);
  const input = args.find((arg, index) => !arg.startsWith('--') && index !== outAt + 1);
  if (!input) { console.error('Usage: node scripts/audits/merge-shards.mjs <reports-dir> [--out <dir>]'); process.exit(2); }
  const reports = collectReports(resolve(input));
  mkdirSync(out, { recursive: true });
  let exitCode = 0;
  for (const audit of AUDITS) {
    const { merged, problems } = mergeAuditReports(audit, reports[audit]);
    if (merged) writeFileSync(join(out, `${audit}.json`), JSON.stringify(merged, null, 1));
    for (const problem of problems) console.log(`INCOMPLETE ${problem}`);
    if (problems.length) { exitCode = 2; continue; }
    console.log(`\n${audit.toUpperCase()}: ${merged.configurations} configurations over ${merged.shards} shards, ${merged.states.length} states x ${LOCALES.length} locales x ${THEMES.length} themes x up to ${WIDTHS.length} widths`);
    if (!merged.groups.length) console.log('NO ISSUES FOUND');
    for (const group of merged.groups.slice(0, 40)) {
      const e = group.example;
      console.log(`${String(group.count).padStart(5)}x  ${group.key}\n         e.g. ${e.state} ${e.locale} ${e.theme} ${e.width}px`);
    }
    console.log(`JS errors: ${merged.jsErrors.length ? JSON.stringify(merged.jsErrors.slice(0, 5)) : 'none'}`);
    console.log(`Media errors: ${merged.mediaErrors.length ? JSON.stringify(merged.mediaErrors.slice(0, 5)) : 'none'}`);
    if ((merged.groups.length || merged.jsErrors.length || merged.mediaErrors.length) && exitCode === 0) exitCode = 1;
  }
  console.log(`\nMerged reports: ${out}`);
  process.exit(exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
