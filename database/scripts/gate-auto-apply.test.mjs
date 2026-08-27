// gate-auto-apply.test.mjs — the decision that lets a machine touch production.
//
// Every case here is written from the same angle: what input would make this
// say `apply=true` when it should not? That is the only failure mode that
// matters, because the other one costs a manual dispatch and this one costs a
// database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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

test('the real tree: 0049 is pending and MUST block auto-apply', () => {
  // The live case at the time of writing. If this ever flips to true without
  // 0049 being applied, the classifier has regressed.
  const dir = fileURLToPath(new URL('../migrations', import.meta.url));
  const probe = mkdtempSync(join(tmpdir(), 'lf-real-'));
  try {
    const f = join(probe, 'p.txt');
    writeFileSync(f, `pending 0049_drop_parent_verification_address.sql${OK}`);
    const out = execFileSync(process.execPath, [GATE, f], {
      env: { ...process.env, MIGRATIONS_DIR: dir },
      encoding: 'utf8',
    });
    assert.match(out, /apply=false/);
    assert.match(out, /contract/);
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
});
