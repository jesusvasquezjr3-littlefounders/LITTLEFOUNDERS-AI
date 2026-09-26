import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkReleaseGateParity, databaseGates, GATES, MANIFEST, MIGRATIONS } from './check-forge-release-gate-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gatesSource = readFileSync(path.join(ROOT, GATES), 'utf8');
const manifestSource = readFileSync(path.join(ROOT, MANIFEST), 'utf8');
const migrations = readdirSync(path.join(ROOT, MIGRATIONS))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((file) => ({ file, sql: readFileSync(path.join(ROOT, MIGRATIONS, file), 'utf8') }));
const real = { gatesSource, manifestSource, migrations };

test('the shipped Forge gates, release manifest and release_course requirements agree', () => {
  assert.deepEqual(checkReleaseGateParity(real), []);
});

test('RED when Forge gains a gate that the release manifest does not record', () => {
  // The union's last member is the newest gate; a gate after it with no release check must turn the parity red.
  const grown = gatesSource.replace('| 17 | 18 | 19;', '| 17 | 18 | 19 | 20;');
  assert.notEqual(grown, gatesSource);
  const problems = checkReleaseGateParity({ ...real, gatesSource: grown });
  assert.ok(problems.some((p) => p.includes('Forge gate 20') && p.includes('reach release unchecked')));
});

test('RED when the manifest records a check the database does not require', () => {
  const anchor = "  { id: 'forge.release.topic-titles',";
  assert.ok(manifestSource.includes(anchor));
  const problems = checkReleaseGateParity({
    ...real,
    manifestSource: manifestSource.replace(anchor, "  { id: 'forge.release.new-check', spec: ['G.2'], scope: 'course', exemptable: false, description: 'New' },\n" + anchor),
  });
  assert.ok(problems.some((p) => p.includes('forge.release.new-check') && p.includes('release_course would not enforce it')));
});

test('RED when the database requires a check verify:course never records', () => {
  const extra = { file: '9999_extra.sql', sql: "insert into public.forge_release_gates (gate_id, gate_number, spec_refs, description) values ('forge.release.ghost', null, array['G.2'], 'Ghost');" };
  const problems = checkReleaseGateParity({ ...real, migrations: [...migrations, extra] });
  assert.ok(problems.some((p) => p.includes('forge.release.ghost') && p.includes('every release would be refused')));
});

test('a later migration can retire a requirement', () => {
  const rows = databaseGates([
    { sql: "insert into public.forge_release_gates (gate_id, gate_number) values ('forge.gate.01.contract', 1), ('forge.catalog.loads', null) on conflict (gate_id) do nothing;" },
    { sql: "delete from public.forge_release_gates where gate_id = 'forge.catalog.loads';" },
  ]);
  assert.deepEqual([...rows.entries()], [['forge.gate.01.contract', 1]]);
});

test('RED when a gate number disagrees between the manifest and the database', () => {
  const problems = checkReleaseGateParity({
    ...real,
    manifestSource: manifestSource.replace("id: 'forge.gate.12.tone', gate: 12,", "id: 'forge.gate.12.tone', gate: 13,"),
  });
  assert.ok(problems.some((p) => p.includes('forge.gate.12.tone') && p.includes('gate number differs')));
});
