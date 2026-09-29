"""D.4 / D.5 (S07.1): the Family Hub state machine, enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on an owned native PostgreSQL cluster, over a
minimal Supabase shim (anon/authenticated/service_role roles, auth.users,
auth.uid(), Supabase's default table grants and the realtime publication).
Then it attacks the Family Hub tables as every relevant population — a
parent-created kid, a verified guardian Tutor, a pending second adult, an
unrelated verified adult, an independent teen and the anonymous role — both
through the browser roles (direct data-gateway writes) and through the
service role (a Core defect), and exercises every OD-21 producing flow,
including real concurrency.

A second database stops at the migration BEFORE the S07.1 ones and reproduces
the D.4 defect first, so the report shows the gap and its closure.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-family-state-postgres.json)
  LF_PG_FULL_CHAIN=1  run every check over the WHOLE migration chain (later
               migrations included), so a later redefinition of an S07.1
               function is regression-tested against the same checks, and
               replay the S07.1 parts plus every later migration that redefines
               what they define (lf_pg_replay.replay_set)
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
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-family-state-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_PARTS = ['_family_hub_state_machine.sql', '_family_hub_transition_guards.sql', '_family_hub_wallet_integrity.sql',
             '_family_hub_guardian_link_lifecycle.sql', '_family_hub_lifecycle_flows.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_PARTS]
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
    database = 'lf_family_state_' + uuid.uuid4().hex
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


def people(db):
    ids = {name: str(uuid.uuid4()) for name in ['parent_a', 'parent_b', 'stranger', 'kid', 'teen', 'adult']}
    rows = ','.join(f"('{v}')" for v in ids.values())
    sql(f"""
