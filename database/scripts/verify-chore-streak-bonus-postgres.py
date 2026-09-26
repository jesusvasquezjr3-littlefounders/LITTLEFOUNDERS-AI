"""D.2, D.10, D.11 (S07.3): chore streak facts, chore kinds and the age-framed
savings bonus, enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to fresh databases on an owned native PostgreSQL cluster, over the same
minimal Supabase shim as the S07.1/S07.2 verifiers. It first reproduces the
three gaps on the chain BEFORE the S07.3 parts (a zero-coin contribution
chore is impossible, any percentage reaches an 8-year-old, no practised-day
record exists), then upgrades that same database through the S07.3 parts
(legacy streaks and bonus rules migrate) and attacks the result as a
parent-created child, a verified Tutor, an unrelated parent, an adult, an
independent teen and a linked teen, through the browser roles and through the
service role (a Core defect), including real concurrency.

The streak arithmetic itself (rest days, pauses, best, milestones) is the pure
model in backend/src/services/choreStreak.ts, covered by Core's tests; this
script proves the FACTS it is computed from cannot be forged.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-chore-streak-bonus-postgres.json)
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
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-chore-streak-bonus-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_3_PARTS = ['_chore_streak_rest_days.sql', '_family_task_contribution_kind.sql', '_savings_bonus_age_framing.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_3_PARTS]
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
    database = 'lf_chore_bonus_' + uuid.uuid4().hex
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


POPULATIONS = ['kid9', 'kid14', 'kid_nob', 'kid_legacy', 'teen', 'teen_l', 'adult', 'parent_a', 'parent_t', 'stranger']


def people(db):
    ids = {name: str(uuid.uuid4()) for name in POPULATIONS}
    rows = ','.join(f"('{v}', false)" for v in ids.values())
    bands = {'teen': '13_to_17', 'teen_l': '13_to_17', 'adult': 'adult', 'parent_a': 'adult', 'parent_t': 'adult', 'stranger': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    kids = ['kid9', 'kid14', 'kid_nob', 'kid_legacy']
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
UPDATE public.profiles SET birth_date = current_date - interval '9 years 3 days' WHERE user_id IN ('{ids['kid9']}', '{ids['kid_legacy']}');
UPDATE public.profiles SET birth_date = current_date - interval '14 years 3 days' WHERE user_id = '{ids['kid14']}';
UPDATE public.profiles SET birth_date = NULL WHERE user_id = '{ids['kid_nob']}';
UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id IN ('{ids['teen']}', '{ids['teen_l']}');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('{ids['parent_a']}', 'parent'), ('{ids['parent_t']}', 'parent'), ('{ids['stranger']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES {','.join(f"('{ids['parent_a']}', '{ids[k]}', 'verified', now())" for k in kids)};
INSERT INTO public.user_roles (user_id, role) VALUES {','.join(f"('{ids[k]}', 'kid')" for k in kids)} ON CONFLICT DO NOTHING;
""", db)
    return ids


def link_teen(db, teen, parent):
    token = f'teen-{uuid.uuid4().hex}'
    service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{teen}', '{teen}', '{token}', now() + interval '7 days')")
    service(db, f"SELECT public.accept_guardian_invite('{token}', '{parent}')")
    link = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{parent}' AND kid_user_id = '{teen}'")
    assert service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen}', true)") == 'verified'


def task(db, parent, child, coins, kind=None):
    tid = str(uuid.uuid4())
    kind_col, kind_val = (', kind', f", '{kind}'") if kind else ('', '')
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins{kind_col}) "
                f"VALUES ('{tid}', '{parent}', '{child}', 'Chore', {coins}{kind_val})")
    return tid


def done(db, tid, day=None):
    extra = f", completed_on = {day}" if day else ''
    service(db, f"UPDATE public.tasks SET status = 'done'{extra} WHERE id = '{tid}'")


def approve(db, tid, parent):
    if FULL_CHAIN:
        # Since S07.5 (D.18) every Tutor decision goes through the decision flow.
        service(db, f"SELECT public.family_decide_task('{tid}', '{parent}', 'approved', NULL, NULL)")
        return
    service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{parent}', decided_at = now() WHERE id = '{tid}'")


