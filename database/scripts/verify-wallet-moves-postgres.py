"""wallet_moves (0259-0260) and allowance_requests (0261), enforced by PostgreSQL.

Part 1: the holder moves their own coins.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on the owned native PostgreSQL cluster, over the
same minimal Supabase shim as the other Block D verifiers, then checks the
legitimate flows (pocket to pocket, Save into a goal, a goal back to Save,
editing a goal, removing a funded goal without stranding its coins) and
attacks the guard through the service role (a Core defect): a move row with
no move, a one-sided move, a move by someone else, coins into a goal that is
closed, a goal's target changed outside the edit function, an adult's wallet.

Cluster selection (never the shared Docker stack): the same LF_PG_* variables
as verify-money-habits-postgres.py.
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
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/wallet-moves-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
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


def fresh():
    database = 'lf_wallet_moves_' + uuid.uuid4().hex
    sql(f'CREATE DATABASE {database}')
    sql(SHIM, database)
    for migration in MIGRATIONS:
        sql(migration.read_text(encoding='utf-8'), database)
    return database


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


def people(db):
    ids = {name: str(uuid.uuid4()) for name in ('kid', 'teen', 'adult', 'parent', 'stranger')}
    rows = ','.join(f"('{v}', false)" for v in ids.values())
    bands = {'kid': 'under_13', 'teen': '13_to_17', 'adult': 'adult', 'parent': 'adult', 'stranger': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
INSERT INTO public.account_safety_origins (user_id) VALUES ('{ids['kid']}');
UPDATE public.profiles SET birth_date = current_date - interval '9 years 3 days' WHERE user_id = '{ids['kid']}';
UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id = '{ids['teen']}';
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['parent']}', 'parent'), ('{ids['stranger']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES ('{ids['parent']}', '{ids['kid']}', 'verified', now());
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['kid']}', 'kid') ON CONFLICT DO NOTHING;
""", db)
    return ids


def credit(db, kid, amount):
    cid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.pending_credits (id, kid_user_id, amount, source) VALUES ('{cid}', '{kid}', {amount}, 'allowance')")
    return cid


def split(db, kid, parent, save, spend, share, goal=None):
    cid = credit(db, kid, save + spend + share)
    g = f"'{goal}'" if goal else 'NULL'
    assert service(db, f"SELECT public.allocate_pending_credit('{cid}', '{kid}', {save}, {spend}, {share}, '{parent}', {g})") == 't'


def goal(db, kid, target):
    gid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.savings_goals (id, kid_user_id, title, target) VALUES ('{gid}', '{kid}', 'Goal', {target})")
    return gid


def balances(db, kid):
    row = service(db, f"""SELECT coalesce(sum(amount) FILTER (WHERE bucket = 'save'), 0), coalesce(sum(amount) FILTER (WHERE bucket = 'spend'), 0),
        coalesce(sum(amount) FILTER (WHERE bucket = 'share'), 0) FROM public.wallet_ledger WHERE kid_user_id = '{kid}'""")
    save, spend, share = (int(x) for x in row.split('|'))
    return {'save': save, 'spend': spend, 'share': share}


def goal_total(db, gid):
    return int(service(db, f"SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE goal_id = '{gid}'"))


def goal_status(db, gid):
    return service(db, f"SELECT status FROM public.savings_goals WHERE id = '{gid}'")


def breakdown(db, gid):
    own, bonus, family, total = (int(x) for x in service(db, f"SELECT own, bonus, family, total FROM public.goal_progress_breakdown(ARRAY['{gid}'::uuid])").split('|'))
    return {'own': own, 'bonus': bonus, 'family': family, 'total': total}


db = fresh()
ids = people(db)
kid, parent, adult, teen, stranger = ids['kid'], ids['parent'], ids['adult'], ids['teen'], ids['stranger']

# ── Pocket to pocket ─────────────────────────────────────────────────────────
split(db, kid, parent, 50, 30, 10)
assert balances(db, kid) == {'save': 50, 'spend': 30, 'share': 10}
service(db, f"SELECT public.wallet_move_pocket('{kid}', 'spend', 'save', 10)")
assert balances(db, kid) == {'save': 60, 'spend': 20, 'share': 10}
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND reason = 'pocket_move'") == '2'
check('a holder moves coins between pockets as two balanced rows')

service(db, f"SELECT public.wallet_move_pocket('{kid}', 'share', 'spend', 10)")
assert balances(db, kid) == {'save': 60, 'spend': 30, 'share': 0}
check('any pocket can move to any other (Share back to Spend)')

refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{kid}', 'share', 'save', 1)"), 'INSUFFICIENT_BALANCE')
refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{kid}', 'spend', 'spend', 1)"), 'WALLET_MOVE_INVALID')
refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{kid}', 'spend', 'save', 0)"), 'WALLET_MOVE_INVALID')
refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{kid}', 'bank', 'save', 1)"), 'WALLET_MOVE_INVALID')
check('overdrawing a pocket, moving to the same pocket, zero coins and an unknown pocket are refused')

refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{adult}', 'spend', 'save', 1)"), 'WALLET_HOLDER_REQUIRED')
check('an adult holds no wallet, so nothing moves for one')

# ── Save into a goal, and the goal reached ───────────────────────────────────
g1 = goal(db, kid, 30)
split(db, kid, parent, 10, 0, 0, g1)  # 10 already tagged by an allowance split; Save is now 70 (60 plain + 10 tagged)
assert goal_total(db, g1) == 10
service(db, f"SELECT public.wallet_move_goal('{kid}', '{g1}', 'in', 15)")
assert goal_total(db, g1) == 25 and goal_status(db, g1) == 'active'
assert balances(db, kid)['save'] == 70  # moving into a goal changes where coins are, never how many
check('plain Save moves into a goal; Save as a pocket does not change')

service(db, f"SELECT public.wallet_move_goal('{kid}', '{g1}', 'in', 5)")
assert goal_total(db, g1) == 30 and goal_status(db, g1) == 'reached'
check('coins that cover the target reach the goal in the same step')

b = breakdown(db, g1)
assert b == {'own': 30, 'bonus': 0, 'family': 0, 'total': 30}, b
check('coins a holder moved into a goal count as their own (D.16), never as family or bonus coins')

refused(lambda: service(db, f"SELECT public.wallet_move_goal('{kid}', '{g1}', 'in', 1)"), 'GOAL_NOT_ACTIVE')
check('a goal already reached takes no more coins')

# plain Save is 40 now (70 - 30 tagged); moving more than that into another goal must fail
g2 = goal(db, kid, 100)
refused(lambda: service(db, f"SELECT public.wallet_move_goal('{kid}', '{g2}', 'in', 41)"), 'GOAL_SAVINGS_PROTECTED')
service(db, f"SELECT public.wallet_move_goal('{kid}', '{g2}', 'in', 40)")
assert goal_total(db, g2) == 40
check('only plain Save moves into a goal: coins already tied to another goal are never double counted')

refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{kid}', 'save', 'spend', 1)"), 'GOAL_SAVINGS_PROTECTED')
check('with all Save tied to goals, nothing moves out of Save until a goal gives coins back')

# ── A goal gives coins back, in any state ────────────────────────────────────
service(db, f"SELECT public.wallet_move_goal('{kid}', '{g1}', 'out', 10)")
assert goal_total(db, g1) == 20 and goal_status(db, g1) == 'reached'
assert balances(db, kid)['save'] == 70
service(db, f"SELECT public.wallet_move_pocket('{kid}', 'save', 'spend', 10)")
assert balances(db, kid) == {'save': 60, 'spend': 40, 'share': 0}
check('a reached goal gives coins back to Save, and they can then be spent')

refused(lambda: service(db, f"SELECT public.wallet_move_goal('{kid}', '{g1}', 'out', 21)"), 'GOAL_BALANCE_INSUFFICIENT')
refused(lambda: service(db, f"SELECT public.wallet_move_goal('{kid}', '{uuid.uuid4()}', 'in', 1)"), 'GOAL_NOT_FOUND')
refused(lambda: service(db, f"SELECT public.wallet_move_goal('{kid}', '{g1}', 'sideways', 1)"), 'WALLET_MOVE_INVALID')
check('a goal cannot give more than it holds; an unknown goal or direction is refused')

# ── Edit a goal ──────────────────────────────────────────────────────────────
assert service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g2}', '  Bike  ', 50, 'bike')") == 't'
assert service(db, f"SELECT title || ':' || target || ':' || icon FROM public.savings_goals WHERE id = '{g2}'") == 'Bike:50:bike'
assert goal_status(db, g2) == 'active'
check('an open goal can be renamed, re-aimed and given another picture')

assert service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g2}', 'Bike', 40, 'bike')") == 't'
assert goal_status(db, g2) == 'reached'
check('lowering a goal to what is already saved reaches it in the same step')

