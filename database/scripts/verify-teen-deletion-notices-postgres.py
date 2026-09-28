"""GAP-FIX-R2 (owner review D-14 (b), E.6): a linked teen's self-deletion
notifies each verified Tutor, notify only, enforced by PostgreSQL.

Applies the ACTUAL migration chain to a fresh database on an owned native
PostgreSQL cluster, over the same minimal Supabase shim as the S07 verifiers.
It first shows the gap on the chain BEFORE teen_deletion_guardian_notices (a
linked teen's request writes nothing a Tutor could read), then applies the
migration and checks every population: a teen with two verified Tutors and one
pending link, an unlinked teen, an adult, a Tutor-initiated request; the
cancelled request that needs no second notice; the Tutor-only read; and the
erasure that takes the notices with the account.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_REPORT report path (default audit-results/gap-fix-r2-teen-deletion-notices-postgres.json)
"""
from pathlib import Path
import json
import os
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/gap-fix-r2-teen-deletion-notices-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
PART = next(m for m in MIGRATIONS if m.name.endswith('_teen_deletion_guardian_notices.sql'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
SHIM = (ROOT / 'database/scripts/verify-money-presentation-postgres.py').read_text(encoding='utf-8').split('SHIM = """', 1)[1].split('"""', 1)[0]


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def as_role(db, role, uid, query):
    claims = json.dumps({'role': role, **({'sub': uid} if uid else {})})
    out = sql(f"SELECT set_config('request.jwt.claims', '{claims}', false), set_config('request.jwt.claim.sub', '{uid or ''}', false), "
              f"set_config('request.jwt.claim.role', '{role}', false);\nSET ROLE {role};\n{query}", db)
    return '\n'.join(out.splitlines()[1:])


def service(db, query):
    return as_role(db, 'service_role', None, query)


def browser(db, uid, query):
    return as_role(db, 'authenticated', uid, query)


def refused(fn, token):
    try:
        fn()
    except RuntimeError as error:
        assert token in str(error), f'expected {token}, got {error}'
        return
    raise AssertionError(f'expected refusal {token}')


checks = []


def check(label):
    checks.append(label)


def request(db, subject, population='teen', initiated='self'):
    return json.loads(service(db, f"SELECT to_jsonb(public.request_account_deletion('{subject}', '{population}', '{initiated}', 14, '{subject}'))"))


def notices(db, guardian):
    return json.loads(service(db, f"SELECT public.guardian_deletion_notices('{guardian}')"))


def audits(db, subject):
    return int(sql(f"SELECT count(*) FROM public.audit_logs WHERE action = 'account.deletion_guardians_notified' AND subject = '{subject}'", db))


database = 'lf_teen_deletion_notices_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql(SHIM, database)
for migration in MIGRATIONS:
    if migration.name >= PART.name:
        break
    sql(migration.read_text(encoding='utf-8'), database)
db = database

ids = {name: str(uuid.uuid4()) for name in ['tutor_a', 'tutor_b', 'pending', 'teen', 'teen2', 'lone', 'adult']}
sql(f"""
INSERT INTO auth.users (id, is_anonymous) SELECT id::uuid, false FROM unnest(ARRAY['{"','".join(ids.values())}']) AS id;
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES
  ('{ids['tutor_a']}', 'adult'), ('{ids['tutor_b']}', 'adult'), ('{ids['pending']}', 'adult'), ('{ids['adult']}', 'adult'),
  ('{ids['teen']}', '13_to_17'), ('{ids['teen2']}', '13_to_17'), ('{ids['lone']}', '13_to_17');
UPDATE public.profiles SET display_name = 'Mateo', birth_date = current_date - interval '15 years' WHERE user_id = '{ids['teen']}';
UPDATE public.profiles SET display_name = 'Lucía', birth_date = current_date - interval '16 years' WHERE user_id = '{ids['teen2']}';
UPDATE public.profiles SET birth_date = current_date - interval '14 years' WHERE user_id = '{ids['lone']}';
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['tutor_a']}', 'parent'), ('{ids['tutor_b']}', 'parent'), ('{ids['pending']}', 'parent')
  ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
  ('{ids['tutor_a']}', '{ids['teen']}', 'verified', now()), ('{ids['tutor_b']}', '{ids['teen']}', 'verified', now()),
  ('{ids['tutor_a']}', '{ids['teen2']}', 'verified', now()), ('{ids['tutor_a']}', '{ids['adult']}', 'verified', now());
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status) VALUES ('{ids['pending']}', '{ids['teen']}', 'pending');
""", db)

before = request(db, ids['teen2'])
assert sql("SELECT count(*) FROM pg_tables WHERE tablename = 'account_deletion_guardian_notices'", db) == '0'
assert audits(db, ids['teen2']) == 0
service(db, f"SELECT public.cancel_account_deletion('{ids['teen2']}')")
check(f'the gap, reproduced before the migration: a linked teen\'s self-deletion request ({before["status"]}, 14 days) writes nothing a '
      f'Tutor could read and no notice audit row')

sql(PART.read_text(encoding='utf-8'), db)
teen, a, b = ids['teen'], ids['tutor_a'], ids['tutor_b']

row = request(db, teen)
written = sql(f"SELECT string_agg(guardian_user_id::text, ',' ORDER BY guardian_user_id) FROM public.account_deletion_guardian_notices "
              f"WHERE request_id = '{row['id']}'", db)
assert sorted(written.split(',')) == sorted([a, b]), written
assert audits(db, teen) == 1
detail = json.loads(sql(f"SELECT detail FROM public.audit_logs WHERE action = 'account.deletion_guardians_notified' AND subject = '{teen}'", db))
assert detail['guardians'] == 2 and detail['request_id'] == row['id'], detail
seen = notices(db, a)
assert len(seen) == 1 and seen[0]['display_name'] == 'Mateo' and seen[0]['teen_user_id'] == teen, seen
assert set(seen[0]) == {'id', 'teen_user_id', 'display_name', 'scheduled_for', 'notified_at'}, seen
assert notices(db, ids['pending']) == []
check('D-14 (b): a linked teen\'s self-deletion writes one notice per verified Tutor (two) and one audit row '
      'account.deletion_guardians_notified {guardians: 2}, in the request\'s transaction; a pending link is not told; the Tutor\'s read '
      'carries only the display name, the scheduled date and when they were told (no reason, no action)')

for who, population in [(ids['lone'], 'teen'), (ids['adult'], 'adult')]:
    r = request(db, who, population)
    assert sql(f"SELECT count(*) FROM public.account_deletion_guardian_notices WHERE request_id = '{r['id']}'", db) == '0'
    assert audits(db, who) == 0
check('D-14 (a): an unlinked teen notifies nobody; an adult\'s own deletion is reported to nobody, even with a stale link')

assert browser(db, a, f"SELECT count(*) FROM public.account_deletion_guardian_notices") == '1'
assert browser(db, b, f"SELECT count(*) FROM public.account_deletion_guardian_notices") == '1'
assert browser(db, teen, f"SELECT count(*) FROM public.account_deletion_guardian_notices") == '0'
assert browser(db, ids['pending'], f"SELECT count(*) FROM public.account_deletion_guardian_notices") == '0'
refused(lambda: browser(db, a, f"INSERT INTO public.account_deletion_guardian_notices (request_id, teen_user_id, guardian_user_id) "
                               f"VALUES ('{row['id']}', '{teen}', '{ids['pending']}')"), 'permission denied')
refused(lambda: browser(db, a, f"DELETE FROM public.account_deletion_guardian_notices"), 'permission denied')
refused(lambda: browser(db, a, f"SELECT public.guardian_deletion_notices('{a}')"), 'permission denied')
check('RLS: each Tutor reads only their own notice; the teen and a pending adult read none; no browser role writes, deletes or calls '
      'the read function')

service(db, f"SELECT public.cancel_account_deletion('{teen}')")
assert notices(db, a) == [] and notices(db, b) == []
assert audits(db, teen) == 1
assert sql(f"SELECT count(*) FROM public.account_deletion_guardian_notices WHERE teen_user_id = '{teen}'", db) == '2'
check('a cancelled deletion needs no second notice: the open notice drops out of the Tutor\'s read and nothing new is written')

again = request(db, teen)
assert len(notices(db, a)) == 1 and audits(db, teen) == 2
sql(f"UPDATE public.account_deletion_requests SET status = 'processing', started_at = now() WHERE id = '{again['id']}'", db)
sql(f"DELETE FROM public.guardian_links WHERE kid_user_id = '{teen}'", db)
sql(f"DELETE FROM auth.users WHERE id = '{teen}'", db)
assert sql(f"SELECT count(*) FROM public.account_deletion_guardian_notices WHERE teen_user_id = '{teen}'", db) == '0'
check('a new request after a cancel is a new deletion and tells the Tutors again; the erasure (auth.users removed) takes the teen\'s '
      'notices with the account')

sql(PART.read_text(encoding='utf-8'), db)
assert sql("SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notify_guardians_of_teen_deletion'", db) == '1'
check('replay: applying the migration again keeps one trigger and every guard')

report = {
    'passed': True,
    'database': db,
    'migration': PART.name,
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim; the gap shown on the chain '
                  'before the migration, then the same database upgraded in place; browser roles exercised through SET ROLE with '
                  'request.jwt claims. The erasure is modelled by removing the auth.users row, as erase_account_data does last. Does not '
                  'replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
