// gate-auto-apply.test.mjs — the decision that lets a machine touch production.
//
// Every case here is written from the same angle: what input would make this
// say `apply=true` when it should not? That is the only failure mode that
// matters, because the other one costs a manual dispatch and this one costs a
// database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATE = fileURLToPath(new URL('./gate-auto-apply.mjs', import.meta.url));

function run({ migrations = {}, dryRun }) {
  const dir = mkdtempSync(join(tmpdir(), 'lf-auto-'));
  try {
    for (const [name, body] of Object.entries(migrations)) writeFileSync(join(dir, name), body);
    const probe = join(dir, 'probe.txt');
    if (dryRun !== undefined) writeFileSync(probe, dryRun);
    const out = execFileSync(process.execPath, [GATE, ...(dryRun === undefined ? [] : [probe])], {
      env: { ...process.env, MIGRATIONS_DIR: dir },
      encoding: 'utf8',
    });
    return {
      apply: /^apply=(\w+)$/m.exec(out)?.[1],
      reason: /^reason=(.*)$/m.exec(out)?.[1] ?? '',
      out,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const OK = '\nOK: dry-run complete\n';
const EXPAND = '-- @phase: expand\nALTER TABLE public.t ADD COLUMN IF NOT EXISTS c text;\n';
const CONTRACT =
  '-- @phase: contract\n-- @after-release: abc1234\nALTER TABLE public.t DROP COLUMN c;\n';

test('all-additive pending → apply', () => {
  const r = run({
    migrations: { '0060_a.sql': EXPAND, '0061_b.sql': EXPAND },
    dryRun: `skip 0059_x.sql (recorded)\npending 0060_a.sql\npending 0061_b.sql${OK}`,
  });
  assert.equal(r.apply, 'true');
  assert.match(r.out, /pending=2/);
});

test('ONE contraction anywhere in the batch blocks the whole run', () => {
  // Not "apply the additive ones and stop": the migrator applies in filename
  // order and a half-applied batch is a state nobody planned for.
  const r = run({
    migrations: { '0060_a.sql': EXPAND, '0061_b.sql': CONTRACT },
    dryRun: `pending 0060_a.sql\npending 0061_b.sql${OK}`,
  });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /0061_b\.sql \(declared contract\)/);
});

test('a file that LIES about being additive is still blocked', () => {
  // The declaration is a promise; the derivation is the check on it. This is
  // the case where the authoring gate was bypassed or a merge went wrong.
  const lying = '-- @phase: expand\nALTER TABLE public.t DROP COLUMN c;\n';
  const r = run({ migrations: { '0060_a.sql': lying }, dryRun: `pending 0060_a.sql${OK}` });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /derived contract/);
});

test('a truncated or failed dry-run is never trusted', () => {
  // No "OK: dry-run complete" means the probe did not finish, so the pending
  // list is not the pending list.
  const r = run({ migrations: { '0060_a.sql': EXPAND }, dryRun: 'pending 0060_a.sql\n' });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /dry-run did not complete/);
});

test('a pending file this checkout does not have refuses', () => {
  // The remote ledger and the repository disagree. Any reading of that other
  // than "stop" is a guess about production.
  const r = run({ migrations: {}, dryRun: `pending 0060_ghost.sql${OK}` });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /not in this checkout/);
});

test('a pending file with no phase header refuses', () => {
  const r = run({
    migrations: { '0060_a.sql': 'ALTER TABLE public.t ADD COLUMN c text;\n' },
    dryRun: `pending 0060_a.sql${OK}`,
  });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /declares no phase/);
});

test('nothing pending is not an apply', () => {
  const r = run({ migrations: {}, dryRun: `skip 0001_x.sql (recorded)${OK}` });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /nothing is pending/);
});

test('no input at all refuses rather than throwing', () => {
  const r = run({ migrations: {} });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /no dry-run output/);
});

test('a pending contraction blocks auto-apply, whichever migration it is', () => {
  /*
   * `0049` was the live case when this was written and was applied on
   * 2026-08-27. The fixture is synthetic now, and deliberately so: pointing at
   * a real APPLIED migration would be pointing at an impossible state, since a
   * pending file is by definition unapplied and therefore carries a header.
   * The property under test is permanent regardless of which migration is
   * waiting.
   */
  const r = run({ migrations: { '0060_x.sql': CONTRACT }, dryRun: `pending 0060_x.sql${OK}` });
  assert.equal(r.apply, 'false');
  assert.match(r.reason, /contract/);
});

test('THE TWO CLASSIFIERS AGREE, because one guards authoring and the other guards production', () => {
  /*
   * `check-migration-phase.mjs` and `gate-auto-apply.mjs` keep SEPARATE copies
   * of the contraction patterns on purpose: one is the authoring gate, the
   * other is the safety decision, and a shared import could change both at
   * once without anyone noticing. The comment in gate-auto-apply.mjs claims the
   * self-tests assert they agree — this is that assertion, and it did not exist
   * until the claim was checked.
   *
   * If they ever diverge, a migration could pass authoring as additive and then
   * be refused by the CD, or worse, the reverse.
   */
  const list = (file) => {
    const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
    const block = /const CONTRACTIONS = \[([\s\S]*?)\n\];/.exec(src);
    assert.ok(block, `${file}: no CONTRACTIONS array found`);
    // Compare the patterns and their reasons, ignoring whitespace and comments.
    return block[1]
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 0 && !l.startsWith('//'));
  };
  assert.deepEqual(list('./gate-auto-apply.mjs'), list('./check-migration-phase.mjs'));
});
