"""H.1 / H.6 optional learning-event admission (Appendix O 1.1 Kid-Role Consent Gate), against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, the shared minimal Supabase shim and EVERY
migration in database/migrations applied in order, so the admission that is
proved is the one production runs (guard_optional_learning_event as last
redefined by effective_age_band, the practice gate enforce_learning_event_practice
of od9_consent_enforcement and learning_qa_events), never a hand-written copy:

  - a self-registered teen: no event before a choice, admitted after "on",
    dropped again after "off"; a safety audit row is never gated;
  - the kid-role consent gate: an unconsented kid event is dropped, a
    consented one is admitted, and a revoked consent drops it again; an
    under-13 kid (the declaration marks the origin) is never admitted, even
    with consent; a teen's own preference never opens a kid-role account;
  - the population matrix: guests, an under-13 origin, an account with no
    role or no age record are dropped; an adult is admitted;
  - concurrency: a revocation that commits first drops a waiting insert, and
    an insert that commits first is kept while the revocation waits for it;
  - replaying the preference migration keeps a recorded "off".

Configuration: LF_PG_PSQL (or LF_PG_BIN), LF_PG_PORT, LF_PG_USER, LF_PG_KEEP,
LF_PG_REPORT. Run by database/scripts/staff-analytics-db-verify.mjs.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
import re
import subprocess
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('LF_PG_BIN', str(ROOT / '.codex/audit-db/pgsql/bin')))
PSQL = os.environ.get('LF_PG_PSQL', str(BIN / ('psql.exe' if os.name == 'nt' else 'psql')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
ENV = {**os.environ, 'PGCLIENTENCODING': 'UTF8'}


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True, env=ENV)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


# The same minimal Supabase shim as the other native verifiers.
SHIM = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-data-platform-postgres.py').read_text(encoding='utf-8'), re.S).group(1)

database = 'lf_analytics_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def check(name):
    checks.append(name)
    print('ok -', name)


def event(user, role='universal'):
    """An optional nav_view through the service role; '' when the admission dropped it."""
    return run(f"SET ROLE service_role; INSERT INTO learning_events (user_id, role, event) VALUES ('{user}', '{role}', 'nav_view') RETURNING id")


def wait_for(expression):
    for _ in range(250):
        if run(expression) == 't':
            return
        time.sleep(.02)
    raise AssertionError(f'expected lock state was not observed: {expression}')


def race(first, second, label):
    """`first` holds its transaction open on an advisory lock while `second` runs and blocks; then first commits."""
    holder = subprocess.Popen(BASE + ['-d', database], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, encoding='utf-8', env=ENV)
    try:
        holder.stdin.write(f"BEGIN; {first}; SELECT pg_advisory_xact_lock(9090);\n")
        holder.stdin.flush()
        wait_for("SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = 9090 "
                 "AND database = (SELECT oid FROM pg_database WHERE datname = current_database()))")
        with ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(sql, f"SET application_name = '{label}'; {second}", database)
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
        return result
    finally:
        if holder.poll() is None:
            if holder.stdin:
                holder.stdin.write('ROLLBACK;\n')
                holder.stdin.close()
                holder.stdin = None
            holder.communicate(timeout=30)


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # A verified guardian for the kid-role accounts (a superuser insert stands in for the ID check).
    guardian = str(uuid.uuid4())
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{guardian}', 'guardian@example.com');
    SELECT record_age_declaration('{guardian}', 'adult');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{guardian}', 'parent', NULL);
    """)

    def account(band=None, roles=(), guest=False, origin=False, preference=None, consent=False):
        subject = str(uuid.uuid4())
        run(f"INSERT INTO auth.users (id, email, is_anonymous) VALUES ('{subject}', {'NULL' if guest else repr(subject[:8] + '@example.com')}, {str(guest).lower()});")
        if band:
            run(f"SELECT record_age_declaration('{subject}', '{band}');")
        for role in roles:
            if role == 'kid':
                run(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{guardian}', '{subject}', 'verified', now());")
            run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{subject}', '{role}', {repr(guardian) if role == 'kid' else 'NULL'}) ON CONFLICT DO NOTHING;")
        if not roles:  # the sign-up trigger grants 'universal'; this population has no role at all
            run(f"DELETE FROM user_roles WHERE user_id = '{subject}';")
        if origin:
            run(f"SELECT mark_under13_origin('{subject}');")
        if preference is not None:
            run(f"SELECT set_teen_analytics_preference('{subject}', {str(preference).lower()});")
        if consent:
            run(f"INSERT INTO analytics_consents (kid_user_id, granted_by) VALUES ('{subject}', '{guardian}');")
        return subject

    # ── A self-registered teen: off until chosen, follows the choice ──
    teen = account('13_to_17', ['universal'])
    choice = lambda value: run(f"SET ROLE service_role; SELECT set_teen_analytics_preference('{teen}', {str(value).lower()})")
    assert event(teen) == ''
    choice(True)
    assert event(teen) != ''
    choice(False)
    assert event(teen) == ''
    run(f"SET ROLE service_role; INSERT INTO audit_logs (actor_id, action, subject) VALUES ('{teen}', 'safety_check', '{teen}');")
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'safety_check' AND actor_id = '{teen}'") == '1'
    check('a teen event is dropped before a choice, admitted after "on", dropped after "off"; a safety audit row is never gated')

    # ── Appendix O 1.1: the kid-role consent gate ──
    kid = account('13_to_17', ['kid'])
    assert event(kid, 'kid') == '', 'an unconsented kid event must be dropped'
    run(f"INSERT INTO analytics_consents (kid_user_id, granted_by) VALUES ('{kid}', '{guardian}');")
    assert event(kid, 'kid') != '', 'a consented kid event must be admitted'
    run(f"UPDATE analytics_consents SET revoked_at = now() WHERE kid_user_id = '{kid}';")
    assert event(kid, 'kid') == '', 'a revoked consent must drop the event again'
    young = account('under_13', ['kid'])
    assert event(young, 'kid') == ''
    run(f"INSERT INTO analytics_consents (kid_user_id, granted_by) VALUES ('{young}', '{guardian}');")
    assert event(young, 'kid') == '', 'under 13 (the declaration marks the origin), usage data is never collected, consent or not'
    opted = account('13_to_17', ['kid'], preference=True)
    assert event(opted, 'kid') == '', "a teen's own preference never opens a kid-role account"
    check('kid-role consent gate: an unconsented kid event is dropped, a consented one is admitted, a revoked consent drops it; under 13 nothing is admitted even with consent; a preference never replaces the consent')

    # ── The population matrix ──
    populations = [
        # band, roles, guest, origin, preference, consent, admitted
        ('adult', ['universal'], False, False, None, False, True),
        ('13_to_17', ['universal'], False, False, True, False, True),
        ('13_to_17', ['universal'], False, False, False, False, False),
        ('13_to_17', ['universal'], False, False, None, False, False),
        ('13_to_17', ['kid'], False, False, None, True, True),
        ('13_to_17', ['kid'], False, False, True, False, False),
        ('under_13', ['kid'], False, True, None, True, False),
        ('13_to_17', ['parent'], False, True, True, False, False),
        ('adult', ['universal'], True, False, None, False, False),
        ('adult', [], False, False, None, False, False),
        (None, ['universal'], False, False, True, False, False),
    ]
    for band, roles, guest, origin, preference, consent, admitted in populations:
        subject = account(band, roles, guest, origin, preference, consent)
        inserted = event(subject, roles[0] if roles else 'universal')
        assert bool(inserted) == admitted, (band, roles, guest, origin, preference, consent)
    check(f'{len(populations)} populations: guests, an under-13 origin, no role or no age record are dropped; adults, opted-in teens and consented kids are admitted')

    # ── Concurrency: whichever commits first decides ──
    choice(True)
    dropped = race(f"SELECT set_teen_analytics_preference('{teen}', false)",
                   f"SET ROLE service_role; INSERT INTO learning_events (user_id, role, event) VALUES ('{teen}', 'universal', 'nav_view') RETURNING id",
                   'event_waiter')
    assert dropped == '', dropped
    choice(True)
    before = int(run('SELECT count(*) FROM learning_events'))
    answer = race(f"SET LOCAL ROLE service_role; INSERT INTO learning_events (user_id, role, event) VALUES ('{teen}', 'universal', 'nav_view')",
                  f"SET ROLE service_role; SELECT set_teen_analytics_preference('{teen}', false)", 'revoke_waiter')
    assert answer == 'f', answer
    assert int(run('SELECT count(*) FROM learning_events')) == before + 1
    assert event(teen) == ''
    check('a revocation committed first drops the waiting insert; an insert committed first is kept and the revocation waits for it')

    # ── Replay keeps the recorded "off" ──
    run((ROOT / 'database/migrations/0089_teen_analytics_preferences.sql').read_text(encoding='utf-8'))
    assert event(teen) == ''
    assert run(f"SELECT enabled FROM teen_analytics_preferences WHERE user_id = '{teen}'") == 'f'
    check('replaying the preference migration keeps a recorded "off"')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; not PostgREST or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
