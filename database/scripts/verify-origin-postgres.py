"""A.2 / A.4 / H.1: the under-13 origin and the optional-event admission trigger, against real PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on an owned native PostgreSQL cluster, over the
minimal Supabase shim the other identity verifiers use, then proves at the
enforcing boundary, against the LATEST definition of each function:

  - A.2 origin: concurrent marks store one record; a guest upgrade (identity,
    email, editable metadata) cannot clear it; the browser roles can neither
    read, write nor call it; the service role cannot rewrite or delete it;
    deleting the account removes it;
  - A.4 age declaration: the first declaration wins under concurrency; an
    under-13 declaration marks the origin in the same transaction (a failed
    declaration write rolls the origin back); a later under-13 disclosure
    still protects; the browser has no way in;
  - E.4: a browser identity cannot set or change a profile birth date, while
    the owner's other profile fields stay writable;
  - C.1: the Mentor calibration is first-write-wins, leaves the origin alone
    and is closed to the browser;
  - H.1: a teen's analytics opt-out persists under concurrency and is closed
    to the browser;
  - Appendix M 1.1 (Unconsented Analytics Event Rate, flagged sessions): the
    optional-event trigger (guard_optional_learning_event) admits a
    learning_events row only for an admitted population. A flagged-origin
    account records none, whatever its declared band, role, teen opt-in or
    guardian analytics consent; a guest, a child without consent, a teen
    without an opt-in, an account with no declaration or no role record none;
    an account flagged after an admitted event records none from then on; a
    teen who reached adult by birth month keeps an earlier "no"; safety and
    audit logs are never switched off;
  - the same trigger under concurrency, with the lock wait observed each time:
    an event racing a teen's revocation or an under-13 origin mark waits for
    it and is refused (the choice locks the account row; the mark is
    serialized by its foreign key's KEY SHARE lock on that row), and a revocation or mark racing an
    already-admitted event waits for that event to commit first, so no
    optional event ever commits after the "no" or the flag is acknowledged;
  - Appendix M 1.1 measured (GAP-FIX-R7 fix7identi0): identity_metrics'
    unconsentedFlagged count reads the event log filtered by the origin flag.
    It is zero while the guards hold; an event admitted BEFORE a later flag is
    not counted; a row that bypasses the admission trigger (the trigger
    disabled in a mutation run, then a service-role insert on learning_events
    or an owner insert on family_money_events) makes it non-zero, and only
    inside the window.

Cluster selection (never the shared Docker stack):
  LF_PG_PSQL   path to psql (default: LF_PG_BIN/psql, else <repo>/.codex/audit-db/pgsql/bin)
  LF_PG_BIN    directory holding psql
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
  LF_PG_DATA   when set, the data directory the server must report (ownership check)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
  LF_PG_REUSE  a database this script already migrated (kept with LF_PG_KEEP=1)
  LF_PG_REPORT optional path for a JSON report of the passed checks

Run by database/scripts/identity-db-verify.mjs (npm run identity:db-verify) in
database CI, the repo gates and release readiness. Minimal auth fixtures: this
does not certify GoTrue.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
import json
import os
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('LF_PG_BIN', str(ROOT / '.codex/audit-db/pgsql/bin')))
PSQL = os.environ.get('LF_PG_PSQL', str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if os.environ.get('LF_PG_DATA') and Path(sql('SHOW data_directory')).resolve() != Path(os.environ['LF_PG_DATA']).resolve():
    raise RuntimeError('Refusing a cluster whose data directory is not LF_PG_DATA')

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
-- Supabase's broad defaults: every migration must revoke explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

REUSE = os.environ.get('LF_PG_REUSE')
database = REUSE or 'lf_origin_' + uuid.uuid4().hex[:12]
if not REUSE:
    sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(statement):
    return run(f'SET ROLE service_role; {statement}')


def check(name):
    checks.append(name)
    print('ok -', name)


def denied(role, statement, messages=('permission denied',), sub=None):
    claim = f"SET request.jwt.claim.sub = '{sub}'; " if sub else ''
    try:
        run(f'{claim}SET ROLE {role}; {statement}')
    except RuntimeError as error:
        assert any(m in str(error) for m in messages), str(error)
        return 1
    raise AssertionError(f'{role} bypassed the boundary: {statement}')


def account(anonymous=False):
    uid = str(uuid.uuid4())
    run(f"INSERT INTO auth.users(id, email, is_anonymous) VALUES ('{uid}', '{uid[:8]}@example.invalid', {str(anonymous).lower()})")
    return uid


def origin(uid):
    return run(f"SELECT count(*) FROM account_safety_origins WHERE user_id = '{uid}'")


def no_service_writes(table):
    for privilege in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'):
        if table == 'account_safety_origins' and privilege == 'INSERT':
            continue
        assert run(f"SELECT has_table_privilege('service_role', 'public.{table}', '{privilege}')") == 'f', (table, privilege)


try:
    if not REUSE:
        run(SHIM)
        for migration in MIGRATIONS:
            try:
                run(migration.read_text(encoding='utf-8'))
            except RuntimeError as error:
                raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(MIGRATIONS)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # ── A.2: the under-13 origin ────────────────────────────────────────────
    guest = account(anonymous=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert list(pool.map(lambda _: service(f"SELECT mark_under13_origin('{guest}')"), range(8))) == ['t'] * 8
    assert origin(guest) == '1'
    before = run(f"SELECT row_to_json(o) FROM account_safety_origins o WHERE user_id = '{guest}'")
    run(f"""UPDATE auth.users SET is_anonymous = false, email = 'upgraded@example.invalid',
            raw_user_meta_data = '{{"under13_origin": false}}' WHERE id = '{guest}'""")
    assert run(f"SELECT row_to_json(o) FROM account_safety_origins o WHERE user_id = '{guest}'") == before
    check('eight concurrent marks store one origin record; a guest upgrade (identity, email, editable metadata) leaves it unchanged')

    denials = 0
    for role in ('anon', 'authenticated'):
        for statement in ('SELECT * FROM public.account_safety_origins',
                          f"SELECT public.mark_under13_origin('{guest}')",
                          'DELETE FROM public.account_safety_origins',
                          'UPDATE public.account_safety_origins SET under13_origin = false',
                          f"INSERT INTO public.account_safety_origins(user_id) VALUES ('{uuid.uuid4()}')"):
            denials += denied(role, statement, sub=guest)
    no_service_writes('account_safety_origins')
    assert run("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.account_safety_origins'::regclass") == 't'
    check(f'{denials} browser reads, writes and calls on the origin are denied; the service role cannot update, delete or truncate it')

    # ── A.4: the age declaration ────────────────────────────────────────────
    child = account()
    assert service(f"SELECT record_age_declaration('{child}', 'under_13', NULL)") == 'under_13'
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert list(pool.map(lambda _: service(f"SELECT record_age_declaration('{child}', 'adult', NULL)"), range(8))) == ['under_13'] * 8
    assert service(f"SELECT record_age_declaration('{child}', '13_to_17', NULL)") == 'under_13'
    assert origin(child) == '1'
    late = account()
    service(f"SELECT record_age_declaration('{late}', 'adult', NULL); SELECT record_age_declaration('{late}', 'under_13', NULL)")
    assert origin(late) == '1', 'a later under-13 disclosure did not protect'
    check('the first declaration wins against eight concurrent attempts to raise it; an under-13 declaration, even a later one, marks the origin')

    failed = account()
    run("""CREATE FUNCTION public.reject_age_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Injected age write failure'; END; $$;
        CREATE TRIGGER reject_age_fixture BEFORE INSERT ON public.account_age_declarations
        FOR EACH ROW EXECUTE FUNCTION public.reject_age_fixture();""")
    try:
        service(f"SELECT record_age_declaration('{failed}', 'under_13', NULL)")
    except RuntimeError as error:
        assert 'Injected age write failure' in str(error), str(error)
    else:
        raise AssertionError('the injected failure did not run')
    finally:
        run('DROP TRIGGER reject_age_fixture ON public.account_age_declarations; DROP FUNCTION public.reject_age_fixture();')
    assert origin(failed) == '0'
    assert run(f"SELECT count(*) FROM account_age_declarations WHERE user_id = '{failed}'") == '0'
    denials = 0
    for role in ('anon', 'authenticated'):
        for statement in ('SELECT * FROM public.account_age_declarations',
                          f"SELECT public.record_age_declaration('{late}', 'adult', NULL)",
                          f"UPDATE public.account_age_declarations SET declared_age_band = 'adult' WHERE user_id = '{child}'"):
            denials += denied(role, statement, sub=child)
    no_service_writes('account_age_declarations')
    check(f'a failed declaration write rolls its origin mark back; {denials} browser attempts on the declaration are denied; the service role writes it only through the function')

    # ── E.4: the profile birth date ─────────────────────────────────────────
    owner = account()
    run(f"UPDATE profiles SET birth_date = '2016-05-01' WHERE user_id = '{owner}'")
    denials = 0
    for role in ('anon', 'authenticated'):
        for value in ("'1990-01-01'", 'NULL'):
            denials += denied(role, f"UPDATE public.profiles SET birth_date = {value} WHERE user_id = '{owner}'",
                              ('reviewed identity workflow', 'permission denied'), sub=owner)
    assert run(f"SELECT birth_date FROM profiles WHERE user_id = '{owner}'") == '2016-05-01'
    # The trigger itself, whatever the table grants say: a browser write that reaches the row is refused.
    run('GRANT UPDATE ON public.profiles TO authenticated')
    denials += denied('authenticated', f"UPDATE public.profiles SET birth_date = '1990-01-01' WHERE user_id = '{owner}'",
                      ('reviewed identity workflow',), sub=owner)
    run(f"SET request.jwt.claim.sub = '{owner}'; SET ROLE authenticated; UPDATE public.profiles SET display_name = 'Changed' WHERE user_id = '{owner}'")
    assert run(f"SELECT display_name || '|' || birth_date FROM profiles WHERE user_id = '{owner}'") == 'Changed|2016-05-01'
    check(f'{denials} browser writes of a profile birth date are refused (the trigger holds even with a table grant); the owner can still edit other fields')

    # ── C.1: the Mentor calibration ─────────────────────────────────────────
    origins_before = run('SELECT json_agg(o ORDER BY user_id) FROM account_safety_origins o')
    learner = account()
    assert service(f"SELECT record_mentor_age_calibration('{learner}', 1::smallint)") == '1'
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert list(pool.map(lambda _: service(f"SELECT record_mentor_age_calibration('{learner}', 3::smallint)"), range(8))) == ['1'] * 8
    denials = 0
    for role in ('anon', 'authenticated'):
        for statement in ('SELECT * FROM public.mentor_age_calibrations', f"SELECT public.record_mentor_age_calibration('{learner}', 3::smallint)"):
            denials += denied(role, statement, sub=learner)
    no_service_writes('mentor_age_calibrations')
    assert run('SELECT json_agg(o ORDER BY user_id) FROM account_safety_origins o') == origins_before
    check(f'the Mentor calibration keeps its first tier against eight concurrent writes, leaves every origin unchanged and denies {denials} browser attempts')

    # ── H.1: the teen analytics choice ──────────────────────────────────────
    teen = account()
    service(f"SELECT record_age_declaration('{teen}', '13_to_17', NULL)")
    assert service(f"SELECT set_teen_analytics_preference('{teen}', true)") == 't'
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert list(pool.map(lambda _: service(f"SELECT set_teen_analytics_preference('{teen}', false)"), range(8))) == ['f'] * 8
    assert run(f"SELECT enabled::text || '|' || disclosure_version FROM teen_analytics_preferences WHERE user_id = '{teen}'") == 'false|1'
    denials = 0
    for role in ('anon', 'authenticated'):
        for statement in ('SELECT * FROM public.teen_analytics_preferences', f"SELECT public.set_teen_analytics_preference('{teen}', true)"):
            denials += denied(role, statement, sub=teen)
    no_service_writes('teen_analytics_preferences')
    check(f'a teen opt-out persists against eight concurrent writes; {denials} browser attempts on the choice are denied')

    # ── Appendix M 1.1: the optional-event admission trigger ────────────────
    trigger = run("""SELECT p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                     WHERE t.tgrelid = 'public.learning_events'::regclass AND NOT t.tgisinternal AND t.tgenabled <> 'D'
                       AND p.proname = 'guard_optional_learning_event'""")
    assert trigger == 'guard_optional_learning_event', 'the optional-event admission trigger is not installed on learning_events'
    parent = account()
    run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{parent}', 'parent', NULL)")

    def population(band=None, role='universal', flagged=False, anonymous=False, consent=False, opt_in=None, month=None, revoked=False):
        uid = account(anonymous=anonymous)
        if band:
            month_sql = f"'{month}'" if month else 'NULL'
            service(f"SELECT record_age_declaration('{uid}', '{band}', {month_sql})")
        if role == 'kid':
            run(f"""INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
                    VALUES ('{parent}', '{uid}', 'verified', now());
                    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{uid}', 'kid', '{parent}')""")
        elif role is None:
            # A new account gets the universal role from trg_handle_new_user; take it away.
            run(f"DELETE FROM user_roles WHERE user_id = '{uid}'")
        if consent:
            run(f"INSERT INTO analytics_consents (kid_user_id, granted_by) VALUES ('{uid}', '{parent}')")
        if revoked:
            run(f"UPDATE analytics_consents SET revoked_at = now() WHERE kid_user_id = '{uid}'")
        if opt_in is not None:
            service(f"SELECT set_teen_analytics_preference('{uid}', {str(opt_in).lower()})")
        if flagged:
            service(f"SELECT mark_under13_origin('{uid}')")
        return uid

    def admitted(uid, role='universal'):
        stored = service(f"INSERT INTO learning_events (user_id, role, event) VALUES ('{uid}', '{role}', 'nav_view') RETURNING id")
        return stored != ''

    today = date.today()
    teen_month = date(today.year - 15, today.month, 1).isoformat()
    grown_month = date(today.year - 19, 1, 1).isoformat()
    refused = {
        'flagged origin, declared adult': population('adult', flagged=True),
        'flagged origin, declared teen with an opt-in': population('13_to_17', flagged=True, opt_in=True),
        'flagged origin, child with guardian consent': population('13_to_17', role='kid', consent=True, flagged=True),
        'child declared under 13, with guardian consent': population('under_13', role='kid', consent=True),
        'flagged guest': population('under_13', anonymous=True),
        'guest': population('adult', anonymous=True),
        'child without guardian consent': population('13_to_17', role='kid'),
        'child whose guardian consent was revoked': population('13_to_17', role='kid', consent=True, revoked=True),
        'teen without an opt-in': population('13_to_17'),
        'teen who opted out': population('13_to_17', opt_in=False),
        'account with no declaration': population(None),
        'account with no role': population('adult', role=None),
    }
    for label, uid in refused.items():
        role = 'kid' if 'child' in label else 'universal'
        assert not admitted(uid, role), f'an optional event was admitted for: {label}'
        assert run(f"SELECT count(*) FROM learning_events WHERE user_id = '{uid}'") == '0', label
    admitted_pop = {
        'adult': population('adult'),
        'teen who opted in': population('13_to_17', opt_in=True),
        'child with guardian consent': population('13_to_17', role='kid', consent=True),
    }
    for label, uid in admitted_pop.items():
        assert admitted(uid, 'kid' if 'child' in label else 'universal'), f'an optional event was refused for: {label}'
    check(f'{len(refused)} refused populations record no optional event (every flagged-origin account, whatever its band, '
          f'opt-in or guardian consent; guests; unconsented children; teens without an opt-in); {len(admitted_pop)} admitted ones do')

    flagged_later = admitted_pop['adult']
    service(f"SELECT mark_under13_origin('{flagged_later}')")
    assert not admitted(flagged_later), 'a flagged session recorded an optional event'
    assert run(f"SELECT count(*) FROM learning_events WHERE user_id = '{flagged_later}'") == '1'
    assert service(f"SELECT family_analytics_admitted('{flagged_later}')") == 'f'
    run(f"INSERT INTO audit_logs (actor_id, action, subject) VALUES ('{flagged_later}', 'safety.check', '{flagged_later}')")
    assert run(f"SELECT count(*) FROM audit_logs WHERE actor_id = '{flagged_later}' AND action = 'safety.check'") == '1'
    check('an account flagged after an admitted event records no further optional event, is refused by the Family Hub admission too, and still writes its audit log')

    # ── Appendix M 1.1 / H.1 under concurrency: the lock ordering ───────────
    def wait_for(expression):
        for _ in range(250):
            if run(expression) == 't':
                return
            time.sleep(.02)
        raise AssertionError(f'expected lock state was not observed: {expression}')

    def race(first, second, label, key):
        """Run `first` in an open transaction, start `second`, prove it waits on
        the first transaction, then commit the first and return the second's output."""
        holder = subprocess.Popen(BASE + ['-d', database], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, encoding='utf-8',
                                  env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
        try:
            holder.stdin.write(f'BEGIN; {first}; SELECT pg_advisory_xact_lock({key});\n')
            holder.stdin.flush()
            wait_for(f"""SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = {key}
                         AND database = (SELECT oid FROM pg_database WHERE datname = current_database()))""")
            with ThreadPoolExecutor(max_workers=1) as pool:
                pending = pool.submit(run, f"SET application_name = '{label}'; {second}")
                try:
                    wait_for(f"""SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
                                 AND application_name = '{label}' AND cardinality(pg_blocking_pids(pid)) > 0)""")
                finally:
                    holder.stdin.write('COMMIT;\n')
                    holder.stdin.flush()
                    holder.stdin.close()
                    holder.stdin = None
                result = pending.result(timeout=30)
            _, stderr = holder.communicate(timeout=30)
            assert holder.returncode == 0, stderr
            return result
        finally:
            if holder.poll() is None:
                if holder.stdin:
                    holder.stdin.write('ROLLBACK;\n')
                    holder.stdin.close()
                    holder.stdin = None
                holder.communicate(timeout=30)

    def insert_event(uid):
        return f"SET ROLE service_role; INSERT INTO learning_events (user_id, role, event) VALUES ('{uid}', 'universal', 'nav_view') RETURNING id"

    def events(uid):
        return int(run(f"SELECT count(*) FROM learning_events WHERE user_id = '{uid}'"))

    racer = population('13_to_17', opt_in=True)
    assert race(f"SET LOCAL ROLE service_role; SELECT set_teen_analytics_preference('{racer}', false)",
                insert_event(racer), 'lf_event_after_revoke', 9101) == '', 'an event racing a revocation was admitted'
    assert events(racer) == 0
    service(f"SELECT set_teen_analytics_preference('{racer}', true)")
    assert race(f"SET LOCAL ROLE service_role; INSERT INTO learning_events (user_id, role, event) VALUES ('{racer}', 'universal', 'nav_view')",
                f"SET ROLE service_role; SELECT set_teen_analytics_preference('{racer}', false)", 'lf_revoke_after_event', 9102) == 'f'
    assert events(racer) == 1 and not admitted(racer)
    check('a teen revocation and an event serialize both ways: the event behind the revocation is refused, '
          'the revocation behind an admitted event waits for it to commit, and nothing lands after the "no"')

    flag_racer = population('adult')
    assert race(f"SET LOCAL ROLE service_role; SELECT mark_under13_origin('{flag_racer}')",
                insert_event(flag_racer), 'lf_event_after_flag', 9103) == '', 'an event racing the under-13 flag was admitted'
    assert events(flag_racer) == 0 and origin(flag_racer) == '1'
    flag_later = population('adult')
    assert race(f"SET LOCAL ROLE service_role; INSERT INTO learning_events (user_id, role, event) VALUES ('{flag_later}', 'universal', 'nav_view')",
                f"SET ROLE service_role; SELECT mark_under13_origin('{flag_later}')", 'lf_flag_after_event', 9104) == 't'
    assert events(flag_later) == 1 and not admitted(flag_later) and origin(flag_later) == '1'
    check('an under-13 origin mark and an event serialize both ways (the origin foreign key locks the account row): the event behind the mark is refused, '
          'the mark behind an admitted event waits for it, and no optional event commits after the flag')

    grown = population('13_to_17', month=teen_month, opt_in=False)
    run(f"""UPDATE account_age_declarations SET declared_birth_month = '{grown_month}' WHERE user_id = '{grown}'""")
    assert run(f"SELECT effective_age_band('{grown}')") == 'adult'
    assert not admitted(grown), 'a teen who turned adult by birth month lost an earlier opt-out'
    check('a teen who reached adult by birth month keeps an earlier analytics opt-out')

    # ── Appendix M 1.1 measured: the flagged-session count in identity_metrics ──
    def unconsented(window="now() - interval '1 day', now() + interval '1 minute'"):
        return json.loads(service(f"SELECT identity_metrics({window}) -> 'unconsentedFlagged'"))

    baseline = unconsented()
    assert baseline['events'] == 0 and baseline['learningEvents'] == 0 and baseline['familyMoneyEvents'] == 0, baseline
    assert baseline['accountsWithEvents'] == 0 and baseline['flaggedActive'] > 0 and baseline['flagged'] >= baseline['flaggedActive'], baseline
    # flagged_later and flag_later each hold one event admitted before their flag.
    assert events(flagged_later) == 1 and events(flag_later) == 1
    check(f"identity_metrics counts zero unconsented events across {baseline['flaggedActive']} flagged accounts active in the window; "
          'the two events admitted before a later flag are not counted')

    leaked = population('adult', flagged=True)
    run('ALTER TABLE public.learning_events DISABLE TRIGGER optional_learning_event_admission')
    try:
        assert service(f"INSERT INTO learning_events (user_id, role, event) VALUES ('{leaked}', 'universal', 'nav_view') RETURNING id") != ''
    finally:
        run('ALTER TABLE public.learning_events ENABLE TRIGGER optional_learning_event_admission')
    run('ALTER TABLE public.family_money_events DISABLE TRIGGER family_money_event_admission')
    try:
        run(f"INSERT INTO family_money_events (user_id, event, goal_id) VALUES ('{leaked}', 'goal_reached', gen_random_uuid())")
    finally:
        run('ALTER TABLE public.family_money_events ENABLE TRIGGER family_money_event_admission')
    after = unconsented()
    assert after['events'] == 2 and after['learningEvents'] == 1 and after['familyMoneyEvents'] == 1, after
    assert after['accountsWithEvents'] == 1 and after['flaggedActive'] >= baseline['flaggedActive'] + 1, after
    earlier = unconsented("now() - interval '2 days', now() - interval '1 day'")
    assert earlier['events'] == 0, earlier
    assert not admitted(leaked), 'the admission trigger was not re-enabled'
    run(f"DELETE FROM learning_events WHERE user_id = '{leaked}'; DELETE FROM family_money_events WHERE user_id = '{leaked}'")
    assert unconsented()['events'] == 0
    denials = sum(denied(role, "SELECT identity_metrics(now() - interval '1 day', now())", sub=leaked) for role in ('anon', 'authenticated'))
    check('a flagged-account row that bypasses the admission trigger (learning_events via the service role, family_money_events via the owner) '
          f'makes identity_metrics.unconsentedFlagged non-zero, only inside its window; {denials} browser calls are denied')

    # ── A.2: account deletion removes the origin ────────────────────────────
    gone = account(anonymous=True)
    service(f"SELECT mark_under13_origin('{gone}')")
    run(f"DELETE FROM auth.users WHERE id = '{gone}'")
    assert origin(gone) == '0'
    check('deleting the account removes its origin record')

    print(f'{len(checks)} checks passed')
    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
finally:
    if os.environ.get('LF_PG_KEEP') != '1' and not REUSE:
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
