"""D.6 and D.12 (S07.6): the staff family-engagement insight on the per-child
shape with its uptime record, and the age register of every Family Hub and
Wallet surface (formerly Digital Banking, OD-28), enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to fresh databases on an owned native PostgreSQL cluster, over the same
minimal Supabase shim as the S07.1-S07.5 verifiers. It first reproduces the
D.6 defect on the chain BEFORE the S07.6 parts (the view is per child, so the
per-family keys Core parsed do not exist), then upgrades that same database
through the S07.6 parts and checks the result against every population: a
parent-created child with no birth date, at 7, 9, 10, 12 and 13 (the A.2
under-13 origin marker set where a Tutor gave an under-13 date), an 18-year-old
still in a family, an independent teen, a teen who linked a Tutor, an adult, a
guest, the verified Tutor and an unrelated parent, through the browser roles
and through the service role.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-money-presentation-postgres.json)
"""
from pathlib import Path
import json
import os
import re
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-money-presentation-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_6_PARTS = ['_family_money_register.sql', '_family_engagement_insight.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_6_PARTS]
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
UUID_TEXT = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
CHILD_KEYS = ['first_link_on', 'guardians', 'last_task_on', 'tasks_approved', 'tasks_created']
SUMMARY_KEYS = ['active_children', 'active_days', 'children', 'children_with_tasks', 'listed_children', 'tasks_approved', 'tasks_created']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')

SHIM = """
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
                         is_anonymous boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""


def fresh(upto):
    database = 'lf_money_presentation_' + uuid.uuid4().hex
    sql(f'CREATE DATABASE {database}')
    sql(SHIM, database)
    for migration in MIGRATIONS:
        if migration.name > upto.name:
            break
        sql(migration.read_text(encoding='utf-8'), database)
    return database


# LF_PG_FULL_CHAIN=1 applies every later migration after these parts, so each
# check also runs over the WHOLE chain (a later checkpoint that redefines a
# guard or a trigger must keep these checks true).
FULL_CHAIN = os.environ.get('LF_PG_FULL_CHAIN') == '1'
LATER = [m for m in MIGRATIONS if m.name > PARTS[-1].name] if FULL_CHAIN else []
TARGET = MIGRATIONS[-1] if FULL_CHAIN else PARTS[-1]


def apply_parts(database):
    for part in [*PARTS, *LATER]:
        sql(part.read_text(encoding='utf-8'), database)


def claims(uid, role):
    body = json.dumps({'role': role, **({'sub': uid} if uid else {})})
    return (f"SELECT set_config('request.jwt.claims', '{body}', false), "
            f"set_config('request.jwt.claim.sub', '{uid or ''}', false), "
            f"set_config('request.jwt.claim.role', '{role}', false);\n")


def as_role(db, role, uid, query):
    out = sql(claims(uid, role) + f'SET ROLE {role};\n' + query, db)
    return '\n'.join(out.splitlines()[1:])


def browser(db, uid, query):
    return as_role(db, 'authenticated', uid, query)


def service(db, query):
    return as_role(db, 'service_role', None, query)


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


# Parent-created children: kid_nodob (no birth date), kid7, kid9, kid10, kid12,
# kid13 and kid18 (still in the family at 18). Those whose Tutor gave an
# under-13 date carry the A.2 under-13 origin marker, exactly as Core writes it.
# teen: independent. teen_l: a self-registered teen who linked the Tutor later.
KIDS = {'kid_nodob': None, 'kid7': '7 years 3 days', 'kid9': '9 years 360 days', 'kid10': '10 years 1 day',
        'kid12': '12 years 300 days', 'kid13': '13 years 1 day', 'kid18': '18 years 2 days'}
UNDER13 = ['kid_nodob', 'kid7', 'kid9', 'kid10', 'kid12']
POPULATIONS = [*KIDS, 'teen', 'teen_l', 'adult', 'guest', 'parent_a', 'stranger']


def people(db):
    ids = {name: str(uuid.uuid4()) for name in POPULATIONS}
    rows = ','.join(f"('{v}', {'true' if k == 'guest' else 'false'})" for k, v in ids.items())
    bands = {**{k: ('under_13' if k in UNDER13 else '13_to_17') for k in KIDS},
             'teen': '13_to_17', 'teen_l': '13_to_17', 'guest': '13_to_17', 'adult': 'adult', 'parent_a': 'adult', 'stranger': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    births = '\n'.join(f"UPDATE public.profiles SET birth_date = current_date - interval '{age}' WHERE user_id = '{ids[k]}';"
                       for k, age in KIDS.items() if age)
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
INSERT INTO public.account_safety_origins (user_id) VALUES {','.join(f"('{ids[k]}')" for k in UNDER13)};
{births}
UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id IN ('{ids['teen']}', '{ids['teen_l']}');
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['parent_a']}', 'parent'), ('{ids['stranger']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES {','.join(f"('{ids['parent_a']}', '{ids[k]}', 'verified', now())" for k in KIDS)};
INSERT INTO public.user_roles (user_id, role) VALUES {','.join(f"('{ids[k]}', 'kid')" for k in KIDS)} ON CONFLICT DO NOTHING;
""", db)
    return ids


