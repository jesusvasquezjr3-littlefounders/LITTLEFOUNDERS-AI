// check-block-d-retention.mjs — D.21's retention and deletion policy as a
// gate, not a document.
//
// docs/operations/FAMILY-DATA-RETENTION.md is the written policy and
// docs/operations/block-d-retention.json its registry: every Block D table
// with its class (a period, or "kept while the account exists"), its rule and
// how an account erasure reaches it. The numbers live in three more places:
// the migration's family_retention_days(), Core's constants (served to
// families as the data policy) and the family-facing copy. This gate reads
// them all from the real files and fails when:
//   - a Block D table exists (after every CREATE, RENAME and DROP in the
//     migration chain) with no class in the registry, or the registry names a
//     table that no longer exists;
//   - a period differs between the registry, the migration and Core;
//   - a table with a period is missing from the sweep or the compliance
//     audit, or a table the family keeps for the account's life is swept;
//   - a table's erasure path (a cascade from auth.users or from its parent
//     row) is not in its CREATE TABLE statement;
//   - the written policy stops naming a table or a period, the copy loses a
//     period placeholder, or a nightly job stops calling the retention work;
//   - the Mentor's context schema gains a Block D field, or a Family Hub
//     surface imports the third-party analytics module (the policy tells
//     families neither happens).
// It runs in the unfiltered repo gates: the evidence spans database/,
// backend/, frontend/, oracle/, .github/ and docs/.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestFunctionBody } from './check-no-unbacked-guarantee.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const REGISTRY = 'docs/operations/block-d-retention.json';
export const POLICY = 'docs/operations/FAMILY-DATA-RETENTION.md';
const CORE = 'backend/src/services/familyRetention.ts';
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const PERIODIC_COPY = ['photos', 'records', 'insights', 'research'];
const PLAIN_COPY = ['coins', 'erasure', 'sharing'];
const SURFACES = ['frontend/src/rebuild/family', 'frontend/src/rebuild/banking', 'frontend/src/rebuild/wallet', 'frontend/src/routes/app/family',
  'frontend/src/routes/app/tasks', 'frontend/src/routes/app/banking', 'frontend/src/routes/app/wallet'];
const MENTOR_SCHEMA = 'oracle/src/context/schema.ts';
const BLOCK_D_FIELD = /\b(wallet|chore|redemption|allowance|banking|ledger|spendLimit|spend_limit|savingsGoal|savings_goal|coinBalance|coins)\w*\s*:/i;

/** The tables alive at the end of the chain, each with the text of its CREATE TABLE statement. */
export function liveTables(migrations) {
  const tables = new Map();
  const statement = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(|\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+rename\s+to\s+([a-z_][a-z0-9_]*)|\bdrop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  for (const { sql } of migrations) {
    for (const m of sql.matchAll(statement)) {
      if (m[1]) {
        const name = m[1].toLowerCase();
        if (tables.has(name)) continue;
        // The statement runs to the first semicolon at the end of a line.
        const end = sql.slice(m.index).search(/\);\s*$/m);
        tables.set(name, sql.slice(m.index, end === -1 ? undefined : m.index + end + 2));
      } else if (m[2]) {
        const from = m[2].toLowerCase();
        if (tables.has(from)) { tables.set(m[3].toLowerCase(), tables.get(from)); tables.delete(from); }
      } else if (m[4]) {
        tables.delete(m[4].toLowerCase());
      }
    }
  }
  return tables;
}

