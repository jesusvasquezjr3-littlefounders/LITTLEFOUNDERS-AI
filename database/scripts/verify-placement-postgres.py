"""B.1 placement commit (Appendix C 2.2 B.1): real-SQL vocabulary, atomic credits and badge checks.

Two modes, both on an OWNED PostgreSQL cluster (never the shared Supabase dev
stack):

  * LF_PG_FULL_CHAIN=1 (the learning-db-verify gate, CI): a Supabase shim and
    EVERY migration in order, then the checks below on the placement schema
    production runs (the latest commit_course_placement, the method CHECK,
    get_completed_course_badges).
  * default (the original S02 audit): only 0043, 0091 and 0092 on a minimal
    catalog, which also reproduces the original release blocker (the old
    method CHECK refused 'adaptive_quiz') before applying the correction.

Checked in both: all four real placement methods (adaptive_quiz,
learner_chose_start, learner_adjusted, no_probe_content_fallback, plus the
historical quiz and claimed_beginner_shortcut) are admitted and an unknown
one refused; a credit failure rolls the whole commit back; eight identical
concurrent commits create once and replay seven times; a conflicting retry is
refused; a credit outside the published course is refused; a credit makes the
course badge attainable without fabricating lesson progress; browsers cannot
execute the commit.

The database is kept (its name is printed) for placement.postgres.test.ts,
which drives Core's routes against it; set LF_PG_DROP=1 to drop it.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_DATA (the cluster's
data_directory, checked before anything is written), LF_PG_FULL_CHAIN,
LF_PG_REPORT (else audit-results/ when that directory exists), LF_PG_DROP.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
PSQL = os.environ.get('LF_PG_PSQL', str(RUNTIME / 'pgsql/bin/psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
FULL_CHAIN = os.environ.get('LF_PG_FULL_CHAIN') == '1'
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')

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

database = 'lf_placement_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
user, course, adventure, saga, topic, lesson = [str(uuid.uuid4()) for _ in range(6)]
methods = ['quiz', 'claimed_beginner_shortcut', 'no_probe_content_fallback', 'adaptive_quiz', 'learner_chose_start', 'learner_adjusted']


def insert(method):
    return f"INSERT INTO course_placements(user_id,course_id,claimed_level,education_level,method) VALUES ('{user}','{course}','some','high','{method}');"


if FULL_CHAIN:
    sql(SHIM, database)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            sql(migration.read_text(encoding='utf-8'), database)
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    # Catalog fixtures with the columns the full schema requires; triggers and
    # FKs are skipped for the fixture insert only (the release gate is not what
    # this proves).
    sql(f"""SET session_replication_role = replica;
INSERT INTO auth.users (id, email) VALUES ('{user}', 'placement@example.com');
INSERT INTO courses (id, slug, title, badge_asset, status, position) VALUES ('{course}','synthetic-course','{{"en-US":"Synthetic course"}}','course-badges/synthetic.png','published',1);
INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{adventure}','{course}',1,'synthetic-adventure','archipelago','published');
INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{saga}','{adventure}',1,'synthetic-saga','published');
INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{topic}','{saga}',1,'synthetic-topic','published');
INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{lesson}','{topic}',1,'synthetic-lesson','published');""", database)
    mode = f'full chain ({len(migrations)} migrations)'
else:
    sql("""
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.is_verified_guardian_of(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE courses(id uuid PRIMARY KEY, slug text, title jsonb, badge_asset text, status text, position integer);
CREATE TABLE adventures(id uuid PRIMARY KEY, course_id uuid);
CREATE TABLE sagas(id uuid PRIMARY KEY, adventure_id uuid);
CREATE TABLE topics(id uuid PRIMARY KEY, saga_id uuid);
CREATE TABLE lessons(id uuid PRIMARY KEY, topic_id uuid, status text);
CREATE TABLE lesson_progress(user_id uuid, lesson_id uuid, passed boolean, completed_at timestamptz);
""", database)
    sql((ROOT / 'database/migrations/0043_course_placements.sql').read_text(encoding='utf-8'), database)
    sql(f"""
INSERT INTO auth.users VALUES ('{user}');
INSERT INTO courses VALUES ('{course}','synthetic-course','{{"en-US":"Synthetic course"}}','synthetic-badge','published',1);
INSERT INTO adventures VALUES ('{adventure}','{course}');
INSERT INTO sagas VALUES ('{saga}','{adventure}');
INSERT INTO topics VALUES ('{topic}','{saga}');
INSERT INTO lessons VALUES ('{lesson}','{topic}','published');
""", database)
    # Reproduce the original release blocker before applying the correction.
    try:
        sql(insert('adaptive_quiz'), database)
    except RuntimeError as error:
        assert 'course_placements_method_check' in str(error)
    else:
        raise AssertionError('The old schema unexpectedly admitted adaptive_quiz')
    sql(insert('quiz'), database)
    migration = (ROOT / 'database/migrations/0091_placement_method_vocabulary.sql').read_text(encoding='utf-8')
    sql('BEGIN;' + migration + 'COMMIT;', database)
    assert sql('SELECT method FROM course_placements', database) == 'quiz'
    mode = 'minimal catalog with 0043, 0091, 0092'

