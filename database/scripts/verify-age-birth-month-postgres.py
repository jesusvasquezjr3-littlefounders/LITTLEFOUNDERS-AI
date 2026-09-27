"""OD-28 (S-04): a declared teen keeps a birth month and moves to adult at 18.

Applies the ACTUAL migration chain (every file in database/migrations, in
order, through the age_declaration_birth_month migration) to a fresh database
on an owned native PostgreSQL cluster, over the minimal Supabase shim the S07
verifiers use, then checks: only a teen's month is kept and only on the first
declaration; malformed months are refused; promotion happens only when due
(read as the birth month's last day), never for an under-13 origin, once
under concurrency, clears the month and moves the social tier; the browser
roles can neither read the table nor call the functions; replaying the
migration keeps every row.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN    directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
  LF_PG_DATA   the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/w2s3-age-birth-month-postgres.json)
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
import json
import os
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/w2s3-age-birth-month-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
TARGET = next(m for m in MIGRATIONS if m.name.endswith('_age_declaration_birth_month.sql'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')

SHIM = """
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
                         is_anonymous boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_age_month_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql(SHIM, database)
for migration in MIGRATIONS:
    if migration.name > TARGET.name:
        break
    sql(migration.read_text(encoding='utf-8'), database)


def service(statement):
    return sql(f'SET ROLE service_role; {statement}', database)


def account(anonymous=False):
    uid = str(uuid.uuid4())
    sql(f"INSERT INTO auth.users(id, is_anonymous) VALUES ('{uid}', {str(anonymous).lower()})", database)
    return uid


def row(uid):
    return sql(f"SELECT declared_age_band || '|' || coalesce(declared_birth_month::text, '-') || '|' || "
               f"(promoted_to_adult_at IS NOT NULL) FROM account_age_declarations WHERE user_id = '{uid}'", database)


today = date.today()
teen_month = date(today.year - 15, today.month, 1).isoformat()
due_month = date(today.year - 19, 1, 1).isoformat()
other_month = date(today.year - 17, 1, 1).isoformat()
report = {'database': database, 'provenance': 'Native PostgreSQL; the real migration chain over a minimal Supabase shim',
          'fullSupabaseAcceptance': False}

# 1. What is kept: a teen's month only, only on the first declaration.
teen = account()
assert service(f"SELECT record_age_declaration('{teen}', '13_to_17', '{teen_month}')") == '13_to_17'
assert row(teen) == f'13_to_17|{teen_month}|false', row(teen)
assert service(f"SELECT record_age_declaration('{teen}', '13_to_17', '{other_month}')") == '13_to_17'
assert service(f"SELECT record_age_declaration('{teen}', 'adult', NULL)") == '13_to_17'
assert row(teen) == f'13_to_17|{teen_month}|false', 'a later declaration changed the first'
adult = account()
assert service(f"SELECT record_age_declaration('{adult}', 'adult', '{teen_month}')") == 'adult'
assert row(adult) == 'adult|-|false', 'an adult kept a month'
child = account()
assert service(f"SELECT record_age_declaration('{child}', 'under_13', '{teen_month}')") == 'under_13'
assert row(child) == 'under_13|-|false', 'an under-13 kept a month'
legacy = account()
assert service(f"SELECT record_age_declaration('{legacy}', '13_to_17')") == '13_to_17'
assert row(legacy) == '13_to_17|-|false'
report['keptOnlyForTeenFirstDeclaration'] = True

refusals = 0
for bad in (f'{today.year - 15}-03-17', f'{today.year + 1}-01-01', '1990-01-01'):
    try:
        service(f"SELECT record_age_declaration('{account()}', '13_to_17', '{bad}')")
    except RuntimeError as error:
        assert 'Invalid birth month' in str(error), str(error)
        refusals += 1
    else:
        raise AssertionError(f'accepted a malformed month {bad}')
for forged in ("UPDATE account_age_declarations SET declared_birth_month = '2010-05-17'",
               "UPDATE account_age_declarations SET declared_birth_month = '2010-05-01' WHERE declared_age_band = 'adult'",
               "UPDATE account_age_declarations SET promoted_to_adult_at = now() WHERE declared_age_band = '13_to_17'"):
    try:
        sql(forged, database)
    except RuntimeError as error:
        assert 'check constraint' in str(error), str(error)
        refusals += 1
    else:
        raise AssertionError(f'the table shape accepted: {forged}')
