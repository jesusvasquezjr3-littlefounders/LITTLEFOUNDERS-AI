// Static gates for database/migrations:
// 1. Sequential NNNN numbering, no gaps, no duplicates.
// 2. Every CREATE TABLE has a matching ENABLE ROW LEVEL SECURITY in the same file.
// 3. No UPDATE/DELETE policies on audit_logs (append-only invariant).
// 4. 0033 reclassifies surviving route_class='games' rows BEFORE tightening the
//    CHECK — one surviving row (legal since 0023) would otherwise raise 23514
//    and abort the migration mid-flight.
// 5. 0031's release_course publishes only preflight-qualified rows and recounts
//    loudly — row locks cannot block concurrent INSERTs, so a blanket
//    `status <> 'published'` UPDATE could publish unverified late content.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, never URL.pathname: on Windows the latter yields '/C:/...',
// which readdirSync resolves against the current drive as 'C:\C:\...' and the
// gate dies with ENOENT before checking a single migration.
const dir = fileURLToPath(new URL('../migrations', import.meta.url));
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

const retireGames = files.find((f) => f.startsWith('0033_'));
if (retireGames) {
  const sql = readFileSync(join(dir, retireGames), 'utf8');
  const remap = sql.indexOf("SET route_class = 'other'");
  const check = sql.indexOf('ADD CONSTRAINT learning_events_route_class_check');
  if (remap === -1 || check === -1 || remap > check) {
    fail(`${retireGames}: surviving route_class='games' rows must be reclassified before the tightened CHECK is added`);
  }
  if (/learning_events_route_class_check CHECK \(route_class IN \([^)]*'games'/is.test(sql)) {
    fail(`${retireGames}: the tightened route_class CHECK must not re-admit 'games'`);
  }
  // The 0025 rollup table freezes route_class into history with no CHECK, so
  // remapping only the raw stream leaves local/QA rollup rows keyed 'games'
  // disagreeing with it. 0033 must merge them into 'other' PK-safely (a bare
  // UPDATE can collide with an existing same-key 'other' row) and delete the
  // 'games' keys afterwards.
  if (!/INSERT INTO public\.insights_daily_activity[\s\S]*?route_class = 'games'[\s\S]*?ON CONFLICT \(day, role, event, route_class, device, locale\)/i.test(sql)) {
    fail(`${retireGames}: insights_daily_activity rows keyed route_class='games' must be merged into 'other' via a PK-safe upsert`);
  }
  if (!/DELETE FROM public\.insights_daily_activity\s+WHERE route_class = 'games'/i.test(sql)) {
    fail(`${retireGames}: merged insights_daily_activity 'games' rows must be deleted so no retired surface key survives the remap`);
  }
}

const releaseGate = files.find((f) => f.startsWith('0031_'));
if (releaseGate) {
  const sql = readFileSync(join(dir, releaseGate), 'utf8');
  if (!/update public\.lessons l[\s\S]*?l\.status = 'review'/.test(sql)) {
    fail(`${releaseGate}: the lesson publish UPDATE must carry the review-ready predicate, not a blanket status filter`);
  }
  const localePredicate = sql.split("filter (where d.locale in ('en-US', 'es-MX', 'pt-BR'))").length - 1;
  if (localePredicate < 2) {
    fail(`${releaseGate}: the locale-complete predicate must guard the publish UPDATE as well as the preflight`);
  }
  if (!sql.includes('concurrent content change detected')) {
    fail(`${releaseGate}: release_course must recount against the preflight totals and raise on mismatch`);
  }
}

if (failed) process.exit(1);
console.log(`migrations OK — ${files.length} file(s): sequential numbering + RLS coverage + append-only audit + release-gate/game-retirement pins`);
