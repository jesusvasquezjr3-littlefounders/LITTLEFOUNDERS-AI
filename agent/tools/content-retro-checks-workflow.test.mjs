import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * G.2 / Appendix N 2.3(b): the retroactive release check must RUN inside its
 * 30-day window, not only be reported once the window has passed. This lint
 * pins .github/workflows/content-retro-checks.yml:
 *
 *   - a schedule whose cadence leaves several runs inside 30 days (weekly or
 *     more often), plus workflow_dispatch;
 *   - the command it runs is Forge's `content:retro-checks`, and that script
 *     still points at coursegen/src/retroChecks.ts;
 *   - Vault is reached with the service-role credential read from the Core
 *     service's Railway variables (no repository secret holds it), and an
 *     empty credential fails the run;
 *   - a failed run notifies a human on the `ops-watchdog` issue (issues:
 *     write, a failure() step that comments or opens the issue).
 *
 * And, for H.4 / Appendix O 1.3, that ops-job-watch.yml still posts its
 * notice to the same issue (the Mentor retention sweep's human notification
 * now goes through it).
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(`${repo}${path}`, 'utf8');
const RETRO = '.github/workflows/content-retro-checks.yml';

/** Days between runs for a five-field cron, when it is daily or weekly; null otherwise. */
export function cronPeriodDays(cron) {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dom, month, dow] = fields;
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour) || dom !== '*' || month !== '*') return null;
  if (dow === '*') return 1;
  if (/^[0-6]$/.test(dow)) return 7;
  return null;
}

export function retroWorkflowFailures(yaml) {
  const failures = [];
  const crons = [...yaml.matchAll(/-\s*cron:\s*'([^']+)'/g)].map((m) => m[1]);
  if (crons.length === 0) failures.push('no schedule');
  for (const cron of crons) {
    const days = cronPeriodDays(cron);
    if (days === null || days > 7) failures.push(`schedule ${cron} is not daily or weekly`);
  }
  if (!/^\s*workflow_dispatch:/m.test(yaml)) failures.push('no workflow_dispatch');
  if (!/npm --prefix coursegen run content:retro-checks/.test(yaml)) failures.push('does not run npm --prefix coursegen run content:retro-checks');
  if (!/railway variable list --service littlefounders-backend/.test(yaml)) failures.push('the credential is not read from the Core service variables');
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!new RegExp(`${name}="\\$\\(read_var ${name}\\)"`).test(yaml)) failures.push(`${name} is not read from Railway`);
  }
  if (/secrets\.SUPABASE_SERVICE_ROLE_KEY/.test(yaml)) failures.push('the service-role key is stored as a repository secret');
  if (!/\[ -z "\$\{!v\}" \]/.test(yaml)) failures.push('an empty credential does not fail the run');
  if (!/set -euo pipefail[\s\S]*content:retro-checks 2>&1 \| tee retro-checks\.log/.test(yaml)) failures.push('a failed check does not fail the step (pipefail before the tee)');
  if (!/^\s*issues: write/m.test(yaml)) failures.push('no issues: write permission');
  if (!/if: failure\(\)[\s\S]*--label ops-watchdog/.test(yaml)) failures.push('a failed run does not notify the ops-watchdog issue');
  return failures;
}

test(`${RETRO} runs the retroactive check on a schedule and notifies a human on failure`, () => {
  assert.deepEqual(retroWorkflowFailures(read(RETRO)), []);
});

test('the scheduled command is still Forge\'s retroactive-check runner', () => {
  const scripts = JSON.parse(read('coursegen/package.json')).scripts;
  assert.match(scripts['content:retro-checks'], /src\/retroChecks\.ts$/);
});

test('the lint fails on a monthly schedule, a missing command, a stored secret and a silent failure', () => {
  const real = read(RETRO);
  assert.match(retroWorkflowFailures(real.replace(/cron: '[^']+'/, "cron: '0 5 1 * *'")).join('\n'), /not daily or weekly/);
  assert.match(retroWorkflowFailures(real.replace('npm --prefix coursegen run content:retro-checks', 'echo skipped')).join('\n'), /does not run/);
  assert.match(retroWorkflowFailures(real.replace('SUPABASE_SERVICE_ROLE_KEY="$(read_var SUPABASE_SERVICE_ROLE_KEY)"', 'SUPABASE_SERVICE_ROLE_KEY="${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"')).join('\n'), /repository secret/);
  assert.match(retroWorkflowFailures(real.replace(/--label ops-watchdog/g, '')).join('\n'), /does not notify/);
  assert.match(retroWorkflowFailures(real.replace('issues: write', 'issues: read')).join('\n'), /issues: write/);
});

test('cronPeriodDays reads daily and weekly schedules only', () => {
  assert.equal(cronPeriodDays('0 5 * * *'), 1);
  assert.equal(cronPeriodDays('0 5 * * 1'), 7);
  assert.equal(cronPeriodDays('0 5 1 * *'), null);
  assert.equal(cronPeriodDays('*/5 * * * *'), null);
});

test('ops-job-watch.yml posts its notice to the ops-watchdog issue and judges through the watcher', () => {
  const yaml = read('.github/workflows/ops-job-watch.yml');
  assert.match(yaml, /^\s*issues: write/m);
  assert.match(yaml, /node agent\/tools\/ops-job-watch\.mjs --status-file status\.json --notify-file notice\.md/);
  assert.match(yaml, /if: failure\(\) && hashFiles\('notice\.md'\) != ''[\s\S]*--label ops-watchdog/);
  assert.match(yaml, /\/api\/v1\/internal\/ops\/job-status/);
});
