"""Competing current guardians must produce exactly one terminal social decision."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import runpy
import uuid

c = runpy.run_path(str(Path(__file__).with_name('verify-social-decisions-postgres.py')))
sql, database, kid, guardian = c['sql'], c['database'], c['first'], c['second']
for name in ['0098_atomic_social_blocks.sql', '0099_atomic_social_unfollow.sql', '0100_approved_social_visibility.sql']:
    sql((c['ROOT'] / 'database/migrations' / name).read_text(encoding='utf-8'), database)
sql("UPDATE guardian_links SET verification_status='verified'", database)
other = str(uuid.uuid4())
sql(f"""INSERT INTO auth.users VALUES ('{other}');
INSERT INTO user_roles VALUES ('{other}','parent');
INSERT INTO parent_verifications(user_id,status,method,birth_date) VALUES ('{other}','verified','local-ocr','1990-01-01');
INSERT INTO guardian_links VALUES ('{other}','{kid}','verified');""", database)
checks=[]
for first_guardian, second_guardian, approved in [(guardian, other, True), (other, guardian, False)]:
    who, request_id = c['new_request']()
    try:
        c['race'](f"SET ROLE service_role; SELECT decide_social_connection('{request_id}','{first_guardian}',{str(approved).lower()});", f"SET ROLE service_role; SELECT decide_social_connection('{request_id}','{second_guardian}',{str(not approved).lower()});", 'competing_guardian')
    except RuntimeError as error:
        assert 'SOCIAL_DECISION_CONFLICT' in str(error)
    else:
        raise AssertionError('Opposite second decision changed terminal state')
    expected = 'approved' if approved else 'denied'
    assert sql(f"SELECT status FROM social_connection_requests WHERE id='{request_id}'", database) == expected
    assert sql(f"SELECT decided_by FROM social_connection_requests WHERE id='{request_id}'", database) == first_guardian
    assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{who}' AND followed_id='{kid}'", database) == ('1' if approved else '0')
    assert sql(f"SELECT count(*) FROM audit_logs WHERE action IN ('social.connection_approved','social.connection_denied') AND detail->>'request_id'='{request_id}'", database) == '1'
    checks.append(f'{expected} first: opposite guardian waits and conflicts without duplicate decision or wrong actor')

who, request_id = c['new_request']()
with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda index: c['decide'](request_id, guardian=guardian if index % 2 else other), range(8)))
assert results == ['approved'] * 8
assert sql(f"SELECT count(*) FROM audit_logs WHERE action='social.connection_approved' AND detail->>'request_id'='{request_id}'", database) == '1'
assert sql(f"SELECT count(*) FROM follows WHERE follower_id='{who}' AND followed_id='{kid}'", database) == '1'
checks.append('eight concurrent same-outcome decisions across two guardians produce one edge and audit')
# Revoking a different guardian must not rewrite attribution or invalidate this decision.
decider = sql(f"SELECT decided_by FROM social_connection_requests WHERE id='{request_id}'", database)
unrelated = other if decider == guardian else guardian
sql(f"UPDATE guardian_links SET verification_status='revoked' WHERE parent_user_id='{unrelated}'", database)
assert c['service'](f"SELECT has_current_social_approval('{who}','{kid}')") == 't'
sql(f"UPDATE guardian_links SET verification_status='revoked' WHERE parent_user_id='{decider}'", database)
assert c['service'](f"SELECT has_current_social_approval('{who}','{kid}')") == 'f'
checks.append('visibility follows the actual deciding guardian, not another linked guardian')
report={'passed':True,'database':database,'checks':checks,'provenance':'Actual migrations through 0100 on fresh native PostgreSQL; observed conflicting-decision lock waits and concurrent same-outcome calls. Does not prove arbitrary multi-operation deadlock freedom.'}
(c['ROOT']/'audit-results/s02-social-multi-guardian-postgres.json').write_bytes((json.dumps(report,indent=2)+'\n').encode('utf-8'))
print(json.dumps(report,indent=2))
