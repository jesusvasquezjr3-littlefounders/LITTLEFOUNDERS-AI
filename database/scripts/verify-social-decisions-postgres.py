"""E.1 guardian decision checks against the owned native PostgreSQL audit cluster."""
from pathlib import Path
import json
import os
import subprocess
import uuid
import time

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
# LF_PG_PSQL/PORT/USER/DATA point the check at another owned cluster (the
# social:db-verify runner starts a throwaway one); the defaults are the
# repo's audit cluster.
PSQL = os.environ.get('LF_PG_PSQL', str(RUNTIME / 'pgsql/bin/psql.exe'))
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', os.environ.get('LF_PG_PORT', '15483'), '-U', os.environ.get('LF_PG_USER', 'audit_owner'), '-v', 'ON_ERROR_STOP=1', '-Atq']

def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')
database = 'lf_social_decisions_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql("""
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE user_roles(user_id uuid, role text);
CREATE TABLE guardian_links(parent_user_id uuid, kid_user_id uuid, verification_status text);
CREATE TABLE follows(follower_id uuid, followed_id uuid, PRIMARY KEY(follower_id,followed_id));
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select_party ON follows FOR SELECT USING (follower_id=auth.uid() OR followed_id=auth.uid());
CREATE POLICY follows_insert_own ON follows FOR INSERT WITH CHECK (follower_id=auth.uid());
CREATE POLICY follows_delete_own ON follows FOR DELETE USING (follower_id=auth.uid());
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT SELECT,INSERT,DELETE ON follows TO authenticated;
GRANT ALL ON follows TO service_role;
""",database)

first,second,third=[str(uuid.uuid4()) for _ in range(3)]
sql(f"""
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('{first}'),('{second}'),('{third}');
INSERT INTO user_roles VALUES ('{first}','universal'),('{second}','universal'),('{third}','universal');
CREATE TABLE audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, action text NOT NULL, subject text NOT NULL DEFAULT '', detail jsonb NOT NULL DEFAULT '{{}}', created_at timestamptz DEFAULT now());
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON audit_logs TO authenticated;
CREATE POLICY audit_logs_select_own ON audit_logs FOR SELECT USING (actor_id=auth.uid());
CREATE TABLE blocks(blocker_id uuid, blocked_id uuid, PRIMARY KEY(blocker_id,blocked_id));
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_select_own ON blocks FOR SELECT USING (blocker_id=auth.uid());
CREATE POLICY blocks_insert_own ON blocks FOR INSERT WITH CHECK (blocker_id=auth.uid());
CREATE POLICY blocks_delete_own ON blocks FOR DELETE USING (blocker_id=auth.uid());
GRANT SELECT,INSERT,DELETE ON blocks TO authenticated;
GRANT ALL ON blocks TO service_role;
""",database)
sql((ROOT/'database/migrations/0094_social_privacy_admission.sql').read_text(encoding='utf-8'),database)
migration=(ROOT/'database/migrations/0095_atomic_social_audit.sql').read_text(encoding='utf-8')
sql(migration,database)

from concurrent.futures import ThreadPoolExecutor
migration=(ROOT/'database/migrations/0096_social_connection_requests.sql').read_text(encoding='utf-8')
sql(migration,database)
sql(f"UPDATE user_roles SET role='kid' WHERE user_id='{first}'; INSERT INTO guardian_links VALUES ('{second}','{first}','verified');",database)

sql(f"""
CREATE TABLE parent_verifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), status text, method text, birth_date date, created_at timestamptz DEFAULT now());
INSERT INTO parent_verifications(user_id,status,method,birth_date,created_at) VALUES ('{second}','verified','local-ocr','1990-01-01','2026-01-01');
UPDATE user_roles SET role='parent' WHERE user_id='{second}';
""",database)
migration=(ROOT/'database/migrations/0097_social_guardian_decisions.sql').read_text(encoding='utf-8')
sql(migration,database)
def service(query): return sql('SET ROLE service_role;'+query,database)
def request(requester=third): return service(f"SELECT request_social_connection('{requester}','{first}');")
def decide(request_id, approve=True, guardian=second): return service(f"SELECT decide_social_connection('{request_id}','{guardian}',{str(approve).lower()});")
def rejected(query,message):
    try: sql(query,database)
    except RuntimeError as error: assert message in str(error),str(error)
    else: raise AssertionError('Protected operation unexpectedly succeeded')
def deny_decision(request_id,guardian=second,message='GUARDIAN_DECISION_FORBIDDEN'):
    rejected(f"SET ROLE service_role; SELECT decide_social_connection('{request_id}','{guardian}',true);",message)
def new_request():
    requester=str(uuid.uuid4())
    sql(f"INSERT INTO auth.users VALUES ('{requester}'); INSERT INTO user_roles VALUES ('{requester}','universal');",database)
    return requester,request(requester)
request_id=request()
assert sql('SELECT count(*) FROM follows',database)=='0'
deny_decision(request_id,third)
rejected(f"SET ROLE authenticated; SELECT decide_social_connection('{request_id}','{second}',true);",'permission denied')
sql(f"UPDATE parent_verifications SET birth_date='2020-01-01';",database)
deny_decision(request_id)
sql("UPDATE parent_verifications SET birth_date='1990-01-01';",database)
sql(f"INSERT INTO parent_verifications(user_id,status,method,birth_date) VALUES ('{second}','revoked','local-ocr','1990-01-01');",database)
deny_decision(request_id)
sql("DELETE FROM parent_verifications WHERE status='revoked';",database)
sql("UPDATE guardian_links SET verification_status='revoked';",database)
deny_decision(request_id)
sql("UPDATE guardian_links SET verification_status='verified';",database)
assert decide(request_id)=='approved'
assert sql('SELECT count(*) FROM follows',database)=='1'
assert sql(f"SELECT decided_by FROM social_connection_requests WHERE id='{request_id}'",database)==second
count=sql('SELECT count(*) FROM audit_logs',database)
assert decide(request_id)=='approved'
assert sql('SELECT count(*) FROM audit_logs',database)==count
rejected(f"SET ROLE service_role; SELECT decide_social_connection('{request_id}','{second}',false);",'SOCIAL_DECISION_CONFLICT')
rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{third}'; INSERT INTO follows VALUES ('{third}','{first}') ON CONFLICT DO NOTHING;",'GUARDIAN_APPROVAL_REQUIRED')
requester,denied_id=new_request()
assert decide(denied_id,False)=='denied'
assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{requester}'",database)=='0'
assert decide(denied_id,False)=='denied'
deny_decision(denied_id,message='SOCIAL_DECISION_CONFLICT')
# A failure in the explicit guardian decision audit must roll back the edge and decision.
requester,failed_id=new_request()
sql("""
CREATE FUNCTION reject_decision_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='social.connection_approved' THEN RAISE EXCEPTION 'INJECTED_DECISION_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER reject_decision_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_decision_audit();
""",database)
deny_decision(failed_id,message='INJECTED_DECISION_AUDIT_FAILURE')
assert sql(f"SELECT status FROM social_connection_requests WHERE id='{failed_id}'",database)=='pending'
assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{requester}'",database)=='0'
assert sql(f"SELECT count(*) FROM audit_logs WHERE action='social.follow' AND detail->>'follower_id'='{requester}'",database)=='0'
sql('DROP TRIGGER reject_decision_audit ON audit_logs;',database)
with ThreadPoolExecutor(max_workers=8) as pool:
    outcomes=list(pool.map(lambda _: decide(failed_id),range(8)))
assert outcomes==['approved']*8
assert sql(f"SELECT count(*) FROM audit_logs WHERE action='social.connection_approved' AND detail->>'request_id'='{failed_id}'",database)=='1'
requester,blocked_id=new_request()
sql(f"INSERT INTO blocks VALUES ('{first}','{requester}');",database)
deny_decision(blocked_id,message='SOCIAL_CONNECTION_BLOCKED')
assert decide(blocked_id,False)=='denied'
sql(migration,database)
assert decide(request_id)=='approved'
# Revocation invalidates the guardian's current eligibility even for decision retries.
sql("UPDATE guardian_links SET verification_status='revoked';",database)
deny_decision(request_id)
# Observe actual row-lock waits in both guardian-link revocation orderings.
sql("UPDATE guardian_links SET verification_status='verified';",database)
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


_,race_id=new_request()
try:
    race("UPDATE guardian_links SET verification_status='revoked'", f"SET ROLE service_role; SELECT decide_social_connection('{race_id}','{second}',true);", 'decision_waiter')
except RuntimeError as error:
    assert 'GUARDIAN_DECISION_FORBIDDEN' in str(error)
else:
    raise AssertionError('Decision bypassed earlier revocation')
assert sql(f"SELECT status FROM social_connection_requests WHERE id='{race_id}'",database)=='pending'
sql("UPDATE guardian_links SET verification_status='verified';",database)
_,race_id=new_request()
assert race(f"SET ROLE service_role; SELECT decide_social_connection('{race_id}','{second}',true);", "UPDATE guardian_links SET verification_status='revoked'", 'revocation_waiter')==''
assert sql(f"SELECT status FROM social_connection_requests WHERE id='{race_id}'",database)=='approved'
assert service(f"SELECT social_guardian_is_current('{second}','{first}');")=='f'
report={'database':database,'passed':True,'checks':['verified adult guardian only','latest revocation defeats historical verification','no edge before approval','approval creates edge and audit atomically','browser cannot insert a kid follow even with an approved receipt','denial creates no edge','same decision idempotent and opposite decision conflicts','audit failure rolls back decision and follow','eight concurrent approvals create one decision event','blocked approval refused but denial allowed','migration replay preserves outcome','revoked guardian cannot retry decisions','observed locks in both guardian-link revocation orderings'],'limitations':['minimal native PostgreSQL fixtures, not full Supabase','Core decision route/UI not enabled','approved discovery and unfollow/block revocation lifecycle still pending','block races and role/verification transition coverage remain pending']}
output=ROOT/'audit-results/s02-social-decisions-postgres.json'
output.write_bytes((json.dumps(report,indent=2)+'\n').encode('utf-8'))
print(json.dumps(report,indent=2))