def cancel(db, tid, parent):
    if FULL_CHAIN:
        service(db, f"SELECT public.family_decide_task('{tid}', '{parent}', 'cancelled', 'not_suitable', 'Not done this week, we try again')")
        return
    service(db, f"UPDATE public.tasks SET status = 'cancelled', decided_by = '{parent}', decided_at = now(), cancel_reason = 'Not done' WHERE id = '{tid}'")


def save_coins(db, kid, parent, amount):
    service(db, f"SELECT public.guardian_adjust_wallet('{kid}', '{parent}', 'save', {amount}, 'Starting coins')")


def due(db, kid):
    service(db, f"UPDATE public.savings_bonus_rules SET next_run_at = now() - interval '1 minute' WHERE kid_user_id = '{kid}'")
    service(db, f"SELECT public.run_due_scheduled_credits('{kid}')")
    return service(db, f"SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND reason = 'savings_bonus'")


# ── 1. Reproduce the three gaps on the chain BEFORE this checkpoint, then
#       upgrade that same database (legacy data migrates) ─────────────────────
previous = MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1]
db = fresh(previous)
p = people(db)
kid9, kid14, kid_nob, kid_legacy, teen, teen_l, adult, pa, pt, stranger = (p[k] for k in POPULATIONS)
assert sql("SELECT count(*) FROM pg_class WHERE relname = 'chore_streak_days'", db) == '0'
refused(lambda: task(db, pa, kid9, 0), 'TASK_REWARD_OUT_OF_RANGE')
for kid, rate in [(kid9, 2000), (kid_nob, 500), (kid14, 1500), (kid_legacy, 0)]:
    service(db, f"INSERT INTO public.savings_bonus_rules (kid_user_id, parent_user_id, rate_bp, active, next_run_at) "
                f"VALUES ('{kid}', '{pa}', {rate}, true, now() + interval '7 days')")
save_coins(db, kid9, pa, 57)
assert due(db, kid9) == '11', 'a 20% weekly percentage reached a 9-year-old'
service(db, f"INSERT INTO public.kid_task_streaks (kid_user_id, current_streak_days, longest_streak_days, last_completed_date) "
            f"VALUES ('{kid_legacy}', 4, 9, (now() AT TIME ZONE 'utc')::date - 1)")
check(f'before {PARTS[0].name}: no practised-day record exists (the streak is one counter the legacy arithmetic resets on any gap), '
      'a zero-coin chore is refused (every chore is paid), and a 20% weekly percentage reached a 9-year-old (57 saved -> 11 coins) (D.2, D.10, D.11 gaps reproduced)')

apply_parts(db)
legacy_days = service(db, f"SELECT count(*) || '/' || bool_and(legacy) || '/' || max(local_date) FROM public.chore_streak_days WHERE kid_user_id = '{kid_legacy}'")
assert legacy_days.startswith('4/true/'), legacy_days
by_kid = {k: service(db, f"SELECT rate_bp || ':' || active || ':' || coalesce(reframed_from_rate_bp::text, '-') FROM public.savings_bonus_rules WHERE kid_user_id = '{p[k]}'")
          for k in ['kid9', 'kid_nob', 'kid14', 'kid_legacy']}
assert by_kid == {'kid9': '1000:true:2000', 'kid_nob': '1000:false:500', 'kid14': '1500:true:-', 'kid_legacy': '1000:false:0'}, by_kid
check(f'upgrade: the legacy 4-day streak became 4 consecutive legacy days ending yesterday ({legacy_days}); bonus rules of under-13 or '
      f'undated children moved to the fixed ratio, switched off where the Tutor had agreed to less than 10%, the old rate kept for the '
      f'Tutor\'s notice; the 14-year-old\'s percentage is unchanged ({json.dumps(by_kid, sort_keys=True)})')

# ── 2. D.2: practised days follow the chore, never a direct write ───────────
framing = {k: service(db, f"SELECT coalesce(public.savings_bonus_framing('{v}'), 'none')") for k, v in p.items()}
t1 = task(db, pa, kid9, 5)
refused(lambda: service(db, f"INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins, completed_on) VALUES ('{pa}', '{kid9}', 'x', 5, current_date)"),
        'TASK_STATE_INVALID')