INSERT INTO auth.users (id) VALUES {rows};
INSERT INTO public.user_roles (user_id, role) VALUES
  ('{ids['parent_a']}', 'parent'), ('{ids['parent_b']}', 'parent'), ('{ids['stranger']}', 'parent'),
  ('{ids['teen']}', 'universal'), ('{ids['adult']}', 'universal') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES ('{ids['parent_a']}', '{ids['kid']}', 'verified', now());
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['kid']}', 'kid') ON CONFLICT DO NOTHING;
""", db)
    return ids


# ── 1. Reproduce the D.4 gap on the chain BEFORE this migration ─────────────
previous = MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1]
before = fresh(previous)
p = people(before)
task = str(uuid.uuid4())
sql(f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins, status) "
    f"VALUES ('{task}', '{p['parent_a']}', '{p['kid']}', 'Dishes', 5, 'open')", before)
browser(before, p['kid'], f"UPDATE public.tasks SET status = 'approved' WHERE id = '{task}'")
assert sql(f"SELECT status FROM public.tasks WHERE id = '{task}'", before) == 'approved'
catalog = str(uuid.uuid4())
sql(f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{catalog}', '{p['parent_a']}', 'Movie', 50)", before)
browser(before, p['kid'], f"INSERT INTO public.redemptions (catalog_id, kid_user_id, status) VALUES ('{catalog}', '{p['kid']}', 'approved')")
assert sql("SELECT count(*) FROM public.redemptions WHERE status = 'approved'", before) == '1'
assert sql("SELECT count(*) FROM public.wallet_ledger", before) == '0'
check(f'before {PARTS[0].name}: a kid browser session approved its own task and inserted an already-approved, unpaid redemption (D.4 reproduced)')

# ── 2. The full chain, including this migration ──────────────────────────────
db = fresh(TARGET)
p = people(db)
kid, pa, pb, stranger, teen = p['kid'], p['parent_a'], p['parent_b'], p['stranger'], p['teen']

# Browser roles: every write path is gone, reads are unchanged.
task = str(uuid.uuid4())
service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins, requires_evidence) "
            f"VALUES ('{task}', '{pa}', '{kid}', 'Dishes', 5, true)")
for who in ['kid', 'parent_a', 'stranger', 'teen']:
    refused(lambda: browser(db, p[who], f"UPDATE public.tasks SET status = 'approved' WHERE id = '{task}'"), 'permission denied')
    refused(lambda: browser(db, p[who], f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) "
                                        f"VALUES ('{pa}', '{kid}', 'x', 5)"), 'permission denied')
refused(lambda: as_role(db, 'anon', None, f"UPDATE public.tasks SET status = 'approved' WHERE id = '{task}'"), 'permission denied')
assert browser(db, kid, f"SELECT count(*) FROM public.tasks WHERE id = '{task}'") == '1'
assert browser(db, pa, f"SELECT count(*) FROM public.tasks WHERE id = '{task}'") == '1'
assert browser(db, stranger, f"SELECT count(*) FROM public.tasks WHERE id = '{task}'") == '0'
check('browser: kid, guardian, unrelated adult, independent teen and anon cannot insert or transition a task; reads unchanged (kid/guardian 1 row, stranger 0)')

catalog = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{catalog}', '{pa}', 'Movie', 5)")
refused(lambda: browser(db, kid, f"INSERT INTO public.redemptions (catalog_id, kid_user_id, status) VALUES ('{catalog}', '{kid}', 'approved')"), 'permission denied')
refused(lambda: browser(db, kid, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{catalog}', '{kid}')"), 'permission denied')
refused(lambda: browser(db, pa, f"INSERT INTO public.redemption_catalog (parent_user_id, title, cost) VALUES ('{pa}', 'x', 9999)"), 'permission denied')
refused(lambda: browser(db, kid, f"INSERT INTO public.savings_goals (kid_user_id, title, target) VALUES ('{kid}', 'Bike', 10)"), 'permission denied')
refused(lambda: browser(db, kid, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) "
                                 f"VALUES ('{kid}', 'spend', 100, 'manual_adjustment', '{kid}')"), 'permission denied')
refused(lambda: browser(db, pa, f"INSERT INTO public.wallet_guardian_actions (kind, kid_user_id, actor_user_id, bucket, amount, reason) "
                                f"VALUES ('manual_adjustment', '{kid}', '{pa}', 'spend', 100, 'gift')"), 'permission denied')
refused(lambda: browser(db, pa, f"UPDATE public.guardian_links SET verification_status = 'revoked' WHERE kid_user_id = '{kid}'"), 'permission denied')
refused(lambda: browser(db, pb, f"INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) "
                                f"VALUES ('{pb}', '{kid}', 'verified', now())"), 'permission denied')
refused(lambda: browser(db, pa, 'SELECT count(*) FROM public.family_state_audit'), 'permission denied')
for fn in [f"public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', 100, 'gift')",
           f"public.fulfill_redemption('{uuid.uuid4()}', '{pa}')",
           f"public.guardian_withdraw_goal('{uuid.uuid4()}', '{pa}', 1, 'spend', 'x')",
           f"public.decide_guardian_link('{uuid.uuid4()}', '{pa}', true)",
           f"public.revoke_own_guardian_link('{kid}', '{pa}')",
           "public.family_state_integrity(now())"]:
    refused(lambda: browser(db, pa, f'SELECT {fn}'), 'permission denied')
    refused(lambda: as_role(db, 'anon', None, f'SELECT {fn}'), 'permission denied')
check('browser: redemption/catalog/goal/ledger/guardian-action/guardian-link writes, the transition audit and all six new RPCs are refused to authenticated and anon')

# Service role: the state machine holds even for a Core defect.
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'approved' WHERE id = '{task}'"), 'TASK_TRANSITION_FORBIDDEN')
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins, status) "
                            f"VALUES ('{pa}', '{kid}', 'x', 5, 'approved')"), 'TASK_STATE_INVALID')
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) "
                            f"VALUES ('{stranger}', '{kid}', 'x', 5)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) "
                            f"VALUES ('{pa}', '{kid}', 'x', 501)"), 'TASK_REWARD_OUT_OF_RANGE')
service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{task}'")
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{pa}', decided_at = now() WHERE id = '{task}'"), 'TASK_EVIDENCE_REQUIRED')
service(db, f"UPDATE public.tasks SET evidence_bucket = 'b', evidence_hash = 'h', evidence_ext = 'jpg', evidence_uploaded_at = now() WHERE id = '{task}'")
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{stranger}', decided_at = now() WHERE id = '{task}'"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{kid}', decided_at = now() WHERE id = '{task}'"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'approved' WHERE id = '{task}'"), 'NOT_A_GUARDIAN')
service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{pa}', decided_at = now() WHERE id = '{task}'")
refused(lambda: service(db, f"UPDATE public.tasks SET evidence_hash = 'other' WHERE id = '{task}'"), 'TASK_EVIDENCE_LOCKED')
refused(lambda: service(db, f"UPDATE public.tasks SET reward_coins = 500 WHERE id = '{task}'"), 'TASK_IMMUTABLE_FIELD')
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'open' WHERE id = '{task}'"), 'TASK_TRANSITION_FORBIDDEN')
refused(lambda: service(db, f"UPDATE public.tasks SET decided_by = '{pb}' WHERE id = '{task}'"), 'TASK_DECISION_IMMUTABLE')
assert service(db, f"SELECT public.allocate_task_reward('{task}', '{kid}', 0, 5, 0, '{kid}', NULL)") == 't'
refused(lambda: service(db, f"UPDATE public.tasks SET allocated = false WHERE id = '{task}'"), 'TASK_ALLOCATION_INVALID')
check('service role: open->approved skip, pre-approved insert, stranger assigner, over-cap reward, approval without the required photo, approval by stranger/kid/nobody, evidence after decision, reward edit, approved->open and un-allocation all refused; the legitimate open->done->approved->allocated path passes')

goal = str(uuid.uuid4())
service(db, f"INSERT INTO public.savings_goals (id, kid_user_id, title, target) VALUES ('{goal}', '{kid}', 'Bike', 6)")
refused(lambda: service(db, f"UPDATE public.savings_goals SET status = 'reached', reached_at = now() WHERE id = '{goal}'"), 'GOAL_NOT_REACHED')
refused(lambda: service(db, f"UPDATE public.savings_goals SET target = 1 WHERE id = '{goal}'"), 'GOAL_IMMUTABLE_FIELD')
refused(lambda: service(db, f"INSERT INTO public.savings_goals (kid_user_id, title, target, status) VALUES ('{kid}', 'x', 5, 'reached')"), 'GOAL_STATE_INVALID')
task2 = str(uuid.uuid4())
service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins) VALUES ('{task2}', '{pa}', '{kid}', 'Bins', 10)")
service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{task2}'")
service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{pa}', decided_at = now() WHERE id = '{task2}'")
assert service(db, f"SELECT public.allocate_task_reward('{task2}', '{kid}', 6, 4, 0, '{kid}', '{goal}')") == 't'
# From S07.4 (wallet_usual_split) the allocation itself reaches a covered goal in
# the same transaction; before it, Core flipped the status in a second step.
if service(db, f"SELECT status FROM public.savings_goals WHERE id = '{goal}'") != 'reached':
    service(db, f"UPDATE public.savings_goals SET status = 'reached', reached_at = now() WHERE id = '{goal}'")
refused(lambda: service(db, f"UPDATE public.savings_goals SET status = 'active', reached_at = NULL WHERE id = '{goal}'"), 'GOAL_TRANSITION_FORBIDDEN')
check('service role: a goal cannot be marked reached without tagged savings covering the target, cannot change its target, cannot be created reached and cannot move back to active')

red = str(uuid.uuid4())
refused(lambda: service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id, status) VALUES ('{catalog}', '{kid}', 'approved')"), 'REDEMPTION_STATE_INVALID')
foreign = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{foreign}', '{stranger}', 'Other', 1)")
refused(lambda: service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{foreign}', '{kid}')"), 'REWARD_UNAVAILABLE')
refused(lambda: service(db, f"INSERT INTO public.redemption_catalog (parent_user_id, title, cost) VALUES ('{pa}', 'x', 501)"), 'CATALOG_COST_OUT_OF_RANGE')
service(db, f"INSERT INTO public.redemptions (id, catalog_id, kid_user_id) VALUES ('{red}', '{catalog}', '{kid}')")
refused(lambda: service(db, f"UPDATE public.redemptions SET status = 'approved', decided_by = '{pa}', decided_at = now() WHERE id = '{red}'"), 'REDEMPTION_NOT_PAID')
refused(lambda: service(db, f"UPDATE public.redemptions SET status = 'fulfilled', fulfilled_by = '{pa}', fulfilled_at = now() WHERE id = '{red}'"), 'REDEMPTION_TRANSITION_FORBIDDEN')
assert service(db, f"SELECT public.decide_redemption('{red}', true, '{pa}')") == 't'
refused(lambda: service(db, f"UPDATE public.redemptions SET status = 'fulfilled', fulfilled_by = '{stranger}', fulfilled_at = now() WHERE id = '{red}'"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.fulfill_redemption('{red}', '{kid}')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.fulfill_redemption('{red}', '{stranger}')"), 'NOT_A_GUARDIAN')
assert service(db, f"SELECT public.fulfill_redemption('{red}', '{pa}')") == 't'
assert service(db, f"SELECT public.fulfill_redemption('{red}', '{pa}')") == 'f'
assert service(db, f"SELECT status || ':' || (fulfilled_by = '{pa}')::text FROM public.redemptions WHERE id = '{red}'") == 'fulfilled:true'
refused(lambda: service(db, f"UPDATE public.redemptions SET status = 'approved' WHERE id = '{red}'"), 'REDEMPTION_TRANSITION_FORBIDDEN')
service(db, f"INSERT INTO public.spend_limits (kid_user_id, parent_user_id, period, cap) VALUES ('{kid}', '{pa}', 'weekly', 6)")
refused(lambda: service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{catalog}', '{kid}')"), 'SPEND_LIMIT_REACHED')
service(db, f"DELETE FROM public.spend_limits WHERE kid_user_id = '{kid}'")
check('redemptions: pre-approved insert, another family\'s reward, over-cap catalog cost, approval without the debit, fulfilment before approval, fulfilment by stranger/kid, re-fulfilment, fulfilled->approved and a request past the spend limit all refused; decide + fulfill_redemption produce and record the fulfilled state')

# Banking freeze ownership at the database.
service(db, f"INSERT INTO public.banking_accounts (kid_user_id{number_columns(db)[0]}, opened_by) VALUES ('{kid}'{number_columns(db)[1]}, '{pa}')")
refused(lambda: service(db, f"INSERT INTO public.banking_accounts (kid_user_id{number_columns(db)[0]}, opened_by) VALUES ('{teen}'{number_columns(db)[1]}, '{stranger}')"), 'NOT_A_GUARDIAN')
service(db, f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{pa}', frozen_at = now() WHERE kid_user_id = '{kid}'")
refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{kid}', frozen_at = NULL WHERE kid_user_id = '{kid}'"), 'FREEZE_OWNED_BY_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen_by = '{kid}' WHERE kid_user_id = '{kid}'"), 'FREEZE_OWNED_BY_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{stranger}', frozen_at = NULL WHERE kid_user_id = '{kid}'"), 'FREEZE_ACTOR_INVALID')
refused(lambda: browser(db, kid, f"UPDATE public.banking_accounts SET frozen = false WHERE kid_user_id = '{kid}'"), 'permission denied')
browser(db, kid, f"UPDATE public.banking_accounts SET nickname = 'Mine' WHERE kid_user_id = '{kid}'")
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{pa}', frozen_at = NULL WHERE kid_user_id = '{kid}'")
service(db, f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{kid}', frozen_at = now() WHERE kid_user_id = '{kid}'")
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{kid}', frozen_at = NULL WHERE kid_user_id = '{kid}'")
check('banking: a child can neither lift nor re-own a guardian freeze even through the service role, a stranger cannot act on the freeze or open an account; the kid keeps the nickname edit and lifts their own freeze')

# ── OD-21 producing flows ────────────────────────────────────────────────────
balances = lambda: service(db, f"SELECT string_agg(bucket || '=' || total, ',' ORDER BY bucket) FROM "
                               f"(SELECT bucket, sum(amount) AS total FROM public.wallet_ledger WHERE kid_user_id = '{kid}' GROUP BY bucket) b")
assert balances() == 'save=6,spend=4', balances()
action = service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', 5, '  Birthday gift  ')")
assert service(db, f"SELECT reason FROM public.wallet_guardian_actions WHERE id = '{action}'") == 'Birthday gift'
assert service(db, f"SELECT count(*) FROM public.audit_logs WHERE action = 'wallet.manual_adjustment' AND detail->>'action_id' = '{action}'") == '1'
assert balances() == 'save=6,spend=9'
for actor, token in [(stranger, 'NOT_A_GUARDIAN'), (kid, 'NOT_A_GUARDIAN'), (pb, 'NOT_A_GUARDIAN')]:
    refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{actor}', 'spend', 5, 'gift')"), token)
refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', 5, '   ')"), 'WALLET_ADJUSTMENT_INVALID')
refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', 5, NULL)"), 'WALLET_ADJUSTMENT_INVALID')
refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', 1001, 'x')"), 'WALLET_ADJUSTMENT_INVALID')
refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', -10, 'Correction')"), 'INSUFFICIENT_BALANCE')
refused(lambda: service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'save', -1, 'Correction')"), 'GOAL_SAVINGS_PROTECTED')
assert service(db, f"SELECT count(*) FROM public.wallet_guardian_actions WHERE kid_user_id = '{kid}'") == '1'
service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', 'spend', -2, 'Lost game fee')")
assert balances() == 'save=6,spend=7'
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by) VALUES ('{kid}', 'spend', 50, 'manual_adjustment', '{pa}')"), 'LEDGER_GUARDIAN_ACTION_REQUIRED')
refused(lambda: service(db, f"INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, guardian_action_id) VALUES ('{kid}', 'spend', 5, 'manual_adjustment', '{pa}', '{action}')"), 'LEDGER_GUARDIAN_ACTION_MISMATCH')
refused(lambda: service(db, f"UPDATE public.wallet_ledger SET amount = 999 WHERE kid_user_id = '{kid}'"), 'permission denied')
refused(lambda: service(db, f"DELETE FROM public.wallet_ledger WHERE kid_user_id = '{kid}'"), 'permission denied')
refused(lambda: sql(f"UPDATE public.wallet_ledger SET amount = 999 WHERE kid_user_id = '{kid}'", db), 'LEDGER_APPEND_ONLY')
refused(lambda: sql(f"BEGIN; INSERT INTO public.wallet_guardian_actions (id, kind, kid_user_id, actor_user_id, bucket, amount, reason) "
                    f"VALUES ('{uuid.uuid4()}', 'manual_adjustment', '{kid}', '{pa}', 'spend', 40, 'orphan'); COMMIT;", db), 'WALLET_ACTION_UNBALANCED')
check('manual_adjustment: produced only by guardian_adjust_wallet for a verified guardian with a trimmed 1-240 character reason, audited, never overdrawing a bucket or the goal-reserved savings; refused for stranger/kid/pending adult, empty/null reasons and out-of-range amounts; untethered or replayed ledger rows, ledger edits/deletes (even by the owner) and a half-written action refused')

withdrawal = service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{pa}', 4, 'spend', 'Bought the bike')")
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE goal_id = '{goal}'") == '2'
assert balances() == 'save=2,spend=11'
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE guardian_action_id = '{withdrawal}'") == '2'
refused(lambda: service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{pa}', 3, 'spend', 'More')"), 'GOAL_BALANCE_INSUFFICIENT')
refused(lambda: service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{stranger}', 1, 'spend', 'x')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{kid}', 1, 'spend', 'x')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{pa}', 1, 'share', 'x')"), 'GOAL_WITHDRAWAL_INVALID')
refused(lambda: service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{pa}', 1, 'spend', '')"), 'GOAL_WITHDRAWAL_INVALID')
service(db, f"SELECT public.guardian_withdraw_goal('{goal}', '{pa}', 2, 'save', 'Goal changed')")
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE goal_id = '{goal}'") == '0'
assert balances() == 'save=2,spend=11'
assert service(db, f"SELECT count(*) FROM public.audit_logs WHERE action = 'wallet.goal_withdrawal'") == '2'
check('goal_withdrawal: guardian_withdraw_goal moves tagged goal savings to Spend (goal 6->2, save 6->2, spend 7->11) or releases them into plain Save (net zero), as one balanced audited pair; refused past the goal balance, for stranger/kid, to Share, and without a reason')

# Guardian links: pending / rejected / revoked.
def invite():
    token = uuid.uuid4().hex + uuid.uuid4().hex[:8]
    service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{kid}', '{pa}', '{token}', now() + interval '7 days')")
    return token


def link_status(parent):
    return service(db, f"SELECT verification_status FROM public.guardian_links WHERE parent_user_id = '{parent}' AND kid_user_id = '{kid}'")


assert service(db, f"SELECT public.accept_guardian_invite('{invite()}', '{pb}')") == kid
assert link_status(pb) == 'pending'
assert service(db, "SELECT count(*) FROM public.audit_logs WHERE action = 'family.second_guardian_pending'") == '1'
assert browser(db, pb, f"SELECT count(*) FROM public.tasks WHERE assigned_to = '{kid}'") == '0'
assert browser(db, pb, f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{kid}'") == '0'
assert service(db, f"SELECT public.family_is_verified_guardian('{pb}', '{kid}')") == 'f'
link_b = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{pb}'")
refused(lambda: service(db, f"SELECT public.decide_guardian_link('{link_b}', '{pb}', true)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.decide_guardian_link('{link_b}', '{stranger}', true)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.decide_guardian_link('{link_b}', '{kid}', true)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'verified', verified_at = now() WHERE id = '{link_b}'"), 'GUARDIAN_LINK_REINVITE_INVALID')
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'verified', verified_at = now(), decided_by = '{pb}', decided_at = now() WHERE id = '{link_b}'"), 'GUARDIAN_LINK_DECISION_INVALID')
assert service(db, f"SELECT public.decide_guardian_link('{link_b}', '{pa}', false)") == 'rejected'
refused(lambda: service(db, f"SELECT public.decide_guardian_link('{link_b}', '{pa}', true)"), 'GUARDIAN_LINK_NOT_PENDING')
assert service(db, f"SELECT public.accept_guardian_invite('{invite()}', '{pb}')") == kid
assert link_status(pb) == 'pending'
assert service(db, f"SELECT public.decide_guardian_link('{link_b}', '{pa}', true)") == 'verified'
assert browser(db, pb, f"SELECT count(*) FROM public.tasks WHERE assigned_to = '{kid}'") == '2'
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'pending' WHERE id = '{link_b}'"), 'GUARDIAN_LINK_TRANSITION_FORBIDDEN')
refused(lambda: service(db, f"UPDATE public.guardian_links SET verification_status = 'revoked', revoked_by = '{pa}', revoked_at = now() WHERE id = '{link_b}'"), 'GUARDIAN_LINK_REVOCATION_INVALID')
refused(lambda: service(db, f"INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status) VALUES ('{stranger}', '{kid}', 'rejected')"), 'GUARDIAN_LINK_STATE_INVALID')
assert service(db, f"SELECT public.revoke_own_guardian_link('{kid}', '{pa}')") == 't'
assert link_status(pa) == 'revoked'
assert browser(db, pa, f"SELECT count(*) FROM public.tasks WHERE assigned_to = '{kid}'") == '0'
refused(lambda: service(db, f"SELECT public.revoke_own_guardian_link('{kid}', '{pb}')"), 'LAST_GUARDIAN')
refused(lambda: service(db, f"SELECT public.revoke_own_guardian_link('{kid}', '{stranger}')"), 'GUARDIAN_LINK_NOT_FOUND')
token = uuid.uuid4().hex + uuid.uuid4().hex[:8]
service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{kid}', '{pb}', '{token}', now() + interval '7 days')")
assert service(db, f"SELECT public.accept_guardian_invite('{token}', '{pa}')") == kid
assert link_status(pa) == 'pending'
link_a = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{pa}'")
assert service(db, f"SELECT public.decide_guardian_link('{link_a}', '{pb}', true)") == 'verified'
assert service(db, f"SELECT suspended_at IS NULL FROM public.profiles WHERE user_id = '{kid}'") in ('t', '')
check('guardian links: an accepted invite produces a PENDING link with no access; the invitee, a stranger and the kid cannot decide it and the service role cannot skip the decision; the existing guardian rejects (consumed: no access, re-invitable), a newer invite re-pends, confirmation grants access; stepping away produces REVOKED (access removed, the last guardian refused), and a revoked guardian re-joins only through a new invite and confirmation')

# ── Concurrency (real lock waits) ────────────────────────────────────────────
red2 = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemptions (id, catalog_id, kid_user_id) VALUES ('{red2}', '{catalog}', '{kid}')")
assert service(db, f"SELECT public.decide_redemption('{red2}', true, '{pa}')") == 't'
with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda i: service(db, f"SELECT public.fulfill_redemption('{red2}', '{pa if i % 2 else pb}')"), range(8)))
assert results.count('t') == 1 and results.count('f') == 7, results
spend_before = int(service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND bucket = 'spend'"))


def debit(i):
    try:
        service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa if i % 2 else pb}', 'spend', -3, 'Concurrent correction {i}')")
        return 'ok'
    except RuntimeError as error:
        assert 'INSUFFICIENT_BALANCE' in str(error), error
        return 'refused'


with ThreadPoolExecutor(max_workers=8) as pool:
    outcomes = list(pool.map(debit, range(8)))
assert outcomes.count('ok') == spend_before // 3, (outcomes, spend_before)
assert int(service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND bucket = 'spend'")) == spend_before % 3
token = invite()
other = str(uuid.uuid4())
sql(f"INSERT INTO auth.users (id) VALUES ('{other}'); INSERT INTO public.user_roles (user_id, role) VALUES ('{other}', 'parent') ON CONFLICT DO NOTHING;", db)
service(db, f"SELECT public.accept_guardian_invite('{token}', '{other}')")
link_o = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{other}'")


def decide(i):
    try:
        return service(db, f"SELECT public.decide_guardian_link('{link_o}', '{pa if i % 2 else pb}', {'true' if i % 2 else 'false'})")
    except RuntimeError as error:
        assert 'GUARDIAN_LINK_NOT_PENDING' in str(error), error
        return 'conflict'


with ThreadPoolExecutor(max_workers=8) as pool:
    decisions = list(pool.map(decide, range(8)))
assert decisions.count('conflict') == 7 and len({d for d in decisions if d != 'conflict'}) == 1, decisions
assert service(db, f"SELECT count(*) FROM public.audit_logs WHERE subject = '{kid}' AND action IN ('family.guardian_link_confirmed', 'family.guardian_link_rejected') AND detail->>'link_id' = '{link_o}'") == '1'
check(f'concurrency: 8 simultaneous fulfilments by two guardians -> exactly 1; 8 simultaneous -3 debits against {spend_before} coins -> exactly {spend_before // 3} succeed and the bucket ends at {spend_before % 3}, never negative; 8 simultaneous opposite link decisions -> exactly one decision and one audit row')

# ── D.4 metric and replay ────────────────────────────────────────────────────
sql(f"UPDATE public.savings_goals SET status = 'archived' WHERE id = '{goal}'", db)  # a manual (non-API) write
integrity = service(db, "SELECT string_agg(table_name || ':' || transitions || ':' || outside_service, ',') FROM public.family_state_integrity(now() - interval '1 hour')")
rows = dict((part.split(':')[0], part.split(':')[1:]) for part in integrity.split(','))
assert rows['savings_goals'][1] == '1', integrity
assert all(values[1] == '0' for table, values in rows.items() if table != 'savings_goals'), integrity
assert {'tasks', 'redemptions', 'guardian_links', 'banking_accounts', 'savings_goals'} <= set(rows), integrity
check(f'metric: family_state_integrity counts every transition by table and isolates the single out-of-band manual write ({integrity})')

counts = lambda: service(db, "SELECT (SELECT count(*) FROM public.wallet_ledger) || '/' || (SELECT count(*) FROM public.wallet_guardian_actions) || '/' || (SELECT count(*) FROM public.guardian_links)")
before_replay = counts()
replay(db)
assert counts() == before_replay
refused(lambda: browser(db, kid, f"UPDATE public.tasks SET status = 'approved' WHERE id = '{task}'"), 'permission denied')
check(f'replay: re-applying {f"the S07.1 parts and the later migrations that redefine them ({len(REPLAY)} files)" if FULL_CHAIN else "the five S07.1 migrations"} preserves ledger/actions/links ({before_replay}) and the lockdown')

# ── Pre-existing behavior observed (outside this checkpoint) ────────────────
lonely_parent, lonely_kid = str(uuid.uuid4()), str(uuid.uuid4())
sql(f"""INSERT INTO auth.users (id) VALUES ('{lonely_parent}'), ('{lonely_kid}');
INSERT INTO public.user_roles (user_id, role) VALUES ('{lonely_parent}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{lonely_parent}', '{lonely_kid}', 'verified', now());
INSERT INTO public.user_roles (user_id, role) VALUES ('{lonely_kid}', 'kid') ON CONFLICT DO NOTHING;""", db)
try:
    sql(f"DELETE FROM auth.users WHERE id = '{lonely_parent}'", db)
    observed = 'deleting the only guardian account succeeded'
except RuntimeError as error:
    observed = 'deleting the only guardian account is refused by 0010: ' + str(error).strip().splitlines()[0]
check('observed (pre-existing, A.1 lane): ' + observed)

report = {
    'passed': True,
    'database': db,
    'reproduction_database': before,
    'migrations': [part.name for part in PARTS],
    'applied_through': TARGET.name,
    'full_chain': FULL_CHAIN,
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim; '
                  'browser roles exercised through SET ROLE with request.jwt claims, concurrency through parallel '
                  'sessions. Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