def link_teen(db, teen, parent):
    token = f'teen-{uuid.uuid4().hex}'
    service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{teen}', '{teen}', '{token}', now() + interval '7 days')")
    service(db, f"SELECT public.accept_guardian_invite('{token}', '{parent}')")
    link = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{parent}' AND kid_user_id = '{teen}'")
    assert service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen}', true)") == 'verified'


def chore(db, parent, kid, approve=False, days_ago=0):
    tid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins) VALUES ('{tid}', '{parent}', '{kid}', 'Chore', 3)")
    if approve:
        service(db, f"SELECT public.family_task_mark_done('{tid}', '{kid}', NULL, NULL)")
        service(db, f"SELECT public.family_decide_task('{tid}', '{parent}', 'approved', NULL, NULL)")
    if days_ago:
        # Backdating a creation time is fixture setup, not a product write, so the
        # superuser does it with the row triggers bypassed.
        sql(f"SET session_replication_role = replica; UPDATE public.tasks SET created_at = now() - interval '{days_ago} days' WHERE id = '{tid}';", db)
    return tid


def register(db, who):
    return service(db, f"SELECT coalesce(public.family_money_register('{who}'), 'none')")


def framing(db, who):
    return service(db, f"SELECT coalesce(public.savings_bonus_framing('{who}'), 'none')")


def insight(db, limit=100, active=30):
    return json.loads(service(db, f'SELECT public.family_engagement_insight({limit}, {active})'))


# ── 1. Reproduce the D.6 defect on the chain BEFORE this checkpoint ──────────
db = fresh(MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1])
columns = sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns "
              "WHERE table_schema = 'public' AND table_name = 'insights_family_engagement'", db).split(',')
assert columns == ['kid_user_id', 'first_guardian_link_at', 'guardians', 'tasks_created', 'tasks_approved', 'last_task_at'], columns
legacy_keys = ['family_id', 'family_created_at', 'members', 'tasks_completed']
assert not any(key in columns for key in legacy_keys)
assert sql("SELECT to_regprocedure('public.family_money_register(uuid)') IS NULL", db) == 't'
check('D.6 reproduced on the chain before S07.6: the view is per child (kid_user_id, first_guardian_link_at, guardians, tasks_created, '
      'tasks_approved, last_task_at) and has none of the per-family keys Core parsed (family_id, family_created_at, members, '
      'tasks_completed), so every row failed Core validation and the endpoint answered "Family views unreachable". D.12 reproduced: '
      'no register exists, so every child saw the same presentation')

ids = people(db)
link_teen(db, ids['teen_l'], ids['parent_a'])
apply_parts(db)

