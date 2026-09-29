"""D.3 (S07.2, OD-3 Option B): the independent teen wallet, enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on an owned native PostgreSQL cluster, over a
minimal Supabase shim (anon/authenticated/service_role roles, auth.users with
is_anonymous, auth.uid(), Supabase's default table grants and the realtime
publication). Then it attacks the teen wallet as every relevant population:
an eligible self-registered teen, a teen who later links a parent, an adult,
a guest who declared 13-17, a declared teen carrying the under-13 origin
marker, a teen whose profile birth date says 18, a staff account, a
parent-created child, a verified parent and an unrelated parent; through the
browser roles (direct data-gateway writes) and through the service role (a
Core defect), including real concurrency. It then proves the family mechanics
layer onto the same wallet once the teen links a parent, without moving or
losing a single row, and that the S07.1 child flows are unchanged.

A second database stops at the migration BEFORE the S07.2 parts and
reproduces the D.3 gap first (a teen has no wallet path at all, and nothing
stops the service role from writing a wallet for an adult).

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-teen-wallet-postgres.json)
  LF_PG_FULL_CHAIN=1  run every check over the WHOLE migration chain (later
               checkpoints redefine the ledger guard and teen_log_income)
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import subprocess
import uuid

from lf_pg_replay import assert_unchanged, fingerprint, replay_set

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-teen-wallet-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_2_PARTS = ['_independent_teen_wallet_schema.sql', '_independent_teen_wallet_guards.sql', '_independent_teen_wallet_ledger.sql',
               '_independent_teen_wallet_flows.sql', '_independent_teen_guardian_link.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_2_PARTS]
# LF_PG_FULL_CHAIN=1 runs every S07.2 check over the WHOLE migration chain
# (later checkpoints redefine the ledger guard and teen_log_income; the S07.2
# rules must still hold), and replays the S07.2 parts plus every later migration
# that redefines what they define (lf_pg_replay.replay_set).
FULL_CHAIN = os.environ.get('LF_PG_FULL_CHAIN') == '1'
TARGET = MIGRATIONS[-1] if FULL_CHAIN else PARTS[-1]
# Over the whole chain: the parts plus every later migration that redefines what they
# define, never the unrelated rest (an expand step cannot run after its own contract step).
REPLAY = replay_set(MIGRATIONS, PARTS) if FULL_CHAIN else PARTS
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def number_columns(database):
    """D.7 (F1-family): the retired card-shaped number is required on a chain that
    stops before its contract migration and gone after it. Returns the column
    list fragment and the value fragment for an INSERT into banking_accounts."""
    present = sql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' "
                  "AND table_name = 'banking_accounts' AND column_name = 'display_number'", database) == '1'
    return (', display_number', ", 'LF-1234-5678'") if present else ('', '')


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
    database = 'lf_teen_wallet_' + uuid.uuid4().hex
    sql(f'CREATE DATABASE {database}')
    sql(SHIM, database)
    for migration in MIGRATIONS:
        if migration.name > upto.name:
            break
        sql(migration.read_text(encoding='utf-8'), database)
    return database


def replay(database):
    """Over the whole chain, every function, trigger, policy and grant must come out
    of the replay exactly as the chain left it (lf_pg_replay)."""
    before = fingerprint(sql, database) if FULL_CHAIN else None
    for part in REPLAY:
        sql(part.read_text(encoding='utf-8'), database)
    if FULL_CHAIN:
        assert_unchanged(before, fingerprint(sql, database))


def claims(uid, role):
    body = json.dumps({'role': role, **({'sub': uid} if uid else {})})
    return (f"SELECT set_config('request.jwt.claims', '{body}', false), "
            f"set_config('request.jwt.claim.sub', '{uid or ''}', false), "
            f"set_config('request.jwt.claim.role', '{role}', false);\n")


def as_role(db, role, uid, query):
    out = sql(claims(uid, role) + f'SET ROLE {role};\n' + query, db)
    return '\n'.join(out.splitlines()[1:])  # drop the set_config echo


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


POPULATIONS = ['teen', 'teen_b', 'teen_l', 'adult', 'guest', 'origin', 'aged', 'staff', 'undeclared', 'kid',
               'parent_a', 'parent_t', 'stranger']


def people(db):
    ids = {name: str(uuid.uuid4()) for name in POPULATIONS}
    rows = ','.join(f"('{v}', {'true' if k == 'guest' else 'false'})" for k, v in ids.items())
    bands = {'teen': '13_to_17', 'teen_b': '13_to_17', 'teen_l': '13_to_17', 'guest': '13_to_17', 'origin': '13_to_17',
             'aged': '13_to_17', 'staff': '13_to_17', 'adult': 'adult', 'parent_a': 'adult', 'parent_t': 'adult', 'stranger': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    root = str(uuid.uuid4())
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
INSERT INTO public.account_safety_origins (user_id) VALUES ('{ids['origin']}');
UPDATE public.profiles SET birth_date = current_date - interval '18 years 2 days' WHERE user_id = '{ids['aged']}';
UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id = '{ids['teen']}';
INSERT INTO auth.users (id, email) VALUES ('{root}', 'root-{root[:8]}@littlefounders.ai');
INSERT INTO public.user_roles (user_id, role) VALUES ('{root}', 'superadmin') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) VALUES
  ('{ids['parent_a']}', 'parent'), ('{ids['parent_t']}', 'parent'), ('{ids['stranger']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role, granted_by) VALUES ('{ids['staff']}', 'admin', '{root}') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES ('{ids['parent_a']}', '{ids['kid']}', 'verified', now());
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['kid']}', 'kid') ON CONFLICT DO NOTHING;
""", db)
    return ids


