"""D.19, D.21, D.22 and D.23 (S07.7): erasure that keeps a child's record,
the Block D retention and deletion policy, the older-teen bridge, the
consent-gated research instrumentation and the Tutor's coaching record,
enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to fresh databases on an owned native PostgreSQL cluster, over the same
minimal Supabase shim as the S07.1-S07.6 verifiers. It first reproduces the two
D.21 defects on the chain BEFORE the S07.7 parts: a Tutor who used the Family
Hub cannot be deleted at all, and once the S08 lane's provenance relaxation is
merged the S07.1 ledger guard refuses the cascade (LEDGER_APPEND_ONLY). It then
upgrades a database through the S07.7 parts and checks every population: a
parent-created child with no birth date, at 9, 14, 15, 17 and 18, an
independent teen at 14 and at 16, an adult, a guest, two verified Tutors of the
same children and an unrelated parent, through the browser roles and through
the service role.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-family-governance-postgres.json)
  LF_PG_FULL_CHAIN=1  also apply every later migration, so a later
               redefinition must keep these checks true (family-db-verify.mjs
               sets it; the replay then re-applies only what redefines these
               objects, lf_pg_replay.replay_set)
"""
from pathlib import Path
import json
import os
import re
import subprocess
import uuid

from lf_pg_replay import assert_unchanged, fingerprint, replay_set

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-family-governance-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_7_PARTS = ['_family_erasure_provenance.sql', '_parent_coaching.sql', '_money_bridge.sql',
               '_family_research_instrumentation.sql', '_family_data_retention.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_7_PARTS]
FULL_CHAIN = os.environ.get('LF_PG_FULL_CHAIN') == '1'
LATER = [m for m in MIGRATIONS if m.name > PARTS[-1].name] if FULL_CHAIN else []
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
UUID_TEXT = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
# The S08 lane's account_deletion_guards statements for the four Block D
# provenance keys (integration branch), used to reproduce the merged defect.
S08_RELAXATION = """
ALTER TABLE public.wallet_ledger ALTER COLUMN created_by DROP NOT NULL, DROP CONSTRAINT IF EXISTS wallet_ledger_created_by_fkey,
  ADD CONSTRAINT wallet_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_decided_by_fkey,
  ADD CONSTRAINT redemptions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.banking_accounts ALTER COLUMN opened_by DROP NOT NULL, DROP CONSTRAINT IF EXISTS banking_accounts_opened_by_fkey,
  ADD CONSTRAINT banking_accounts_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.banking_accounts DROP CONSTRAINT IF EXISTS banking_accounts_frozen_by_fkey,
  ADD CONSTRAINT banking_accounts_frozen_by_fkey FOREIGN KEY (frozen_by) REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.allowance_rules ALTER COLUMN parent_user_id DROP NOT NULL, DROP CONSTRAINT IF EXISTS allowance_rules_parent_user_id_fkey,
  ADD CONSTRAINT allowance_rules_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.savings_bonus_rules ALTER COLUMN parent_user_id DROP NOT NULL, DROP CONSTRAINT IF EXISTS savings_bonus_rules_parent_user_id_fkey,
  ADD CONSTRAINT savings_bonus_rules_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.spend_limits ALTER COLUMN parent_user_id DROP NOT NULL, DROP CONSTRAINT IF EXISTS spend_limits_parent_user_id_fkey,
  ADD CONSTRAINT spend_limits_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
"""


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

SHIM = (ROOT / 'database/scripts/verify-money-presentation-postgres.py').read_text(encoding='utf-8').split('SHIM = """', 1)[1].split('"""', 1)[0]


def fresh(upto):
    database = 'lf_family_governance_' + uuid.uuid4().hex
    sql(f'CREATE DATABASE {database}')
    sql(SHIM, database)
    for migration in MIGRATIONS:
        if migration.name > upto.name:
            break
        sql(migration.read_text(encoding='utf-8'), database)
    return database


def apply_parts(database):
    for part in [*PARTS, *LATER]:
        sql(part.read_text(encoding='utf-8'), database)


def replay_parts(database):
    """The replay step. Over the whole chain it re-applies the parts plus every later
    migration that redefines what they define (lf_pg_replay.replay_set) and asserts
    every function, trigger, policy and grant is left exactly as the chain left it."""
    if not FULL_CHAIN:
        apply_parts(database)
        return
    before = fingerprint(sql, database)
    for part in replay_set(MIGRATIONS, PARTS):
        sql(part.read_text(encoding='utf-8'), database)
    assert_unchanged(before, fingerprint(sql, database))


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


def fixture(db, query):
    # Backdated or pre-existing rows are fixture setup, not product writes: the
    # superuser writes them with the row triggers bypassed. Every product
    # behaviour under test runs with triggers on.
    sql('SET session_replication_role = replica;\n' + query, db)


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


# Parent-created children (the A.2 under-13 origin marker where the Tutor gave
# an under-13 date), independent teens, and the adults around them.
KIDS = {'kid_nodob': None, 'kid9': '9 years 20 days', 'kid14': '14 years 20 days', 'kid15': '15 years 3 days',
        'kid17': '17 years 300 days', 'kid18': '18 years 2 days'}
UNDER13 = ['kid_nodob', 'kid9']
TEENS = {'teen14': '14 years 30 days', 'teen16': '16 years 30 days'}
POPULATIONS = [*KIDS, *TEENS, 'adult', 'guest', 'parent_a', 'parent_b', 'stranger']


def people(db):
    ids = {name: str(uuid.uuid4()) for name in POPULATIONS}
    rows = ','.join(f"('{v}', {'true' if k == 'guest' else 'false'})" for k, v in ids.items())
    bands = {**{k: ('under_13' if k in UNDER13 else '13_to_17') for k in KIDS}, **{k: '13_to_17' for k in TEENS},
             'guest': '13_to_17', 'adult': 'adult', 'parent_a': 'adult', 'parent_b': 'adult', 'stranger': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    births = '\n'.join(f"UPDATE public.profiles SET birth_date = current_date - interval '{age}' WHERE user_id = '{ids[k]}';"
                       for k, age in {**KIDS, **TEENS}.items() if age)
    links = ','.join(f"('{ids[p]}', '{ids[k]}', 'verified', now())" for k in KIDS for p in ('parent_a', 'parent_b'))
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
INSERT INTO public.account_safety_origins (user_id) VALUES {','.join(f"('{ids[k]}')" for k in UNDER13)};
{births}
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['parent_a']}', 'parent'), ('{ids['parent_b']}', 'parent'), ('{ids['stranger']}', 'parent')
  ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES {links};
INSERT INTO public.user_roles (user_id, role) VALUES {','.join(f"('{ids[k]}', 'kid')" for k in KIDS)} ON CONFLICT DO NOTHING;
""", db)
    return ids


def chore(db, parent, kid, approve=False, coins=3):
    tid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins) VALUES ('{tid}', '{parent}', '{kid}', 'Chore', {coins})")
    if approve:
        service(db, f"SELECT public.family_task_mark_done('{tid}', '{kid}', NULL, NULL)")
        service(db, f"SELECT public.family_decide_task('{tid}', '{parent}', 'approved', NULL, NULL)")
    return tid


def ledger_totals(db, kid):
    return sql(f"SELECT coalesce(string_agg(bucket || '=' || total, ',' ORDER BY bucket), '') FROM "
               f"(SELECT bucket, sum(amount) AS total FROM public.wallet_ledger WHERE kid_user_id = '{kid}' GROUP BY bucket) t", db)


def family_money(db, ids, parent, kid):
    """A family that has used every Block D table the Tutor is named in."""
    cat, red, goal, dest, gift, action = (str(uuid.uuid4()) for _ in range(6))
    t = chore(db, parent, kid, approve=True, coins=10)
    fixture(db, f"""
INSERT INTO public.banking_accounts (kid_user_id{number_columns(db)[0]}, frozen, frozen_by, frozen_at, opened_by)
  VALUES ('{kid}'{number_columns(db)[1]}, true, '{parent}', now(), '{parent}');
INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{cat}', '{ids['parent_b']}', 'Park', 1);
INSERT INTO public.redemptions (id, catalog_id, kid_user_id, status, decided_by, decided_at) VALUES ('{red}', '{cat}', '{kid}', 'approved', '{parent}', now());
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, task_id) VALUES ('{kid}', 'spend', 4, 'task_approved', '{parent}', '{t}');
INSERT INTO public.allowance_rules (kid_user_id, parent_user_id, amount, frequency, anchor_day, next_run_at)
  VALUES ('{kid}', '{parent}', 5, 'weekly', 1, now() - interval '1 hour');
