#!/usr/bin/env node
/**
 * C.22 / Appendix F Part 3 Stage 5 — THE CANARY DELIVERY PATH, IN EVERY COPY.
 *
 * A Tier 2 change reaches a small share of real Mentor sessions first as an
 * H.7 experiment arm (surface `tutor`, target `mentor.canary`). The pieces
 * are hand-owned in three places and generated into two:
 *
 *   Source  docs/rebuild/mentor/governance/registry.json   tier2Parameters: id, object, field, bounds, integer
 *           docs/rebuild/mentor/governance/canaries.json   the running canaries: experiment, proposal, share, overrides
 *   Oracle  oracle/src/tutor/tier2Parameters.generated.ts  GENERATED: the id / bounds table Oracle clamps against
 *           oracle/src/tutor/mentorCanary.ts               applies overrides to the three config objects
 *   Core    backend/src/services/pedagogy/mentorCanaryTables.generated.ts
 *                                                           GENERATED: the same table plus the manifest
 *           backend/src/services/pedagogy/mentorCanary.ts  resolves the arm at session start, records it at close
 *   DB      database/migrations/*_mentor_canary_arm.sql    tutor_sessions.canary_arm CHECK
 *
 * A drift fails in the worst direction: Oracle clamps to bounds the registry
 * no longer approves, Core sends an override Oracle refuses (the canary never
 * runs while the record says it did), or a CHECK refuses the arm Core stores
 * (the canary-vs-control reading silently loses its sessions). This gate
 * fails first.
 *
 *   node agent/tools/check-mentor-canary-parity.mjs           check (CI: repo-gates, `npm run canary:check`)
 *   node agent/tools/check-mentor-canary-parity.mjs --write   regenerate the two generated files
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constArray } from './check-behavioral-telemetry-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  registry: 'docs/rebuild/mentor/governance/registry.json',
  manifest: 'docs/rebuild/mentor/governance/canaries.json',
  oracleTable: 'oracle/src/tutor/tier2Parameters.generated.ts',
  oracleCanary: 'oracle/src/tutor/mentorCanary.ts',
  coreTables: 'backend/src/services/pedagogy/mentorCanaryTables.generated.ts',
  coreCanary: 'backend/src/services/pedagogy/mentorCanary.ts',
};
export const PROPOSALS_DIR = 'docs/rebuild/mentor/governance/proposals';
export const CANARY_TARGET = 'mentor.canary';
export const CANARY_SURFACE = 'tutor';
/** The arms, in the order every copy declares them. */
export const CANARY_ARMS = ['canary', 'control'];
/** running: Core delivers it; concluded: kept as the Stage 5 record, never delivered. */
export const CANARY_STATUSES = ['running', 'concluded'];
/** A canary is a SMALL share: no manifest may raise the ceiling past this. */
export const MAX_SHARE_CEILING = 0.1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROPOSAL_ID = /^P-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

const readText = (f) => {
  try {
    return readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    return null;
  }
};
const parse = (text) => {
  try {
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
};

/** The registry's Tier 2 parameters as the generated table rows, or problems. */
export function tier2Table(registry) {
  const problems = [];
  const rows = [];
  const seen = new Set();
  for (const p of registry?.tier2Parameters ?? []) {
    const where = `tier2Parameters ${p.id ?? '(no id)'}`;
    if (typeof p.id !== 'string' || !/^[a-zA-Z]+\.[a-zA-Z]+$/.test(p.id)) problems.push(`${where}: the id must be <component>.<field>`);
    if (seen.has(p.id)) problems.push(`${where}: listed twice`);
    seen.add(p.id);
    const [min, max] = Array.isArray(p.bounds) ? p.bounds : [];
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) problems.push(`${where}: bounds must be [min, max] numbers`);
    if (typeof p.integer !== 'boolean') problems.push(`${where}: must say whether the value is an integer ("integer": true|false)`);
    if (p.integer === true && (!Number.isInteger(min) || !Number.isInteger(max))) problems.push(`${where}: an integer parameter needs integer bounds`);
    if (typeof p.object !== 'string' || typeof p.field !== 'string') problems.push(`${where}: names its object and field`);
    rows.push({ id: p.id, object: p.object, field: p.field, min, max, integer: p.integer === true });
  }
  if (rows.length === 0) problems.push('the registry lists no Tier 2 parameters: the canary path would carry nothing');
  return { rows, problems };
}

