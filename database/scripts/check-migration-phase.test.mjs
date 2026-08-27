// check-migration-phase.test.mjs — the phase gate, run against KNOWN-BAD input.
//
// A checker nobody has watched fail is a checker nobody knows works. Each case
// here is a mistake that is easy to make and expensive to miss, and the gate has
// to reject it for the stated reason rather than merely exit non-zero.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATE = fileURLToPath(new URL('./check-migration-phase.mjs', import.meta.url));

/** Run the gate against a throwaway directory of fixtures. */
function run(files) {
  const dir = mkdtempSync(join(tmpdir(), 'lf-phase-'));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    try {
      const stdout = execFileSync(process.execPath, [GATE], {
        env: { ...process.env, MIGRATIONS_DIR: dir },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out: stdout };
    } catch (err) {
      return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const EXPAND = '-- @phase: expand\nALTER TABLE public.t ADD COLUMN IF NOT EXISTS c text;\n';

test('an undeclared APPLIED migration is classified, never demanded to change', () => {
  /*
   * THE EXPENSIVE ONE. `railway-migrate.sh` records a SHA-256 of every applied
   * file and refuses to run when one no longer matches ("migration drift
   * detected"). Stamping a phase header onto the 48 files already in
   * production changed all 48 checksums and would have bricked the migrator on
   * its next run - caught by diffing hashes against HEAD, not in production.
   *
   * An applied migration is immutable down to its comments (/AGENTS.md §1.3),
   * so at or below the high-water mark the gate DERIVES the phase and asks for
   * nothing.
   */
  const r = run({ '0001_x.sql': 'ALTER TABLE public.t DROP COLUMN c;\n' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /0 expand, 1 contract/);
});

test('an undeclared UNAPPLIED migration is rejected', () => {
  const r = run({ '0060_x.sql': 'ALTER TABLE public.t ADD COLUMN c text;\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /no "-- @phase/);
});

test('a purely additive migration declared expand passes', () => {
  const r = run({ '0060_x.sql': EXPAND });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 expand, 0 contract/);
});

test('THE CENTRAL CASE: a file that claims expand while dropping a column is rejected', () => {
  // This is `0049` with the wrong label, and the mistake the whole gate exists
  // to stop: applied before its release, the column goes while an older deploy
  // still names it and PostgREST rejects every write that does.
  const r = run({ '0060_x.sql': '-- @phase: expand\nALTER TABLE public.t DROP COLUMN c;\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /declares "@phase: expand" but drops a column/);
});

test('a narrowed CHECK counts as a contraction even though it is re-added', () => {
  // Migration 0025 in the real tree: three event kinds deleted and the
  // constraint re-added without them. "Re-added" is not "unchanged".
  const sql =
    '-- @phase: expand\n' +
    'alter table public.t drop constraint if exists t_check;\n' +
    "alter table public.t add constraint t_check check (e in ('a','b'));\n";
  const r = run({ '0060_x.sql': sql });
  assert.equal(r.code, 1);
  assert.match(r.out, /narrows a CHECK constraint/);
});

test('the idempotent DROP POLICY / CREATE POLICY idiom is NOT a contraction', () => {
  // Eleven real migrations use this. Flagging it would make the gate noise,
  // and a noisy gate is one people learn to override.
  const sql =
    '-- @phase: expand\n' +
    'DROP POLICY IF EXISTS p ON public.t;\n' +
    'CREATE POLICY p ON public.t FOR SELECT USING (true);\n';
  const r = run({ '0060_x.sql': sql });
  assert.equal(r.code, 0, r.out);
});

test('a contract migration with no @after-release is rejected', () => {
  const r = run({ '0060_x.sql': '-- @phase: contract\nALTER TABLE public.t DROP COLUMN c;\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /requires an "-- @after-release:"/);
});

test('an UNAPPLIED contraction may not hide behind "historical"', () => {
  // 0049 is above the high-water mark, so it has to name the release that
  // removed the last reader. "historical" is only true of what already shipped.
  const sql =
    '-- @phase: contract\n' +
    '-- @after-release: historical (applied before this convention existed)\n' +
    'ALTER TABLE public.t DROP COLUMN c;\n';
  const r = run({ '0049_x.sql': sql });
  assert.equal(r.code, 1);
  assert.match(r.out, /must name the release/);
});

test('an unapplied contraction that names its release passes, and is REPORTED', () => {
  const sql =
    '-- @phase: contract\n' +
    '-- @after-release: 9b75bab7 (Core stopped sending the field)\n' +
    'ALTER TABLE public.t DROP COLUMN c;\n';
  const r = run({ '0049_x.sql': sql });
  assert.equal(r.code, 0, r.out);
  // Passing quietly would defeat the point: an operator about to dispatch a
  // migration needs to see which of them cannot go before a deploy.
  assert.match(r.out, /must NOT be applied before their release is live/);
  assert.match(r.out, /0049_x\.sql/);
});

test('the real migration tree passes its own gate', () => {
  const r = run({});
  // An empty fixture dir proves the harness; the real tree is checked by
  // `npm test` in database/. This asserts the gate is runnable and silent on
  // nothing, so a green run on the real tree means something.
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /0 file\(s\)/);
});
