import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkThresholds, constant, liveInputs, readLog } from './check-block-d-thresholds.mjs';

/*
 * The Block D threshold gate must see drift in every direction: the log
 * changed alone, a Core constant changed alone, a migration changed alone,
 * a threshold added to the log with no rule, and a log with no review.
 */

test('the live repository agrees', () => {
  assert.deepEqual(checkThresholds(liveInputs()), []);
});

test('reads the log and the constants out of the real files', () => {
  const { log, readSource } = liveInputs();
  assert.equal(readLog(log).get('savings_bonus.per_ten_unit'), '10');
  assert.equal(constant(readSource('backend/src/services/choreStreak.ts'), 'STREAK_MILESTONES'), '7, 30, 100');
});

const mutate = (change) => {
  const live = liveInputs();
  return checkThresholds({ ...live, ...change(live) });
};

test('catches the log changed without Core and the database', () => {
  const failures = mutate((live) => ({ log: live.log.replace('| `chore.contribution_max_coins` | 2 |', '| `chore.contribution_max_coins` | 5 |') }));
  assert.ok(failures.some((f) => f.includes('MAX_CONTRIBUTION_COINS is 2')), failures.join('\n'));
  assert.ok(failures.some((f) => f.includes('BETWEEN 0 AND 5')), failures.join('\n'));
});

test('catches a Core constant changed alone', () => {
  const failures = mutate((live) => ({
    readSource: (path) => path.endsWith('choreStreak.ts') ? live.readSource(path).replace('REST_DAYS_PER_WEEK = 2;', 'REST_DAYS_PER_WEEK = 3;') : live.readSource(path),
  }));
  assert.deepEqual(failures, ['chore_streak.rest_days_per_week: log says 2, backend/src/services/choreStreak.ts REST_DAYS_PER_WEEK is 3']);
});

test('catches a migration changed alone', () => {
  const failures = mutate((live) => ({
    readMigration: (suffix) => suffix === '_savings_bonus_age_framing' ? live.readMigration(suffix).replace('::int < 13 THEN', '::int < 12 THEN') : live.readMigration(suffix),
  }));
  // S07.6: the teen register (D.12) reads the same cutoff as the bonus framing
  // (D.11), so moving it alone breaks both, which is the point: one design.
  assert.equal(failures.length, 2);
  assert.match(failures[0], /percent_min_age/);
  assert.match(failures[1], /register\.teen_min_age/);
});

test('catches an unchecked threshold and a log with no review', () => {
  const failures = mutate((live) => ({ log: `${live.log.replace(/## Review history[\s\S]*/, '')}\n| \`new.threshold\` | 4 | x |\n` }));
  assert.ok(failures.includes('new.threshold: in the log but no rule checks it'));
  assert.ok(failures.some((f) => f.includes('no dated entry')));
});
