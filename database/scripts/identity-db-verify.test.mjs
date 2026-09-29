import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOCK_A, GATE } from './identity-db-verify.mjs';

// GAP-FIX-R4 (Appendix M Part 2.1 criterion 2, Part 3 Stage 2, 1.1, 1.3): the
// Block A database proofs run in CI and release readiness on every release.
// This fails when a Block A verifier is left out of the runner, when a
// database guard loses its proof, when a verifier stops running the whole
// chain, or when CI, the repo gates or release readiness stops calling it.

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const files = readdirSync(here);
const migrations = readdirSync(join(root, 'database/migrations')).filter((name) => name.endsWith('.sql'));

const EXPECTED = [
  'verify-origin-postgres.py',
  'verify-kid-email-guard-postgres.py',
  'verify-staff-ops-postgres.py',
  'verify-age-correction-postgres.py',
  'verify-age-birth-month-postgres.py',
  'verify-kid-username-change-postgres.py',
];

/**
 * Every Block A safeguard that lives in the database, the verifier that proves
 * it, and the refusal (or function name) that verifier must exercise. GoTrue
 * is reachable directly through Kong, so for these the database IS the path.
 */
const GUARDS = [
  { fn: 'guard_kid_email', clause: 'A.6 / Appendix M 1.3', verifier: 'verify-kid-email-guard-postgres.py', proof: 'KID_EMAIL_FORBIDDEN' },
  { fn: 'guard_optional_learning_event', clause: 'A.2 / Appendix M 1.1', verifier: 'verify-origin-postgres.py', proof: 'guard_optional_learning_event' },
  { fn: 'mark_under13_origin', clause: 'A.2', verifier: 'verify-origin-postgres.py', proof: 'mark_under13_origin' },
  { fn: 'record_age_declaration', clause: 'A.4', verifier: 'verify-origin-postgres.py', proof: 'record_age_declaration' },
  { fn: 'guard_profile_birth_date', clause: 'E.4', verifier: 'verify-origin-postgres.py', proof: 'reviewed identity workflow' },
  { fn: 'enforce_parent_role_provenance', clause: 'A.5', verifier: 'verify-staff-ops-postgres.py', proof: 'PARENT_ROLE_UNJUSTIFIED' },
  { fn: 'guard_parent_verification_age', clause: 'A.5', verifier: 'verify-staff-ops-postgres.py', proof: 'AGE_RECORD_MINOR' },
  { fn: 'list_minor_record_tutors', clause: 'A.5', verifier: 'verify-staff-ops-postgres.py', proof: 'list_minor_record_tutors' },
  { fn: 'identity_metrics', clause: 'Appendix M Part 1', verifier: 'verify-staff-ops-postgres.py', proof: 'identity_metrics' },
  { fn: 'decide_age_correction', clause: 'E.4 / A.4', verifier: 'verify-age-correction-postgres.py', proof: 'decide_age_correction' },
  { fn: 'promote_age_declaration', clause: 'OD-28', verifier: 'verify-age-birth-month-postgres.py', proof: 'promote_age_declaration' },
  { fn: 'guardian_rename_flagged_child', clause: 'S-06', verifier: 'verify-kid-username-change-postgres.py', proof: 'guardian_rename_flagged_child' },
];

test('every Block A verifier exists and is listed once', () => {
  for (const name of BLOCK_A) assert.ok(files.includes(name), `${name} is missing from database/scripts`);
  assert.equal(new Set(BLOCK_A).size, BLOCK_A.length);
  for (const name of EXPECTED) assert.ok(BLOCK_A.includes(name), name);
});

test('every database guard of Block A is defined by a migration and proved by a verifier the gate runs', () => {
  const chain = migrations.map((name) => read(`database/migrations/${name}`)).join('\n');
  for (const guard of GUARDS) {
    assert.match(chain, new RegExp(`FUNCTION public\\.${guard.fn}\\(`), `${guard.fn} (${guard.clause}) is no longer defined by a migration`);
    assert.ok(BLOCK_A.includes(guard.verifier), `${guard.verifier} proves ${guard.fn} but identity-db-verify.mjs does not run it`);
    assert.ok(read(`database/scripts/${guard.verifier}`).includes(guard.proof), `${guard.verifier} no longer exercises ${guard.fn} (${guard.proof})`);
  }
});

