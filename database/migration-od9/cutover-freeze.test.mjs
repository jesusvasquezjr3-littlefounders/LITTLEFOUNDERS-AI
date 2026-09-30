// OD-9 section 4.5 and S10.2a/S10.2e (the cutover freezes every scheduled
// job, so nothing runs in the window), with H.4 (the watchdogs): the freeze
// list in docs/operations/CUTOVER-RUNBOOK.md step 1 is pinned to the workflow
// directory.
//
// Gap-fix round 8: rounds 4 to 7 added nine scheduled workflows that the
// runbook's list never named, so a retention sweep would have written through
// the window. Every `.github/workflows/*.yml` with a `schedule:` trigger must
// now be either in the step 1 disable list or one of the watchdogs step 1
// names as staying enabled. The next scheduled workflow added fails here until
// the runbook says what happens to it during the window.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNBOOK = join(ROOT, 'docs/operations/CUTOVER-RUNBOOK.md');
const WORKFLOWS = join(ROOT, '.github/workflows');

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const backticked = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/** Workflow names (file name without .yml) whose YAML declares a `schedule:` trigger key. */
export function scheduledWorkflows(dir = WORKFLOWS) {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.yml'))
    .filter((file) => /^\s+schedule:/m.test(readFileSync(join(dir, file), 'utf8')))
    .map((file) => file.replace(/\.yml$/, ''))
    .sort();
}

/** The runbook text between two headings (the first heading included). */
function section(text, start, end) {
  const from = text.indexOf(start);
  assert.notEqual(from, -1, `the runbook has no "${start}" heading`);
  const to = text.indexOf(end, from + start.length);
  return text.slice(from, to === -1 ? undefined : to);
}

/** One numbered item of a section, by its number (the item's text up to the next item). */
function item(sectionText, number) {
  const match = new RegExp(`^${number}\\. [\\s\\S]*?(?=^\\d+\\. |^### |(?![\\s\\S]))`, 'm').exec(sectionText);
  assert.ok(match, `no item ${number}.`);
  return match[0];
}

/** Step 1 item 1: the workflows it disables and the ones it leaves enabled. */
export function parseFreezeList(text) {
  const freeze = item(section(text, '### Step 1. Freeze', '### Step 2.'), 1);
  const listStart = freeze.indexOf('the scheduled workflows');
  const listEnd = freeze.indexOf('(`gh workflow disable');
  assert.ok(listStart !== -1 && listEnd > listStart, 'step 1 item 1 names no "scheduled workflows ... (`gh workflow disable" list');
  const disabled = backticked(freeze.slice(listStart, listEnd)).filter((name) => NAME.test(name));
  const leave = /Leave [^.]*enabled\./.exec(freeze);
  assert.ok(leave, 'step 1 item 1 says nothing about which workflows stay enabled');
  const enabled = backticked(leave[0]).filter((name) => NAME.test(name));
  return { disabled, enabled, text: freeze };
}

test('every scheduled workflow is either frozen in step 1 or a watchdog it names as staying enabled', () => {
  const { disabled, enabled } = parseFreezeList(readFileSync(RUNBOOK, 'utf8'));
  const scheduled = scheduledWorkflows();
  assert.ok(scheduled.length > 0, 'no scheduled workflow found; the directory scan is broken');
  assert.deepEqual([...new Set(disabled)].length, disabled.length, 'the freeze list names a workflow twice');
  assert.deepEqual(disabled.filter((name) => enabled.includes(name)), [], 'a workflow is both frozen and left enabled');
  const listed = new Set([...disabled, ...enabled]);
  assert.deepEqual(scheduled.filter((name) => !listed.has(name)), [],
    'a scheduled workflow is missing from CUTOVER-RUNBOOK.md step 1: add it to the freeze list (or, for a read-only watchdog, to the workflows left enabled)');
  assert.deepEqual([...listed].filter((name) => !scheduled.includes(name)).sort(), [],
    'CUTOVER-RUNBOOK.md step 1 names a workflow that does not exist or has no schedule');
});

test('the two watchdogs stay enabled and the automatic migration path is stopped', () => {
  const { enabled, text } = parseFreezeList(readFileSync(RUNBOOK, 'utf8'));
  assert.deepEqual([...enabled].sort(), ['ops-job-watch', 'tutor-retention-watch']);
  assert.match(text, /`database-cd\.yml`/);
});

test('step 9 re-enables only workflows step 1 froze, and says so for all of them', () => {
  const text = readFileSync(RUNBOOK, 'utf8');
  const { disabled, enabled } = parseFreezeList(text);
  const reenable = item(section(text, '### Step 9. Switch', '### Step 10.'), 4);
  assert.match(reenable, /every workflow disabled in step 1/);
  const named = backticked(reenable).filter((name) => NAME.test(name));
  // A watchdog step 1 left enabled may be named (it reports what stays quiet); nothing else outside the freeze list.
  assert.deepEqual(named.filter((name) => !disabled.includes(name) && !enabled.includes(name)), [], 'step 9 names a workflow step 1 did not freeze');
  assert.match(reenable, /`database-cd\.yml`/);
});

test('the parser refuses a runbook whose freeze list lost a workflow', () => {
  const text = readFileSync(RUNBOOK, 'utf8').replace('`learning-retention`, ', '');
  const { disabled, enabled } = parseFreezeList(text);
  const listed = new Set([...disabled, ...enabled]);
  assert.deepEqual(scheduledWorkflows().filter((name) => !listed.has(name)), ['learning-retention']);
});
