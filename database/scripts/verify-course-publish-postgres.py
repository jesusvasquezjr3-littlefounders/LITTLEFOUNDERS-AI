"""G.2 local course publication goes through release_course, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, the shared minimal Supabase shim and EVERY
migration in database/migrations applied in order, so the release gate that
is proved is the one production runs (release_course as last redefined by
forge_release_gate_manifest and release_only_publication), never the first
version of it. The query is read out of database/scripts/publish-course.sh
itself and run with psql's own variable binding, as the operator runs it:

  - a course whose lessons lack a locale is refused (INCOMPLETE_LOCALES) and
    nothing is published;
  - without a Forge verification it is refused (VERIFICATION_REQUIRED); an
    incomplete verification (a gate missing) is refused too;
  - a complete, current verification releases the whole hierarchy; a retry
    is idempotent; a verification made stale by a content change is refused;
  - a quoted slug is bound safely; an unknown slug releases nothing;
  - no browser role can call release_course.

Configuration: LF_PG_PSQL (or LF_PG_BIN), LF_PG_PORT, LF_PG_USER, LF_PG_KEEP,
LF_PG_REPORT. Run by database/scripts/staff-analytics-db-verify.mjs.
"""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('LF_PG_BIN', str(ROOT / '.codex/audit-db/pgsql/bin')))
PSQL = os.environ.get('LF_PG_PSQL', str(BIN / ('psql.exe' if os.name == 'nt' else 'psql')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres', variables=None):
    args = BASE + ['-d', database]
    for key, value in (variables or {}).items():
        args += ['-v', f'{key}={value}']
    result = subprocess.run(args, input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


# The same minimal Supabase shim as the other native verifiers.
SHIM = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-data-platform-postgres.py').read_text(encoding='utf-8'), re.S).group(1)

script = (ROOT / 'database/scripts/publish-course.sh').read_text(encoding='utf-8').replace('\r\n', '\n')
match = re.search(r"<<'SQL'\n(.*?)\nSQL", script, re.S)
if not match or 'public.release_course(target.id)' not in match.group(1):
    raise RuntimeError('The operator script has no guarded release query')
QUERY = match.group(1)

database = 'lf_course_publish_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def check(name):
    checks.append(name)
    print('ok -', name)


def rejected(query, message):
    try:
        run(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'expected {message!r}, the statement succeeded')


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    I = {k: str(uuid.uuid4()) for k in ('course', 'adv', 'saga', 'topic', 'lesson')}
    slug = "quoted'course"
    run(f"""
    INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{I['course']}', 'quoted''course', 'draft', 'course-badges/quoted.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{I['adv']}', '{I['course']}', 1, 'pub-adv', 'archipelago', 'draft');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{I['saga']}', '{I['adv']}', 1, 'pub-saga', 'draft');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{I['topic']}', '{I['saga']}', 1, 'pub-topic', 'draft');
    INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson']}', '{I['topic']}', 1, 'pub-lesson', 'review');
    """)

    def release(target=slug):
        return sql(QUERY, database, {'slug': target}).split('|')

    status = lambda table, key: run(f"SELECT status FROM {table} WHERE id = '{I[key]}'")

    assert release()[1] == 'INCOMPLETE_LOCALES'
    assert status('courses', 'course') == 'draft' and status('lessons', 'lesson') == 'review'
    check('a course whose lesson lacks a locale is refused and nothing is published')

    for locale in ('en-US', 'es-MX', 'pt-BR'):
        run(f"INSERT INTO lesson_documents (lesson_id, locale, document) VALUES ('{I['lesson']}', '{locale}', '{{\"segments\": []}}');")
    assert release()[1] == 'VERIFICATION_REQUIRED'
    assert status('lessons', 'lesson') == 'review'
    run(f"INSERT INTO course_release_verifications (course_id, checks, content_watermark) VALUES ('{I['course']}', '[]'::jsonb, forge_release_content_watermark('{I['course']}'));")
    incomplete = release()
    assert incomplete[0] == 'f' and incomplete[1].startswith('VERIFICATION'), incomplete
    assert status('courses', 'course') == 'draft'
    check('without a Forge verification, or with an incomplete one, the release is refused and nothing moves')

    gates = run("SELECT string_agg(format('{\"gate\": \"%s\", \"ok\": true}', gate_id), ',') FROM forge_release_gates")
    run(f"UPDATE course_release_verifications SET checks = '[{gates}]'::jsonb, content_watermark = forge_release_content_watermark('{I['course']}') WHERE course_id = '{I['course']}';")
    released = release()
    assert released[0:2] == ['t', 'RELEASED'], released
    for table, key in (('courses', 'course'), ('adventures', 'adv'), ('sagas', 'saga'), ('topics', 'topic'), ('lessons', 'lesson')):
        assert status(table, key) == 'published', table
    assert release()[0:2] == ['t', 'RELEASED']
    check('a complete, current verification releases the whole hierarchy through release_course; a retry is idempotent')

    assert sql(QUERY, database, {'slug': 'missing-course'}) == ''
    check('the quoted slug is bound by psql, never spliced; an unknown slug releases nothing')

    # A content change after the verification makes it stale (the watermark moves).
    run(f"BEGIN; SET LOCAL lf.bypass_justification = 'Fixing a typo in the published lesson copy'; "
        f"UPDATE lesson_documents SET document = '{{\"segments\": [{{\"id\": \"s1\"}}]}}' WHERE lesson_id = '{I['lesson']}' AND locale = 'en-US'; COMMIT;")
    stale = release()
    assert stale[0:2] == ['f', 'VERIFICATION_REQUIRED'], stale
    check('a verification made stale by a later content change is refused')

    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT * FROM release_course('{I['course']}');", 'permission denied')
    check('no browser role can call release_course')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'database/scripts/publish-course.sh over every migration on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim and catalog fixtures; not a live production publication.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
