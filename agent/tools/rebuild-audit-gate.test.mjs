import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * GAP-FIX-R5 F5-design-system: the Frontend Bible audits (02 §7 item 10,
 * 03 §5, 05 §8, 06 §7) and the Mentor-stage verifier (08 §9) run in CI and in
 * release readiness, not only by hand. This pins the pieces that make a split
 * CI run the WHOLE gate (the shard partition, and the merge that refuses a
 * partial run) and the wiring itself, so the step cannot quietly disappear
 * again. The browser runs themselves are the gate; this is the gate's lint.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FRONTEND = `${ROOT}frontend/`;
const { STATES, LOCALES, THEMES, WIDTHS, shardStates } = await import('../../frontend/scripts/audits/states.mjs');
const { mergeAuditReports } = await import('../../frontend/scripts/audits/merge-shards.mjs');
const gate = await import('../../frontend/scripts/rebuild-audit-gate.mjs');

test('AUDIT_SHARD partitions every state into disjoint, balanced round-robin shards whose union is the whole list', () => {
  assert.ok(STATES.length > 400, `${STATES.length} states`);
  const ids = STATES.map((state) => state.id);
  for (const count of [1, 2, 5, 12, 13]) {
    const shards = Array.from({ length: count }, (_, index) => shardStates(STATES, `${index + 1}/${count}`).map((state) => state.id));
    const all = shards.flat();
    assert.equal(new Set(all).size, all.length, `n=${count}: a state in two shards`);
    assert.deepEqual([...all].sort(), [...ids].sort(), `n=${count}: union is not the whole list`);
    const sizes = shards.map((shard) => shard.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `n=${count}: unbalanced ${sizes}`);
  }
});

test('AUDIT_SHARD unset runs everything; a malformed one is refused', () => {
  assert.equal(shardStates(STATES, undefined), STATES);
  assert.equal(shardStates(STATES, ''), STATES);
  for (const spec of ['0/3', '4/3', '3', 'a/b', '1/0', '-1/3']) assert.throws(() => shardStates(STATES, spec), /AUDIT_SHARD/, spec);
});

const EXPECTED = ['a', 'b', 'c', 'd', 'e'];
const shard = (index, states, extra = {}) => ({
  shard: `${index}/2`, filtered: false, states, locales: LOCALES, themes: THEMES, widths: WIDTHS,
  configurations: states.length * 10, findings: 0, groups: [], jsErrors: [],
  signatures: states.map((id) => [`sig-${id}`, id]), ...extra,
});
const problemsOf = (reports) => mergeAuditReports('text-fit', reports, EXPECTED).problems.join('\n');

test('merge-shards merges a complete split run: configurations and findings summed, groups combined by key', () => {
  const { merged, problems } = mergeAuditReports('copy-budget', [
    shard(1, ['a', 'c', 'e'], { findings: 2, groups: [{ key: 'over-budget | x', count: 2, example: {} }] }),
    shard(2, ['b', 'd'], { findings: 1, groups: [{ key: 'over-budget | x', count: 1, example: {} }] }),
  ], EXPECTED);
  assert.deepEqual(problems, []);
  assert.equal(merged.shards, 2);
  assert.equal(merged.configurations, 50);
  assert.equal(merged.findings, 3);
  assert.deepEqual(merged.groups.map(({ key, count }) => [key, count]), [['over-budget | x', 3]]);
  assert.deepEqual([...merged.states].sort(), EXPECTED);
});

test('merge-shards refuses a missing shard, a repeated shard and a report with no shard', () => {
  assert.match(problemsOf([shard(1, ['a', 'c', 'e'])]), /shard 2\/2 is missing[\s\S]*never measured: b, d/);
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(1, ['b', 'd'])]), /shard 1\/2 reported twice/);
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(2, ['b', 'd'], { shard: null })]), /carries no AUDIT_SHARD/);
  assert.deepEqual(mergeAuditReports('text-fit', [], EXPECTED).problems, ['text-fit: no shard report found']);
});

test('merge-shards refuses a state measured twice or never, and a narrowed or trimmed matrix', () => {
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(2, ['b', 'c'])]), /state c measured by shard 1\/2 and shard 2\/2[\s\S]*never measured: d/);
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(2, ['b', 'd'], { filtered: true })]), /narrowed by AUDIT_STATES/);
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(2, ['b', 'd'], { locales: ['en-US'] })]), /measured locales en-US/);
  assert.match(problemsOf([shard(1, ['a', 'c', 'e'], { themes: ['light'] }), shard(2, ['b', 'd'])]), /measured themes light/);
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(2, ['b', 'd'], { widths: [375] })]), /measured widths 375/);
});

test('merge-shards repeats the identical-markup check across shards', () => {
  assert.match(problemsOf([shard(1, ['a', 'c', 'e']), shard(2, ['b', 'd'], { signatures: [['sig-a', 'b'], ['sig-d', 'd']] })]), /states a and b render identical markup/);
});

