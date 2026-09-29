"""Gap-fix round 3, learning lane, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim,
applies EVERY migration in database/migrations in order, and proves at the
enforcing boundary (migration v2_selection_task_diagnostics):

  - the widened receipt CHECK accepts the five L1 selection-task codes
    (confirmation_bias, p_only_missing_not_q, matching, not_p_checked,
    all_cards) and every code an older Core writes, and still refuses an
    unknown code and the other malformed fields the previous CHECK refused;
  - learning_error_family_split (0207) reports each selection code by name,
    as an answer error, on first tries only, service role only.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP, LF_PG_REPORT
(see verify-teen-discoverable-postgres.py).
"""

import json
import os
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PSQL = os.environ.get('LF_PG_PSQL', str(ROOT / '.codex/audit-db/pgsql/bin/psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


SHIM = """
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb, email_change text DEFAULT '',
    created_at timestamptz DEFAULT now(), is_anonymous boolean DEFAULT false);
CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_learning_r3_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def rejected(query, message):
    try:
        run(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'expected {message!r}, the statement succeeded')


def check(name):
    checks.append(name)
    print('ok -', name)


SELECTION = ['confirmation_bias', 'p_only_missing_not_q', 'matching', 'not_p_checked', 'all_cards']
OLDER = ['none', 'structure', 'value', 'partial', 'miss', 'false_alarm', 'path', 'outcome', 'bin', 'reason', 'tolerance', 'count_from_zero']

try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    user = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{user}', 'learner@example.com');")

    def receipt(jti, run_id, segment, verdict, at="now()"):
        return f"""SET session_replication_role = replica;
          INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict, created_at)
          VALUES ('{jti}', '{user}', '{run_id}', '{uuid.uuid4()}', '{segment}', '{json.dumps(verdict)}'::jsonb, {at});"""

    for index, code in enumerate(SELECTION):
        run_id = str(uuid.uuid4())
        run(receipt(f'jti-select-{index:015d}', run_id, 'cards-01', {'correct': False, 'score': 0, 'diagnostic': code, 'item_role': 'practice', 'kc': 'kc-conditional-check'},
                    "now() - interval '2 minutes'"))
        if code == 'confirmation_bias':
            # A retry on the same run is not a first try: the split must not count it.
            run(receipt(f'jti-select-retry-{index:09d}', run_id, 'cards-01', {'correct': False, 'score': 0, 'diagnostic': 'matching'}))
    run(receipt('jti-select-second-00001', str(uuid.uuid4()), 'cards-01', {'correct': False, 'score': 0, 'diagnostic': 'confirmation_bias'}))
    for index, code in enumerate(OLDER):
        run(receipt(f'jti-older-{index:016d}', str(uuid.uuid4()), 'older-01', {'correct': code == 'none', 'score': 100 if code == 'none' else 0, 'diagnostic': code}))
    check('the receipt CHECK accepts the five L1 selection-task codes and every code an older Core writes')

    rejected(receipt('jti-bad-code-000000001', str(uuid.uuid4()), 'cards-01', {'correct': False, 'score': 0, 'diagnostic': 'wason'}), 'lesson_v2_grade_receipts_signals_check')
    rejected(receipt('jti-bad-hints-00000001', str(uuid.uuid4()), 'cards-01', {'correct': False, 'score': 0, 'diagnostic': 'matching', 'hints_used': 3}), 'lesson_v2_grade_receipts_signals_check')
    rejected(receipt('jti-bad-stage-00000001', str(uuid.uuid4()), 'cards-01', {'correct': False, 'score': 0, 'entry_stage': 'symbolic'}), 'lesson_v2_grade_receipts_signals_check')
    check('an unknown diagnostic and the malformed fields the previous CHECK refused are still refused')

    window = "now() - interval '1 day', now() + interval '1 day'"
    rows = run(f"SET ROLE service_role; SELECT family || ':' || diagnostic || ':' || errors FROM learning_error_family_split({window}) WHERE diagnostic = ANY(ARRAY{SELECTION});").splitlines()
    split = dict((row.split(':')[1], (row.split(':')[0], int(row.split(':')[2]))) for row in rows)
    assert split == {'confirmation_bias': ('answer', 2), 'p_only_missing_not_q': ('answer', 1), 'matching': ('answer', 1),
                     'not_p_checked': ('answer', 1), 'all_cards': ('answer', 1)}, split
    rejected(f"SET ROLE authenticated; SELECT * FROM learning_error_family_split({window});", 'permission denied')
    check('learning_error_family_split reports each selection code by name as an answer error on first tries; browsers read nothing')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; fixture receipts inserted directly (FKs skipped, CHECKs enforced); not PostgREST or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
