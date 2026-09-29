"""G.2 / B.3 course release gate: the operator's publish-course.sh query against owned PostgreSQL.

Two modes:

  * LF_PG_FULL_CHAIN=1 (the learning-db-verify gate, CI): a Supabase shim and
    EVERY migration in order, so the release_course production runs (0031 as
    later extended by the Forge gate manifest, 0112) is what is proved: the
    attestation must name every required Forge gate with ok = true.
  * default (the original S02 audit): migration 0031 alone on a minimal
    catalog.

Checked in both: incomplete locales are refused; a missing verification is
refused without mutating anything; a complete, fresh verification releases
the hierarchy; a retry is idempotent; a quoted slug is bound safely; a missing
slug returns no release. Full chain also: an attestation that misses a
required gate is refused (VERIFICATION_INCOMPLETE).

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_DATA (checked against
the cluster's data_directory), LF_PG_FULL_CHAIN, LF_PG_REPORT (else
audit-results/ when that directory exists).
"""
from pathlib import Path
import json
import os
import re
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
    raise RuntimeError('Refusing a PostgreSQL cluster outside the owned audit directory')

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

script = (ROOT / 'database/scripts/publish-course.sh').read_text(encoding='utf-8').replace('\r\n', '\n')
match = re.search(r"<<'SQL'\n(.*?)\nSQL", script, re.S)
if not match or 'public.release_course(target.id)' not in match.group(1):
    raise RuntimeError('The operator script has no guarded release query')
query = match.group(1)
database = 'lf_course_publish_' + uuid.uuid4().hex
course = str(uuid.uuid4())
adventure, saga, topic, lesson = [str(uuid.uuid4()) for _ in range(4)]
slug = "quoted'course"
checks = ['incomplete locales refused', 'missing verification refused without mutation',
          'fresh verification releases the hierarchy', 'idempotent retry',
          'quoted slug bound safely', 'missing slug returns no release']

sql(f'CREATE DATABASE {database}')
try:
    if FULL_CHAIN:
        sql(SHIM, database)
        migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
        for migration in migrations:
            try:
                sql(migration.read_text(encoding='utf-8'), database)
            except RuntimeError as error:
                raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
        sql(f"""SET session_replication_role = replica;
INSERT INTO public.courses (id, slug, status, badge_asset) VALUES ('{course}', 'quoted''course', 'draft', 'course-badges/quoted.png');
INSERT INTO public.adventures (id, course_id, position, slug, theme, status) VALUES ('{adventure}', '{course}', 1, 'adventure-1', 'archipelago', 'draft');
INSERT INTO public.sagas (id, adventure_id, position, slug, status) VALUES ('{saga}', '{adventure}', 1, 'saga-1', 'draft');
INSERT INTO public.topics (id, saga_id, position, slug, status) VALUES ('{topic}', '{saga}', 1, 'topic-1', 'draft');
INSERT INTO public.lessons (id, topic_id, position, slug, status) VALUES ('{lesson}', '{topic}', 1, 'lesson-1', 'review');
""", database)
        mode = f'full chain ({len(migrations)} migrations)'

        def add_document(locale):
            sql(f"INSERT INTO public.lesson_documents (lesson_id, locale, document, updated_at) VALUES ('{lesson}', '{locale}', '{{}}'::jsonb, now() - interval '1 hour')", database)

        def attest(gates):
            sql(f"""INSERT INTO public.course_release_verifications (course_id, checks, content_watermark)
                SELECT '{course}', {gates}, public.forge_release_content_watermark('{course}')
                ON CONFLICT (course_id) DO UPDATE SET checks = excluded.checks, content_watermark = excluded.content_watermark;""", database)
    else:
        sql("""
CREATE TABLE public.courses(id uuid PRIMARY KEY, slug text UNIQUE, status text);
CREATE TABLE public.adventures(id uuid PRIMARY KEY, course_id uuid REFERENCES public.courses(id), status text);
CREATE TABLE public.sagas(id uuid PRIMARY KEY, adventure_id uuid REFERENCES public.adventures(id), status text);
CREATE TABLE public.topics(id uuid PRIMARY KEY, saga_id uuid REFERENCES public.sagas(id), status text);
CREATE TABLE public.lessons(id uuid PRIMARY KEY, topic_id uuid REFERENCES public.topics(id), status text);
CREATE TABLE public.lesson_documents(id uuid PRIMARY KEY, lesson_id uuid REFERENCES public.lessons(id), locale text, updated_at timestamptz);
""", database)
        sql((ROOT / 'database/migrations/0031_course_release_gate.sql').read_text(encoding='utf-8'), database)
        sql(f"""
INSERT INTO public.courses VALUES ('{course}', 'quoted''course', 'draft');
INSERT INTO public.adventures VALUES ('{adventure}', '{course}', 'draft');
INSERT INTO public.sagas VALUES ('{saga}', '{adventure}', 'draft');
INSERT INTO public.topics VALUES ('{topic}', '{saga}', 'draft');
INSERT INTO public.lessons VALUES ('{lesson}', '{topic}', 'review');
""", database)
        mode = 'migration 0031 on a minimal catalog'

        def add_document(locale):
            sql(f"INSERT INTO public.lesson_documents VALUES ('{uuid.uuid4()}', '{lesson}', '{locale}', now() - interval '1 hour')", database)

        def attest(_gates):
            sql(f"INSERT INTO public.course_release_verifications(course_id, checks) VALUES ('{course}', '[\"full acceptance\"]'::jsonb)", database)

    def release():
        return sql(query, database, {'slug': slug}).split('|')

    assert release()[1] == 'INCOMPLETE_LOCALES'
    assert sql(f"SELECT status FROM public.courses WHERE id='{course}'", database) == 'draft'
    for locale in ['en-US', 'es-MX', 'pt-BR']:
        add_document(locale)
    assert release()[1] == 'VERIFICATION_REQUIRED'
    assert sql(f"SELECT status FROM public.lessons WHERE id='{lesson}'", database) == 'review'
    if FULL_CHAIN:
        # An attestation missing one required Forge gate cannot unlock a release.
        attest("(SELECT jsonb_agg(jsonb_build_object('gate', gate_id, 'ok', true)) FROM public.forge_release_gates WHERE gate_id <> 'forge.gate.13.copy-budget')")
        assert release()[1] == 'VERIFICATION_INCOMPLETE', release()
        assert sql(f"SELECT status FROM public.courses WHERE id='{course}'", database) == 'draft'
        checks.append('an attestation missing a required Forge gate refused')
    attest("(SELECT jsonb_agg(jsonb_build_object('gate', gate_id, 'ok', true)) FROM public.forge_release_gates)")
    released = release()
    assert released[0:2] == ['t', 'RELEASED'], released
    assert sql(f"SELECT status FROM public.courses WHERE id='{course}'", database) == 'published'
    assert sql(f"SELECT status FROM public.lessons WHERE id='{lesson}'", database) == 'published'
    assert release()[0:2] == ['t', 'RELEASED']
    assert sql(query, database, {'slug': 'missing-course'}) == ''
finally:
    sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': f'database/scripts/publish-course.sh and {mode} on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal catalog fixtures; not full Supabase or live production route verification.'
}
report_path = os.environ.get('LF_PG_REPORT') or (str(ROOT / 'audit-results/s02-course-publish-postgres.json') if (ROOT / 'audit-results').is_dir() else None)
if report_path:
    Path(report_path).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
