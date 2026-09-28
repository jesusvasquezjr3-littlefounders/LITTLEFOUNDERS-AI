#!/usr/bin/env node
/**
 * EVERY FORGE GATE IS PART OF THE RELEASE PREFLIGHT (S05.4c; Product G.2,
 * Appendix C Part 3 Stage 2).
 *
 * Three hand-written lists must agree, and they live in two packages that
 * share no code (no workspaces):
 *
 *   1. coursegen/src/pipeline/gates.ts `GateNumber` — every Forge document gate;
 *   2. coursegen/src/release/gateManifest.ts `FORGE_RELEASE_CHECKS` — what
 *      verify:course records in a course's release attestation (plus
 *      `GENERATION_ONLY_GATES`, the gates it cannot evaluate, each with a reason);
 *   3. database/migrations/*.sql rows of `public.forge_release_gates` — what
 *      Vault's release_course preflight requires before any course release,
 *      whether the release comes from Core's staff route or the local
 *      publish command.
 *
 * Drift in either direction is a defect nobody would see: a Forge gate with no
 * release check ships content the gate would refuse; a database requirement
 * Forge never records makes every release impossible. This gate fails on both.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const GATES = 'coursegen/src/pipeline/gates.ts';
export const MANIFEST = 'coursegen/src/release/gateManifest.ts';
export const MIGRATIONS = 'database/migrations';
export const V2_RELEASE = 'coursegen/src/v2/release.ts';

/** Gate numbers of the `GateNumber` union in gates.ts. */
export function gateNumbers(source) {
  const match = /export type GateNumber\s*=\s*([^;]+);/.exec(source);
  if (!match) return null;
  return [...match[1].matchAll(/\d+/g)].map((m) => Number(m[0])).sort((a, b) => a - b);
}

/** { id, gate? } entries of FORGE_RELEASE_CHECKS, and the GENERATION_ONLY_GATES keys. */
export function manifestEntries(source) {
  const start = source.indexOf('export const FORGE_RELEASE_CHECKS');
  const end = start === -1 ? -1 : source.indexOf('];', start);
  if (start === -1 || end === -1) return null;
  const entries = [...source.slice(start, end).matchAll(/\{\s*id:\s*'([^']+)'(?:,\s*gate:\s*(\d+))?/g)].map((m) => ({
    id: m[1],
    ...(m[2] ? { gate: Number(m[2]) } : {}),
  }));
  const genStart = source.indexOf('export const GENERATION_ONLY_GATES');
  const genEnd = genStart === -1 ? -1 : source.indexOf('};', genStart);
  const generationOnly =
    genStart === -1 || genEnd === -1
      ? []
      : [...source.slice(source.indexOf('{', source.indexOf('=', genStart)), genEnd).matchAll(/^\s*(\d+):\s*'[^']{20,}'/gm)].map((m) => Number(m[1]));
  return { entries, generationOnly };
}

/** gate_id → gate_number (null for non-gate checks), applying every migration in order. */
export function databaseGates(migrations) {
  const rows = new Map();
  for (const { sql } of migrations) {
    for (const block of sql.matchAll(/insert\s+into\s+public\.forge_release_gates\s*\([^)]*\)\s*values([\s\S]*?)(?:on\s+conflict|;)/gi)) {
      for (const row of block[1].matchAll(/\(\s*'(forge\.[^']+)'\s*,\s*(null|\d+)/gi)) {
        rows.set(row[1], row[2].toLowerCase() === 'null' ? null : Number(row[2]));
      }
    }
    for (const removed of sql.matchAll(/delete\s+from\s+public\.forge_release_gates\s+where\s+gate_id\s*(?:=|in)\s*\(?([^;]+)/gi)) {
      for (const id of removed[1].matchAll(/'(forge\.[^']+)'/g)) rows.delete(id[1]);
    }
  }
  return rows;
}

