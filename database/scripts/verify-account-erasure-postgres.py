"""E.6 account erasure against real PostgreSQL: the full migration chain, then
every deletion path's database contract.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack). It creates a throwaway database, installs a minimal Supabase shim (the
anon/authenticated/service_role roles, an auth schema with users,
audit_log_entries, sessions and uid()/role()), applies EVERY migration in
database/migrations in order, seeds a family, and proves:

  - the defect this checkpoint fixes: before an erasure is claimed, deleting a
    parent who is a child's last Tutor is still refused (the 0010 guards hold);
  - request / duplicate / not-due / cancel semantics and their audit rows;
  - an open E.3 safety review holds the erasure until staff resolve it;
  - erasing a parent removes the account, suspends the child it supervised
    alone (A.1), leaves a co-supervised child active, keeps every child record
    with the departed adult's provenance cleared, ends the voice consent it
    granted, removes the non-cascading rows (memory ledger, converted
    anonymous visitors and their events, email logs, GoTrue audit entries),
    and records the Depot and warehouse inventory on the request;
  - the core step is idempotent and completion refuses a missing step;
  - the 90-day suspension purge of that child erases it through the same
    function, keeping a content-addressed Depot object another learner shares;
  - staff accounts and every non-service role are refused;
  - the relaxed guards still refuse outside an erasure, and the lesson-version
    immutability guard accepts only an author's id being cleared.

Configuration (defaults match the repo's owned audit cluster):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
"""
from pathlib import Path
import json
import os
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
PSQL = os.environ.get('LF_PG_PSQL', str(ROOT / '.codex/audit-db/pgsql/bin/psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_account_erasure_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    return run('SET ROLE service_role;' + query)


def rejected(query, message):
    try:
        run(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'expected {message!r}, the statement succeeded')


def check(name):
    checks.append(name)


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    P1, P2, K1, K2, ADULT, OTHER_KID, STAFF = (str(uuid.uuid4()) for _ in range(7))
    ANON = str(uuid.uuid4())
    run(f"""
    INSERT INTO auth.users (id, email) VALUES
        ('{P1}', 'Parent.One@example.com'), ('{P2}', 'parent.two@example.com'),
        ('{K1}', 'k1@kids.invalid'), ('{K2}', 'k2@kids.invalid'), ('{ADULT}', 'adult@example.com'),
        ('{OTHER_KID}', 'k3@kids.invalid'), ('{STAFF}', 'staff@littlefounders.ai');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{P1}', 'parent', NULL), ('{P2}', 'parent', NULL);
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{P1}', '{K1}', 'verified', now()), ('{P1}', '{K2}', 'verified', now()), ('{P2}', '{K2}', 'verified', now()),
        ('{P2}', '{OTHER_KID}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES
        ('{K1}', 'kid', '{P1}'), ('{K2}', 'kid', '{P1}'), ('{OTHER_KID}', 'kid', '{P2}');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{STAFF}', 'superadmin', NULL);
    """)

    # Family Hub provenance P1 left behind on both children.
    run(f"""
    INSERT INTO wallet_ledger (kid_user_id, bucket, amount, reason, created_by) VALUES
        ('{K1}', 'save', 5, 'manual_adjustment', '{P1}'), ('{K2}', 'spend', 3, 'manual_adjustment', '{P1}');
    INSERT INTO allowance_rules (kid_user_id, parent_user_id, amount, frequency, anchor_day, next_run_at)
        VALUES ('{K2}', '{P1}', 10, 'weekly', 1, now() + interval '1 day');
    INSERT INTO savings_bonus_rules (kid_user_id, parent_user_id, rate_bp, next_run_at) VALUES ('{K2}', '{P1}', 100, now() + interval '1 day');
    INSERT INTO spend_limits (kid_user_id, parent_user_id, period, cap) VALUES ('{K2}', '{P1}', 'weekly', 50);
    INSERT INTO redemption_catalog (id, parent_user_id, title, cost) VALUES ('{str(uuid.uuid4())}', '{P2}', 'Park trip', 20);
    INSERT INTO redemptions (catalog_id, kid_user_id, status, decided_at, decided_by)
        SELECT id, '{K2}', 'approved', now(), '{P1}' FROM redemption_catalog WHERE parent_user_id = '{P2}';
    INSERT INTO banking_accounts (kid_user_id, display_number, opened_by, frozen, frozen_by, frozen_at)
        VALUES ('{K2}', 'LF-1234-5678', '{P1}', true, '{P1}', now());
    INSERT INTO tutor_voice_consent (user_id, granted_by, consent_text, locale) VALUES ('{K2}', '{P1}', 'I agree', 'en-US');
    INSERT INTO tasks (assigned_by, assigned_to, title, reward_coins, evidence_bucket, evidence_hash, evidence_ext)
        VALUES ('{P1}', '{K1}', 'Tidy up', 5, 'task-evidence', '{'e' * 64}', 'jpg');
    """)
    # A legacy badge share (the table refuses new rows since OD-20; seed as the owner).
    run(f"""
    ALTER TABLE badge_shares DISABLE TRIGGER badge_shares_refuse_insert;
    INSERT INTO badge_shares (token, kid_user_id, created_by, achievement_kind, achievement_label, first_name,
        image_bucket, image_hash, image_ext, image_url)
        VALUES ('{'t' * 32}', '{K1}', '{P1}', 'streak', '7-day streak', 'Ana', 'badges', '{'b' * 64}', 'png', 'http://depot/files/badges/{'b' * 64}.png');
    ALTER TABLE badge_shares ENABLE TRIGGER badge_shares_refuse_insert;
    """)
    # Social edges, mail, a converted anonymous visitor and its events, GoTrue audit entries.
    run(f"""
    INSERT INTO follows (follower_id, followed_id) VALUES ('{P1}', '{ADULT}'), ('{ADULT}', '{P1}');
    INSERT INTO blocks (blocker_id, blocked_id) VALUES ('{P2}', '{P1}');
    INSERT INTO email_logs (to_address, subject, user_id) VALUES ('parent.one@example.com', 'Welcome', NULL),
        ('x@example.com', 'Receipt', '{P1}'), ('someone@example.com', 'Other', NULL);
    INSERT INTO anon_visitors (anon_id, converted_user_id, converted_at) VALUES ('{ANON}', '{P1}', now());
    ALTER TABLE learning_events DISABLE TRIGGER optional_learning_event_admission;
    INSERT INTO learning_events (anon_id, role, event, route_class) VALUES ('{ANON}', 'anon', 'page_view', 'marketing');
    INSERT INTO learning_events (user_id, role, event, route_class) VALUES ('{P1}', 'parent', 'nav_view', 'family');
    ALTER TABLE learning_events ENABLE TRIGGER optional_learning_event_admission;
    INSERT INTO auth.audit_log_entries (payload) VALUES (json_build_object('actor_id', '{P1}', 'actor_username', 'Parent.One@example.com')),
        (json_build_object('actor_id', '{ADULT}'));
    INSERT INTO auth.sessions (user_id) VALUES ('{P1}');
    INSERT INTO audit_logs (actor_id, action, subject, detail) VALUES ('{P1}', 'family.kid_created', '{K1}', '{{}}');
    """)
    # K1's Mentor session audio: one object only K1 references, one another learner's turn shares.
    run(f"""
    INSERT INTO tutor_sessions (id, user_id, locale, tier, character, diorama, intent) VALUES
        ('{str(uuid.UUID(int=1))}', '{K1}', 'en-US', 1, 'dina', 'diorama-a', 'open'),
        ('{str(uuid.UUID(int=2))}', '{OTHER_KID}', 'en-US', 1, 'dina', 'diorama-a', 'open');
    INSERT INTO tutor_turns (session_id, seq, speaker, text, audio_path) VALUES
        ('{str(uuid.UUID(int=1))}', 0, 'tutor', 'Hi', 'tutor-speech/{'1' * 64}.mp3'),
        ('{str(uuid.UUID(int=1))}', 1, 'tutor', 'Shared line', 'tutor-speech/{'2' * 64}.mp3'),
        ('{str(uuid.UUID(int=2))}', 0, 'tutor', 'Shared line', 'tutor-speech/{'2' * 64}.mp3');
    INSERT INTO learner_memory_ledger (user_id, store, actor, after_hash) VALUES ('{K1}', 'learner', 'review', '{'c' * 64}');
    """)
    check('seeded two Tutors, a child supervised by one, a co-supervised child, Family Hub provenance, social edges, mail, anonymous events, Mentor audio')

    # The defect: a parent who is a child's last Tutor cannot be deleted outside an erasure.
    rejected(f"DELETE FROM auth.users WHERE id = '{P1}'", 'orphan a kid account')
    rejected(f"DELETE FROM guardian_links WHERE parent_user_id = '{P1}' AND kid_user_id = '{K1}'", 'Cannot remove the last verified guardian')
    check('outside an erasure the 0010 guards still refuse to orphan a child')

    # Only the service role may touch the lifecycle.
    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT request_account_deletion('{P1}', 'parent', 'self', 14, '{P1}')", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM account_deletion_requests", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT erase_account_data('{uuid.uuid4()}')", 'permission denied')
    rejected(f"SET ROLE service_role; INSERT INTO account_deletion_requests (subject_id, population, initiated_by, scheduled_for) VALUES ('{P1}', 'parent', 'self', now())", 'permission denied')
    rejected(f"SET ROLE service_role; UPDATE account_deletion_requests SET status = 'completed'", 'permission denied')
    check('browser roles cannot call or read the lifecycle; even the service role writes only through the audited functions')

    # Request, duplicate, not due, cancel.
    first = json.loads(service(f"SELECT row_to_json(r) FROM request_account_deletion('{P1}', 'parent', 'self', 14, '{P1}') r"))
    assert first['status'] == 'pending'
    grace = run(f"SELECT round(extract(epoch FROM scheduled_for - requested_at) / 86400) FROM account_deletion_requests WHERE id = '{first['id']}'")
    assert grace == '14', grace
    rejected(f"SET ROLE service_role; SELECT request_account_deletion('{P1}', 'parent', 'self', 14, '{P1}')", 'DELETION_ALREADY_OPEN')
    assert service(f"SELECT claim_account_deletion('{first['id']}') IS NULL") == 't'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'account.deletion_requested' AND subject = '{P1}'") == '1'
    cancelled = json.loads(service(f"SELECT row_to_json(r) FROM cancel_account_deletion('{P1}') r"))
    assert cancelled['status'] == 'cancelled' and cancelled['cancelled_at']
    rejected(f"SET ROLE service_role; SELECT cancel_account_deletion('{P1}')", 'NO_OPEN_DELETION')
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'account.deletion_cancelled' AND subject = '{P1}'") == '1'
    assert run(f"SELECT count(*) FROM auth.users WHERE id = '{P1}'") == '1'
    check('a request is pending for exactly the grace period, a second is refused, it is not claimable early, and cancelling keeps the account (all audited)')

    # An open safety review holds the erasure.
    request = json.loads(service(f"SELECT row_to_json(r) FROM request_account_deletion('{P1}', 'parent', 'self', 0, '{P1}') r"))
    run(f"INSERT INTO social_review_cases (subject_id, origin) VALUES ('{P1}', 'report')")
    held = json.loads(service(f"SELECT row_to_json(r) FROM claim_account_deletion('{request['id']}') r"))
    assert held['status'] == 'held' and held['held_reason'] == 'open_safety_review', held
    rejected(f"SET ROLE service_role; SELECT erase_account_data('{request['id']}')", 'ERASURE_NOT_CLAIMED')
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'account.deletion_held' AND subject = '{P1}'") == '1'
    run(f"UPDATE social_review_cases SET status = 'resolved', resolved_at = now() WHERE subject_id = '{P1}'")
    claimed = json.loads(service(f"SELECT row_to_json(r) FROM claim_account_deletion('{request['id']}') r"))
    assert claimed['status'] == 'processing' and claimed['attempts'] == 1, claimed
    assert service(f"SELECT claim_account_deletion('{request['id']}') IS NULL") == 't'
    check('an open safety review holds the erasure and nothing can be erased while held; resolution releases it; a fresh claim is exclusive')

    # Erase the parent.
    counts = json.loads(service(f"SELECT erase_account_data('{request['id']}')"))
    assert counts['account'] == 1 and counts['guardian_links'] == 2, counts
    assert counts['anon_visitors'] == 1 and counts['email_logs'] == 2 and counts['follows'] == 2 and counts['blocks'] == 1, counts
    assert counts['voice_consents_ended'] == 1 and counts['gotrue_audit_entries'] == 1, counts
    assert run(f"SELECT count(*) FROM auth.users WHERE id = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM auth.sessions WHERE user_id = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM profiles WHERE user_id = '{P1}'") == '0'
    assert run(f"SELECT suspended_at IS NOT NULL FROM profiles WHERE user_id = '{K1}'") == 't'
    assert run(f"SELECT suspended_at IS NULL FROM profiles WHERE user_id = '{K2}'") == 't'
    assert run(f"SELECT granted_by IS NULL FROM user_roles WHERE user_id = '{K2}' AND role = 'kid'") == 't'
    assert run(f"SELECT count(*) FROM wallet_ledger WHERE kid_user_id IN ('{K1}', '{K2}') AND created_by IS NULL") == '2'
    assert run(f"SELECT opened_by IS NULL AND frozen_by IS NULL AND frozen FROM banking_accounts WHERE kid_user_id = '{K2}'") == 't'
    assert run(f"SELECT (SELECT count(*) FROM allowance_rules WHERE parent_user_id IS NULL) + (SELECT count(*) FROM savings_bonus_rules WHERE parent_user_id IS NULL) + (SELECT count(*) FROM spend_limits WHERE parent_user_id IS NULL AND active)") == '3'
    assert run(f"SELECT decided_by IS NULL FROM redemptions WHERE kid_user_id = '{K2}'") == 't'
    assert run(f"SELECT revoked_at IS NOT NULL AND granted_by IS NULL FROM tutor_voice_consent WHERE user_id = '{K2}'") == 't'
    assert run(f"SELECT count(*) FROM tasks WHERE assigned_by = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM badge_shares WHERE created_by = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM learning_events WHERE anon_id = '{ANON}' OR user_id = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM email_logs") == '1'
    assert run(f"SELECT count(*) FROM auth.audit_log_entries") == '1'
    assert run(f"SELECT count(*) FROM follows WHERE follower_id = '{P1}' OR followed_id = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM audit_logs WHERE actor_id = '{P1}'") == '0'
    assert run(f"SELECT count(*) FROM audit_logs WHERE subject = '{K1}' AND action = 'family.kid_created' AND actor_id IS NULL") == '1'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'account.erased' AND subject = '{P1}'") == '1'
    row = json.loads(run(f"SELECT row_to_json(r) FROM account_deletion_requests r WHERE id = '{request['id']}'"))
    assert sorted(row['depot_paths']) == sorted([f"badges/{'b' * 64}.png", f"task-evidence/{'e' * 64}.jpg"]), row['depot_paths']
    assert row['anon_ids'] == [ANON], row['anon_ids']
    check('erasing a last-Tutor parent deletes the account and its sessions, suspends the child it supervised alone (A.1), leaves the co-supervised child active')
    check('child records survive with the departed adult cleared (ledger, account open/freeze, allowance, bonus, spend limit still active, redemption decision); the voice consent it granted ends')
    check('non-cascading rows are removed (converted visitor and its events, mail by id and by address case-insensitively, GoTrue audit entries); audit actor ids are cleared while subjects remain')
    check('the Depot and warehouse inventory (evidence, legacy badge image, anonymous ids) is stored on the request in the same transaction')

    # Idempotent core step; completion needs every step.
    again = json.loads(service(f"SELECT erase_account_data('{request['id']}')"))
    assert again == counts
    rejected(f"SET ROLE service_role; SELECT complete_account_deletion('{request['id']}')", 'DELETION_INCOMPLETE')
    rejected(f"SET ROLE service_role; SELECT record_account_deletion_step('{request['id']}', 'core', '{{}}', NULL, NULL)", 'INVALID_DELETION_STEP')
    service(f"SELECT record_account_deletion_step('{request['id']}', 'core', NULL, 'transient', NULL)")
    assert run(f"SELECT last_error FROM account_deletion_requests WHERE id = '{request['id']}'") == 'core: transient'
    service(f"SELECT record_account_deletion_step('{request['id']}', 'oracle', '{{\"live\":0}}', NULL, NULL)")
    service(f"SELECT record_account_deletion_step('{request['id']}', 'depot', NULL, 'depot unreachable', '[\"badges/{'b' * 64}.png\"]')")
    assert run(f"SELECT last_error FROM account_deletion_requests WHERE id = '{request['id']}'") == 'depot: depot unreachable'
    service(f"SELECT record_account_deletion_step('{request['id']}', 'dataintel', '{{\"events\":1}}', NULL, NULL)")
    rejected(f"SET ROLE service_role; SELECT complete_account_deletion('{request['id']}')", 'DELETION_INCOMPLETE')
    service(f"SELECT record_account_deletion_step('{request['id']}', 'depot', '{{\"deleted\":2}}', NULL, '[]')")
    done = json.loads(service(f"SELECT row_to_json(r) FROM complete_account_deletion('{request['id']}') r"))
    assert done['status'] == 'completed' and done['depot_paths'] == [] and done['anon_ids'] == [] and done['last_error'] is None
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'account.deletion_completed' AND subject = '{P1}'") == '1'
    rejected(f"SET ROLE service_role; SELECT complete_account_deletion('{request['id']}')", 'DELETION_NOT_PROCESSING')
    check('the core step is idempotent and only a core FAILURE can be recorded from outside; completion is refused while a step or a Depot object is outstanding, then records and audits the completion')

    # A.1's 90-day purge of the suspended child goes through the same erasure.
    purge = json.loads(service(f"SELECT row_to_json(r) FROM request_account_deletion('{K1}', 'kid', 'suspension_expiry', 0, NULL) r"))
    service(f"SELECT claim_account_deletion('{purge['id']}')")
    kid_counts = json.loads(service(f"SELECT erase_account_data('{purge['id']}')"))
    assert kid_counts['account'] == 1 and kid_counts['learner_memory_ledger'] == 1, kid_counts
    assert kid_counts['depot_objects'] == 1 and kid_counts['depot_shared_kept'] == 1, kid_counts
    row = json.loads(run(f"SELECT row_to_json(r) FROM account_deletion_requests r WHERE id = '{purge['id']}'"))
    assert row['depot_paths'] == [f"tutor-speech/{'1' * 64}.mp3"], row['depot_paths']
    # The count alone is not evidence (a no-op statement also reports one row).
    assert run(f"SELECT count(*) FROM learner_memory_ledger WHERE user_id = '{K1}'") == '0'
    assert run(f"SELECT count(*) FROM tutor_sessions WHERE user_id = '{K1}'") == '0'
    assert run(f"SELECT count(*) FROM tutor_turns WHERE audio_path = 'tutor-speech/{'2' * 64}.mp3'") == '1'
    assert run(f"SELECT count(*) FROM wallet_ledger WHERE kid_user_id = '{K1}'") == '0'
    check('the suspended child is purged through the same erasure; its memory ledger goes; a Depot object another learner still references is kept')

    # A co-supervised child deleted by the remaining Tutor (guardian path).
    kid = json.loads(service(f"SELECT row_to_json(r) FROM request_account_deletion('{K2}', 'kid', 'guardian', 0, '{P2}') r"))
    service(f"SELECT claim_account_deletion('{kid['id']}')")
    assert json.loads(service(f"SELECT erase_account_data('{kid['id']}')"))['account'] == 1
    assert run(f"SELECT count(*) FROM banking_accounts WHERE kid_user_id = '{K2}'") == '0'
    assert run(f"SELECT count(*) FROM redemption_catalog WHERE parent_user_id = '{P2}'") == '1'
    check('a Tutor deleting a child with a single remaining link succeeds through the erasure (no last-guardian refusal)')

    # Staff refusal at both functions.
    rejected(f"SET ROLE service_role; SELECT request_account_deletion('{STAFF}', 'adult', 'self', 14, '{STAFF}')", 'STAFF_ACCOUNT')
    late = json.loads(service(f"SELECT row_to_json(r) FROM request_account_deletion('{ADULT}', 'adult', 'self', 0, '{ADULT}') r"))
    run(f"UPDATE auth.users SET email = 'adult@littlefounders.ai' WHERE id = '{ADULT}'")
    run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{ADULT}', 'superadmin', NULL)")
    service(f"SELECT claim_account_deletion('{late['id']}')")
    rejected(f"SET ROLE service_role; SELECT erase_account_data('{late['id']}')", 'STAFF_ACCOUNT')
    assert run(f"SELECT count(*) FROM auth.users WHERE id = '{ADULT}'") == '1'
    check('a staff account is refused at request time and again at erasure time, and nothing is deleted')

    # An account already gone records an empty core step.
    gone = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{gone}', 'gone@example.com')")
    orphan = json.loads(service(f"SELECT row_to_json(r) FROM request_account_deletion('{gone}', 'adult', 'self', 0, '{gone}') r"))
    service(f"SELECT claim_account_deletion('{orphan['id']}')")
    run(f"DELETE FROM auth.users WHERE id = '{gone}'")
    assert json.loads(service(f"SELECT erase_account_data('{orphan['id']}')")) == {'account': 0}
    check('an account removed out of band records an empty core step instead of failing forever')

    # Guards outside an erasure; the provenance-only relaxations are exact.
    rejected(f"DELETE FROM guardian_links WHERE kid_user_id = '{OTHER_KID}'", 'Cannot remove the last verified guardian')
    rejected(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{P2}', 'kid', NULL)", 'MUST have at least 1 verified guardian')
    rejected(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{P2}', 'admin', NULL)", 'must have a granted_by actor')
    rejected(f"UPDATE user_roles SET role = 'kid' WHERE user_id = '{P2}' AND role = 'parent'", 'MUST have at least 1 verified guardian')
    run("""
    CREATE TABLE immut_probe (id int PRIMARY KEY, body text, created_by uuid);
    CREATE TRIGGER immut_probe_guard BEFORE UPDATE OR DELETE ON immut_probe
        FOR EACH ROW EXECUTE FUNCTION reject_lesson_document_version_mutation();
    INSERT INTO immut_probe VALUES (1, 'v1', gen_random_uuid());
    """)
    rejected("UPDATE immut_probe SET body = 'v2'", 'immutable')
    rejected("UPDATE immut_probe SET body = 'v2', created_by = NULL", 'immutable')
    rejected("DELETE FROM immut_probe", 'immutable')
    run("UPDATE immut_probe SET created_by = NULL")
    check('outside an erasure the guards still refuse; the kid/admin/lesson-version relaxations accept only a provenance id being cleared')

    print(json.dumps({'database': database, 'checks': checks}, indent=2))
    print(f'account-erasure PostgreSQL verification OK — {len(checks)} checks')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
