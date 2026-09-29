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
    incomplete verification is refused too: an empty attestation, and one
    that names every required Forge gate but one (VERIFICATION_INCOMPLETE);
  - a complete, current verification releases the whole hierarchy; a retry
    is idempotent; a verification made stale by a content change is refused;
  - a quoted slug is bound safely; an unknown slug releases nothing;
  - no browser role can call release_course.

GAP-FIX-R5 staff-ops (G.3; Appendix N 1.2, the publish event log from the
staff console and the CLI): every course and lesson status decision names a
staff actor and writes its central audit row in the same transaction:

  - the CLI release binds the local superadmin; release_course,
    release_lesson, set_course_status and set_lesson_status each write
    exactly one audit row naming the staff actor (a retry that changes
    nothing writes none);
  - a failed audit insert rolls the release, and a status move, back;
  - an admin without manage_content is refused (FORBIDDEN) and nothing moves;
  - the one-argument release_course(uuid) and release_lesson(uuid) are gone;
  - the service role can no longer change a course or lesson status by
    PATCH, except the Forge upsert of a lesson into review, whose demotion of
    a published lesson is recorded (content.lesson.demoted).

Configuration: LF_PG_PSQL (or LF_PG_BIN), LF_PG_PORT, LF_PG_USER, LF_PG_DATA
(checked against the cluster's data_directory before anything is touched),
LF_PG_KEEP, LF_PG_REPORT. Run by database/scripts/staff-analytics-db-verify.mjs
and database/scripts/learning-db-verify.mjs (both over the whole chain).
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
DATA = Path(os.environ.get('LF_PG_DATA', str(ROOT / '.codex/audit-db/data')))
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


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing a PostgreSQL cluster outside the owned audit directory (LF_PG_DATA)')

# The same minimal Supabase shim as the other native verifiers.
SHIM = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-data-platform-postgres.py').read_text(encoding='utf-8'), re.S).group(1)

script = (ROOT / 'database/scripts/publish-course.sh').read_text(encoding='utf-8').replace('\r\n', '\n')
match = re.search(r"<<'SQL'\n(.*?)\nSQL", script, re.S)
if not match or 'public.release_course(actor.id, target.id)' not in match.group(1):
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

    I = {k: str(uuid.uuid4()) for k in ('course', 'adv', 'saga', 'topic', 'lesson', 'lesson2', 'boss', 'editor', 'analyst')}
    slug = "quoted'course"
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{I['boss']}', 'boss@littlefounders.ai'), ('{I['editor']}', 'editor@littlefounders.ai'), ('{I['analyst']}', 'analyst@littlefounders.ai');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['boss']}', 'superadmin', NULL), ('{I['editor']}', 'admin', '{I['boss']}'), ('{I['analyst']}', 'admin', '{I['boss']}');
    INSERT INTO admin_permissions (user_id, permission) VALUES ('{I['editor']}', 'manage_content'), ('{I['analyst']}', 'view_analytics');
    INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{I['course']}', 'quoted''course', 'draft', 'course-badges/quoted.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{I['adv']}', '{I['course']}', 1, 'pub-adv', 'archipelago', 'draft');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{I['saga']}', '{I['adv']}', 1, 'pub-saga', 'draft');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{I['topic']}', '{I['saga']}', 1, 'pub-topic', 'draft');
    INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson']}', '{I['topic']}', 1, 'pub-lesson', 'review');
    """)

    def release(target=slug, actor=''):
        return sql(QUERY, database, {'slug': target, 'actor': actor}).split('|')

    def service(query):
        out = run('SET ROLE service_role;' + query)
        return out.splitlines()[-1] if out else ''

    audits = lambda action, subject: run(f"SELECT count(*) || ':' || coalesce(string_agg(actor_id::text, ','), '') FROM audit_logs WHERE action = '{action}' AND subject = '{subject}'")

    def audit_outage(action):
        run(f"""CREATE OR REPLACE FUNCTION lf_verify_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.action = '{action}' THEN RAISE EXCEPTION 'audit store unavailable'; END IF; RETURN NEW; END $$;
            DROP TRIGGER IF EXISTS zz_fail_audit ON audit_logs;
            CREATE TRIGGER zz_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION lf_verify_fail_audit();""")

    def audit_restored():
        run('DROP TRIGGER IF EXISTS zz_fail_audit ON audit_logs; DROP FUNCTION IF EXISTS lf_verify_fail_audit();')

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

    # An attestation that names every required Forge gate but one cannot unlock a release.
    partial = run("SELECT string_agg(format('{\"gate\": \"%s\", \"ok\": true}', gate_id), ',') FROM forge_release_gates WHERE gate_id <> 'forge.gate.13.copy-budget'")
    run(f"UPDATE course_release_verifications SET checks = '[{partial}]'::jsonb, content_watermark = forge_release_content_watermark('{I['course']}') WHERE course_id = '{I['course']}';")
    missing_one = release()
    assert missing_one[0:2] == ['f', 'VERIFICATION_INCOMPLETE'], missing_one
    assert status('courses', 'course') == 'draft'
    check('an attestation missing one required Forge gate is refused (VERIFICATION_INCOMPLETE)')

    gates = run("SELECT string_agg(format('{\"gate\": \"%s\", \"ok\": true}', gate_id), ',') FROM forge_release_gates")
    verify = lambda: run(f"UPDATE course_release_verifications SET checks = '[{gates}]'::jsonb, content_watermark = forge_release_content_watermark('{I['course']}') WHERE course_id = '{I['course']}';")
    verify()

    # GAP-FIX-R6 (stage3_review_release_gate): a lesson goes live only with a passing Stage 3 review of its
    # current content, recorded by a content admin who did not author it. The Stage 3 proof itself is
    # verify-stage3-review-postgres.py; here each lesson is reviewed before its release.
    def stage3_pass(key):
        code = service(f"""SELECT code FROM record_lesson_pedagogical_review('{I['editor']}', '{I[key]}', NULL, lesson_stage3_fingerprint('{I[key]}'), '{I['boss']}',
            (SELECT jsonb_object_agg(item, jsonb_build_object('result', 'pass', 'finding', 'Meets the Block B standard for this lesson.')) FROM stage3_review_items()), '[]'::jsonb)""")
        assert code == 'RECORDED', code
    stage3_pass('lesson')

    # G.3: an admin without the content permission is refused before anything moves.
    forbidden = release(actor=I['analyst'])
    assert forbidden[0:2] == ['f', 'FORBIDDEN'], forbidden
    assert status('courses', 'course') == 'draft' and status('lessons', 'lesson') == 'review'
    assert audits('admin.course.release', I['course']) == '0:'
    check('G.3: a release by an admin without manage_content is refused (FORBIDDEN); nothing moves and nothing is audited')

    # G.3: the release and its audit row are one transaction.
    audit_outage('admin.course.release')
    try:
        release()
    except RuntimeError as error:
        assert 'audit store unavailable' in str(error), str(error)
    else:
        raise AssertionError('a release whose audit row failed was committed')
    audit_restored()
    for table, key in (('courses', 'course'), ('adventures', 'adv'), ('sagas', 'saga'), ('topics', 'topic')):
        assert status(table, key) == 'draft', table
    assert status('lessons', 'lesson') == 'review'
    check('G.3: a failed audit insert rolls the whole course release back')

    released = release()
    assert released[0:2] == ['t', 'RELEASED'], released
    for table, key in (('courses', 'course'), ('adventures', 'adv'), ('sagas', 'saga'), ('topics', 'topic'), ('lessons', 'lesson')):
        assert status(table, key) == 'published', table
    assert audits('admin.course.release', I['course']) == f"1:{I['boss']}"
    assert release()[0:2] == ['t', 'RELEASED']
    assert audits('admin.course.release', I['course']) == f"1:{I['boss']}"
    check('a complete, current verification releases the whole hierarchy through release_course; a retry is idempotent')
    check('G.3 / Appendix N 1.2: the CLI release names the local superadmin and writes exactly one admin.course.release row; a retry that changes nothing writes none')

    assert sql(QUERY, database, {'slug': 'missing-course', 'actor': ''}) == ''
    check('the quoted slug is bound by psql, never spliced; an unknown slug releases nothing')

    # A content change after the verification makes it stale (the watermark moves).
    run(f"BEGIN; SET LOCAL lf.bypass_justification = 'Fixing a typo in the published lesson copy'; "
        f"UPDATE lesson_documents SET document = '{{\"segments\": [{{\"id\": \"s1\"}}]}}' WHERE lesson_id = '{I['lesson']}' AND locale = 'en-US'; COMMIT;")
    stale = release()
    assert stale[0:2] == ['f', 'VERIFICATION_REQUIRED'], stale
    check('a verification made stale by a later content change is refused')

    # GAP-FIX-R5: every other decision is audited with its actor.
    run(f"""INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson2']}', '{I['topic']}', 2, 'pub-lesson-2', 'review');
        INSERT INTO lesson_documents (lesson_id, locale, document) SELECT '{I['lesson2']}', l, '{{"segments": []}}' FROM unnest(ARRAY['en-US', 'es-MX', 'pt-BR']) AS l;""")
    verify()
    stage3_pass('lesson2')
    assert service(f"SELECT code FROM release_lesson('{I['analyst']}', '{I['lesson2']}')") == 'FORBIDDEN'
    assert status('lessons', 'lesson2') == 'review'
    audit_outage('admin.lesson.release')
    rejected(f"SET ROLE service_role; SELECT code FROM release_lesson('{I['editor']}', '{I['lesson2']}')", 'audit store unavailable')
    audit_restored()
    assert status('lessons', 'lesson2') == 'review'
    assert service(f"SELECT code FROM release_lesson('{I['editor']}', '{I['lesson2']}')") == 'RELEASED'
    assert status('lessons', 'lesson2') == 'published'
    assert audits('admin.lesson.release', I['lesson2']) == f"1:{I['editor']}"
    check('release_lesson: an admin without manage_content is refused, a failed audit insert rolls it back, and a release writes exactly one admin.lesson.release row naming the content admin')

    assert service(f"SELECT code FROM set_lesson_status('{I['analyst']}', '{I['lesson2']}', 'draft')") == 'FORBIDDEN'
    assert service(f"SELECT code FROM set_lesson_status('{I['editor']}', '{I['lesson2']}', 'published')") == 'USE_RELEASE'
    assert status('lessons', 'lesson2') == 'published'
    audit_outage('admin.lesson.set_status')
    rejected(f"SET ROLE service_role; SELECT code FROM set_lesson_status('{I['editor']}', '{I['lesson2']}', 'archived')", 'audit store unavailable')
    audit_restored()
    assert status('lessons', 'lesson2') == 'published'
    assert service(f"SELECT code FROM set_lesson_status('{I['editor']}', '{I['lesson2']}', 'draft')") == 'UPDATED'
    assert status('lessons', 'lesson2') == 'draft'
    assert service(f"SELECT code FROM set_lesson_status('{I['editor']}', '{I['lesson2']}', 'draft')") == 'UNCHANGED'
    assert audits('admin.lesson.set_status', I['lesson2']) == f"1:{I['editor']}"
    assert run(f"SELECT (detail ->> 'from') || '>' || (detail ->> 'status') FROM audit_logs WHERE action = 'admin.lesson.set_status' AND subject = '{I['lesson2']}'") == 'published>draft'
    check('set_lesson_status: a non-content admin is refused, publishing is refused (USE_RELEASE), a failed audit insert rolls the takedown back, and an unpublish writes exactly one admin.lesson.set_status row {from, status} with the actor')

    assert service(f"SELECT code FROM set_course_status('{I['analyst']}', '{I['course']}', 'archived')") == 'FORBIDDEN'
    assert service(f"SELECT code FROM set_course_status('{I['boss']}', '{I['course']}', 'published')") == 'USE_RELEASE'
    audit_outage('admin.course.set_status')
    rejected(f"SET ROLE service_role; SELECT code FROM set_course_status('{I['boss']}', '{I['course']}', 'archived')", 'audit store unavailable')
    audit_restored()
    assert status('courses', 'course') == 'published'
    assert service(f"SELECT code FROM set_course_status('{I['boss']}', '{I['course']}', 'archived')") == 'UPDATED'
    assert status('courses', 'course') == 'archived'
    assert audits('admin.course.set_status', I['course']) == f"1:{I['boss']}"
    check('set_course_status: a non-content admin is refused, a failed audit insert rolls the unpublish back, and a takedown writes exactly one admin.course.set_status row with the superadmin actor')

    assert run("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('release_course', 'release_lesson') AND p.pronargs = 1") == '0'
    rejected(f"SET ROLE service_role; SELECT * FROM release_course('{I['course']}')", 'does not exist')
    check('the one-argument release_course(uuid) and release_lesson(uuid), which named no actor, are gone')

    rejected(f"SET ROLE service_role; UPDATE courses SET status = 'draft' WHERE id = '{I['course']}'", 'set_course_status')
    rejected(f"SET ROLE service_role; UPDATE lessons SET status = 'archived' WHERE id = '{I['lesson']}'", 'set_course_status or set_lesson_status')
    rejected(f"SET ROLE service_role; UPDATE lessons SET status = 'draft' WHERE id = '{I['lesson']}'", 'set_course_status or set_lesson_status')
    rejected(f"SET ROLE service_role; UPDATE lessons SET status = 'published' WHERE id = '{I['lesson2']}'", 'release_course or release_lesson')
    assert status('courses', 'course') == 'archived' and status('lessons', 'lesson') == 'published'
    service(f"UPDATE lessons SET status = 'review' WHERE id = '{I['lesson']}'")
    assert status('lessons', 'lesson') == 'review'
    assert run(f"SELECT count(*) || ':' || coalesce(max(actor_id::text), 'system') FROM audit_logs WHERE action = 'content.lesson.demoted' AND subject = '{I['lesson']}'") == '1:system'
    service(f"UPDATE lessons SET status = 'review' WHERE id = '{I['lesson2']}'")
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'content.lesson.demoted' AND subject = '{I['lesson2']}'") == '0'
    check('the service role cannot move a course or lesson status by PATCH; only the Forge upsert into review passes, and its demotion of a published lesson is recorded (content.lesson.demoted)')

    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT * FROM release_course('{I['boss']}', '{I['course']}');", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM release_lesson('{I['boss']}', '{I['lesson']}');", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM set_course_status('{I['boss']}', '{I['course']}', 'draft');", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM set_lesson_status('{I['boss']}', '{I['lesson']}', 'draft');", 'permission denied')
    check('no browser role can call release_course, release_lesson, set_course_status or set_lesson_status')
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
