"""Verify the local course-publish SQL against migration 0031 on owned PostgreSQL."""
from pathlib import Path
import json
import re
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BASE = [str(RUNTIME / 'pgsql/bin/psql.exe'), '-X', '-h', '127.0.0.1', '-p', '15483',
        '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq']

def sql(query, database='postgres', variables=None):
    args = BASE + ['-d', database]
    for key, value in (variables or {}).items():
        args += ['-v', f'{key}={value}']
    result = subprocess.run(args, input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

if Path(sql('SHOW data_directory')).resolve() != (RUNTIME / 'data').resolve():
    raise RuntimeError('Refusing a PostgreSQL cluster outside the owned audit directory')

script = (ROOT / 'database/scripts/publish-course.sh').read_text(encoding='utf-8')
match = re.search(r"<<'SQL'\n(.*?)\nSQL", script, re.S)
if not match or 'public.release_course(target.id)' not in match.group(1):
    raise RuntimeError('The operator script has no guarded release query')
query = match.group(1)
database = 'lf_course_publish_' + uuid.uuid4().hex
course = str(uuid.uuid4())
adventure, saga, topic, lesson = [str(uuid.uuid4()) for _ in range(4)]
slug = "quoted'course"

sql(f'CREATE DATABASE {database}')
try:
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

    def release():
        return sql(query, database, {'slug': slug}).split('|')

    assert release()[1] == 'INCOMPLETE_LOCALES'
    assert sql(f"SELECT status FROM public.courses WHERE id='{course}'", database) == 'draft'
    for locale in ['en-US', 'es-MX', 'pt-BR']:
        sql(f"INSERT INTO public.lesson_documents VALUES ('{uuid.uuid4()}', '{lesson}', '{locale}', now() - interval '1 hour')", database)
    assert release()[1] == 'VERIFICATION_REQUIRED'
    assert sql(f"SELECT status FROM public.lessons WHERE id='{lesson}'", database) == 'review'
    sql(f"INSERT INTO public.course_release_verifications(course_id, checks) VALUES ('{course}', '[\"full acceptance\"]'::jsonb)", database)
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
    'source': 'database/scripts/publish-course.sh and actual migration 0031 on an owned disposable native PostgreSQL database',
    'checks': ['incomplete locales refused', 'missing verification refused without mutation',
               'fresh verification releases the hierarchy', 'idempotent retry',
               'quoted slug bound safely', 'missing slug returns no release'],
    'limits': 'Minimal catalog fixtures; not full Supabase or live production route verification.'
}
(ROOT / 'audit-results/s02-course-publish-postgres.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