test('merge-shards expects every state the driver declares by default', () => {
  const { problems } = mergeAuditReports('proportion', [{ ...shard(1, ['a']), shard: '1/1' }]);
  assert.match(problems.join('\n'), new RegExp(`${STATES.length} state\\(s\\) never measured`));
});

test('rebuild-audit-gate runs every suite by default and refuses an unknown one', () => {
  assert.deepEqual(gate.parseArgs([]), { suite: 'all', requireChrome: false });
  assert.deepEqual(gate.parseArgs(['--suite', 'audits', '--require-chrome']), { suite: 'audits', requireChrome: true });
  assert.deepEqual(gate.SUITES.all, ['audits', 'mentor-stage']);
  assert.throws(() => gate.parseArgs(['--suite', 'text-fit']), /--suite/);
});

test('rebuild-audit-gate skips without Chrome only when Chrome is not required (release readiness), and fails in CI', () => {
  assert.equal(gate.chromeDecision('/usr/bin/google-chrome', true), 'run');
  assert.equal(gate.chromeDecision('/usr/bin/google-chrome', false), 'run');
  assert.equal(gate.chromeDecision(null, false), 'skip');
  assert.equal(gate.chromeDecision(null, true), 'fail');
});

test('rebuild-audit-gate drives the real audit driver over all three audits and the real Mentor-stage verifier', () => {
  assert.deepEqual(gate.SUITE_SCRIPTS.audits, ['scripts/audit-rebuild.mjs', 'all']);
  assert.deepEqual(gate.SUITE_SCRIPTS['mentor-stage'], ['scripts/verify-mentor-stage.mjs']);
  for (const [script] of Object.values(gate.SUITE_SCRIPTS)) assert.ok(existsSync(`${FRONTEND}${script}`), script);
});

const WORKFLOW = readFileSync(`${ROOT}.github/workflows/frontend-ci.yml`, 'utf8').replace(/\r\n/g, '\n');
function job(name) {
  const start = WORKFLOW.indexOf(`\n  ${name}:\n`);
  assert.ok(start > -1, `job ${name} missing from frontend-ci.yml`);
  const next = WORKFLOW.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? WORKFLOW.slice(start) : WORKFLOW.slice(start, start + 1 + next);
}

test('frontend CI runs the audits as a complete matrix of shards, after the unit job', () => {
  const audits = job('rebuild-audits');
  assert.match(audits, /needs: ci\n/);
  const shards = /shard: \[([\d, ]+)\]/.exec(audits)?.[1]?.split(',').map((value) => Number(value.trim()));
  assert.ok(shards && shards.length > 1, 'no shard matrix');
  assert.deepEqual(shards, Array.from({ length: shards.length }, (_, index) => index + 1));
  assert.ok(audits.includes(`AUDIT_SHARD: \${{ matrix.shard }}/${shards.length}`), 'AUDIT_SHARD does not match the matrix size');
  assert.match(audits, /fail-fast: false/);
  assert.match(audits, /run: npm run scenes:fetch/);
  assert.match(audits, /run: node scripts\/rebuild-audit-gate\.mjs --suite audits --require-chrome/);
  assert.doesNotMatch(audits, /AUDIT_(?:STATES|LOCALES|THEMES|WIDTHS|ROUTES):/, 'a CI shard may never narrow the matrix');
  assert.match(audits, /upload-artifact@v4[\s\S]*name: rebuild-audits-shard-\$\{\{ matrix\.shard \}\}[\s\S]*path: audit-results\/rebuild-audits\/\*\.json/);
});

test('frontend CI merges the shards and fails on an incomplete run', () => {
  const report = job('rebuild-audits-report');
  assert.match(report, /needs: rebuild-audits\n/);
  assert.match(report, /download-artifact@v4[\s\S]*pattern: rebuild-audits-shard-\*/);
  assert.match(report, /run: node scripts\/audits\/merge-shards\.mjs \.\.\/audit-results\/shards --out \.\.\/audit-results\/rebuild-audits/);
  assert.match(report, /name: rebuild-audits\n/);
});

test('frontend CI runs the Mentor-stage verifier in the browser job the comment names', () => {
  const browser = job('browser-gates');
  assert.match(browser, /run: node scripts\/rebuild-audit-gate\.mjs --suite mentor-stage --require-chrome/);
  assert.match(browser, /path: audit-results\/mentor-stage\/\*\*\/report\.json/);
});

test('release readiness runs every suite (a machine without Chrome prints SKIP)', () => {
  const release = readFileSync(`${ROOT}agent/tools/release-readiness.sh`, 'utf8');
  assert.match(release, /^npm run rebuild:audit-gate$/m);
  const root = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));
  const frontend = JSON.parse(readFileSync(`${FRONTEND}package.json`, 'utf8'));
  assert.equal(root.scripts['rebuild:audit-gate'], 'npm --prefix frontend run audit:gate -- --suite all');
  assert.equal(frontend.scripts['audit:gate'], 'node scripts/rebuild-audit-gate.mjs');
  assert.equal(frontend.scripts['audit:merge'], 'node scripts/audits/merge-shards.mjs');
});
