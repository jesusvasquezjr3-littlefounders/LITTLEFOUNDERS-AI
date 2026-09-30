import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkThresholds, fill, liveInputs, readLog, RULES } from './check-block-b-thresholds.mjs';
import {
  blockBSchedule, checkBlockBCadence, checkGateEffectivenessReviews, DARK_PATTERN_RECORD, GATE_REVIEW_MAX_OPEN_DAYS, LOG, loadOpenGateReviews,
  REGISTER_AUDIT_ITEM, registerAuditDates, REVIEWS,
} from './block-b-review-cadence.mjs';

/*
 * GAP-FIX-R6 (Appendix C Part 1.3, Part 3 Stage 6; B.17, B.19, B.26, B.28):
 * the Block B threshold gate sees drift in every direction (the log alone, a
 * Forge or Core constant alone, a migration alone, an unchecked threshold, no
 * review), and both recurring human reviews (the threshold review and the
 * Age-Band Register Differentiation Audit, MN-03) have a due date an engineering
 * row never moves, warn when overdue and fail under --strict.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const mutate = (change) => {
  const live = liveInputs();
  return checkThresholds({ ...live, ...change(live) });
};
const swap = (live, file, from, to) => (path) => {
  const text = live.readSource(path);
  if (path !== file) return text;
  assert.ok(text.includes(from), `${file} does not contain ${from}`);
  return text.replace(from, to);
};

test('the live repository agrees, and every rule is a key the log holds', () => {
  const live = liveInputs();
  assert.deepEqual(checkThresholds(live), []);
  assert.deepEqual([...readLog(live.log).keys()].sort(), RULES.map((r) => r.key).sort());
  assert.equal(new Set(RULES.map((r) => r.key)).size, RULES.length);
});

test('every rule is enforced somewhere: a source file, a migration, or its package twin test', () => {
  for (const rule of RULES) assert.ok(rule.src || rule.sql || ['coursegen', 'backend'].includes(rule.twin), rule.key);
  const twin = readFileSync(`${repo}coursegen/src/__tests__/blockBThresholds.test.ts`, 'utf8');
  for (const rule of RULES.filter((r) => r.twin === 'coursegen')) assert.ok(twin.includes(`'${rule.key}'`), rule.key);
});

test('fills whole values and list parts', () => {
  assert.equal(fill('{ words: {0}, youngWords: {1}, sentences: {2} }', '20, 12, 2'), '{ words: 20, youngWords: 12, sentences: 2 }');
  assert.equal(fill("'es-MX': {v}, 'pt-BR': {v}", '1.25'), "'es-MX': 1.25, 'pt-BR': 1.25");
});

test('catches the log changed without the code and the database', () => {
  const failures = mutate((live) => ({ log: live.log.replace('| `practice_band.default` | 70, 85, 30 |', '| `practice_band.default` | 65, 85, 30 |') }));
  assert.ok(failures.some((f) => f.includes('lowerPct: 65')), failures.join('\n'));
  assert.ok(failures.some((f) => f.includes('SELECT NULL, 65, 85, 30,')), failures.join('\n'));
});

test('catches a Forge constant changed alone (the B.17 ceiling)', () => {
  const failures = mutate((live) => ({ readSource: swap(live, 'coursegen/src/contentGates/conceptCap.ts', "'6-9': { target: 2, ceiling: 3 }", "'6-9': { target: 2, ceiling: 4 }") }));
  assert.deepEqual(failures, [`concept_cap.6_9: log says 2, 3, coursegen/src/contentGates/conceptCap.ts does not contain "'6-9': { target: 2, ceiling: 3 },"`]);
});

test('catches a Core constant changed alone (the B.26 guided review, the B.28 trend)', () => {
  const guided = mutate((live) => ({ readSource: swap(live, 'backend/src/services/learnerRegisterPolicy.ts', 'GUIDED_REVIEW_MISS_THRESHOLD = 3;', 'GUIDED_REVIEW_MISS_THRESHOLD = 4;') }));
  assert.deepEqual(guided.map((f) => f.split(':')[0]), ['guided_review.miss_threshold']);
  const trend = mutate((live) => ({ readSource: swap(live, 'backend/src/services/engagementHealth.ts', 'TREND_TOLERANCE = 0.1;', 'TREND_TOLERANCE = 0.2;') }));
  assert.deepEqual(trend.map((f) => f.split(':')[0]), ['engagement.trend_tolerance']);
});

test('catches a register boundary moved in one place only', () => {
  const failures = mutate((live) => ({ readSource: swap(live, 'backend/src/services/learnerRegisterPolicy.ts', "if (age < 13) return 'transition';", "if (age < 12) return 'transition';") }));
  assert.deepEqual(failures.map((f) => f.split(':')[0]), ['register.teen_age']);
});

test('catches a migration changed alone (the B.19 guard rails)', () => {
  const failures = mutate((live) => ({
    readMigration: (suffix) => live.readMigration(suffix)?.replace('lower_pct >= 50 AND', 'lower_pct >= 40 AND') ?? null,
  }));
  assert.equal(failures.length, 1);
  assert.match(failures[0], /^practice_band\.guard_rails: migration \*_practice_difficulty_calibration\.sql/);
});

test('catches an unchecked threshold, a missing one and a log with no review', () => {
  const failures = mutate((live) => ({
    log: `${live.log.replace(/## Review history[\s\S]*/, '').replace(/^\| `mentor\.zpd_target` .*\n/m, '')}\n| \`new.threshold\` | 4 | x |\n`,
  }));
  assert.ok(failures.includes('new.threshold: in the log but no rule checks it'), failures.join('\n'));
  assert.ok(failures.includes(`mentor.zpd_target: missing from ${LOG}`), failures.join('\n'));
  assert.ok(failures.some((f) => f.includes('no dated entry')), failures.join('\n'));
});

