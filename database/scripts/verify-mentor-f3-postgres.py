"""GAP-FIX-R3 (mentor lane): the Mentor canary arm column (C.22, Appendix F
Stage 5) and Age-Tier Calibration Coverage (C.1, Appendix F 1.3), against
real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, the minimal Supabase shim the other native
verifiers use, EVERY migration applied in order, then at the enforcing
boundary:

  - tutor_sessions.canary_proposal_id / canary_arm: a well-formed pair is
    stored; an arm outside the closed set, a malformed proposal id, and an arm
    without its proposal (or the reverse) are refused;
  - mentor_age_calibration_coverage counts the window's sessions, those by
    learners of unknown age AS OF THE SESSION START (no birth date and no
    13_to_17/adult declaration without an under-13 origin), and how many of
    those had the calibration before the session started; a known age (an
    adult or teen declaration, a birth date under 13) is not counted; a
    declaration or a calibration made after the session does not count;
  - only the service role calls the function (anon and authenticated are
    refused);
  - both migrations replay without error and without changing a row.

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
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
CANARY = next(m for m in MIGRATIONS if m.name.endswith('_mentor_canary_arm.sql'))
COVERAGE = next(m for m in MIGRATIONS if m.name.endswith('_mentor_age_calibration_coverage.sql'))


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

database = 'lf_mentor_f3_' + uuid.uuid4().hex[:12]
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


try:
    run(SHIM)
    for migration in MIGRATIONS:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(MIGRATIONS)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # ── the canary arm ──
    owner = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{owner}', 'adult@example.com')")
    s = run(f"INSERT INTO tutor_sessions (user_id, locale, tier, character, diorama, intent) VALUES ('{owner}', 'en-US', 3, 'rho', 'a', 'open') RETURNING id;").splitlines()[-1]
    run(f"UPDATE tutor_sessions SET canary_proposal_id = 'P-2026-10-01-latency-z', canary_arm = 'canary' WHERE id = '{s}'")
    assert run(f"SELECT canary_proposal_id || '/' || canary_arm FROM tutor_sessions WHERE id = '{s}'") == 'P-2026-10-01-latency-z/canary'
    run(f"UPDATE tutor_sessions SET canary_arm = 'control' WHERE id = '{s}'")
    rejected(f"UPDATE tutor_sessions SET canary_arm = 'holdout' WHERE id = '{s}'", 'check constraint')
    rejected(f"UPDATE tutor_sessions SET canary_proposal_id = 'latency z' WHERE id = '{s}'", 'check constraint')
    rejected(f"UPDATE tutor_sessions SET canary_arm = NULL WHERE id = '{s}'", 'tutor_sessions_canary_pair')
    s2 = run(f"INSERT INTO tutor_sessions (user_id, locale, tier, character, diorama, intent) VALUES ('{owner}', 'en-US', 3, 'rho', 'a', 'open') RETURNING id;").splitlines()[-1]
    rejected(f"UPDATE tutor_sessions SET canary_arm = 'canary' WHERE id = '{s2}'", 'tutor_sessions_canary_pair')
    assert run(f"SELECT count(*) FROM tutor_sessions WHERE canary_proposal_id IS NULL AND canary_arm IS NULL AND id = '{s2}'") == '1'
    check('the canary arm is stored as a pair; an unknown arm, a malformed proposal id and a half-written pair are refused')

    # ── Age-Tier Calibration Coverage ──
    run('DELETE FROM tutor_sessions')
    U = {k: str(uuid.uuid4()) for k in ('none_cal', 'none_late', 'adult', 'under13_decl', 'kid_birth', 'adult_late', 'teen', 'outside')}
    run(';'.join(f"INSERT INTO auth.users (id, email) VALUES ('{u}', '{k}@example.com')" for k, u in U.items()))
    start = "now() - interval '2 days'"
    run(f"""
    -- A known age: an adult and a teen declaration (no origin), a parent-created child's birth date under 13.
    INSERT INTO account_age_declarations (user_id, declared_age_band, created_at) VALUES
      ('{U['adult']}', 'adult', now() - interval '30 days'),
      ('{U['teen']}', '13_to_17', now() - interval '30 days'),
      ('{U['under13_decl']}', 'under_13', now() - interval '30 days'),
      ('{U['adult_late']}', 'adult', now() - interval '1 day');
    INSERT INTO account_safety_origins (user_id, created_at) VALUES ('{U['under13_decl']}', now() - interval '30 days');
    UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '9 years')::date WHERE user_id = '{U['kid_birth']}';
    -- The calibrations: before the session, or only after it.
    INSERT INTO mentor_age_calibrations (user_id, tier, created_at) VALUES
      ('{U['none_cal']}', 2, now() - interval '10 days'),
      ('{U['none_late']}', 2, now() - interval '1 day'),
      ('{U['under13_decl']}', 1, now() - interval '10 days');
    """)
    for key in ('none_cal', 'none_late', 'adult', 'under13_decl', 'kid_birth', 'adult_late', 'teen'):
        run(f"INSERT INTO tutor_sessions (user_id, locale, tier, character, diorama, intent, started_at) VALUES ('{U[key]}', 'en-US', 2, 'rho', 'a', 'open', {start})")
    run(f"INSERT INTO tutor_sessions (user_id, locale, tier, character, diorama, intent, started_at) VALUES ('{U['outside']}', 'en-US', 2, 'rho', 'a', 'open', now() - interval '60 days')")
    row = run("SET ROLE service_role; SELECT sessions || ',' || unknown_age_sessions || ',' || calibrated_before_start || ',' || coverage FROM mentor_age_calibration_coverage(now() - interval '30 days', now())").splitlines()[-1]
    # Unknown at the start: none_cal (calibrated), none_late (calibrated after), under13_decl (origin, calibrated),
    # adult_late (declared after the start, not calibrated). Known: adult, teen, kid_birth. Outside the window: outside.
    assert row == '7,4,2,0.5000', row
    empty = run("SET ROLE service_role; SELECT sessions || ',' || unknown_age_sessions || ',' || calibrated_before_start || ',' || coalesce(coverage::text, 'null') FROM mentor_age_calibration_coverage(now() - interval '400 days', now() - interval '300 days')").splitlines()[-1]
    assert empty == '0,0,0,null', empty
    check('coverage counts unknown-age sessions as of their start (no birth date, no teen/adult declaration without an origin) and only calibrations made before the session; known ages and other windows are not counted')

    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT * FROM mentor_age_calibration_coverage(now() - interval '30 days', now())", 'permission denied')
    check('only the service role calls mentor_age_calibration_coverage (anon and authenticated are refused)')

    before = run("SELECT count(*) || ':' || count(canary_arm) FROM tutor_sessions")
    run(CANARY.read_text(encoding='utf-8'))
    run(COVERAGE.read_text(encoding='utf-8'))
    assert run("SELECT count(*) || ':' || count(canary_arm) FROM tutor_sessions") == before
    check(f'{CANARY.name} and {COVERAGE.name} replay without error and without changing a row')
    print(f'\n{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