refused(lambda: done(db, t1, "(now() AT TIME ZONE 'utc')::date - 2"), 'TASK_COMPLETION_DAY_INVALID')
refused(lambda: done(db, t1, "(now() AT TIME ZONE 'utc')::date + 2"), 'TASK_COMPLETION_DAY_INVALID')
done(db, t1)
assert service(db, f"SELECT completed_on = (now() AT TIME ZONE 'utc')::date FROM public.tasks WHERE id = '{t1}'") == 't'
refused(lambda: service(db, f"UPDATE public.tasks SET completed_on = completed_on - 1 WHERE id = '{t1}'"), 'TASK_IMMUTABLE_FIELD')
t2 = task(db, pa, kid9, 5)
done(db, t2, "(now() AT TIME ZONE 'utc')::date")
today_row = lambda kid: service(db, f"SELECT coalesce((SELECT completions::text FROM public.chore_streak_days WHERE kid_user_id = '{kid}' AND local_date = (now() AT TIME ZONE 'utc')::date), 'none')")
assert today_row(kid9) == '2'
cancel(db, t2, pa)
assert today_row(kid9) == '1'
approve(db, t1, pa)
assert today_row(kid9) == '1'
t3 = task(db, pa, kid9, 5)
done(db, t3, "(now() AT TIME ZONE 'utc')::date + 1")
assert service(db, f"SELECT completions FROM public.chore_streak_days WHERE kid_user_id = '{kid9}' AND local_date = (now() AT TIME ZONE 'utc')::date + 1") == '1'
check('completion day: a task cannot be created with one; open -> done stamps the server UTC day when none is sent, accepts the child\'s '
      'local day within one day either side, refuses two days back or ahead, and the day can never change afterwards; two chores the same '
      'day count 2, a Tutor cancelling a done chore takes it back (1), approval keeps it')

for writer in [lambda q: service(db, q)]:
    refused(lambda: writer(f"INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions) VALUES ('{kid9}', current_date - 3, 1)"), 'CHORE_DAY_WRITE_FORBIDDEN')
    refused(lambda: writer(f"UPDATE public.chore_streak_days SET completions = 9 WHERE kid_user_id = '{kid9}'"), 'CHORE_DAY_WRITE_FORBIDDEN')
    refused(lambda: writer(f"UPDATE public.chore_streak_days SET legacy = true WHERE kid_user_id = '{kid9}'"), 'CHORE_DAY_WRITE_FORBIDDEN')