/** Every rule a canary entry must satisfy (the governance gate reuses it). */
export function checkManifest(manifest, table, proposalIds) {
  const problems = [];
  if (manifest?.kind !== 'mentor-canary-manifest') return ['canaries.json is not a mentor-canary-manifest'];
  if (manifest.target !== CANARY_TARGET) problems.push(`canaries.json target must be ${CANARY_TARGET}`);
  if (manifest.surface !== CANARY_SURFACE) problems.push(`canaries.json surface must be ${CANARY_SURFACE}`);
  if (!(typeof manifest.maxShare === 'number' && manifest.maxShare > 0 && manifest.maxShare <= MAX_SHARE_CEILING)) {
    problems.push(`canaries.json maxShare must be in (0, ${MAX_SHARE_CEILING}]: a canary is a small share of real sessions`);
  }
  if (!Array.isArray(manifest.canaries)) return [...problems, 'canaries.json canaries must be a list'];
  const byId = new Map(table.map((r) => [r.id, r]));
  const experiments = new Set();
  const proposals = new Set();
  for (const [i, c] of manifest.canaries.entries()) {
    const where = `canaries[${i}]`;
    if (!UUID.test(c?.experimentId ?? '')) problems.push(`${where}: experimentId must be the H.7 experiment's uuid`);
    else if (experiments.has(c.experimentId)) problems.push(`${where}: experiment ${c.experimentId} is listed twice`);
    experiments.add(c?.experimentId);
    if (!PROPOSAL_ID.test(c?.proposalId ?? '')) problems.push(`${where}: proposalId must be P-YYYY-MM-DD-<slug>`);
    else {
      if (proposals.has(c.proposalId)) problems.push(`${where}: proposal ${c.proposalId} has two canaries`);
      if (proposalIds && !proposalIds.has(c.proposalId)) problems.push(`${where}: proposal ${c.proposalId} has no record in ${PROPOSALS_DIR}`);
    }
    proposals.add(c?.proposalId);
    if (!(typeof c?.share === 'number' && c.share > 0 && c.share <= (manifest.maxShare ?? 0))) problems.push(`${where}: share must be in (0, maxShare]`);
    if (!CANARY_STATUSES.includes(c?.status)) problems.push(`${where}: status must be one of ${CANARY_STATUSES.join(', ')} (a concluded canary stays listed as the proposal's Stage 5 evidence)`);
    const overrides = c?.overrides;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || Object.keys(overrides).length === 0) {
      problems.push(`${where}: overrides must name at least one Tier 2 parameter (a canary that changes nothing is a control)`);
      continue;
    }
    for (const [key, value] of Object.entries(overrides)) {
      const row = byId.get(key);
      if (!row) {
        problems.push(`${where}: ${key} is not a registered Tier 2 parameter — only tier2Parameters may be canaried`);
        continue;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${where}: ${key} must be a number`);
      else if (value < row.min || value > row.max) problems.push(`${where}: ${key} = ${value} is outside its approved bounds [${row.min}, ${row.max}]`);
      else if (row.integer && !Number.isInteger(value)) problems.push(`${where}: ${key} must be an integer`);
    }
  }
  return problems;
}

const HEADER = (source) =>
  `/*\n * GENERATED by agent/tools/check-mentor-canary-parity.mjs --write from\n * ${source}. Do not edit by hand: \`npm run canary:check\` fails on any drift.\n */\n`;

const tableLiteral = (rows, withLocation) =>
  rows
    .map((r) => {
      const where = withLocation ? ` object: '${r.object}', field: '${r.field}',` : '';
      return `  '${r.id}': {${where} min: ${r.min}, max: ${r.max}, integer: ${r.integer} },`;
    })
    .join('\n');

export function renderOracleTable(rows) {
  return (
    HEADER('docs/rebuild/mentor/governance/registry.json (tier2Parameters)') +
    `\nexport interface Tier2ParameterBounds {\n  object: 'TELEMETRY_DEFAULTS' | 'ALLIANCE_DEFAULTS' | 'SELF_EXPLANATION_DEFAULTS';\n  field: string;\n  min: number;\n  max: number;\n  integer: boolean;\n}\n\n` +
    `/** C.22 Tier 2 parameters: the only values a Stage 5 canary may override, and their approved bounds. */\n` +
    `export const TIER2_PARAMETERS = {\n${tableLiteral(rows, true)}\n} as const satisfies Record<string, Tier2ParameterBounds>;\n\n` +
    `export type Tier2ParameterId = keyof typeof TIER2_PARAMETERS;\n`
  );
}

const canaryLiteral = (manifest) =>
  (manifest?.canaries ?? [])
    .filter((c) => c.status === 'running')
    .map((c) => {
      const overrides = Object.entries(c.overrides ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `'${k}': ${v}`)
        .join(', ');
      return `  { experimentId: '${c.experimentId}', proposalId: '${c.proposalId}', share: ${c.share}, overrides: { ${overrides} } },`;
    })
    .join('\n');

export function renderCoreTables(rows, manifest) {
  const canaries = canaryLiteral(manifest);
  return (
    HEADER('docs/rebuild/mentor/governance/registry.json (tier2Parameters) and canaries.json') +
    `\nexport interface Tier2ParameterBounds {\n  min: number;\n  max: number;\n  integer: boolean;\n}\n\n` +
    `export interface MentorCanaryEntry {\n  experimentId: string;\n  proposalId: string;\n  share: number;\n  overrides: Readonly<Record<string, number>>;\n}\n\n` +
    `/** C.22 Tier 2 parameters: the only values a Stage 5 canary may override, and their approved bounds. */\n` +
    `export const TIER2_PARAMETERS: Readonly<Record<string, Tier2ParameterBounds>> = {\n${tableLiteral(rows, false)}\n};\n\n` +
    `export const MENTOR_CANARY_TARGET = '${manifest?.target ?? CANARY_TARGET}';\n` +
    `export const MENTOR_CANARY_MAX_SHARE = ${manifest?.maxShare ?? 0};\n\n` +
    `/** The RUNNING canaries (Appendix F Stage 5); empty while no Tier 2 change is in canary. A concluded one is never delivered. */\n` +
    `export const MENTOR_CANARIES: readonly MentorCanaryEntry[] = [${canaries ? `\n${canaries}\n` : ''}];\n`
  );
}

function listProposalIds() {
  try {
    return new Set(
      readdirSync(path.join(ROOT, PROPOSALS_DIR))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length)),
    );
  } catch {
    return new Set();
  }
}

function readArmMigration() {
  try {
    const name = readdirSync(path.join(ROOT, 'database/migrations')).find((f) => /_mentor_canary_arm\.sql$/.test(f));
    return name ? readFileSync(path.join(ROOT, 'database/migrations', name), 'utf8') : null;
  } catch {
    return null;
  }
}

/** Everything that must agree. `read(file)` returns the file's text or null. */
export function checkMentorCanaryParity(read = readText, { proposalIds = listProposalIds(), migration = readArmMigration() } = {}) {
  const problems = [];
  const registry = parse(read(FILES.registry));
  const manifest = parse(read(FILES.manifest));
  if (!registry) return [`${FILES.registry} is missing or not JSON`];
  if (!manifest) return [`${FILES.manifest} is missing or not JSON`];
  const { rows, problems: tableProblems } = tier2Table(registry);
  problems.push(...tableProblems);
  problems.push(...checkManifest(manifest, rows, proposalIds));

  const norm = (t) => (t ?? '').replace(/\r\n/g, '\n');
  if (norm(read(FILES.oracleTable)) !== renderOracleTable(rows)) problems.push(`${FILES.oracleTable} is stale: run node agent/tools/check-mentor-canary-parity.mjs --write`);
  if (norm(read(FILES.coreTables)) !== renderCoreTables(rows, manifest)) problems.push(`${FILES.coreTables} is stale: run node agent/tools/check-mentor-canary-parity.mjs --write`);

  const oracle = read(FILES.oracleCanary) ?? '';
  const core = read(FILES.coreCanary) ?? '';
  for (const [file, text] of [[FILES.oracleCanary, oracle], [FILES.coreCanary, core]]) {
    const arms = constArray(text, 'CANARY_ARMS');
    if (JSON.stringify(arms) !== JSON.stringify(CANARY_ARMS)) problems.push(`${file}: CANARY_ARMS is ${JSON.stringify(arms)}, expected ${JSON.stringify(CANARY_ARMS)}`);
  }
  // Oracle applies every registered object: an object it never builds would drop its overrides silently.
  for (const object of new Set(rows.map((r) => r.object))) {
    if (!oracle.includes(object)) problems.push(`${FILES.oracleCanary}: never applies ${object}, so its Tier 2 overrides would be dropped`);
  }
  // Core asks the H.7 runtime for the manifest's target and nothing else.
  if (!/getExperimentAssignments\(\{[^}]*target:\s*MENTOR_CANARY_TARGET/s.test(core)) problems.push(`${FILES.coreCanary}: must ask the H.7 runtime for MENTOR_CANARY_TARGET`);
  if (!/recordExperimentExposure\(\{[^}]*target:\s*MENTOR_CANARY_TARGET/s.test(core)) problems.push(`${FILES.coreCanary}: must record the exposure under MENTOR_CANARY_TARGET`);

  if (migration === null) problems.push('no *_mentor_canary_arm.sql migration: tutor_sessions.canary_arm has no CHECK');
  else {
    const m = /canary_arm\s+text[^,;]*?IN\s*\(([^)]*)\)/i.exec(migration);
    const arms = m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : null;
    if (JSON.stringify(arms) !== JSON.stringify(CANARY_ARMS)) problems.push(`the canary_arm CHECK is ${JSON.stringify(arms)}, expected ${JSON.stringify(CANARY_ARMS)}`);
  }
  return problems;
}

function main() {
  if (process.argv.includes('--write')) {
    const registry = parse(readText(FILES.registry));
    const manifest = parse(readText(FILES.manifest));
    const { rows, problems } = tier2Table(registry);
    const manifestProblems = checkManifest(manifest, rows, listProposalIds());
    if (problems.length > 0 || manifestProblems.length > 0) {
      for (const p of [...problems, ...manifestProblems]) console.error(`  ${p}`);
      console.error('canary:write refused — fix the source files first');
      return 1;
    }
    writeFileSync(path.join(ROOT, FILES.oracleTable), renderOracleTable(rows));
    writeFileSync(path.join(ROOT, FILES.coreTables), renderCoreTables(rows, manifest));
    const running = manifest.canaries.filter((c) => c.status === 'running').length;
    console.log(`canary:write — ${rows.length} Tier 2 parameters, ${running} running canar${running === 1 ? 'y' : 'ies'} of ${manifest.canaries.length}`);
    return 0;
  }
  const problems = checkMentorCanaryParity();
  if (problems.length > 0) {
    console.error(`canary:check FAILED — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log('canary:check OK — the Tier 2 bounds, the canary manifest, both generated tables, the arms and the migration CHECK agree');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