/** The body of the LATEST migration that (re)defines public.<fn>, in chain order. */
function latestDefinition(fn) {
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`, 'g');
  let body = null;
  for (const name of [...migrations].sort()) {
    for (const match of read(`database/migrations/${name}`).matchAll(pattern)) body = match[1];
  }
  return body;
}

test('a flagged session cannot race an optional event past the flag: every writer serializes on the account row the guard locks', () => {
  // Appendix M 1.1 / A.2 / H.1. The guard reads the origin, the declaration and
  // the teen choice under a FOR UPDATE lock on the auth.users row. The teen
  // choice and the declaration take that lock explicitly; the origin mark is
  // serialized by its foreign key (the FK check's KEY SHARE lock on the same
  // row conflicts with FOR UPDATE). The chain proves both orderings of both
  // races with observed lock waits in verify-origin-postgres.py.
  assert.match(latestDefinition('guard_optional_learning_event') ?? '', /FROM auth\.users WHERE id = NEW\.user_id FOR UPDATE/);
  for (const fn of ['set_teen_analytics_preference', 'record_age_declaration']) {
    assert.match(latestDefinition(fn) ?? '', /FROM auth\.users WHERE id = p_user_id FOR UPDATE/, `${fn} no longer serializes with the event guard`);
  }
  assert.match(read('database/migrations/0085_under13_origin.sql'), /user_id uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/,
    'the origin mark lost the foreign key that serializes it with the event guard');
  const origin = read('database/scripts/verify-origin-postgres.py');
  for (const label of ['lf_event_after_revoke', 'lf_revoke_after_event', 'lf_event_after_flag', 'lf_flag_after_event']) {
    assert.ok(origin.includes(`'${label}'`), `verify-origin-postgres.py lost the ${label} race`);
  }
  assert.ok(origin.includes('cardinality(pg_blocking_pids(pid)) > 0'), 'the races no longer prove a real lock wait');
});

test('a verifier that cites a Block A clause in its first line cannot be left out of the runner', () => {
  // verify-analytics-postgres.py (H.1, a hand-written 0090-era schema) is superseded by the full-chain origin proof.
  const blockA = files.filter((name) => /^verify-.+\.py$/.test(name))
    .filter((name) => /\bA\.\d+\b/.test(read(`database/scripts/${name}`).split('\n')[0]));
  assert.ok(blockA.length >= 2, blockA.join(', '));
  for (const name of blockA) assert.ok(BLOCK_A.includes(name), `${name} cites a Block A clause but identity-db-verify.mjs does not run it`);
});

test('the gate runs the whole chain, on the shared harness', () => {
  assert.equal(GATE.env.LF_PG_FULL_CHAIN, '1');
  for (const name of BLOCK_A) {
    const source = read(`database/scripts/${name}`);
    for (const variable of ['LF_PG_PORT', 'LF_PG_USER']) assert.ok(source.includes(variable), `${name} ignores ${variable}`);
    assert.ok(source.includes('LF_PG_PSQL') || source.includes('LF_PG_BIN'), `${name} cannot be pointed at a psql`);
    assert.ok(!/'-p',\s*'\d+'/.test(source), `${name} hardcodes a port`);
    assert.ok(!source.includes('SHOW data_directory') || source.includes('LF_PG_DATA'), `${name} demands the audit cluster's data directory`);
    // The whole chain: every file in database/migrations, in order, with no early stop unless LF_PG_FULL_CHAIN lifts it.
    assert.match(source, /sorted\(\(ROOT \/ 'database\/migrations'\)\.glob\('\*\.sql'\)\)/, `${name} does not apply the migration chain`);
    const stops = /\n\s+break\n/.test(source);
    assert.ok(!stops || source.includes("os.environ.get('LF_PG_FULL_CHAIN') == '1'"), `${name} stops before the end of the chain`);
    for (const single of ["'0085_under13_origin.sql'", "'0090_optional_event_admission.sql'"]) assert.ok(!source.includes(single), `${name} applies one migration instead of the chain`);
  }
});

test('CI, the unfiltered repo gates and release readiness call it', () => {
  assert.equal(JSON.parse(read('package.json')).scripts['identity:db-verify'], 'node database/scripts/identity-db-verify.mjs');
  assert.equal(JSON.parse(read('database/package.json')).scripts['identity:db-verify'], 'node scripts/identity-db-verify.mjs');
  assert.ok(JSON.parse(read('database/package.json')).scripts.test.includes('scripts/identity-db-verify.test.mjs'));
  for (const workflow of ['.github/workflows/database-ci.yml', '.github/workflows/repo-gates.yml']) {
    const text = read(workflow);
    const job = /\n {2}identity-db-verify:\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n|$)/.exec(text);
    assert.ok(job, `${workflow} has no identity-db-verify job`);
    assert.match(job[1], /image: postgres:17/, `${workflow}: the identity job has no PostgreSQL 17 service`);
    for (const env of ["LF_PG_PORT: '5432'", 'LF_PG_USER: postgres', 'LF_PG_PSQL: psql', 'LF_PG_DATA: /var/lib/postgresql/data']) {
      assert.ok(job[1].includes(env), `${workflow}: the identity job lacks ${env}`);
    }
    assert.ok(job[1].includes('run: node database/scripts/identity-db-verify.mjs'), workflow);
  }
  assert.ok(/^npm run identity:db-verify$/m.test(read('agent/tools/release-readiness.sh')));
});

test('the staff identity report names the gate as the release proof of its database checks', () => {
  const source = read('backend/src/services/identityMetrics.ts');
  const adversarial = /export const IDENTITY_ADVERSARIAL = \[([\s\S]*?)\] as const;/.exec(source)?.[1] ?? '';
  const entry = (id) => new RegExp(`id: '${id}'[^\\n]*`).exec(adversarial)?.[0] ?? '';
  for (const id of ['flagged_session_unconsented_analytics', 'kid_email_change_unauthorized']) {
    assert.ok(entry(id).includes('npm run identity:db-verify'), `${id} does not name the identity:db-verify gate`);
  }
  assert.ok(entry('flagged_session_unconsented_analytics').includes('verify-origin-postgres.py'));
  assert.ok(entry('kid_email_change_unauthorized').includes('verify-kid-email-guard-postgres.py'));
});