# ── 2. D.12: the register is decided by age evidence, never role ─────────────
expected = {'kid_nodob': 'young', 'kid7': 'young', 'kid9': 'young', 'kid10': 'transition', 'kid12': 'transition', 'kid13': 'teen',
            'kid18': 'teen', 'teen': 'teen', 'teen_l': 'teen', 'adult': 'none', 'guest': 'none', 'parent_a': 'none', 'stranger': 'none'}
actual = {name: register(db, ids[name]) for name in expected}
assert actual == expected, actual
assert service(db, 'SELECT coalesce(public.family_money_register(NULL), \'none\')') == 'none'
check('D.12 register by age: no birth date, 7 and 9 read "young"; 10 and 12 "transition"; 13, 18, an independent teen and a linked teen '
      '"teen"; an adult, a guest, the Tutor and an unrelated parent have no register (no wallet); NULL has none')

# One coherent age-band design with D.11: the teen register is exactly the
# percentage framing, and no register exists without a framing.
for name in expected:
    r, f = register(db, ids[name]), framing(db, ids[name])
    assert (r == 'teen') == (f == 'percent'), (name, r, f)
    assert (r == 'none') == (f == 'none'), (name, r, f)
check('D.12 and D.11 are one design: for every population the teen register is exactly the percentage bonus framing, young and '
      'transition are exactly the per-ten framing, and there is no register without a framing')

# Birthdays move the register with no stored state, and a role never does.
sql(f"UPDATE public.profiles SET birth_date = current_date - interval '10 years' WHERE user_id = '{ids['kid9']}'", db)
assert register(db, ids['kid9']) == 'transition'
sql(f"UPDATE public.profiles SET birth_date = current_date - interval '13 years' WHERE user_id = '{ids['kid12']}'", db)
assert register(db, ids['kid12']) == 'teen'
sql(f"UPDATE public.profiles SET birth_date = current_date - interval '11 years' WHERE user_id = '{ids['kid_nodob']}'", db)
assert register(db, ids['kid_nodob']) == 'transition'
sql(f"INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['adult']}', 'parent') ON CONFLICT DO NOTHING", db)
assert register(db, ids['adult']) == 'none'
check('D.12 register follows the birth date at read time: a 10th birthday moves "young" to "transition", a 13th moves "transition" to '
      '"teen", a Tutor adding a birth date of 11 moves an unknown-age child to "transition"; granting an adult a role gives no register')

distribution = service(db, "SELECT string_agg(register || '=' || holders, ',' ORDER BY register) FROM public.family_money_register_distribution()")
assert distribution == 'teen=5,transition=3,young=1', distribution
check(f'Appendix H (threshold log, D.12): the register distribution counts wallet holders per register ({distribution}), counts only')

for fn in ['family_money_register(NULL::uuid)', 'family_money_register_distribution()']:
    refused(lambda fn=fn: browser(db, ids['kid9'], f'SELECT public.{fn}'), 'permission denied')
    refused(lambda fn=fn: as_role(db, 'anon', None, f'SELECT public.{fn}'), 'permission denied')
check('D.12: a browser session (a child, anon) cannot call the register or the distribution; only the service role (Core) reads them')

# ── 3. D.6: the insight on the per-child shape ──────────────────────────────
parent = ids['parent_a']
sql(f"""
INSERT INTO public.analytics_consents (kid_user_id, granted_by) VALUES ('{ids['kid13']}', '{parent}'), ('{ids['kid7']}', '{parent}'),
  ('{ids['kid18']}', '{parent}');
INSERT INTO public.teen_analytics_preferences (user_id, enabled, disclosure_version) VALUES ('{ids['teen_l']}', true, 1), ('{ids['teen']}', true, 1);
""", db)
for _ in range(3):
    chore(db, parent, ids['kid13'], approve=True)
chore(db, parent, ids['kid13'])
chore(db, parent, ids['kid7'], approve=True)
chore(db, parent, ids['kid10'], approve=True)
chore(db, parent, ids['teen_l'], approve=True, days_ago=40)
chore(db, parent, ids['kid18'], days_ago=45)

