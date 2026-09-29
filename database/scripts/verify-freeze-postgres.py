"""D.1 (Appendix H 1.3 Freeze-Enforcement Verification and the Unauthorized
State-Transition check; 2.2 D.1(d)): the banking freeze, enforced by
PostgreSQL, over the WHOLE migration chain.

The first version of this proof built a hand-written minimal schema and
applied only 0093_enforce_banking_freeze.sql, so it kept passing while later
checkpoints redefined every function that carries the freeze (the S07.1
guards, the S07.4 allocators, the S07.3 scheduled credits, the S07.5 decision
flows). This one applies EVERY migration in order to a fresh database over a
minimal Supabase shim (anon/authenticated/service_role, auth.users,
auth.uid(), Supabase's default grants) and attacks what production runs:

  * the live definition of each enforcing function still calls the freeze
    check, and each enforcing trigger is installed;
  * while a Tutor's freeze holds: a reward request (direct insert, the child's
    request flow), a Tutor's approval (both approval paths) and a level's
    pre-approval (even forged by a superuser) are refused; a bonus chore's,
    a family-contribution chore's and an allowance's split wait; the scheduled
    allowance and savings bonus post nothing and keep their due dates; the
    child can neither pledge Share coins nor take a pledge back; nothing
    already in a pocket moves;
  * the child cannot lift or re-own a Tutor's freeze through the service path
    (a Core defect) nor through the browser role, and no browser role can
    write the freeze or call a movement function;
  * after the Tutor lifts it, every held split lands exactly once, the
    schedule catches up, the waiting request can be approved and the pledge
    taken back;
  * real lock waits: a freeze committed first holds a waiting allocation, an
    allocation holding the account row completes before the freeze;
  * a replay of 0093 and every later migration that redefines a function they
    define (lf_pg_replay.replay_set) preserves the ledger and leaves every
    function and trigger exactly as the chain left them.

It always runs over the whole chain; LF_PG_FULL_CHAIN is accepted for
symmetry with the other Block D verifiers (family-db-verify.mjs sets it).

Cluster selection (never the shared Docker stack):
  LF_PG_BIN    directory holding psql (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
  LF_PG_DATA   the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s02-freeze-postgres.json)
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import subprocess
import time
import uuid

from lf_pg_replay import assert_unchanged, fingerprint, replay_set

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s02-freeze-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
FREEZE = next(m for m in MIGRATIONS if m.name.endswith('_enforce_banking_freeze.sql'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']

# Every function that carries the freeze, and the guard its live body must hold.
ENFORCING = {
    'banking_movement_allowed': 'FOR UPDATE',
    'guard_frozen_redemption_request': 'banking_movement_allowed(NEW.kid_user_id)',
    'guard_redemption_state': 'banking_movement_allowed(NEW.kid_user_id)',
    'decide_redemption': 'banking_movement_allowed(v_kid_user_id)',
    'family_decide_redemption': 'banking_movement_allowed(v_kid)',
    'family_request_redemption': 'banking_movement_allowed(p_kid)',
    'allocate_task_reward': 'banking_movement_allowed(p_kid_user_id)',
    'allocate_pending_credit': 'banking_movement_allowed(p_kid_user_id)',
    'run_due_scheduled_credits': 'banking_movement_allowed(p_kid_user_id)',
    'guard_share_gift': "'ACCOUNT_FROZEN'",
    'guard_banking_account_state': "'FREEZE_OWNED_BY_GUARDIAN'",
}


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


# ── 1. The whole chain, and the live definitions ────────────────────────────
db = 'lf_freeze_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {db}')
sql(SHIM, db)
for migration in MIGRATIONS:
    sql(migration.read_text(encoding='utf-8'), db)

for fn, guard in ENFORCING.items():
    body = sql(f"SELECT string_agg(pg_get_functiondef(p.oid), E'\\n') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
               f"WHERE n.nspname = 'public' AND p.proname = '{fn}'", db)
    assert body, f'public.{fn} is not defined on the full chain'
    assert guard in body, f'the live public.{fn} no longer carries {guard}'
triggers = sql("SELECT string_agg(tgrelid::regclass::text || '.' || tgname || '=' || tgfoid::regproc::text, ',' ORDER BY 1) FROM pg_trigger "
               "WHERE NOT tgisinternal AND tgfoid::regproc::text IN ('guard_frozen_redemption_request', 'guard_redemption_state', "
               "'guard_share_gift', 'guard_banking_account_state')", db)
for needed in ['redemptions.frozen_redemption_admission=guard_frozen_redemption_request', '=guard_redemption_state', '=guard_share_gift',
               'banking_accounts.banking_account_state_guard=guard_banking_account_state']:
    assert needed in triggers, f'{needed} is not installed ({triggers})'
check(f'live definitions: on the chain through {MIGRATIONS[-1].name}, each of the {len(ENFORCING)} enforcing functions carries its freeze guard '
      f'and the four enforcing triggers are installed ({triggers})')

# ── 2. A family: a Tutor, an unrelated adult and a 9-year-old ───────────────
kid, pa, stranger = (str(uuid.uuid4()) for _ in range(3))
sql(f"""
INSERT INTO auth.users (id) VALUES ('{kid}'), ('{pa}'), ('{stranger}');
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES ('{pa}', 'adult'), ('{stranger}', 'adult');
UPDATE public.profiles SET birth_date = current_date - interval '9 years 3 days' WHERE user_id = '{kid}';
INSERT INTO public.user_roles (user_id, role) VALUES ('{pa}', 'parent'), ('{stranger}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{pa}', '{kid}', 'verified', now());
INSERT INTO public.user_roles (user_id, role) VALUES ('{kid}', 'kid') ON CONFLICT DO NOTHING;
""", db)
number = sql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'banking_accounts' "
             "AND column_name = 'display_number'", db) == '1'
# D.7: the retired card-shaped number is required before its contract migration and gone after it.
number_column, number_value = (', display_number', ", 'LF-1234-5678'") if number else ('', '')
service(db, f"INSERT INTO public.banking_accounts (kid_user_id{number_column}, opened_by) VALUES ('{kid}'{number_value}, '{pa}')")
for bucket, coins in [('spend', 30), ('save', 40), ('share', 5)]:
    service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{pa}', '{bucket}', {coins}, 'Starting coins')")

GOOD_REWARD = 'Save 10 more coins first, then we can get it.'


def balances():
    return service(db, f"SELECT string_agg(bucket || '=' || total, ',' ORDER BY bucket) FROM "
                       f"(SELECT bucket, sum(amount) AS total FROM public.wallet_ledger WHERE kid_user_id = '{kid}' GROUP BY bucket) b")


def approved_task(coins, kind):
    tid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins, kind) VALUES ('{tid}', '{pa}', '{kid}', 'Chore', {coins}, '{kind}')")
    service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{tid}'")
    service(db, f"SELECT public.family_decide_task('{tid}', '{pa}', 'approved', NULL, NULL)")
    assert service(db, f"SELECT status || ':' || allocated FROM public.tasks WHERE id = '{tid}'") == 'approved:false'
    return tid


def request(catalog):
    return json.loads(service(db, f"SELECT public.family_request_redemption('{kid}', '{catalog}', 'treat', NULL)"))['id']


catalog = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{catalog}', '{pa}', 'Movie', 5)")
waiting, to_deny, forged = request(catalog), request(catalog), request(catalog)
bonus_task, contribution_task = approved_task(10, 'bonus'), approved_task(2, 'contribution')
credit = str(uuid.uuid4())
service(db, f"INSERT INTO public.pending_credits (id, kid_user_id, amount, source) VALUES ('{credit}', '{kid}', 10, 'allowance')")
service(db, f"INSERT INTO public.allowance_rules (kid_user_id, parent_user_id, amount, frequency, anchor_day, active, next_run_at) "
            f"VALUES ('{kid}', '{pa}', 7, 'weekly', 1, true, now() - interval '1 day')")
service(db, f"INSERT INTO public.savings_bonus_rules (kid_user_id, parent_user_id, rate_bp, active, next_run_at) "
            f"VALUES ('{kid}', '{pa}', 1000, true, now() - interval '1 minute')")
dest = service(db, f"SELECT public.share_destination_create('{kid}', '{pa}', 'Food bank', 'charity')")
pledged = service(db, f"SELECT public.share_gift_pledge('{kid}', '{dest}', 1)")
given = service(db, f"SELECT public.share_gift_pledge('{kid}', '{dest}', 1)")
# A level-2 child with a pre-approval limit, so the forged pre-approval below reaches the freeze check itself.
sql(f"ALTER TABLE public.family_autonomy_levels DISABLE TRIGGER USER; "
    f"INSERT INTO public.family_autonomy_levels (kid_user_id, level, preapproved_limit) VALUES ('{kid}', 2, 10) "
    f"ON CONFLICT (kid_user_id) DO UPDATE SET level = 2, preapproved_limit = 10; "
    f"ALTER TABLE public.family_autonomy_levels ENABLE TRIGGER USER;", db)
assert service(db, f"SELECT public.family_autonomy_admits_reward('{kid}', 5)") == 't'

held = balances()
assert held == 'save=40,share=3,spend=30', held
pending_before = service(db, f"SELECT count(*) FROM public.pending_credits WHERE kid_user_id = '{kid}'")
due_before = service(db, f"SELECT (SELECT next_run_at FROM public.allowance_rules WHERE kid_user_id = '{kid}') || '/' || "
                         f"(SELECT next_run_at FROM public.savings_bonus_rules WHERE kid_user_id = '{kid}')")
ledger_rows = service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{kid}'")

# ── 3. The Tutor freezes ────────────────────────────────────────────────────
service(db, f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{pa}', frozen_at = now() WHERE kid_user_id = '{kid}'")

refused(lambda: service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{catalog}', '{kid}')"), 'ACCOUNT_FROZEN')
refused(lambda: service(db, f"SELECT public.family_request_redemption('{kid}', '{catalog}', 'treat', NULL)"), 'ACCOUNT_FROZEN')
assert service(db, f"SELECT public.decide_redemption('{waiting}', true, '{pa}')") == 'f'
refused(lambda: service(db, f"SELECT public.family_decide_redemption('{waiting}', '{pa}', true, NULL, NULL, NULL)"), 'ACCOUNT_FROZEN')
refused(lambda: sql(f"""BEGIN;
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, redemption_id, created_by) VALUES ('{kid}', 'spend', -5, 'redemption', '{forged}', '{kid}');
INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind) VALUES ('{kid}', 'redemption', '{forged}', 'requested', 'preapproved', '{kid}', 'child');
UPDATE public.redemptions SET status = 'approved', decided_at = now(), decision_id = (SELECT id FROM public.family_decisions WHERE redemption_id = '{forged}') WHERE id = '{forged}';
COMMIT;""", db), 'ACCOUNT_FROZEN')
assert service(db, f"SELECT public.family_decide_redemption('{to_deny}', '{pa}', false, 'save_more', '{GOOD_REWARD}', NULL)") == 'denied'
assert service(db, f"SELECT string_agg(status, ',' ORDER BY status) FROM public.redemptions WHERE id IN ('{waiting}', '{forged}')") == 'requested,requested'
check('rewards: while frozen, a direct request insert, the child\'s request flow, decide_redemption, family_decide_redemption\'s yes and a '
      'superuser-forged level pre-approval (level 2, inside the limit) are all refused; the waiting requests stay requested; a denial with a reason still works')

assert service(db, f"SELECT public.allocate_task_reward('{bonus_task}', '{kid}', 4, 4, 2, '{kid}', NULL)") == 'f'
assert service(db, f"SELECT public.allocate_task_reward('{contribution_task}', '{kid}', 0, 2, 0, '{kid}', NULL)") == 'f'
assert service(db, f"SELECT public.allocate_pending_credit('{credit}', '{kid}', 5, 5, 0, '{kid}')") == 'f'
assert service(db, f"SELECT string_agg(allocated::text, ',') FROM public.tasks WHERE id IN ('{bonus_task}', '{contribution_task}')") == 'false,false'
assert service(db, f"SELECT allocated FROM public.pending_credits WHERE id = '{credit}'") == 'f'
check('splits: while frozen, a bonus chore\'s split, a family-contribution chore\'s split and an allowance payout\'s split are held (false, '
      'nothing allocated)')

assert service(db, f"SELECT public.run_due_scheduled_credits('{kid}')") == '0'
assert service(db, f"SELECT count(*) FROM public.pending_credits WHERE kid_user_id = '{kid}'") == pending_before
assert service(db, f"SELECT (SELECT next_run_at FROM public.allowance_rules WHERE kid_user_id = '{kid}') || '/' || "
                   f"(SELECT next_run_at FROM public.savings_bonus_rules WHERE kid_user_id = '{kid}')") == due_before
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND reason = 'savings_bonus'") == '0'
check('credits: while frozen, run_due_scheduled_credits posts 0, creates no allowance payout, credits no savings bonus and leaves both due dates where they were')

refused(lambda: service(db, f"SELECT public.share_gift_pledge('{kid}', '{dest}', 1)"), 'ACCOUNT_FROZEN')
refused(lambda: service(db, f"SELECT public.share_gift_settle('{pledged}', '{kid}', 'returned', NULL)"), 'ACCOUNT_FROZEN')
assert service(db, f"SELECT public.share_gift_settle('{given}', '{pa}', 'given', 'Taken to the food bank')") == 'given'
check('share: while frozen, the child can neither pledge Share coins nor take a pledge back; the Tutor still records what the family gave')

refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{kid}', frozen_at = NULL WHERE kid_user_id = '{kid}'"), 'FREEZE_OWNED_BY_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen_by = '{kid}' WHERE kid_user_id = '{kid}'"), 'FREEZE_OWNED_BY_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{stranger}', frozen_at = NULL WHERE kid_user_id = '{kid}'"), 'FREEZE_ACTOR_INVALID')
for who in [kid, pa, stranger]:
    refused(lambda: browser(db, who, f"UPDATE public.banking_accounts SET frozen = false WHERE kid_user_id = '{kid}'"), 'permission denied')
    refused(lambda: browser(db, who, f"UPDATE public.banking_accounts SET frozen_by = '{who}' WHERE kid_user_id = '{kid}'"), 'permission denied')
    refused(lambda: browser(db, who, f"DELETE FROM public.banking_accounts WHERE kid_user_id = '{kid}'"), 'permission denied')
    for fn in [f"public.banking_movement_allowed('{kid}')", f"public.allocate_pending_credit('{credit}', '{kid}', 5, 5, 0, '{kid}')",
               f"public.allocate_task_reward('{bonus_task}', '{kid}', 4, 4, 2, '{kid}', NULL)", f"public.run_due_scheduled_credits('{kid}')",
               f"public.decide_redemption('{waiting}', true, '{pa}')"]:
        refused(lambda: browser(db, who, f'SELECT {fn}'), 'permission denied')
refused(lambda: as_role(db, 'anon', None, f"UPDATE public.banking_accounts SET frozen = false WHERE kid_user_id = '{kid}'"), 'permission denied')
browser(db, kid, f"UPDATE public.banking_accounts SET nickname = 'Rocket' WHERE kid_user_id = '{kid}'")
assert service(db, f"SELECT frozen || ':' || (frozen_by = '{pa}') || ':' || nickname FROM public.banking_accounts WHERE kid_user_id = '{kid}'") == 'true:true:Rocket'
assert balances() == held, balances()
check('owner: the child cannot lift or re-own the Tutor\'s freeze through the service path (FREEZE_OWNED_BY_GUARDIAN) and an unrelated adult '
      'cannot act on it (FREEZE_ACTOR_INVALID); no browser session (child, Tutor, stranger, anon) can write the freeze, delete the account or '
      'call a movement function; the child keeps the nickname edit; while frozen only the Tutor\'s record of a given gift moved a coin '
      f'(before {held}, after {balances()})')

# ── 4. The Tutor lifts it: everything held lands exactly once ───────────────
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{pa}', frozen_at = NULL WHERE kid_user_id = '{kid}'")
assert service(db, f"SELECT public.allocate_task_reward('{bonus_task}', '{kid}', 4, 4, 2, '{kid}', NULL)") == 't'
assert service(db, f"SELECT public.allocate_task_reward('{bonus_task}', '{kid}', 4, 4, 2, '{kid}', NULL)") == 'f'
assert service(db, f"SELECT public.allocate_task_reward('{contribution_task}', '{kid}', 0, 2, 0, '{kid}', NULL)") == 't'
assert service(db, f"SELECT public.allocate_pending_credit('{credit}', '{kid}', 5, 5, 0, '{kid}')") == 't'
assert service(db, f"SELECT public.allocate_pending_credit('{credit}', '{kid}', 5, 5, 0, '{kid}')") == 'f'
posted = service(db, f"SELECT public.run_due_scheduled_credits('{kid}')")
assert posted == '2', posted
assert int(service(db, f"SELECT count(*) FROM public.pending_credits WHERE kid_user_id = '{kid}'")) == int(pending_before) + 1
assert service(db, f"SELECT (SELECT next_run_at > now() FROM public.allowance_rules WHERE kid_user_id = '{kid}') AND "
                   f"(SELECT next_run_at > now() FROM public.savings_bonus_rules WHERE kid_user_id = '{kid}')") == 't'
bonus = service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND reason = 'savings_bonus'")
assert bonus == '4', bonus  # 1 coin per full 10 of the 49 saved (40 + 4 from the chore + 5 from the allowance)
assert service(db, f"SELECT public.family_decide_redemption('{waiting}', '{pa}', true, NULL, NULL, NULL)") == 'approved'
assert service(db, f"SELECT public.share_gift_settle('{pledged}', '{kid}', 'returned', NULL)") == 'returned'
after = balances()
# save 40 + 4 + 5 + 4 bonus; share 5 - 2 pledged + 2 + 1 returned; spend 30 + 4 + 2 + 5 - 5 for the approved reward
assert after == 'save=53,share=6,spend=36', after
check(f'resume: after the Tutor lifts the freeze the bonus chore, the contribution chore and the allowance split each land exactly once, the '
      f'schedule catches up (2 posted: one allowance payout, a {bonus}-coin per-ten bonus) and moves its due dates forward, the waiting '
      f'request is approved and the pledge comes back; pockets {held} -> {after}')

# ── 5. Real lock waits between a freeze and an allocation ───────────────────
def wait_for(expression):
    for _ in range(500):
        if sql(expression, db) == 't':
            return
        time.sleep(.02)
    raise AssertionError('Expected lock state was not observed')


MARK = 9090


def race(first, second, label):
    """`first` runs inside an open transaction that also takes advisory lock MARK;
    `second` must be observed waiting on it before `first` commits."""
    holder = subprocess.Popen(BASE + ['-d', db], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
    try:
        holder.stdin.write(f'BEGIN; {first}; SELECT pg_advisory_xact_lock({MARK});\n')
        holder.stdin.flush()
        wait_for(f"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = {MARK} AND granted "
                 f"AND database = (SELECT oid FROM pg_database WHERE datname = current_database()))")
        with ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(sql, f"SET application_name = '{label}'; {second}", db)
            try:
                wait_for(f"SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() "
                         f"AND application_name = '{label}' AND cardinality(pg_blocking_pids(pid)) > 0)")
            finally:
                holder.stdin.write('COMMIT;\n')
                holder.stdin.flush()
                holder.stdin.close()
                holder.stdin = None
            result = pending.result(timeout=30)
        _, stderr = holder.communicate(timeout=30)
        assert holder.returncode == 0, stderr
        return '\n'.join(line for line in result.splitlines() if line not in ('', 'SET'))
    finally:
        if holder.poll() is None:
            if holder.stdin:
                holder.stdin.write('ROLLBACK;\n')
                holder.stdin.close()
                holder.stdin = None
            holder.communicate(timeout=30)


def pending_credit():
    cid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.pending_credits (id, kid_user_id, amount, source) VALUES ('{cid}', '{kid}', 10, 'allowance')")
    return cid


freeze = f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{pa}', frozen_at = now() WHERE kid_user_id = '{kid}'"
racing = pending_credit()
allocation = f"SET ROLE service_role; SELECT public.allocate_pending_credit('{racing}', '{kid}', 5, 5, 0, '{kid}')"
assert race(freeze, allocation, 'allocation_waiter') == 'f'
assert service(db, f"SELECT allocated FROM public.pending_credits WHERE id = '{racing}'") == 'f'
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{pa}', frozen_at = NULL WHERE kid_user_id = '{kid}'")
assert race(allocation, freeze, 'freeze_waiter') == ''
assert service(db, f"SELECT allocated FROM public.pending_credits WHERE id = '{racing}'") == 't'
assert service(db, f"SELECT frozen FROM public.banking_accounts WHERE kid_user_id = '{kid}'") == 't'
raced = balances()
assert raced == 'save=58,share=6,spend=41', raced
check(f'concurrency: a freeze committed while an allocation waits on the account row holds it (false, credit still unallocated); an '
      f'allocation holding the row completes before the waiting freeze lands (allocated, then frozen); both lock waits were observed ({raced})')

# ── 6. Replay: the migrations under test re-applied leave production's schema ─
REPLAY = replay_set(MIGRATIONS, [FREEZE])
before_print = fingerprint(sql, db)
counts = lambda: service(db, "SELECT (SELECT count(*) FROM public.wallet_ledger) || '/' || (SELECT count(*) FROM public.pending_credits) "
                             "|| '/' || (SELECT count(*) FROM public.redemptions)")
before_counts = counts()
for migration in REPLAY:
    sql(migration.read_text(encoding='utf-8'), db)
assert counts() == before_counts
assert_unchanged(before_print, fingerprint(sql, db))
assert balances() == raced
refused(lambda: service(db, f"SELECT public.share_gift_pledge('{kid}', '{dest}', 1)"), 'ACCOUNT_FROZEN')
assert service(db, f"SELECT public.allocate_pending_credit('{pending_credit()}', '{kid}', 5, 5, 0, '{kid}')") == 'f'
check(f'replay: re-applying {FREEZE.name} and the {len(REPLAY) - 1} later migrations that redefine its functions ({REPLAY[-1].name} last) '
      f'preserves ledger/credits/requests ({before_counts}), leaves every public function and trigger byte-identical and the freeze still holds')

report = {
    'passed': True,
    'database': db,
    'applied_through': MIGRATIONS[-1].name,
    'full_chain': True,
    'replayed': [m.name for m in REPLAY],
    'enforcing_functions': ENFORCING,
    'checks': checks,
    'provenance': 'The actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim; browser roles exercised '
                  'through SET ROLE with request.jwt claims, lock ordering through parallel sessions. Does not replace a full Supabase '
                  '(PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
