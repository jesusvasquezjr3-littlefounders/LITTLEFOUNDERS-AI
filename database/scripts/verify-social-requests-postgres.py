"""E.1 pending social request checks against the owned native PostgreSQL audit cluster."""
from pathlib import Path
import json
import os
import subprocess
import uuid

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
database = 'lf_social_requests_' + uuid.uuid4().hex
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
def request(requester=third):
    return sql(f"SET ROLE service_role; SELECT request_social_connection('{requester}','{first}');",database)
def rejected(query,message):
    try:
        sql(query,database)
    except RuntimeError as error:
        assert message in str(error),str(error)
    else:
        raise AssertionError('Protected operation unexpectedly succeeded')

request_id=request()
assert str(uuid.UUID(request_id))==request_id
assert request()==request_id
assert sql('SELECT status FROM social_connection_requests',database)=='pending'
assert sql("SELECT count(*) FROM audit_logs WHERE action='social.connection_requested'",database)=='1'
assert sql('SELECT count(*) FROM follows',database)=='0'
assert sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{third}'; SELECT social_subject_visible('{first}');",database)=='f'
for role in ['anon','authenticated']:
    rejected(f"SET ROLE {role}; SELECT request_social_connection('{third}','{first}');",'permission denied')
    rejected(f"SET ROLE {role}; SELECT * FROM social_connection_requests;",'permission denied')
    rejected(f"SET ROLE {role}; UPDATE social_connection_requests SET status='approved';",'permission denied')
rejected("SET ROLE service_role; UPDATE social_connection_requests SET status='approved';",'permission denied')
rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{third}'; INSERT INTO follows VALUES ('{third}','{first}');",'GUARDIAN_APPROVAL_REQUIRED')
# Concurrent callers create one pending request and one event, sharing the receipt.
fourth=str(uuid.uuid4())
sql(f"INSERT INTO auth.users VALUES ('{fourth}'); INSERT INTO user_roles VALUES ('{fourth}','universal');",database)
with ThreadPoolExecutor(max_workers=8) as pool:
    ids=list(pool.map(lambda _: request(fourth),range(8)))
assert len(set(ids))==1
assert sql('SELECT count(*) FROM social_connection_requests',database)=='2'
assert sql("SELECT count(*) FROM audit_logs WHERE action='social.connection_requested'",database)=='2'
# Existing blocks and a revoked guardian link prevent further request admission.
sql(f"INSERT INTO blocks VALUES ('{first}','{third}');",database)
rejected(f"SET ROLE service_role; SELECT request_social_connection('{third}','{first}');",'SOCIAL_REQUEST_UNAVAILABLE')
sql('DELETE FROM blocks;',database)
sql("UPDATE guardian_links SET verification_status='revoked';",database)
rejected(f"SET ROLE service_role; SELECT request_social_connection('{third}','{first}');",'SOCIAL_REQUEST_UNAVAILABLE')
sql("UPDATE guardian_links SET verification_status='verified';",database)
rejected(f"SET ROLE service_role; SELECT request_social_connection('{first}','{first}');",'INVALID_SOCIAL_REQUEST')
rejected(f"SET ROLE service_role; SELECT request_social_connection('{third}','{second}');",'SOCIAL_REQUEST_UNAVAILABLE')
# A missing audit insert must roll back the pending request itself.
fifth=str(uuid.uuid4())
sql(f"INSERT INTO auth.users VALUES ('{fifth}'); INSERT INTO user_roles VALUES ('{fifth}','universal');",database)
sql("""
CREATE FUNCTION reject_request_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_AUDIT_FAILURE'; END; $$;
CREATE TRIGGER reject_request_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_request_audit();
""",database)
rejected(f"SET ROLE service_role; SELECT request_social_connection('{fifth}','{first}');",'INJECTED_AUDIT_FAILURE')
assert sql('SELECT count(*) FROM social_connection_requests',database)=='2'
sql('DROP TRIGGER reject_request_audit ON audit_logs;',database)
sql(migration,database)
assert request()==request_id
assert sql('SELECT count(*) FROM social_connection_requests',database)=='2'
assert sql('SELECT count(*) FROM follows',database)=='0'
report={'database':database,'passed':True,'checks':['pending only with no follow or visibility','idempotent receipt and one audit','browser cannot read, invoke or approve','service cannot directly approve','direct follow still refused','eight concurrent retries produce one request','blocked and revoked-link admission refused','self/non-kid refused','audit failure rolls back pending request','migration replay preserves receipts'],'limitations':['minimal native PostgreSQL fixtures, not full Supabase','Core admission and guardian decision/UI not implemented','concurrent block/link/role transitions and abuse controls remain pending']}
output=ROOT/'audit-results/s02-social-requests-postgres.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes((json.dumps(report,indent=2)+'\n').encode('utf-8'))
print(json.dumps(report,indent=2))