// ── The review cadence ──

const thresholds = REVIEWS.find((r) => r.id === 'thresholds');
const register = REVIEWS.find((r) => r.id === 'register-audit');
const doc = ({ history = [['2026-09-24', 'engineering']], audits = [['2026-09-24', 'engineering']], firstDue = '2027-01-15', registerColumns = '| Date | Kind | Scope | Result | By |' } = {}) => [
  '# Log', '', firstDue ? `**First human review due: ${firstDue}** (one quarter after the release).` : 'No date.', '',
  '## Review history', '', '| Date | Kind | Keys | Decision | By |', '|---|---|---|---|---|',
  ...history.map(([d, k]) => `| ${d} | ${k} | All | A decision. | Someone |`), '',
  '## Register audit log', '', registerColumns, '|---|---|---|---|---|',
  ...audits.map(([d, k]) => `| ${d} | ${k} | Scope | Result | Someone |`), '', '## What a recalibration looks at', '',
].join('\n');
const releaseAudit = (date, result, signed = 'A. Reviewer') => ({ id: `${date}-release`, date, kind: 'release-audit', signed_off_by: signed, items: { [REGISTER_AUDIT_ITEM]: { result, evidence: 'x' } } });
const record = (...audits) => ({ audits: [{ id: 'pre', date: '2026-09-24', kind: 'engineering-pre-audit', signed_off_by: null, items: { [REGISTER_AUDIT_ITEM]: { result: 'pass' } } }, ...audits] });

test('names both reviews, their owners and their cadences', () => {
  assert.deepEqual(REVIEWS.map((r) => [r.id, r.cadence]), [['thresholds', 'quarterly-then-yearly'], ['register-audit', 'quarterly']]);
  assert.match(thresholds.owner, /Pedagogical Lead/);
  assert.match(register.spec, /MN-03/);
  assert.equal(register.also, DARK_PATTERN_RECORD);
});

test('engineering rows and an engineering pre-audit never count: both are due on the first date', () => {
  const s = checkBlockBCadence({ markdown: doc(), record: record(), today: '2027-01-15' });
  assert.deepEqual([s.failures, s.warnings], [[], []]);
  assert.equal(s.schedules.thresholds.due, '2027-01-15');
  assert.equal(s.schedules['register-audit'].due, '2027-01-15');
  assert.equal(s.schedules['register-audit'].lastHuman, null);
});

test('the threshold review moves one quarter past a human row, and yearly after four', () => {
  assert.equal(blockBSchedule(thresholds, { markdown: doc({ history: [['2027-01-10', 'human']] }), record: record() }).due, '2027-04-10');
  const four = [['2027-01-10', 'human'], ['2027-04-08', 'human'], ['2027-07-05', 'human'], ['2027-10-01', 'human']];
  assert.equal(blockBSchedule(thresholds, { markdown: doc({ history: four }), record: record() }).due, '2028-09-30');
});

