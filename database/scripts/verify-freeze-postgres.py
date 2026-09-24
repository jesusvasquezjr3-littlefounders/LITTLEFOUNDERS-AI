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
database = 'lf_freeze_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql("""
CREATE TABLE banking_accounts(kid_user_id uuid PRIMARY KEY, frozen boolean, frozen_by uuid, nickname text, card_design text);
CREATE TABLE tasks(id uuid PRIMARY KEY, assigned_to uuid, status text, allocated boolean, reward_coins int);
CREATE TABLE savings_goals(id uuid PRIMARY KEY, kid_user_id uuid, status text);
CREATE TABLE wallet_ledger(kid_user_id uuid, bucket text, amount int, reason text, created_by uuid, task_id uuid, goal_id uuid, redemption_id uuid);
CREATE TABLE pending_credits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kid_user_id uuid, amount int, source text, source_ref uuid, allocated boolean DEFAULT false);
CREATE TABLE allowance_rules(id uuid PRIMARY KEY, kid_user_id uuid, parent_user_id uuid, amount int, frequency text, active boolean, next_run_at timestamptz);
CREATE TABLE savings_bonus_rules(kid_user_id uuid PRIMARY KEY, rate_bp int, active boolean, next_run_at timestamptz);
CREATE TABLE redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kid_user_id uuid, catalog_id uuid, status text DEFAULT 'requested', decided_at timestamptz, decided_by uuid);
CREATE TABLE redemption_catalog(id uuid PRIMARY KEY, cost int);
GRANT USAGE ON SCHEMA public TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, UPDATE ON banking_accounts TO authenticated;
""", database)
migration=(ROOT/'database/migrations/0093_enforce_banking_freeze.sql').read_text(encoding='utf-8')
sql(migration,database)
kid,parent,task,credit,rule,catalog=[str(uuid.uuid4()) for _ in range(6)]
sql(f"""
INSERT INTO banking_accounts VALUES ('{kid}',true,'{parent}','Synthetic','indigo');
INSERT INTO tasks VALUES ('{task}','{kid}','approved',false,10);
INSERT INTO pending_credits(id,kid_user_id,amount,source) VALUES ('{credit}','{kid}',10,'allowance');
INSERT INTO allowance_rules VALUES ('{rule}','{kid}','{parent}',10,'weekly',true,now()-interval '1 day');
INSERT INTO redemption_catalog VALUES ('{catalog}',3);
""",database)
def service(query): return sql('SET ROLE service_role;'+query,database)
def allocate(): return service(f"SELECT allocate_pending_credit('{credit}','{kid}',10,0,0,'{kid}');")
assert allocate()=='f'
assert service(f"SELECT allocate_task_reward('{task}','{kid}',10,0,0,'{kid}',NULL);")=='f'
due=sql('SELECT next_run_at FROM allowance_rules',database)
assert service(f"SELECT run_due_scheduled_credits('{kid}');")=='0'
assert sql('SELECT next_run_at FROM allowance_rules',database)==due
assert sql('SELECT count(*) FROM wallet_ledger',database)=='0'
assert sql('SELECT allocated FROM pending_credits',database)=='f'
try: service(f"INSERT INTO redemptions(kid_user_id,catalog_id) VALUES ('{kid}','{catalog}');")
except RuntimeError as error: assert 'ACCOUNT_FROZEN' in str(error)
else: raise AssertionError('Frozen request was accepted')
try: sql(f"SET ROLE authenticated; UPDATE banking_accounts SET frozen=false WHERE kid_user_id='{kid}';",database)
except RuntimeError as error: assert 'permission denied' in str(error)
else: raise AssertionError('Browser directly removed freeze')
service(f"UPDATE banking_accounts SET frozen=false WHERE kid_user_id='{kid}';")
assert allocate()=='t'
assert service(f"SELECT allocate_task_reward('{task}','{kid}',10,0,0,'{kid}',NULL);")=='t'
assert service(f"SELECT run_due_scheduled_credits('{kid}');")=='1'
service(f"INSERT INTO redemptions(kid_user_id,catalog_id) VALUES ('{kid}','{catalog}');")
assert sql('SELECT sum(amount) FROM wallet_ledger',database)=='20'
assert sql('SELECT count(*) FROM pending_credits WHERE NOT allocated',database)=='1'
sql(migration,database)
assert sql('SELECT sum(amount) FROM wallet_ledger',database)=='20'
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

racing_credit=str(uuid.uuid4())
sql(f"INSERT INTO pending_credits(id,kid_user_id,amount,source) VALUES ('{racing_credit}','{kid}',10,'allowance');",database)
allocation=f"SET ROLE service_role; SELECT allocate_pending_credit('{racing_credit}','{kid}',10,0,0,'{kid}');"
freeze=f"UPDATE banking_accounts SET frozen=true,frozen_by='{parent}' WHERE kid_user_id='{kid}'"
assert race(freeze,allocation,'allocation_waiter')=='f'
assert sql(f"SELECT allocated FROM pending_credits WHERE id='{racing_credit}'",database)=='f'
service(f"UPDATE banking_accounts SET frozen=false WHERE kid_user_id='{kid}';")
assert race(allocation,freeze,'freeze_waiter')==''
assert sql(f"SELECT allocated FROM pending_credits WHERE id='{racing_credit}'",database)=='t'
assert sql('SELECT frozen FROM banking_accounts',database)=='t'
assert sql('SELECT sum(amount) FROM wallet_ledger',database)=='30'
redemption=sql('SELECT id FROM redemptions LIMIT 1',database)
assert service(f"SELECT decide_redemption('{redemption}',true,'{parent}');")=='f'
assert sql('SELECT status FROM redemptions LIMIT 1',database)=='requested'
assert service(f"SELECT decide_redemption('{redemption}',false,'{parent}');")=='t'
assert sql('SELECT status FROM redemptions LIMIT 1',database)=='denied'
report=dict(database=database,provenance='Native PostgreSQL with actual 0093 functions over minimal fixtures; not full Supabase',frozenTaskHeld=True,frozenAllowanceHeld=True,scheduleNotAdvanced=True,redemptionRejected=True,directBrowserUnfreezeDenied=True,unfreezeResumesWithoutLostCredits=True,replayPreservesLedger=True, freezeFirstHoldsWaitingAllocation=True, allocationFirstCompletesBeforeFreeze=True, bothLockWaitsObserved=True, frozenApprovalHeld=True, denialStillAvailable=True)
(ROOT/'audit-results/s02-freeze-postgres.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
