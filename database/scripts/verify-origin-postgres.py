"""Supplemental A.2 storage checks on the owned native audit cluster.

Creates a fresh database; never resets or drops an existing database. Minimal
auth fixtures do not certify GoTrue or replace the full Supabase reset gates.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex' / 'audit-db'
BASE = [str(RUNTIME / 'pgsql/bin/psql.exe'), '-X', '-h', '127.0.0.1',
        '-p', '15483', '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True,
                            encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != (RUNTIME / 'data').resolve():
    raise RuntimeError('Refusing a cluster not owned by this audit')

for role in ('anon', 'authenticated', 'service_role'):
    if sql(f"SELECT count(*) FROM pg_roles WHERE rolname='{role}'") != '1':
        raise RuntimeError(f'Missing audit role: {role}')

database = f'lf_origin_{uuid.uuid4().hex}'
sql(f'CREATE DATABASE {database}')
sql("""
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, is_anonymous boolean,
    raw_user_meta_data jsonb DEFAULT '{}');
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Simulate Supabase's broad defaults: the migration must explicitly revoke.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
""", database)
migration = (ROOT / 'database/migrations/0085_under13_origin.sql').read_text(encoding='utf-8')
sql(migration, database)
age_migration = (ROOT / 'database/migrations/0086_age_declarations.sql').read_text(encoding='utf-8')
sql(age_migration, database)
user = str(uuid.uuid4())
sql(f"INSERT INTO auth.users(id,is_anonymous) VALUES ('{user}',true)", database)


def mark(_):
    return sql(f"SET ROLE service_role; SELECT public.mark_under13_origin('{user}')", database)


with ThreadPoolExecutor(max_workers=8) as pool:
    assert list(pool.map(mark, range(8))) == ['t'] * 8
assert sql('SELECT count(*) FROM account_safety_origins', database) == '1'
before = sql('SELECT row_to_json(o) FROM account_safety_origins o', database)
# Identity changes and user metadata cannot clear a record keyed to auth ID.
sql(f"UPDATE auth.users SET is_anonymous=false,email='synthetic@example.invalid',"
    f"raw_user_meta_data='{{\"under13_origin\":false}}' WHERE id='{user}'", database)
assert sql('SELECT row_to_json(o) FROM account_safety_origins o', database) == before
denials = 0
for role in ('anon', 'authenticated'):
    for statement in (
        'SELECT * FROM public.account_safety_origins',
        f"SELECT public.mark_under13_origin('{user}')",
        'DELETE FROM public.account_safety_origins',
        'UPDATE public.account_safety_origins SET under13_origin=false',
        f"INSERT INTO public.account_safety_origins(user_id) VALUES ('{uuid.uuid4()}')",
    ):
        try:
            sql(f'SET ROLE {role}; {statement}', database)
        except RuntimeError as error:
            assert 'permission denied' in str(error), str(error)
            denials += 1
        else:
            raise AssertionError(f'{role} bypassed the storage boundary')
sql(migration, database)
assert sql('SELECT row_to_json(o) FROM account_safety_origins o', database) == before
for privilege in ('UPDATE', 'DELETE', 'TRUNCATE'):
    assert sql(f"SELECT has_table_privilege('service_role','public.account_safety_origins','{privilege}')", database) == 'f'
sql(f"DELETE FROM auth.users WHERE id='{user}'", database)
assert sql('SELECT count(*) FROM account_safety_origins', database) == '0'
report = {'database': database, 'provenance': 'Native PostgreSQL; minimal auth fixtures',
          'concurrentMarks': 8, 'storedRecords': 1, 'browserDenials': denials,
          'identityUpgradePreservesOrigin': True, 'migrationReplayPreservesOrigin': True,
          'accountDeletionRemovesOrigin': True, 'fullSupabaseAcceptance': False}
age_user = str(uuid.uuid4())
sql(f"INSERT INTO auth.users(id,is_anonymous) VALUES ('{age_user}',false)", database)

def declare(band):
    return sql(f"SET ROLE service_role; SELECT public.record_age_declaration('{age_user}','{band}')", database)

assert declare('under_13') == 'under_13'
with ThreadPoolExecutor(max_workers=8) as pool:
    assert list(pool.map(declare, ['adult'] * 8)) == ['under_13'] * 8
assert sql(f"SELECT under13_origin FROM account_safety_origins WHERE user_id='{age_user}'", database) == 't'
sql(age_migration, database)
assert declare('13_to_17') == 'under_13'
for role in ('anon', 'authenticated'):
    assert sql(f"SELECT has_function_privilege('{role}','public.record_age_declaration(uuid,text)','EXECUTE')", database) == 'f'
    assert sql(f"SELECT has_table_privilege('{role}','public.account_age_declarations','SELECT')", database) == 'f'
for privilege in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'):
    assert sql(f"SELECT has_table_privilege('service_role','public.account_age_declarations','{privilege}')", database) == 'f'
late_user = str(uuid.uuid4())
sql(f"INSERT INTO auth.users(id) VALUES ('{late_user}')", database)
sql(f"SET ROLE service_role; SELECT record_age_declaration('{late_user}','adult'); SELECT record_age_declaration('{late_user}','under_13')", database)
assert sql(f"SELECT under13_origin FROM account_safety_origins WHERE user_id='{late_user}'", database) == 't'
failed_user = str(uuid.uuid4())
sql(f"INSERT INTO auth.users(id) VALUES ('{failed_user}')", database)
sql("""CREATE FUNCTION public.reject_age_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Injected age write failure'; END; $$;
CREATE TRIGGER reject_age_fixture BEFORE INSERT ON public.account_age_declarations
FOR EACH ROW EXECUTE FUNCTION public.reject_age_fixture();""", database)
try:
    sql(f"SET ROLE service_role; SELECT record_age_declaration('{failed_user}','under_13')", database)
except RuntimeError as error:
    assert 'Injected age write failure' in str(error)
else:
    raise AssertionError('Failure injection did not run')
assert sql(f"SELECT count(*) FROM account_safety_origins WHERE user_id='{failed_user}'", database) == '0'
assert sql(f"SELECT count(*) FROM account_age_declarations WHERE user_id='{failed_user}'", database) == '0'
report.update({'ageDeclarationImmutableUnderConcurrency': True, 'under13DeclarationMarksOriginAtomically': True,
               'lateUnder13DisclosureProtects': True, 'ageDeclarationBrowserAccessDenied': True,
               'failedAgeWriteRollsBackOrigin': True})
sql('CREATE TABLE public.profiles(user_id uuid PRIMARY KEY, birth_date date, display_name text)', database)
profile_migration = (ROOT / 'database/migrations/0087_profile_birth_date_guard.sql').read_text(encoding='utf-8')
sql(profile_migration, database)
sql(f"SET ROLE service_role; INSERT INTO profiles VALUES ('{age_user}','2016-05-01','Synthetic')", database)
profile_denials = 0
for role in ('anon', 'authenticated'):
    for statement in (
        f"UPDATE profiles SET birth_date='1990-01-01' WHERE user_id='{age_user}'",
        f"UPDATE profiles SET birth_date=NULL WHERE user_id='{age_user}'",
        f"INSERT INTO profiles VALUES ('{uuid.uuid4()}','1990-01-01','Forged')",
    ):
        try:
            sql(f'SET ROLE {role}; {statement}', database)
        except RuntimeError as error:
            assert 'reviewed identity workflow' in str(error), str(error)
            profile_denials += 1
        else:
            raise AssertionError('Browser changed a protected profile date')
sql(f"SET ROLE authenticated; UPDATE profiles SET display_name='Changed' WHERE user_id='{age_user}'", database)
assert sql(f"SELECT birth_date FROM profiles WHERE user_id='{age_user}'", database) == '2016-05-01'
sql(profile_migration, database)
assert sql(f"SELECT birth_date FROM profiles WHERE user_id='{age_user}'", database) == '2016-05-01'
report.update({'profileDateBrowserDenials': profile_denials, 'profileOtherFieldsRemainWritable': True,
               'profileGuardReplayPreservesDates': True})
calibration_migration = (ROOT / 'database/migrations/0088_mentor_age_calibration.sql').read_text(encoding='utf-8')
sql(calibration_migration, database)
origin_before_calibration = sql('SELECT json_agg(o ORDER BY user_id) FROM account_safety_origins o', database)
assert sql(f"SET ROLE service_role; SELECT record_mentor_age_calibration('{age_user}',1::smallint)", database) == '1'
with ThreadPoolExecutor(max_workers=8) as pool:
    attempts = list(pool.map(lambda _: sql(f"SET ROLE service_role; SELECT record_mentor_age_calibration('{age_user}',3::smallint)", database), range(8)))
assert attempts == ['1'] * 8
for role in ('anon', 'authenticated'):
    for statement in ('SELECT * FROM mentor_age_calibrations', f"SELECT record_mentor_age_calibration('{age_user}',3::smallint)"):
        try:
            sql(f'SET ROLE {role}; {statement}', database)
        except RuntimeError as error:
            assert 'permission denied' in str(error)
        else:
            raise AssertionError('Browser accessed teaching calibration storage')
for privilege in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'):
    assert sql(f"SELECT has_table_privilege('service_role','public.mentor_age_calibrations','{privilege}')", database) == 'f'
assert sql('SELECT json_agg(o ORDER BY user_id) FROM account_safety_origins o', database) == origin_before_calibration
sql(calibration_migration, database)
assert sql(f"SELECT tier FROM mentor_age_calibrations WHERE user_id='{age_user}'", database) == '1'
report.update({'calibrationFirstWriteWinsUnderConcurrency': True, 'calibrationDoesNotChangeOrigin': True,
               'calibrationBrowserAccessDenied': True, 'calibrationReplayPreservesTier': True})
analytics_migration = (ROOT / 'database/migrations/0089_teen_analytics_preferences.sql').read_text(encoding='utf-8')
sql(analytics_migration, database)
assert sql(f"SET ROLE service_role; SELECT set_teen_analytics_preference('{age_user}',true)", database) == 't'
with ThreadPoolExecutor(max_workers=8) as pool:
    choices = list(pool.map(lambda _: sql(f"SET ROLE service_role; SELECT set_teen_analytics_preference('{age_user}',false)", database), range(8)))
assert choices == ['f'] * 8
assert sql(f"SELECT enabled FROM teen_analytics_preferences WHERE user_id='{age_user}'", database) == 'f'
assert sql(f"SELECT disclosure_version FROM teen_analytics_preferences WHERE user_id='{age_user}'", database) == '1'
for role in ('anon', 'authenticated'):
    for statement in ('SELECT * FROM teen_analytics_preferences', f"SELECT set_teen_analytics_preference('{age_user}',true)"):
        try:
            sql(f'SET ROLE {role}; {statement}', database)
        except RuntimeError as error:
            assert 'permission denied' in str(error)
        else:
            raise AssertionError('Browser accessed analytics preference storage')
for privilege in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'):
    assert sql(f"SELECT has_table_privilege('service_role','public.teen_analytics_preferences','{privilege}')", database) == 'f'
assert sql('SELECT json_agg(o ORDER BY user_id) FROM account_safety_origins o', database) == origin_before_calibration
sql(analytics_migration, database)
assert sql(f"SELECT enabled FROM teen_analytics_preferences WHERE user_id='{age_user}'", database) == 'f'
report.update({'analyticsOptOutPersistsUnderConcurrency': True, 'analyticsChoiceBrowserAccessDenied': True,
               'analyticsChoiceReplayPreservesOptOut': True, 'analyticsChoiceDoesNotChangeOrigin': True})
(ROOT / 'audit-results/s01-origin-postgres.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