for method in methods:
    sql("DELETE FROM course_placements;" + insert(method), database)
try:
    sql("UPDATE course_placements SET method='fabricated';", database)
except RuntimeError as error:
    assert 'course_placements_method_check' in str(error)
else:
    raise AssertionError('Unknown placement method was accepted')
assert sql(f"SELECT count(*) FROM get_completed_course_badges('{user}')", database) == '0'
sql(f"INSERT INTO placement_credits(user_id,lesson_id,topic_id,course_id) VALUES ('{user}','{lesson}','{topic}','{course}');", database)
assert sql(f"SELECT course_slug FROM get_completed_course_badges('{user}')", database) == 'synthetic-course'
assert sql('SELECT count(*) FROM lesson_progress', database) == '0'
if not FULL_CHAIN:
    sql('BEGIN;' + migration + 'COMMIT;', database)
    assert sql('SELECT method FROM course_placements', database) == 'learner_adjusted'
    sql((ROOT / 'database/migrations/0092_atomic_placement_commit.sql').read_text(encoding='utf-8'), database)
sql('DELETE FROM placement_credits; DELETE FROM course_placements;', database)
payload = dict(user_id=user, course_id=course, claimed_level='some', education_level='high', quiz_answers=[], start_topic_id=None, start_lesson_id=None, method='adaptive_quiz')


def commit(value=None, ids=None):
    data = json.dumps(payload if value is None else value)
    selected = [lesson] if ids is None else ids
    array = 'ARRAY[' + ','.join("'" + item + "'::uuid" for item in selected) + ']::uuid[]'
    return sql(f"SET ROLE service_role; SELECT commit_course_placement($json${data}$json$::jsonb,{array});", database)


sql("""
CREATE FUNCTION fail_test_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic credit outage'; END $$;
CREATE TRIGGER fail_test_credit BEFORE INSERT ON placement_credits FOR EACH ROW EXECUTE FUNCTION fail_test_credit();
""", database)
try:
    commit()
except RuntimeError as error:
    assert 'Synthetic credit outage' in str(error)
else:
    raise AssertionError('Expected transactional credit failure')
assert sql('SELECT count(*) FROM course_placements', database) == '0'
assert sql('SELECT count(*) FROM placement_credits', database) == '0'
sql('DROP TRIGGER fail_test_credit ON placement_credits; DROP FUNCTION fail_test_credit();', database)
with ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(lambda _: commit(), range(8)))
assert results.count('created') == 1 and results.count('replayed') == 7, results
assert commit(dict(payload, method='learner_chose_start'), []) == 'conflict'
assert sql('SELECT count(*) FROM placement_credits', database) == '1'
assert sql(f"SELECT course_slug FROM get_completed_course_badges('{user}')", database) == 'synthetic-course'
try:
    commit(ids=[str(uuid.uuid4())])
except RuntimeError as error:
    assert 'Credit outside published course' in str(error)
else:
    raise AssertionError('Accepted a fabricated lesson')
for role in ['anon', 'authenticated']:
    try:
        sql(f"SET ROLE {role}; SELECT commit_course_placement('{{}}'::jsonb,'{{}}'::uuid[]);", database)
    except RuntimeError as error:
        assert 'permission denied' in str(error)
    else:
        raise AssertionError('Browser role could award placement')
# Leave the database empty of this run's placement rows for the Core route test.
sql('DELETE FROM placement_credits; DELETE FROM course_placements;', database)
if FULL_CHAIN:
    sql(f"SET session_replication_role = replica; DELETE FROM lessons; DELETE FROM topics; DELETE FROM sagas; DELETE FROM adventures; DELETE FROM courses; DELETE FROM auth.users WHERE id = '{user}';", database)
else:
    sql(f"DELETE FROM lessons; DELETE FROM topics; DELETE FROM sagas; DELETE FROM adventures; DELETE FROM courses; DELETE FROM auth.users;", database)

report = dict(database=database, mode=mode, provenance=f'Native PostgreSQL; {mode}; minimal catalog fixtures; not API E2E (placement.postgres.test.ts drives Core against this database)',
              oldFailureReproduced=not FULL_CHAIN, admittedMethods=methods, unknownMethodRejected=True, replayPreservesRows=True,
              creditedBadgeAttainable=True, noFabricatedLessonProgress=True, creditFailureRollsBackResult=True, concurrentIdenticalCommits=8,
              conflictingRetryRejected=True, browserExecutionDenied=True)
if os.environ.get('LF_PG_DROP') == '1':
    sql(f'DROP DATABASE {database} WITH (FORCE)')
report_path = os.environ.get('LF_PG_REPORT') or (str(ROOT / 'audit-results/s02-placement-postgres.json') if (ROOT / 'audit-results').is_dir() else None)
if report_path:
    Path(report_path).write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
