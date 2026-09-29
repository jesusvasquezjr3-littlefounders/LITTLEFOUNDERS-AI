"""G.1 staff-grant RLS boundary and the Generation read path, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, the shared minimal Supabase shim, EVERY
migration in database/migrations applied in order (so the latest RLS
definitions are what is proved, never a hand-written copy), then:

  - G.1 admin_permissions: a session reads only its own grants, another
    account only its own, no session reads nothing, a browser session cannot
    insert a grant, and a revoked grant disappears on the next read;
  - G.1 generation_runs_live (Appendix N 1.2's second read path, F4-staff-ops):
    an admin with no grant reads 0 rows, an admin with only view_analytics
    reads 0, an admin with manage_content reads the row, a superadmin reads
    it, anon reads nothing; revoking manage_content hides the row on the next
    query; the session cannot write the table.

Configuration: LF_PG_PSQL (or LF_PG_BIN), LF_PG_PORT, LF_PG_USER, LF_PG_KEEP,
LF_PG_REPORT. Run by database/scripts/staff-analytics-db-verify.mjs.
"""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('LF_PG_BIN', str(ROOT / '.codex/audit-db/pgsql/bin')))
PSQL = os.environ.get('LF_PG_PSQL', str(BIN / ('psql.exe' if os.name == 'nt' else 'psql')))
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

database = 'lf_admin_permissions_' + uuid.uuid4().hex[:12]
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


def as_user(user, query):
    """A browser session: the authenticated role with this account's JWT subject."""
    return run(f"SET ROLE authenticated; SET request.jwt.claim.sub = '{user}'; {query}")


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    I = {k: str(uuid.uuid4()) for k in ('boss', 'staff', 'other', 'bare', 'analyst', 'support', 'editor')}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@littlefounders.ai')" for k, v in I.items()) + ';')
    run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['boss']}', 'superadmin', NULL);")
    run('INSERT INTO user_roles (user_id, role, granted_by) VALUES ' + ', '.join(
        f"('{I[k]}', 'admin', '{I['boss']}')" for k in ('staff', 'other', 'bare', 'analyst', 'support', 'editor')) + ';')
    run(f"""
    INSERT INTO admin_permissions (user_id, permission, granted_by) VALUES
        ('{I['staff']}', 'manage_users', '{I['boss']}'), ('{I['other']}', 'manage_content', '{I['boss']}'),
        ('{I['analyst']}', 'view_analytics', '{I['boss']}'), ('{I['support']}', 'manage_support', '{I['boss']}'),
        ('{I['editor']}', 'manage_content', '{I['boss']}');
    """)

    # ── G.1: admin_permissions is self-read only, written by the service role only ──
    assert as_user(I['staff'], 'SELECT string_agg(permission, \',\' ORDER BY permission) FROM admin_permissions;') == 'manage_users'
    assert as_user(I['other'], 'SELECT string_agg(permission, \',\' ORDER BY permission) FROM admin_permissions;') == 'manage_content'
    assert run('SET ROLE authenticated; SELECT count(*) FROM admin_permissions;') == '0'
    assert run('SET ROLE anon; SELECT count(*) FROM admin_permissions;') == '0'
    check('a session reads only its own staff grants; another account only its own; no session reads none')

    rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub = '{I['staff']}'; "
             f"INSERT INTO admin_permissions (user_id, permission) VALUES ('{I['staff']}', 'manage_content');", 'row-level security')
    # No update policy: the statement matches no row, so the grant cannot be widened.
    as_user(I['staff'], f"UPDATE admin_permissions SET permission = 'manage_content' WHERE user_id = '{I['staff']}';")
    assert run(f"SELECT permission FROM admin_permissions WHERE user_id = '{I['staff']}'") == 'manage_users'
    run(f"DELETE FROM admin_permissions WHERE user_id = '{I['staff']}' AND permission = 'manage_users';")
    assert as_user(I['staff'], 'SELECT count(*) FROM admin_permissions;') == '0'
    check('a browser session cannot grant or widen its own permission; a revoked grant is gone on the next read')

    # ── G.1: generation_runs_live, the Generation screen's direct read path ──
    run("INSERT INTO generation_runs_live (run_id, course_slug, total_slots, tokens_used, usd_used) VALUES ('run-1', 'money-basics', 12, 48000, 3.2150);")
    live = lambda user: as_user(user, 'SELECT count(*) FROM generation_runs_live;')
    for name in ('bare', 'analyst', 'support', 'staff'):
        assert live(I[name]) == '0', name
    assert live(I['editor']) == '1'
    assert live(I['boss']) == '1'
    assert run('SET ROLE anon; SELECT count(*) FROM generation_runs_live;') == '0'
    assert run('SET ROLE authenticated; SELECT count(*) FROM generation_runs_live;') == '0'
    check('generation_runs_live: an admin with no grant, only view_analytics or only manage_support reads 0 rows; an admin with manage_content and a superadmin read the row; anon and a session without a subject read nothing')

    run(f"DELETE FROM admin_permissions WHERE user_id = '{I['editor']}' AND permission = 'manage_content';")
    assert live(I['editor']) == '0'
    run(f"INSERT INTO admin_permissions (user_id, permission, granted_by) VALUES ('{I['editor']}', 'manage_content', '{I['boss']}');")
    assert live(I['editor']) == '1'
    run(f"DELETE FROM user_roles WHERE user_id = '{I['editor']}' AND role = 'admin';")
    assert live(I['editor']) == '0', 'a manage_content row without the admin role opens nothing'
    check('revoking manage_content (or the admin role) hides the live row on the next query; re-granting restores it')

    # The proof can fail: with generation_realtime's original policy back in
    # place, the analyst reads the row again; the fix migration closes it.
    run((ROOT / 'database/migrations/0019_generation_realtime.sql').read_text(encoding='utf-8'))
    assert live(I['analyst']) == '1', 'the original policy should admit any admin'
    run(next((ROOT / 'database/migrations').glob('*_generation_live_manage_content.sql')).read_text(encoding='utf-8'))
    assert live(I['analyst']) == '0'
    check('the original role-only policy admits an admin without manage_content (the leak); generation_live_manage_content closes it')

    for name in ('editor', 'boss'):
        as_user(I[name], "UPDATE generation_runs_live SET usd_used = 0 WHERE run_id = 'run-1';")
        rejected(f"SET ROLE authenticated; SET request.jwt.claim.sub = '{I[name]}'; "
                 "INSERT INTO generation_runs_live (run_id, course_slug) VALUES ('forged', 'x');", 'row-level security')
    assert run("SELECT usd_used FROM generation_runs_live WHERE run_id = 'run-1'") == '3.2150'
    check('no browser session writes generation_runs_live; the service role remains its only writer')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; not PostgREST, Realtime or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