export function checkReleaseGateParity({ gatesSource, manifestSource, migrations }) {
  const problems = [];
  const numbers = gateNumbers(gatesSource);
  const manifest = manifestEntries(manifestSource);
  if (!numbers) return [`${GATES}: GateNumber union not found`];
  if (!manifest) return [`${MANIFEST}: FORGE_RELEASE_CHECKS not found`];
  const db = databaseGates(migrations);
  if (db.size === 0) problems.push(`${MIGRATIONS}: no public.forge_release_gates rows are seeded`);

  const ids = manifest.entries.map((e) => e.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) problems.push(`${MANIFEST}: duplicate release check ids ${[...new Set(duplicates)].join(', ')}`);

  for (const gate of numbers) {
    const wired = manifest.entries.some((e) => e.gate === gate);
    const generationOnly = manifest.generationOnly.includes(gate);
    if (!wired && !generationOnly) {
      problems.push(`Forge gate ${gate} (${GATES}) has no release check in ${MANIFEST} and no GENERATION_ONLY_GATES reason: its content would reach release unchecked`);
    }
    if (wired && generationOnly) problems.push(`Forge gate ${gate} is both a release check and generation-only in ${MANIFEST}`);
  }
  for (const entry of manifest.entries) {
    if (entry.gate !== undefined && !numbers.includes(entry.gate)) problems.push(`${MANIFEST}: ${entry.id} names gate ${entry.gate}, which ${GATES} does not define`);
    if (!db.has(entry.id)) problems.push(`${entry.id} is recorded by verify:course but not required by ${MIGRATIONS} (forge_release_gates): release_course would not enforce it`);
    else if ((db.get(entry.id) ?? undefined) !== entry.gate) {
      problems.push(`${entry.id}: gate number differs (manifest ${entry.gate ?? 'none'}, database ${db.get(entry.id) ?? 'none'})`);
    }
  }
  for (const id of db.keys()) {
    if (!ids.includes(id)) problems.push(`${id} is required by ${MIGRATIONS} but verify:course never records it: every release would be refused`);
  }
  return problems;
}

/**
 * GAP-FIX-R2 learning (Appendix C Stage 2; G.2): the gates a v2 publication
 * manifest attests (Forge's V2_MANIFEST_GATES) and the gates Vault's
 * publish_v2_lesson_version requires (rows of public.forge_v2_manifest_gates)
 * must be the same list, or a v2 lesson publishes around a gate (or never).
 */
export function v2ManifestGates(source) {
  const start = source.indexOf('export const V2_MANIFEST_GATES');
  const end = start === -1 ? -1 : source.indexOf('.includes(id))', start);
  if (start === -1 || end === -1) return null;
  return [...source.slice(start, end).matchAll(/'(forge\.[^']+)'/g)].map((m) => m[1]).sort();
}

export function databaseV2ManifestGates(migrations) {
  const rows = new Set();
  for (const { sql } of migrations) {
    for (const block of sql.matchAll(/insert\s+into\s+public\.forge_v2_manifest_gates\s*\([^)]*\)\s*values([\s\S]*?)(?:on\s+conflict|;)/gi)) {
      for (const row of block[1].matchAll(/'(forge\.[^']+)'/g)) rows.add(row[1]);
    }
    for (const removed of sql.matchAll(/delete\s+from\s+public\.forge_v2_manifest_gates\s+where\s+gate_id\s*(?:=|in)\s*\(?([^;]+)/gi)) {
      for (const id of removed[1].matchAll(/'(forge\.[^']+)'/g)) rows.delete(id[1]);
    }
  }
  return [...rows].sort();
}

export function checkV2ManifestParity({ releaseSource, migrations }) {
  const forge = v2ManifestGates(releaseSource);
  if (!forge) return [`${V2_RELEASE}: V2_MANIFEST_GATES not found`];
  const db = databaseV2ManifestGates(migrations);
  const problems = [];
  for (const id of forge) if (!db.includes(id)) problems.push(`${id} is attested by Forge's v2 manifest but not required by public.forge_v2_manifest_gates: a v2 publication could skip it`);
  for (const id of db) if (!forge.includes(id)) problems.push(`${id} is required for a v2 publication but Forge's v2 manifest never attests it: every v2 publication would be refused`);
  return problems;
}

function loadMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: readFileSync(path.join(dir, file), 'utf8') }));
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const migrations = loadMigrations(path.join(ROOT, MIGRATIONS));
  const problems = [
    ...checkReleaseGateParity({
      gatesSource: readFileSync(path.join(ROOT, GATES), 'utf8'),
      manifestSource: readFileSync(path.join(ROOT, MANIFEST), 'utf8'),
      migrations,
    }),
    ...checkV2ManifestParity({ releaseSource: readFileSync(path.join(ROOT, V2_RELEASE), 'utf8'), migrations }),
  ];
  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL: ${problem}`);
    process.exit(1);
  }
  const count = manifestEntries(readFileSync(path.join(ROOT, MANIFEST), 'utf8')).entries.length;
  console.log(`forge release-gate parity OK — ${count} release checks recorded by verify:course and required by release_course`);
}
