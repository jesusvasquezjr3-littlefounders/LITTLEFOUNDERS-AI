"""GAP-FIX-R2 (owner review H-25, D.22): a young adult whose Tutor's research
yes lapsed at 18 can answer for themselves, enforced by PostgreSQL.

Applies the ACTUAL migration chain to a fresh database on an owned native
PostgreSQL cluster, over the same minimal Supabase shim as the S07 verifiers.
It first reproduces the gap on the chain BEFORE family_research_reconsent_at_18
(a self-registered teen linked to a Tutor, enrolled by that Tutor, turns 18,
stops being a wallet holder and is refused their own yes), then applies the
migration to the same database and checks every population: the young adult's
yes replaces the lapsed row and keeps the history; their no deletes it; an
adult with no lapsed consent, a Tutor answering for an 18-year-old, a
17-year-old answering for themselves and a guest are still refused.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_REPORT report path (default audit-results/gap-fix-r2-research-reconsent-postgres.json)
  LF_PG_FULL_CHAIN=1  also apply every later migration, so a later
               redefinition must keep these checks true (family-db-verify.mjs sets it)
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
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/gap-fix-r2-research-reconsent-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
PART = next(m for m in MIGRATIONS if m.name.endswith('_family_research_reconsent_at_18.sql'))
LATER = [m for m in MIGRATIONS if m.name > PART.name] if os.environ.get('LF_PG_FULL_CHAIN') == '1' else []
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
SHIM = (ROOT / 'database/scripts/verify-money-presentation-postgres.py').read_text(encoding='utf-8').split('SHIM = """', 1)[1].split('"""', 1)[0]


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def service(db, query):
    claims = json.dumps({'role': 'service_role'})
    out = sql(f"SELECT set_config('request.jwt.claims', '{claims}', false), set_config('request.jwt.claim.role', 'service_role', false);\n"
              f'SET ROLE service_role;\n{query}', db)
    return '\n'.join(out.splitlines()[1:])


def fixture(db, query):
    sql('SET session_replication_role = replica;\n' + query, db)


def refused(fn, token):
    try:
        fn()
    except RuntimeError as error:
        assert token in str(error), f'expected {token}, got {error}'
        return
    raise AssertionError(f'expected refusal {token}')


def consent(db, subject, actor, participate=True, version=1):
    return json.loads(service(db, f"SELECT public.family_research_set_consent('{subject}', '{actor}', {str(participate).lower()}, {version})"))


def state(db, subject):
    return json.loads(service(db, f"SELECT public.family_research_state('{subject}')"))


checks = []


def check(label):
    checks.append(label)


database = 'lf_research_reconsent_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql(SHIM, database)
for migration in MIGRATIONS:
    if migration.name >= PART.name:
        break
    sql(migration.read_text(encoding='utf-8'), database)
db = database

ids = {name: str(uuid.uuid4()) for name in ['tutor', 'teen', 'teen17', 'adult', 'guest']}
sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES ('{ids['tutor']}', false), ('{ids['teen']}', false), ('{ids['teen17']}', false),
  ('{ids['adult']}', false), ('{ids['guest']}', true);
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES ('{ids['tutor']}', 'adult'), ('{ids['teen']}', '13_to_17'),
  ('{ids['teen17']}', '13_to_17'), ('{ids['adult']}', 'adult'), ('{ids['guest']}', '13_to_17');
UPDATE public.profiles SET birth_date = current_date - interval '17 years 300 days' WHERE user_id IN ('{ids['teen']}', '{ids['teen17']}');
UPDATE public.profiles SET birth_date = current_date - interval '30 years' WHERE user_id = '{ids['adult']}';
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['tutor']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
  ('{ids['tutor']}', '{ids['teen']}', 'verified', now()), ('{ids['tutor']}', '{ids['teen17']}', 'verified', now());
""", db)
teen, tutor = ids['teen'], ids['tutor']

