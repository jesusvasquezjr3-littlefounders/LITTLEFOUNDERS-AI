"""F1 data-platform guards against real PostgreSQL (owned native cluster only).

A throwaway database with the Supabase shim and EVERY migration applied, then:

  - A.5 / Appendix M 1.4: parent_verifications has no document_type column
    after the chain (the expand step nulled it, the contract step dropped it);
  - G.2 (live_lesson_document_guard): for the service role, a content change
    to a published lesson's document and a delete of its document are
    refused; Echo's narration stamp (segments[].audio_segment_id only) and the
    audio manifest are allowed; a lesson in review is untouched by the guard;
    the database owner's change is allowed and logged in audit_logs;
  - OD-24 (legacy_catalog_delete_guard): deleting a lesson with progress, a
    topic with a placement credit or a course with a frozen badge is refused
    for every role, the owner included; a row nobody learned from can still be
    deleted; archiving is unaffected.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP, LF_PG_REPORT
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

database = 'lf_data_platform_' + uuid.uuid4().hex[:12]
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


DOC = {'segments': [{'id': 's1', 'type': 'story', 'prompt': 'Hola'}, {'id': 's2', 'type': 'quiz', 'prompt': 'Dos'}]}


def jlit(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # ── A.5: the retired field is gone ────────────────────────────────────
    cols = run("SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'parent_verifications'")
    assert 'document_type' not in cols.split(','), cols
    learner = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{learner}', 'l@example.com')")
    service(f"INSERT INTO parent_verifications (user_id, given_names, surnames, birth_date) VALUES ('{learner}', 'A', 'B', '1980-01-01')")
    rejected(f"SET ROLE service_role; INSERT INTO parent_verifications (user_id, given_names, surnames, birth_date, document_type) VALUES ('{learner}', 'A', 'B', '1980-01-01', 'national-id')", 'document_type')
    check('A.5: parent_verifications keeps no document_type after the chain; a verification is written without it, and a write naming it is refused')

    # ── Catalog fixture (owner writes: outside the API-role guards) ──────
    C = {k: str(uuid.uuid4()) for k in ('course', 'adv', 'saga', 'topic', 'live', 'review', 'spare', 'course2', 'adv2', 'saga2', 'topic2', 'lesson2')}
    run(f"""
    INSERT INTO courses (id, slug, title, status, badge_asset) VALUES ('{C['course']}', 'c-one', '{{"en-US":"C"}}', 'published', 'course-badges/c-one.png'), ('{C['course2']}', 'c-two', '{{"en-US":"D"}}', 'published', 'course-badges/c-two.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, age_tier, status) VALUES
        ('{C['adv']}', '{C['course']}', 0, 'a1', 'archipelago', 'tier2', 'published'), ('{C['adv2']}', '{C['course2']}', 0, 'a2', 'archipelago', 'tier2', 'published');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{C['saga']}', '{C['adv']}', 0, 's1', 'published'), ('{C['saga2']}', '{C['adv2']}', 0, 's2', 'published');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{C['topic']}', '{C['saga']}', 0, 't1', 'published'), ('{C['topic2']}', '{C['saga2']}', 0, 't2', 'published');
    INSERT INTO lessons (id, topic_id, position, slug, status) VALUES
        ('{C['live']}', '{C['topic']}', 0, 'live', 'published'), ('{C['review']}', '{C['topic']}', 1, 'rev', 'review'),
        ('{C['spare']}', '{C['topic']}', 2, 'spare', 'draft'), ('{C['lesson2']}', '{C['topic2']}', 0, 'l2', 'published');
    INSERT INTO lesson_documents (lesson_id, locale, document) VALUES
        ('{C['live']}', 'es-MX', {jlit(DOC)}), ('{C['review']}', 'es-MX', {jlit(DOC)});
    """)

    # ── G.2: the live lesson document guard ──────────────────────────────
    changed = json.loads(json.dumps(DOC)); changed['segments'][0]['image_url'] = 'https://example.test/a.png'
    stamped = json.loads(json.dumps(DOC)); stamped['segments'][0]['audio_segment_id'] = 's1.prompt'
    where = f"lesson_id = '{C['live']}' AND locale = 'es-MX'"
    rejected(f"SET ROLE service_role; UPDATE lesson_documents SET document = {jlit(changed)} WHERE {where}", 'only through a release')
    rejected(f"SET ROLE service_role; DELETE FROM lesson_documents WHERE {where}", 'archiving the lesson or through a release')
    service(f"UPDATE lesson_documents SET document = {jlit(stamped)}, audio = '{{\"version\":1}}'::jsonb WHERE {where}")
    assert run(f"SELECT document -> 'segments' -> 0 ->> 'audio_segment_id' FROM lesson_documents WHERE {where}") == 's1.prompt'
    stamped_changed = json.loads(json.dumps(stamped)); stamped_changed['segments'][1]['prompt'] = 'Tres'
    rejected(f"SET ROLE service_role; UPDATE lesson_documents SET document = {jlit(stamped_changed)} WHERE {where}", 'only through a release')
    service(f"UPDATE lesson_documents SET document = {jlit(changed)} WHERE lesson_id = '{C['review']}'")
    before = int(run("SELECT count(*) FROM audit_logs WHERE action = 'content.live_document_patched'"))
    run(f"UPDATE lesson_documents SET document = {jlit(changed)} WHERE {where}")
    assert int(run("SELECT count(*) FROM audit_logs WHERE action = 'content.live_document_patched'")) == before + 1
    assert run(f"SELECT detail ->> 'origin' FROM audit_logs WHERE action = 'content.live_document_patched' ORDER BY id DESC LIMIT 1") == 'database-owner'
    check("G.2: the service role cannot rewrite or delete a published lesson's document (42501); Echo's narration stamp and the audio manifest pass, a stamp bundled with a content change does not; a lesson in review is unaffected; the database owner's change passes and is logged (content.live_document_patched)")

    # ── OD-24: the delete guard ──────────────────────────────────────────
    run(f"""
    INSERT INTO lesson_progress (user_id, lesson_id, best_score, passed, attempts, xp_earned) VALUES ('{learner}', '{C['live']}', 90, true, 1, 20);
    INSERT INTO placement_credits (user_id, lesson_id, topic_id, course_id) VALUES ('{learner}', '{C['lesson2']}', '{C['topic2']}', '{C['course2']}');
    """)
    rejected(f"DELETE FROM lessons WHERE id = '{C['live']}'", 'LEGACY_RECORDS_KEPT')
    rejected(f"DELETE FROM topics WHERE id = '{C['topic']}'", 'LEGACY_RECORDS_KEPT')
    rejected(f"DELETE FROM courses WHERE id = '{C['course']}'", 'LEGACY_RECORDS_KEPT')
    rejected(f"DELETE FROM adventures WHERE id = '{C['adv']}'", 'LEGACY_RECORDS_KEPT')
    rejected(f"DELETE FROM topics WHERE id = '{C['topic2']}'", 'LEGACY_RECORDS_KEPT')
    rejected(f"DELETE FROM courses WHERE id = '{C['course2']}'", 'LEGACY_RECORDS_KEPT')
    rejected(f"SET ROLE service_role; DELETE FROM lessons WHERE id = '{C['live']}'", 'LEGACY_RECORDS_KEPT')
    run(f"DELETE FROM lessons WHERE id = '{C['spare']}'")
    assert run(f"SELECT count(*) FROM lessons WHERE id = '{C['spare']}'") == '0'
    run(f"UPDATE lessons SET status = 'archived' WHERE id = '{C['live']}'; UPDATE courses SET status = 'archived' WHERE id = '{C['course']}'")
    assert run(f"SELECT count(*) FROM lesson_progress WHERE lesson_id = '{C['live']}'") == '1'
    check('OD-24: deleting a lesson with progress, a topic or a course that holds it (directly or through an adventure) or a placement credit is refused (LEGACY_RECORDS_KEPT) for the owner and the service role alike; a lesson nobody learned from is still deletable; archiving works and keeps the progress')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
