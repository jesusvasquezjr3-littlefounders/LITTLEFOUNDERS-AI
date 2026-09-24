"""G.1 staff-grant RLS boundary on the owned disposable native PostgreSQL cluster."""
from pathlib import Path
import json
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BASE = [str(RUNTIME / 'pgsql/bin/psql.exe'), '-X', '-h', '127.0.0.1', '-p', '15483',
        '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq']

def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

if Path(sql('SHOW data_directory')).resolve() != (RUNTIME / 'data').resolve():
    raise RuntimeError('Refusing a PostgreSQL cluster outside the owned audit directory')

database = 'lf_admin_permissions_' + uuid.uuid4().hex
staff, other = str(uuid.uuid4()), str(uuid.uuid4())
sql(f'CREATE DATABASE {database}')
try:
    sql(f"""
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('{staff}'), ('{other}');
CREATE TABLE public.audit_logs(actor_id uuid, action text, subject text, detail jsonb);
""", database)
    sql((ROOT / 'database/migrations/0030_admin_permissions.sql').read_text(encoding='utf-8'), database)
    sql(f"""
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT ON public.admin_permissions TO authenticated;
INSERT INTO public.admin_permissions(user_id, permission, granted_by)
VALUES ('{staff}', 'manage_users', '{other}'), ('{other}', 'manage_content', '{other}');
""", database)

    own = sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{staff}'; SELECT permission FROM public.admin_permissions ORDER BY permission;", database)
    assert own == 'manage_users', own
    foreign = sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{other}'; SELECT permission FROM public.admin_permissions ORDER BY permission;", database)
    assert foreign == 'manage_content', foreign
    anonymous = sql("SET ROLE authenticated; SELECT count(*) FROM public.admin_permissions;", database)
    assert anonymous == '0', anonymous

    try:
        sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{staff}'; INSERT INTO public.admin_permissions(user_id,permission) VALUES ('{staff}','manage_content');", database)
    except RuntimeError as error:
        assert 'row-level security policy' in str(error), error
    else:
        raise AssertionError('Browser insert bypassed staff-grant RLS')

    sql(f"DELETE FROM public.admin_permissions WHERE user_id='{staff}' AND permission='manage_users'", database)
    revoked = sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{staff}'; SELECT count(*) FROM public.admin_permissions;", database)
    assert revoked == '0', revoked
finally:
    sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Actual migration 0030 on an owned disposable native PostgreSQL database',
    'checks': ['session reads own grant only', 'another account reads only its own grant',
               'missing session sees no grants', 'browser cannot insert a grant',
               'revoked grant disappears on the next read'],
    'limits': 'Minimal native fixtures; not full Supabase/PostgREST or deployed Core.'
}
(ROOT / 'audit-results/s02-admin-permissions-postgres.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
