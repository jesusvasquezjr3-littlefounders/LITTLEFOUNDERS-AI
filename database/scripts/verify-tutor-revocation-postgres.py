"""A.5 / Appendix M Part 2.1 criterion 2 / A.1: a staff revocation of a Tutor's verification ends the Tutor's powers, on real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim and
applies EVERY migration in database/migrations in order. Just before
tutor_revocation_cascade it seeds an adult revoked through the old path (who
kept the parent role, a verified link and an open invite), so the migration's
backfill is proved as well as the new function. It proves:

  - the old defect reproduces before the migration (a revoked adult kept the
    parent role and a verified link), and the backfill ends both, attributes
    the link revocation to the staff member of the revocation, withdraws the
    open invite and pauses the child;
  - revoke_parent_verification ends every verified guardian link of the adult
    (revoked_by = the staff actor), withdraws the adult's unaccepted invites
    and removes the parent role (the user_roles audit row names the staff
    actor), in the same transaction as the revoked row and its audit row; a
    failed audit write leaves all of it untouched;
  - A.1: a kid-role child whose only Tutor was revoked is paused and banned at
    GoTrue; a child with another verified guardian is not; the other
    guardian's link stays verified;
  - no path back: a service-role parent-role insert, the audited staff grant,
    a new verified ID check, a new or reopened guardian link (pending or
    verified) are all refused for the revoked adult;
  - the guardian stepping away still works, and a link revocation naming
    someone else outside the staff path is still refused;
  - browser roles cannot call the revocation; nobody but the database calls
    end_revoked_tutor_powers.

Configuration: LF_PG_PSQL (or LF_PG_BIN), LF_PG_PORT, LF_PG_USER, LF_PG_KEEP.
"""

import json
import os
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_BIN = os.environ.get('LF_PG_BIN')
PSQL = os.environ.get('LF_PG_PSQL') or (str(Path(_BIN) / ('psql.exe' if os.name == 'nt' else 'psql')) if _BIN
                                         else str(ROOT / '.codex/audit-db/pgsql/bin/psql.exe'))
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
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb, email_change text DEFAULT '',
    created_at timestamptz DEFAULT now(), is_anonymous boolean DEFAULT false, banned_until timestamptz);
CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, user_id text, token text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

BREAK_AUDIT = """
CREATE OR REPLACE FUNCTION public.test_break_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action = current_setting('test.break_action', true) THEN RAISE EXCEPTION 'audit store unavailable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_test_break_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.test_break_audit();
"""

database = 'lf_tutor_revocation_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    out = run('SET ROLE service_role;' + query)
    return out.splitlines()[-1] if out else ''


def scalar(query):
    out = run(query)
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


names = ('boss', 'admin', 'old', 'old_kid', 'tutor', 'kid_a', 'kid_b', 'other', 'teen', 'other_kid', 'stranger')
U = {name: str(uuid.uuid4()) for name in names}
REASON = 'Fraud report 812 confirmed: the ID belonged to someone else'


def seed_people():
    emails = {k: (f'{k}@littlefounders.ai' if k in ('boss', 'admin') else f'{k}@example.com') for k in names}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{emails[k]}')" for k, v in U.items()) + ';')
    run(f"""
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{U['boss']}', 'superadmin', NULL);
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{U['admin']}', 'admin', '{U['boss']}');
    """)


def verified_tutor(name):
    run(f"INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date) "
        f"VALUES ('{U[name]}', 'verified', 'local-ocr', 'T', 'Utor', '1980-01-01');")
    service(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{U[name]}', 'parent', '{U[name]}');")


def link(parent, kid):
    service(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) "
            f"VALUES ('{U[parent]}', '{U[kid]}', 'verified', now());")


def kid_role(kid, parent):
    run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{U[kid]}', 'kid', '{U[parent]}');")


def invite(parent, kid):
    service(f"INSERT INTO guardian_invites (kid_user_id, created_by, token, expires_at) "
            f"VALUES ('{U[kid]}', '{U[parent]}', '{uuid.uuid4().hex}', now() + interval '7 days');")


def link_status(parent, kid):
    return scalar(f"SELECT verification_status || '|' || coalesce(revoked_by::text, '-') FROM guardian_links "
                  f"WHERE parent_user_id = '{U[parent]}' AND kid_user_id = '{U[kid]}'")


def has_parent_role(name):
    return scalar(f"SELECT count(*) FROM user_roles WHERE user_id = '{U[name]}' AND role = 'parent'") == '1'


