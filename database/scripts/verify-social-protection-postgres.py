"""Appendix J E.1-E.5 metrics (social_protection_metrics) against real PostgreSQL.

Owned native cluster only (never the shared Supabase stack): a throwaway
database with the Supabase shim, EVERY migration applied in order, then:

  - record_social_protection_event stores counts by tier pair and relation,
    never an identifier; an unknown event and the trigger-only age events are
    refused; no browser role can call it or read the counters;
  - discovery: a stranger's resolution of a guardian-tier child is counted as
    unrelated and reached (target zero, so a regression shows), the child's
    own Tutor's is not;
  - the Tutor badge shown to an unrelated viewer is counted apart (target 0);
  - age boundary: a birth-date change by a reviewed function, by Core's
    guardian path (service role, verified guardian) and by any other service
    write land in their own buckets; setting a first date is not a change;
  - audit completeness is 100% for follows, blocks and reports written
    through the real paths, and drops when an audit row is missing
    (negative control on a scratch copy of the check);
  - pattern escalation: three unrelated kid-role reporters open a case (rate
    100%); with the case gone the same subject reads as missed (rate 0);
  - approval latency p50/p95 from decided requests; the window is validated.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP, LF_PG_REPORT; LF_PG_TEMPLATE
names a database that already holds the shim and the whole chain (a faster
local loop; the release gate never sets it).
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

database = 'lf_social_protection_' + uuid.uuid4().hex[:12]
TEMPLATE = os.environ.get('LF_PG_TEMPLATE')
sql(f'CREATE DATABASE {database}' + (f' TEMPLATE {TEMPLATE}' if TEMPLATE else ''))
checks = []
NINE = ['discovery', 'unauthorizedConnections', 'approvalLatency', 'reports', 'patternEscalation',
        'ageBoundary', 'tutorBadge', 'familySocialPanel', 'auditCompleteness']


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


def metrics(days=30):
    return json.loads(service(f'SELECT social_protection_metrics({days})'))


def record(event, viewer, subject):
    service(f"SELECT record_social_protection_event('{event}', '{I[viewer]}', '{I[subject]}')")


try:
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    if not TEMPLATE:
        run(SHIM)
        for migration in migrations:
            try:
                run(migration.read_text(encoding='utf-8'))
            except RuntimeError as error:
                raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    names = ('parent', 'kid', 'stranger', 'adult2', 'staff', 'p1', 'p2', 'p3', 'r1', 'r2', 'r3')
    I = {name: str(uuid.uuid4()) for name in names}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(
        f"('{v}', '{k}@{'littlefounders.ai' if k == 'staff' else 'example.com'}')" for k, v in I.items()) + ';')
    run(f"""
    UPDATE profiles SET username = 'u_' || p.k, display_name = initcap(p.k)
      FROM (VALUES {', '.join(f"('{v}'::uuid, '{k}')" for k, v in I.items())}) AS p(id, k) WHERE profiles.user_id = p.id;
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
      ('{I['stranger']}', 'adult'), ('{I['adult2']}', 'adult'), ('{I['staff']}', 'adult');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['staff']}', 'superadmin', NULL);
    """)
    for parent, kid in (('parent', 'kid'), ('p1', 'r1'), ('p2', 'r2'), ('p3', 'r3')):
        run(f"""
        INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I[parent]}', 'parent', NULL);
        INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
            VALUES ('{I[parent]}', 'verified', 'local-ocr', 'P', 'Q', '1985-03-01');
        INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{I[parent]}', '{I[kid]}', 'verified', now());
        INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I[kid]}', 'kid', '{I[parent]}');
        UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '9 years')::date WHERE user_id = '{I[kid]}';
        """)
    assert service(f"SELECT social_tier('{I['kid']}')") == 'guardian'

    # ── Counters: counts only, service role only ──────────────────────────
    record('profile_full', 'stranger', 'kid')
    record('profile_refused', 'stranger', 'kid')
    record('profile_full', 'parent', 'kid')
    record('list_full', 'staff', 'kid')
    cols = run("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'social_protection_counters'")
    assert cols == 'day,event,viewer_tier,subject_tier,related,n', cols
    for bad in ('bogus', 'age_change_other'):
        rejected(f"SET ROLE service_role; SELECT record_social_protection_event('{bad}', '{I['stranger']}', '{I['kid']}')", 'SOCIAL_EVENT_INVALID')
    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT record_social_protection_event('profile_full', '{I['stranger']}', '{I['kid']}')", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT social_protection_metrics(30)", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM social_protection_counters", 'permission denied')
    rejected("SET ROLE service_role; SELECT * FROM social_protection_counters", 'permission denied')
    rejected("SET ROLE service_role; SELECT social_protection_metrics(0)", 'SOCIAL_METRIC_WINDOW')
    rejected("SET ROLE service_role; SELECT social_protection_metrics(367)", 'SOCIAL_METRIC_WINDOW')
    m = metrics()
    assert sorted(m) == sorted(['days', *NINE]), sorted(m)
    assert m['discovery'] == {'unrelatedAttempts': 2, 'unrelatedReached': 1, 'resolutions': 4, 'rate': 0.5}, m['discovery']
    check('counters hold day, event, tier pair and relation only; unknown and trigger-only events are refused; browsers cannot record, read the counters or the metric, the service role reads only through the metric; the window is 1-366 days; the answer carries exactly the nine Appendix J metrics')
    check("discovery: a stranger reaching a guardian-tier child counts as unrelated and reached (rate 0.5 of the stranger's two attempts), the child's own Tutor and staff do not")

    # ── Tutor badge, family panel, follow refusals ────────────────────────
    record('tutor_badge_shown', 'stranger', 'parent')
    record('tutor_badge_shown', 'kid', 'parent')
    record('family_social_panel_view', 'parent', 'kid')
    record('follow_attempt', 'stranger', 'kid')
    record('follow_refused_guardian', 'stranger', 'kid')
    m = metrics()
    assert m['tutorBadge'] == {'shown': 2, 'shownUnrelated': 1}, m['tutorBadge']
    assert m['familySocialPanel'] == {'views': 1, 'guardiansWithLinkedChild': 4}, m['familySocialPanel']
    assert m['unauthorizedConnections']['refusedGuardianApproval'] == 1 and m['unauthorizedConnections']['rate'] == 1
    check('the Tutor badge shown to an unrelated viewer is counted apart from one shown to the linked child; Family social panel views and refused follows are counted')

    # ── Age boundary ──────────────────────────────────────────────────────
    run(f"UPDATE profiles SET birth_date = birth_date - 1 WHERE user_id = '{I['kid']}'")
    service(f"UPDATE profiles SET birth_date = birth_date - 1 WHERE user_id = '{I['kid']}'")
    service(f"UPDATE profiles SET birth_date = '1990-01-01' WHERE user_id = '{I['adult2']}'")
    assert metrics()['ageBoundary'] == {'guardianPath': 1, 'reviewedFunction': 1, 'other': 0}
    service(f"UPDATE profiles SET birth_date = '1991-01-01' WHERE user_id = '{I['adult2']}'")
    run(f"UPDATE account_age_declarations SET declared_age_band = '13_to_17' WHERE user_id = '{I['adult2']}'")
    assert metrics()['ageBoundary'] == {'guardianPath': 1, 'reviewedFunction': 2, 'other': 1}
    run(f"UPDATE account_age_declarations SET declared_age_band = 'adult' WHERE user_id = '{I['adult2']}'")
    check("age boundary: a reviewed function or migration, Core's guardian path (service role, verified guardian) and any other service write of a set birth date land in their own buckets (target zero for other); setting a first date is not a change")

    # ── Audit completeness ────────────────────────────────────────────────
    service(f"INSERT INTO follows (follower_id, followed_id) VALUES ('{I['stranger']}', '{I['adult2']}')")
    service(f"INSERT INTO blocks (blocker_id, blocked_id) VALUES ('{I['adult2']}', '{I['staff']}')")
    service(f"SELECT submit_social_report('{I['adult2']}', '{I['stranger']}', 'other', NULL)")
    a = metrics()['auditCompleteness']
    assert (a['follows'], a['followsAudited'], a['blocks'], a['blocksAudited'], a['rate']) == (1, 1, 1, 1, 1), a
    assert a['reports'] == a['reportsAudited'] == 1
    run(f"ALTER TABLE audit_logs DISABLE TRIGGER USER; DELETE FROM audit_logs WHERE action = 'social.follow'; ALTER TABLE audit_logs ENABLE TRIGGER USER")
    a = metrics()['auditCompleteness']
    assert a['followsAudited'] == 0 and a['rate'] < 1, a
    check('audit completeness is 100% for a follow, a block and a report written through the real paths; negative control: removing the follow audit row drops the follow count and the rate below 100%')

    # ── Pattern escalation ────────────────────────────────────────────────
    for r in ('r1', 'r2', 'r3'):
        service(f"SELECT submit_social_report('{I[r]}', '{I['stranger']}', 'unwanted_contact', NULL)")
    p = metrics()['patternEscalation']
    assert p == {'qualifying': 1, 'escalated': 1, 'rate': 1}, p
    run(f"DELETE FROM social_review_cases WHERE subject_id = '{I['stranger']}'")
    p = metrics()['patternEscalation']
    assert p == {'qualifying': 1, 'escalated': 0, 'rate': 0}, p
    check('pattern escalation: three unrelated kid-role reporters in 30 days qualify the subject and the case is open (100%); negative control: with the case gone the same subject reads as missed (0%)')

    # ── Latency ───────────────────────────────────────────────────────────
    run(f"""INSERT INTO social_connection_requests (requester_id, kid_user_id, status, requested_at, decided_at, decided_by)
        VALUES ('{I['r1']}', '{I['kid']}', 'approved', now() - interval '2 hours', now(), '{I['parent']}'),
               ('{I['r2']}', '{I['kid']}', 'denied', now() - interval '6 hours', now(), '{I['parent']}')""")
    lat = metrics()['approvalLatency']
    assert lat['guardianDecided'] == 2 and 3.9 < lat['guardianP50Hours'] < 4.1 and 5.5 < lat['guardianP95Hours'] < 6.1, lat
    r = metrics()['reports']
    assert r['filed'] == 4 and r['open'] == 4 and r['p50ResolutionHours'] is None, r
    check('guardian-approval latency p50/p95 come from decided requests; reports are counted with their resolution time (none resolved yet reads null, never zero)')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
