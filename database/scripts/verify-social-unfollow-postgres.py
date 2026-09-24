"""E.1/E.2 withdrawal authorization, atomicity and real approval ordering."""
from pathlib import Path
import json
import runpy

c = runpy.run_path(str(Path(__file__).with_name('verify-social-decisions-postgres.py')))
sql, database, kid, guardian = c['sql'], c['database'], c['first'], c['second']
for name in ['0098_atomic_social_blocks.sql', '0099_atomic_social_unfollow.sql']:
    sql((c['ROOT'] / 'database/migrations' / name).read_text(encoding='utf-8'), database)
sql("UPDATE guardian_links SET verification_status='verified'", database)

def withdraw(who, target=kid):
    return f"SET ROLE authenticated; SET request.jwt.claim.sub='{who}'; SELECT withdraw_social_connection('{who}','{target}');"

def state(who, request_id):
    assert sql(f"SELECT status FROM social_connection_requests WHERE id='{request_id}'", database) == 'revoked'
    assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{who}' AND followed_id='{kid}'", database) == '0'

who, request_id = c['new_request']()
assert c['decide'](request_id) == 'approved'
assert sql(withdraw(who), database) == 't'
state(who, request_id)
audit_count = sql('SELECT count(*) FROM audit_logs', database)
assert sql(withdraw(who), database) == 't'
assert sql('SELECT count(*) FROM audit_logs', database) == audit_count
c['deny_decision'](request_id, message='SOCIAL_DECISION_CONFLICT')
c['rejected'](f"SET ROLE authenticated; SET request.jwt.claim.sub='{guardian}'; SELECT withdraw_social_connection('{who}','{kid}');", 'SOCIAL_WITHDRAWAL_FORBIDDEN')
c['rejected'](f"SET ROLE anon; SELECT withdraw_social_connection('{who}','{kid}');", 'permission denied')
c['rejected'](f"SET ROLE authenticated; SET request.jwt.claim.sub='{who}'; DELETE FROM follows WHERE follower_id='{who}';", 'permission denied')
checks = ['withdrawal revokes approval and removes edge', 'retry adds no audit', 'old approval cannot reactivate', 'spoofed actor and anonymous RPC refused', 'raw browser DELETE refused']

who, request_id = c['new_request']()
c['race'](f"SET ROLE service_role; SELECT decide_social_connection('{request_id}','{guardian}',true);", withdraw(who), 'withdraw_after_approval')
state(who, request_id)
checks.append('approval-first withdrawal observes real lock wait and removes committed edge')
who, request_id = c['new_request']()
try:
    c['race'](withdraw(who), f"SET ROLE service_role; SELECT decide_social_connection('{request_id}','{guardian}',true);", 'approval_after_withdraw')
except RuntimeError as error:
    assert 'SOCIAL_DECISION_CONFLICT' in str(error)
else:
    raise AssertionError('Approval resurrected withdrawn request')
state(who, request_id)
checks.append('withdrawal-first approval observes real lock wait and is refused')

who, request_id = c['new_request']()
assert c['decide'](request_id) == 'approved'
sql("""CREATE FUNCTION reject_withdrawal_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='social.unfollow' THEN RAISE EXCEPTION 'INJECTED_WITHDRAWAL_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER reject_withdrawal_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_withdrawal_audit();""", database)
c['rejected'](withdraw(who), 'INJECTED_WITHDRAWAL_AUDIT_FAILURE')
assert sql(f"SELECT status FROM social_connection_requests WHERE id='{request_id}'", database) == 'approved'
assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{who}' AND followed_id='{kid}'", database) == '1'
assert sql(f"SELECT count(*) FROM audit_logs WHERE action='social.connection_revoked' AND detail->>'request_id'='{request_id}'", database) == '0'
sql('DROP TRIGGER reject_withdrawal_audit ON audit_logs', database)
checks.append('failed edge audit rolls back prior revocation audit, request and edge')
# Replaying the migration preserves data and privileges.
sql((c['ROOT'] / 'database/migrations/0099_atomic_social_unfollow.sql').read_text(encoding='utf-8'), database)
assert sql(withdraw(who), database) == 't'
state(who, request_id)
checks.append('migration replay preserves withdrawal')
report = {'passed': True, 'database': database, 'migrationApplied': '0099', 'checks': checks, 'provenance': 'Actual migrations on fresh owned native PostgreSQL with minimal schemas; real lock waits, not full Supabase integration.'}
(c['ROOT'] / 'audit-results/s02-social-unfollow-postgres.json').write_bytes((json.dumps(report, indent=2)+'\n').encode('utf-8'))
print(json.dumps(report, indent=2))