answer = insight(db)
summary, children = answer['summary'], answer['children']
assert sorted(answer) == ['children', 'summary']
assert sorted(summary) == SUMMARY_KEYS, sorted(summary)
# Linked children: the 7 parent-created + teen_l = 8. With tasks: kid13, kid7, kid10, teen_l, kid18 = 5.
assert summary['children'] == 8 and summary['children_with_tasks'] == 5, summary
assert summary['tasks_created'] == 8 and summary['tasks_approved'] == 6, summary
assert summary['active_children'] == 3 and summary['active_days'] == 30, summary
# Admitted: kid13 (consent), kid18 (consent, adult band), teen_l (own opt-in). kid7 has consent but carries the
# under-13 origin marker, so the H.1 gate never admits it; kid10 has no consent; teen is not linked (not in the view).
assert summary['listed_children'] == 3 and len(children) == 3, answer
assert all(sorted(c) == CHILD_KEYS for c in children), children
assert [c['tasks_created'] for c in children] == [4, 1, 1], children
assert [c['tasks_approved'] for c in children] == [3, 1, 0], children
assert children[0]['guardians'] == 1 and re.fullmatch(r'\d{4}-\d{2}-\d{2}', children[0]['last_task_on'])
assert not UUID_TEXT.search(json.dumps(answer)), 'the insight carries an identity'
check('D.6 insight on the per-child shape: the summary counts every child with a verified Tutor (8 children, 5 with chores, 8 chores, 6 '
      'approved, 3 active in 30 days); the per-child rows (guardians, chores created and approved, first link and last chore by day) '
      'list only the 3 children the H.1 gate admits, newest first, and the answer carries no child or Tutor id')

sql(f"UPDATE public.analytics_consents SET revoked_at = now() WHERE kid_user_id = '{ids['kid13']}'", db)
after = insight(db)
assert after['summary']['listed_children'] == 2 and after['summary']['children'] == 8, after['summary']
sql(f"UPDATE public.analytics_consents SET revoked_at = NULL WHERE kid_user_id = '{ids['kid13']}'", db)
assert insight(db, limit=1)['summary']['listed_children'] == 1
for bad in ['0, 30', '501, 30', '10, 0', '10, 366', 'NULL, 30']:
    refused(lambda bad=bad: service(db, f'SELECT public.family_engagement_insight({bad})'), 'ENGAGEMENT_INSIGHT_BOUNDS')
check('D.6: revoking the Tutor\'s analytics consent removes that child\'s row at once while the population count stays; the limit is '
      'honoured; out-of-range limits and windows are refused (ENGAGEMENT_INSIGHT_BOUNDS)')

# ── 4. D.6 uptime: the record and the nightly probe ─────────────────────────
for fn in ['family_engagement_insight(10, 30)', "record_staff_insight_check('family_engagement', 'request', 'ok')",
           'probe_family_engagement_insight(400)', "staff_insight_uptime('family_engagement', now())"]:
    refused(lambda fn=fn: browser(db, parent, f'SELECT public.{fn}'), 'permission denied')
    refused(lambda fn=fn: as_role(db, 'anon', None, f'SELECT public.{fn}'), 'permission denied')
for query in ['SELECT count(*) FROM public.staff_insight_checks',
              "INSERT INTO public.staff_insight_checks (insight, source, outcome) VALUES ('family_engagement', 'request', 'ok')"]:
    refused(lambda query=query: browser(db, parent, query), 'permission denied')
    refused(lambda query=query: service(db, query), 'permission denied')
refused(lambda: service(db, "SELECT public.record_staff_insight_check('family_engagement', 'request', 'fine')"), 'staff_insight_checks_outcome_check')
refused(lambda: service(db, "SELECT public.record_staff_insight_check('other', 'request', 'ok')"), 'staff_insight_checks_insight_check')
check('D.6 uptime record resists every writer: no browser or anon session calls the insight, the recorder, the probe or the uptime; '
      'no browser or service-role session reads or writes the table directly; the recorder refuses an outcome or insight outside the '
      'closed vocabulary')

