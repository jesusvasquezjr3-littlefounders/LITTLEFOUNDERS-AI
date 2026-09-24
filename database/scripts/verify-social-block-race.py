"""Adversarial release gate: a committed block must defeat an in-flight approval."""
from pathlib import Path
import json
import runpy
import sys
import subprocess
from concurrent.futures import ThreadPoolExecutor, TimeoutError

# The prerequisite creates a fresh owned DB and applies the real decision migrations.
context = runpy.run_path(str(Path(__file__).with_name('verify-social-decisions-postgres.py')))
sql, database, base = context['sql'], context['database'], context['BASE']
kid, guardian = context['first'], context['second']
if '--baseline97' not in sys.argv:
    migration_path = 'database/scripts/fixtures/social-block-candidate.sql' if '--candidate' in sys.argv else 'database/migrations/0098_atomic_social_blocks.sql'
    sql((context['ROOT'] / migration_path).read_text(encoding='utf-8'), database)
sql("UPDATE guardian_links SET verification_status='verified';", database)
requester, request_id = context['new_request']()
holder = subprocess.Popen(base + ['-d', database], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
try:
    holder.stdin.write(f"BEGIN; SET ROLE service_role; SELECT decide_social_connection('{request_id}','{guardian}',true); SELECT pg_advisory_xact_lock(9091);\n")
    holder.stdin.flush()
    context['wait_for']("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=9091 AND database=(SELECT oid FROM pg_database WHERE datname=current_database()))")
    # A corrected blocker may wait for the approval; observe that wait before committing.
    def block_transaction():
        sql(f"SET application_name='social_block_waiter'; SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; INSERT INTO blocks VALUES ('{kid}','{requester}');", database)
        if '--baseline97' in sys.argv:
            sql(f"SET ROLE service_role; DELETE FROM follows WHERE (follower_id='{kid}' AND followed_id='{requester}') OR (follower_id='{requester}' AND followed_id='{kid}');", database)
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(block_transaction)
        try:
            pending.result(timeout=0.5)
        except TimeoutError:
            context['wait_for']("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='social_block_waiter' AND cardinality(pg_blocking_pids(pid))>0)")
        finally:
            holder.stdin.write('COMMIT;\n'); holder.stdin.flush(); holder.stdin.close(); holder.stdin = None
        pending.result(timeout=20)
    _, error = holder.communicate(timeout=20)
    assert holder.returncode == 0, error
finally:
    if holder.poll() is None:
        if holder.stdin:
            holder.stdin.write('ROLLBACK;\n'); holder.stdin.close(); holder.stdin = None
        holder.communicate(timeout=20)
blocked = sql(f"SELECT count(*) FROM blocks WHERE blocker_id='{kid}' AND blocked_id='{requester}'", database)
edges = sql(f"SELECT count(*) FROM follows WHERE follower_id='{requester}' AND followed_id='{kid}'", database)
status = sql(f"SELECT status FROM social_connection_requests WHERE id='{request_id}'", database)
checks = []
if '--baseline97' not in sys.argv:
    # Core retries use INSERT ON CONFLICT DO NOTHING after an already atomic block.
    audit_count = sql('SELECT count(*) FROM audit_logs', database)
    sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; INSERT INTO blocks VALUES ('{kid}','{requester}') ON CONFLICT DO NOTHING;", database)
    assert sql('SELECT count(*) FROM audit_logs', database) == audit_count
    assert sql(f"SELECT status FROM social_connection_requests WHERE id='{request_id}'", database) == 'revoked'
    checks.append('duplicate block retry preserves outcome without duplicate audit')
    # Removing the block must not resurrect an old approval.
    sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; DELETE FROM blocks WHERE blocker_id='{kid}' AND blocked_id='{requester}';", database)
    context['deny_decision'](request_id, message='SOCIAL_DECISION_CONFLICT')
    assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{requester}' AND followed_id='{kid}'", database) == '0'
    checks.append('unblock does not resurrect approval')
    next_requester, next_id = context['new_request']()
    try:
        context['race'](f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; INSERT INTO blocks VALUES ('{kid}','{next_requester}');", f"SET ROLE service_role; SELECT decide_social_connection('{next_id}','{guardian}',true);", 'blocked_decision_waiter')
    except RuntimeError as error:
        assert 'SOCIAL_DECISION_CONFLICT' in str(error)
    else:
        raise AssertionError('Approval bypassed earlier block')
    assert sql(f"SELECT status FROM social_connection_requests WHERE id='{next_id}'", database) == 'revoked'
    checks.append('block first revokes and refuses waiting decision')
    # The guardian may also be the requester; pair-before-user lock order must still work.
    own_id = context['request'](guardian)
    context['race'](f"SET ROLE service_role; SELECT decide_social_connection('{own_id}','{guardian}',true);", f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; INSERT INTO blocks VALUES ('{kid}','{guardian}');", 'guardian_block_waiter')
    assert sql(f"SELECT status FROM social_connection_requests WHERE id='{own_id}'", database) == 'revoked'
    assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{guardian}' AND followed_id='{kid}'", database) == '0'
    checks.append('guardian-as-requester approval and block lock order')
    # Ordinary adult following uses the same admission lock, not just guardian decisions.
    adult_follower, _ = context['new_request']()
    adult_target = context['third']
    context['race'](f"SET ROLE authenticated; SET request.jwt.claim.sub='{adult_follower}'; INSERT INTO follows VALUES ('{adult_follower}','{adult_target}');", f"SET ROLE authenticated; SET request.jwt.claim.sub='{adult_target}'; INSERT INTO blocks VALUES ('{adult_target}','{adult_follower}');", 'ordinary_follow_block_waiter')
    assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{adult_follower}' AND followed_id='{adult_target}'", database) == '0'
    checks.append('ordinary follow admission also serializes with block cleanup')
    rollback_requester, rollback_id = context['new_request']()
    assert context['decide'](rollback_id) == 'approved'
    sql("""
CREATE FUNCTION reject_revocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='social.connection_revoked' THEN RAISE EXCEPTION 'INJECTED_REVOCATION_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER reject_revocation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_revocation_audit();
""", database)
    context['rejected'](f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; INSERT INTO blocks VALUES ('{kid}','{rollback_requester}');", 'INJECTED_REVOCATION_AUDIT_FAILURE')
    assert sql(f"SELECT count(*) FROM blocks WHERE blocker_id='{kid}' AND blocked_id='{rollback_requester}'", database) == '0'
    assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{rollback_requester}' AND followed_id='{kid}'", database) == '1'
    assert sql(f"SELECT status FROM social_connection_requests WHERE id='{rollback_id}'", database) == 'approved'
    checks.append('failed revocation audit rolls back block, cleanup and request changes')
report = {'database': database, 'candidateApplied': '--candidate' in sys.argv, 'migrationApplied': '0098' if '--candidate' not in sys.argv and '--baseline97' not in sys.argv else None, 'checks': checks, 'blockCommitted': blocked == '1', 'remainingEdges': int(edges), 'requestStatus': status, 'passed': blocked == '1' and edges == '0', 'provenance': 'Real PostgreSQL transactions with the actual decision migrations; single block write mirrors current Core; --baseline97 includes historical separate cleanup. Minimal schema fixtures.'}
output = context['ROOT'] / 'audit-results/s02-social-block-race.json'
output.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
assert report['passed'], 'Release blocker: an approval committed after a block leaves an active edge'
