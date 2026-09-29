import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkManifest, checkMentorCanaryParity, FILES, renderCoreTables, tier2Table } from './check-mentor-canary-parity.mjs';

/*
 * GAP-FIX-R3 (C.22, Appendix F Stage 5): the canary delivery path agrees
 * with itself — the registry's Tier 2 bounds, the manifest, both generated
 * tables, the arms and the migration CHECK — and turns red on each drift.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const migrationName = readdirSync(path.join(ROOT, 'database/migrations')).find((f) => /_mentor_canary_arm\.sql$/.test(f));
const migration = readFileSync(path.join(ROOT, 'database/migrations', migrationName), 'utf8');
const EXP = '55555555-5555-4555-8555-000000000001';
const PROPOSAL = 'P-2026-10-01-latency-z';
const proposalIds = new Set([PROPOSAL]);

const readWith = (patch = {}) => (f) => (f in patch ? patch[f] : real[f]);
const manifestWith = (canaries, extra = {}) => JSON.stringify({ ...JSON.parse(real[FILES.manifest]), ...extra, canaries });
const entry = (over = {}) => ({ experimentId: EXP, proposalId: PROPOSAL, share: 0.05, status: 'running', overrides: { 'telemetry.latencyZ': 1.7 }, ...over });
const rows = tier2Table(JSON.parse(real[FILES.registry])).rows;

test('the shipped repo agrees with itself across every copy', () => {
  assert.deepEqual(checkMentorCanaryParity(readWith(), { proposalIds, migration }), []);
});

test('the table is the registry (a vacuous pass is a failure)', () => {
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.find((r) => r.id === 'telemetry.latencyZ'), { id: 'telemetry.latencyZ', object: 'TELEMETRY_DEFAULTS', field: 'latencyZ', min: 1, max: 2.5, integer: false });
  assert.match(real[FILES.coreTables], /'selfExplanation\.minSpacingTurns': \{ min: 2, max: 6, integer: true \}/);
});

test('a running canary is generated into Core; a concluded one never is', () => {
  const manifest = JSON.parse(manifestWith([entry(), entry({ experimentId: '55555555-5555-4555-8555-000000000002', proposalId: 'P-2026-09-01-old', status: 'concluded' })]));
  const core = renderCoreTables(rows, manifest);
  assert.match(core, new RegExp(`experimentId: '${EXP}', proposalId: '${PROPOSAL}', share: 0.05, overrides: \\{ 'telemetry.latencyZ': 1.7 \\}`));
  assert.doesNotMatch(core, /P-2026-09-01-old/);
});

test('RED when a generated table is stale (the registry or the manifest moved without --write)', () => {
  const registry = JSON.parse(real[FILES.registry]);
  registry.tier2Parameters[0].bounds = [1, 2.2];
  const problems = checkMentorCanaryParity(readWith({ [FILES.registry]: JSON.stringify(registry) }), { proposalIds, migration });
  assert.ok(problems.some((p) => p.includes('tier2Parameters.generated.ts is stale')));
  assert.ok(problems.some((p) => p.includes('mentorCanaryTables.generated.ts is stale')));
  const manifestOnly = checkMentorCanaryParity(readWith({ [FILES.manifest]: manifestWith([entry()]) }), { proposalIds, migration });
  assert.ok(manifestOnly.some((p) => p.includes('mentorCanaryTables.generated.ts is stale')));
});

test('RED on every manifest entry a canary may not carry', () => {
  const red = (canaries, text, extra = {}) => {
    const problems = checkManifest(JSON.parse(manifestWith(canaries, extra)), rows, proposalIds);
    assert.ok(problems.some((p) => p.includes(text)), `${text}: ${JSON.stringify(problems)}`);
  };
  red([entry({ overrides: { 'telemetry.windowSize': 5 } })], 'only tier2Parameters may be canaried');
  red([entry({ overrides: { 'telemetry.latencyZ': 3 } })], 'outside its approved bounds');
  red([entry({ overrides: { 'telemetry.maxCheckIns': 2.5 } })], 'must be an integer');
  red([entry({ overrides: {} })], 'a canary that changes nothing is a control');
  red([entry({ share: 0.2 })], 'share must be in (0, maxShare]');
  red([], 'maxShare must be in (0, 0.1]', { maxShare: 0.5 });
  red([entry({ status: 'paused' })], 'status must be one of running, concluded');
  red([entry(), entry({ proposalId: 'P-2026-10-02-other' })], 'is listed twice');
  red([entry(), entry({ experimentId: '55555555-5555-4555-8555-000000000009' })], 'has two canaries');
  red([entry({ proposalId: 'P-2026-10-03-ghost' })], 'has no record in');
  red([entry({ experimentId: 'exp-1' })], "the H.7 experiment's uuid");
  red([], 'target must be mentor.canary', { target: 'mentor.dialogue-register' });
  assert.deepEqual(checkManifest(JSON.parse(manifestWith([entry()])), rows, proposalIds), []);
});

test('RED when Oracle stops applying a registered object, or an arm vocabulary drifts', () => {
  const dropped = real[FILES.oracleCanary].replaceAll('SELF_EXPLANATION_DEFAULTS', 'SELF_EXPLANATION_BASE');
  assert.ok(checkMentorCanaryParity(readWith({ [FILES.oracleCanary]: dropped }), { proposalIds, migration }).some((p) => p.includes('never applies SELF_EXPLANATION_DEFAULTS')));
  const arms = real[FILES.coreCanary].replace("CANARY_ARMS = ['canary', 'control']", "CANARY_ARMS = ['canary', 'control', 'holdout']");
  assert.ok(checkMentorCanaryParity(readWith({ [FILES.coreCanary]: arms }), { proposalIds, migration }).some((p) => p.includes('CANARY_ARMS')));
  const target = real[FILES.coreCanary].replace('target: MENTOR_CANARY_TARGET, age });', "target: 'mentor.dialogue-register', age });");
  assert.ok(checkMentorCanaryParity(readWith({ [FILES.coreCanary]: target }), { proposalIds, migration }).some((p) => p.includes('must ask the H.7 runtime for MENTOR_CANARY_TARGET')));
});

test('RED when the migration CHECK disagrees with the arms, or is missing', () => {
  const drift = migration.replace("canary_arm IN ('canary', 'control')", "canary_arm IN ('canary')");
  assert.ok(checkMentorCanaryParity(readWith(), { proposalIds, migration: drift }).some((p) => p.includes('the canary_arm CHECK')));
  assert.ok(checkMentorCanaryParity(readWith(), { proposalIds, migration: null }).some((p) => p.includes('no *_mentor_canary_arm.sql migration')));
});
