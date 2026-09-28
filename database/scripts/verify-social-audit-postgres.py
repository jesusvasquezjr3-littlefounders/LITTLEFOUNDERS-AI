"""E.2 atomic graph audit checks against the owned native PostgreSQL audit cluster."""
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
database = 'lf_social_audit_' + uuid.uuid4().hex
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
def user(query):
    return sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{first}'; {query}",database)
def rejected(query,message):
    try:
        sql(query,database)
    except RuntimeError as error:
        assert message in str(error),str(error)
    else:
        raise AssertionError('Protected operation unexpectedly succeeded')

user(f"INSERT INTO follows VALUES ('{first}','{second}');")
assert sql("SELECT action FROM audit_logs",database)=='social.follow'
assert user('SELECT actor_id FROM audit_logs')==first
assert json.loads(sql('SELECT detail FROM audit_logs',database))=={'follower_id':first,'followed_id':second,'origin':'database-trigger'}
user(f"INSERT INTO follows VALUES ('{first}','{second}') ON CONFLICT DO NOTHING;")
assert sql('SELECT count(*) FROM audit_logs',database)=='1'
user(f"DELETE FROM follows WHERE follower_id='{first}';")
assert sql("SELECT count(*) FROM audit_logs WHERE action='social.unfollow'",database)=='1'
user(f"INSERT INTO blocks VALUES ('{first}','{second}');")
user(f"DELETE FROM blocks WHERE blocker_id='{first}';")
assert sql("SELECT string_agg(action,',' ORDER BY id) FROM audit_logs",database)=='social.follow,social.unfollow,social.block,social.unblock'
# Direct service writes retain the graph participants but do not invent a human actor.
sql(f"SET ROLE service_role; INSERT INTO follows VALUES ('{first}','{second}');",database)
assert sql('SELECT actor_id IS NULL FROM audit_logs ORDER BY id DESC LIMIT 1',database)=='t'
sql(f"SET ROLE service_role; UPDATE follows SET followed_id='{third}' WHERE follower_id='{first}';",database)
assert sql("SELECT count(*) FROM audit_logs WHERE action='social.unfollow' AND subject='{second}'".format(second=second),database)=='2'
assert sql('SELECT count(*) FROM audit_logs',database)=='7'
sql(f"SET ROLE service_role; UPDATE follows SET followed_id='{third}' WHERE follower_id='{first}';",database)
assert sql('SELECT count(*) FROM audit_logs',database)=='7'
# Denied browser writes cannot manufacture a successful audit event.
rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{second}'; INSERT INTO blocks VALUES ('{first}','{third}');",'row-level security')
assert sql('SELECT count(*) FROM audit_logs',database)=='7'
rejected("SET ROLE authenticated; INSERT INTO audit_logs(action) VALUES ('social.follow');",'permission denied')
rejected('SET ROLE authenticated; DELETE FROM audit_logs;', 'permission denied')
# An audit failure rolls back its graph write in the same transaction.
sql("""
CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_AUDIT_FAILURE'; END; $$;
CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit();
""",database)
rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{first}'; INSERT INTO blocks VALUES ('{first}','{second}');",'INJECTED_AUDIT_FAILURE')
assert sql('SELECT count(*) FROM blocks',database)=='0'
assert sql('SELECT count(*) FROM audit_logs',database)=='7'
sql('DROP TRIGGER reject_audit ON audit_logs;',database)
# Replaying trigger definitions creates no historical consent or synthetic events.
sql(migration,database)
assert sql('SELECT count(*) FROM audit_logs',database)=='7'
# Explicit transaction rollback removes both the graph mutation and its audit record.
user(f"BEGIN; INSERT INTO blocks VALUES ('{first}','{second}'); ROLLBACK;")
assert sql('SELECT count(*) FROM blocks',database)=='0'
assert sql('SELECT count(*) FROM audit_logs',database)=='7'
# Kid-role participation is audited while the E.1 inbound prohibition stays enforced.
sql(f"UPDATE user_roles SET role='kid' WHERE user_id='{first}';",database)
user(f"INSERT INTO follows VALUES ('{first}','{second}'); DELETE FROM follows WHERE follower_id='{first}' AND followed_id='{second}';")
user(f"INSERT INTO blocks VALUES ('{first}','{second}'); DELETE FROM blocks WHERE blocker_id='{first}' AND blocked_id='{second}';")
assert sql('SELECT count(*) FROM audit_logs',database)=='11'
rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub='{second}'; INSERT INTO follows VALUES ('{second}','{first}');",'GUARDIAN_APPROVAL_REQUIRED')
assert sql('SELECT count(*) FROM audit_logs',database)=='11'
report={'database':database,'passed':True,'checks':['follow/unfollow/block/unblock audited','JWT actor and fixed participant fields','service actor remains unknown','retarget emits removal and addition','no-op emits no event','RLS-denied mutation emits no event','browser cannot forge or delete audit','audit failure rolls back mutation','transaction rollback removes both','migration replay emits no synthetic history','kid events audited and unapproved inbound follow still refused'],'limitations':['minimal native PostgreSQL fixtures, not full Supabase','guardian/staff read plane and one-release-cycle completeness metric remain pending','approval decisions and block/follow concurrency remain separate work']}
output=ROOT/'audit-results/s02-social-audit-postgres.json'
output.write_bytes((json.dumps(report,indent=2)+'\n').encode('utf-8'))
print(json.dumps(report,indent=2))
