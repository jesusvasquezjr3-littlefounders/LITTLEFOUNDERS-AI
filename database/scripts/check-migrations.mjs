// Static gates for database/migrations:
// 1. Sequential NNNN numbering, no gaps, no duplicates.
// 2. Every CREATE TABLE has a matching ENABLE ROW LEVEL SECURITY in the same file.
// 3. No UPDATE/DELETE policies on audit_logs (append-only invariant).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../migrations', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let failed = false;
const fail = (msg) => { console.error(`FAIL: ${msg}`); failed = true; };

files.forEach((f, i) => {
  const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) return fail(`${f}: name must match NNNN_description.sql`);
  const n = Number(m[1]);
  if (n !== i + 1) fail(`${f}: expected number ${String(i + 1).padStart(4, '0')} (sequential, no gaps)`);
});

for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8');
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]);
  for (const t of tables) {
    const rls = new RegExp(`ALTER TABLE\\s+(?:public\\.)?${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i');
    if (!rls.test(sql)) fail(`${f}: table "${t}" has no ENABLE ROW LEVEL SECURITY in the same migration`);
  }
  if (/CREATE POLICY\s+\w+\s+ON\s+(?:public\.)?audit_logs\s+FOR\s+(UPDATE|DELETE)/i.test(sql)) {
    fail(`${f}: audit_logs must stay append-only — no UPDATE/DELETE policies`);
  }
}

if (failed) process.exit(1);
console.log(`migrations OK — ${files.length} file(s): sequential numbering + RLS coverage + append-only audit`);