INSERT INTO public.spend_limits (kid_user_id, parent_user_id, period, cap) VALUES ('{kid}', '{parent}', 'weekly', 50);
INSERT INTO public.savings_bonus_rules (kid_user_id, parent_user_id, rate_bp, next_run_at) VALUES ('{kid}', '{parent}', 1000, now() - interval '1 hour');
INSERT INTO public.savings_goals (id, kid_user_id, title, target) VALUES ('{goal}', '{kid}', 'Bike', 100);
INSERT INTO public.share_destinations (id, holder_user_id, title, kind, chosen_by, created_by) VALUES ('{dest}', '{kid}', 'Food bank', 'charity', 'tutor', '{parent}');
INSERT INTO public.share_gifts (id, holder_user_id, destination_id, amount, status, settled_at, settled_by, note)
  VALUES ('{gift}', '{kid}', '{dest}', 2, 'given', now(), '{parent}', 'Given at school');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, share_gift_id) VALUES ('{kid}', 'share', 2, 'allowance', '{parent}', NULL),
  ('{kid}', 'share', -2, 'share_gift', '{kid}', '{gift}');
INSERT INTO public.wallet_guardian_actions (id, kind, kid_user_id, actor_user_id, bucket, amount, reason)
  VALUES ('{action}', 'manual_adjustment', '{kid}', '{parent}', 'save', 1, 'Correcting a typo');
INSERT INTO public.chore_streak_pauses (kid_user_id, starts_on, ends_on, created_by) VALUES ('{kid}', current_date, current_date + 3, '{parent}');
INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_user_id, actor_kind)
  VALUES ('{kid}', 1, 2, 0, 10, '{parent}', 'tutor');
