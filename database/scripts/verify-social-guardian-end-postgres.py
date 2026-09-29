"""E.1/E.2/E.3/E.13 (GAP-FIX-R3 social): the verified Tutor ends a connection
they approved for their child, against real PostgreSQL.

Owned native cluster only (never the shared Supabase stack): a throwaway
database with the Supabase shim and EVERY migration applied in order, then:

  - refusals change nothing: an unrelated verified parent, a stale guardian
    (linked, but the latest verification is revoked), the anon and
    authenticated browser roles, a self-registered teen's linked parent (the
    teen decides its own connections, E.8) and malformed arguments;
  - success: both follow edges go, the approval turns 'revoked' (so
    has_current_social_approval is false), exactly one guardian_ended audit
    row names the guardian, the child and the other account, and the follows
    trigger audits each removed edge;
  - atomicity: a failing audit write rolls the whole end back (edges and
    approval intact);
  - a re-follow in either direction is refused until a guardian approves a
    fresh request, and a fresh approval works;
  - no current connection answers 0 and writes nothing;
  - Appendix J audit completeness stays at 100% with the guardian-ended
    unfollows Core records; mutation checks: the 0204 reconciliation (before
    this lane) reads the same unfollows as unaudited, and a copy of the
    function without the guardian re-check lets the stale guardian through.

Configuration: LF_PG_PSQL or LF_PG_BIN (directory holding psql), LF_PG_PORT, LF_PG_USER,
LF_PG_DATA (the data directory the server must report), LF_PG_KEEP,
LF_PG_REPORT.
"""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = os.environ.get('LF_PG_DATA')
PSQL = os.environ.get('LF_PG_PSQL') or (str(BIN / 'psql.exe') if (BIN / 'psql.exe').exists() else str(BIN / 'psql'))
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
THIS = next(m for m in MIGRATIONS if m.name.endswith('_guardian_end_social_connection.sql'))
BEFORE_METRICS = next(m for m in MIGRATIONS if m.name.endswith('_social_protection_metrics.sql'))


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if DATA and Path(sql('SHOW data_directory')).resolve() != Path(DATA).resolve():
    raise RuntimeError('Refusing an unowned database cluster')

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

database = 'lf_social_guardian_end_' + uuid.uuid4().hex[:12]
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