test('the register audit counts its own human row or a signed release audit that judged MN-03, and stays quarterly', () => {
  const own = blockBSchedule(register, { markdown: doc({ audits: [['2027-01-05', 'human']] }), record: record() });
  assert.deepEqual([own.lastHuman, own.due], ['2027-01-05', '2027-04-05']);
  const released = blockBSchedule(register, { markdown: doc({ audits: [['2027-01-05', 'human']] }), record: record(releaseAudit('2027-02-01', 'pass')) });
  assert.deepEqual([released.lastHuman, released.due], ['2027-02-01', '2027-05-02']);
  // A failing result is still an audit performed; an open item, an unsigned audit or a pre-audit is not.
  assert.equal(registerAuditDates(record(releaseAudit('2027-02-01', 'fail'))).dates[0], '2027-02-01');
  assert.deepEqual(registerAuditDates(record(releaseAudit('2027-02-01', 'open'))).dates, []);
  assert.deepEqual(registerAuditDates(record(releaseAudit('2027-02-01', 'pass', null))).dates, []);
  const four = [['2027-01-10', 'human'], ['2027-04-08', 'human'], ['2027-07-05', 'human'], ['2027-10-01', 'human']];
  assert.equal(blockBSchedule(register, { markdown: doc({ audits: four }), record: record() }).due, '2027-12-30');
});

test('overdue warns in the repo gates and fails under --strict, for each review', () => {
  const late = checkBlockBCadence({ markdown: doc({ history: [['2027-01-10', 'human']] }), record: record(), today: '2027-01-16' });
  assert.deepEqual(late.failures, []);
  assert.equal(late.warnings.length, 1);
  assert.match(late.warnings[0], /Age-Band Register Differentiation Audit .* was due 2027-01-15/);
  const strict = checkBlockBCadence({ markdown: doc(), record: record(), today: '2027-01-16', strict: true });
  assert.equal(strict.warnings.length, 0);
  assert.equal(strict.failures.length, 2);
  assert.match(strict.failures[0], /Block B Threshold Recalibration .* was due 2027-01-15/);
  const done = checkBlockBCadence({ markdown: doc({ history: [['2027-01-14', 'human']], audits: [['2027-01-14', 'human']] }), record: record(), today: '2027-04-13', strict: true });
  assert.deepEqual(done.failures, []);
});

test('a malformed record fails whatever the date', () => {
  const fails = (options, rec = record()) => checkBlockBCadence({ markdown: doc(options), record: rec, today: '2026-10-01' }).failures.join('\n');
  assert.match(fails({ firstDue: null }), /First human review due/);
  assert.match(fails({ audits: [['2026-09-24', 'Engineering (S05 lane)']] }), /kind is "Engineering \(S05 lane\)"/);
  assert.match(fails({ audits: [['24 Sep 2026', 'human']] }), /no valid date/);
  assert.match(fails({ registerColumns: '| When | Type | Scope | Result | By |' }), /Date and Kind columns/);
  assert.match(fails({}, null), /dark-pattern-audits\.json is missing/);
  assert.match(fails({}, { audits: [{ ...releaseAudit('soon', 'pass'), id: 'x' }] }), /release audit x has no valid date/);
  assert.match(checkBlockBCadence({ markdown: doc().replace('## Register audit log', '## Audits'), record: record(), today: '2026-10-01' }).failures.join('\n'), /no "## Register audit log" table/);
});

test('the live records parse and are due no earlier than the stated first date', () => {
  const live = liveInputs();
  const result = checkBlockBCadence({ markdown: live.log, record: live.record, today: '2026-10-01' });
  assert.deepEqual(result.failures, []);
  assert.ok(result.schedules.thresholds.due >= '2027-01-15');
  assert.ok(result.schedules['register-audit'].due >= '2027-01-15');
});

test('release readiness passes --strict, the repo gates run it, and it runs clean today', () => {
  assert.match(readFileSync(`${repo}agent/tools/release-readiness.sh`, 'utf8'), /^node agent\/tools\/check-block-b-thresholds\.mjs --strict$/m);
  assert.match(readFileSync(`${repo}.github/workflows/repo-gates.yml`, 'utf8'), /run: node agent\/tools\/check-block-b-thresholds\.mjs\n/);
  const out = execFileSync(process.execPath, [`${repo}agent/tools/check-block-b-thresholds.mjs`], { encoding: 'utf8' });
  assert.match(out, /next human review due \d{4}-\d{2}-\d{2}, next register audit due \d{4}-\d{2}-\d{2}/);
});

/* Appendix C 1.3 "Defect Escape Rate" / Stage 6 (gap-fix round 7): the open gate-effectiveness reviews. */
const openReview = (id, openedAt, gate = 'forge.gate.12.tone', owner = 'pedagogical_lead') => ({ review_id: id, gate_id: gate, owner_role: owner, opened_at: openedAt });