""")
    return {'task': t, 'redemption': red, 'catalog': cat}


# ── 1. Reproduce the D.21 erasure defects on the chain BEFORE this checkpoint
db0 = fresh(MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1])
ids0 = people(db0)
family_money(db0, ids0, ids0['parent_a'], ids0['kid9'])
# Since the S07 merge the chain carries the S08 lane's account_deletion_guards
# BEFORE the S07.7 parts, so the NO ACTION stage exists only on the
# pre-merge chain; the merged chain reproduces the LEDGER_APPEND_ONLY stage.
s08_in_chain = sql("SELECT confdeltype FROM pg_constraint WHERE conname = 'wallet_ledger_created_by_fkey'", db0) == 'n'
if not s08_in_chain:
    refused(lambda: sql(f"DELETE FROM auth.users WHERE id = '{ids0['parent_a']}'", db0), 'wallet_ledger_created_by_fkey')
    sql(S08_RELAXATION, db0)
refused(lambda: sql(f"DELETE FROM auth.users WHERE id = '{ids0['parent_a']}'", db0), 'LEDGER_APPEND_ONLY')
assert sql("SELECT to_regprocedure('public.family_retention_sweep()') IS NULL", db0) == 't'
check(("D.21 reproduced on the merged chain before S07.7, which already holds the S08 lane's ON DELETE SET NULL relaxation: "
       if s08_in_chain else "D.21 reproduced on the chain before S07.7: deleting a Tutor who used the Family Hub fails on the NO ACTION key "
       "wallet_ledger_created_by_fkey; with the S08 lane's ON DELETE SET NULL relaxation applied (the merged tree), ") +
      "deleting a Tutor who used the Family Hub makes the cascade's own update, which the S07.1 ledger guard refuses (LEDGER_APPEND_ONLY). "
      "No retention job exists for any Block D table")

# ── 2. Upgrade: erasure keeps the child's record ────────────────────────────
apply_parts(db0)
db = db0
ids = ids0
parent, co = ids['parent_a'], ids['parent_b']
kid = ids['kid9']
before = ledger_totals(db, kid)
authored = sql(f"SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND created_by = '{parent}'", db)
sql(f"DELETE FROM auth.users WHERE id = '{parent}'", db)
after = ledger_totals(db, kid)
assert before == after and before, (before, after)
state = sql(f"""SELECT (SELECT count(*) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND created_by IS NULL) || '|' ||
  (SELECT decided_by IS NULL FROM public.redemptions WHERE kid_user_id = '{kid}') || '|' ||
  (SELECT frozen AND frozen_by IS NULL AND opened_by IS NULL FROM public.banking_accounts WHERE kid_user_id = '{kid}') || '|' ||
  (SELECT parent_user_id IS NULL FROM public.allowance_rules WHERE kid_user_id = '{kid}') || '|' ||
  (SELECT parent_user_id IS NULL FROM public.spend_limits WHERE kid_user_id = '{kid}') || '|' ||
  (SELECT parent_user_id IS NULL FROM public.savings_bonus_rules WHERE kid_user_id = '{kid}') || '|' ||
  (SELECT count(*) FROM public.tasks WHERE assigned_to = '{kid}') || '|' ||
  (SELECT count(*) FROM public.guardian_links WHERE kid_user_id = '{kid}' AND verification_status = 'verified')""", db)
assert state == f'{authored}|true|true|true|true|true|0|1' and authored != '0', state
check(f'D.21 erasure keeps the child\'s record: deleting a Tutor (a co-Tutor remains) succeeds; the child\'s coins are unchanged '
      f'({before}); the ledger lines, the reward decision, the account (still frozen, now with no recorded freezer, so still the '
      f'Tutors\' freeze) and the three rules keep their rows with the departed Tutor\'s id cleared; the chores that Tutor created go '
      f'with them (tasks.assigned_by cascade, documented); the co-Tutor\'s link stays')

credited = service(db, f"SELECT public.run_due_scheduled_credits('{kid}')")
assert credited == '0', credited  # the account is frozen: nothing moves
sql(f"UPDATE public.banking_accounts SET frozen = false, frozen_at = NULL, frozen_by = '{co}' WHERE kid_user_id = '{kid}'", db)
credited = service(db, f"SELECT public.run_due_scheduled_credits('{kid}')")
assert int(credited) >= 2, credited
check(f'D.21: a rule whose Tutor was erased keeps running for the child (a frozen account moves nothing; once the co-Tutor lifts the '
      f'freeze the allowance and the bonus credit again, {credited} credits), so an erasure never stops a child\'s allowance')

refused(lambda: sql(f"UPDATE public.wallet_ledger SET created_by = '{co}' WHERE kid_user_id = '{kid}'", db), 'LEDGER_APPEND_ONLY')
refused(lambda: sql(f"UPDATE public.wallet_ledger SET amount = amount + 1, created_by = NULL WHERE kid_user_id = '{kid}'", db), 'LEDGER_APPEND_ONLY')
refused(lambda: sql(f"UPDATE public.redemptions SET decided_by = '{co}' WHERE kid_user_id = '{kid}'", db), 'REDEMPTION')
sql(f"UPDATE public.savings_bonus_rules SET parent_user_id = '{co}' WHERE kid_user_id = '{kid}'", db)
refused(lambda: sql(f"UPDATE public.savings_bonus_rules SET parent_user_id = NULL, rate_bp = 2000 WHERE kid_user_id = '{kid}'", db),
        'NOT_A_GUARDIAN')
refused(lambda: sql(f"UPDATE public.savings_bonus_rules SET rate_bp = 2000 WHERE kid_user_id = '{kid}'", db), 'SAVINGS_BONUS_FIXED_FOR_AGE')
sql(f"UPDATE public.banking_accounts SET frozen = true, frozen_at = now(), frozen_by = '{co}' WHERE kid_user_id = '{kid}'", db)
refused(lambda: sql(f"UPDATE public.banking_accounts SET frozen = false, frozen_at = NULL, frozen_by = '{kid}' WHERE kid_user_id = '{kid}'", db),
        'FREEZE_OWNED_BY_GUARDIAN')
check('D.21 the guards still hold for every other update: re-assigning a ledger line to someone else, or changing an amount while '
      'clearing its author, is LEDGER_APPEND_ONLY; re-assigning a reward decision is refused; a percentage for a 9-year-old is '
      'refused, and so is clearing a rule\'s Tutor together with any other change (NOT_A_GUARDIAN); a child still cannot lift a '
      'Tutor\'s freeze')

# The child's own erasure removes every Block D row about them.
kid15 = ids['kid15']
fam15 = family_money(db, ids, co, kid15)
service(db, f"SELECT public.family_research_set_consent('{kid15}', '{co}', true, 1)")
service(db, f"SELECT public.money_bridge_mark('{kid15}', 'first_pay', 0, true)")
CHILD_KEYS = {
    'wallet_ledger': 'kid_user_id', 'tasks': 'assigned_to', 'redemptions': 'kid_user_id', 'banking_accounts': 'kid_user_id',
    'allowance_rules': 'kid_user_id', 'spend_limits': 'kid_user_id', 'savings_bonus_rules': 'kid_user_id', 'savings_goals': 'kid_user_id',
    'share_destinations': 'holder_user_id', 'share_gifts': 'holder_user_id', 'wallet_guardian_actions': 'kid_user_id',
    'chore_streak_pauses': 'kid_user_id', 'chore_streak_days': 'kid_user_id', 'family_autonomy_changes': 'kid_user_id',
    'family_decisions': 'kid_user_id', 'guardian_links': 'kid_user_id', 'family_research_consents': 'subject_user_id',
    'family_research_participants': 'subject_user_id', 'money_bridge_progress': 'holder_user_id',
}
counts = {t: int(sql(f"SELECT count(*) FROM public.{t} WHERE {c} = '{kid15}'", db)) for t, c in CHILD_KEYS.items()}
assert all(counts[t] > 0 for t in ['wallet_ledger', 'tasks', 'family_decisions', 'family_research_participants', 'money_bridge_progress']), counts
sql(f"DELETE FROM public.user_roles WHERE user_id = '{kid15}'; DELETE FROM auth.users WHERE id = '{kid15}'", db)
left = {t: int(sql(f"SELECT count(*) FROM public.{t} WHERE {c} = '{kid15}'", db)) for t, c in CHILD_KEYS.items()}
assert all(v == 0 for v in left.values()), left
check(f'D.21 a child\'s erasure removes every Block D row about them: {len(CHILD_KEYS)} tables held {sum(counts.values())} rows for the '
      f'15-year-old (ledger, chores, decisions, rules, goals, Share, corrections, streak, ladder, research consent and participant, '
      f'bridge checklist) and hold none after the account is deleted')

# ── 3. D.21: the retention sweep, the photo purge and the compliance audit ──
kid17 = ids['kid17']
old_task, young_task, photo_task, shared_task, open_task = (chore(db, co, kid17, approve=True) for _ in range(5))
fixture(db, f"""
UPDATE public.tasks SET decided_at = now() - interval '420 days', created_at = now() - interval '421 days' WHERE id IN ('{old_task}', '{photo_task}');
UPDATE public.tasks SET decided_at = now() - interval '10 days' WHERE id = '{shared_task}';
UPDATE public.tasks SET evidence_bucket = 'task-evidence', evidence_hash = 'a1', evidence_ext = 'jpg', evidence_uploaded_at = now()
  WHERE id IN ('{photo_task}', '{shared_task}');