try:
    run(SHIM)
    for migration in MIGRATIONS:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(MIGRATIONS)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    names = ('parent', 'kid', 'other', 'other2', 'stale', 'unrelated', 'kid2', 'teen')
    I = {name: str(uuid.uuid4()) for name in names}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in I.items()) + ';')
    run(f"""
    UPDATE profiles SET username = 'u_' || p.k, display_name = initcap(p.k)
      FROM (VALUES {', '.join(f"('{v}'::uuid, '{k}')" for k, v in I.items())}) AS p(id, k) WHERE profiles.user_id = p.id;
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
      ('{I['other']}', 'adult'), ('{I['other2']}', 'adult'), ('{I['teen']}', '13_to_17');
    """)

    def verified_parent(parent):
        run(f"""
        INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I[parent]}', 'parent', NULL);
        INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
            VALUES ('{I[parent]}', 'verified', 'local-ocr', 'P', 'Q', '1985-03-01');""")

    def link(parent, kid, kid_role=True):
        run(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{I[parent]}', '{I[kid]}', 'verified', now());")
        if kid_role:
            run(f"""INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I[kid]}', 'kid', '{I[parent]}') ON CONFLICT DO NOTHING;
            UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '9 years')::date WHERE user_id = '{I[kid]}';""")

    for parent in ('parent', 'stale', 'unrelated'):
        verified_parent(parent)
    link('parent', 'kid')
    link('stale', 'kid')
    link('unrelated', 'kid2')
    link('parent', 'teen', kid_role=False)
    # The stale guardian's LATEST verification is revoked (a later row).
    run(f"""INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['stale']}', 'revoked', 'local-ocr', 'P', 'Q', '1985-03-01');""")
    assert service(f"SELECT social_tier('{I['kid']}')") == 'guardian'
    assert service(f"SELECT social_tier('{I['teen']}')") == 'teen', service(f"SELECT social_tier('{I['teen']}')")
    assert service(f"SELECT social_guardian_is_current('{I['stale']}', '{I['kid']}')") == 'f'

    def connect(other='other', kid='kid', guardian='parent'):
        request_id = service(f"SELECT request_social_connection('{I[other]}', '{I[kid]}')")
        assert service(f"SELECT decide_social_connection('{request_id}', '{I[guardian]}', true)") == 'approved'
        # The child follows back (guardian tier, outbound, allowed by the approval).
        service(f"INSERT INTO follows (follower_id, followed_id) VALUES ('{I[kid]}', '{I[other]}')")
        return request_id

    def edges(other='other', kid='kid'):
        return run(f"SELECT count(*) FROM follows WHERE (follower_id = '{I[other]}' AND followed_id = '{I[kid]}') OR (follower_id = '{I[kid]}' AND followed_id = '{I[other]}')")

    def ended_rows(other='other'):
        return run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.connection_revoked' AND detail ->> 'reason' = 'guardian_ended' AND detail ->> 'other_user_id' = '{I[other]}'")

    def end(guardian='parent', kid='kid', other='other', role='service_role'):
        return run(f"SET ROLE {role}; SELECT guardian_end_social_connection('{I[guardian]}', '{I[kid]}', '{I[other]}')").splitlines()[-1]

    request_id = connect()
    assert edges() == '2'
    assert service(f"SELECT has_current_social_approval('{I['other']}', '{I['kid']}')") == 't'

    # ── Refusals change nothing ───────────────────────────────────────────
    snapshot = run("SELECT (SELECT count(*) FROM follows) || ':' || (SELECT count(*) FROM audit_logs) || ':' || (SELECT string_agg(status, ',' ORDER BY id) FROM social_connection_requests)")
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['unrelated']}', '{I['kid']}', '{I['other']}')", 'GUARDIAN_DECISION_FORBIDDEN')
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['stale']}', '{I['kid']}', '{I['other']}')", 'GUARDIAN_DECISION_FORBIDDEN')
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['other']}', '{I['kid']}', '{I['other']}')", 'GUARDIAN_DECISION_FORBIDDEN')
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['parent']}', '{I['kid']}', '{I['kid']}')", 'INVALID_SOCIAL_END')
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['parent']}', '{I['kid']}', NULL)", 'INVALID_SOCIAL_END')
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['parent']}', '{I['teen']}', '{I['other']}')", 'SOCIAL_SELF_MANAGED')
    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SET request.jwt.claim.sub = '{I['parent']}'; SELECT guardian_end_social_connection('{I['parent']}', '{I['kid']}', '{I['other']}')", 'permission denied')
    assert run("SELECT (SELECT count(*) FROM follows) || ':' || (SELECT count(*) FROM audit_logs) || ':' || (SELECT string_agg(status, ',' ORDER BY id) FROM social_connection_requests)") == snapshot
    check("refused without a trace: an unrelated verified parent, a stale guardian (latest verification revoked), the other account itself, the child itself, a null account, a self-registered teen's linked parent (E.8: the teen decides) and the anon/authenticated browser roles")

    # ── Atomicity: a failing audit write rolls everything back ────────────
    run("""CREATE FUNCTION reject_guardian_end_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action = 'social.connection_revoked' AND NEW.detail ->> 'reason' = 'guardian_ended' THEN RAISE EXCEPTION 'INJECTED_GUARDIAN_END_AUDIT_FAILURE'; END IF;
        RETURN NEW; END; $$;
        CREATE TRIGGER reject_guardian_end_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_guardian_end_audit();""")
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['parent']}', '{I['kid']}', '{I['other']}')", 'INJECTED_GUARDIAN_END_AUDIT_FAILURE')
    assert edges() == '2'
    assert run(f"SELECT status FROM social_connection_requests WHERE id = '{request_id}'") == 'approved'
    assert run("SELECT count(*) FROM audit_logs WHERE action = 'social.unfollow'") == '0'
    run('DROP TRIGGER reject_guardian_end_audit ON audit_logs; DROP FUNCTION reject_guardian_end_audit();')
    check('atomic: a failing guardian_ended audit write rolls back both edge deletions, their trigger audit rows and the revoked approval')

    # ── Success ───────────────────────────────────────────────────────────
    assert end() == '2'
    assert edges() == '0'
    assert run(f"SELECT status FROM social_connection_requests WHERE id = '{request_id}'") == 'revoked'
    assert service(f"SELECT has_current_social_approval('{I['other']}', '{I['kid']}')") == 'f'
    row = json.loads(run("SELECT json_build_object('actor', actor_id, 'subject', subject, 'detail', detail) FROM audit_logs WHERE action = 'social.connection_revoked' AND detail ->> 'reason' = 'guardian_ended'"))
    assert row['actor'] == I['parent'] and row['subject'] == I['kid'], row
    d = row['detail']
    assert (d['kid_user_id'], d['guardian_id'], d['other_user_id'], d['request_ids'], d['removed_edges'], d['origin']) == \
        (I['kid'], I['parent'], I['other'], [request_id], 2, 'database-function'), d
    assert run("SELECT count(*) FROM audit_logs WHERE action = 'social.unfollow' AND actor_id IS NULL") == '2'
    check('success: both edges go, the approval turns revoked (has_current_social_approval false), one guardian_ended audit row names guardian, child, account and request, and the follows trigger audits each removed edge')

    # ── A re-follow needs a fresh approval ────────────────────────────────
    rejected(f"SET ROLE service_role; INSERT INTO follows (follower_id, followed_id) VALUES ('{I['other']}', '{I['kid']}')", 'GUARDIAN_APPROVAL_REQUIRED')
    rejected(f"SET ROLE service_role; INSERT INTO follows (follower_id, followed_id) VALUES ('{I['kid']}', '{I['other']}')", 'GUARDIAN_MANAGED_CONNECTIONS')
    rejected(f"SET ROLE service_role; SELECT decide_social_connection('{request_id}', '{I['parent']}', true)", 'SOCIAL_DECISION_CONFLICT')
    fresh = connect()
    assert fresh != request_id and edges() == '2'
    check('after an end, a re-follow either way is refused and the old request cannot be re-approved; only a fresh guardian approval reconnects')

    # ── Nothing to end ────────────────────────────────────────────────────
    audit_before = run('SELECT count(*) FROM audit_logs')
    assert end(other='other2') == '0'
    assert run('SELECT count(*) FROM audit_logs') == audit_before and ended_rows('other2') == '0'
    check('an account that is not a current connection answers 0 and writes nothing')

    # ── Appendix J audit completeness ─────────────────────────────────────
    assert end() == '2'
    for _ in range(4):  # Core records each removed edge of the two ends as an unfollow.
        service(f"SELECT record_social_protection_event('unfollow', '{I['parent']}', '{I['kid']}')")
    a = json.loads(service('SELECT social_protection_metrics(30)'))['auditCompleteness']
    assert a['unfollows'] == 4 and a['unfollowsAudited'] == 4 and a['rate'] == 1, a
    check('Appendix J audit completeness: the guardian-ended unfollows Core records reconcile with their trigger rows (100%)')

    # ── Mutation checks ───────────────────────────────────────────────────
    old = BEFORE_METRICS.read_text(encoding='utf-8')
    old_fn = old[old.index('CREATE OR REPLACE FUNCTION public.social_protection_metrics'):]
    run(old_fn)
    a = json.loads(service('SELECT social_protection_metrics(30)'))['auditCompleteness']
    assert a['unfollowsAudited'] == 0 and a['rate'] < 1, a
    source = THIS.read_text(encoding='utf-8')
    mutated, n = re.subn(r"    IF NOT public\.social_guardian_is_current\(p_guardian, p_kid\) THEN\n        RAISE EXCEPTION 'GUARDIAN_DECISION_FORBIDDEN' USING ERRCODE = 'P0001';\n    END IF;\n", '', source)
    assert n == 1
    run(mutated)
    connect(other='other2')
    assert end(guardian='stale', other='other2') == '2'
    run(source)
    a = json.loads(service('SELECT social_protection_metrics(30)'))['auditCompleteness']
    assert a['unfollowsAudited'] == 4, a
    rejected(f"SET ROLE service_role; SELECT guardian_end_social_connection('{I['stale']}', '{I['kid']}', '{I['other']}')", 'GUARDIAN_DECISION_FORBIDDEN')
    check('mutation checks: the pre-lane (0204) reconciliation reads the guardian-ended unfollows as unaudited, and a copy without the guardian re-check lets the stale guardian end a connection; re-applying the migration restores both')

    report = {'passed': True, 'database': database, 'migration': THIS.name, 'checks': checks,
              'provenance': 'Actual migration chain on a fresh owned native PostgreSQL with the minimal Supabase shim; not a full Supabase integration.'}
    out = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/gap-fix-r3-social-guardian-end-postgres.json')))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
