"""E.1 admission and RLS checks against the owned native PostgreSQL audit cluster."""
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
database = 'lf_social_' + uuid.uuid4().hex
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
kid,guardian,sibling,outsider,adult,unknown=[str(uuid.uuid4()) for _ in range(6)]
sql(f"""
INSERT INTO user_roles VALUES ('{kid}','kid'),('{guardian}','parent'),('{sibling}','kid'),('{outsider}','parent'),('{adult}','adult');
INSERT INTO guardian_links VALUES ('{guardian}','{kid}','verified'),('{guardian}','{sibling}','verified');
INSERT INTO follows VALUES ('{outsider}','{kid}'),('{kid}','{outsider}'),('{guardian}','{kid}'),('{sibling}','{kid}');
""",database)
migration=(ROOT/'database/migrations/0094_social_privacy_admission.sql').read_text(encoding='utf-8')
sql(migration,database)

def viewer(user,query):
    return sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{user}'; {query}",database)

assert viewer(outsider,'SELECT count(*) FROM follows')=='0'
assert viewer(kid,'SELECT count(*) FROM follows')=='4'
assert viewer(guardian,'SELECT count(*) FROM follows')=='1'
assert viewer(sibling,'SELECT count(*) FROM follows')=='1'
assert viewer(outsider,f"SELECT social_subject_visible('{unknown}')")=='f'
assert viewer(unknown,f"SELECT social_subject_visible('{unknown}')")=='t'
assert viewer(outsider,f"SELECT social_subject_visible('{adult}')")=='t'

def rejected(query,message):
    try:
        sql(query,database)
    except RuntimeError as error:
        assert message in str(error),str(error)
    else:
        raise AssertionError('Protected operation unexpectedly succeeded')

for user in [guardian,sibling,outsider]:
    rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{user}'; INSERT INTO follows VALUES ('{user}','{kid}');",'GUARDIAN_APPROVAL_REQUIRED')
rejected(f"SET ROLE service_role; INSERT INTO follows VALUES ('{adult}','{kid}');",'GUARDIAN_APPROVAL_REQUIRED')
rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{outsider}'; INSERT INTO follows VALUES ('{outsider}','{unknown}');",'SOCIAL_ROLE_UNAVAILABLE')
viewer(outsider,f"INSERT INTO follows VALUES ('{outsider}','{adult}')")
rejected(f"SET ROLE service_role; UPDATE follows SET followed_id='{sibling}' WHERE follower_id='{outsider}' AND followed_id='{adult}';",'GUARDIAN_APPROVAL_REQUIRED')
sql(f"UPDATE guardian_links SET verification_status='revoked' WHERE kid_user_id='{kid}'",database)
assert viewer(guardian,'SELECT count(*) FROM follows')=='0'
assert viewer(sibling,'SELECT count(*) FROM follows')=='0'
assert viewer(outsider,'SELECT count(*) FROM follows')=='1'
# Replaying the policy/trigger definition must neither grant approval nor destroy legacy rows.
sql(migration,database)
assert sql('SELECT count(*) FROM follows',database)=='5'
assert viewer(outsider,'SELECT count(*) FROM follows')=='1'
rejected(f"SET ROLE anon; SELECT social_subject_visible('{kid}');",'permission denied')
report={'database':database,'passed':True,'checks':['legacy outside-family edges hidden','self/guardian/sibling reads','missing role fails closed','direct browser and service child follow refused','unknown-role follow refused','adult follow allowed','edge retarget refused','revoked family loses visibility','migration replay retains history','anonymous helper denied'],'limitations':['minimal fixtures, not full Supabase','approval workflow not implemented','concurrent role/link transitions require further verification']}
output=ROOT/'audit-results/s02-social-postgres.json'
output.parent.mkdir(exist_ok=True)
output.write_bytes((json.dumps(report,indent=2)+'\n').encode('utf-8'))
print(json.dumps(report,indent=2))
