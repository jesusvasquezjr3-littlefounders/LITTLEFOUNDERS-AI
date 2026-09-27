#!/usr/bin/env node
// Proof of the OD-9 toolkit on a native PostgreSQL with the full migration
// chain. Never the shared Docker stack, never production.
//
//   1. a fresh database gets the LEGACY schema (the chain up to
//      *_rename_banking_accounts.sql) and the synthetic legacy dataset;
//   2. the toolkit captures the "before" inventory there, and refuses the
//      correction steps on the legacy schema;
//   3. the rest of the chain (the whole rebuild, this lane's migration
//      included) is applied OVER that data, then seed:kc's rows;
//   4. defects, KC credit and consent run as dry runs (no product write),
//      then apply, then apply again (idempotent), each checked against
//      expectations the fixture computed independently;
//   5. the legacy catalog is retired the OD-24 way (archived) and the
//      "after" inventory must equal "before" for every promised record,
//      every family and every identifier; a tampered copy must fail;
//   6. RLS and grants of the new tables are checked through the browser
//      roles.
//
// Cluster: LF_PG_BIN (psql directory), LF_PG_PORT, LF_PG_USER, LF_PG_DATA
// (the data directory the server must report: ownership check). Report:
// audit-results/od9/prove-od9-postgres.json. LF_KEEP_DB=1 keeps the database.

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { run, runPsql } from './od9.mjs';
import { generateLegacyFixture, PRACTICES } from './fixtures/generate-legacy-fixture.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MIGRATIONS = readdirSync(join(ROOT, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
const LEGACY_LAST = MIGRATIONS.findIndex((f) => f.endsWith('_rename_banking_accounts.sql'));
assert.ok(LEGACY_LAST > 0, 'legacy baseline migration not found');

const env = {
  ...process.env,
  LF_PG_BIN: process.env.LF_PG_BIN ?? join(ROOT, '.codex/audit-db/pgsql/bin'),
};
const PORT = process.env.LF_PG_PORT ?? '15483';
const USER = process.env.LF_PG_USER ?? 'audit_owner';
const DATA = process.env.LF_PG_DATA ?? join(ROOT, '.codex/audit-db/data');
const conn = (dbname) => `host=127.0.0.1 port=${PORT} user=${USER} dbname=${dbname}`;
const sql = (query, dbname) => runPsql(query, { db: conn(dbname), env }).trim();

const norm = (p) => resolve(p).replace(/\\/g, '/').toLowerCase();
if (norm(sql('SHOW data_directory', 'postgres')) !== norm(DATA)) throw new Error('Refusing an unowned database cluster (LF_PG_DATA)');

const SHIM = readFileSync(join(ROOT, 'database/scripts/verify-money-presentation-postgres.py'), 'utf8').split('SHIM = """')[1].split('"""')[0];
// Supabase keeps the sign-in provider in raw_app_meta_data and auth.identities.
const AUTH_EXTRA = `
ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb DEFAULT '{}'::jsonb;
CREATE TABLE auth.identities (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL, provider_id text NOT NULL);`;

const checks = [];
const check = (label) => { checks.push(label); console.log(`ok - ${label}`); };
const quiet = () => {};

const db = `lf_od9_${randomBytes(6).toString('hex')}`;
const cli = (args, extra = {}) => run({ apply: false, ...args, db: conn(db), out: join(ROOT, 'audit-results/od9', db) }, { env, log: quiet, ...extra });
const claims = (uid, role) => `SELECT set_config('request.jwt.claims', '${JSON.stringify({ role, ...(uid ? { sub: uid } : {}) })}', false), `
  + `set_config('request.jwt.claim.sub', '${uid ?? ''}', false), set_config('request.jwt.claim.role', '${role}', false);\nSET ROLE ${role};\n`;
