"""D.17 and D.18 (S07.5): the graduated-autonomy ladder and the decision
record with actionable reasons, enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to fresh databases on an owned native PostgreSQL cluster, over the same
minimal Supabase shim as the S07.1-S07.4 verifiers. It first reproduces the
D.17/D.18 gaps on the chain BEFORE the S07.5 parts (a chore cancelled and a
reward denied with no reason, no level anywhere), then upgrades that same
database through the S07.5 parts and attacks the result as parent-created
children of 7, 9 and 13, a child with no birth date, an independent teen, a
teen who linked a parent, an adult, a guest, the verified Tutor, an unrelated
parent and three staff accounts (manage_support, view_analytics only, and an
admin with no grant), through the browser roles, the service role (a Core
defect) and a superuser forging rows (a writer that skips every flow),
including real concurrency. A second database carries a crafted, backdated
timeline so the Appendix H metrics are checked against hand-computed numbers.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN    directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
  LF_PG_DATA   the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/s07-autonomy-decisions-postgres.json)
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
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/s07-autonomy-decisions-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
S07_5_PARTS = ['_family_autonomy_ladder.sql', '_family_autonomy_rules.sql', '_family_autonomy_flows.sql',
               '_family_decision_guards.sql', '_family_decision_flows.sql', '_family_talk_nudges.sql']
PARTS = [next(m for m in MIGRATIONS if m.name.endswith(suffix)) for suffix in S07_5_PARTS]
FIXTURE = json.loads((ROOT / 'database/scripts/fixtures/denial-reasons.json').read_text(encoding='utf-8'))
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
    database = 'lf_autonomy_' + uuid.uuid4().hex
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


def q(text):
    return "'" + text.replace("'", "''") + "'"


# kid7/kid9: parent-created under 13 (kid7 under the Level 2 age). kid13: 13.
# kid_nodob: parent-created with no birth date. teen: independent (no parent).
# teen_l: a self-registered teen who linked the Tutor later.
# support / analyst / admin0: staff with manage_support, view_analytics only, no grant.
POPULATIONS = ['kid7', 'kid9', 'kid13', 'kid_nodob', 'teen', 'teen_l', 'adult', 'guest', 'parent_a', 'stranger',
               'support', 'analyst', 'admin0']


def people(db):
    ids = {name: str(uuid.uuid4()) for name in POPULATIONS}
    rows = ','.join(f"('{v}', {'true' if k == 'guest' else 'false'})" for k, v in ids.items())
    bands = {'kid7': 'under_13', 'kid9': 'under_13', 'kid13': '13_to_17', 'kid_nodob': 'under_13', 'teen': '13_to_17', 'teen_l': '13_to_17',
             'guest': '13_to_17', 'adult': 'adult', 'parent_a': 'adult', 'stranger': 'adult', 'support': 'adult', 'analyst': 'adult', 'admin0': 'adult'}
    declarations = ','.join(f"('{ids[k]}', '{band}')" for k, band in bands.items())
    kids = ['kid7', 'kid9', 'kid13', 'kid_nodob']
    sql(f"""
INSERT INTO auth.users (id, is_anonymous) VALUES {rows};
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES {declarations};
INSERT INTO public.account_safety_origins (user_id) VALUES ('{ids['kid7']}'), ('{ids['kid9']}');
UPDATE public.profiles SET birth_date = current_date - interval '7 years 3 days' WHERE user_id = '{ids['kid7']}';
UPDATE public.profiles SET birth_date = current_date - interval '9 years 3 days' WHERE user_id = '{ids['kid9']}';
UPDATE public.profiles SET birth_date = current_date - interval '13 years 3 days' WHERE user_id = '{ids['kid13']}';
UPDATE public.profiles SET birth_date = current_date - interval '15 years' WHERE user_id IN ('{ids['teen']}', '{ids['teen_l']}');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('{ids['parent_a']}', 'parent'), ('{ids['stranger']}', 'parent') ON CONFLICT DO NOTHING;
-- Staff fixtures: the admin-grant chain (a superadmin granter on a company
-- domain) is out of scope here, so its triggers are bypassed for setup only.
SET session_replication_role = replica;
INSERT INTO public.user_roles (user_id, role) VALUES
  ('{ids['support']}', 'admin'), ('{ids['analyst']}', 'admin'), ('{ids['admin0']}', 'admin') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_permissions (user_id, permission) VALUES ('{ids['support']}', 'manage_support'), ('{ids['analyst']}', 'view_analytics');
SET session_replication_role = origin;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
  VALUES {','.join(f"('{ids['parent_a']}', '{ids[k]}', 'verified', now())" for k in kids)};