UPDATE public.tasks SET status = 'open', decided_at = NULL, decided_by = NULL, decision_id = NULL, allocated = false,
  evidence_bucket = 'task-evidence', evidence_hash = 'b2', evidence_ext = 'jpg', evidence_uploaded_at = now() WHERE id = '{open_task}';
UPDATE public.family_decisions SET created_at = now() - interval '420 days' WHERE task_id IN ('{old_task}', '{photo_task}');
INSERT INTO public.family_state_audit (table_name, row_id, db_role, created_at) VALUES ('tasks', 'x', 'postgres', now() - interval '500 days'),
  ('tasks', 'y', 'postgres', now());
INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at, created_at)
  VALUES ('{kid17}', '{co}', 'old-{uuid.uuid4().hex}', now() - interval '40 days', now() - interval '47 days'),
         ('{kid17}', '{co}', 'new-{uuid.uuid4().hex}', now() + interval '5 days', now());
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, created_at) VALUES ('{kid17}', 'save', 7, 'allowance', '{co}', now() - interval '500 days');
INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions) VALUES ('{kid17}', current_date - 500, 1);
INSERT INTO public.family_money_events (user_id, event, source, bucket, amount, created_at)
  VALUES ('{kid17}', 'credit', 'earned', 'save', 3, now() - interval '410 days'), ('{kid17}', 'credit', 'earned', 'save', 3, now());
