"""Gap-fix F1-staff-ops, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim, applies
EVERY migration in database/migrations in order, and proves at the enforcing
boundary (migrations parent_grant_integrity, audited_staff_decisions,
staff_access_reviews and identity_metrics):

  - A.5: a parent role reaches an account only through the audited staff
    function (reason 10-200 characters, superadmin actor) or an ID-verified
    row; a direct service-role insert without either is refused; when the
    audit row cannot be written, the role is not committed either; the
    revocation writes its row and its reason together or not at all;
  - G.3: a live-activity verdict and a pack decision write their audit row in
    the same transaction, exactly when the decision row changes;
  - G.4: the access-review log lists only admin/superadmin roles and the four
    staff permissions, ages a grant from max(granted, last kept review), and
    a review is superadmin-only and audited; browser roles read nothing;
  - Appendix M Part 1: identity_metrics counts every population correctly;
  - A.2 / Appendix M 1.1: onboarding_discovery_metrics counts stored discovery
    answers from refused populations, and its migration scrubs them.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP, LF_PG_REPORT
(see verify-teen-discoverable-postgres.py).
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
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb, email_change text DEFAULT '',
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

database = 'lf_staff_ops_' + uuid.uuid4().hex[:12]
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


def scalar(query):
    return run(query).splitlines()[-1]


# A failing audit write, switched on per action for the atomicity proofs.
BREAK_AUDIT = """
CREATE OR REPLACE FUNCTION public.test_break_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action = current_setting('test.break_action', true) THEN RAISE EXCEPTION 'audit store unavailable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_test_break_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.test_break_audit();
"""

try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')
    run(BREAK_AUDIT)

    names = ('boss', 'admin', 'plain', 'target', 'ocr', 'revokee', 'guest1', 'guest2', 'g_kid', 'g_teen', 'g_new',
             'mail', 'old', 'kidpending', 'kid', 'untagged')
    I = {name: str(uuid.uuid4()) for name in names}
    emails = {k: (f'{k}@littlefounders.ai' if k in ('boss', 'admin') else f'{k}@example.com') for k in names}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{emails[k]}')" for k, v in I.items()) + ';')
    run(f"""
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['boss']}', 'superadmin', NULL);
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['admin']}', 'admin', '{I['boss']}');
    """)

    # ── A.5: the parent grant ────────────────────────────────────────────
    rejected(f"SET ROLE service_role; INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['target']}', 'parent', '{I['boss']}');",
             'PARENT_ROLE_UNJUSTIFIED')
    check('a direct service-role parent-role insert with no ID check and no justification is refused')

    rejected(f"SET ROLE service_role; SELECT grant_parent_role_with_justification('{I['target']}', '{I['boss']}', '  too short ');",
             'PARENT_GRANT_JUSTIFICATION_REQUIRED')
    rejected(f"SET ROLE service_role; SELECT grant_parent_role_with_justification('{I['target']}', '{I['boss']}', '{'x' * 201}');",
             'PARENT_GRANT_JUSTIFICATION_REQUIRED')
    rejected(f"SET ROLE service_role; SELECT grant_parent_role_with_justification('{I['target']}', '{I['admin']}', 'Support case 1234: re-verified in person');",
             'PARENT_GRANT_FORBIDDEN')
    assert scalar(f"SELECT count(*) FROM user_roles WHERE user_id = '{I['target']}' AND role = 'parent'") == '0'
    check('a short, overlong or non-superadmin grant is refused and leaves no role')

    rejected(f"SET ROLE service_role; SET test.break_action = 'admin.parent_role_justification'; "
             f"SELECT grant_parent_role_with_justification('{I['target']}', '{I['boss']}', 'Support case 1234: re-verified in person');",
             'audit store unavailable')
    assert scalar(f"SELECT count(*) FROM user_roles WHERE user_id = '{I['target']}' AND role = 'parent'") == '0'
    check('when the justification cannot be recorded, the parent role is not committed either')

    assert service(f"SELECT grant_parent_role_with_justification('{I['target']}', '{I['boss']}', ' Support case 1234: re-verified in person ');") == 'granted'
    row = scalar(f"SELECT detail ->> 'justification' FROM audit_logs WHERE action = 'admin.parent_role_justification' AND subject = '{I['target']}'")
    assert row == 'Support case 1234: re-verified in person', row
    assert service(f"SELECT grant_parent_role_with_justification('{I['target']}', '{I['boss']}', 'Second look, still justified');") == 'already_granted'
    check('the audited grant commits the role and the trimmed justification together')

    run(f"INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date) VALUES ('{I['ocr']}', 'verified', 'local-ocr', 'O', 'Cr', '1980-01-01');")
    service(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['ocr']}', 'parent', '{I['ocr']}');")
    assert scalar(f"SELECT count(*) FROM user_roles WHERE user_id = '{I['ocr']}' AND role = 'parent'") == '1'
    check('the ID-verified path (latest row verified, local-ocr) still grants the role')

    rejected(f"SET ROLE service_role; UPDATE user_roles SET role = 'parent' WHERE user_id = '{I['admin']}' AND role = 'admin';",
             'PARENT_ROLE_UNJUSTIFIED')
    check('turning another role into parent through an update is refused the same way')

    run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['untagged']}', 'parent', NULL);")
    check('a superuser session (migrations, seeds, operator) is not pretended to be bound')

    # ── A.5: the revocation ──────────────────────────────────────────────
    run(f"INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date) VALUES ('{I['revokee']}', 'verified', 'local-ocr', 'R', 'V', '1981-01-01');")
    service(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['revokee']}', 'parent', '{I['revokee']}');")
    rejected(f"SET ROLE service_role; SELECT revoke_parent_verification('{I['revokee']}', '{I['boss']}', 'short');", 'PARENT_REVOKE_REASON_REQUIRED')
    rejected(f"SET ROLE service_role; SELECT revoke_parent_verification('{I['revokee']}', '{I['plain']}', 'Fraud report confirmed by two guardians');",
             'PARENT_REVOKE_FORBIDDEN')
    rejected(f"SET ROLE service_role; SET test.break_action = 'admin.parent_verification.revoked'; "
             f"SELECT revoke_parent_verification('{I['revokee']}', '{I['admin']}', 'Fraud report confirmed by two guardians');",
             'audit store unavailable')
    assert scalar(f"SELECT count(*) FROM parent_verifications WHERE user_id = '{I['revokee']}' AND status = 'revoked'") == '0'
    assert service(f"SELECT revoke_parent_verification('{I['revokee']}', '{I['admin']}', 'Fraud report confirmed by two guardians');") == 'revoked'
    assert scalar(f"SELECT count(*) FROM parent_verifications WHERE user_id = '{I['revokee']}' AND status = 'revoked' AND method = 'staff-revoked'") == '1'
    assert scalar(f"SELECT detail ->> 'reason' FROM audit_logs WHERE action = 'admin.parent_verification.revoked' AND subject = '{I['revokee']}'") == 'Fraud report confirmed by two guardians'
    assert service(f"SELECT revoke_parent_verification('{uuid.uuid4()}', '{I['admin']}', 'Fraud report confirmed by two guardians');") == 'not_found'
    check('a revocation writes its row and its reason together, refuses a short reason or a non-staff actor, and fails whole')

    # ── F3-identity-site: a verified ID check never outranks a minor's age record ──
    A = {name: str(uuid.uuid4()) for name in ('flag_guest', 'flag_upgraded', 'teen', 'teen_due', 'adult_ok')}
    run(f"""
    INSERT INTO auth.users (id, email, is_anonymous) VALUES ('{A['flag_guest']}', NULL, true),
        ('{A['flag_upgraded']}', 'up@example.com', false), ('{A['teen']}', 'teen@example.com', false),
        ('{A['teen_due']}', 'due@example.com', false), ('{A['adult_ok']}', 'ok@example.com', false);
    INSERT INTO account_safety_origins (user_id) VALUES ('{A['flag_guest']}'), ('{A['flag_upgraded']}');
    INSERT INTO account_age_declarations (user_id, declared_age_band, declared_birth_month) VALUES
        ('{A['teen']}', '13_to_17', NULL),
        ('{A['teen_due']}', '13_to_17', date_trunc('month', now() - interval '18 years 2 months')::date),
        ('{A['adult_ok']}', 'adult', NULL);
    """)
    verified = "INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date) VALUES ('{0}', 'verified', 'local-ocr', 'A', 'Dult', '1980-01-01');"
    for name in ('flag_guest', 'flag_upgraded', 'teen'):
        rejected('SET ROLE service_role; ' + verified.format(A[name]), 'AGE_RECORD_MINOR')
        # A row that is not a verified ID check may exist; it cannot be turned into one.
        service(verified.format(A[name]).replace("'verified', 'local-ocr'", "'revoked', 'staff-revoked'"))
        rejected(f"SET ROLE service_role; UPDATE parent_verifications SET status = 'verified', method = 'local-ocr' WHERE user_id = '{A[name]}';",
                 'AGE_RECORD_MINOR')
        rejected(f"SET ROLE service_role; INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{A[name]}', 'parent', '{A[name]}');",
                 'PARENT_ROLE_UNJUSTIFIED')
        assert scalar(f"SELECT count(*) FROM parent_verifications WHERE user_id = '{A[name]}' AND status = 'verified'") == '0'
    for name in ('teen_due', 'adult_ok'):
        service(verified.format(A[name]))
    check('a verified ID check cannot be written or updated into place for a flagged guest, an upgraded flagged account or a declared teen (so none gains the parent role); an adult and a teen whose birth month made them 18 can')

    # F3-identity-site finish: Tutors verified BEFORE the guard existed keep the
    # role (a superuser insert stands in for that history); list_minor_record_tutors
    # names exactly the ones whose own age record says a minor, for staff review.
    before = set(run('SET ROLE service_role; SELECT user_id FROM list_minor_record_tutors();').split())
    run('INSERT INTO user_roles (user_id, role, granted_by) VALUES ' + ', '.join(
        f"('{A[name]}', 'parent', NULL)" for name in ('flag_guest', 'flag_upgraded', 'teen', 'teen_due', 'adult_ok')) + ';')
    listed = set(run('SET ROLE service_role; SELECT user_id FROM list_minor_record_tutors();').split()) - before
    assert listed == {A['flag_guest'], A['flag_upgraded'], A['teen']}, listed
    for role in ('anon', 'authenticated'):
        rejected(f'SET ROLE {role}; SELECT * FROM list_minor_record_tutors();', 'permission denied')
    run(f"DELETE FROM auth.users WHERE id IN ({', '.join(repr(v) for v in A.values())});")
    check('list_minor_record_tutors names a Tutor with an under-13 origin or a declared teen band (never one made 18 by birth month, never an adult), for the service role only')

    # ── G.3: live-activity verdicts and pack decisions ───────────────────
    session = run(f"INSERT INTO tutor_sessions (user_id, locale, tier, character, diorama, intent) VALUES ('{I['plain']}', 'en-US', 2, 'rho', 'a', 'open') RETURNING id;").splitlines()[-1]
    segs = [run(f"INSERT INTO tutor_segments (session_id, seq, origin, segment_type, payload, review_status) VALUES ('{session}', {n}, 'live', 'quiz_mcq', '{{}}', 'pending') RETURNING id;").splitlines()[-1] for n in range(3)]
    rejected(f"SET ROLE service_role; SET test.break_action = 'admin.tutor_activity.review'; SELECT record_tutor_live_review('{segs[0]}', 'approved', NULL, '{I['admin']}');",
             'audit store unavailable')
    assert scalar(f"SELECT review_status FROM tutor_segments WHERE id = '{segs[0]}'") == 'pending'
    assert service(f"SELECT record_tutor_live_review('{segs[0]}', 'rejected', 'safety', '{I['admin']}');") == 'recorded_legacy'
    detail = json.loads(scalar(f"SELECT detail FROM audit_logs WHERE action = 'admin.tutor_activity.review' AND subject = '{segs[0]}'"))
    assert detail == {'status': 'rejected', 'issue': 'safety', 'governed': False}, detail
    assert service(f"SELECT record_tutor_live_review('{segs[0]}', 'approved', NULL, '{I['admin']}');") == 'not_pending'
    assert scalar(f"SELECT count(*) FROM audit_logs WHERE action = 'admin.tutor_activity.review' AND subject = '{segs[0]}'") == '1'
    changed = int(scalar("SELECT count(*) FROM tutor_segments WHERE review_status <> 'pending'"))
    audited = int(scalar("SELECT count(*) FROM audit_logs WHERE action = 'admin.tutor_activity.review'"))
    assert changed == audited == 1, (changed, audited)
    check('a live-activity verdict and its audit row commit together, exactly when the segment changes')

    pack = run("INSERT INTO tutor_packs (skill_key, tier, locale, pack, status) VALUES ('kc:money.save-first', 2, 'en-US', '{}', 'review') RETURNING id;").splitlines()[-1]
    digest = 'a' * 64
    rejected(f"SET ROLE service_role; SET test.break_action = 'admin.tutor_pack.status'; SELECT set_tutor_pack_status('{pack}', 'review', 'published', '{I['admin']}', '{digest}');",
             'audit store unavailable')
    assert scalar(f"SELECT status FROM tutor_packs WHERE id = '{pack}'") == 'review'
    assert service(f"SELECT set_tutor_pack_status('{pack}', 'published', 'archived', '{I['admin']}', NULL) IS NULL;") == 't'
    published = json.loads(service(f"SELECT set_tutor_pack_status('{pack}', 'review', 'published', '{I['admin']}', '{digest}');"))
    assert published['status'] == 'published' and published['released_by'] == I['admin'] and published['content_hash'] == digest
    audit = json.loads(scalar(f"SELECT detail FROM audit_logs WHERE action = 'admin.tutor_pack.status' AND subject = '{pack}'"))
    assert audit['from'] == 'review' and audit['to'] == 'published' and audit['contentHash'] == digest, audit
    rejected(f"SET ROLE service_role; SELECT set_tutor_pack_status('{pack}', 'review', 'published', '{I['admin']}', 'nothex');",
             'publishing records the validated content hash')
    check('a pack decision and its audit row commit together; a stale decision changes and records nothing')

    # ── G.4: the access-review log ───────────────────────────────────────
    run(f"""
    INSERT INTO admin_permissions (user_id, permission, granted_by) VALUES
        ('{I['admin']}', 'manage_users', '{I['boss']}'), ('{I['admin']}', 'view_analytics', '{I['boss']}');
    UPDATE user_roles SET granted_at = now() - interval '200 days' WHERE user_id = '{I['admin']}' AND role = 'admin';
    UPDATE admin_permissions SET granted_at = now() - interval '120 days' WHERE user_id = '{I['admin']}' AND permission = 'manage_users';
    """)
    status = json.loads(service('SELECT staff_access_review_status(90);'))
    keys = {(g['kind'], g['grant']) for g in status['grants']}
    assert keys == {('role', 'superadmin'), ('role', 'admin'), ('permission', 'manage_users'), ('permission', 'view_analytics')}, keys
    assert status['total'] == 4 and status['stale'] == 2, status
    check('the review list holds only admin/superadmin roles and staff permissions, never family roles')

    rejected(f"SET ROLE service_role; SELECT record_staff_access_review('{I['admin']}', 'role', 'admin', '{I['admin']}', 'kept', NULL);", 'ACCESS_REVIEW_FORBIDDEN')
    rejected(f"SET ROLE service_role; SELECT record_staff_access_review('{I['target']}', 'role', 'parent', '{I['boss']}', 'kept', NULL);", 'ACCESS_REVIEW_INVALID')
    assert service(f"SELECT record_staff_access_review('{I['admin']}', 'permission', 'manage_content', '{I['boss']}', 'kept', NULL);") == 'not_held'
    rejected(f"SET ROLE service_role; SET test.break_action = 'admin.access.reviewed'; SELECT record_staff_access_review('{I['admin']}', 'role', 'admin', '{I['boss']}', 'kept', NULL);",
             'audit store unavailable')
    assert scalar('SELECT count(*) FROM staff_access_reviews') == '0'
    assert service(f"SELECT record_staff_access_review('{I['admin']}', 'role', 'admin', '{I['boss']}', 'kept', 'Quarterly review: still on call');") == 'recorded'
    status = json.loads(service('SELECT staff_access_review_status(90);'))
    admin_row = next(g for g in status['grants'] if g['kind'] == 'role' and g['grant'] == 'admin')
    assert admin_row['due'] is False and admin_row['lastReviewedAt'] is not None and status['stale'] == 1, status
    assert scalar(f"SELECT count(*) FROM audit_logs WHERE action = 'admin.access.reviewed' AND subject = '{I['admin']}'") == '1'
    check('a kept review is superadmin-only, audited in the same transaction, and restarts the cadence')

    for role in ('anon', 'authenticated'):
        rejected(f'SET ROLE {role}; SELECT count(*) FROM staff_access_reviews;', 'permission denied')
        rejected(f'SET ROLE {role}; SELECT staff_access_review_status(90);', 'permission denied')
        rejected(f"SET ROLE {role}; SELECT identity_metrics(now() - interval '1 day', now());", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT grant_parent_role_with_justification('{I['plain']}', '{I['boss']}', 'Support case 1234: in person');", 'permission denied')
    check('no browser role reads the review log or calls the staff functions')

    # ── Appendix M Part 1: identity_metrics ──────────────────────────────
    run(f"""
    UPDATE auth.users SET is_anonymous = true WHERE id IN ('{I['guest1']}', '{I['guest2']}');
    UPDATE auth.users SET raw_app_meta_data = '{{"provider": "google"}}' WHERE id IN ('{I['g_kid']}', '{I['g_teen']}', '{I['g_new']}');
    UPDATE auth.users SET created_at = now() - interval '400 days' WHERE id = '{I['old']}';
    INSERT INTO account_safety_origins (user_id) VALUES ('{I['guest1']}');
    SELECT record_age_declaration('{I['g_kid']}', 'under_13');
    SELECT record_age_declaration('{I['g_teen']}', '13_to_17');
    SELECT record_age_declaration('{I['mail']}', 'adult');
    INSERT INTO audit_logs (actor_id, action, subject, detail) VALUES
        ('{I['guest1']}', 'auth.guest.age_refusal', '{I['guest1']}', '{{"flagged": true}}'),
        ('{I['guest2']}', 'auth.guest.age_refusal', '{I['guest2']}', '{{"flagged": false}}'),
        ('{I['kid']}', 'auth.kid_email_change.refused', '{I['kid']}', '{{}}');
    UPDATE account_age_declarations SET created_at = now() - interval '300 days' WHERE user_id = '{I['mail']}';
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['ocr']}', '{I['kid']}', 'verified', now()), ('{I['ocr']}', '{I['kidpending']}', 'verified', now());
    -- A pending address left from before guard_kid_email (0197) existed: it is
    -- written before the kid role, since the guard now refuses it for a child.
    UPDATE auth.users SET email_change = 'escape@example.com' WHERE id = '{I['kidpending']}';
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['ocr']}'), ('{I['kidpending']}', 'kid', '{I['ocr']}');
    UPDATE profiles SET birth_date = '2016-05-01' WHERE user_id IN ('{I['kid']}', '{I['kidpending']}');
    """)
    m = json.loads(service("SELECT identity_metrics(now() - interval '30 days', now() + interval '1 minute');"))
    assert m['guestOrigin'] == {'requested': 2, 'flagged': 1, 'flaggedGuestsCreated': 1}, m['guestOrigin']
    assert m['googleAgeScreen'] == {'firstTime': 3, 'screened': 2}, m['googleAgeScreen']
    assert m['googleUnder13'] == {'declaredUnder13': 1, 'reclassified': 1}, m['googleUnder13']
    assert m['entryCapture']['google'] == {'created': 3, 'captured': 2}, m['entryCapture']
    assert m['entryCapture']['guest'] == {'created': 2, 'captured': 1}, m['entryCapture']
    assert m['entryCapture']['kid'] == {'created': 2, 'captured': 2}, m['entryCapture']
    email = m['entryCapture']['email']
    assert email['created'] >= 1 and email['captured'] >= 1, email
    assert m['undatedBacklog'] == {'existing': 1, 'undated': 1}, m['undatedBacklog']
    assert m['parentTags'] == {'holders': 4, 'idVerified': 1, 'staffGranted': 1, 'revoked': 1, 'untagged': 1}, m['parentTags']
    assert m['staffGrantJustification']['staffGranted'] == 2 and m['staffGrantJustification']['justified'] == 1, m['staffGrantJustification']
    assert m['revocation']['revokedRows'] == 1 and m['revocation']['auditedRevocations'] == 1, m['revocation']
    assert m['kidEmail'] == {'kids': 2, 'restricted': 1, 'refusalsInWindow': 1}, m['kidEmail']
    # F3-identity-site: the cancellation promise has parity only once a sweep that
    # looks for expired suspensions has run; the schema alone is not enough.
    assert m['faqCapabilities'] == {'secondGuardian': True, 'cancellationCascade': False, 'reportTool': True}, m['faqCapabilities']
    run("INSERT INTO audit_logs (actor_id, action, subject, detail) VALUES "
        "(NULL, 'account_deletions.sweep_ran', 'account_deletion_requests', '{\"scanned\": 0, \"limit\": 50}');")
    stale = json.loads(service("SELECT identity_metrics(now() - interval '30 days', now() + interval '1 minute');"))
    assert stale['faqCapabilities']['cancellationCascade'] is False, 'a sweep run that never read the suspensions is not parity'
    run("INSERT INTO audit_logs (actor_id, action, subject, detail) VALUES "
        "(NULL, 'account_deletions.sweep_ran', 'account_deletion_requests', '{\"scanned\": 0, \"limit\": 50, \"suspensionsExpired\": 0}');")
    m = json.loads(service("SELECT identity_metrics(now() - interval '30 days', now() + interval '1 minute');"))
    assert m['faqCapabilities'] == {'secondGuardian': True, 'cancellationCascade': True, 'reportTool': True}, m['faqCapabilities']
    check('FAQ parity for the cancellation promise needs the suspension triggers with the ban, the scheduled candidate read and a recent sweep that used it (F3-identity-site)')
    assert m['schemaFields']['originFlag']['consumed'] is True and m['schemaFields']['originFlag']['produced'] >= 2, m['schemaFields']
    # F1-data-platform retires the column (0199 expand, 0200 contract): after the
    # full chain it is no longer declared, so the Schema Field Utilization check passes.
    assert m['schemaFields']['documentType'] == {'declared': False, 'consumed': False}, m['schemaFields']
    assert m['flagPersistence']['upgraded'] >= 1 and m['flagPersistence']['upgraded'] == m['flagPersistence']['safeguarded'], m['flagPersistence']
    check('identity_metrics counts guest flags, Google screening and reclassification, entry-path capture, backlog, parent tags, justification, revocation, kid email and schema fields')
    rejected("SET ROLE service_role; SELECT identity_metrics(now(), now() - interval '1 day');", 'from < to')
    check('identity_metrics refuses an empty or inverted window')

    # ── A.2, Appendix M 1.1: onboarding discovery answers (target zero) ──
    # Rows written the way Core wrote them before the gap-fix round 2 gate: a
    # flagged guest, a kid, an under-13 declaration, a teen without an opt-in,
    # and one admitted adult.
    run(f"""
    INSERT INTO onboarding_responses (user_id, discovery_channel, account_offer_choice) VALUES
        ('{I['guest1']}', 'friend', 'later'), ('{I['kid']}', 'school', 'later'), ('{I['g_kid']}', 'search', 'later'),
        ('{I['g_teen']}', 'ad', 'later'), ('{I['mail']}', 'friend', 'created_now');
    """)
    d = json.loads(service('SELECT onboarding_discovery_metrics();'))
    assert d['answered'] == 5 and d['unconsented'] == 4, d
    assert d['flaggedOrigin'] >= 1 and d['kid'] == 1 and d['teenWithoutOptIn'] == 1, d
    for role in ('anon', 'authenticated'):
        rejected(f'SET ROLE {role}; SELECT onboarding_discovery_metrics();', 'permission denied')
    check('onboarding_discovery_metrics counts answers from refused populations and only the service role reads it')
    scrub = next((ROOT / 'database/migrations').glob('*_onboarding_discovery_metrics.sql'))
    run(scrub.read_text(encoding='utf-8'))
    d = json.loads(service('SELECT onboarding_discovery_metrics();'))
    assert d == {'answered': 1, 'unconsented': 0, 'flaggedOrigin': 0, 'kid': 0, 'under13Declared': 0, 'teenWithoutOptIn': 0}, d
    assert scalar('SELECT count(*) FROM onboarding_responses;') == '5', 'the completion markers stay'
    assert scalar(f"SELECT discovery_channel FROM onboarding_responses WHERE user_id = '{I['mail']}';") == 'friend'
    check('the onboarding_discovery_metrics scrub nulls refused answers, keeps every completion marker and the admitted answer')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; not PostgREST, GoTrue or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