enrolled = consent(db, teen, tutor)
assert enrolled['admitted'] and enrolled['grantor'] == 'tutor', enrolled
assert consent(db, ids['teen17'], tutor)['admitted']
fixture(db, f"""
INSERT INTO public.family_research_snapshots (research_id, period, tenure_months, autonomy_level, coins_received, coins_to_save, coins_spent,
  coins_given, goals_reached, next_goals_set, chores_approved, rewards_asked, rewards_not_yet, practised_days, split_changed, bridge_entries)
  SELECT research_id, (date_trunc('month', now()) - interval '2 months')::date, 3, 2, 10, 6, 3, 1, 1, 0, 2, 1, 0, 8, false, 0
  FROM public.family_research_participants WHERE subject_user_id = '{teen}';
""")
assert state(db, teen)['snapshots'] == 1
check('setup: a self-registered teen linked to a verified Tutor, enrolled by the Tutor at 17 (admitted, grantor tutor), one month recorded')

sql(f"UPDATE public.profiles SET birth_date = current_date - interval '18 years 2 days' WHERE user_id = '{teen}'", db)
lapsed = state(db, teen)
assert lapsed['participating'] and lapsed['grantor'] == 'tutor' and lapsed['adult'] and not lapsed['admitted'], lapsed
assert service(db, f"SELECT public.wallet_holder_kind('{teen}') IS NULL") == 't'
refused(lambda: consent(db, teen, teen), 'RESEARCH_CONSENT_NOT_ALLOWED')
check('the gap, reproduced before the migration: at 18 the Tutor\'s yes lapses (participating, grantor tutor, adult, not recorded), '
      'the young adult is no longer a wallet holder, and their own yes is refused RESEARCH_CONSENT_NOT_ALLOWED')

for migration in [PART, *LATER]:
    sql(migration.read_text(encoding='utf-8'), db)

refused(lambda: consent(db, teen, tutor), 'RESEARCH_CONSENT_NOT_ALLOWED')
refused(lambda: consent(db, ids['teen17'], ids['teen17']), 'RESEARCH_CONSENT_NOT_ALLOWED')
refused(lambda: consent(db, ids['adult'], ids['adult']), 'RESEARCH_CONSENT_NOT_ALLOWED')
refused(lambda: consent(db, ids['guest'], ids['guest']), 'RESEARCH_CONSENT_NOT_ALLOWED')
refused(lambda: consent(db, teen, teen, True, 0), 'RESEARCH_DISCLOSURE_STALE')
check('still refused after the migration: the Tutor answering for the 18-year-old, a 17-year-old answering for themselves, an adult '
      'with no lapsed consent and no wallet, a guest; a yes on an older disclosure is RESEARCH_DISCLOSURE_STALE')

joined = consent(db, teen, teen)
assert joined['participating'] and joined['grantor'] == 'self' and joined['snapshots'] == 1 and not joined['admitted'], joined
rows = sql(f"SELECT string_agg(grantor_kind || ':' || (revoked_at IS NULL) || ':' || (coalesce(revoked_by, granted_by) = '{teen}'), ',' "
           f"ORDER BY granted_at, revoked_at NULLS LAST) FROM public.family_research_consents WHERE subject_user_id = '{teen}'", db)
assert rows == 'tutor:false:true,self:true:true', rows
again = consent(db, teen, teen)
assert again['grantor'] == 'self' and sql(f"SELECT count(*) FROM public.family_research_consents WHERE subject_user_id = '{teen}'", db) == '2'
check(f'H-25: the young adult\'s own yes replaces the lapsed Tutor row (revoked by the young adult) with a self grant and keeps the '
      f'month recorded as a child (consent rows grantor:active:by-self = {rows}); recording stays off without a wallet (a later '
      f'phase\'s disclosure); a repeated yes to the same disclosure changes nothing and never revives the Tutor\'s row')

stopped = consent(db, teen, teen, False)
assert not stopped['participating'] and stopped['snapshots'] == 0, stopped
assert sql(f"SELECT count(*) FROM public.family_research_participants WHERE subject_user_id = '{teen}'", db) == '0'
check('the young adult\'s no withdraws the consent and deletes every snapshot at once')

report = {
    'passed': True,
    'database': db,
    'migration': PART.name,
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim; the gap reproduced on the '
                  'chain before the migration, then the same database upgraded in place; backdated snapshots written as fixtures with '
                  'triggers bypassed. Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