const norm = (text) => text.replace(/\s+/g, ' ').toLowerCase();

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkRetention({ registry, migrations, readFile, locales, surfaceSources }) {
  const failures = [];
  const tables = liveTables(migrations);
  const inDomain = (name) => registry.domainPrefixes.some((p) => name === p || name.startsWith(p));
  const known = new Set([...Object.keys(registry.tables), ...Object.keys(registry.outOfScope ?? {})]);
  for (const name of tables.keys()) {
    if (inDomain(name) && !known.has(name)) failures.push(`${name}: a Block D table with no retention class in ${REGISTRY}`);
  }
  for (const [name, why] of Object.entries(registry.outOfScope ?? {})) {
    if (typeof why !== 'string' || why.trim().length < 20) failures.push(`${name}: out of scope needs a reason a reviewer can check`);
  }

  const retention = migrations.filter((m) => m.name.endsWith('_family_data_retention.sql')).at(-1);
  const days = latestFunctionBody(migrations, 'family_retention_days');
  const sweep = latestFunctionBody(migrations, 'family_retention_sweep');
  const audit = latestFunctionBody(migrations, 'family_retention_compliance');
  if (!retention || !days || !sweep || !audit) {
    failures.push('the family_data_retention migration (family_retention_days, family_retention_sweep, family_retention_compliance) is missing');
    return failures;
  }
  const core = readFile(CORE) ?? '';
  for (const [cls, spec] of Object.entries(registry.classes)) {
    if (spec.days === null) continue;
    if (!days.body.includes(`WHEN '${cls}' THEN ${spec.days}`)) failures.push(`class ${cls}: the registry says ${spec.days} days, family_retention_days() does not`);
    const constant = new RegExp(`export const ${spec.coreConstant}\\s*=\\s*(\\d+);`).exec(core)?.[1];
    if (constant !== String(spec.days)) failures.push(`class ${cls}: ${CORE} ${spec.coreConstant} is ${constant ?? 'missing'}, the registry says ${spec.days}`);
  }

  for (const [name, spec] of Object.entries(registry.tables)) {
    if (!registry.classes[spec.class]) { failures.push(`${name}: unknown class ${spec.class}`); continue; }
    const create = tables.get(name);
    if (!create) { failures.push(`${name}: in ${REGISTRY} but no migration creates it (or it was dropped)`); continue; }
    const swept = new RegExp(`DELETE FROM public\\.${name}\\b`).test(sweep.body);
    if (spec.class === 'account') {
      if (swept) failures.push(`${name}: kept while the account exists, but family_retention_sweep() deletes from it`);
    } else {
      if (!swept) failures.push(`${name}: class ${spec.class} but family_retention_sweep() never deletes from it`);
      if (!audit.body.includes(`'${name}'`)) failures.push(`${name}: class ${spec.class} but family_retention_compliance() never counts it`);
    }
    if (spec.photo && !audit.body.includes(`'${name}.evidence'`)) failures.push(`${name}: its photos are not counted by the compliance audit`);
    const text = norm(create);
    if (spec.erasedVia === 'auth.users') {
      if (!/references auth\.users ?\(id\) on delete cascade/.test(text)) failures.push(`${name}: says an erasure reaches it from auth.users, but its CREATE TABLE has no ON DELETE CASCADE to auth.users`);
    } else if (spec.erasedVia === 'none') {
      if (spec.personal !== false || !spec.note) failures.push(`${name}: no erasure path is allowed only for a table with no personal data, with a note saying why`);
    } else if (!new RegExp(`references public\\.${spec.erasedVia} ?\\([a-z_]+\\) on delete cascade`).test(text)) {
      failures.push(`${name}: says an erasure reaches it through ${spec.erasedVia}, but its CREATE TABLE has no cascade from it`);
    }
  }

  const policy = readFile(POLICY);
  if (policy === null) failures.push(`${POLICY} is missing`);
  else {
    for (const name of Object.keys(registry.tables)) if (!policy.includes(`\`${name}\``)) failures.push(`${POLICY} does not name \`${name}\``);
    for (const [cls, spec] of Object.entries(registry.classes)) {
      if (spec.days !== null && !policy.includes(`${spec.days.toLocaleString('en-US')} days`)) failures.push(`${POLICY} does not state the ${cls} period (${spec.days} days)`);
    }
  }

  const served = { photos: 'RETENTION_EVIDENCE_DAYS', records: 'RETENTION_RECORDS_DAYS', insights: 'RETENTION_RECORDS_DAYS', research: 'RETENTION_RESEARCH_DAYS' };
  for (const [id, constant] of Object.entries(served)) {
    if (!core.includes(`{ id: '${id}', days: ${constant} }`)) failures.push(`${CORE}: the family is not served ${id} from ${constant}`);
  }
  for (const id of PLAIN_COPY) if (!core.includes(`{ id: '${id}', days: null }`)) failures.push(`${CORE}: ${id} must be served with no period`);
  for (const locale of LOCALES) {
    const copy = locales(locale, 'familyGovernance')?.dataPolicy;
    if (!copy) { failures.push(`familyGovernance.json (${locale}): no dataPolicy copy`); continue; }
    for (const id of PERIODIC_COPY) if (!String(copy[id] ?? '').includes('{days}')) failures.push(`familyGovernance.json (${locale}): dataPolicy.${id} must show the served period ({days})`);
    for (const id of PLAIN_COPY) if (!copy[id] || /\{days\}|\d/.test(copy[id])) failures.push(`familyGovernance.json (${locale}): dataPolicy.${id} must state its rule without a number`);
  }

  const nightly = readFile('.github/workflows/family-retention.yml') ?? '';
  if (!nightly.includes('/api/v1/family-hub/internal/retention/run')) failures.push('.github/workflows/family-retention.yml no longer runs the retention job');
  const maintenance = readFile('.github/workflows/insights-maintenance.yml') ?? '';
  for (const fn of ['prune_family_money_events', 'record_family_research_snapshots', 'probe_family_engagement_insight']) {
    if (!maintenance.includes(fn)) failures.push(`.github/workflows/insights-maintenance.yml no longer calls ${fn}`);
  }

  const mentor = readFile(MENTOR_SCHEMA);
  if (mentor === null) failures.push(`${MENTOR_SCHEMA} is missing`);
  else {
    const hit = mentor.split('\n').find((line) => BLOCK_D_FIELD.test(line));
    if (hit) failures.push(`${MENTOR_SCHEMA}: a Block D field reaches the Mentor's context ("${hit.trim()}"); the policy tells families it never does`);
  }
  for (const [file, source] of surfaceSources) {
    if (/from ['"]@\/lib\/analytics['"]/.test(source)) failures.push(`${file}: a Family Hub surface imports the third-party analytics module`);
  }
  return failures;
}

function walk(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  } catch { return []; }
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') }));
  return {
    registry: JSON.parse(readFileSync(join(root, REGISTRY), 'utf8')),
    migrations,
    readFile: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
    locales: (locale, ns) => { try { return JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, `${ns}.json`), 'utf8')); } catch { return null; } },
    surfaceSources: SURFACES.flatMap((d) => walk(join(root, d))).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => [f.slice(root.length).replace(/\\/g, '/'), readFileSync(f, 'utf8')]),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputs = liveInputs();
  const failures = checkRetention(inputs);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  const counts = Object.values(inputs.registry.tables).reduce((acc, t) => ({ ...acc, [t.class]: (acc[t.class] ?? 0) + 1 }), {});
  console.log(`block-d-retention OK — ${Object.keys(inputs.registry.tables).length} Block D tables classified (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}); periods agree across the registry, the migration, Core and the copy; the sweep, the audit, the jobs and the erasure paths match`);
}
