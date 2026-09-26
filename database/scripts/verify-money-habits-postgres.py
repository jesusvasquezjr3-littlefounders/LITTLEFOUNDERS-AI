"""D.13, D.14, D.15, D.16 (S07.4): the usual split, the Share destination, the
next-goal prompt and goal-progress provenance, enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to fresh databases on an owned native PostgreSQL cluster, over the same
minimal Supabase shim as the S07.1-S07.3 verifiers. It first reproduces the
gaps on the chain BEFORE the S07.4 parts, then upgrades that same database
through the S07.4 parts and attacks the result as a parent-created child
under 13, a parent-created child of 13 with and without analytics consent,
an independent teen with and without their own analytics opt-in, a teen who
linked a parent, an adult, a guest, the verified Tutor and an unrelated
parent, through the browser roles and through the service role (a Core
defect), including real concurrency. A second database carries a crafted,
backdated event timeline so the Appendix H diagnostics are checked against
hand-computed numbers.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-money-habits-postgres.json)
"""
from concurrent.futures import ThreadPoolExecutor
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
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-money-habits-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_4_PARTS = ['_family_money_events.sql', '_share_gift_destinations.sql', '_share_gift_flows.sql', '_wallet_usual_split.sql', '_savings_goal_next_step.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_4_PARTS]
FIXTURE = json.loads((ROOT / 'database/scripts/fixtures/split-coins.json').read_text(encoding='utf-8'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


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
    database = 'lf_money_habits_' + uuid.uuid4().hex
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


# kid9: parent-created, under 13 (A.2 origin marker from the parent's date), Tutor consent granted.
# kid14: parent-created, 13, Tutor consent granted. kid14n: parent-created, 13, no consent.
# teen: independent, own analytics opt-in. teen_off: independent, no opt-in. teen_l: linked later.
POPULATIONS = ['kid9', 'kid14', 'kid14n', 'teen', 'teen_off', 'teen_l', 'adult', 'guest', 'parent_a', 'parent_t', 'stranger']


def people(db):
    ids = {name: str(uuid.uuid4()) for name in POPULATIONS}
    rows = ','.join(f"('{v}', {'true' if k == 'guest' else 'false'})" for k, v in ids.items())
    bands = {'kid9': 'under_13', 'kid14': '13_to_17', 'kid14n': '13_to_17', 'teen': '13_to_17', 'teen_off': '13_to_17', 'teen_l': '13_to_17',
             'guest': '13_to_17', 'adult': 'adult', 'parent_a': 'adult', 'parent_t': 'adult', 'stranger': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    kids = ['kid9', 'kid14', 'kid14n']
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
INSERT INTO public.account_safety_origins (user_id) VALUES ('{ids['kid9']}');
UPDATE public.profiles SET birth_date = current_date - interval '9 years 3 days' WHERE user_id = '{ids['kid9']}';
UPDATE public.profiles SET birth_date = current_date - interval '13 years 3 days' WHERE user_id IN ('{ids['kid14']}', '{ids['kid14n']}');
UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id IN ('{ids['teen']}', '{ids['teen_off']}', '{ids['teen_l']}');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('{ids['parent_a']}', 'parent'), ('{ids['parent_t']}', 'parent'), ('{ids['stranger']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES {','.join(f"('{ids['parent_a']}', '{ids[k]}', 'verified', now())" for k in kids)};
INSERT INTO public.user_roles (user_id, role) VALUES {','.join(f"('{ids[k]}', 'kid')" for k in kids)} ON CONFLICT DO NOTHING;
INSERT INTO public.analytics_consents (kid_user_id, granted_by) VALUES ('{ids['kid9']}', '{ids['parent_a']}'), ('{ids['kid14']}', '{ids['parent_a']}');
INSERT INTO public.teen_analytics_preferences (user_id, enabled, disclosure_version) VALUES ('{ids['teen']}', true, 1), ('{ids['teen_off']}', false, 1);
""", db)
    return ids


def link_teen(db, teen, parent):
    token = f'teen-{uuid.uuid4().hex}'
    service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{teen}', '{teen}', '{token}', now() + interval '7 days')")
    service(db, f"SELECT public.accept_guardian_invite('{token}', '{parent}')")
    link = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{parent}' AND kid_user_id = '{teen}'")
    assert service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen}', true)") == 'verified'


def approved_task(db, parent, child, coins):
    tid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins) VALUES ('{tid}', '{parent}', '{child}', 'Chore', {coins})")
    service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{tid}'")
    service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{parent}', decided_at = now() WHERE id = '{tid}'")
    return tid


def credit(db, kid, amount):
    cid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.pending_credits (id, kid_user_id, amount, source) VALUES ('{cid}', '{kid}', {amount}, 'allowance')")
    return cid


def goal(db, kid, target, follows=None):
    gid = str(uuid.uuid4())
    column, value = (', follows_goal_id', f", '{follows}'") if follows else ('', '')
    service(db, f"INSERT INTO public.savings_goals (id, kid_user_id, title, target{column}) VALUES ('{gid}', '{kid}', 'Goal', {target}{value})")
    return gid


def events(db, who, event=None):
    where = f" AND event = '{event}'" if event else ''
    return service(db, f"SELECT count(*) FROM public.family_money_events WHERE user_id = '{who}'{where}")


def balance(db, kid, bucket):
    return int(service(db, f"SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND bucket = '{bucket}'"))


# ── 1. Reproduce the gaps on the chain BEFORE this checkpoint ────────────────
previous = MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1]
db = fresh(previous)
p = people(db)
kid9, kid14, kid14n, teen, teen_off, teen_l, adult, guest, pa, pt, stranger = (p[k] for k in POPULATIONS)
assert sql("SELECT count(*) FROM pg_class WHERE relname IN ('family_money_events', 'share_gifts', 'share_destinations', 'wallet_split_preferences', 'goal_next_steps')", db) == '0'
assert sql("SELECT max(pronargs) FROM pg_proc WHERE proname = 'allocate_pending_credit'", db) == '6'
g_pre = goal(db, kid14, 50)
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by) VALUES ('{kid14}', 'save', 5, 'allowance', '{g_pre}', '{kid14}')"),
        'LEDGER_CREDIT_INVALID')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by) VALUES ('{kid14}', 'save', 5, 'savings_bonus', '{g_pre}', '{kid14}')"),
        'LEDGER_CREDIT_INVALID')
check(f'before {PARTS[0].name}: no usual split, Share destination, next step or behaviour stream exists; an allowance cannot be split with a goal '
      'tag (allocate_pending_credit takes 6 arguments, a tagged allowance row is refused); a savings-bonus row tagged to a goal is already refused '
      '(the D.16 guard this checkpoint keeps)')

apply_parts(db)
assert sql("SELECT max(pronargs) FROM pg_proc WHERE proname = 'allocate_pending_credit'", db) == '7'

# ── 2. The consent gate mirrors H.1's optional-event gate exactly ───────────
gate = {}
for k, v in p.items():
    admitted = service(db, f"SELECT public.family_analytics_admitted('{v}')")
    sql(f"INSERT INTO public.learning_events (user_id, role, event) VALUES ('{v}', 'universal', 'task_view')", db)
    kept = sql(f"SELECT count(*) > 0 FROM public.learning_events WHERE user_id = '{v}'", db)
    assert admitted == kept, (k, admitted, kept)
    gate[k] = admitted == 't'
assert {k for k, v in gate.items() if v} == {'kid14', 'teen', 'adult', 'parent_a', 'parent_t', 'stranger'}, gate
refused(lambda: browser(db, kid14, "INSERT INTO public.family_money_events (user_id, event, goal_id) VALUES (auth.uid(), 'goal_reached', gen_random_uuid())"), 'permission denied')
refused(lambda: service(db, f"INSERT INTO public.family_money_events (user_id, event, goal_id) VALUES ('{kid14}', 'goal_reached', gen_random_uuid())"), 'permission denied')
refused(lambda: browser(db, kid14, 'SELECT count(*) FROM public.family_money_events'), 'permission denied')
check(f'consent gate: family_analytics_admitted() equals the H.1 learning_events gate for all {len(p)} populations (admitted: the consented '
      '13-year-old, the opted-in teen and adults; never the under-13 child even with Tutor consent, the unconsented child, the teen who did not '
      'opt in, or a guest); no browser or service-role write reaches the stream, and no browser reads it')

# ── 3. D.13: the usual split ────────────────────────────────────────────────
usual = lambda who: service(db, f"SELECT save_pct || '/' || spend_pct || '/' || share_pct || '/' || custom FROM public.wallet_usual_split('{who}')")
assert usual(kid9) == '50/40/10/false'
assert service(db, f"SELECT public.set_wallet_usual_split('{kid9}', '{kid9}', 60, 30, 10)") == 't'
assert usual(kid9) == '60/30/10/true'
refused(lambda: service(db, f"SELECT public.set_wallet_usual_split('{kid9}', '{pa}', 100, 0, 0)"), 'SPLIT_OWNER_ONLY')
refused(lambda: service(db, f"SELECT public.set_wallet_usual_split('{kid9}', '{stranger}', 100, 0, 0)"), 'SPLIT_OWNER_ONLY')
for bad in ['50, 40, 5', '101, 0, -1', '50, 50, NULL']:
    refused(lambda: service(db, f"SELECT public.set_wallet_usual_split('{kid9}', '{kid9}', {bad})"), 'SPLIT_INVALID')
refused(lambda: service(db, f"SELECT public.set_wallet_usual_split('{adult}', '{adult}', 50, 40, 10)"), 'WALLET_HOLDER_REQUIRED')
refused(lambda: service(db, f"SELECT public.set_wallet_usual_split('{guest}', '{guest}', 50, 40, 10)"), 'WALLET_HOLDER_REQUIRED')
refused(lambda: service(db, f"INSERT INTO public.wallet_split_preferences (holder_user_id, save_pct, spend_pct, share_pct) VALUES ('{kid14}', 0, 100, 0)"), 'permission denied')
for who in [kid9, pa, teen]:
    refused(lambda: browser(db, who, f"INSERT INTO public.wallet_split_preferences (holder_user_id, save_pct, spend_pct, share_pct) VALUES ('{who}', 0, 100, 0)"), 'permission denied')
    refused(lambda: browser(db, who, f"SELECT public.set_wallet_usual_split('{who}', '{who}', 50, 40, 10)"), 'permission denied')
assert browser(db, pa, f"SELECT count(*) FROM public.wallet_split_preferences WHERE holder_user_id = '{kid9}'") == '1'
assert browser(db, stranger, f"SELECT count(*) FROM public.wallet_split_preferences WHERE holder_user_id = '{kid9}'") == '0'
values = ','.join(f"({i}, {c['amount']}, {c['pct']['save']}, {c['pct']['spend']}, {c['pct']['share']})" for i, c in enumerate(FIXTURE['cases']))
coins = service(db, f"SELECT string_agg(s.save || '/' || s.spend || '/' || s.share, ',' ORDER BY v.i) FROM (VALUES {values}) v (i, a, sv, sp, sh) "
                    "CROSS JOIN LATERAL public.wallet_split_coins(v.a, v.sv, v.sp, v.sh) s")
expected = ','.join(f"{c['coins']['save']}/{c['coins']['spend']}/{c['coins']['share']}" for c in FIXTURE['cases'])
assert coins == expected, 'wallet_split_coins disagrees with the fixture'
check(f'usual split: a holder with none gets the recommendation 50/40/10; only the holder sets their own (the Tutor and a stranger get '
      f'SPLIT_OWNER_ONLY); sums other than 100 are refused; an adult and a guest hold none; the service role and browser roles cannot write the '
      f'table or call the setter from a browser; the Tutor reads it, a stranger does not; wallet_split_coins() matches the shared fixture for all '
      f'{len(FIXTURE["cases"])} cases (Core and the client are pinned to the same file)')

# ── 4. D.13: every split is recorded against the default (consent-gated) ────
t_keep = approved_task(db, pa, kid14, 10)
assert service(db, f"SELECT public.allocate_task_reward('{t_keep}', '{kid14}', 5, 4, 1, '{kid14}', NULL)") == 't'
t_adj = approved_task(db, pa, kid14, 10)
assert service(db, f"SELECT public.allocate_task_reward('{t_adj}', '{kid14}', 0, 10, 0, '{kid14}', NULL)") == 't'
g14 = goal(db, kid14, 30)
c14 = credit(db, kid14, 20)
assert service(db, f"SELECT public.allocate_pending_credit('{c14}', '{kid14}', 10, 8, 2, '{kid14}', '{g14}')") == 't'
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE goal_id = '{g14}'") == '10'
assert service(db, f"SELECT public.allocate_pending_credit('{credit(db, kid14, 5)}', '{kid14}', 0, 5, 0, '{kid14}', '{g14}')") == 'f'
assert service(db, f"SELECT public.allocate_pending_credit('{credit(db, kid14, 5)}', '{kid14}', 5, 0, 0, '{kid14}', '{uuid.uuid4()}')") == 'f'
c14old = credit(db, kid14, 4)
assert service(db, f"SELECT public.allocate_pending_credit('{c14old}', '{kid14}', 2, 2, 0, '{kid14}')") == 't'
service(db, f"SELECT public.teen_log_income('{teen}', 'allowance', 3, 6, 1, NULL)")
service(db, f"SELECT public.teen_log_income('{teen_off}', 'earned', 5, 4, 1, NULL)")
t9 = approved_task(db, pa, kid9, 10)
assert service(db, f"SELECT public.allocate_task_reward('{t9}', '{kid9}', 6, 3, 1, '{kid9}', NULL)") == 't'
splits = service(db, f"SELECT string_agg(source || ':' || amount || ':' || save_amount || '/' || spend_amount || '/' || share_amount || ':' || "
                     f"default_save || '/' || default_spend || '/' || default_share || ':' || followed_default, ' ' ORDER BY id) "
                     f"FROM public.family_money_events WHERE event = 'split_allocated' AND user_id = '{kid14}'")
assert splits == 'task:10:5/4/1:5/4/1:true task:10:0/10/0:5/4/1:false allowance:20:10/8/2:10/8/2:true allowance:4:2/2/0:2/2/0:true', splits
assert service(db, f"SELECT save_amount || '/' || spend_amount || '/' || share_amount || ':' || default_save || '/' || default_spend || '/' || default_share || ':' || followed_default "
                   f"FROM public.family_money_events WHERE event = 'split_allocated' AND user_id = '{teen}'") == '3/6/1:5/4/1:false'
for silent in [kid9, teen_off]:
    assert events(db, silent) == '0', silent
assert balance(db, kid9, 'save') == 6 and balance(db, teen_off, 'save') == 5
# The consent store failing never blocks a coin: the event is dropped, the split lands.
before_down = events(db, kid14)
sql("CREATE OR REPLACE FUNCTION public.family_analytics_admitted(p_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE AS $$ BEGIN RAISE EXCEPTION 'CONSENT_STORE_DOWN'; END $$;", db)
t_down = approved_task(db, pa, kid14, 3)
assert service(db, f"SELECT public.allocate_task_reward('{t_down}', '{kid14}', 2, 1, 0, '{kid14}', NULL)") == 't'
assert events(db, kid14) == before_down and service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE task_id = '{t_down}'") == '3'
sql(PARTS[0].read_text(encoding='utf-8'), db)
assert service(db, f"SELECT public.family_analytics_admitted('{kid14}')") == 't'
engagement = service(db, "SELECT string_agg(source || '=' || allocations || '/' || kept_default || '/' || adjusted, ' ' ORDER BY source) FROM public.family_split_engagement(now() - interval '1 hour')")
assert engagement == 'allowance=2/2/0 income=1/0/1 task=2/1/1', engagement
check(f'split events: the 13-year-old keeps the 5/4/1 default (recorded as kept), puts all 10 in Spend (adjusted), splits an allowance with '
      f'10 to a goal (the new goal tag; a tag with nothing in Save or a foreign goal is refused as before) and an older six-argument call still '
      f'works; the opted-in teen\'s logged income is recorded against the same default; the under-13 child and the teen who did not opt in '
      f'leave no event while their coins land normally; if the consent question cannot be answered the event is dropped and the 3 coins still '
      f'land (fail-closed, never blocking); Split-Ratio Engagement = {engagement}')

# ── 5. D.13: redemption requests timed against the last credits to Spend ────
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{uuid.uuid4()}', '{pa}', 'Cinema', 3)")
catalog = service(db, f"SELECT id FROM public.redemption_catalog WHERE parent_user_id = '{pa}' LIMIT 1")
service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{catalog}', '{kid14}')")
service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{catalog}', '{kid9}')")
reward = service(db, f"SELECT public.teen_create_personal_reward('{teen}', 'Snack', 2)")
service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward}')")
timing = service(db, f"SELECT source || ':' || amount || ':' || (hours_since_allowance < 1) || ':' || (hours_since_earned < 1) FROM public.family_money_events "
                     f"WHERE event = 'redemption_requested' AND user_id = '{kid14}'")
assert timing == 'catalog:3:true:true', timing
assert service(db, f"SELECT source || ':' || amount || ':' || (hours_since_allowance < 1) || ':' || (hours_since_earned IS NULL) FROM public.family_money_events "
                   f"WHERE event = 'redemption_requested' AND user_id = '{teen}'") == 'personal_reward:2:true:true'
assert events(db, kid9, 'redemption_requested') == '0'
credits_logged = service(db, f"SELECT string_agg(source || ':' || bucket || ':' || amount, ' ' ORDER BY id) FROM public.family_money_events WHERE event = 'credit' AND user_id = '{kid14}'")
assert credits_logged.split(' ')[:3] == ['earned:save:5', 'earned:spend:4', 'earned:share:1'], credits_logged
check(f'redemption timing: a reward request by the consented 13-year-old and a personal reward the opted-in teen marked are recorded with the '
      f'hours since the last allowance and the last earned credit to Spend, read from the ledger at that moment (a teen with no earned income has '
      f'none); the under-13 child\'s request leaves no event; every own credit is recorded with its class and pocket ({credits_logged})')

# ── 6. D.14: the Share destination ──────────────────────────────────────────
dest = service(db, f"SELECT public.share_destination_create('{kid14}', '{pa}', ' Food bank ', 'charity')")
assert service(db, f"SELECT title || ':' || chosen_by FROM public.share_destinations WHERE id = '{dest}'") == 'Food bank:tutor'
refused(lambda: service(db, f"SELECT public.share_destination_create('{kid14}', '{kid14}', 'Park', 'community')"), 'SHARE_DESTINATION_FORBIDDEN')
refused(lambda: service(db, f"SELECT public.share_destination_create('{kid14}', '{stranger}', 'Park', 'community')"), 'SHARE_DESTINATION_FORBIDDEN')
refused(lambda: service(db, f"SELECT public.share_destination_create('{adult}', '{adult}', 'Park', 'community')"), 'WALLET_HOLDER_REQUIRED')
for bad in ["''", "repeat('x', 61)", 'NULL']:
    refused(lambda: service(db, f"SELECT public.share_destination_create('{kid14}', '{pa}', {bad}, 'gift')"), 'SHARE_DESTINATION_INVALID')
refused(lambda: service(db, f"SELECT public.share_destination_create('{kid14}', '{pa}', 'Bank', 'bank')"), 'SHARE_DESTINATION_INVALID')
own = service(db, f"SELECT public.share_destination_create('{teen}', '{teen}', 'Animal shelter', 'charity')")
assert service(db, f"SELECT chosen_by FROM public.share_destinations WHERE id = '{own}'") == 'holder'
for i in range(9):
    service(db, f"SELECT public.share_destination_create('{teen}', '{teen}', 'Place {i}', 'gift')")
refused(lambda: service(db, f"SELECT public.share_destination_create('{teen}', '{teen}', 'One more', 'gift')"), 'SHARE_DESTINATION_LIMIT')

share14 = balance(db, kid14, 'share')
gift = service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 2)")
assert balance(db, kid14, 'share') == share14 - 2
refused(lambda: service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', {share14})"), 'INSUFFICIENT_BALANCE')
refused(lambda: service(db, f"SELECT public.share_gift_pledge('{kid14}', '{own}', 1)"), 'SHARE_DESTINATION_UNAVAILABLE')
for bad in ['0', '1001', 'NULL']:
    refused(lambda: service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', {bad})"), 'SHARE_GIFT_INVALID')
refused(lambda: service(db, f"SELECT public.share_gift_settle('{gift}', '{kid14}', 'given', 'I gave it')"), 'SHARE_GIFT_FORBIDDEN')
refused(lambda: service(db, f"SELECT public.share_gift_settle('{gift}', '{stranger}', 'given', 'Done')"), 'SHARE_GIFT_NOT_FOUND')
refused(lambda: service(db, f"SELECT public.share_gift_settle('{gift}', '{pa}', 'given', '  ')"), 'SHARE_GIFT_NOTE_REQUIRED')
assert service(db, f"SELECT public.share_gift_settle('{gift}', '{pa}', 'given', 'We took rice to the food bank')") == 'given'
refused(lambda: service(db, f"SELECT public.share_gift_settle('{gift}', '{pa}', 'returned', 'Oops')"), 'SHARE_GIFT_SETTLED')
back = service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 1)")
assert service(db, f"SELECT public.share_gift_settle('{back}', '{kid14}', 'returned', NULL)") == 'returned'
back2 = service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 1)")
refused(lambda: service(db, f"SELECT public.share_gift_settle('{back2}', '{pa}', 'returned', NULL)"), 'SHARE_GIFT_NOTE_REQUIRED')
assert service(db, f"SELECT public.share_gift_settle('{back2}', '{pa}', 'returned', 'The drive was cancelled')") == 'returned'
assert balance(db, kid14, 'share') == share14 - 2
ledger = service(db, f"SELECT string_agg(reason || ':' || amount, ' ' ORDER BY id) FROM public.wallet_ledger WHERE share_gift_id IN ('{gift}', '{back}', '{back2}')")
assert ledger == 'share_gift:-2 share_gift:-1 share_gift_returned:1 share_gift:-1 share_gift_returned:1', ledger
service(db, f"SELECT public.teen_log_income('{teen}', 'gift', 0, 0, 5, NULL)")
tgift = service(db, f"SELECT public.share_gift_pledge('{teen}', '{own}', 3)")
refused(lambda: service(db, f"SELECT public.share_gift_settle('{tgift}', '{teen}', 'given', NULL)"), 'SHARE_GIFT_NOTE_REQUIRED')
assert service(db, f"SELECT public.share_gift_settle('{tgift}', '{teen}', 'given', 'Bought dog food')") == 'given'
check('share: a Tutor chooses a place for a child in a family (the child and a stranger cannot, an adult holds no wallet, a bad name or kind '
      'is refused); a teen chooses their own, at most 10 active; a pledge leaves Share at once and cannot exceed it or go to someone else\'s '
      'place; only the steward records "given", always with a note (the child and a stranger cannot); a settled gift cannot settle again; the '
      'child takes a pledge back without a note, a Tutor returns one only with a reason, and each return credits Share exactly once; a teen logs '
      f'what they did with their own place; the ledger holds exactly the matching rows ({ledger})')

refused(lambda: service(db, f"INSERT INTO public.share_gifts (holder_user_id, destination_id, amount) VALUES ('{kid14}', '{dest}', 1)"), 'permission denied')
refused(lambda: service(db, f"UPDATE public.share_gifts SET status = 'given', note = 'x', settled_at = now(), settled_by = '{pa}' WHERE id = '{back}'"), 'permission denied')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, share_gift_id) VALUES ('{kid14}', 'share', 5, 'share_gift_returned', '{pa}', '{gift}')"),
        'LEDGER_SHARE_GIFT_INVALID')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, share_gift_id) VALUES ('{kid14}', 'share', 5, 'manual_adjustment', '{pa}', '{gift}')"),
        'LEDGER_REASON_INVALID')
refused(lambda: sql(f"BEGIN; INSERT INTO public.share_gifts (holder_user_id, destination_id, amount) VALUES ('{kid14}', '{dest}', 1); COMMIT;", db), 'SHARE_GIFT_UNBALANCED')
refused(lambda: sql(f"UPDATE public.share_gifts SET status = 'pledged', settled_at = NULL, settled_by = NULL, note = NULL WHERE id = '{gift}'", db), 'SHARE_GIFT_TRANSITION_FORBIDDEN')
for who in [kid14, pa, teen]:
    refused(lambda: browser(db, who, f"INSERT INTO public.share_destinations (holder_user_id, title, kind, chosen_by, created_by) VALUES ('{kid14}', 'x', 'gift', 'tutor', '{pa}')"), 'permission denied')
    refused(lambda: browser(db, who, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 1)"), 'permission denied')
assert browser(db, kid14, f"SELECT count(*) FROM public.share_gifts WHERE holder_user_id = '{kid14}'") == '3'
assert browser(db, pa, f"SELECT count(*) FROM public.share_gifts WHERE holder_user_id = '{kid14}'") == '3'
assert browser(db, stranger, f"SELECT count(*) FROM public.share_gifts WHERE holder_user_id = '{kid14}'") == '0'
assert browser(db, teen_off, f"SELECT count(*) FROM public.share_destinations WHERE holder_user_id = '{teen}'") == '0'
check('share forgery: the service role cannot write gifts directly or forge a gift ledger row (wrong amount, a second return, a foreign reason '
      'pointing at a gift); a gift written without its debit is refused at commit (SHARE_GIFT_UNBALANCED); a settled gift cannot reopen, even '
      'for a superuser; browser roles have no write path; the child and the Tutor read the gifts, a stranger and another teen read nothing')

service(db, f"INSERT INTO public.banking_accounts (kid_user_id, display_number, opened_by) VALUES ('{kid14}', 'LF-1234-5678', '{pa}')")
held = service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 1)")
service(db, f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{pa}', frozen_at = now() WHERE kid_user_id = '{kid14}'")
refused(lambda: service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 1)"), 'ACCOUNT_FROZEN')
refused(lambda: service(db, f"SELECT public.share_gift_settle('{held}', '{kid14}', 'returned', NULL)"), 'ACCOUNT_FROZEN')
assert service(db, f"SELECT public.share_gift_settle('{held}', '{pa}', 'given', 'Done while the card was frozen')") == 'given'
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{pa}', frozen_at = NULL WHERE kid_user_id = '{kid14}'")
check('share and the freeze (D.1): while a Tutor\'s freeze holds, the child can neither pledge nor take a pledge back; the Tutor can still '
      'record what the family did')

# ── 7. Concurrency ───────────────────────────────────────────────────────────
service(db, f"SELECT public.guardian_adjust_wallet('{kid14}', '{pa}', 'share', 10 - {balance(db, kid14, 'share')}, 'Test coins')") if balance(db, kid14, 'share') != 10 else None
assert balance(db, kid14, 'share') == 10


def pledge_once(_):
    try:
        service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 3)")
        return 'ok'
    except RuntimeError as error:
        assert 'INSUFFICIENT_BALANCE' in str(error), error
        return 'refused'


with ThreadPoolExecutor(max_workers=8) as pool:
    pledges = list(pool.map(pledge_once, range(8)))
assert pledges.count('ok') == 3 and balance(db, kid14, 'share') == 1, (pledges, balance(db, kid14, 'share'))
race = service(db, f"SELECT public.share_gift_pledge('{kid14}', '{dest}', 1)")


def settle_once(i):
    actor, outcome = [(pa, 'given'), (kid14, 'returned')][i % 2]
    try:
        service(db, f"SELECT public.share_gift_settle('{race}', '{actor}', '{outcome}', 'Race {i}')")
        return outcome
    except RuntimeError as error:
        assert 'SHARE_GIFT_SETTLED' in str(error), error
        return 'refused'


with ThreadPoolExecutor(max_workers=8) as pool:
    settles = list(pool.map(settle_once, range(8)))
assert len([s for s in settles if s != 'refused']) == 1, settles
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE share_gift_id = '{race}' AND reason = 'share_gift_returned'") == ('1' if 'returned' in settles else '0')
check(f'concurrency: 8 simultaneous 3-coin pledges against 10 Share coins -> exactly 3, never negative; 8 simultaneous opposite settlements (the '
      f'Tutor marking it done, the child taking it back) -> exactly 1 ({[s for s in settles if s != "refused"][0]}), with at most one return credit')

# ── 8. D.15: the next goal ──────────────────────────────────────────────────
gk = goal(db, kid14, 10)
tk = approved_task(db, pa, kid14, 10)
assert service(db, f"SELECT public.allocate_task_reward('{tk}', '{kid14}', 10, 0, 0, '{kid14}', '{gk}')") == 't'
assert service(db, f"SELECT status FROM public.savings_goals WHERE id = '{gk}'") == 'reached'
assert service(db, f"SELECT state FROM public.goal_next_steps WHERE goal_id = '{gk}'") == 'pending'
assert service(db, f"SELECT public.goal_next_step_seen('{kid14}', '{gk}')") == 't'
assert service(db, f"SELECT public.goal_next_step_seen('{kid14}', '{gk}')") == 'f'
refused(lambda: service(db, f"SELECT public.goal_next_step_seen('{kid9}', '{gk}')"), 'GOAL_NOT_FOUND')
refused(lambda: goal(db, kid9, 20, gk), 'GOAL_FOLLOWS_INVALID')
refused(lambda: goal(db, kid14, 20, g14), 'GOAL_FOLLOWS_INVALID')
nk = goal(db, kid14, 40, gk)
assert service(db, f"SELECT state || ':' || (next_goal_id = '{nk}') FROM public.goal_next_steps WHERE goal_id = '{gk}'") == 'set:true'
refused(lambda: goal(db, kid14, 40, gk), 'duplicate key')
assert service(db, f"SELECT public.goal_next_step_decline('{kid14}', '{gk}')") == 'f'
refused(lambda: service(db, f"UPDATE public.savings_goals SET follows_goal_id = '{g14}' WHERE id = '{nk}'"), 'GOAL_IMMUTABLE_FIELD')
gt = goal(db, teen, 5)
service(db, f"SELECT public.teen_log_income('{teen}', 'earned', 5, 0, 0, '{gt}')")
assert service(db, f"SELECT state FROM public.goal_next_steps WHERE goal_id = '{gt}'") == 'pending'
assert service(db, f"SELECT public.goal_next_step_decline('{teen}', '{gt}')") == 't'
assert service(db, f"SELECT public.goal_next_step_seen('{teen}', '{gt}')") == 'f'
g9 = goal(db, kid9, 4)
t94 = approved_task(db, pa, kid9, 4)
service(db, f"SELECT public.allocate_task_reward('{t94}', '{kid9}', 4, 0, 0, '{kid9}', '{g9}')")
assert service(db, f"SELECT state FROM public.goal_next_steps WHERE goal_id = '{g9}'") == 'pending'
assert events(db, kid9) == '0'
flow = service(db, f"SELECT string_agg(event, ',' ORDER BY id) FROM public.family_money_events WHERE goal_id = '{gk}' AND event NOT IN ('credit', 'split_allocated')")
assert flow == 'goal_reached,next_goal_prompted,next_goal_set', flow
refused(lambda: service(db, f"UPDATE public.goal_next_steps SET state = 'pending', decided_at = NULL, next_goal_id = NULL WHERE goal_id = '{gk}'"), 'permission denied')
refused(lambda: sql(f"UPDATE public.goal_next_steps SET state = 'pending', decided_at = NULL, next_goal_id = NULL, prompted_at = NULL WHERE goal_id = '{gk}'", db),
        'GOAL_NEXT_STEP_TRANSITION_FORBIDDEN')
refused(lambda: sql(f"INSERT INTO public.goal_next_steps (goal_id, holder_user_id, reached_at) VALUES ('{nk}', '{kid14}', now())", db), 'GOAL_NEXT_STEP_INVALID')
for who in [kid14, pa]:
    refused(lambda: browser(db, who, f"SELECT public.goal_next_step_seen('{kid14}', '{gk}')"), 'permission denied')
assert browser(db, pa, f"SELECT count(*) FROM public.goal_next_steps WHERE holder_user_id = '{kid14}'") == '1'
assert browser(db, stranger, f"SELECT count(*) FROM public.goal_next_steps WHERE holder_user_id = '{kid14}'") == '0'
check(f'next goal: a chore that covers a goal reaches it in the same transaction and opens its next step (pending); the first view is the one '
      f'celebration (true, then false); another child cannot see it or follow it; a next goal may follow only the holder\'s own reached goal, '
      f'only once, and the link cannot be changed; starting it closes the step as set ({flow}); a teen\'s income reaching a goal opens a step '
      f'and "not now" is respected; an under-13 child gets the prompt but no event; no writer can reopen or forge a step; the Tutor reads it, a '
      f'stranger does not')

# ── 9. D.16: goal progress by provenance ────────────────────────────────────
gp = goal(db, kid14, 100)
tp = approved_task(db, pa, kid14, 12)
service(db, f"SELECT public.allocate_task_reward('{tp}', '{kid14}', 12, 0, 0, '{kid14}', '{gp}')")
service(db, f"SELECT public.allocate_pending_credit('{credit(db, kid14, 6)}', '{kid14}', 6, 0, 0, '{kid14}', '{gp}')")
breakdown = lambda gid: service(db, f"SELECT own || '/' || bonus || '/' || family || '/' || total FROM public.goal_progress_breakdown(ARRAY['{gid}']::uuid[])")
assert breakdown(gp) == '18/0/0/18', breakdown(gp)
service(db, f"SELECT public.guardian_withdraw_goal('{gp}', '{pa}', 5, 'spend', 'Bought the ball')")
assert breakdown(gp) == '13/0/0/13', breakdown(gp)
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by) VALUES ('{kid14}', 'save', 4, 'savings_bonus', '{gp}', '{kid14}')"),
        'LEDGER_CREDIT_INVALID')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by) VALUES ('{kid14}', 'save', 4, 'manual_adjustment', '{gp}', '{pa}')"),
        'LEDGER_GUARDIAN_ACTION_REQUIRED')
sql(f"SET session_replication_role = replica; INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by) "
    f"VALUES ('{kid14}', 'save', 4, 'savings_bonus', '{gp}', '{kid14}'), ('{kid14}', 'save', 3, 'manual_adjustment', '{gp}', '{pa}'); SET session_replication_role = origin;", db)
assert breakdown(gp) == '13/4/3/20', breakdown(gp)
service(db, f"SELECT public.guardian_withdraw_goal('{gp}', '{pa}', 15, 'save', 'Moved back')")
assert breakdown(gp) == '0/4/1/5', breakdown(gp)
assert service(db, f"SELECT count(*) FROM public.goal_progress_breakdown(ARRAY['{gp}', '{uuid.uuid4()}']::uuid[])") == '2'
refused(lambda: browser(db, kid14, f"SELECT * FROM public.goal_progress_breakdown(ARRAY['{gp}']::uuid[])"), 'permission denied')
check('provenance: a goal fed by a chore (12) and an allowance (6) is 18 of the child\'s own; a Tutor\'s 5-coin withdrawal comes out of the '
      'child\'s own part (13/0/0/13); no writer can tag a savings bonus or an unexplained Tutor credit to a goal; if a future path did (simulated '
      'with triggers off) the breakdown shows it apart (13 own / 4 bonus / 3 Tutor), and a later withdrawal is taken from the child\'s own part first, '
      'so "yours" is never overstated (0/4/1/5); unknown goals read as zero; browser roles cannot call it')

# ── 10. Retention and audit ─────────────────────────────────────────────────
sql(f"SET session_replication_role = replica; INSERT INTO public.family_money_events (user_id, event, goal_id, created_at) "
    f"VALUES ('{kid14}', 'goal_reached', gen_random_uuid(), now() - interval '500 days'); SET session_replication_role = origin;", db)
refused(lambda: service(db, 'SELECT public.prune_family_money_events(7)'), 'RETENTION_INVALID')
assert service(db, 'SELECT public.prune_family_money_events(400)') == '1'
assert service(db, "SELECT removed FROM public.insights_maintenance_log WHERE job = 'prune_family_money_events' ORDER BY id DESC LIMIT 1") == '1'
refused(lambda: browser(db, pa, 'SELECT public.prune_family_money_events(400)'), 'permission denied')
audit = service(db, "SELECT string_agg(table_name || '=' || n, ' ' ORDER BY table_name) FROM (SELECT table_name, count(*) n FROM public.family_state_audit "
                    "WHERE table_name IN ('share_gifts', 'share_destinations', 'goal_next_steps') GROUP BY table_name) a")
outside = service(db, "SELECT count(*) FROM public.family_state_audit WHERE table_name IN ('share_gifts', 'share_destinations', 'goal_next_steps') "
                      "AND request_role IS DISTINCT FROM 'service_role'")
assert outside == '0', outside
check(f'retention and audit: prune_family_money_events(400) removes an event older than 400 days and logs it (a window under 30 days is refused, '
      f'no browser call); every Share-gift, destination and next-step transition is in the D.4 transition audit ({audit}), all through the '
      f'service role (the deliberate superuser attempts above were refused and left no transition)')

# ── 11. Replay ───────────────────────────────────────────────────────────────
snapshot = lambda: service(db, "SELECT (SELECT count(*) FROM public.family_money_events) || '/' || (SELECT count(*) FROM public.share_gifts) || '/' || "
                               "(SELECT count(*) FROM public.share_destinations) || '/' || (SELECT count(*) FROM public.goal_next_steps) || '/' || "
                               "(SELECT count(*) FROM public.wallet_split_preferences) || '/' || (SELECT count(*) FROM public.wallet_ledger)")
before_replay = snapshot()
apply_parts(db)
assert snapshot() == before_replay, (before_replay, snapshot())
refused(lambda: service(db, f"SELECT public.set_wallet_usual_split('{kid9}', '{pa}', 100, 0, 0)"), 'SPLIT_OWNER_ONLY')
refused(lambda: service(db, f"SELECT public.share_gift_settle('{gift}', '{pa}', 'returned', 'x')"), 'SHARE_GIFT_SETTLED')
check(f'replay: re-applying the five S07.4 migrations preserves every row (events/gifts/places/steps/splits/ledger = {before_replay}) and the refusals')

# ── 12. The Appendix H diagnostics against a crafted, backdated timeline ────
m = fresh(TARGET)
q = people(m)
who = q['teen']
now = "now()"
rows = [
    # credits to Spend: an allowance 100 h ago, an earned credit 30 h ago
    ('credit', 'allowance', 'spend', 5, 'NULL', 100), ('credit', 'earned', 'spend', 3, 'NULL', 30),
    # reward requests: 10 h and 80 h after the allowance, 5 h after the earned credit (the older one before any earned credit)
    ('redemption_requested', 'catalog', None, 2, 'NULL', 90), ('redemption_requested', 'catalog', None, 2, 'NULL', 20),
]
values = []
for event, source, bucket, amount, goal_id, hours_ago in rows:
    values.append(f"('{who}', '{event}', '{source}', {f"'{bucket}'" if bucket else 'NULL'}, {amount}, {goal_id}, {now} - interval '{hours_ago} hours')")
sql("SET session_replication_role = replica; INSERT INTO public.family_money_events (user_id, event, source, bucket, amount, goal_id, created_at) VALUES "
    + ','.join(values) + ';', m)
sql(f"UPDATE public.family_money_events SET hours_since_allowance = 10, hours_since_earned = NULL WHERE event = 'redemption_requested' AND created_at < now() - interval '50 hours';"
    f"UPDATE public.family_money_events SET hours_since_allowance = 80, hours_since_earned = 10 WHERE event = 'redemption_requested' AND created_at > now() - interval '50 hours';", m)
rates = sql("SELECT string_agg(credit_class || ':' || bin || '=' || requests || '/' || coalesce(exposure_hours::text, '-') || '/' || coalesce(rate_per_100_child_days::text, '-'), ' ' "
            "ORDER BY credit_class, bin) FROM public.family_redemption_credit_timing(now() - interval '10 days')", m)
expected_rates = ('allowance:0_24h=1/24.00/100.00 allowance:168h_plus=0/0.00/- allowance:24_72h=0/48.00/0.00 allowance:72_168h=1/28.00/85.71 '
                  'allowance:none=0/-/- earned:0_24h=1/24.00/100.00 earned:168h_plus=0/0.00/- earned:24_72h=0/6.00/0.00 earned:72_168h=0/0.00/- earned:none=1/-/-')
assert rates == expected_rates, rates
g1 = str(uuid.uuid4())
cliff_rows = [("'credit'", "'earned'", "'save'", 20, 'NULL', f"{now} - interval '30 days'"),
              ("'credit'", "'allowance'", "'save'", 18, 'NULL', f"{now} - interval '25 days'"),
              ("'credit'", "'earned'", "'save'", 18, 'NULL', f"{now} - interval '21 days'"),
              ("'goal_reached'", 'NULL', 'NULL', 'NULL', f"'{g1}'", f"{now} - interval '20 days'"),
              ("'next_goal_set'", 'NULL', 'NULL', 'NULL', f"'{g1}'", f"{now} - interval '19 days'"),
              ("'credit'", "'gift'", "'save'", 14, 'NULL', f"{now} - interval '15 days'"),
              ("'credit'", "'bonus'", "'save'", 9, 'NULL', f"{now} - interval '15 days'"),
              ("'credit'", "'earned'", "'spend'", 7, 'NULL', f"{now} - interval '15 days'")]
sql("SET session_replication_role = replica; INSERT INTO public.family_money_events (user_id, event, source, bucket, amount, goal_id, created_at) VALUES "
    + ','.join(f"('{who}', {e}, {s}, {b}, {a}, {g}, {t})" for e, s, b, a, g, t in cliff_rows) + ';', m)
cliff = sql("SELECT string_agg(next_goal_within_2_days || '=' || goals || '/' || mean_before_per_day || '/' || mean_after_per_day || '/' || goals_with_drop, ' ') "
            "FROM public.family_post_goal_motivation(now() - interval '60 days')", m)
assert cliff == 'true=1/2.000/1.000/1 false=0/0.000/0.000/0', cliff
persistence = sql("SELECT children || '/' || save_contributors || '/' || save_coins || '/' || own_coins FROM public.family_save_contribution_persistence(now() - interval '60 days')", m)
assert persistence == '1/1/70/85', persistence
check(f'diagnostics (crafted timeline): redemption requests per 100 child-days by time since the last credit to Spend match the hand computation '
      f'({rates}); the post-goal cliff for a goal whose next goal was set within a day reads 2 coins a day before and 1 after, a drop '
      f'({cliff}); Save persistence counts own coins only, never the bonus ({persistence})')

report = {
    'passed': True,
    'database': db,
    'migrations': [part.name for part in PARTS],
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim, upgraded in place '
                  'through the S07.4 parts; browser roles exercised through SET ROLE with request.jwt claims, concurrency '
                  'through parallel sessions; diagnostics on a second database with a crafted, backdated event timeline. '
                  'Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