""")
compliance = dict((r.split('|')[1], int(r.split('|')[2])) for r in
                  service(db, "SELECT data_class || '|' || table_name || '|' || overdue FROM public.family_retention_compliance()").splitlines())
assert compliance['tasks.evidence'] == 1 and compliance['family_decisions'] == 2 and compliance['tasks'] == 2, compliance
assert compliance['family_state_audit'] == 1 and compliance['guardian_invites'] == 1 and compliance['family_money_events'] == 1, compliance
balance = ledger_totals(db, kid17)
streak_days = sql(f"SELECT count(*) FROM public.chore_streak_days WHERE kid_user_id = '{kid17}'", db)

due = service(db, "SELECT task_id || '|' || hash || '|' || shared FROM public.family_evidence_due(100) ORDER BY 1")
# The photo chore is due and shares its content-addressed object with a chore
# decided 10 days ago (not due): only the pointer may go, the object stays.
assert due == f'{photo_task}|a1|true', due
removed = json.loads(service(db, 'SELECT public.family_retention_sweep()'))
assert removed['family_decisions'] == 2 and removed['tasks'] == 1, removed  # the photo chore waits for its photo
assert sql(f"SELECT count(*) FROM public.tasks WHERE id = '{photo_task}'", db) == '1'
assert removed['family_state_audit'] == 1 and removed['guardian_invites'] == 1 and removed['family_money_events'] == 1, removed
check(f'D.21 the sweep deletes what is past its period and nothing else: 2 decisions and 1 decided chore older than 400 days, 1 '
      f'transition-audit row older than 400 days, 1 invitation 30 days past its expiry and 1 behaviour event older than 400 days; the '
      f'decided chore whose photo is still stored is kept (a failed Depot call can never orphan a photo); the run is recorded '
      f'(run {removed["run_id"]})')

assert balance == 'save=7' and ledger_totals(db, kid17) == balance and sql(f"SELECT count(*) FROM public.chore_streak_days WHERE kid_user_id = '{kid17}'", db) == streak_days
assert sql(f"SELECT count(*) FROM public.tasks WHERE id IN ('{young_task}', '{shared_task}', '{open_task}')", db) == '3'
check(f'D.21 the coin record is the child\'s: a ledger line and a practised day from 500 days ago survive the sweep, so the ledger '
      f'totals ({balance}) and the streak\'s practised days are unchanged; young decided chores, an open chore and their decisions stay')

assert service(db, f"SELECT public.family_evidence_cleared('{open_task}', 'task-evidence', 'b2', 'jpg')") == 'f'
assert service(db, f"SELECT public.family_evidence_cleared('{shared_task}', 'task-evidence', 'a1', 'jpg')") == 'f'
refused(lambda: sql(claims(None, 'service_role') + f"UPDATE public.tasks SET evidence_bucket = NULL, evidence_hash = NULL, evidence_ext = NULL, "
                    f"evidence_uploaded_at = NULL WHERE id = '{shared_task}'", db), 'TASK_EVIDENCE_LOCKED')
refused(lambda: sql(f"UPDATE public.tasks SET evidence_bucket = NULL, evidence_hash = NULL, evidence_ext = NULL, evidence_uploaded_at = NULL, "
                    f"title = 'Changed' WHERE id = '{photo_task}'", db), 'TASK_IMMUTABLE_FIELD')
assert service(db, f"SELECT public.family_evidence_cleared('{photo_task}', 'task-evidence', 'zz', 'jpg')") == 'f'
assert service(db, f"SELECT public.family_evidence_cleared('{photo_task}', 'task-evidence', 'a1', 'jpg')") == 't'
assert service(db, f"SELECT public.record_family_evidence_purge({removed['run_id']}, 1, 0)") == 't'
assert service(db, f"SELECT public.record_family_evidence_purge({removed['run_id']}, 5, 5)") == 'f'
second = json.loads(service(db, 'SELECT public.family_retention_sweep()'))
assert second['tasks'] == 1 and sql(f"SELECT count(*) FROM public.tasks WHERE id = '{photo_task}'", db) == '0', second
overdue = service(db, "SELECT coalesce(sum(overdue), 0) FROM public.family_retention_compliance()")
assert overdue == '0', overdue
last = json.loads(service(db, 'SELECT public.family_retention_last_run()'))
assert last['removed']['tasks'] == 1 and last['evidence_cleared'] is None
check('D.21 photos (Appendix H Retention-Policy Compliance Audit): a decided chore\'s photo is due 30 days after the decision; a '
      'photo shared with a chore that is not due yet is flagged so only the pointer is cleared; the pointer clears only for the '
      'matching object on a chore decided over 30 days ago (an open chore\'s photo stays locked, and nothing else may change in the '
      'same update); the purge result is recorded once per run; the next sweep then removes the chore; the compliance audit '
      'reads zero overdue rows in every class afterwards')

for fn in ['family_retention_sweep()', 'family_retention_compliance()', 'family_evidence_due(10)', 'family_retention_last_run()',
           "family_evidence_cleared(gen_random_uuid(), 'a', 'b', 'c')", 'record_family_evidence_purge(1, 0, 0)']:
    refused(lambda fn=fn: browser(db, co, f'SELECT public.{fn}'), 'permission denied')
    refused(lambda fn=fn: as_role(db, 'anon', None, f'SELECT public.{fn}'), 'permission denied')
for query in ["INSERT INTO public.family_retention_runs (removed) VALUES ('{}')", 'DELETE FROM public.family_retention_runs']:
    refused(lambda query=query: service(db, query), 'permission denied')
check('D.21: no browser or anon session calls the sweep, the audit, the photo functions or the last run; the service role cannot '
      'write or delete the run record directly')

# ── 4. D.23: the reflective prompt's record and the monthly tip ────────────
kid14 = ids['kid14']
t1 = chore(db, co, kid14, approve=True)
d1 = service(db, f"SELECT public.record_decision_reflection('{co}', 'task', '{t1}', 'written')")
assert UUID_TEXT.fullmatch(d1)
refused(lambda: service(db, f"SELECT public.record_decision_reflection('{co}', 'task', '{t1}', 'skipped')"), 'REFLECTION_NO_DECISION')
t2 = chore(db, co, kid14, approve=True)
refused(lambda: service(db, f"SELECT public.record_decision_reflection('{ids['stranger']}', 'task', '{t2}', 'skipped')"), 'REFLECTION_NO_DECISION')
refused(lambda: service(db, f"SELECT public.record_decision_reflection('{co}', 'task', '{t2}', 'thought')"), 'REFLECTION_INVALID')
fixture(db, f"UPDATE public.family_decisions SET created_at = now() - interval '11 minutes' WHERE task_id = '{t2}';")
refused(lambda: service(db, f"SELECT public.record_decision_reflection('{co}', 'task', '{t2}', 'skipped')"), 'REFLECTION_NO_DECISION')
t3 = chore(db, co, kid14)
service(db, f"SELECT public.family_task_mark_done('{t3}', '{kid14}', NULL, NULL)")
service(db, f"SELECT public.family_decide_task('{t3}', '{co}', 'sent_back', 'redo', 'Please wipe the table again too')")
assert UUID_TEXT.fullmatch(service(db, f"SELECT public.record_decision_reflection('{co}', 'task', '{t3}', 'shared')"))
refused(lambda: service(db, f"INSERT INTO public.family_decision_reflections (decision_id, reflection) VALUES ('{d1}', 'written')"), 'permission denied')
rate = service(db, "SELECT tutor_decisions || '/' || with_reflection || '/' || written || '/' || shared || '/' || skipped "
                   "FROM public.parent_coaching_reflection_rate(now() - interval '1 hour')")
check(f'D.23 the reflective prompt\'s record: one per Tutor decision, matched to the decision that Tutor just made on that subject '
      f'(a second record, another adult, a value outside written/shared/skipped, or a decision older than ten minutes is refused); no '
      f'text is stored and nobody writes the table directly; prompt fired on Tutor decisions in the window: {rate} '
      f'(decisions/with/written/shared/skipped)')

tips = "ARRAY['contribution-vs-bonus', 'price-by-effort', 'keep-promises']"
assert service(db, f"SELECT public.parent_coaching_deliver('{co}', ARRAY[]::text[])") == ''
refused(lambda: service(db, f"SELECT public.parent_coaching_deliver('{co}', ARRAY['Not A Tip'])"), 'parent_coaching_deliveries_tip_id_check')
first = json.loads(service(db, f"SELECT public.parent_coaching_deliver('{co}', {tips})"))
assert first['tip_id'] == 'contribution-vs-bonus' and first['opened_at'] is None, first
again = json.loads(service(db, f"SELECT public.parent_coaching_deliver('{co}', {tips})"))
assert again['id'] == first['id']
assert service(db, f"SELECT public.parent_coaching_deliver('{co}', ARRAY['price-by-effort'])") == ''
fixture(db, f"UPDATE public.parent_coaching_deliveries SET period = (date_trunc('month', now()) - interval '1 month')::date WHERE id = '{first['id']}';")
second_tip = json.loads(service(db, f"SELECT public.parent_coaching_deliver('{co}', {tips})"))
assert second_tip['tip_id'] == 'price-by-effort', second_tip
for who in ['kid14', 'teen16', 'adult', 'guest']:
    refused(lambda who=who: service(db, f"SELECT public.parent_coaching_deliver('{ids[who]}', {tips})"), 'COACHING_NOT_ELIGIBLE')
opened = json.loads(service(db, f"SELECT public.parent_coaching_mark('{second_tip['id']}', '{co}', 'opened')"))
assert opened['opened_at'] is not None
refused(lambda: service(db, f"SELECT public.parent_coaching_mark('{second_tip['id']}', '{ids['stranger']}', 'opened')"), 'COACHING_NOT_FOUND')
refused(lambda: sql(f"UPDATE public.parent_coaching_deliveries SET tip_id = 'keep-promises' WHERE id = '{second_tip['id']}'", db),
        'COACHING_DELIVERY_IMMUTABLE')
delivery = service(db, "SELECT eligible || '/' || delivered || '/' || opened FROM public.parent_coaching_delivery_rate(current_date)")
assert delivery == '1/1/1', delivery
check(f'D.23 the monthly tip: nothing is delivered while no tip is reviewed; one tip per Tutor per month, the same row on every visit, '
      f'never a tip that is no longer reviewed; the next month brings the next unseen tip; a child, a teen, an adult who is not a Tutor '
      f'and a guest are refused (COACHING_NOT_ELIGIBLE); only the Tutor marks their own delivery; the delivery cannot be rewritten. '
      f'Delivery & Engagement Rate this month: eligible/delivered/opened = {delivery}')
for fn in [f"parent_coaching_deliver('{co}', {tips})", f"record_decision_reflection('{co}', 'task', '{t1}', 'written')",
           'parent_coaching_delivery_rate(current_date)', 'parent_coaching_reflection_rate(now())']:
    refused(lambda fn=fn: browser(db, co, f'SELECT public.{fn}'), 'permission denied')
check('D.23: no browser session calls the delivery, the reflection or either metric; only Core does')

# ── 5. D.19: the bridge follows age evidence ───────────────────────────────
expected = {'kid_nodob': False, 'kid9': False, 'kid14': False, 'kid17': True, 'kid18': True, 'teen14': False, 'teen16': True,
            'adult': False, 'guest': False, 'parent_b': False}
actual = {name: service(db, f"SELECT public.money_bridge_eligible('{ids[name]}')") == 't' for name in expected}
assert actual == expected, actual
sql(f"UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id = '{ids['kid14']}'", db)
assert service(db, f"SELECT public.money_bridge_eligible('{ids['kid14']}')") == 't'
check('D.19 the bridge by age evidence: 15 and older with a wallet (a family child at 15, 17 or 18, an independent teen at 16) is '
      'eligible; 14, 9, no birth date, an adult, a guest and a Tutor are not; a 15th birthday opens it with no stored state')

teen = ids['teen16']
refused(lambda: service(db, f"SELECT public.money_bridge_mark('{teen}', 'first_pay', 1, true)"), 'BRIDGE_MOMENT_FIRST')
refused(lambda: service(db, f"SELECT public.money_bridge_mark('{ids['teen14']}', 'first_pay', 0, true)"), 'BRIDGE_NOT_ELIGIBLE')
refused(lambda: service(db, f"SELECT public.money_bridge_mark('{teen}', 'lottery', 0, true)"), 'BRIDGE_ENTRY_INVALID')
for step in range(4):
    service(db, f"SELECT public.money_bridge_mark('{teen}', 'first_pay', {step}, true)")
service(db, f"SELECT public.money_bridge_mark('{teen}', 'first_account', 0, true)")
state = json.loads(service(db, f"SELECT public.money_bridge_state('{teen}')"))
assert state['eligible'] and len(state['progress']) == 5
service(db, f"SELECT public.money_bridge_mark('{teen}', 'first_account', 0, false)")
assert len(json.loads(service(db, f"SELECT public.money_bridge_state('{teen}')"))['progress']) == 4
assert browser(db, teen, 'SELECT count(*) FROM public.money_bridge_progress') == '4'
assert browser(db, ids['kid17'], 'SELECT count(*) FROM public.money_bridge_progress') == '0'
refused(lambda: browser(db, teen, f"INSERT INTO public.money_bridge_progress (holder_user_id, milestone, step) VALUES ('{teen}', 'first_budget', 0)"),
        'permission denied')
refused(lambda: service(db, f"INSERT INTO public.money_bridge_progress (holder_user_id, milestone, step) VALUES ('{teen}', 'first_budget', 0)"),
        'permission denied')
refused(lambda: browser(db, teen, f"SELECT public.money_bridge_mark('{teen}', 'first_budget', 0, true)"), 'permission denied')
engagement = service(db, "SELECT string_agg(milestone || '=' || eligible || '/' || engaged || '/' || arrived || '/' || completed, ',') "
                         "FROM public.money_bridge_engagement()")
assert engagement.startswith('all=4/1/1/1,first_pay=4/1/1/1,first_account=4/0/0/0'), engagement
check(f'D.19 the checklist: a step waits for its moment (BRIDGE_MOMENT_FIRST); a 14-year-old and an unknown moment are refused; '
      f'unticking a moment clears it; a teen reads only their own entries and nobody writes the table directly. Real-World Bridge '
      f'Engagement Rate (eligible/engaged/arrived/completed): {engagement}')

# ── 6. D.22: consent-gated, observational research instrumentation ─────────
kid9, kid17, kid18, teen14, teen16 = ids['kid9'], ids['kid17'], ids['kid18'], ids['teen14'], ids['teen16']
allowed = [(kid9, co), (kid17, co), (kid18, kid18), (ids['kid_nodob'], co)]
denied = [(kid18, co), (teen16, teen16), (teen14, teen14), (kid9, kid9), (kid9, ids['stranger']), (ids['adult'], ids['adult']),
          (ids['guest'], ids['guest']), (co, co)]
for subject, actor in denied:
    refused(lambda s=subject, a=actor: service(db, f"SELECT public.family_research_set_consent('{s}', '{a}', true, 1)"), 'RESEARCH_CONSENT_NOT_ALLOWED')
refused(lambda: service(db, f"SELECT public.family_research_set_consent('{kid9}', '{co}', true, 0)"), 'RESEARCH_DISCLOSURE_STALE')
for subject, actor in allowed:
    assert json.loads(service(db, f"SELECT public.family_research_set_consent('{subject}', '{actor}', true, 1)"))['admitted']
check('D.22 consent (OD-23: observational only, never an experiment on a minor): a verified Tutor may say yes for a child under 18 or '
      'of unknown age, and an 18-year-old only for themselves; a Tutor for an 18-year-old, a teen for themselves (independent or in a '
      'family), a child for themselves, an unrelated parent, an adult with no wallet, a guest and a Tutor for themselves are refused; a '
      'yes on an older disclosure is refused (RESEARCH_DISCLOSURE_STALE)')

# Hand-computed month: the consent is backdated three months, and last month
# gets known activity for kid17.
fixture(db, f"""
UPDATE public.family_research_consents SET granted_at = date_trunc('month', now()) - interval '3 months' WHERE subject_user_id IN ('{kid17}', '{kid9}');
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, created_at) VALUES
  ('{kid17}', 'save', 6, 'allowance', '{co}', date_trunc('month', now()) - interval '20 days'),
  ('{kid17}', 'spend', 4, 'allowance', '{co}', date_trunc('month', now()) - interval '20 days'),
  ('{kid17}', 'spend', -3, 'redemption', '{kid17}', date_trunc('month', now()) - interval '10 days'),
  ('{kid17}', 'save', 5, 'allowance', '{co}', date_trunc('month', now()) - interval '50 days');
INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions) VALUES
  ('{kid17}', (date_trunc('month', now()) - interval '5 days')::date, 1), ('{kid17}', (date_trunc('month', now()) - interval '6 days')::date, 2);
""")
last_month = "(date_trunc('month', now()) - interval '1 month')::date"
assert service(db, f'SELECT public.record_family_research_snapshots({last_month})') == '2'
assert service(db, f'SELECT public.record_family_research_snapshots({last_month})') == '0'
refused(lambda: service(db, "SELECT public.record_family_research_snapshots(current_date)"), 'RESEARCH_PERIOD_INCOMPLETE')
snap = sql(f"""SELECT s.coins_received || '/' || s.coins_to_save || '/' || s.coins_spent || '/' || s.practised_days || '/' || s.age_years
  || '/' || s.register || '/' || s.autonomy_level FROM public.family_research_snapshots s
  JOIN public.family_research_participants p ON p.research_id = s.research_id WHERE p.subject_user_id = '{kid17}'""", db)
assert snap == '10/6/3/2/17/teen/1', snap
columns = sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns "
              "WHERE table_name = 'family_research_snapshots'", db)
assert 'user' not in columns and 'note' not in columns and 'title' not in columns and 'reason' not in columns, columns
assert service(db, f"SELECT public.record_family_research_snapshots((date_trunc('month', now()) - interval '4 months')::date)") == '0'
check(f'D.22 the monthly snapshot: only complete months that began after the consent, once per month (a second run adds nothing; the '
      f'current month is refused), for admitted participants only; the hand-computed month for the 17-year-old reads '
      f'received/saved/spent/practised days/age/register/level = {snap}; the table has no identity, note, title or reason column '
      f'({columns})')

completeness = service(db, "SELECT string_agg(cohort || '=' || long_tenure || '/' || enrolled || '/' || measurable || '/' || complete, ',') "
                           "FROM public.family_research_completeness(1, 1)")
check(f'Appendix H Part 1.4 (Longitudinal-Hypothesis Data Completeness, Diagnostic), with a one-month window and one month of tenure: '
      f'long-tenure/enrolled/measurable/complete = {completeness} (the bridge_age cohort is D.19 (c): the 15+ population is tracked)')
assert completeness == 'all=1/1/1/1,bridge_age=1/1/1/1', completeness

# Withdrawal deletes; a lapse records nothing more.
withdrawn = json.loads(service(db, f"SELECT public.family_research_set_consent('{kid17}', '{kid17}', false, 1)"))
assert not withdrawn['participating'] and withdrawn['snapshots'] == 0
assert sql(f"SELECT count(*) FROM public.family_research_participants WHERE subject_user_id = '{kid17}'", db) == '0'
assert sql(f"SELECT revoked_at IS NOT NULL AND revoked_by = '{kid17}' FROM public.family_research_consents WHERE subject_user_id = '{kid17}'", db) == 't'
sql(f"UPDATE public.profiles SET birth_date = current_date - interval '18 years 1 day' WHERE user_id = '{kid9}'", db)
assert json.loads(service(db, f"SELECT public.family_research_state('{kid9}')"))['admitted'] is False
fixture(db, f"UPDATE public.family_research_snapshots SET period = (date_trunc('month', now()) - interval '2 months')::date;")
assert service(db, f'SELECT public.record_family_research_snapshots({last_month})') == '0'
sql(f"UPDATE public.profiles SET birth_date = current_date - interval '9 years' WHERE user_id = '{kid9}'", db)
check('D.22 saying no deletes: the child\'s own no (the participant, not only the Tutor) withdraws the consent and deletes every '
      'snapshot at once; a Tutor\'s yes lapses at 18, and nothing more is recorded until the young adult says yes themselves')

fixture(db, f"""
INSERT INTO public.family_research_snapshots (research_id, period, tenure_months, autonomy_level, coins_received, coins_to_save, coins_spent,
  coins_given, goals_reached, next_goals_set, chores_approved, rewards_asked, rewards_not_yet, practised_days, split_changed, bridge_entries)
  SELECT research_id, (date_trunc('month', now()) - interval '40 months')::date, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, 0
  FROM public.family_research_participants WHERE subject_user_id = '{kid9}';