refused(lambda: service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g1}', 'Renamed', 99, 'star')"), 'GOAL_EDIT_REACHED')
assert service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g1}', 'Renamed', 30, 'star')") == 't'
check('a reached goal keeps its target but can be renamed')

refused(lambda: service(db, f"UPDATE public.savings_goals SET target = 1 WHERE id = '{g1}'"), 'GOAL_IMMUTABLE_FIELD')
refused(lambda: service(db, f"UPDATE public.savings_goals SET target = 1 WHERE id = '{g2}'"), 'GOAL_IMMUTABLE_FIELD')
check('a goal target still cannot change outside the edit function (the marker is transaction-local)')

refused(lambda: service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g1}', '', 30, 'star')"), 'GOAL_EDIT_INVALID')
refused(lambda: service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g1}', 'x', 0, 'star')"), 'GOAL_EDIT_INVALID')
refused(lambda: service(db, f"SELECT public.wallet_goal_edit('{kid}', '{g1}', 'x', 5, 'house')"), 'GOAL_EDIT_INVALID')
check('an empty name, a zero target and an unknown picture are refused')

# ── Remove a funded goal: its coins go home ──────────────────────────────────
g3 = goal(db, kid, 500)
split(db, kid, parent, 10, 0, 0)  # fresh plain Save to fund the goal that will be removed
before = balances(db, kid)
plain = before['save'] - goal_total(db, g1) - goal_total(db, g2)
service(db, f"SELECT public.wallet_move_goal('{kid}', '{g3}', 'in', {min(plain, 7)})")
held = goal_total(db, g3)
assert held == 7
assert int(service(db, f"SELECT public.wallet_goal_archive('{kid}', '{g3}')")) == 7
assert goal_status(db, g3) == 'archived' and goal_total(db, g3) == 0
assert balances(db, kid) == before
assert service(db, f"SELECT public.wallet_goal_archive('{kid}', '{g3}')") == '0'
check('removing a funded goal returns every coin to plain Save and archives it; removing it again is a no-op')

refused(lambda: service(db, f"SELECT public.wallet_move_goal('{kid}', '{g3}', 'in', 1)"), 'GOAL_NOT_ACTIVE')
check('an archived goal takes no coins')

# a legacy goal archived by the old plain PATCH still holds coins: it can give them back
g4 = goal(db, kid, 500)
service(db, f"SELECT public.wallet_move_goal('{kid}', '{g4}', 'in', 3)")
service(db, f"UPDATE public.savings_goals SET status = 'archived' WHERE id = '{g4}'")
refused(lambda: service(db, f"SELECT public.wallet_move_pocket('{kid}', 'save', 'spend', {balances(db, kid)['save']})"), 'GOAL_SAVINGS_PROTECTED')
service(db, f"SELECT public.wallet_move_goal('{kid}', '{g4}', 'out', 3)")
assert goal_total(db, g4) == 0
check('coins stranded in a goal archived the old way are recoverable')

# ── Attacks through the service role (a Core defect) ─────────────────────────
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) VALUES ('{kid}', 'save', 5, 'pocket_move', '{kid}')"), 'LEDGER_MOVE_REQUIRED')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) VALUES ('{kid}', 'save', 5, 'goal_move', '{kid}')"), 'LEDGER_MOVE_REQUIRED')
check('a move row with no move behind it is refused')

mv = str(uuid.uuid4())
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_moves (id, holder_user_id, kind, amount, from_bucket, to_bucket) VALUES ('{mv}', '{kid}', 'pocket', 5, 'spend', 'save');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id) VALUES ('{kid}', 'save', 5, 'pocket_move', '{kid}', '{mv}');
COMMIT;"""), 'WALLET_MOVE_UNBALANCED')
check('a one-sided move (coins created) is refused at commit')

mv = str(uuid.uuid4())
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_moves (id, holder_user_id, kind, amount, from_bucket, to_bucket) VALUES ('{mv}', '{kid}', 'pocket', 5, 'spend', 'save');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id) VALUES ('{kid}', 'spend', -5, 'pocket_move', '{kid}', '{mv}');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id) VALUES ('{kid}', 'save', 9, 'pocket_move', '{kid}', '{mv}');
COMMIT;"""), 'LEDGER_MOVE_MISMATCH')
check('a move whose rows differ from what the move says is refused')