def approved_task(db, parent, child, coins):
    task = str(uuid.uuid4())
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins) VALUES ('{task}', '{parent}', '{child}', 'Chore', {coins})")
    service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{task}'")
    service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{parent}', decided_at = now() WHERE id = '{task}'")
    return task


# ── 1. Reproduce the D.3 gap on the chain BEFORE this checkpoint ─────────────
previous = MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1]
before = fresh(previous)
p = people(before)
functions_before = sql("SELECT count(*) FROM pg_proc WHERE proname IN ('teen_log_income', 'wallet_access', 'teen_claim_personal_reward')", before)
assert functions_before == '0'
refused(lambda: service(before, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) VALUES ('{p['teen']}', '{p['teen']}', 'Self', 5)"), 'NOT_A_GUARDIAN')
service(before, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) VALUES ('{p['adult']}', 'spend', 50, 'allowance', '{p['adult']}')")
service(before, f"INSERT INTO public.savings_goals (kid_user_id, title, target) VALUES ('{p['adult']}', 'Car', 100)")
assert sql(f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{p['adult']}'", before) == '1'
check(f'before {PARTS[0].name}: a self-registered teen has no wallet path at all (no income, reward or access function; a chore needs a guardian), '
      'while the service role could still write a wallet ledger row and a savings goal for an ADULT (D.3 and OD-3 gaps reproduced)')

# ── 2. The full chain ────────────────────────────────────────────────────────
db = fresh(TARGET)
p = people(db)
teen, teen_b, teen_l, adult, kid, pa, pt, stranger = (p[k] for k in ['teen', 'teen_b', 'teen_l', 'adult', 'kid', 'parent_a', 'parent_t', 'stranger'])

kinds = {k: service(db, f"SELECT coalesce(public.wallet_holder_kind('{v}'), 'none')") for k, v in p.items()}
expected = {'teen': 'teen', 'teen_b': 'teen', 'teen_l': 'teen', 'adult': 'none', 'guest': 'none', 'origin': 'none', 'aged': 'none',
            'staff': 'none', 'undeclared': 'none', 'kid': 'managed_child', 'parent_a': 'none', 'parent_t': 'none', 'stranger': 'none'}
assert kinds == expected, kinds
access = json.loads(service(db, f"SELECT public.wallet_access('{kid}')"))
assert access == {'kind': 'managed_child', 'verified_guardians': 1}, access
check('eligibility by age, never role: only the declared 13-17 teens hold a teen wallet; adult, guest, under-13 origin, birth date past 17, '
      f'staff, undeclared and parent accounts hold none; the parent-created child keeps the family wallet ({json.dumps(kinds, sort_keys=True)})')

# Browser roles: no write path, no RPC.
for who in [teen, adult, kid, pa]:
    refused(lambda: browser(db, who, f"INSERT INTO public.personal_rewards (holder_user_id, title, cost) VALUES ('{teen}', 'x', 5)"), 'permission denied')
    refused(lambda: browser(db, who, f"INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, spend_amount) "
                                     f"VALUES ('self_income', '{teen}', 5, 'gift', 5)"), 'permission denied')
    refused(lambda: browser(db, who, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) "
                                     f"VALUES ('{teen}', 'spend', 5, 'self_income', '{teen}')"), 'permission denied')
    refused(lambda: browser(db, who, f"INSERT INTO public.savings_goals (kid_user_id, title, target) VALUES ('{teen}', 'x', 5)"), 'permission denied')
for fn in [f"public.teen_log_income('{teen}', 'gift', 0, 5, 0, NULL)", f"public.teen_create_personal_reward('{teen}', 'x', 5)",
           f"public.teen_claim_personal_reward('{teen}', '{uuid.uuid4()}')", f"public.teen_archive_personal_reward('{teen}', '{uuid.uuid4()}')",
           f"public.teen_release_goal('{teen}', '{uuid.uuid4()}', 1, 'spend')", f"public.teen_decide_guardian_link('{uuid.uuid4()}', '{teen}', true)",
           f"public.wallet_access('{teen}')", f"public.wallet_holder_kind('{teen}')", f"public.teen_wallet_holder('{teen}')",
           'public.teen_wallet_adoption(now())']:
    refused(lambda: browser(db, teen, f'SELECT {fn}'), 'permission denied')
    refused(lambda: as_role(db, 'anon', None, f'SELECT {fn}'), 'permission denied')
check('browser: the teen, an adult, a parent-created child and a parent cannot write personal rewards, self actions, ledger rows or goals; '
      'all ten new functions are refused to authenticated and anon')

# Service role: adults and every ineligible population are refused.
for who in ['adult', 'guest', 'origin', 'aged', 'staff', 'undeclared', 'kid', 'parent_a']:
    refused(lambda: service(db, f"SELECT public.teen_log_income('{p[who]}', 'gift', 0, 5, 0, NULL)"), 'TEEN_WALLET_REQUIRED')
    refused(lambda: service(db, f"SELECT public.teen_create_personal_reward('{p[who]}', 'Movie', 5)"), 'TEEN_WALLET_REQUIRED')
for who in ['adult', 'guest', 'origin', 'aged', 'staff', 'undeclared', 'parent_a']:
    refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) "
                                f"VALUES ('{p[who]}', 'spend', 50, 'allowance', '{p[who]}')"), 'WALLET_HOLDER_REQUIRED')
    refused(lambda: service(db, f"INSERT INTO public.savings_goals (kid_user_id, title, target) VALUES ('{p[who]}', 'Car', 100)"), 'WALLET_HOLDER_REQUIRED')
