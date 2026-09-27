"""S-06 (owner decision OD-28): a Tutor renames a flagged child handle, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim (with
GoTrue's auth.identities), applies EVERY migration in database/migrations in
order, and proves at the enforcing boundary (migration
guardian_child_username_change):

  - guardian_rename_flagged_child changes the profile handle, the sign-in
    address derived from it and GoTrue's email identity together, writes one
    audit row naming the act and the flag categories (never a handle), and
    clears the child's E.13 review;
  - every unauthorized population and every bad request is refused with
    nothing changed: another parent, a pending or revoked link, a
    self-registered teen, an unflagged handle, a flagged or malformed or taken
    new handle (profile or sign-in address), the same handle, an address that
    does not follow the derivation;
  - kid_username_guard: no other write (a child's own session, a service
    write, a superuser) can change a child's handle, while display names, a
    new child's first handle and adults' handles stay writable;
  - no browser role can call the function.

Configuration (defaults match the repo's owned audit cluster):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
  LF_PG_REPORT optional path for a JSON report of the passed checks
"""

import json
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
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(), is_anonymous boolean DEFAULT false);
CREATE UNIQUE INDEX users_email_unique ON auth.users (email);
CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, identity_data jsonb NOT NULL, provider text NOT NULL,
    email text GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED);
CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_kid_username_' + uuid.uuid4().hex[:12]
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
        raise AssertionError(f'expected {message!r}, the statement succeeded')


def check(name):
    checks.append(name)
    print('ok -', name)


