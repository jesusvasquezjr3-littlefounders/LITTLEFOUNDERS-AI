"""Appendix O 1.1 (H.1) disclosure coverage against real PostgreSQL.

A throwaway database with the Supabase shim and EVERY migration applied, then
public.analytics_disclosure_coverage(p_from, p_to) is read over a fixture:

  - a self-registered 13-17 account with a disclosure on file (opted in, and
    one opted out) is covered; one with no choice on file is not;
  - a 13-17 account with a protected under-13 origin is covered (analytics
    suppressed outright);
  - a kid-role account (behind the guardian-consent gate), an adult and an
    account inactive in the window are out of the population;
  - an active guest is covered: the admission trigger drops its event, so it
    is never measured;
  - an event admitted for a teen with no opt-in (a leak simulated by writing
    past the trigger) makes that teen uncovered and is counted;
  - the function refuses an empty window, returns counts only (no account id)
    and is executable by service_role, not by anon or authenticated.

Configuration: LF_PG_PSQL (or LF_PG_BIN), LF_PG_PORT, LF_PG_USER, LF_PG_KEEP
"""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('LF_PG_BIN', str(ROOT / '.codex/audit-db/pgsql/bin')))
PSQL = os.environ.get('LF_PG_PSQL', str(BIN / 'psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


# The same minimal Supabase shim as the other native verifiers.
SHIM = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-data-platform-postgres.py').read_text(encoding='utf-8'), re.S).group(1)

database = 'lf_disclosure_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def check(name):
    checks.append(name)
    print('ok -', name)


def rejected(query, message):
    try:
        run(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'expected {message!r}, the statement succeeded')


WINDOW = "now() - interval '30 days', now()"

try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    U = {k: str(uuid.uuid4()) for k in ('teen_in', 'teen_out', 'teen_none', 'teen_protected', 'teen_leak', 'teen_old',
                                        'kid', 'adult', 'guest', 'guest_old')}
    old = "now() - interval '90 days'"
    # Fixture rows are written past the triggers (replica mode): the kid role
    # without a guardian link, and the one leaked event the trigger would drop.
    run(f"""
    SET session_replication_role = replica;
    INSERT INTO auth.users (id, email, is_anonymous, created_at) VALUES
      ('{U['teen_in']}', 'a@example.com', false, now()), ('{U['teen_out']}', 'b@example.com', false, now()),
      ('{U['teen_none']}', 'c@example.com', false, now()), ('{U['teen_protected']}', 'd@example.com', false, now()),
      ('{U['teen_leak']}', 'e@example.com', false, now()), ('{U['teen_old']}', 'f@example.com', false, {old}),
      ('{U['kid']}', null, false, now()), ('{U['adult']}', 'g@example.com', false, now()),
      ('{U['guest']}', null, true, now()), ('{U['guest_old']}', null, true, {old});
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
      ('{U['teen_in']}', '13_to_17'), ('{U['teen_out']}', '13_to_17'), ('{U['teen_none']}', '13_to_17'),
      ('{U['teen_protected']}', '13_to_17'), ('{U['teen_leak']}', '13_to_17'), ('{U['teen_old']}', '13_to_17'),
      ('{U['kid']}', '13_to_17'), ('{U['adult']}', 'adult');
    INSERT INTO user_roles (user_id, role) VALUES
      ('{U['teen_in']}', 'universal'), ('{U['teen_out']}', 'universal'), ('{U['teen_none']}', 'universal'),
      ('{U['teen_protected']}', 'universal'), ('{U['teen_leak']}', 'universal'), ('{U['teen_old']}', 'universal'),
      ('{U['kid']}', 'kid'), ('{U['adult']}', 'universal');
    INSERT INTO account_safety_origins (user_id) VALUES ('{U['teen_protected']}');
    INSERT INTO learning_events (user_id, role, event) VALUES ('{U['teen_leak']}', 'universal', 'page_view');
    SET session_replication_role = origin;
    SELECT public.set_teen_analytics_preference('{U['teen_in']}', true);
    SELECT public.set_teen_analytics_preference('{U['teen_out']}', false);
    """)
    # Through the live trigger: the opted-in teen's event is admitted; the
    # guest's and the undisclosed teen's are dropped.
    run(f"""
    INSERT INTO learning_events (user_id, role, event) VALUES
      ('{U['teen_in']}', 'universal', 'page_view'), ('{U['guest']}', 'anon', 'page_view'),
      ('{U['teen_none']}', 'universal', 'page_view');
    """)
    admitted = run(f"SELECT string_agg(user_id::text, ',') FROM learning_events WHERE user_id IN ('{U['teen_in']}', '{U['guest']}', '{U['teen_none']}')")
    assert admitted == U['teen_in'], admitted
    check('H.1 gate (0090): an opted-in teen event is admitted; a guest event and an undisclosed teen event are dropped')

    report = json.loads(run(f"SET ROLE service_role; SELECT public.analytics_disclosure_coverage({WINDOW})").splitlines()[-1])
    assert report['teens'] == {'active': 5, 'disclosed': 2, 'optedIn': 1, 'optedOut': 1, 'protectedOrigin': 1,
                               'measuredWithoutOptIn': 1, 'covered': 3}, report['teens']
    assert report['guests'] == {'active': 1, 'suppressed': 1, 'measured': 0}, report['guests']
    check('Appendix O 1.1: 5 active self-registered teens (the kid, the adult and the inactive teen excluded), 3 covered '
          '(opted in, opted out, protected origin); the undisclosed teen and the leaked-event teen are not; the active guest is covered')

    # The leaked teen now records a choice: still uncovered, because an event was admitted without an opt-in.
    run(f"SELECT public.set_teen_analytics_preference('{U['teen_leak']}', false)")
    report = json.loads(run(f"SET ROLE service_role; SELECT public.analytics_disclosure_coverage({WINDOW})").splitlines()[-1])
    assert report['teens']['covered'] == 3 and report['teens']['measuredWithoutOptIn'] == 1, report['teens']
    check('a teen measured without an opt-in stays uncovered after recording a choice (a disclosure that gates nothing is not coverage)')

    # F3-identity-site (H.1, Appendix O 2.2(a)): the first-session step's "Keep off"
    # is the teen's first recorded choice. It writes the version-1 row with
    # enabled = false, admits no optional event, and makes the teen covered.
    run(f"SELECT public.set_teen_analytics_preference('{U['teen_none']}', false)")
    assert run(f"SELECT enabled::text || '/' || disclosure_version FROM teen_analytics_preferences WHERE user_id = '{U['teen_none']}'") == 'false/1'
    run(f"INSERT INTO learning_events (user_id, role, event) VALUES ('{U['teen_none']}', 'universal', 'page_view')")
    assert run(f"SELECT count(*) FROM learning_events WHERE user_id = '{U['teen_none']}'") == '0'
    report = json.loads(run(f"SET ROLE service_role; SELECT public.analytics_disclosure_coverage({WINDOW})").splitlines()[-1])
    assert report['teens']['covered'] == 4 and report['teens']['optedOut'] == 3, report['teens']
    check('a first choice of "Keep off" records the version-1 disclosure off, admits no optional event, and counts the teen as covered')

    # A guest measured past the gate is counted, never hidden.
    run(f"SET session_replication_role = replica; INSERT INTO learning_events (user_id, role, event) VALUES ('{U['guest']}', 'anon', 'page_view')")
    report = json.loads(run(f"SET ROLE service_role; SELECT public.analytics_disclosure_coverage({WINDOW})").splitlines()[-1])
    assert report['guests'] == {'active': 1, 'suppressed': 0, 'measured': 1}, report['guests']
    check('a guest with an admitted event is counted as measured and uncovered')

    text = json.dumps(report)
    assert not any(u in text for u in U.values()), text
    check('counts only: no account id leaves the function')

    rejected("SELECT public.analytics_disclosure_coverage(now(), now() - interval '1 day')", 'from < to')
    rejected(f"SET ROLE authenticated; SELECT public.analytics_disclosure_coverage({WINDOW})", 'permission denied')
    rejected(f"SET ROLE anon; SELECT public.analytics_disclosure_coverage({WINDOW})", 'permission denied')
    check('an inverted window is refused (22023); anon and authenticated cannot execute the function')

    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