""")
swept = json.loads(service(db, 'SELECT public.family_retention_sweep()'))
assert swept['family_research_snapshots'] == 1, swept
check('D.21/D.22: a research snapshot older than 1,100 days is deleted by the same sweep')

for fn in [f"family_research_set_consent('{kid9}', '{co}', true, 1)", f"family_research_state('{kid9}')",
           'record_family_research_snapshots()', 'family_research_completeness(3, 6)', f"family_research_admitted('{kid9}')"]:
    refused(lambda fn=fn: browser(db, co, f'SELECT public.{fn}'), 'permission denied')
for table in ['family_research_consents', 'family_research_participants', 'family_research_snapshots']:
    refused(lambda t=table: browser(db, co, f'SELECT count(*) FROM public.{t}'), 'permission denied')
    refused(lambda t=table: service(db, f'DELETE FROM public.{t}'), 'permission denied')
refused(lambda: service(db, 'SELECT count(*) FROM public.family_research_participants'), 'permission denied')
check('D.22: no browser session calls a research function or reads a research table; the service role reads consents only, never '
      'the pseudonym map or the snapshots, and deletes nothing directly')

# ── 7. Replay ──────────────────────────────────────────────────────────────
counts_before = sql("SELECT (SELECT count(*) FROM public.parent_coaching_deliveries) || '/' || (SELECT count(*) FROM public.money_bridge_progress)"
                    " || '/' || (SELECT count(*) FROM public.family_research_consents) || '/' || (SELECT count(*) FROM public.family_retention_runs)", db)
replay_parts(db)
counts_after = sql("SELECT (SELECT count(*) FROM public.parent_coaching_deliveries) || '/' || (SELECT count(*) FROM public.money_bridge_progress)"
                   " || '/' || (SELECT count(*) FROM public.family_research_consents) || '/' || (SELECT count(*) FROM public.family_retention_runs)", db)
assert counts_before == counts_after, (counts_before, counts_after)
refused(lambda: sql(f"UPDATE public.wallet_ledger SET amount = amount + 1 WHERE kid_user_id = '{kid}'", db), 'LEDGER_APPEND_ONLY')
check(f'replay: applying the five S07.7 parts again keeps every delivery, bridge entry, consent and run ({counts_after}) and every guard')

report = {
    'passed': True,
    'database': db,
    'migrations': [part.name for part in PARTS],
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim; the D.21 defects reproduced '
                  'on the chain before S07.7 (with the S08 lane\'s provenance statements applied by hand to model the merged tree), then '
                  'the same database upgraded in place through the S07.7 parts; browser roles exercised through SET ROLE with '
                  'request.jwt claims; backdated rows written as fixtures with triggers bypassed, every behaviour under test with '
                  'triggers on. Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
