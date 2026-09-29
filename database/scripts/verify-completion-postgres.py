"""B.5 / lesson completion (atomic completion, replay and privileges): real PostgreSQL transactions on an owned native cluster only.

Every migration applies in order (twice, on two databases), then concurrent
completions keep exact totals, a replay never double-counts, receipts are not
browser-readable and a browser cannot execute complete_lesson.

Auth objects are minimal fixtures, not a GoTrue/Supabase certification.
This is supplemental to the mandatory Docker reset and type-generation gates.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_DATA (checked against
the cluster's data_directory), LF_PG_REPORT (else audit-results/ when that
directory exists), LF_PG_KEEP=1 keeps the databases.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import hashlib
import os
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex' / 'audit-db'
PSQL = os.environ.get('LF_PG_PSQL', str(RUNTIME / 'pgsql' / 'bin' / 'psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']

def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

actual = Path(sql('SHOW data_directory')).resolve()
if actual != DATA.resolve():
    raise RuntimeError('Refusing a cluster not owned by this audit')
for role in ('anon', 'authenticated', 'service_role', 'supabase_admin', 'postgres'):
    if sql(f"SELECT count(*) FROM pg_roles WHERE rolname='{role}'") == '0':
        sql(f'CREATE ROLE {role}' + (' BYPASSRLS' if role == 'service_role' else ''))

bootstrap = """
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, created_at timestamptz DEFAULT now(), raw_user_meta_data jsonb DEFAULT '{}',
    is_anonymous boolean NOT NULL DEFAULT false);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
CREATE TABLE public.schema_migrations (filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migrations FROM anon, authenticated, service_role;
"""
seed = """
INSERT INTO courses (id,slug) VALUES ('e1830000-0000-4000-8000-000000000010','audit-course');
INSERT INTO adventures (id,course_id,position,slug,theme) VALUES ('e1830000-0000-4000-8000-000000000011','e1830000-0000-4000-8000-000000000010',1,'audit-adventure','archipelago');
INSERT INTO sagas (id,adventure_id,position,slug) VALUES ('e1830000-0000-4000-8000-000000000012','e1830000-0000-4000-8000-000000000011',1,'audit-saga');
INSERT INTO topics (id,saga_id,position,slug) VALUES ('e1830000-0000-4000-8000-000000000013','e1830000-0000-4000-8000-000000000012',1,'audit-topic');
INSERT INTO lessons (id,topic_id,position,slug) VALUES
('e1830000-0000-4000-8000-000000000014','e1830000-0000-4000-8000-000000000013',1,'audit-first'),
('e1830000-0000-4000-8000-000000000015','e1830000-0000-4000-8000-000000000013',2,'audit-second');
"""
report = {'provenance': 'Native PostgreSQL 17.6; minimal auth fixtures; no Docker/GoTrue/provider', 'runs': []}
for iteration in (1,2):
    db = f'lf_completion_{uuid.uuid4().hex[:12]}_{iteration}'
    sql(f'CREATE DATABASE {db}')
    sql(bootstrap, db)
    migrations = sorted((ROOT / 'database' / 'migrations').glob('*.sql'))
    for migration in migrations:
        print(f'{db}: {migration.name}', flush=True)
        checksum = hashlib.sha256(migration.read_bytes()).hexdigest()
        receipt = f"INSERT INTO schema_migrations(filename,checksum) VALUES ('{migration.name}','{checksum}');"
        sql('BEGIN;\n' + migration.read_text(encoding='utf-8') + '\n' + receipt + '\nCOMMIT;', db)
    sql(seed, db)
    sql((ROOT / 'database/scripts/test-lesson-completion.sql').read_text(encoding='utf-8'), db)
    print('Rollback, replay and function-privilege regression passed', flush=True)
    sql("INSERT INTO auth.users(id) VALUES ('e1830000-0000-4000-8000-000000000020')",db)
    def complete(lesson, run, xp):
        return json.loads(sql(f"BEGIN; SET LOCAL ROLE service_role; SELECT complete_lesson('e1830000-0000-4000-8000-000000000020','{lesson}','{run}',100,true,{xp},5,'2026-09-16'); SELECT pg_sleep(0.15); COMMIT;",db))
    with ThreadPoolExecutor(max_workers=8) as pool:
        same=list(pool.map(lambda _: complete('e1830000-0000-4000-8000-000000000014','e1830000-0000-4000-8000-000000000021',20),range(8)))
    assert sum(not r['replayed'] for r in same)==1, same
    with ThreadPoolExecutor(max_workers=8) as pool:
        different=list(pool.map(lambda n: complete('e1830000-0000-4000-8000-000000000014' if n%2==0 else 'e1830000-0000-4000-8000-000000000015',f'e1830000-0000-4000-8000-{30+n:012d}',40 if n%2==0 else 30),range(8)))
    totals=json.loads(sql("SELECT row_to_json(s) FROM learning_stats s WHERE user_id='e1830000-0000-4000-8000-000000000020'",db))
    assert (totals['xp_points'], totals['lessons_completed'], totals['minutes_learned']) == (70,2,45), totals
    assert sql("SELECT sum(attempts) FROM lesson_progress WHERE user_id='e1830000-0000-4000-8000-000000000020'",db)=='9'
    assert sql('BEGIN; SET LOCAL ROLE authenticated; SELECT count(*) FROM lesson_completion_receipts; ROLLBACK;',db)=='0'
    try:
        sql("SET ROLE authenticated; SELECT complete_lesson('e1830000-0000-4000-8000-000000000020','e1830000-0000-4000-8000-000000000014',NULL,100,true,999,1,'2026-09-16')",db)
        raise AssertionError('Browser role executed privileged completion')
    except RuntimeError as error:
        assert 'permission denied for function complete_lesson' in str(error), error
    # Reapply only the new migration: historical destructive deltas must not replay.
    sql((ROOT/'database/migrations/0083_atomic_lesson_completion.sql').read_text(encoding='utf-8'),db)
    report['runs'].append({'database':db,'migrations':len(migrations),'rollback':True,'retry':True,'privileges':True,'concurrentSameRun':8,'concurrentDifferentRuns':8,'totals':totals,'newMigrationReplay':True,'receiptRls':True,'browserExecutionDenied':True,'lockHoldMilliseconds':150,'completedAsServiceRole':True})
    print(f'PASS {db}: real concurrent completions retained exact totals',flush=True)
if os.environ.get('LF_PG_KEEP') != '1':
    for run in report['runs']:
        sql(f"DROP DATABASE {run['database']} WITH (FORCE)")
report_path = os.environ.get('LF_PG_REPORT') or (str(ROOT / 'audit-results/closure-postgres.json') if (ROOT / 'audit-results').is_dir() else None)
if report_path:
    Path(report_path).write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'passed': True, 'runs': len(report['runs'])}))
