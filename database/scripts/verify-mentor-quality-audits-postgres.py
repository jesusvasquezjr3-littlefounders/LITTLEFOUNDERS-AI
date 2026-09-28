"""GAP-FIX-R2 staff-ops: the C.24 dashboard's per-release manual audits
(release_audit_results, B.25 / B.22 / B.20) and Parent Time-to-Value
(parent_time_to_value, B.10), against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, a minimal Supabase shim, EVERY migration applied
in order, then at the enforcing boundary:

  - record_release_audit records only for a NAMED OWNER of the kind's role
    (dark_pattern and variable_ratio: safety_trust_lead; reward_framing:
    pedagogical_lead), refuses inconsistent values, records a release once,
    and writes its audit_logs row in the same transaction;
  - a recorded audit is never edited or deleted, except the erasure of the
    reviewer's account nulling reviewer_id (E.6);
  - the two parent events are accepted by the event CHECK, and
    parent_time_to_value counts signups in the window, the parents who
    reached first value after their signup, the median and 75th percentile
    and those within the 3-minute target;
  - no browser role reads the table or calls either function.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP.
"""

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

database = 'lf_mq_audits_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    out = run('SET ROLE service_role;' + query)
    return out.splitlines()[-1] if out else ''


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


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    I = {k: str(uuid.uuid4()) for k in ('safety', 'peda', 'other')}
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{I['safety']}', 'safety@littlefounders.ai'), ('{I['peda']}', 'peda@littlefounders.ai'), ('{I['other']}', 'other@littlefounders.ai');
    INSERT INTO mentor_quality_owner (owner_role, user_id) VALUES ('safety_trust_lead', '{I['safety']}'), ('pedagogical_lead', '{I['peda']}');
    """)
    rec = lambda actor, kind, release, result, findings: service(
        f"SELECT record_release_audit('{actor}', '{kind}', '{release}', '{result}', {findings}, 'note')")

    assert rec(I['other'], 'dark_pattern', 'r-1', 'pass', 0) == 'not_owner'
    assert rec(I['peda'], 'dark_pattern', 'r-1', 'pass', 0) == 'not_owner'
    assert rec(I['safety'], 'reward_framing', 'r-1', 'pass', 0) == 'not_owner'
    assert rec(I['safety'], 'dark_pattern', 'r-1', 'fail', 0) == 'invalid'
    assert rec(I['safety'], 'dark_pattern', 'r-1', 'pass', 2) == 'invalid'
    assert rec(I['safety'], 'loot_box', 'r-1', 'pass', 0) == 'invalid'
    assert rec(I['safety'], 'dark_pattern', 'bad id', 'pass', 0) == 'invalid'
    assert run('SELECT count(*) FROM release_audit_results') == '0'
    assert rec(I['safety'], 'dark_pattern', 'r-1', 'fail', 3) == 'recorded'
    assert rec(I['safety'], 'variable_ratio', 'r-1', 'pass', 0) == 'recorded'
    assert rec(I['peda'], 'reward_framing', 'r-1', 'pass', 0) == 'recorded'
    assert rec(I['safety'], 'dark_pattern', 'r-1', 'pass', 0) == 'duplicate'
    assert run('SELECT count(*) FROM release_audit_results') == '3'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'mentor_quality.release_audit.recorded' AND actor_id = '{I['safety']}'") == '2'
    assert run("SELECT detail ->> 'owner_role' FROM audit_logs WHERE action = 'mentor_quality.release_audit.recorded' AND detail ->> 'kind' = 'reward_framing'") == 'pedagogical_lead'
    check('record_release_audit records only for the named owner of the kind\'s role, refuses inconsistent values and a second audit of the same release, and audits in the same transaction')

    rejected("UPDATE release_audit_results SET result = 'pass', finding_count = 0 WHERE audit_kind = 'dark_pattern'", 'never edited or removed')
    rejected("DELETE FROM release_audit_results WHERE audit_kind = 'variable_ratio'", 'never edited or removed')
    rejected("SET ROLE service_role; DELETE FROM release_audit_results", 'never edited or removed')
    run(f"DELETE FROM mentor_quality_owner WHERE user_id = '{I['peda']}'; DELETE FROM auth.users WHERE id = '{I['peda']}'")
    assert run("SELECT reviewer_id IS NULL AND result = 'pass' FROM release_audit_results WHERE audit_kind = 'reward_framing'") == 't'
    check('a recorded audit is never edited or deleted, even by the owner session; erasing the reviewer\'s account only nulls reviewer_id (E.6)')

    P = [str(uuid.uuid4()) for _ in range(5)]
    for index, parent in enumerate(P):
        run(f"""
        INSERT INTO auth.users (id, email) VALUES ('{parent}', 'p{index}@example.com');
        INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES ('{parent}', 'adult');
        INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{parent}', 'parent', NULL);
        """)
    ev = lambda user, event, at: f"INSERT INTO learning_events (user_id, role, event, route_class, created_at) VALUES ('{user}', 'parent', '{event}', 'family', now() - interval '{at}')"
    run(';'.join([
        ev(P[0], 'parent_signup_completed', '2 days'), ev(P[0], 'parent_first_value', '2 days -60 seconds'),
        ev(P[1], 'parent_signup_completed', '3 days'), ev(P[1], 'parent_first_value', '3 days -120 seconds'), ev(P[1], 'parent_first_value', '1 day'),
        ev(P[2], 'parent_signup_completed', '4 days'), ev(P[2], 'parent_first_value', '4 days -600 seconds'),
        ev(P[3], 'parent_signup_completed', '5 days'),
        ev(P[4], 'parent_signup_completed', '60 days'), ev(P[4], 'parent_first_value', '60 days -30 seconds'),
    ]))
    row = service("SELECT signups || ',' || reached || ',' || median_seconds || ',' || p75_seconds || ',' || within_target FROM parent_time_to_value(now() - interval '30 days', now())")
    assert row == '4,3,120.0,360.0,2', row
    service(f"INSERT INTO learning_events (user_id, role, event, route_class) VALUES ('{P[3]}', 'parent', 'parent_first_value', 'family')")
    check('the parent events pass the event CHECK; parent_time_to_value counts window signups (4), first value after signup (3), median 120 s, p75 360 s, 2 within 3 minutes')

    for role in ('anon', 'authenticated'):
        for query in ('SELECT count(*) FROM release_audit_results',
                      f"SELECT record_release_audit('{I['safety']}', 'dark_pattern', 'r-2', 'pass', 0, NULL)",
                      "SELECT count(*) FROM parent_time_to_value(now() - interval '1 day', now())"):
            rejected(f'SET ROLE {role}; {query}', 'permission denied')
    check('no browser role reads the audits or calls record_release_audit or parent_time_to_value')
    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
