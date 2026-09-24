"""B.1 supplemental real-SQL vocabulary/credit/badge checks, not full API E2E."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BASE = [str(RUNTIME / 'pgsql/bin/psql.exe'), '-X', '-h', '127.0.0.1', '-p', '15483', '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq']

def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

if Path(sql('SHOW data_directory')).resolve() != (RUNTIME / 'data').resolve():
    raise RuntimeError('Refusing an unowned database cluster')
database = 'lf_placement_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
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
user, course, adventure, saga, topic, lesson = [str(uuid.uuid4()) for _ in range(6)]
sql(f"""
INSERT INTO auth.users VALUES ('{user}');
INSERT INTO courses VALUES ('{course}','synthetic-course','{{"en-US":"Synthetic course"}}','synthetic-badge','published',1);
INSERT INTO adventures VALUES ('{adventure}','{course}');
INSERT INTO sagas VALUES ('{saga}','{adventure}');
INSERT INTO topics VALUES ('{topic}','{saga}');
INSERT INTO lessons VALUES ('{lesson}','{topic}','published');
""", database)
def insert(method):
    return f"INSERT INTO course_placements(user_id,course_id,claimed_level,education_level,method) VALUES ('{user}','{course}','some','high','{method}');"
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
methods = ['quiz','claimed_beginner_shortcut','no_probe_content_fallback','adaptive_quiz','learner_chose_start','learner_adjusted']
for method in methods:
    sql(f"DELETE FROM course_placements;" + insert(method), database)
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
sql('DROP TRIGGER fail_test_credit ON placement_credits;', database)
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
for role in ['anon','authenticated']:
    try:
        sql(f"SET ROLE {role}; SELECT commit_course_placement('{{}}'::jsonb,'{{}}'::uuid[]);", database)
    except RuntimeError as error:
        assert 'permission denied' in str(error)
    else:
        raise AssertionError('Browser role could award placement')
report = dict(database=database, provenance='Native PostgreSQL; actual migrations 0043, 0091 and 0092 with minimal catalog fixtures; not API E2E', oldFailureReproduced=True, admittedMethods=methods, unknownMethodRejected=True, historicalRowsPreserved=True, replayPreservesRows=True, creditedBadgeAttainable=True, noFabricatedLessonProgress=True, creditFailureRollsBackResult=True, concurrentIdenticalCommits=8, conflictingRetryRejected=True, browserExecutionDenied=True)
(ROOT / 'audit-results/s02-placement-postgres.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
