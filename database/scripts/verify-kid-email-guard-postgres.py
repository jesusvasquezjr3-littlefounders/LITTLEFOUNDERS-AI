"""A.6 / Appendix M 1.3: a child account's sign-in address cannot change from outside Core, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim (with
GoTrue's email_change / phone columns and auth.identities), applies EVERY
migration in database/migrations in order, and proves at the enforcing
boundary (migration guard_kid_email):

  - for a kid-role account, every write GoTrue would make for PUT /auth/v1/user
    {email} or {phone} is refused with KID_EMAIL_FORBIDDEN and nothing changes:
    a direct email move, a pending address (email_change), a phone, a pending
    phone; whoever writes (GoTrue's own role, the service role, a superuser);
  - an unchanged address, a cleared pending value and any other column (the
    whole-row rewrite GoTrue does at sign-in) stay writable for the child;
  - adults and self-registered teens can still change their address;
  - the verified Tutor's rename of a flagged handle (S-06) still moves the
    child's address to the derived one.

Configuration:
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
"""

import os
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PSQL = os.environ.get('LF_PG_PSQL', str(ROOT / '.codex/audit-db/pgsql/bin/psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
DOMAIN = '@kids.littlefounders.invalid'


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


SHIM = """
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(), is_anonymous boolean DEFAULT false, last_sign_in_at timestamptz,
    email_change text DEFAULT '', email_change_token_new text DEFAULT '', phone text, phone_change text DEFAULT '');
CREATE UNIQUE INDEX users_email_unique ON auth.users (email);
CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, identity_data jsonb NOT NULL, provider text NOT NULL,
    email text GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED);
CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_kid_email_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def rejected(query, message):
    try:
        run(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'expected {message!r}, the statement succeeded: {query}')


def check(name):
    checks.append(name)
    print('ok -', name)


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    handles = {'parent': 'parent_a', 'kid': 'sofia2016', 'teen': 'teo_b', 'adult': 'ana_adult'}
    I = {name: str(uuid.uuid4()) for name in handles}
    email = {name: (handle + DOMAIN if name == 'kid' else f'{handle}@example.com') for name, handle in handles.items()}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{I[k]}', '{email[k]}')" for k in handles) + ';')
    run('INSERT INTO auth.identities (provider_id, user_id, identity_data, provider) VALUES ' + ', '.join(
        f"('{I[k]}', '{I[k]}', jsonb_build_object('sub', '{I[k]}', 'email', '{email[k]}'), 'email')" for k in handles) + ';')
    run(f"""
    UPDATE profiles SET username = h.handle, display_name = initcap(h.k)
      FROM (VALUES {', '.join(f"('{I[k]}'::uuid, '{h}', '{k}')" for k, h in handles.items())}) AS h(id, handle, k)
      WHERE profiles.user_id = h.id;
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL);
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['parent']}');
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
        ('{I['kid']}', 'under_13'), ('{I['teen']}', '13_to_17'), ('{I['adult']}', 'adult');
    """)

    def kid_row():
        return run(f"SELECT concat_ws('|', email, email_change, coalesce(phone, '-'), phone_change) FROM auth.users WHERE id = '{I['kid']}'")

    before = kid_row()
    writes = [
        f"UPDATE auth.users SET email = 'sofia@gmail.com' WHERE id = '{I['kid']}'",
        f"UPDATE auth.users SET email_change = 'sofia@gmail.com', email_change_token_new = 'tok' WHERE id = '{I['kid']}'",
        f"UPDATE auth.users SET phone = '+15555550100' WHERE id = '{I['kid']}'",
        f"UPDATE auth.users SET phone_change = '+15555550100' WHERE id = '{I['kid']}'",
        f"UPDATE auth.users SET email = 'other_kid{DOMAIN}' WHERE id = '{I['kid']}'",
    ]
    for role in ('supabase_auth_admin', 'service_role', None):
        for write in writes:
            rejected(f'SET ROLE {role}; {write}' if role else write, 'KID_EMAIL_FORBIDDEN')
    assert kid_row() == before, 'a refused write changed the child row'
    check(f'{len(writes) * 3} writes of a child address (a real email, a pending email_change, a phone, a pending phone, another synthetic address) by GoTrue, the service role and a superuser are refused with KID_EMAIL_FORBIDDEN, nothing changed')

    run(f"SET ROLE supabase_auth_admin; UPDATE auth.users SET last_sign_in_at = now(), email = email, email_change = '', phone = phone WHERE id = '{I['kid']}'")
    run(f"SET ROLE supabase_auth_admin; UPDATE auth.users SET raw_user_meta_data = '{{\"locale\": \"es-MX\"}}' WHERE id = '{I['kid']}'")
    # A pending value left from before the guard can still be cleared.
    run(f"ALTER TABLE auth.users DISABLE TRIGGER guard_kid_email; UPDATE auth.users SET email_change = 'old@gmail.com' WHERE id = '{I['kid']}'; ALTER TABLE auth.users ENABLE TRIGGER guard_kid_email;")
    run(f"SET ROLE supabase_auth_admin; UPDATE auth.users SET email_change = '', email_change_token_new = '' WHERE id = '{I['kid']}'")
    assert run(f"SELECT email_change FROM auth.users WHERE id = '{I['kid']}'") == ''
    check('a sign-in rewrite of the whole row, a metadata change and clearing a pending address stay writable for the child')

    for who, new in (('adult', 'ana_new@example.com'), ('teen', 'teo_new@example.com'), ('parent', 'parent_new@example.com')):
        run(f"SET ROLE supabase_auth_admin; UPDATE auth.users SET email_change = '{new}' WHERE id = '{I[who]}'")
        run(f"SET ROLE supabase_auth_admin; UPDATE auth.users SET email = '{new}', email_change = '' WHERE id = '{I[who]}'")
        assert run(f"SELECT email FROM auth.users WHERE id = '{I[who]}'") == new
    check('an adult, a self-registered teen and a Tutor can still change their own address')

    # S-06: the Tutor's rename of a flagged handle moves the address to the derived one.
    assert run(f"SELECT profile_fields_flagged('{I['kid']}')") == 't'
    assert run(f"SET ROLE service_role; SELECT guardian_rename_flagged_child('{I['parent']}', '{I['kid']}', 'sofia_b')").splitlines()[-1] == 'sofia_b'
    assert run(f"SELECT email FROM auth.users WHERE id = '{I['kid']}'") == 'sofia_b' + DOMAIN
    rejected(f"UPDATE auth.users SET email = 'sofia2016{DOMAIN}' WHERE id = '{I['kid']}'", 'KID_EMAIL_FORBIDDEN')
    check("the verified Tutor's rename (S-06) still moves the child's address to the derived one; the old address cannot come back")

    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