const as = (role, uid, query) => sql(claims(uid, role) + query, db).split('\n').slice(1).join('\n');
const refused = (fn, token) => {
  try { fn(); } catch (error) {
    assert.ok(String(error.message).includes(token), `expected ${token}, got ${error.message}`);
    return;
  }
  throw new Error(`expected refusal ${token}`);
};
const productState = () => sql(`SELECT concat_ws('|',
  (SELECT count(*) FROM public.parent_verifications), (SELECT count(*) FROM public.account_age_declarations),
  (SELECT count(*) FROM public.account_safety_origins), (SELECT md5(string_agg(id || expires_at::text, ',' ORDER BY id)) FROM public.badge_shares),
  (SELECT count(*) FROM public.audit_logs), (SELECT count(*) FROM public.legacy_kc_credits),
  (SELECT count(*) FROM public.course_pathway_badges), (SELECT count(*) FROM public.data_practice_consents))`, db);

const fixture = generateLegacyFixture();
const X = fixture.expectations;
const id = X.ids;
const started = Date.now();

try {
  // ── 1. Legacy schema and data ─────────────────────────────────────────
  sql(`CREATE DATABASE ${db}`, 'postgres');
  sql(SHIM + AUTH_EXTRA, db);
  for (const m of MIGRATIONS.slice(0, LEGACY_LAST + 1)) sql(readFileSync(join(ROOT, 'database/migrations', m), 'utf8'), db);
  sql(fixture.legacySql, db);
  assert.equal(sql('SELECT count(*) FROM auth.users', db), String(X.accounts));
  check(`legacy schema (${LEGACY_LAST + 1} migrations, through ${MIGRATIONS[LEGACY_LAST]}) loaded with the synthetic dataset: ${X.accounts} accounts, ${sql('SELECT count(*) FROM public.lesson_progress', db)} lesson_progress rows, ${sql('SELECT count(*) FROM public.wallet_ledger', db)} ledger rows`);

  // ── 2. Before inventory; correction steps refused on the legacy schema ─
  cli({ command: 'install' });
  const before = cli({ command: 'inventory', label: 'before' });
  const beforeGaps = before.rows.filter((r) => r.status !== 'captured');
  assert.deepEqual(beforeGaps, [], 'every promised category is readable on the legacy schema');
  check(`before inventory on the legacy schema: ${before.rows.filter((r) => !r.category.startsWith('identifiers')).length} categories, no gap; ${before.rows.find((r) => r.category === 'identifiers:username').accounts} usernames and ${before.rows.find((r) => r.category === 'identifiers:guardian_link').accounts} guardian links captured`);
  for (const command of ['defects', 'kc-credit', 'consent']) refused(() => cli({ command }), 'OD9_REBUILD_SCHEMA_REQUIRED');
  check('defects, kc-credit and consent refuse the legacy schema (OD9_REBUILD_SCHEMA_REQUIRED) instead of half-applying');

  // ── 3. The rebuild chain over the legacy data, then seed:kc ─────────────
  for (const m of MIGRATIONS.slice(LEGACY_LAST + 1)) {
    try { sql(readFileSync(join(ROOT, 'database/migrations', m), 'utf8'), db); } catch (error) { throw new Error(`${m}: ${error.message}`); }
  }
  sql(fixture.seedKcSql, db);
  assert.ok(fixture.driftSql, 'the fixture drifts one share');
  sql(fixture.driftSql, db);
  cli({ command: 'install' });
  check(`the remaining ${MIGRATIONS.length - LEGACY_LAST - 1} migrations (through ${MIGRATIONS.at(-1)}) apply over the legacy data; toolkit re-install is idempotent`);

  // ── 4a. Defects ────────────────────────────────────────────────────────
  const state0 = productState();
  const dry = cli({ command: 'defects' });
  assert.equal(productState(), state0, 'a dry run writes no product row');
  const wouldCounts = Object.fromEntries(Object.entries(dry.counts).map(([k, n]) => [k.replace(':would_', ':'), n]));
  assert.deepEqual(wouldCounts, X.defects);
  const applied = cli({ command: 'defects', apply: true });
  assert.deepEqual(applied.counts, X.defects);
  check(`defects dry run writes nothing and reports exactly the fixture's independent expectation; apply performs it: ${JSON.stringify(X.defects)}`);

  const facts = sql(`SELECT concat_ws('|',
    (SELECT method || '/' || status FROM public.parent_verifications WHERE user_id = '${id.parent_b}' ORDER BY created_at DESC, id DESC LIMIT 1),
    (SELECT count(*) FROM public.account_safety_origins WHERE user_id = '${id.guest_nodob}'),
    COALESCE((SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = '${id.guest_nodob}'), 'none'),
    (SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = '${id.guest_child}'),
    (SELECT count(*) FROM public.account_safety_origins WHERE user_id = '${id.guest_child}'),
    (SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = '${id.guest_adult}'),
    (SELECT count(*) FROM public.account_age_declarations WHERE user_id IN ('${id.google_nodob}', '${id.email_nodob}', '${id.kid_b}')),
    (SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = '${id.teen_indie}'),
    (SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = '${id.parent_d}'),
    (SELECT count(*) FROM public.user_roles WHERE user_id IN ('${id.parent_b}', '${id.parent_d}') AND role = 'parent'))`, db);
  assert.equal(facts, 'staff-granted/verified|1|none|under_13|1|adult|0|13_to_17|adult|2');
  const shares = sql(`SELECT string_agg((expires_at = created_at + interval '30 days')::text, ',' ORDER BY id) FROM public.badge_shares`, db);
  assert.equal(shares, 'true,true,true');
  const audit = sql(`SELECT count(*) FROM public.audit_logs WHERE action LIKE 'od9.%'`, db);
  assert.equal(Number(audit), X.defects['A5_parent_role_without_justification:mark_staff_granted'] + X.defects['A2_legacy_guest:protective_under13_marker']
    + X.defects['A2_legacy_guest:declare_from_birth_date'] + X.defects['age_declaration_from_birth_date:declare_from_birth_date'] + X.defects['F2_share_without_expiry:default_expiry']);
  check('A.5: the unjustified staff grant is marked staff-granted (distinct trust level) and kept for review, the revoked-verification parent is flagged, no parent role is removed; A.2: the no-evidence guest gets the protective under-13 marker without an invented band, the 10-year-old guest is declared under 13 (marker included), the adult guest declared adult; A.3/A.4: no age is invented for accounts without evidence; F.2: every public share now carries the 30-day default window; one audit_logs row per data change');

  const state1 = productState();
  const again = cli({ command: 'defects', apply: true });
  assert.equal(productState(), state1, 'a second apply changes nothing');
  assert.deepEqual(again.counts, {
    'A3_google_no_dob:age_screen_required': 1, 'A4_no_age_evidence:age_screen_required': X.defects['A4_no_age_evidence:age_screen_required'],
    'A5_parent_role_without_justification:await_justification': 1, 'A5_parent_role_without_justification:review_revoked_verification': 1,
  });
  sql(`INSERT INTO public.audit_logs (actor_id, action, subject, detail) VALUES ('${id.staff_member}', 'admin.parent_role_justification', '${id.parent_b}', '{"justification":"Reviewed at cutover."}')`, db);
  cli({ command: 'defects', apply: true });
  assert.equal(sql(`SELECT status FROM od9.findings WHERE kind = 'A5_parent_role_without_justification' AND subject_ref = '${id.parent_b}'`, db), 'resolved');
  check('defects apply is idempotent (a second apply writes no product row and only re-reports what needs a person); a staff justification recorded later resolves the A.5 finding');

  // ── 4b. OD-24 KC credit ────────────────────────────────────────────────
  const state2 = productState();
  const kcDry = cli({ command: 'kc-credit' });
  assert.equal(productState(), state2);
  const expectedCredits = new Set(X.credits.map((c) => `${c.user}|${X.kcIdByKey[c.kc]}|${c.topic}|${c.stage}`));
  assert.equal(kcDry.new_credits, expectedCredits.size);
  const kcApplied = cli({ command: 'kc-credit', apply: true });
  assert.equal(kcApplied.new_credits, expectedCredits.size);
  const stored = new Set(sql(`SELECT user_id || '|' || kc_id || '|' || source_topic_id || '|' || source_stage FROM public.legacy_kc_credits`, db).split('\n').filter(Boolean));
  assert.deepEqual(stored, expectedCredits);
  const bases = sql(`SELECT string_agg(DISTINCT source_course_slug || ':' || basis, ',' ORDER BY source_course_slug || ':' || basis) FROM public.legacy_kc_credits WHERE user_id IN ('${id.kid_a_two}', '${id.kid_b}')`, db);
  assert.equal(bases, 'financial-education:lessons_passed,financial-education:mixed,financial-education:placement_credit');
  assert.equal(cli({ command: 'kc-credit', apply: true }).new_credits, 0);
  const badges = sql(`SELECT string_agg(user_id::text, ',' ORDER BY user_id) FROM public.course_pathway_badges b JOIN public.courses c ON c.id = b.course_id WHERE c.slug = 'first-lemonade-stand' AND b.award_key = 'legacy'`, db);
  assert.equal(badges, [...X.badgeHolders].sort().join(','));
  const lemonKc = X.credits.find((c) => c.user === id.kid_a_one && c.stage === 'child');
  const teenKc = X.credits.find((c) => c.user === id.kid_c && c.stage === 'teen');
  const covers = sql(`SELECT concat_ws('|',
    public.legacy_kc_credit_covers('${id.kid_a_one}', '${X.kcIdByKey[lemonKc.kc]}', 'child'),
    public.legacy_kc_credit_covers('${id.kid_a_one}', '${X.kcIdByKey[lemonKc.kc]}', 'teen'),
    public.legacy_kc_credit_covers('${id.kid_c}', '${X.kcIdByKey[teenKc.kc]}', 'teen'),
    public.legacy_kc_credit_covers('${id.kid_c}', '${X.kcIdByKey[teenKc.kc]}', 'child'),
    public.legacy_kc_credit_covers('${id.kid_c}', '${X.kcIdByKey[lemonKc.kc]}', 'child'))`, db);
  assert.equal(covers, 't|f|t|t|f');
  check(`OD-24: ${expectedCredits.size} KC credits written, exactly the (learner, KC, completed teaching topic, stage) set computed independently from the fixture (E1: published lessons passed or placement-credited; review topics and draft lessons never credit); bases lessons_passed/placement_credit/mixed recorded; a second apply adds 0; the lemonade-stand legacy badge is frozen for its holders; equivalence covers the same or a younger stage only (child credit does not stand for teen content, teen credit stands for both)`);

  // ── 4c. Consent carry-over ─────────────────────────────────────────────
  const state3 = productState();
  const cDry = cli({ command: 'consent' });
  assert.equal(productState(), state3);
  assert.equal(cDry.children, X.consent.children);
  assert.equal(cDry.missing, X.consent.missing);
  assert.deepEqual(cDry.byGrantor, Object.fromEntries(Object.entries(X.consent.byGrantor).sort(([a], [b]) => a.localeCompare(b))));
  assert.equal(Object.keys(cDry.byPractice).length, PRACTICES.length);
  cli({ command: 'consent', apply: true });
  assert.equal(sql(`SELECT count(*) FROM od9.findings WHERE kind = 'consent_gap' AND status = 'flagged'`, db), String(X.consent.missing));
  sql(`INSERT INTO public.data_practice_consents (subject_user_id, practice_key, grantor_kind, granted_by, disclosure_version)
       VALUES ('${id.kid_a_one}', 'mentor.disposition_profile', 'tutor', '${id.parent_a}', 1)`, db);
  const cAgain = cli({ command: 'consent', apply: true });
  assert.equal(cAgain.missing, X.consent.missing - 1);
  assert.equal(sql(`SELECT status FROM od9.findings WHERE kind = 'consent_gap' AND subject_ref = '${id.kid_a_one}:mentor.disposition_profile'`, db), 'resolved');
  sql(`UPDATE public.data_practice_consents SET revoked_at = now(), revoked_by = '${id.parent_a}' WHERE subject_user_id = '${id.kid_a_one}'`, db);
  assert.equal(sql(`SELECT public.has_data_practice_consent('${id.kid_a_one}', 'mentor.disposition_profile')`, db), 'f');
  assert.equal(sql(`SELECT public.has_data_practice_consent('${id.kid_a_one}', 'no.such-practice')`, db), 'f');
  check(`consent carry-over: ${PRACTICES.length} rebuild practices listed; ${X.consent.children} migrated children (unknown age counted as a child, adults excluded) lack ${X.consent.missing} specific consents, by grantor ${JSON.stringify(X.consent.byGrantor)}, exactly as computed independently; a granted consent resolves its gap and a revoked one no longer counts`);

  // ── 5. Retire the legacy catalog (OD-24) and compare ───────────────────
  sql(`SET session_replication_role = replica;
       UPDATE public.lessons SET status = 'archived'; UPDATE public.topics SET status = 'archived';
       UPDATE public.sagas SET status = 'archived'; UPDATE public.adventures SET status = 'archived';
       UPDATE public.courses SET status = 'archived';`, db);
  cli({ command: 'inventory', label: 'after' });
  const verdict = cli({ command: 'compare', before: 'before', after: 'after' });
  assert.equal(verdict.ok, true, JSON.stringify(verdict.failures.slice(0, 5)));
  assert.equal(verdict.families.total, verdict.families.same);
  check(`after the full chain, every correction, the KC credit and the retirement of the whole legacy catalog (archived, never deleted): 0 failures; ${verdict.families.same}/${verdict.families.total} families identical; every category equal (${verdict.categories.map((c) => `${c.category} ${c.before_rows}`).join(', ')}); every username and guardian link unchanged`);

  // Negative control: one changed streak and one changed username must fail.
  sql(`SET session_replication_role = replica;
       UPDATE public.learning_stats SET longest_streak = longest_streak + 1 WHERE user_id = '${id.kid_a_two}';
       UPDATE public.profiles SET username = 'renamed_kid' WHERE user_id = '${id.kid_a_one}';`, db);
  cli({ command: 'inventory', label: 'tamper' });
  const tamper = cli({ command: 'compare', before: 'after', after: 'tamper' });
  assert.equal(tamper.ok, false);
  const failed = tamper.failures.map((f) => `${f.scope}:${f.category}:${f.subject}`).sort();
  const familyOf = (uid) => sql(`SELECT family_key FROM od9.inventory WHERE label = 'after' AND user_id = '${uid}' LIMIT 1`, db);
  assert.deepEqual(failed, [`account:learning_streak:${id.kid_a_two}`, `family:all:${familyOf(id.kid_a_two)}`, `identifier:username:${id.kid_a_one}`].sort());
  check('negative control: a one-day change to one child\'s best streak and one renamed username fail the comparison exactly at that account, its family and that identifier');

  // Without this lane's badge-reader fix, archiving would hide frozen badges.
  const hidden = sql(`SELECT count(*) FROM public.course_pathway_badges b JOIN public.courses c ON c.id = b.course_id WHERE c.status = 'archived'`, db);
  assert.ok(Number(hidden) >= X.badgeHolders.length);
  assert.equal(sql(`SELECT count(*) FROM public.get_completed_course_badges('${X.badgeHolders[0]}')`, db), '1');
  const reader0125 = readFileSync(join(ROOT, 'database/migrations', MIGRATIONS.find((m) => m.endsWith('_b6_pathway_route_adoption.sql'))), 'utf8');
  const start = reader0125.indexOf('CREATE OR REPLACE FUNCTION public.get_completed_course_badges(');
  sql(reader0125.slice(start, reader0125.indexOf('$$;', start) + 3), db);
  assert.equal(sql(`SELECT count(*) FROM public.get_completed_course_badges('${X.badgeHolders[0]}')`, db), '0');
  sql(readFileSync(join(ROOT, 'database/migrations', MIGRATIONS.find((m) => m.endsWith('_od9_legacy_migration.sql'))), 'utf8'), db);
  assert.equal(sql(`SELECT count(*) FROM public.get_completed_course_badges('${X.badgeHolders[0]}')`, db), '1');
  check(`an archived legacy course keeps its ${hidden} frozen badge(s) visible through get_completed_course_badges; negative control: with the previous (0125) reader restored the same badge disappears, and re-applying this lane's migration (idempotent) brings it back`);

  // ── 6. RLS and grants ──────────────────────────────────────────────────
  const own = X.credits.filter((c) => c.user === id.kid_a_one).length;
  assert.equal(as('authenticated', id.kid_a_one, 'SELECT count(*) FROM public.legacy_kc_credits'), String(own));
  assert.equal(as('authenticated', id.parent_a, `SELECT count(*) FROM public.legacy_kc_credits WHERE user_id = '${id.kid_a_one}'`), String(own));
  assert.equal(as('authenticated', id.parent_c, `SELECT count(*) FROM public.legacy_kc_credits WHERE user_id = '${id.kid_a_one}'`), '0');
  refused(() => as('authenticated', id.kid_a_one, `INSERT INTO public.legacy_kc_credits (user_id, kc_id, source_topic_id, source_course_slug, source_topic_path, source_stage, basis, lessons_total, map_version)
    VALUES ('${id.kid_a_one}', '${X.kcIdByKey[lemonKc.kc]}', gen_random_uuid(), 'x', 'x/y/z', 'teen', 'mixed', 1, 1)`), 'permission denied');
  refused(() => as('authenticated', id.parent_a, `INSERT INTO public.data_practice_consents (subject_user_id, practice_key, grantor_kind, granted_by, disclosure_version)
    VALUES ('${id.kid_a_one}', 'mentor.disposition_profile', 'tutor', '${id.parent_a}', 1)`), 'permission denied');
  assert.equal(as('authenticated', id.parent_a, `SELECT count(*) FROM public.data_practice_consents WHERE subject_user_id = '${id.kid_a_one}'`), '1');
  assert.equal(as('authenticated', id.parent_c, `SELECT count(*) FROM public.data_practice_consents WHERE subject_user_id = '${id.kid_a_one}'`), '0');
  assert.equal(as('authenticated', id.kid_a_one, 'SELECT count(*) FROM public.data_practices'), String(PRACTICES.length));
  refused(() => as('authenticated', id.parent_a, `SELECT public.has_data_practice_consent('${id.kid_a_one}', 'mentor.disposition_profile')`), 'permission denied');
  refused(() => as('authenticated', id.parent_a, `SELECT public.legacy_kc_credit_covers('${id.kid_a_one}', '${X.kcIdByKey[lemonKc.kc]}', 'child')`), 'permission denied');
  refused(() => as('authenticated', id.kid_a_one, 'SELECT count(*) FROM od9.findings'), 'permission denied');
  refused(() => as('service_role', null, 'SELECT count(*) FROM od9.inventory'), 'permission denied');
  assert.equal(as('service_role', null, 'SELECT count(*) > 0 FROM public.legacy_kc_credits'), 't');
  check('RLS and grants: a learner reads only their own KC credits and a verified Tutor their child\'s, an unrelated Tutor none; browser roles cannot write credits or consents; consents are readable by the child and their Tutor only; the registry is readable; both helper functions and the whole od9 evidence schema are closed to browser roles (od9 also to the service role)');

  const report = { database: db, migrations: MIGRATIONS.length, legacyBaseline: MIGRATIONS[LEGACY_LAST], seconds: Math.round((Date.now() - started) / 1000), checks };
  mkdirSync(join(ROOT, 'audit-results/od9'), { recursive: true });
  writeFileSync(join(ROOT, 'audit-results/od9/prove-od9-postgres.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${checks.length} checks passed in ${report.seconds}s`);
} finally {
  if (process.env.LF_KEEP_DB !== '1') {
    try { sql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`, 'postgres'); } catch { /* reported by the failing check */ }
  }
}
