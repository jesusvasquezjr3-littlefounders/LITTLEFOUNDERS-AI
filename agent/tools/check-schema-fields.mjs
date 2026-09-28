import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * check-schema-fields.mjs — Appendix M 1.4 Schema Field Utilization Audit
 * (Block A), and the check 1.2 retires into: "a Schema Field Utilization
 * check confirming the field no longer exists unused".
 *
 * A.5 took the alternate remedy for the parent document type: the field is
 * removed rather than validated against the image. A removed field must stay
 * removed, everywhere a future change could quietly bring it back:
 *
 *   1. the migration chain drops the column, and no later migration adds it
 *      back or re-creates the table with it;
 *   2. the generated types (database/types/database.ts) no longer declare it
 *      on that table;
 *   3. no service source names it (the token is checked in every package's
 *      src, tests included, so a fixture cannot resurrect the write either).
 *
 * RETIRED lists every field this rule covers. `token: null` skips the source
 * scan for a column whose name is an ordinary word (address).
 */

export const RETIRED = [
  { table: 'parent_verifications', column: 'document_type', requirement: 'A.5 (Appendix M 1.2/1.4)', token: 'document_type' },
  { table: 'parent_verifications', column: 'address', requirement: 'A.5 minimal collection (0049)', token: null },
];

const SOURCE_DIRS = ['backend/src', 'frontend/src', 'oracle/src', 'parent-id-check/src', 'coursegen/src', 'dataintel/src', 'email-server/src', 'filebase/src', 'audiogen/src', 'picturegen/src', 'pulse/src'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? (entry.name === 'node_modules' ? [] : walk(join(dir, entry.name))) : [join(dir, entry.name)]);
}

/** The table's block in the generated types: from `<table>: {` to its `Relationships:`. */
export function typesBlock(types, table) {
  const start = types.search(new RegExp(`\\n\\s+${table}: \\{\\s*\\n\\s+Row: \\{`));
  if (start < 0) return null;
  const end = types.indexOf('Relationships:', start);
  return types.slice(start, end < 0 ? undefined : end);
}

/**
 * @param {{ migrations: {file: string, sql: string}[], types: string, sources: {file: string, text: string}[] }} input
 * @returns {string[]} failures
 */
export function checkSchemaFields({ migrations, types, sources }, retired = RETIRED) {
  const failures = [];
  const ordered = [...migrations].sort((a, b) => a.file.localeCompare(b.file));
  for (const field of retired) {
    const name = `${field.table}.${field.column}`;
    const dropRe = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?${field.table}\\s+DROP\\s+COLUMN\\s+(?:IF\\s+EXISTS\\s+)?${field.column}\\b`, 'i');
    const dropAt = ordered.findLastIndex((m) => dropRe.test(m.sql));
    if (dropAt < 0) {
      failures.push(`${name}: no migration drops the column (${field.requirement}) — a retired field must not remain declared and unused`);
    } else {
      const addRe = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?${field.table}\\s+ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${field.column}\\b`, 'i');
      const createRe = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${field.table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
      for (const later of ordered.slice(dropAt + 1)) {
        const created = createRe.exec(later.sql)?.[1] ?? '';
        if (addRe.test(later.sql) || new RegExp(`^\\s+${field.column}\\s`, 'm').test(created)) {
          failures.push(`${later.file}: brings back ${name}, retired by ${ordered[dropAt].file} (${field.requirement})`);
        }
      }
    }
    const block = typesBlock(types, field.table);
    if (block === null) failures.push(`database/types/database.ts: no ${field.table} table block found`);
    else if (new RegExp(`\\b${field.column}\\??:`).test(block)) failures.push(`database/types/database.ts: ${field.table} still declares ${field.column} (regenerate the types)`);
    if (field.token) {
      const tokenRe = new RegExp(`\\b${field.token}\\b`);
      for (const source of sources) if (tokenRe.test(source.text)) failures.push(`${source.file}: names the retired field ${name}`);
    }
  }
  return failures;
}

export function loadInputs(root) {
  const dir = resolve(root, 'database/migrations');
  const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((file) => ({ file, sql: readFileSync(join(dir, file), 'utf8') }));
  const types = readFileSync(resolve(root, 'database/types/database.ts'), 'utf8');
  const sources = SOURCE_DIRS.flatMap((d) => walk(resolve(root, d)))
    .filter((f) => /\.(ts|tsx|mjs|js|json)$/.test(f))
    .map((f) => ({ file: relative(root, f).replaceAll('\\', '/'), text: readFileSync(f, 'utf8') }));
  return { migrations, types, sources };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const failures = checkSchemaFields(loadInputs(root));
  if (failures.length) {
    for (const f of failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
  console.log(`schema-fields OK — ${RETIRED.length} retired field(s) absent from the chain's final schema, the generated types and every service source`);
}