service(db, "SELECT public.record_staff_insight_check('family_engagement', 'request', 'ok')")
service(db, "SELECT public.record_staff_insight_check('family_engagement', 'request', 'shape_mismatch')")
assert service(db, 'SELECT public.probe_family_engagement_insight(400)') == 'ok'

probe_db = fresh(TARGET)
assert service(probe_db, 'SELECT public.probe_family_engagement_insight(400)') == 'ok'
sql("""CREATE OR REPLACE FUNCTION public.family_engagement_insight(p_limit int DEFAULT 100, p_active_days int DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('families', '[]'::jsonb) $$;""", probe_db)
assert service(probe_db, 'SELECT public.probe_family_engagement_insight(400)') == 'shape_mismatch'
sql("DROP VIEW public.insights_family_engagement CASCADE;", probe_db)
sql("""CREATE OR REPLACE FUNCTION public.family_engagement_insight(p_limit int DEFAULT 100, p_active_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$ BEGIN RETURN (SELECT to_jsonb(e) FROM public.insights_family_engagement e LIMIT 1); END $$;""", probe_db)
assert service(probe_db, 'SELECT public.probe_family_engagement_insight(400)') == 'unavailable'
sql("SET session_replication_role = replica; INSERT INTO public.staff_insight_checks (insight, source, outcome, checked_at) "
    "VALUES ('family_engagement', 'probe', 'ok', now() - interval '500 days');", probe_db)
assert sql("SELECT count(*) FROM public.staff_insight_checks WHERE checked_at < now() - interval '400 days'", probe_db) == '1'
service(probe_db, 'SELECT public.probe_family_engagement_insight(400)')
assert sql("SELECT count(*) FROM public.staff_insight_checks WHERE checked_at < now() - interval '400 days'", probe_db) == '0'
probe_outcomes = sql("SELECT string_agg(outcome, ',' ORDER BY id) FROM public.staff_insight_checks", probe_db)
assert probe_outcomes == 'ok,shape_mismatch,unavailable,unavailable', probe_outcomes
check('D.6 nightly probe: "ok" on the real insight; "shape_mismatch" when the insight answers without the contract keys (the D.6 '
      'failure mode); "unavailable" when the view under it is gone; it prunes checks older than 400 days and keeps the rest')

uptime = service(db, "SELECT string_agg(source || '=' || checks || '/' || ok || '/' || last_outcome, ',' ORDER BY source) "
                     "FROM public.staff_insight_uptime('family_engagement', now() - interval '1 day')")
assert uptime == 'probe=1/1/ok,request=2/1/shape_mismatch', uptime
empty = service(db, "SELECT string_agg(source || '=' || checks || '/' || ok, ',' ORDER BY source) "
                    "FROM public.staff_insight_uptime('family_engagement', now() + interval '1 day')")
assert empty == 'probe=0/0,request=0/0', empty
check(f'Appendix H (Staff Family-Engagement Insight Uptime): per source, checks and checks with data over the window ({uptime}); an '
      f'empty window reports zero checks, never a made-up 100% ({empty})')

# ── 5. Replay ───────────────────────────────────────────────────────────────
before = sql('SELECT count(*) FROM public.staff_insight_checks', db)
apply_parts(db)
assert sql('SELECT count(*) FROM public.staff_insight_checks', db) == before
assert register(db, ids['kid10']) == 'transition' and insight(db)['summary']['children'] == 8
check(f'replay: applying the two S07.6 parts again keeps every uptime check ({before}) and every answer')

report = {
    'passed': True,
    'database': db,
    'migrations': [part.name for part in PARTS],
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim, upgraded in place '
                  'through the S07.6 parts; browser roles exercised through SET ROLE with request.jwt claims; the probe failure '
                  'modes on a second database whose insight is deliberately broken. Does not replace a full Supabase '
                  '(PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
