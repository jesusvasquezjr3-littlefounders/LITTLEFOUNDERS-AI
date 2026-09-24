"""Supplemental H.1 concurrency checks; fresh DB on the owned native audit cluster."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BASE = [str(RUNTIME / 'pgsql/bin/psql.exe'), '-X', '-h', '127.0.0.1', '-p', '15483', '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq']
def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout.strip()
if Path(sql('SHOW data_directory')).resolve() != (RUNTIME / 'data').resolve():
    raise RuntimeError('Refusing an unowned database cluster')
database = 'lf_analytics_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql("""
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, is_anonymous boolean);
CREATE TABLE public.user_roles(user_id uuid, role text);
CREATE TABLE public.analytics_consents(kid_user_id uuid, revoked_at timestamptz);
CREATE TABLE public.learning_events(id bigint GENERATED ALWAYS AS IDENTITY, user_id uuid, event text);
CREATE TABLE public.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY, user_id uuid, action text);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT INSERT, SELECT ON learning_events, audit_logs TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
""", database)
for name in ['0085_under13_origin.sql', '0086_age_declarations.sql', '0089_teen_analytics_preferences.sql', '0090_optional_event_admission.sql']:
    sql((ROOT / 'database/migrations' / name).read_text(encoding='utf-8'), database)
user = str(uuid.uuid4())
sql(f"INSERT INTO auth.users VALUES ('{user}',false); INSERT INTO user_roles VALUES ('{user}','universal'); SELECT record_age_declaration('{user}','13_to_17');", database)
def choice(value): return sql(f"SET ROLE service_role; SELECT set_teen_analytics_preference('{user}',{str(value).lower()})", database)
def event(): return sql(f"SET ROLE service_role; INSERT INTO learning_events(user_id,event) VALUES ('{user}','nav_view') RETURNING id", database)
assert event() == ''
choice(True); assert event() != ''
choice(False); assert event() == ''
sql(f"SET ROLE service_role; INSERT INTO audit_logs(user_id,action) VALUES ('{user}','safety_check')", database)
assert sql('SELECT count(*) FROM audit_logs', database) == '1'

def wait_for(expression):
    for _ in range(200):
        if sql(expression, database) == 't': return
        time.sleep(.02)
    raise AssertionError('Expected lock state was not observed')

def race(first, second, label):
    holder = subprocess.Popen(BASE + ['-d', database], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
    try:
        holder.stdin.write(f"BEGIN; {first}; SELECT pg_advisory_xact_lock(9090);\n"); holder.stdin.flush()
        wait_for("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=9090 AND database=(SELECT oid FROM pg_database WHERE datname=current_database()))")
        with ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(sql, f"SET application_name = '{label}'; {second}", database)
            try:
                wait_for(f"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='{label}' AND cardinality(pg_blocking_pids(pid))>0)")
            finally:
                holder.stdin.write('COMMIT;\n'); holder.stdin.flush(); holder.stdin.close(); holder.stdin = None
            result = pending.result(timeout=20)
        stdout, stderr = holder.communicate(timeout=20)
        assert holder.returncode == 0, stderr
        return result
    finally:
        if holder.poll() is None:
            if holder.stdin:
                holder.stdin.write('ROLLBACK;\n'); holder.stdin.close(); holder.stdin = None
            holder.communicate(timeout=20)

choice(True)
assert race(f"SELECT set_teen_analytics_preference('{user}',false)", f"SET ROLE service_role; INSERT INTO learning_events(user_id,event) VALUES ('{user}','nav_view') RETURNING id", 'event_waiter') == ''
choice(True)
count_before = int(sql('SELECT count(*) FROM learning_events', database))
assert race(f"SET LOCAL ROLE service_role; INSERT INTO learning_events(user_id,event) VALUES ('{user}','nav_view')", f"SET ROLE service_role; SELECT set_teen_analytics_preference('{user}',false)", 'revoke_waiter') == 'f'
assert int(sql('SELECT count(*) FROM learning_events', database)) == count_before + 1
assert event() == ''
# Replay preserves both history and the revoked preference.
sql((ROOT / 'database/migrations/0090_optional_event_admission.sql').read_text(encoding='utf-8'), database)
assert event() == ''
populations = [
    ('adult', ['universal'], False, False, None, False, True),
    ('13_to_17', ['universal'], False, False, True, False, True),
    ('13_to_17', ['universal'], False, False, False, False, False),
    ('13_to_17', ['kid'], False, False, False, True, True),
    ('13_to_17', ['kid'], False, False, True, False, False),
    ('13_to_17', ['parent'], False, True, True, True, False),
    ('adult', ['parent'], True, False, None, True, False),
    ('adult', [], False, False, None, False, False),
    (None, ['universal'], False, False, True, False, False),
    ('under_13', ['kid'], False, True, True, True, False),
]
for band, roles, guest, origin, preference, consent, expected in populations:
    subject = str(uuid.uuid4())
    sql(f"INSERT INTO auth.users VALUES ('{subject}',{str(guest).lower()})", database)
    for role in roles: sql(f"INSERT INTO user_roles VALUES ('{subject}','{role}')", database)
    if band: sql(f"SELECT record_age_declaration('{subject}','{band}')", database)
    if origin: sql(f"SELECT mark_under13_origin('{subject}')", database)
    if preference is not None: sql(f"SELECT set_teen_analytics_preference('{subject}',{str(preference).lower()})", database)
    if consent: sql(f"INSERT INTO analytics_consents VALUES ('{subject}',NULL)", database)
    inserted = sql(f"SET ROLE service_role; INSERT INTO learning_events(user_id,event) VALUES ('{subject}','nav_view') RETURNING id", database)
    assert bool(inserted) == expected, (band, roles, guest, origin, preference, consent)
assert sql("SET ROLE service_role; INSERT INTO learning_events(user_id,event) VALUES (NULL,'page_view') RETURNING id", database)
report = {'database': database, 'provenance': 'Native PostgreSQL, minimal fixtures; not full Supabase', 'revocationFirstDropsBlockedInsert': True, 'insertFirstCommitsBeforeRevocationAcknowledgement': True, 'bothLockWaitsObserved': True, 'safetyFixtureUnaffected': True, 'migrationReplayPreservesOptOut': True, 'populationCases': len(populations), 'anonymousAcquisitionUnchanged': True}
(ROOT / 'audit-results/s01-analytics-concurrency.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