for who in [kid9, pa, teen, adult]:
    refused(lambda: browser(db, who, f"INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions) VALUES ('{kid9}', current_date - 3, 1)"), 'permission denied')
    refused(lambda: browser(db, who, f"INSERT INTO public.chore_streak_pauses (kid_user_id, starts_on, ends_on, created_by) VALUES ('{kid9}', current_date, current_date, '{pa}')"), 'permission denied')
    refused(lambda: browser(db, who, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', current_date, current_date)"), 'permission denied')
assert browser(db, kid9, f"SELECT count(*) FROM public.chore_streak_days WHERE kid_user_id = '{kid9}'") == '2'
assert browser(db, pa, f"SELECT count(*) FROM public.chore_streak_days WHERE kid_user_id = '{kid9}'") == '2'
assert browser(db, stranger, f"SELECT count(*) FROM public.chore_streak_days WHERE kid_user_id = '{kid9}'") == '0'
check('forgery: the service role cannot insert a practised day, raise a day\'s count or mark one legacy (only the task trigger writes days); '
      'the child, the Tutor, a teen and an adult have no browser write path to days or pauses and no pause RPC; the child and the Tutor read '
      'the days, an unrelated parent reads none')

# ── 3. D.2: holiday pauses ───────────────────────────────────────────────────
U = "(now() AT TIME ZONE 'utc')::date"
pause = service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', {U} - 3, {U} + 4)")
for actor, token in [(stranger, 'NOT_A_GUARDIAN'), (kid9, 'NOT_A_GUARDIAN'), (pt, 'NOT_A_GUARDIAN')]:
    refused(lambda: service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{actor}', {U} + 20, {U} + 21)"), token)
for start, end in [(f'{U} - 8', f'{U} - 8'), (f'{U} + 121', f'{U} + 122'), (f'{U} + 30', f'{U} + 51'), (f'{U} + 30', f'{U} + 29')]:
    refused(lambda: service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', {start}, {end})"), 'STREAK_PAUSE_INVALID')
refused(lambda: service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', {U} + 4, {U} + 6)"), 'STREAK_PAUSE_OVERLAP')
future = service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', {U} + 10, {U} + 12)")
service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', {U} + 20, {U} + 22)")
refused(lambda: service(db, f"SELECT public.guardian_pause_chore_streak('{kid9}', '{pa}', {U} + 40, {U} + 41)"), 'STREAK_PAUSE_LIMIT')
refused(lambda: service(db, f"SELECT public.guardian_end_chore_streak_pause('{future}', '{stranger}')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.chore_streak_pauses SET starts_on = starts_on - 1 WHERE id = '{pause}'"), 'STREAK_PAUSE_OVER')
refused(lambda: service(db, f"UPDATE public.chore_streak_pauses SET ends_on = ends_on + 1, changed_by = '{pa}' WHERE id = '{pause}'"), 'STREAK_PAUSE_INVALID')
refused(lambda: service(db, f"UPDATE public.chore_streak_pauses SET cancelled_at = now(), changed_by = '{pa}' WHERE id = '{pause}'"), 'STREAK_PAUSE_INVALID')
assert service(db, f"SELECT public.guardian_end_chore_streak_pause('{future}', '{pa}')") == 'cancelled'
assert service(db, f"SELECT public.guardian_end_chore_streak_pause('{pause}', '{pa}')") == 'ended'
assert service(db, f"SELECT (ends_on = {U} - 1)::text || '/' || (cancelled_at IS NULL)::text FROM public.chore_streak_pauses WHERE id = '{pause}'") == 'true/true'
refused(lambda: service(db, f"SELECT public.guardian_end_chore_streak_pause('{pause}', '{pa}')"), 'STREAK_PAUSE_OVER')
refused(lambda: service(db, f"SELECT public.guardian_end_chore_streak_pause('{future}', '{pa}')"), 'STREAK_PAUSE_OVER')
refused(lambda: service(db, f"SELECT public.guardian_end_chore_streak_pause('{uuid.uuid4()}', '{pa}')"), 'STREAK_PAUSE_NOT_FOUND')
refused(lambda: service(db, f"INSERT INTO public.chore_streak_pauses (kid_user_id, starts_on, ends_on, created_by) VALUES ('{kid9}', {U} + 60, {U} + 61, '{stranger}')"),
        'NOT_A_GUARDIAN')
check('pauses: the Tutor pauses 8 days starting 3 days ago; an unrelated parent, the child and another parent are refused; a start more '
      'than 7 days back or 120 ahead, 22 days, and an end before the start are refused; an overlap and a fourth live pause are refused; '
      'changing a start, extending, or "cancelling" a running pause directly are refused; a future pause is cancelled, the running one '
      'ends yesterday, and nothing can end twice; a direct insert by the service role for a stranger is refused')


def pause_once(i):
    try:
        service(db, f"SELECT public.guardian_pause_chore_streak('{kid14}', '{pa}', {U} + {30 + (i % 2)}, {U} + 33)")
        return 'ok'
    except RuntimeError as error:
        assert 'STREAK_PAUSE_OVERLAP' in str(error), error
        return 'refused'


with ThreadPoolExecutor(max_workers=8) as pool:
    pause_outcomes = list(pool.map(pause_once, range(8)))
assert pause_outcomes.count('ok') == 1, pause_outcomes
day_tasks = [task(db, pa, kid14, 3) for _ in range(8)]


def complete_once(tid):
    done(db, tid)
    return 'ok'


with ThreadPoolExecutor(max_workers=8) as pool:
    list(pool.map(complete_once, day_tasks))
assert today_row(kid14) == '8'
check('concurrency: 8 simultaneous overlapping pauses for one child -> exactly 1; 8 chores marked done at the same moment -> the day counts 8 (no lost update)')

# ── 4. D.10: contribution versus bonus ──────────────────────────────────────
c0 = task(db, pa, kid9, 0, 'contribution')
c2 = task(db, pa, kid9, 2, 'contribution')
b0 = task(db, pa, kid9, 7)
assert service(db, f"SELECT kind FROM public.tasks WHERE id = '{b0}'") == 'bonus'
refused(lambda: task(db, pa, kid9, 3, 'contribution'), 'TASK_REWARD_OUT_OF_RANGE')
refused(lambda: task(db, pa, kid9, 0, 'bonus'), 'TASK_REWARD_OUT_OF_RANGE')
refused(lambda: task(db, pa, kid9, 501, 'bonus'), 'TASK_REWARD_OUT_OF_RANGE')
refused(lambda: task(db, pa, kid9, 1, 'job'), 'TASK_KIND_INVALID')
refused(lambda: task(db, stranger, kid9, 0, 'contribution'), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.tasks SET kind = 'bonus', reward_coins = 20 WHERE id = '{c0}'"), 'TASK_IMMUTABLE_FIELD')
refused(lambda: service(db, f"UPDATE public.tasks SET kind = 'contribution' WHERE id = '{b0}'"), 'TASK_IMMUTABLE_FIELD')
refused(lambda: browser(db, pa, f"UPDATE public.tasks SET kind = 'bonus' WHERE id = '{c0}'"), 'permission denied')
done(db, c0)
approve(db, c0, pa)
refused(lambda: service(db, f"SELECT public.allocate_task_reward('{c0}', '{kid9}', 0, 0, 0, '{kid9}', NULL)"), 'TASK_ALLOCATION_INVALID')
assert service(db, f"SELECT public.allocate_task_reward('{c0}', '{kid9}', 1, 0, 0, '{kid9}', NULL)") == 'f'
refused(lambda: service(db, f"UPDATE public.tasks SET allocated = true WHERE id = '{c0}'"), 'TASK_ALLOCATION_INVALID')
done(db, c2)
approve(db, c2, pa)
assert service(db, f"SELECT public.allocate_task_reward('{c2}', '{kid9}', 1, 1, 0, '{kid9}', NULL)") == 't'
assert service(db, f"SELECT count(*) FROM public.wallet_ledger WHERE task_id = '{c0}'") == '0'
assert service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE task_id = '{c2}'") == '2'
adoption = service(db, "SELECT contribution_tasks || '/' || bonus_tasks || '/' || tutors || '/' || tutors_using_contribution FROM public.chore_tag_adoption(now() - interval '1 hour')")
contribution_count = service(db, "SELECT count(*) FROM public.tasks WHERE kind = 'contribution'")
bonus_count = service(db, "SELECT count(*) FROM public.tasks WHERE kind = 'bonus'")
assert adoption == f'{contribution_count}/{bonus_count}/1/1', adoption
refused(lambda: browser(db, pa, "SELECT * FROM public.chore_tag_adoption(now())"), 'permission denied')
check(f'kinds: a 0-coin and a 2-coin contribution and a default (bonus) chore are created; a 3-coin contribution, a 0- or 501-coin bonus, '
      f'an unknown kind and a stranger\'s chore are refused; the kind and reward can never change (service role) and the Tutor has no '
      f'browser path; a 0-coin contribution is approved and never allocated (an empty split and a direct flag are refused, a 1-coin split does not match, no ledger row); '
      f'a 2-coin contribution allocates normally; Chore-Tag Adoption (contribution/bonus/tutors/tutors using contribution) = {adoption}, service role only')

# ── 5. D.11: framing by age and the credit ───────────────────────────────────
assert framing == {'kid9': 'per_ten', 'kid14': 'percent', 'kid_nob': 'per_ten', 'kid_legacy': 'per_ten', 'teen': 'percent',
                   'teen_l': 'percent', 'adult': 'none', 'parent_a': 'none', 'parent_t': 'none', 'stranger': 'none'}, framing
upsert = lambda kid, parent, rate, active='true': service(db, f"INSERT INTO public.savings_bonus_rules (kid_user_id, parent_user_id, rate_bp, active, next_run_at) "
                                                         f"VALUES ('{kid}', '{parent}', {rate}, {active}, now() + interval '7 days') "
                                                         f"ON CONFLICT (kid_user_id) DO UPDATE SET rate_bp = EXCLUDED.rate_bp, active = EXCLUDED.active, "
                                                         f"parent_user_id = EXCLUDED.parent_user_id, reframed_from_rate_bp = NULL")
refused(lambda: upsert(kid9, pa, 1500), 'SAVINGS_BONUS_FIXED_FOR_AGE')
refused(lambda: upsert(kid_nob, pa, 500), 'SAVINGS_BONUS_FIXED_FOR_AGE')
refused(lambda: upsert(kid9, stranger, 1000), 'NOT_A_GUARDIAN')
refused(lambda: upsert(adult, pa, 1000), 'WALLET_HOLDER_REQUIRED')
refused(lambda: upsert(teen, pa, 1000), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"UPDATE public.savings_bonus_rules SET rate_bp = 2000 WHERE kid_user_id = '{kid9}'"), 'SAVINGS_BONUS_FIXED_FOR_AGE')
refused(lambda: browser(db, pa, f"UPDATE public.savings_bonus_rules SET rate_bp = 2000 WHERE kid_user_id = '{kid14}'"), 'permission denied')
upsert(kid_nob, pa, 1000)
upsert(kid14, pa, 1500)
link_teen(db, teen_l, pt)
upsert(teen_l, pt, 800)
refused(lambda: upsert(teen_l, pa, 800), 'NOT_A_GUARDIAN')

save_coins(db, kid_nob, pa, 57)
save_coins(db, kid14, pa, 57)
before9 = int(service(db, f"SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE kid_user_id = '{kid9}' AND reason = 'savings_bonus'"))
save9 = int(service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{kid9}' AND bucket = 'save'"))
gained9 = int(due(db, kid9)) - before9
assert gained9 == save9 // 10, (gained9, save9)
assert due(db, kid_nob) == '5'
assert due(db, kid14) == '8'
service(db, f"UPDATE public.profiles SET birth_date = current_date - interval '12 years 3 days' WHERE user_id = '{kid14}'")
assert service(db, f"SELECT public.savings_bonus_framing('{kid14}')") == 'per_ten'
gained = int(due(db, kid14)) - 8
save14 = int(service(db, f"SELECT sum(amount) FROM public.wallet_ledger WHERE kid_user_id = '{kid14}' AND bucket = 'save'")) - gained
assert gained == save14 // 10, (gained, save14)
service(db, f"UPDATE public.profiles SET birth_date = current_date - interval '14 years 3 days' WHERE user_id = '{kid14}'")
service(db, f"SELECT public.guardian_adjust_wallet('{teen_l}', '{pt}', 'save', 50, 'Birthday')")
assert due(db, teen_l) == '4'
check(f'bonus: framing by age, never role ({json.dumps(framing, sort_keys=True)}); a percentage for a 9-year-old or an undated child, a '
      'stranger\'s rule, an adult\'s rule, a rule for an unlinked teen and a direct rate change are refused, and the Tutor has no browser path; '
      f'the credit is 1 per full 10 saved under 13 ({save9} saved -> {gained9}; 57 -> 5), the Tutor\'s rate at 13+ (57 at 15% -> 8; a linked '
      f'teen\'s 50 at 8% -> 4), and a stored 15% never reaches a child whose birth date now says 12 ({save14} saved -> {gained})')

# A rule whose Tutor is no longer a guardian (simulated by a superuser write
# with triggers off): the weekly job's own bookkeeping still runs.
sql(f"SET session_replication_role = replica; UPDATE public.savings_bonus_rules SET parent_user_id = '{stranger}', active = true "
    f"WHERE kid_user_id = '{kid_legacy}'; SET session_replication_role = origin;", db)
save_coins(db, kid_legacy, pa, 23)
assert due(db, kid_legacy) == '2'
assert service(db, f"SELECT next_run_at > now() FROM public.savings_bonus_rules WHERE kid_user_id = '{kid_legacy}'") == 't'
refused(lambda: service(db, f"UPDATE public.savings_bonus_rules SET active = false WHERE kid_user_id = '{kid_legacy}'"), 'NOT_A_GUARDIAN')
check('bookkeeping: for a rule whose Tutor is no longer a guardian, the weekly job still credits (23 saved -> 2) and advances its own '
      'next run, while any configuration change on that rule is refused until a current Tutor saves it')

# ── 6. D.11: the 13-17 worked example ────────────────────────────────────────
for who in [kid9, kid_nob, adult, teen]:
    refused(lambda: service(db, f"SELECT public.record_savings_bonus_explanation('{who}', 'shown', NULL, NULL)"), 'EXAMPLE_NOT_APPLICABLE')
refused(lambda: service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'peeked', NULL, NULL)"), 'EXAMPLE_INVALID')
assert service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'shown', NULL, NULL)") == 't'
assert service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'shown', NULL, NULL)") == 't'
refused(lambda: service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'answered', 5, 1)"), 'EXAMPLE_INVALID')
assert service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'answered', 200, 20)") == 'f'
assert service(db, f"SELECT completed_at IS NULL FROM public.savings_bonus_explanations WHERE user_id = '{kid14}'") == 't'
assert service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'answered', 200, 30)") == 't'
assert service(db, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'answered', 200, 31)") == 'f'
assert service(db, f"SELECT attempts || '/' || (completed_at IS NOT NULL) FROM public.savings_bonus_explanations WHERE user_id = '{kid14}'") == '3/true'
assert service(db, f"SELECT public.record_savings_bonus_explanation('{teen_l}', 'shown', NULL, NULL)") == 't'
for who in [kid14, pa]:
    refused(lambda: browser(db, who, f"INSERT INTO public.savings_bonus_explanations (user_id, completed_at) VALUES ('{who}', now())"), 'permission denied')
    refused(lambda: browser(db, who, f"SELECT public.record_savings_bonus_explanation('{kid14}', 'shown', NULL, NULL)"), 'permission denied')
comprehension = service(db, "SELECT eligible || '/' || shown || '/' || completed FROM public.savings_bonus_comprehension(now() - interval '1 hour')")
assert comprehension == '2/2/1', comprehension
check(f'worked example: refused for under-13 and undated children, an adult and an unlinked teen (no percentage bonus); the 14-year-old '
      f'is shown it (idempotent), a wrong answer (20 for 200 at 15%) does not complete it, the right one (30) does, and a later wrong answer '
      f'never un-completes it; the answer is checked against the current rate in the database; no browser write path; Comprehension Proxy '
      f'(eligible/shown/completed) = {comprehension}')

# ── 7. Replay ────────────────────────────────────────────────────────────────
counts = lambda: service(db, "SELECT (SELECT count(*) FROM public.chore_streak_days) || '/' || (SELECT sum(completions) FROM public.chore_streak_days) || '/' || "
                             "(SELECT count(*) FROM public.chore_streak_pauses) || '/' || (SELECT count(*) FROM public.tasks) || '/' || "
                             "(SELECT string_agg(rate_bp || ':' || active, ',' ORDER BY kid_user_id) FROM public.savings_bonus_rules) || '/' || "
                             "(SELECT count(*) FROM public.savings_bonus_explanations)")
before_replay = counts()
apply_parts(db)
assert counts() == before_replay, (before_replay, counts())
refused(lambda: service(db, f"INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions) VALUES ('{kid9}', current_date - 3, 1)"), 'CHORE_DAY_WRITE_FORBIDDEN')
refused(lambda: upsert(kid9, pa, 1500), 'SAVINGS_BONUS_FIXED_FOR_AGE')
check(f'replay: re-applying the three S07.3 migrations preserves days, pauses, tasks, rules and explanations ({before_replay}) and the refusals')

report = {
    'passed': True,
    'database': db,
    'migrations': [part.name for part in PARTS],
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim, upgraded in place '
                  'through the S07.3 parts; browser roles exercised through SET ROLE with request.jwt claims, concurrency '
                  'through parallel sessions. Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