test('a gate-effectiveness review open longer than the cadence warns in the repo gates and fails under --strict', () => {
  assert.equal(GATE_REVIEW_MAX_OPEN_DAYS, 90);
  const reviews = [openReview('r-late', '2026-06-29T12:00:00Z'), openReview('r-fresh', '2026-09-01T00:00:00Z', 'forge.release.locales-complete', 'content_engineering')];
  const warned = checkGateEffectivenessReviews({ reviews, today: '2026-09-29' });
  assert.deepEqual(warned.failures, []);
  assert.deepEqual(warned.overdue, ['r-late']);
  assert.match(warned.warnings[0], /r-late for forge\.gate\.12\.tone .* open 91 days, longer than/);
  const strict = checkGateEffectivenessReviews({ reviews, today: '2026-09-30', strict: true });
  assert.equal(strict.warnings.length, 0);
  assert.equal(strict.failures.length, 1);
  assert.match(strict.failures[0], /r-late for forge\.gate\.12\.tone .* open 92 days, longer than 90; the Pedagogical Lead must record why the gate missed/);
  // Exactly the cadence is not yet overdue.
  assert.deepEqual(checkGateEffectivenessReviews({ reviews: [openReview('r-edge', '2026-07-01T00:00:00Z')], today: '2026-09-29', strict: true }).failures, []);
  assert.deepEqual(checkGateEffectivenessReviews({ reviews: [], today: '2026-09-29', strict: true }), { failures: [], warnings: [], overdue: [] });
});

test('a malformed review list fails; an unread source warns and says how to read it', () => {
  assert.match(checkGateEffectivenessReviews({ reviews: {}, today: '2026-09-29' }).failures[0], /expected a JSON array/);
  assert.match(checkGateEffectivenessReviews({ reviews: [{ gate_id: 'forge.gate.12.tone' }], today: '2026-09-29' }).failures[0], /no review id, gate or opening time/);
  assert.match(checkGateEffectivenessReviews({ reviews: [openReview('r', 'soon')], today: '2026-09-29' }).failures[0], /no review id, gate or opening time/);
  const unread = checkGateEffectivenessReviews({ reviews: null, unread: 'no source here', today: '2026-09-29', strict: true });
  assert.deepEqual(unread.failures, []);
  assert.match(unread.warnings[0], /not checked \(no source here\); pass --gate-reviews/);
});

test('the open reviews load from a file, from the service-role RPC, or not at all', async () => {
  const fromFile = await loadOpenGateReviews({ argv: ['--strict', '--gate-reviews=reviews.json'], env: {}, readFile: () => JSON.stringify([openReview('r', '2026-09-01T00:00:00Z')]) });
  assert.equal(fromFile.reviews.length, 1);
  const badFile = await loadOpenGateReviews({ argv: ['--gate-reviews=missing.json'], env: {}, readFile: () => { throw new Error('ENOENT'); } });
  assert.equal(badFile.reviews, null);
  assert.equal(badFile.failed, true);
  const none = await loadOpenGateReviews({ argv: [], env: {}, readFile: () => '' });
  assert.equal(none.reviews, null);
  assert.equal(none.failed, undefined);
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); return { ok: true, json: async () => [openReview('r', '2026-09-01T00:00:00Z')] }; };
  const fromDb = await loadOpenGateReviews({ argv: [], env: { SUPABASE_URL: 'http://localhost:54321/', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' }, readFile: () => '', fetchImpl });
  assert.equal(fromDb.reviews.length, 1);
  assert.equal(seen[0].url, 'http://localhost:54321/rest/v1/rpc/gate_effectiveness_reviews_open');
  assert.equal(seen[0].init.method, 'POST');
  const down = await loadOpenGateReviews({ argv: [], env: { SUPABASE_URL: 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' }, readFile: () => '',
    fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(down.failed, true);
  assert.match(down.unread, /answered 404/);
});

test('--strict fails the CLI on an overdue review read from a file', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'lf-gate-reviews-')), 'open.json');
  writeFileSync(file, JSON.stringify([openReview('r-old', '2020-01-01T00:00:00Z')]));
  try {
    let failed = null;
    try { execFileSync(process.execPath, ['agent/tools/check-block-b-thresholds.mjs', '--strict', `--gate-reviews=${file}`], { cwd: repo, stdio: 'pipe' }); }
    catch (error) { failed = String(error.stderr); }
    assert.ok(failed, 'expected --strict to fail');
    assert.match(failed, /FAIL: the gate-effectiveness review r-old/);
    const warned = execFileSync(process.execPath, ['agent/tools/check-block-b-thresholds.mjs', `--gate-reviews=${file}`], { cwd: repo, stdio: 'pipe' });
    assert.match(String(warned), /block-b-thresholds OK/);
  } finally {
    rmSync(file, { force: true });
  }
});