report['malformedRefusals'] = refusals

# 2. When the move happens: the month's last day is the birthday.
fn = 'age_declaration_promotion_due'
assert sql(f"SELECT {fn}('2008-09-01', '2026-09-30 23:59:59+00')", database) == 'f'
assert sql(f"SELECT {fn}('2008-09-01', '2026-10-01 00:00:00+00')", database) == 't'
assert sql(f"SELECT {fn}('2008-12-01', '2027-01-01 00:00:00+00')", database) == 't'
assert sql(f"SELECT {fn}(NULL, now())", database) == 'f'
assert service(f"SELECT promote_age_declaration('{teen}')") == '13_to_17'
assert row(teen) == f'13_to_17|{teen_month}|false', 'a teen was promoted early'
report['promotionReadsLastDayOfMonth'] = True

# 3. Due teens move once, with the month cleared and the tier moved.
due = account()
sql(f"INSERT INTO account_age_declarations(user_id, declared_age_band, declared_birth_month) VALUES ('{due}', '13_to_17', '{due_month}')", database)
tier_before = sql(f"SELECT social_tier('{due}')", database)
with ThreadPoolExecutor(max_workers=8) as pool:
    bands = list(pool.map(lambda _: service(f"SELECT promote_age_declaration('{due}')"), range(8)))
assert bands == ['adult'] * 8, bands
assert row(due) == 'adult|-|true', row(due)
tier_after = sql(f"SELECT social_tier('{due}')", database)
assert (tier_before, tier_after) == ('teen', 'adult'), (tier_before, tier_after)
stamp = sql(f"SELECT promoted_to_adult_at FROM account_age_declarations WHERE user_id = '{due}'", database)
assert service(f"SELECT promote_age_declaration('{due}')") == 'adult'
assert sql(f"SELECT promoted_to_adult_at FROM account_age_declarations WHERE user_id = '{due}'", database) == stamp
report['concurrentPromotionOnce'] = True
report['socialTierMoves'] = f'{tier_before} -> {tier_after}'

# 4. An under-13 origin is never promoted, by one call or by the batch.
protected = account(anonymous=True)
sql(f"INSERT INTO account_age_declarations(user_id, declared_age_band, declared_birth_month) VALUES ('{protected}', '13_to_17', '{due_month}')", database)
service(f"SELECT mark_under13_origin('{protected}')")
assert service(f"SELECT promote_age_declaration('{protected}')") == '13_to_17'
batch_a, batch_b = account(), account()
for uid in (batch_a, batch_b):
    sql(f"INSERT INTO account_age_declarations(user_id, declared_age_band, declared_birth_month) VALUES ('{uid}', '13_to_17', '{due_month}')", database)
assert service('SELECT promote_due_age_declarations()') == '2'
assert service('SELECT promote_due_age_declarations()') == '0'
assert row(protected) == f'13_to_17|{due_month}|false'
assert row(batch_a) == row(batch_b) == 'adult|-|true'
report['under13OriginNeverPromoted'] = True
report['batchIdempotent'] = True

# 5. The browser has no way in.
denials = 0
for role in ('anon', 'authenticated'):
    for statement in ('SELECT * FROM public.account_age_declarations',
                      f"SELECT public.record_age_declaration('{teen}', '13_to_17', '{other_month}')",
                      f"SELECT public.promote_age_declaration('{teen}')",
                      'SELECT public.promote_due_age_declarations()',
                      f"UPDATE public.account_age_declarations SET declared_age_band = 'adult' WHERE user_id = '{teen}'"):
        try:
            sql(f'SET ROLE {role}; {statement}', database)
        except RuntimeError as error:
            assert 'permission denied' in str(error), str(error)
            denials += 1
        else:
            raise AssertionError(f'{role} bypassed: {statement}')
for privilege in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'):
    assert sql(f"SELECT has_table_privilege('service_role', 'public.account_age_declarations', '{privilege}')", database) == 'f'
assert sql("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.account_age_declarations'::regclass", database) == 't'
report['browserDenials'] = denials

# 6. Replay keeps every row.
snapshot = sql('SELECT json_agg(d ORDER BY user_id) FROM account_age_declarations d', database)
sql(TARGET.read_text(encoding='utf-8'), database)
assert sql('SELECT json_agg(d ORDER BY user_id) FROM account_age_declarations d', database) == snapshot
report['replayPreservesRows'] = True

sql(f'DROP DATABASE {database}')
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
