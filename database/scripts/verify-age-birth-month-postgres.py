"""S-04 (owner decision OD-28): the age-screen birth month, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim, applies
EVERY migration in database/migrations in order, and proves at the enforcing
boundary (migration age_screen_birth_month):

  - record_age_screen keeps a birth month only with a 13-to-17 declaration,
    only as the first day of a month consistent with that band today, and
    only with the FIRST declaration (the E.4 lock of 0086: a band-only teen
    cannot add a month later, and a second call changes nothing);
  - the table itself refuses a month on another band or off the first day,
    from any writer;
  - effective_age_band / adult_by_birth_month / age_at_least_by_birth_month
    move a declared teen to 'adult' only after the whole 18th-birthday month
    has passed, and never touch a declaration without a month;
  - every tier and admission reader follows the band as of today: social_tier
    (E.8), the optional-analytics trigger and family gate (H.1, carrying an
    explicit teen "no" into adulthood), the teen wallet holder (D.3, H-08) and
    research adulthood (D.22); an under-13 origin still wins;
  - no browser role can call the new functions or write the column.

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

database = 'lf_age_birth_month_' + uuid.uuid4().hex[:12]
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


def month(expr):
    """A first-of-month date computed in SQL relative to today (UTC)."""
    return f"date_trunc('month', (now() AT TIME ZONE 'UTC')::date {expr})::date"


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    names = ('teen_month', 'teen_plain', 'teen_late', 'promoted', 'promoted_no', 'promoted_yes', 'in_month',
             'origin_teen', 'adult', 'kid', 'parent', 'young', 'old', 'nobody')
    I = {name: str(uuid.uuid4()) for name in names}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in I.items()) + ';')

    # ── record_age_screen: what it keeps, and the E.4 lock ──────────────────
    fifteen = month("- interval '15 years'")
    fourteen = month("- interval '14 years'")
    thirteen = month("- interval '13 years'")
    assert service(f"SELECT record_age_screen('{I['teen_month']}', '13_to_17', {fifteen})") == '13_to_17'
    assert run(f"SELECT birth_month = {fifteen} FROM account_age_declarations WHERE user_id = '{I['teen_month']}'") == 't'
    # A second call (another band, another month) changes nothing.
    assert service(f"SELECT record_age_screen('{I['teen_month']}', 'adult', NULL)") == '13_to_17'
    assert service(f"SELECT record_age_screen('{I['teen_month']}', '13_to_17', {fourteen})") == '13_to_17'
    assert run(f"SELECT birth_month = {fifteen} FROM account_age_declarations WHERE user_id = '{I['teen_month']}'") == 't'
    # A band-only teen (the old path) cannot add a month later.
    assert service(f"SELECT record_age_declaration('{I['teen_plain']}', '13_to_17')") == '13_to_17'
    assert service(f"SELECT record_age_screen('{I['teen_plain']}', '13_to_17', {fifteen})") == '13_to_17'
    assert run(f"SELECT birth_month IS NULL FROM account_age_declarations WHERE user_id = '{I['teen_plain']}'") == 't'
    check('record_age_screen keeps the month with the first 13-to-17 declaration only: a second call and a band-only teen change nothing (E.4 lock)')

    for band, value, message in [
        ('under_13', month("- interval '10 years'"), 'kept only with a 13 to 17 declaration'),
        ('adult', month("- interval '30 years'"), 'kept only with a 13 to 17 declaration'),
        ('13_to_17', f"({fifteen} + 4)", 'first day of its month'),
        ('13_to_17', month("- interval '12 years'"), 'does not match a 13 to 17 declaration'),
        ('13_to_17', month("- interval '19 years'"), 'does not match a 13 to 17 declaration'),
    ]:
        rejected(f"SET ROLE service_role; SELECT record_age_screen('{I['young']}', '{band}', {value})", message)
    assert run(f"SELECT count(*) FROM account_age_declarations WHERE user_id = '{I['young']}'") == '0'
    # The boundary months themselves: 13 on some day this month, 17 on some day this month.
    assert service(f"SELECT record_age_screen('{I['teen_late']}', '13_to_17', {thirteen})") == '13_to_17'
    check('record_age_screen refuses a month on an under-13 or adult band, off the first day, or inconsistent with 13-17 today (nothing stored); the 13th-birthday month itself is accepted')

    thirty = month("- interval '30 years'")
    for bad in (f"('{I['old']}', 'adult', {thirty})",
                f"('{I['old']}', '13_to_17', ({fifteen} + 3))"):
        rejected(f"INSERT INTO account_age_declarations (user_id, declared_age_band, birth_month) VALUES {bad}",
                 'account_age_declarations_birth_month_shape')
    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT record_age_screen('{I['old']}', '13_to_17', {fifteen})", 'permission denied')
        for fn in (f"effective_age_band('{I['teen_month']}')", f"adult_by_birth_month('{I['teen_month']}')",
                   f"age_at_least_by_birth_month('{I['teen_month']}', 16)"):
            rejected(f"SET ROLE {role}; SELECT {fn}", 'permission denied')
        rejected(f"SET ROLE {role}; UPDATE account_age_declarations SET birth_month = NULL", 'permission denied')
    rejected(f"SET ROLE service_role; UPDATE account_age_declarations SET birth_month = NULL WHERE user_id = '{I['teen_month']}'", 'permission denied')
    check('the table refuses a month on another band or off the first day from any writer; browser roles cannot call the functions, and no API role can rewrite a month')

    # ── The band as of today ────────────────────────────────────────────────
    # Declarations made years ago (the function would refuse these months
    # today, which is the point: time passed since the first declaration).
    run(f"""
    INSERT INTO account_age_declarations (user_id, declared_age_band, birth_month) VALUES
        ('{I['promoted']}', '13_to_17', {month("- interval '18 years 1 month'")}),
        ('{I['promoted_no']}', '13_to_17', {month("- interval '19 years'")}),
        ('{I['promoted_yes']}', '13_to_17', {month("- interval '25 years'")}),
        ('{I['in_month']}', '13_to_17', {month("- interval '18 years'")}),
        ('{I['origin_teen']}', '13_to_17', {month("- interval '25 years'")}),
        ('{I['adult']}', 'adult', NULL), ('{I['kid']}', 'under_13', NULL);
    INSERT INTO account_safety_origins (user_id) VALUES ('{I['origin_teen']}');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL);
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
        VALUES ('{I['parent']}', '{I['kid']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['parent']}');
    """)
    expect = {'promoted': 'adult', 'promoted_no': 'adult', 'promoted_yes': 'adult', 'in_month': '13_to_17',
              'teen_month': '13_to_17', 'teen_plain': '13_to_17', 'adult': 'adult', 'kid': 'under_13', 'nobody': ''}
    for name, want in expect.items():
        assert service(f"SELECT effective_age_band('{I[name]}')") == want, (name, want)
    assert service(f"SELECT adult_by_birth_month('{I['promoted']}')") == 't'
    for name in ('in_month', 'teen_plain', 'adult', 'nobody'):
        assert service(f"SELECT adult_by_birth_month('{I[name]}')") == 'f', name
    # Born 15 years ago this month: the whole birthday month has not passed, so it proves 14, not 15.
    assert service(f"SELECT age_at_least_by_birth_month('{I['teen_month']}', 14)") == 't'
    assert service(f"SELECT age_at_least_by_birth_month('{I['teen_month']}', 15)") == 'f'
    assert service(f"SELECT age_at_least_by_birth_month('{I['promoted']}', 16)") == 't'
    assert service(f"SELECT age_at_least_by_birth_month('{I['teen_late']}', 16)") == 'f'
    assert service(f"SELECT age_at_least_by_birth_month('{I['teen_plain']}', 16)") == 'f'
    assert service(f"SELECT age_at_least_by_birth_month('{I['nobody']}', 16)") == 'f'
    check("effective_age_band reads a declared teen as adult only after the whole 18th-birthday month (inside it: still 13_to_17); no month, no change; age_at_least_by_birth_month proves an age only past the whole birthday month")

    # ── Readers of the tier follow the band as of today ─────────────────────
    tiers = {'promoted': 'adult', 'in_month': 'teen', 'teen_month': 'teen', 'origin_teen': 'closed', 'kid': 'guardian', 'adult': 'adult'}
    for name, want in tiers.items():
        assert service(f"SELECT social_tier('{I[name]}')") == want, (name, want)
    check('social_tier: a teen past the 18th-birthday month is adult, inside it still teen; an under-13 origin and a kid role still win')

    run(f"""
    INSERT INTO teen_analytics_preferences (user_id, enabled, disclosure_version) VALUES
        ('{I['promoted_no']}', false, 1), ('{I['promoted_yes']}', true, 1), ('{I['teen_month']}', true, 1);
    """)
    admitted = {'promoted': 't', 'promoted_no': 'f', 'promoted_yes': 't', 'in_month': 'f', 'teen_month': 't', 'teen_plain': 'f', 'adult': 't'}
    for name, want in admitted.items():
        assert service(f"SELECT family_analytics_admitted('{I[name]}')") == want, (name, want)

    def event_admitted(name):
        return run(f"INSERT INTO learning_events (user_id, role, event) VALUES ('{I[name]}', 'universal', 'session_start') RETURNING id") != ''

    for name, want in admitted.items():
        assert event_admitted(name) == (want == 't'), (name, want)
    check('H.1: optional events and Family Hub analytics follow the band as of today, and an explicit teen "no" survives the move to adult (no choice recorded: the adult rule)')

    wallet = {'teen_month': 't', 'in_month': 't', 'promoted': 'f', 'teen_plain': 't', 'origin_teen': 'f'}
    for name, want in wallet.items():
        assert service(f"SELECT teen_wallet_holder('{I[name]}')") == want, (name, want)
    research = {'promoted': 't', 'in_month': 'f', 'adult': 't', 'nobody': 'f', 'teen_plain': 'f'}
    for name, want in research.items():
        assert service(f"SELECT family_research_is_adult('{I[name]}')") == want, (name, want)
    check('D.3: the teen wallet stops taking a holder once the teen is adult by birth month (rows kept, H-08); D.22 research adulthood follows, and an account with no declaration is not an adult (false, never NULL)')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
