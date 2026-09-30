import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLICY, checkBlockEReview, readBlockELog } from './block-e-review-cadence.mjs';

/*
 * Gap-fix round 7 (Appendix J Part 1.4 / Part 3 Stage 7, E.7): the Block E
 * threshold log and regulatory watch list are read with their own due dates;
 * a malformed log always fails, an overdue row warns and fails under --strict,
 * and release readiness runs it with --strict.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const TOOL = fileURLToPath(new URL('./block-e-review-cadence.mjs', import.meta.url));
const live = readFileSync(`${repo}${POLICY}`, 'utf8');

function run(markdown, args = []) {
  const root = mkdtempSync(join(tmpdir(), 'block-e-cadence-'));
  mkdirSync(dirname(join(root, POLICY)), { recursive: true });
  writeFileSync(join(root, POLICY), markdown);
  const result = spawnSync(process.execPath, [TOOL, '--root', root, ...args], { encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test('the live policy parses: nine thresholds and five watch-list items, all dated', () => {
  const log = readBlockELog(live);
  assert.deepEqual(log.failures, []);
  assert.equal(log.adoption, '2026-09-25');
  assert.equal(log.thresholds.length, 9);
  assert.equal(log.watch.length, 5);
  for (const t of log.thresholds) assert.match(t.due, /^\d{4}-\d{2}-\d{2}$/, t.name);
  for (const w of log.watch) assert.match(w.due, /^\d{4}-\d{2}-\d{2}$/, w.item);
  assert.ok(log.thresholds.some((t) => t.enforcedIn.includes('request_teen_connection')));
});

test('on time it passes; overdue it warns, and fails under --strict', () => {
  const onTime = checkBlockEReview({ markdown: live, today: '2026-12-24', strict: true });
  assert.deepEqual([onTime.failures, onTime.warnings], [[], []]);
  const late = checkBlockEReview({ markdown: live, today: '2026-12-25' });
  assert.deepEqual(late.failures, []);
  assert.equal(late.warnings.length, 14);
  const strict = checkBlockEReview({ markdown: live, today: '2026-12-25', strict: true });
  assert.equal(strict.failures.length, 14);
  assert.ok(strict.failures.some((f) => /Teen decline cooldown.*was due 2026-12-24/.test(f)));
  assert.ok(strict.failures.some((f) => /regulatory re-check of "Federal KOSA"/.test(f)));
});

test('the CLI exits non-zero under --strict only when a row is overdue', () => {
  assert.equal(run(live, ['--today', '2026-10-01', '--strict']).code, 0);
  const warned = run(live, ['--today', '2027-01-02']);
  assert.equal(warned.code, 0);
  assert.match(warned.out, /WARN: the Block E recalibration/);
  const failed = run(live, ['--today', '2027-01-02', '--strict']);
  assert.equal(failed.code, 1);
  assert.match(failed.out, /FAIL: the regulatory re-check of "Maryland Kids Code"/);
});

test('a single overdue watch-list item fails release readiness on its own', () => {
  const edited = live.replace('| Open: re-check whether enacted | not yet | 2026-12-24 |', '| Open: re-check whether enacted | not yet | 2026-10-15 |');
  assert.notEqual(edited, live);
  const result = checkBlockEReview({ markdown: edited, today: '2026-11-01', strict: true });
  assert.deepEqual(result.failures, ['the regulatory re-check of "Federal KOSA" (E.7) was due 2026-10-15; the Safety/Trust Lead and counsel record it in docs/rebuild/policies/SOCIAL-GOVERNANCE.md §1.3 and §1.4']);
});

test('a malformed log fails in every mode', () => {
  const cases = [
    [live.replace('| 2026-09-25 | 2026-12-24 |', '| 2026-09-25 | soon |'), /needs ISO "Last reviewed" and "Next review due"/],
    [live.replace('| 2026-09-25 | 2026-12-24 |', '| 2026-09-25 | 2027-09-01 |'), /due 341 days after its last review; the cadence allows 92/],
    [live.replace('| 2026-09-25 | 2026-12-24 |', '| 2026-12-24 | 2026-09-25 |'), /due before it was last reviewed/],
    [live.replace('| not yet | 2026-12-24 |', '| someday | 2026-12-24 |'), /needs an ISO "Last re-checked" date or "not yet"/],
    [live.replace('| not yet | 2026-12-24 |', '| not yet | TBD |'), /needs an ISO "Next re-check due" date/],
    [live.replace('| not yet | 2026-12-24 |', '| not yet | 2027-06-01 |'), /due 249 days after the adoption/],
    [live.replace('| Status | Last re-checked | Next re-check due |', '| Status on 2026-09-25 |'), /needs the column\(s\) "status", "last re-checked", "next re-check due"/],
    [live.replace('### 1.3 Regulatory watch list', '### 1.3 Notes'), /no "1.3 Regulatory watch list" section/],
    [live.replace('### 1.4 Recalibration record', '### 1.4 History'), /no "1.4 Recalibration record" section/],
  ];
  for (const [markdown, expected] of cases) {
    assert.notEqual(markdown, live, String(expected));
    const result = checkBlockEReview({ markdown, today: '2026-10-01' });
    assert.ok(result.failures.some((f) => expected.test(f)), `${expected} in ${JSON.stringify(result.failures)}`);
    assert.equal(run(markdown, ['--today', '2026-10-01']).code, 1, String(expected));
  }
  assert.match(checkBlockEReview({ markdown: null, today: '2026-10-01' }).failures[0], /is missing/);
});

test('after the first year a yearly interval is allowed', () => {
  const later = live.replace('| 2026-09-25 | 2026-12-24 |', '| 2027-10-01 | 2028-09-30 |');
  assert.deepEqual(readBlockELog(later).failures, []);
});

test('release readiness and the repo gates run the Block E cadence check', () => {
  assert.match(readFileSync(`${repo}agent/tools/release-readiness.sh`, 'utf8'), /^node agent\/tools\/block-e-review-cadence\.mjs --strict$/m);
  assert.match(readFileSync(`${repo}.github/workflows/repo-gates.yml`, 'utf8'), /run: node agent\/tools\/block-e-review-cadence\.mjs\n/);
});