def rename(guardian, kid, username):
    return f"SET ROLE service_role; SELECT guardian_rename_flagged_child('{guardian}', '{kid}', '{username}')"


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    handles = {'parent': 'parent_a', 'other_parent': 'parent_b', 'pending_parent': 'parent_c',
               'kid': 'sofia2016', 'calm_kid': 'luna_b', 'teen': 'teo2011', 'odd_kid': 'max_ig', 'adult': 'ana_adult',
               'taken': 'taken_one'}
    I = {name: str(uuid.uuid4()) for name in handles}
    email = {name: (handle + DOMAIN if name in ('kid', 'calm_kid', 'odd_kid') else f'{handle}@example.com') for name, handle in handles.items()}
    email['odd_kid'] = 'legacy_address' + DOMAIN  # an account that does not follow the derivation
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{I[k]}', '{email[k]}')" for k in handles) + ';')
    run('INSERT INTO auth.identities (provider_id, user_id, identity_data, provider) VALUES ' + ', '.join(
        f"('{I[k]}', '{I[k]}', jsonb_build_object('sub', '{I[k]}', 'email', '{email[k]}'), 'email')" for k in handles) + ';')
    # Legacy handles are set before the accounts are minors in scope, exactly
    # like a handle created before E.13 existed.
    run(f"""
    UPDATE profiles SET username = h.handle, display_name = initcap(h.k)
      FROM (VALUES {', '.join(f"('{I[k]}'::uuid, '{h}', '{k}')" for k, h in handles.items())}) AS h(id, handle, k)
      WHERE profiles.user_id = h.id;
    INSERT INTO user_roles (user_id, role, granted_by) VALUES
        ('{I['parent']}', 'parent', NULL), ('{I['other_parent']}', 'parent', NULL), ('{I['pending_parent']}', 'parent', NULL);
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid']}', 'verified', now()), ('{I['parent']}', '{I['calm_kid']}', 'verified', now()),
        ('{I['parent']}', '{I['odd_kid']}', 'verified', now()), ('{I['parent']}', '{I['teen']}', 'verified', now()),
        ('{I['other_parent']}', '{I['calm_kid']}', 'verified', now());
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status) VALUES ('{I['pending_parent']}', '{I['kid']}', 'pending');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES
        ('{I['kid']}', 'kid', '{I['parent']}'), ('{I['calm_kid']}', 'kid', '{I['parent']}'), ('{I['odd_kid']}', 'kid', '{I['parent']}');
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES ('{I['teen']}', '13_to_17'), ('{I['adult']}', 'adult');
    """)
    assert run(f"SELECT profile_fields_flagged('{I['kid']}')") == 't'

    def state():
        return run(f"""SELECT json_build_object(
            'handles', (SELECT json_object_agg(user_id, username) FROM profiles),
            'emails', (SELECT json_object_agg(id, email) FROM auth.users),
            'identities', (SELECT json_object_agg(user_id, identity_data->>'email') FROM auth.identities),
            'audit', (SELECT count(*) FROM audit_logs WHERE action = 'family.kid_username_changed'))""")

    # A sign-in address already taken, with no profile using the handle.
    run(f"INSERT INTO auth.users (id, email) VALUES ('{uuid.uuid4()}', 'ghost_b{DOMAIN}')")
    before = state()
    refusals = [
        (I['other_parent'], I['kid'], 'sofia_b', 'NOT_GUARDIAN'),        # a verified parent of another child
        (I['pending_parent'], I['kid'], 'sofia_b', 'NOT_GUARDIAN'),      # a pending link is not a guardian
        (I['adult'], I['kid'], 'sofia_b', 'NOT_GUARDIAN'),               # no parent role at all
        (I['kid'], I['kid'], 'sofia_b', 'NOT_GUARDIAN'),                 # the child itself
        (I['parent'], str(uuid.uuid4()), 'sofia_b', 'NOT_GUARDIAN'),     # no such account
        (I['parent'], I['teen'], 'teo_b', 'ACCOUNT_SELF_MANAGED'),       # a linked self-registered teen
        (I['parent'], I['calm_kid'], 'luna_c', 'USERNAME_NOT_FLAGGED'),  # an unflagged handle stays locked
        (I['parent'], I['kid'], 'sofia2016', 'USERNAME_UNCHANGED'),
        (I['parent'], I['kid'], 'sofia_2017', 'PROFILE_FIELD_UNSAFE'),   # the new handle is itself flagged
        (I['parent'], I['kid'], 'luna_b', 'USERNAME_IN_USE'),            # another profile's handle
        (I['parent'], I['kid'], 'Sofia_B', 'USERNAME_SHAPE'),
        (I['parent'], I['kid'], 'so', 'USERNAME_SHAPE'),
        (I['parent'], I['odd_kid'], 'max_b', 'SIGN_IN_IDENTIFIER_MISMATCH'),
    ]
    for guardian, kid, handle, message in refusals:
        rejected(rename(guardian, kid, handle), message)
    rejected(rename(I['parent'], I['kid'], 'ghost_b'), 'USERNAME_IN_USE')
    assert json.loads(state()) == json.loads(before), 'a refusal changed something'
    check(f'{len(refusals) + 1} refusals (another parent, a pending link, no parent role, the child itself, an unknown account, a self-registered teen, an unflagged handle, the same handle, a flagged, malformed or taken new handle, a taken sign-in address, an address off the derivation) change nothing')

    assert run(rename(I['parent'], I['kid'], 'sofia_b')).splitlines()[-1] == 'sofia_b'
    assert run(f"SELECT username FROM profiles WHERE user_id = '{I['kid']}'") == 'sofia_b'
    assert run(f"SELECT email FROM auth.users WHERE id = '{I['kid']}'") == 'sofia_b' + DOMAIN
    assert run(f"SELECT identity_data->>'email' FROM auth.identities WHERE user_id = '{I['kid']}'") == 'sofia_b' + DOMAIN
    audit = json.loads(run(f"SELECT json_agg(json_build_object('actor', actor_id, 'subject', subject, 'detail', detail)) FROM audit_logs WHERE action = 'family.kid_username_changed'"))
    assert audit == [{'actor': I['parent'], 'subject': I['kid'], 'detail': {'origin': 'database-function', 'reason': 'flagged_handle', 'flags': ['year']}}], audit
    assert 'sofia' not in json.dumps(audit[0]['detail'])
    assert run(f"SELECT profile_fields_flagged('{I['kid']}')") == 'f'
    # The new handle is no longer flagged, so it is locked again.
    rejected(rename(I['parent'], I['kid'], 'sofia_c'), 'USERNAME_NOT_FLAGGED')
    check('the verified Tutor renames the flagged handle: profile, sign-in address and email identity change together, one audit row names the act and the flag category only, the review clears, and the new handle is locked again')

    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['calm_kid']}', false); UPDATE profiles SET username = 'luna_c' WHERE user_id = '{I['calm_kid']}'", 'KID_USERNAME_LOCKED')
    rejected(f"SET ROLE service_role; UPDATE profiles SET username = 'luna_c' WHERE user_id = '{I['calm_kid']}'", 'KID_USERNAME_LOCKED')
    rejected(f"UPDATE profiles SET username = 'luna_c' WHERE user_id = '{I['calm_kid']}'", 'KID_USERNAME_LOCKED')
    # A session cannot borrow the rename's switch for another child.
    rejected(f"BEGIN; SELECT set_config('lf.kid_username_rename', '{I['kid']}', true); UPDATE profiles SET username = 'luna_c' WHERE user_id = '{I['calm_kid']}'; COMMIT;", 'KID_USERNAME_LOCKED')
    run(f"SET ROLE service_role; UPDATE profiles SET display_name = 'Luna' WHERE user_id = '{I['calm_kid']}'")
    run(f"SET ROLE service_role; UPDATE profiles SET username = 'ana_grown' WHERE user_id = '{I['adult']}'")
    fresh = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{fresh}', 'nina_b{DOMAIN}'); SET ROLE service_role; UPDATE profiles SET username = 'nina_b' WHERE user_id = '{fresh}'")
    check("kid_username_guard: a child's handle cannot change through the child's session, a service write or a superuser write (nor with another child's switch); display names, an adult's handle and a new child's first handle stay writable")

    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT guardian_rename_flagged_child('{I['parent']}', '{I['kid']}', 'sofia_d')", 'permission denied')
    check('no browser role can call guardian_rename_flagged_child')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
