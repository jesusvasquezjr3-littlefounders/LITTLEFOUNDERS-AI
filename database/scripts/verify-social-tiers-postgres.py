"""E.8 age tiers and E.13 profile-field review against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim (the
anon/authenticated/service_role roles and an auth schema with users and
uid()/role()), applies EVERY migration in database/migrations in order, seeds
one account per population, and proves at the enforcing boundary:

  - public.profile_field_flags returns exactly the shared corpus
    (database/scripts/fixtures/profile-field-safety-cases.json), the same
    corpus Core's mirror is tested against;
  - public.social_tier classifies every population by age evidence, not role:
    parent-created child and guardian-linked under-13 origin = guardian;
    unlinked under-13 origin, guest, unscreened and role-less = closed;
    declared 13-17 = teen; declared adult and ID-verified parent = adult;
  - follow admission, for browser and service writers alike: into a teen
    only with the teen's recorded consent; out of a child only inside its
    family or back to an approved connection; nothing to or from closed;
    adults unchanged;
  - the teen consent queue: service-only, idempotent, audited, decided only
    by the teen, decline cooldown, per-requester pending cap, a child cannot
    initiate, withdrawal/removal/block all close the consent, and a closed
    consent cannot be reused;
  - browser visibility (social_subject_visible through the restrictive
    follows policy) matches the tiers, and a flagged minor profile is hidden
    from every non-family viewer while its family still sees it;
  - the E.13 write guard refuses a flagged username or display name for a
    minor from any writer, lets unrelated edits of a legacy flagged profile
    through, never touches adults, and every in-scope profile has a review
    (creation, edit, role grant, guardian link, age declaration, backfill);
  - the metric function returns counts only and no browser role can call
    any of the new functions or read the new tables.

Configuration (defaults match the repo's owned audit cluster):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
  LF_PG_REPORT optional path for a JSON report of the passed checks
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

database = 'lf_social_tiers_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    return run('SET ROLE service_role;' + query)


def as_user(user_id, query):
    return run(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{user_id}', false); {query}")


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


def tier(user_id):
    return service(f"SELECT social_tier('{user_id}')")


def visible(viewer, subject):
    return as_user(viewer, f"SELECT social_subject_visible('{subject}')").splitlines()[-1] == 't'


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # ── Classifier parity with the shared corpus ────────────────────────────
    corpus = json.loads((ROOT / 'database/scripts/fixtures/profile-field-safety-cases.json').read_text(encoding='utf-8'))
    for case in corpus['cases']:
        literal = case['value'].replace("'", "''")
        got = service(f"SELECT coalesce(array_to_json(profile_field_flags('{literal}'))::text, '[]')")
        assert json.loads(got) == case['flags'], (case, got)
    check(f"profile_field_flags matches all {len(corpus['cases'])} corpus cases (the corpus Core's mirror runs)")

    # ── One account per population ──────────────────────────────────────────
    ids = {name: str(uuid.uuid4()) for name in (
        'parent', 'parent2', 'kid', 'sibling', 'other_kid', 'origin_linked', 'origin_alone', 'guest',
        'teen', 'teen2', 'teen3', 'adult', 'adult2', 'stranger', 'unscreened', 'roleless', 'flagkid', 'flagteen')}
    I = ids
    run('INSERT INTO auth.users (id, email, is_anonymous) VALUES ' + ', '.join(
        f"('{v}', '{k}@example.com', {'true' if k == 'guest' else 'false'})" for k, v in ids.items()) + ';')
    run(f"""
    UPDATE profiles SET display_name = initcap(replace(p.k, '_', ' ')), username = p.k
      FROM (VALUES {', '.join(f"('{v}'::uuid, '{k}')" for k, v in ids.items())}) AS p(id, k)
      WHERE profiles.user_id = p.id;
    DELETE FROM user_roles WHERE user_id = '{I['roleless']}';
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL), ('{I['parent2']}', 'parent', NULL);
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01'), ('{I['parent2']}', 'verified', 'local-ocr', 'P', 'Two', '1984-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid']}', 'verified', now()), ('{I['parent']}', '{I['sibling']}', 'verified', now()),
        ('{I['parent2']}', '{I['other_kid']}', 'verified', now()), ('{I['parent']}', '{I['origin_linked']}', 'verified', now()),
        ('{I['parent2']}', '{I['flagkid']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['parent']}'),
        ('{I['sibling']}', 'kid', '{I['parent']}'), ('{I['other_kid']}', 'kid', '{I['parent2']}'), ('{I['flagkid']}', 'kid', '{I['parent2']}');
    INSERT INTO account_safety_origins (user_id) VALUES ('{I['origin_linked']}'), ('{I['origin_alone']}'), ('{I['guest']}');
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
        ('{I['teen']}', '13_to_17'), ('{I['teen2']}', '13_to_17'), ('{I['teen3']}', '13_to_17'), ('{I['flagteen']}', '13_to_17'),
        ('{I['adult']}', 'adult'), ('{I['adult2']}', 'adult'), ('{I['stranger']}', 'adult'), ('{I['kid']}', 'under_13');
    """)
    expected = {'parent': 'adult', 'parent2': 'adult', 'kid': 'guardian', 'sibling': 'guardian', 'other_kid': 'guardian',
                'origin_linked': 'guardian', 'origin_alone': 'closed', 'guest': 'closed', 'teen': 'teen', 'teen2': 'teen',
                'adult': 'adult', 'stranger': 'adult', 'unscreened': 'closed', 'roleless': 'closed', 'flagkid': 'guardian',
                'flagteen': 'teen'}
    for name, want in expected.items():
        assert tier(I[name]) == want, (name, tier(I[name]), want)
    run(f"UPDATE auth.users SET is_anonymous = true WHERE id = '{I['adult2']}'")
    assert tier(I['adult2']) == 'closed'
    run(f"UPDATE auth.users SET is_anonymous = false WHERE id = '{I['adult2']}'")
    check('social_tier: child, linked under-13 origin -> guardian; unlinked origin, guest, anonymous, unscreened, role-less -> closed; declared 13-17 -> teen; declared adult, ID-verified parent -> adult')

    # ── Follow admission by tier (browser writer) ───────────────────────────
    def follow(follower, followed):
        return as_user(follower, f"INSERT INTO follows (follower_id, followed_id) VALUES ('{follower}', '{followed}')")

    follow(I['adult'], I['stranger'])
    follow(I['teen'], I['adult2'])
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['adult']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['adult']}', '{I['teen']}')", 'SUBJECT_CONSENT_REQUIRED')
    rejected(f"SET ROLE service_role; INSERT INTO follows (follower_id, followed_id) VALUES ('{I['adult']}', '{I['teen']}')", 'SUBJECT_CONSENT_REQUIRED')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['teen2']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['teen2']}', '{I['teen']}')", 'SUBJECT_CONSENT_REQUIRED')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['kid']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['kid']}', '{I['stranger']}')", 'GUARDIAN_MANAGED_CONNECTIONS')
    rejected(f"SET ROLE service_role; INSERT INTO follows (follower_id, followed_id) VALUES ('{I['kid']}', '{I['adult']}')", 'GUARDIAN_MANAGED_CONNECTIONS')
    follow(I['kid'], I['parent'])
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['stranger']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['stranger']}', '{I['kid']}')", 'GUARDIAN_APPROVAL_REQUIRED')
    for closed in ('guest', 'unscreened', 'origin_alone'):
        rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I[closed]}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I[closed]}', '{I['adult']}')", 'SOCIAL_TIER_CLOSED')
        rejected(f"SET ROLE service_role; INSERT INTO follows (follower_id, followed_id) VALUES ('{I['adult']}', '{I[closed]}')", 'SOCIAL_TIER_CLOSED')
    check('follow admission: adult->adult and teen->adult allowed; into a teen refused without consent (browser, service, teen->teen); child->outsider refused (browser and service), child->own Tutor allowed; outsider->child still needs guardian approval; nothing to or from guest, unscreened or unlinked under-13 origin')

    # ── Teen consent queue ──────────────────────────────────────────────────
    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT request_teen_connection('{I['adult']}', '{I['teen']}')", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT decide_teen_connection('{uuid.uuid4()}', '{I['teen']}', true)", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM social_consent_requests", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT * FROM profile_safety_reviews", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT social_tier('{I['teen']}')", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT social_safety_metrics()", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT remove_social_follower('{I['teen']}', '{I['adult']}')", 'permission denied')
    rejected(f"SET ROLE service_role; INSERT INTO social_consent_requests (requester_id, subject_id) VALUES ('{I['adult']}', '{I['teen']}')", 'permission denied')
    rejected("SET ROLE anon; SELECT social_subject_visible(gen_random_uuid())", 'permission denied')
    check('browser roles cannot call or read any new function or table; even the service role writes consents only through the functions')

    req = service(f"SELECT request_teen_connection('{I['adult']}', '{I['teen']}')")
    assert service(f"SELECT request_teen_connection('{I['adult']}', '{I['teen']}')") == req
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.connection_requested' AND detail->>'request_id' = '{req}'") == '1'
    assert not visible(I['adult'], I['teen'])
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['kid']}', '{I['teen']}')", 'GUARDIAN_MANAGED_CONNECTIONS')
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['guest']}', '{I['teen']}')", 'SOCIAL_REQUEST_UNAVAILABLE')
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['teen']}', '{I['adult']}')", 'SOCIAL_REQUEST_UNAVAILABLE')
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['adult']}', '{I['kid']}')", 'SOCIAL_REQUEST_UNAVAILABLE')
    rejected(f"SET ROLE service_role; SELECT decide_teen_connection('{req}', '{I['teen2']}', true)", 'SOCIAL_REQUEST_NOT_FOUND')
    check('teen request: pending, idempotent, audited once, confers no visibility; a child cannot initiate; guest, non-teen targets refused; only the targeted teen can decide')

    assert service(f"SELECT decide_teen_connection('{req}', '{I['teen']}', true)") == 'accepted'
    assert service(f"SELECT decide_teen_connection('{req}', '{I['teen']}', true)") == 'accepted'
    rejected(f"SET ROLE service_role; SELECT decide_teen_connection('{req}', '{I['teen']}', false)", 'SOCIAL_DECISION_CONFLICT')
    assert run(f"SELECT count(*) FROM follows WHERE follower_id = '{I['adult']}' AND followed_id = '{I['teen']}'") == '1'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.connection_accepted' AND detail->>'request_id' = '{req}'") == '1'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.follow' AND subject = '{I['teen']}'") == '1'
    assert visible(I['adult'], I['teen'])
    assert not visible(I['stranger'], I['teen'])
    assert visible(I['adult'], I['adult']) and visible(I['stranger'], I['adult'])
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['adult']}', '{I['teen']}')", 'SOCIAL_ALREADY_CONNECTED')
    check('teen accepts: one edge, one decision audit, one follow audit; the accepted adult sees the teen, a stranger does not; the decision is final and a second request is refused')

    # The teen chose to follow adult2 earlier: that account may see the teen.
    assert visible(I['adult2'], I['teen'])
    follow(I['teen'], I['stranger'])
    assert visible(I['stranger'], I['teen'])
    check('a teen who follows someone is visible to that account (the teen chose it)')

    # Withdrawal closes consent; a raw re-follow is refused.
    as_user(I['adult'], f"SELECT withdraw_social_connection('{I['adult']}', '{I['teen']}')")
    assert run(f"SELECT status FROM social_consent_requests WHERE id = '{req}'") == 'withdrawn'
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['adult']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['adult']}', '{I['teen']}')", 'SUBJECT_CONSENT_REQUIRED')
    check('unfollowing withdraws the consent; the old consent cannot be reused for a raw re-follow')

    # Decline and cooldown; removal; block.
    req2 = service(f"SELECT request_teen_connection('{I['teen2']}', '{I['teen']}')")
    assert service(f"SELECT decide_teen_connection('{req2}', '{I['teen']}', false)") == 'declined'
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['teen2']}', '{I['teen']}')", 'SOCIAL_REQUEST_COOLDOWN')
    run(f"UPDATE social_consent_requests SET decided_at = now() - interval '31 days' WHERE id = '{req2}'")
    req3 = service(f"SELECT request_teen_connection('{I['teen2']}', '{I['teen']}')")
    assert service(f"SELECT decide_teen_connection('{req3}', '{I['teen']}', true)") == 'accepted'
    assert visible(I['teen2'], I['teen'])
    assert service(f"SELECT remove_social_follower('{I['teen']}', '{I['teen2']}')") == 't'
    assert service(f"SELECT remove_social_follower('{I['teen']}', '{I['teen2']}')") == 'f'
    assert run(f"SELECT status FROM social_consent_requests WHERE id = '{req3}'") == 'removed'
    assert not visible(I['teen2'], I['teen'])
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.follower_removed' AND subject = '{I['teen']}'") == '1'
    req4 = service(f"SELECT request_teen_connection('{I['adult']}', '{I['teen']}')")
    as_user(I['teen'], f"INSERT INTO blocks (blocker_id, blocked_id) VALUES ('{I['teen']}', '{I['adult']}')")
    assert run(f"SELECT status FROM social_consent_requests WHERE id = '{req4}'") == 'removed'
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['adult']}', '{I['teen']}')", 'SOCIAL_REQUEST_UNAVAILABLE')
    check('decline is respected for 30 days; the teen removes a follower (consent closed, audited, visibility gone); a block closes a pending consent and refuses new requests')

    # Pending cap per requester.
    many = [str(uuid.uuid4()) for _ in range(21)]
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{m}', 'bulk{n}@example.com')" for n, m in enumerate(many)) + ';')
    run('INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES ' + ', '.join(f"('{m}', '13_to_17')" for m in many) + ';')
    for m in many[:20]:
        service(f"SELECT request_teen_connection('{I['stranger']}', '{m}')")
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['stranger']}', '{many[20]}')", 'SOCIAL_REQUEST_LIMIT')
    check('one account holds at most 20 pending teen requests')

    # ── Child visibility unchanged, family intact ───────────────────────────
    assert visible(I['parent'], I['kid']) and visible(I['sibling'], I['kid'])
    assert not visible(I['stranger'], I['kid']) and not visible(I['parent2'], I['kid'])
    assert not visible(I['guest'], I['adult'])
    check('child visibility: own Tutor and sibling yes, strangers and other Tutors no; a closed-tier viewer sees no profile')

    # ── E.13 review coverage and write guard ────────────────────────────────
    in_scope = service('SELECT count(*) FROM profiles WHERE profile_review_in_scope(user_id)')
    reviewed = service('SELECT count(*) FROM profiles p JOIN profile_safety_reviews r USING (user_id) WHERE profile_review_in_scope(p.user_id)')
    assert in_scope == reviewed and int(in_scope) >= 30, (in_scope, reviewed)
    assert run(f"SELECT count(*) FROM profile_safety_reviews WHERE user_id IN ('{I['adult']}', '{I['stranger']}', '{I['guest']}')") == '0'
    check(f'every in-scope profile has a review ({reviewed}/{in_scope}); adults and closed accounts are not reviewed')

    # A legacy flagged child name (written before the guard, as the owner).
    run(f"ALTER TABLE profiles DISABLE TRIGGER profile_fields_guard; UPDATE profiles SET display_name = 'Ana Escuela Benito' WHERE user_id = '{I['flagkid']}'; ALTER TABLE profiles ENABLE TRIGGER profile_fields_guard;")
    assert service(f"SELECT profile_fields_flagged('{I['flagkid']}')") == 't'
    approve = service(f"SELECT request_social_connection('{I['adult']}', '{I['flagkid']}')")
    assert service(f"SELECT decide_social_connection('{approve}', '{I['parent2']}', true)") == 'approved'
    assert not visible(I['adult'], I['flagkid'])
    assert visible(I['parent2'], I['flagkid']) and visible(I['other_kid'], I['flagkid'])
    run(f"UPDATE profiles SET locale = 'es-MX' WHERE user_id = '{I['flagkid']}'")
    rejected(f"UPDATE profiles SET display_name = 'Ana 2016' WHERE user_id = '{I['flagkid']}'", 'PROFILE_FIELD_UNSAFE')
    rejected(f"SET ROLE service_role; UPDATE profiles SET display_name = 'ana@mail.com' WHERE user_id = '{I['flagkid']}'", 'PROFILE_FIELD_UNSAFE')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['flagkid']}', false); UPDATE profiles SET display_name = 'Roblox Ana' WHERE user_id = '{I['flagkid']}'", 'PROFILE_FIELD_UNSAFE')
    service(f"UPDATE profiles SET display_name = 'Ana' WHERE user_id = '{I['flagkid']}'")
    assert service(f"SELECT profile_fields_flagged('{I['flagkid']}')") == 'f'
    assert visible(I['adult'], I['flagkid'])
    check('a legacy flagged child name hides the child from an approved outsider while its family still sees it; unrelated edits pass; a flagged change is refused for the owner, service and browser writers; a safe rename clears the flag and restores the approved view')

    # Teen: flagged teen hidden and cannot connect; rename by the teen.
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['flagteen']}', false); UPDATE profiles SET username = 'ig_flagteen' WHERE user_id = '{I['flagteen']}'", 'PROFILE_FIELD_UNSAFE')
    run(f"ALTER TABLE profiles DISABLE TRIGGER profile_fields_guard; UPDATE profiles SET username = 'flagteen_2011' WHERE user_id = '{I['flagteen']}'; ALTER TABLE profiles ENABLE TRIGGER profile_fields_guard;")
    assert service(f"SELECT profile_fields_flagged('{I['flagteen']}')") == 't'
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['adult']}', '{I['flagteen']}')", 'SOCIAL_REQUEST_UNAVAILABLE')
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['flagteen']}', '{I['teen3']}')", 'PROFILE_REVIEW_REQUIRED')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['flagteen']}', false); INSERT INTO follows (follower_id, followed_id) VALUES ('{I['flagteen']}', '{I['adult']}')", 'PROFILE_REVIEW_REQUIRED')
    as_user(I['flagteen'], f"UPDATE profiles SET username = 'flagteen_ok' WHERE user_id = '{I['flagteen']}'")
    assert service(f"SELECT profile_fields_flagged('{I['flagteen']}')") == 'f'
    follow(I['flagteen'], I['adult'])
    check('a flagged teen cannot be requested, request or follow; the teen fixes it by renaming, which the guard accepts and the review clears')

    # Adults are out of scope; creation order of a child.
    as_user(I['adult'], f"UPDATE profiles SET display_name = 'Ana 1999 Maple Street' WHERE user_id = '{I['adult']}'")
    newkid = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('{newkid}', 'new@kids.invalid', '{{\"display_name\": \"Beto\"}}')")
    run(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{I['parent']}', '{newkid}', 'verified', now())")
    assert run(f"SELECT count(*) FROM profile_safety_reviews WHERE user_id = '{newkid}'") == '1'
    rejected(f"SET ROLE service_role; UPDATE profiles SET username = 'beto_roblox', display_name = 'Beto' WHERE user_id = '{newkid}'", 'PROFILE_FIELD_UNSAFE')
    service(f"UPDATE profiles SET username = 'beto_b', display_name = 'Beto' WHERE user_id = '{newkid}'")
    run(f"INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{newkid}', 'kid', '{I['parent']}')")
    assert tier(newkid) == 'guardian' and service(f"SELECT profile_fields_flagged('{newkid}')") == 'f'
    check('adults keep any display name; a child being created is reviewed from its guardian link on, before its role, and a flagged handle is refused')

    # Metrics: counts only.
    metrics = json.loads(service('SELECT social_safety_metrics()'))
    assert set(metrics) == {'accountsByTier', 'profileReview', 'teenConsent'}
    assert metrics['profileReview']['inScope'] == metrics['profileReview']['reviewed']
    assert metrics['profileReview']['guardianTierInScope'] == metrics['profileReview']['guardianTierReviewed']
    flat = json.dumps(metrics)
    assert all(v not in flat for v in ids.values())
    check(f"social_safety_metrics returns counts only: {flat}")

    report = {'database': database, 'server': run('SHOW server_version'), 'checks': checks}
    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
