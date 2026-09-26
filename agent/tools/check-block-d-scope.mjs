// check-block-d-scope.mjs — D.20's scope statement as a gate.
//
// Parent-facing material must say plainly what the practice does and does not
// teach, naming credit, debt and real compound interest as outside its scope,
// so "financial literacy" never implies more than the mechanics build
// (Appendix G §3.5). docs/operations/block-d-scope.json lists every line of
// the statement: each thing it practises with the code that backs it, and
// each thing it does not attempt with its research basis. This gate fails
// when:
//   - a required exclusion (credit, debt, compound interest, risk) is gone;
//   - a line's copy is missing in any locale, or the component's lists differ
//     from the registry;
//   - a line that says the practice teaches something loses its backing code;
//   - a page that must show the statement stops mounting it;
//   - a table or column for borrowing, lending, interest, insurance or
//     investing appears in the schema without the statement acknowledging it
//     (the statement would then be false in the other direction);
//   - the public FAQ answer (S07.8) leaves its page or stops naming an
//     exclusion in any locale;
//   - the quarterly human audit log has no dated entry.
// It runs in the unfiltered repo gates.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const REGISTRY = 'docs/operations/block-d-scope.json';
export const STATEMENT = 'docs/operations/BLOCK-D-SCOPE-STATEMENT.md';
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const TYPES = 'uuid|text|integer|int|bigint|smallint|numeric|boolean|timestamptz|timestamp|date|jsonb|real|double|varchar|character';

/** Every table and column name the migrations define (CREATE TABLE names and columns, ADD COLUMN, RENAME TO). */
export function schemaIdentifiers(migrations) {
  const out = new Set();
  for (const { sql } of migrations) {
    for (const m of sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi)) {
      out.add(m[1].toLowerCase());
      for (const c of m[2].matchAll(new RegExp(`^\\s*([a-z_][a-z0-9_]*)\\s+(?:${TYPES})\\b`, 'gim'))) out.add(c[1].toLowerCase());
    }
    for (const m of sql.matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) out.add(m[1].toLowerCase());
    for (const m of sql.matchAll(/\brename\s+(?:column\s+[a-z_][a-z0-9_]*\s+)?to\s+([a-z_][a-z0-9_]*)/gi)) out.add(m[1].toLowerCase());
  }
  return out;
}

/** The identifiers that name a lending, interest, insurance or investing mechanic. */
export function mechanics(identifiers, words, pairs) {
  const set = new Set(words);
  return [...identifiers].filter((id) => id.split('_').some((part) => set.has(part)) || pairs.some((p) => id.includes(p))).sort();
}

const lookup = (json, path) => path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), json);
const listIn = (source, name) => {
  const m = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const;`).exec(source ?? '');
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : null;
};

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkScope({ registry, readFile, locales, migrations }) {
  const failures = [];
  const concepts = new Set(registry.notAttempted.map((n) => n.concept));
  for (const concept of registry.requiredConcepts) {
    if (!concepts.has(concept)) failures.push(`the statement no longer says the practice does not teach ${concept}`);
  }
  for (const line of [...registry.teaches, ...registry.notAttempted]) {
    for (const locale of LOCALES) {
      const text = lookup(locales(locale, registry.copyNamespace), line.copyKey);
      if (typeof text !== 'string' || text.trim() === '') failures.push(`${line.id}: copy ${registry.copyNamespace}:${line.copyKey} is missing in ${locale}`);
    }
  }
  for (const line of registry.notAttempted) {
    if (!line.basis || line.basis.trim().length < 20) failures.push(`${line.id}: an exclusion needs its research basis`);
  }
  for (const line of registry.teaches) {
    if (!Array.isArray(line.backedBy) || line.backedBy.length === 0) failures.push(`${line.id}: a line saying the practice teaches something needs the code that backs it`);
    for (const evidence of line.backedBy ?? []) {
      const text = readFile(evidence.file);
      if (text === null) failures.push(`${line.id}: ${evidence.file} does not exist`);
      else if (!text.includes(evidence.contains)) failures.push(`${line.id}: ${evidence.file} no longer contains "${evidence.contains}"`);
    }
  }
  const component = readFile(registry.component);
  const teaches = listIn(component, 'SCOPE_TEACHES');
  const not = listIn(component, 'SCOPE_NOT');
  if (JSON.stringify(teaches) !== JSON.stringify(registry.teaches.map((t) => t.id))) failures.push(`${registry.component}: SCOPE_TEACHES is ${teaches} but the registry lists ${registry.teaches.map((t) => t.id)}`);
  if (JSON.stringify(not) !== JSON.stringify(registry.notAttempted.map((t) => t.id))) failures.push(`${registry.component}: SCOPE_NOT is ${not} but the registry lists ${registry.notAttempted.map((t) => t.id)}`);
  for (const file of registry.mounts) {
    const text = readFile(file);
    if (text === null || !/<ScopeStatement(Panel)?\b/.test(text)) failures.push(`${file}: no longer shows the scope statement`);
  }
  // S07.8: the statement also stands in public parent-facing material (the
  // marketing FAQ), listed on its page and naming every exclusion per locale.
  for (const answer of registry.publicAnswers ?? []) {
    const list = readFile(answer.list);
    if (list === null || !list.includes(`id: "${answer.id}"`)) failures.push(`${answer.list}: no longer lists the "${answer.id}" answer`);
    for (const locale of LOCALES) {
      const text = lookup(locales(locale, answer.namespace), answer.copyKey);
      if (typeof text !== 'string' || text.trim() === '') { failures.push(`${answer.id}: copy ${answer.namespace}:${answer.copyKey} is missing in ${locale}`); continue; }
      for (const word of answer.mustName?.[locale] ?? []) {
        if (!text.toLowerCase().includes(word.toLowerCase())) failures.push(`${answer.id}: ${answer.namespace}:${answer.copyKey} (${locale}) no longer names "${word}"`);
      }
    }
  }
  const found = mechanics(schemaIdentifiers(migrations), registry.mechanicWords, registry.mechanicPairs);
  for (const id of found) {
    if (!registry.acknowledged?.[id]) failures.push(`schema: "${id}" looks like a borrowing, interest, insurance or investing mechanic; update the scope statement (and acknowledge it in ${REGISTRY}) before shipping it`);
  }
  const statement = readFile(STATEMENT);
  if (statement === null) failures.push(`${STATEMENT} is missing`);
  else if (!/## Audit log[\s\S]*\| \d{4}-\d{2}-\d{2} \|/.test(statement)) failures.push(`${STATEMENT}: the audit log has no dated entry`);
  return failures;
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  const cache = new Map();
  return {
    registry: JSON.parse(readFileSync(join(root, REGISTRY), 'utf8')),
    readFile: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
    locales: (locale, ns) => {
      const key = `${locale}/${ns}`;
      if (!cache.has(key)) {
        try { cache.set(key, JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, `${ns}.json`), 'utf8'))); } catch { cache.set(key, null); }
      }
      return cache.get(key);
    },
    migrations: readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputs = liveInputs();
  const failures = checkScope(inputs);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`block-d-scope OK — ${inputs.registry.teaches.length} practised lines backed by code, ${inputs.registry.notAttempted.length} exclusions (${inputs.registry.requiredConcepts.join(', ')}) in three locales; mounted on ${inputs.registry.mounts.length} pages and ${(inputs.registry.publicAnswers ?? []).length} public FAQ answer; no lending, interest, insurance or investing mechanic in the schema`);
}