check('service role: income and personal rewards are refused for the adult, guest, under-13 origin, aged-out, staff, undeclared, '
      'parent-created child and parent accounts; a ledger row or a goal for any non-holder is refused (no adult wallet, whoever writes)')

for bad in ["NULL, 0, 5, 0, NULL", "'salary', 0, 5, 0, NULL", "'gift', 0, 0, 0, NULL", "'gift', 0, 1001, 0, NULL",
            "'gift', -1, 6, 0, NULL", f"'gift', 0, 5, 0, '{uuid.uuid4()}'"]:
    refused(lambda: service(db, f"SELECT public.teen_log_income('{teen}', {bad})"), 'SELF_INCOME_INVALID')
goal = str(uuid.uuid4())
service(db, f"INSERT INTO public.savings_goals (id, kid_user_id, title, target) VALUES ('{goal}', '{teen}', 'Headphones', 10)")
other_goal = str(uuid.uuid4())
service(db, f"INSERT INTO public.savings_goals (id, kid_user_id, title, target) VALUES ('{other_goal}', '{teen_b}', 'Bike', 10)")
refused(lambda: service(db, f"SELECT public.teen_log_income('{teen}', 'gift', 5, 0, 0, '{other_goal}')"), 'GOAL_NOT_ACTIVE')
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, spend_amount) VALUES ('self_income', '{teen}', 5, 'gift', 5);
COMMIT;"""), 'WALLET_ACTION_UNBALANCED')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) "
                            f"VALUES ('{teen}', 'spend', 500, 'self_income', '{teen}')"), 'LEDGER_SELF_ACTION_REQUIRED')
refused(lambda: service(db, f"""BEGIN;
WITH a AS (INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, spend_amount) VALUES ('self_income', '{teen}', 5, 'gift', 5) RETURNING id)
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id) SELECT '{teen}', 'spend', 500, 'self_income', '{teen}', id FROM a;
COMMIT;"""), 'LEDGER_SELF_ACTION_MISMATCH')
refused(lambda: service(db, f"""BEGIN;
WITH a AS (INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, spend_amount) VALUES ('self_income', '{teen}', 5, 'gift', 5) RETURNING id)
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id) SELECT '{teen}', 'spend', 5, 'self_income', '{pa}', id FROM a;
COMMIT;"""), 'LEDGER_SELF_ACTION_REQUIRED')
refused(lambda: service(db, f"""BEGIN;
WITH a AS (INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, spend_amount) VALUES ('self_income', '{teen}', 5, 'gift', 5) RETURNING id)
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, self_action_id) SELECT '{teen}', 'spend', 5, 'allowance', '{teen}', id FROM a;
COMMIT;"""), 'LEDGER_REASON_INVALID')
refused(lambda: service(db, f"INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, source, spend_amount) "
                            f"VALUES ('self_income', '{adult}', 5, 'gift', 5)"), 'TEEN_WALLET_REQUIRED')
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{teen}'") == '0'
check('service role: bad source, empty, oversized, negative and goal-without-save income, another teen\'s goal, an action with no ledger rows '
      '(refused at commit), a bare ledger row, a mismatched amount, a row written by someone else, a borrowed action and an adult action are all refused; nothing was written')

# Happy path: log, split, goal reached in the same action.
action = service(db, f"SELECT public.teen_log_income('{teen}', 'earned', 10, 6, 4, '{goal}')")
balances = service(db, f"SELECT string_agg(bucket || '=' || total, ',' ORDER BY bucket) FROM (SELECT bucket, sum(amount) AS total FROM public.wallet_ledger WHERE kid_user_id = '{teen}' GROUP BY bucket) b")
assert balances == 'save=10,share=4,spend=6', balances
assert service(db, f"SELECT status || ':' || (reached_at IS NOT NULL)::text FROM public.savings_goals WHERE id = '{goal}'") == 'reached:true'
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE self_action_id = '{action}'") == '3'
assert service(db, f"SELECT count(*) FROM public.audit_logs WHERE action = 'wallet.self_income' AND subject = '{teen}'") == '1'
assert service(db, f"SELECT count(*) FROM public.family_state_audit WHERE table_name = 'savings_goals' AND row_id = '{goal}' AND to_state = 'reached'") == '1'
assert service(db, "SELECT count(*) FROM public.tasks WHERE status = 'done'") == '0'
check(f'flow: the teen logs 20 earned coins split 10/6/4 with Save aimed at a 10-coin goal in one action and no approval step -> {balances}, '
      'three ledger rows pointing at the action, the goal reached in the same transaction and audited')

reward = service(db, f"SELECT public.teen_create_personal_reward('{teen}', '  Movie night ', 5)")
assert service(db, f"SELECT title || '/' || cost || '/' || status FROM public.personal_rewards WHERE id = '{reward}'") == 'Movie night/5/active'
for bad in ["''", "'   '", f"'{'x' * 61}'"]:
    refused(lambda: service(db, f"SELECT public.teen_create_personal_reward('{teen}', {bad}, 5)"), 'PERSONAL_REWARD_INVALID')
for bad in ['0', '501', 'NULL']:
    refused(lambda: service(db, f"SELECT public.teen_create_personal_reward('{teen}', 'x', {bad})"), 'PERSONAL_REWARD_INVALID')
claim = service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward}')")
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{teen}' AND bucket = 'spend'") == '1'
refused(lambda: service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward}')"), 'INSUFFICIENT_BALANCE')
refused(lambda: service(db, f"SELECT public.teen_claim_personal_reward('{teen_b}', '{reward}')"), 'PERSONAL_REWARD_UNAVAILABLE')
refused(lambda: service(db, f"UPDATE public.personal_rewards SET cost = 1 WHERE id = '{reward}'"), 'PERSONAL_REWARD_IMMUTABLE')
refused(lambda: service(db, f"UPDATE public.personal_rewards SET holder_user_id = '{teen_b}' WHERE id = '{reward}'"), 'PERSONAL_REWARD_IMMUTABLE')
refused(lambda: service(db, f"INSERT INTO public.personal_rewards (holder_user_id, title, cost, status, archived_at) VALUES ('{teen}', 'x', 5, 'archived', now())"),
        'PERSONAL_REWARD_STATE_INVALID')
refused(lambda: service(db, f"SELECT public.teen_archive_personal_reward('{teen_b}', '{reward}')"), 'PERSONAL_REWARD_NOT_FOUND')
assert service(db, f"SELECT public.teen_archive_personal_reward('{teen}', '{reward}')") == 't'
assert service(db, f"SELECT public.teen_archive_personal_reward('{teen}', '{reward}')") == 'f'
refused(lambda: service(db, f"UPDATE public.personal_rewards SET status = 'active', archived_at = NULL WHERE id = '{reward}'"), 'PERSONAL_REWARD_TRANSITION_FORBIDDEN')
refused(lambda: service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward}')"), 'PERSONAL_REWARD_UNAVAILABLE')
for i in range(20):
    service(db, f"SELECT public.teen_create_personal_reward('{teen_b}', 'Treat {i}', 1)")
refused(lambda: service(db, f"SELECT public.teen_create_personal_reward('{teen_b}', 'One more', 1)"), 'PERSONAL_REWARD_LIMIT')
check('personal rewards: the teen defines "Movie night" (trimmed), marks it and 5 coins leave Spend at once; a second mark without coins, '
      'another teen marking it, cost/owner edits, an archived insert, archiving someone else\'s, un-archiving and marking an archived reward '
      'are refused; archive is idempotent; the 21st active reward is refused')

refused(lambda: service(db, f"SELECT public.teen_release_goal('{teen}', '{goal}', 11, 'spend')"), 'GOAL_BALANCE_INSUFFICIENT')
refused(lambda: service(db, f"SELECT public.teen_release_goal('{teen_b}', '{goal}', 1, 'spend')"), 'GOAL_NOT_FOUND')
refused(lambda: service(db, f"SELECT public.teen_release_goal('{teen}', '{goal}', 1, 'share')"), 'GOAL_RELEASE_INVALID')
refused(lambda: service(db, f"SELECT public.teen_release_goal('{teen}', '{goal}', 0, 'spend')"), 'GOAL_RELEASE_INVALID')
release = service(db, f"SELECT public.teen_release_goal('{teen}', '{goal}', 4, 'spend')")
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE goal_id = '{goal}'") == '6'
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{teen}' AND bucket = 'spend'") == '5'
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE self_action_id = '{release}'") == '0'
refused(lambda: service(db, f"""BEGIN;
INSERT INTO public.wallet_self_actions (kind, holder_user_id, amount, goal_id, destination) VALUES ('goal_release', '{teen}', 2, '{goal}', 'spend');
COMMIT;"""), 'WALLET_ACTION_UNBALANCED')
refused(lambda: service(db, f"UPDATE public.wallet_ledger SET amount = 999 WHERE self_action_id = '{release}'"), 'permission denied')
refused(lambda: sql(f"UPDATE public.wallet_ledger SET amount = 999 WHERE self_action_id = '{release}'", db), 'LEDGER_APPEND_ONLY')
refused(lambda: service(db, f"UPDATE public.wallet_self_actions SET amount = 999 WHERE id = '{release}'"), 'permission denied')
refused(lambda: sql(f"UPDATE public.wallet_self_actions SET amount = 999 WHERE id = '{release}'", db), 'WALLET_ACTION_APPEND_ONLY')
refused(lambda: service(db, f"DELETE FROM public.wallet_self_actions WHERE id = '{release}'"), 'permission denied')
check('goal release: the teen moves 4 coins from their own goal to Spend as one balanced pair; releasing more than the goal holds, someone '
      'else\'s goal, to Share, zero, or a half-written release are refused; the ledger and the action log are append-only (service role and owner)')

# Tasks and approvals stay guardian-only.
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) VALUES ('{teen}', '{teen}', 'Self', 5)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) VALUES ('{stranger}', '{teen}', 'x', 5)"), 'NOT_A_GUARDIAN')
foreign = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{foreign}', '{stranger}', 'Other', 1)")
refused(lambda: service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{foreign}', '{teen}')"), 'REWARD_UNAVAILABLE')
check('tasks and approvals stay guardian-only: an unlinked teen cannot assign themself a chore, a stranger cannot assign one, and a '
      'reward request against a stranger\'s catalog is refused')

# ── 3. The teen links a parent later; the family mechanics layer on top ─────
refused(lambda: service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) "
                            f"VALUES ('{teen}', '{pt}', 'forged-{uuid.uuid4().hex}', now() + interval '7 days')"), 'TEEN_INVITES_OWN_GUARDIAN')
refused(lambda: service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) "
                            f"VALUES ('{kid}', '{stranger}', 'forged-{uuid.uuid4().hex}', now() + interval '7 days')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) "
                            f"VALUES ('{adult}', '{adult}', 'forged-{uuid.uuid4().hex}', now() + interval '7 days')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) "
                            f"VALUES ('{teen}', '{teen}', 'long-{uuid.uuid4().hex}', now() + interval '30 days')"), 'GUARDIAN_INVITE_INVALID')
tokens = [f'teen-{uuid.uuid4().hex}' for _ in range(3)]
for token in tokens:
    service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{teen}', '{teen}', '{token}', now() + interval '7 days')")
refused(lambda: service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) "
                            f"VALUES ('{teen}', '{teen}', 'fourth-{uuid.uuid4().hex}', now() + interval '7 days')"), 'GUARDIAN_INVITE_LIMIT')
kid_token = f'kid-{uuid.uuid4().hex}'
service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{kid}', '{pa}', '{kid_token}', now() + interval '7 days')")
check('invites: a parent cannot issue an invite for a teen\'s account (only the teen can), a stranger or an adult cannot issue one for '
      'anyone, a 30-day invite and a fourth outstanding teen invite are refused; a verified guardian still invites for a parent-created child')

refused(lambda: service(db, f"SELECT public.accept_guardian_invite('{tokens[0]}', '{teen}')"), 'INVALID_GUARDIAN_INVITE')
refused(lambda: service(db, f"SELECT public.accept_guardian_invite('{tokens[0]}', '{adult}')"), 'INVALID_GUARDIAN_INVITE')
refused(lambda: service(db, f"SELECT public.accept_guardian_invite('{tokens[0]}', '{teen_b}')"), 'INVALID_GUARDIAN_INVITE')
snapshot = lambda: service(db, f"""SELECT (SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{teen}') || '/' ||
  (SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE kid_user_id = '{teen}') || '/' ||
  (SELECT count(*) FROM public.savings_goals WHERE kid_user_id = '{teen}') || '/' ||
  (SELECT count(*) FROM public.personal_rewards WHERE holder_user_id = '{teen}') || '/' ||
  (SELECT count(*) FROM public.wallet_self_actions WHERE holder_user_id = '{teen}')""")
before_link = snapshot()
assert service(db, f"SELECT public.accept_guardian_invite('{tokens[0]}', '{pt}')") == teen
link = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{pt}' AND kid_user_id = '{teen}'")
assert service(db, f"SELECT verification_status FROM public.guardian_links WHERE id = '{link}'") == 'pending'
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) VALUES ('{pt}', '{teen}', 'x', 5)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.decide_guardian_link('{link}', '{pt}', true)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.decide_guardian_link('{link}', '{pa}', true)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'verified', verified_at = now(), decided_by = '{pt}', decided_at = now() WHERE id = '{link}'"),
        'GUARDIAN_LINK_DECISION_INVALID')
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'verified', verified_at = now(), decided_by = '{stranger}', decided_at = now() WHERE id = '{link}'"),
        'GUARDIAN_LINK_DECISION_INVALID')
refused(lambda: service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen_b}', true)"), 'GUARDIAN_LINK_NOT_FOUND')
refused(lambda: service(db, f"SELECT public.accept_guardian_invite('{tokens[0]}', '{stranger}')"), 'INVALID_GUARDIAN_INVITE')
assert service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen}', true)") == 'verified'
refused(lambda: service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen}', false)"), 'GUARDIAN_LINK_NOT_PENDING')
assert snapshot() == before_link, (before_link, snapshot())
assert json.loads(service(db, f"SELECT public.wallet_access('{teen}')")) == {'kind': 'teen', 'verified_guardians': 1}
check(f'link: the teen themself, an adult without the parent role and another teen cannot accept the teen\'s invite; the parent\'s acceptance '
      'is PENDING and grants nothing (no chore, no confirming it themself, no other family\'s Tutor confirming it, no forged decision); only '
      f'the teen confirms; the wallet is byte-for-byte the same before and after linking (rows/sum/goals/rewards/actions {before_link})')

# The existing family mechanics now work on the SAME wallet.
task = approved_task(db, pt, teen, 8)
assert service(db, f"SELECT public.allocate_task_reward('{task}', '{teen}', 0, 8, 0, '{teen}', NULL)") == 't'
catalog = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{catalog}', '{pt}', 'Cinema', 6)")
red = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemptions (id, catalog_id, kid_user_id) VALUES ('{red}', '{catalog}', '{teen}')")
assert service(db, f"SELECT public.decide_redemption('{red}', true, '{pt}')") == 't'
action_id = service(db, f"SELECT public.guardian_adjust_wallet('{teen}', '{pt}', 'share', 3, 'Birthday gift')")
assert service(db, f"SELECT public.teen_log_income('{teen}', 'gift', 0, 2, 0, NULL)") != ''
spend = service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{teen}' AND bucket = 'spend'")
assert spend == str(5 + 8 - 6 + 2), spend
reasons = service(db, f"SELECT string_agg(DISTINCT reason, ',' ORDER BY reason) FROM public.wallet_ledger WHERE kid_user_id = '{teen}'")
check(f'layering: once linked, the parent\'s chore (approved, allocated by the teen), reward catalog request and approval, and a Tutor '
      f'correction land on the same ledger next to the teen\'s own income, which still needs no approval (reasons: {reasons}; spend {spend})')

service(db, f"INSERT INTO public.banking_accounts (kid_user_id{number_columns(db)[0]}, opened_by) VALUES ('{teen}'{number_columns(db)[1]}, '{pt}')")
service(db, f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{pt}', frozen_at = now() WHERE kid_user_id = '{teen}'")
refused(lambda: service(db, f"SELECT public.teen_log_income('{teen}', 'gift', 0, 2, 0, NULL)"), 'ACCOUNT_FROZEN')
reward2 = service(db, f"SELECT public.teen_create_personal_reward('{teen}', 'Snack', 2)")
refused(lambda: service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward2}')"), 'ACCOUNT_FROZEN')
refused(lambda: service(db, f"SELECT public.teen_release_goal('{teen}', '{goal}', 1, 'spend')"), 'ACCOUNT_FROZEN')
refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{teen}', frozen_at = NULL WHERE kid_user_id = '{teen}'"),
        'FREEZE_OWNED_BY_GUARDIAN')
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{pt}', frozen_at = NULL WHERE kid_user_id = '{teen}'")
service(db, f"INSERT INTO public.spend_limits (kid_user_id, parent_user_id, period, cap) VALUES ('{teen}', '{pt}', 'weekly', 7)")
refused(lambda: service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward2}')"), 'SPEND_LIMIT_REACHED')
service(db, f"UPDATE public.spend_limits SET cap = 20 WHERE kid_user_id = '{teen}'")
assert service(db, f"SELECT public.teen_claim_personal_reward('{teen}', '{reward2}')") != ''
check('guardian controls hold on the teen\'s own actions once linked: a parent\'s freeze stops logged income, a personal reward and a goal '
      'release (and the teen cannot lift it); the parent\'s weekly limit counts the approved request (6) and the teen\'s earlier '
      'personal reward (5) together, refuses a 2-coin reward over a cap of 7, then admits it once the cap is raised to 20')

# ── 4. S07.1 child flows unchanged ──────────────────────────────────────────
ktask = approved_task(db, pa, kid, 5)
assert service(db, f"SELECT public.allocate_task_reward('{ktask}', '{kid}', 2, 3, 0, '{kid}', NULL)") == 't'
assert service(db, f"SELECT public.accept_guardian_invite('{kid_token}', '{pt}')") == kid
assert service(db, f"SELECT verification_status FROM public.guardian_links WHERE parent_user_id = '{pt}' AND kid_user_id = '{kid}'") == 'pending'
klink = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{pt}' AND kid_user_id = '{kid}'")
refused(lambda: service(db, f"SELECT public.teen_decide_guardian_link('{klink}', '{kid}', true)"), 'GUARDIAN_LINK_NOT_FOUND')
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'verified', verified_at = now(), decided_by = '{kid}', decided_at = now() WHERE id = '{klink}'"),
        'GUARDIAN_LINK_DECISION_INVALID')
assert service(db, f"SELECT public.decide_guardian_link('{klink}', '{pa}', true)") == 'verified'
refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{adult}', '{pa}', 'spend', 5, 'x')"), 'NOT_A_GUARDIAN')
check('regression: a parent-created child still allocates an approved chore; a second Tutor invited by the verified guardian is still '
      'pending and confirmed by that guardian, never by the child')

# ── 5. Concurrency ──────────────────────────────────────────────────────────
service(db, f"SELECT public.teen_log_income('{teen_l}', 'allowance', 0, 12, 0, NULL)")
cheap = service(db, f"SELECT public.teen_create_personal_reward('{teen_l}', 'Game', 5)")


def claim_once(_):
    try:
        service(db, f"SELECT public.teen_claim_personal_reward('{teen_l}', '{cheap}')")
        return 'ok'
    except RuntimeError as error:
        assert 'INSUFFICIENT_BALANCE' in str(error), error
        return 'refused'


with ThreadPoolExecutor(max_workers=8) as pool:
    outcomes = list(pool.map(claim_once, range(8)))
assert outcomes.count('ok') == 2, outcomes
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{teen_l}' AND bucket = 'spend'") == '2'

token_l = f'teen-{uuid.uuid4().hex}'
service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{teen_l}', '{teen_l}', '{token_l}', now() + interval '7 days')")
service(db, f"SELECT public.accept_guardian_invite('{token_l}', '{stranger}')")
link_l = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{stranger}' AND kid_user_id = '{teen_l}'")


def decide(i):
    try:
        return service(db, f"SELECT public.teen_decide_guardian_link('{link_l}', '{teen_l}', {'true' if i % 2 else 'false'})")
    except RuntimeError as error:
        assert 'GUARDIAN_LINK_NOT_PENDING' in str(error), error
        return 'conflict'


with ThreadPoolExecutor(max_workers=8) as pool:
    decisions = list(pool.map(decide, range(8)))
assert decisions.count('conflict') == 7, decisions
assert service(db, f"SELECT count(*) FROM public.audit_logs WHERE subject = '{teen_l}' AND action IN ('family.teen_guardian_confirmed', 'family.teen_guardian_rejected')") == '1'
check(f'concurrency: 8 simultaneous marks of a 5-coin personal reward against 12 coins -> exactly 2 succeed and Spend ends at 2, never '
      f'negative; 8 simultaneous opposite teen decisions on one pending parent -> exactly one decision ({[d for d in decisions if d != "conflict"][0]}) and one audit row')

# ── 6. Metrics and replay ───────────────────────────────────────────────────
adoption = service(db, "SELECT eligible_teens || '/' || adopters || '/' || independent_adopters || '/' || linked_adopters || '/' || new_adopters FROM public.teen_wallet_adoption(now() - interval '1 hour')")
linked_l = service(db, f"SELECT count(*) FROM public.guardian_links WHERE kid_user_id = '{teen_l}' AND verification_status = 'verified'")
expected_adoption = f"3/3/{1 if linked_l == '1' else 2}/{2 if linked_l == '1' else 1}/3"
assert adoption == expected_adoption, (adoption, expected_adoption)
integrity = service(db, "SELECT string_agg(table_name || ':' || transitions || ':' || outside_service, ',' ORDER BY table_name) FROM public.family_state_integrity(now() - interval '1 hour')")
assert 'personal_rewards:1:0' in integrity, integrity
check(f'metrics: Teen Independent-Mode Adoption (eligible/adopters/independent/linked/new) = {adoption}, counting only eligible teens; '
      f'the D.4 integrity metric now includes the personal-reward transitions, all through the service layer ({integrity})')

counts = lambda: service(db, "SELECT (SELECT count(*) FROM public.wallet_ledger) || '/' || (SELECT count(*) FROM public.wallet_self_actions) || '/' || "
                             "(SELECT count(*) FROM public.personal_rewards) || '/' || (SELECT count(*) FROM public.guardian_links)")
before_replay = counts()
replay(db)
assert counts() == before_replay
refused(lambda: service(db, f"SELECT public.teen_log_income('{adult}', 'gift', 0, 5, 0, NULL)"), 'TEEN_WALLET_REQUIRED')
check(f'replay: re-applying the five S07.2 migrations preserves ledger/actions/rewards/links ({before_replay}) and the refusals')

report = {
    'passed': True,
    'database': db,
    'reproduction_database': before,
    'migrations': [part.name for part in PARTS],
    'applied_through': TARGET.name,
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim; '
                  'browser roles exercised through SET ROLE with request.jwt claims, concurrency through parallel '
                  'sessions. Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
