"""E.4 (OD-3): the staff-reviewed age correction for a self-registered account, against real PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on an owned native PostgreSQL cluster, over the
minimal Supabase shim the S07 verifiers use, then proves at the enforcing
boundary (migration age_correction_requests):

  - request_age_correction refuses every population that is not a
    self-registered account with a declaration (a parent-created child, an
    under-13 origin, a guest, an unscreened account), a request that changes
    nothing, a malformed month and a second pending request;
  - a pending request changes no declaration, tier or analytics admission;
  - the account cannot decide its own request (not even a staff account), a
    non-staff account or an admin without manage_users cannot decide at all;
  - an approval replaces the declaration through record_age_declaration,
    moves the social tier and the analytics admission, promotes a due teen
    month, and writes one audit row in the same transaction; a rejection
    changes no age; a decided request cannot be decided again;
  - an under-13 request protects at once (the under-13 origin);
  - the browser roles can neither read the table nor call either function.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN    directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
"""
from datetime import date
from pathlib import Path
import os
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('LF_PG_BIN', str(ROOT / '.codex/audit-db/pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


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

# LF_PG_REUSE names a database this script already migrated (kept with LF_PG_KEEP=1), for a fast re-run while editing.
REUSE = os.environ.get('LF_PG_REUSE')
database = REUSE or 'lf_age_correction_' + uuid.uuid4().hex[:12]
if not REUSE:
    sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(statement):
    return run(f'SET ROLE service_role; {statement}')


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


def account(band=None, month=None, anonymous=False, domain='example.com'):
    uid = str(uuid.uuid4())
    run(f"INSERT INTO auth.users(id, email, is_anonymous) VALUES ('{uid}', '{uid[:8]}@{domain}', {str(anonymous).lower()})")
    if band:
        service(f"SELECT record_age_declaration('{uid}', '{band}'{', ' + repr(month) if month else ''})")
    return uid


def request(uid, band, month=None):
    return service(f"SELECT request_age_correction('{uid}', '{band}', {repr(month) if month else 'NULL'})")


def decide(request_id, staff, approve, reason):
    return service(f"SELECT decide_age_correction('{request_id}', '{staff}', {str(approve).lower()}, '{reason}')")


def state(uid):
    return run(f"""SELECT concat_ws('|', (SELECT declared_age_band FROM account_age_declarations WHERE user_id = '{uid}'),
        coalesce((SELECT declared_birth_month::text FROM account_age_declarations WHERE user_id = '{uid}'), '-'),
        social_tier('{uid}'), effective_age_band('{uid}'), family_analytics_admitted('{uid}'),
        EXISTS (SELECT 1 FROM account_safety_origins WHERE user_id = '{uid}'))""")


today = date.today()
teen_month = date(today.year - 15, today.month, 1).isoformat()
_m = today.month - 2 if today.month > 2 else today.month + 10
due_month = date(today.year - 18 - (0 if today.month > 2 else 1), _m, 1).isoformat()  # 18 years and 2 months ago: due

try:
    if not REUSE:
        run(SHIM)
        for migration in MIGRATIONS:
            try:
                run(migration.read_text(encoding='utf-8'))
            except RuntimeError as error:
                raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
        check(f'all {len(MIGRATIONS)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # Staff: a manage_users admin, an admin without the grant, a superadmin.
    staff, weak_admin, superadmin = account('adult'), account('adult'), account('adult', domain='littlefounders.ai')
    run(f"""INSERT INTO user_roles (user_id, role) VALUES ('{superadmin}', 'superadmin');
            INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{staff}', 'admin', '{superadmin}'), ('{weak_admin}', 'admin', '{superadmin}');
            INSERT INTO admin_permissions (user_id, permission) VALUES ('{staff}', 'manage_users'), ('{weak_admin}', 'view_analytics');""")

    # 1. Who may ask.
    parent, kid = account('adult'), account('under_13')
    run(f"""INSERT INTO user_roles (user_id, role) VALUES ('{parent}', 'parent');
            INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{parent}', '{kid}', 'verified', now());
            INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{kid}', 'kid', '{parent}');""")
    teen_kid = account('13_to_17')
    run(f"""INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{parent}', '{teen_kid}', 'verified', now());
            INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{teen_kid}', 'kid', '{parent}');""")
    protected = account('13_to_17')
    service(f"SELECT mark_under13_origin('{protected}')")
    guest = account('adult', anonymous=True)
    unscreened = account()
    teen = account('13_to_17', teen_month)
    filed_before = run('SELECT count(*) FROM age_correction_requests')
    refusals = [
        (teen_kid, 'adult', None, 'KID_AGE_BY_TUTOR'),
        (protected, 'adult', None, 'AGE_PROTECTED'),
        (guest, '13_to_17', teen_month, 'NOT_ELIGIBLE'),
        (unscreened, 'adult', None, 'AGE_SCREEN_REQUIRED'),
        (teen, '13_to_17', teen_month, 'AGE_UNCHANGED'),
        (teen, 'adult', teen_month, 'INVALID_BIRTH_MONTH'),
        (teen, '13_to_17', f'{today.year - 15}-03-17', 'INVALID_BIRTH_MONTH'),
        (teen, 'teen', None, 'INVALID_AGE_BAND'),
        (str(uuid.uuid4()), 'adult', None, 'NOT_ELIGIBLE'),
    ]
    for uid, band, month, message in refusals:
        rejected(f"SET ROLE service_role; SELECT request_age_correction('{uid}', '{band}', {repr(month) if month else 'NULL'})", message)
    assert run('SELECT count(*) FROM age_correction_requests') == filed_before
    check(f'{len(refusals)} refused requests (a parent-created child, an under-13 origin, a guest, an unscreened account, no change, malformed bands and months, an unknown account) file nothing')

    # 2. A pending request changes nothing, and only one can be open.
    before = state(teen)
    pending = request(teen, 'adult')
    assert state(teen) == before, (state(teen), before)
    rejected(f"SET ROLE service_role; SELECT request_age_correction('{teen}', 'adult', NULL)", 'CORRECTION_PENDING')
    check('a pending request changes no declaration, tier or analytics admission; a second pending request is refused')

    # 3. Nobody decides their own request; only a manage_users admin or a superadmin decides.
    staff_request = request(staff, '13_to_17', teen_month)
    rejected(f"SET ROLE service_role; SELECT decide_age_correction('{staff_request}', '{staff}', true, 'entry_error')", 'SELF_DECISION')
    for outsider in (teen, weak_admin, parent, str(uuid.uuid4())):
        rejected(f"SET ROLE service_role; SELECT decide_age_correction('{pending}', '{outsider}', true, 'entry_error')", 'NOT_STAFF')
    rejected(f"SET ROLE service_role; SELECT decide_age_correction('{pending}', '{staff}', true, 'not_credible')", 'INVALID_DECISION')
    rejected(f"SET ROLE service_role; SELECT decide_age_correction('{pending}', '{staff}', false, 'entry_error')", 'INVALID_DECISION')
    assert state(teen) == before
    assert run(f"SELECT status FROM age_correction_requests WHERE id = '{pending}'") == 'pending'
    check('the account cannot decide its own request (even as staff); the requester, an admin without manage_users, a parent and an unknown account cannot decide; a reason must match the decision')

    # 4. An approval moves the declaration, the tier and the analytics admission, audited in the same transaction.
    assert before.split('|')[2:5] == ['teen', '13_to_17', 'f'], before
    assert decide(pending, staff, True, 'evidence_verified') == 'approved'
    after = state(teen)
    assert after.split('|')[:5] == ['adult', '-', 'adult', 'adult', 't'], after
    audit = run(f"SELECT concat_ws('|', detail->>'decision', detail->>'tierBefore', detail->>'tierAfter', actor_id) FROM audit_logs WHERE action = 'staff.age_correction_decided' AND subject = '{teen}'")
    assert audit == f'approved|teen|adult|{staff}', audit
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'account.age_correction_requested' AND subject = '{teen}'") == '1'
    rejected(f"SET ROLE service_role; SELECT decide_age_correction('{pending}', '{superadmin}', false, 'not_credible')", 'NOT_PENDING')
    check('an approval moves the declaration (teen to adult), the social tier and the analytics admission, writes one audit row naming the staff member; a decided request cannot be decided again')

    # 5. An adult corrected to a teen keeps the teen month; a due month is promoted at once.
    adult = account('adult')
    corrected = request(adult, '13_to_17', teen_month)
    assert decide(corrected, superadmin, True, 'entry_error') == 'approved'
    assert state(adult).split('|')[:4] == ['13_to_17', teen_month, 'teen', '13_to_17'], state(adult)
    late = account('13_to_17')
    due = request(late, '13_to_17', due_month)
    assert decide(due, staff, True, 'entry_error') == 'approved'
    assert run(f"SELECT declared_age_band || '|' || (promoted_to_adult_at IS NOT NULL) FROM account_age_declarations WHERE user_id = '{late}'") == 'adult|true'
    check('an adult corrected to 13-17 keeps the month and moves to the teen tier; a corrected month that already says 18 is promoted to adult at once')

    # 6. A rejection changes no age.
    other = account('13_to_17', teen_month)
    before_other = state(other)
    rejected_request = request(other, 'adult')
    assert decide(rejected_request, staff, False, 'evidence_missing') == 'rejected'
    assert state(other) == before_other
    assert run(f"SELECT status || '|' || reason_code || '|' || (decided_by = '{staff}') FROM age_correction_requests WHERE id = '{rejected_request}'") == 'rejected|evidence_missing|true'
    check('a rejection changes no declaration or tier and records the decider and reason')

    # 7. An under-13 request protects at once; staff settle the band.
    young = account('13_to_17', teen_month)
    young_request = request(young, 'under_13')
    assert state(young).split('|')[2] == 'closed' and state(young).endswith('|t'), state(young)
    assert decide(young_request, staff, True, 'evidence_verified') == 'approved'
    assert state(young).split('|')[:2] == ['under_13', '-'], state(young)
    check('an under-13 request marks the under-13 origin at once (closed tier); the approval records the band without a month')

    # 8. The browser has no way in.
    denials = 0
    for role in ('anon', 'authenticated'):
        for statement in ('SELECT * FROM public.age_correction_requests',
                          f"SELECT public.request_age_correction('{other}', 'adult', NULL)",
                          f"SELECT public.decide_age_correction('{rejected_request}', '{staff}', true, 'entry_error')",
                          f"UPDATE public.age_correction_requests SET status = 'approved' WHERE id = '{rejected_request}'"):
            rejected(f'SET ROLE {role}; {statement}', 'permission denied')
            denials += 1
    for privilege in ('INSERT', 'UPDATE', 'DELETE'):
        assert run(f"SELECT has_table_privilege('service_role', 'public.age_correction_requests', '{privilege}')") == 'f'
    check(f'{denials} browser attempts are denied; the service role can only read the table')

    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1' and not REUSE:
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
