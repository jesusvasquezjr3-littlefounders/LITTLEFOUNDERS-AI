"""S-03 (owner decision OD-27 (2)): the 16-17 discoverable-profile opt-in, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim, applies
EVERY migration in database/migrations in order, and proves at the enforcing
boundary (migration teen_discoverable_profile):

  - eligibility is the teen social tier AND age evidence proving 16 (a
    recorded birth month past its whole 16th-birthday month, or a profile
    birth date) AND an unflagged profile: a 13-to-15-year-old, a declared teen
    with no birth month, a parent-created child (any age), an under-13 origin,
    a flagged teen and an adult cannot turn it on;
  - private is the default; the opt-in is explicit, revocable (off always
    works, even once ineligible) and audited in the same transaction, and an
    unchanged answer writes nothing;
  - browser visibility (social_subject_visible) shows an opted-in, eligible
    teen to any non-closed viewer, and stops the moment eligibility lapses (a
    flagged handle), with no sweep;
  - a follow into a discoverable teen still needs the teen's consent
    (SUBJECT_CONSENT_REQUIRED, E.8 unchanged);
  - no browser role can call the functions or read the table.

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

database = 'lf_teen_discoverable_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    out = run('SET ROLE service_role;' + query)
    return out.splitlines()[-1] if out else ''


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


def month(years):
    return f"date_trunc('month', (now() AT TIME ZONE 'UTC')::date - interval '{years}')::date"


def visible(viewer, subject):
    return run(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{viewer}', false); SELECT social_subject_visible('{subject}')").splitlines()[-1] == 't'


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    names = ('teen16', 'teen17_dob', 'teen15', 'teen_nomonth', 'teen_in16month', 'flagteen', 'kid16', 'parent',
             'origin', 'adult', 'stranger', 'guest')
    I = {name: str(uuid.uuid4()) for name in names}
    run('INSERT INTO auth.users (id, email, is_anonymous) VALUES ' + ', '.join(
        f"('{v}', '{k}@example.com', {'true' if k == 'guest' else 'false'})" for k, v in I.items()) + ';')
    run(f"""
    UPDATE profiles SET username = p.k, display_name = initcap(p.k)
      FROM (VALUES {', '.join(f"('{v}'::uuid, '{k}')" for k, v in I.items() if k != 'flagteen')}) AS p(id, k)
      WHERE profiles.user_id = p.id;
    UPDATE profiles SET username = 'luz_tiktok', display_name = 'Luz' WHERE user_id = '{I['flagteen']}';
    INSERT INTO account_age_declarations (user_id, declared_age_band, birth_month) VALUES
        ('{I['teen16']}', '13_to_17', {month('16 years 2 months')}),
        ('{I['teen15']}', '13_to_17', {month('15 years 3 months')}),
        ('{I['teen_in16month']}', '13_to_17', {month('16 years')}),
        ('{I['teen_nomonth']}', '13_to_17', NULL),
        ('{I['teen17_dob']}', '13_to_17', NULL),
        ('{I['flagteen']}', '13_to_17', {month('17 years')}),
        ('{I['origin']}', '13_to_17', {month('16 years 6 months')}),
        ('{I['adult']}', 'adult', NULL), ('{I['stranger']}', 'adult', NULL);
    UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '17 years')::date WHERE user_id = '{I['teen17_dob']}';
    INSERT INTO account_safety_origins (user_id) VALUES ('{I['origin']}');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL);
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid16']}', 'verified', now()), ('{I['parent']}', '{I['origin']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid16']}', 'kid', '{I['parent']}');
    UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '16 years 6 months')::date WHERE user_id = '{I['kid16']}';
    """)
    eligible = {'teen16': 't', 'teen17_dob': 't', 'teen15': 'f', 'teen_in16month': 'f', 'teen_nomonth': 'f',
                'flagteen': 'f', 'kid16': 'f', 'origin': 'f', 'adult': 'f', 'guest': 'f'}
    for name, want in eligible.items():
        assert service(f"SELECT teen_discoverable_eligible('{I[name]}')") == want, (name, want)
    check('eligible only when the teen tier, proven 16+ (a birth month past its whole 16th-birthday month, or a profile birth date) and an unflagged profile all hold: 13-15, the 16th-birthday month itself, no birth month, flagged, parent-created child, under-13 origin, adult and guest are not')

    audit = "SELECT count(*) FROM audit_logs WHERE action LIKE 'social.profile_discoverable_%'"
    assert service(f"SELECT teen_profile_discoverable('{I['teen16']}')") == 'f'
    assert not visible(I['stranger'], I['teen16'])
    for name in ('teen15', 'teen_nomonth', 'flagteen', 'kid16', 'origin', 'adult', 'teen_in16month'):
        rejected(f"SET ROLE service_role; SELECT set_teen_profile_discoverable('{I[name]}', true)", 'DISCOVERABLE_NOT_ELIGIBLE')
    assert run('SELECT count(*) FROM teen_profile_discoverability') == '0' and run(audit) == '0'
    check('private is the default, and every ineligible account is refused turning it on, with nothing stored or audited')

    assert service(f"SELECT set_teen_profile_discoverable('{I['teen16']}', true)") == 't'
    assert service(f"SELECT set_teen_profile_discoverable('{I['teen16']}', true)") == 't'
    assert run(audit) == '1'
    assert service(f"SELECT teen_profile_discoverable('{I['teen16']}')") == 't'
    for viewer in ('stranger', 'teen15', 'kid16'):
        assert visible(I[viewer], I['teen16']), viewer
    assert not visible(I['guest'], I['teen16'])
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['stranger']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['stranger']}', '{I['teen16']}')", 'SUBJECT_CONSENT_REQUIRED')
    check('an eligible teen opts in once (a repeat writes nothing): visible to every non-closed viewer, never to a guest, and a follow still needs the teen\'s consent')

    # Eligibility lapses by itself: a flagged display name hides the profile at once.
    # (The E.13 write guard refuses a flagged value from any writer, so the
    # flag is set on the review record directly, as a rules update would.)
    run(f"UPDATE profile_safety_reviews SET display_name_flags = ARRAY['platform'] WHERE user_id = '{I['teen16']}'")
    assert run(f"SELECT profile_fields_flagged('{I['teen16']}')") == 't'
    assert service(f"SELECT teen_profile_discoverable('{I['teen16']}')") == 'f'
    assert not visible(I['stranger'], I['teen16'])
    # Off always works, even while ineligible, and is audited.
    assert service(f"SELECT set_teen_profile_discoverable('{I['teen16']}', false)") == 'f'
    assert run(audit) == '2'
    assert service(f"SELECT set_teen_profile_discoverable('{I['teen_nomonth']}', false)") == 'f'
    assert run(audit) == '2'
    check('the opt-in lapses by itself when eligibility does (a flagged profile is hidden at once, no sweep); turning it off always works and is audited; an unchanged answer writes nothing')

    for role in ('anon', 'authenticated'):
        for fn in (f"teen_discoverable_eligible('{I['teen16']}')", f"teen_profile_discoverable('{I['teen16']}')",
                   f"set_teen_profile_discoverable('{I['teen16']}', true)"):
            rejected(f"SET ROLE {role}; SELECT {fn}", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM teen_profile_discoverability", 'permission denied')
    rejected(f"SET ROLE service_role; INSERT INTO teen_profile_discoverability (user_id, discoverable) VALUES ('{I['teen17_dob']}', true)", 'permission denied')
    check('no browser role can call the functions or read the table, and even the service role writes only through set_teen_profile_discoverable')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