mv = str(uuid.uuid4())
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_moves (id, holder_user_id, kind, amount, from_bucket, to_bucket) VALUES ('{mv}', '{kid}', 'pocket', 5, 'spend', 'save');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id) VALUES ('{kid}', 'spend', -5, 'pocket_move', '{parent}', '{mv}');
COMMIT;"""), 'LEDGER_MOVE_REQUIRED')
check('only the holder writes their own moves (a Tutor-written row is refused)')

mv = str(uuid.uuid4())
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_moves (id, holder_user_id, kind, amount, from_bucket, to_bucket) VALUES ('{mv}', '{kid}', 'pocket', 5, 'spend', 'save');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id) VALUES ('{kid}', 'spend', -5, 'task_approved', '{kid}', '{mv}');
COMMIT;"""), 'LEDGER_REASON_INVALID')
check('a move cannot ride on a reason that is not a move')

mv = str(uuid.uuid4())
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_moves (id, holder_user_id, kind, amount, goal_id) VALUES ('{mv}', '{kid}', 'goal_in', 5, '{g2}');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, move_id) VALUES ('{kid}', 'save', -5, 'goal_move', '{kid}', '{mv}');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, goal_id, created_by, move_id) VALUES ('{kid}', 'save', 5, 'goal_move', '{g1}', '{kid}', '{mv}');
COMMIT;"""), 'LEDGER_MOVE_MISMATCH')
check('coins cannot be pointed at a different goal than the move names')

# the browser roles never write a move
refused(lambda: browser(db, kid, f"INSERT INTO public.wallet_moves (holder_user_id, kind, amount, from_bucket, to_bucket) VALUES ('{kid}', 'pocket', 1, 'spend', 'save')"), 'permission denied')
refused(lambda: browser(db, kid, f"SELECT public.wallet_move_pocket('{kid}', 'spend', 'save', 1)"), 'permission denied')
refused(lambda: browser(db, kid, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) VALUES ('{kid}', 'save', 50, 'pocket_move', '{kid}')"), 'permission denied')
check('browser roles can neither write a move nor call the move functions')

# the ledger stays append-only
refused(lambda: service(db, f"UPDATE public.wallet_ledger SET amount = amount + 1 WHERE kid_user_id = '{kid}' AND reason = 'pocket_move'"), 'permission denied')
refused(lambda: service(db, "UPDATE public.wallet_moves SET amount = amount + 1"), 'permission denied')
check('the ledger and the move log are append-only')

# a teen with their own wallet moves too
split_teen = str(uuid.uuid4())
service(db, f"SELECT public.teen_log_income('{teen}', 'earned', 20, 10, 0, NULL)")
service(db, f"SELECT public.wallet_move_pocket('{teen}', 'spend', 'save', 4)")
assert balances(db, teen) == {'save': 24, 'spend': 6, 'share': 0}
check('an independent teen moves their own coins the same way')

# the whole ledger still balances: every move is net zero
assert service(db, "SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE reason IN ('pocket_move', 'goal_move')") == '0'
check('across the whole database every move nets to zero coins')


# ── allowance_requests (0261): a child asks for more, the Tutor answers ─────────
service(db, f"""INSERT INTO public.allowance_rules (kid_user_id, parent_user_id, amount, frequency, anchor_day, next_run_at)
                VALUES ('{kid}', '{parent}', 10, 'weekly', 5, now() + interval '3 days')""")


def ask(amount, kind='saving_goal', note='NULL'):
    return service(db, f"SELECT public.allowance_request_create('{kid}', {amount}, '{kind}', {note})")


def allowance():
    return int(service(db, f"SELECT amount FROM public.allowance_rules WHERE kid_user_id = '{kid}'"))


def decide(rid, actor, approve, code='NULL', reason='NULL', revisit='NULL'):
    def quote(value):
        return value if value == 'NULL' else "'" + value + "'"
    date = 'NULL' if revisit == 'NULL' else "'" + revisit + "'::date"
    return service(db, f"SELECT public.allowance_request_decide('{rid}', '{actor}', {'true' if approve else 'false'}, {quote(code)}, {quote(reason)}, {date})")


refused(lambda: ask(10), 'ALLOWANCE_REQUEST_INVALID')
refused(lambda: ask(5), 'ALLOWANCE_REQUEST_INVALID')
refused(lambda: ask(15, 'because'), 'ALLOWANCE_REQUEST_INVALID')
refused(lambda: ask(15, 'other', "'" + 'x' * 121 + "'"), 'ALLOWANCE_REQUEST_INVALID')
check('a request must ask for more than the allowance is now, with a known reason and a short note')

refused(lambda: service(db, f"SELECT public.allowance_request_create('{teen}', 20, 'other', NULL)"), 'WALLET_HOLDER_REQUIRED')
refused(lambda: service(db, f"SELECT public.allowance_request_create('{adult}', 20, 'other', NULL)"), 'WALLET_HOLDER_REQUIRED')
check('only a child in a family can ask: a teen with no linked parent and an adult cannot')

first = ask(15, 'saving_goal', "'for a bike'")
assert service(db, f"SELECT status || ':' || from_amount || ':' || amount FROM public.allowance_requests WHERE id = '{first}'") == 'requested:10:15'
refused(lambda: ask(20), 'ALLOWANCE_REQUEST_OPEN')
assert allowance() == 10
check('one request waits at a time, and asking changes nothing about the allowance')

REASON = 'Save two more weeks and ask again'
refused(lambda: decide(first, parent, False, 'later_date', 'Not now', '2099-01-01'), 'DECISION_REASON_NOT_ACTIONABLE')
refused(lambda: decide(first, parent, False, 'NULL', REASON), 'DECISION_REASON_REQUIRED')
refused(lambda: decide(first, parent, False, 'later_date', REASON), 'DECISION_REVISIT_INVALID')
refused(lambda: decide(first, parent, False, 'not_suitable', REASON, '2099-01-01'), 'DECISION_REVISIT_INVALID')
refused(lambda: decide(first, parent, False, 'save_more', REASON), 'DECISION_REASON_REQUIRED')
check('a "not yet" needs a code from the closed set, a reason that says what to do next, and a date only for "later"')

refused(lambda: decide(first, stranger, True), 'ALLOWANCE_REQUEST_NOT_FOUND')
refused(lambda: decide(first, adult, True), 'ALLOWANCE_REQUEST_NOT_FOUND')
check('only a verified Tutor of this child can answer; anyone else sees nothing')

soon = service(db, "SELECT (current_date + 3)::text")
assert decide(first, parent, False, 'later_date', REASON, soon) == 'denied'
assert allowance() == 10
assert service(db, f"SELECT status || ':' || decision_code FROM public.allowance_requests WHERE id = '{first}'") == 'denied:later_date'
refused(lambda: decide(first, parent, True), 'ALLOWANCE_REQUEST_DECIDED')
check('a denial keeps the allowance, keeps its reason, and cannot be answered twice')

second = ask(18, 'more_needs')
assert decide(second, parent, True) == 'approved'
assert allowance() == 18
check('a yes makes the allowance the asked amount')

third = ask(25, 'other')
service(db, f"SELECT public.allowance_request_withdraw('{third}', '{kid}')")
assert service(db, f"SELECT status FROM public.allowance_requests WHERE id = '{third}'") == 'withdrawn'
refused(lambda: service(db, f"SELECT public.allowance_request_withdraw('{third}', '{kid}')"), 'ALLOWANCE_REQUEST_NOT_FOUND')
refused(lambda: decide(third, parent, True), 'ALLOWANCE_REQUEST_DECIDED')
assert allowance() == 18
check('a child takes a request back before it is answered; a taken-back request cannot be approved')

service(db, f"UPDATE public.allowance_rules SET active = false WHERE kid_user_id = '{kid}'")
refused(lambda: ask(30), 'ALLOWANCE_NONE')
service(db, f"UPDATE public.allowance_rules SET active = true WHERE kid_user_id = '{kid}'")
check('no active allowance, nothing to ask more of')

refused(lambda: browser(db, kid, f"INSERT INTO public.allowance_requests (kid_user_id, from_amount, amount, reason_kind) VALUES ('{kid}', 18, 40, 'other')"), 'permission denied')
refused(lambda: browser(db, kid, f"SELECT public.allowance_request_create('{kid}', 40, 'other', NULL)"), 'permission denied')
refused(lambda: service(db, "UPDATE public.allowance_requests SET status = 'approved'"), 'permission denied')
refused(lambda: service(db, "DELETE FROM public.allowance_requests"), 'permission denied')
assert browser(db, kid, "SELECT count(*) FROM public.allowance_requests") == '3'
assert browser(db, stranger, "SELECT count(*) FROM public.allowance_requests") == '0'
check('browser roles and the service role cannot write requests directly; a child reads their own, a stranger reads none')

sql(f'DROP DATABASE {db}')
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps({'checks': checks, 'count': len(checks), 'migrations': len(MIGRATIONS), 'last': MIGRATIONS[-1].name}, indent=2), encoding='utf-8')
print(f'wallet_moves + allowance_requests: {len(checks)} checks passed over {len(MIGRATIONS)} migrations (last {MIGRATIONS[-1].name})')