INSERT INTO public.user_roles (user_id, role) VALUES {','.join(f"('{ids[k]}', 'kid')" for k in kids)} ON CONFLICT DO NOTHING;
INSERT INTO public.analytics_consents (kid_user_id, granted_by) VALUES ('{ids['kid13']}', '{ids['parent_a']}');
""", db)
    return ids


def link_teen(db, teen, parent):
    token = f'teen-{uuid.uuid4().hex}'
    service(db, f"INSERT INTO public.guardian_invites (kid_user_id, created_by, token, expires_at) VALUES ('{teen}', '{teen}', '{token}', now() + interval '7 days')")
    service(db, f"SELECT public.accept_guardian_invite('{token}', '{parent}')")
    link = service(db, f"SELECT id FROM public.guardian_links WHERE parent_user_id = '{parent}' AND kid_user_id = '{teen}'")
    assert service(db, f"SELECT public.teen_decide_guardian_link('{link}', '{teen}', true)") == 'verified'


def chore(db, parent, kid, coins=1, kind='bonus', photo=False):
    tid = str(uuid.uuid4())
    service(db, f"INSERT INTO public.tasks (id, assigned_by, assigned_to, title, kind, reward_coins, requires_evidence) "
                f"VALUES ('{tid}', '{parent}', '{kid}', 'Chore', '{kind}', {coins}, {'true' if photo else 'false'})")
    return tid


def done(db, tid, kid, note=None):
    return json.loads(service(db, f"SELECT public.family_task_mark_done('{tid}', '{kid}', NULL, {q(note) if note else 'NULL'})"))


def decide_task(db, tid, actor, outcome, code=None, reason=None):
    return service(db, f"SELECT public.family_decide_task('{tid}', '{actor}', '{outcome}', {q(code) if code else 'NULL'}, {q(reason) if reason else 'NULL'})")


def approvals(db, parent, kid, count):
    sql(f"""DO $$ DECLARE t uuid; BEGIN FOR i IN 1..{count} LOOP
        INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins) VALUES ('{parent}', '{kid}', 'Record', 1) RETURNING id INTO t;
        PERFORM public.family_task_mark_done(t, '{kid}', NULL, NULL);
        PERFORM public.family_decide_task(t, '{parent}', 'approved', NULL, NULL);
    END LOOP; END $$;""", db)


def fund(db, parent, kid, coins):
    tid = chore(db, parent, kid, coins)
    done(db, tid, kid)
    if service(db, f"SELECT status FROM public.tasks WHERE id = '{tid}'") == 'done':
        decide_task(db, tid, parent, 'approved')
    assert service(db, f"SELECT public.allocate_task_reward('{tid}', '{kid}', 0, {coins}, 0, '{kid}', NULL)") == 't'


def level(db, kid):
    return service(db, f"SELECT level || '/' || preapproved_limit || '/' || stored_level FROM public.family_autonomy_level('{kid}')")


def eligible(db, kid, lvl):
    return json.loads(service(db, f"SELECT public.family_autonomy_eligibility('{kid}', {lvl})"))


def balance(db, kid, bucket):
    return int(service(db, f"SELECT coalesce(sum(amount), 0) FROM public.wallet_ledger WHERE kid_user_id = '{kid}' AND bucket = '{bucket}'"))


GOOD_TASK = 'The dishes are still in the sink; rinse them and ask again.'
GOOD_REWARD = 'Save 10 more coins first, then we can get it.'

# ── 1. Reproduce the gaps on the chain BEFORE this checkpoint ────────────────
previous = MIGRATIONS[MIGRATIONS.index(PARTS[0]) - 1]
db = fresh(previous)
p = people(db)
kid7, kid9, kid13, kid_nodob, teen, teen_l, adult, guest, pa, stranger, support, analyst, admin0 = (p[k] for k in POPULATIONS)
assert sql("SELECT count(*) FROM pg_class WHERE relname IN ('family_decisions', 'family_autonomy_levels', 'family_talk_nudges')", db) == '0'
legacy_task = chore(db, pa, kid9, 3)
service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{legacy_task}'")
service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{pa}', decided_at = now() WHERE id = '{legacy_task}'")
bare_cancel = chore(db, pa, kid9, 2)
service(db, f"UPDATE public.tasks SET status = 'done' WHERE id = '{bare_cancel}'")
service(db, f"UPDATE public.tasks SET status = 'cancelled', decided_by = '{pa}', decided_at = now() WHERE id = '{bare_cancel}'")
catalog_pre = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{catalog_pre}', '{pa}', 'Movie', 5)")
legacy_red = service(db, f"INSERT INTO public.redemptions (catalog_id, kid_user_id) VALUES ('{catalog_pre}', '{kid9}') RETURNING id").splitlines()[0]
assert service(db, f"SELECT public.decide_redemption('{legacy_red}', false, '{pa}')") == 't'
assert service(db, f"SELECT cancel_reason IS NULL FROM public.tasks WHERE id = '{bare_cancel}'") == 't'
check(f'before {PARTS[0].name}: no decision record, level or nudge exists; a Tutor cancels a chore the child marked done with no reason at '
      'all, and denies a reward request with no reason (decide_redemption(false)): exactly the D.18 gap; every child is on the same flat '
      'approval model whatever their age (D.17)')

apply_parts(db)
backfill = service(db, f"SELECT string_agg(subject || ':' || outcome || ':' || legacy, ',' ORDER BY subject) FROM public.family_decisions WHERE kid_user_id = '{kid9}'")
assert backfill == 'redemption:denied:true,task:approved:true', backfill
assert service(db, f"SELECT decision_id IS NOT NULL FROM public.tasks WHERE id = '{legacy_task}'") == 't'
assert service(db, f"SELECT decision_id IS NOT NULL FROM public.redemptions WHERE id = '{legacy_red}'") == 't'
check('backfill (OD-9): the approved chore and the denied reward from before become legacy decision rows the track record reads, and '
      'their subjects point at them; a bare cancellation (no reason, no way to tell whether it was a denial) is not invented into one')

# ── 2. The actionable-reason rule, pinned by the shared fixture ─────────────
values = ','.join(f"({i}, {q(c['text'])})" for i, c in enumerate(FIXTURE['cases']))
verdicts = service(db, f"SELECT string_agg(public.family_reason_actionable(v.t)::text, ',' ORDER BY v.i) FROM (VALUES {values}) v (i, t)")
expected = ','.join('true' if c['actionable'] else 'false' for c in FIXTURE['cases'])
assert verdicts == expected, verdicts
check(f'family_reason_actionable() matches the shared fixture for all {len(FIXTURE["cases"])} cases in EN, es-MX and pt-BR (Core and the client '
      'are pinned to the same file): the SPEC\'s "not now" and its equivalents, fewer than three different words, under 12 or over 240 '
      'characters are refused; a reason that names what to do next passes, even when it starts with "not now"')

# ── 3. D.18 on chores: approve, send back, cancel ───────────────────────────
t1 = chore(db, pa, kid9, 4)
assert done(db, t1, kid9, 'I also folded the towels') == {'status': 'done', 'self_logged': False}
assert service(db, f"SELECT child_note FROM public.tasks WHERE id = '{t1}'") == 'I also folded the towels'
refused(lambda: service(db, f"UPDATE public.tasks SET child_note = 'edited' WHERE id = '{t1}'"), 'TASK_IMMUTABLE_FIELD')
refused(lambda: done(db, t1, kid9), 'TASK_NOT_OPEN')
refused(lambda: done(db, chore(db, pa, kid13), kid9), 'TASK_NOT_FOUND')
refused(lambda: done(db, chore(db, pa, kid9), kid9, 'x' * 141), 'TASK_NOTE_INVALID')
day = service(db, f"SELECT completed_on FROM public.tasks WHERE id = '{t1}'")
before_day = service(db, f"SELECT completions FROM public.chore_streak_days WHERE kid_user_id = '{kid9}' AND local_date = '{day}'")
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'cancelled', decided_by = '{pa}', decided_at = now(), cancel_reason = 'x' WHERE id = '{t1}'"), 'DECISION_REASON_REQUIRED')
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'open', completed_on = NULL WHERE id = '{t1}'"), 'DECISION_REASON_REQUIRED')
refused(lambda: decide_task(db, t1, pa, 'sent_back'), 'DECISION_REASON_REQUIRED')
refused(lambda: decide_task(db, t1, pa, 'sent_back', 'redo', 'Not now'), 'DECISION_REASON_NOT_ACTIONABLE')
refused(lambda: decide_task(db, t1, pa, 'sent_back', 'save_more', GOOD_TASK), 'DECISION_REASON_REQUIRED')
refused(lambda: decide_task(db, t1, stranger, 'sent_back', 'redo', GOOD_TASK), 'NOT_A_GUARDIAN')
refused(lambda: decide_task(db, t1, kid9, 'approved'), 'NOT_A_GUARDIAN')
assert decide_task(db, t1, pa, 'sent_back', 'redo', GOOD_TASK) == 'open'
assert service(db, f"SELECT status || '/' || (completed_on IS NULL) || '/' || (decided_by IS NULL) FROM public.tasks WHERE id = '{t1}'") == 'open/true/true'
after_day = service(db, f"SELECT completions FROM public.chore_streak_days WHERE kid_user_id = '{kid9}' AND local_date = '{day}'")
assert int(after_day) == int(before_day) - 1, (before_day, after_day)
assert done(db, t1, kid9, 'Rinsed them all now')['status'] == 'done'
assert decide_task(db, t1, pa, 'approved', None, 'Great job, thank you!') == 'approved'
t2 = chore(db, pa, kid9, 2)
done(db, t2, kid9)
assert decide_task(db, t2, pa, 'cancelled', 'not_suitable', 'We do not need the garage swept this week.') == 'cancelled'
assert service(db, f"SELECT cancel_reason FROM public.tasks WHERE id = '{t2}'") == 'We do not need the garage swept this week.'
t3 = chore(db, pa, kid9, 2)
refused(lambda: decide_task(db, t3, pa, 'cancelled', 'talk_first', 'no no no no'), 'DECISION_REASON_NOT_ACTIONABLE')
assert decide_task(db, t3, pa, 'cancelled', 'talk_first', 'Let us talk about which chores fit school nights.') == 'cancelled'
# The S07.1 direct approval still works, and records itself.
t4 = chore(db, pa, kid9, 2)
done(db, t4, kid9)
service(db, f"UPDATE public.tasks SET status = 'approved', decided_by = '{pa}', decided_at = now() WHERE id = '{t4}'")
assert service(db, f"SELECT d.outcome || '/' || d.actor_kind FROM public.tasks t JOIN public.family_decisions d ON d.id = t.decision_id WHERE t.id = '{t4}'") == 'approved/tutor'
history = service(db, f"SELECT string_agg(outcome || ':' || coalesce(reason_code, '-'), ',' ORDER BY created_at, outcome) FROM public.family_decisions WHERE task_id = '{t1}'")
assert history == 'sent_back:redo,approved:-', history
check('chores (D.18): the child marks a chore done with their own note (140 characters at most, never editable afterwards); a Tutor '
      'sends it back only with a task reason code and an actionable reason (none, "Not now" and a reward code are refused; a stranger and '
      'the child are refused), and it returns to open with no completion day and the practised day taken back; cancelling needs the same '
      'and stores the reason the child reads; a direct cancel or send-back by the service role without a decision is refused; the S07.1 '
      'direct approval still works and records its own decision; the chore keeps its full history (sent back, then approved with a note)')

# ── 4. D.18 on reward requests ──────────────────────────────────────────────
fund(db, pa, kid9, 40)
catalog = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{catalog}', '{pa}', 'Cinema', 10)")
refused(lambda: service(db, f"SELECT public.family_request_redemption('{kid9}', '{catalog}', NULL, NULL)"), 'REDEMPTION_REASON_REQUIRED')
refused(lambda: service(db, f"SELECT public.family_request_redemption('{kid9}', '{catalog}', 'because', NULL)"), 'REDEMPTION_REASON_REQUIRED')
r1 = json.loads(service(db, f"SELECT public.family_request_redemption('{kid9}', '{catalog}', 'saved_for_it', 'I saved for three weeks')"))
assert r1['status'] == 'requested' and r1['preapproved'] is False, r1
assert service(db, f"SELECT child_reason_kind || '/' || child_note FROM public.redemptions WHERE id = '{r1['id']}'") == 'saved_for_it/I saved for three weeks'
refused(lambda: service(db, f"UPDATE public.redemptions SET child_note = 'x' WHERE id = '{r1['id']}'"), 'REDEMPTION_IMMUTABLE_FIELD')
refused(lambda: service(db, f"SELECT public.decide_redemption('{r1['id']}', false, '{pa}')"), 'DECISION_REASON_REQUIRED')
deny = lambda actor, code, reason, revisit='NULL': service(db, f"SELECT public.family_decide_redemption('{r1['id']}', '{actor}', false, {q(code) if code else 'NULL'}, {q(reason) if reason else 'NULL'}, {revisit})")
refused(lambda: deny(pa, None, None), 'DECISION_REASON_REQUIRED')
refused(lambda: deny(pa, 'later_date', 'Let us wait until after your test on Friday.'), 'DECISION_REVISIT_INVALID')
refused(lambda: deny(pa, 'later_date', 'Let us wait until after your test on Friday.', "current_date + 91"), 'DECISION_REVISIT_INVALID')
refused(lambda: deny(pa, 'save_more', GOOD_REWARD, "current_date + 3"), 'DECISION_REVISIT_INVALID')
refused(lambda: deny(pa, 'redo', GOOD_REWARD), 'DECISION_REASON_REQUIRED')
refused(lambda: deny(pa, 'save_more', 'Ahora no'), 'DECISION_REASON_NOT_ACTIONABLE')
refused(lambda: deny(stranger, 'save_more', GOOD_REWARD), 'NOT_A_GUARDIAN')
assert deny(pa, 'later_date', 'Let us wait until after your test on Friday.', 'current_date + 3') == 'denied'
assert balance(db, kid9, 'spend') == 40
r2 = json.loads(service(db, f"SELECT public.family_request_redemption('{kid9}', '{catalog}', 'treat', NULL)"))
assert service(db, f"SELECT public.decide_redemption('{r2['id']}', true, '{pa}')") == 't'
assert service(db, f"SELECT d.outcome FROM public.redemptions r JOIN public.family_decisions d ON d.id = r.decision_id WHERE r.id = '{r2['id']}'") == 'approved'
assert balance(db, kid9, 'spend') == 30
check('reward requests (D.18): the child\'s reason is required from a closed set a young child can tap (plus an optional note) and '
      'can never be edited; the legacy decide_redemption(false) is refused; a denial needs a reward code and an actionable reason, and '
      '"later" needs a date 1 to 90 days ahead (no date, 91 days, or a date on another code are refused); the Spanish "Ahora no" is refused; '
      'a stranger is refused; the denial moves no coins; the legacy approval still works, pays, and records its own decision')

# ── 5. The decision record resists every writer ─────────────────────────────
refused(lambda: service(db, f"INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind) "
                            f"VALUES ('{kid9}', 'task', '{t1}', 'done', 'approved', '{pa}', 'tutor')"), 'permission denied')
for who in [kid9, pa]:
    refused(lambda: browser(db, who, f"INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind) "
                                     f"VALUES ('{kid9}', 'task', '{t1}', 'done', 'approved', '{pa}', 'tutor')"), 'permission denied')
    refused(lambda: browser(db, who, f"SELECT public.family_decide_task('{t1}', '{pa}', 'approved', NULL, NULL)"), 'permission denied')
refused(lambda: sql(f"UPDATE public.family_decisions SET reason = 'edited reason for the child' WHERE task_id = '{t1}'", db), 'DECISION_IMMUTABLE')
refused(lambda: sql(f"INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind, legacy) "
                    f"VALUES ('{kid9}', 'task', '{t1}', 'approved', 'approved', '{pa}', 'tutor', true)", db), 'DECISION_LEGACY_FORBIDDEN')
t5 = chore(db, pa, kid9, 2)
done(db, t5, kid9)
refused(lambda: sql(f"INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind) "
                    f"VALUES ('{kid9}', 'task', '{t5}', 'done', 'approved', '{pa}', 'tutor')", db), 'DECISION_UNAPPLIED')
refused(lambda: sql(f"INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind) "
                    f"VALUES ('{kid13}', 'task', '{t5}', 'done', 'approved', '{pa}', 'tutor')", db), 'DECISION_SUBJECT_INVALID')
refused(lambda: sql(f"INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind) "
                    f"VALUES ('{kid9}', 'task', '{t5}', 'done', 'denied', '{pa}', 'tutor')", db), 'DECISION_OUTCOME_INVALID')
assert browser(db, kid9, f"SELECT count(*) > 0 FROM public.family_decisions WHERE kid_user_id = '{kid9}'") == 't'
assert browser(db, pa, f"SELECT count(*) > 0 FROM public.family_decisions WHERE kid_user_id = '{kid9}'") == 't'
assert browser(db, stranger, f"SELECT count(*) FROM public.family_decisions WHERE kid_user_id = '{kid9}'") == '0'
assert browser(db, kid13, f"SELECT count(*) FROM public.family_decisions WHERE kid_user_id = '{kid9}'") == '0'
check('decision record: no service-role or browser insert, no browser call of a flow; even a superuser cannot edit a decision, forge a '
      'legacy row, record a decision whose state change did not happen (refused at commit), attach one to another child\'s chore or '
      'record an outcome the subject cannot have; the child and their Tutor read it, a stranger and another child do not')

# ── 6. D.17: every child starts on Level 1; eligibility is the documented rule
for kid in [kid7, kid9, kid13, kid_nodob]:
    assert level(db, kid) == '1/0/1', (kid, level(db, kid))
t6 = chore(db, pa, kid9, 0, 'contribution')
assert done(db, t6, kid9)['status'] == 'done'
e = eligible(db, kid9, 2)
assert e['eligible'] is False and e['age_ok'] is True and e['approved'] == 5 and e['not_approved'] == 4 and e['share_ok'] is False, e
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid9}', '{pa}', 2, 10)"), 'AUTONOMY_NOT_ELIGIBLE')
approvals(db, pa, kid9, 7)
e = eligible(db, kid9, 2)
assert e['approved'] == 12 and e['not_approved'] == 4 and e['share_ok'] is True and e['eligible'] is True, e
assert service(db, f"SELECT count(*) FROM public.family_autonomy_eligibility_log WHERE kid_user_id = '{kid9}' AND level = 2") == '1'
approvals(db, pa, kid7, 10)
e7 = eligible(db, kid7, 2)
assert e7['approved'] == 10 and e7['age_ok'] is False and e7['eligible'] is False, e7
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid7}', '{pa}', 2, 10)"), 'AUTONOMY_NOT_ELIGIBLE')
approvals(db, pa, kid_nodob, 10)
assert eligible(db, kid_nodob, 2)['age'] is None and eligible(db, kid_nodob, 2)['eligible'] is False
service(db, f"UPDATE public.profiles SET birth_date = current_date - interval '10 years' WHERE user_id = '{kid_nodob}'")
assert eligible(db, kid_nodob, 2)['eligible'] is True
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid9}', '{stranger}', 2, 10)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid9}', '{kid9}', 2, 10)"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid9}', '{pa}', 2, 21)"), 'AUTONOMY_LIMIT_INVALID')
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid9}', '{pa}', 3, 10)"), 'AUTONOMY_NOT_ELIGIBLE')
assert service(db, f"SELECT public.family_autonomy_set('{kid9}', '{pa}', 2, 15)") == '2'
assert level(db, kid9) == '2/15/2'
check('eligibility (D.17): every child starts on Level 1 with nothing pre-approved and a contribution still waits for the Tutor; Level 2 '
      'opens at age 8+ with 10 approved in 60 days and at most 25% not approved: the 9-year-old with 5 approved and 4 not (the '
      'backfilled legacy decisions included; a cancel of a chore never marked done excluded) is refused, then eligible at exactly the '
      '25% boundary with 12 approved and 4 not (the first eligible moment is logged); the 7-year-old with the same record is refused by age; a child with '
      'no birth date is not eligible until the Tutor records one; a stranger and the child cannot promote; the pre-approved amount is '
      'capped at 20 on Level 2; Level 3 is refused without 28 days on Level 2')

# ── 7. Level 2 unlocks, and nothing else ────────────────────────────────────
t7 = chore(db, pa, kid9, 0, 'contribution')
assert done(db, t7, kid9) == {'status': 'approved', 'self_logged': True}
assert service(db, f"SELECT d.outcome || '/' || d.actor_kind || '/' || (t.decided_by IS NULL) FROM public.tasks t JOIN public.family_decisions d ON d.id = t.decision_id WHERE t.id = '{t7}'") == 'self_logged/child/true'
t8 = chore(db, pa, kid9, 5)
assert done(db, t8, kid9) == {'status': 'done', 'self_logged': False}
refused(lambda: sql(f"""BEGIN;
INSERT INTO public.family_decisions (id, kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind)
VALUES ('{uuid.uuid4()}', '{kid9}', 'task', '{t8}', 'done', 'self_logged', '{kid9}', 'child');
UPDATE public.tasks SET status = 'approved', decided_at = now(), decision_id = (SELECT id FROM public.family_decisions WHERE task_id = '{t8}' AND outcome = 'self_logged') WHERE id = '{t8}';
COMMIT;""", db), 'TASK_SELF_LOG_FORBIDDEN')
cheap = str(uuid.uuid4())
dear = str(uuid.uuid4())
service(db, f"INSERT INTO public.redemption_catalog (id, parent_user_id, title, cost) VALUES ('{cheap}', '{pa}', 'Sticker', 10), ('{dear}', '{pa}', 'Game', 18)")
r3 = json.loads(service(db, f"SELECT public.family_request_redemption('{kid9}', '{cheap}', 'treat', NULL)"))
assert r3['status'] == 'approved' and r3['preapproved'] is True, r3
assert balance(db, kid9, 'spend') == 20
r4 = json.loads(service(db, f"SELECT public.family_request_redemption('{kid9}', '{dear}', 'saved_for_it', NULL)"))
assert r4['status'] == 'requested', r4
refused(lambda: sql(f"""BEGIN;
INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, redemption_id, created_by) VALUES ('{kid9}', 'spend', -18, 'redemption', '{r4['id']}', '{kid9}');
INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind) VALUES ('{kid9}', 'redemption', '{r4['id']}', 'requested', 'preapproved', '{kid9}', 'child');
UPDATE public.redemptions SET status = 'approved', decided_at = now(), decision_id = (SELECT id FROM public.family_decisions WHERE redemption_id = '{r4['id']}') WHERE id = '{r4['id']}';
COMMIT;""", db), 'REDEMPTION_PREAPPROVAL_FORBIDDEN')
service(db, f"INSERT INTO public.spend_limits (kid_user_id, parent_user_id, period, cap) VALUES ('{kid9}', '{pa}', 'weekly', 15)")
refused(lambda: service(db, f"SELECT public.family_request_redemption('{kid9}', '{cheap}', 'treat', NULL)"), 'SPEND_LIMIT_REACHED')
service(db, f"DELETE FROM public.spend_limits WHERE kid_user_id = '{kid9}'")
service(db, f"INSERT INTO public.banking_accounts (kid_user_id, display_number, opened_by) VALUES ('{kid9}', 'LF-1234-5678', '{pa}')")
service(db, f"UPDATE public.banking_accounts SET frozen = true, frozen_by = '{pa}', frozen_at = now() WHERE kid_user_id = '{kid9}'")
refused(lambda: service(db, f"SELECT public.family_request_redemption('{kid9}', '{cheap}', 'treat', NULL)"), 'ACCOUNT_FROZEN')
service(db, f"UPDATE public.banking_accounts SET frozen = false, frozen_by = '{pa}', frozen_at = NULL WHERE kid_user_id = '{kid9}'")
check('Level 2 (D.17): a family contribution marked done is self-logged at once (approved by the child under the level, no Tutor, '
      'recorded as such); a bonus chore still waits; a superuser forging a self-logged bonus chore is refused by the task guard; a '
      '10-coin reward inside the 15-coin pre-approved amount is approved and paid with no tap, an 18-coin one waits; a forged '
      'pre-approval over the amount is refused; the spending limit and the freeze still stop a pre-approved reward')

# ── 8. Level 3, photos, and the age cap ─────────────────────────────────────
approvals(db, pa, kid13, 20)
assert service(db, f"SELECT public.family_autonomy_set('{kid13}', '{pa}', 2, 20)") == '2'
e3 = eligible(db, kid13, 3)
assert e3['days_ok'] is False and e3['eligible'] is False, e3
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid13}', '{pa}', 3, 100)"), 'AUTONOMY_NOT_ELIGIBLE')
sql(f"ALTER TABLE public.family_autonomy_levels DISABLE TRIGGER family_autonomy_level_guard; "
    f"UPDATE public.family_autonomy_levels SET level_since = now() - interval '29 days' WHERE kid_user_id = '{kid13}'; "
    f"ALTER TABLE public.family_autonomy_levels ENABLE TRIGGER family_autonomy_level_guard;", db)
assert eligible(db, kid13, 3)['eligible'] is True
refused(lambda: service(db, f"SELECT public.family_autonomy_set('{kid13}', '{pa}', 3, 101)"), 'AUTONOMY_LIMIT_INVALID')
assert service(db, f"SELECT public.family_autonomy_set('{kid13}', '{pa}', 3, 100)") == '3'
t9 = chore(db, pa, kid13, 100)
assert done(db, t9, kid13)['self_logged'] is True
t10 = chore(db, pa, kid13, 150)
assert done(db, t10, kid13)['self_logged'] is False
t11 = chore(db, pa, kid13, 20, photo=True)
assert done(db, t11, kid13)['self_logged'] is False
assert service(db, f"SELECT public.family_task_self_log('{t11}', '{kid13}')") == 'f'
service(db, f"UPDATE public.tasks SET evidence_bucket = 'b', evidence_hash = 'h', evidence_ext = 'jpg', evidence_uploaded_at = now() WHERE id = '{t11}'")
assert service(db, f"SELECT public.family_task_self_log('{t11}', '{kid13}')") == 't'
service(db, f"UPDATE public.profiles SET birth_date = current_date - interval '11 years' WHERE user_id = '{kid13}'")
assert level(db, kid13) == '2/20/3', level(db, kid13)
t12 = chore(db, pa, kid13, 30)
assert done(db, t12, kid13)['self_logged'] is False
service(db, f"UPDATE public.profiles SET birth_date = current_date - interval '13 years 3 days' WHERE user_id = '{kid13}'")
assert level(db, kid13) == '3/100/3'
check('Level 3 (D.17): 28 days on Level 2 are required (refused on day 0, eligible on day 29 with age 13 and 20 approved); the '
      'pre-approved amount is capped at 100; a 100-coin chore is self-logged, a 150-coin one waits; a chore that asks for a photo waits '
      'until the photo is in, then self-logs; if the birth date changes to 11, the level in force falls to 2 (pre-approved 20) at '
      'once, whatever is stored, and a 30-coin chore waits again')

# ── 9. Reviews afterwards, the evidence-based step-down, and the rollback ───
self_logged = service(db, f"SELECT string_agg(id::text, ',' ORDER BY created_at) FROM public.family_decisions WHERE kid_user_id = '{kid13}' AND outcome = 'self_logged'").split(',')
assert len(self_logged) == 2, self_logged
review = lambda dec, actor, outcome, code=None, reason=None: service(db, f"SELECT public.family_review_decision('{dec}', '{actor}', '{outcome}', {q(code) if code else 'NULL'}, {q(reason) if reason else 'NULL'})")
refused(lambda: review(self_logged[0], stranger, 'confirmed'), 'NOT_A_GUARDIAN')
assert review(self_logged[0], pa, 'confirmed') == 'confirmed'
refused(lambda: review(self_logged[0], pa, 'questioned', 'redo', GOOD_TASK), 'DECISION_ALREADY_REVIEWED')
refused(lambda: review(self_logged[1], pa, 'questioned'), 'DECISION_REASON_REQUIRED')
tutor_approved = service(db, f"SELECT id FROM public.family_decisions WHERE kid_user_id = '{kid13}' AND outcome = 'approved' LIMIT 1")
refused(lambda: review(tutor_approved, pa, 'confirmed'), 'DECISION_NOT_FOUND')
assert review(self_logged[1], pa, 'questioned', 'redo', 'The photo shows only half the room; tidy the rest.') == 'questioned'
more = []
for _ in range(2):
    t = chore(db, pa, kid13, 10)
    done(db, t, kid13)
    more.append(service(db, f"SELECT decision_id FROM public.tasks WHERE id = '{t}'"))
assert review(more[0], pa, 'questioned', 'not_finished', 'The bike is still muddy; wash the wheels too.') == 'questioned'
assert level(db, kid13) == '3/100/3'
assert review(more[1], pa, 'questioned', 'not_finished', 'The shelf still has books on the floor below it.') == 'questioned'
assert level(db, kid13) == '2/20/2', level(db, kid13)
sys_change = service(db, f"SELECT actor_kind || '/' || reason_code || '/' || from_level || '>' || to_level || '/' || (actor_user_id IS NULL) FROM public.family_autonomy_changes WHERE kid_user_id = '{kid13}' ORDER BY created_at DESC LIMIT 1")
assert sys_change == 'system/questioned_pattern/3>2/true', sys_change
refused(lambda: sql(f"""BEGIN;
INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_kind, reason_code)
VALUES ('{kid13}', 2, 1, 20, 0, 'system', 'questioned_pattern');
COMMIT;""", db), 'AUTONOMY_SYSTEM_FORBIDDEN')
setlvl = lambda kid, actor, lvl, lim, code=None, reason=None: service(db, f"SELECT public.family_autonomy_set('{kid}', '{actor}', {lvl}, {lim}, {q(code) if code else 'NULL'}, {q(reason) if reason else 'NULL'})")
refused(lambda: setlvl(kid9, pa, 1, 0), 'AUTONOMY_REASON_REQUIRED')
refused(lambda: setlvl(kid9, pa, 1, 0, 'practice_more', 'Maybe later'), 'AUTONOMY_REASON_REQUIRED')
assert setlvl(kid9, pa, 2, 5) == '2'
assert level(db, kid9) == '2/5/2'
assert service(db, f"SELECT public.family_autonomy_step_down('{kid9}')") == '1'
assert level(db, kid9) == '1/0/1'
refused(lambda: service(db, f"SELECT public.family_autonomy_step_down('{kid9}')"), 'AUTONOMY_CHILD_STEP_DOWN_ONLY')
refused(lambda: sql(f"""BEGIN;
INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_user_id, actor_kind)
VALUES ('{kid9}', 1, 2, 0, 0, '{kid9}', 'child');
INSERT INTO public.family_autonomy_levels (kid_user_id, level, preapproved_limit) VALUES ('{kid9}', 2, 0)
ON CONFLICT (kid_user_id) DO UPDATE SET level = 2;
COMMIT;""", db), 'AUTONOMY_CHILD_STEP_DOWN_ONLY')
staff_lower = lambda actor, lvl, reason: service(db, f"SELECT public.family_autonomy_staff_lower('{kid13}', '{actor}', {lvl}, {q(reason)})")
STAFF_REASON = 'Support review found the level was reached by mistake.'
refused(lambda: staff_lower(analyst, 1, STAFF_REASON), 'AUTONOMY_STAFF_FORBIDDEN')
refused(lambda: staff_lower(admin0, 1, STAFF_REASON), 'AUTONOMY_STAFF_FORBIDDEN')
refused(lambda: staff_lower(pa, 1, STAFF_REASON), 'AUTONOMY_STAFF_FORBIDDEN')
refused(lambda: staff_lower(support, 3, STAFF_REASON), 'AUTONOMY_STAFF_LOWER_ONLY')
refused(lambda: staff_lower(support, 1, 'Not now'), 'AUTONOMY_REASON_REQUIRED')
assert staff_lower(support, 1, STAFF_REASON) == '1'
assert level(db, kid13) == '1/0/1'
check('afterwards and rollback (D.17, Appendix H DoD (d)): a Tutor confirms or questions a self-directed item once (a question needs an '
      'actionable reason; a stranger, a second review, and a review of a Tutor\'s own approval are refused); the third question in 30 '
      'days steps the level down by one automatically (3 to 2, pre-approved 100 to 20, a system change with its reason code), and a '
      'superuser cannot forge a system change; a Tutor lowers a level only with an actionable reason; the child steps down on their '
      'own but can never step up; staff lower a level only with manage_support (analytics-only, no-grant admins and a parent are '
      'refused), only downward, and only with a reason')

# ── 10. The child's own ask, and the Tutor's answer ─────────────────────────
ask = lambda kid, note=None: service(db, f"SELECT public.family_autonomy_request_level('{kid}', {q(note) if note else 'NULL'})")
req = ask(kid9, 'I did all my chores for two weeks')
refused(lambda: ask(kid9), 'AUTONOMY_REQUEST_PENDING')
refused(lambda: ask(kid7, 'x' * 141), 'AUTONOMY_REQUEST_INVALID')
answer = lambda request, actor, grant, lim='NULL', code=None, reason=None, revisit='NULL': service(
    db, f"SELECT public.family_autonomy_decide_request('{request}', '{actor}', {grant}, {lim}, {q(code) if code else 'NULL'}, {q(reason) if reason else 'NULL'}, {revisit})")
refused(lambda: answer(req, stranger, 'false', code='practice_more', reason=GOOD_TASK), 'NOT_A_GUARDIAN')
refused(lambda: answer(req, pa, 'false'), 'DECISION_REASON_REQUIRED')
refused(lambda: answer(req, pa, 'false', code='redo', reason=GOOD_TASK), 'DECISION_REASON_REQUIRED')
assert answer(req, pa, 'false', code='later_date', reason='Let us try again after the school trip next week.', revisit='current_date + 10') == 'declined'
refused(lambda: answer(req, pa, 'true', 10), 'AUTONOMY_REQUEST_DECIDED')
req2 = ask(kid9)
assert answer(req2, pa, 'true', 10) == 'granted'
assert level(db, kid9) == '2/10/2'
req7 = ask(kid7)
refused(lambda: answer(req7, pa, 'true', 10), 'AUTONOMY_NOT_ELIGIBLE')
req_nodob = ask(kid_nodob)
assert setlvl(kid_nodob, pa, 2, 0) == '2'
assert service(db, f"SELECT status FROM public.family_autonomy_requests WHERE id = '{req_nodob}'") == 'granted'
refused(lambda: ask(teen), 'AUTONOMY_NOT_IN_FAMILY')
refused(lambda: ask(adult), 'AUTONOMY_NOT_IN_FAMILY')
refused(lambda: ask(guest), 'AUTONOMY_NOT_IN_FAMILY')
refused(lambda: setlvl(teen, pa, 2, 0), 'NOT_A_GUARDIAN')
link_teen(db, teen_l, pa)
approvals(db, pa, teen_l, 10)
assert eligible(db, teen_l, 2)['age'] == 15 and eligible(db, teen_l, 2)['eligible'] is True
assert setlvl(teen_l, pa, 2, 20) == '2'
check('the child\'s voice (D.17 via D.18): the child asks for the next level in their own words (one pending ask, 140 characters); a '
      'Tutor declines only with a level code and an actionable reason ("later" with a date), grants only when the rule says eligible '
      '(the 7-year-old\'s ask cannot be granted), and a direct promotion grants the pending ask; an independent teen, an adult and a '
      'guest have no ladder (OD-3 Option B: no family mechanics), while a teen who linked the Tutor climbs it like any child in a family')

# ── 11. The level tables resist every writer ────────────────────────────────
refused(lambda: service(db, f"INSERT INTO public.family_autonomy_levels (kid_user_id, level) VALUES ('{kid7}', 3)"), 'permission denied')
refused(lambda: service(db, f"UPDATE public.family_autonomy_levels SET level = 3 WHERE kid_user_id = '{kid9}'"), 'permission denied')
refused(lambda: service(db, f"INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_user_id, actor_kind) VALUES ('{kid7}', 1, 2, 0, 0, '{pa}', 'tutor')"), 'permission denied')
for who in [kid9, pa]:
    refused(lambda: browser(db, who, f"UPDATE public.family_autonomy_levels SET level = 3 WHERE kid_user_id = '{kid9}'"), 'permission denied')
    refused(lambda: browser(db, who, f"SELECT public.family_autonomy_set('{kid9}', '{pa}', 3, 0)"), 'permission denied')
refused(lambda: sql(f"INSERT INTO public.family_autonomy_levels (kid_user_id, level) VALUES ('{kid7}', 3)", db), 'AUTONOMY_CHANGE_REQUIRED')
refused(lambda: sql(f"""BEGIN;
INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_user_id, actor_kind, reason_code, reason)
VALUES ('{kid9}', 2, 1, 10, 0, '{pa}', 'tutor', 'practice_more', 'Let us practise saving before the next step.');
COMMIT;""", db), 'AUTONOMY_CHANGE_UNAPPLIED')
refused(lambda: sql(f"UPDATE public.family_autonomy_changes SET to_level = 3 WHERE kid_user_id = '{kid9}'", db), 'AUTONOMY_CHANGE_IMMUTABLE')
assert browser(db, kid9, f"SELECT level FROM public.family_autonomy_levels WHERE kid_user_id = '{kid9}'") == '2'
assert browser(db, pa, f"SELECT count(*) FROM public.family_autonomy_changes WHERE kid_user_id = '{kid9}'") != '0'
assert browser(db, stranger, f"SELECT count(*) FROM public.family_autonomy_levels WHERE kid_user_id = '{kid9}'") == '0'
refused(lambda: browser(db, pa, 'SELECT count(*) FROM public.family_autonomy_eligibility_log'), 'permission denied')
check('level tables: no service-role or browser write, no browser call of a flow; a superuser cannot write a level without its change, '
      'a change without its level (refused at commit) or edit a change; the child and their Tutor read their levels and history, a '
      'stranger does not, and no browser reads the eligibility log')

# ── 12. Concurrency: pre-approvals never overdraw Spend ─────────────────────
start = balance(db, kid9, 'spend')
assert start == 20, start
pool = ThreadPoolExecutor(8)
results = list(pool.map(lambda _: json.loads(service(db, f"SELECT public.family_request_redemption('{kid9}', '{cheap}', 'treat', NULL)"))['status'], range(8)))
assert results.count('approved') == 2 and results.count('requested') == 6, results
assert balance(db, kid9, 'spend') == 0
check('concurrency: 8 simultaneous 10-coin requests inside the pre-approved amount against 20 coins in Spend: exactly 2 are pre-approved '
      'and paid, 6 wait for the Tutor, and Spend ends at 0, never below')

# ── 13. D.18: "talk about it" ───────────────────────────────────────────────
nudges = lambda kid: service(db, f"SELECT count(*) FROM public.family_talk_nudges WHERE kid_user_id = '{kid}' AND origin = 'pattern'")
assert nudges(kid7) == '0'
for i in range(2):
    t = chore(db, pa, kid7, 1)
    done(db, t, kid7)
    decide_task(db, t, pa, 'sent_back', 'redo', GOOD_TASK)
assert nudges(kid7) == '0'
t = chore(db, pa, kid7, 1)
done(db, t, kid7)
decide_task(db, t, pa, 'cancelled', 'not_suitable', 'We will pick an easier chore for school nights.')
assert nudges(kid7) == '1'
assert service(db, f"SELECT denials || '/' || status FROM public.family_talk_nudges WHERE kid_user_id = '{kid7}'") == '3/open'
t = chore(db, pa, kid7, 1)
done(db, t, kid7)
last = decide_task(db, t, pa, 'sent_back', 'redo', GOOD_TASK)
assert nudges(kid7) == '1'
open_cancel = chore(db, pa, kid7, 1)
decide_task(db, open_cancel, pa, 'cancelled', 'not_suitable', 'We will pick an easier chore for school nights.')
assert service(db, f"SELECT count(*) FROM public.family_decisions WHERE task_id = '{open_cancel}' AND prior_status = 'open'") == '1'
denial = service(db, f"SELECT id FROM public.family_decisions WHERE kid_user_id = '{kid7}' AND outcome = 'sent_back' LIMIT 1")
approval = service(db, f"SELECT id FROM public.family_decisions WHERE kid_user_id = '{kid7}' AND outcome = 'approved' LIMIT 1")
ask_talk = service(db, f"SELECT public.family_talk_request('{kid7}', '{denial}')")
assert service(db, f"SELECT public.family_talk_request('{kid7}', '{denial}')") == ask_talk
refused(lambda: service(db, f"SELECT public.family_talk_request('{kid7}', '{approval}')"), 'TALK_NUDGE_INVALID')
refused(lambda: service(db, f"SELECT public.family_talk_request('{kid9}', '{denial}')"), 'TALK_NUDGE_INVALID')
refused(lambda: sql(f"INSERT INTO public.family_talk_nudges (kid_user_id, origin, decision_id, denials) VALUES ('{kid7}', 'pattern', '{denial}', 3)", db), 'TALK_NUDGE_FORBIDDEN')
refused(lambda: service(db, f"INSERT INTO public.family_talk_nudges (kid_user_id, origin, decision_id) VALUES ('{kid7}', 'child', '{denial}')"), 'permission denied')
pattern = service(db, f"SELECT id FROM public.family_talk_nudges WHERE kid_user_id = '{kid7}' AND origin = 'pattern'")
refused(lambda: service(db, f"SELECT public.family_talk_close('{pattern}', '{stranger}', 'talked')"), 'NOT_A_GUARDIAN')
refused(lambda: service(db, f"SELECT public.family_talk_close('{pattern}', '{kid7}', 'talked')"), 'NOT_A_GUARDIAN')
assert service(db, f"SELECT public.family_talk_close('{pattern}', '{pa}', 'talked')") == 'talked'
refused(lambda: service(db, f"SELECT public.family_talk_close('{pattern}', '{pa}', 'dismissed')"), 'TALK_NUDGE_CLOSED')
assert service(db, f"SELECT public.family_talk_close('{ask_talk}', '{pa}', 'dismissed')") == 'dismissed'
assert browser(db, kid7, f"SELECT count(*) FROM public.family_talk_nudges WHERE kid_user_id = '{kid7}'") == '2'
assert browser(db, stranger, f"SELECT count(*) FROM public.family_talk_nudges WHERE kid_user_id = '{kid7}'") == '0'
check('"talk about it" (D.18): two "not yet"s open nothing, the third within 14 days opens one pattern nudge (3 denials) and the '
      'fourth adds none (one per 14 days); cancelling a chore the child never marked done is not a denial of their request; the child '
      'asks to talk about a "not yet" (idempotent), never about a yes or another child\'s decision; a pattern nudge cannot be forged even '
      'by a superuser, and no service-role insert exists; only a verified Tutor closes a nudge ("we talked" or dismissed), once')

# ── 14. The eligibility sweep and the replay ────────────────────────────────
assert service(db, 'SELECT public.record_family_autonomy_eligibility_all() >= 0') == 't'
counts = lambda: sql("SELECT (SELECT count(*) FROM public.family_decisions) || '/' || (SELECT count(*) FROM public.family_autonomy_changes) || '/' "
                     "|| (SELECT count(*) FROM public.family_autonomy_levels) || '/' || (SELECT count(*) FROM public.family_talk_nudges) || '/' "
                     "|| (SELECT count(*) FROM public.family_autonomy_eligibility_log)", db)
before_replay = counts()
apply_parts(db)
assert counts() == before_replay, (before_replay, counts())
after_replay = chore(db, pa, kid9, 1)
refused(lambda: decide_task(db, after_replay, pa, 'cancelled', 'redo', 'Not now'), 'DECISION_REASON_NOT_ACTIONABLE')
refused(lambda: service(db, f"UPDATE public.tasks SET status = 'cancelled', decided_by = '{pa}', decided_at = now() WHERE id = '{after_replay}'"), 'DECISION_REASON_REQUIRED')
check(f'replay: re-applying the six S07.5 migrations preserves every decision, change, level, nudge and eligibility row ({before_replay}) '
      'and every refusal; the nightly eligibility sweep runs')

# ── 15. Appendix H metrics on a crafted, backdated timeline ─────────────────
m = fresh(TARGET)
mp = people(m)
mk7, mk9, mk13, mkn = mp['kid7'], mp['kid9'], mp['kid13'], mp['kid_nodob']
mpa, man, madmin = mp['parent_a'], mp['analyst'], mp['admin0']
sql(f"""SET session_replication_role = replica;
INSERT INTO public.family_autonomy_eligibility_log (kid_user_id, level, first_eligible_at) VALUES
  ('{mk9}', 2, now() - interval '40 days'), ('{mk13}', 2, now() - interval '45 days'), ('{mk7}', 2, now() - interval '35 days'),
  ('{mkn}', 2, now() - interval '5 days'), ('{mk13}', 3, now() - interval '100 days');
INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_user_id, actor_kind, created_at) VALUES
  ('{mk9}', 1, 2, 0, 10, '{mpa}', 'tutor', now() - interval '30 days'),
  ('{mk13}', 1, 2, 0, 10, '{mpa}', 'tutor', now() - interval '5 days'),
  ('{mk9}', 2, 1, 10, 0, NULL, 'system', now() - interval '3 days'),
  ('{mk13}', 2, 1, 10, 0, '{mpa}', 'tutor', now() - interval '2 days');
""", m)
prog = sql("SELECT string_agg(level || '=' || judged || '/' || progressed || '/' || waiting, ' ' ORDER BY level) FROM public.family_autonomy_progression(now() - interval '60 days')", m)
assert prog == '2=3/1/1 3=0/0/0', prog
downs = sql("SELECT string_agg(actor_kind || '=' || step_downs, ' ' ORDER BY actor_kind) FROM public.family_autonomy_step_downs(now() - interval '60 days')", m)
assert downs == 'child=0 staff=0 system=1 tutor=1', downs
tk = [str(uuid.uuid4()) for _ in range(8)]
sql(f"SET session_replication_role = replica; INSERT INTO public.tasks (id, assigned_by, assigned_to, title, reward_coins) VALUES "
    + ','.join(f"('{t}', '{mpa}', '{mk13}', 'Chore', 1)" for t in tk) + ';', m)
neg = [(0, 30), (1, 28), (2, 26), (3, 20), (4, 10), (5, 9), (6, 8), (7, 1)]
base = sql('SELECT now()', m)
decisions = [(str(uuid.uuid4()), tk[i], days) for i, days in neg]
reasons = ['The dishes are still in the sink; rinse them.', 'not now', 'Fold the towels in half, please.', 'Sweep under the table too.',
           'Put the books back on the shelf.', 'Water the plants in the kitchen too.', 'Feed the cat before school.', 'Take the bins out tonight.']
sql("SET session_replication_role = replica; INSERT INTO public.family_decisions (id, kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind, reason_code, reason, created_at) VALUES "
    + ','.join(f"('{d}', '{mk13}', 'task', '{t}', 'done', 'sent_back', '{mpa}', 'tutor', 'redo', {q(reasons[i])}, '{base}'::timestamptz - interval '{days} days')"
               for i, (d, t, days) in enumerate(decisions)) + ';', m)
# Episodes: starts at the 3rd "not yet" (26 days ago) and at the first qualifying one 14+ days later (9 days ago); only the first opened its nudge.
sql(f"SET session_replication_role = replica; INSERT INTO public.family_talk_nudges (kid_user_id, origin, decision_id, denials, status, created_at) "
    f"VALUES ('{mk13}', 'pattern', '{decisions[2][0]}', 3, 'talked', '{base}'::timestamptz - interval '26 days'), "
    f"('{mk13}', 'child', '{decisions[7][0]}', NULL, 'open', '{base}'::timestamptz - interval '1 day');", m)
rate = sql("SELECT patterns || '/' || nudged || '/' || child_asks || '/' || talked || '/' || dismissed || '/' || still_open FROM public.family_talk_nudge_rate(now() - interval '60 days')", m)
assert rate == '2/1/1/1/0/1', rate
sample = sql("SELECT count(*) FROM public.family_denial_reason_sample(now() - interval '60 days', 50)", m)
assert sample == '8', sample
sql(f"SET session_replication_role = replica; INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind, reason_code, reason, created_at) "
    f"VALUES ('{mk9}', 'task', '{tk[0]}', 'done', 'sent_back', '{mpa}', 'tutor', 'redo', 'Rinse the cups in the sink too.', now() - interval '2 days');", m)
assert sql("SELECT count(*) FROM public.family_denial_reason_sample(now() - interval '60 days', 50)", m) == '8'
shape = sql("SELECT pg_get_function_result('public.family_denial_reason_sample(timestamptz, int)'::regprocedure)", m)
assert shape == 'TABLE(decision_id uuid, subject text, outcome text, reason_code text, reason text, created_at timestamp with time zone)', shape
score = lambda who, dec, verdict: sql(f"SELECT public.family_score_denial_reason('{dec}', '{who}', {verdict})", m)
refused(lambda: score(madmin, decisions[0][0], 'true'), 'DENIAL_SCORE_FORBIDDEN')
refused(lambda: score(mpa, decisions[0][0], 'true'), 'DENIAL_SCORE_FORBIDDEN')
under13 = sql(f"SELECT id FROM public.family_decisions WHERE kid_user_id = '{mk9}' LIMIT 1", m)
refused(lambda: score(man, under13, 'true'), 'DENIAL_SCORE_INVALID')
for i, (d, _, _) in enumerate(decisions[:4]):
    assert score(man, d, 'false' if i == 1 else 'true') == 't'
assert score(man, decisions[0][0], 'false') == 'f'
act = sql("SELECT denials || '/' || structured || '/' || admitted || '/' || scored || '/' || actionable FROM public.family_denial_actionability(now() - interval '60 days')", m)
assert act == '9/9/8/4/3', act
assert sql("SELECT count(*) FROM public.family_denial_reason_sample(now() - interval '60 days', 50)", m) == '4'
check(f'Appendix H metrics (crafted timeline): Independence-Tier Progression {prog} (level=judged/progressed/waiting: of three children '
      f'first eligible more than 30 days ago one was promoted within 30 days, one later, one never; one still inside the window); '
      f'step-downs by who lowered the level {downs}; nudge trigger rate {rate} (patterns/nudged/child asks/talked/dismissed/open: two '
      f'repeated-denial episodes, one of which had its nudge; the mechanism is checked, not assumed); the actionability sample only '
      f'draws reasons of children the H.1 gate admits (the under-13 child\'s is excluded) and carries no identity; only view_analytics '
      f'staff score (a no-grant admin and a parent are refused), once per reason; Denial-Reason Actionability {act} '
      '(denials/structured/admitted/scored/actionable)')

report = {
    'passed': True,
    'database': db,
    'migrations': [part.name for part in PARTS],
    'checks': checks,
    'provenance': 'Actual migration chain on fresh native PostgreSQL with a minimal Supabase role/auth shim, upgraded in place '
                  'through the S07.5 parts; browser roles exercised through SET ROLE with request.jwt claims, forged writes as a '
                  'superuser, concurrency through parallel sessions; metrics on a second database with a crafted, backdated '
                  'timeline. Does not replace a full Supabase (PostgREST/GoTrue) stack run.',
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
print(json.dumps(report, indent=2))
