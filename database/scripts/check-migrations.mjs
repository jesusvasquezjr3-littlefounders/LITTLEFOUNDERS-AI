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
// 6. S05.4c: the latest release_course and release_lesson refuse through the
//    one shared verification function, which requires every Forge release
//    gate and counts v2 activations; lessons/courses status and the live v2
//    pointer are guarded against direct API-role publication (Product G.2).
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

// railway-migrate.sh ships each migration base64-encoded as ONE command-line
// argument, and a Windows command line is capped at 32,767 characters. Found
// in the S05.4c lane review: a 24,913-byte migration failed with "Argument
// list too long" in railway-migrate.test.mjs, while 22,799 bytes (0025, the
// largest shipped) applies. Fail here, in seconds, instead of on the owner's
// production run: split a larger migration in two.
const MAX_MIGRATION_BYTES = 23000;
for (const f of files) {
  const bytes = readFileSync(join(dir, f)).length;
  if (bytes > MAX_MIGRATION_BYTES) {
    fail(`${f}: ${bytes} bytes exceeds ${MAX_MIGRATION_BYTES}, the size railway-migrate.sh can pass as one Windows command-line argument; split it`);
  }
}

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

// Every definition of release_course (0031 and each later replacement) keeps
// the preflight pins; the LATEST definition is the one production runs, and
// since the S05.4c release-gate manifest it must also require every Forge
// release gate (Product G.2). Found by content, not number: lanes renumber.
const releaseDefinitions = files.filter((f) => /create or replace function public\.release_course\(/i.test(readFileSync(join(dir, f), 'utf8')));
for (const releaseGate of releaseDefinitions) {
  const sql = readFileSync(join(dir, releaseGate), 'utf8');
  if (!/update public\.lessons l[\s\S]*?l\.status = 'review'/i.test(sql)) {
    fail(`${releaseGate}: the lesson publish UPDATE must carry the review-ready predicate, not a blanket status filter`);
  }
  const legacyLocalePredicate = sql.split("filter (where d.locale in ('en-US', 'es-MX', 'pt-BR'))").length - 1;
  const effectiveLocalePredicate = (sql.match(/public\.lesson_effective_locale_count\(l\.id\)/g) ?? []).length;
  if (legacyLocalePredicate < 2 && effectiveLocalePredicate < 2) {
    fail(`${releaseGate}: the v1 or effective-locale completeness predicate must guard the publish UPDATE as well as the preflight`);
  }
  if (!sql.includes('concurrent content change detected')) {
    fail(`${releaseGate}: release_course must recount against the preflight totals and raise on mismatch`);
  }
}
const definitionPattern = (fn) => new RegExp(`create or replace function public\\.${fn}\\(`, 'i');
const latestDefinition = (fn) => files.filter((f) => definitionPattern(fn).test(readFileSync(join(dir, f), 'utf8'))).at(-1);
const functionBody = (f, fn) => {
  const sql = readFileSync(join(dir, f), 'utf8');
  const start = sql.search(definitionPattern(fn));
  const end = sql.indexOf('$$;', sql.indexOf('$$', start) + 2);
  return sql.slice(start, end);
};
const latestRelease = releaseDefinitions.at(-1);
if (latestRelease && !latestRelease.startsWith('0031_')) {
  // S05.4c: the verification half of the preflight is one shared function.
  if (!/from public\.forge_release_verification_refusal\(p_course_id\)/i.test(functionBody(latestRelease, 'release_course'))) {
    fail(`${latestRelease}: the latest release_course must refuse through forge_release_verification_refusal`);
  }
  const verification = latestDefinition('forge_release_verification_refusal');
  const body = verification ? functionBody(verification, 'forge_release_verification_refusal') : '';
  if (!/from public\.forge_release_gates r[\s\S]*?e\.item ->> 'gate' = r\.gate_id[\s\S]*?'VERIFICATION_INCOMPLETE'/.test(body)) {
    fail(`${verification ?? 'migrations'}: forge_release_verification_refusal must refuse an attestation that does not pass every forge_release_gates id`);
  }
  // v2 activations count as content changes: through the shared watermark.
  const watermarkFile = latestDefinition('forge_release_content_watermark');
  const watermarkBody = watermarkFile ? functionBody(watermarkFile, 'forge_release_content_watermark') : '';
  if (!/max\(d\.updated_at\)[\s\S]*?max\(p\.activated_at\)[\s\S]*?lesson_document_version_current/.test(watermarkBody)) {
    fail(`${watermarkFile ?? 'migrations'}: forge_release_content_watermark must cover document changes and v2 activations`);
  }
  if (!/v_last_change := public\.forge_release_content_watermark\(p_course_id\)[\s\S]*?'VERIFICATION_REQUIRED'/.test(body)) {
    fail(`${verification ?? 'migrations'}: forge_release_verification_refusal must count v2 activations as content changes`);
  }
  // The attestation covers what verify:course read: its watermark must still
  // be the current one (closes the read-then-attest race).
  if (!/v_watermark is distinct from v_last_change[\s\S]*?'VERIFICATION_REQUIRED'/.test(body)) {
    fail(`${verification ?? 'migrations'}: forge_release_verification_refusal must refuse an attestation whose content watermark is not current`);
  }
}
// S05.4c lane review (G.2): a single lesson is released only through the same
// preflight, and no API role can publish by writing a status.
const lessonRelease = latestDefinition('release_lesson');
if (lessonRelease && !/from public\.forge_release_verification_refusal\(v_course_id\)/i.test(functionBody(lessonRelease, 'release_lesson'))) {
  fail(`${lessonRelease}: release_lesson must refuse through forge_release_verification_refusal`);
}

// The canonical v2 release accepts a current pointer for each locale and only
// falls back to v1 where that locale has no pointer. The latest publication
// function is retry-safe only for the same immutable content digests.
const effectiveLocaleRelease = latestDefinition('lesson_effective_locale_count');
if (effectiveLocaleRelease) {
  const sql = readFileSync(join(dir, effectiveLocaleRelease), 'utf8');
  const body = functionBody(effectiveLocaleRelease, 'lesson_effective_locale_count');
  if (!/VALUES \('en-US'::text\), \('es-MX'::text\), \('pt-BR'::text\)/i.test(body)
      || !/lesson_document_version_current[\s\S]*?NOT EXISTS[\s\S]*?lesson_documents/i.test(body)) {
    fail(`${effectiveLocaleRelease}: effective locales must prefer each current v2 pointer and fall back to v1 only when absent`);
  }
  if (!/lesson_effective_locale_count\(l\.id\) <> 3/.test(functionBody(latestRelease, 'release_course'))
      || !/lesson_effective_locale_count\(p_lesson_id\)/.test(functionBody(lessonRelease, 'release_lesson'))) {
    fail(`${latestRelease}: course and lesson release must both require three effective locales`);
  }
  for (const gate of ['05.rationale-canon', '06.anti-genericity', '07.generation-quality', '08.clarity', '09.readability']) {
    if (!sql.includes(`('forge.gate.${gate}')`)) {
      fail(`${effectiveLocaleRelease}: canonical v2 publication must require forge.gate.${gate}`);
    }
  }
}
const v2Publication = latestDefinition('publish_v2_lesson_version');
if (v2Publication) {
  const body = functionBody(v2Publication, 'publish_v2_lesson_version');
  if (!/v_existing_document_digest IS DISTINCT FROM v_document_digest[\s\S]*?v_existing_keys_digest IS DISTINCT FROM v_keys_digest/i.test(body)
      || !/USING ERRCODE = '23505'/.test(body)
      || !/'idempotent', true/.test(body)) {
    fail(`${v2Publication}: a repeated v2 identity must be idempotent only for matching document and answer-key digests`);
  }
}
if (lessonRelease) {
  const sql = readFileSync(join(dir, lessonRelease), 'utf8');
  for (const table of ['lessons', 'courses']) {
    if (!new RegExp(`before insert or update of status on public\\.${table}\\s+for each row execute function public\\.guard_release_only_publication\\(\\)`, 'i').test(sql)) {
      fail(`${lessonRelease}: ${table}.status must be guarded by guard_release_only_publication`);
    }
  }
  if (!/before insert or update on public\.lesson_document_version_current\s+for each row execute function public\.guard_live_v2_activation\(\)/i.test(sql)) {
    fail(`${lessonRelease}: the v2 pointer of a published lesson must be guarded by guard_live_v2_activation`);
  }
}

if (failed) process.exit(1);
console.log(`migrations OK — ${files.length} file(s): sequential numbering + RLS coverage + append-only audit + release-gate/release-only-publication/game-retirement pins + Railway transport size cap`);