def paused(name):
    return scalar(f"SELECT (p.suspended_at IS NOT NULL)::text || '|' || (u.banned_until IS NOT NULL)::text "
                  f"FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE p.user_id = '{U[name]}'")


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    target = next(m for m in migrations if m.name.endswith('_tutor_revocation_cascade.sql'))
    for migration in migrations:
        if migration.name == target.name:
            # ── Before: the old revocation, which ended nothing ──────────────
            seed_people()
            verified_tutor('old')
            link('old', 'old_kid')
            kid_role('old_kid', 'old')
            invite('old', 'old_kid')
            assert service(f"SELECT revoke_parent_verification('{U['old']}', '{U['admin']}', '{REASON}');") == 'revoked'
            assert has_parent_role('old') and link_status('old', 'old_kid') == 'verified|-', 'the old defect did not reproduce'
            check('before the migration a revoked Tutor kept the parent role and the verified link (the A.5 defect reproduces)')
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')
    run(BREAK_AUDIT)

    # ── The backfill ─────────────────────────────────────────────────────
    assert not has_parent_role('old')
    assert link_status('old', 'old_kid') == f"revoked|{U['admin']}", link_status('old', 'old_kid')
    assert scalar(f"SELECT count(*) FROM guardian_invites WHERE created_by = '{U['old']}' AND accepted_at IS NULL") == '0'
    assert paused('old_kid') == 'true|true', paused('old_kid')
    ended = json.loads(scalar(f"SELECT detail FROM audit_logs WHERE action = 'admin.parent_verification.powers_ended' AND subject = '{U['old']}'"))
    assert ended == {'origin': 'migration-backfill', 'linksRevoked': 1, 'invitesWithdrawn': 1, 'parentRoleRemoved': True, 'childrenPaused': 1}, ended
    check('the backfill ends the powers an earlier revocation left: role, link (named after the revoking staff member), open invite; the child is paused')

    # ── The live revocation ──────────────────────────────────────────────
    verified_tutor('tutor')
    link('tutor', 'kid_a')
    kid_role('kid_a', 'tutor')
    link('tutor', 'kid_b')
    link('other', 'kid_b')
    kid_role('kid_b', 'tutor')
    invite('tutor', 'kid_a')

    rejected(f"SET ROLE service_role; SET test.break_action = 'admin.parent_verification.revoked'; "
             f"SELECT revoke_parent_verification('{U['tutor']}', '{U['admin']}', '{REASON}');", 'audit store unavailable')
    assert has_parent_role('tutor') and link_status('tutor', 'kid_a') == 'verified|-' and paused('kid_a') == 'false|false'
    assert scalar(f"SELECT count(*) FROM parent_verifications WHERE user_id = '{U['tutor']}' AND status = 'revoked'") == '0'
    check('a revocation whose audit row cannot be written changes nothing: no revoked row, role and links intact')

    rejected(f"SET ROLE service_role; SELECT revoke_parent_verification('{U['tutor']}', '{U['stranger']}', '{REASON}');", 'PARENT_REVOKE_FORBIDDEN')
    assert service(f"SELECT revoke_parent_verification('{U['tutor']}', '{U['admin']}', '{REASON}');") == 'revoked'
    assert not has_parent_role('tutor')
    assert link_status('tutor', 'kid_a') == f"revoked|{U['admin']}" and link_status('tutor', 'kid_b') == f"revoked|{U['admin']}"
    assert link_status('other', 'kid_b') == 'verified|-'
    assert scalar(f"SELECT count(*) FROM guardian_invites WHERE created_by = '{U['tutor']}'") == '0'
    detail = json.loads(scalar(f"SELECT detail FROM audit_logs WHERE action = 'admin.parent_verification.revoked' AND subject = '{U['tutor']}'"))
    assert detail == {'reason': REASON, 'linksRevoked': 2, 'invitesWithdrawn': 1, 'parentRoleRemoved': True, 'childrenPaused': 1}, detail
    role_audit = scalar(f"SELECT actor_id FROM audit_logs WHERE action = 'user_roles.delete' AND subject = '{U['tutor']}' AND detail ->> 'role' = 'parent'")
    assert role_audit == U['admin'], role_audit
    transitions = scalar(f"SELECT count(*) || ':' || string_agg(DISTINCT actor_user_id::text, ',') FROM family_state_audit "
                         f"WHERE table_name = 'guardian_links' AND to_state = 'revoked' AND row_id IN "
                         f"(SELECT id::text FROM guardian_links WHERE parent_user_id = '{U['tutor']}')")
    assert transitions == f"2:{U['admin']}", transitions
    check('revoke_parent_verification ends both verified links (revoked_by = staff), withdraws the open invite and removes the parent role, audited under the staff actor')

    assert paused('kid_a') == 'true|true', paused('kid_a')
    assert paused('kid_b') == 'false|false', paused('kid_b')
    check('A.1: the child whose only Tutor was revoked is paused and banned; the child with another verified guardian is not')

    # ── No path back ─────────────────────────────────────────────────────
    rejected(f"SET ROLE service_role; INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{U['tutor']}', 'parent', '{U['tutor']}');",
             'PARENT_ROLE_REVOKED')
    rejected(f"SET ROLE service_role; SELECT grant_parent_role_with_justification('{U['tutor']}', '{U['boss']}', 'Support case 99: re-verified in person');",
             'PARENT_ROLE_REVOKED')
    rejected(f"SET ROLE service_role; INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date) "
             f"VALUES ('{U['tutor']}', 'verified', 'local-ocr', 'T', 'Utor', '1980-01-01');", 'PARENT_VERIFICATION_REVOKED')
    assert not has_parent_role('tutor')
    check('no path back: the parent role (service role or audited staff grant) and a new verified ID check are refused')

    rejected(f"SET ROLE service_role; INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) "
             f"VALUES ('{U['tutor']}', '{U['other_kid']}', 'verified', now());", 'GUARDIAN_LINK_TUTOR_REVOKED')
    rejected(f"SET ROLE service_role; INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status) "
             f"VALUES ('{U['tutor']}', '{U['other_kid']}', 'pending');", 'GUARDIAN_LINK_TUTOR_REVOKED')
    invite('other', 'kid_b')
    token = scalar(f"SELECT token FROM guardian_invites WHERE created_by = '{U['other']}' AND kid_user_id = '{U['kid_b']}'")
    # The invite path needs the parent role, which is gone; the link guard
    # also refuses the reopening itself, whatever writes it.
    rejected(f"SET ROLE service_role; SELECT accept_guardian_invite('{token}', '{U['tutor']}');", 'INVALID_GUARDIAN_INVITE')
    invite_id = scalar(f"SELECT id FROM guardian_invites WHERE token = '{token}'")
    for status, verified_at in (('pending', 'NULL'), ('verified', 'now()')):
        rejected(f"SET ROLE service_role; UPDATE guardian_links SET verification_status = '{status}', verified_at = {verified_at}, "
                 f"invite_id = '{invite_id}', revoked_by = NULL, revoked_at = NULL "
                 f"WHERE parent_user_id = '{U['tutor']}' AND kid_user_id = '{U['kid_b']}';", 'GUARDIAN_LINK_TUTOR_REVOKED')
    assert link_status('tutor', 'kid_b') == f"revoked|{U['admin']}"
    check('no path back: a new link (pending or verified), an invite acceptance and a reopened revoked link are refused')

    # ── The ordinary lifecycle is unchanged ──────────────────────────────
    service(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) "
            f"VALUES ('{U['other']}', '{U['teen']}', 'verified', now());")
    rejected(f"SET ROLE service_role; UPDATE guardian_links SET verification_status = 'revoked', revoked_by = '{U['admin']}', revoked_at = now() "
             f"WHERE parent_user_id = '{U['other']}' AND kid_user_id = '{U['teen']}';", 'GUARDIAN_LINK_REVOCATION_INVALID')
    service(f"UPDATE guardian_links SET verification_status = 'revoked', revoked_by = '{U['other']}', revoked_at = now() "
            f"WHERE parent_user_id = '{U['other']}' AND kid_user_id = '{U['teen']}';")
    assert link_status('other', 'teen') == f"revoked|{U['other']}"
    check('outside the staff path a link revocation must still name the guardian stepping away, who still can')

    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT revoke_parent_verification('{U['other']}', '{U['admin']}', '{REASON}');", 'permission denied')
    for role in ('anon', 'authenticated', 'service_role'):
        rejected(f"SET ROLE {role}; SELECT end_revoked_tutor_powers('{U['other']}', '{U['admin']}');", 'permission denied')
    assert service(f"SELECT tutor_verification_revoked('{U['tutor']}')::text;") == 'true'
    assert service(f"SELECT tutor_verification_revoked('{U['other']}')::text;") == 'false'
    check('browser roles cannot revoke; nobody calls end_revoked_tutor_powers directly; tutor_verification_revoked is latest-row-wins')

    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
