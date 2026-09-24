"""E.1 approved visibility and revocation against real PostgreSQL functions."""
from pathlib import Path
import json
import runpy
import sys

c = runpy.run_path(str(Path(__file__).with_name('verify-social-decisions-postgres.py')))
sql, database, kid, guardian = c['sql'], c['database'], c['first'], c['second']
for name in ['0098_atomic_social_blocks.sql', '0099_atomic_social_unfollow.sql']:
    sql((c['ROOT'] / 'database/migrations' / name).read_text(encoding='utf-8'), database)
source = 'database/scripts/fixtures/social-discovery-candidate.sql' if '--candidate' in sys.argv else 'database/migrations/0100_approved_social_visibility.sql'
sql((c['ROOT'] / source).read_text(encoding='utf-8'), database)
sql("UPDATE guardian_links SET verification_status='verified'", database)

def visible(viewer):
    return sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{viewer}'; SELECT social_subject_visible('{kid}');", database) == 't'
def approval(viewer):
    return c['service'](f"SELECT has_current_social_approval('{viewer}','{kid}');") == 't'

who, request_id = c['new_request']()
assert not visible(who) and not approval(who)
assert c['decide'](request_id) == 'approved'
assert visible(who) and approval(who)
assert sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{who}'; SELECT count(*) FROM follows WHERE followed_id='{kid}';", database) == '1'
other, other_id = c['new_request']()
assert not visible(other) and not approval(other)
c['rejected'](f"SET ROLE authenticated; SET request.jwt.claim.sub='{other}'; SELECT has_current_social_approval('{who}','{kid}');", 'permission denied')
c['rejected'](f"SET ROLE anon; SELECT social_subject_visible('{kid}');", 'permission denied')
checks = ['pending confers no visibility', 'approved active edge grants profile and RLS visibility', 'approval is pair-specific', 'browser cannot query arbitrary approval pairs', 'anonymous visibility function refused']

sql("UPDATE guardian_links SET verification_status='revoked'", database)
assert not visible(who) and not approval(who)
sql("UPDATE guardian_links SET verification_status='verified'", database)
assert visible(who)
checks.append('current guardian-link revocation hides approved relationship')
sql(f"UPDATE user_roles SET role='universal' WHERE user_id='{guardian}'", database)
assert not visible(who) and not approval(who)
sql(f"UPDATE user_roles SET role='parent' WHERE user_id='{guardian}'", database)
assert visible(who)
checks.append('guardian parent-role loss hides approved relationship')
sql(f"INSERT INTO parent_verifications(user_id,status,method,birth_date) VALUES ('{guardian}','revoked','local-ocr','1990-01-01');", database)
assert not visible(who) and not approval(who)
sql("DELETE FROM parent_verifications WHERE status='revoked'", database)
assert visible(who)
checks.append('latest revoked identity evidence defeats an older adult verification')

# A trusted maintenance delete cannot leave the approval alone granting visibility.
c['service'](f"DELETE FROM follows WHERE follower_id='{who}' AND followed_id='{kid}';")
assert not visible(who) and not approval(who)
checks.append('approved receipt without active edge confers no visibility')

who, request_id = c['new_request']()
assert c['decide'](request_id) == 'approved'
assert visible(who)
sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{who}'; SELECT withdraw_social_connection('{who}','{kid}');", database)
assert not visible(who) and not approval(who)
checks.append('withdrawal removes visibility')
who, request_id = c['new_request']()
assert c['decide'](request_id) == 'approved'
sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; INSERT INTO blocks VALUES ('{kid}','{who}');", database)
assert not visible(who) and not approval(who)
sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{kid}'; DELETE FROM blocks WHERE blocker_id='{kid}' AND blocked_id='{who}';", database)
assert not visible(who) and not approval(who)
checks.append('block and subsequent unblock do not restore visibility')
sql((c['ROOT'] / source).read_text(encoding='utf-8'), database)
assert not visible(who)
checks.append('migration replay preserves revocation')
report = {'passed': True, 'database': database, 'source': source, 'checks': checks, 'provenance': 'Actual SQL on fresh native PostgreSQL minimal fixtures; full Supabase and Core/UI activation remain separate gates.'}
(c['ROOT'] / 'audit-results/s02-social-discovery-postgres.json').write_bytes((json.dumps(report, indent=2)+'\n').encode('utf-8'))
print(json.dumps(report, indent=2))
