"""Gap-fix round 1 (Mentor lane): the tell, budget and self-naming counts on
tutor_dialogue_calibration, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim, applies
EVERY migration in database/migrations in order, and proves at the enforcing
boundary (migration mentor_tell_budget_self_naming_counts):

  - a close row written by an Oracle that predates the counts still inserts,
    with the six new columns NULL (the scorer reads NULL as "not measured");
  - a row with the counts inserts; a count out of range is refused;
  - more tell answers plus withdrawals than tell requests is refused;
  - the table stays behind RLS, closed to the browser roles.

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

database = 'lf_mentor_counts_' + uuid.uuid4().hex[:12]
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


ROW = ("INSERT INTO tutor_dialogue_calibration (character, band, variant, assignment, ladder_rungs, hint_requests, "
       "tell_requests, controlling_caught, controlling_delivered, pacing_offers, unilateral_style_changes{extra}) "
       "VALUES ('rho', 'young_child', 'calibrated', 'not_eligible', 4, 0, {tell}, 0, 0, 0, 0{values})")


def row(tell=0, **counts):
    extra = ''.join(f', {k}' for k in counts)
    values = ''.join(f', {v}' for v in counts.values())
    return ROW.format(extra=extra, values=values, tell=tell)


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    run(row(tell=1))
    assert run("SELECT count(*) FROM tutor_dialogue_calibration WHERE tell_delivered IS NULL AND budget_caught IS NULL "
               "AND self_naming_delivered IS NULL") == '1'
    check('a close row from an Oracle that predates the counts inserts, with the new columns NULL')

    run(row(tell=2, tell_delivered=1, tell_withdrawn=1, budget_caught=3, budget_delivered=1,
            self_naming_caught=1, self_naming_delivered=0))
    rejected(row(tell=1, tell_delivered=1, tell_withdrawn=1), 'tutor_dialogue_calibration_tell_answers')
    rejected(row(tell=0, budget_caught=-1), 'violates check constraint')
    rejected(row(tell=0, self_naming_delivered=10001), 'violates check constraint')
    check('the counts insert; out-of-range counts and more tell answers than requests are refused')

    assert run("SELECT relrowsecurity FROM pg_class WHERE relname = 'tutor_dialogue_calibration'") == 't'
    for role in ('anon', 'authenticated'):
        assert run(f"SET ROLE {role}; SELECT count(*) FROM tutor_dialogue_calibration") == '0'
    check('the table stays behind RLS: the browser roles read no row')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
